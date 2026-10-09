const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(MOD + '/rules.js')
const I = R._internal
const d = require(MOD + '/data.js').data
const SP = d.id_of
for (const id of [44, 15, 13]) {
	const c = I.get_connections({ turn: 1 }, id)
	console.log(id + '(' + d.spaces[id].name + ') conns=', c.map(i => i + ':' + d.spaces[i].name).join(', '))
}
