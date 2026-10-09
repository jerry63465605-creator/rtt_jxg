const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let g = rules.setup(1)
g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'
const put = (id, nation, type, sp) => { g.location[id] = d.id_of(sp); g.piece_nation[id] = nation; g.piece_type[id] = type }
function clearBoard(){ for(const k in g.location) delete g.location[k]; for(const k in g.piece_nation) delete g.piece_nation[k]; for(const k in g.piece_type) delete g.piece_type[k]; g.markers={} }
clearBoard()
put('g_ost','德国','army','东欧'); put('g_west','德国','army','西欧'); put('g_balk','德国','army','巴尔干'); put('g_ita','德国','army','意大利'); put('g_ukr','德国','army','乌克兰'); put('g_ns','德国','navy','北海'); put('g_balt','德国','navy','波罗的海'); put('g_black','德国','navy','黑海')
put('sov','苏联','army','西欧')

const w = d.id_of('西欧')
console.log('space_id 西欧 =', w, 'terrain=', d.spaces[w].terrain)
console.log('pieces_on 西欧 =', rules.pieces_on ? 'n/a' : '', Object.keys(g.location).filter(p=>g.location[p]===w).map(p=>g.piece_nation[p]+'/'+g.piece_type[p]))

try { console.log('build_piece 西欧 army =', JSON.stringify(build_piece(g, '德国', 'army', w))) } catch(e){ console.log('build_piece THREW', e.message) }
try { console.log('do_battle 西欧 =', JSON.stringify(do_battle(g, '德国', w, 0, 'land', {}))) } catch(e){ console.log('do_battle THREW', e.message) }
try { console.log('recruit 东欧 =', JSON.stringify(recruit_piece(g, '德国', 'army', d.id_of('东欧')))) } catch(e){ console.log('recruit THREW', e.message) }
try { console.log('compute_supply keys=', Object.keys(rules).filter(k=>k.includes('supply'))) } catch(e){}
