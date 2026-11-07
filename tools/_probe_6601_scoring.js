/* 6601 计分 +1 是否真的加到分数（日志有、分数没动？） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

const g = R.setup(20261107)
g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
/* 德国陆军放三地 + 保证补给（用大本营与相邻，尽量有补给） */
for (const [p, sp] of [['de_h', '德国'], ['de_w', '西欧'], ['de_e', '东欧']])
	R.action(g, 'Axis', 'debug_place', { piece: p, nation: '德国', type: 'army', space: d.id_of(sp) })
R.action(g, 'Axis', 'debug_add_card', { face: '6601', nation: '德国', dest: 'hand' })
I.refresh(g)
for (const p of ['de_h', 'de_w', 'de_e']) I.grant_supply(g, p, g.turn)
I.refresh(g)

const card = (g.hands['德国'] || []).find(x => faceOf(x) === '6601')
let n = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card })
I.refresh(g)
console.log('打出 log = ' + (g.log || []).slice(n).join(' | '))
console.log('桌面状态卡 = ' + JSON.stringify((g.table['德国'] || []).map(faceOf)))
console.log('markers[德国] = ' + JSON.stringify((g.markers || {})[d.id_of('德国')]))

console.log('score 前 = ' + JSON.stringify(g.score))
n = (g.log || []).length
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'scoring' })
I.refresh(g)
console.log('计分 log = ' + (g.log || []).slice(n).join(' | '))
console.log('score 后 = ' + JSON.stringify(g.score))
console.log('uk_enigma_targets = ' + JSON.stringify((g.uk_enigma_targets || []).map(x => x.card_id)))
console.log('pending_status_react = ' + JSON.stringify(!!g.pending_status_react))
console.log('armed_offers = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, n: (w.cards || []).length }))))
