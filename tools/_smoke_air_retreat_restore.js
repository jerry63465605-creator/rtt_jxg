/*
 * 【2026-10-28】免死卡 × 空军撤退复原 验收
 *
 * 玩家口径（2026-10-28）：
 *   · 「免死的飞机撤退时，发动后飞机应回原处而不是撤退」
 *   · 「要求正常飞机互相替代死亡和抵消的情况无影响」—— 代受死亡 / 抵消死亡【不复活】
 *   · 「无处可撤的也要复活」
 *   · 「victim 受保护时不撤退空军」（方案 b）
 *
 * 实现：新增原子 restore_retreated_airs(game, ctx)，10 张免死/还原类响应卡统一调用：
 *   15330 / 15332 / 15334 / 15337 / 15420 / 15421 / 15436 / 17730 / 17733 / 17735
 *
 * 地图事实（实测，决定夹具）：
 *   · 不列颠(2) 只与 北海(17) 相邻 —— 没有任何陆路邻区，
 *     所以「德国陆军攻击不列颠」在引擎里构造不出来（battle_initiators 恒为空）。
 *   · 西欧(6) 与 德国(44) 相邻 -> 陆战夹具用西欧，英国陆军/空军放西欧。
 *   · 北海(17) 与西欧/不列颠相邻 -> 15332 的 filter 场景用北海海战。
 *
 * 全部走真实引擎路径：
 *   rules.action(play_card)     -> 发起战斗，挂起等防守方
 *   rules.action(resolve_battle)-> 代受 / 不代受 / 抵消
 *   rules.action(trigger_response)-> 发动免死卡，结算响应栈
 * 只有「摆棋子 / 摆桌面响应卡 / 预言 protect」是测试手段。
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const data = I.data

const UK = data.id_of('不列颠')   /* 2 */
const NS = data.id_of('北海')     /* 17 */
const WE = data.id_of('西欧')     /* 6 */
const GE = data.id_of('德国')     /* 44 */

const WAR = '15201#1'             /* 德国【发起陆战/海战】基本卡 */

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }
const loc = (g, p) => g.location[p] == null ? null : data.name_of(g.location[p])

/*
 * 造局（opt.space 决定战场）：
 *   opt.space = WE  -> 英国陆军 uk_army + 英国空军 uk_air 在西欧，德国陆军 de_a + 德国空军 de_air 在德国
 *   opt.space = NS  -> 英国海军 uk_navy + 英国空军 uk_air 在北海，英国陆军 uk_home 在不列颠（撤退载体），
 *                      德国陆军 de_a 在西欧（可对北海发起），德国空军 de_air 在南大西洋
 *   opt.cards   -> 桌面响应卡（face id 数组）
 */
function make(opt) {
	opt = opt || {}
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.active = 'axis'
	g.current_nation = '德国'
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1

	/* 清空所有初始棋子，避免 victim 选错 / 补给干扰 */
	for (const pid of Object.keys(g.location)) delete g.location[pid]

	const put = (pid, sid, nat, ty) => {
		g.location[pid] = sid
		g.piece_nation[pid] = nat
		g.piece_type[pid] = ty
	}

	if (opt.space === NS) {
		put('uk_navy', NS, '英国', 'navy')
		put('uk_air', NS, '英国', 'air')
		put('uk_home', UK, '英国', 'army')     /* 空军撤退载体 */
		put('de_a', WE, '德国', 'army')        /* 西欧邻北海，可对北海发起 */
		put('de_air', data.id_of('南大西洋'), '德国', 'air')
	} else {
		put('uk_army', WE, '英国', 'army')
		put('uk_air', WE, '英国', 'air')
		put('de_a', GE, '德国', 'army')
		put('de_air', GE, '德国', 'air')
	}

	g.hands = g.hands || {}
	g.hands['德国'] = [WAR]

	g.table_responses = []
	for (const face of (opt.cards || [])) {
		g.table_responses.push({ card_id: face + '#1', nation: '英国', owner_side: 'allies' })
	}

	I.refresh(g)
	g.response_stack = []
	g.pending_battle = null
	return g
}

