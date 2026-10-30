/* 临时验证：翻转类委托统一原语（17721/16703/17729/17535）
 * 用法：node tools/_smoke_delegate.js
 * 跑完即删。
 *
 * 覆盖：
 *  17535 租借法案（single）：美国选友方→其打牌→归还控制
 *  17729 卡佩里尼（order）：轴心依次从弃牌堆抽牌，逐国翻转控制，结束归还意大利
 *  16703 罗马尼亚铁卫团（german_draw）：德国弃1摸1→归还意大利（与 17721 共用 game.delegate）
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}
function baseGame() {
	const g = rules.setup(20260922, 'Standard', {})
	if (!g.hands) g.hands = {}
	if (!g.discard) g.discard = {}
	g.active = 'allies'
	I.set_skip_turn_guard(true)
	return g
}

console.log('=== 17535 租借法案（single）===')
{
	let g = baseGame()
	g.current_nation = '美国'
	g.turn_phase = 'play'
	g.hands['美国'] = ['17535#1', '15338#1'] // 17535 + 一张 STATUS 备用
	g.hands['苏联'] = ['15338#1', '15339#1', '15340#1']
	g.hands['英国'] = ['15341#1']
	rules.action(g, '美国', 'play_card', { card: '17535#1' })
	ok('[1] 打出17535后 game.delegate.mode=single', g.delegate && g.delegate.mode === 'single', 'mode=' + (g.delegate && g.delegate.mode))
	ok('[2] 控制权仍在【美国】', g.current_nation === '美国', 'cur=' + g.current_nation)
	rules.action(g, 'Allies', 'resolve_us_lend_lease_select', { nation: '苏联' })
	ok('[3] 选定苏联后 控制权翻给【苏联】', g.current_nation === '苏联', 'cur=' + g.current_nation)
	ok('[4] delegate.mode 仍为 single', g.delegate && g.delegate.mode === 'single', 'mode=' + (g.delegate && g.delegate.mode))
	ok('[5] 苏联 active=Allies（阵营角色）', g.active === 'Allies', 'active=' + g.active)
	// 苏联打出一张 STATUS 卡（无需目标），触发 finish
	const handBefore = (g.hands['苏联'] || []).length
	g.play_done = g.play_done || {}
	g.play_done['苏联'] = true // 标记本次委托打牌已完成，触发归还
	rules.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: '15338#1' })
	ok('[6] 苏联打牌后 控制权归还【美国】', g.current_nation === '美国', 'cur=' + g.current_nation)
	ok('[7] delegate 已清空', g.delegate === null, 'delegate=' + JSON.stringify(g.delegate))
}

console.log('\n=== 17729 卡佩里尼（order）===')
{
	let g = baseGame()
	g.current_nation = '意大利'
	g.turn_phase = 'play'
	g.active = 'axis'
	// 各国弃牌堆给几张，供抽牌检视
	g.discard['德国'] = ['10000#1', '10100#1']
	g.discard['意大利'] = ['10200#1', '10300#1']
	g.discard['日本'] = ['10400#1', '10500#1']
	g.hands['意大利'] = ['17729#1', '15338#1']
	rules.action(g, '意大利', 'play_card', { card: '17729#1' })
	ok('[1] 打出17729后 game.delegate.mode=order', g.delegate && g.delegate.mode === 'order', 'mode=' + (g.delegate && g.delegate.mode))
	ok('[2] 控制权翻给首国【德国】', g.current_nation === '德国', 'cur=' + g.current_nation)
	// 三国依次选择「弃置」(discard)——无需地图目标，逐国翻转
	const order = ['德国', '意大利', '日本']
	for (let i = 0; i < order.length; i++) {
		const who = order[i]
		ok('[3.' + i + '] 轮到【' + who + '】出牌', g.current_nation === who, 'cur=' + g.current_nation)
		rules.action(g, who, 'resolve_italy_chain', { choice: 'discard' })
	}
	ok('[4] 全部处理完 控制权归还【意大利】', g.current_nation === '意大利', 'cur=' + g.current_nation)
	ok('[5] delegate 已清空', g.delegate === null, 'delegate=' + JSON.stringify(g.delegate))
}

console.log('\n=== 16703 罗马尼亚铁卫团（german_draw，与 17721 共用 game.delegate）===')
{
	let g = baseGame()
	g.current_nation = '意大利'
	g.turn_phase = 'play'
	g.active = 'axis'
	g.hands['意大利'] = ['16703#1', '15338#1']
	g.hands['德国'] = ['15339#1']
	// 16703 由 17721 链接触发；此处直接验证其 run 的翻转/归还走 game.delegate
	rules.action(g, '意大利', 'play_card', { card: '16703#1' })
	ok('[1] 16703 触发后 mode=german_draw', g.delegate && g.delegate.mode === 'german_draw', 'mode=' + (g.delegate && g.delegate.mode))
	ok('[2] 控制权翻给【德国】', g.current_nation === '德国', 'cur=' + g.current_nation)
	rules.action(g, '德国', 'italy_german_draw', {})
	ok('[3] 德国弃摸后 控制权归还【意大利】', g.current_nation === '意大利', 'cur=' + g.current_nation)
	ok('[4] delegate 已清空', g.delegate === null, 'delegate=' + JSON.stringify(g.delegate))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
