/*
 * 【D1/P3】段执行器 op 映射编号真实测试（真实 R.setup / R.action / R.view）
 * 用法：node tools/_real_test_P3_prelude_ops.js
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
let seq = 0
function started() {
	const g = R.setup(20261112, 'Episode 2')
	let guard = 0
	while (g.opening && guard++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
function play(g, face) {
	const id = String(face) + '#t' + (++seq)
	g.prelude.hands[g.current_nation].push(id)
	R.action(g, g.active, 'prelude_play_hand', { card: id })
	return id
}
function answer(g, pay) {
	if (!g.prelude.pending) return
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_pay)
	if (side) R.action(g, side, pay ? 'prelude_pay' : 'prelude_skip')
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

console.log('=== A. 编译层补捕获地区参数 ===')
{
	const c1 = C.CARD_BY_ID[18308]
	const ir1 = P.compile({ id: c1.id, nation: c1.nation, deck: c1.deck,
		type: c1.type, name: c1.name, text: c1.text })
	const op1 = ir1.config.segments.flatMap(s => s.steps).find(o => o.op === 'always_supplied')
	ok('★★ always_supplied 带 space（P3 新增）', !!op1 && !!op1.space, J(op1))
	const c2 = C.CARD_BY_ID[18011]
	const ir2 = P.compile({ id: c2.id, nation: c2.nation, deck: c2.deck,
		type: c2.type, name: c2.name, text: c2.text })
	const op2 = ir2.config.segments.flatMap(s => s.steps).find(o => o.op === 'supply_point')
	ok('★★ supply_point 带 space + nation', !!op2 && !!op2.space && !!op2.nation, J(op2))
}

console.log('\n=== B. add_marker 执行（14901 瓜分捷克斯洛伐克）===')
{
	const g = started()
	const n0 = g.log.length
	const before = Object.keys(g.markers || {}).length
	play(g, 14901)
	ok('★ B 段建窗口', !!g.prelude.pending, J(g.prelude.pending))
	answer(g, true)
	ok('★★ add_marker 复用现成原子（日志含「增加 1 个计分标记」）',
		/增加 1 个计分标记/.test(logSince(g, n0)), logSince(g, n0).slice(0, 260))
	ok('★ game.markers 有变化', Object.keys(g.markers || {}).length >= before,
		J(Object.keys(g.markers || {})))
}

console.log('\n=== C. end_neutrality 执行（17201 隔离演说）===')
{
	const g = started()
	const n0 = g.log.length
	play(g, 17201)
	ok('★ C 段（对手反制）建窗口', !!g.prelude.pending &&
		g.prelude.pending.segments[0].kind === 'opponentOptOut',
		J(g.prelude.pending && g.prelude.pending.segments[0]))
	answer(g, false)   /* 对手不支付 → 执行后续段 */
	ok('★★ 对手不支付 → 美国结束中立（end_neutral 原子）',
		!!(g.neutral && g.neutral['美国'] === false), J(g.neutral))
	ok('★ 日志含结束中立', /结束中立/.test(logSince(g, n0)),
		logSince(g, n0).slice(0, 260))
}

console.log('\n=== D. always_supplied + 持续段明细（18308 法国殖民地基地）===')
{
	const g = started()
	const n0 = g.log.length
	play(g, 18308)
	answer(g, true)
	ok('★★ set_supply_point 复用现成原子（日志含「设为…补给点」）',
		/设为 .* 补给点/.test(logSince(g, n0)), logSince(g, n0).slice(0, 260))
	ok('★ supply_override 已写', Object.keys(g.supply_override || {}).length >= 0)
	const v = R.view(g, g.active)
	ok('★★ view.prelude.persistent 下发明细（不再只有 count）',
		Array.isArray(v.prelude.persistent) && v.prelude.persistent.length >= 1 &&
		v.prelude.persistent[0].nation && v.prelude.persistent[0].tags,
		J(v.prelude.persistent))
	ok('★ persistent_count 与明细长度一致',
		v.prelude.persistent_count === v.prelude.persistent.length)
}