/*
 * 发起战斗：play_card 的 piece 参数是【被攻击的目标敌方部队】（不是发起单位），
 * 发起单位由服务端从 battle_initiators 里选（本局固定 de_a）。
 */
function startBattle(g, target) {
	const victim = (target === NS) ? 'uk_navy' : 'uk_army'
	rules.action(g, 'Axis', 'play_card', { card: WAR, space: target, piece: victim })
	return g.pending_battle
}
function frames(g) { return (g.response_stack || []) }
function hasFrame(g, face) { return frames(g).some(f => String(f.card_face) === face) }
function trigger(g) { return rules.action(g, 'Allies', 'trigger_response', {}) }

/* ============================================================
 * S1 不代受 -> 空军撤退 -> 无处可撤被删除 -> 15330 发动 -> 陆军回位 + 空军【复活】
 * ============================================================ */
section('S1 不代受撤退（无处可撤被删）-> 15330 发动 -> 陆军与空军都回位')
{
	const g = make({ space: WE, cards: ['15330'] })
	const pb = startBattle(g, WE)
	ok('发起陆战：挂起等防守方（stage=defend）', !!pb && (pb.stage || 'defend') === 'defend')
	ok('  防守方是英国', pb && pb.defender_nation === '英国', pb && pb.defender_nation)

	rules.action(g, 'Allies', 'resolve_battle', { declined: true })
	ok('不代受：英国陆军被移除', g.location['uk_army'] == null)
	ok('不代受：英国空军无处可撤（西欧邻区无英国载体）-> 被删除', g.location['uk_air'] == null,
		loc(g, 'uk_air'))
	ok('响应栈出现 15330 帧', hasFrame(g, '15330'))
	const f = frames(g).find(x => String(x.card_face) === '15330')
	ok('  帧 ctx 带 retreated_airs（含 uk_air）',
		!!f && (f.ctx.retreated_airs || []).indexOf('uk_air') >= 0,
		f && f.ctx.retreated_airs)

	trigger(g)
	ok('★ 15330 发动后：英国陆军回到西欧', loc(g, 'uk_army') === '西欧', loc(g, 'uk_army'))
	ok('★ 15330 发动后：被删除的英国空军【复活】回西欧', loc(g, 'uk_air') === '西欧', loc(g, 'uk_air'))
}

/* ============================================================
 * S2 同样局面但不发动 -> 陆军与空军都不回来（确认没有「自动复原」）
 * ============================================================ */
section('S2 不代受撤退 -> 不发动 15330 -> 陆军与空军都不回来')
{
	const g = make({ space: WE, cards: ['15330'] })
	startBattle(g, WE)
	rules.action(g, 'Allies', 'resolve_battle', { declined: true })
	ok('陆军已移除', g.location['uk_army'] == null)
	ok('空军已移除', g.location['uk_air'] == null)
	rules.action(g, 'Allies', 'pass_response', {})
	ok('不发动后：陆军仍不在场（不许凭空复原）', g.location['uk_army'] == null)
	ok('不发动后：空军仍不在场', g.location['uk_air'] == null)
}

/* ============================================================
 * S3 15332 只认「不列颠/北海」-> 西欧战斗不该弹
 * ============================================================ */
section('S3 15332 filter：西欧的英国部队被移除 -> 不弹')
{
	const g = make({ space: WE, cards: ['15332'] })
	startBattle(g, WE)
	rules.action(g, 'Allies', 'resolve_battle', { declined: true })
	ok('英国陆军被移除', g.location['uk_army'] == null)
	ok('★ 15332 不在响应栈（地区不匹配）', !hasFrame(g, '15332'),
		frames(g).map(x => x.card_face))
}

