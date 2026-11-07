/*
 * 排查「法国陆军被移除，但英国没收到 15311 询问框」：
 * 逐条真实移除路径，看哪条没派发 armed 窗口。
 *
 *   A 基础卡《发起陆战》(15201)          —— 已证：会派
 *   B 14500《黄色方案》战斗预算 + event_battle
 *   C 15225《阿登闪击战》（事件卡直接移除）
 *   D 补给阶段移除（断补）              —— 预期不派（非战斗移除）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const WE = d.id_of('西欧')

const base = () => {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_echo = null; g.pending_status_react = null; g.pending_script = null
	g.pending_event_step = null; g.event_budget = null
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	for (const f of ['15311', '15304', '15305', '15306', '15307'])
		R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
	I.refresh(g)
	return g
}
const report = (tag, g, n0) => {
	const off = (g.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '15311'))
	const v = R.view(g, 'Allies')
	console.log('  ' + tag + ' → 西欧=' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])) +
		'  armed=' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, nation: w.nation, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))) +
		'  view.armed=' + JSON.stringify(v.armed_offer ? (v.armed_offer.cards || []).map(c => c.name) : null))
	console.log('    log = ' + logSince(g, n0).slice(0, 200))
	console.log('    ' + (off ? '✓ 15311 询问框已开' : '✗ 15311 没有询问框'))
}

/* A 基础卡陆战 */
console.log('=== A. 15201《发起陆战》打<西欧>法国陆军 ===')
{
	const g = base()
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'deA', nation: '德国', type: 'army', space: d.id_of('德国') })
	I.refresh(g); I.grant_supply(g, 'deA', g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' }); I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15201'), space: WE, piece: fr })
	I.refresh(g)
	report('A', g, n0)
}

/* B 黄色方案（战斗预算） */
console.log('\n=== B. 14500《黄色方案》→ event_battle 打<西欧> ===')
{
	const g = base()
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'deB', nation: '德国', type: 'army', space: d.id_of('德国') })
	I.refresh(g); I.grant_supply(g, 'deB', g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '14500', nation: '德国', dest: 'hand' }); I.refresh(g)
	let n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '14500') })
	I.refresh(g)
	console.log('  打出后 budget=' + JSON.stringify(g.event_budget && { rem: g.event_budget.remaining }) + '  log=' + logSince(g, n0).slice(0, 120))
	n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_battle', { target: WE })
	I.refresh(g)
	report('B', g, n0)
}

/* C 阿登闪击战（事件卡直接移除） */
console.log('\n=== C. 15225《阿登闪击战》 ===')
{
	const g = base()
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15225', nation: '德国', dest: 'hand' }); I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15225') })
	I.refresh(g)
	console.log('  打出后 pending_event_step=' + JSON.stringify(g.pending_event_step && { op: g.pending_event_step.op, need: g.pending_event_step.need }) +
		'  pending_battle=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
	report('C1', g, n0)
	/* 若卡在选目标，补一次提交 */
	if (g.pending_event_step) {
		const n1 = (g.log || []).length
		R.action(g, 'Axis', 'event_step_next', {})
		I.refresh(g)
		report('C2', g, n1)
	}
}

/* D 补给阶段断补移除（预期不派） */
console.log('\n=== D. 补给阶段（断补移除，预期不派询问）===')
{
	const g = base()
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	console.log('  法国陆军 = ' + fr + '（不给补给）')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'supply' })
	I.refresh(g)
	report('D', g, n0)
}
