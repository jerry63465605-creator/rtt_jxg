/*
 * 预算/多步挂起的动作门禁回归（2026-10-25）。
 *
 * 覆盖两个"只有前端白名单、后端不冻结"的挂起：
 *   · 17851 天王星行动 → event_budget（发起战斗期间还能打牌/推阶段）
 *   · 17852 罗科索夫斯基 → pending_status_play（选状态卡期间可被绕过）
 *
 * 断言口径：
 *   · 客户端：view.actions 里不该出现 play_card / next_phase
 *   · 服务端：直接提交被拒，且日志给出原因
 *   · 插队窗口必须仍放行：event_battle / event_finish / activate_status
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const data = I.data
const { CARDS } = require(path.join(__dirname, '..', 'cards.js'))

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }
const ALLOWED_BUDGET_MSG = /战斗预算进行中/
const STATUS_PLAY_MSG = /等待选择状态卡中/

/* ---------- 17851：进入战斗预算 ---------- */
function makeBudget() {
	const g = rules.setup(9911, rules.default_scenario, {})
	g.opening = null
	g.turn_phase = 'play'
	g.active = 'allies'
	g.current_nation = '苏联'
	/* 苏联默认中立，无法对德国发起战斗；先参战，否则 event_battle 打不出来 */
	I.end_neutral(g, '苏联', '测试：直接参战')

	/* 清空苏联部队，摆 2 支到乌克兰相邻陆地 */
	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] === '苏联') delete g.location[p]
	}
	const uk = data.id_of('乌克兰')
	const nb = (data.spaces[uk].connections || [])
		.filter(id => data.spaces[id] && data.spaces[id].terrain === 'land')
	/* 优先放大本营莫斯科 / 罗斯（保证在补给链上，uranus_count 才数得到） */
	let n = 0
	const prefer = ['莫斯科', '罗斯'].map(x => data.id_of(x)).filter(x => x != null && nb.indexOf(x) >= 0)
	for (const sp of prefer.concat(nb)) {
		if (n >= 2) break
		const pid = 'pS' + (n + 1)
		g.location[pid] = sp
		g.piece_nation[pid] = '苏联'
		g.piece_type[pid] = 'army'
		n++
	}
	/* 乌克兰本格放一支德国陆军，保证有合法攻击目标 */
	g.location['pDE'] = uk
	g.piece_nation['pDE'] = '德国'
	g.piece_type['pDE'] = 'army'
	I.compute_supply(g)

	const other = CARDS.find(c => c.nation === '苏联' && c.type === 'EVENT' && String(c.id) !== '17851')
	g.hands['苏联'] = ['17851#1', String(other.id) + '#1']
	g._other_card = String(other.id) + '#1'

	const r1 = rules.action(g, 'Allies', 'play_card', { card: '17851#1' })
	const r2 = rules.action(r1, 'Allies', 'uranus_choice', { choice: 'battle' })
	r2._other_card = g._other_card
	return r2
}

section('A 17851 进入预算后：动作表必须收窄')
{
	const g = makeBudget()
	ok('A0 event_budget 已建立', !!g.event_budget && g.event_budget.source === 'uranus',
		g.event_budget && g.event_budget.source)
	ok('A0b pending_uranus 已清', !g.pending_uranus)
	const v = rules.view(g, 'Allies')
	ok('A1 play_card 不在白名单', !(v.actions && v.actions.play_card), v.actions)
	ok('A2 next_phase 不在白名单', !(v.actions && v.actions.next_phase), v.actions)
	ok('A3 discard_in_discard_phase 不在白名单', !(v.actions && v.actions.discard_in_discard_phase), v.actions)
	ok('A4 event_battle 在白名单', !!(v.actions && v.actions.event_battle), v.actions)
	ok('A5 event_finish 在白名单', !!(v.actions && v.actions.event_finish), v.actions)
	ok('A6 block_reason 指明预算', /event_budget/.test(v.block_reason || ''), v.block_reason)
}

section('B 17851 预算期间：服务端必须拦截非预算动作')
{
	const g = makeBudget()
	const r = rules.action(g, 'Allies', 'play_card', { card: g._other_card })
	ok('B1 play_card 被拒', (r.log || []).some(l => ALLOWED_BUDGET_MSG.test(l)), (r.log || []).slice(-1))
	ok('B2 第二张仍在手牌', (r.hands['苏联'] || []).indexOf(g._other_card) >= 0)
	ok('B3 预算仍保留', !!r.event_budget)

	const phaseBefore = g.turn_phase
	const r2 = rules.action(g, 'Allies', 'next_phase', {})
	ok('B4 next_phase 被拒', (r2.log || []).slice(-2).some(l => ALLOWED_BUDGET_MSG.test(l)),
		(r2.log || []).slice(-2))
	ok('B5 阶段未变', r2.turn_phase === phaseBefore, phaseBefore + ' -> ' + r2.turn_phase)

	const r3 = rules.action(g, 'Allies', 'discard_one', { card: (r.hands['苏联'] || [])[0] })
	ok('B6 discard_one 被拒', (r3.log || []).some(l => ALLOWED_BUDGET_MSG.test(l)))
}

