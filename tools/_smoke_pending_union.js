/* 挂起集合化 第 1 步 回归：
 * 战斗挂起（等苏联表态，同盟）与 英国响应卡(15337 生命的飞跃，同盟)【同时存在】时，
 * 同盟玩家位必须【同时】拿到 resolve_battle 与 trigger_response，
 * 且服务端两段守卫都不能互相挡死。
 * 修复前：白名单命中响应分支丢掉 resolve_battle；服务端战斗守卫挡 trigger_response、
 *         响应守卫又挡 resolve_battle —— 互相锁死（英国点了没反应）。 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let g = rules.setup(1)
g.opening = null   // 跳过开局弃牌，否则 build_actions 先命中 opening 分支

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
const deArmy = put('德国', sp, 'army')
const suArmy = put('苏联', enemySp, 'army')
I.compute_supply(g)
g.current_nation = '德国'

/* ① 战斗挂起：等【苏联】（同盟）表态是否用空军代受 */
g.pending_battle = {
	stage: 'defend', space: enemySp, kind: 'land',
	attacker: '德国', attacker_faction: 'axis', attacker_piece: deArmy,
	victim_nation: '苏联', defender_nation: '苏联', air_nation: '苏联',
	victim: suArmy, victim_type: 'army', airs: [], retreats: [],
}
/*
 * ② 响应：英国(同盟) 15337 生命的飞跃
 *
 * 【2026-10-25 夹具整改】真相源已经迁移到【栈】：response_queue 只是
 * sync_response_queue_view 维护的派生只读视图，build_actions / view 一律读栈
 * （top_response_frame）。旧夹具只写 queue -> 入栈动作算不出来，白名单里
 * 没有 trigger_response -> 场景 1/2 全 FAIL。这里按 request_responses 的
 * 帧结构直接压栈，并同步派生视图。
 */
const respFrame = {
	card_id: '15337#1', card_face: '15337', name: '生命的飞跃',
	owner_side: 'allies', on: 'piece_removed', pre: false,
	ctx: { space: enemySp, nation: '法国' },
	kind: 'space', candidates: [], prompt: '', extra: null,
	group_id: 'rg_union1', group_idx: 0, ordered: true,
}
g.response_stack = [respFrame]
g.response_queue = [Object.assign({}, respFrame, {
	candidates: [{ card_id: '15337', card_face: '15337', name: '生命的飞跃' }],
})]

const v = rules.view(g, 'Allies')
console.log('view.actions =', JSON.stringify(v.actions))
console.log('block_reason =', v.block_reason)
console.log('pending_battle  可见 =', !!v.pending_battle)
console.log('pending_trigger 可见 =', !!v.pending_trigger)

let failed = 0
function assert(c, m) { if (!c) { console.log('FAIL: ' + m); failed++ } else console.log('PASS: ' + m) }

assert(!!(v.actions && v.actions['resolve_battle']), '同盟能结算战斗（resolve_battle 在白名单）')
assert(!!(v.actions && v.actions['trigger_response']), '同盟能答复响应（trigger_response 在白名单）')
assert(!!(v.actions && v.actions['pass_response']), '同盟能放弃响应（pass_response 在白名单）')

/* 服务端守卫：trigger_response 不应被"战斗结算中"挡下 */
const l1 = g.log.length
rules.action(g, 'Allies', 'trigger_response', { card: '15337' })
const m1 = g.log.slice(l1).join('|')
console.log('\ntrigger_response 日志 =', m1)
assert(!/战斗结算中/.test(m1), '服务端未用"战斗结算中"挡掉 trigger_response')

/* 服务端守卫：resolve_battle 不应被"响应结算中"挡下 */
const l2 = g.log.length
rules.action(g, 'Allies', 'resolve_battle', { declined: true })
const m2 = g.log.slice(l2).join('|')
console.log('resolve_battle 日志 =', m2)
assert(!/响应结算中/.test(m2), '服务端未用"响应结算中"挡掉 resolve_battle')

/* 轴心侧口径：不应拿到【同盟持有】的响应动作。
 * 注：resolve_battle 本就在"基础动作集"里（与 pendingBattle 是按阵营过滤的、
 *     轴心非等待方时 pendingBattle 为 null，落通用分支）—— 这是既有行为，
 *     真正的冻结由服务端守卫 pendingOk 负责，故此处不断言 resolve_battle。 */
const vAxis = rules.view(g, 'Axis')
console.log('\nAxis view.actions =', JSON.stringify(vAxis.actions))
assert(!(vAxis.actions && vAxis.actions['trigger_response']), '轴心拿不到 trigger_response（响应属同盟）')
assert(!(vAxis.actions && vAxis.actions['pass_response']), '轴心拿不到 pass_response（响应属同盟）')

/* ============================================================
 * 场景 2（第 2 步）：高速公路（轴心）与 响应（同盟）并存。
 * 验证并集不跨阵营泄漏，且轴心仍保有中途发动状态卡的 activate_status。
 * ============================================================ */
