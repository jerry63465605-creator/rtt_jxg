/* 针对"高速公路结算中 贵在行动发动不了、结算完毕却可以"的白名单回归：
 * build_actions 在 pending_autobahn 处是【排他式提前 return】，
 * 若白名单不含 activate_status，客户端 send_action 会静默 return false。
 * 这里直接断言 view.actions —— 客户端能否发出动作的唯一依据。 */
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

I.set_supply_point(g, home, 'axis', true)
I.set_supply_point(g, sp, 'axis', true)
I.set_supply_point(g, enemySp, 'allies', true)
function put(nation, spId, type) {
	const id = 't_' + nation + '_' + type + '_' + spId
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	g.location[id] = spId
	return id
}
put('苏联', enemySp, 'army')
I.compute_supply(g)

g.table['德国'] = ['15247', '15253']
g.status_used = {}
g.current_nation = '德国'
/* setup(1) 开局处于"初始弃牌"阶段，build_actions 会先命中 opening 分支 return，
 * 测不到 pending_autobahn 分支 —— 必须先跳过开局。 */
g.opening = null
g.pending_autobahn = { remaining: 2, total: 2, actor: '德国', timing: false }

/* 重建 1 支 -> 武装 15247 的 after_build_army 窗口 */
rules.action(g, 'Axis', 'resolve_autobahn', { space: sp })
const v = rules.view(g, 'Axis')

console.log('pending_autobahn =', JSON.stringify(v.pending_autobahn))
console.log('status_instant   =', JSON.stringify(g.status_instant))
const ts = (v.table_status || []).find(c => c.card === '15247')
console.log('table_status 15247: ready =', ts && ts.ready, '|', ts && ts.ready_reason)
console.log('view.actions     =', JSON.stringify(v.actions))

let failed = 0
function assert(c, m) { if (!c) { console.log('FAIL: ' + m); failed++ } else console.log('PASS: ' + m) }

assert(!!v.pending_autobahn, '仍处于高速公路结算中（前置条件）')
assert(ts && ts.ready, '15247 贵在行动 桌面显示"可触发"')
assert(!!(v.actions && v.actions['activate_status']),
	'【核心】结算中白名单含 activate_status（否则客户端静默不发）')
assert(!!(v.actions && v.actions['activate_status:15247']), '同时登记带 card 后缀的 key')
assert(!!(v.actions && v.actions['resolve_autobahn']), '仍保留 resolve_autobahn')

/* 结算完毕后同样应有（回归，防止只改好一半）。
 * 这里直接清掉挂起来模拟"已结算完毕"，不再依赖能否再建一支。 */
g.pending_autobahn = null
const v2 = rules.view(g, 'Axis')
console.log('\n结算完毕: pending_autobahn =', JSON.stringify(v2.pending_autobahn))
assert(!v2.pending_autobahn, '高速公路已结算完毕')
assert(!!(v2.actions && v2.actions['activate_status']), '结算完毕后白名单仍含 activate_status')

console.log(failed === 0 ? '\nALL PASS' : '\n' + failed + ' FAILED')
