/*
 * 回归测试：15211《威瑟堡行动》+ 15249《狼群战术》/15241《瑞典铁矿》额外打出。
 *
 * 覆盖两点（用户反馈）：
 *   A. 15211 计分阶段触发后应在<北欧>征召陆军（原实现写<北海>，海域无法征召陆军
 *      → 恒失败"未征召：只能在陆地地区征召陆军"）。
 *   B. 15211 授予的 [北方行动] 额外打出，应能让同批 STATUS 卡（15249/15241）在
 *      计分阶段打出（原 STATUS 分支硬编码"只能在出牌阶段打出"，把 extra:true 又挡回）。
 *
 * 用法：node tools/_smoke_15211_15249.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

const NORTH_ID = I.data.id_of('北欧')        /* 数字 id（recruit_piece 把 location 存为数字） */
const SEA_NORTH_ID = I.data.id_of('北海')

function baseGame() {
	let g = rules.setup(1)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'scoring'
	g.turn = g.turn || 1
	g.hands = g.hands || {}
	return g
}

function germanyArmyAt(game, spaceId) {
	let n = 0
	for (const id in (game.location || {})) {
		if (game.location[id] === spaceId &&
			game.piece_nation[id] === '德国' && game.piece_type[id] === 'army') n++
	}
	return n
}

console.log('=== A. 15211 威瑟堡行动：应在<北欧>征召陆军（非<北海>）===')
{
	ok('地形校验：<北海>是海域(sea)', I.data.spaces[SEA_NORTH_ID] &&
		I.data.spaces[SEA_NORTH_ID].terrain === 'sea',
		'北海 terrain=' + (I.data.spaces[SEA_NORTH_ID] || {}).terrain)
	ok('地形校验：<北欧>是陆地(land)', I.data.spaces[NORTH_ID] &&
		I.data.spaces[NORTH_ID].terrain === 'land',
		'北欧 terrain=' + (I.data.spaces[NORTH_ID] || {}).terrain)

	let g = baseGame()
	const before = germanyArmyAt(g, NORTH_ID)
	const r = I.ECHO_EFFECTS['15211'].armed.run(g, { card_id: '15211#1', nation: '德国' })
	ok('15211 run 返回 ok', !!r.ok, JSON.stringify(r))
	ok('<北欧>德陆军 +1', germanyArmyAt(g, NORTH_ID) === before + 1,
		'before=' + before + ' after=' + germanyArmyAt(g, NORTH_ID))
	ok('未在<北海>误征召', germanyArmyAt(g, SEA_NORTH_ID) === 0,
		'北海德陆军=' + germanyArmyAt(g, SEA_NORTH_ID))
	ok('授予 [北方行动] 额外打出(phase=scoring)',
		!!(g.extra_play && g.extra_play.filter === 'north' && g.extra_play.phase === 'scoring'),
		'extra_play=' + JSON.stringify(g.extra_play))
}

console.log('\n=== B. 15249 狼群战术：经额外打出在计分阶段打出 STATUS 卡 ===')
{
	let g = baseGame()
	g.hands['德国'] = ['15249#1']
	g.extra_play = {
		nation: '德国', source: '15211', source_name: '威瑟堡行动',
		filter: 'north', count: 1, turn: g.turn, phase: 'scoring',
	}
	ok('授予 extra_play(north) 成功', !!(g.extra_play && g.extra_play.filter === 'north'))
	g = rules.action(g, '德国', 'play_card', { card: '15249#1' })
	const onTable = (g.table['德国'] || []).indexOf('15249#1') >= 0
	ok('15249 进入桌面[德国]（状态卡已打出）', onTable,
		'table[德国]=' + JSON.stringify(g.table['德国']))
	ok('未报"只能在出牌阶段打出"', !g.log.some(l => /只能在出牌阶段打出/.test(l) && /狼群战术/.test(l)),
		'log尾=' + JSON.stringify(g.log.slice(-3)))
	ok('未报"效果尚未实现"', !g.log.some(l => /效果尚未实现/.test(l)),
		'log尾=' + JSON.stringify(g.log.slice(-3)))
	ok('额外打出已消耗（extra_play 清空）', !g.extra_play)
}

console.log('\n=== B2. 15241 瑞典铁矿：同源 STATUS [北方行动] 卡同样可经额外打出 ===')
{
	let g = baseGame()
	g.hands['德国'] = ['15241#1']
	g.extra_play = {
		nation: '德国', source: '15211', source_name: '威瑟堡行动',
		filter: 'north', count: 1, turn: g.turn, phase: 'scoring',
	}
	g = rules.action(g, '德国', 'play_card', { card: '15241#1' })
	const onTable = (g.table['德国'] || []).indexOf('15241#1') >= 0
	ok('15241 进入桌面[德国]', onTable, 'table[德国]=' + JSON.stringify(g.table['德国']))
	ok('未报"只能在出牌阶段打出"', !g.log.some(l => /只能在出牌阶段打出/.test(l)),
		'log尾=' + JSON.stringify(g.log.slice(-3)))
	ok('额外打出已消耗', !g.extra_play)
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
