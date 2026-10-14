/* 15247 贵在行动 重做后的行为回归：
 * ① 攻击地区/发起单位/目标由【玩家选择】（不再服务端替选）；
 * ② 候选含空地（status_battle_spaces）；
 * ③ 空打（无守军）成立且能触发闪电战(15253)等 after_land 后续窗口；
 * ④ 未选地区 / 非相邻地区 被拒绝。
 * 用真实 rules.action / rules.query 派发。 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let g = rules.setup(1)
const home = data.id_of('德国')
const sp = I.get_connections(g, home, 'axis').map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== home)
const landNbrs = I.get_connections(g, sp, 'axis').map(Number)
	.filter(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== sp)
const enemySp = landNbrs[0]
const emptySp = landNbrs[1]
console.log('sp=', sp, data.name_of(sp), '| enemySp=', enemySp, data.name_of(enemySp),
	'| emptySp=', emptySp, data.name_of(emptySp))

I.set_supply_point(g, home, 'axis', true)
I.set_supply_point(g, sp, 'axis', true)
I.set_supply_point(g, enemySp, 'allies', true)
I.set_supply_point(g, emptySp, 'axis', true)

function put(nation, spId, type) {
	const id = 't_' + nation + '_' + type + '_' + spId
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	g.location[id] = spId
	return id
}
put('苏联', enemySp, 'army')
put('苏联', enemySp, 'air')
I.compute_supply(g)

g.table['德国'] = ['15247', '15253']
g.status_used = {}
g.current_nation = '德国'
g.pending_autobahn = { remaining: 2, total: 2, actor: '德国', timing: false }

rules.action(g, 'Axis', 'resolve_autobahn', { space: sp })
rules.view(g, 'Axis')
/* 新建的德军陆军（发起单位） */
const deArmy = Object.keys(g.location).find(p =>
	g.location[p] === sp && g.piece_nation[p] === '德国' && g.piece_type[p] === 'army')
console.log('\n[1] 重建后 发起单位 =', deArmy)

/* ② 候选查询：应为建设地点的相邻陆地，且【含空地】 */
const cands = rules.query(g, 'Axis', 'status_battle_spaces',
	{ card: '15247', nation: '德国', kind: 'land' })
console.log('[2] 候选 =', JSON.stringify(cands))

let failed = 0
function assert(c, m) { if (!c) { console.log('FAIL: ' + m); failed++ } else console.log('PASS: ' + m) }
assert(cands && cands.ok, 'status_battle_spaces 查询成功')
assert(cands.spaces.indexOf(enemySp) >= 0, '候选含敌方地区 ' + data.name_of(enemySp))
assert(cands.spaces.indexOf(emptySp) >= 0, '候选【含空地】' + data.name_of(emptySp) + '（可空打）')

/* ④ 未选地区应被拒（不再服务端替选） */
const l0 = g.log.length
rules.action(g, 'Axis', 'activate_status', { card: '15247' })
const noSpaceMsg = g.log.slice(l0).join('|')
assert(/请选择要攻击的相邻地区/.test(noSpaceMsg), '未指定地区时被拒绝（不再替玩家选）')

/* ④ 非相邻地区应被拒 */
const far = Object.keys(data.spaces).map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' &&
		cands.spaces.indexOf(s) < 0 && s !== sp)
const l1 = g.log.length
rules.action(g, 'Axis', 'activate_status', { card: '15247', space: far, from: deArmy })
assert(/只能对建设地区的相邻地区/.test(g.log.slice(l1).join('|')), '非相邻地区被拒绝')

/* ③ 空打：选空地，带 from、不带 victim */
const l2 = g.log.length
rules.action(g, 'Axis', 'activate_status',
	{ card: '15247', space: emptySp, from: deArmy })
const emptyMsg = g.log.slice(l2).join('|')
console.log('[3] 空打日志 =', emptyMsg)
assert(/空打/.test(emptyMsg), '空打成立（无守军，仅消耗）')
assert(g.status_used && g.status_used['15247'] != null, '贵在行动 记为本回合已发动')

/* 空打也要能触发闪电战等 after_land 窗口 */
rules.view(g, 'Axis')
const v = rules.view(g, 'Axis')
const blitz = (v.table_status || []).find(c => c.card === '15253')
console.log('[4] 闪电战 ready =', blitz && blitz.ready, '|', blitz && blitz.ready_reason)
assert(blitz && blitz.ready, '空打同样触发 after_land —— 闪电战(15253)可发动')

console.log(failed === 0 ? '\nALL PASS' : '\n' + failed + ' FAILED')
