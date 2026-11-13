/*
 * 【D1/P14】检视类对齐 15229：整堆候选 + 单一选牌窗口 + 卡图 modal
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_real_test_P14_inspect_ui.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const C = require(path.join(MOD, 'cards.js'))
const P = require(path.join(MOD, 'prelude_compiler.js'))
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
const segOps = cfg => cfg.segments.reduce((a, s) => a.concat(s.steps || []), [])
const cfgOf = id => {
	const x = C.CARD_BY_ID[id]
	return P.compile({ id: x.id, nation: x.nation, deck: x.deck,
		type: x.type, name: x.name, text: x.text }).config
}

console.log('=== A. 编译层：检视+选牌收口、整堆标记 ===')
{
	const c14903 = segOps(cfgOf(14903))
	ok('★★ 14903 的 peek_reorder 标记 silent（不再开顶/底窗口）',
		c14903.some(o => o.op === 'peek_reorder' && o.silent === true),
		J(c14903))
	ok('★★ 14903 的 peek_and_play.peek_scope = null（整堆，不再默认 3）',
		c14903.some(o => o.op === 'peek_and_play' && o.peek_scope === null),
		J(c14903))
	ok('★★ 14907/18412 卡面明写「前 10 张」仍保留 peek_scope=10',
		segOps(cfgOf(14907)).some(o => o.op === 'peek_and_play' && o.peek_scope === 10) &&
		segOps(cfgOf(18412)).some(o => o.op === 'play_response' && o.peek_scope === 10),
		J(segOps(cfgOf(18412))))
	ok('★★ 18300 无后续选牌 op → 不标 silent（排序窗口保留）',
		!segOps(cfgOf(18300)).some(o => o.silent),
		J(segOps(cfgOf(18300))))
}

console.log('\n=== B. 14903：单一检视选牌窗口 + 整堆候选 ===')
{
	const g = started()
	const n = g.current_nation
	/* 6 张里 4 张军备卡（含第 5 张），2 张非军备；整堆才不会漏 */
	g.prelude.decks[n] = ['18416#p1', '18416#p2', '18416#p3',
		'14900#p4', '18416#p5', '14900#p6']
	g.prelude.hands[n].push('14903#t1')
	R.action(g, g.active, 'prelude_play_hand', { card: '14903#t1' })
	const w = g.prelude.op_window
	ok('★★ 打出后只有 1 个窗口，且是 card 检视选牌（无前置 choice）',
		!!w && w.kind === 'card' && w.op.op === 'peek_and_play' &&
		w.inspect === true && !(g.log || []).some(l => /等待.*选择：peek_reorder/.test(l)),
		J(w && { kind: w.kind, op: w.op.op, inspect: w.inspect }))
	ok('★★ 候选来自整堆：4 张军备卡全在（含第 5 张），非军备被筛掉',
		!!w && w.candidates.length === 4 &&
		w.candidates.every(c => String(c.id).indexOf('18416#') === 0) &&
		w.candidates.some(c => c.id === '18416#p5'),
		J(w && w.candidates.map(c => c.id)))
	ok('★★ 候选带真实卡图信息 img/type/text（15229 card_info 同款）',
		!!w && w.candidates.every(c => c.img && c.type && c.name && c.text != null),
		J(w && w.candidates[0]))
	ok('★ 窗口标记不可放弃、需选 1 张',
		w.cancellable === false && w.need === 1,
		J({ cancellable: w && w.cancellable, need: w && w.need }))
}

console.log('\n=== C. 双门禁 + view 下发 ===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.decks[n] = ['18416#p1', '14900#p2', '18416#p3']
	g.prelude.hands[n].push('14903#t1')
	R.action(g, g.active, 'prelude_play_hand', { card: '14903#t1' })
	const v = R.view(g, g.active)
	ok('★★ view.prelude.op_window 下发 inspect / cancellable / need',
		v.prelude.op_window.inspect === true &&
		v.prelude.op_window.cancellable === false &&
		v.prelude.op_window.need === 1,
		J(v.prelude.op_window))
	ok('★★ 双门禁之一：检视窗口不下发 prelude_op_skip',
		!!v.actions.prelude_op_pick && !v.actions.prelude_op_skip,
		J(Object.keys(v.actions).filter(k => k.indexOf('prelude_') === 0)))
	/* 双门禁之二：服务端也拒绝放弃 */
	const before = g.prelude.op_window
	R.action(g, g.active, 'prelude_op_skip', {})
	ok('★★ 双门禁之二：服务端拒绝放弃检视窗口（窗口仍在）',
		g.prelude.op_window === before &&
		(g.log || []).some(l => /检视窗口不可放弃/.test(l)),
		J((g.log || []).slice(-2)))
	const side = pickSide(g)
	R.action(g, side, 'prelude_op_pick', { pick: '18416#p1' })
	ok('★★ 选中后窗口清空、军备卡暗置留场（P5 口径不变）',
		!g.prelude.op_window &&
		(g.table_responses || []).some(x => x.card_id === '18416#p1'),
		J({ win: g.prelude.op_window,
			table: (g.table_responses || []).map(x => x.card_id) }))
}