/* ============================================================
 * S4 15332 在北海生效：海军被移除 -> 海军与撤退到不列颠的空军都回北海
 * ============================================================ */
section('S4 北海：不代受撤退（撤到不列颠）-> 15332 发动 -> 海军与空军都回北海')
{
	const g = make({ space: NS, cards: ['15332'] })
	/*
	 * 这里不能走 play_card：play_card 对海区目标要求【海军】发起且发起单位补给，
	 * 而本夹具的德国只有西欧陆军（西欧邻北海）。故直接从 do_battle 入口驱动 ——
	 * 这与服务端卡效果内部发起战斗走的是同一个函数（不是测试专用旁路）。
	 */
	I.do_battle(g, '德国', NS, 'uk_navy', 'sea', { from: 'de_a' })
	ok('对北海发起海战并挂起', !!g.pending_battle && g.pending_battle.defender_nation === '英国',
		g.pending_battle && g.pending_battle.stage)

	rules.action(g, 'Allies', 'resolve_battle', { declined: true })
	ok('不代受：英国海军被移除', g.location['uk_navy'] == null)
	ok('不代受：英国空军撤到不列颠', loc(g, 'uk_air') === '不列颠', loc(g, 'uk_air'))
	ok('响应栈出现 15332 帧', hasFrame(g, '15332'))

	trigger(g)
	ok('★ 15332 发动后：英国海军回到北海', loc(g, 'uk_navy') === '北海', loc(g, 'uk_navy'))
	ok('★ 15332 发动后：撤到不列颠的空军回到北海', loc(g, 'uk_air') === '北海', loc(g, 'uk_air'))
}

/* ============================================================
 * S5【玩家核心场景】英国陆军 + 英国空军 A（同地区）+ 德国空军 B（相邻）
 *    防守方代受 A -> 发起方用 B 抵消 -> A/B/陆军 三方皆死
 *    -> 15330 发动 -> 陆军回位；A、B【不得复活】
 * ============================================================ */
section('S5 代受 + 抵消 + 15330：陆军回位，双方空军不复活')
{
	const g = make({ space: WE, cards: ['15330'] })
	startBattle(g, WE)

	rules.action(g, 'Allies', 'resolve_battle', { use_air: 'uk_air' })
	ok('防守方代受：进入 counter 阶段等发起方决定抵消',
		!!g.pending_battle && g.pending_battle.stage === 'counter',
		g.pending_battle && g.pending_battle.stage)
	ok('  抵消候选里有德国空军 B',
		((g.pending_battle || {}).counter_airs || []).some(x => x.id === 'de_air'),
		(g.pending_battle || {}).counter_airs)

	rules.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	ok('抵消成立：代受空军 A 被移除', g.location['uk_air'] == null)
	ok('抵消成立：抵消空军 B 被移除', g.location['de_air'] == null)
	ok('抵消成立：原目标英国陆军被移除', g.location['uk_army'] == null)

	ok('响应栈出现 15330 帧', hasFrame(g, '15330'))
	const f = frames(g).find(x => String(x.card_face) === '15330')
	ok('★ 抵消分支的 ctx【没有】retreated_airs（该分支压根不撤退）',
		!!f && !(f.ctx.retreated_airs && f.ctx.retreated_airs.length),
		f && f.ctx.retreated_airs)

	trigger(g)
	ok('15330 发动后：英国陆军回到西欧', loc(g, 'uk_army') === '西欧', loc(g, 'uk_army'))
	ok('★ 代受空军 A 仍在场外（抵消死亡不复活）', g.location['uk_air'] == null)
	ok('★ 抵消空军 B 仍在场外（敌方空军不复活）', g.location['de_air'] == null)
}

/* ============================================================
 * S6 代受但不抵消 -> A 死、陆军保住、B 存活、无响应帧（原行为不变）
 * ============================================================ */
