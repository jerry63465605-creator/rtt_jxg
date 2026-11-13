/*
 * 【D1/P11】乙口径：补牌 / 手动卡牌阶段 / 弃 1+1 选牌 / 皆空跳过
 * 真实 R.setup / R.action / R.view 驱动；用无编译配置的 id 测纯流程，避免卡效果窗口干扰。
 * 用法：node tools/_real_test_P11_play_flow.js
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
const pickSide = g => ['Axis', 'Allies'].find(s =>
	(R.view(g, s).actions || {}).prelude_op_pick)

console.log('=== A. 打出 1 张前奏手牌 → 不摸牌（D1/P12 纠正）===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.hands[n] = ['99999#a', '99999#b']
	const d0 = (g.prelude.decks[n] || []).length
	const top0 = (g.prelude.decks[n] || [])[0]
	const n0 = g.log.length
	R.action(g, g.active, 'prelude_play_hand', { card: '99999#a' })
	const h = g.prelude.hands[n] || []
	ok('★★ 牌堆长度不变（没有从牌堆顶摸牌）',
		(g.prelude.decks[n] || []).length === d0,
		J({ before: d0, after: (g.prelude.decks[n] || []).length }))
	ok('★★ 牌堆顶仍是原来那张',
		(g.prelude.decks[n] || [])[0] === top0, J((g.prelude.decks[n] || [])[0]))
	ok('★★ 打出的牌离开手牌、只剩 1 张',
		h.indexOf('99999#a') < 0 && h.length === 1, J(h))
	ok('★★ 日志无「加入手牌」补牌记录',
		!(g.log || []).slice(n0).some(l => /加入手牌/.test(l)),
		J((g.log || []).slice(n0)))
	/* 打出【牌堆顶】仍会 shift 露出新顶 —— 那不是摸牌 */
	const g2 = started()
	const n2 = g2.current_nation
	const t2 = (g2.prelude.decks[n2] || [])[0]
	const len2 = (g2.prelude.decks[n2] || []).length
	R.action(g2, g2.active, 'prelude_play_top', {})
	ok('★ 打牌堆顶仍露出新顶（非摸牌，保留）',
		(g2.prelude.decks[n2] || []).length === len2 - 1 &&
		(g2.prelude.decks[n2] || [])[0] !== t2,
		J({ len: (g2.prelude.decks[n2] || []).length, top: (g2.prelude.decks[n2] || [])[0] }))
}

console.log('\n=== B. 乙口径：卡牌阶段点「继续」才执行 ===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.hands[n] = ['99999#a', '99999#b']
	R.action(g, g.active, 'prelude_play_hand', { card: '99999#a' })
	const handAtCards = (g.prelude.hands[n] || []).slice()
	ok('★★ 打牌后进入卡牌阶段但【不自动执行】',
		g.prelude.phase === 'prelude_cards' &&
		(g.prelude.hands[n] || []).join(',') === handAtCards.join(',') &&
		!(g.log || []).some(l => /弃置前奏手牌/.test(l)),
		J({ phase: g.prelude.phase, hand: g.prelude.hands[n] }))
	ok('★ CARDS 阶段白名单有「继续」',
		!!(R.view(g, g.active).actions || {}).prelude_next)
	R.action(g, g.active, 'prelude_next', {})
	ok('★★ 点「继续」后才弃光手牌 → 摸 2 张',
		(g.prelude.hands[n] || []).length === 2 &&
		(g.log || []).some(l => /弃置前奏手牌/.test(l)),
		J((g.prelude.hands[n] || []).length))
	ok('★★ 并推进到下一个国家',
		g.current_nation !== n, J({ from: n, to: g.current_nation }))
}

console.log('\n=== C. 弃 1+1：手牌 >1 时手动选牌 ===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.hands[n] = ['99999#a', '99999#b']
	const d0 = (g.prelude.decks[n] || []).length
	const top0 = (g.prelude.decks[n] || [])[0]
	R.action(g, g.active, 'prelude_discard_1_1', {})
	const w = g.prelude.op_window
	ok('★★ 开出选牌窗口（候选 = 2 张前奏手牌）', !!w &&
		w.op.op === 'discard_prelude_hand' && w.kind === 'card' &&
		w.candidates.length === 2, J(w && w.candidates))
	ok('★ 窗口可点（双门禁下发 prelude_op_pick）', !!pickSide(g))
	R.action(g, pickSide(g), 'prelude_op_pick', { pick: '99999#b' })
	ok('★★ 弃的是玩家选中的那张（不是第一张）',
		(g.prelude.hands[n] || []).indexOf('99999#b') < 0 &&
		(g.prelude.hands[n] || []).indexOf('99999#a') >= 0 &&
		(g.prelude.discard[n] || []).indexOf('99999#b') >= 0,
		J({ hand: g.prelude.hands[n], dis: g.prelude.discard[n] }))
	ok('★★ 同时弃牌堆顶 1 张',
		(g.prelude.decks[n] || []).length === d0 - 1 &&
		(g.prelude.discard[n] || []).indexOf(top0) >= 0,
		J({ deck: (g.prelude.decks[n] || []).length, dis: g.prelude.discard[n] }))
	ok('★★ 留在行动阶段，可再执行 1 次行动阶段',
		g.prelude.phase === 'prelude_action' && !g.prelude.op_window &&
		!!(R.view(g, g.active).actions || {}).prelude_play_hand,
		J({ phase: g.prelude.phase, acts: Object.keys(R.view(g, g.active).actions || {}) }))
}