console.log('\n=== D. 空候选：跳过该段、留日志、不卡死 ===')
{
	const g = started()
	const n = g.current_nation
	/* 整堆全是 PRELUDE，0 张军备卡 */
	g.prelude.decks[n] = ['14900#p1', '14900#p2', '14900#p3', '14900#p4']
	g.prelude.hands[n].push('14903#t1')
	const l0 = g.log.length
	R.action(g, g.active, 'prelude_play_hand', { card: '14903#t1' })
	ok('★★ 不建选牌窗口（不卡死）', !g.prelude.op_window,
		J(g.prelude.op_window))
	ok('★★ 留下「整堆无符合条件的牌，跳过该段」日志',
		(g.log || []).slice(l0).some(l => /整堆无符合条件的牌，跳过该段/.test(l)),
		J((g.log || []).slice(l0)))
	ok('★★ C 段反制窗口仍在，答完能继续推进（不死锁）',
		!!(g.prelude.pending && g.prelude.pending.answerNation === '英国'),
		J(g.prelude.pending && g.prelude.pending.answerNation))
	const foe = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_skip)
	R.action(g, foe, 'prelude_skip', {})
	/* 【D1/P16】不支付后 C 段的 play_prelude 会开选牌窗口（多张手牌时），
	 * 答完它才算流程走通。 */
	let guard = 0
	while (g.prelude.op_window && guard++ < 5) {
		const ow = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
		const cand = ow && (g.prelude.op_window.candidates || [])[0]
		if (!cand) break
		R.action(g, ow, 'prelude_op_pick', { pick: cand.id })
	}
	ok('★★ 答完段窗口后进入卡牌阶段（流程走通）',
		!g.prelude.pending && g.prelude.phase === 'prelude_cards',
		J({ pending: g.prelude.pending, phase: g.prelude.phase }))
}

console.log('\n=== E. 不回归：排序窗口 / 前 N 张 / 弃牌堆整堆 ===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.decks[n] = ['15400#p1', '15400#p2', '15400#p3', '15400#p4']
	g.prelude.hands[n].push('18300#t1')
	R.action(g, g.active, 'prelude_play_hand', { card: '18300#t1' })
	const w = g.prelude.op_window
	ok('★★ 18300 仍是 choice 排序窗口（顶/底/自定义）', !!w &&
		w.kind === 'choice' && w.op.op === 'peek_reorder' &&
		['top', 'bottom', 'custom'].every(id =>
			w.candidates.some(c => c.id === id)),
		J(w && { kind: w.kind, cands: w.candidates.map(c => c.id) }))
	ok('★ 14907 卡面「前 10 张」仍按 10 取（不是整堆默认值）',
		segOps(cfgOf(14907)).some(o => o.op === 'peek_reorder' && o.n === 10),
		J(segOps(cfgOf(14907))[0]))
	ok('★ 14918 弃牌堆检视 n=null → 整堆（card 窗口）',
		segOps(cfgOf(14918)).some(o => o.op === 'peek_reorder' &&
			o.source === 'discard' && o.n === null),
		J(segOps(cfgOf(14918))))
}

console.log('\n=== F. 静态守卫（客户端 15229 同款 UI）===')
{
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ 独立前奏检视 modal（不复用正式 script_modal）',
		/id="prelude_peek_modal"/.test(phtml) &&
		/id="prelude_peek_grid" class="card-grid"/.test(phtml) &&
		!/prelude_peek_cancel/.test(phtml))
	ok('★★ modal 用 card_elt 真实卡图 + .sel 高亮 + 0/N + 确认',
		/function update_prelude_peek_modal\(\)/.test(pjs) &&
		/card_elt\(c, \(\) =>/.test(pjs) &&
		/classList\.toggle\("sel"/.test(pjs) &&
		/prelude_peek_note/.test(pjs) &&
		/function confirm_prelude_peek\(\)/.test(pjs))
	ok('★★ 检视窗口在浮动面板不出候选按钮、不渲染放弃',
		/p\.op_window && p\.op_window\.inspect/.test(pjs) &&
		/请在检视弹窗中选择一张牌（不可放弃）/.test(pjs))
	ok('★★ update_map 每帧刷新检视弹窗',
		/update_prelude_peek_modal\(\)/.test(pjs))
	ok('★★ 弃牌选牌窗口判断兼容字符串 op（修 P4/P12 遗留 bug）',
		/typeof pw\.op === "string" \? pw\.op/.test(pjs))
	ok('★ 引擎侧整堆 / 检视类 / 空候选跳过段 三处唯一实现',
		/function prelude_peek_count\(/.test(src) &&
		/function prelude_inspect_op\(/.test(src) &&
		/整堆无符合条件的牌，跳过该段/.test(src) &&
		/inspect: insp, cancellable: !insp/.test(src))
	const vers = (phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	ok('★ 版本串统一且非空',
		vers.length >= 5 && vers.every(v => v && v === vers[0]), vers)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
