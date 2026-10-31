/*
 * 回归（真实盘面）：game 8 出牌前那一刻（snap 31）的盘面
 *   <非洲北部> = 德国陆军 dbg_1 + 德国空军 dbg_2，<中东> 空
 * 期望：15315 的征召步给出【两个候选】（消灭陆军会连带消灭同格同国空军 -> 北非可征召）
 *       并真的能征召到<非洲北部>。
 *
 * fixture 由 tools/_make_fixture_game8_snap31.js 导出（免 --experimental-sqlite）。
 * 用法：node tools/_real_test_15315_game8.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

const fixture = path.join(__dirname, 'fixtures', 'game8_snap31_15315.json')
if (!fs.existsSync(fixture)) {
	console.log('⚠ 缺 fixture：先跑 node --experimental-sqlite tools/_make_fixture_game8_snap31.js')
	process.exit(2)
}

const AF = d.id_of('非洲北部'), ME = d.id_of('中东')
const at = (g, sid) => Object.keys(g.location || {}).filter(p => g.location[p] === sid)
	.map(p => p + ':' + g.piece_nation[p] + '/' + g.piece_type[p])

console.log('\n=== 0. 还原 game 8 出牌前盘面（snap 31）===')
/*
 * 快照里的 log 存的是【长度数字】而不是数组，且 phase 停在 resource；
 * 这里做最小归一，让它能被真实 action 驱动（其余状态一律不动）。
 */
function loadBoard() {
	const st = JSON.parse(fs.readFileSync(fixture, 'utf8'))
	if (typeof st.log === 'number') st.log = []
	I.refresh(st)
	R.action(st, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(st)
	return st
}
const g = loadBoard()
console.log('  北非 = ' + JSON.stringify(at(g, AF)))
console.log('  中东 = ' + JSON.stringify(at(g, ME)))
ok('盘面就如用户那一局：北非「陆军 + 空军」、中东空',
	at(g, AF).length === 2 && at(g, AF).some(x => /army$/.test(x)) && at(g, AF).some(x => /air$/.test(x)) &&
	at(g, ME).length === 0, JSON.stringify(at(g, AF)))

const card = ((g.hands || {})['英国'] || []).find(x => faceOf(x) === '15315')
ok('英国手里有 15315', !!card, JSON.stringify(((g.hands || {})['英国']) || []))

console.log('\n=== 1. 征召候选必须有两个（本次修复点）===')
const q = R.query(g, 'Allies', 'event_targets', { card })
console.log('  event_targets -> ' + JSON.stringify(q && {
	need: q.need, step: q.step, cands: (q.candidates || []).map(c => c.name || c),
}))
ok('★ need=space（会弹选择框）', !!(q && q.need === 'space'), JSON.stringify(q && q.need))
ok('★ 候选含<中东>', !!(q && (q.candidates || []).some(c => (c.id != null ? c.id : c) === ME)),
	JSON.stringify(q && q.candidates))
ok('★ 候选含<非洲北部>（消灭陆军连带空军 -> 该格可征召）',
	!!(q && (q.candidates || []).some(c => (c.id != null ? c.id : c) === AF)),
	JSON.stringify(q && q.candidates))

console.log('\n=== 2. 真打：选<非洲北部> ===')
{
	const g2 = loadBoard()
	const c2 = ((g2.hands || {})['英国'] || []).find(x => faceOf(x) === '15315')
	const n0 = (g2.log || []).length
	R.action(g2, 'Allies', 'play_card', { card: c2, space: AF, spaces: [null, AF] })
	let guard = 0
	while (g2.pending_event_step && guard++ < 4) {
		const n1 = (g2.log || []).length
		R.action(g2, 'Allies', 'event_step_next', {})
		console.log('  step: ' + logSince(g2, n1))
	}
	console.log('  首步日志: ' + logSince(g2, n0))
	console.log('  结果：北非 = ' + JSON.stringify(at(g2, AF)) + '  中东 = ' + JSON.stringify(at(g2, ME)))
	ok('★ 德国陆军与德国空军都被消灭（连带）',
		g2.location['dbg_1'] == null && g2.location['dbg_2'] == null,
		JSON.stringify({ army: g2.location['dbg_1'], air: g2.location['dbg_2'] }))
	ok('★★ 英国陆军落在<非洲北部>', at(g2, AF).some(x => /英国\/army$/.test(x)),
		JSON.stringify(at(g2, AF)))
	ok('中东没有部队', at(g2, ME).length === 0, JSON.stringify(at(g2, ME)))
	ok('无残留挂起', !g2.pending_event_step && !g2.pending_armed_use)
}

console.log('\n=== 3. 对照：选<中东>时德军也照样被全灭 ===')
{
	const g3 = loadBoard()
	const c3 = ((g3.hands || {})['英国'] || []).find(x => faceOf(x) === '15315')
	R.action(g3, 'Allies', 'play_card', { card: c3, space: ME, spaces: [null, ME] })
	let guard = 0
	while (g3.pending_event_step && guard++ < 4) R.action(g3, 'Allies', 'event_step_next', {})
	console.log('  结果：北非 = ' + JSON.stringify(at(g3, AF)) + '  中东 = ' + JSON.stringify(at(g3, ME)))
	ok('★ <非洲北部>被清空（陆军+空军都被消灭）', at(g3, AF).length === 0, JSON.stringify(at(g3, AF)))
	ok('英国陆军落在<中东>', at(g3, ME).some(x => /英国\/army$/.test(x)), JSON.stringify(at(g3, ME)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
