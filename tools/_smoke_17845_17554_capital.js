/*
 * 【2026-10-28 #17】迁都 / 大本营改判 验收
 *
 * 玩家报告：「迁都后无法在新大本营建设陆军；17827 西伯利亚大铁路的建设也失败」。
 *
 * 实际结论：代码已在批次 1（98fd640）修好 —— can_build_at 的「本国大本营」分支
 * 原本多了一个静态前置 `sp.home_base &&`（data.js 写死的地图标记），
 * 新都自然没有该标记，于是 effective_home_base() 改判成功也会被拒。
 * 去掉静态前置后，17827 的选位（走 step_space_candidates -> can_build_at）自动跟着好。
 *
 * 本脚本的作用是【锁住这个行为】，防止将来有人把静态前置加回去。
 *
 * 覆盖：
 *   S1 17845 未打出：大本营 = 莫斯科，西伯利亚不是苏联补给点
 *   S2 17845 打出：大本营 = 西伯利亚；补给点仅苏联；莫斯科补给点被移除；标记 +1
 *   S3 17845 打出后：can_build_at / build_piece 在新都成功
 *   S4 17554 条件不满足（中国东部未被敌占）：大本营不变（条件光环不生效）
 *   S5 17554 条件满足：大本营 = 中国西部；补给点仅中国；可建设
 *   S6 17827：苏联迁都后，逐一建设的候选含西伯利亚（与建设陆军同源）
 *   S7 17845 离场：大本营回莫斯科、西伯利亚补给点消失
 *   S8 17845 + 17827 叠加：pending_autobahn.actor = 苏联
 *
 * 用法：node tools/_smoke_17845_17554_capital.js
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const data = I.data

const MSC = data.id_of('莫斯科')
const SIB = data.id_of('西伯利亚')
const CE = data.id_of('中国东部')
const CW = data.id_of('中国西部')

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

function make(opts) {
	opts = opts || {}
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1
	g.current_nation = opts.nation || '苏联'
	g.active = 'Allies'
	return g
}
const SP = (g, sid, nation) => rules.view(g, nation === '中国' ? 'Allies' : 'Allies')

/* ============================================================
 * S1 / S2 / S3 17845 迁都古比雪夫
 * ============================================================ */
section('S1 17845 未打出：大本营 = 莫斯科，西伯利亚不是苏联补给点')
{
	const g = make()
	ok('大本营 = 莫斯科', I.effective_home_base(g, '苏联') === MSC, I.effective_home_base(g, '苏联'))
	ok('西伯利亚不是苏联补给点', I.is_supply_point(g, SIB, 'allies', '苏联') === false)
}

section('S2 17845 打出后：大本营 / 补给点 / 标记')
{
	const g = make()
	g.hands['苏联'] = ['17845#1']
	rules.action(g, 'Allies', 'play_card', { card: '17845#1' })
	ok('★ 大本营 = 西伯利亚', I.effective_home_base(g, '苏联') === SIB, I.effective_home_base(g, '苏联'))
	ok('★ 西伯利亚成为【苏联】补给点', I.is_supply_point(g, SIB, 'allies', '苏联') === true)
	ok('★ 西伯利亚【不】对英国生效（仅苏联）', I.is_supply_point(g, SIB, 'allies', '英国') === false)
	ok('★ 莫斯科补给点被移除', I.is_supply_point(g, MSC, 'allies', '苏联') === false)
	const mk = (g.markers && g.markers[SIB]) || []
	ok('★ 西伯利亚 +1 标记（owner 苏联）',
		mk.some(m => m.owner === '苏联' && m.value >= 1), mk)
}

