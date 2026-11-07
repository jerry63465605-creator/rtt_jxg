/*
 * 建盘公共库 —— **所有真实盘面脚本必须走 new_board()**
 *
 * 为什么要有这个文件：手工建盘最容易漏掉「初始阶段：每国摸 10 弃 3」。
 * 裸 `R.setup()` 之后直接插入手牌，得到的是「10 张 + 插入卡」，与真实开局
 * （7 张）不一致 —— 测试结论会失真（手牌数、弃牌堆、可弃代价都不同）。
 *
 * 铁律：
 *   ① 建盘 = `new_board(seed)`，内部已完成 setup + 六国 opening_discard；
 *   ② 需要别的阶段再用 `go_phase(g, nation, phase)`（内部会 refresh）；
 *   ③ 禁止在业务脚本里直接 `R.setup()`（tools/_audit_board_setup.js 会扫出来）。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const ORDER = I.ORDER_OF_NATIONS || ['德国', '英国', '日本', '苏联', '意大利', '美国']
const ROLE = n => (I.faction_of_nation(n) === 'allies' ? 'Allies' : 'Axis')
const faceOf = x => String(x).split('#')[0]

/** 清掉与建盘无关的挂起（armed 窗口 / 响应栈 / 分步等） */
function clear_pending(g) {
	g.pending_battle = null
	g.pending_econ = null
	g.armed_offers = []
	g.response_queue = []
	g.response_stack = []
	g.pending_echo = null
	g.pending_status_react = null
	g.pending_script = null
	g.pending_event_step = null
	g.event_budget = null
	I.refresh(g)
	return g
}

/**
 * 初始阶段：六国依次「弃 3 留 7」（走真实动作 opening_discard）
 * @param {object} g
 * @param {object} opt { drop_of(nation, hand) -> [3 张实例 id] }
 */
function run_opening_discard(g, opt = {}) {
	let guard = 0
	while (g.opening && guard++ < 12) {
		const nation = ORDER[g.opening.index]
		const hand = (g.hands[nation] || []).slice()
		const drop = opt.drop_of ? opt.drop_of(nation, hand) : hand.slice(0, 3)
		R.action(g, ROLE(nation), 'opening_discard', { cards: drop })
		I.refresh(g)
	}
	if (g.opening) throw new Error('opening_discard 未完成（请检查 countries 顺序）')
	return g
}

/** 切到指定国 / 阶段（真实动作 debug_set_phase） */
function go_phase(g, nation, phase) {
	R.action(g, ROLE(nation), 'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}

/** 建盘：setup → 清挂起 → 六国弃 3 → （可选）切阶段 */
function new_board(seed = 20261108, opt = {}) {
	const g = R.setup(seed)
	clear_pending(g)
	run_opening_discard(g, opt)
	if (opt.nation && opt.phase) go_phase(g, opt.nation, opt.phase)
	return g
}

/** 给某国塞手牌（真实动作 debug_add_card） */
function give(g, face, nation, dest = 'hand') {
	R.action(g, ROLE(nation), 'debug_add_card', { face: String(face), nation, dest })
	I.refresh(g)
	return g
}

/** 放部队（真实动作 debug_place；注意：失败是静默的，务必复查 pieces_on） */
function place(g, piece, nation, type, spaceName) {
	R.action(g, ROLE(nation), 'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
	I.refresh(g)
	return g
}

/** 打印六国手牌/牌堆，便于人工确认初设）
 */
function report(g, tag = '') {
	const rows = ORDER.map(n => n + ' ' + (g.hands[n] || []).length + '/' + (g.decks[n] || []).length)
	console.log((tag || '手牌/牌堆') + '：' + rows.join('　'))
	return g
}

module.exports = { R, I, d, ORDER, ROLE, faceOf, clear_pending, run_opening_discard, go_phase, new_board, give, place, report, ROOT, MOD }
