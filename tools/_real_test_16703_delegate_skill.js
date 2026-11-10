/*
 * #4 / 2026-11-11 重写：16703 让权 × 意大利国家技能 —— 真实引擎路径
 *
 * 【修掉假绿】旧版手工塞 g.delegate / g.national_skill_offer，
 * 断言「两窗口并存时白名单叠加」—— 与玩家新口径相反。
 *
 * 玩家口径（2026-11-11 确认）：
 *  ① 让权期间【完全不弹】意大利国家技能窗口（参考 17721）；
 *  ② 方案 B：彻底收敛，去掉 17721 专用标记与 play_card 的卡面硬编码；
 *  ③ 德国归还控制权后【立刻】补开。
 *
 * 忠实复现铁律：_board_lib.new_board 建真实盘面，16703 用真实 play_card +
 * event_step_next 推进分步机，绝不手填 delegate / national_skill_offer。
 *
 * 用法：node tools/_real_test_16703_delegate_skill.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const acts = (g, side) => Object.keys(R.view(g, side).actions || {})
const fr = g => (g.response_stack || []).length

const BALKAN = d.id_of('巴尔干')

/** 真实建盘：意大利出牌阶段、手里有 16703、巴尔干有补给点（step1 征召要成功） */
function scene(card) {
	const g = new_board(20261108, { nation: '意大利', phase: 'play' })
	clear_pending(g)
	g.current_nation = '意大利'
	g.active = 'Axis'
	if (BALKAN != null) I.set_supply_point(g, BALKAN, 'axis', true)
	I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: card, nation: '意大利', dest: 'hand' })
	/* 国家技能要「有得打」：给意大利一张状态卡作额外打出的目标 */
	R.action(g, 'Axis', 'debug_add_card', { face: '15338', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	return { g, cid: (g.hands['意大利'] || []).find(x => faceOf(x) === String(card)) }
}

/** 16703 是分步卡：真实 event_step_next 推进到 step2（run 建 delegate） */
function driveToDelegate(g, maxStep = 6) {
	for (let i = 0; i < maxStep; i++) {
		if (g.delegate && g.delegate.mode === 'german_draw') return true
		if (acts(g, 'Axis').indexOf('event_step_next') >= 0) {
			R.action(g, 'Axis', 'event_step_next', {})
			continue
		}
		break
	}
	return !!(g.delegate && g.delegate.mode === 'german_draw')
}

/* ==================== A. 让权期间不弹窗 ==================== */
console.log('\n=== A. 16703 让权期间【不弹】技能窗口 ===')
{
	const { g, cid } = scene('16703')
	ok('A0 16703 是★卡（技能触发源）', I.is_starred_card('16703') === true)
	R.action(g, 'Axis', 'play_card', { card: cid })
	ok('A1 真实推进分步机到 delegate', driveToDelegate(g), J(g.delegate))
	ok('★★ A2 让权期间 national_skill_offer = null（不共存）',
		!g.national_skill_offer, J(g.national_skill_offer))
	ok('A3 延后权益已登记（national_skill_deferred）',
		!!(g.national_skill_deferred && g.national_skill_deferred.nation === '意大利'),
		J(g.national_skill_deferred))
	ok('A4 控制权确实在德国', g.current_nation === '德国', J(g.current_nation))
	ok('A5 委托仍是 german_draw', !!(g.delegate && g.delegate.mode === 'german_draw'))
	ok('A6 让权期间 view(Axis).national_skill 不可用',
		!(R.view(g, 'Axis').national_skill && R.view(g, 'Axis').national_skill.usable),
		J(R.view(g, 'Axis').national_skill))
	ok('A7 德国两条收尾动作都在白名单（链不会卡死）',
		acts(g, 'Axis').indexOf('italy_german_draw') >= 0 &&
		acts(g, 'Axis').indexOf('event_delegate_decline') >= 0, J(acts(g, 'Axis')))
	ok('A8 让权期间不给国家技能键',
		acts(g, 'Axis').indexOf('use_national_skill') < 0, J(acts(g, 'Axis')))
}

/* ==================== B. 两条收尾路径都立刻补开 ==================== */
console.log('\n=== B. 德国点手牌弃摸（italy_german_draw）===')
{
	const { g, cid } = scene('16703')
	R.action(g, 'Axis', 'play_card', { card: cid })
	driveToDelegate(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'italy_german_draw', { card_id: null })
	ok('B1 控制权已归还意大利', g.current_nation === '意大利', J(g.current_nation))
	ok('B2 delegate 已清', !g.delegate, J(g.delegate))
	ok('★★ B3 归还后【立刻】补开技能窗口（★卡权益不丢）',
		!!(g.national_skill_offer && g.national_skill_offer.nation === '意大利'),
		J(g.national_skill_offer))
	ok('B4 延后标记已消费', !g.national_skill_deferred)
	ok('B5 view(Axis).national_skill.usable=true',
		!!(R.view(g, 'Axis').national_skill && R.view(g, 'Axis').national_skill.usable))
	ok('B6 日志含「罗马尼亚铁卫团」（按 mode 分流，不再写《钢铁条约》）',
		/罗马尼亚铁卫团/.test(logSince(g, n0)), logSince(g, n0).slice(0, 160))
	ok('B7 白名单含 use/skip_national_skill',
		acts(g, 'Axis').indexOf('use_national_skill') >= 0 &&
		acts(g, 'Axis').indexOf('skip_national_skill') >= 0, J(acts(g, 'Axis')))
}

console.log('\n=== C. 德国点「放弃」（event_delegate_decline）===')
{
	const { g, cid } = scene('16703')
	R.action(g, 'Axis', 'play_card', { card: cid })
	driveToDelegate(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_delegate_decline', {})
	ok('C1 控制权已归还意大利', g.current_nation === '意大利', J(g.current_nation))
	ok('★★ C2 同样【立刻】补开（两条路径一致，不再一有一无）',
		!!(g.national_skill_offer && g.national_skill_offer.nation === '意大利'),
		J(g.national_skill_offer))
	ok('C3 延后标记已消费', !g.national_skill_deferred)
	ok('C4 日志按 mode 写《罗马尼亚铁卫团》',
		/罗马尼亚铁卫团/.test(logSince(g, n0)) &&
		!/钢铁条约/.test(logSince(g, n0)), logSince(g, n0).slice(0, 160))
}

/* ==================== D. 技能真的能结算 ==================== */
console.log('\n=== D. 补开的技能窗口能真结算（不是摆设）===')
{
	const { g, cid } = scene('16703')
	R.action(g, 'Axis', 'play_card', { card: cid })
	driveToDelegate(g)
	R.action(g, 'Axis', 'italy_german_draw', { card_id: null })
	const score0 = (g.score || {}).axis
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_national_skill', {})
	const lg = logSince(g, n0)
	ok('★★ D1 技能真结算（扣 2 分 + 授权额外打出）',
		/意大利国家技能/.test(lg) &&
		(g.score || {}).axis <= score0 - 2,
		'score ' + score0 + '→' + (g.score || {}).axis + ' | ' + lg.slice(0, 180))
	ok('D2 技能窗口已清', !g.national_skill_offer)
	ok('D3 额外打出通道已授权', !!g.extra_play, J(g.extra_play))
}

/* ==================== E. 方案 B：17721 硬编码已收敛 ==================== */
console.log('\n=== E. 方案 B 静态守卫（不写死卡面 id）===')
{
	const fs = require('fs')
	const path = require('path')
	const src = fs.readFileSync(path.join(L.MOD, 'rules.js'), 'utf8')
	/* 只扫【非注释代码行】：注释里回顾旧机制的说明允许保留 */
	const code = src.split('\n').filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l)).join('\n')
	ok('E1 不再有 pending_17721_skill 专用标记（代码行）',
		!/pending_17721_skill/.test(code))
	ok('E2 play_card 不再有 `!== \'17721\'` 硬编码跳过（代码行）',
		!/!== '17721'/.test(code))
	ok('E3 event_delegate_decline 不再写死 after_card_resolved(\'意大利\',\'17721\')',
		!/after_card_resolved\(game, '意大利', '17721'\)/.test(code))
	ok('E4 17721 用声明式 deferSkillUntilDelegateEnd 配置',
		/deferSkillUntilDelegateEnd: true/.test(code))
	ok('E5 统一判据 delegate_skill_reason + 统一补开 flush_deferred_national_skill 都在',
		/function delegate_skill_reason\(/.test(code) &&
		/function flush_deferred_national_skill\(/.test(code))
	ok('E6 补开挂在 exports.action 的统一出口',
		/flush_deferred_national_skill\(game\)/.test(code))
	ok('E7 17553 不再各写一份补开（pending_cross_faction_handoff 并入通用判据）',
		(code.match(/maybe_offer_national_skill\(game, _def\.nation/g) || []).length === 0)
}

/* ==================== F. 让权链本身不回归 ==================== */
console.log('\n=== F. 其它让权卡不回归 ===')
{
	/* 17729 order：逐国翻转后归还意大利，delegate 清空 */
	const { g, cid } = scene('17729')
	R.action(g, 'Axis', 'play_card', { card: cid })
	ok('F1 17729 建立 order 委托', !!(g.delegate && g.delegate.mode === 'order'), J(g.delegate && g.delegate.mode))
	for (let i = 0; i < 3 && g.delegate; i++)
		R.action(g, 'Axis', 'resolve_italy_chain', { choice: 'discard' })
	ok('F2 17729 全部处理完归还意大利、delegate 清空',
		g.current_nation === '意大利' && !g.delegate,
		J({ cur: g.current_nation, dg: g.delegate }))
	ok('F3 17729 结束不残留延后标记', !g.national_skill_deferred)
}
{
	/* 17535 single：美国打出后先要真实付「大萧条的余波」弃牌代价，
	 * 引擎会重放 play_card 才真正建立委托。不可用不存在的 finish 动作。 */
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	clear_pending(g)
	g.current_nation = '美国'; g.active = 'Allies'
	R.action(g, 'Allies', 'debug_add_card', { face: '17535', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const cid = (g.hands['美国'] || []).find(x => faceOf(x) === '17535')
	R.action(g, 'Allies', 'play_card', { card: cid })
	ok('F4 17535 打出被「大萧条的余波」前置挂起（真实路径）',
		!!(g.us_depression_discard && g.us_depression_discard.pending),
		J(g.us_depression_discard))
	/* 真实付代价：弃 1 张手牌（不能弃 17535 自己），引擎重放 play_card */
	const drop = (g.hands['美国'] || []).find(x => x !== cid)
	R.action(g, 'Allies', 'us_depression_discard', { card: drop })
	ok('F5 17535 重放后建立 single 委托',
		!!(g.delegate && g.delegate.mode === 'single'), J(g.delegate && g.delegate.mode))
	R.action(g, 'Allies', 'resolve_us_lend_lease_select', { nation: '苏联' })
	ok('F6 17535 选苏联后控制权翻给苏联', g.current_nation === '苏联', J(g.current_nation))
	/* 17535 用手动归还（详见 docs/change-17535-pending-target.md）：
	   这里只验证委托链仍可推进，不残留被误延后的技能窗口 */
	ok('F7 17535 让权期间未误登记意大利技能延后',
		!(g.national_skill_deferred && g.national_skill_deferred.nation === '意大利'),
		J(g.national_skill_deferred))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
