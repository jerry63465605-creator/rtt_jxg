/*
 * 契约测试：棋子查询原语（region_spaces / list_pieces / count_pieces / has_pieces）
 * 【2026-10-23 D7】这些原语是 15218/15219/15220/15223 四个"数错国别/兵种" bug 的
 * 唯一修复点，其行为必须被锁住，否则改动 _pieces_owner_missing 会让漏洞静默回来。
 *
 * 覆盖：
 *   A. 归属缺失（铁律①）-> 返回空 + 写【警告】日志（不是"数全场"）
 *   B. 归属四选一：nation / nations / faction / enemyOf
 *   C. 附加过滤：types / supplied
 *   D. region_spaces 四种范围：space / spaces / radius / adjacent / excludeSelf / side
 *   E. 薄封装同源：count/has 与 list 结果一致
 *
 * 用法：node tools/_smoke_count_contract.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { data } = I

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

const SP = (n) => I.data.id_of(n)
const EAST = SP('东欧'), WEST = SP('西欧'), NORTH = SP('北海')

function base() {
	const g = rules.setup(1)
	for (const p in g.location) delete g.location[p]
	g.log.length = 0
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	return g
}
function put(g, pid, nation, type, space) {
	g.location[pid] = space
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
}

/* 东欧：德国陆军 x2 + 英国陆军 x1；西欧：意大利陆军 x1；北海：英国海军 x1 */
function board() {
	const g = base()
	put(g, 'p1', '德国', 'army', EAST)
	put(g, 'p2', '德国', 'army', EAST)
	put(g, 'p3', '英国', 'army', EAST)
	put(g, 'p4', '意大利', 'army', WEST)
	put(g, 'p5', '英国', 'navy', NORTH)
	return g
}

/* ============================================================ */
console.log('=== A. 归属缺失 -> 返回空 + 写警告（铁律①） ===')
{
	const g = board()
	const before = g.log.length
	ok('list_pieces({}) = []', I.list_pieces(g, {}).length === 0)
	ok('list_pieces({space}) = []（有范围但无归属，同样拒绝）',
		I.list_pieces(g, { space: EAST }).length === 0)
	ok('count_pieces({}) = 0', I.count_pieces(g, {}) === 0)
	ok('has_pieces({}) = false', I.has_pieces(g, {}) === false)
	const warns = g.log.slice(before).filter(l => /【警告】/.test(l) && /归属条件/.test(l))
	ok('每次拒绝都写一条【警告】日志', warns.length === 4, 'warns=' + warns.length)
}

console.log('\n=== B. 归属四选一 ===')
{
	const g = board()
	ok('nation=德国 东欧 = 2', I.count_pieces(g, { space: EAST, nation: '德国' }) === 2)
	ok('nation=英国 东欧 = 1', I.count_pieces(g, { space: EAST, nation: '英国' }) === 1)
	ok('nation=意大利 东欧 = 0（别国不算）', I.count_pieces(g, { space: EAST, nation: '意大利' }) === 0)
	ok('nations=[德国,意大利] 东欧 = 2', I.count_pieces(g, { space: EAST, nations: ['德国', '意大利'] }) === 2)
	ok('faction=axis 东欧 = 2（德2 轴心，英1 同盟）',
		I.count_pieces(g, { space: EAST, faction: 'axis' }) === 2)
	ok('faction=allies 东欧 = 1', I.count_pieces(g, { space: EAST, faction: 'allies' }) === 1)
	ok('enemyOf=德国 东欧 = 1（英国）', I.count_pieces(g, { space: EAST, enemyOf: '德国' }) === 1)
	ok('enemyOf=英国 东欧 = 2（德2）', I.count_pieces(g, { space: EAST, enemyOf: '英国' }) === 2)
	ok('enemyOf=德国 西欧 = 0（意大利同为轴心，非敌）',
		I.count_pieces(g, { space: WEST, enemyOf: '德国' }) === 0)
}

