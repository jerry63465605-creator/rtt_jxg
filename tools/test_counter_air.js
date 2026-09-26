/*
 * 发起方抵消（easy_rule 七 第二条）
 *
 * 规则：防守方可以用空军代受；代受后，发起方可以移除 1 支相邻的
 *      本方空军来抵消 —— 抵消后原目标照常被移除，双方各损失 1 支空军。
 *
 * 这是一个【两阶段挂起】：
 *   stage='defend'  等防守方决定是否代受
 *   stage='counter' 等发起方决定是否抵消
 *
 * 运行：node tools/test_counter_air.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
const failures = []

function ok(cond, name, extra) {
	if (cond) { pass++ }
	else { fail++; failures.push(name + (extra ? '  -> ' + extra : '')) }
}
function eq(a, b, name) {
	ok(a === b, name, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b))
}

const SP = d.id_of

/*
 * 标准局面：
 *   德国陆军 @ 德国(44,★)   -- 发起单位（有补给，与东欧相邻）
 *   德国空军 @ 德国(44)     -- 可用于抵消（与东欧相邻）
 *   苏联陆军 @ 东欧(5)      -- victim
 *   苏联空军 @ 东欧(5)      -- guardAir（可代受）
 */
function setup() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null
	g.markers = I.init_markers()
	g.supply_override = {}

	g.location['g_army'] = SP('德国'); g.piece_nation['g_army'] = '德国'; g.piece_type['g_army'] = 'army'
	g.location['g_air'] = SP('德国'); g.piece_nation['g_air'] = '德国'; g.piece_type['g_air'] = 'air'
	g.location['s_army'] = SP('东欧'); g.piece_nation['s_army'] = '苏联'; g.piece_type['s_army'] = 'army'
	g.location['s_air'] = SP('东欧'); g.piece_nation['s_air'] = '苏联'; g.piece_type['s_air'] = 'air'
	return g
}

const GER = SP('德国')
const EO = SP('东欧')

console.log('=== 0. 测试前提 ===')
{
	ok(d.spaces[GER].supply, '0.1 德国是★补给点（保证发起单位有补给）')
	ok(d.spaces[GER].connections.indexOf(EO) >= 0, '0.2 德国与东欧相邻')
	const g = setup()
	const sup = I.compute_supply(g)
	eq(!!sup.in_supply['g_army'], true, '0.3 发起单位处于补给状态')
}

console.log('=== 1. 发起战斗 -> 挂起等防守方（stage=defend） ===')
{
	const g = setup()
	const r = I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	eq(r.pending, true, '1.1 挂起')
	eq(g.pending_battle.stage, 'defend', '1.2 stage=defend')
	eq(g.pending_battle.defender_nation, '苏联', '1.3 等待苏联决定')
	eq(g.pending_battle.attacker, '德国', '1.4 发起方德国')
	eq(g.pending_battle.victim, 's_army', '1.5 victim 记录正确')
	ok(g.pending_battle.airs.indexOf('s_air') >= 0, '1.6 列出可代受的空军')
}

console.log('=== 2. 防守方代受 -> 挂起等发起方（stage=counter） ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	const pb = g.pending_battle
	/* 防守方选择代受 */
	const r = I.do_battle(g, pb.attacker, pb.space, pb.victim, pb.kind, {
		from: pb.attacker_piece,
		defend_air: 's_air',
	})
	eq(r.pending, true, '2.1 再次挂起')
	eq(g.pending_battle.stage, 'counter', '2.2 stage=counter')
	eq(g.pending_battle.attacker, '德国', '2.3 现在等德国')
	eq(g.pending_battle.defend_air, 's_air', '2.4 记录代受空军')
	const ids = (g.pending_battle.counter_airs || []).map(x => x.id)
	ok(ids.indexOf('g_air') >= 0, '2.5 列出可抵消的空军', JSON.stringify(ids))
	/* 此时还没有任何单位被移除 */
	ok(g.location['s_air'] != null, '2.6 代受空军还在（等发起方表态）')
	ok(g.location['s_army'] != null, '2.7 原目标还在')
}

