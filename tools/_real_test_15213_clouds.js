/*
 * 真实测试（rtt-realboard-test §7 范式 B）：15213《云雾》
 *
 * 卡面：出牌阶段开始时：本回合中空军无法防御战斗。
 * 玩家口径（2026-10-31）：云雾生效期间，防守方的空军
 *   **既不能代受（防御），也不能撤离（撤退）—— 只能原地移除**。
 *
 * 断言：
 *   A. 云雾已生效（game.modifiers 有 air_no_defend）
 *   B. 战斗挂起面板：airs=[]（无代受）、retreats=[]（无撤退）、air_no_retreat=true
 *   C. 防守方 declined -> 受攻击陆军被移除、同格空军【原地移除】（不是撤退）
 *   D. 强行指定撤退目标（air_retreat）也不能生效（空军仍原地移除）
 *   E. 强行代受（use_air）仍被拒（《云雾》）
 *   F. 对照（无云雾）：retreats 非空，空军可撤到相邻合法格、不消失
 *   G. 客户端：面板只给「原地移除」一个选项（静态 + view 字段镜像）
 *
 * 用法：node tools/_real_test_15213_clouds.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

const W = d.id_of('西欧')

/*
 * 布阵（合法）：
 *   · 德国陆军 @<德国>（发起方，开局既有 p1，补给中）
 *   · 英国陆军 + 英国空军 @<西欧>（被攻击方；空军载体 = 该陆军，补给中）
 *   · 15213 云雾 交给德国
 */
function setup({ clouds = true } = {}) {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_def', nation: '英国', type: 'army', space: W })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_air', nation: '英国', type: 'air', space: W })
	/*
	 * 额外给一支英国海军@<北海>：让"撤退"在【无云雾】时真的可选
	 * （西欧相邻 = 波罗的海/意大利/北海/德国/地中海，只有北海有英国载体）。
	 * 这样 F 段对照才有意义；有云雾时这条撤退路径必须被禁。
	 */
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_navy', nation: '英国', type: 'navy', space: d.id_of('北海') })
	R.action(g, 'Axis', 'debug_add_card', { face: '15213', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
	I.refresh(g)
	/* 进入德国出牌阶段（play_start 窗口） */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	if (clouds) {
		const cl = (g.hands['德国'] || []).find(x => faceOf(x) === '15213')
		R.action(g, 'Axis', 'play_card', { card: cl })
	}
	return g
}

/* 用真实 action 发起陆战：德国陆军@德国 -> 英国陆军@西欧（piece 指定受害者） */
function attack(g) {
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15201')
	const atk = Object.keys(g.location).find(p =>
		g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === d.id_of('德国'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card, space: W, piece: 'uk_def', from: atk })
	return logSince(g, n0)
}

console.log('\n=== A. 云雾生效 ===')
const gA = setup()
ok('德国手牌打出 15213 后 modifiers 含 air_no_defend',
	(gA.modifiers || []).some(m => m.key === 'air_no_defend'),
	JSON.stringify((gA.modifiers || []).map(m => m.key)))
ok('15213 已进弃牌堆',
	(gA.discard['德国'] || []).some(x => faceOf(x) === '15213'),
	JSON.stringify((gA.discard['德国'] || []).map(faceOf)))

console.log('\n=== B. 战斗挂起面板：无代受、无撤退（只能原地移除）===')
let log = attack(gA)
console.log('  log: ' + log)
ok('战斗已挂起等待防守方决定', !!gA.pending_battle, JSON.stringify(gA.pending_battle && gA.pending_battle.stage))
{
	const pb = gA.pending_battle || {}
	console.log('  pending_battle=' + JSON.stringify({
		stage: pb.stage, airs: pb.airs, retreats: pb.retreats,
		air_defend_disabled: pb.air_defend_disabled, air_no_retreat: pb.air_no_retreat,
	}))
	ok('★ 无代受候选（airs 为空）', (pb.airs || []).length === 0, JSON.stringify(pb.airs))
	ok('★ 无撤退候选（retreats 为空）', (pb.retreats || []).length === 0,
		JSON.stringify((pb.retreats || []).map(r => r && r.name)))
	ok('★ 标记 air_no_retreat=true（客户端据此只给"原地移除"）',
		pb.air_no_retreat === true, String(pb.air_no_retreat))
	const v = R.view(gA, 'Allies')
	ok('view 也下发 air_no_retreat（客户端可见）',
		!!(v.pending_battle && v.pending_battle.air_no_retreat === true),
		JSON.stringify(v.pending_battle && v.pending_battle.air_no_retreat))
}

console.log('\n=== C. 防守方不代受 -> 陆军被移除 + 空军原地移除 ===')
{
	const n0 = (gA.log || []).length
	R.action(gA, 'Allies', 'resolve_battle', { declined: true })
	console.log('  log: ' + logSince(gA, n0))
	ok('★ 受攻击的英国陆军被移除', gA.location['uk_def'] == null)
	ok('★ 同格英国空军【原地移除】（不是撤退）', gA.location['uk_air'] == null,
		'air loc=' + String(gA.location['uk_air']))
	ok('无残留挂起', !gA.pending_battle && !gA.pending_armed_use)
}

console.log('\n=== D. 强行指定撤退目标也不能生效 ===')
{
	const g = setup()
	attack(g)
	const adj = I.get_connections(g, W, 'allies').find(s =>
		d.spaces[s] && d.spaces[s].terrain !== 'sea')
	console.log('  试图撤往：' + (adj != null ? d.name_of(adj) : '(无)'))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { declined: true, retreat: adj, air_retreat: adj })
	console.log('  log: ' + logSince(g, n0))
	ok('★ 空军没有被移到撤退目标格',
		adj == null || Object.keys(g.location).every(p => !(g.location[p] === adj && p === 'uk_air')),
		JSON.stringify({ air: g.location['uk_air'], to: adj }))
	ok('★ 空军仍被原地移除', g.location['uk_air'] == null, String(g.location['uk_air']))
}

