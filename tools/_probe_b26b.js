/*
 * B26 补充探针：
 *   (i)  17513 打出后【不结算】→ 卡是否卡在"三处都没有"的 limbo？有没有动作能清掉 us_wartime？
 *   (ii) 17505 的"要求地区"半径 = 大本营+相邻(1)，而 17517 的要求是 radius 2
 *        → 放在 2 环内的美国空军算不算？口径是否一致
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const cards = require(path.join(MOD, 'cards.js'))
const byId = {}
for (const c of cards.CARDS) byId[String(c.id)] = c
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const base = () => {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	return g
}
const where = (g, face) => ({
	hand: (g.hands['美国'] || []).some(x => faceOf(x) === face),
	discard: (g.discard['美国'] || []).some(x => faceOf(x) === face),
	table: (g.table['美国'] || []).some(x => faceOf(x) === face),
	removed: (g.removed['美国'] || []).some(x => faceOf(x) === face),
	deck: (g.decks['美国'] || []).some(x => faceOf(x) === face),
})

console.log('=== (i) 17513 打出后不结算 → 卡在哪 ===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17555', nation: '美国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const st = (g.hands['美国'] || []).find(x => faceOf(x) === '17555')
	if (st) R.action(g, 'Allies', 'play_card', { card: st })
	I.refresh(g)
	const ts = (g.table['美国'] || []).filter(x => (byId[faceOf(x)] || {}).type === 'STATUS')
	g.status_used = g.status_used || {}
	if (ts[0]) g.status_used[ts[0]] = (I.freq_key ? I.freq_key(g) : '1:美国')
	I.refresh(g)
	const p = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: p })
	I.refresh(g)
	console.log('  打出 log = ' + logSince(g, n0).slice(0, 120))
	console.log('  卡的所在 = ' + JSON.stringify(where(g, '17513')))
	console.log('  us_wartime = ' + JSON.stringify(!!g.us_wartime))

	/* 之后做一堆别的动作，看 us_wartime 会不会被清 */
	const acts = [
		['Allies', 'next_phase', {}],
		['Allies', 'log', {}],
	]
	for (const [side, a, arg] of acts) {
		R.action(g, side, a, arg)
		I.refresh(g)
		console.log('  执行 ' + a + ' 后：us_wartime=' + JSON.stringify(!!g.us_wartime) +
			'  17513 所在=' + JSON.stringify(where(g, '17513')))
	}
	/* 换到对手回合再回来 */
	R.action(g, 'Axis', 'next_phase', {})
	I.refresh(g)
	console.log('  轴心 next_phase 后：current=' + g.current_nation + ' us_wartime=' + JSON.stringify(!!g.us_wartime) +
		'  17513=' + JSON.stringify(where(g, '17513')))
}

console.log('\n=== (ii) 17505 的"要求地区"半径 vs 轰炸卡 radius 2 ===')
{
	const DE = d.id_of('德国')
	/* 找 2 环内但不在 1 环内的陆地 */
	const r1 = new Set([DE].concat(I.get_connections(g0 = base(), DE, '美国') || []))
	const r2 = new Set()
	for (const s of r1) for (const x of (I.get_connections(g0, s, '美国') || [])) r2.add(x)
	const ring2 = [...r2].filter(s => !r1.has(s) && d.spaces[s] && d.spaces[s].terrain === 'land')
	console.log('  1 环（含本格）=' + [...r1].map(s => d.name_of(s)).slice(0, 8).join('/'))
	console.log('  2 环外沿示例 = ' + ring2.slice(0, 5).map(s => d.name_of(s)).join('/'))
	const far = ring2[0]
	if (far == null) { console.log('  （没有 2 环地区，跳过）'); }
	else {
		const g = base()
		for (let k = 0; k < 8; k++) R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })
		/* 美国陆军放在 1 环（让 17517 成立） */
		const nb = (d.spaces[DE].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
		R.action(g, 'Allies', 'debug_place', { piece: 'us_a1', nation: '美国', type: 'army', space: nb })
		/* 美国空军放在 2 环（不在 1 环） */
		R.action(g, 'Allies', 'debug_place', { piece: 'us_f2', nation: '美国', type: 'air', space: far })
		I.refresh(g)
		for (const p of ['us_a1', 'us_f2']) I.grant_supply(g, p, g.turn)
		I.refresh(g)
		R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
		I.refresh(g)
		const p51 = (g.hands['美国'] || []).find(x => faceOf(x) === '17505')
		R.action(g, 'Allies', 'play_card', { card: p51 })
		I.refresh(g)
		R.action(g, 'Allies', 'debug_add_card', { face: '17517', nation: '美国', dest: 'hand' })
		I.refresh(g)
		const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17517')
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'play_card', { card: inst, target: '德国' })
		I.refresh(g)
		const lg = logSince(g, n0)
		console.log('  空军在 2 环（' + d.name_of(far) + '）时：' + lg.slice(0, 220))
		console.log('  → P-51 是否计入 2 环空军 = ' + /P-51/.test(lg))
	}
}
