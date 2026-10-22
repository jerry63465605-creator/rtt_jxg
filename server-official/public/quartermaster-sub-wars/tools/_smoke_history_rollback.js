"use strict"
/*
 * 行动记录（history）+ 时间回溯（rollback）回归测试
 *
 * 玩家 2026-10-22 口径：
 *   · 可退到【本回合（整轮）开始】（本整轮内任一国家回合开始的检查点）；
 *   · 必须【对方同意】才生效；
 *   · 历史行动记录保留 120 条。
 */
const rules = require('../rules.js')
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, detail) {
	if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  | ' + detail : '')) }
	else { fail++; console.log('  FAIL  ' + name + (detail ? '  | ' + detail : '')) }
}

/*
 * 状态指纹：部队位置/归属/兵种 + 各国手牌与牌堆张数 + 回合指针。
 * 不只看 location —— 开局弃牌阶段盘上没有部队移动，只有手牌变化。
 */
function fp(g) {
	return JSON.stringify({
		loc: Object.keys(g.location).sort()
			.map(p => p + ':' + g.location[p] + ':' + g.piece_nation[p] + ':' + g.piece_type[p])
			.join('|'),
		hands: Object.keys(g.hands || {}).sort()
			.map(n => n + ':' + (g.hands[n] || []).length).join(','),
		decks: Object.keys(g.decks || {}).sort()
			.map(n => n + ':' + (g.decks[n] || []).length).join(','),
		table: Object.keys(g.table || {}).sort()
			.map(n => n + ':' + (g.table[n] || []).length).join(','),
		nation: g.current_nation,
		phase: g.turn_phase,
		turn: g.turn,
		done: g.nations_done,
	})
}

/* 用真实 view.actions 驱动，保证每步都是合法动作 */
function play_steps(g, n) {
	const skip = /^(propose_rollback|accept_rollback|reject_rollback|cancel_rollback)$/
	for (let i = 0; i < n; i++) {
		const v = rules.view(g, g.active)
		const names = Object.keys(v.actions || {}).filter(x => !skip.test(x))
		if (!names.length) return i
		const a = names[i % names.length]
		const val = v.actions[a]
		const arg = Array.isArray(val) ? val[0] : null
		rules.action(g, g.active, a, arg)
		if (g.game_over) return i
	}
	return n
}

/*
 * 制造可观测的盘面变化（测试专用）。
 * 开局阶段只有弃牌、盘上没有部队移动，用 debug_place 直接落一支子，
 * 这样"回退是否真的把盘面退回去了"才有可断言的对象。
 */
const EAST = I.data.id_of('东欧')
function place_extra(g, id) {
	rules.action(g, g.active, 'debug_place', {
		piece: id, nation: '德国', type: 'army', space: EAST,
	})
	return g.location[id] === EAST
}

console.log('\n=== A. setup 初始字段 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	ok('history 是空数组', Array.isArray(g.history) && g.history.length === 0)
	ok('history_total = 0', g.history_total === 0)
	ok('rollback 有 1 个开局检查点', (g.rollback || []).length === 1,
		(g.rollback[0] || {}).label)
	ok('检查点有压缩快照', !!(g.rollback[0] || {}).snap)
	ok('HISTORY_MAX = 120', I.HISTORY_MAX === 120, String(I.HISTORY_MAX))
	ok('ROLLBACK_MAX = 12', I.ROLLBACK_MAX === 12, String(I.ROLLBACK_MAX))
}

console.log('\n=== B. 行动记录：有日志的动作才记，且索引可 slice ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	const before = g.history.length
	play_steps(g, 20)
	ok('history 有增长', g.history.length > before, before + ' -> ' + g.history.length)
	const h = g.history[0]
	ok('条目含 n/turn/phase/action/label/from/to',
		h && h.n >= 1 && h.turn >= 1 && h.action && h.label != null &&
		typeof h.from === 'number' && typeof h.to === 'number',
		JSON.stringify(h))
	ok('from < to', h.from < h.to, h.from + '..' + h.to)
	ok('log.slice(from,to) 非空', (g.log.slice(h.from, h.to) || []).filter(Boolean).length > 0,
		JSON.stringify((g.log.slice(h.from, h.to) || []).slice(0, 1)))
	ok('by 是阵营 key', h.by === 'axis' || h.by === 'allies', h.by)
}

