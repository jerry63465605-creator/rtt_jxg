/*
 * 回归：17732《德国军事顾问》借用框的可见性 + ask_box 抢占（2026-10-23）
 *
 * 现场症状（玩家截图）：
 *   顶部横幅「响应卡结算中：请决定是否发动《破译恩尼格码》」，
 *   底部却显示「德国军事顾问：已借用《闪电战》/ 激活《闪电战》」，
 *   而【发动 / 不发动】按钮完全不见 —— 玩家无处可点，对局卡死。
 *
 * 根因（两处叠加）：
 *   ① 服务端 view.italy_borrow 不判 side -> 对手（英国/同盟）也收到，
 *      客户端于是在【对手界面】渲染意大利的借用框
 *   ② 客户端 update_italy_borrow_box 在 update_pending_trigger_box 之后调用，
 *      而又无条件 render_ask_box -> 把「是否发动《破译恩尼格码》」的按钮盖掉
 *
 * 修法：
 *   · 服务端：italy_borrow 只发给借用方所在阵营
 *   · 客户端：update_italy_borrow_box 在 pending_trigger / response_choice 存在时让位
 *   · 客户端：update_map 末尾再调一次 update_pending_trigger_box（永久兜底，保证最上层）
 *
 * 用法：node tools/_smoke_17732_borrow_visibility.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

const PLAY_SRC = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

function base() {
	const g = rules.setup(1201, rules.default_scenario, {})
	g.opening = null
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.turn_phase = 'play'
	return g
}

console.log('=== A. 已借用（pending=false）：只发给借用方阵营 ===')
{
	const g = base()
	g.table['德国'] = ['15253#1']
	g.italy_borrow = { card_face: '15253#1', nation: '意大利', turn: g.turn, pending: false }

	const axis = rules.view(g, 'Axis')
	const allies = rules.view(g, 'Allies')
	ok('轴心能看到 italy_borrow', !!axis.italy_borrow)
	ok('轴心看到的是《闪电战》', axis.italy_borrow && /闪电战/.test(axis.italy_borrow.name || ''),
		axis.italy_borrow && axis.italy_borrow.name)
	ok('同盟【看不到】italy_borrow（关键修复）', allies.italy_borrow === null,
		JSON.stringify(allies.italy_borrow))
}

console.log('\n=== B. 待选（pending=true）：同样只发给借用方阵营 ===')
{
	const g = base()
	g.table['德国'] = ['15253#1', '15346#1']
	g.italy_borrow = { pending: true, nation: '意大利', options: ['15253#1', '15346#1'], turn: g.turn }

	const axis = rules.view(g, 'Axis')
	const allies = rules.view(g, 'Allies')
	ok('轴心能看到待选列表', !!(axis.italy_borrow && axis.italy_borrow.pending))
	ok('轴心候选 = 2', axis.italy_borrow && (axis.italy_borrow.options || []).length === 2,
		axis.italy_borrow && (axis.italy_borrow.options || []).length)
	ok('同盟【看不到】待选列表', allies.italy_borrow === null)
}

console.log('\n=== C. 客户端：借用框让位 + 末尾兜底重绘 ===')
{
	ok('update_italy_borrow_box 有让位守卫',
		/if \(view\.pending_trigger \|\| view\.response_choice\) return/.test(PLAY_SRC))
	ok('update_map 末尾调用 update_pending_trigger_box（兜底）',
		/reapply_all_highlights\(\)[\s\S]{0,900}?update_pending_trigger_box\(\)\s*\n\}/.test(PLAY_SRC))
}

console.log('\n=== D. 响应卡决策框本身仍正常（pending_trigger 按 side 裁剪） ===')
{
	const g = base()
	/* 压一帧响应栈：栈顶归同盟（英国持有 15328） */
	g.response_queue = [{
		card_id: '15328#1', card_face: '15328', name: '破译恩尼格码',
		owner_side: 'allies', on: 'status_attacked', pre: false,
		candidates: [{ card_id: '15328#1', card_face: '15328', name: '破译恩尼格码' }],
	}]
	const allies = rules.view(g, 'Allies')
	const axis = rules.view(g, 'Axis')
	ok('同盟看到 pending_trigger', !!allies.pending_trigger)
	ok('同盟看到候选《破译恩尼格码》',
		!!(allies.pending_trigger && (allies.pending_trigger.candidates || []).some(c => /恩尼格码/.test(c.name || ''))),
		JSON.stringify(allies.pending_trigger && allies.pending_trigger.candidates))
	ok('轴心看到的是"等待"而非自己的 pending_trigger', axis.pending_trigger === null)
	ok('轴心的 prompt 是等待文案', /等待/.test(axis.prompt || ''), (axis.prompt || '').slice(0, 40))
	ok('pending_trigger 存在时不发 response_choice（否则客户端会早退）',
		allies.response_choice === null, JSON.stringify(allies.response_choice))
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
