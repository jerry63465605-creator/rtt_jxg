/* 收尾定性：① 16800 点击后到底哪个字段在问"选地区" ② 17509 无合法地区时是否白扣损耗 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const base = (phase, nation = '美国') => {
	const g = R.setup(20261107)
	g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_echo = null; g.pending_status_react = null
	R.action(g, 'Allies', 'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}

console.log('=== ① 16800 点击后谁在问"选地区" ===')
{
	const g = base('play')
	R.action(g, 'Allies', 'debug_add_card', { face: '16800', nation: '美国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '17500', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const build = (g.hands['美国'] || []).find(x => faceOf(x) === '17500')
	const tgt = (d.spaces[d.id_of('美国')].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
	R.action(g, 'Allies', 'play_card', { card: build, space: tgt })
	I.refresh(g)
	const w = (g.armed_offers || []).find(x => x.when === 'after_build_army')
	const c = (w.cards || [])[0]
	console.log('  窗口卡 = ' + faceOf(c.card_id))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: c.card_id })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0))
	console.log('  pending_echo = ' + JSON.stringify(g.pending_echo))
	const v = R.view(g, 'Allies')
	console.log('  view 挂起字段 = ' + JSON.stringify(Object.keys(v).filter(k => /ask|choos|pend|pick|select|space|echo/i.test(k))
		.map(k => [k, Array.isArray(v[k]) ? 'arr:' + v[k].length : (v[k] && typeof v[k] === 'object' ? 'obj:' + Object.keys(v[k]).slice(0, 4).join('|') : v[k])])))
	console.log('  view.pending_echo = ' + JSON.stringify(v.pending_echo))
	/* 统计：美国还能建陆军的地方（用 engine 的 build_piece 试探，不落子） */
	let buildable = 0
	for (let sp = 1; sp < d.spaces.length; sp++) {
		if (!d.spaces[sp]) continue
		const r = I.build_piece(JSON.parse(JSON.stringify(g)), '美国', 'army', sp)
		if (r && r.ok) buildable++
	}
	console.log('  全图可建美国陆军的地区数 = ' + buildable)
}

console.log('\n=== ② 17509 无合法地区时是否白扣损耗 ===')
{
	const g = base('scoring')
	R.action(g, 'Allies', 'debug_add_card', { face: '17509', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const deck0 = (g.decks['美国'] || []).length
	const card = (g.hands['美国'] || []).find(x => faceOf(x) === '17509')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0))
	console.log('  牌库 ' + deck0 + '→' + (g.decks['美国'] || []).length +
		'（扣了 ' + (deck0 - (g.decks['美国'] || []).length) + '）')
	console.log('  卡还在手牌 = ' + (g.hands['美国'] || []).some(x => faceOf(x) === '17509'))
}