console.log('=== 3. 发起方抵消 -> 三方都移除 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	const pb1 = g.pending_battle
	I.do_battle(g, pb1.attacker, pb1.space, pb1.victim, pb1.kind, {
		from: pb1.attacker_piece, defend_air: 's_air',
	})
	const pb2 = g.pending_battle
	const r = I.do_battle(g, pb2.attacker, pb2.space, pb2.victim, pb2.kind, {
		from: pb2.attacker_piece,
		defend_air: pb2.defend_air,
		counter_air: 'g_air',
	})
	eq(r.ok, true, '3.1 结算成功')
	eq(r.countered_by_air, 'g_air', '3.2 记录抵消空军')
	eq(g.pending_battle, null, '3.3 挂起已清除')
	eq(g.location['s_air'], undefined, '3.4 代受空军被移除')
	eq(g.location['g_air'], undefined, '3.5 抵消空军被移除')
	eq(g.location['s_army'], undefined, '3.6 原目标照常被移除')
	ok(g.location['g_army'] != null, '3.7 发起单位不受影响')
}

console.log('=== 4. 发起方不抵消 -> 代受成立，原目标保住 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	const pb1 = g.pending_battle
	I.do_battle(g, pb1.attacker, pb1.space, pb1.victim, pb1.kind, {
		from: pb1.attacker_piece, defend_air: 's_air',
	})
	const pb2 = g.pending_battle
	const r = I.do_battle(g, pb2.attacker, pb2.space, pb2.victim, pb2.kind, {
		from: pb2.attacker_piece,
		defend_air: pb2.defend_air,
		declined_counter: true,
	})
	eq(r.ok, true, '4.1 结算成功')
	eq(r.defended_by_air, 's_air', '4.2 代受成立')
	eq(g.location['s_air'], undefined, '4.3 代受空军被移除')
	eq(g.location['s_army'], EO, '4.4 原目标【保住】')
	ok(g.location['g_air'] != null, '4.5 发起方空军没损失')
}

console.log('=== 5. 发起方没有可抵消的空军 -> 不挂起，直接结算 ===')
{
	const g = setup()
	/* 把德国空军挪到远离东欧的地方（日本） */
	g.location['g_air'] = SP('日本')
	eq(I.counter_air_options(g, '德国', EO).length, 0, '5.1 没有可抵消的空军')
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	const pb1 = g.pending_battle
	const r = I.do_battle(g, pb1.attacker, pb1.space, pb1.victim, pb1.kind, {
		from: pb1.attacker_piece, defend_air: 's_air',
	})
	eq(r.pending, undefined, '5.2 不再挂起')
	eq(g.pending_battle, null, '5.3 挂起已清除')
	eq(g.location['s_air'], undefined, '5.4 代受空军移除')
	eq(g.location['s_army'], EO, '5.5 原目标保住')
}

console.log('=== 6. 抵消空军的合法性校验 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	const pb1 = g.pending_battle
	I.do_battle(g, pb1.attacker, pb1.space, pb1.victim, pb1.kind, {
		from: pb1.attacker_piece, defend_air: 's_air',
	})
	const pb2 = g.pending_battle
	/* 用敌方的空军抵消 */
	const r = I.do_battle(g, pb2.attacker, pb2.space, pb2.victim, pb2.kind, {
		from: pb2.attacker_piece, defend_air: pb2.defend_air, counter_air: 's_air',
	})
	eq(r.ok, false, '6.1 用敌方空军抵消被拒')
	ok(/不能用于抵消/.test(r.reason || ''), '6.2 文案正确', r.reason)
	/* 挂起保留，可重试 */
	ok(g.pending_battle != null, '6.3 挂起保留（可重选）')
}
{
	/* 用陆军抵消（不是空军） */
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	const pb1 = g.pending_battle
	I.do_battle(g, pb1.attacker, pb1.space, pb1.victim, pb1.kind, {
		from: pb1.attacker_piece, defend_air: 's_air',
	})
	const pb2 = g.pending_battle
	const r = I.do_battle(g, pb2.attacker, pb2.space, pb2.victim, pb2.kind, {
		from: pb2.attacker_piece, defend_air: pb2.defend_air, counter_air: 'g_army',
	})
	eq(r.ok, false, '6.4 用陆军抵消被拒')
}

console.log('=== 7. counter_air_options：必须是本国 + 相邻 ===')
{
	const g = setup()
	const opts = I.counter_air_options(g, '德国', EO)
	eq(opts.length, 1, '7.1 德国只有 1 支可用空军')
	eq(opts[0].id, 'g_air', '7.2 是 g_air')
	eq(opts[0].space_name, '德国', '7.3 位于德国（与东欧相邻）')
	/* 苏联视角：没有空军可抵消（苏联空军在东欧，但发起方不是苏联） */
	const opts2 = I.counter_air_options(g, '苏联', EO)
	eq(opts2.length, 1, '7.4 苏联的空军在东欧本身，也算相邻')
}

