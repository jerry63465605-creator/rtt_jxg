/*
 * 【D1/P8】正式牌「选择并打出」留场 + 后备区对齐 + 多段/排序增强
 * 编号真实测试：真实 R.setup / R.action / R.view 驱动。
 * 用法：node tools/_real_test_P8_formal_play.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const P = require(path.join(MOD, 'prelude_compiler.js'))
const C = require(path.join(MOD, 'cards.js'))
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
function play(g, id) {
	const card = String(id) + '#t8'
	g.prelude.hands[g.current_nation].push(card)
	R.action(g, g.active, 'prelude_play_hand', { card: card })
	return card
}
const cfgOf = id => {
	const x = C.CARD_BY_ID[id]
	return P.compile({ id: x.id, nation: x.nation, deck: x.deck,
		type: x.type, name: x.name, text: x.text }).config
}
const segOps = cfg => cfg.segments.flatMap(s => s.steps)
const win = g => g.prelude && g.prelude.op_window
const pickSide = g => ['Axis', 'Allies'].find(s =>
	(R.view(g, s).actions || {}).prelude_op_pick)

/* 摆一个已选定候选的 card 窗口作为初始局面，答复走真实 action */
function putCardWindow(g, op, pickId) {
	const n = g.current_nation
	g.prelude.op_window = {
		nation: n, owner: n, kind: 'card',
		candidates: [{ id: pickId, name: String(pickId) }],
		op: op, seg: { steps: [], refs: [] },
		pendingOps: [], desc: 'P8 测试窗口',
	}
}

console.log('=== A. 编译层传播卡面类型 filter ===')
{
	const a = segOps(cfgOf(14907)).find(o => o.op === 'peek_and_play')
	const b = segOps(cfgOf(18004)).find(o => o.op === 'peek_and_play')
	const c = segOps(cfgOf(17204)).find(o => o.op === 'peek_and_play')
	const d = segOps(cfgOf(14903)).find(o => o.op === 'peek_and_play')
	/* 【D1/P18】14907 是「状态卡打出 / 其它牌置入手牌」二选一，不再过滤；
	 * 18004/17204 卡面只有「选状态卡打出」，仍按 filter 过滤。 */
	ok('★★ 18004/17204 仍传播 filter=状态卡；14907 二选一 filter=null',
		!!a && a.filter === null && a.pick_mode === 'status_play_or_hand' &&
		!!b && b.filter === '状态卡' && !!c && c.filter === '状态卡',
		J([a, b, c]))
	ok('★★ 14903 传播 filter=军备卡（前奏牌堆）',
		!!d && d.filter === '军备卡' && d.source === 'prelude', J(d))
	ok('★ 18412 的 play_response 仍带 filter=响应卡（P5 收口不回归）',
		segOps(cfgOf(18412)).some(o => o.op === 'play_response' &&
			o.filter === '响应卡'), J(segOps(cfgOf(18412))))
}

console.log('\n=== B. 候选按卡面类型过滤（不误筛、不漏筛）===')
{
	const g = started()
	const n = g.current_nation
	/* 正式牌堆混 STATUS(15255) / BASIC(15300) / RESPONSE(15328) */
	g.decks[n] = ['15255#s1', '15300#b1', '15255#s2', '15328#r1', '15255#s3']
	play(g, 14907)
	/* 【D1/P14】收口后直接是 peek_and_play 选牌窗口，无前置顶/底 choice */
	const w = win(g)
	/* 【D1/P18】14907 无条件检视：全部 5 张都是候选（含 BASIC/RESPONSE） */
	ok('★★ 候选包含全部牌型（状态卡打出、其它牌加入手牌）',
		!!w && w.candidates.length === 5 &&
		w.candidates.some(c => c.id === '15300#b1') &&
		w.candidates.some(c => c.id === '15328#r1'),
		J(w && w.candidates.map(c => c.id)))
	ok('★ 候选仍带 source/peek_scope（P7 不回归）',
		!!w && w.op.source === 'formal' && w.op.peek_scope === 10,
		J(w && w.op))
}

