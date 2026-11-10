/*
 * #2 调试面板「扣分 / 损耗 / 复原」点击不生效 —— 白名单修复真实测试
 *
 * 根因：B28 给 exports.action 加了 debug_attrition / debug_restore / debug_score
 * 三条分支，却漏同步 build_actions 白名单；client.js:1063 查 view.actions[verb]
 * 不在册就静默 return false（hint 是无条件弹的，看起来"点了有反应"）。
 * 修法：finish_acts 外层统一登记 10 个 debug_*，并与服务端两处硬冻结同源。
 *
 * A ★★ 常态 10 个 debug_* 全在册（client.js 会真正发请求）
 * B ★★ debug_score 生效：服务端分数 / view / 日志三层
 * C ★★ debug_attrition 生效：牌库 -2 / 弃牌堆 +2 / view.deck_counts 同源 / 日志
 * D ★★ debug_restore 生效：牌库·弃牌堆复原 / 日志
 * E ★★ 挂起态(17555 排他 return) 10 个 debug_* 仍全在册（外层兜底）
 * F ★★ 挂起态服务端接受 debug_score 且【不清窗口】（B28 豁免口径）
 * G ★★ 终局冻结 / 回退提议待确认：debug_* 不在册且服务端拒绝（判定同源）
 * H ★  残留检查：view 正常、无意外挂起、其它常规动作未被破坏
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const VERBS = ['debug_place', 'debug_remove', 'debug_clear', 'debug_draw',
	'debug_add_card', 'debug_set_phase', 'debug_set_view_nation',
	'debug_attrition', 'debug_restore', 'debug_score']
const MISS3 = ['debug_attrition', 'debug_restore', 'debug_score']
const NAT = '美国'
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const deck = (g, n) => (g.decks[n] || []).length
const disc = (g, n) => (g.discard[n] || []).length

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function scene() {
	const g = new_board(20261108, { nation: NAT, phase: 'play' })
	I.refresh(g)
	return g
}
const actsOf = g => R.view(g, 'Allies').actions || {}
const allIn = a => VERBS.every(v => !!a[v])
const noneIn = a => MISS3.every(v => !a[v])

console.log('=== A. 常态白名单 ===')
{
	const g = scene()
	const a = actsOf(g)
	console.log('  view.actions = ' + VERBS.map(v => v.replace('debug_', '') + ':' + (a[v] ? 1 : 0)).join(' '))
	ok('★★ 10 个 debug_* 全部在册', allIn(a), JSON.stringify(VERBS.filter(v => !a[v])))
	ok('★★ 报障 3 个 verb 已补齐', MISS3.every(v => !!a[v]))
	ok('★ 常规动作仍在册（未被替换）', !!a.play_card && !!a.log)
}

console.log('\n=== B. debug_score（扣分）===')
{
	const g = scene()
	const before = Number(g.score && g.score.axis) || 0
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_score', { faction: 'axis', delta: -2 })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  axis ' + before + ' -> ' + g.score.axis + '　log = ' + lg.slice(0, 120))
	ok('★★ 服务端分数 -2', g.score.axis === before - 2, String(g.score.axis))
	const v = R.view(g, 'Allies')
	ok('★★ view.score 与服务端同源', v.score && v.score.axis === g.score.axis, JSON.stringify(v.score))
	ok('★ 日志写明分数增减', /【调试】轴心 分数 -2/.test(lg), lg.slice(0, 100))
}

console.log('\n=== C/D. debug_attrition（损耗）→ debug_restore（复原）===')
{
	const g = scene()
	const d0 = deck(g, NAT), x0 = disc(g, NAT)
	console.log('  初始 牌库=' + d0 + ' 弃牌堆=' + x0)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_attrition', { n: 2 })
	I.refresh(g)
	const lg1 = logSince(g, n0)
	console.log('  损耗后 牌库=' + deck(g, NAT) + ' 弃牌堆=' + disc(g, NAT) + '　log = ' + lg1.slice(0, 140))
	ok('★★ 牌库 -2', deck(g, NAT) === d0 - 2, String(deck(g, NAT)))
	ok('★★ 弃牌堆 +2', disc(g, NAT) === x0 + 2, String(disc(g, NAT)))
	const v1 = R.view(g, 'Allies')
	ok('★★ view.deck_counts 同源', v1.deck_counts && v1.deck_counts[NAT] === deck(g, NAT), JSON.stringify(v1.deck_counts && v1.deck_counts[NAT]))
	ok('★ 日志写明损耗张数', /损耗 2 张牌/.test(lg1), lg1.slice(0, 120))

	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'debug_restore', { n: 2 })
	I.refresh(g)
	const lg2 = logSince(g, n1)
	console.log('  复原后 牌库=' + deck(g, NAT) + ' 弃牌堆=' + disc(g, NAT) + '　log = ' + lg2.slice(0, 140))
	ok('★★ 牌库复原到原张数', deck(g, NAT) === d0, String(deck(g, NAT)))
	ok('★★ 弃牌堆复原到原张数', disc(g, NAT) === x0, String(disc(g, NAT)))
	ok('★ 日志写明复原张数', /复原 2 张牌到牌库顶/.test(lg2), lg2.slice(0, 120))
}

console.log('\n=== E/F. 挂起态（17555 大萧条的余波，base 仍在）===')
{
	const g = scene()
	give(g, '16300', NAT)
	I.refresh(g)
	const cid = (g.hands[NAT] || []).find(x => faceOf(x) === '16300')
	R.action(g, 'Allies', 'play_card', {
		card: cid, choice: 2, spaces: [Number(d.id_of('中东'))],
	})
	I.refresh(g)
	ok('★ 挂起已建立', !!(g.us_depression_discard && g.us_depression_discard.pending))
	const a = actsOf(g)
	console.log('  挂起态 view.actions = ' + VERBS.map(v => v.replace('debug_', '') + ':' + (a[v] ? 1 : 0)).join(' '))
	ok('★★ 挂起期 10 个 debug_* 仍全在册（外层兜底）', allIn(a), JSON.stringify(VERBS.filter(v => !a[v])))
	const before = Number(g.score && g.score.allies) || 0
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_score', { faction: 'allies', delta: 1 })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  allies ' + before + ' -> ' + g.score.allies + '　log = ' + lg.slice(0, 120))
	ok('★★ 挂起期服务端接受 debug_score', g.score.allies === before + 1, String(g.score.allies))
	ok('★★ 调试动作未清掉弃牌窗口（B28 豁免）', !!(g.us_depression_discard && g.us_depression_discard.pending))
}

console.log('\n=== E2. 真正的排他 return（event_budget 期间）外层兜底 ===')
{
	/* rules.js:29564 `return bacts` 的对象里一个 debug_* 都没有 —— 这才是
	   "挂起期间丢掉整个 base" 的真实场景（17555 挂起本身并不走排他 return）。 */
	const g = scene()
	const NA = Number(d.id_of('非洲北部'))
	I.end_neutral(g, NAT, '测试：模拟已参战')
	place(g, 'us_na', NAT, 'army', '非洲北部')
	I.grant_supply(g, 'us_na', g.turn)
	I.set_supply_point(g, NA, 'allies', true)
	I.compute_supply(g)
	I.refresh(g)
	give(g, '16300', NAT)
	I.refresh(g)
	const cid = (g.hands[NAT] || []).find(x => faceOf(x) === '16300')
	const land = (d.spaces[NA].connections || []).map(Number)
		.find(s => d.spaces[s] && d.spaces[s].terrain !== 'sea')
	R.action(g, 'Allies', 'play_card', { card: cid, choice: 0, spaces: [null, land] })
	I.refresh(g)
	/* 17555《大萧条的余波》前置弃牌：按真实动作付代价，由 resume 重放 */
	if (g.us_depression_discard && g.us_depression_discard.pending) {
		const drop = (g.hands[NAT] || []).find(x => faceOf(x) !== '16300')
		if (drop) R.action(g, 'Allies', 'us_depression_discard', { card: drop })
		I.refresh(g)
	}
	ok('★ 战斗预算已建立（走排他 return 分支）', !!g.event_budget, JSON.stringify(g.event_budget && { resumeStep: g.event_budget.resumeStep }))
	const a = actsOf(g)
	console.log('  event_budget 期 view.actions = ' + VERBS.map(v => v.replace('debug_', '') + ':' + (a[v] ? 1 : 0)).join(' '))
	ok('★★ 排他 return 下 10 个 debug_* 仍全在册（外层兜底）', allIn(a), JSON.stringify(VERBS.filter(v => !a[v])))
	ok('★ 预算专属动作仍在册（未被替换）', !!a.event_battle && !!a.event_finish)
	const before = Number(g.score && g.score.allies) || 0
	R.action(g, 'Allies', 'debug_score', { faction: 'allies', delta: 1 })
	I.refresh(g)
	ok('★★ 预算期间调试动作生效且预算未被清', g.score.allies === before + 1 && !!g.event_budget, String(g.score.allies))
}

