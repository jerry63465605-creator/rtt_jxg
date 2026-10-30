/*
 * RTT 卡牌 bug 复现脚手架（通用，2026-10-13 沉淀）
 * ------------------------------------------------------------------
 * 为什么需要它（踩过的坑）：
 *   复现 RTT 卡牌 bug 时，直接"手写游戏状态"几乎必然失败——
 *   引擎的挂起/响应/续跑逻辑是隐式的，手填的 mock 结构缺字段、
 *   漏初始化，导致真实行为根本不触发。正确做法是"用真实引擎
 *   路径驱动，只用工具摆好初始局面（棋子/暗置响应卡/手牌）"。
 *
 * 忠实复现六步（详见 skill rtt-card-bug-repro）：
 *   1. 选"真正能暴露 bug 的交叉状态"：顺序依赖 bug 必须让两种
 *      挂起重叠（他国响应 + 本国续跑窗口）。单国流程/提前结清
 *      响应的流程暴露不出（曾用 _dbg_15210_15208.js 测"先打
 *      15210"就漏掉了，因为没放英国响应卡）。
 *   2. 用真实卡 id（从 cards.js / 配置表查 armed.when /
 *      response trigger），绝不凭记忆猜卡号。
 *      例：海军被移除响应是 15334（驱逐舰），不是 15335
 *      （效忠吾王=build 触发）—— 选错卡号则不触发。
 *   3. 用真实引擎入口 rules.action(ROLE, action, params) 驱动，
 *      绝不手写 g.xxx 状态替代引擎流程。
 *   4. 他国挂起用真实响应卡暗置 g.table_responses（owner_side
 *      必须小写阵营 'axis'/'allies'，与真实卡配置一致）自然触发
 *      request_responses 入队 —— 不要手填 g.response_queue。
 *   5. 初始化跳过回合强制：I.set_skip_turn_guard(true)，手动设
 *      current_nation/active/turn_phase='play'。
 *   6. 棋子布置手写三字段 + I.grant_supply + I.refresh（别用
 *      g.piece_type 反查初始局面）。
 *
 * 大小写纪律（最高频的"模拟失败"原因）：
 *   - 传给 rules.action 的第一个参数是 ROLE 名大写：'Axis'/'Allies'
 *   - table_responses 里手填的 owner_side 是【小写】阵营：'axis'/'allies'
 *   - 阵营常量 AXIS/ALLIES 也是小写；side 与小写阵营比，不与 ROLE 比
 *   混用会误报"只有持有方能决定响应"。
 *
 * 用法 A（快速复现新 bug）：复制本文件底部 self-test 改造。
 * 用法 B（当库引用）：const R = require('./rtt_repro.js')
 */
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { data, SPACE } = require(path.join(DIR, 'data.js'))
const I = rules._internal

const ROLE = { AXIS: 'Axis', ALLIES: 'Allies' }
const NATIONS = ['德国', '英国', '美国', '苏联', '日本', '意大利', '法国', '中国']

// 创建可控测试局面（跳过回合顺序强制）
function setupRepro(opts = {}) {
	I.set_skip_turn_guard(true)
	const g = rules.setup(1, 'Standard', {})
	g.current_nation = opts.nation || '德国'
	g.active = opts.active || 'Axis'
	g.turn_phase = opts.phase || 'play'
	g.location = g.location || {}
	g.piece_nation = g.piece_nation || {}
	g.piece_type = g.piece_type || {}
	g.play_done = g.play_done || {}
	g.discard = g.discard || {}
	for (const n of NATIONS) if (!g.discard[n]) g.discard[n] = []
	g.table_responses = g.table_responses || []
	return g
}

// 放棋子：手写三字段 + 补给 + 刷新（别用 g.piece_type 反查初始局面）
function placePiece(g, id, nation, type, space, supplied = true) {
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	if (supplied) I.grant_supply(g, id, g.turn || 1)
	I.refresh(g)
	return g
}

// 暗置真实响应卡（owner_side 必须小写阵营，与真实卡配置一致）
function setTableResponse(g, cardId, side) {
	g.table_responses.push({ card_id: String(cardId), owner_side: side })
}

// 按条件过滤地图空间，返回 sid 数字数组
function findSpaces(pred) {
	return Object.keys(data.spaces)
		.filter(sid => pred(data.spaces[sid], Number(sid)))
		.map(Number)
}

function armedCards(g) {
	return (g.armed_offers || []).flatMap(w => (w.cards || []).map(c => c.card_id))
}

// 诊断打印：动作前后对比挂起状态（排查"窗口凭空消失"的核心手段）
function diag(g, label) {
	const nat = g.national_skill_offer ? g.national_skill_offer.nation : '-'
	console.log(`[diag ${label}] cur=${g.current_nation} active=${g.active} ` +
		`respQ=${(g.response_queue || []).length} natSkill=${nat} ` +
		`armed=[${armedCards(g)}] pending=${g.pending_event_armed ? 'Y' : '-'} ` +
		`logLen=${g.log.length}`)
}

