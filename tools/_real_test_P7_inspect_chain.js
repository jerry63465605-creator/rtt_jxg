/*
 * 【D1/P7】检视链路补全 + 自定义排序 —— 编号真实测试
 * 真实 R.setup / R.action / R.view 驱动；只用工具摆好初始牌堆，不手写结算结果。
 * 用法：node tools/_real_test_P7_inspect_chain.js
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
	const card = String(id) + '#t7'
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

console.log('=== A. 编译层：检视 source 传播到同段后续 op ===')
{
	const a = segOps(cfgOf(18412))
	const b = segOps(cfgOf(14907))
	const c = segOps(cfgOf(18004))
	const d = segOps(cfgOf(14903))
	ok('★★ 18412 play_response 继承 formal',
		a.some(o => o.op === 'play_response' && o.source === 'formal'), J(a))
	/* 【D1/P18】14907「选状态卡打出 / 选其它牌置入手牌」是二选一，
	 * 收口为单个 peek_and_play：不再排队 join_hand、不再按状态卡过滤。 */
	ok('★★ 14907 收口为单个 peek_and_play（无 join_hand、filter=null、pick_mode）',
		b.some(o => o.op === 'peek_and_play' && o.source === 'formal' &&
			o.filter === null && o.pick_mode === 'status_play_or_hand') &&
		!b.some(o => o.op === 'join_hand'), J(b))
	ok('★★ 18004 peek_and_play 继承 formal',
		c.some(o => o.op === 'peek_and_play' && o.source === 'formal'), J(c))
	ok('★★ 14903 检视前奏牌堆 → 后续 op 继承 prelude（不是 formal）',
		d.some(o => o.op === 'peek_and_play' && o.source === 'prelude'), J(d))
	/* 14900 的 B 段本身有「检视牌堆」，故只断言非检视类 op 不被误加 source */
	ok('★ 非检视类 op 不被误加 source / peek_scope',
		segOps(cfgOf(14900)).filter(o => o.op !== 'peek_reorder')
			.every(o => !o.source && o.peek_scope == null),
		J(segOps(cfgOf(14900))))
}

console.log('\n=== B. 18412：正式牌堆顶选响应卡 → 暗置留场 ===')
{
	const g = started()
	const n = g.current_nation
	g.decks[n] = ['15328#f1', '15300#f2', '15328#f3', '15300#f4']
	play(g, 18412)
	const w0 = win(g)
	/* 【D1/P14】检视+选牌收口：不再先弹顶/底 choice，直接是选牌窗口 */
	ok('★ 首个窗口是单一检视选牌 card 窗口（P14）', !!w0 &&
		w0.kind === 'card' && w0.op.op === 'play_response' &&
		w0.op.source === 'formal' && w0.inspect === true,
		J(w0 && { kind: w0.kind, op: w0.op.op, src: w0.op.source }))
	const w1 = w0
	ok('★★ 选牌窗口的 op 与来源正确', !!w1 &&
		w1.op.op === 'play_response' && w1.op.source === 'formal',
		J(w1 && w1.op))
	ok('★★ 候选来自正式牌堆顶（含 2 张响应卡，不含非响应卡）',
		!!w1 && w1.candidates.length === 2 &&
		w1.candidates.every(c => String(c.id).indexOf('15328#') === 0),
		J(w1 && w1.candidates))
	const s1 = pickSide(g)
	const n0 = g.log.length
	R.action(g, s1, 'prelude_op_pick', { pick: '15328#f1' })
	ok('★★ 选中后暗置到桌面且原牌离开正式牌堆',
		(g.table_responses || []).some(x => x.card_id === '15328#f1') &&
		g.decks[n].indexOf('15328#f1') < 0,
		J({ table: (g.table_responses || []).map(x => x.card_id), deck: g.decks[n] }))
	ok('★★ 牌名保密（暗置日志不含卡名）',
		!(g.log || []).slice(n0).some(l => /破译恩尼格码/.test(l)),
		(g.log || []).slice(n0).join(' | ').slice(0, 200))
}

console.log('\n=== C. 14907：正式牌堆选牌取回手牌 + join_hand 继承来源 ===')
{
	const g = started()
	const n = g.current_nation
	/* 【D1/P18】14907 无条件检视 10 张（不足则全部），候选是混合牌型；
	 * 选中状态卡→打出留场，选其它→加入手牌。 */
	g.decks[n] = ['15255#f1', '15300#b1', '15255#f2', '15328#r1', '15255#f3']
	play(g, 14907)
	/* 【D1/P14】收口后直接是 peek_and_play 选牌窗口，无前置 choice */
	const w1 = win(g)
	ok('★ 候选来自正式牌堆且包含全部牌型（不再只留状态卡）', !!w1 &&
		w1.op.op === 'peek_and_play' && w1.op.source === 'formal' &&
		w1.op.filter === null &&
		w1.op.pick_mode === 'status_play_or_hand' &&
		w1.candidates.length === 5 &&
		w1.candidates.some(c => c.id === '15300#b1') &&
		w1.candidates.some(c => c.id === '15328#r1'),
		J(w1 && { filter: w1.op.filter, cands: w1.candidates.map(c => c.id) }))
	const before = (g.hands[n] || []).length
	const s1 = pickSide(g)
	R.action(g, s1, 'prelude_op_pick', { pick: '15255#f2' })
	ok('★★ 选中的状态卡明置留场（不触发正式效果、不进手牌）',
		(g.table[n] || []).indexOf('15255#f2') >= 0 &&
		(g.hands[n] || []).indexOf('15255#f2') < 0 &&
		g.decks[n].indexOf('15255#f2') < 0 &&
		(g.log || []).some(l => /打出 1 张状态卡于桌面留场/.test(l)),
		J({ table: g.table[n], hand: (g.hands[n] || []).slice(-3), deck: g.decks[n] }))
	/* 【D1/P18】二选一收口后不再有 join_hand 排队，选一张就结束，不多取牌 */
	ok('★★ 无 join_hand 排队：正式手牌不增、其余牌留在牌堆',
		(g.hands[n] || []).length === before &&
		(g.decks[n] || []).length === 4 &&
		!(g.log || []).some(l => /从正式牌堆取 1 张牌加入手牌/.test(l)),
		J({ hand: (g.hands[n] || []).length, deck: g.decks[n],
			log: (g.log || []).slice(-4) }))
}

