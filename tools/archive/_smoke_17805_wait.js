/* 临时验证：17805《红色管弦乐队》active 翻给苏联阵营（让权模式）
 * 用法：node tools/_smoke_17805_wait.js
 * 跑完即删。
 *
 * 验证点：
 *  [A] su_red_ask 挂起 + active 仍为原行动方时，德国被冻结 + 下发等待提示
 *  [B] 苏联看到自己的决策框（不下发等待提示）
 *  [C] 苏联 decline 后：su_red_ask 清空，且 active 还原到原行动国（Axis）
 *  [D] 完整链 use->pick->resolve_red：pick 时 active 翻给德国（二选一），
 *      resolve 后 active 还原到原行动国（Axis，而非停在 Allies）
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

/* 前置：德国出牌阶段、苏联手里有 17805、德国桌面有状态卡 */
function base(preFlip) {
	const g = rules.setup(20261014, 'Standard', {})
	g.current_nation = '德国'
	g.turn_phase = 'play'
	delete g.opening  // 跳过初始弃牌阶段
	g.hands = g.hands || {}
	g.hands['苏联'] = ['17805#1']
	g.hands['德国'] = ['15338#1', '15339#1', '15340#1']
	g.table = g.table || {}
	g.table['德国'] = ['15338#1']  // 一张德国桌面状态卡（15338 为德国 STATUS）
	if (preFlip) {
		// 模拟 offer_su_red 已把 active 翻给苏联阵营，并记录原行动方
		g.active = 'Allies'
		g.su_red_origin_active = 'Axis'
	} else {
		g.active = 'Axis'
	}
	g.su_red_ask = { trigger: '德国', card_name: '红色管弦乐队' }
	return g
}

console.log('=== 测试 A：苏联未决，德国出牌阶段被冻结 ===')
let g = base(false)
const vAxis = rules.view(g, 'Axis')
ok('[A1] view(德国).su_red_wait 非空', !!(vAxis.su_red_wait), JSON.stringify(vAxis.su_red_wait))
ok('[A2] su_red_wait 文案为「等待苏联行动」', vAxis.su_red_wait && vAxis.su_red_wait.text === '等待苏联行动', vAxis.su_red_wait && vAxis.su_red_wait.text)
ok('[A3] 德国被冻结：actions 无 play_card', !vAxis.actions.play_card, 'play_card=' + vAxis.actions.play_card)
ok('[A4] 德国被冻结：actions 无 discard_one', !vAxis.actions.discard_one, 'discard_one=' + vAxis.actions.discard_one)
ok('[A5] 德国被冻结：actions 无 minus_score', !vAxis.actions.minus_score, 'minus_score=' + vAxis.actions.minus_score)

console.log('\n=== 测试 B：苏联看到自己的决策框（不应下发等待提示）===')
const vAllies = rules.view(g, 'Allies')
ok('[B1] view(苏联).su_red_wait 为 null', !vAllies.su_red_wait, JSON.stringify(vAllies.su_red_wait))
ok('[B2] view(苏联) 有 su_red_use 决策动作', !!vAllies.actions.su_red_use, 'su_red_use=' + vAllies.actions.su_red_use)
ok('[B3] view(苏联) 有 su_red_decline 决策动作', !!vAllies.actions.su_red_decline, 'su_red_decline=' + vAllies.actions.su_red_decline)

console.log('\n=== 测试 C：苏联 decline 后 active 还原到原行动国（Axis）===')
let g2 = base(true)
ok('[C0] 前置：active 已翻给 Allies', g2.active === 'Allies', 'active=' + g2.active)
rules.action(g2, 'Allies', 'su_red_decline', {})
ok('[C1] 决定后 su_red_ask 已清空', !g2.su_red_ask, 'su_red_ask=' + JSON.stringify(g2.su_red_ask))
ok('[C2] active 已还原为 Axis（原行动国）', g2.active === 'Axis', 'active=' + g2.active)
ok('[C3] su_red_origin_active 已清空', g2.su_red_origin_active == null, 'su_red_origin_active=' + JSON.stringify(g2.su_red_origin_active))
const vAxisC = rules.view(g2, 'Axis')
ok('[C4] view(德国).su_red_wait 恢复为 null', !vAxisC.su_red_wait, JSON.stringify(vAxisC.su_red_wait))
ok('[C5] view(德国) 恢复 play_card 动作', !!vAxisC.actions.play_card, 'play_card=' + vAxisC.actions.play_card)

console.log('\n=== 测试 D：完整链 use->pick->resolve_red 后 active 还原（非停在 Allies）===')
let g3 = base(true)
g3.su_red_ask = null
g3.su_red_pick = { card_name: '红色管弦乐队' }
// 苏联选卡 -> 挂起德国二选一
rules.action(g3, 'Allies', 'su_red_pick', { status: '15338#1' })
ok('[D1] su_red_pick 后 pending_red 已挂起', !!g3.pending_red, 'pending_red=' + JSON.stringify(g3.pending_red))
ok('[D2] 选卡后 active 翻给德国（Axis，等德国二选一）', g3.active === 'Axis', 'active=' + g3.active)
// 德国二选一：choice=0（本回合内无效）
rules.action(g3, 'Axis', 'resolve_red', { choice: 0 })
ok('[D3] resolve 后 pending_red 已清空', !g3.pending_red, 'pending_red=' + JSON.stringify(g3.pending_red))
ok('[D4] resolve 后 active 还原为 Axis（原行动国，非停在 Allies）', g3.active === 'Axis', 'active=' + g3.active)
ok('[D5] su_red_origin_active 已清空', g3.su_red_origin_active == null, 'su_red_origin_active=' + JSON.stringify(g3.su_red_origin_active))

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAILED')))
process.exit(fail === 0 ? 0 : 1)
