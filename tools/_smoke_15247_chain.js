/* 诊断 15247 贵在行动：
 * ① 攻击地点是否由玩家选择（现状：服务端 nbrs.find 取第一个）；
 * ② 战斗落地后是否武装 after_land，从而让 闪电战(15253)/15245 可接续发动。
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
const enemySp = I.get_connections(g, sp, 'axis').map(Number)
	.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== sp)
console.log('sp=', sp, data.name_of(sp), '| enemySp=', enemySp, data.name_of(enemySp))

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
put('苏联', enemySp, 'air')   // 有空军 -> 防守方需表决 -> 真正 pending
I.compute_supply(g)

// 桌面：15247 贵在行动 + 15253 闪电战 + 15245
g.table['德国'] = ['15247', '15253', '15245']
g.status_used = {}
g.current_nation = '德国'
g.pending_autobahn = { remaining: 2, total: 2, actor: '德国', timing: false }

// 重建 1 支（武装 15247 的 after_build_army）
rules.action(g, 'Axis', 'resolve_autobahn', { space: sp })
rules.view(g, 'Axis')
console.log('\n[1] 重建后 status_instant =', JSON.stringify(g.status_instant))

/* 【新流程】攻击地区 / 发起单位 / 目标算子 全部由玩家选择后提交 */
const deArmy = Object.keys(g.location).find(p =>
	g.location[p] === sp && g.piece_nation[p] === '德国' && g.piece_type[p] === 'army')
const suArmy = 't_苏联_army_' + enemySp
// 中途发动 贵在行动
rules.action(g, 'Axis', 'activate_status',
	{ card: '15247', space: enemySp, from: deArmy, victim: suArmy })
console.log('[2] 发动后: pending_battle=', g.pending_battle ? g.pending_battle.stage : null,
	'| pending_autobahn=', JSON.stringify(g.pending_autobahn))
console.log('    status_instant =', JSON.stringify(g.status_instant))

// 防守方（苏联）不代受 -> 战斗落地
rules.action(g, 'Allies', 'resolve_battle', { declined: true })
console.log('[3] 战斗落地后: pending_battle=', g.pending_battle)
console.log('    status_instant =', JSON.stringify(g.status_instant))

const v = rules.view(g, 'Axis')
const ts = v.table_status || []
console.log('[4] view: pending_autobahn =', JSON.stringify(v.pending_autobahn))
for (const c of ts)
	console.log('    table_status:', c.card, c.name, '| ready =', c.ready, '|', c.ready_reason)

let failed = 0
function assert(c, m) { if (!c) { console.log('FAIL: ' + m); failed++ } else console.log('PASS: ' + m) }
const hasAfterLand = (g.status_instant || []).some(e => e.window === 'after_land')
assert(hasAfterLand, '战斗落地后武装了 after_land 窗口（闪电战链）')
const blitz = ts.find(c => c.card === '15253')
assert(blitz && blitz.ready, '15253 闪电战 在桌面显示"可触发"')
const c45 = ts.find(c => c.card === '15245')
assert(c45 && c45.ready, '15245 在桌面显示"可触发"')
console.log(failed === 0 ? '\nALL PASS' : '\n' + failed + ' FAILED')
