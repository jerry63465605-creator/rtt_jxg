const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data
const I = rules._internal
let g = rules.setup(1)
g.status_aura = { sea_axis_only: [d.id_of('北海'), d.id_of('波罗的海')] }
g.limited_connections = { axis: { [d.id_of('北海')]: null } }
console.log('北海 id:', d.id_of('北海'), 'type:', typeof d.id_of('北海'))
console.log('sea_axis_only:', JSON.stringify(g.status_aura.sea_axis_only))
console.log('indexOf result:', g.status_aura.sea_axis_only.indexOf(d.id_of('北海')))
const conns = I.get_connections(g, d.id_of('北海'), 'axis')
console.log('filtered conns:', JSON.stringify(conns.map(n=>d.name_of(n))))
console.log('limited_connections[axis][北海] after:', JSON.stringify(g.limited_connections.axis[d.id_of('北海')]))