console.log('\n=== C. 「选择并打出」按类型留场，不触发正式效果 ===')
{
	/* STATUS → 明置桌面 game.table */
	const g1 = started()
	const n1 = g1.current_nation
	g1.decks[n1] = ['15255#s1']
	putCardWindow(g1, { op: 'peek_and_play', source: 'formal', filter: '状态卡',
		peek_scope: 10, n: 1 }, '15255#s1')
	const n0 = g1.log.length
	R.action(g1, pickSide(g1), 'prelude_op_pick', { pick: '15255#s1' })
	ok('★★ STATUS 明置留场于 game.table、不进手牌、不触发挥应栈',
		(g1.table[n1] || []).indexOf('15255#s1') >= 0 &&
		(g1.hands[n1] || []).indexOf('15255#s1') < 0 &&
		!(g1.response_stack || []).length &&
		(g1.log || []).slice(n0).some(l => /打出 1 张状态卡于桌面留场/.test(l)),
		J({ table: g1.table[n1], stack: g1.response_stack }))

	/* RESPONSE → 暗置到 table_responses，牌名保密 */
	const g2 = started()
	const n2 = g2.current_nation
	g2.decks[n2] = ['15328#r1']
	putCardWindow(g2, { op: 'peek_and_play', source: 'formal', filter: '响应卡',
		peek_scope: 10, n: 1 }, '15328#r1')
	const n2log = g2.log.length
	R.action(g2, pickSide(g2), 'prelude_op_pick', { pick: '15328#r1' })
	ok('★★ RESPONSE 暗置留场（复用 facedown_response）且牌名保密',
		(g2.table_responses || []).some(x => x.card_id === '15328#r1') &&
		!(g2.log || []).slice(n2log).some(l => /破译恩尼格码/.test(l)),
		J({ table: (g2.table_responses || []).map(x => x.card_id),
			log: (g2.log || []).slice(n2log) }))

	/* 其它类型 → 取回正式手牌，仍不自动打出 */
	const g3 = started()
	const n3 = g3.current_nation
	g3.decks[n3] = ['15300#b1']
	putCardWindow(g3, { op: 'peek_and_play', source: 'formal', peek_scope: 10, n: 1 },
		'15300#b1')
	R.action(g3, pickSide(g3), 'prelude_op_pick', { pick: '15300#b1' })
	ok('★★ 其它类型取回正式手牌，不自动打正式卡',
		(g3.hands[n3] || []).indexOf('15300#b1') >= 0 &&
		!(g3.table[n3] || []).length &&
		(g3.log || []).some(l => /不自动打出正式卡/.test(l)),
		J({ hand: (g3.hands[n3] || []).slice(-2) }))
}

console.log('\n=== D. 后备区与正式局棋子上限对齐 ===')
{
	const g = started()
	const n = g.current_nation
	/* 摆一个窗口，排队 ops 里放 add_reserve，由真实 action 触发执行器 */
	g.prelude.op_window = {
		nation: n, owner: n, kind: 'choice',
		candidates: [{ id: 'top', name: '保持原序' }],
		op: { op: 'peek_reorder', source: 'prelude', n: 2 },
		seg: { steps: [], refs: [] },
		pendingOps: [{ op: 'add_reserve', n: 1, type: '陆军' }],
		desc: 'P8 后备测试',
	}
	R.action(g, pickSide(g), 'prelude_op_pick', { pick: 'top' })
	const v = R.view(g, g.active)
	ok('★★ 复用 add_army_bonus，正式局 army_bonus 真的增加',
		(g.army_bonus || {})[n] >= 1, J(g.army_bonus))
	ok('★★ view 下发 reserves_bonus 与正式局 army_bonus 同源',
		(v.prelude.reserves_bonus || {})[n] === (g.army_bonus || {})[n],
		J({ view: v.prelude.reserves_bonus, game: g.army_bonus }))
	ok('★ p.reserves 前奏记账仍累加（P4 不回归）',
		(g.prelude.reserves || {})[n] >= 1, J(g.prelude.reserves))
	ok('★ unit_cap_ok 现成原子仍在 _internal',
		typeof R._internal.unit_cap_ok === 'function' &&
		typeof R._internal.add_army_bonus === 'function')
}

console.log('\n=== E. 多段军备卡 / order 拖拽增强 / 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ 多段军备卡遍历后续段非窗口 op（不再只跑 segments[0]）',
		/for \(let si = 1; si < cfg\.segments\.length; si\+\+\)/.test(src) &&
		/prelude_run_op\(g, nation, o, s2\)/.test(src))
	ok('★ 窗口 op 仍留给 defer、绝不自动替玩家选',
		/需分步窗口，defer 续打待接入/.test(src))
	ok('★ 正式牌留场路径不调用 card_effect_of / play_status_card_impl',
		!/prelude_apply_op_choice[\s\S]{0,3000}card_effect_of\(/.test(src) &&
		!/prelude_apply_op_choice[\s\S]{0,3000}play_status_card_impl\(/.test(src))
	const pcsrc = fs.readFileSync(path.join(MOD, 'prelude_compiler.js'), 'utf8')
	ok('★ 类型 filter 传播是配置驱动（PRELUDE_FILTER_TYPE）',
		/PRELUDE_FILTER_TYPE/.test(src) && /op\.filter = s\.filters\.find/.test(pcsrc))
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('★★ order 窗口支持拖拽重排与撤销',
		/item\.draggable = true/.test(pjs) && /ondrop =/.test(pjs) &&
		/撤销/.test(pjs))
	ok('★ 面板显示正式局同源后备加成',
		/p\.reserves_bonus \|\| \{\}/.test(pjs))
	const texts = C.CARDS.filter(x => x.deck === 'PRELUDE' || x.deck === 'ARMAMENT' ||
		x.type === 'PRELUDE' || x.type === 'ARMAMENT').map(x => x.text)
	const cov = P.coverage(texts)
	ok('★★ 官方 125 张覆盖率仍 100%',
		cov.rate === 1 && cov.unmatchedBracket.length === 0 &&
		cov.unmatchedAction.length === 0,
		J({ total: cov.total, hit: cov.hit, noise: cov.noise }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