function play(g, role, card, params = {}) {
	return rules.action(g, role, 'play_card', Object.assign({ card }, params))
}
function useArmed(g, role, card, window = 0) {
	return rules.action(g, role, 'use_armed_offer', { window, card })
}
// 解决队首响应（若队列非空），返回是否真消费了队列
function resolveResponse(g, role) {
	if ((g.response_queue || []).length === 0) return false
	const before = (g.response_queue || []).length
	rules.action(g, role, 'pass_response', {})
	return (g.response_queue || []).length < before
}

module.exports = {
	rules, I, data, SPACE, ROLE,
	setupRepro, placePiece, setTableResponse, findSpaces,
	armedCards, diag, play, useArmed, resolveResponse,
}

/* ============================ self-test ============================
 * 用 15237（土耳其加入轴心国，德国★卡）顺序依赖 bug 验证脚手架：
 * 先打 15208、后打 15210（战斗触发英国响应 15334 入队，与 15237
 * 续跑重叠）。修复后用 side 比对清理，英国响应解决后国家技能窗口
 * 仍存活。本自测随修复后的 rules.js 应当全过。
 * 运行：node tools/rtt_repro.js
 */
if (require.main === module) {
	let pass = 0, fail = 0
	const ok = (c, m) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)) }

	const g = setupRepro({ nation: '德国', active: 'Axis', phase: 'play' })
	const BOSPH = SPACE['黑海'], AZ = SPACE['亚速尔']

	// 黑海邻接陆地放补给德军（满足 15237 step0 建海军前提）
	let placed = false
	for (const sid of Object.keys(data.spaces)) {
		const sp = data.spaces[sid]
		if (sp.terrain !== 'land') continue
		if (!(sp.connections || []).includes(BOSPH)) continue
		placePiece(g, 'g_army', '德国', 'army', Number(sid))
		if (I.can_build_at(g, '德国', BOSPH, 'navy').ok) { placed = true; break }
		delete g.location['g_army']; delete g.piece_nation['g_army']; delete g.piece_type['g_army']
	}
	ok(placed, '布置黑海邻接补给德军')

	// 亚速尔相邻海域放英海军(目标)，其相邻陆地放德军(发起者) -> 15210 可开战
	const S = (data.spaces[AZ].connections || []).map(Number)
		.filter(s => data.spaces[s] && data.spaces[s].terrain === 'sea')[0]
	let landAdj = null
	for (const n of (data.spaces[S].connections || []).map(Number))
		if (data.spaces[n] && data.spaces[n].terrain === 'land') { landAdj = n; break }
	ok(S != null && landAdj != null, '找到亚速尔相邻海域与陆地')
	placePiece(g, 'de_army2', '德国', 'army', landAdj)
	placePiece(g, 'al_navy', '英国', 'navy', S) // 补给态 -> 满足 15334 的 was_supplied
	setTableResponse(g, '15334', 'allies')    // 真实英国响应卡，小写 owner_side
	g.hands['德国'] = ['15237', '15208', '15210', '15338']

	diag(g, 'init')
	play(g, ROLE.AXIS, '15237')
	ok((g.armed_offers || []).length === 1, '出现 1 个增强窗口')
	ok(armedCards(g).includes('15208') && armedCards(g).includes('15210'), '窗口含 15208 + 15210')
	ok(!!g.pending_event_armed, 'pending_event_armed 挂起（15237 step0）')

	// 场景 B：先 15208 后 15210（与用户报的坏顺序一致）
	useArmed(g, ROLE.AXIS, '15208')
	useArmed(g, ROLE.AXIS, '15210')
	diag(g, 'after-both')
	ok((g.armed_offers || []).length === 0, '增强窗口已清空')
	ok(!g.pending_event_armed, 'pending_event_armed 已续跑清空')
	ok(!!g.national_skill_offer, '15237 分步完成 → 国家技能窗口出现')

	// 15210 战斗触发英国响应入队，必须先解决
	if ((g.response_queue || []).length) {
		ok((g.response_queue || []).length >= 1, '英国响应已入队（与续跑重叠）')
		resolveResponse(g, ROLE.ALLIES)
	}
	ok(!!g.national_skill_offer, '【核心修复】英国响应解决后德国国家技能窗口【仍存活】')
	const rN = rules.action(g, ROLE.AXIS, 'use_national_skill', { drop: [] })
	ok(rN !== undefined, '德国可发动国家技能（返回 state）')
	ok(!g.national_skill_offer, '国家技能发动后窗口清空')

	console.log(`\n=== rtt_repro self-test: ${pass} 通过 / ${fail} 失败 ===`)
	process.exit(fail ? 1 : 0)
}
