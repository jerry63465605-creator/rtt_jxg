/*
 * 批次 B 回归（2026-10-25）
 *   B1 KV-2 弃牌国：view.pending_battle.cost_nation + hands 可见性
 *   B2 响应窗口：非持有方冻结 + pending_trigger 读栈顶（不依赖派生缓存）
 *   B3 17821/17822：发起战斗须真实补给（配置去掉 grantSupply，battle 步不再强授）
 *
 * 用法：node tools/_smoke_batch_b.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let fails = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fails++
}
function fresh() {
	const g = rules.setup(1)
	g.opening = null
	g.turn = 2
	g.turn_phase = 'play'
	I.ensure_markers(g)
	g.table_responses = []
	return g
}
function put(g, nation, type, space) {
	const id = I.new_piece_id(g)
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	return id
}
function firstLand() {
	for (let i = 1; i < d.spaces.length; i++)
		if (d.spaces[i] && d.spaces[i].terrain === 'land') return i
	return null
}

/* ================= B1 ================= */
console.log('=== B1. KV-2 弃牌国 ===')
{
	const g = fresh()
	const land = firstLand()
	const suArmy = put(g, '苏联', 'army', land)
	const jpArmy = put(g, '日本', 'army', land + 1)
	/* 日本是攻击方，但 current_nation 设为德国（模拟"日本攻击、回合国不是日本"） */
	g.current_nation = '德国'
	g.active = 'Axis'
	g.pending_battle = {
		stage: 'kv2', space: land, kind: 'land',
		attacker: '日本', attacker_faction: 'axis', attacker_piece: jpArmy,
		victim: suArmy, victim_nation: '苏联', victim_type: 'army',
		defender: '苏联', defender_nation: '苏联',
		kv2_card: '17837#1', kv2_owner_nation: '苏联',
	}
	const v = rules.view(g, 'Axis')
	ok('view.pending_battle 已下发（轴心视角）', !!v.pending_battle)
	ok('cost_nation = 攻击方日本（不是 my_nation 德国）',
		v.pending_battle && v.pending_battle.cost_nation === '日本',
		v.pending_battle && v.pending_battle.cost_nation)
	ok('攻击国手牌可见（cards 非 null）',
		!!(v.hands['日本'] && v.hands['日本'].cards),
		v.hands['日本'] && (v.hands['日本'].cards ? 'cards×' + v.hands['日本'].cards.length : 'null'))
	ok('pending_battle 未被写入 state（浅拷贝）',
		game_cost_ok(g), g.pending_battle && g.pending_battle.cost_nation)

	function game_cost_ok(gg) { return gg.pending_battle.cost_nation === undefined }

	/* su_step_back：代价由苏联自己付 */
	g.pending_battle = {
		stage: 'su_step_back', space: land, kind: 'land',
		attacker: '日本', attacker_piece: jpArmy,
		victim: suArmy, victim_nation: '苏联', victim_type: 'army',
		defender: '苏联', defender_nation: '苏联',
		su_card: '17853#1', su_owner_nation: '苏联',
	}
	const v2 = rules.view(g, 'Allies')   /* 等待方是苏联（同盟），要看同盟视角 */
	ok('su_step_back 的 cost_nation = 苏联', v2.pending_battle && v2.pending_battle.cost_nation === '苏联',
		v2.pending_battle && v2.pending_battle.cost_nation)
}

/* ================= B2 ================= */
console.log('\n=== B2. 响应窗口 ===')
{
	const g = fresh()
	g.current_nation = '英国'
	g.active = 'Allies'
	put(g, '英国', 'army', firstLand())
	/* 意大利暗置 17737（以逸待劳），同盟征召触发 */
	g.table_responses = [{ card_id: '17737#1', owner_side: 'axis', nation: '意大利' }]
	const italy = I.space_id_of('意大利')
	const nb = (I.get_connections(g, italy, 'allies') || []).map(Number)
		.find(sp => d.spaces[sp] && d.spaces[sp].terrain === 'land' && sp !== italy)
	const r = I.recruit_piece(g, '英国', 'army', nb)
	ok('同盟在意大利相邻地区征召成功（触发点）', r && r.ok, nb != null ? d.name_of(nb) : 'no-space')

	const vA = rules.view(g, 'Axis')
	const vL = rules.view(g, 'Allies')
	ok('轴心 pending_trigger 非空', !!vA.pending_trigger)
	ok('轴心 actions 含 trigger/pass',
		!!(vA.actions && vA.actions.trigger_response && vA.actions.pass_response), JSON.stringify(vA.actions))
	ok('同盟被冻结（actions 只剩 log）',
		!vL.actions.play_card && !vL.actions.next_phase && vL.actions.log === 1, JSON.stringify(vL.actions))
	ok('同盟 block_reason 说明在等对方', /等待.*表态/.test(vL.block_reason || ''), vL.block_reason)
	ok('轴心 block_reason 说明待本方表态', /表态/.test(vA.block_reason || ''), vA.block_reason)

	/* 人为清空派生缓存（模拟漏 sync）：pending_trigger 仍应非空 */
	g.response_queue = []
	const vA2 = rules.view(g, 'Axis')
	ok('清空 response_queue 后仍弹框（读栈顶）', !!vA2.pending_trigger,
		vA2.pending_trigger ? 'ok' : 'null')

	/* 动作入口会按栈自愈重建 */
	rules.action(g, 'Axis', 'pass_response', {})
	ok('pass_response 能清空响应栈', (g.response_stack || []).length === 0)
	ok('active 归还 Allies', g.active === 'Allies', g.active)
	const vL2 = rules.view(g, 'Allies')
	ok('同盟恢复常规动作', !!(vL2.actions && vL2.actions.play_card), JSON.stringify(vL2.actions))
}

/* ================= B3 ================= */
console.log('\n=== B3. 17821/17822 补给 ===')
{
	const eff21 = I.EVENT_EFFECTS['17821']
	const eff22 = I.EVENT_EFFECTS['17822']
	const hasGrant = e => (e.steps || []).some(s => s.grantSupply)
	ok('17821 的 recruit 步已去掉 grantSupply', !hasGrant(eff21))
	ok('17822 的 recruit 步已去掉 grantSupply', !hasGrant(eff22))
	ok('17821 仍保留 battle(useNewPiece) 步',
		(eff21.steps || []).some(s => s.op === 'battle' && s.useNewPiece))
	ok('17821/17822 的 battle 步也不再声明 grantSupply',
		!(eff21.steps || []).concat(eff22.steps || []).some(s => s.op === 'battle' && s.grantSupply))
}

console.log('\n=== ' + (fails ? fails + ' 项失败' : '全部通过') + ' ===')
process.exit(fails ? 1 : 0)
