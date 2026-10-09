const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

function newGame() {
  const g = rules.setup(1)
  g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'; g.play_done = {}
  g.hands['德国'] = []; g.decks['德国'] = []
  for (let k = 1; k <= 20; k++) g.decks['德国'].push('dk' + k + '#1')
  g.discard['德国'] = []; g.table['德国'] = g.table['德国'] || []
  return g
}
const g = newGame()
g.hands['德国'].push('15212#1')
g.hands['德国'].push('15217#1')
console.log('econ_config_of(15217#1)=', JSON.stringify(I.econ_config_of ? I.econ_config_of('15217#1') : 'n/a'))

const held = {
  pre: true,
  trigger: 'play_card',
  owner_side: 'allies',
  play_role: 'Axis',
  intercept_card: '15217#1',
  intercept_nation: '德国',
  ctx: { nation: '德国', card: '15217#1', card_obj: { name: '电动潜艇' } },
  candidates: [{ card_id: '15329#1', card_face: '15329', name: '反潜战术', owner_side: 'allies' }],
  resume: { action: 'play_card', arg: { card: '15217#1', target: '英国' } },
  expires_at_turn: g.turn + 1,
}
g.response_queue = g.response_queue || []
g.response_queue.push(held)
g.current_nation = '英国'
const g2 = rules.action(g, 'Allies', 'trigger_response', { card: '15329#1' })
console.log('armed_offer=', JSON.stringify(g2.armed_offer))
console.log('queue len after=', (g2.response_queue || []).length)
console.log('hand 德国=', JSON.stringify(g2.hands['德国']))
console.log('log tail=', JSON.stringify(g2.log.slice(-6)))
