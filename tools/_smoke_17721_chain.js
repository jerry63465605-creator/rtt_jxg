/*
 * 【2026-10-25】17721《钢铁条约》链式委托回归。
 *
 * 卡面两段串行：① 意大利打出 1 张[响应卡] → ② 德国打出 1 张[状态卡]。
 * 修复：意大利手牌【没有响应牌】时，跳过 ① 直接建链给德国
 *       （旧实现把 ② 挂在 ① 成功之后，于是永远切不到德国）。
 *
 * 用法：node tools/_smoke_17721_chain.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

function scene(italyHand, germanyHand) {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '意大利'
	g.turn_phase = 'play'
	g.active = 'Axis'
	g.hands['意大利'] = italyHand.slice()
	g.hands['德国'] = germanyHand.slice()
	return g
}

console.log('\n[1] 意大利手牌【无响应牌】-> 直接把链交给德国（本次修复）')
{
	const g = scene(['17721#1'], ['15343#1'])
	rules.action(g, 'Axis', 'play_card', { card: '17721#1' })
	console.log('    current_nation =', g.current_nation, ' delegate =', JSON.stringify(g.delegate))
	console.log('    extra_play =', JSON.stringify(g.extra_play))
	ok('切到德国', g.current_nation === '德国')
	ok('建立了 chain 委托', !!(g.delegate && g.delegate.mode === 'chain'))
	ok('德国拿到 status 额外打出',
		!!(g.extra_play && g.extra_play.nation === '德国' && g.extra_play.filter === 'status'))
	const v = rules.view(g, 'Axis')
	console.log('    actions =', JSON.stringify(Object.keys(v.actions).sort()))
	ok('德国可打牌', !!v.actions['play_card'])
	ok('有放弃出口 event_delegate_decline', !!v.actions['event_delegate_decline'])
	ok('block_reason 说明在等德国', /钢铁条约/.test(v.block_reason || ''), v.block_reason)
}

console.log('\n[2] 意大利有响应牌 -> 仍是意大利先打响应牌（不提前建链）')
{
	const g = scene(['17721#1', '17730#1'], ['15343#1'])
	rules.action(g, 'Axis', 'play_card', { card: '17721#1' })
	console.log('    current_nation =', g.current_nation, ' extra_play =', JSON.stringify(g.extra_play))
	ok('仍停留在意大利', g.current_nation === '意大利')
	ok('意大利拿到 response 额外打出',
		!!(g.extra_play && g.extra_play.nation === '意大利' && g.extra_play.filter === 'response'))
	ok('此时尚未建链', !g.delegate)
	/* 打出那张响应牌后才建链 */
	rules.action(g, 'Axis', 'play_card', { card: '17730#1' })
	ok('打出响应牌后建链', !!(g.delegate && g.delegate.mode === 'chain'))
	ok('切到德国', g.current_nation === '德国')
}

console.log('\n[3] 德国打出状态卡 -> 归还意大利 + 触发意大利技能窗口')
{
	const g = scene(['17721#1'], ['15343#1'])
	rules.action(g, 'Axis', 'play_card', { card: '17721#1' })   /* 无响应牌 -> 直连德国 */
	const l0 = g.log.length
	rules.action(g, 'Axis', 'play_card', { card: '15343#1' })   /* 德国打出状态卡 */
	const log = g.log.slice(l0).join(' | ')
	console.log('    德国出牌日志 =', log)
	console.log('    current_nation =', g.current_nation, ' delegate =', JSON.stringify(g.delegate))
	ok('控制权归还意大利', g.current_nation === '意大利')
	ok('委托已收尾', !g.delegate)
	/*
	 * 注：pending_17721_skill 在【状态卡打出实现】里当场消费（25697），
	 * 由 after_card_resolved 决定意大利此刻是否真能发动国家技能 —— 那是
	 * 另一套可用性判定（本回合是否已用过 / ★条件等），不在本回归范围，
	 * 故这里只断言"旗帜已被消费（链路走到底）"，不断言窗口必然弹出。
	 */
	ok('pending_17721_skill 已被消费（链路走到底）',
		g.pending_17721_skill !== true)
}

console.log('\n[4] 德国无状态卡 -> 放弃也能归还，不卡死')
{
	const g = scene(['17721#1'], ['15200#1'])   /* 建设陆军 = BASIC，不是状态卡 */
	rules.action(g, 'Axis', 'play_card', { card: '17721#1' })
	rules.action(g, 'Axis', 'event_delegate_decline', {})
	console.log('    current_nation =', g.current_nation, ' delegate =', JSON.stringify(g.delegate))
	ok('归还意大利', g.current_nation === '意大利')
	ok('委托已收尾', !g.delegate)
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
