const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

const g = rules.setup(1)
g.current_nation = '意大利'
g.active = 'AXIS'
I.ensure_markers(g)
const tgt = 32
let placed = null
for (let i = 1; i < d.spaces.length; i++) {
	if (i === tgt) continue
	if (!I.is_adjacent(g, tgt, i, 'AXIS')) continue
	const id = I.new_piece_id(g)
	g.location[id] = i
	g.piece_nation[id] = '意大利'
	g.piece_type[id] = 'army'
	I.set_supply_point(g, i, 'AXIS', true)
	placed = i
	break
}
console.log('placed at', placed, d.name_of(placed))
console.log('can_build_at army 32:', JSON.stringify(I.can_build_at(g, '意大利', 32, 'army')))
const s = I.compute_supply(g)
const supAt = Object.keys(s.in_supply).filter(k => g.location[k] === placed)
console.log('placed unit in supply?', supAt)
console.log('all supply points (AXIS):', JSON.stringify(g.supply_points))
