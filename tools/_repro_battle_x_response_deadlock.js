/*
 * 【2026-10-25】「战斗挂起 × 响应挂起」互相挡死的【实证 + 入口定位】脚本。
 *
 * 目的（玩家要求）：先回答"到底哪张/哪些卡组合能触发"，不是直接改代码。
 *
 * 结论（由本脚本 + 源码核对得出）：
 *   ① 死锁的两个守卫都【不按 side 过滤】，白名单互不包含：
 *        rules.js 25839  pending_battle -> 只放行 resolve_battle / armed / debug
 *        rules.js 25874  响应栈/队列非空 -> 只放行 响应动作 / armed / activate_status
 *      -> trigger_response 被前者挡、resolve_battle 被后者挡 = 双向锁死。
 *   ② 唯一能在"响应未表态"期间还建立 pending_battle 的入口，
 *      是守卫 B 白名单里的两个动作自己的【卡效果】：
 *        · activate_status  -> 状态卡效果发起战斗
 *        · use_armed_offer  -> 增强卡效果发起战斗
 *      其它发起战斗的方式（play_card 等）会被守卫 B 直接挡下，反而不危险。
 *
 * 用法：node tools/_repro_battle_x_response_deadlock.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

const VICTIM = 'su_army'
const ATTACKER = 'de_army'

/*
 * 摆一个"德国攻击苏联陆军"的盘面：两国相邻、都在补给。
 */
function board() {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '德国'
	const home = data.id_of('德国')
	const deSp = I.get_connections(g, home, 'axis').map(Number)
		.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== home)
	const suSp = I.get_connections(g, deSp, 'axis').map(Number)
		.find(s => data.spaces[s] && data.spaces[s].terrain === 'land' && s !== deSp)
	I.set_supply_point(g, deSp, 'axis', true)
	I.set_supply_point(g, suSp, 'allies', true)
	g.piece_nation = g.piece_nation || {}
	g.piece_type = g.piece_type || {}
	g.location = g.location || {}
	g.piece_nation[ATTACKER] = '德国'; g.piece_type[ATTACKER] = 'army'; g.location[ATTACKER] = deSp
	g.piece_nation[VICTIM] = '苏联'; g.piece_type[VICTIM] = 'army'; g.location[VICTIM] = suSp
	I.compute_supply(g)
	return { g: g, deSp: deSp, suSp: suSp }
}

/* 手工压一个响应栈帧（结构与 request_responses 一致：待发动态 candidates 为空） */
function pushPendingResponse(g, owner_side, card_id, face) {
	g.response_stack = g.response_stack || []
	g.response_stack.push({
		card_id: card_id, card_face: face, name: '未表态的响应牌',
		owner_side: owner_side, on: 'piece_removed', pre: false,
		kind: 'space', candidates: [], prompt: '', extra: null, ctx: {},
		group_id: 'rg_dl', group_idx: 0, ordered: true,
	})
	g.response_queue = g.response_stack.slice()
}

/* 手工建立 KV-2 式的战斗挂起（等待苏联表态） */
function setSovietPendingBattle(g, suSp, stage) {
	g.pending_battle = {
		stage: stage || 'kv2_ask', space: suSp, kind: 'land',
		attacker: '德国', attacker_faction: 'axis', attacker_piece: ATTACKER,
		victim_nation: '苏联', defender_nation: '苏联',
		victim: VICTIM, victim_type: 'army', airs: [], retreats: [],
		kv2_owner_nation: '苏联', su_owner_nation: '苏联',
	}
}

function logsSince(g, fn) {
	const l0 = g.log.length
	fn()
	return g.log.slice(l0).join(' | ')
}

console.log('\n[对照 1] 只有战斗挂起 -> 苏联能 resolve_battle（正常）')
{
	const { g, suSp } = board()
	setSovietPendingBattle(g, suSp, 'kv2_ask')
	const log = logsSince(g, () => rules.action(g, 'Allies', 'resolve_battle', {}))
	ok('未被"响应结算中"挡下', !/响应结算中/.test(log), log)
}

