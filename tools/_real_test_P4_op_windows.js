/*
 * 【D1/P4】统一分步窗口编号真实测试（真实 R.setup / R.action / R.view）
 * 手法：只用工具摆好 op_window 挂起这个初始局面，答复一律走真实 action 派发，
 *      不手写状态替代引擎结算。用法：node tools/_real_test_P4_op_windows.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started() {
	const g = R.setup(20261112, 'Episode 2')
	let guard = 0
	while (g.opening && guard++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
/* 只摆挂起的初始局面；后续全部走 R.action */
function putWindow(g, w) {
	g.prelude.op_window = Object.assign({
		nation: g.current_nation, owner: g.current_nation,
		seg: null, pendingOps: [], desc: '测试窗口',
	}, w)
	return g.prelude.op_window
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

console.log('=== A. 状态层与双门禁 ===')
{
	const g = started()
	ok('★★ op_window / reserves / extra_action 已在初始状态显式声明',
		'op_window' in g.prelude && 'reserves' in g.prelude &&
		'extra_action' in g.prelude, J(Object.keys(g.prelude)))
	putWindow(g, { kind: 'choice', candidates: [{ id: 'top', name: 'A' }, { id: 'bottom', name: 'B' }],
		op: { op: 'peek_reorder', n: 3 } })
	const ownSide = g.active
	const foeSide = ownSide === 'Axis' ? 'Allies' : 'Axis'
	const vOwn = R.view(g, ownSide), vFoe = R.view(g, foeSide)
	ok('★★ build_actions 只给答复方 prelude_op_pick / prelude_op_skip',
		!!(vOwn.actions.prelude_op_pick && vOwn.actions.prelude_op_skip) &&
		!vFoe.actions.prelude_op_pick, J(Object.keys(vOwn.actions).filter(k => k.indexOf('prelude_') === 0)))
	ok('★★ view 候选只给答复方，对手仅见 waiting',
		Array.isArray(vOwn.prelude.op_window.candidates) &&
		vFoe.prelude.op_window.waiting === g.current_nation,
		J(vFoe.prelude.op_window))
	ok('★ block_reason 说明等待谁', /前奏：等待/.test(vOwn.block_reason || ''),
		vOwn.block_reason)
	const n0 = g.log.length
	R.action(g, foeSide, 'prelude_op_pick', { pick: 'top' })
	ok('★★ 非答复方动作被拒、窗口保留', !!g.prelude.op_window &&
		/只有【/.test(logSince(g, n0)), logSince(g, n0).slice(0, 160))
	ok('★ 挂起能 JSON 往返（跨 action 落盘）', (() => {
		const copy = JSON.parse(JSON.stringify(g.prelude.op_window))
		return Array.isArray(copy.candidates) && copy.op && copy.op.op === 'peek_reorder'
	})())
}

console.log('\n=== B. choice 窗口：peek_reorder 置于牌堆底 ===')
{
	const g = started()
	const n = g.current_nation
	const before = (g.prelude.decks[n] || []).slice(0, 3)
	putWindow(g, { kind: 'choice', candidates: [{ id: 'top', name: '顶' }, { id: 'bottom', name: '底' }],
		op: { op: 'peek_reorder', n: 3 }, seg: { refs: [], steps: [] } })
	const n0 = g.log.length
	R.action(g, g.active, 'prelude_op_pick', { pick: 'bottom' })
	ok('★★ 答复后窗口清空、日志含移到牌堆底', !g.prelude.op_window &&
		/移到牌堆底/.test(logSince(g, n0)), logSince(g, n0).slice(0, 240))
	const after = g.prelude.decks[n] || []
	ok('★★ 牌堆顶 3 张确实移到了末尾',
		before.length === 3 && after.slice(-3).every((x, i) => x === before[i]),
		J({ before: before, tail: after.slice(-3) }))
	ok('★ 窗口答完自动进入卡牌阶段', g.prelude.phase === 'prelude_cards', g.prelude.phase)
}

console.log('\n=== C. card 窗口：peek_and_play 打出所选牌 ===')
{
	const g = started()
	const n = g.current_nation
	const pick = (g.prelude.decks[n] || [])[0]
	putWindow(g, { kind: 'card', candidates: [{ id: pick, name: '所选前奏牌' }],
		op: { op: 'peek_and_play', n: 1 }, seg: { refs: [], steps: [] } })
	const n0 = g.log.length
	R.action(g, g.active, 'prelude_op_pick', { pick: pick })
	/* 【D1/P16】打出的卡若含「打出 1 张前奏手牌」，会连锁开选牌窗口；逐层答完 */
	let guard = 0
	while (g.prelude.op_window && guard++ < 5) {
		const ow = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
		const cand = ow && (g.prelude.op_window.candidates || [])[0]
		if (!cand) break
		R.action(g, ow, 'prelude_op_pick', { pick: cand.id })
	}
	ok('★★ 所选牌从牌堆移除并打出', !g.prelude.op_window &&
		(g.prelude.decks[n] || []).indexOf(pick) < 0 &&
		/打出前奏牌/.test(logSince(g, n0)), logSince(g, n0).slice(0, 240))
	ok('★ 打出的牌进弃牌堆', (g.prelude.discard[n] || []).indexOf(pick) >= 0)
}

console.log('\n=== D. piece / space 窗口答复走现成原子 ===')
{
	const g = started()
	/* 摆一个敌方部队在合法陆地格，候选由窗口给出（模拟服务端已算好的候选） */
	const d = require(path.join(MOD, 'data.js')).data
	const sp = d.id_of('东欧')
	const foe = g.active === 'Axis' ? '英国' : '德国'
	g.location['p4_foe'] = sp
	g.piece_nation['p4_foe'] = foe
	g.piece_type['p4_foe'] = 'army'
	R._internal.refresh(g)
	putWindow(g, { kind: 'piece', candidates: [{ id: 'p4_foe', name: '东欧 · 敌方陆军' }],
		op: { op: 'battle', kind: '陆战', n: 1 }, seg: { refs: [], steps: [] } })
	const n0 = g.log.length
	R.action(g, g.active, 'prelude_op_pick', { pick: 'p4_foe' })
	ok('★★ battle 候选由玩家点选、答复后调 do_battle 原子',
		!g.prelude.op_window && /发起陆战/.test(logSince(g, n0)),
		logSince(g, n0).slice(0, 260))
	const g2 = started()
	putWindow(g2, { kind: 'space', candidates: [{ id: sp, name: d.name_of(sp) }],
		op: { op: 'deploy_air', n: 1 }, seg: { refs: [], steps: [] } })
	const n2 = g2.log.length
	R.action(g2, g2.active, 'prelude_op_pick', { pick: sp })
	ok('★★ deploy_air 候选由玩家选地区、答复后调 build_piece',
		!g2.prelude.op_window && /部署/.test(logSince(g2, n2)),
		logSince(g2, n2).slice(0, 240))
}

console.log('\n=== E. ops 排队续跑 + 放弃出口 ===')
{
	const g = started()
	putWindow(g, { kind: 'choice', candidates: [{ id: 'skip', name: '跳过' }],
		op: { op: 'choice_attrition_or_skip', n: 1 }, seg: { refs: [], steps: [] },
		pendingOps: [{ op: 'add_reserve', n: 2, type: '陆军' }] })
	R.action(g, g.active, 'prelude_op_pick', { pick: 'skip' })
	ok('★★ 答完首个窗口后续排 ops 继续执行（后备 +2）',
		!g.prelude.op_window && (g.prelude.reserves[g.current_nation] || 0) === 2,
		J({ win: g.prelude.op_window, reserves: g.prelude.reserves }))
	const g2 = started()
	putWindow(g2, { kind: 'choice', candidates: [{ id: 'skip', name: '跳过' }],
		op: { op: 'choice_attrition_or_skip', n: 1 }, seg: { refs: [], steps: [] } })
	const n2 = g2.log.length
	R.action(g2, g2.active, 'prelude_op_skip', {})
	ok('★★ 「放弃」有明确出口：窗口清空 + 日志', !g2.prelude.op_window &&
		/放弃 op/.test(logSince(g2, n2)), logSoon(g2, n2))
}
function logSoon(g, n) { return logSince(g, n).slice(0, 200) }

console.log('\n=== F. 无窗口 op 与额外行动阶段 ===')
{
	const g = started()
	const n = g.current_nation
	putWindow(g, { kind: 'choice', candidates: [{ id: 'skip', name: '跳过' }],
		op: { op: 'choice_attrition_or_skip', n: 1 }, seg: { refs: [], steps: [] },
		pendingOps: [
			{ op: 'add_reserve', n: 1, type: '陆军' },
			{ op: 'execute_action_phase', n: 1 },
		] })
	const n0 = g.log.length
	R.action(g, g.active, 'prelude_op_pick', { pick: 'skip' })
	/* 排队 ops 跑完后 prelude_advance 会【立即消耗】一次额外机会并留在 ACTION */
	ok('★ add_reserve 接线 + execute_action_phase 已触发额外行动阶段',
		(g.prelude.reserves[n] || 0) === 1 &&
		/额外的行动阶段/.test(logSince(g, n0)) && g.prelude.extra_action === 0,
		J({ reserves: g.prelude.reserves, extra: g.prelude.extra_action,
			log: logSince(g, n0).slice(0, 200) }))
	ok('★ 额外行动阶段时留在 action 而非进 cards',
		g.prelude.phase === 'prelude_action', g.prelude.phase)
	R.action(g, g.active, 'prelude_discard_1_1', {})
	ok('★★ 额外机会用完后仍可执行一次行动阶段', g.prelude.extra_action === 0 &&
		g.prelude.phase === 'prelude_action', g.prelude.extra_action)
}

console.log('\n=== G. 静态守卫与接线点 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ PRELUDE_OP_WINDOW 表存在且覆盖 6 类需窗口 op',
		/const PRELUDE_OP_WINDOW = \{/.test(src) &&
		['battle', 'eliminate', 'deploy_air', 'peek_reorder', 'peek_and_play', 'choice_attrition_or_skip']
			.every(k => src.indexOf(k + ':') >= 0))
	ok('★★ 双门禁三处齐全（build_actions / do_action / prelude_do_action）',
		/acts\.prelude_op_pick = 1/.test(src) &&
		/if \(p\.op_window\) \{[\s\S]{0,400}prelude_answer_op_window/.test(src) &&
		/String\(action\)\.indexOf\('prelude_'\) === 0/.test(src))
	ok('★ 候选只给答复方（隐私）',
		/faction_role_of_nation\(p\.op_window\.nation\) === current/.test(src))
	ok('★ 持续段按 once_per_turn 记账重跑',
		/p\.persistent_used\[key\]/.test(src) && /rec\.segObj/.test(src))
	/* 只检查前奏候选函数本身；rules.js 其它功能对 find_battle_target 的合法调用不受限 */
	const candFn = src.slice(src.indexOf('function prelude_op_candidates'),
		src.indexOf('function prelude_run_steps'))
	ok('★ 前奏候选函数未用 find_battle_target 替玩家选',
		!/find_battle_target/.test(candFn), candFn.slice(0, 120))
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('★★ 客户端按服务端候选生成按钮 + 结束原因',
		/p\.op_window\.candidates\.forEach/.test(pjs) && /前奏结束：/.test(pjs))
	const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	const vers = (html.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	ok('★ play.html 版本串统一且非空', vers.length >= 5 &&
		vers.every(v => v && v === vers[0]), J(vers))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
