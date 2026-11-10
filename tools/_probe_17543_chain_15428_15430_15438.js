/*
 * 只读探针：玩家报障场景「15428 + 15430 + 15438 + 雷达」
 *
 * 玩家口径：响应链进行中要暂停，先挂起询问美国《雷达》，答完再继续响应链。
 *
 * 本探针不改任何产品代码。全程走真实引擎路径：
 *   · _board_lib.new_board 建真实盘面（含开局弃 3）
 *   · 暗置真实响应卡到 g.table_responses（owner_side 小写）
 *   · R.action 推进到日本出牌阶段，让 phase_play 真实派发 play_start
 *   · R.action 逐张 trigger_response / resolve_response_choice 驱动响应链
 *   · 每步打印 response_stack（真相源）、status_instant（雷达窗口）、
 *     view(Allies) 的 pending_trigger / table_status.ready / actions / waiting_for
 *
 * 用法：node tools/_probe_17543_chain_15428_15430_15438.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L

const JP_SEA = d.id_of('东海')
/* <夏威夷>是陆地，15438 的海战候选是「夏威夷或其相邻」中的海域 -> 中太平洋(28)。
 * 靶子（美国海军）必须放在真正会被打的海域，否则 piece_removed 不会发生。 */
const US_SEA = d.id_of('中太平洋')

function toTable(g, face, nation) {
	const inst = (g.hands[nation] || []).find(x => faceOf(x) === String(face))
	if (!inst) return null
	g.hands[nation] = (g.hands[nation] || []).filter(x => x !== inst)
	g.table[nation] = (g.table[nation] || []).concat([inst])
	I.refresh(g)
	return inst
}

function snap(g, tag) {
	const va = R.view(g, 'Allies')
	const vx = R.view(g, 'Axis')
	const ts = (va.table_status || []).find(x => faceOf(x.card) === '17543') || {}
	const frames = (g.response_stack || []).map(f =>
		(f.name || f.card_face) + '[' + f.owner_side + (f.pending ? ',pending' : '') +
		(f.skipped ? ',skip' : '') + ']')
	const inst = (g.status_instant || []).filter(e => faceOf(e.card_id) === '17543')
		.map(e => e.card_id + '@' + e.window)
	console.log('\n--- ' + tag + ' ---')
	console.log('  active=' + g.active + '  current_nation=' + g.current_nation +
		'  phase=' + g.turn_phase)
	console.log('  response_stack(自底向上) = [' + frames.join(' , ') + ']')
	console.log('  deferred = [' + (g.deferred_response_stack || []).map(f => f.name).join(' , ') + ']')
	console.log('  status_instant(雷达) = [' + inst.join(',') + ']')
	console.log('  last_piece_removed = ' + JSON.stringify(g.last_piece_removed || null))
	console.log('  view(Allies).pending_trigger = ' + (va.pending_trigger
		? '《' + (va.pending_trigger.candidates || []).map(c => c.name).join('》《') + '》 current=' + va.pending_trigger.current
		: 'null'))
	console.log('  view(Axis).pending_trigger   = ' + (vx.pending_trigger
		? '《' + (vx.pending_trigger.candidates || []).map(c => c.name).join('》《') + '》 current=' + vx.pending_trigger.current
		: 'null'))
	console.log('  view(Allies).response_choice = ' + (va.response_choice
		? va.response_choice.prompt + ' / 候选' + (va.response_choice.candidates || []).length
		: 'null'))
	console.log('  view(Allies).table_status[雷达].ready = ' + ts.ready +
		'  reason=' + (ts.ready_reason || ''))
	console.log('  view(Allies).actions 含 activate_status = ' +
		(Object.keys(va.actions || {}).indexOf('activate_status') >= 0))
	console.log('  view(Allies).waiting_for = ' + JSON.stringify(va.waiting_for || null))
	console.log('  view(Allies).block_reason = ' + (va.block_reason || g.block_reason || ''))
}

/* ================= 建盘 ================= */
const g = new_board(20261108, { nation: '日本', phase: 'play' })
clear_pending(g)
g.current_nation = '日本'
g.active = 'Axis'

/* 美国桌面：《雷达》 */
give(g, '17543', '美国')
I.refresh(g)
const radarCid = toTable(g, '17543', '美国')

