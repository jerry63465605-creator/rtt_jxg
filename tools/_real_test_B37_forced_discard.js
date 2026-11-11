/*
 * B37 真实测试 —— 底层规则 forced_discard_or_attrition + 17553 接入
 *
 * 玩家口径（2026-11-12）：
 *   · 被动强制弃牌时，无手牌 → 改为损耗牌库；
 *   · 17553 无手牌时「弃牌折算 1 张 + 原有损耗 1 张」= 共损耗 2 张；
 *   · 牌库有牌可损耗时不扣分；牌库不足/为空时差额每张扣该国阵营 1 分。
 *
 * A 原子层四种组合 + extraAttrition
 * B 17553 真实链路（让权挂起 / 不建挂起 / 分数 / 让权归还成对）
 * C 弃牌走 discard_card 原子（静态 + 弃牌堆）
 * D 静态守卫（导出、接入、旧硬编码已删）
 *
 * 用法：node tools/_real_test_B37_forced_discard.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const J = x => JSON.stringify(x)
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

function board(opt) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_ask = null; g.us_japan_delegate = null
	g.econ_return_active = null
	g.current_nation = '苏联'; g.active = 'Allies'; g.turn_phase = 'play'
	I.refresh(g)
	g.table['美国'] = ['17553#1']
	g.hands['日本'] = []
	for (let i = 0; i < (opt.jpHand || 0); i++) g.hands['日本'].push('15300#' + (1 + i))
	g.decks['日本'] = []
	for (let i = 0; i < (opt.jpDeck || 0); i++) g.decks['日本'].push('15300#' + (20 + i))
	g.score = { axis: 10, allies: 10 }
	I.refresh(g)
	return g
}
const lostCount = g => (g.discard['日本'] || []).filter(x => faceOf(x) === '15300').length

console.log('=== A. 底层原子 forced_discard_or_attrition ===')
ok('★ 新原子已导出到 _internal', typeof I.forced_discard_or_attrition === 'function')
{
	const g = board({ jpHand: 2, jpDeck: 3 })
	const r = I.forced_discard_or_attrition(g, '日本', 1, { extraAttrition: 1, reason: '原子测试' })
	ok('A1 手牌够 → mode=discard、不损耗、不扣分',
		r.mode === 'discard' && r.total === 0 && g.score.axis === 10, J(r))
}
{
	const g = board({ jpHand: 0, jpDeck: 3 })
	const r = I.forced_discard_or_attrition(g, '日本', 1, { extraAttrition: 1, reason: '原子测试' })
	ok('A2 ★★ 无手牌 + 牌库有 → 共损耗 2 张、不扣分',
		r.mode === 'attrition' && r.total === 2 && r.lost.length === 2 &&
		r.short === 0 && g.score.axis === 10, J({ total: r.total, lost: r.lost.length, short: r.short, score: g.score }))
}
{
	const g = board({ jpHand: 0, jpDeck: 1 })
	const r = I.forced_discard_or_attrition(g, '日本', 1, { extraAttrition: 1, reason: '原子测试' })
	ok('A3 无手牌 + 牌库 1 → 损耗 1、差额 1、扣 axis 1 分',
		r.lost.length === 1 && r.short === 1 && g.score.axis === 9,
		J({ lost: r.lost.length, short: r.short, score: g.score }))
}
{
	const g = board({ jpHand: 0, jpDeck: 0 })
	const r = I.forced_discard_or_attrition(g, '日本', 1, { extraAttrition: 1, reason: '原子测试' })
	ok('A4 ★★ 无手牌 + 牌库空 → 共需 2、实际 0、扣 axis 2 分',
		r.total === 2 && r.lost.length === 0 && r.short === 2 && g.score.axis === 8,
		J({ total: r.total, short: r.short, score: g.score }))
}
{
	const g = board({ jpHand: 0, jpDeck: 2 })
	const r = I.forced_discard_or_attrition(g, '日本', 1, { reason: '原子测试' })
	ok('A5 无 extraAttrition 时只折算 1 张',
		r.total === 1 && r.lost.length === 1 && g.score.axis === 10, J({ total: r.total, lost: r.lost.length }))
}

console.log('\n=== B. 17553 真实链路（引擎函数 offer_us_japan_delegate 驱动）===')
function offer(g) {
	const n0 = (g.log || []).length
	I.offer_us_japan_delegate(g, '中国建设')
	return (g.log || []).slice(n0).join(' | ')
}
{
	const g = board({ jpHand: 2, jpDeck: 3 })
	const lg = offer(g)
	ok('B1 有手牌 → 让权挂起、current_nation=日本、active=Axis',
		!!g.us_japan_delegate && g.current_nation === '日本' && g.active === 'Axis',
		J({ cn: g.current_nation, active: g.active, dg: g.us_japan_delegate }))
	const card = (g.hands['日本'] || [])[0]
	R.action(g, 'Axis', 'resolve_japan_delegate', { card: card })
	ok('B2 弃 1（手牌 2→1）+ 损耗 1（牌库 3→2）、不扣分',
		(g.hands['日本'] || []).length === 1 && (g.decks['日本'] || []).length === 2 &&
		lostCount(g) === 2 && g.score.axis === 10,
		J({ hand: g.hands['日本'].length, deck: g.decks['日本'].length,
			discard: lostCount(g), score: g.score }))
	ok('B3 ★ 让权归还成对（rtt-handoff-authority）',
		!g.us_japan_delegate && g.current_nation === '苏联' && g.active === 'Allies',
		J({ cn: g.current_nation, active: g.active }))
	ok('B4 弃的牌确实进了弃牌堆（discard_card 生效）',
		(g.discard['日本'] || []).indexOf(card) >= 0, J(g.discard['日本']))
}
{
	const g = board({ jpHand: 0, jpDeck: 3 })
	const lg = offer(g)
	console.log('  C 场景日志: ' + lg.slice(0, 200))
	ok('B5 ★★ 无手牌 + 牌库有 → 不建让权挂起、共损耗 2 张、不扣分',
		!g.us_japan_delegate && lostCount(g) === 2 && g.score.axis === 10,
		J({ dg: g.us_japan_delegate, discard: lostCount(g), score: g.score }))
	ok('B6 日志写明折算与共损耗 2 张', /折算为损耗牌库 1 张/.test(lg) && /共需损耗 2 张/.test(lg))
}
{
	const g = board({ jpHand: 0, jpDeck: 0 })
	const lg = offer(g)
	console.log('  D 场景日志: ' + lg.slice(0, 220))
	ok('B7 ★★ 无手牌 + 牌库空 → 不建挂起、共需 2、扣 axis 2 分',
		!g.us_japan_delegate && /共需损耗 2 张/.test(lg) && g.score.axis === 8,
		J({ dg: g.us_japan_delegate, score: g.score }))
}
{
	const g = board({ jpHand: 2, jpDeck: 0 })
	offer(g)
	R.action(g, 'Axis', 'resolve_japan_delegate', { card: (g.hands['日本'] || [])[0] })
	ok('B8 有手牌 + 牌库空 → 弃 1、原有损耗差额扣 1 分（口径不变）',
		(g.hands['日本'] || []).length === 1 && g.score.axis === 9, J(g.score))
}

console.log('\n=== C/D. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('C1 新原子已登记进 _internal',
		/forced_discard_or_attrition,/.test(src))
	ok('C2 17553 offer 接入原子',
		/const fb = forced_discard_or_attrition\(game, '日本', 1, \{/.test(src))
	ok('C3 让权结算弃牌改走 discard_card',
		/discard_card\(game, '日本', card\)/.test(src))
	ok('C4 旧硬编码「跳过弃牌，仅损耗」已删',
		!/跳过弃牌，仅损耗/.test(src))
	ok('C5 旧 splice 绕过原子已删（resolve_us_japan_delegate 段）',
		!/hand\.splice\(hi, 1\)\s*\r?\n\s*game\.discard\['日本'\]/.test(src))
	ok('D1 原子只处理被动强制（注释标明主动代价不走这里）',
		/只服务【被动强制】弃牌/.test(src))
	ok('D2 扣分语义由 attrition_passive 统一承载，原子内不自己改 score',
		!/function forced_discard_or_attrition[\s\S]{0,1400}?game\.score\[/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
