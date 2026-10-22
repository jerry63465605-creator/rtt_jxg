/*
 * 回归测试：15249《狼群战术》相关经济战的两处既有缺陷修复。
 *
 *   A. de_units_near 缺归属过滤
 *      · 15219 强行封锁 / 15220 袭击摩尔曼斯克：卡面「每有1支【德国部队】」，
 *        旧实现把相邻地区的盟军部队也数了进去 → 多损耗多得分。
 *      · 15218 季风艇群：卡面「每有1支【友方国家】陆军」，旧实现把敌方陆军也数了。
 *   B. status_on_econ 缺阵营守卫
 *      · 卡面「[北方行动]/[潜艇行动]被使用时」= 本方（轴心）使用；
 *        旧实现只看 tag 不看使用方，同盟国的 [潜艇行动] 也会给德国加分。
 *
 * 用法：node tools/_smoke_15219_15220.js
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

const NORTH = I.data.id_of('北欧')
const WEST = I.data.id_of('西欧')
const SEA_N = I.data.id_of('北海')
const INDIAN = I.data.id_of('印度洋')

function base(nation, card) {
	let g = rules.setup(1)
	g.current_nation = nation
	g.active = (nation === '英国') ? 'Allies' : 'Axis'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.hands = g.hands || {}
	g.table = g.table || {}
	g.hands[nation] = [card]
	g.table['德国'] = ['15249#1']      /* 桌面《狼群战术》 */
	return g
}
function put(g, pid, nation, type, space) {
	g.location[pid] = space
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
}
/* 清空某地区及其相邻地区上的全部棋子，避免开局布置干扰计数 */
function clearNear(g, name) {
	const id = I.data.id_of(name)
	const set = [id].concat(I.data.spaces[id].connections || [])
	for (const p in g.location) if (set.indexOf(g.location[p]) >= 0) delete g.location[p]
}
function firstLandNear(name) {
	const id = I.data.id_of(name)
	for (const nb of (I.data.spaces[id].connections || []))
		if (I.data.spaces[nb] && I.data.spaces[nb].terrain === 'land') return nb
	return null
}

console.log('=== A. 15219 强行封锁：只数德国部队（北欧/西欧各 1 陆军 + 1 空军）===')
{
	const g = base('德国', '15219#1')
	clearNear(g, '北海')
	put(g, 'p1', '德国', 'army', NORTH)
	put(g, 'p2', '德国', 'air', NORTH)
	put(g, 'p3', '德国', 'army', WEST)
	put(g, 'p4', '德国', 'air', WEST)
	const uk0 = g.decks['英国'].length
	const ax0 = g.score.axis || 0
	const r = rules.action(g, 'Axis', 'play_card', { card: '15219#1', target: '英国' })
	ok('k = 4（不计其它国家部队）', r.log.some(l => /有 4 支德国部队/.test(l)),
		JSON.stringify(r.log.slice(-2)))
	ok('英国共损 6 张（4 + 狼群 1 + 北欧条件 1）', uk0 - r.decks['英国'].length === 6,
		'lost=' + (uk0 - r.decks['英国'].length))
	ok('轴心 +5 分（4 + 狼群 1）', (r.score.axis - ax0) === 5, 'd=' + (r.score.axis - ax0))
}

console.log('\n=== A2. 15219：北欧另有 1 支【英国】陆军，计数不变 ===')
{
	const g = base('德国', '15219#1')
	clearNear(g, '北海')
	put(g, 'p1', '德国', 'army', NORTH)
	put(g, 'p2', '德国', 'air', NORTH)
	put(g, 'p3', '德国', 'army', WEST)
	put(g, 'p4', '德国', 'air', WEST)
	put(g, 'p5', '英国', 'army', NORTH)      /* 敌方陆军，不该计入 */
	const uk0 = g.decks['英国'].length
	const ax0 = g.score.axis || 0
	const r = rules.action(g, 'Axis', 'play_card', { card: '15219#1', target: '英国' })
	ok('k 仍为 4（英国陆军未计入）', r.log.some(l => /有 4 支德国部队/.test(l)),
		JSON.stringify(r.log.filter(l => /德国部队/.test(l))))
	ok('英国共损 6 张', uk0 - r.decks['英国'].length === 6, 'lost=' + (uk0 - r.decks['英国'].length))
	ok('轴心 +5 分', (r.score.axis - ax0) === 5)
}

