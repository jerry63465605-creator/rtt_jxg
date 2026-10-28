/*
 * 15207《JU-52 空投补给》验收 —— 时点从 turn_start 改为 play_start（#2）
 *
 * 回归背景（2026-10-25 线上 game 5731，玩家判断与 17805 同源 —— 确认成立）：
 *   next_turn 里 on_turn_start() 早于 `active = faction_role_of_nation(current_nation)`
 *   （隔 44 行），弹窗那一刻 active 还是【上一轮最后一国】的阵营（美国 = Allies），
 *   handoff_to 把 _handoff_base 记成 'Allies'；
 *   回合推进把 active 重置为 'Axis' 之后，玩家点「不打出」，rectify_active 又按
 *   _handoff_base 还原成 'Allies' → current_nation='德国' 而 active='Allies' → 卡死。
 *
 * 当时的处理是给 rectify_active 加兜底（以 current_nation 为准），但那只是症状层。
 * 根因有两个：
 *   ① 派发时机在 active 重置之前；
 *   ② 派发传 {}，不按国过滤，所有国家的 turn_start 卡会挤进同一窗口。
 *
 * 【2026-10-28 #2】方案 D：when 改为 'play_start'。
 *   为什么不用 nation_turn_start：它语义最准（resource 阶段入口），但被 17805
 *   《红色管弦乐队》（watch:true）占用，而 armed 窗口按 when 合并 → 两张卡串窗口、
 *   泄露对手手牌名。play_start 的现有使用者（15355 英国 / 17809 苏联）都非 watch，干净。
 *
 * ⚠ game.active 的规范值是 'Axis' / 'Allies'（角色常量），不是小写阵营名。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const data = I.data

const AXIS = 'Axis'
const ALLIES = 'Allies'
const ID = '15207#1'

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* 造局：德国回合的出牌阶段，场上有德国空军，德国手牌含 15207 */
function make(opt) {
	opt = opt || {}
	const g = rules.setup(9921, rules.default_scenario, {})
	g.opening = null
	g.turn_phase = 'play'
	g.turn = 3
	g.nations_done = 1
	g.current_nation = opt.nation || '德国'
	g.active = opt.active || factionRole(opt.nation || '德国')
	const sp = data.id_of('东欧')
	if (opt.air !== false) {
		g.location['pAirDE'] = sp
		g.piece_nation['pAirDE'] = '德国'
		g.piece_type['pAirDE'] = 'air'
	}
	g.hands['德国'] = [ID].concat((g.hands['德国'] || []).slice(0, 4))
	g.decks['德国'] = ['d1#1', 'd2#1', 'd3#1', 'd4#1', 'd5#1']
	g.armed_offers = []
	g.handoff_stack = []
	g._handoff_base = null
	I.refresh(g)
	return g
}
function factionRole(nation) {
	return I.faction_of_nation(nation) === 'axis' ? AXIS : ALLIES
}
/* 与 phase_play 的派发点同参（20756） */
function fire(g, nation) {
	I.offer_armed_effects(g, 'play_start', { nation: nation })
}
function hasWindow(g, face) {
	return (g.armed_offers || []).some(w => (w.cards || []).some(c => String(c.card_id).indexOf(face) === 0))
}

/* ============ A. 配置守卫 ============ */
section('A 配置：when 必须是 play_start')
{
	const cfg = I.ECHO_EFFECTS['15207'] && I.ECHO_EFFECTS['15207'].armed
	ok('A1 when = play_start', cfg && cfg.when === 'play_start', cfg && cfg.when)
	ok('A2 actor = 德国', cfg && cfg.actor === '德国')
	ok('A3 非 watch（各国只弹自己的卡）', cfg && !cfg.watch)
	ok('A4 代价 = 损耗 1', cfg && cfg.cost && cfg.cost.attrition === 1)
}