console.log('\n=== G. 两处硬冻结：判定同源（客户端不给 / 服务端不收）===')
{
	const g = scene()
	g.game_over = true
	I.refresh(g)
	const a = actsOf(g)
	ok('★★ 终局 debug_* 不在册', noneIn(a), JSON.stringify(MISS3.filter(v => a[v])))
	const before = g.score.axis
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_score', { faction: 'axis', delta: -1 })
	I.refresh(g)
	ok('★★ 终局服务端拒绝且分数不变', g.score.axis === before && /对局已结束/.test(logSince(g, n0)), logSince(g, n0).slice(0, 120))
}
{
	const g = scene()
	g.rollback_proposal = { by_side: 'axis' }
	I.refresh(g)
	const a = actsOf(g)
	ok('★★ 回退提议期 debug_* 不在册', noneIn(a), JSON.stringify(MISS3.filter(v => a[v])))
	const before = g.score.axis
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_score', { faction: 'axis', delta: -1 })
	I.refresh(g)
	ok('★★ 回退提议期服务端拒绝且分数不变', g.score.axis === before && /回退提议待确认/.test(logSince(g, n0)), logSince(g, n0).slice(0, 120))
}

console.log('\n=== H. 残留检查 ===')
{
	const g = scene()
	const a = actsOf(g)
	ok('★ view 可正常生成', !!R.view(g, 'Allies'))
	ok('★ 无意外弃牌挂起', !(g.us_depression_discard && g.us_depression_discard.pending))
	ok('★ 常规动作未被 debug 白名单挤掉', !!a.play_card && !!a.discard_one && !!a.log)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
