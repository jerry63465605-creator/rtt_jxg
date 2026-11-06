/*
 * 15215《卓越规划》行为核查（真实盘面 + 真实动作）
 *
 * A 出牌阶段开始时能发动（armed 窗口），检视牌堆顶 5 张
 * B 只有持有方看得到 peek（对手 view 里没有）
 * C ★★ 提交 placement（置顶/置底 + 顺序）→ 牌堆顺序与提交完全一致
 * D ★ 非法 placement（改牌）被拒，且不破坏牌堆
 * E ★★ B19 交互：peek 期间若对手有拦截窗口，提交 placement 是否被门禁挡住（重点核查）
 *
 * 用法：node tools/_real_test_15215_plan.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 补足德国牌堆到 10 张（真实 setup 牌堆可能不足 5） */
	g.decks['德国'] = g.decks['德国'] || []
	while (g.decks['德国'].length < 10) g.decks['德国'].push('1530' + (g.decks['德国'].length % 10) + '#t' + g.decks['德国'].length)
	R.action(g, 'Axis', 'debug_add_card', { face: '15215', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	return g
}

/* 找到 15215 的窗口并打出 */
function playPlan(g) {
	const inst = (g.hands['德国'] || []).find(x => faceOf(x) === '15215')
	if (!inst) return { ok: false, reason: '手里没有 15215' }
	/* 出牌阶段开始时的机会卡：手动派发窗口（与 enter_phase=play 中 resume 同款） */
	I.offer_armed_effects(g, 'play_start', { nation: '德国', window: 'play_start' })
	I.refresh(g)
	const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '15215'))
	if (!w) {
		/* 兜底：直接打（有的配置允许主动出牌） */
		const n0 = (g.log || []).length
		R.action(g, 'Axis', 'play_card', { card: inst })
		I.refresh(g)
		return { ok: !!(g.peek), log: logSince(g, n0) }
	}
	const c = (w.cards || []).find(x => faceOf(x.card_id) === '15215')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: c.card_id })
	I.refresh(g)
	return { ok: !!(g.peek), log: logSince(g, n0) }
}

console.log('=== A/B. 发动 + 检视 + 保密 ===')
let G = null
{
	const g = setup()
	const r = playPlan(g)
	console.log('  log = ' + (r.log || '(无)').slice(0, 200))
	console.log('  peek = ' + JSON.stringify(g.peek && { n: (g.peek.cards || []).length, viewer: g.peek.viewer, topBottom: g.peek.topBottom }))
	ok('★★ 发动后进入检视（5 张，topBottom）',
		!!(g.peek && (g.peek.cards || []).length === 5 && g.peek.topBottom), JSON.stringify(g.peek && g.peek.cards))
	const vA = R.view(g, 'Axis'), vU = R.view(g, 'Allies')
	console.log('  Axis.peek=' + JSON.stringify(!!vA.peek) + '  Allies.peek=' + JSON.stringify(!!vU.peek))
	ok('★★ 只有持有方看得到 peek', !!vA.peek && !vU.peek)
	G = g
}

console.log('\n=== C. 提交 placement → 牌堆顺序 ===')
{
	const g = G
	const peekIds = (g.peek.cards || []).slice()
	const deckBefore = (g.decks['德国'] || []).slice()
	/* 前两张置顶（order 0,1），后三张置底（order 2,3,4） */
	const placement = peekIds.map((id, i) => ({
		id, where: i < 2 ? 'top' : 'bottom', order: i,
	}))
	const cfg = (I.ECHO_EFFECTS || {})['15215'] ? null : null
	const inst = (g.table_responses || []).map(x => x.card_id).find(x => faceOf(x) === '15215') ||
		(g.hands['德国'] || []).find(x => faceOf(x) === '15215') || '15215#1'
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: inst, placement })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 200))
	const deckAfter = (g.decks['德国'] || []).slice()
	console.log('  peek牌 = ' + JSON.stringify(peekIds))
	console.log('  提交后牌堆前5 = ' + JSON.stringify(deckAfter.slice(0, 5)))
	console.log('  提交后牌堆后3 = ' + JSON.stringify(deckAfter.slice(-3)))
	const topOk = deckAfter[0] === peekIds[0] && deckAfter[1] === peekIds[1]
	const bottomOk = deckAfter.slice(-3).join(',') === peekIds.slice(2).join(',')
	ok('★★ 置顶组顺序正确（前 2 张）', topOk, JSON.stringify(deckAfter.slice(0, 3)))
	ok('★★ 置底组顺序正确（末尾 3 张）', bottomOk, JSON.stringify(deckAfter.slice(-3)))
	ok('★ 检视状态已清空', !g.peek)
	ok('★ 其余牌未丢（数量守恒）', deckAfter.length === deckBefore.length, deckAfter.length + ' vs ' + deckBefore.length)
}

