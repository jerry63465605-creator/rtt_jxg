/* 细化：16800 的 pending_echo 真身 / finally 清脏字段 / 17509 在有合法地区时能否打出 */
const path = require('path')
const fs = require('fs')
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
const give = f => (g) => { R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '美国', dest: 'hand' }); I.refresh(g) }

/* ---- ① 16800：pending_echo 真身 + 候选从哪来 ---- */
console.log('=== ① 16800 pending_echo 真身 ===')
{
	const g = base('play')
	give('16800')(g); give('17500')(g)
	const build = (g.hands['美国'] || []).find(x => faceOf(x) === '17500')
	const tgt = (d.spaces[d.id_of('美国')].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
	R.action(g, 'Allies', 'play_card', { card: build, space: tgt })
	I.refresh(g)
	const w = (g.armed_offers || []).find(x => x.when === 'after_build_army')
	const c = (w.cards || [])[0]
	console.log('  候选（引擎口径 armed_rebuild_candidates）= ' +
		JSON.stringify((I.armed_rebuild_candidates ? I.armed_rebuild_candidates(g, '美国', 'army') : [])))
	R.action(g, 'Allies', 'use_armed_offer', { card: c.card_id })
	I.refresh(g)
	console.log('  pending_echo = ' + JSON.stringify(g.pending_echo).slice(0, 400))
	const v = R.view(g, 'Allies')
	console.log('  view.pending_echo = ' + JSON.stringify(v.pending_echo).slice(0, 300))
	console.log('  view.actions 含 use_armed_offer/choose = ' + JSON.stringify(Object.keys(v.actions || {}).filter(k => /armed|choose|pick|echo/.test(k))))
}

/* ---- ② finally 清脏字段是否真在 ---- */
console.log('\n=== ② 空框清理（finally）是否真在 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const idx = src.lastIndexOf('finally')
	console.log('  lastIndexOf(finally) = ' + idx)
	console.log('  上下文 = ' + JSON.stringify(src.slice(Math.max(0, idx - 120), idx + 260)).slice(0, 420))
	console.log('  is_empty_echo_frame 出现次数 = ' + (src.match(/is_empty_echo_frame/g) || []).length)
}

/* ---- ③ 17509：给一个合法空军建设地，看能否打出 ---- */
console.log('\n=== ③ 17509 在有合法地区时能否执行 ===')
{
	const g = base('scoring')
	give('17509')(g)
	const cp = d.id_of('中太平洋')
	console.log('  中太平洋相邻 = ' + (d.spaces[cp].connections || []).map(s => d.name_of(s) + '(' + (d.spaces[s].terrain || '?') + ')').join('/'))
	console.log('  当前这些地区的美/日部队 = ' + JSON.stringify((d.spaces[cp].connections || []).concat([cp]).map(s => ({
		s: d.name_of(s),
		us: I.pieces_on(g, s).filter(p => g.piece_nation[p] === '美国').length,
		jp: I.pieces_on(g, s).filter(p => g.piece_nation[p] === '日本').length,
	}))))
	const card = (g.hands['美国'] || []).find(x => faceOf(x) === '17509')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 240))
	console.log('  pending_echo = ' + JSON.stringify(g.pending_echo).slice(0, 300))
	const v = R.view(g, 'Allies')
	console.log('  view.pending_echo = ' + JSON.stringify(v.pending_echo).slice(0, 300))
}
