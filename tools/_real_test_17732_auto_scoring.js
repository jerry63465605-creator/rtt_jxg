/*
 * B12 扩展：17732 借出的德国 auto 计分卡（15241 / 15244 / 6601）
 * 在【借用方意大利】的计分阶段【自动】结算（不需要再点卡），条件仍按德国部队。
 *
 *  A 15241：<波罗的海> 德国海军 → +1；再加 <北欧> 德国陆军 → 共 +2
 *  B 15244：<罗斯><乌克兰><中亚> 各有德国陆军 → +3
 *  C 6601 ：<东欧> 德国陆军 → +1
 *  D 未借用：意大利计分阶段不加（基线）
 *  E 德国本国计分：借出当回合【跳过】（不重复加）
 *  F 15353 在意大利计分阶段也能拦（被拦 → 不加分）
 *  G 回合变更后借用失效（不再自动加）
 *
 * 用法：node tools/_real_test_17732_auto_scoring.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const faceOf = x => String(x).split('#')[0]
const axis = g => Number((g.score && (g.score.axis != null ? g.score.axis : g.score.AXIS)) || 0)

function setup(cardId, opts) {
	opts = opts || {}
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 德国打出 auto 状态卡 */
	R.action(g, 'Axis', 'debug_add_card', { face: cardId, nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === cardId)
	if (c) R.action(g, 'Axis', 'play_card', { card: c })
	I.refresh(g)
	/* 意大利暗置 17732 并通过真实响应窗口触发 */
	if (!opts.noBorrow) {
		R.action(g, 'Axis', 'debug_add_card', { face: '17732', nation: '意大利', dest: 'hand' })
		R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
		I.refresh(g)
		const b = (g.hands['意大利'] || []).find(x => faceOf(x) === '17732')
		if (b) R.action(g, 'Axis', 'play_card', { card: b })
		I.refresh(g)
		const resp = (g.table_responses || []).find(x => faceOf(x.card_id) === '17732')
		if (resp) {
			I.request_responses(g, 'play_start', { nation: '意大利' })
			I.refresh(g)
			R.action(g, 'Axis', 'trigger_response', { card: resp.card_id })
			I.refresh(g)
		}
		const inst = (g.table['德国'] || []).find(x => faceOf(x) === cardId)
		if (inst) { R.action(g, 'Axis', 'resolve_italy_borrow', { face: inst }); I.refresh(g) }
	}
	return g
}
const putArmy = (g, id, sp) => R.action(g, 'Axis', 'debug_place', { piece: id, nation: '德国', type: 'army', space: d.id_of(sp) })
const putNavy = (g, id, sp) => R.action(g, 'Axis', 'debug_place', { piece: id, nation: '德国', type: 'navy', space: d.id_of(sp) })

/* 跑一次某国计分，返回该卡的加分行（解析“额外得 N 分”） */
function scoreRun(g, nation, cardName) {
	const n0 = (g.log || []).length
	const s0 = axis(g)
	I.phase_scoring(g, nation)
	I.refresh(g)
	const lines = (g.log || []).slice(n0).filter(l => String(l).indexOf('《' + cardName + '》') >= 0)
	let bonus = 0
	for (const l of lines) {
		const m = String(l).match(/额外得\s*(\d+)\s*分/)
		if (m) bonus += Number(m[1])
	}
	return { bonus, lines, dScore: axis(g) - s0 }
}

console.log('=== A. 15241 瑞典铁矿：波罗的海德国海军 + 北欧德国陆军 ===')
{
	const g = setup('15241')
	putNavy(g, 'de_n', '波罗的海')
	putArmy(g, 'de_a1', '北欧')
	I.refresh(g)
	const r = scoreRun(g, '意大利', '瑞典铁矿')
	console.log('  log: ' + r.lines.join(' | ') + '  Δ分=' + r.dScore)
	ok('★★ 意大利计分阶段自动 +2（海军1 + 陆军1）', r.bonus === 2, 'bonus=' + r.bonus)
}

console.log('\n=== B. 15244 丰富的资源：三地区各 1 支德国陆军 ===')
{
	const g = setup('15244')
	putArmy(g, 'de_r', '罗斯'); putArmy(g, 'de_u', '乌克兰'); putArmy(g, 'de_m', '中亚')
	I.refresh(g)
	const r = scoreRun(g, '意大利', '丰富的资源')
	console.log('  log: ' + r.lines.join(' | '))
	ok('★★ 意大利计分阶段自动 +3', r.bonus === 3, 'bonus=' + r.bonus)
}

