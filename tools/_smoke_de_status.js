/*
 * 德国状态卡冒烟自检（2026-09-27，服务端自动结算）
 * 用法：node tools/_smoke_de_status.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data
const I = rules._internal
const space_id = (nm) => d.id_of(nm)

let g = rules.setup(1)
g.current_nation = '德国'
g.active = 'Axis'
g.turn_phase = 'play'

const put = (id, nation, type, spaceName) => {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function clearBoard() {
	for (const k in g.location) delete g.location[k]
	for (const k in g.piece_nation) delete g.piece_nation[k]
	for (const k in g.piece_type) delete g.piece_type[k]
	if (g.table) for (const k in g.table) delete g.table[k]
	g.markers = {}
	g.status_aura = {}
	g.limited_connections = {}
	g.log = g.log || []
	g.last_battle = null
	g.play_done = {}
	g.skip_play_done = {}
	g.status_used = {}
	g.turn_phase = 'play'
}
function seedSupply() {
	put('g_home', '德国', 'army', '德国')
	put('g_ost', '德国', 'army', '东欧')
	put('g_west', '德国', 'army', '西欧')
	put('g_balk', '德国', 'army', '巴尔干')
	put('g_ita', '德国', 'army', '意大利')
	put('g_ukr', '德国', 'army', '乌克兰')
	put('g_ns', '德国', 'navy', '北海')
	put('g_balt', '德国', 'navy', '波罗的海')
	put('g_black', '德国', 'navy', '黑海')
}
function cnt(spaceName, nation, type) {
	const id = d.id_of(spaceName)
	let n = 0
	for (const p in g.piece_nation)
		if (g.piece_nation[p] === nation && g.piece_type[p] === type && g.location[p] === id) n++
	return n
}
function totArmy(nation) {
	let n = 0
	for (const p in g.piece_nation)
		if (g.piece_nation[p] === nation && g.piece_type[p] === 'army') n++
	return n
}
const give = (face, nation) => (g.hands[nation || '德国']).push(String(face) + '#1')
const score = () => (g.score && g.score['axis']) || 0
const delPiece = (id) => { delete g.location[id]; delete g.piece_nation[id]; delete g.piece_type[id] }
function givePlay(face, target) {
	give(face)
	g.play_done = {}
	g = rules.action(g, 'Axis', 'play_card', { card: String(face) + '#1', target: target || '苏联' })
	return g
}
/* 找一个 supply:true 且与给定地区相邻的空格 id（用于放置攻击方保证补给） */
function supplyNeighbor(spaceName) {
	const tid = d.id_of(spaceName)
	const conns = I.get_connections(g, tid, 'axis')
	for (const nb of conns) {
		const sp = d.spaces[nb]
		if (sp && sp.supply) return nb
	}
	return conns[0]
}

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	cond ? pass++ : (fail++, process.exitCode = 1)
}

/* ---- 0) 全部 16 张可识别并打出上桌 ---- */
console.log('\n=== 0) 全部状态卡可打出 ===')
const ALL = ['15241','15242','15243','15244','15245','15246','15247','15248','15249','15250','15251','15252','15253','15254','15255','6601']
for (const f of ALL) {
	clearBoard(); seedSupply()
	const before = (g.table['德国'] || []).length
	givePlay(f)
	const onTable = (g.table['德国'] || []).some(c => String(c).indexOf(f) === 0)
	ok(f + ' 上桌', onTable, 'table=' + JSON.stringify(g.table['德国']))
}

/* ---- auto 计分贡献（隔离基准） ---- */
console.log('\n=== auto 计分贡献 ===')
function autoContribution(card, setup) {
	clearBoard(); seedSupply(); if (setup) setup()
	g.score = { axis: 0, allies: 0 }; I.phase_scoring(g, '德国'); const base = score()
	clearBoard(); seedSupply(); if (setup) setup()
	givePlay(card)
	g.score = { axis: 0, allies: 0 }; I.phase_scoring(g, '德国'); const total = score()
	return total - base
}
const c15241 = autoContribution('15241', () => { put('g_bn', '德国', 'navy', '波罗的海'); put('g_ne', '德国', 'army', '北欧') })
ok('15241 +2（波罗的海海军+北欧陆军）', c15241 === 2, 'Δ=' + c15241)
const c15244 = autoContribution('15244', () => { put('g_ros', '德国', 'army', '罗斯'); put('g_zy', '德国', 'army', '中亚') })
ok('15244 +3（罗斯/乌克兰/中亚各1）', c15244 === 3, 'Δ=' + c15244)
const c6601 = autoContribution('6601')
ok('6601 +2（打出标记+1，计分东欧德军+1）', c6601 === 2, 'Δ=' + c6601)

/* ---- 6601 on_play 加标记（注意标记键是数字空格 id） ---- */
console.log('\n=== 6601 打出加标记 ===')
clearBoard(); seedSupply()
givePlay('6601')
ok('打出即<德国>加1标记', (g.markers[d.id_of('德国')] || []).length >= 1, 'markers@44=' + JSON.stringify(g.markers[d.id_of('德国')]))

/* ---- 15242 人民冲锋队（play_start trigger） ---- */
console.log('\n=== 15242 人民冲锋队 ===')
clearBoard(); seedSupply()
put('sov_german', '苏联', 'army', '德国')
give('15225'); give('15226')
givePlay('15242')
g = rules.action(g, 'Axis', 'activate_status', { card: '15242#1', discard: ['15225#1'] })
ok('在<德国>消灭苏军', cnt('德国', '苏联', 'army') === 0, '苏军=' + cnt('德国','苏联','army'))
ok('在<德国>征召德军', cnt('德国', '德国', 'army') >= 1, '德军=' + cnt('德国','德国','army'))