/* 美国海军在<夏威夷>（将被移除的靶子）；日本海军在<东海>（可发起海战） */
place(g, 'us_nv', '美国', 'navy', d.name_of(US_SEA))
place(g, 'jp_nv', '日本', 'navy', d.name_of(JP_SEA))
I.grant_supply(g, 'jp_nv', g.turn || 1)
I.set_supply_point(g, JP_SEA, 'axis', true)
I.refresh(g)
I.compute_supply(g)

/* 暗置三张真实响应卡（owner_side 必须小写） */
for (const face of ['15428', '15430', '15438'])
	g.table_responses.push({ card_id: face, owner_side: 'axis', nation: '日本' })
I.refresh(g)

console.log('=== 初始布置 ===')
console.log('  雷达实例 = ' + radarCid)
console.log('  美国海军@夏威夷 = ' + JSON.stringify(I.pieces_on(g, US_SEA)))
console.log('  日本海军@东海   = ' + JSON.stringify(I.pieces_on(g, JP_SEA)))
console.log('  暗置响应卡 = ' + JSON.stringify(g.table_responses.map(r => r.card_id)))

/* ================= 真实进入出牌阶段（派发 play_start） ================= */
/* new_board 已经 go_phase 到 play；这里用真实 action 重进一次 play 以触发 phase_play */
R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
I.refresh(g)
snap(g, 'S0 出牌阶段开始后（play_start 已派发）')

/* ================= 逐张推动响应链 ================= */
/* 最多 12 步，按 view 给出的可用动作自动选择，不手写状态 */
const actsOf = side => Object.keys(R.view(g, side).actions || {})
for (let step = 1; step <= 12; step++) {
	const va = R.view(g, 'Allies')
	const vx = R.view(g, 'Axis')
	const pt = vx.pending_trigger || va.pending_trigger
	const rc = vx.response_choice || va.response_choice
	const axActs = actsOf('Axis')
	const alActs = actsOf('Allies')

	if (axActs.indexOf('response_confirm') >= 0 && pt && !pt.ordered &&
		(pt.candidates || []).length > 1) {
		R.action(g, 'Axis', 'response_confirm', { order: (pt.candidates || []).map(c => c.card_id) })
		snap(g, 'S' + step + ' 确认同组响应顺序')
		continue
	}
	if (rc && (axActs.indexOf('resolve_response_choice') >= 0 ||
		alActs.indexOf('resolve_response_choice') >= 0)) {
		const role = axActs.indexOf('resolve_response_choice') >= 0 ? 'Axis' : 'Allies'
		const v = R.view(g, role)
		const cands = (v.response_choice || {}).candidates || []
		/* 选<夏威夷>：让海战打掉美国海军，触发 piece_removed */
		const pick = cands.find(c => Number(c.id) === Number(US_SEA)) || cands[0]
		if (!pick) { snap(g, 'S' + step + ' 无候选，停'); break }
		R.action(g, role, 'resolve_response_choice', { choice: pick.id })
		snap(g, 'S' + step + ' 选目标 ' + pick.id + ':' + (pick.name || ''))
		continue
	}
	if (axActs.indexOf('trigger_response') >= 0) {
		R.action(g, 'Axis', 'trigger_response', {})
		snap(g, 'S' + step + ' 轴心发动响应')
		continue
	}
	/* ★ 关键检查点：此时若雷达窗口已武装，看美国有没有被"挂起询问" */
	const inst = (g.status_instant || []).some(e => faceOf(e.card_id) === '17543')
	if (inst) {
		console.log('\n=== ★ 雷达窗口已武装的时刻：检查是否"挂起询问美国" ===')
		console.log('  view(Allies) 是否有专属挂起字段 = ' +
			JSON.stringify(Object.keys(va).filter(k => /pending|waiting|ask/.test(k))
				.map(k => k + '=' + (va[k] ? 'set' : 'null'))))
		console.log('  响应链是否仍在推进（栈顶归谁） = ' +
			JSON.stringify((g.response_stack || []).map(f => f.name + ':' + f.owner_side)))
		console.log('  view(Allies).waiting_for = ' + JSON.stringify(va.waiting_for || null))
	}
	snap(g, 'S' + step + ' 无可推进动作，停')
	break
}

console.log('\n=== 结论 ===')
console.log('  看「★ 雷达窗口已武装的时刻」：是否有跨阵营"挂起询问美国"的字段/让权；')
console.log('  若没有，且响应链继续由轴心推进 → 坐实玩家报障「没有立刻挂起给美国」。')