console.log('=== 8. 防守方不代受 -> 不会进入 counter 阶段 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	const pb1 = g.pending_battle
	const r = I.do_battle(g, pb1.attacker, pb1.space, pb1.victim, pb1.kind, {
		from: pb1.attacker_piece,
		defend_air: null,
		declined_defend_air: true,
	})
	eq(r.pending, undefined, '8.1 不挂起 counter')
	eq(g.pending_battle, null, '8.2 挂起清除')
	eq(g.location['s_army'], undefined, '8.3 原目标被移除')
	/* 苏联空军撤离（东欧相邻地区找得到位置） */
	ok(g.location['s_air'] !== EO, '8.4 苏联空军已撤离东欧')
}

console.log('=== 9. view 可见性按 stage 分发 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	/* stage=defend：等苏联（同盟） */
	const vAxis = R.view(g, 'Axis')
	const vAllies = R.view(g, 'Allies')
	eq(vAxis.pending_battle, null, '9.1 轴心看不到（等防守方）')
	ok(vAllies.pending_battle != null, '9.2 同盟看得到')
	eq(vAllies.pending_battle.stage, 'defend', '9.3 stage=defend')

	/* 防守方代受 -> stage=counter：等德国（轴心） */
	const pb1 = g.pending_battle
	I.do_battle(g, pb1.attacker, pb1.space, pb1.victim, pb1.kind, {
		from: pb1.attacker_piece, defend_air: 's_air',
	})
	const vAxis2 = R.view(g, 'Axis')
	const vAllies2 = R.view(g, 'Allies')
	ok(vAxis2.pending_battle != null, '9.4 轴心看得到（等发起方）')
	eq(vAxis2.pending_battle.stage, 'counter', '9.5 stage=counter')
	eq(vAllies2.pending_battle, null, '9.6 同盟看不到了')
}

console.log('=== 10. view.actions 按 stage 分发 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	eq(!!(R.view(g, 'Allies').actions || {}).resolve_battle, true, '10.1 防守方可提交')
	/*
	 * 注意：轴心（发起方）的 actions 里【也有】resolve_battle ——
	 * 因为它是当前行动方，拿到的是完整动作列表。
	 * 真正的权限区分在【服务端提交时】按 stage 校验（见测试 12），
	 * 白名单层面做不到、也不必做到这一点。
	 * 这里验证的是：它拿不到待决面板。
	 */
	eq(R.view(g, 'Axis').pending_battle, null, '10.2 发起方看不到待决面板')

	const pb1 = g.pending_battle
	I.do_battle(g, pb1.attacker, pb1.space, pb1.victim, pb1.kind, {
		from: pb1.attacker_piece, defend_air: 's_air',
	})
	eq(!!(R.view(g, 'Axis').actions || {}).resolve_battle, true, '10.3 现在发起方可提交')
	eq(!!(R.view(g, 'Allies').actions || {}).resolve_battle, false, '10.4 防守方不可提交')
}

console.log('=== 11. 完整 action 流程（resolve_battle 两阶段） ===')
{
	const g = setup()
	g.current_nation = '德国'
	g.active = 'Axis'
	/* 发起 */
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	eq(g.pending_battle.stage, 'defend', '11.1 stage=defend')

	/* 防守方（同盟）提交代受 */
	R.action(g, 'Allies', 'resolve_battle', { use_air: 's_air' })
	eq(g.pending_battle != null, true, '11.2 挂起转为 counter')
	eq(g.pending_battle.stage, 'counter', '11.3 stage=counter')

	/* 发起方（轴心）提交抵消 */
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'g_air' })
	eq(g.pending_battle, null, '11.4 结算完毕')
	eq(g.location['s_army'], undefined, '11.5 原目标被移除')
	eq(g.location['s_air'], undefined, '11.6 代受空军被移除')
	eq(g.location['g_air'], undefined, '11.7 抵消空军被移除')
}
{
	/* 发起方明确不抵消 */
	const g = setup()
	g.current_nation = '德国'
	g.active = 'Axis'
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	R.action(g, 'Allies', 'resolve_battle', { use_air: 's_air' })
	R.action(g, 'Axis', 'resolve_battle', { declined: true })
	eq(g.pending_battle, null, '11.8 结算完毕')
	eq(g.location['s_army'], EO, '11.9 原目标保住')
	eq(g.location['s_air'], undefined, '11.10 代受空军移除')
	ok(g.location['g_air'] != null, '11.11 发起方空军没损失')
}
{
	/* 防守方不代受时不进入 counter */
	const g = setup()
	g.current_nation = '德国'
	g.active = 'Axis'
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	eq(g.pending_battle, null, '11.12 直接结算，无 counter')
	eq(g.location['s_army'], undefined, '11.13 原目标被移除')
}

