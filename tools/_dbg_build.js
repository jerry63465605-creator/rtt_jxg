const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const g = rules.setup(1)
const seaId = 40
function clearAt(id) { for (const p of Object.keys(g.location || {})) { if (g.location[p] === id) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] } } }
g.location = g.location || {}; g.piece_nation = g.piece_nation || {}; g.piece_type = g.piece_type || {}
for (const id of [21, 22, 23, 24]) clearAt(id)
g.location['TEST_JP_ARMY_22'] = 22
g.piece_nation['TEST_JP_ARMY_22'] = '日本'; g.piece_type['TEST_JP_ARMY_22'] = 'army'
g.location['TEST_JP_ARMY_24'] = 24
g.piece_nation['TEST_JP_ARMY_24'] = '日本'; g.piece_type['TEST_JP_ARMY_24'] = 'army'
console.log('24 邻接:', I.get_connections(g, 24, I.faction_of_nation('日本')))
console.log('21(中国东北) 可建?', JSON.stringify(I.can_build_at(g, '日本', 21, 'army')))
console.log('23(菲律宾) 可建?', JSON.stringify(I.can_build_at(g, '日本', 23, 'army')))
console.log('24(海参崴) 邻接含23?', I.get_connections(g, 24, I.faction_of_nation('日本')).includes(23))
