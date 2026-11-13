/*
 * 【D1/P15】前奏期回退（沿用「需对方同意」语义）编号真实测试
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_real_test_P15_prelude_rollback.js
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
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
const actsOf = (g, current) => R.view(g, current).actions || {}
const preludeKeys = a => Object.keys(a).filter(k => k.indexOf('prelude_') === 0)

console.log('=== A. 前奏动作压回退点、白名单放行 propose_rollback ===')
{
	const g = started()
	const side = g.active
	const foe = side === 'Axis' ? 'Allies' : 'Axis'
	const n = g.current_nation
	const rb0 = (R.view(g, side).rollback_points || []).length
	const hand0 = (g.prelude.hands[n] || []).slice()
	R.action(g, side, 'prelude_play_hand', { card: hand0[0] })
	const v = R.view(g, side)
	ok('★★ 打一张前奏牌后回退点 +1（外层 finally 压点未回归）',
		(v.rollback_points || []).length === rb0 + 1,
		J({ before: rb0, after: (v.rollback_points || []).length }))
	ok('★★ 本方 view.actions 有 propose_rollback（P15 修复点）',
		v.actions.propose_rollback === 1, J(v.actions))
	ok('★★ view.can_propose_rollback 与客户端判据不再矛盾',
		v.can_propose_rollback === true, J(v.can_propose_rollback))
	ok('★ 对方没有 propose_rollback（轮到本方才能提议）',
		!actsOf(g, foe).propose_rollback, J(actsOf(g, foe)))
	const pts = v.rollback_points || []
	console.log('    [info] 回退点数=' + pts.length +
		'，倒数第二点 n=' + (pts.length > 1 ? pts[pts.length - 2].n : '?'))
}

console.log('\n=== B. 真实提议：提议挂起期间双方白名单 ===')
{
	const g = started()
	const side = g.active
	const foe = side === 'Axis' ? 'Allies' : 'Axis'
	const n = g.current_nation
	const hand0 = (g.prelude.hands[n] || []).slice()
	const deck0 = (g.prelude.decks[n] || []).length
	R.action(g, side, 'prelude_play_hand', { card: hand0[0] })
	const pts = R.view(g, side).rollback_points || []
	const targetN = pts.length > 1 ? pts[pts.length - 2].n : 0
	R.action(g, side, 'propose_rollback', { n: targetN })
	ok('★★ 提议建立、操作权交对方（沿用需对方同意）',
		!!g.rollback_proposal && g.active === foe &&
		g.rollback_proposal.n === targetN,
		J({ pr: g.rollback_proposal && g.rollback_proposal.n, active: g.active }))
	const vm = R.view(g, side)
	const vf = R.view(g, foe)
	ok('★★ 提议方拿到 cancel_rollback、无 accept/reject',
		vm.actions.cancel_rollback === 1 &&
		!vm.actions.accept_rollback && !vm.actions.reject_rollback,
		J(vm.actions))
	ok('★★ 对方拿到 accept/reject、无 cancel',
		vf.actions.accept_rollback === 1 && vf.actions.reject_rollback === 1 &&
		!vf.actions.cancel_rollback, J(vf.actions))
	ok('★★ 提议挂起期间双方都不下发 prelude_* 动作',
		preludeKeys(vm.actions).length === 0 && preludeKeys(vf.actions).length === 0,
		J({ mine: preludeKeys(vm.actions), foe: preludeKeys(vf.actions) }))
	ok('★ view.rollback_proposal 对双方可见',
		!!vm.rollback_proposal && !!vf.rollback_proposal,
		J(vm.rollback_proposal))

	console.log('\n--- B2. 挂起期间前奏动作被拒（不再冲掉提议） ---')
	const phaseBefore = g.prelude.phase
	const l0 = g.log.length
	R.action(g, side, 'prelude_next', {})
	ok('★★ prelude_next 不生效：阶段不变、手牌/牌堆不变',
		g.prelude.phase === phaseBefore &&
		(g.prelude.hands[n] || []).length === hand0.length - 1 &&
		(g.prelude.decks[n] || []).length === deck0,
		J({ phase: g.prelude.phase, hand: (g.prelude.hands[n] || []).length,
			deck: (g.prelude.decks[n] || []).length }))
	ok('★★ 日志明确提示「回退提议待确认」',
		(g.log || []).slice(l0).some(l => /回退提议待确认/.test(l)),
		J((g.log || []).slice(l0)))
	ok('★★ 提议仍在、未被冲掉', !!g.rollback_proposal,
		J(g.rollback_proposal && g.rollback_proposal.n))

	console.log('\n--- B3. 对方同意 → 前奏状态完整恢复 ---')
	R.action(g, foe, 'accept_rollback', {})
	ok('★★ prelude 恢复到打牌前（手牌 2 张、牌堆长度不变、ACTION 阶段）',
		(g.prelude.hands[n] || []).length === hand0.length &&
		(g.prelude.decks[n] || []).length === deck0 &&
		g.prelude.phase === 'prelude_action',
		J({ hand: (g.prelude.hands[n] || []).length,
			deck: (g.prelude.decks[n] || []).length, phase: g.prelude.phase }))
	ok('★★ prelude 仍启用、active 归还本方、提议清空',
		g.prelude.enabled === true && g.active === side &&
		!g.rollback_proposal,
		J({ enabled: g.prelude.enabled, active: g.active, pr: g.rollback_proposal }))
	ok('★★ 同意后前奏动作白名单恢复',
		actsOf(g, side).prelude_play_hand === 1 &&
		actsOf(g, side).propose_rollback === 1,
		J(actsOf(g, side)))
}

console.log('\n=== C. 拒绝 / 撤回后前奏动作恢复，提议不残留 ===')
for (const mode of ['reject', 'cancel']) {
	const g = started()
	const side = g.active
	const foe = side === 'Axis' ? 'Allies' : 'Axis'
	R.action(g, side, 'propose_rollback', {})
	if (!g.rollback_proposal) {
		ok('★★ ' + mode + '：提议应能建立', false, 'no proposal')
		continue
	}
	R.action(g, mode === 'reject' ? foe : side,
		mode === 'reject' ? 'reject_rollback' : 'cancel_rollback', {})
	ok('★★ ' + mode + ' 后提议清空、active 归还',
		!g.rollback_proposal && g.active === side,
		J({ pr: g.rollback_proposal, active: g.active }))
	ok('★★ ' + mode + ' 后前奏动作与回退提议入口都恢复',
		actsOf(g, side).prelude_play_hand === 1 &&
		actsOf(g, side).propose_rollback === 1,
		J(actsOf(g, side)))
}

console.log('\n=== D. 正式局回退不回归 ===')
{
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	ok('★★ Standard 局仍有回退点与 propose_rollback',
		(R.view(g, g.active).rollback_points || []).length > 0 &&
		actsOf(g, g.active).propose_rollback === 1,
		J(actsOf(g, g.active)))
	ok('★ Standard 局 prelude 未启用', g.prelude.enabled === false,
		J(g.prelude.enabled))
	/* 提议后 active 会切给对方，先存提议方再按各自视角断言 */
	const proposer = g.active
	const answerer = proposer === 'Axis' ? 'Allies' : 'Axis'
	R.action(g, proposer, 'propose_rollback', {})
	ok('★★ Standard 局提议挂起时白名单仍是 accept/reject/cancel 三动作',
		!!g.rollback_proposal &&
		actsOf(g, proposer).cancel_rollback === 1 &&
		actsOf(g, answerer).accept_rollback === 1 &&
		actsOf(g, answerer).reject_rollback === 1,
		J({ proposer: actsOf(g, proposer), answerer: actsOf(g, answerer) }))
}

