/*
 * 回归：弃牌阶段手牌超上限 -> 玩家【自选】弃哪几张（不再自动砍手牌尾部）
 *
 * 玩家 2026-10-23 口径："复用现用的弃牌逻辑和客户端 ui，不要新增"。
 *
 * 修复前 phase_discard 直接调 enforce_hand_limit：
 *   game.hands[nation].splice(HAND_LIMIT, over)   // 砍掉数组尾部 = 最后摸到的几张
 * 玩家无法决定弃哪些。现改为挂起 pending_hand_limit，走【已有的】
 * discard_in_discard_phase（点手牌框选 -> 确认弃牌），零新增 UI。
 *
 * 本测试锁死：
 *   A. 超限不自动弃 + 挂起 need 正确
 *   B. 未超限无挂起
 *   C. 弃不足 need -> 拒绝（手牌不变）
 *   D. 弃超过 need -> 拒绝
 *   E. 恰好 need -> 成功 + 挂起清除 + 弃的是所选那几张
 *   F. 挂起期间 next_phase -> 拒绝
 *   G. 弃够后 next_phase -> 通过
 *   H. 无挂起时仍可主动弃任意数量（原功能未破坏）
 *   I. view 下发 pending_hand_limit（只带 nation/need）
 *
 * 用法：node tools/_smoke_hand_limit_pick.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

/* 造一个"德国正处于弃牌阶段、手牌 handCount 张"的局面 */
function base(handCount) {
	const g = rules.setup(301, rules.default_scenario, {})
	g.opening = null
	const pool = (g.decks['德国'] || []).slice(0, 12)
	g.decks['德国'] = (g.decks['德国'] || []).slice(pool.length)
	g.hands['德国'] = pool.slice(0, handCount)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'discard'
	g.phase_note = ''
	g.pending_hand_limit = null
	g.log.length = 0
	return g
}

const LIMIT = I.HAND_LIMIT   /* 7 */

console.log('=== A. 超限 9 张 -> 挂起 need=2，且【不】自动弃 ===')
{
	const g = base(9)
	const before = g.hands['德国'].slice()
	I.phase_discard(g, '德国')
	ok('创建 pending_hand_limit', !!g.pending_hand_limit)
	ok('nation = 德国', g.pending_hand_limit && g.pending_hand_limit.nation === '德国')
	ok('need = 2', g.pending_hand_limit && g.pending_hand_limit.need === 2, g.pending_hand_limit && g.pending_hand_limit.need)
	ok('手牌仍 9 张（未自动弃）', g.hands['德国'].length === 9, g.hands['德国'].length)
	ok('手牌内容未被改动', JSON.stringify(g.hands['德国']) === JSON.stringify(before))
	ok('phase_note 提示自选弃 2 张', /请自选弃置 2 张/.test(g.phase_note || ''), g.phase_note)
}

console.log('\n=== B. 恰好 ' + LIMIT + ' 张 -> 无挂起 ===')
{
	const g = base(LIMIT)
	I.phase_discard(g, '德国')
	ok('无 pending_hand_limit', !g.pending_hand_limit)
	ok('phase_note 可主动弃牌', /可主动弃置/.test(g.phase_note || ''), g.phase_note)
}

console.log('\n=== C/D. 弃牌张数必须恰好 need ===')
{
	const g1 = base(10)   /* need = 3 */
	I.phase_discard(g1, '德国')
	const hand = g1.hands['德国'].slice()
	const g2 = rules.action(g1, 'Axis', 'discard_in_discard_phase', { cards: [hand[0]] })
	ok('C 弃 1 张（need=3）-> 拒绝', g2.hands['德国'].length === 10, g2.hands['德国'].length)
	ok('C 挂起仍在', !!g2.pending_hand_limit)
	ok('C 日志提示必须恰好 3 张', /必须【恰好】弃置 3 张/.test((g2.log || []).join('\n')), (g2.log || []).slice(-1)[0])

	const g3 = rules.action(g1, 'Axis', 'discard_in_discard_phase', { cards: hand.slice(0, 4) })
	ok('D 弃 4 张（need=3）-> 拒绝', g3.hands['德国'].length === 10, g3.hands['德国'].length)
	ok('D 挂起仍在', !!g3.pending_hand_limit)
}