g.pending_battle = null
g.table['德国'] = ['15247']
g.status_used = {}
g.pending_autobahn = { remaining: 2, total: 2, actor: '德国', timing: false }
/*
 * 【2026-10-25 夹具整改·二】场景 1 末尾的 trigger_response / resolve_battle
 * 在死锁修复后【真的会执行】（修复前被守卫挡下、什么都没发生），
 * 于是响应栈已被消耗。场景 2 的语义是"两者并存"，必须在这里重新压帧，
 * 否则后面的断言测的是"只剩 autobahn"的单挂起局面。
 */
g.response_stack = [Object.assign({}, respFrame)]
g.response_queue = [{ card_id: '15337#1', card_face: '15337', name: '生命的飞跃',
	owner_side: 'allies', on: 'piece_removed', pre: false,
	candidates: [{ card_id: '15337', card_face: '15337', name: '生命的飞跃' }], ctx: {} }]
/* 武装 15247 的 after_build_army 窗口（否则没有 ready 的状态卡） */
g.status_instant = [{ card_id: '15247', nation: '德国', window: 'after_build_army', space: sp }]

const vA = rules.view(g, 'Axis')
const vB = rules.view(g, 'Allies')
console.log('\n[场景2] Axis   =', JSON.stringify(vA.actions))
console.log('[场景2] Allies =', JSON.stringify(vB.actions))

/*
 * 【2026-10-25 语义更新】B2（17737 非持有方冻结）之后，响应待决期间
 * 非持有方一律只拿 {log:1} —— 这是为了防止"一动手就把让权/回合国错位"。
 * 于是"轴心继续选建设位置"与下面"行动方被冻结"是同一事实的两面，
 * 后者才是现行语义；这里改为断言冻结（旧的 resolve_autobahn 断言已作废）。
 */
assert(!(vA.actions && vA.actions['resolve_autobahn']),
	'响应待决期间轴心被冻结（不跨阵营继续自己的建设流程）')
/*
 * 注意语义：响应卡多为【先制】效果（15337 生命的飞跃 = 该法国陆军本回合内无法被移除），
 * 必须在移除发生【之前】表态才有效。因此响应待决期间【行动方被冻结】是正确语义 ——
 * register_status_actions 在 response_queue 非空时不发放状态卡发送权。
 * 真正要修的是"英国答不了响应"，而不是让德国抢在响应前面行动。
 */
assert(!(vA.actions && vA.actions['activate_status']),
	'响应待决期间行动方被冻结（先制响应须先表态，正确语义）')
assert(!!(vB.actions && vB.actions['trigger_response']), '同盟仍能答复响应')
assert(!(vB.actions && vB.actions['resolve_autobahn']), '同盟拿不到 resolve_autobahn（不跨阵营泄漏）')
assert(!(vA.actions && vA.actions['trigger_response']), '轴心拿不到 trigger_response（不跨阵营泄漏）')

/* ============================================================
 * 场景 3（第 3 步）：su_red_ask（17805 苏联决策窗口）。
 * 关键：决策方苏联【不是】当前行动方（德国回合），仍必须拿到动作；
 *      同时德国这一方应被冻结（只剩 log）。
 * 这验证"并集返回必须排在 !is_my_turn 之前"，且冻结语义未丢。
 * ============================================================ */
g.pending_autobahn = null
g.response_queue = []
g.response_stack = []
g.status_instant = []
/*
 * 【2026-10-25 夹具整改·三】原夹具用的 su_red_ask / su_red_use 机制早已从 rules.js
 * 移除（17805 改由 propose_rollback 方案承载），这三条断言自那时起恒为失败。
 * 这里换成【等价语义】的现行机制：战斗挂起等待【苏联】表态（德国回合）。
 * 意图不变 —— 验证"决策方不是当前行动方时仍拿得到动作、且对方被冻结"。
 */
g.current_nation = '德国'
g.active = 'Axis'   // 当前是德国（轴心）回合
g.pending_battle = {
	stage: 'defend', space: enemySp, kind: 'land',
	attacker: '德国', attacker_faction: 'axis', attacker_piece: deArmy,
	victim_nation: '苏联', defender_nation: '苏联', air_nation: '苏联',
	victim: suArmy, victim_type: 'army', airs: [], retreats: [],
}

const vS = rules.view(g, 'Allies')   // 苏联 = 同盟
const vG = rules.view(g, 'Axis')     // 德国 = 轴心
console.log('\n[场景3] Allies(苏联) =', JSON.stringify(vS.actions))
console.log('[场景3] Axis(德国)   =', JSON.stringify(vG.actions))

assert(!!(vS.actions && vS.actions['resolve_battle']), '苏联虽非行动方，仍能结算战斗表态')
/*
 * 【2026-10-25 语义更新】"德国被冻结"在现行实现里由【服务端守卫】负责
 * （do_action 的战斗挂起守卫，见脚本上方"真正的冻结由服务端 pendingOk 负责"注解），
 * 而不是 build_actions 的白名单 —— 白名单层面德国仍会看到常规按钮。
 * 故这里改为测真实的服务端行为：点了应被"战斗结算中"挡下。
 */
{
	const l = g.log.length
	rules.action(g, 'Axis', 'play_card', { card: '15310#1' })
	const lg = g.log.slice(l).join('|')
	assert(/战斗结算中/.test(lg), '德国被服务端守卫冻结（play_card 被"战斗结算中"挡下）' + '  ' + lg)
}

console.log(failed === 0 ? '\nALL PASS' : '\n' + failed + ' FAILED')
