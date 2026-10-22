/*
 * 回归测试：棋子查询原语 region_spaces / list_pieces / count_pieces / has_pieces
 * （2026-10-22 count_units 重构 · P0）
 *
 * 覆盖「区域 × 归属 × 形态」矩阵：
 *   A 单格+国别+兵种        B 相邻（含本格）        C 阵营
 *   D 敌方(enemyOf)         E 全场                  F 海域(terrain)
 *   G 半径                  H 显式多格              I 缺归属 -> 空 + 告警
 *   J side 与 radius 互斥   K 列表稳定/去重          L 只数在版图上的棋子
 *
 * 用法：node tools/_smoke_count_primitives.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}
const id = (n) => I.data.id_of(n)
const NORTH = id('北欧'), WEST = id('西欧'), SEA_N = id('北海'), SEA_B = id('波罗的海')

function base() {
	const g = rules.setup(1)
	for (const p in g.location) delete g.location[p]        /* 清空开局棋子 */
	g.location = g.location || {}
	g.piece_nation = g.piece_nation || {}
	g.piece_type = g.piece_type || {}
	return g
}
function put(g, pid, nation, type, space) {
	g.location[pid] = space
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
}

console.log('=== A. 单格 + 国别 + 兵种 ===')
{
	const g = base()
	put(g, 'a1', '德国', 'army', NORTH)
	put(g, 'a2', '英国', 'army', NORTH)
	put(g, 'a3', '德国', 'air', NORTH)
	ok('德国陆军@北欧 = 1', I.count_pieces(g, { space: '北欧', types: ['army'], nation: '德国' }) === 1)
	ok('德国部队@北欧 = 2', I.count_pieces(g, { space: '北欧', types: ['army', 'air'], nation: '德国' }) === 2)
	ok('英国陆军@北欧 = 1', I.count_pieces(g, { space: '北欧', types: ['army'], nation: '英国' }) === 1)
	ok('意大利陆军@北欧 = 0', I.count_pieces(g, { space: '北欧', types: ['army'], nation: '意大利' }) === 0)
}

console.log('\n=== B. 相邻（含本格，几何邻接） ===')
{
	const g = base()
	put(g, 'b1', '德国', 'army', NORTH)     /* 北海的相邻 */
	put(g, 'b2', '德国', 'army', WEST)      /* 北海的相邻 */
	put(g, 'b3', '德国', 'army', id('东欧'))  /* 与北海不相邻 */
	ok('北海或相邻 德国陆军 = 2',
		I.count_pieces(g, { space: '北海', adjacent: true, types: ['army'], nation: '德国' }) === 2,
		'实得 ' + I.count_pieces(g, { space: '北海', adjacent: true, types: ['army'], nation: '德国' }))
	ok('不带 adjacent 只数本格 = 0',
		I.count_pieces(g, { space: '北海', types: ['army'], nation: '德国' }) === 0)
}

console.log('\n=== C. 阵营（faction） ===')
{
	const g = base()
	put(g, 'c1', '德国', 'army', NORTH)
	put(g, 'c2', '意大利', 'army', NORTH)
	put(g, 'c3', '日本', 'army', NORTH)
	put(g, 'c4', '英国', 'army', NORTH)
	ok('轴心陆军 = 3（德+意+日）',
		I.count_pieces(g, { space: '北欧', types: ['army'], faction: 'axis' }) === 3)
	ok('同盟陆军 = 1', I.count_pieces(g, { space: '北欧', types: ['army'], faction: 'allies' }) === 1)
}

console.log('\n=== D. 敌方（enemyOf） ===')
{
	const g = base()
	put(g, 'd1', '德国', 'army', NORTH)
	put(g, 'd2', '意大利', 'army', NORTH)     /* 友军，不算敌方 */
	put(g, 'd3', '英国', 'army', NORTH)
	put(g, 'd4', '苏联', 'army', NORTH)
	ok('德国的敌人@北欧 = 2', I.count_pieces(g, { space: '北欧', enemyOf: '德国' }) === 2)
	ok('英国的敌人@北欧 = 2', I.count_pieces(g, { space: '北欧', enemyOf: '英国' }) === 2)
}

