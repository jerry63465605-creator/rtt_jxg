const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data
const I = rules._internal

global.__DBG = (m) => console.log('DBG:', m)

let g = rules.setup(1)
g.current_nation = '德国'
g.active = 'Axis'
g.turn_phase = 'play'

const put = (id, nation, type, spaceName) => {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}

// seed like smoke
put('g_home', '德国', 'army', '德国')
put('g_ost', '德国', 'army', '东欧')
put('g_west', '德国', 'army', '西欧')
put('g_balk', '德国', 'army', '巴尔干')
put('g_ita', '德国', 'army', '意大利')
put('g_ukr', '德国', 'army', '乌克兰')
put('g_ns', '德国', 'navy', '北海')
put('g_balt', '德国', 'navy', '波罗的海')
put('g_black', '德国', 'navy', '黑海')

delPiece('g_ukr')
put('sov_ukr', '苏联', 'army', '乌克兰')

const give = (face) => g.hands['德国'].push(String(face) + '#1')
give('15253')
g.play_done = {}
g = rules.action(g, 'Axis', 'play_card', { card: '15253#1', target: '苏联' })

console.log('TABLE before battle=', JSON.stringify(g.table['德国'] || []))
console.log('ukr sov before=', (g.piece_nation['sov_ukr']? 'sov present at '+g.location['sov_ukr'] : 'none'))

const r = I.do_battle(g, '德国', d.id_of('乌克兰'), 0, 'land', { from: 'g_ost' })
console.log('do_battle result=', JSON.stringify(r))
console.log('TABLE after battle=', JSON.stringify(g.table['德国'] || []))
console.log('ukr DE army=', countArmy('乌克兰','德国'), ' ukr SOV army=', countArmy('乌克兰','苏联'))
function countArmy(spaceName, nation){ const id=d.id_of(spaceName); let n=0; for(const p in g.piece_nation) if(g.piece_nation[p]===nation && g.piece_type[p]==='army' && g.location[p]===id) n++; return n }

function delPiece(id){ delete g.location[id]; delete g.piece_nation[id]; delete g.piece_type[id] }
