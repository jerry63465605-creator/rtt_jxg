"use strict"
/*
 * 【2026-10-18】17506《沉睡的巨人》"先选择，后建设" 回归测试
 *
 * 卡面：在<太平洋>建设海军后，损耗1张牌：在相邻地区建设 1 支部队。
 * 改动：执行建设前，玩家须在「建设陆军 / 建设海军」之间二选一（need:'choice'），
 *       选择结果传入后续建设步（need:'space'）并由 build_piece 按所选兵种落地。
 *
 * 复用：15406/15351 的 need:'choice'+choiceOptions 范式 + use_armed_offer 多步累加。
 *
 * 测试布局：触发海 = 东太平洋(52)（名字含"太平洋"，且邻接美国大本营 27 与夏威夷 50）。
 *   在夏威夷(50, 美国补给点) 放一支美国陆军 -> 使 52 的相邻海域 28/49 可建海军；
 *   美国大本营 27（留空）本身即可建陆军 -> 使 27 成为陆军候选。
 *
 * 覆盖：
 *   T1 触发后窗口出现且含 17506
 *   T2 首步必为 need:'choice'（先选择），choiceOptions 恰为 陆军/海军 两项，未选前不建设
 *   T3 陆军路径：choice='army' -> need:'space' 候选全为陆地 -> 选点后落【陆军】
 *   T4 海军路径：choice='navy' -> need:'space' 候选全为海域 -> 选点后落【海军】
 *   T5 选择结果正确传递：陆军路径落的是陆军、海军路径落的是海军；代价(损耗1)已付
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const D = require(path.join(__dirname, '..', 'data.js')).data

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}
function terrainOf(id) { return D.spaces[id] ? D.spaces[id].terrain : null }

/* 触发海：东太平洋(52) 是太平洋海域；邻接美国大本营 27（陆军候选）与夏威夷 50（海军候选的供给源） */
const TRIGGER = 52
const SUPPLY = 50   /* 夏威夷：美国补给点，邻接 52 的海域邻居 28/49 */

function baseGame() {
	const g = rules.setup('t-17506-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '美国'
	g.active = 'allies'
	g.turn_phase = 'play'
	g.turn = 1
	/* 干净棋盘，仅放一支美国陆军于补给点 50，使 52 的相邻海域 28/49 可建海军 */
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.location['us_a_50'] = SUPPLY
	g.piece_nation['us_a_50'] = '美国'
	g.piece_type['us_a_50'] = 'army'
	g.hands = { '美国': ['17506#1'] }
	/* 损耗代价从 game.decks[nation] 扣除（见 attrition_cards / can_attrite），setup 已为各国建好牌库 */
	g.armed_offers = []
	return g
}

function openWindow(g) {
	I.offer_armed_effects(g, 'after_build_navy', { space: TRIGGER, nation: '美国' })
	return (g.armed_offers || []).find(w => (w.cards || []).some(c => c.card_id === '17506#1'))
}
function countPieces(g, space, nation, type) {
	let n = 0
	for (const [pid, loc] of Object.entries(g.location || {})) {
		if (loc !== space) continue
		if (g.piece_nation[pid] !== nation) continue
		if (g.piece_type[pid] !== type) continue
		n++
	}
	return n
}
function pendingOf(g) {
	const w = (g.armed_offers || []).find(w => (w.cards || []).some(c => c.card_id === '17506#1'))
	return w && w.pending
}
function usPieceTotal(g) {
	let n = 0
	for (const [pid, loc] of Object.entries(g.location || {})) {
		if (loc == null) continue
		if (g.piece_nation[pid] === '美国') n++
	}
	return n
}

// ---- T1：触发后窗口出现 ----
;(function () {
	const g = baseGame()
	const win = openWindow(g)
	check('T1 窗口出现且含 17506#1', !!win, g.armed_offers)
})()

// ---- T2：首步必为 need:'choice'，且未选前不建设 ----
;(function () {
	const g = baseGame()
	openWindow(g)
	const before = usPieceTotal(g)
	const r = rules.action(g, 'Allies', 'use_armed_offer', { card: '17506#1' })
	const p = pendingOf(r)
	check('T2 首步 need === "choice"', p && p.need === 'choice', p)
	check('T2 choiceOptions 恰两项', p && p.choiceOptions && p.choiceOptions.length === 2, p && p.choiceOptions)
	const ids = (p && p.choiceOptions || []).map(o => o.id).sort()
	check('T2 选项为 army / navy', JSON.stringify(ids) === JSON.stringify(['army', 'navy']), ids)
	check('T2 未选择前未建设（美国棋子数不变）', usPieceTotal(r) === before, { before, after: usPieceTotal(r) })
})()

// ---- T3：陆军路径 ----
;(function () {
	const g = baseGame()
	openWindow(g)
	rules.action(g, 'Allies', 'use_armed_offer', { card: '17506#1' })            // -> choice
	const r2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17506#1', choice: 'army' })
	const p = pendingOf(r2)
	check('T3 陆军步 need === "space"', p && p.need === 'space', p)
	check('T3 陆军候选非空且全为陆地',
		p && p.candidates.length > 0 && p.candidates.every(c => terrainOf(c) !== 'sea'), p && p.candidates)
	const tgt = p.candidates[0]
	const before = countPieces(g, tgt, '美国', 'army')
	const deckBefore = (g.decks['美国'] || []).length
	const r3 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17506#1', choice: 'army', space: tgt })
	check('T3 选点后建设成功（落【陆军】）',
		countPieces(r3, tgt, '美国', 'army') === before + 1, { before, after: countPieces(r3, tgt, '美国', 'army') })
	check('T3 建设的兵种确为陆军（非海军）',
		countPieces(r3, tgt, '美国', 'navy') === 0)
	check('T3 损耗代价已付（牌库 -1）', (g.decks['美国'] || []).length === deckBefore - 1, { deckBefore, after: (g.decks['美国'] || []).length })
	check('T3 17506 进入弃牌堆', (r3.discard['美国'] || []).indexOf('17506#1') >= 0, r3.discard && r3.discard['美国'])
})()

// ---- T4：海军路径 ----
;(function () {
	const g = baseGame()
	openWindow(g)
	rules.action(g, 'Allies', 'use_armed_offer', { card: '17506#1' })            // -> choice
	const r2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17506#1', choice: 'navy' })
	const p = pendingOf(r2)
	check('T4 海军步 need === "space"', p && p.need === 'space', p)
	check('T4 海军候选非空且全为海域',
		p && p.candidates.length > 0 && p.candidates.every(c => terrainOf(c) === 'sea'), p && p.candidates)
	const tgt = p.candidates[0]
	const before = countPieces(g, tgt, '美国', 'navy')
	const r3 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17506#1', choice: 'navy', space: tgt })
	check('T4 选点后建设成功（落【海军】）',
		countPieces(r3, tgt, '美国', 'navy') === before + 1, { before, after: countPieces(r3, tgt, '美国', 'navy') })
	check('T4 建设的兵种确为海军（非陆军）',
		countPieces(r3, tgt, '美国', 'army') === 0)
})()

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