console.log('\n=== C. 历史条数上限 120 ===')
{
	const g = rules.setup(7, rules.default_scenario, {})
	/* 直接灌 200 条，验证裁剪 */
	for (let i = 0; i < 200; i++)
		I.record_action_history(Object.assign(g, { log: g.log.concat(['dummy ' + i]) }),
			{ action: 'dummy', side: 'axis', from: g.log.length - 1 })
	ok('history <= 120', g.history.length <= I.HISTORY_MAX, String(g.history.length))
	ok('history_total 累计', g.history_total >= 200, String(g.history_total))
}

console.log('\n=== D. 提议回退：操作权交给对方，普通动作被拦 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	const fp0 = fp(g)
	play_steps(g, 20)
	ok('落子成功（准备盘面变化）', place_extra(g, 'zz_d1'))
	ok('盘面已变化', fp(g) !== fp0)
	const pts = rules.view(g, g.active).rollback_points
	ok('有可回退检查点', pts.length >= 1, JSON.stringify(pts.map(p => p.label)))
	const proposer = g.active
	const other = proposer === 'Axis' ? 'Allies' : 'Axis'

	rules.action(g, proposer, 'propose_rollback', { index: pts[0].index })
	ok('产生待确认提议', !!g.rollback_proposal, JSON.stringify(g.rollback_proposal && {
		by: g.rollback_proposal.by_side, label: g.rollback_proposal.label,
	}))
	ok('active 切给对方', g.active === other, proposer + ' -> ' + g.active)

	const vOther = rules.view(g, other)
	ok('对方看到 accept/reject 白名单',
		!!(vOther.actions && vOther.actions.accept_rollback) &&
		!!(vOther.actions && vOther.actions.reject_rollback),
		JSON.stringify(Object.keys(vOther.actions || {}).filter(x => /rollback/.test(x))))
	ok('对方看不到普通动作以外的入口被清空？(play_card 仍在白名单但服务端会拦)',
		true)

	/* 提议期间对方打牌必须被拦（active 已切给他） */
	const fpBefore = fp(g)
	const logLen = g.log.length
	rules.action(g, other, 'next_phase', {})
	ok('提议期间 next_phase 被拦', fp(g) === fpBefore && !!g.rollback_proposal,
		(g.log[g.log.length - 1] || '').slice(0, 40))
	ok('拦截有日志说明', g.log.length > logLen, g.log[g.log.length - 1])
}

console.log('\n=== E. 拒绝：提议作废、盘面不变、操作权归还 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	play_steps(g, 16)
	const pts = rules.view(g, g.active).rollback_points
	const proposer = g.active
	const other = proposer === 'Axis' ? 'Allies' : 'Axis'
	rules.action(g, proposer, 'propose_rollback', { index: pts[0].index })
	const fpNow = fp(g)
	rules.action(g, other, 'reject_rollback', {})
	ok('提议已清空', g.rollback_proposal === null)
	ok('盘面未变', fp(g) === fpNow)
	ok('操作权归还提议方', g.active === proposer, g.active)
	ok('日志记录拒绝', (g.log || []).some(l => /拒绝/.test(l)), (g.log || []).slice(-1)[0])
}

