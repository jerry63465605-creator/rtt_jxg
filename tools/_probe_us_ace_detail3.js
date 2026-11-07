/* 16800 补一步：带 space 再发一次，判断是"提示缺失"还是"根本用不了" */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(20261107)
g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
g.pending_echo = null
R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
I.refresh(g)
R.action(g, 'Allies', 'debug_add_card', { face: '16800', nation: '美国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '17500', nation: '美国', dest: 'hand' })
I.refresh(g)
const build = (g.hands['美国'] || []).find(x => faceOf(x) === '17500')
const tgt = (d.spaces[d.id_of('美国')].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
R.action(g, 'Allies', 'play_card', { card: build, space: tgt })
I.refresh(g)

/* 找一个可建陆军的地区（用副本试探，不动真局） */
let spot = null
for (let sp = 1; sp < d.spaces.length; sp++) {
	if (!d.spaces[sp]) continue
	const cp = JSON.parse(JSON.stringify(g))
	const r = I.build_piece(cp, '美国', 'army', sp)
	if (r && r.ok) { spot = sp; break }
}
console.log('可建地 = ' + (spot ? d.name_of(spot) : '(无)'))

const w = (g.armed_offers || []).find(x => x.when === 'after_build_army')
const cid = (w.cards || [])[0].card_id
let n0 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: cid })
I.refresh(g)
console.log('第 1 次（不带 space）log = ' + logSince(g, n0))
console.log('  pending_echo = ' + JSON.stringify(g.pending_echo))

const army0 = Object.keys(g.location || {}).filter(p => g.piece_nation[p] === '美国' && g.piece_type[p] === 'army').length
n0 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: cid, space: spot })
I.refresh(g)
const army1 = Object.keys(g.location || {}).filter(p => g.piece_nation[p] === '美国' && g.piece_type[p] === 'army').length
console.log('第 2 次（带 space=' + (spot ? d.name_of(spot) : '-') + '）log = ' + logSince(g, n0))
console.log('  美国陆军 ' + army0 + '→' + army1 + '（建成 = ' + (army1 - army0) + '）')
console.log('  窗口还在 = ' + JSON.stringify((g.armed_offers || []).map(x => ({ when: x.when, n: (x.cards || []).length }))))
