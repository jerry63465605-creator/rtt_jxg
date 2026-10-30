/*
 * 回归：增强卡拦截（enemy_echo_played）队列化 + P1「未被打断直接生效」
 *
 * 背景（2026-10-29 玩家报障）：
 *   「15352 布莱切利园 即使不打出，依然阻止对方增强卡打出」
 *   实测根因：① 窗口唯一，德国连打两张时第二张覆盖第一张的 ctx -> 第一张成孤儿；
 *             ② 拦截方不应答、发起方转别的事 -> 窗口残留 / 卡静默作废。
 *
 * 本脚本覆盖 6 个场景，全部走真实 rules.action。
 * 用法：node tools/_smoke_echo_intercept_queue.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const wins = g => (g.armed_offers || []).map(w => w.when)
const hasEchoWin = g => wins(g).indexOf('enemy_echo_played') >= 0
const inHand = (g, n, c) => (g.hands[n] || []).indexOf(c) >= 0
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0

/* 德国回合；德国手里两张增强卡；英国手里 15352（拦截卡）+ 1 张可弃牌 */
function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.hands['德国'] = ['15213#1', '15216#2', '15211#3']
	g.hands['英国'] = ['15352#1', '15341#7']
	g.table_responses = []
	g.echo_intercept_queue = []
	I.refresh && I.refresh(g)
	return g
}

console.log('\n=== ① 英国握着拦截卡 → 开窗；放弃 → 照常结算 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	ok('开了 enemy_echo_played 窗口', hasEchoWin(g))
	ok('被拦的卡尚未结算（仍在手牌）', inHand(g, '德国', '15213#1'))
	ok('操作权交给英国', g.active === 'Allies', 'active=' + g.active)
	R.action(g, 'Allies', 'skip_armed_offer', {})
	ok('放弃后窗口关闭', !hasEchoWin(g))
	ok('放弃后卡照常结算（进弃牌堆）', inDisc(g, '德国', '15213#1'))
	ok('队列清空', (g.echo_intercept_queue || []).length === 0)
}

console.log('\n=== ② 拦截方打出拦截卡 → 被拦卡作废、效果不生效 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#7'] })
	ok('被拦卡进弃牌堆', inDisc(g, '德国', '15213#1'))
	ok('拦截卡自己也被消耗', inDisc(g, '英国', '15352#1'))
	ok('队列清空', (g.echo_intercept_queue || []).length === 0)
}

console.log('\n=== ③ 连打两张：不覆盖、不产生孤儿卡 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	R.action(g, 'Axis', 'play_card', { card: '15216#2' })
	/* 第二张开打时，第一张应已被"未被打断直接生效"（P1）或排队等待 */
	ok('第一张已结算（进弃牌堆）', inDisc(g, '德国', '15213#1'))
	ok('第二张成为当前窗口的目标', JSON.stringify(g.armed_offers || []).indexOf('15216#2') >= 0 ||
		inDisc(g, '德国', '15216#2'), JSON.stringify((g.armed_offers || []).map(w => w.ctx && w.ctx.card)))
	R.action(g, 'Allies', 'skip_armed_offer', {})
	ok('放弃后第二张也结算', inDisc(g, '德国', '15216#2'))
	ok('两张都没有滞留手牌', !inHand(g, '德国', '15213#1') && !inHand(g, '德国', '15216#2'),
		JSON.stringify(g.hands['德国']))
	ok('队列清空', (g.echo_intercept_queue || []).length === 0)
}

console.log('\n=== ④ P1：发起方转做别的动作 → 被挂起卡直接生效、窗口不残留 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	ok('先开窗', hasEchoWin(g))
	R.action(g, 'Axis', 'next_phase', {})
	ok('推进阶段后被挂起卡直接生效（进弃牌堆）', inDisc(g, '德国', '15213#1'),
		JSON.stringify(g.discard['德国'] || []))
	ok('残留窗口已摘掉（否则英国能拿过期 ctx 重复弃牌）', !hasEchoWin(g),
		JSON.stringify(wins(g)))
	ok('阶段确实推进了', g.turn_phase !== 'play', 'phase=' + g.turn_phase)
}

console.log('\n=== ⑤ 重复点击幂等 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	R.action(g, 'Allies', 'skip_armed_offer', {})
	const discLen = (g.discard['德国'] || []).length
	R.action(g, 'Allies', 'skip_armed_offer', {})
	ok('重复放弃不产生第二次结算', (g.discard['德国'] || []).length === discLen,
		'before=' + discLen + ' after=' + (g.discard['德国'] || []).length)
	const g2 = fresh()
	R.action(g2, 'Axis', 'play_card', { card: '15213#1' })
	R.action(g2, 'Allies', 'skip_armed_offer', {})
	R.action(g2, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#7'] })
	ok('窗口关闭后再点【使用】被拒（不会重复扣牌）', inHand(g2, '英国', '15352#1'),
		JSON.stringify(g2.hands['英国'] || []))
}

console.log('\n=== ⑥ 发起方弃手牌（同阶段内动作）也会放行 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '15213#1' })
	R.action(g, 'Axis', 'discard_one', { card: '15211#3' })
	ok('弃牌后被挂起卡直接生效', inDisc(g, '德国', '15213#1'))
	ok('窗口不残留', !hasEchoWin(g))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
