/*
 * 验证：《空军力量》在空军阶段的 hand_ready 预检（2026-10-07）
 *
 * 背景（用户反馈"德国的空军力量打不出"）：
 *   hand_ready 用 check_phase_for_card(game, n, face, {}) 预检，
 *   而该函数在空军阶段只在 mode 是 deploy/seize 时放行 ——
 *   预检时玩家还没选 mode，于是恒定 ok:false，
 *   客户端据此置灰 + 点击门槛直接拒绝，模式框永远弹不出来。
 *
 * 期望：预检按 deploy/seize 取【或】，并下发可行 modes。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of

let pass = 0, fail = 0
function ok(cond, label, extra) {
	if (cond) { pass++; console.log('  OK  ' + label) }
	else { fail++; console.log('  FAIL  ' + label + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')) }
}

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null; g.phase_note = ''; g.markers = {}
	g.event_budget = null; g.pending_autobahn = null
	g.table_responses = []; g.response_queue = []; g.pending_response_choice = null
	g.modifiers = []; g.status_instant = []
	g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'airforce'
	return g
}
function place(g, nation, type, spaceName, id) {
	const pid = id || ('T' + (++g.piece_seq))
	g.location[pid] = SP(spaceName); g.piece_nation[pid] = nation; g.piece_type[pid] = type
	return pid
}

const AIR_CARD = '15204#1'   /* 德国《空军力量》实例 */

console.log('=== 《空军力量》hand_ready 预检验证 ===')

/* ---------- ① 老口径复现：无 mode 预检必定拒绝（根因） ---------- */
;(() => {
	console.log('[① 根因复现]')
	const g = fresh()
	place(g, '德国', 'army', '德国')
	g.hands['德国'] = [AIR_CARD]
	const face = I.inst_card ? I.inst_card(AIR_CARD) : null
	if (face && I.check_phase_for_card) {
		const r0 = I.check_phase_for_card(g, '德国', face, {})
		ok(!r0.ok, '无 mode 时 check_phase_for_card 仍拒绝（保持执行判定严格）', r0.reason)
	} else {
		console.log('  SKIP  _internal 未导出 check_phase_for_card（不影响主结论）')
	}
})()

/* ---------- ② 有陆军可承载：hand_ready 放行，modes 含 deploy ---------- */
;(() => {
	console.log('[② 有可部署载体]')
	const g = fresh()
	place(g, '德国', 'army', '德国')
	g.hands['德国'] = [AIR_CARD]
	const v = R.view(g, 'Axis')
	const hr = v.hand_ready && v.hand_ready[AIR_CARD]
	ok(!!hr && hr.ok === true, 'hand_ready.ok = true', hr)
	ok(!!hr && Array.isArray(hr.modes) && hr.modes.indexOf('deploy') >= 0,
		'modes 含 deploy', hr && hr.modes)
	/* 本国无空军 -> seize 无合法目标，不应出现在 modes 里 */
	ok(!!hr && hr.modes.indexOf('seize') < 0, '本国无空军时 modes 不含 seize', hr && hr.modes)
})()

/* ---------- ③ 有本国空军 + 相邻敌机：seize 也进 modes ---------- */
;(() => {
	console.log('[③ 有空军且有敌机]')
	const g = fresh()
	place(g, '德国', 'army', '德国')
	place(g, '德国', 'air', '德国')          /* 本国空军（载体在德国本土） */
	place(g, '英国', 'army', '西欧')          /* 英国陆军（西欧与德国相邻） */
	place(g, '英国', 'air', '西欧')           /* 敌方空军 */
	g.hands['德国'] = [AIR_CARD]
	const v = R.view(g, 'Axis')
	const hr = v.hand_ready && v.hand_ready[AIR_CARD]
	ok(!!hr && hr.ok === true, 'hand_ready.ok = true', hr)
	ok(!!hr && hr.modes.indexOf('seize') >= 0, 'modes 含 seize（可夺取制空权）', hr && hr.modes)
})()

/* ---------- ④ 完全没有载体：拒绝且给出原因，不静默 ---------- */
;(() => {
	console.log('[④ 无载体]')
	const g = fresh()
	g.hands['德国'] = [AIR_CARD]   /* 版图上没有任何德国部队 */
	const v = R.view(g, 'Axis')
	const hr = v.hand_ready && v.hand_ready[AIR_CARD]
	ok(!!hr && hr.ok === false, 'hand_ready.ok = false', hr)
	ok(!!hr && Array.isArray(hr.modes) && hr.modes.length === 0, 'modes 为空', hr && hr.modes)
	ok(!!hr && !!hr.reason, '给出拒绝原因（不是静默）', hr && hr.reason)
})()

/* ---------- ⑤ 非空军阶段：仍然拒绝（不放宽阶段口径） ---------- */
;(() => {
	console.log('[⑤ 出牌阶段不放宽]')
	const g = fresh()
	g.turn_phase = 'play'
	place(g, '德国', 'army', '德国')
	g.hands['德国'] = [AIR_CARD]
	const v = R.view(g, 'Axis')
	const hr = v.hand_ready && v.hand_ready[AIR_CARD]
	ok(!!hr && hr.ok === false, '出牌阶段仍拒绝《空军力量》', hr)
})()

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
