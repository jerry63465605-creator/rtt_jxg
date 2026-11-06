/*
 * B20：被 15353 压制 / 计分类的德国状态卡，15328《破译恩尼格码》应能弃掉
 *
 * A ★★ 计分阶段 15353 拦下 15241 → 压制后仍上报 → 15328 出现在 pending_trigger
 * B ★★ 触发 15328 → response_choice 候选含 15241 → 选它 → 从德国桌面进弃牌堆
 * C ★  未压制时（跳过 15353）计分结束也上报（B14 同源）
 * D ★  被压制的卡本回合不生效（无"额外得 X 分"）
 * E ★  无残留挂起
 * F 静态守卫 2 条
 *
 * 用法：node tools/_real_test_15328_discard_suppressed.js
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

function setup(opts) {
	opts = opts || {}
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 德国 15241《瑞典铁矿》上桌 */
	R.action(g, 'Axis', 'debug_add_card', { face: '15241', nation: '德国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15328', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
	I.refresh(g)
	/* 15328 用真实 play_card 暗置（手写 table_responses 缺 owner_side 会被拒） */
	if (opts.with15328 !== false) {
		R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
		I.refresh(g)
		const uk28 = (g.hands['英国'] || []).find(x => faceOf(x) === '15328')
		if (uk28) R.action(g, 'Allies', 'play_card', { card: uk28 })
		I.refresh(g)
	}
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	/* 15241 上桌（德国出牌阶段） */
	const st = (g.hands['德国'] || []).find(x => faceOf(x) === '15241')
	if (st) R.action(g, 'Axis', 'play_card', { card: st })
	I.refresh(g)
	return g
}
const tableStatus = g => (g.table['德国'] || []).slice()
const find15328 = g => {
	const v = R.view(g, 'Allies') || {}
	if (v.pending_trigger && (v.pending_trigger.candidates || []).some(c => faceOf(c.card_id) === '15328'))
		return { card: (v.pending_trigger.candidates || []).find(c => faceOf(c.card_id) === '15328').card_id }
	return null
}

console.log('=== A/B/D. 计分 → 15353 压制 → 15241 仍可被 15328 弃掉 ===')
{
	const g = setup()
	const st = tableStatus(g)[0]
	console.log('  德国桌面 = ' + JSON.stringify(tableStatus(g).map(faceOf)))
	const n0 = (g.log || []).length
	I.phase_scoring(g, '德国', {})
	I.refresh(g)
	const off = (g.armed_offers || []).map(w => ({ when: w.when, cards: (w.cards || []).map(c => faceOf(c.card_id)) }))
	console.log('  计分中窗口 = ' + JSON.stringify(off))
	ok('★ 计分阶段开出 15353 拦截窗口',
		off.some(o => o.when === 'enemy_status_effect' && o.cards.indexOf('15353') >= 0), JSON.stringify(off))

	/* 英国用 15353（弃 1 张手牌 = drop） */
	const w = (g.armed_offers || []).find(x => x.when === 'enemy_status_effect')
	const card = w && (w.cards || [])[0]
	const fodder = (g.hands['英国'] || []).find(x => faceOf(x) !== '15353')
	R.action(g, 'Allies', 'use_armed_offer', { card: card.card_id, drop: [fodder] })
	I.refresh(g)
	console.log('  压制 = ' + JSON.stringify(g.status_suppressed_this_turn))
	ok('★ 15241 被标记压制', !!(g.status_suppressed_this_turn && g.status_suppressed_this_turn[st]))

	/* 压制后仍应上报 → 15328 出现在 pending_trigger */
	const f = find15328(g)
	console.log('  pending_trigger 里有 15328 = ' + !!f)
	ok('★★ 被压制的卡仍然上报给 15328', !!f, JSON.stringify((R.view(g, 'Allies') || {}).pending_trigger))

	if (f) {
		/* B：真实两步触发 */
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'trigger_response', { card: f.card })
		I.refresh(g)
		const ch = (R.view(g, 'Allies') || {}).response_choice
		console.log('  response_choice = ' + JSON.stringify(ch && { kind: ch.kind, cands: (ch.candidates || []).map(c => c.id) }))
		ok('★★ 候选里含 15241', !!(ch && (ch.candidates || []).some(c => c.id === st)), JSON.stringify(ch && ch.candidates))
		const n2 = (g.log || []).length
		/* 第二步用专用动作 resolve_response_choice（trigger_response 只负责"发动"） */
		R.action(g, 'Allies', 'resolve_response_choice', { choice: st })
		I.refresh(g)
		console.log('  弃置 log = ' + logSince(g, n2).slice(0, 200))
		ok('★★ 15241 离开德国桌面', tableStatus(g).indexOf(st) < 0, JSON.stringify(tableStatus(g).map(faceOf)))
		ok('★★ 15241 进入德国弃牌堆', (g.discard['德国'] || []).indexOf(st) >= 0)
	}
	ok('★ 被压制的卡不加分（无"额外得 X 分"）', !/额外得/.test(logSince(g, n0)), logSince(g, n0).slice(0, 160))
	console.log('  残留：queue=' + (g.response_queue || []).length + ' stack=' + (g.response_stack || []).length +
		' react=' + JSON.stringify(g.pending_status_react && true))
	ok('★ 无残留挂起', !(g.response_queue || []).length && !(g.response_stack || []).length && !g.pending_status_react)
}

console.log('\n=== C. 未压制时计分结束也上报（B14 同源）===')
{
	const g = setup()
	const st = tableStatus(g)[0]
	I.phase_scoring(g, '德国', {})
	I.refresh(g)
	let guard = 0
	while ((g.armed_offers || []).some(w => (w.cards || []).length) && guard++ < 4) {
		R.action(g, 'Allies', 'skip_armed_offer', {})
		I.refresh(g)
	}
	const f = find15328(g)
	console.log('  15241 仍在桌面 = ' + (tableStatus(g).indexOf(st) >= 0) + '  15328 可触发 = ' + !!f)
	ok('★★ 计分类（未压制）也会上报 → 15328 可触发', !!f,
		JSON.stringify((R.view(g, 'Allies') || {}).pending_trigger))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('压制分支也记 fired', /压制，不生效[\s\S]{0,260}p\.fired\.push\(it\.cid\)/.test(src))
	ok('不再排除 scoring 模式', !/fired\.length && mode !== 'scoring'/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
