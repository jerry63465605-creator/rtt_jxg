/*
 * 17805《红色管弦乐队》跨阵营触发后的操作权归还。
 *
 * 回归背景（2026-10-25，线上 game 5721）：
 *   德国回合，苏联的 17805（watch:true）弹窗 → armed 跨阵营让权把 active 翻成 Allies
 *   → 旧的 set_pending_red 把"当时的 active(=Allies)"记成归还点
 *   → 德国选完「损耗 2 张」后 active 被还原成 Allies，而 current_nation 仍是德国
 *   → 轴心视角"等待对方行动"、actions 为空 → 永久卡死。
 *
 * 修复后改为走统一让权栈（handoff_to / reconcile_handoff），归还点由栈裁决。
 *
 * ⚠ game.active 的规范值是【角色常量】'Axis' / 'Allies'（不是阵营小写 axis/allies）。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

const AXIS_ROLE = 'Axis'
const ALLIES_ROLE = 'Allies'

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* 造局：不手工覆盖 active，让 armed 让权自然发生 */
function baseGame(target) {
	const g = rules.setup('t-17805h-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	const nat = target || '德国'
	g.opening = null                       /* 跳过开局弃牌，否则白名单只有 opening_discard */
	g.current_nation = nat
	g.active = (nat === '苏联' || nat === '英国' || nat === '美国') ? ALLIES_ROLE : AXIS_ROLE
	g.turn_phase = 'resource'
	g.turn = 3
	g.hands = g.hands || {}
	g.hands['苏联'] = ['17805#1']
	if (nat !== '苏联') g.hands[nat] = ['15205#1', '15206#1']   /* 给决策方留牌用于损耗 */
	g.discard = g.discard || {}
	g.armed_offers = g.armed_offers || []
	g.table = g.table || {}
	g.table['德国'] = ['15338#1']              /* 德国桌面一张[状态卡] */
	return g
}

/* 打完 17805 的两步（是否打出 + 选状态卡），返回挂起 pending_red 的 game */
function toPendingRed(g) {
	I.offer_armed_effects(g, 'nation_turn_start', { nation: g.current_nation })
	const g2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '17805#1' })
	return rules.action(g2, 'Allies', 'use_armed_offer', { card: '17805#1', status: '15338#1' })
}

section('A 德国回合触发 → armed 跨阵营让权 → 结算后操作权必须回轴心')
{
	const g = baseGame('德国')
	I.offer_armed_effects(g, 'nation_turn_start', { nation: '德国' })
	const win = (g.armed_offers || []).find(w => w.when === 'nation_turn_start')
	ok('A1 苏联的 17805 进入候选（watch 跨阵营）',
		!!(win && win.cards && win.cards.some(c => c.card_id === '17805#1')))
	ok('A2 armed 让权把 active 翻给同盟', g.active === ALLIES_ROLE, g.active)
	ok('A3 归还基准 _handoff_base 记的是轴心', g._handoff_base === AXIS_ROLE, g._handoff_base)

	const g3 = toPendingRed(g)
	ok('A4 pending_red 建立', !!g3.pending_red && g3.pending_red.waiting_for === '德国')
	ok('A5 挂起期间 active 翻给德国', g3.active === AXIS_ROLE, g3.active)

	const g4 = rules.action(g3, 'Axis', 'resolve_red', { choice: 1 })
	ok('A6 pending_red 已清', !g4.pending_red)
	ok('A7 current_nation 仍是德国', g4.current_nation === '德国', g4.current_nation)
	ok('A8 **active 回到 Axis（核心）**', g4.active === AXIS_ROLE, g4.active)
	ok('A9 handoff_stack 已空', !(g4.handoff_stack || []).length, g4.handoff_stack)
	const v = rules.view(g4, 'Axis')
	ok('A10 轴心视角 actions 非空（不再"等待对方行动"）',
		!!(v.actions && Object.keys(v.actions).length), v.actions)
	ok('A11 轴心视角可推进阶段', !!(v.actions && v.actions.next_phase), v.actions)
}

section('B 德国回合 + 选「本回合内无效」：操作权同样要回轴心')
{
	const g = baseGame('德国')
	const g3 = toPendingRed(g)
	const g4 = rules.action(g3, 'Axis', 'resolve_red', { choice: 0 })
	ok('B1 目标状态卡被抑制', g4.su_red_suppressed && g4.su_red_suppressed['15338'] === g4.turn,
		g4.su_red_suppressed)
	ok('B2 pending_red 已清', !g4.pending_red)
	ok('B3 active 回到 Axis', g4.active === AXIS_ROLE, g4.active)
	ok('B4 current_nation 仍是德国', g4.current_nation === '德国', g4.current_nation)
}

section('C 苏联回合触发（不能回归）')
{
	const g = baseGame('苏联')
	const g3 = toPendingRed(g)
	ok('C1 挂起期间 active 翻给德国', g3.active === AXIS_ROLE, g3.active)
	const g4 = rules.action(g3, 'Axis', 'resolve_red', { choice: 1 })
	ok('C2 结算后 active 回到 Allies', g4.active === ALLIES_ROLE, g4.active)
	ok('C3 current_nation 仍是苏联', g4.current_nation === '苏联', g4.current_nation)
	const v = rules.view(g4, 'Allies')
	ok('C4 同盟视角 actions 非空', !!(v.actions && Object.keys(v.actions).length), v.actions)
}

section('D 重复提交 resolve_red 不重复结算')
{
	const g = baseGame('德国')
	const g3 = toPendingRed(g)
	const g4 = rules.action(g3, 'Axis', 'resolve_red', { choice: 1 })
	const supBefore = JSON.stringify(g4.su_red_suppressed || {})
	const g5 = rules.action(g4, 'Axis', 'resolve_red', { choice: 0 })
	ok('D1 第二次被拒（pending_red 已空）', !g5.pending_red)
	ok('D2 状态未被二次修改', JSON.stringify(g5.su_red_suppressed || {}) === supBefore)
	ok('D3 active 仍为 Axis', g5.active === AXIS_ROLE, g5.active)
}

section('E rectify_active 兜底：_handoff_base 为空时不能把 active 变 null')
{
	const g = baseGame('德国')
	g.handoff_stack = []
	g._handoff_base = null
	g.active = AXIS_ROLE
	g.current_nation = '德国'
	if (I.rectify_active) I.rectify_active(g)
	ok('E1 active 不为 null', g.active !== null && g.active !== undefined, g.active)
	ok('E2 active === Axis', g.active === AXIS_ROLE, g.active)
}

section('F 挂起结构完整（供 UI 渲染）')
{
	const g = baseGame('德国')
	const g3 = toPendingRed(g)
	ok('F1 pending_red 含 target / target_name / waiting_for',
		!!(g3.pending_red && g3.pending_red.target && g3.pending_red.waiting_for),
		g3.pending_red)
}

console.log('\n' + '='.repeat(46))
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) {
	console.log('失败项：\n  ' + fails.join('\n  '))
	process.exit(1)
}
console.log('ALL PASS')
