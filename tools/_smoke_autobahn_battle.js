/* 验证 贵在行动(15247) 在高速公路中途发动、相邻有敌方时：
 * 1) 服务端 activate_status 不被守卫拦截（已修 20415）；
 * 2) 但其 run 会创建 pending_battle，而 pending_autobahn 仍在，
 *    导致战斗结算动作被 20415 守卫拦截 —— 玩家卡死（即"不能中途发动"的真因）。
 * 用真实 rules.action 派发。 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let g = rules.setup(1)
const home = data.id_of('德国')
const sp = I.get_connections(g, home, 'axis').map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== home)
// 找一个 sp 的陆地邻居放苏联兵（作为 15247 的攻击目标）
const enemySp = I.get_connections(g, sp, 'axis').map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== sp)
console.log('home=', home, 'sp=', sp, data.name_of(sp), 'enemySp=', enemySp, data.name_of(enemySp))

I.set_supply_point(g, home, 'axis', true)
I.set_supply_point(g, sp, 'axis', true)
I.compute_supply(g)

// 苏联兵放在 enemySp（与 sp 相邻）。棋子按模块约定存于
// game.piece_nation / game.piece_type / game.location。
function putPiece(nation, spId, type) {
/* id 必须含 type，否则同格陆军/空军会互相覆盖（只剩一个棋子） */
const id = 'test_' + nation + '_' + type + '_' + spId
g.piece_nation[id] = nation
g.piece_type[id] = type
g.location[id] = spId
return id
}
function factionOf(n) { return n === '德国' || n === '日本' || n === '意大利' ? 'axis' : 'allies' }
// 苏联部队要能"用空军代受"必须处于补给状态，否则 do_battle 同步结算完（无表决）
I.set_supply_point(g, enemySp, 'allies', true)
putPiece('苏联', enemySp, 'army')
// 苏联空军：使 do_battle 需要防守方"是否代受"表决 -> 真正创建 pending_battle
putPiece('苏联', enemySp, 'air')
I.compute_supply(g)

// 贵在行动在桌面且本回合未用过
g.table['德国'] = ['15247']
g.status_used = {}
g.current_nation = '德国'
g.pending_autobahn = { remaining: 2, total: 2, actor: '德国', timing: false }
console.log('can_build sp:', JSON.stringify(I.can_build_at(g, '德国', sp, 'army')))

// 第 1 次重建（sp 处建陆军，成功 -> 武装 after_build_army）
rules.action(g, 'Axis', 'resolve_autobahn', { space: sp })
rules.view(g, 'Axis')
console.log('\n--- 第1次重建后 ---')
console.log('status_instant =', JSON.stringify(g.status_instant))

// 中途发动 贵在行动（相邻有苏联兵 -> 应创建战斗）
/* 【新流程】玩家选定：目标地区 + 发起单位 + 目标算子 */
const deArmy = Object.keys(g.location).find(p =>
	g.location[p] === sp && g.piece_nation[p] === '德国' && g.piece_type[p] === 'army')
const suArmy = 'test_苏联_army_' + enemySp
const before = g.log.length
rules.action(g, 'Axis', 'activate_status',
	{ card: '15247', space: enemySp, from: deArmy, victim: suArmy })
console.log('\n--- 中途发动 贵在行动 后 ---')
console.log('log tail =', JSON.stringify(g.log.slice(-3)))
console.log('pending_autobahn =', JSON.stringify(g.pending_autobahn), '(应仍 active)')
console.log('pending_battle   =', JSON.stringify(g.pending_battle), '(应被创建)')
console.log('status_used      =', JSON.stringify(g.status_used))

let failed = 0
function assert(c, m) { if (!c) { console.log('FAIL: ' + m); failed++ } else console.log('PASS: ' + m) }

// ① 效果创建战斗 -> autobahn 应被挂起（本体制空、上下文存盘）
assert(g.pending_battle != null, '贵在行动 创建 pending_battle（防守方需表决）')
assert(g.pending_autobahn == null, 'autobahn 被挂起（本体置空，不再拦截战斗）')
assert(g.pending_autobahn_suspended != null, 'autobahn 上下文已存盘')
assert(g.pending_autobahn_suspended && g.pending_autobahn_suspended.remaining === 1,
	'挂起前剩余 1 次被完整保留')

// ② 防守方（苏联 = Allies）表态：不代受 -> 战斗结束
const bBefore = g.log.length
rules.action(g, 'Allies', 'resolve_battle', { declined: true })
const blocked = g.log.slice(bBefore).some(l => String(l).indexOf('高速公路结算中') >= 0)
assert(!blocked, '防守方结算战斗【不再】被 autobahn 守卫拦截（修复前会卡死）')
console.log('\n--- 防守方表态后 ---')
console.log('pending_battle =', JSON.stringify(g.pending_battle), '(应 null = 战斗结束)')

// ③ view 里恢复：客户端能立刻看到重建面板与高亮
const v = rules.view(g, 'Axis')
console.log('view.pending_autobahn =', JSON.stringify(v.pending_autobahn), '(应已恢复)')
assert(g.pending_battle == null, '战斗结算完毕')
assert(v.pending_autobahn != null, 'autobahn 在 view 中已恢复（客户端可见）')
assert(v.pending_autobahn.remaining === 1, '恢复后剩余次数仍为 1')
assert(g.pending_autobahn_suspended == null, '挂起槽已清空（无泄漏）')
console.log(failed === 0 ? '\nALL PASS（挂起/恢复链路正确）' : '\n' + failed + ' FAILED')