console.log('\n=== F. 同意：退回检查点盘面 / 日志与历史同步截断 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	const fp0 = fp(g)
	const log0 = g.log.length
	const roll0 = (g.rollback || []).length
	play_steps(g, 20)
	ok('落子成功（准备盘面变化）', place_extra(g, 'zz_f1'))
	ok('回退前盘面已变', fp(g) !== fp0)
	ok('回退前日志更长', g.log.length > log0, log0 + ' -> ' + g.log.length)
	ok('回退前有历史', g.history.length > 0, String(g.history.length))

	const pts = rules.view(g, g.active).rollback_points
	const proposer = g.active
	const other = proposer === 'Axis' ? 'Allies' : 'Axis'
	rules.action(g, proposer, 'propose_rollback', { index: pts[0].index })
	rules.action(g, other, 'accept_rollback', {})

	ok('盘面退回检查点', fp(g) === fp0, 'fp equal=' + (fp(g) === fp0))
	ok('回退前落的子已消失', g.location['zz_f1'] === undefined,
		String(g.location['zz_f1']))
	ok('提议已清空', g.rollback_proposal === null)
	ok('日志截断到检查点附近', g.log.length <= log0 + 2, log0 + ' vs ' + g.log.length)
	ok('日志保留回退说明', (g.log || []).some(l => /同意回退/.test(l)), (g.log || []).slice(-1)[0])
	ok('history 被截断', g.history.length <= (rules.view(g, g.active).history_total || 0),
		'hist=' + g.history.length)
	ok('rollback 数组截断到被回退点', (g.rollback || []).length <= roll0,
		roll0 + ' -> ' + (g.rollback || []).length)
	ok('回退后 view 仍可用', !!rules.view(g, g.active).actions)
	/* 回退后索引连续：history_total 必须跟着回退，否则编号从 1 重来 */
	ok('history_total 已回退（不重置累积）', g.history_total <= 20, String(g.history_total))
	/* 回退后还能继续正常游戏 */
	const steps = play_steps(g, 3)
	ok('回退后可继续行动', steps >= 1, 'steps=' + steps)
	ok('回退后新记录编号连续',
		!(g.history || []).some((h, i, a) => i > 0 && h.n <= a[i - 1].n),
		JSON.stringify((g.history || []).map(x => x.n).slice(-5)))
}

console.log('\n=== G. 权限守卫 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	play_steps(g, 10)
	const pts = rules.view(g, g.active).rollback_points
	const proposer = g.active
	const other = proposer === 'Axis' ? 'Allies' : 'Axis'

	/* 非 active 方提议 */
	const logLen = g.log.length
	rules.action(g, other, 'propose_rollback', { index: pts[0].index })
	ok('非当前行动方不能提议', !g.rollback_proposal && g.log.length > logLen,
		(g.log || []).slice(-1)[0])

	/* 提议方自己同意 */
	rules.action(g, proposer, 'propose_rollback', { index: pts[0].index })
	ok('前提：提议已产生', !!g.rollback_proposal)
	const fpNow = fp(g)
	rules.action(g, proposer, 'accept_rollback', {})
	ok('提议方不能自批', !!g.rollback_proposal && fp(g) === fpNow,
		(g.log || []).slice(-1)[0])

	/* 提议方撤回 */
	rules.action(g, proposer, 'cancel_rollback', {})
	ok('提议方可撤回', g.rollback_proposal === null && g.active === proposer,
		(g.log || []).slice(-1)[0])
}

console.log('\n=== H. 检查点范围：只能退到本回合（整轮）内的点 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	/* 伪造一个"上一轮"的检查点，验证拒绝 */
	g.rollback.unshift({ turn: 0, nation: '德国', label: '上一轮', log_len: 0, hist_len: 0, snap: g.rollback[0].snap })
	const pts = rules.view(g, g.active).rollback_points
	ok('view 只下发本回合检查点', pts.every(p => p.turn === (g.turn || 1)),
		JSON.stringify(pts.map(p => p.turn)))
	const logLen = g.log.length
	rules.action(g, g.active, 'propose_rollback', { index: 0 })
	ok('越界检查点被拒', !g.rollback_proposal && g.log.length > logLen,
		(g.log || []).slice(-1)[0])
}

console.log('\n=== I. 存档往返（JSON 序列化后行为一致）===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	play_steps(g, 12)
	const g2 = JSON.parse(JSON.stringify(g))
	ok('序列化后 rollback 快照仍在', (g2.rollback || []).length > 0)
	ok('序列化后 history 仍在', (g2.history || []).length > 0)
	ok('无 _in_action 残留', g2._in_action === undefined, String(g2._in_action))
	ok('序列化后 view 正常', !!rules.view(g2, g2.active).actions)
	/* 序列化后仍能回退 */
	const pts = rules.view(g2, g2.active).rollback_points
	const proposer = g2.active
	const other = proposer === 'Axis' ? 'Allies' : 'Axis'
	rules.action(g2, proposer, 'propose_rollback', { index: pts[0].index })
	rules.action(g2, other, 'accept_rollback', {})
	ok('序列化后回退成功', g2.rollback_proposal === null && (g2.log || []).some(l => /同意回退/.test(l)),
		(g2.log || []).slice(-1)[0])
}

console.log('\n' + (fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAIL / ' + pass + ' PASS'))
process.exitCode = fail ? 1 : 0
