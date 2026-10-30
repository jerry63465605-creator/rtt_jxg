/*
 * 17805 红色管弦乐队 全流程诊断（只读，不修改 rules.js）
 * 验证：苏联持牌 → 德国有状态卡 → play 阶段 offer → su_red_use → su_red_pick → resolve_red → 压制生效
 */
const R = require('./rtt_repro.js')
const { rules, I, ROLE } = R

let pass = 0, fail = 0
const ok = (c, m) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)) }

const g = R.setupRepro({ nation: '苏联', active: 'Allies', phase: 'play' })
// 苏联手牌放入 17805
g.hands['苏联'] = ['17805']
// 德国桌面放一张状态卡（15338 为德国 STATUS）
g.table['德国'] = ['15338#1']
console.log('初始：苏联手牌=%j 德国桌面=%j', g.hands['苏联'], g.table['德国'])

// 1) 触发 offer（苏联出牌阶段开始）
I.offer_su_red(g, '苏联')
ok(!!g.su_red_ask, 'offer_su_red(苏联) → game.su_red_ask 已挂起')
ok(!g.su_red_pick && !g.pending_red, '此时 su_red_pick / pending_red 应为空')

// 2) view 可见性：苏联(Allies)可见，德国(Axis)不可见
const vAllies = rules.view(g, ROLE.ALLIES)
const vAxis = rules.view(g, ROLE.AXIS)
ok(!!vAllies.su_red_ask, 'view(Allies).su_red_ask 存在（苏联可见）')
ok(!vAxis.su_red_ask, 'view(Axis).su_red_ask 不存在（德国不可见）')
ok(!vAllies.pending_red && !vAllies.su_red_pick, 'view(Allies) 此刻无 pending/pick')

// 3) 苏联点击"使用"
const r1 = rules.action(g, ROLE.ALLIES, 'su_red_use', {})
ok(!!g.su_red_pick, 'su_red_use → game.su_red_pick 已挂起')
ok((g.hands['苏联'] || []).indexOf('17805') < 0, '17805 已移出苏联手牌')
ok((g.discard['苏联'] || []).some(c => String(c) === '17805'), '17805 进苏联弃牌堆')

// 4) view：苏联选卡框可见，候选含 15338#1
const v2 = rules.view(g, ROLE.ALLIES)
ok(!!v2.su_red_pick, 'view(Allies).su_red_pick 存在（苏联选卡框）')
const cands = (v2.su_red_pick && v2.su_red_pick.candidates) || []
ok(cands.some(c => String(c.id) === '15338#1'), '候选含德国状态卡 15338#1')
console.log('   候选=%j', cands.map(c => c.id))

// 5) 苏联选 15338#1
const r2 = rules.action(g, ROLE.ALLIES, 'su_red_pick', { status: '15338#1' })
ok(!!g.pending_red, 'su_red_pick → game.pending_red 已挂起')
ok(g.pending_red && g.pending_red.target === '15338#1', 'pending_red.target = 15338#1')
ok(!g.su_red_pick, 'su_red_pick 已清空')

// 6) view：德国(Axis)可见二选一，苏联不可见选项
const vA = rules.view(g, ROLE.AXIS)
const vAl = rules.view(g, ROLE.ALLIES)
ok(!!vA.pending_red && vA.pending_red.options && vA.pending_red.options.length === 2,
	'view(Axis).pending_red 含 2 个选项（德国可见）')
ok(!!vAl.pending_red && (!vAl.pending_red.options || !vAl.pending_red.options.length),
	'view(Allies).pending_red 无选项（苏联仅见等待提示）')

// 7) 德国选择"本回合内无效"(choice=0)
const r3 = rules.action(g, ROLE.AXIS, 'resolve_red', { choice: 0 })
ok(!g.pending_red, 'resolve_red(0) → pending_red 清空')
ok(g.su_red_suppressed && g.su_red_suppressed['15338'] === g.turn,
	'status_active 压制记录已写（su_red_suppressed[15338]=当前 turn）')

// 8) 压制是否生效
ok(I.status_active(g, '15338#1') === false, 'status_active(15338#1) 当前回合返回 false（压制生效）')
ok(I.status_active(g, '15338#1') === true || I.status_active(g, '15338#1') === false, 'status_active 可调')

console.log(`\n=== 17805 诊断：${pass} 通过 / ${fail} 失败 ===`)
process.exit(fail ? 1 : 0)