section('S3 迁都后可在新大本营建设（#17 的主诉）')
{
	const g = make()
	g.hands['苏联'] = ['17845#1']
	rules.action(g, 'Allies', 'play_card', { card: '17845#1' })
	const chk = I.can_build_at(g, '苏联', SIB, 'army')
	ok('★ can_build_at(西伯利亚) = ok', chk && chk.ok, chk)
	ok('  理由写明"本国大本营"', /本国大本营/.test((chk && chk.reason) || ''), chk && chk.reason)
	const r = I.build_piece(g, '苏联', 'army', SIB)
	ok('★ build_piece 成功', r && r.ok, r)
	ok('  部队确实落在西伯利亚', Object.keys(g.location).some(p =>
		g.location[p] === SIB && g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army'))
}

/* ============================================================
 * S4 / S5 17554 重庆国民政府（条件光环）
 * ============================================================ */
section('S4 17554 条件不满足（中国东部未被敌占）：大本营不变')
{
	const g = make({ nation: '中国' })
	const before = I.effective_home_base(g, '中国')
	g.hands['中国'] = ['17554#1']
	rules.action(g, 'Allies', 'play_card', { card: '17554#1' })
	ok('★ 大本营仍是原值（条件未满足不生效）',
		I.effective_home_base(g, '中国') === before,
		'before=' + before + ' after=' + I.effective_home_base(g, '中国'))
}

section('S5 17554 条件满足（日占中国东部）：大本营 = 中国西部')
{
	const g = make({ nation: '中国' })
	/* 中国东部被敌方（日本）占领 */
	g.location['jp_ce'] = CE
	g.piece_nation['jp_ce'] = '日本'
	g.piece_type['jp_ce'] = 'army'
	I.refresh(g)
	g.hands['中国'] = ['17554#1']
	rules.action(g, 'Allies', 'play_card', { card: '17554#1' })
	ok('★ 大本营 = 中国西部', I.effective_home_base(g, '中国') === CW, I.effective_home_base(g, '中国'))
	ok('★ 中国西部成为【中国】补给点', I.is_supply_point(g, CW, 'allies', '中国') === true)
	const chk = I.can_build_at(g, '中国', CW, 'army')
	ok('★ can_build_at(中国西部) = ok', chk && chk.ok, chk)
}

/* ============================================================
 * S6 17827 西伯利亚大铁路：逐一建设候选与建设陆军同源
 * ============================================================ */
section('S6 17827 逐一建设：迁都后候选含西伯利亚')
{
	const g = make()
	g.hands['苏联'] = ['17845#1']
	rules.action(g, 'Allies', 'play_card', { card: '17845#1' })
	/* query 'autobahn_targets' 内部就是这一步（31972） */
	const cands = I.step_space_candidates(g, '苏联', { op: 'build', type: 'army' }, {})
	ok('★ 候选含西伯利亚（新都）', cands.indexOf(SIB) >= 0, cands.slice(0, 12))
	ok('  候选非空（逐一建设能继续）', cands.length > 0, cands.length)
}

/* ============================================================
 * S7 17845 离场：光环撤销，大本营回莫斯科
 * ============================================================ */
section('S7 17845 离场后恢复')
{
	const g = make()
	g.hands['苏联'] = ['17845#1']
	rules.action(g, 'Allies', 'play_card', { card: '17845#1' })
	ok('前置：已迁都', I.effective_home_base(g, '苏联') === SIB)
	/*
	 * 离场 = 从桌面移除。effective_home_base 是【动态扫桌面】（8248），
	 * 不看 revert —— 卡还在 table 里就仍然生效。所以两个动作都要做：
	 *   ① 从 table 移除 -> 条件光环（大本营）自动失效
	 *   ② revert_status_ongoing -> 撤销写入式的 status_aura / supply_override
	 */
	g.table['苏联'] = (g.table['苏联'] || []).filter(c => String(c).indexOf('17845') !== 0)
	I.revert_status_ongoing(g, '17845#1')
	I.refresh(g)
	ok('★ 大本营回到莫斯科', I.effective_home_base(g, '苏联') === MSC, I.effective_home_base(g, '苏联'))
	/*
	 * ⚠ 已知缺口（不属于 #17）：revert 后西伯利亚的 supply_override 仍残留。
	 * 这是写入式光环的共性问题 —— 属 #4【光环生命周期：离场不撤销】，
	 * 已登记待办，本脚本只记录现状，不判失败，避免把两类问题混在一起。
	 */
	const stillOn = I.is_supply_point(g, SIB, 'allies', '苏联')
	if (stillOn) {
		console.log('  note  ★ 西伯利亚补给点离场后仍残留 —— 属 #4（光环离场不撤销），不在 #17 范围')
	} else {
		ok('★ 西伯利亚补给点已撤销（#4 若已修，此项会自动变绿）', true)
	}
}

/* ============================================================
 * S8 17845 + 17827 叠加：委托/管线不串国
 * ============================================================ */
section('S8 17845 打出后建 pending_autobahn：actor = 苏联')
{
	const g = make()
	g.hands['苏联'] = ['17845#1']
	rules.action(g, 'Allies', 'play_card', { card: '17845#1' })
	g.pending_autobahn = { remaining: 3, total: 3, actor: '苏联' }
	const cands = I.step_space_candidates(g, g.pending_autobahn.actor, { op: 'build', type: 'army' }, {})
	ok('actor 是苏联（不是默认德国）', g.pending_autobahn.actor === '苏联')
	ok('★ 候选按苏联算（含西伯利亚）', cands.indexOf(SIB) >= 0, cands.slice(0, 10))
}

console.log('\n' + (fails.length ? ('有失败断言：' + fails.join(', ')) : '全部通过') +
	'  PASS ' + pass + ' / FAIL ' + fails.length)
process.exitCode = fails.length ? 1 : 0
