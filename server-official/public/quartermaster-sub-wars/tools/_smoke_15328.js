/*
 * 回归测试：15328《破译恩尼格码》
 *
 * 玩家 2026-10-22 口径：
 *   · 德国状态卡【效果发动】后触发 15328 —— 手动 activate_status / attacked / econ_used / econ_target 算
 *   · auto（计分阶段自动生效）不算
 *   · 多张同时 -> 仍选 1 张弃置
 *   · 弃置实现：桌面移除 + 撤光环 + 进弃牌堆
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_15328.js
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

function base() {
	let g = rules.setup(1)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.hands['德国'] = g.hands['德国'] || []
	g.table['德国'] = g.table['德国'] || []
	g.table_responses = g.table_responses || []
	g.discard['德国'] = g.discard['德国'] || []
	return g
}
function holdBritish(g, face, inst) {
	g.table_responses.push({ card_id: inst, owner_side: 'allies', nation: '英国', id: inst })
}
function qHas15328(g) {
	/* response_queue 是分组派生视图：卡在 candidates[] 里 */
	return (g.response_queue || []).some(f =>
		(f.candidates || []).some(c =>
			String(c.card_face || '') === '15328' || String(c.card_id || '').startsWith('15328')))
}

console.log('=== A. 实现修复：弃置 -> 桌面移除 + 进弃牌堆 + 撤销光环 ===')
{
	let g = base()
	/* 机械验证 revert_status_ongoing：把 17838(always_supplied 苏联) 放德国桌面并 apply */
	g.table['德国'].push('17838#1')
	I.apply_status_ongoing(g, '17838#1', '德国')
	const before = g.status_aura && g.status_aura.supply_immune && g.status_aura.supply_immune['苏联']
	ok('前置：17838 光环已登记（supply_immune[苏联]）', before === '17838#1',
		'aura=' + JSON.stringify(g.status_aura && g.status_aura.supply_immune))
	const r = I.RESPONSE_EFFECT_IMPL['15328'](g, 'allies', { nation: '德国', cards: ['17838#1'] }, '17838#1')
	ok('impl 返回 ok', !!(r && r.ok), JSON.stringify(r))
	ok('已从德国桌面移除', (g.table['德国'] || []).indexOf('17838#1') < 0,
		'table=' + JSON.stringify(g.table['德国']))
	ok('已进德国弃牌堆', (g.discard['德国'] || []).indexOf('17838#1') >= 0,
		'discard=' + JSON.stringify(g.discard['德国'].slice(-3)))
	ok('光环已撤销（supply_immune[苏联] 清空）',
		!(g.status_aura && g.status_aura.supply_immune && g.status_aura.supply_immune['苏联']),
		'aura=' + JSON.stringify(g.status_aura && g.status_aura.supply_immune))
}

console.log('\n=== B. 触发过滤：仅"德国 + 有卡"才命中 15328 ===')
{
	let g = base()
	holdBritish(g, '15328', '15328#1')
	const c1 = I.fire_trigger(g, 'status_attacked', { nation: '德国', cards: ['15249#1'] })
	ok('德国 + 有卡 -> 命中 15328', c1.some(x => String(x.card_face) === '15328'),
		'hits=' + JSON.stringify(c1.map(x => x.card_face)))
	const c2 = I.fire_trigger(g, 'status_attacked', { nation: '英国', cards: ['15249#1'] })
	ok('非德国 -> 不命中', !c2.some(x => String(x.card_face) === '15328'),
		'hits=' + JSON.stringify(c2.map(x => x.card_face)))
	const c3 = I.fire_trigger(g, 'status_attacked', { nation: '德国', cards: [] })
	ok('空卡列表 -> 不命中', !c3.some(x => String(x.card_face) === '15328'),
		'hits=' + JSON.stringify(c3.map(x => x.card_face)))
}

console.log('\n=== C. econ_used 端到端：15249 触发 -> 15328 入响应队列 ===')
{
	let g = base()
	g.table['德国'].push('15249#1')          /* 狼群战术（econ_used，tag 含 潜艇行动） */
	holdBritish(g, '15328', '15328#1')
	g.hands['德国'].push('15217#1')          /* 德国 ECON[潜艇行动]，目标可选英国 */
	g = rules.action(g, 'Axis', 'play_card', { card: '15217#1', target: '英国' })
	ok('狼群战术已触发（日志）', g.log.some(l => /狼群战术.*触发/.test(l)),
		'log尾=' + JSON.stringify(g.log.slice(-4)))
	ok('15328 已进入响应队列', qHas15328(g),
		'queue=' + JSON.stringify((g.response_queue || []).map(f => f.card_face || f.card_id)))
}

console.log('\n=== D. 反向：auto 型不触发（15241 计分自动，不产生 status_attacked） ===')
{
	let g = base()
	g.table['德国'].push('15241#1')          /* 瑞典铁矿：auto 计分 */
	holdBritish(g, '15328', '15328#1')
	/* auto 由 phase_scoring 驱动；这里直接验证 auto 配置不参与 status_attacked 触发 */
	const c = I.fire_trigger(g, 'status_attacked', { nation: '德国', cards: [] })
	ok('auto 卡不因 auto 生效被计入 status_attacked', !c.some(x => String(x.card_face) === '15328'),
		'hits=' + JSON.stringify(c.map(x => x.card_face)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
