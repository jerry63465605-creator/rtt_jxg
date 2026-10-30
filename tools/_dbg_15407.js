const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal
const d = I.data

const g = R.setup(1)
g.opening = null
g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'discard'
g.hands['日本'] = ['15407#1']
g.neutral = { '美国': true, '苏联': true }
g.location = {}; g.piece_nation = {}; g.piece_type = {}
g.location['jp_air'] = 1; g.piece_nation['jp_air'] = '日本'; g.piece_type['jp_air'] = 'air'
g.location['us_air'] = 17; g.piece_nation['us_air'] = '美国'; g.piece_type['us_air'] = 'air'
I.refresh && I.refresh(g)

console.log('space1 =', d.name_of(1))
console.log('get_connections(g,1,"axis") =', JSON.stringify(I.get_connections(g, 1, 'axis')),
	'->', (I.get_connections(g, 1, 'axis') || []).map(x => d.name_of(x)).join(','))
console.log('pieces_on(17) =', JSON.stringify(I.pieces_on(g, 17)))
console.log('location keys =', JSON.stringify(g.location), 'types=', JSON.stringify(g.piece_type))
console.log('faction_of 日本 =', I.faction_of_nation ? I.faction_of_nation('日本') : 'n/a')
const r = I.seize_air(g, '日本', 17, 'jp_air')
console.log('seize_air 直接调用 =', JSON.stringify(r))
console.log('us_air 还在? ' + (g.location['us_air'] != null) + '  neutral=', JSON.stringify(g.neutral))
console.log('log: ' + (g.log || []).slice(-4).join(' | '))

/* 动作名：从 view.actions 看 */
const v = R.view(g, 'Axis')
console.log('view.actions keys =', Object.keys(v.actions || {}).filter(k => /air|seize|battle/i.test(k)).join(','))