console.log('\n=== D. 非法 placement（换一张牌）被拒 ===')
{
	const g = setup()
	playPlan(g)
	const peekIds = (g.peek.cards || []).slice()
	const bad = peekIds.map((id, i) => ({ id: i === 0 ? 'zzz#1' : id, where: 'top', order: i }))
	const inst = (g.peek && g.peek.card) ||
		(g.table_responses || []).map(x => x.card_id).find(x => faceOf(x) === '15215') || '15215#1'
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: inst, placement: bad })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 160))
	ok('★★ 非法提交被拒（牌与检视不一致）', /不一致/.test(lg), lg.slice(0, 120))
	ok('★ 拒绝后牌堆未被破坏（前 5 仍是检视的牌）',
		(g.decks['德国'] || []).slice(0, 5).join(',') === peekIds.join(','), JSON.stringify((g.decks['德国'] || []).slice(0, 5)))
}

console.log('\n=== E. peek 期间出现对手拦截窗口 → 提交是否被门禁挡住 ===')
{
	const g = setup()
	playPlan(g)
	/* 造一个对手（英国）的增强卡窗口（B19 的"对方时点强挂起"） */
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	I.refresh(g)
	I.offer_armed_effects(g, 'enemy_echo_played', {
		nation: '德国', card: '15215#1', space: null, via: 'play', window: 'enemy_echo_played',
	})
	I.refresh(g)
	const win = (g.armed_offers || []).some(w => (w.cards || []).length)
	const peekIds = (g.peek.cards || []).slice()
	const placement = peekIds.map((id, i) => ({ id, where: 'top', order: i }))
	const inst = (g.peek && g.peek.card) ||
		(g.table_responses || []).map(x => x.card_id).find(x => faceOf(x) === '15215') || '15215#1'
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: inst, placement })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  对手窗口存在 = ' + win + '  提交 log = ' + (lg || '(无日志，已生效)').slice(0, 140))
	console.log('  peek 仍在 = ' + !!g.peek)
	ok('★ 提交被"对方时点"门禁拦下（等待对手表态）', /等待【/.test(lg), lg.slice(0, 120))
	/* 对手表态后必须能继续提交（否则是真的卡死） */
	R.action(g, 'Allies', 'skip_armed_offer', {})
	I.refresh(g)
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: inst, placement })
	I.refresh(g)
	const lg2 = logSince(g, n1)
	console.log('  对手表态后再提交 log = ' + (lg2 || '(无日志)').slice(0, 160))
	/* 提交会再次排到拦截队列后面；继续把窗口处理完，看是否最终落到牌堆上 */
	let guard = 0
	while (((g.armed_offers || []).some(w => (w.cards || []).length) || g.pending_echo) && guard++ < 6) {
		if ((g.armed_offers || []).some(w => (w.cards || []).length)) R.action(g, 'Allies', 'skip_armed_offer', {})
		I.refresh(g)
	}
	console.log('  释放后 peek=' + JSON.stringify(!!g.peek) + '  牌堆前5=' + JSON.stringify((g.decks['德国'] || []).slice(0, 5)))
	/* 队列释放不带 placement → 会重新问一次；这里再提交一次，验证"可恢复" */
	const inst2 = (g.peek && g.peek.card) || inst
	const n2 = (g.log || []).length
	if (g.peek) {
		R.action(g, 'Axis', 'play_card', { card: inst2, placement })
		I.refresh(g)
	}
	const lg3 = logSince(g, n2)
	console.log('  二次提交 log = ' + (lg3 || '(无)').slice(0, 140))
	const deckTop = (g.decks['德国'] || []).slice(0, 5)
	console.log('  最终 peek=' + JSON.stringify(!!g.peek) + '  牌堆前5=' + JSON.stringify(deckTop))
	ok('★★ 二次提交后 placement 生效（可恢复，非死锁）',
		!g.peek && deckTop.join(',') === peekIds.join(','), JSON.stringify(deckTop))
	if (lg3 && !g.peek) console.log('  ⚠ 现象：拦截释放时丢了 placement 参数，玩家需二次提交（见报告）')
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
