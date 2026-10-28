"use strict"
/*
 * 【2026-10-19】大清洗(17850)「切到苏联视角→打状态卡→返回原视角」让权回归测试。
 * 仅服务端 rules.js，不动客户端。验证：
 *   A1 动作边界钩子确实把 current_nation 翻到苏联、active 翻到 Allies（中途不归还在非 su_purge 动作）；
 *   A2 走 su_purge_skip 完整往返：翻→弃《大清洗》→归还原攻击方(德国/Axis)；
 *   B  current_nation 本已是苏联(17817/压力参战路径)时不再翻转、收尾后仍是苏联。
 * 用 su_purge_skip 走收尾，免去给苏联手牌塞状态卡的麻烦（打牌逻辑本身未改，只新增收尾）。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

function baseGame() {
	const g = rules.setup('t-supurge-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	g.neutral = g.neutral || {}
	g.neutral['苏联'] = true                 // 确保苏联仍中立，end_neutral 才会置 offer
	g.table = g.table || {}
	g.table['苏联'] = g.table['苏联'] || []
	if (!g.table['苏联'].some(x => String(x).split('#')[0] === '17850'))
		g.table['苏联'].push('17850#1')     // 确保《大清洗》在苏联桌面
	return g
}

// A1：动作边界钩子确实翻到苏联（用无害 debug_draw，不触发 finish）
;(function () {
	const g = baseGame()
	g.current_nation = '德国'
	g.active = 'Axis'
	I.end_neutral(g, '苏联', 'test-attack')
	check('A1 end_neutral 设置 su_purge_offer', g.su_purge_offer === true)
	check('A1 return_nation=德国', g.su_purge_delegate && g.su_purge_delegate.return_nation === '德国')
	check('A1 end_neutral 不就地翻转(仍是德国)', g.current_nation === '德国')

	rules.action(g, 'Allies', 'debug_draw', { nation: '德国', n: 0 })
	check('A1 钩子在动作边界翻到苏联', g.current_nation === '苏联')
	check('A1 钩子翻 active 到 Allies', g.active === 'Allies')
	check('A1 让权栈含 su_purge(尚未归还)',
		g.handoff_stack && g.handoff_stack.some(x => x.id === 'su_purge'))
	console.log('--- A1 钩子翻转 通过 ---')
})()

// A2：su_purge_skip 完整往返（德国攻击路径）
;(function () {
	const g = baseGame()
	g.current_nation = '德国'
	g.active = 'Axis'
	I.end_neutral(g, '苏联', 'test-attack')
	rules.action(g, 'Allies', 'su_purge_skip', {})
	check('A2 收尾后 current_nation 归还德国', g.current_nation === '德国')
	check('A2 收尾后 active 归还 Axis', g.active === 'Axis')
	check('A2 su_purge_offer 清除', g.su_purge_offer === false)
	check('A2 su_purge_delegate 清除', g.su_purge_delegate === null)
	check('A2 让权栈已清空 su_purge',
		!g.handoff_stack || !g.handoff_stack.some(x => x.id === 'su_purge'))
	check('A2 《大清洗》已弃置(不在苏联桌面)',
		!g.table['苏联'].some(x => String(x).split('#')[0] === '17850'))
	console.log('--- A2 被攻击路径完整往返 通过 ---')
})()

// B：current_nation 本已是苏联（17817/压力参战路径），不翻转
;(function () {
	const g = baseGame()
	g.current_nation = '苏联'
	g.active = 'Allies'
	I.end_neutral(g, '苏联', 'test-self')
	check('B return_nation=苏联', g.su_purge_delegate && g.su_purge_delegate.return_nation === '苏联')
	rules.action(g, 'Allies', 'su_purge_skip', {})
	check('B 收尾后仍是苏联(无翻转)', g.current_nation === '苏联')
	check('B active 仍是 Allies', g.active === 'Allies')
	check('B su_purge_delegate 清除', g.su_purge_delegate === null)
	console.log('--- B 自打/压力路径 通过 ---')
})()

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