section('C 17851 预算期间：插队窗口必须仍放行')
{
	const g = makeBudget()
	/* event_battle 放行（不出现门禁日志即可，目标合法性另行校验） */
	const r = rules.action(g, 'Allies', 'event_battle', { target: data.id_of('乌克兰'), from: 'pS1' })
	ok('C1 event_battle 未被门禁拦截',
		!(r.log || []).slice(-1).some(l => ALLOWED_BUDGET_MSG.test(l)), (r.log || []).slice(-1))

	/* event_finish 放行：source='uranus' 应重建 pending_uranus */
	const r2 = rules.action(g, 'Allies', 'event_finish', {})
	ok('C2 event_finish 未被门禁拦截',
		!(r2.log || []).slice(-1).some(l => ALLOWED_BUDGET_MSG.test(l)), (r2.log || []).slice(-1))
	ok('C3 预算已结束', !r2.event_budget)
	ok('C4 天王星菜单按剩余次数重建', !!r2.pending_uranus, r2.pending_uranus)
}

section('D 17852 挂起期间：服务端必须冻结 play_card / next_phase')
{
	const g = rules.setup(9912, rules.default_scenario, {})
	g.opening = null
	g.turn_phase = 'play'
	g.active = 'allies'
	g.current_nation = '苏联'
	const other = CARDS.find(c => c.nation === '苏联' && c.type === 'EVENT' && String(c.id) !== '17852')
	const st = (CARDS.find(c => c.nation === '苏联' && c.type === 'STATUS') || {}).id
	g.hands['苏联'] = ['17852#1', String(other.id) + '#1', String(st) + '#1']

	const r1 = rules.action(g, 'Allies', 'play_card', { card: '17852#1' })
	ok('D0 pending_status_play 已建立', !!r1.pending_status_play)

	const v = rules.view(r1, 'Allies')
	ok('D1 play_card 不在白名单', !(v.actions && v.actions.play_card), v.actions)
	ok('D2 su_status_play 在白名单', !!(v.actions && v.actions.su_status_play), v.actions)

	const r2 = rules.action(r1, 'Allies', 'play_card', { card: String(other.id) + '#1' })
	ok('D3 play_card 被拒', (r2.log || []).some(l => STATUS_PLAY_MSG.test(l)), (r2.log || []).slice(-1))

	const phaseBefore = r1.turn_phase
	const r3 = rules.action(r1, 'Allies', 'next_phase', {})
	ok('D4 next_phase 被拒', (r3.log || []).slice(-2).some(l => STATUS_PLAY_MSG.test(l)),
		(r3.log || []).slice(-2))
	ok('D5 阶段未变', r3.turn_phase === phaseBefore, phaseBefore + ' -> ' + r3.turn_phase)
	ok('D6 挂起仍在', !!r3.pending_status_play)

	/* 自身出口必须放行 */
	const r4 = rules.action(r1, 'Allies', 'su_status_skip', {})
	ok('D7 su_status_skip 放行（挂起清除）', !r4.pending_status_play)
}

section('E 17852：su_status_play 正常打出状态卡')
{
	const g = rules.setup(9913, rules.default_scenario, {})
	g.opening = null
	g.turn_phase = 'play'
	g.active = 'allies'
	g.current_nation = '苏联'
	const st = (CARDS.find(c => c.nation === '苏联' && c.type === 'STATUS') || {}).id
	g.hands['苏联'] = ['17852#1', String(st) + '#1']
	const r1 = rules.action(g, 'Allies', 'play_card', { card: '17852#1' })
	const r2 = rules.action(r1, 'Allies', 'su_status_play', { cards: [String(st) + '#1'] })
	ok('E1 未被门禁拦截', !(r2.log || []).slice(-1).some(l => STATUS_PLAY_MSG.test(l)),
		(r2.log || []).slice(-1))
	ok('E2 剩余次数递减', (r2.pending_status_play || {}).remaining === 1,
		r2.pending_status_play)
}

console.log('\n' + '='.repeat(46))
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) {
	console.log('失败项：\n  ' + fails.join('\n  '))
	process.exit(1)
}
console.log('ALL PASS')