console.log('\n=== E. 静态守卫（三处门禁 + 客户端零改动）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ build_actions 前奏分支挂起时只发回退三动作',
		/if \(game\.rollback_proposal\) \{\s*\n\s*const rb = \{ log: 1 \}/.test(src) &&
		/rb\.cancel_rollback = 1/.test(src) &&
		/rb\.accept_rollback = 1; rb\.reject_rollback = 1/.test(src))
	ok('★★ build_actions 前奏分支无提议时下发 propose_rollback',
		/if \(!game\.game_over && is_my_turn && rollback_points_of\(game\)\.length\)\s*\n\s*acts\.propose_rollback = 1/.test(src))
	ok('★★ do_action 前奏分发不再绕过提议门禁',
		/prelude_on\(game\) && !game\.rollback_proposal &&/.test(src))
	ok('★★ prelude_advance 提议挂起时冻结推进',
		/【前奏】回退提议待确认，暂不推进阶段/.test(src))
	ok('★ 快照机制零改动（仍只剔除固定字段、prelude 进快照）',
		/function rollback_pack\(game\)/.test(src) &&
		!/k === 'prelude'/.test(src.slice(src.indexOf('function rollback_pack'),
			src.indexOf('function rollback_unpack'))))
	ok('★ 客户端零改动：can_propose_rollback 仍只读 view.actions',
		/return !\(view && view\.actions && view\.actions\.propose_rollback\)/.test(pjs) === false &&
		/view\.actions\.propose_rollback/.test(pjs))
	const vers = (phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	/* 【D1/P16】后续期因客户端改动 bump 过版本串；这里只校验统一性，不写死值 */
	ok('★ 版本串统一且非空（P15 当轮客户端零改动）',
		vers.length >= 5 && vers.every(v => v && v === vers[0]),
		[...new Set(vers)])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