console.log('\n=== D. order kind：custom → 二级窗口 → 自定义顺序重排 ===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.decks[n] = ['15400#p1', '15400#p2', '15400#p3', '15400#p4', '15400#p5']
	play(g, 18300)
	const w0 = win(g)
	ok('★★ choice 有 top / bottom / custom 三项', !!w0 &&
		['top', 'bottom', 'custom'].every(id =>
			w0.candidates.some(c => c.id === id)), J(w0 && w0.candidates))
	const s0 = pickSide(g)
	R.action(g, s0, 'prelude_op_pick', { pick: 'custom' })
	const w1 = win(g)
	ok('★★ custom 开出二级 order 窗口（未被答复流程清掉）',
		!!w1 && w1.kind === 'order' && w1.candidates.length === 3,
		J(w1 && { kind: w1.kind, n: w1.candidates.length, desc: w1.desc }))
	/* 【D1/P12】打出牌后不再摸牌，牌堆仍是 p1..p5，候选与牌堆同源 */
	const s1 = pickSide(g)
	R.action(g, s1, 'prelude_op_pick', { order: ['15400#p3', '15400#p1'] })
	ok('★★ 部分自定义顺序生效：p3,p1 置顶、p2 保持其后',
		g.prelude.decks[n].slice(0, 3).join(',') ===
			'15400#p3,15400#p1,15400#p2',
		J(g.prelude.decks[n]))
	ok('★★ 排序后窗口清空、阶段继续', !win(g), J(win(g)))
}

console.log('\n=== E. order 非法答复被拒（不越权重排）===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.decks[n] = ['15400#p1', '15400#p2', '15400#p3', '15400#p4']
	play(g, 18300)
	R.action(g, pickSide(g), 'prelude_op_pick', { pick: 'custom' })
	const before = (g.prelude.decks[n] || []).join(',')
	R.action(g, pickSide(g), 'prelude_op_pick',
		{ order: ['NOT_A_CARD', '15400#p1'] })
	ok('★★ 含非法 id 的顺序被忽略、牌堆不变',
		(g.prelude.decks[n] || []).join(',') === before &&
		(g.log || []).some(l => /含非法或重复项/.test(l)),
		J({ deck: g.prelude.decks[n], tail: (g.log || []).slice(-3) }))
}

console.log('\n=== F. 后备区下发 / 多段防御 / 静态守卫 ===')
{
	const g = started()
	g.prelude.reserves[g.current_nation] = 2
	const v = R.view(g, g.active)
	ok('★★ view.prelude.reserves 下发按国记账',
		(v.prelude.reserves || {})[g.current_nation] === 2,
		J(v.prelude.reserves))
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	/* 【D1/P8】防御日志升级为「后续段非窗口 op 一并执行、窗口 op 留给 defer」 */
	ok('★★ 多段军备卡后续段非窗口 op 一并执行、窗口 op 留给 defer',
		/后续段非窗口 op/.test(src) && /defer 续打待接入/.test(src))
	const pcsrc = fs.readFileSync(path.join(MOD, 'prelude_compiler.js'), 'utf8')
	ok('★ source 传播与 order 重排均有唯一实现点',
		/const peek = \(s\.steps \|\| \[\]\)\.find/.test(pcsrc) &&
		/op\.peek_scope = peek\.n/.test(pcsrc) &&
		/w\.kind === 'order'/.test(src))
	ok('★ 正式牌不擅自触发 card_effect_of',
		/不自动打出正式卡/.test(src) &&
		!/prelude_apply_op_choice[\s\S]{0,2000}card_effect_of\(/.test(src))
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('★ 客户端渲染 order 排序与后备区',
		/kind === "order"/.test(pjs) && /p\.reserves \|\| \{\}/.test(pjs))
	const texts = C.CARDS.filter(x => x.deck === 'PRELUDE' || x.deck === 'ARMAMENT' ||
		x.type === 'PRELUDE' || x.type === 'ARMAMENT').map(x => x.text)
	const cov = P.coverage(texts)
	ok('★★ 官方 125 张覆盖率仍 100%', cov.rate === 1 &&
		cov.unmatchedBracket.length === 0 && cov.unmatchedAction.length === 0,
		J({ total: cov.total, hit: cov.hit, noise: cov.noise }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
