const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data

const g = R.setup(1)
g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0

function place(nation, type, space, id) {
	const pid = id || ('T' + (++g.piece_seq))
	g.location[pid] = Number(space)
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
	return pid
}

console.log('--- 只放德国陆军在德国(44) ---')
place('德国', 'army', d.id_of('德国'), 'g1')
console.log('location:', JSON.stringify(g.location))
const c = I.axis_supply_points_held(g)
console.log('count =', c.count, 'spaces =', JSON.stringify(c.spaces))

console.log('\n--- home_base_of 各国 ---')
for (const n of ['德国', '日本', '意大利', '英国', '美国']) {
	console.log(' ', n, '->', I.home_base_of(n))
}

console.log('\n--- 候选清单（supply=true） ---')
for (const sp of d.spaces) {
	if (!sp || !sp.id) continue
	if (sp.supply) console.log('  ', sp.id, sp.name)
}