console.log('\n=== D. 牌库或手牌为空 → 不可选择「弃 1+1」 ===')
{
	const g1 = started()
	const n1 = g1.current_nation
	g1.prelude.hands[n1] = []
	const d1 = (g1.prelude.decks[n1] || []).length
	const l1 = g1.log.length
	R.action(g1, g1.active, 'prelude_discard_1_1', {})
	ok('★★ 手牌空：按钮不下发 + 服务端拒绝 + 牌堆不变',
		!(R.view(g1, g1.active).actions || {}).prelude_discard_1_1 &&
		(g1.prelude.decks[n1] || []).length === d1 &&
		(g1.log || []).slice(l1).some(l => /不能选择/.test(l)),
		J((g1.log || []).slice(l1)))
	const g2 = started()
	const n2 = g2.current_nation
	g2.prelude.decks[n2] = []
	const h2 = (g2.prelude.hands[n2] || []).length
	const l2 = g2.log.length
	R.action(g2, g2.active, 'prelude_discard_1_1', {})
	ok('★★ 牌库空：按钮不下发 + 服务端拒绝 + 手牌不变',
		!(R.view(g2, g2.active).actions || {}).prelude_discard_1_1 &&
		(g2.prelude.hands[n2] || []).length === h2 &&
		(g2.log || []).slice(l2).some(l => /不能选择/.test(l)),
		J((g2.log || []).slice(l2)))
}

console.log('\n=== E. 牌库+手牌皆空 → 跳过该国前奏阶段 ===')
{
	/* 动作后即空 */
	const g = started()
	const n = g.current_nation
	g.prelude.hands[n] = ['99999#a']
	g.prelude.decks[n] = ['99999#d']
	R.action(g, g.active, 'prelude_discard_1_1', { card: '99999#a' })
	ok('★★ 弃 1+1 后本国皆空 → 直接跳过该国',
		g.current_nation !== n &&
		(g.log || []).some(l => /跳过该国前奏阶段/.test(l)),
		J({ from: n, to: g.current_nation, tail: (g.log || []).slice(-4) }))
	/* 轮转时循环跳过空国 */
	const g2 = started()
	for (const nn of Object.keys(g2.prelude.decks)) {
		g2.prelude.decks[nn] = []
		g2.prelude.hands[nn] = []
	}
	g2.prelude.hands[g2.current_nation] = ['99999#a']
	g2.prelude.phase = 'prelude_cards'
	R.action(g2, g2.active, 'prelude_next', {})
	ok('★★ 轮转时循环跳过所有空国（有防死循环）',
		(g2.log || []).filter(l => /跳过该国前奏阶段/.test(l)).length >= 1,
		J((g2.log || []).filter(l => /跳过该国前奏阶段/.test(l)).slice(0, 3)))
	ok('★★ 一轮结束后全空 → 结束条件②触发',
		g2.prelude.ended === true, J({ ended: g2.prelude.ended, reason: g2.prelude.end_reason }))
}

console.log('\n=== F. 静态守卫与客户端 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	/* 【D1/P12】撤销 P11 的补牌：play_hand 分支里不再有 prelude_draw */
	ok('★★ 打出手牌后不再补牌（P12 口径）', (() => {
		const fn = src.slice(src.indexOf("if (action === 'prelude_play_hand')"),
			src.indexOf("if (action === 'prelude_play_top')"))
		return !/prelude_draw\(game/.test(fn) && /prelude_resolve_card\(/.test(fn)
	})())
	ok('★★ 卡牌阶段不再自动执行（ACTION→CARDS 只切阶段）',
		/卡牌阶段（点击「继续」执行/.test(src) &&
		!/p\.phase = PRELUDE_PHASE\.CARDS\s*\n\s*prelude_run_phase\(game\)/.test(src))
	ok('★ 「继续」才跑卡牌阶段',
		/p\.phase === PRELUDE_PHASE\.CARDS\) prelude_run_phase\(game\)/.test(src))
	ok('★ 弃 1+1 选牌窗口与 keep_action 登记',
		/discard_prelude_hand: 'card'/.test(src) && /keep_action: true/.test(src))
	ok('★ 可用性判断双门禁同源',
		/p\.hands\[pn\] \|\| \[\]\)\.length && \(p\.decks\[pn\]/.test(src) &&
		/牌库或前奏手牌为空，不能选择/.test(src))
	ok('★ 轮转跳过空国有防死循环',
		/guard\+\+ < ORDER_OF_NATIONS\.length/.test(src) &&
		/牌库与手牌皆空，跳过该国前奏阶段/.test(src))
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('★ 客户端弃牌窗口下手牌卡片回传 pick',
		/discard_prelude_hand/.test(pjs) &&
		/send_action\("prelude_op_pick", \{ pick: c\.id \}\)/.test(pjs))
	ok('★ 「继续」文案说明卡牌阶段动作',
		/弃光手牌 → 摸 2 张/.test(pjs))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
