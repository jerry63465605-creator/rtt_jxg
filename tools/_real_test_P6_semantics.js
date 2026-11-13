/*
 * 【D1/P6】语义错位修正 —— 编号真实测试
 * ① 后续 mandatory 段不再弹「支付代价」窗口  ② 检视类 op 按 source 选牌堆
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_real_test_P6_semantics.js
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
	const card = String(id) + '#t' + Math.floor(Math.random() * 1e6)
	g.prelude.hands[g.current_nation].push(card)
	R.action(g, g.active, 'prelude_play_hand', { card: card })
	return card
}
function compileCfg(id) {
	const x = C.CARD_BY_ID[id]
	return P.compile({ id: x.id, nation: x.nation, deck: x.deck,
		type: x.type, name: x.name, text: x.text }).config
}
const segOps = cfg => cfg.segments.flatMap(s => s.steps)
const peekOps = cfg => segOps(cfg).filter(o => o.op === 'peek_reorder')

console.log('=== A. 编译层：检视来源被捕获 ===')
{
	const formal = [14900, 14907, 18412, 18004, 17204]
	const prelude = [14903, 17207]
	const discard = [14918]
	ok('★★ 5 张「检视牌堆」→ source=formal',
		formal.every(id => peekOps(compileCfg(id)).some(o => o.source === 'formal')),
		J(formal.map(id => [id, peekOps(compileCfg(id)).map(o => o.source)])))
	ok('★★ 2 张「检视前奏牌堆」→ source=prelude',
		prelude.every(id => peekOps(compileCfg(id)).some(o => o.source === 'prelude')),
		J(prelude.map(id => [id, peekOps(compileCfg(id)).map(o => o.source)])))
	ok('★★ 14918「检视弃牌堆」→ source=discard',
		peekOps(compileCfg(14918)).some(o => o.source === 'discard'),
		J(peekOps(compileCfg(14918))))
	ok('★ 全部 8 张检视 op 都有合法 source（无遗漏）',
		[...formal, ...prelude, ...discard].every(id =>
			peekOps(compileCfg(id)).every(o =>
				['formal', 'prelude', 'discard'].indexOf(o.source) >= 0)))
	ok('★ n 参数仍正确（18412 检视前 10 张）',
		peekOps(compileCfg(18412))[0].n === 10, J(peekOps(compileCfg(18412))))
	const bad = {
		id: 90081, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
		name: '缺来源', tokens: ['获得1分'],
	}
	const ir = P.compile(bad)
	ir.config.segments[0].steps.push({ op: 'peek_reorder', n: 2 })
	ok('★★ validate 拒绝缺 source 的检视 op',
		!P.validate(bad, ir).ok &&
		P.validate(bad, ir).errors.some(e => /缺少合法 source/.test(e)),
		J(P.validate(bad, ir).errors))
	const good = {
		id: 90082, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
		name: '有来源', tokens: ['获得1分'],
	}
	const ir2 = P.compile(good)
	ir2.config.segments[0].steps.push({ op: 'peek_reorder', source: 'formal', n: 2 })
	ok('★ 带合法 source 的检视 op 通过校验', P.validate(good, ir2).ok)
}

console.log('\n=== B. 后续 mandatory 段直接执行，不再弹支付窗口 ===')
{
	const g = started()
	play(g, 14905)      /* 四年计划：seg1 是 mandatory [紧张度+1] */
	ok('★★ 14905 打出后无「支付代价」段窗口',
		!(g.prelude && g.prelude.pending), J(g.prelude && g.prelude.pending))
	ok('★★ 第二段必付紧张度已执行（全局 tension=1）',
		g.prelude.tension === 1, g.prelude.tension)
	ok('★ 日志无「决定是否支付后续段代价」',
		!(g.log || []).some(l => /决定是否支付后续段代价/.test(l)))
	const g2 = started()
	/* play_response 的候选来自正式手牌里的响应卡，需先摆好 */
	g2.hands[g2.current_nation] = g2.hands[g2.current_nation] || []
	g2.hands[g2.current_nation].push('15328#probe')
	play(g2, 18404)     /* 黑龙会：seg1 mandatory 里含 play_response */
	ok('★★ 18404 第二段直接执行并落到 play_response 选牌窗口',
		!(g2.prelude && g2.prelude.pending) &&
		!!(g2.prelude && g2.prelude.op_window &&
			g2.prelude.op_window.op.op === 'play_response'),
		J({ pending: g2.prelude.pending, win: g2.prelude.op_window }))
	const g3 = started()
	play(g3, 14900)     /* 德奥合并：seg1 是 optional，仍应开窗 */
	ok('★★ B 段 optional 仍照常开窗（不回归）',
		!!(g3.prelude && g3.prelude.pending &&
			g3.prelude.pending.segments[0].kind === 'optional'),
		J(g3.prelude && g3.prelude.pending))
}

