/* 复现 15247 贵在行动 在高速公路逐次重建中是否每次重建后都能武装 after_build_army 窗口。
 * 用真实 rules.action 派发 resolve_autobahn，使其经过 20209 的 status_instant 清空逻辑。 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let g = rules.setup(1)
const home = data.id_of('德国')
const adj = I.get_connections(g, home, 'axis').map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== home)
console.log('home =', home, data.name_of(home), '| adj =', adj, data.name_of(adj))

// 直接挂起 pending_autobahn 复现窗口逻辑（不真放兵；home/adj 保持为空以便建造）
I.set_supply_point(g, home, 'axis', true)
I.set_supply_point(g, adj, 'axis', true)
I.compute_supply(g)
// 贵在行动在桌面且本回合未用过
g.table['德国'] = ['15247']
g.status_used = {}
g.current_nation = '德国'
// 直接挂起高速公路重建（total=2，模拟收回 2 支陆军）
g.pending_autobahn = { remaining: 2, total: 2, actor: '德国', timing: false }
console.log('can_build home:', JSON.stringify(I.can_build_at(g, '德国', home, 'army')))
console.log('can_build adj :', JSON.stringify(I.can_build_at(g, '德国', adj, 'army')))
console.log('pending:', JSON.stringify(g.pending_autobahn))

// 第 1 次重建（仍有剩余，pending 不撤销）
rules.action(g, 'Axis', 'resolve_autobahn', { space: home })
console.log('log after r1:', JSON.stringify(g.log.slice(-3)))
rules.view(g, 'Axis')  // 触发 18271 的 after_build_army 武装
console.log('\n--- 第1次重建后（remaining>0, 仍在高速公路中）---')
console.log('pending_autobahn =', JSON.stringify(g.pending_autobahn))
console.log('status_instant  =', JSON.stringify(g.status_instant))

// 模拟玩家“继续重建”发出的第 2 次 resolve_autobahn（会在 20209 清空 status_instant）
rules.action(g, 'Axis', 'resolve_autobahn', { space: adj })
rules.view(g, 'Axis')
console.log('\n--- 第2次重建后（尚未结算完毕，pending 仍 active）---')
console.log('pending_autobahn =', JSON.stringify(g.pending_autobahn))
console.log('status_instant  =', JSON.stringify(g.status_instant))

/*
 * 模拟玩家在高速公路中途发动 贵在行动（修复前会被 20411 守卫拦截）。
 * 【新流程】相邻无敌方 -> 玩家点一个相邻空地 -> 空打（带 space + from，不带 victim）。
 */
const deArmy = Object.keys(g.location).find(p =>
	g.location[p] === adj && g.piece_nation[p] === '德国' && g.piece_type[p] === 'army')
const emptySp = I.get_connections(g, adj, 'axis').map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== adj &&
		!Object.keys(g.location).some(p => g.location[p] === s))
console.log('空打目标(空地) =', emptySp, data.name_of(emptySp), '| 发起单位 =', deArmy)
const before = g.log.length
rules.action(g, 'Axis', 'activate_status', { card: '15247', space: emptySp, from: deArmy })
const blocked = g.log.slice(before).some(l => String(l).indexOf('高速公路结算中') >= 0)
console.log('\n--- 中途发动 贵在行动 后 ---')
console.log('被守卫拦截? ', blocked)
console.log('pending_autobahn =', JSON.stringify(g.pending_autobahn), '(应仍 active)')
console.log('status_used     =', JSON.stringify(g.status_used), '(应含 15247)')
console.log('log tail       =', JSON.stringify(g.log.slice(-2)))

let failed = 0
function assert(c, m) { if (!c) { console.log('FAIL: ' + m); failed++ } else console.log('PASS: ' + m) }
assert(!blocked, 'autobahn 中途 activate_status 不被守卫拦截')
assert(g.pending_autobahn && g.pending_autobahn.remaining === 1, '发动后 autobahn 状态保留（remaining=1）')
assert(g.status_used && g.status_used['15247'] != null, '贵在行动 本回合记为已发动')
console.log(failed === 0 ? '\nALL PASS' : '\n' + failed + ' FAILED')