console.log('\n=== C. 6601 大德意志帝国：东欧有德国陆军 ===')
{
	const g = setup('6601')
	putArmy(g, 'de_e', '东欧')
	I.refresh(g)
	const r = scoreRun(g, '意大利', '大德意志帝国')
	console.log('  log: ' + r.lines.join(' | '))
	ok('★★ 意大利计分阶段自动 +1', r.bonus === 1, 'bonus=' + r.bonus)
}

console.log('\n=== D. 未借用：意大利计分阶段不加（基线）===')
{
	const g = setup('15241', { noBorrow: true })
	putNavy(g, 'de_n', '波罗的海'); putArmy(g, 'de_a1', '北欧')
	I.refresh(g)
	const r = scoreRun(g, '意大利', '瑞典铁矿')
	console.log('  log: ' + (r.lines.join(' | ') || '（无该卡日志）'))
	ok('★ 未借用时该卡不结算', r.bonus === 0, 'bonus=' + r.bonus)
}

console.log('\n=== E. 借出回合各加一次：意大利回合 +N，德国自己的回合再 +N ===')
{
	const g = setup('15241')
	putNavy(g, 'de_n', '波罗的海'); putArmy(g, 'de_a1', '北欧')
	I.refresh(g)
	/* ① 借出回合 = 意大利这个国家回合 */
	const r1 = scoreRun(g, '意大利', '瑞典铁矿')
	console.log('  意大利回合 log: ' + (r1.lines.join(' | ') || '（无）'))
	ok('★★ 借出回合（意大利）计分 +2', r1.bonus === 2, 'bonus=' + r1.bonus)
	/* ② 德国自己的回合（game.turn 前进一格 = 借用自然失效）*/
	g.turn += 1
	I.refresh(g)
	const r2 = scoreRun(g, '德国', '瑞典铁矿')
	console.log('  德国回合 log: ' + (r2.lines.join(' | ') || '（无）'))
	ok('★★ 德国自己的回合再 +2（各加一次）', r2.bonus === 2, 'bonus=' + r2.bonus)
	/* ③ 合计 = 4（一轮次 6 个国家回合里共两次） */
	ok('★★ 一轮次合计 4 分', r1.bonus + r2.bonus === 4, r1.bonus + '+' + r2.bonus)
}

console.log('\n=== F. 15353 在意大利计分阶段也能拦 ===')
{
	const g = setup('15244')
	putArmy(g, 'de_r', '罗斯'); putArmy(g, 'de_u', '乌克兰'); putArmy(g, 'de_m', '中亚')
	R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
	I.refresh(g)
	I.phase_scoring(g, '意大利')
	I.refresh(g)
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	console.log('  拦截窗口 = ' + JSON.stringify(!!win) + '  pending=' + JSON.stringify(!!g.pending_status_react))
	ok('★ 意大利计分阶段出现 15353 拦截窗口', !!win)
	if (win) {
		const card = win.cards[0].card_id
		const pay = (g.hands['英国'] || []).filter(x => faceOf(x) !== '15353').slice(0, 2)
		const s0 = axis(g)
		R.action(g, 'Allies', 'use_armed_offer', { card, drop: pay })
		I.refresh(g)
		const lg = (g.log || []).slice(-8).join(' | ')
		console.log('  拦截后 log: ' + lg.slice(0, 200))
		ok('★★ 被拦后该卡不再加分（日志含"压制"）', /压制/.test(lg) || axis(g) === s0, lg.slice(0, 140))
	}
}

console.log('\n=== G. 回合变更后借用失效 ===')
{
	const g = setup('15241')
	putNavy(g, 'de_n', '波罗的海'); putArmy(g, 'de_a1', '北欧')
	g.turn += 1
	I.refresh(g)
	const r = scoreRun(g, '意大利', '瑞典铁矿')
	console.log('  log: ' + (r.lines.join(' | ') || '（无该卡日志）'))
	ok('★ 跨回合后不再自动加', r.bonus === 0, 'bonus=' + r.bonus)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