console.log('\n=== C. 检视窗口按 source 取候选 / 执行 ===')
{
	/*
	 * 14918 是 type=ARMAMENT，P5 起打出即暗置留场（符合玩家口径），
	 * 检视窗口要到正式局触发时才出现。这里摆好该窗口作为初始局面，
	 * 再用真实 R.action 答复，验证执行侧按 source 操作【正式弃牌堆】。
	 */
	const g = started()
	const n = g.current_nation
	g.discard[n] = ['15300#d1', '15300#d2', '15300#d3']
	const cfg18 = compileCfg(14918)
	const op18 = cfg18.segments[0].steps[0]
	g.prelude.op_window = {
		nation: n, owner: n, kind: 'card',
		candidates: g.discard[n].map(id => ({ id: id, name: String(id) })),
		op: op18, seg: cfg18.segments[0], pendingOps: [], desc: '检视弃牌堆',
	}
	ok('★★ 弃牌堆检视 op 的 source=discard 且窗口 kind=card',
		op18.source === 'discard' && g.prelude.op_window.kind === 'card',
		J({ src: op18.source, kind: g.prelude.op_window.kind }))
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	R.action(g, side, 'prelude_op_pick', { pick: '15300#d1' })
	ok('★★ 选中后从正式弃牌堆取回手牌（不是前奏牌堆）',
		(g.hands[n] || []).indexOf('15300#d1') >= 0 &&
		(g.discard[n] || []).indexOf('15300#d1') < 0 &&
		(g.prelude.discard[n] || []).indexOf('15300#d1') < 0,
		J({ hand: (g.hands[n] || []).slice(-2), disc: g.discard[n] }))

	/* 14900：B 段 formal 检视，答完应改 game.decks 而非 p.decks */
	const g2 = started()
	const n2 = g2.current_nation
	/* 摆 5 张：把顶 3 张移到底后顺序确实会变（3 张时等于没变，测不出重排） */
	g2.decks[n2] = ['15400#f1', '15400#f2', '15400#f3', '15400#f4', '15400#f5']
	g2.prelude.decks[n2] = ['15400#p1', '15400#p2', '15400#p3', '15400#p4', '15400#p5']
	/* 【D1/P16】只留 1 张前奏手牌：14900 A 段的 play_prelude 直接打、不弹
	 * 选牌窗口，保持本组对 B 段 formal 检视 choice 的验证焦点。 */
	g2.prelude.hands[n2] = ['18416#h1']
	play(g2, 14900)
	const segSide = ['Axis', 'Allies'].find(s => (R.view(g2, s).actions || {}).prelude_pay)
	ok('★ 14900 B 段窗口可答复', !!segSide, segSide)
	R.action(g2, segSide, 'prelude_pay', {})
	const w2 = g2.prelude && g2.prelude.op_window
	ok('★★ formal 检视仍走 choice（顶/底）且 source=formal',
		!!w2 && w2.kind === 'choice' && w2.op.source === 'formal',
		J(w2 && { kind: w2.kind, src: w2.op.source }))
	const pickSide = ['Axis', 'Allies'].find(s => (R.view(g2, s).actions || {}).prelude_op_pick)
	R.action(g2, pickSide, 'prelude_op_pick', { pick: 'bottom' })
	/* 卡牌阶段推进本身会从前奏牌堆摸 2 张，故不断言「前奏牌堆完全不变」，
	 * 只断言：正式牌堆被重排，且前奏牌堆没有串入正式牌。 */
	ok('★★ 重排只改正式牌堆（顶 3 张移到底），前奏牌堆不串牌',
		g2.decks[n2][0] === '15400#f4' &&
		g2.decks[n2][g2.decks[n2].length - 1] === '15400#f3' &&
		(g2.log || []).some(l => /牌堆顶 3 张移到牌堆底/.test(l)) &&
		!(g2.prelude.decks[n2] || []).some(x => String(x).indexOf('15400#f') === 0),
		J({ formal: g2.decks[n2], prelude: g2.prelude.decks[n2] }))
}

