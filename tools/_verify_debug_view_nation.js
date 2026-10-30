/*
 * 验证「调试：手牌视角」（debug_set_view_nation）
 *
 *  A. 服务端：阵营限制（同盟只能选同盟）、设置/清除、view.my_nation 跟随
 *  B. 优先级：正在等表态的窗口 > 调试 override（不能被调试开关盖掉）
 *  C. 手牌可见性：被选中的国家 cards 可见、其它国仍只有张数
 *  D. 静态：动作已注册、view 字段下发、query 存在
 *  E. 客户端：菜单项、面板 DOM、JS 函数、CSS 选择器
 *
 * 用法：node tools/_verify_debug_view_nation.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const mk = () => {
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.neutral = {}
	I.refresh(g)
	return g
}

console.log('\n=== A. 服务端：设置 / 清除 / 阵营限制 ===')
{
	const g = mk()
	const def = R.view(g, 'Allies').my_nation
	ok('同盟默认显示（当前德国回合）=' + def, !!def)
	R.action(g, 'Allies', 'debug_set_view_nation', { nation: '美国' })
	ok('设置后写入 game.debug_view_nation.allies',
		(g.debug_view_nation || {}).allies === '美国', JSON.stringify(g.debug_view_nation || {}))
	const v1 = R.view(g, 'Allies')
	ok('★ view.my_nation 切到美国', v1.my_nation === '美国', String(v1.my_nation))
	ok('view.debug_view_nation 回显', v1.debug_view_nation === '美国', String(v1.debug_view_nation))
	ok('★ 美国手牌可见（cards 非空）',
		!!(v1.hands['美国'] && Array.isArray(v1.hands['美国'].cards)),
		JSON.stringify(v1.hands['美国'] && Object.keys(v1.hands['美国'])))
	const other = ['英国', '苏联', '法国', '中国'].filter(n => n !== '美国')
	ok('其它同盟国仍只有张数（cards=null）',
		other.every(n => !(v1.hands[n] && v1.hands[n].cards)),
		JSON.stringify(other.map(n => [n, v1.hands[n] && (v1.hands[n].cards ? 'cards' : 'count')])))

	/* 轴心视角不受影响 */
	ok('轴心视角不受同盟 override 影响', R.view(g, 'Axis').my_nation === '德国',
		String(R.view(g, 'Axis').my_nation))

	/* 跨阵营应被拒 */
	const before = (g.debug_view_nation || {}).allies
	R.action(g, 'Allies', 'debug_set_view_nation', { nation: '德国', side: 'allies' })
	ok('跨阵营被拒绝（仍为原值）', (g.debug_view_nation || {}).allies === before,
		JSON.stringify(g.debug_view_nation || {}))

	/* 清除 */
	R.action(g, 'Allies', 'debug_set_view_nation', { nation: null })
	ok('★ 清除后恢复默认', !(g.debug_view_nation || {}).allies &&
		R.view(g, 'Allies').my_nation === def,
		JSON.stringify({ dv: g.debug_view_nation || {}, my: R.view(g, 'Allies').my_nation }))
}

console.log('\n=== B. 优先级：窗口态 > 调试 override ===')
{
	const g = mk()
	R.action(g, 'Allies', 'debug_set_view_nation', { nation: '美国' })
	ok('已固定美国', R.view(g, 'Allies').my_nation === '美国')
	/* 造一个"同盟正在等表态"的武装窗口（英国 15352 拦敌方增强卡） */
	g.hands['英国'] = (g.hands['英国'] || []).concat(['15352#90'])
	I.refresh(g)
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '德国', card: '15209#1', space: null })
	const v = R.view(g, 'Allies')
	ok('★ 有窗口在等时自动切到窗口归属国（英国），不被 override 盖住',
		v.my_nation === '英国', String(v.my_nation) +
		' armed=' + JSON.stringify((g.armed_offers || []).map(w => w.when + ':' + w.nation)))
}

console.log('\n=== C. query debug_view_options ===')
{
	const g = mk()
	R.action(g, 'Allies', 'debug_set_view_nation', { nation: '苏联' })
	const out = R.query(g, 'Allies', 'debug_view_options', {})
	ok('返回 side=allies', out && out.side === 'allies', JSON.stringify(out && out.side))
	ok('nations 只含同盟国', Array.isArray(out.nations) &&
		out.nations.every(x => x.nation !== '德国' && x.nation !== '意大利' && x.nation !== '日本'),
		JSON.stringify((out.nations || []).map(x => x.nation)))
	ok('current=苏联', out.current === '苏联', String(out.current))
	ok('含 default_nation / my_nation 提示',
		!!out.default_nation && !!out.my_nation, JSON.stringify({ d: out.default_nation, m: out.my_nation }))
}

console.log('\n=== D. 静态（服务端） ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('动作已注册 REGISTERED_ACTIONS', src.indexOf('debug_set_view_nation: 1') > 0)
	ok('动作实现存在', src.indexOf("action === 'debug_set_view_nation'") > 0)
	ok('view 兜底读取 override', src.indexOf('const dv = (game.debug_view_nation || {})[side]') > 0)
	ok('view 下发 debug_view_nation 字段', src.indexOf('debug_view_nation: (game.debug_view_nation || {})[side] || null') > 0)
	ok('query debug_view_options 存在', src.indexOf("query === 'debug_view_options'") > 0)
}

console.log('\n=== E. 静态（客户端） ===')
{
	const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8')
	ok('菜单项「调试手牌视角」', html.indexOf('toggle_debug_view()') > 0 &&
		html.indexOf('调试手牌视角') > 0)
	ok('面板 DOM #debug_view_panel', html.indexOf('id="debug_view_panel"') > 0)
	ok('国家下拉 #dbg_view_nation', html.indexOf('id="dbg_view_nation"') > 0)
	ok('面板有 × 关闭按钮',
		html.indexOf("close_debug_panel('debug_view_panel')") > 0 && html.indexOf('panel-close') > 0)
	ok('JS: toggle_debug_view', js.indexOf('function toggle_debug_view(') > 0)
	ok('JS: debug_do_set_view', js.indexOf('function debug_do_set_view(') > 0)
	ok('JS: 处理 query 回包', js.indexOf('q === "debug_view_options"') > 0)
	ok('JS: 面板互斥包含新面板',
		js.indexOf('["debug_panel", "debug_card_panel", "debug_phase_panel", "debug_view_panel"]') > 0)
	ok('CSS: 面板并入共享样式组', css.indexOf('#debug_panel, #debug_card_panel, #debug_phase_panel, #debug_view_panel {') > 0)
	ok('CSS: 关闭按钮样式', css.indexOf('#debug_view_panel .panel-close {') > 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
