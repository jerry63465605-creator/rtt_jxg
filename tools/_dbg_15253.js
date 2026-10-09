const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data
const I = rules._internal
let g = rules.setup(1)
g.nations = ['德国', '苏联']
g.roles = { Axis: ['德国'], Allies: ['苏联'] }
g.current_nation = '德国'
g.active = 'Axis'
g.turn_phase = 'play'
g.turn = 1
const put = (id, nation, type, spaceName) => { g.location[id] = d.id_of(spaceName); g.piece_nation[id] = nation; g.piece_type[id] = type }
const delPiece = (id) => { delete g.location[id]; delete g.piece_nation[id]; delete g.piece_type[id] }
function seedSupply() {
	put('g_home', '德国', 'army', '德国'); put('g_ost', '德国', 'army', '东欧')
	put('g_west', '德国', 'army', '西欧'); put('g_balk', '德国', 'army', '巴尔干')
	put('g_ita', '德国', 'army', '意大利'); put('g_ukr', '德国', 'army', '乌克兰')
	put('g_ns', '德国', 'navy', '北海'); put('g_balt', '德国', 'navy', '波罗的海')
}
seedSupply()
delPiece('g_ukr')
put('sov_ukr', '苏联', 'army', '乌克兰')
put('sov_ros', '苏联', 'army', '罗斯')
g.play_done = {}
g.hands['德国'].push('15245#1'); g.hands['德国'].push('15253#1')
g = rules.action(g, 'Axis', 'play_card', { card: '15245#1', target: '苏联' })
g = rules.action(g, 'Axis', 'play_card', { card: '15253#1', target: '苏联' })
console.log('table 德国:', JSON.stringify(g.table['德国']))
I.do_battle(g, '德国', d.id_of('乌克兰'), 0, 'land', { from: 'g_ost' })
console.log('战后乌克兰苏军:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('乌克兰')&&g.piece_nation[p]==='苏联'))
console.log('战后乌克兰德军:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('乌克兰')&&g.piece_nation[p]==='德国'))
console.log('罗斯苏军:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('罗斯')&&g.piece_nation[p]==='苏联'))