console.log('\n=== A3. 15220 袭击摩尔曼斯克：只数德国部队（北欧 1 德陆军 + 1 英陆军）===')
{
	const g = base('德国', '15220#1')
	clearNear(g, '北欧')
	put(g, 'p1', '德国', 'army', NORTH)
	put(g, 'p2', '英国', 'army', NORTH)
	const su0 = g.decks['苏联'].length
	const ax0 = g.score.axis || 0
	const r = rules.action(g, 'Axis', 'play_card', { card: '15220#1', target: '苏联' })
	ok('k = 1（只数德国陆军）', r.log.some(l => /有 1 支德国部队/.test(l)),
		JSON.stringify(r.log.filter(l => /德国部队/.test(l))))
	ok('苏联共损 3 张（1 + 狼群 1 + 北欧条件 1）', su0 - r.decks['苏联'].length === 3,
		'lost=' + (su0 - r.decks['苏联'].length))
	ok('轴心 +2 分（1 + 狼群 1）', (r.score.axis - ax0) === 2, 'd=' + (r.score.axis - ax0))
}

console.log('\n=== A4. 15218 季风艇群：只数【友方（轴心）】陆军 ===')
{
	const g = base('德国', '15218#1')
	clearNear(g, '印度洋')
	const land = firstLandNear('印度洋')
	put(g, 'p1', '德国', 'army', land)
	put(g, 'p2', '英国', 'army', land)        /* 敌方陆军，不该计入 */
	const uk0 = g.decks['英国'].length
	const ax0 = g.score.axis || 0
	const r = rules.action(g, 'Axis', 'play_card', { card: '15218#1', target: '英国' })
	ok('k = 1（只数轴心陆军）', r.log.some(l => /有 1 支友方国家陆军/.test(l)),
		JSON.stringify(r.log.filter(l => /友方国家陆军/.test(l))))
	ok('英国共损 3 张（2×1 + 狼群 1；北欧无德陆军不加第二段）', uk0 - r.decks['英国'].length === 3,
		'lost=' + (uk0 - r.decks['英国'].length))
	ok('轴心 +3 分（15218 固定 2 + 狼群 1）', (r.score.axis - ax0) === 3, 'd=' + (r.score.axis - ax0))
}

console.log('\n=== B1. 阵营守卫：英国 15314《马耳他潜艇群》（链式）不触发狼群 ===')
{
	const g = base('英国', '15314#1')
	const ax0 = g.score.axis || 0
	let r = rules.action(g, 'Allies', 'play_card', { card: '15314#1' })
	ok('15314 进入链式挂起', !!r.pending_econ, 'pending=' + JSON.stringify((r.pending_econ || {}).chain))
	r = rules.action(r, 'Axis', 'resolve_econ', { choice: 'attrite' })   /* 德国 */
	r = rules.action(r, 'Axis', 'resolve_econ', { choice: 'attrite' })   /* 意大利 */
	ok('链式已结算完成', !r.pending_econ)
	ok('《狼群战术》未触发', !r.log.some(l => /狼群战术.*触发/.test(l)),
		JSON.stringify(r.log.slice(-3)))
	ok('轴心未因敌方潜艇行动加分', (r.score.axis - ax0) === 0, 'd=' + (r.score.axis - ax0))
}

console.log('\n=== B2. 正向：日本 15416《潜艇支援太平洋诸岛》（轴心）仍触发狼群 ===')
{
	const g = base('日本', '15416#1')
	clearNear(g, '北欧')      /* 北欧无德陆军 -> 只有第一段 +1 */
	const us0 = g.decks['美国'].length
	const ax0 = g.score.axis || 0
	const r = rules.action(g, 'Axis', 'play_card', { card: '15416#1', target: '美国' })
	ok('《狼群战术》已触发', r.log.some(l => /狼群战术.*触发/.test(l)),
		JSON.stringify(r.log.slice(-3)))
	ok('美国共损 3 张（2 + 狼群 1）', us0 - r.decks['美国'].length === 3,
		'lost=' + (us0 - r.decks['美国'].length))
	ok('轴心 +1 分（15416 无海军 -> 0，狼群 +1）', (r.score.axis - ax0) === 1, 'd=' + (r.score.axis - ax0))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
