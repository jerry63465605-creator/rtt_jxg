/*
 * 15254《战争海军》验收（2026-10-27 重做）
 *
 * 卡面（玩家口径）：
 *   ① <北海>与<波罗的海>在任何情况下仅对轴心国相邻
 *      = 等效【北欧海峡永远视为被轴心控制】
 *   ② 若<波罗的海>没有敌对国家海军 —— 补给阶段视为该格有【德国 / 意大利】海军
 *      = 波罗的海可作【补给中继】（不是凭空造源）
 *
 * 旧实现（过滤海区的陆地邻居，要有轴心部队才保留）语义错误，
 * 且导致北海的【同盟】海军必然断补 —— S3 专门盯这条。
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const d = I.data

const BAL = d.id_of('波罗的海')   /* 8  */
const NOR = d.id_of('北海')       /* 17 */
const NORDIC = d.id_of('北欧')    /* 4  */
const BRIT = d.id_of('不列颠')    /* 2  */
const GER = d.id_of('德国')       /* 44 */
const ROSS = d.id_of('罗斯')      /* 7  */
const nm = id => d.name_of(id)

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* 清空盘面后精确布置 */
function blank(turnNation, side) {
	const g = rules.setup(7701, rules.default_scenario, {})
	g.opening = null
	g.turn = 3
	g.turn_phase = 'play'
	g.current_nation = turnNation || '德国'
	g.active = side || 'Axis'
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.status_aura = {}
	return g
}
const put = (g, pid, nat, type, space) => {
	g.location[pid] = space
	g.piece_nation[pid] = nat
	g.piece_type[pid] = type
}
const hasCard = g => I.apply_status_ongoing(g, '15254#1', '德国')
/* 显式传 snap：get_connections 默认读 game.limited_connections 旧快照，测试要现算 */
const adj = (g, sp, side) => I.get_connections(g, sp, side, I.compute_connections(g))
const has = (g, sp, side, target) => adj(g, sp, side).indexOf(target) >= 0

section('S1 无 15254：同盟占领北欧 -> 北海↔波罗的海在【同盟】视角相邻')
{
	const g = blank()
	put(g, 'pUK', '英国', 'army', NORDIC)     /* 同盟占领北欧海峡 */
	hasCard(g)
	void g
	const g2 = blank()
	put(g2, 'pUK', '英国', 'army', NORDIC)    /* 无卡 */
	console.log('    （无卡）波罗的海 allies:', adj(g2, BAL, 'allies').map(nm).join(','))
	console.log('    （无卡）波罗的海 axis  :', adj(g2, BAL, 'axis').map(nm).join(','))
	ok('无卡时波罗的海↔北海在 allies 视角相邻（同盟占北欧）', has(g2, BAL, 'allies', NOR))
	ok('无卡时 axis 视角不相邻', !has(g2, BAL, 'axis', NOR))
}

section('S2 有 15254：同盟占领北欧 -> 海峡仍归轴心')
{
	const g = blank()
	put(g, 'pUK', '英国', 'army', NORDIC)
	hasCard(g)
	console.log('    波罗的海 axis  :', adj(g, BAL, 'axis').map(nm).join(','))
	console.log('    波罗的海 allies:', adj(g, BAL, 'allies').map(nm).join(','))
	ok('★ 轴心视角恒相邻（海峡强制轴心）', has(g, BAL, 'axis', NOR))
	ok('★ 同盟视角仍不相邻（仅对轴心国相邻）', !has(g, BAL, 'allies', NOR))
}

section('S3 有 15254：北海的英国海军应【有补给】（原 bug 回归）')
{
	const g = blank('英国', 'Allies')
	put(g, 'pUKa', '英国', 'army', BRIT)      /* 不列颠 = 英国★ */
	put(g, 'pUKn', '英国', 'navy', NOR)
	hasCard(g)
	const sup = I.compute_supply(g)
	ok('★ 北海英国海军有补给', !!sup.in_supply['pUKn'],
		'北海 allies 邻居=' + adj(g, NOR, 'allies').map(nm).join(','))
	ok('北海仍与不列颠相邻', has(g, NOR, 'allies', BRIT))
}

section('S4 有 15254：德国海军在北海、周边无德军 -> 与无卡结果一致（不再额外切断）')
{
	const mk = () => {
		const g = blank()
		put(g, 'pDEa', '德国', 'army', GER)   /* 德国★，但德国本土不与北海相邻 */
		put(g, 'pDEn', '德国', 'navy', NOR)
		return g
	}
	const g0 = mk()
	const g1 = mk(); hasCard(g1)
	const s0 = I.compute_supply(g0).in_supply['pDEn']
	const s1 = I.compute_supply(g1).in_supply['pDEn']
	ok('挂卡前后结果一致（卡不再误伤自己）', !!s0 === !!s1, '无卡=' + !!s0 + ' 有卡=' + !!s1)
	console.log('    （两者同为断补属正常：北海周边没有德军，海军 A 条件不成立）')
}