console.log('\n=== E. 强行代受仍被拒（《云雾》）===')
{
	const g = setup()
	attack(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { use_air: 'uk_air' })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★ 代受被拒（云雾）', /云雾/.test(lg) || g.location['uk_def'] != null, lg)
	ok('英国空军未被移除', g.location['uk_air'] != null)
}

console.log('\n=== F. 对照：无云雾时空军可以撤离（不被原地移除）===')
{
	const g = setup({ clouds: false })
	attack(g)
	const pb = g.pending_battle || {}
	console.log('  pending_battle=' + JSON.stringify({
		stage: pb.stage, airs: pb.airs, retreats: (pb.retreats || []).map(r => r && r.name),
		air_no_retreat: pb.air_no_retreat,
	}))
	ok('无云雾：可代受（airs 非空）', (pb.airs || []).length > 0, JSON.stringify(pb.airs))
	ok('无云雾：可撤退（retreats 非空）', (pb.retreats || []).length > 0,
		JSON.stringify((pb.retreats || []).map(r => r && r.name)))
	ok('无云雾：air_no_retreat 不为 true', pb.air_no_retreat !== true, String(pb.air_no_retreat))
	const to = (pb.retreats || [])[0]
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { declined: true, retreat: to && to.id })
	console.log('  log: ' + logSince(g, n0))
	ok('★ 空军撤到目标格（未被移除）',
		g.location['uk_air'] != null && g.location['uk_air'] === (to && to.id),
		JSON.stringify({ air: g.location['uk_air'], to: to && to.id }))
}

console.log('\n=== G. 客户端接线（静态 + 镜像）===')
{
	const pj = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('客户端识别 air_no_retreat', pj.indexOf('air_no_retreat') >= 0)
	ok('客户端给出"原地移除"按钮',
		pj.indexOf('原地移除') >= 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
