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
	return g
}
function place(g, nation, type, spaceName, id) {
	const pid = id || ('T' + (++g.piece_seq))
	g.location[pid] = SP(spaceName); g.piece_nation[pid] = nation; g.piece_type[pid] = type
	return pid
}
function armyAt(g, nation, spaceName) {
	const sp = SP(spaceName)
	return Object.keys(g.location).filter(p =>
		g.piece_nation[p] === nation && g.piece_type[p] === 'army' && g.location[p] === sp).length
}

console.log('=== 苏联增强卡 EFFECT 验证（第一批） ===')

/* ---------- 17807 里海舰队：计分阶段 -> 里海相邻（中亚/中东）征召 1 陆军 ---------- */
;(() => {
	console.log('[17807 里海舰队]')
	const g = fresh()
	g.current_nation = '苏联'; g.active = 'Allies'; g.turn_phase = 'scoring'
	g.hands['苏联'] = ['17807#1']

	/* 配置存在且 steps 候选 = 中亚/中东 */
	const cfg = I.ECHO_EFFECTS['17807']
	ok(!!cfg, 'ECHO_EFFECTS 有 17807 配置')
	const spaces = (cfg.steps && cfg.steps[0] && cfg.steps[0].spaces) || []
	const names = spaces.map(d.name_of)
	ok(names.length === 2 && names.indexOf('中亚') >= 0 && names.indexOf('中东') >= 0,
		'候选地区=中亚、中东', names)

	/* 触发时机登记 */
	const ct = I.CARD_TRIGGERS ? I.CARD_TRIGGERS['17807'] : null
	ok(ct && ct.kind === 'self' && ct.phase === 'scoring' && ct.nation === '苏联',
		'CARD_TRIGGERS = self/scoring/苏联', ct)

	/* 打出并在"中亚"征召 */
	const before = armyAt(g, '苏联', '中亚')
	I.set_skip_turn_guard && I.set_skip_turn_guard(true)
	R.action(g, 'Allies', 'play_card', { card: '17807#1' })
	/*
	 * ECHO pending 时【不落状态】，只回 need 给客户端；
	 * 客户端把选择放进 play_card 的 arg 重发（resolve_event_card 的第 4 参）。
	 */
	R.action(g, 'Allies', 'play_card', { card: '17807#1', space: SP('中亚') })
	I.set_skip_turn_guard && I.set_skip_turn_guard(false)
	ok(armyAt(g, '苏联', '中亚') === before + 1, '中亚征召苏联陆军 +1', armyAt(g, '苏联', '中亚'))
	ok((g.hands['苏联'] || []).indexOf('17807#1') < 0, '17807 离手')
})()

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
