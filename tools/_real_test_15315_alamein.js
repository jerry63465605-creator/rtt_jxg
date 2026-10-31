/*
 * 真实测试（rtt-realboard-test §7 范式 B）：15315《阿拉曼战役》
 *
 * 卡面：在<非洲北部>消灭1支敌方国家陆军。在<中东><非洲北部>之一征召陆军
 *
 * 用户反馈：征召步【没有客户端选择】，默认落在 中东。
 *
 * 断言：
 *   A. needs 层（客户端据此高亮/弹选择）：消灭步执行【前】就要能算出两个候选
 *      （<非洲北部>此刻还有敌方陆军，必须按"将被消灭"的影子盘面计算）
 *   B. 不带 spaces 的 play_card 不能替玩家自动征召
 *   C. 选 中东 -> 英国陆军落在中东（对照 A 支）
 *   D. 选 非洲北部 -> 英国陆军落在非洲北部（对照 B 支）
 *   E. 纪律：15315 进弃牌堆、德国陆军被消灭、无残留挂起
 *
 * 用法：node tools/_real_test_15315_alamein.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const at = (g, name) => {
	const sid = d.id_of(name)
	return Object.keys(g.location).filter(p => g.location[p] === sid)
}
/*
 * 真实客户端流程：选完地区后 play_card 会【分步停机】（oneStep），
 * 玩家再点「下一步」(event_step_next) 才执行后续步 —— 这里如实模拟。
 */
function playAndResume(g, card, spaces) {
	const out = []
	R.action(g, 'Allies', 'play_card', Object.assign({ card }, spaces ? { spaces } : {}))
	out.push(logSince(g, 0))
	let guard = 0
	while (g.pending_event_step && guard++ < 5) {
		const n = (g.log || []).length
		R.action(g, 'Allies', 'event_step_next', {})
		out.push(logSince(g, n))
	}
	return out.join('\n    ')
}

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

const NA = d.id_of('非洲北部'), ME = d.id_of('中东')
ok('地区 id 就绪（非洲北部=' + NA + ' / 中东=' + ME + '）', NA != null && ME != null)

/* 合法盘面：英国出牌阶段；非洲北部有 1 支德国陆军（消灭目标）；15315 给英国 */
function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_na', nation: '德国', type: 'army', space: NA })
	R.action(g, 'Allies', 'debug_add_card', { face: '15315', nation: '英国', dest: 'hand' })
	I.refresh(g)
	return g
}

console.log('\n=== A. needs 层：消灭步执行前就该给出两个候选 ===')
const g0 = setup()
const card0 = (g0.hands['英国'] || []).find(x => faceOf(x) === '15315')
ok('15315 在手、德国陆军在非洲北部',
	!!card0 && at(g0, '非洲北部').length === 1,
	JSON.stringify(at(g0, '非洲北部')))
const nd = I.event_card_needs(g0, '英国', card0, {})
console.log('  event_card_needs = ' + JSON.stringify(nd && {
	need: nd.need, step: nd.step, candidates: nd.candidates,
}))
ok('★ 返回 need:space（必须让玩家选）', !!(nd && nd.need === 'space'), JSON.stringify(nd && nd.need))
ok('★ 候选包含 中东', !!(nd && (nd.candidates || []).indexOf(ME) >= 0),
	JSON.stringify(nd && nd.candidates))
ok('★ 候选包含 非洲北部（消灭后即可征召）',
	!!(nd && (nd.candidates || []).indexOf(NA) >= 0), JSON.stringify(nd && nd.candidates))

console.log('\n=== B. 不带 spaces 的 play_card 不能替玩家自动征召 ===')
let n0 = (g0.log || []).length
R.action(g0, 'Allies', 'play_card', { card: card0 })
console.log('  log: ' + logSince(g0, n0))
console.log('  中东=' + JSON.stringify(at(g0, '中东')) + '  非洲北部=' + JSON.stringify(at(g0, '非洲北部')))
ok('★ 没有自动在中东征召（等玩家选）', at(g0, '中东').length === 0,
	JSON.stringify(at(g0, '中东')))