section('S5 卡面②：波罗的海无敌国海军 -> 德军可【经波罗的海】接补给')
{
	const mk = () => {
		const g = blank()
		put(g, 'pDEhome', '德国', 'army', GER)    /* 德国★ = base/can_source */
		put(g, 'pDEross', '德国', 'army', ROSS)   /* 罗斯孤军，只能经波罗的海接回本土 */
		return g
	}
	const g0 = mk()
	const s0 = I.compute_supply(g0).in_supply['pDEross']
	console.log('    （无卡）罗斯德军补给 = ' + !!s0)
	const g1 = mk(); hasCard(g1)
	const s1 = I.compute_supply(g1).in_supply['pDEross']
	ok('★ 挂卡后罗斯德军经波罗的海接通补给', !!s1)
}

section('S6 波罗的海有英国海军 -> 不注入虚拟海军')
{
	const g = blank()
	put(g, 'pDEhome', '德国', 'army', GER)
	put(g, 'pDEross', '德国', 'army', ROSS)
	put(g, 'pUKn', '英国', 'navy', BAL)          /* 敌国海军在波罗的海 */
	hasCard(g)
	const sup = I.compute_supply(g)
	ok('★ 有敌国海军时不注入：罗斯德军断补', !sup.in_supply['pDEross'])
}

section('S7 15353《保持冷静》压制 -> 海峡恢复正常 + 不注入')
{
	const g = blank()
	put(g, 'pDEhome', '德国', 'army', GER)
	put(g, 'pDEross', '德国', 'army', ROSS)
	put(g, 'pUK', '英国', 'army', NORDIC)        /* 同盟占北欧 */
	hasCard(g)
	g.status_suppressed_this_turn = {}
	g.status_suppressed_this_turn['15254#1'] = (g.turn + ':' + (g.current_nation || ''))
	console.log('    压制标记 =', g.status_suppressed_this_turn['15254#1'])
	ok('★ 压制后海峡恢复：axis 视角不再恒相邻', !has(g, BAL, 'axis', NOR))
	ok('★ 压制后不注入虚拟海军：罗斯德军断补', !I.compute_supply(g).in_supply['pDEross'])
}

section('S8 离场（revert）-> 光环清空')
{
	const g = blank()
	hasCard(g)
	ok('挂卡后 strait_force_axis 有值',
		Object.keys(g.status_aura.strait_force_axis || {}).length > 0,
		JSON.stringify(g.status_aura.strait_force_axis))
	I.revert_status_ongoing(g, '15254#1', '德国')
	ok('★ 撤销后清空', Object.keys(g.status_aura.strait_force_axis || {}).length === 0)
}

section('S9 虚拟海军不污染盘面与返回值')
{
	const g = blank()
	put(g, 'pDEhome', '德国', 'army', GER)
	put(g, 'pDEross', '德国', 'army', ROSS)
	hasCard(g)
	const sup = I.compute_supply(g)
	const left = Object.keys(g.location).filter(p => String(p).indexOf('__vnavy') === 0)
	ok('game.location 无残留 __vnavy_*', left.length === 0, left)
	ok('返回 in_supply 无 __vnavy_* 键',
		Object.keys(sup.in_supply).every(k => String(k).indexOf('__vnavy') < 0))
	ok('sources 无 __vnavy_* 键',
		Object.keys(sup.sources).every(k => String(k).indexOf('__vnavy') < 0))
}

section('S10【玩家指定】仅北欧有意大利陆军 + 挂 15254 -> 期望【断补】')
{
	/*
	 * 这是"中继不是源"的反面验证：
	 *   虚拟意海军要成立，B 条件要求相邻有【补给中的】部队；
	 *   而北欧这支意军本身没有补给链（远离意大利本土），
	 *   于是虚拟海军也断补 -> 救不了它。期望断补。
	 */
	const g = blank()
	put(g, 'pITa', '意大利', 'army', NORDIC)     /* 孤军深入：仅北欧有意军 */
	hasCard(g)
	const sup = I.compute_supply(g)
	console.log('    北欧 allies/axis 邻居:', adj(g, NORDIC, 'axis').map(nm).join(','))
	ok('★ 北欧的意大利陆军断补（虚拟海军救不了孤军）', !sup.in_supply['pITa'])
	/* 对照：把意军放回本土（★）应有补给，证明不是判定本身的问题 */
	const g2 = blank()
	put(g2, 'pITb', '意大利', 'army', d.id_of('意大利'))
	hasCard(g2)
	ok('对照：意大利本土（★）的意军有补给', !!I.compute_supply(g2).in_supply['pITb'])
}

console.log('\n==============================================')
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) { console.log('失败项：\n - ' + fails.join('\n - ')); process.exit(1) }
console.log('ALL PASS')