console.log('\n=== E. 全场（不含 space） ===')
{
	const g = base()
	put(g, 'e1', '苏联', 'army', NORTH)
	put(g, 'e2', '苏联', 'army', WEST)
	put(g, 'e3', '苏联', 'navy', SEA_B)
	let manual = 0
	for (const p in g.location) if (g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army') manual++
	ok('全场苏联陆军 = 手工遍历', I.count_pieces(g, { types: ['army'], nation: '苏联' }) === manual,
		'primitive=' + I.count_pieces(g, { types: ['army'], nation: '苏联' }) + ' manual=' + manual)
	ok('全场苏联部队 = 3', I.count_pieces(g, { types: ['army', 'navy', 'air'], nation: '苏联' }) === 3)
}

console.log('\n=== F. 海域过滤（terrain） ===')
{
	const g = base()
	put(g, 'f1', '德国', 'navy', SEA_N)
	put(g, 'f2', '德国', 'navy', SEA_B)
	put(g, 'f3', '德国', 'army', NORTH)      /* 陆地，不算 */
	ok('德国海军在全部海域 = 2',
		I.count_pieces(g, { terrain: 'sea', types: ['navy'], nation: '德国' }) === 2)
	ok('terrain 与 space 组合：北欧是陆地 -> 0',
		I.count_pieces(g, { space: '北欧', terrain: 'sea', nation: '德国' }) === 0)
}

console.log('\n=== G. 半径（radius）===')
{
	const g = base()
	const jp = id('日本')
	const nb1 = (I.data.spaces[jp].connections || [])[0]
	put(g, 'g1', '美国', 'navy', nb1)        /* 日本的一跳相邻 */
	ok('radius=0 只数本格 -> 0',
		I.count_pieces(g, { space: '日本', radius: 0, nation: '美国' }) === 0)
	ok('radius=1 含一跳相邻 -> 1',
		I.count_pieces(g, { space: '日本', radius: 1, nation: '美国' }) === 1)
	put(g, 'g2', '美国', 'navy', jp)
	ok('radius 含本格', I.count_pieces(g, { space: '日本', radius: 1, nation: '美国' }) === 2)
}

console.log('\n=== H. 显式多格（spaces） ===')
{
	const g = base()
	put(g, 'h1', '中国', 'army', NORTH)
	put(g, 'h2', '中国', 'army', WEST)
	put(g, 'h3', '中国', 'army', id('东欧'))   /* 不在列表里 */
	ok('spaces=[北欧,西欧] 中国陆军 = 2',
		I.count_pieces(g, { spaces: ['北欧', '西欧'], types: ['army'], nation: '中国' }) === 2)
	ok('重复地区自动去重',
		I.count_pieces(g, { spaces: ['北欧', '北欧'], types: ['army'], nation: '中国' }) === 1)
}

console.log('\n=== I. 缺归属条件 -> 返回空 + 告警（铁律①） ===')
{
	const g = base()
	put(g, 'i1', '德国', 'army', NORTH)
	const n = I.count_pieces(g, { space: '北欧', types: ['army'] })
	ok('缺 nation/faction/enemyOf -> 0', n === 0, 'n=' + n)
	ok('日志有警告', (g.log || []).some(l => /棋子查询缺少归属条件/.test(l)),
		JSON.stringify((g.log || []).slice(-1)))
}

console.log('\n=== J. side 与 radius 互斥 ===')
{
	const g = base()
	let threw = false
	try { I.region_spaces(g, { space: '地中海', side: 'axis', radius: 2 }) } catch (e) { threw = true }
	ok('同时给出 side+radius 抛错', threw)
	const sps = I.region_spaces(g, { space: '地中海', side: 'axis' })
	ok('side 单跳含本格', sps.indexOf(id('地中海')) >= 0, JSON.stringify(sps.map(x => I.data.name_of(x))))
}

console.log('\n=== K. 列表形态稳定、可 indexOf ===')
{
	const g = base()
	put(g, 'k1', '苏联', 'army', NORTH)
	put(g, 'k2', '苏联', 'army', WEST)
	const l1 = I.list_pieces(g, { types: ['army'], nation: '苏联' })
	const l2 = I.list_pieces(g, { types: ['army'], nation: '苏联' })
	ok('两次查询结果一致', JSON.stringify(l1) === JSON.stringify(l2), JSON.stringify(l1))
	ok('可 indexOf 定位', l1.indexOf('k1') >= 0 && l1.indexOf('k2') >= 0)
	ok('has_pieces 与 list 同源', I.has_pieces(g, { types: ['army'], nation: '苏联' }) === (l1.length > 0))
	ok('无该兵种时 has_pieces=false', I.has_pieces(g, { types: ['air'], nation: '苏联' }) === false)
}

console.log('\n=== L. 只数【在版图上】的棋子 ===')
{
	const g = base()
	put(g, 'l1', '德国', 'army', NORTH)
	put(g, 'l2', '德国', 'army', null)        /* 无坐标 -> 不算 */
	ok('location 为空的棋子被排除',
		I.count_pieces(g, { types: ['army'], nation: '德国' }) === 1,
		'n=' + I.count_pieces(g, { types: ['army'], nation: '德国' }))
}

console.log('\n=== M. excludeSelf（卡面"相邻地区"不含本格） ===')
{
	const g = base()
	put(g, 'm1', '德国', 'army', NORTH)                 /* 本格 */
	ok('含本格时 adjacent=true 命中',
		I.has_pieces(g, { space: '北欧', adjacent: true, nation: '德国' }) === true)
	ok('excludeSelf=true 时本格不算',
		I.has_pieces(g, { space: '北欧', adjacent: true, excludeSelf: true, nation: '德国' }) === false)
	const nb = (I.data.spaces[NORTH].connections || [])[0]
	put(g, 'm2', '德国', 'army', nb)                    /* 相邻格 */
	ok('相邻格有部队 -> excludeSelf 仍命中',
		I.has_pieces(g, { space: '北欧', adjacent: true, excludeSelf: true, nation: '德国' }) === true)
	ok('excludeSelf 不影响集合去重',
		I.region_spaces(g, { space: '北欧', adjacent: true, excludeSelf: true }).indexOf(NORTH) < 0)
}

console.log('\n=== N. side（阵营视角连通，含海峡） ===')
{
	const g = base()
	const sps = I.region_spaces(g, { space: '地中海', side: 'axis' })
	ok('side 结果含本格', sps.indexOf(id('地中海')) >= 0)
	ok('side + excludeSelf 排除本格',
		I.region_spaces(g, { space: '地中海', side: 'axis', excludeSelf: true }).indexOf(id('地中海')) < 0)
	ok('side 结果非空（轴心视角有邻接）', sps.length > 1, JSON.stringify(sps.map(x => I.data.name_of(x))))
}

console.log('\n=== O. supplied（仅"处于补给状态"的棋子，17521 用） ===')
{
	const g = base()
	put(g, 'o1', '美国', 'navy', id('美国'))        /* 大本营，必有补给 */
	put(g, 'o2', '美国', 'navy', id('菲律宾'))      /* 远离本土，可能断补给 */
	const sup = I.compute_supply(g)
	const all = I.count_pieces(g, { types: ['navy'], nation: '美国' })
	const insup = I.count_pieces(g, { types: ['navy'], nation: '美国', supplied: true })
	ok('supplied 结果不超过全量', insup <= all, 'all=' + all + ' in=' + insup)
	ok('大本营海军在补给中', !!sup.in_supply['o1'], 'in_supply[o1]=' + !!sup.in_supply['o1'])
	ok('supplied 结果与 compute_supply 一致',
		insup === ['o1', 'o2'].filter(p => sup.in_supply[p]).length,
		'insup=' + insup)
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