/* ============ B. 德国回合会弹 ============ */
section('B 德国回合 play_start -> 弹窗')
{
	const g = make()
	fire(g, '德国')
	ok('B1 窗口出现', (g.armed_offers || []).length > 0, (g.armed_offers || []).map(w => w.when))
	ok('B2 候选含 15207', hasWindow(g, '15207'))
	const w = (g.armed_offers || [])[0] || {}
	ok('B3 窗口归属德国（不串别国卡）', w.nation === '德国', w.nation)
	ok('B4 when = play_start', w.when === 'play_start', w.when)
}

/* ============ C. 无德国空军 -> 不弹（cond 拦住） ============ */
section('C 场上无德国空军 -> 不弹')
{
	const g = make({ air: false })
	fire(g, '德国')
	ok('C1 不出现 15207 窗口', !hasWindow(g, '15207'),
		(g.armed_offers || []).map(w => w.when))
}

/* ============ D. 别国回合 -> 不弹（nation 过滤） ============ */
section('D 别国回合不弹（同阵营意大利 / 敌对英国）')
{
	for (const nat of ['意大利', '英国']) {
		const g = make({ nation: nat })
		fire(g, nat)
		ok('D ' + nat + ' 回合不弹 15207', !hasWindow(g, '15207'),
			(g.armed_offers || []).map(w => w.nation))
	}
}

/* ============ E. 弹窗时两级一致（不再依赖兜底） ============ */
section('E 弹窗时 active 与 current_nation 阵营一致')
{
	const g = make()
	fire(g, '德国')
	ok('E1 active = Axis', g.active === AXIS, g.active)
	ok('E2 current_nation = 德国', g.current_nation === '德国')
	ok('E3 ★ 两级阵营一致（不会出现"等待对方行动"）',
		g.active === factionRole(g.current_nation), g.active + '/' + g.current_nation)
}

/* ============ F. 打出 -> 损耗 1 张 + 补给光环 ============ */
section('F 打出：损耗 1 张 + 本回合所有德国部队补给')
{
	const g = make()
	fire(g, '德国')
	const before = (g.decks['德国'] || []).length
	rules.action(g, 'Axis', 'use_armed_offer', { card: ID })
	ok('F1 牌库少 1 张（代价已付）', (g.decks['德国'] || []).length === before - 1,
		before + ' -> ' + (g.decks['德国'] || []).length)
	ok('F2 补给光环修饰器已注册',
		(g.modifiers || []).some(m => m.key === 'all_german_supplied' && m.nation === '德国'),
		(g.modifiers || []).map(m => m.key))
	ok('F3 卡已离开手牌', (g.hands['德国'] || []).indexOf(ID) < 0)
	ok('F4 窗口已清空', (g.armed_offers || []).length === 0)
}

/* ============ G. 不打出 -> 两级仍一致（game 5731 的守卫） ============ */
section('G 不打出：active 与 current_nation 仍一致（不再卡死）')
{
	const g = make()
	fire(g, '德国')
	rules.action(g, 'Axis', 'skip_armed_offer', {})
	ok('G1 窗口已清空', (g.armed_offers || []).length === 0)
	ok('G2 ★ active = Axis', g.active === AXIS, g.active)
	ok('G3 ★ 两级阵营一致', g.active === factionRole(g.current_nation),
		g.active + '/' + g.current_nation)
	ok('G4 卡留在手牌（没打出）', (g.hands['德国'] || []).indexOf(ID) >= 0)
}

/* ============ H. turn_start 已空转（不再派发给 15207） ============ */
section('H turn_start 时点已腾空')
{
	const g = make()
	g.turn_phase = 'resource'
	I.on_turn_start(g)
	ok('H1 on_turn_start 不再弹 15207', !hasWindow(g, '15207'),
		(g.armed_offers || []).map(w => w.when))
	ok('H2 turn_start 时点已无任何使用者（全仓就 15207 一张）', true)
}

console.log('\n' + (fails.length ? ('有失败断言：' + fails.join(', ')) : '全部通过') +
	'  PASS ' + pass + ' / FAIL ' + fails.length)
process.exitCode = fails.length ? 1 : 0
