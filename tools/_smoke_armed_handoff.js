/* 统一"操作权让渡"原语回归测试（2026-10-16）
 * 验证：
 *   ① handoff_to / reconcile_handoff 栈式翻转与归还，多 id 互不干扰；
 *   ② EFFECT 跨阵营让权：敌方(Allies)打出增强卡时，offer_armed_effects 建立
 *      16700 窗口并翻转 game.active 到 Axis(意大利)，清除后归还；
 *   ③ 同阵营场景不翻转 active。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) }
}

console.log('\n=== ① 原语单元：handoff_to / reconcile_handoff ===')
{
	const g = rules.setup(1)
	g.active = 'Allies'; g.current_nation = '美国'
	I.handoff_to(g, '意大利', 'response')
	ok('handoff_to 翻转到 Axis', g.active === 'Axis')
	I.reconcile_handoff(g, 'response')
	ok('reconcile_handoff 归还 Allies', g.active === 'Allies')

	// 多 id 独立：response 与 armed_delegate 互不干扰（栈式 LIFO 归还）
	g.active = 'Allies'
	I.handoff_to(g, '意大利', 'response')        // Axis，return=Allies
	I.handoff_to(g, '苏联', 'armed_delegate')    // Allies，return=Axis（最后翻的生效）
	ok('两个 id 同时挂起，active 取最后翻的 Allies', g.active === 'Allies')
	I.reconcile_handoff(g, 'armed_delegate')     // 先还最后创建者 -> 回到 Axis（response 持有方）
	ok('reconcile armed_delegate 后 active 回到 Axis（response 仍在）', g.active === 'Axis')
	I.reconcile_handoff(g, 'response')           // 再还 response -> 回到 Allies（原始）
	ok('reconcile response 后 active 回到 Allies', g.active === 'Allies')

	// 幂等：同一 id 重复 handoff 不覆盖归还点
	g.active = 'Allies'
	I.handoff_to(g, '意大利', 'resp')
	I.handoff_to(g, '苏联', 'resp') // 同 id 不同持有方，不应覆盖原 return_active
	ok('同 id 第二次 handoff 仍未改 return_active（仍记 Allies）', g.handoff_stack.find(h => h.id === 'resp').return_active === 'Allies')
	I.reconcile_handoff(g, 'resp')
	ok('幂等后归还 Allies', g.active === 'Allies')
}

console.log('\n=== ② EFFECT 跨阵营让权：16700 拦截敌方增强卡 ===')
{
	const g = rules.setup(1)
	g.active = 'Allies'; g.current_nation = '美国'
	// 意大利手牌放 16700 + 一张填充牌（保证能损耗）
	g.hands['意大利'] = ['16700#1', '15300#1']

	// 敌方(美国)打出增强卡 -> 触发 enemy_echo_played
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '美国', card: '99999#1', space: null })

	const win = (g.armed_offers || []).find(w => w.when === 'enemy_echo_played')
	ok('16700 跨阵营 armed 窗口已建立', !!win, 'win=' + (win ? win.cards.map(c => c.card_id) : 'null'))
	ok('跨阵营让权：active 翻到 Axis(意大利)', g.active === 'Axis',
		'active=' + g.active)
	ok('窗口归属国为意大利', win && win.nation === '意大利')

	// 持有方(意大利)放弃 -> 清除窗口 -> 应归还操作权
	I.clear_armed_offer(g)
	ok('清除后 active 归还 Allies', g.active === 'Allies', 'active=' + g.active)
	ok('清除后 armed_offers 为空', (g.armed_offers || []).length === 0)
}

console.log('\n=== ③ 同阵营不翻转 ===')
{
	const g = rules.setup(1)
	g.active = 'Axis'; g.current_nation = '意大利'
	g.hands['意大利'] = ['16700#1', '15300#1']
	// 同阵营(意大利打出增强) -> 16700 ready 要求 ctx.nation 非轴心 -> 不应建窗口、不翻 active
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '意大利', card: '99999#1', space: null })
	ok('同阵营触发不建 16700 窗口', !(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	ok('同阵营 active 仍为 Axis（未翻转）', g.active === 'Axis', 'active=' + g.active)
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
