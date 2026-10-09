/*
 * 日本经济战卡冒烟自检（2026-10-06）
 * 覆盖：15414 封锁海参崴 / 15415 气球炸弹（可选回手 / 可选弃牌）
 *      15416 潜艇支援太平洋诸岛 / 15417 印度洋警备队 / 15418 轰炸重庆
 *      7901 强占马六甲海峡
 * 用法：node tools/_smoke_ja_econ.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
function put(g, id, nation, type, spaceName) {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function neighborName(spaceName) {
	const id = d.id_of(spaceName)
	const nb = d.spaces[id].connections[0]
	return d.spaces[nb].name
}
/* BFS 取距离 ring 跳的某个真实地块名（ring=1 即相邻，ring=2 即相邻之相邻） */
function ringName(spaceName, ring) {
	const id = d.id_of(spaceName)
	const seen = new Set([id]); let frontier = [id]
	for (let r = 0; r < ring; r++) {
		const nxt = []
		for (const sp of frontier)
			for (const nb of d.spaces[sp].connections)
				if (!seen.has(nb)) { seen.add(nb); nxt.push(nb) }
		frontier = nxt
	}
	return d.spaces[frontier[0]].name
}
function freshJa() {
	let g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	return g
}
const give = (g, nation, face) => g.hands[nation].push(String(face) + '#1')
const play = (g, card, target) =>
	rules.action(g, 'Axis', 'play_card', target ? { card, target } : { card })
const scoreDelta = (g, s0) => (g.score.axis || 0) - s0
const discBefore = (g, nat) => (g.discard[nat] || []).length

console.log('=== 15414 封锁海参崴 ===')
{
	let g = freshJa(); give(g, '日本', 15414)
	put(g, 'jaE', '日本', 'army', '东海')
	put(g, 'jaN', '日本', 'navy', '北太平洋')
	const s0 = g.score.axis || 0, b = discBefore(g, '苏联')
	g = play(g, '15414#1', '苏联')
	ok('苏联损耗 1 张', discBefore(g, '苏联') - b === 1)
	ok('日本+2分（东海1+北太平洋1）', scoreDelta(g, s0) === 2, 'delta=' + scoreDelta(g, s0))
	ok('15414 进弃牌堆', (g.discard['日本'] || []).indexOf('15414#1') >= 0)
}

console.log('\n=== 15415 气球炸弹（弃3手牌→本卡回手，可选） ===')
{
	let g = freshJa()
	g.hands['日本'] = ['999#1', '998#1', '997#1', '996#1', '995#1'] // 5 张，无本卡
	give(g, '日本', 15415)            // 本卡补上 → 手牌 6 张
	const s0 = g.score.axis || 0
	g = play(g, '15415#1', '日本')
	ok('日本+1分', scoreDelta(g, s0) === 1, 'delta=' + scoreDelta(g, s0))
	ok('15415 进弃牌堆', (g.discard['日本'] || []).indexOf('15415#1') >= 0)
	ok('挂起可选窗口 pending_balloon', !!g.pending_balloon && g.pending_balloon.card === '15415#1')
	const handPlay = g.hands['日本'].length // 5（本卡已进弃牌堆）
	// 绑定动作（原子）：弃 3 张（代价）→ 本卡回手（效果）
	g = rules.action(g, 'Axis', 'balloon_discard', { drop: ['999#1', '998#1', '997#1'] })
	ok('弃的3张进弃牌堆', ['999#1','998#1','997#1'].every(c => (g.discard['日本']||[]).indexOf(c) >= 0))
	ok('本卡移出弃牌堆回手牌', (g.discard['日本']||[]).indexOf('15415#1') < 0 && g.hands['日本'].indexOf('15415#1') >= 0)
	ok('回手后手牌变 3（2+本卡）', g.hands['日本'].length === handPlay - 3 + 1, 'hand=' + g.hands['日本'].length)
	ok('完成后窗口关闭', g.pending_balloon === null)
}
{
	// 代价不足：只弃 2 张 → 拒绝，不触发回手，窗口仍在
	let g = freshJa(); g.hands['日本'] = ['999#1', '998#1', '997#1', '15415#1']
	g = play(g, '15415#1', '日本')
	g = rules.action(g, 'Axis', 'balloon_discard', { drop: ['999#1', '998#1'] })
	ok('弃2张被拒（需恰好3张）', g.pending_balloon !== null)
	ok('被拒后气球炸弹仍在弃牌堆', (g.discard['日本'] || []).indexOf('15415#1') >= 0)
	// 补第三张后正确完成
	g.hands['日本'].push('996#1')
	g = rules.action(g, 'Axis', 'balloon_discard', { drop: ['999#1', '998#1', '997#1'] })
	ok('弃3张后回手成功', g.hands['日本'].indexOf('15415#1') >= 0)
	ok('窗口关闭', g.pending_balloon === null)
}
{
	// 跳过：只完成，不弃牌不回手
	let g = freshJa(); g.hands['日本'] = ['15415#1', '999#1', '998#1']
	g = play(g, '15415#1', '日本')
	const handSkip = g.hands['日本'].length // 15415 已进弃牌堆，手牌剩 2
	g = rules.action(g, 'Axis', 'balloon_done', {})
	ok('跳过：手牌不变（仅 15415 已进弃牌堆）', g.hands['日本'].length === handSkip, 'hand=' + g.hands['日本'].length)
	ok('跳过：窗口关闭', g.pending_balloon === null)
	ok('跳过：气球炸弹仍在弃牌堆', (g.discard['日本'] || []).indexOf('15415#1') >= 0)
}
{
	// 错过即失效：做别的动作（再打一张牌）会令窗口自动失效
	let g = freshJa(); g.hands['日本'] = ['15415#1', '999#1']
	g = play(g, '15415#1', '日本')
	ok('窗口已挂起', !!g.pending_balloon)
	g.hands['日本'].push('15414#1')
	g = play(g, '15414#1', '苏联')
	ok('做别的动作后窗口自动失效', g.pending_balloon === null)
}

