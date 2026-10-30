/*
 * 验证：17742 拉丁世界 的 build_army 窗口是否像 15341 那样工作。
 * 机制（通用）：打出《建设陆军》进入选地块时，点状态卡 -> activate_status{from_status:true, build_card}
 *   -> 放弃本次建设（建设卡进弃牌堆、占出牌名额），改为在卡面指定地区征召陆军。
 * 用法：node tools/_smoke_17742_build_army.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}
function space_id_of_name(nm) {
	for (const k in (d.spaces || {})) if ((d.spaces[k].name || '') === nm) return Number(k)
	return null
}
function italyArmyAt(g, sp) {
	return Object.keys(g.location || {}).filter(p =>
		g.location[p] === sp && g.piece_nation[p] === '意大利' && g.piece_type[p] === 'army').length
}

console.log('=== A. 17742 build_army 窗口（仿 15341）===')
{
	let g = rules.setup(1)
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = 1
	g.table = g.table || {}
	g.table['意大利'] = ['17742#1']
	g.hands = g.hands || {}
	g.hands['意大利'] = ['17700#1']  // 建设陆军（意大利基础卡）
	const la = space_id_of_name('拉丁美洲')
	ok('拉丁美洲 是合法地区 id', la != null, 'la=' + la)

	const g2 = rules.action(g, 'Axis', 'activate_status',
		{ card: '17742#1', from_status: true, build_card: '17700#1' })
	ok('意大利在拉丁美洲征召到 1 支陆军', italyArmyAt(g2, la) === 1,
		'latAmArmy=' + italyArmyAt(g2, la))
	ok('被放弃的《建设陆军》已打出（移出手牌）', !g2.hands['意大利'].includes('17700#1'))
	ok('出牌名额被占用（forgo_build 占名额）', !!(g2.play_done && g2.play_done['意大利']),
		'play_done=' + JSON.stringify(g2.play_done))
}

console.log('\n=== B. 对照：15341 build_army 窗口 ===')
{
	let g = rules.setup(1)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.turn = 1
	g.table = g.table || {}
	g.table['英国'] = ['15341#1']
	g.hands = g.hands || {}
	g.hands['英国'] = ['15300#1']  // 英国建设陆军
	const au = space_id_of_name('澳大利亚')
	ok('澳大利亚 是合法地区 id', au != null, 'au=' + au)
	const g2 = rules.action(g, 'Allies', 'activate_status',
		{ card: '15341#1', from_status: true, build_card: '15300#1' })
	ok('英国在澳大利亚征召到 1 支陆军',
		Object.keys(g2.location || {}).filter(p =>
			g2.location[p] === au && g2.piece_nation[p] === '英国' && g2.piece_type[p] === 'army').length === 1)
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
