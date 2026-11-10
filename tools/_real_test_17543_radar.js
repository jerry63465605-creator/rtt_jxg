/*
 * #7 雷达 17543 —— 立刻窗口的排他询问回归（真实栈帧版）
 *
 * 【2026-11-11 重写：修掉假绿】
 * 旧版手工塞 g.response_queue = [{...}]（只是 response_stack 的派生只读视图，
 * 栈为空），于是 build_actions_inner 不进响应帧分支，register_status_actions
 * 得以执行 -> 4 项全绿。但真实对局里压的是【response_stack 帧】，那个分支会
 * 提前 return，activate_status 根本不在白名单 —— 玩家点了静默不发（#7 假绿）。
 *
 * 现在改为：暗置真实响应卡 + R.action 真实驱动，断言"真栈帧存在时"
 * 雷达仍由 pending_status_ask 排他挂起接管，且两个答复动作都在白名单。
 * 详细的 57 项矩阵见 tools/_real_test_17543_radar_pause.js。
 *
 * 用法：node tools/_real_test_17543_radar.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const JP = d.id_of('东海'), US = d.id_of('中太平洋')

function toTable(g, face, nation) {
	const inst = (g.hands[nation] || []).find(x => faceOf(x) === String(face))
	if (!inst) return null
	g.hands[nation] = (g.hands[nation] || []).filter(x => x !== inst)
	g.table[nation] = (g.table[nation] || []).concat([inst])
	I.refresh(g)
	return inst
}

/** 真实盘面 + 真实响应栈帧（暗置 15428/15438），不手填任何 queue */
function scene() {
	const g = new_board(20261108, { nation: '日本', phase: 'play' })
	clear_pending(g)
	g.current_nation = '日本'; g.active = 'Axis'
	place(g, 'jp_nv', '日本', 'navy', d.name_of(JP))
	place(g, 'us_nv', '美国', 'navy', d.name_of(US))
	I.grant_supply(g, 'jp_nv', g.turn || 1)
	I.set_supply_point(g, JP, 'axis', true)
	I.refresh(g); I.compute_supply(g)
	give(g, '17543', '美国'); I.refresh(g)
	const radar = toTable(g, '17543', '美国')
	for (const f of ['15428', '15438'])
		g.table_responses.push({ card_id: f, owner_side: 'axis', nation: '日本' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	return { g, radar }
}

function drive(g) {
	for (let i = 0; i < 10; i++) {
		if (g.pending_status_ask) return true
		const vx = R.view(g, 'Axis'), va = R.view(g, 'Allies')
		const ax = Object.keys(vx.actions || {}), al = Object.keys(va.actions || {})
		const pt = vx.pending_trigger || va.pending_trigger
		if (ax.indexOf('response_confirm') >= 0 && pt && !pt.ordered && (pt.candidates || []).length > 1) {
			R.action(g, 'Axis', 'response_confirm', { order: pt.candidates.map(c => c.card_id) }); continue
		}
		const role = ax.indexOf('resolve_response_choice') >= 0 ? 'Axis'
			: (al.indexOf('resolve_response_choice') >= 0 ? 'Allies' : null)
		if (role) {
			const c = (R.view(g, role).response_choice || {}).candidates || []
			const pick = c.find(x => Number(x.id) === Number(US)) || c[0]
			if (!pick) break
			R.action(g, role, 'resolve_response_choice', { choice: pick.id }); continue
		}
		if (ax.indexOf('trigger_response') >= 0) { R.action(g, 'Axis', 'trigger_response', {}); continue }
		break
	}
	return !!g.pending_status_ask
}

console.log('\n=== 真实响应栈帧下的雷达立即询问 ===')
{
	const { g, radar } = scene()
	ok('S0 建盘后已有真实 response_stack 帧', (g.response_stack || []).length > 0)
	ok('S1 真实 action 驱动到雷达挂起', drive(g))
	const acts = Object.keys(R.view(g, 'Allies').actions || {})
	ok('★★ S2 真栈帧下 view(Allies).actions 含 activate_status（不再是假绿）',
		acts.indexOf('activate_status') >= 0, JSON.stringify(acts))
	ok('S3 同时含 skip_status_ask（必须回答的出口）',
		acts.indexOf('skip_status_ask') >= 0)
	const deck0 = (g.decks['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: radar })
	const lg = logSince(g, n0)
	ok('★★ S4 真发 activate_status 能结算（损耗2 + 还原海军）',
		(g.decks['美国'] || []).length <= deck0 - 2 && /雷达|还原/.test(lg), lg.slice(0, 140))
	ok('S5 发动后挂起清除，响应链继续', !g.pending_status_ask && (g.response_stack || []).length > 0)
}

console.log('\n=== 对照：未武装窗口时不放行任何状态卡 ===')
{
	const g = new_board(20261108, { nation: '日本', phase: 'play' })
	clear_pending(g); g.current_nation = '日本'; g.active = 'Axis'
	place(g, 'jp_nv', '日本', 'navy', d.name_of(JP))
	I.refresh(g)
	give(g, '17543', '美国'); I.refresh(g)
	toTable(g, '17543', '美国')
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	ok('S6 无移除事件时没有 pending_status_ask', !g.pending_status_ask)
	ok('S7 无窗口时雷达桌面卡 ready=false',
		!(R.view(g, 'Allies').table_status || []).some(c => faceOf(c.card) === '17543' && c.ready))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