console.log('\n=== C. 附加过滤：types / supplied ===')
{
	const g = board()
	ok('types=[army] 东欧 nation=德国 = 2',
		I.count_pieces(g, { space: EAST, nation: '德国', types: ['army'] }) === 2)
	ok('types=[navy] 东欧 nation=德国 = 0',
		I.count_pieces(g, { space: EAST, nation: '德国', types: ['navy'] }) === 0)
	ok('types=[army,navy] 北海 nation=英国 = 1',
		I.count_pieces(g, { space: NORTH, nation: '英国', types: ['army', 'navy'] }) === 1)
	/* supplied：西欧的意大利陆军是否在补给内，取决于补给计算；只验"过滤生效且不报错" */
	const all = I.count_pieces(g, { space: WEST, nation: '意大利' })
	const sup = I.count_pieces(g, { space: WEST, nation: '意大利', supplied: true })
	ok('supplied 过滤不改变上限且结果 ⊆ 全集', sup <= all, 'supplied=' + sup + ' all=' + all)
}

console.log('\n=== D. region_spaces 范围模式 ===')
{
	const g = board()
	ok('space 精确 -> [东欧]',
		JSON.stringify(I.region_spaces(g, { space: EAST }).map(Number)) === JSON.stringify([Number(EAST)]))
	ok('spaces 多格 -> 两个都在',
		I.region_spaces(g, { spaces: ['东欧', '西欧'] }).length === 2)
	ok('space 无效 -> []', I.region_spaces(g, { space: '不存在的地名' }).length === 0)

	const nbs = (data.spaces[EAST].connections || []).map(Number)
	const adj = I.region_spaces(g, { space: EAST, adjacent: true }).map(Number)
	ok('adjacent 含自身（旧行为，勿改）', adj.indexOf(Number(EAST)) >= 0, 'size=' + adj.length)
	const adjNo = I.region_spaces(g, { space: EAST, adjacent: true, excludeSelf: true }).map(Number)
	ok('adjacent + excludeSelf 去掉自身', adjNo.indexOf(Number(EAST)) < 0)
	ok('adjacent + excludeSelf = 全部几何邻居', adjNo.length === nbs.length,
		adjNo.length + ' vs ' + nbs.length)

	const r1 = I.region_spaces(g, { space: EAST, radius: 1 }).map(Number)
	ok('radius:1 == adjacent（同样含自身）',
		JSON.stringify(r1.slice().sort()) === JSON.stringify(adj.slice().sort()))
	const r2 = I.region_spaces(g, { space: EAST, radius: 2 }).map(Number)
	ok('radius:2 范围 ⊇ radius:1', r2.length >= r1.length, r1.length + ' -> ' + r2.length)

	/* 全场：不给 space -> 所有格 */
	ok('无 space = 全场', I.region_spaces(g, {}).length === data.spaces.length - 1,
		String(I.region_spaces(g, {}).length))

	/* side 与 radius 互斥（防口径混用） */
	let threw = false
	try { I.region_spaces(g, { space: EAST, side: 'axis', radius: 1 }) } catch (e) { threw = true }
	ok('side + radius 同时给 -> 抛错（口径混用保护）', threw)
}

console.log('\n=== E. 薄封装同源 + 全场聚合 ===')
{
	const g = board()
	const list = I.list_pieces(g, { nation: '德国' })
	ok('count == list.length', I.count_pieces(g, { nation: '德国' }) === list.length, String(list.length))
	ok('has == list.length>0', I.has_pieces(g, { nation: '德国' }) === (list.length > 0))
	ok('全场 nation=德国 = 2', list.length === 2)
	ok('全场 faction=allies = 2（英国陆军+海军）',
		I.count_pieces(g, { faction: 'allies' }) === 2)
	/* 顺序 = game.location 遍历顺序（客户端候选展示依赖） */
	const keys = Object.keys(g.location).filter(p => g.piece_nation[p] === '德国')
	ok('返回顺序 == location 遍历顺序',
		JSON.stringify(list) === JSON.stringify(keys), JSON.stringify(list) + ' vs ' + JSON.stringify(keys))
}

console.log('\n=== F. 空盘面 / 已消灭部队 ===')
{
	const g = base()
	ok('空盘 list = []', I.list_pieces(g, { nation: '德国' }).length === 0)
	put(g, 'z1', '德国', 'army', EAST)
	g.location['z1'] = null                 /* 已消灭：location 为 null */
	ok('location=null 不计入', I.count_pieces(g, { nation: '德国' }) === 0)
}

console.log('\n' + (fail ? 'FAIL / ' + fail : 'ALL PASS'))
process.exit(fail ? 1 : 0)