console.log('=== 12. 权限：错误的一方提交会被拒绝 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	/* 发起方在 defend 阶段提交 -> 拒绝 */
	R.action(g, 'Axis', 'resolve_battle', { use_air: 's_air' })
	eq(g.pending_battle.stage, 'defend', '12.1 仍在 defend（拒绝生效）')
	ok(g.location['s_army'] != null, '12.2 没有结算')
}
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	R.action(g, 'Allies', 'resolve_battle', { use_air: 's_air' })
	eq(g.pending_battle.stage, 'counter', '12.3 进入 counter')
	/* 防守方在 counter 阶段提交 -> 拒绝 */
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	eq(g.pending_battle.stage, 'counter', '12.4 仍在 counter（拒绝生效）')
}

console.log('=== 13. 全局挂起：counter 期间其它动作被拦 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EO, 's_army', 'land', { from: 'g_army' })
	R.action(g, 'Allies', 'resolve_battle', { use_air: 's_air' })
	eq(g.pending_battle.stage, 'counter', '13.1 stage=counter')
	const before = g.turn_phase
	R.action(g, 'Axis', 'next_phase', {})
	eq(g.turn_phase, before, '13.2 next_phase 被拦（阶段未变）')
	ok(g.pending_battle != null, '13.3 战斗仍挂起')
}

console.log('=== 14. 修复验证：等待方是"非本方首个国家"时也能看到 ===')
{
	/*
	 * 踩坑（2026-09-23）：原写法用 my_nation（本方排最前的国家）
	 * 比国家名，等意大利/日本/法国时会漏。
	 * 这里让【意大利】做防守方（轴心首个国家是德国），验证仍能拿到面板。
	 */
	const g = setup()
	/*
	 * 发起方用苏联，但【苏联开局中立，不能攻击意大利】——
	 * 会先被中立检查拦下。这里先让它参战，才能测到后面的面板可见性。
	 */
	I.end_neutral(g, '苏联', '测试用')
	g.location['i_army'] = EO; g.piece_nation['i_army'] = '意大利'; g.piece_type['i_army'] = 'army'
	g.location['i_air'] = EO; g.piece_nation['i_air'] = '意大利'; g.piece_type['i_air'] = 'air'
	/* 让 victim 是意大利部队：删掉苏联的，留意大利 */
	delete g.location['s_army']
	delete g.location['s_air']
	/*
	 * 发起单位：苏联陆军放在【乌克兰(45,★)】——
	 * 既自带补给（★），又与东欧相邻（东欧邻接 罗斯/波罗的海/巴尔干/德国/乌克兰）。
	 * 不能放罗斯：那里没有★，也没有邻接的本国补给源，会断补。
	 */
	g.location['g_army'] = SP('乌克兰'); g.piece_nation['g_army'] = '苏联'
	delete g.location['g_air']
	const sup = I.compute_supply(g)
	ok(!!sup.in_supply['g_army'], '14.1 苏联发起单位有补给（乌克兰是★）')

	const r = I.do_battle(g, '苏联', EO, 'i_army', 'land', { from: 'g_army' })
	eq(r.pending, true, '14.2 挂起')
	eq(g.pending_battle.defender_nation, '意大利', '14.3 等待意大利')
	/* 轴心视角应能看到（意大利属轴心，但轴心首个国家是德国） */
	const vAxis = R.view(g, 'Axis')
	ok(vAxis.pending_battle != null, '14.4 轴心能看到面板（修复生效）')
	eq(vAxis.pending_battle.defender_nation, '意大利', '14.5 面板内容正确')
}

console.log('\n' + '='.repeat(50))
console.log('通过 ' + pass + ' / 失败 ' + fail)
if (fail) {
	console.log('\n失败项：')
	failures.forEach(f => console.log('  ✗ ' + f))
	process.exit(1)
}
console.log('全部通过')