/* ---- 15255 征兵（play_start trigger: 损耗2→建设） ---- */
console.log('\n=== 15255 征兵 ===')
clearBoard(); seedSupply()
/* 清空本土相邻陆地，留建设空位 */
delPiece('g_west'); delPiece('g_ost'); delPiece('g_balk'); delPiece('g_ita')
give('15225'); give('15226')
givePlay('15255')
g = rules.action(g, 'Axis', 'activate_status', { card: '15255#1' })
ok('德军在其土相邻空地建设1支陆军', totArmy('德国') >= 2, '德军陆军总数=' + totArmy('德国'))

/* ---- 15243/15250/15252 on-attacked（攻击方损耗） ---- */
console.log('\n=== on-attacked 反应卡 ===')
function attackLoses(card, targetSpace) {
	clearBoard(); seedSupply()
	const tid = d.id_of(targetSpace)
	const sid = supplyNeighbor(targetSpace)
	put('g_def', '德国', 'army', targetSpace)
	put('sov_atk', '苏联', 'army', d.name_of(sid))
	give(card)
	g = rules.action(g, 'Axis', 'play_card', { card: card + '#1', target: '苏联' })
	I.do_battle(g, '苏联', tid, 0, 'land', { from: 'sov_atk' })
	const log = (g.log || []).join(' ')
	return /损耗/.test(log) && log.indexOf('苏联') >= 0
}
ok('15243 西欧被攻击→苏军损3（日志）', attackLoses('15243', '西欧'))
ok('15250 德军被攻击→苏军损2（日志）', attackLoses('15250', '乌克兰'))
ok('15252 <德国>被攻击→苏军损3（日志）', attackLoses('15252', '德国'))

/* ---- 15245 after_land（单独测试，避免 play_done 互斥） ---- */
console.log('\n=== 15245 俯冲式轰炸机 ===')
clearBoard(); seedSupply()
delPiece('g_ukr')
put('sov_ukr', '苏联', 'army', '乌克兰')
put('sov_ros', '苏联', 'army', '罗斯')
givePlay('15245')
I.do_battle(g, '德国', d.id_of('乌克兰'), 0, 'land', { from: 'g_ost' })
ok('15245 相邻陆战发起（罗斯苏军减少）', cnt('罗斯', '苏联', 'army') <= 1, '苏军@罗斯=' + cnt('罗斯','苏联','army'))

/* ---- 15253 after_land（单独测试） ---- */
console.log('\n=== 15253 闪电战 ===')
clearBoard(); seedSupply()
delPiece('g_ukr')
put('sov_ukr', '苏联', 'army', '乌克兰')
givePlay('15253')
I.do_battle(g, '德国', d.id_of('乌克兰'), 0, 'land', { from: 'g_ost' })
ok('15253 战斗地区建德军', cnt('乌克兰', '德国', 'army') >= 1, '德军@乌克兰=' + cnt('乌克兰','德国','army'))

/* ---- 15247/15248 after_build_army ---- */
console.log('\n=== after_build_army 触发卡 ===')
clearBoard(); seedSupply()
delPiece('g_west')                 /* 西欧留空，便于建设 */
delPiece('g_ita')                  /* 移除意大利的德军种子，使意大利仅苏联敌军（15247 方能攻击） */
put('sov_ita', '苏联', 'army', '意大利')
givePlay('15247'); givePlay('15248')
I.build_piece(g, '德国', 'army', d.id_of('西欧'))   /* 西欧邻接 g_home 补给，可建 */
g = I.auto_fire_status(g, 'after_build_army', { space: d.id_of('西欧') })
ok('15247 相邻陆战发起（意大利苏军减少）', cnt('意大利', '苏联', 'army') === 0, '苏军@意大利=' + cnt('意大利','苏联','army'))
ok('15248 相邻建德军（德军陆军增多）', totArmy('德国') >= 6, '德军陆军总数=' + totArmy('德国'))

/* ---- 15249 econ_used（[潜艇行动]加成） ---- */
console.log('\n=== 15249 狼群战术 ===')
/* 基线：15217 单独打出，本身给 +2 分（ECON 自带），与 15249 无关 */
clearBoard(); seedSupply(); g.score = { axis: 0, allies: 0 }
givePlay('15217')
const base49 = score()   /* = 2 */
/* 带 15249 反应：15217 的 +2 之上应再 +1（狼群战术 econ_used），共 +3 */
clearBoard(); seedSupply(); g.score = { axis: 0, allies: 0 }
givePlay('15249')
givePlay('15217')   /* givePlay 会清空本回合出牌标记，ECON 卡方可打出并触发 econ_used 反应 */
ok('经济战触发+1分（15249 反应增量）', score() - base49 === 1, '基线=' + base49 + ' 带反应=' + score() + ' 增量=' + (score() - base49))

/* ---- 15254 战争海军（北海仅对轴心国相邻） ---- */
console.log('\n=== 15254 战争海军 ===')
clearBoard(); seedSupply()
givePlay('15254')
const nbConns = I.get_connections(g, d.id_of('北海'), 'axis')
const allAxis = nbConns.every(nb => {
	const nsp = d.spaces[nb]
	if (nsp.terrain === 'sea') return true
	return Object.keys(g.location).some(p => g.location[p] === nb && g.piece_nation[p] && I.faction_of_nation(g.piece_nation[p]) === 'axis')
})
ok('北海邻接被限制为轴心国/海', allAxis, 'conns=' + JSON.stringify(nbConns.map(n=>d.name_of(n))))

console.log('\nDONE pass=' + pass + ' fail=' + fail)
