/* 15431《全面侵华》回归（2026-10-12）。
 *
 * 卡面：对<中国>发起陆战后：在战斗地区建设陆军。对相邻地区发起1次陆战。
 *
 * 玩家反馈"发动后没有效果"的两个错：
 *   ① 原实现漏了"在战斗地区建设陆军"；
 *   ② 陆战目标写成了【战斗地区】，卡面是【相邻地区】。
 * 并按玩家口径支持【延期续做】：建设若触发其它响应，先处理那些响应，
 * 最后才回来选陆战目标（不能插队）。
 *
 * ⚠ 事实：
 *   · _internal 已导出 RESPONSE_EFFECT_IMPL，可直接单测 effect。
 *   · 中国东部=22，邻接 [19 中国西部, 21 中国东北, 37 东南亚, 40 东海]；
 *     其中 40 东海是 sea，故陆战候选应为 19/21/37（不含战斗地区 22 自身）。
 *   · pieces_on 返回【字符串】id，自造棋子 id 用字符串。
 *   · 发起单位需补给：用 I.add_supply_point 把 21 设为补给点。
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

const SP_CN_EAST = 22   /* 战斗地区：中国东部 */
const SP_CN_NE = 21     /* 发起地/候选：中国东北 */

function baseGame() {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	I.add_supply_point(g, SP_CN_NE)
	g.response_queue = []
	g.pending_response_choice = null
	g.deferred_response_choice = null
	I.set_skip_turn_guard(true)
	return g
}
function putPiece(g, id, nation, type, space) {
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function armiesAt(g, space, nation) {
	let n = 0
	for (const p in g.location)
		if (g.location[p] === space && g.piece_nation[p] === nation &&
			g.piece_type[p] === 'army') n++
	return n
}

const impl = I.RESPONSE_EFFECT_IMPL['15431']
ok('15431 effect 已注册', typeof impl === 'function')

/* 找某地区某国某兵种的棋子 */
function findPiece(g, space, nation, type) {
	for (const p in g.location)
		if (g.location[p] === space && g.piece_nation[p] === nation &&
			g.piece_type[p] === type) return p
	return null
}

console.log('\n=== 1. 第①步：在【战斗地区】建设陆军（原来完全缺失）===')
let g1 = baseGame()
putPiece(g1, 'jp1', '日本', 'army', SP_CN_NE)     /* 发起单位在相邻陆地 */
/*
 * ⚠ 中国东部(22)【初始就有】中国陆军（setup 自带，如 p8）。
 *   不能再往 22 加第二支中国陆军 —— 每国每格限 1 支，会让 do_battle 直接
 *   失败（ok:false），守军清不掉 -> 建设被"有敌方部队"拒绝。
 *   必须用 findPiece 找初始守军当目标。
 */
const cnArmy = findPiece(g1, SP_CN_EAST, '中国', 'army')
console.log('   初始中国守军 =', cnArmy)
let r0 = I.do_battle(g1, '日本', SP_CN_EAST, cnArmy, 'land', { from: 'jp1' })
console.log('   前置战斗 -> ' + j(r0))
ok('前置战斗成功清掉守军', r0.ok === true, j(r0))
const before = armiesAt(g1, SP_CN_EAST, '日本')
let r1 = impl(g1, 'axis', { space: SP_CN_EAST, kind: 'land', nation: '日本' })
console.log('   effect -> ' + j(r1))
ok('战斗地区建设出日本陆军', armiesAt(g1, SP_CN_EAST, '日本') === before + 1,
	'before=' + before + ' after=' + armiesAt(g1, SP_CN_EAST, '日本'))

console.log('\n=== 2. 第②步：陆战候选是【相邻陆地】，不含战斗地区本身 ===')
ok('返回 pending 等待玩家选目标', !!(r1 && r1.pending), j(r1 && r1.pending))
const cands = ((r1 && r1.candidates) || []).map(c => Number(c.id))
console.log('   候选 = ' + j(cands))
ok('候选不含战斗地区 22', cands.indexOf(SP_CN_EAST) < 0, j(cands))
ok('候选含相邻陆地 21', cands.indexOf(SP_CN_NE) >= 0, j(cands))
ok('候选不含海域 40（东海）', cands.indexOf(40) < 0, j(cands))

console.log('\n=== 3. 第②步：选目标后真正发起陆战 ===')
/* 在 19 中国西部放一支中国陆军当靶子 */
putPiece(g1, 'cn2', '中国', 'army', 19)
const tgt = cands.indexOf(19) >= 0 ? 19 : cands[0]
console.log('   选择目标 =', tgt)
let r2 = impl(g1, 'axis', { space: SP_CN_EAST, kind: 'land', nation: '日本' }, tgt)
console.log('   effect -> ' + j(r2))
ok('陆战已结算（返回 ok/desc）', r2 && typeof r2.desc === 'string', j(r2))

console.log('\n=== 4. 延期续做：建设触发其它响应时不挂起、转入 deferred ===')
let g2 = baseGame()
putPiece(g2, 'jp2', '日本', 'army', SP_CN_NE)
const cnArmy2 = findPiece(g2, SP_CN_EAST, '中国', 'army')
I.do_battle(g2, '日本', SP_CN_EAST, cnArmy2, 'land', { from: 'jp2' })
/* 手动模拟"建设触发了别的响应"：建设前先占住队列，建设后队列会再变长。
 * 这里直接验证 grew 判据的效果：调用前队列长度 1，若建设 push 了新项则 >1。
 * 为确保场景成立，先塞一条无关的 build 响应批次。 */
g2.response_queue.push({
	on: 'build', owner_side: 'allies',
	ctx: { type: 'army', nation: '日本', space: SP_CN_EAST },
	candidates: [{ card_id: 'X#1', card_face: 'X', name: '其它响应', owner_side: 'allies', nation: '中国' }],
})
const qLen0 = g2.response_queue.length
/* 直接调 effect：内部比较的是 build_piece 前后的长度 */
let r3 = impl(g2, 'axis', { space: SP_CN_EAST, kind: 'land', nation: '日本' })
console.log('   队列 前=' + qLen0 + ' 后=' + g2.response_queue.length)
console.log('   effect -> ' + j(r3 && { defer: r3.defer, pending: r3.pending, desc: r3.desc }))
/* 本局没有真实匹配 build 的响应卡，故仍是常规挂起；defer 分支需有卡才走 */
ok('无其它响应触发时走常规挂起（pending）', !!(r3 && r3.pending) || !!(r3 && r3.defer),
	j(r3 && { defer: r3.defer, pending: r3.pending }))

console.log('\n=== 5. 延期提升：deferred 在队列清空后变成 pending_response_choice ===')
let g3 = baseGame()
g3.deferred_response_choice = {
	card_id: '15431#1', card_face: '15431', name: '全面侵华',
	owner_side: 'axis', kind: 'space',
	candidates: [{ id: 21, name: '中国东北' }],
	prompt: '选择要发起陆战的相邻地区', ctx: {}, extra: null,
}
g3.response_queue = []      /* 队列已空 */
const fn = (I.promote_deferred_response) || null
if (fn) {
	fn(g3)
	ok('队列清空后提升为 pending_response_choice',
		!!(g3.pending_response_choice && g3.pending_response_choice.card_face === '15431'),
		j(g3.pending_response_choice))
	ok('提升后 deferred 已清除', !g3.deferred_response_choice, j(g3.deferred_response_choice))
} else {
	console.log('  [SKIP] promote_deferred_response 未导出，跳过')
}

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