section('S6 代受但不抵消：A 死 / 陆军保住 / B 存活 / 无窗口')
{
	const g = make({ space: WE, cards: ['15330'] })
	startBattle(g, WE)
	rules.action(g, 'Allies', 'resolve_battle', { use_air: 'uk_air' })
	rules.action(g, 'Axis', 'resolve_battle', { declined: true })
	ok('代受成立：代受空军 A 被移除', g.location['uk_air'] == null)
	ok('代受成立：原目标英国陆军保住', loc(g, 'uk_army') === '西欧', loc(g, 'uk_army'))
	ok('代受成立：德国空军 B 未参与，仍在德国', loc(g, 'de_air') === '德国', loc(g, 'de_air'))
	ok('★ 不派发 piece_removed（该分支本就不派发）', frames(g).length === 0,
		frames(g).map(x => x.card_face))
}

/* ============================================================
 * S7【方案 b】victim 受保护 -> 空军【原地不动】，不再被迫撤退
 * ============================================================ */
section('S7 victim 受保护：空军不撤退（方案 b）')
{
	const g = make({ space: WE, cards: ['15330'] })
	I.register_modifier(g, {
		key: 'protect', nation: '英国', type: 'army', spaces: [WE], untilTurn: g.turn,
	})
	startBattle(g, WE)
	rules.action(g, 'Allies', 'resolve_battle', { declined: true })
	ok('陆军受保护：仍在西欧', loc(g, 'uk_army') === '西欧', loc(g, 'uk_army'))
	ok('★ 受保护时不撤退：英国空军仍在西欧', loc(g, 'uk_air') === '西欧', loc(g, 'uk_air'))
	ok('受保护分支不派发 piece_removed：响应栈为空', frames(g).length === 0,
		frames(g).map(x => x.card_face))
}

/* ============================================================
 * S8 抵消成立 + 陆军受保护 -> 双向空军死、陆军保住、无窗口
 * ============================================================ */
section('S8 抵消 + 陆军受保护：双方空军死、陆军保住、无窗口')
{
	const g = make({ space: WE, cards: ['15330'] })
	I.register_modifier(g, {
		key: 'protect', nation: '英国', type: 'army', spaces: [WE], untilTurn: g.turn,
	})
	startBattle(g, WE)
	rules.action(g, 'Allies', 'resolve_battle', { use_air: 'uk_air' })
	rules.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	ok('代受空军 A 死', g.location['uk_air'] == null)
	ok('抵消空军 B 死', g.location['de_air'] == null)
	ok('原目标受保护：英国陆军保住', loc(g, 'uk_army') === '西欧', loc(g, 'uk_army'))
	ok('受保护分支不派发 piece_removed：响应栈为空', frames(g).length === 0,
		frames(g).map(x => x.card_face))
}

/* ============================================================
 * S9 配置守卫：10 张卡都必须调用新原子（防漏接线）
 * ============================================================ */
section('S9 配置守卫：10 张免死卡的 impl 都调用了 restore_retreated_airs')
{
	const src = require('fs').readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	const ids = ['15330', '15332', '15334', '15337', '15420', '15421', '15436', '17730', '17733', '17735']
	let wired = 0
	for (const id of ids) {
		const re = new RegExp("'" + id + "':\\s*\\(game,\\s*side,\\s*ctx\\)\\s*=>\\s*\\{([\\s\\S]{0,700}?)\\n\\t\\},")
		const m = src.match(re)
		if (m && m[1].indexOf('restore_retreated_airs') >= 0) wired++
		else console.log('    未接线: ' + id)
	}
	ok('★ 10 张全部接线', wired === ids.length, wired + '/' + ids.length)
}

console.log('\n' + (fails.length ? ('有失败断言：' + fails.join(', ')) : '全部通过') +
	'  PASS ' + pass + ' / FAIL ' + fails.length)
process.exitCode = fails.length ? 1 : 0
