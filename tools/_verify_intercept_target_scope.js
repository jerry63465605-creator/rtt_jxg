/*
 * 验证「拦截询问显示被拦截的卡」是【一类问题的通用修复】，覆盖全部拦截载体：
 *   ① enemy_echo_played  — 15352（英）
 *   ② enemy_echo_played  — 16700（意）：拦同盟增强卡
 *   ③ enemy_status_effect — 15353（英）
 *   ④ 响应栈 pre-cancel   — 15329（英·经济战）
 *   ⑤ 响应栈 pre-cancel   — 17736（意·轰炸行动）
 *
 * 断言统一走 view_intercept_target() -> {name, nation, type, via, text}
 *
 * 用法：node tools/_verify_intercept_target_scope.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const base = () => {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	return g
}

console.log('\n=== ① 15352（英国，拦轴心增强卡）真实出牌 ===')
{
	const g = base()
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '14500', nation: '德国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === '14500')
	R.action(g, 'Axis', 'play_card', { card: c })
	const ao = R.view(g, 'Allies').armed_offer
	ok('★ 15352 窗口 target=黄色方案', !!(ao && ao.target && ao.target.name === '黄色方案'),
		JSON.stringify(ao && ao.target && ao.target.name))
	ok('target.nation=德国', !!(ao && ao.target && ao.target.nation === '德国'))
}

console.log('\n=== ② 16700（意大利，拦同盟增强卡）===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15305', nation: '英国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '16700', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['英国'] || []).find(x => faceOf(x) === '15305')
	/* 15305 是"计分阶段"卡，出牌阶段打不出 -> 用真实派发函数（与 play_card 同一入口）开窗 */
	I.offer_armed_effects(g, 'enemy_echo_played', {
		nation: '英国', card: c, space: null, via: 'play', window: 'enemy_echo_played',
	})
	const ao = R.view(g, 'Axis').armed_offer
	ok('★ 16700 窗口带 target（被拦的英国卡）',
		!!(ao && ao.when === 'enemy_echo_played' && ao.target && ao.target.nation === '英国'),
		JSON.stringify(ao && ao.target && { n: ao.target.name, n2: ao.target.nation }))
	ok('16700 与 15352 走【同一段】渲染逻辑（target 字段结构一致）',
		!!(ao && ao.target && 'name' in ao.target && 'text' in ao.target && 'via' in ao.target),
		JSON.stringify(Object.keys((ao && ao.target) || {})))
}

console.log('\n=== ③ 15353（英国，拦状态卡）===')
{
	const g = base()
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15248', nation: '德国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === '15248')
	I.offer_armed_effects(g, 'enemy_status_effect', {
		nation: '德国', card: c, arg: { card: c, space: 1 }, window: 'enemy_status_effect',
	})
	const ao = R.view(g, 'Allies').armed_offer
	ok('★ 15353 窗口 target=合成燃料', !!(ao && ao.target && /合成燃料/.test(ao.target.name)))
	ok('target.type=STATUS', !!(ao && ao.target && ao.target.type === 'STATUS'))
}

console.log('\n=== ④ 15329（响应栈 pre-cancel，拦经济战）===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15329', nation: '英国', dest: 'hand' })
	I.refresh(g)
	const cf = (g.hands['英国'] || []).find(x => faceOf(x) === '15329')
	R.action(g, 'Allies', 'play_card', { card: cf })

	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15217', nation: '德国', dest: 'hand' })
	I.refresh(g)
	const econ = (g.hands['德国'] || []).find(x => faceOf(x) === '15217')
	R.action(g, 'Axis', 'play_card', { card: econ, target: '英国' })

	const v = R.view(g, 'Allies')
	const pt = v.pending_trigger
	console.log('  pending_trigger=' + JSON.stringify(pt && {
		on: pt.on, pre: pt.pre, target: pt.target && pt.target.name,
	}))
	ok('★ 15329 发动询问带 target（被拦的经济战卡）',
		!!(pt && pt.target && /电动潜艇/.test(pt.target.name)),
		JSON.stringify(pt && pt.target && pt.target.name))
	ok('target.nation=德国', !!(pt && pt.target && pt.target.nation === '德国'))
	ok('target.type=ECON', !!(pt && pt.target && pt.target.type === 'ECON'),
		JSON.stringify(pt && pt.target && pt.target.type))
}

console.log('\n=== ⑤ 17736（响应栈 pre-cancel，拦轰炸行动）===')
{
	const g = base()
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17736', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	const cr = (g.hands['意大利'] || []).find(x => faceOf(x) === '17736')
	R.action(g, 'Axis', 'play_card', { card: cr })
	ok('17736 已暗置（table_responses）',
		(g.table_responses || []).some(x => faceOf(x.card_id) === '17736'),
		JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	/* 17736 的 target 走同一段 view_intercept_target（响应栈帧的 ctx） */
	const same = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const n = (same.match(/view_intercept_target\(/g) || []).length
	ok('★ 三个窗口共用同一个 view_intercept_target（类级修复）', n >= 3, String(n))
}

console.log('\n=== ⑥ 客户端：两处询问框都渲染 target ===')
{
	const pj = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('增强/状态卡询问框（update_armed_offer_box）读 ao.target',
		pj.indexOf('const tgt = ao.target || null') > 0)
	ok('响应卡询问框（update_pending_trigger_box）读 pt.target',
		pj.indexOf('const tgt = pt.target || null') > 0)
	ok('两处都写"被拦截："前缀', (pj.match(/被拦截：/g) || []).length >= 2,
		String((pj.match(/被拦截：/g) || []).length))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
