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
console.log('AXIS const =', JSON.stringify(rules._internal ? undefined : undefined))
// 15254
seedSupply()
g.hands['德国'].push('15254#1')
g.play_done = {}
g = rules.action(g, 'Axis', 'play_card', { card: '15254#1', target: '苏联' })
console.log('15254 sea_axis_only =', JSON.stringify(g.status_aura.sea_axis_only))
console.log('北海 id =', d.id_of('北海'))
console.log('北海 conns =', JSON.stringify(I.get_connections(g, d.id_of('北海'), 'axis').map(n=>d.name_of(n))))
console.log('limited_connections =', JSON.stringify(g.limited_connections))

// 15249
seedSupply()
g.hands['德国'].push('15249#1')
g.play_done = {}
g = rules.action(g, 'Axis', 'play_card', { card: '15249#1', target: '苏联' })
const scBefore = (g.score && g.score['axis']) || 0
g.hands['德国'].push('15217#1')
g = rules.action(g, 'Axis', 'play_card', { card: '15217#1', target: '苏联' })
console.log('15249 score before=', scBefore, 'after=', (g.score && g.score['axis']) || 0)
console.log('score keys =', JSON.stringify(Object.keys(g.score || {})))

// 15253
seedSupply(); delPiece('g_ukr'); put('sov_ukr', '苏联', 'army', '乌克兰')
g.hands['德国'].push('15253#1')
g.play_done = {}
g = rules.action(g, 'Axis', 'play_card', { card: '15253#1', target: '苏联' })
console.log('15253 on table:', JSON.stringify(g.table['德国']))
I.do_battle(g, '德国', d.id_of('乌克兰'), 0, 'land', { from: 'g_ost' })
console.log('15253 乌克兰德军:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('乌克兰')&&g.piece_nation[p]==='德国'))

// 15247
seedSupply(); delPiece('g_west'); put('sov_ita', '苏联', 'army', '意大利')
g.hands['德国'].push('15247#1'); g.hands['德国'].push('15248#1')
g.play_done = {}
g = rules.action(g, 'Axis', 'play_card', { card: '15247#1', target: '苏联' })
g = rules.action(g, 'Axis', 'play_card', { card: '15248#1', target: '苏联' })
I.build_piece(g, '德国', 'army', d.id_of('西欧'))
g = I.auto_fire_status(g, 'after_build_army', { space: d.id_of('西欧') })
console.log('15247 意大利苏军:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('意大利')&&g.piece_nation[p]==='苏联'))
console.log('15248 德军陆军总数:', Object.keys(g.location).filter(p=>g.piece_nation[p]==='德国'&&g.piece_type[p]==='army').length)
