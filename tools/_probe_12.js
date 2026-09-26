const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data

const g = R.setup(1)
g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0

g.location['u1'] = d.id_of('美国'); g.piece_nation['u1'] = '美国'; g.piece_type['u1'] = 'army'
g.location['j1'] = d.id_of('北大西洋'); g.piece_nation['j1'] = '日本'; g.piece_type['j1'] = 'navy'

console.log('美国 is_neutral =', I.is_neutral(g, '美国'))
const r = I.do_battle(g, '日本', d.id_of('美国'), 'u1', 'land', { from: 'j1' })
console.log('do_battle:', JSON.stringify(r))
console.log('美国 is_neutral after =', I.is_neutral(g, '美国'))
console.log('reason =', g.neutral_reason)
console.log('location after:', JSON.stringify(g.location))
