/* 15215 检视中途被 15352 拦截后，队列如何释放（只读） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
I.refresh(g)
g.decks['德国'] = g.decks['德国'] || []
while (g.decks['德国'].length < 10) g.decks['德国'].push('1530' + (g.decks['德国'].length % 10) + '#t' + g.decks['德国'].length)
R.action(g, 'Axis', 'debug_add_card', { face: '15215', nation: '德国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
I.offer_armed_effects(g, 'play_start', { nation: '德国', window: 'play_start' })
I.refresh(g)
const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '15215'))
R.action(g, 'Axis', 'use_armed_offer', { card: (w.cards || []).find(c => faceOf(c.card_id) === '15215').card_id })
I.refresh(g)
console.log('peek =', JSON.stringify(g.peek && { n: g.peek.cards.length, card: g.peek.card, viewer: g.peek.viewer }))

const inst = g.peek.card
const ids = g.peek.cards.slice()
const placement = ids.map((id, i) => ({ id, where: i < 2 ? 'top' : 'bottom', order: i }))
let n = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: inst, placement })
I.refresh(g)
console.log('\n第一次提交 log =', logSince(g, n))
console.log('  armed =', JSON.stringify((g.armed_offers || []).map(x => ({ when: x.when, faces: (x.cards || []).map(c => faceOf(c.card_id)) }))))
console.log('  pending_echo =', JSON.stringify(g.pending_echo || null).slice(0, 200))
console.log('  echo_queue =', JSON.stringify(g.echo_queue || null).slice(0, 200))
console.log('  peek =', JSON.stringify(!!g.peek))

n = (g.log || []).length
R.action(g, 'Allies', 'skip_armed_offer', {})
I.refresh(g)
console.log('\nskip 之后 log =', logSince(g, n))
console.log('  peek =', JSON.stringify(!!g.peek), ' 牌堆前5 =', JSON.stringify((g.decks['德国'] || []).slice(0, 5)))
console.log('  pending_echo =', JSON.stringify(g.pending_echo || null).slice(0, 160))
console.log('  echo_queue =', JSON.stringify(g.echo_queue || null).slice(0, 160))

n = (g.log || []).length
R.action(g, 'Axis', 'log', {})
I.refresh(g)
console.log('\n再发一个 log 动作后 log =', logSince(g, n))
console.log('  peek =', JSON.stringify(!!g.peek), ' 牌堆前5 =', JSON.stringify((g.decks['德国'] || []).slice(0, 5)))
