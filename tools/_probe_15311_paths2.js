/* 续查：① 阿登闪击战走完 ② 同一时刻移除两支部队（敦刻尔克 + 马奇诺）③ 英国手里没这张卡时 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const WE = d.id_of('西欧')

function base(ukCards) {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_echo = null; g.pending_status_react = null; g.pending_script = null
	g.pending_event_step = null; g.event_budget = null
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	for (const f of ukCards) R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
	I.refresh(g)
	return g
}
const faces = g => (g.armed_offers || []).map(w => ({ when: w.when, nation: w.nation, f: (w.cards || []).map(c => faceOf(c.card_id)) }))

/* ① 阿登闪击战：建立预算 → event_battle 打西欧 */
console.log('=== ① 15225 阿登闪击战 → event_battle ===')
{
	const g = base(['15311', '15304', '15305', '15306', '15307'])
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'de1', nation: '德国', type: 'army', space: d.id_of('德国') })
	I.refresh(g); I.grant_supply(g, 'de1', g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15225', nation: '德国', dest: 'hand' }); I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15225') })
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_battle', { target: WE })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 160))
	console.log('  西欧=' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])) + '  armed=' + JSON.stringify(faces(g)))
	console.log('  ' + (faces(g).some(w => w.f.indexOf('15311') >= 0) ? '✓ 有 15311 询问' : '✗ 没有'))
}

/* ② 同一时刻移除两支：西欧法国陆军 + 英国陆军（敦刻尔克同窗口） */
console.log('\n=== ② 同时移除 法国陆军(西欧) 与 英国陆军(不列颠) ===')
{
	const g = base(['15311', '15351', '15304', '15305', '15306', '15307'])
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_b', nation: '英国', type: 'army', space: d.id_of('不列颠') })
	I.refresh(g); I.grant_supply(g, 'uk_b', g.turn); I.refresh(g)
	for (const p of [fr, 'uk_b']) {
		const n0 = (g.log || []).length
		I.remove_piece ? I.remove_piece(g, p, '测试') : null
		R.action(g, 'Axis', 'debug_remove', { piece: p })
		I.refresh(g)
		console.log('  移除 ' + p + ' → armed=' + JSON.stringify(faces(g)))
	}
	console.log('  ' + (faces(g).some(w => w.f.indexOf('15311') >= 0) ? '✓ 15311 仍在窗口' : '✗ 15311 丢了'))
	console.log('  （debug_remove 本就不派发，仅作结构对照）')
}

/* ③ 英国手里没有 15311（只有别的卡）→ 不应有框（对照） */
console.log('\n=== ③ 英国手里没有 15311（对照：应当没框）===')
{
	const g = base(['15304', '15305', '15306', '15307'])
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'de3', nation: '德国', type: 'army', space: d.id_of('德国') })
	I.refresh(g); I.grant_supply(g, 'de3', g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' }); I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15201'), space: WE, piece: fr })
	I.refresh(g)
	console.log('  armed=' + JSON.stringify(faces(g)) + '（期望空）')
}
