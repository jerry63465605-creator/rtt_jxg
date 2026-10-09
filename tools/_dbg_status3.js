const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data
const I = rules._internal
function newg() {
	global.__DBG = (m) => console.log('DBG:', m)
	let g = rules.setup(1)
	g.nations = ['德国', '苏联']
	g.roles = { Axis: ['德国'], Allies: ['苏联'] }
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = 1
	g.table = {}
	return g
}
const put = (g, id, nation, type, spaceName) => { g.location[id] = d.id_of(spaceName); g.piece_nation[id] = nation; g.piece_type[id] = type }
const delPiece = (g, id) => { delete g.location[id]; delete g.piece_nation[id]; delete g.piece_type[id] }
function seed(g) {
	put(g,'g_home','德国','army','德国'); put(g,'g_ost','德国','army','东欧')
	put(g,'g_west','德国','army','西欧'); put(g,'g_balk','德国','army','巴尔干')
	put(g,'g_ita','德国','army','意大利'); put(g,'g_ukr','德国','army','乌克兰')
	put(g,'g_ns','德国','navy','北海'); put(g,'g_balt','德国','navy','波罗的海')
}

// 15249
{
	let g = newg(); seed(g)
	g.hands['德国'].push('15249#1')
	g.play_done = {}
	g = rules.action(g, 'Axis', 'play_card', { card: '15249#1', target: '苏联' })
	console.log('--- 15249 on table:', JSON.stringify(g.table['德国']))
	const before = (g.score && g.score['axis']) || 0
	g.hands['德国'].push('15217#1')
	g.play_done = {}
	g = rules.action(g, 'Axis', 'play_card', { card: '15217#1', target: '苏联' })
	console.log('15249 score', before, '->', (g.score && g.score['axis']) || 0)
	console.log('15249 log tail:', JSON.stringify(g.log.slice(-5)))
	console.log('15249 score:', JSON.stringify(g.score), 'table:', JSON.stringify(g.table['德国']))
}
// 15253
{
	let g = newg(); seed(g); delPiece(g,'g_ukr'); put(g,'sov_ukr','苏联','army','乌克兰')
	g.hands['德国'].push('15253#1')
	g.play_done = {}
	g = rules.action(g, 'Axis', 'play_card', { card: '15253#1', target: '苏联' })
	I.do_battle(g, '德国', d.id_of('乌克兰'), 0, 'land', { from: 'g_ost' })
	const mb = I.build_piece(g, '德国', 'army', d.id_of('乌克兰'))
	console.log('manual build 乌克兰:', JSON.stringify(mb))
	console.log('--- 15253 乌克兰德军:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('乌克兰')&&g.piece_nation[p]==='德国'))
	console.log('15253 log tail:', JSON.stringify(g.log.slice(-6)))
}
// 15247
{
	let g = newg(); seed(g); delPiece(g,'g_west'); delPiece(g,'g_ita'); put(g,'sov_ita','苏联','army','意大利')
	g.hands['德国'].push('15247#1'); g.hands['德国'].push('15248#1')
	g.play_done = {}
	g = rules.action(g, 'Axis', 'play_card', { card: '15247#1', target: '苏联' })
	g = rules.action(g, 'Axis', 'play_card', { card: '15248#1', target: '苏联' })
	I.build_piece(g, '德国', 'army', d.id_of('西欧'))
	console.log('15247 意大利德军 before fire:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('意大利')&&g.piece_nation[p]==='德国'))
	console.log('15247 table 顺序:', JSON.stringify(g.table['德国']))
	g = I.auto_fire_status(g, 'after_build_army', { space: d.id_of('西欧') })
	console.log('15247 意大利德军 after fire:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('意大利')&&g.piece_nation[p]==='德国'))
	console.log('15247 log tail:', JSON.stringify(g.log.slice(-8)))
	console.log('--- 15247 意大利苏军:', Object.keys(g.location).filter(p=>g.location[p]===d.id_of('意大利')&&g.piece_nation[p]==='苏联'))
	console.log('15247 log tail:', JSON.stringify(g.log.slice(-6)))
}