console.log('\n=== E. 恰好 need -> 成功，弃的是所选那几张（不是尾部） ===')
{
	const g1 = base(9)   /* need = 2 */
	I.phase_discard(g1, '德国')
	const hand = g1.hands['德国'].slice()
	/* 故意选【前两张】，而旧实现会弃掉【尾部两张】 */
	const drop = [hand[0], hand[1]]
	const g2 = rules.action(g1, 'Axis', 'discard_in_discard_phase', { cards: drop })
	ok('手牌 9 -> 7', g2.hands['德国'].length === 7, g2.hands['德国'].length)
	ok('所选两张已不在手牌', drop.every(id => g2.hands['德国'].indexOf(id) < 0))
	ok('未选的 7 张都还在', hand.slice(2).every(id => g2.hands['德国'].indexOf(id) >= 0))
	ok('挂起已清', !g2.pending_hand_limit)
	ok('日志记录弃牌张数', /主动弃置 2 张/.test((g2.log || []).join('\n')), (g2.log || []).slice(-2)[0])
}

console.log('\n=== F/G. 挂起期间不能结束阶段，弃够后可结束 ===')
{
	const g1 = base(9)
	I.phase_discard(g1, '德国')
	const g2 = rules.action(g1, 'Axis', 'next_phase', {})
	ok('F 挂起时 next_phase 被拒（仍在 discard）', g2.turn_phase === 'discard', g2.turn_phase)
	ok('F 日志提示先自选弃置 2 张', /请先自选弃置 2 张/.test((g2.log || []).join('\n')), (g2.log || []).slice(-1)[0])

	const hand = g1.hands['德国'].slice()
	const g3 = rules.action(g1, 'Axis', 'discard_in_discard_phase', { cards: hand.slice(0, 2) })
	const g4 = rules.action(g3, 'Axis', 'next_phase', {})
	ok('G 弃够后 next_phase 通过（离开 discard）', g4.turn_phase !== 'discard', g4.turn_phase)
}

console.log('\n=== H. 无挂起时仍可主动弃任意数量（原功能未破坏） ===')
{
	const g1 = base(7)
	I.phase_discard(g1, '德国')
	const hand = g1.hands['德国'].slice()
	const g2 = rules.action(g1, 'Axis', 'discard_in_discard_phase', { cards: hand.slice(0, 2) })
	ok('弃 2 张成功', g2.hands['德国'].length === 5, g2.hands['德国'].length)
	ok('仍无挂起', !g2.pending_hand_limit)

	/* rules.action 原地改 state，故 3 张这组必须用新盘面，不能复用已被弃过 2 张的 g1 */
	const g1b = base(7)
	I.phase_discard(g1b, '德国')
	const handB = g1b.hands['德国'].slice()
	const g3 = rules.action(g1b, 'Axis', 'discard_in_discard_phase', { cards: handB.slice(0, 3) })
	ok('弃 3 张也成功（不受 need 限制）', g3.hands['德国'].length === 4, g3.hands['德国'].length)
}

console.log('\n=== I. view 下发 pending_hand_limit ===')
{
	const g = base(9)
	I.phase_discard(g, '德国')
	const v1 = rules.view(g, 'Axis')
	ok('view.pending_hand_limit 存在', !!v1.pending_hand_limit)
	ok('need = 2', v1.pending_hand_limit && v1.pending_hand_limit.need === 2)
	ok('nation = 德国', v1.pending_hand_limit && v1.pending_hand_limit.nation === '德国')

	const g2 = base(7)
	I.phase_discard(g2, '德国')
	const v2 = rules.view(g2, 'Axis')
	ok('未超限时 view 字段为 null', v2.pending_hand_limit === null)
}

console.log('\n=== J/K. 挂起期间手牌减少到上限内 -> 自动解除（防阶段卡死） ===')
{
	const g1 = base(9)
	I.phase_discard(g1, '德国')
	/* 模拟"打牌模式"打出手牌，手牌降到上限 */
	g1.hands['德国'] = g1.hands['德国'].slice(0, LIMIT)
	const g2 = rules.action(g1, 'Axis', 'next_phase', {})
	ok('J 阶段可推进（未被卡住）', g2.turn_phase !== 'discard', g2.turn_phase)
	ok('J 挂起已清', !g2.pending_hand_limit)
	ok('J 日志提示自动解除', /超限弃牌要求自动解除/.test((g2.log || []).join('\n')))
}
{
	const g1 = base(9)
	I.phase_discard(g1, '德国')
	const keep = g1.hands['德国'].slice(0, LIMIT)
	g1.hands['德国'] = keep.slice()
	const g2 = rules.action(g1, 'Axis', 'discard_in_discard_phase', { cards: [keep[0]] })
	ok('K 自动解除后可弃 1 张（不受 need 限制）', g2.hands['德国'].length === 6, g2.hands['德国'].length)
	ok('K 挂起已清', !g2.pending_hand_limit)
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
