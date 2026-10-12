/* 回归：do_battle 的 4 个成功出口都必须派发 'battle' 时点（2026-10-12）。
 *
 * 背景：15431《全面侵华》（日本 RESPONSE，on:'battle'，
 *   filter = kind==='land' 且地区在中国）
 * 玩家报告：防守方空军代受 + 发起方飞机抵消结算完后，没有给打出时机。
 * 根因：do_battle 4 个成功出口里，只有 2 个派发了 'battle'
 *   （代受成立 / 正常战斗），"抵消成立"与"空打"直接 return 漏了。
 *
 * 验证：直接调 I.do_battle 构造各分支，检查 game.response_queue
 * 是否出现 on==='battle' 且候选含 15431。
 *
 * ⚠ 踩坑（实测确认，别再犯）：
 *   1) 地区：中国东部=22，邻接 [19,21,37,40]；发起地用【陆地】21 中国东北。
 *   2) pieces_on 用 for..in 遍历 game.location -> 返回的是【字符串】id。
 *      所以自造棋子 id 与 target_piece 都必须用字符串，否则
 *      enemies.indexOf(数字) 恒为 -1 -> "指定的部队不是该地区的敌方部队"。
 *   3) 发起单位必须处于补给状态：日本本土不与中国东北连通，
 *      故用 I.add_supply_point(g, 21) 把发起地设为补给点。
 *   4) 中国东部初始就有中国陆军，要做【空打】必须先移除它。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { console.log('  [PASS] ' + name); pass++ }
	else { console.log('  [FAIL] ' + name + (extra ? ' :: ' + extra : '')); fail++ }
}
const j = x => JSON.stringify(x)

const SP_CN_EAST = 22   /* 中国东部 */
const SP_CN_NE = 21     /* 中国东北（陆地，发起方所在地） */

function baseGame() {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	I.add_supply_point(g, SP_CN_NE)   /* 发起地设为补给点 */
	g.table_responses = [{
		card_id: '15431#1', card_face: '15431',
		owner_side: 'axis', nation: '日本',
	}]
	g.response_queue = []
	I.set_skip_turn_guard(true)
	return g
}

/* 放棋子：id 用【字符串】，与 pieces_on 返回的键一致 */
function putPiece(g, id, nation, type, space) {
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}

function dropPiece(g, id) {
	delete g.location[id]
	delete g.piece_nation[id]
	delete g.piece_type[id]
}

/* 找某地区某国某兵种的棋子 */
function findPiece(g, space, nation, type) {
	for (const p in g.location)
		if (g.location[p] === space && g.piece_nation[p] === nation &&
			g.piece_type[p] === type) return p
	return null
}

function hasBattleWith15431(g) {
	const q = g.response_queue || []
	return q.some(e => e.on === 'battle' &&
		(e.candidates || []).some(c => String(c.card_face) === '15431'))
}

console.log('=== 1. 基线：正常战斗（无空军介入）===')
let g1 = baseGame()
putPiece(g1, 'ja1', '日本', 'army', SP_CN_NE)           /* 发起单位（相邻陆地） */
const cnArmy1 = findPiece(g1, SP_CN_EAST, '中国', 'army') || (putPiece(g1, 'cn1', '中国', 'army', SP_CN_EAST), 'cn1')
console.log('   中国守军 id =', cnArmy1)
let r1 = I.do_battle(g1, '日本', SP_CN_EAST, cnArmy1, 'land')
console.log('   -> ' + j(r1))
ok('正常战斗 ok', r1.ok === true, j(r1))
ok('正常战斗派发 battle 且含 15431', hasBattleWith15431(g1), j(g1.response_queue))

console.log('\n=== 2. 空打（无守军）===')
let g2 = baseGame()
putPiece(g2, 'ja2', '日本', 'army', SP_CN_NE)
/* 清空中国东部的中国陆军，制造真正的空地 */
for (const p of Object.keys(g2.location)) {
	if (g2.location[p] === SP_CN_EAST && g2.piece_nation[p] === '中国')
		dropPiece(g2, p)
}
let r2 = I.do_battle(g2, '日本', SP_CN_EAST, null, 'land')
console.log('   -> ' + j(r2))
ok('空打 ok 且 empty=true', r2.ok === true && r2.empty === true, j(r2))
ok('空打派发 battle 且含 15431', hasBattleWith15431(g2), j(g2.response_queue))

console.log('\n=== 3. 抵消成立（空军代受 + 飞机抵消）===')
let g3 = baseGame()
putPiece(g3, 'ja3', '日本', 'army', SP_CN_NE)        /* 发起单位 */
const cnArmy3 = findPiece(g3, SP_CN_EAST, '中国', 'army') || (putPiece(g3, 'cn3', '中国', 'army', SP_CN_EAST), 'cn3')
putPiece(g3, 'cnAir3', '中国', 'air', SP_CN_EAST)    /* 防守方空军（代受） */
putPiece(g3, 'jpAir3', '日本', 'air', SP_CN_NE)      /* 发起方空军（抵消，相邻） */
let r3 = I.do_battle(g3, '日本', SP_CN_EAST, cnArmy3, 'land',
	{ from: 'ja3', defend_air: 'cnAir3', counter_air: 'jpAir3' })
console.log('   -> ' + j(r3))
ok('抵消 ok', r3.ok === true, j(r3))
ok('抵消 countered_by_air 生效', r3.countered_by_air === 'jpAir3', j(r3 && r3.countered_by_air))
ok('抵消成立派发 battle 且含 15431', hasBattleWith15431(g3), j(g3.response_queue))

console.log('\n=== 4. 对照：代受成立（不抵消）原本就会派发，确认未回归 ===')
let g4 = baseGame()
putPiece(g4, 'ja4', '日本', 'army', SP_CN_NE)
const cnArmy4 = findPiece(g4, SP_CN_EAST, '中国', 'army') || (putPiece(g4, 'cn4', '中国', 'army', SP_CN_EAST), 'cn4')
putPiece(g4, 'cnAir4', '中国', 'air', SP_CN_EAST)
let r4 = I.do_battle(g4, '日本', SP_CN_EAST, cnArmy4, 'land',
	{ from: 'ja4', defend_air: 'cnAir4' })
console.log('   -> ' + j(r4))
ok('代受成立 ok', r4.ok === true, j(r4))
ok('代受成立派发 battle 且含 15431', hasBattleWith15431(g4), j(g4.response_queue))

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
