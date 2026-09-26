const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data

const g = R.setup(1)
g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0

g.location['b1'] = d.id_of('不列颠')
g.piece_nation['b1'] = '英国'
g.piece_type['b1'] = 'army'

g.location['s1'] = d.id_of('印度')
g.piece_nation['s1'] = '苏联'
g.piece_type['s1'] = 'army'

console.log('is_neutral 苏联 =', I.is_neutral(g, '苏联'))
const pen = I.soviet_india_penalty(g)
console.log('india_penalty =', JSON.stringify(pen))

const r = I.phase_scoring(g, '英国')
console.log('phase_scoring result gained =', r.gained)
console.log('last_scoring =', JSON.stringify(g.last_scoring, null, 1))
console.log('score =', JSON.stringify(g.score))