console.log('\n[对照 2] 只有响应挂起 -> 可以 trigger/pass_response（正常）')
{
	const { g } = board()
	pushPendingResponse(g, 'allies', '17835#1', '17835')
	const log = logsSince(g, () => rules.action(g, 'Allies', 'pass_response', {}))
	ok('未被"战斗结算中"挡下', !/战斗结算中/.test(log), log)
}

console.log('\n[死锁 3] 两者并存 -> 修复后必须【双向都有出路】')
{
	/* 3-A：先结算战斗 —— 不应被响应守卫挡（修复前会被"响应结算中"挡死） */
	{
		const { g, suSp } = board()
		setSovietPendingBattle(g, suSp, 'kv2_ask')
		pushPendingResponse(g, 'allies', '17835#1', '17835')
		const log = logsSince(g, () => rules.action(g, 'Allies', 'resolve_battle', {}))
		console.log('    先 resolve_battle ->', log)
		ok('resolve_battle 未被"响应结算中"挡下', !/响应结算中/.test(log))
		ok('战斗确实结算了', /进行战斗|移除/.test(log))
	}

	/* 3-B：先处理响应 —— 不应被战斗守卫挡（修复前会被"战斗结算中"挡死） */
	{
		const { g, suSp } = board()
		setSovietPendingBattle(g, suSp, 'kv2_ask')
		pushPendingResponse(g, 'allies', '17835#1', '17835')
		const log = logsSince(g, () => rules.action(g, 'Allies', 'trigger_response', {}))
		console.log('    先 trigger_response ->', log)
		ok('trigger_response 未被"战斗结算中"挡下', !/战斗结算中/.test(log))
	}

	/* 3-C：放弃响应也应照常可用（不因并存而失效） */
	{
		const { g, suSp } = board()
		setSovietPendingBattle(g, suSp, 'kv2_ask')
		pushPendingResponse(g, 'allies', '17835#1', '17835')
		const log = logsSince(g, () => rules.action(g, 'Allies', 'pass_response', {}))
		console.log('    先 pass_response ->', log)
		ok('pass_response 未被"战斗结算中"挡下', !/战斗结算中/.test(log))
	}

	/*
	 * 3-D：UI 与服务端一致 —— 并存时动作表必须【同时】给出战斗表态与响应表态。
	 * （这一步靠"乙·UI 与服务端一致"修复；若这里失败说明 UI 仍会让玩家点了没反应。）
	 */
	{
		const { g, suSp } = board()
		setSovietPendingBattle(g, suSp, 'kv2_ask')
		pushPendingResponse(g, 'allies', '17835#1', '17835')
		const v = rules.view(g, 'Allies')
		console.log('    actions =', JSON.stringify(v.actions))
		ok('动作表同时含 resolve_battle 与响应表态（乙的验收点）',
			!!v.actions['resolve_battle'] &&
			!!v.actions['trigger_response'] && !!v.actions['pass_response'])
	}
}

console.log('\n[入口 4] 响应挂起期间，哪些动作仍能穿过守卫（= 可能建立新战斗挂起）')
{
	const { g } = board()
	pushPendingResponse(g, 'allies', '17835#1', '17835')

	const lCard = logsSince(g, () => rules.action(g, 'Allies', 'play_card', { card: '15310#1' }))
	ok('play_card 被挡（安全）', /响应结算中/.test(lCard), lCard)

	const lStatus = logsSince(g, () => rules.action(g, 'Allies', 'activate_status', { card: 'no-such#1' }))
	ok('activate_status【不被守卫挡】-> 是可达入口',
		!/响应结算中/.test(lStatus), lStatus)

	const lArmed = logsSince(g, () => rules.action(g, 'Allies', 'use_armed_offer', { card: 'no-such#1' }))
	ok('use_armed_offer【不被守卫挡】-> 是可达入口',
		!/响应结算中/.test(lArmed), lArmed)
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
