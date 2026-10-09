const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let g = rules.setup(1)
g.current_nation = '日本'
g.active = 'Axis'
g.turn_phase = 'play'
g.play_done = {}
g.hands['日本'].push('15444#1')
g = rules.action(g, 'Axis', 'play_card', { card: '15444#1' })
const put = (id, n, t, s) => { g.location[id] = d.id_of(s); g.piece_nation[id] = n; g.piece_type[id] = t }
put('ja47', '日本', 'army', '日本')
put('jn40', '日本', 'navy', '东海')

console.log('aura before delete=', JSON.stringify(g.status_aura.virtual_army), 'key type=', typeof d.id_of('硫磺岛'))
I.compute_supply(g)
console.log('after 1st compute, __varmy in location?', Object.keys(g.location).filter(k => k.indexOf('__varmy') >= 0))

delete g.status_aura.virtual_army[d.id_of('硫磺岛')]
console.log('aura after delete=', JSON.stringify(g.status_aura.virtual_army))
I.compute_supply(g)
console.log('after 2nd compute, __varmy in location?', Object.keys(g.location).filter(k => k.indexOf('__varmy') >= 0))

put('jn49', '日本', 'navy', '北太平洋')
const sup = I.compute_supply(g)
console.log('49 海军 in_supply (no varmy)=', !!sup.in_supply['jn49'])
console.log('final __varmy in location?', Object.keys(g.location).filter(k => k.indexOf('__varmy') >= 0))