ok('15315 仍在手牌或处于待选（未结算）',
	(g0.hands['英国'] || []).indexOf(card0) >= 0 || !!g0.pending_event_step,
	JSON.stringify({ inHand: (g0.hands['英国'] || []).indexOf(card0) >= 0, pe: !!g0.pending_event_step }))

console.log('\n=== C. 选 中东 ===')
{
	const g = setup()
	const card = (g.hands['英国'] || []).find(x => faceOf(x) === '15315')
	console.log('  log: ' + playAndResume(g, card, [null, ME]))
	ok('★ 英国陆军落在中东', at(g, '中东').some(p => g.piece_nation[p] === '英国' && g.piece_type[p] === 'army'),
		JSON.stringify(at(g, '中东')))
	ok('非洲北部没有新征召（只消灭）', at(g, '非洲北部').length === 0, JSON.stringify(at(g, '非洲北部')))
	ok('德国陆军被消灭', !('de_na' in g.location))
	ok('15315 进弃牌堆', (g.discard['英国'] || []).indexOf(card) >= 0)
	ok('无残留（pending_event_step/pending_armed_use）', !g.pending_event_step && !g.pending_armed_use,
		JSON.stringify({ pe: !!g.pending_event_step, pu: !!g.pending_armed_use }))
}

console.log('\n=== D. 选 非洲北部 ===')
{
	const g = setup()
	const card = (g.hands['英国'] || []).find(x => faceOf(x) === '15315')
	console.log('  log: ' + playAndResume(g, card, [null, NA]))
	ok('★ 英国陆军落在非洲北部',
		at(g, '非洲北部').some(p => g.piece_nation[p] === '英国' && g.piece_type[p] === 'army'),
		JSON.stringify(at(g, '非洲北部')))
	ok('中东没有部队', at(g, '中东').length === 0, JSON.stringify(at(g, '中东')))
	ok('15315 进弃牌堆', (g.discard['英国'] || []).indexOf(card) >= 0)
}

console.log('\n=== E. 北非 = 德国陆军 + 德国空军（连带消灭，仍要有选择框）===')
{
	/* 这是玩家 game 8 的真实形态：消灭陆军时同格同国空军一并消灭 -> 北非仍可征召 */
	function setupAir() {
		const g = setup()
		R.action(g, 'Axis', 'debug_place', { piece: 'de_air_na', nation: '德国', type: 'air', space: NA })
		I.refresh(g)
		return g
	}
	const g0 = setupAir()
	const card0 = (g0.hands['英国'] || []).find(x => faceOf(x) === '15315')
	ok('盘面就位：北非有德国陆军 + 德国空军',
		at(g0, '非洲北部').length === 2 && at(g0, '非洲北部').some(p => g0.piece_type[p] === 'air'),
		JSON.stringify(at(g0, '非洲北部')))
	const nd = I.event_card_needs(g0, '英国', card0, {})
	ok('★ need=space（不能因为残留敌机就不问）', !!(nd && nd.need === 'space'), JSON.stringify(nd && nd.need))
	ok('★ 候选含 非洲北部（敌机随陆军一起消失）',
		!!(nd && (nd.candidates || []).indexOf(NA) >= 0), JSON.stringify(nd && nd.candidates))

	const g = setupAir()
	const card = (g.hands['英国'] || []).find(x => faceOf(x) === '15315')
	console.log('  log: ' + playAndResume(g, card, [null, NA]))
	ok('★ 德国陆军与德国空军都被消灭（连带）',
		g.location['de_na'] == null && g.location['de_air_na'] == null,
		JSON.stringify({ army: g.location['de_na'], air: g.location['de_air_na'] }))
	ok('★★ 英国陆军落在非洲北部',
		at(g, '非洲北部').some(p => g.piece_nation[p] === '英国' && g.piece_type[p] === 'army'),
		JSON.stringify(at(g, '非洲北部')))
	ok('无残留挂起', !g.pending_event_step && !g.pending_armed_use)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
