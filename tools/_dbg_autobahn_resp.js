/* 复现：高速公路中途 15247 贵在行动发起战斗 -> 真实 request_responses 把响应挂起给英国
 * -> 检查 view.actions（发动/不发动）与 trigger_response 处理器。用运行时补丁让 15336 恒匹配。 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

// 运行时补丁：让 15336（法兰西爱国者）对一切陆地战斗恒匹配，作为盟军响应卡
const RE = I.RESPONSE_EFFECTS
RE['15336'].trigger.filter = () => true
RE['15336'].trigger.on = 'battle'

function setup() {
	let g = rules.setup(1)
	g.opening = null
	g.turn_phase = 'play'
	g.phase = 'play'
	const home = data.id_of('德国')
	const sp = I.get_connections(g, home, 'axis').map(Number)
		.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== home)
	const enemySp = I.get_connections(g, sp, 'axis').map(Number)
		.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== sp)
	I.set_supply_point(g, home, 'axis', true)
	I.set_supply_point(g, sp, 'axis', true)
	I.set_supply_point(g, enemySp, 'allies', true)
	I.compute_supply(g)
	function putPiece(nation, spId, type) {
		const id = 'test_' + nation + '_' + type + '_' + spId
		g.piece_nation[id] = nation; g.piece_type[id] = type; g.location[id] = spId; return id
	}
	putPiece('苏联', enemySp, 'army')
	putPiece('苏联', enemySp, 'air')
	I.compute_supply(g)
	g.table['德国'] = ['15247']
	g.table_responses = [{ card_id: '15336#1', owner_side: 'allies', nation: '英国' }]
	g.status_used = {}
	g.current_nation = '德国'
	g.pending_autobahn = { remaining: 2, total: 2, actor: '德国', timing: false }
	return { g, home, sp, enemySp }
}

function run(label, withAutobahnSuspend) {
	console.log('\n########## ' + label + ' ##########')
	const { g, sp, enemySp } = setup()
	rules.action(g, 'Axis', 'resolve_autobahn', { space: sp })
	rules.view(g, 'Axis')
	const deArmy = Object.keys(g.location).find(p =>
		g.location[p] === sp && g.piece_nation[p] === '德国' && g.piece_type[p] === 'army')
	const suArmy = 'test_苏联_army_' + enemySp
	rules.action(g, 'Axis', 'activate_status', { card: '15247', space: enemySp, from: deArmy, victim: suArmy })
	console.log('15247 战斗后: active=' + g.active +
		' pending_autobahn_suspended=' + !!g.pending_autobahn_suspended +
		' pending_battle=' + !!g.pending_battle +
		' handoff_stack=' + JSON.stringify((g.handoff_stack || []).map(h => h.id + ':' + h.holder_role)) +
		' response_queue.len=' + (g.response_queue || []).length)

	if (!withAutobahnSuspend) g.pending_autobahn_suspended = null

	const v = rules.view(g, 'Allies')
	console.log('Allies view.side=' + v.side + ' view.pending_trigger=' + JSON.stringify(v.pending_trigger))
	console.log('Allies view.actions = ' + JSON.stringify(v.actions))

	const before = g.log.length
	rules.action(g, 'Allies', 'trigger_response', {})
	const rejected = g.log.slice(before).some(l => String(l).indexOf('不属于你方') >= 0 || String(l).indexOf('没有等待响应') >= 0)
	console.log('trigger_response 后: active=' + g.active + ' 被拒=' + rejected + ' logTail=' + JSON.stringify(g.log.slice(-1)))
}

run('A. 高速公路场景（pending_autobahn_suspended 存在）', true)
run('B. 控制场景（无 autobahn suspend）', false)
