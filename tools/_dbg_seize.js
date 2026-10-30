const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal
const d = I.data
const t = require('fs').readFileSync(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'), 'utf8').split('\n')

const j = t.findIndex(l => l.indexOf('function seize_air') === 0)
console.log('=== seize_air initiator 段 (26-70) ===')
console.log(t.slice(j + 25, j + 70).join('\n'))

const g = R.setup(1)
g.opening = null
g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'discard'
g.neutral = { '美国': true, '苏联': true }
g.location = {}; g.piece_nation = {}; g.piece_type = {}
const sp = d.id_of('日本') || 47
g.location['jp_air'] = sp; g.piece_nation['jp_air'] = '日本'; g.piece_type['jp_air'] = 'air'
g.location['us_air'] = sp; g.piece_nation['us_air'] = '美国'; g.piece_type['us_air'] = 'air'
I.refresh && I.refresh(g)
const sup = I.compute_supply(g)
console.log('\ncompute_supply 类型 =', typeof sup, ' keys=', sup && Object.keys(sup).slice(0, 5))
console.log('jp_air 在补给里? ', JSON.stringify(sup && sup['jp_air']))
console.log('is_supply_point(日本) =', I.is_supply_point ? I.is_supply_point(g, sp) : 'n/a')
console.log('pieces_on(日本) =', JSON.stringify(I.pieces_on(g, sp)))
