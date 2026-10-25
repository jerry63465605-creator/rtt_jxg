/*
 * 复现：17737《以逸待劳》发动时点仍为同盟，轴心无法点「发动/不发动」→ 卡死
 *
 * 场景（真实引擎路径）：
 *   同盟国（英国）在<意大利>相邻地区【征召陆军】→ recruit_piece 派发 'recruit'
 *   → 意大利桌面暗置的 17737 filter 命中 → request_responses 压栈 + 让权给 AXIS
 *
 * 断言：
 *   ① 压栈后 g.active 应为 'Axis'（让权成功）
 *   ② view(Axis).actions 应含 trigger_response / pass_response
 *   ③ rules.action(g,'Axis','pass_response',{}) 应清空栈并把 active 还给 Allies
 *
 * 用法：node tools/_repro_17737.js
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

/* 找与意大利相邻的陆地空格（17737 的 filter 要求 space_is_or_adjacent_to 意大利） */
function adjLandOf(space, side) {
	const conns = I.get_connections(null, space, I.faction_of_nation('意大利')).map(Number)
	return conns
}

const g = rules.setup(1)
/* setup 后处于初始弃牌阶段（game.opening），先跳过，进入正常回合 */
g.opening = null
g.turn = 2
g.turn_phase = 'play'
I.ensure_markers(g)

const italySp = I.space_id_of('意大利')
ok('意大利 space 可解析', italySp != null, 'id=' + italySp)

/* 意大利相邻陆地（用真实连通表，且必须是陆地、可征召） */
const conns = (I.get_connections(g, italySp, 'axis') || []).map(Number)
const cand = conns.filter(sp => d.spaces[sp] && d.spaces[sp].terrain === 'land' && sp !== italySp)
console.log('意大利相邻陆地候选：', cand.map(sp => sp + ':' + d.name_of(sp)).join(', '))

/* 同盟回合：英国征召陆军 */
g.current_nation = '英国'
g.active = 'Allies'

/* 意大利桌面暗置 17737 */
g.table_responses = [{ card_id: '17737#1', owner_side: 'axis', nation: '意大利' }]

let target = null
for (const sp of cand) {
	const r = I.recruit_piece(g, '英国', 'army', sp)
	if (r && r.ok) { target = sp; break }
}
ok('英国在意大利相邻地区征召陆军成功（触发点）', target != null,
	target != null ? d.name_of(target) : '所有相邻陆地都不可征召')

function dump(tag) {
	console.log('\n--- ' + tag + ' ---')
	console.log('active        =', g.active, '| current_nation =', g.current_nation)
	console.log('handoff_stack =', JSON.stringify(g.handoff_stack || []))
	console.log('_handoff_base =', g._handoff_base)
	console.log('response_stack=', (g.response_stack || []).length,
		JSON.stringify((g.response_stack || []).map(f => ({ card: f.card_id, side: f.owner_side, on: f.on }))))
	console.log('response_queue=', (g.response_queue || []).length)
	try {
		const vA = rules.view(g, 'Axis')
		console.log('view(Axis).actions        =', JSON.stringify(vA.actions))
		console.log('view(Axis).pending_trigger=', vA.pending_trigger
			? JSON.stringify({ owner: vA.pending_trigger.owner_side, n: (vA.pending_trigger.candidates || []).length })
			: null)
		console.log('view(Axis).block_reason   =', vA.block_reason)
		console.log('view(Axis).response_pending =', JSON.stringify(vA.response_pending))
	} catch (e) { console.log('view(Axis) 抛错：', e.message) }
	try {
		const vL = rules.view(g, 'Allies')
		console.log('view(Allies).actions      =', JSON.stringify(vL.actions))
		console.log('view(Allies).block_reason =', vL.block_reason)
	} catch (e) { console.log('view(Allies) 抛错：', e.message) }
}

dump('征召后（触发瞬间）')

const vA = rules.view(g, 'Axis')
ok('① 让权：active 应已翻到 Axis', g.active === 'Axis', 'active=' + g.active)
ok('② 轴心视角含 trigger_response', !!(vA.actions && vA.actions.trigger_response), JSON.stringify(vA.actions))
ok('② 轴心视角含 pass_response', !!(vA.actions && vA.actions.pass_response), JSON.stringify(vA.actions))
ok('② 轴心视角 pending_trigger 非空', !!vA.pending_trigger)

/* ③ 轴心点「不发动」 */
const before = (g.response_stack || []).length
rules.action(g, 'Axis', 'pass_response', {})
dump('轴心点「不发动」之后')
ok('③ pass_response 清空了响应栈', (g.response_stack || []).length === 0,
	'before=' + before + ' after=' + (g.response_stack || []).length)
ok('③ active 归还给 Allies', g.active === 'Allies', 'active=' + g.active)
ok('③ handoff_stack 已清空', !(g.handoff_stack || []).length, JSON.stringify(g.handoff_stack || []))

console.log('\n=== ' + (fails ? fails + ' 项失败' : '全部通过') + ' ===')
process.exit(fails ? 1 : 0)
