/* 验证高速公路中途 贵在行动(15247) 对"只有陆军、无空军"的目标发起【同步战斗】时：
 * 战斗在 do_battle 末尾 request_responses('battle') 把 15336（英国响应卡）入队并
 * handoff 给英国，但此时 pending_autobahn 仍为真（原挂起条件只看 pending_battle），
 * 全局拦截器(20564) 会把 trigger_response / pass_response 一并拦下 ——
 * 表现为"挂起给英国后点击发动/不发动无反应"。
 *
 * 修复：activate_status(21890) 的挂起条件扩展为
 *   pending_battle || response_queue 非空 || pending_econ
 * 即战斗引入了任何嵌套挂起就挂起高速公路，结算完由 maybe_resume_autobahn 恢复。
 *
 * 用真实 rules.action 派发，验证 trigger_response 不再被拦。 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let g = rules.setup(1)
const home = data.id_of('德国')
const sp = I.get_connections(g, home, 'axis').map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== home)
const enemySp = I.get_connections(g, sp, 'axis').map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== sp)
console.log('home=', home, 'sp=', sp, data.name_of(sp), 'enemySp=', enemySp, data.name_of(enemySp))

I.set_supply_point(g, home, 'axis', true)
I.set_supply_point(g, sp, 'axis', true)
I.compute_supply(g)

// 苏联【仅陆军】放在 enemySp（与 sp 相邻）。不放大补齐空军 -> do_battle 同步结算（无 pending_battle）
I.set_supply_point(g, enemySp, 'allies', true)
const suArmy = 'test_苏联_army_' + enemySp
g.piece_nation[suArmy] = '苏联'
g.piece_type[suArmy] = 'army'
g.location[suArmy] = enemySp
I.compute_supply(g)

// 贵在行动在桌面且本回合未用过
g.table['德国'] = ['15247']
g.status_used = {}
g.current_nation = '德国'
g.pending_autobahn = { remaining: 2, total: 2, actor: '德国', timing: false }

// 让 15336（法兰西爱国者·英国持有，on:'battle'）恒匹配任意战斗，作盟军响应卡
const resp = I.RESPONSE_EFFECTS['15336']
resp.trigger.filter = function () { return true }
resp.trigger.on = 'battle'
g.table_responses = [
	{ card_id: '15336#1', owner_side: 'allies', nation: '英国' },
]

// 第 1 次重建（sp 处建陆军，成功 -> 武装 after_build_army 窗口）
rules.action(g, 'Axis', 'resolve_autobahn', { space: sp })
/* 武装 15247(after_build_army) 窗口：本模块在 view 计算时 arm_status_instant，
 * 故需先 view 一次（与 _smoke_autobahn_battle.js 同款前置） */
rules.view(g, 'Axis')
const deArmy = Object.keys(g.location).find(p =>
	g.location[p] === sp && g.piece_nation[p] === '德国' && g.piece_type[p] === 'army')

// 中途发动 贵在行动（相邻有苏联陆军 -> 同步发起战斗，无空军因此不挂起 pending_battle）
rules.action(g, 'Axis', 'activate_status',
	{ card: '15247', space: enemySp, from: deArmy, victim: suArmy })

let failed = 0
function assert(c, m) { if (!c) { console.log('FAIL: ' + m); failed++ } else console.log('PASS: ' + m) }

console.log('\n--- 中途发动 贵在行动 后（同步战斗 + 15336 入队） ---')
console.log('log tail      =', JSON.stringify(g.log.slice(-3)))
console.log('pending_autobahn_suspended =', JSON.stringify(g.pending_autobahn_suspended))
console.log('pending_battle =', JSON.stringify(g.pending_battle))
console.log('response_queue.len =', (g.response_queue || []).length)
console.log('active =', g.active)

// ① 同步战斗：无 pending_battle，但 response_queue 已入队 15336，autobahn 应被挂起
assert(g.pending_battle == null, '同步战斗未产生 pending_battle（无空军代受）')
assert((g.response_queue || []).length === 1, '15336 已入队 response_queue')
assert(g.response_queue[0].owner_side === 'allies', '响应卡持有方为同盟（英国）')
assert(g.active === 'Allies', '操作权已 handoff 给同盟（英国）')
assert(g.pending_autobahn == null, 'autobahn 被挂起（本体置空，不再拦截响应动作）')
assert(g.pending_autobahn_suspended != null, 'autobahn 上下文已存盘')

// ② 英国点击"发动"响应：修复前应被 20564 守卫拦截（日志出现"高速公路结算中"）
const beforeClicks = g.log.length
rules.action(g, 'Allies', 'trigger_response', { ordered: true })
const blocked = g.log.slice(beforeClicks).some(l => String(l).indexOf('高速公路结算中') >= 0)
assert(!blocked, '英国 trigger_response【不再】被 autobahn 守卫拦截（修复前会卡死）')
assert((g.response_queue || []).length === 0, '15336 已结算出队')

// ③ view 里恢复：客户端能立刻看到重建面板与高亮（剩余次数不变）
const v = rules.view(g, 'Axis')
console.log('view.pending_autobahn =', JSON.stringify(v.pending_autobahn), '(应已恢复)')
assert(v.pending_autobahn != null, 'autobahn 在 view 中已恢复（客户端可见）')
assert(v.pending_autobahn.remaining === 1, '恢复后剩余次数仍为 1')
assert(g.pending_autobahn_suspended == null, '挂起槽已清空（无泄漏）')

console.log(failed === 0 ? '\nALL PASS（高速公路中途同步战斗+英国响应 链路正确）' : '\n' + failed + ' FAILED')
