/*
 * 2026-11-11 · 方案 B：17721 让权 × 意大利国家技能窗口 —— 真实引擎路径
 *
 * 玩家口径：参考 17721 的「让权期间不弹窗、归还后立即补开」，
 * 并把 16703 与 17721 收敛到同一套通用机制（不再各自维护专用标记/硬编码）。
 *
 * 本测试专测 17721 的【两条归还路径】，尤其是最容易回归的
 * 「德国打出状态卡」路径：旧实现靠 pending_17721_skill 排在
 * play_status_card_impl 的 after_card_resolved 之后；方案 B 改由
 * exports.action 统一出口的 flush_deferred_national_skill 补开。
 *
 * 忠实复现：_board_lib.new_board 建真实盘面，全程 R.action 驱动，
 * 不手填 delegate / national_skill_offer。
 *
 * 用法：node tools/_real_test_17721_skill_defer.js
 */
const L = require('./_board_lib')
const { R, I, faceOf, new_board, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const acts = (g, side) => Object.keys(R.view(g, side).actions || {})

/** 真实盘面：意大利出牌阶段，手握 17721 + 响应牌 + 状态卡；德国有状态卡可打 */
function scene() {
	const g = new_board(20261111, { nation: '意大利', phase: 'play' })
	clear_pending(g)
	g.current_nation = '意大利'
	g.active = 'Axis'
	for (const f of ['17721', '17730', '15338'])
		R.action(g, 'Axis', 'debug_add_card', { face: f, nation: '意大利', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15338', nation: '德国', dest: 'hand' })
	I.refresh(g)
	const cid = (g.hands['意大利'] || []).find(x => faceOf(x) === '17721')
	const resp = (g.hands['意大利'] || []).find(x => faceOf(x) === '17730')
	const deStatus = (g.hands['德国'] || []).find(x => faceOf(x) === '15338')
	return { g, cid, resp, deStatus }
}

/** 打出 17721 并真实打出响应牌，把链式让权交给德国 */
function driveToChain(g, cid, resp) {
	R.action(g, 'Axis', 'play_card', { card: cid })
	R.action(g, 'Axis', 'play_card', { card: resp })
	return !!(g.delegate && g.delegate.mode === 'chain')
}

console.log('\n=== A. 17721 让权全程【不弹】技能窗口 ===')
{
	const { g, cid, resp } = scene()
	R.action(g, 'Axis', 'play_card', { card: cid })
	ok('A1 打出 17721 后立即不开窗（声明式延后）', !g.national_skill_offer,
		J(g.national_skill_offer))
	ok('A2 延后权益已登记', !!(g.national_skill_deferred &&
		g.national_skill_deferred.nation === '意大利'), J(g.national_skill_deferred))
	ok('A3 尚未建立 delegate（链式要先打响应牌）', !g.delegate, J(g.delegate))
	ok('A4 extra_play 指向 17721，且配置声明 deferSkillUntilDelegateEnd',
		!!(g.extra_play && g.extra_play.source === '17721' &&
			I.EVENT_EFFECTS && I.EVENT_EFFECTS['17721'].deferSkillUntilDelegateEnd === true),
		J(g.extra_play))
	R.action(g, 'Axis', 'play_card', { card: resp })
	ok('A5 打出响应牌后建立 chain 让权、控制权翻给德国',
		!!(g.delegate && g.delegate.mode === 'chain') && g.current_nation === '德国',
		J({ dg: g.delegate && g.delegate.mode, cur: g.current_nation }))
	ok('★★ A6 让权期间仍不开窗', !g.national_skill_offer, J(g.national_skill_offer))
	ok('A7 延后标记仍在（未提前消费）', !!g.national_skill_deferred)
	ok('A8 无 pending_17721_skill 专用标记', !g.pending_17721_skill)
}

console.log('\n=== B. 德国打出状态卡归还（旧 pending_17721_skill 路径）===')
{
	const { g, cid, resp, deStatus } = scene()
	driveToChain(g, cid, resp)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: deStatus })
	ok('B1 控制权归还意大利', g.current_nation === '意大利', J(g.current_nation))
	ok('B2 delegate 已清', !g.delegate, J(g.delegate))
	ok('★★ B3 归还后【立刻】补开技能窗口',
		!!(g.national_skill_offer && g.national_skill_offer.nation === '意大利'),
		J(g.national_skill_offer) + ' | ' + logSince(g, n0).slice(0, 160))
	ok('B4 延后标记已消费', !g.national_skill_deferred)
	ok('B5 日志含《钢铁条约》（chain 文案）',
		/钢铁条约/.test(logSince(g, n0)), logSince(g, n0).slice(0, 180))
	ok('B6 白名单含 use/skip_national_skill',
		acts(g, 'Axis').indexOf('use_national_skill') >= 0 &&
		acts(g, 'Axis').indexOf('skip_national_skill') >= 0, J(acts(g, 'Axis')))
}

console.log('\n=== C. 德国放弃委托归还 ===')
{
	const { g, cid, resp } = scene()
	driveToChain(g, cid, resp)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_delegate_decline', {})
	ok('C1 控制权归还意大利', g.current_nation === '意大利', J(g.current_nation))
	ok('★★ C2 同样【立刻】补开（两条路径一致）',
		!!(g.national_skill_offer && g.national_skill_offer.nation === '意大利'),
		J(g.national_skill_offer))
	ok('C3 日志按 mode 写《钢铁条约》',
		/钢铁条约/.test(logSince(g, n0)), logSince(g, n0).slice(0, 180))
	ok('C4 无 pending_17721_skill 专用标记', !g.pending_17721_skill)
}

console.log('\n=== D. 补开的窗口真能结算 ===')
{
	const { g, cid, resp, deStatus } = scene()
	driveToChain(g, cid, resp)
	R.action(g, 'Axis', 'play_card', { card: deStatus })
	const score0 = (g.score || {}).axis
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_national_skill', {})
	const lg = logSince(g, n0)
	ok('★★ D1 技能真结算（扣 2 分 + 授权额外打出）',
		/意大利国家技能/.test(lg) && (g.score || {}).axis <= score0 - 2,
		'score ' + score0 + '→' + (g.score || {}).axis + ' | ' + lg.slice(0, 180))
	ok('D2 窗口已清', !g.national_skill_offer)
}

console.log('\n=== E. 普通★事件卡仍立即开窗（通用 EVENT 路径不受影响）===')
{
	const g = new_board(20261111, { nation: '意大利', phase: 'play' })
	clear_pending(g)
	g.current_nation = '意大利'; g.active = 'Axis'
	/* 17717 是★卡；给一张状态卡保证 national_skill_usable「有得打」 */
	for (const f of ['17717', '15338'])
		R.action(g, 'Axis', 'debug_add_card', { face: f, nation: '意大利', dest: 'hand' })
	I.refresh(g)
	const cid = (g.hands['意大利'] || []).find(x => faceOf(x) === '17717')
	ok('E1 17717 是★卡', I.is_starred_card('17717') === true)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cid })
	/* 17717《大力神行动》也是分步卡：真实 event_step_next 推进到
	 * finish_event_card 的 after_card_resolved，才会结算★卡技能窗口 */
	for (let i = 0; i < 6 && !g.national_skill_offer; i++) {
		if (acts(g, 'Axis').indexOf('event_step_next') >= 0)
			R.action(g, 'Axis', 'event_step_next', {})
		else break
	}
	ok('★★ E2 普通★卡不被通用判据误延后，结算后立即 OPEN(意大利)',
		!!(g.national_skill_offer && g.national_skill_offer.nation === '意大利'),
		J(g.national_skill_offer) + ' | ' + logSince(g, n0).slice(0, 200))
	ok('E3 无延后标记', !g.national_skill_deferred)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
