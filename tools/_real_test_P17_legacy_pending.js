/*
 * 【D1/P17】旧存档兼容：P16 之前建立的段窗口缺 opponentDiscard
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_real_test_P17_legacy_pending.js
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
/* 走到 14903 C 段，然后删掉 opponentDiscard 模拟 P16 之前的旧存档 */
function legacyPending() {
	const g = started()
	const de = g.current_nation
	g.prelude.decks[de] = ['18416#p1', '18416#p2', '18416#p3']
	g.prelude.hands[de] = ['14903#t1', '18416#h1', '18416#h2']
	R.action(g, g.active, 'prelude_play_hand', { card: '14903#t1' })
	const w = g.prelude.op_window
	if (w && w.candidates && w.candidates.length) {
		const s = ['Axis', 'Allies'].find(x => (R.view(g, x).actions || {}).prelude_op_pick)
		R.action(g, s, 'prelude_op_pick', { pick: w.candidates[0].id })
	}
	if (!g.prelude.pending) return null
	delete g.prelude.pending.opponentDiscard
	return g
}

console.log('=== A. 旧存档：view 惰性补建候选（根因修复）===')
{
	const g = legacyPending()
	ok('★ 成功构造旧存档（有 C 段窗口、无 opponentDiscard）',
		!!g && !!g.prelude.pending && !g.prelude.pending.opponentDiscard &&
		g.prelude.pending.segments[0].opponentCost.discard === 2,
		J(g && g.prelude.pending && g.prelude.pending.opponentDiscard))
	const vUK = R.view(g, 'Allies')
	const od = vUK.prelude.pending && vUK.prelude.pending.opponentDiscard
	ok('★★ Allies 视角拿到 opponentDiscard（need=2、7 张正式手牌带卡图）',
		!!od && od.nation === '英国' && od.need === 2 &&
		od.candidates.length === (g.hands['英国'] || []).length &&
		od.candidates.every(c => c.id && c.name && c.img && c.type),
		J(od && { need: od.need, n: od.candidates.length, first: od.candidates[0] }))
	ok('★★ Axis 视角仍为 null（牌面保密不变）',
		R.view(g, 'Axis').prelude.pending.opponentDiscard === null,
		J(R.view(g, 'Axis').prelude.pending.opponentDiscard))
	ok('★★ 补建结果写回 p.pending（随存档落盘）',
		!!g.prelude.pending.opponentDiscard,
		J(!!g.prelude.pending.opponentDiscard))
	ok('★ 白名单仍只给答复方 prelude_pay / prelude_skip',
		vUK.actions.prelude_pay === 1 && vUK.actions.prelude_skip === 1 &&
		!R.view(g, 'Axis').actions.prelude_pay,
		J(Object.keys(vUK.actions).filter(k => k.indexOf('prelude_') === 0)))
}

console.log('\n=== B. 幂等：重复 view 不重建候选对象 ===')
{
	const g = legacyPending()
	R.view(g, 'Allies')
	const first = g.prelude.pending.opponentDiscard
	R.view(g, 'Allies'); R.view(g, 'Axis'); R.view(g, 'Allies')
	ok('★★ 多次 view 后仍是同一个候选对象、数量不变',
		g.prelude.pending.opponentDiscard === first &&
		first.candidates.length === (g.hands['英国'] || []).length,
		J({ same: g.prelude.pending.opponentDiscard === first,
			n: first && first.candidates.length }))
	ok('★ 不因 view 反复补建而污染日志',
		(g.log || []).filter(l => /兼容旧存档/.test(l)).length === 0,
		J((g.log || []).filter(l => /兼容旧存档/.test(l)).length))
}

console.log('\n=== C. 旧存档下两种答复都能正常结算 ===')
{
	const g1 = legacyPending()
	R.view(g1, 'Allies')
	const ids = (g1.hands['英国'] || []).slice(0, 2)
	const hand0 = (g1.hands['英国'] || []).length
	const disc0 = (g1.discard['英国'] || []).length
	R.action(g1, 'Allies', 'prelude_pay', { cards: ids })
	ok('★★ 支付：英国弃 2 张进弃牌堆、段未执行、窗口清空、归还',
		(g1.hands['英国'] || []).length === hand0 - 2 &&
		(g1.discard['英国'] || []).length === disc0 + 2 &&
		!g1.prelude.pending &&
		(g1.log || []).some(l => /操作权归还/.test(l)),
		J({ hand: (g1.hands['英国'] || []).length,
			pending: !!g1.prelude.pending }))
	const g2 = legacyPending()
	R.view(g2, 'Allies')
	R.action(g2, 'Allies', 'prelude_skip', {})
	ok('★★ 不支付：段窗口清空、C 段 play_prelude 开选牌窗口（多张手牌）',
		!g2.prelude.pending &&
		!!(g2.prelude.op_window && g2.prelude.op_window.op.op === 'play_prelude'),
		J({ pending: !!g2.prelude.pending,
			win: g2.prelude.op_window && g2.prelude.op_window.op.op }))
}

console.log('\n=== D. 不误伤：无弃牌代价的段窗口 ===')
{
	const g = started()
	const de = g.current_nation
	/* 14900 B 段是 optional（代价=弃 1 张手牌），不是 opponentOptOut */
	g.prelude.hands[de] = ['14900#t1', '18416#h1']
	R.action(g, g.active, 'prelude_play_hand', { card: '14900#t1' })
	if (g.prelude.op_window) {
		const ow = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
		const cand = (g.prelude.op_window.candidates || [])[0]
		if (ow && cand) R.action(g, ow, 'prelude_op_pick', { pick: cand.id })
	}
	if (g.prelude.pending) delete g.prelude.pending.opponentDiscard
	R.view(g, 'Axis')
	ok('★★ optional 段窗口不被补建 opponentDiscard',
		!!(g.prelude.pending && !g.prelude.pending.opponentDiscard),
		J(g.prelude.pending && g.prelude.pending.opponentDiscard))
	ok('★ 该段窗口仍可用 prelude_pay{} 答复（P16 F 组口径不回归）',
		!!R.view(g, 'Axis').actions.prelude_pay,
		J(Object.keys(R.view(g, 'Axis').actions)))
}

console.log('\n=== E. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	/* 正则排除顶格的函数定义行，只数缩进的调用行 */
	ok('★★ 唯一补建 helper，且在 view 与段答复两处调用',
		(src.match(/function prelude_ensure_opponent_discard\(/g) || []).length === 1 &&
		(src.match(/^[ \t]+prelude_ensure_opponent_discard\(game\)/gm) || []).length === 2 &&
		/prelude: \(\(\) => \{[\s\S]{0,180}prelude_ensure_opponent_discard\(game\)/.test(src))
	ok('★★ helper 幂等（已有字段直接返回）且不写日志',
		/if \(pend\.opponentDiscard\) return pend\.opponentDiscard/.test(src) &&
		!/兼容旧存档：补建/.test(src))
	/* 【D1/P20】后续期因客户端改动 bump 过，这里只校验统一性 */
	ok('★ 版本串统一且非空（P17 当轮客户端零改动）',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v && v === (phtml.match(/\?v=([0-9a-z]+)/) || [])[1]),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