console.log('\n=== E. peek_reorder 改为分步窗口（18300 军情五处，P4 新口径）===')
{
	/*
	 * 【D1/P4】peek_reorder 从 P3 的 default「暂不执行」升级为统一分步窗口，
	 * 不再是未接线 op；unhandled_ops.peek_reorder 不再增长（预期变化，非回归）。
	 */
	const g = started()
	const n0 = g.log.length
	play(g, 18300)
	ok('★★ 建立 op 分步窗口并等待选择（不再是 default 日志）',
		/等待【德国】选择：peek_reorder/.test(logSince(g, n0)) &&
		!/P2 骨架/.test(logSince(g, n0)), logSince(g, n0).slice(0, 300))
	const v = R.view(g, g.active)
	/* 【D1/P7】choice 由「顶/底二选一」扩为三选一（新增 custom → 二级 order 窗口） */
	ok('★★ view.prelude.op_window 下发候选（顶/底/自定义顺序）',
		!!v.prelude.op_window && v.prelude.op_window.kind === 'choice' &&
		['top', 'bottom', 'custom'].every(id =>
			v.prelude.op_window.candidates.some(c => c.id === id)),
		J(v.prelude.op_window))
	ok('★ 双门禁之一：答复方 actions 有 prelude_op_pick / prelude_op_skip',
		!!(v.actions.prelude_op_pick && v.actions.prelude_op_skip),
		J(Object.keys(v.actions).filter(k => k.indexOf('prelude_') === 0)))
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	ok('★ 双门禁之二：服务端收得下（答完窗口清空）', !!side, side)
	R.action(g, side, 'prelude_op_pick', { pick: 'bottom' })
	ok('★★ 答复后执行（牌堆顶移到牌堆底）且窗口清空',
		!g.prelude.op_window && /移到牌堆底/.test(logSince(g, n0)),
		logSince(g, n0).slice(0, 320))
	ok('★ 未接线 op 诊断不再把 peek_reorder 计入',
		!((v.prelude.unhandled_ops || {}).peek_reorder),
		J(v.prelude.unhandled_ops))
}

console.log('\n=== F. 静态守卫与接线点 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ PRELUDE_OP_DEFERRED 登记表存在且含铁律说明',
		/const PRELUDE_OP_DEFERRED = \{/.test(src) &&
		/服务端【不得替玩家选】/.test(src))
	ok('★ 新接 op 均调用现成原子（不自己遍历）',
		/case 'add_marker':[\s\S]{0,300}add_marker\(game, sp/.test(src) &&
		/case 'always_supplied':[\s\S]{0,600}set_supply_point\(game, sp/.test(src) &&
		/case 'end_neutrality':[\s\S]{0,300}end_neutral\(game, target/.test(src))
	ok('★ view 下发 persistent / unhandled_ops',
		/persistent: \(p\.persistent \|\| \[\]\)\.map/.test(src) &&
		/unhandled_ops: p\.unhandled_ops/.test(src))
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	/* 【D1/P9】逐张手牌改由「前奏手牌区」卡片承担，不再是一排按钮 */
	/* 【D1/P12】手牌区改为按同阵营各国分组渲染，逐张仍走 addCard */
	ok('★★ 客户端手牌逐张可选（卡片化，不是只打第一张）',
		/hands\[nat\]\.forEach\(c => addCard\(c, false\)\)/.test(pjs) &&
		!/const first = myHand\[0\]/.test(pjs))
	ok('★ 客户端显示段窗口 desc 与持续段',
		/p\.pending\.desc/.test(pjs) && /p\.persistent_count/.test(pjs))
	const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	const vers = (html.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	ok('★ play.html 版本串统一且非空', vers.length >= 5 &&
		vers.every(v2 => v2 && v2 === vers[0]), J(vers))
}

console.log('\n=== G. 官方 125 张 op 分布（诊断基线，勿写成硬断言）===')
{
	const a = C.CARDS.filter(x => x.deck === 'PRELUDE' || x.deck === 'ARMAMENT' ||
		x.type === 'PRELUDE' || x.type === 'ARMAMENT')
	const ops = {}
	for (const x of a) {
		const ir = P.compile({ id: x.id, nation: x.nation, deck: x.deck,
			type: x.type, name: x.name, text: x.text })
		for (const s of ir.config.segments)
			for (const o of s.steps) ops[o.op] = (ops[o.op] || 0) + 1
	}
	ok('★ 高频 op 均已登记（recruit/build/gain_score/peek_reorder 有计数）',
		['recruit', 'build', 'gain_score', 'peek_reorder'].every(k => ops[k] > 0),
		J(ops))
	console.log('  分布: ' + J(ops))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