console.log('\n=== D. source=prelude 与 ops 排队续跑 ===')
{
	const g = started()
	const n = g.current_nation
	/* 【D1/P14】14903 检视【整堆】：摆 6 张（4 张军备卡 + 2 张非军备），
	 * 旧的「默认只取前 3 张」会漏掉第 5 张军备卡。 */
	/* 18416/14921 都是 type=ARMAMENT；非军备卡须用 14900（type=PRELUDE） */
	g.prelude.decks[n] = ['18416#p1', '18416#p2', '18416#p3',
		'14900#p4', '18416#p5', '14900#p6']
	play(g, 14903)      /* seg0: silent peek_reorder + peek_and_play；seg1: opponentOptOut */
	const w = g.prelude && g.prelude.op_window
	ok('★ 14903 首个窗口是单一检视选牌 card 窗口（P14，不再弹顶/底 choice）',
		!!w && w.kind === 'card' && w.op.op === 'peek_and_play' &&
		w.op.source === 'prelude' && w.inspect === true,
		J(w && { kind: w.kind, op: w.op.op, inspect: w.inspect }))
	ok('★★ 候选来自整堆（4 张军备卡全在，含第 5 张，且带卡图信息）',
		!!w && w.candidates.length === 4 &&
		w.candidates.every(c => String(c.id).indexOf('18416#') === 0) &&
		w.candidates.some(c => c.id === '18416#p5') &&
		w.candidates.every(c => c.img && c.type),
		J(w && w.candidates))
	const s1 = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	R.action(g, s1, 'prelude_op_pick', { pick: '18416#p1' })
	ok('★ 选牌后窗口清空、C 段反制窗口仍在（段级答复不丢）',
		!(g.prelude && g.prelude.op_window) &&
		!!(g.prelude && g.prelude.pending &&
			g.prelude.pending.segments[0].kind === 'opponentOptOut'),
		J(g.prelude && g.prelude.pending))
}

console.log('\n=== E. 静态守卫与覆盖率 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ 窗口 kind 唯一判定点存在', /function prelude_op_window_kind\(op\)/.test(src))
	ok('★★ 5 处引用全部改用 helper（仅 helper 内部保留 1 处索引）',
		(src.match(/prelude_op_window_kind\(/g) || []).length >= 6 &&
		(src.match(/PRELUDE_OP_WINDOW\[/g) || []).length === 1)
	ok('★ 检视牌堆来源 helper 成对（get/set）',
		/function prelude_peek_array/.test(src) && /function prelude_peek_set/.test(src))
	ok('★ 后续 mandatory 段直接执行 + 段窗口防御跳过',
		/seg\.kind !== 'mandatory'/.test(src) &&
		/pend\.segments\[0\]\.kind === 'mandatory'/.test(src))
	ok('★ afterSegs 排队机制存在', /w\.afterSegs \|\| \[\]/.test(src))
	const pcsrc = fs.readFileSync(path.join(MOD, 'prelude_compiler.js'), 'utf8')
	ok('★ 编译层两条检视规则都带 source 捕获',
		(pcsrc.match(/source: m\[1\]/g) || []).length >= 2 &&
		/'formal'/.test(pcsrc) && /'prelude'/.test(pcsrc) && /'discard'/.test(pcsrc))
	ok('★ validate 有 source 合法性校验', /缺少合法 source/.test(pcsrc))
	const texts = C.CARDS.filter(x => x.deck === 'PRELUDE' || x.deck === 'ARMAMENT' ||
		x.type === 'PRELUDE' || x.type === 'ARMAMENT').map(x => x.text)
	const cov = P.coverage(texts)
	ok('★★ 官方 125 张覆盖率仍 100%、方括号零遗漏',
		cov.rate === 1 && cov.unmatchedBracket.length === 0 &&
		cov.unmatchedAction.length === 0,
		J({ total: cov.total, hit: cov.hit, noise: cov.noise }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