console.log('\n=== 15416 潜艇支援太平洋诸岛（[潜艇行动]） ===')
{
	let g = freshJa(); give(g, '日本', 15416)
	put(g, 'jnEP', '日本', 'navy', '东太平洋')
	put(g, 'jnEP2', '日本', 'navy', neighborName('东太平洋')) // 相邻也计数
	const s0 = g.score.axis || 0, b = discBefore(g, '美国')
	g = play(g, '15416#1', '美国')
	ok('美国损耗 2 张', discBefore(g, '美国') - b === 2)
	ok('日本+4分（2支海军×2）', scoreDelta(g, s0) === 4, 'delta=' + scoreDelta(g, s0))
	ok('last_econ.tag=潜艇行动', (g.last_econ || {}).tag === '潜艇行动')
}

console.log('\n=== 15417 印度洋警备队 ===')
{
	let g = freshJa(); give(g, '日本', 15417)
	put(g, 'jnIO', '日本', 'navy', '印度洋')
	put(g, 'jnIO2', '日本', 'navy', neighborName('印度洋'))
	const s0 = g.score.axis || 0, b = discBefore(g, '英国')
	g = play(g, '15417#1', '英国')
	ok('英国损耗 2 张', discBefore(g, '英国') - b === 2)
	ok('日本+4分（2支海军×2）', scoreDelta(g, s0) === 4, 'delta=' + scoreDelta(g, s0))
}

console.log('\n=== 15418 轰炸重庆（半径2：本格+相邻+相邻之相邻） ===')
{
	let g = freshJa(); give(g, '日本', 15418)
	put(g, 'jaA0', '日本', 'air', '中国西部')               // 本格 dist0
	put(g, 'jaA1', '日本', 'air', ringName('中国西部', 1))  // 相邻 dist1（如中国东部）
	put(g, 'jaA2', '日本', 'air', ringName('中国西部', 2))  // 相邻之相邻 dist2（如东海）
	const s0 = g.score.axis || 0, b = discBefore(g, '美国')
	g = play(g, '15418#1', '美国')
	ok('美国损耗 2 张', discBefore(g, '美国') - b === 2)
	ok('日本+3分（半径2内3支空军）', scoreDelta(g, s0) === 3, 'delta=' + scoreDelta(g, s0))
}

console.log('\n=== 7901 强占马六甲海峡（条件：东南亚有日陆军 且 相邻有日海军） ===')
{
	// 条件满足
	let g = freshJa(); give(g, '日本', 7901)
	put(g, 'jaSE', '日本', 'army', '东南亚')
	put(g, 'jnSEN', '日本', 'navy', neighborName('东南亚'))
	const s0 = g.score.axis || 0, b = discBefore(g, '英国')
	g = play(g, '7901#1', '英国')
	ok('英国损耗 2 张', discBefore(g, '英国') - b === 2)
	ok('日本+2分', scoreDelta(g, s0) === 2, 'delta=' + scoreDelta(g, s0))

	// 仅陆军、无相邻海军 → 不触发
	let g2 = freshJa(); give(g2, '日本', 7901)
	put(g2, 'jaSE2', '日本', 'army', '东南亚')
	const s02 = g2.score['AXIS'] || 0, b2 = discBefore(g2, '英国')
	g2 = play(g2, '7901#1', '英国')
	ok('仅陆军无相邻海军 → 英国不损耗', discBefore(g2, '英国') - b2 === 0)
	ok('仅陆军无相邻海军 → 日本不加分', scoreDelta(g2, s02) === 0)

	// 仅相邻海军、无陆军 → 不触发
	let g3 = freshJa(); give(g3, '日本', 7901)
	put(g3, 'jnSEN3', '日本', 'navy', neighborName('东南亚'))
	const s03 = g3.score['AXIS'] || 0, b3 = discBefore(g3, '英国')
	g3 = play(g3, '7901#1', '英国')
	ok('仅相邻海军无陆军 → 英国不损耗', discBefore(g3, '英国') - b3 === 0)
	ok('仅相邻海军无陆军 → 日本不加分', scoreDelta(g3, s03) === 0)
}

console.log('\n================ ' + pass + ' PASS / ' + fail + ' FAIL ================')
process.exit(fail ? 1 : 0)
