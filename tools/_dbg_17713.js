// 验证 17713 修复：地中海唯一的海域邻居是通过中东海峡相连的阿拉伯海
// 原 count_uncontrolled_seas_near 直读 data.spaces[id].connections（全陆地邻居），
// 永远数不到阿拉伯海，故返回 1；修复后走 get_connections 枢纽，应返回 2（地中海 + 阿拉伯海）。
const path = require('path')
const r = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const dataMod = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js'))
const data = dataMod.data
const SPACE = dataMod.SPACE

let pass = 0, fail = 0
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS', msg) } else { fail++; console.log('  FAIL', msg) } }

function freshGame() {
	const g = r.setup(7, 'Standard', {})
	g.pieces = []; g.location = {}; g.piece_nation = {}
	g.turn_phase = 'play'; g.current_nation = '意大利'; g.active = 'axis'; g.play_done = {}
	g.score = g.score || { axis: 0, allies: 0 }
	let pid = 1000
	g.P = (nation, type, space) => { g.pieces.push({ id: pid, nation, type }); g.location[pid] = SPACE[space]; g.piece_nation[pid] = nation; pid++ }
	return g
}

function play17713(g) {
	g.hands = g.hands || {}; g.hands['意大利'] = ['17713#1']
	const before = g.score['axis'] || 0
	const res = r.action(g, '意大利', 'play_card', { card: '17713#1', target: '英国' })
	console.log('    action result:', JSON.stringify(res).slice(0, 200), '| hands:', JSON.stringify(g.hands['意大利']), '| score:', JSON.stringify(g.score))
	return (g.score['axis'] || 0) - before
}

console.log('场景1：轴心占领中东，地中海/阿拉伯海均无同盟棋子 → 期望 +2')
{
	const g = freshGame()
	g.P('意大利', 'army', '中东') // 轴心占据中东，海峡挂到轴心侧，开通地中海↔阿拉伯海
	const k = play17713(g)
	ok(k === 2, 'axis 分增量 = ' + k + ' (期望 2)')
}

console.log('场景2：不占中东（海峡在盟友侧，轴心视角看不到阿拉伯海）→ 期望 +1（仅地中海本身）')
{
	const g = freshGame()
	// 不放任何棋子
	const k = play17713(g)
	ok(k === 1, 'axis 分增量 = ' + k + ' (期望 1)')
}

console.log('场景3：轴心占中东 + 同盟在阿拉伯海驻军（该海域被同盟控制）→ 期望 +1')
{
	const g = freshGame()
	g.P('意大利', 'army', '中东')
	g.P('英国', 'navy', '阿拉伯海')
	const k = play17713(g)
	ok(k === 1, 'axis 分增量 = ' + k + ' (期望 1)')
}

console.log('场景4：轴心占中东 + 同盟在地中海驻军 → 期望 +1（仅阿拉伯海）')
{
	const g = freshGame()
	g.P('意大利', 'army', '中东')
	g.P('英国', 'navy', '地中海')
	const k = play17713(g)
	ok(k === 1, 'axis 分增量 = ' + k + ' (期望 1)')
}

console.log('场景5：轴心占中东 + 两地都被同盟控制 → 期望 +0')
{
	const g = freshGame()
	g.P('意大利', 'army', '中东')
	g.P('英国', 'navy', '地中海')
	g.P('英国', 'navy', '阿拉伯海')
	const k = play17713(g)
	ok(k === 0, 'axis 分增量 = ' + k + ' (期望 0)')
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
