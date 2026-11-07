/* 7902 前置：确认「海军能否发起陆战」（我方上一轮误判为不能） */
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
R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
I.refresh(g)

const AU = d.id_of('澳大利亚')
console.log('澳大利亚 id = ' + AU + '  相邻 = ' +
	(d.spaces[AU].connections || []).map(s => d.name_of(s) + '(' + (d.spaces[s].terrain || '?') + ')').join('/'))

/* 日本海军放在南太平洋；英国陆军守澳大利亚 */
const sea = (d.spaces[AU].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'sea')
console.log('放海军的海域 = ' + d.name_of(sea))
R.action(g, 'Axis', 'debug_place', { piece: 'jp_nv', nation: '日本', type: 'navy', space: sea })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_au', nation: '英国', type: 'army', space: AU })
I.refresh(g)
I.grant_supply(g, 'jp_nv', g.turn)
I.refresh(g)
console.log('日本海军在 = ' + d.name_of(g.location['jp_nv']) + '  英国陆军在 = ' + d.name_of(g.location['uk_au']))

/* battle_initiators（引擎口径） */
let can = null
try {
	can = I.battle_initiators(g, '日本', AU, 'land')
} catch (e) { can = 'ERR ' + e.message }
console.log('battle_initiators(日本, 澳, land) = ' + JSON.stringify(can))

/* 真实打出《发起陆战》 */
R.action(g, 'Axis', 'debug_add_card', { face: '15401', nation: '日本', dest: 'hand' })
I.refresh(g)
const card = (g.hands['日本'] || []).find(x => faceOf(x) === '15401')
const n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card, space: AU, piece: 'uk_au' })
I.refresh(g)
console.log('打出 log = ' + logSince(g, n0))
console.log('pending_battle = ' + JSON.stringify(g.pending_battle && { st: g.pending_battle.stage, sp: d.name_of(g.pending_battle.space) }))
console.log('英国陆军还在澳? ' + (g.location['uk_au'] != null) + '  澳大利亚现在 = ' +
	JSON.stringify(I.pieces_on(g, AU).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
