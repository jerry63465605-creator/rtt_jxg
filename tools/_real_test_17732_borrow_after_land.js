/*
 * 2026-11-11 · 17732《德国军事顾问》借用德国 after_land 状态卡 —— 收紧后的兼容回归
 *
 * 背景：17842 喀秋莎修复把 `after_land` 收紧为「只武装发起国本人」。
 * 但 17732 允许【意大利借用一张德国状态卡】本回合自用，而德国桌面
 * 15253《闪电战》/15245《俯冲式轰炸机》正是 after_land 卡：
 * 收紧若按 own!==nation 一刀切，借用方发起陆战时它不会被武装 ->
 * status_window_ready / activate_status 的 `borrowed` 豁免只解决"能不能发动"，
 * 救不了"有没有被武装" -> 借用彻底失效。
 *
 * 覆盖：
 *   A 意大利借用 15253 后自己发起陆战 -> 15253 入窗口、by=意大利、ready、可发动并建设陆军
 *   B 窗口里只有【被借的那一张】（不连带德国其它卡 / 苏联喀秋莎）
 *   C 对照：德国自己发起陆战 -> 15253 正常入窗口（own===nation 路径未破坏）
 *   D 对照：英/美发起 -> 苏联喀秋莎不入窗口（方案 A 不回归）
 *   E 静态守卫：收紧处含 italy_borrow 借用豁免
 *
 * 用法：node tools/_real_test_17732_borrow_after_land.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const instOf = (g, nat, face) =>
	(g.hands[nat] || []).find(x => faceOf(x) === String(face)) || null
const winOf = (g, face) => (g.status_instant || [])
	.find(e => String(faceOf(e.card_id)) === String(face))
const NE = d.id_of('中国东北')
const W = d.id_of('中国西部')

/** 建盘：德国真实打出 statusFace（留桌面）→ 切到 atkNation 回合 → <中国东北> 放日本陆军 */
function base(atkNation, statusFace) {
	const g = new_board(20261111, { nation: '德国', phase: 'play' })
	clear_pending(g)
	give(g, statusFace, '德国'); I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '德国', statusFace) })
	R.action(g, 'Axis', 'debug_set_phase', { nation: atkNation, phase: 'play' })
	I.refresh(g)
	place(g, 'atk_w', atkNation, 'army', '中国西部')
	I.refresh(g)
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' }); I.refresh(g)
	/* 靶子必须是【敌方】陆军：意/德属轴心，日本也是轴心，不能互攻 -> 用苏联 */
	g.location['jp1'] = NE; g.piece_nation['jp1'] = '苏联'; g.piece_type['jp1'] = 'army'
	I.refresh(g)
	I.grant_supply(g, 'atk_w', g.turn || 1)
	I.refresh(g); I.compute_supply(g)
	return g
}

/** 真实触发 17732（play_start 响应）并选定借用 statusFace 那张德国卡 */
function borrow(g, statusFace) {
	/* 17732 是意大利 RESPONSE（on: play_start），暗置到桌面响应区 */
	const respId = '17732#9'
	g.table_responses = g.table_responses || []
	if (!g.table_responses.some(r => String(r.card_id) === respId))
		g.table_responses.push({ card_id: respId, owner_side: 'axis', nation: '意大利' })
	I.refresh(g)
	I.request_responses(g, 'play_start', { nation: '意大利' }, false)
	I.refresh(g)
	const trig = R.view(g, 'Axis').pending_trigger
	if (trig) R.action(g, 'Axis', 'trigger_response', {})
	I.refresh(g)
	const ib = g.italy_borrow
	const face = (g.table['德国'] || []).find(x => faceOf(x) === String(statusFace))
	R.action(g, 'Axis', 'resolve_italy_borrow', { face: face })
	I.refresh(g)
	return face
}

/* ================= A. 借用后意大利发起 → 15253 入窗口并可用 ================= */
console.log('\n=== A. 意大利借用 15253 后自己发起陆战 ===')
{
	const g = base('意大利', '15253')
	const face = borrow(g, '15253')
	ok('A1 借用已锁定到 15253', !!(g.italy_borrow && g.italy_borrow.card_face === face),
		J(g.italy_borrow && { face: g.italy_borrow.card_face, nation: g.italy_borrow.nation }))
	ok('A2 借用方 = 意大利且当前就是意大利回合',
		g.italy_borrow.nation === '意大利' && g.current_nation === '意大利',
		J({ nat: g.italy_borrow.nation, cur: g.current_nation }))

	give(g, '17701', '意大利'); I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', {
		card: instOf(g, '意大利', '17701'), space: NE, piece: 'jp1',
	})
	I.refresh(g)
	ok('A3 意大利陆战成功', !g.location['jp1'], logSince(g, n0).slice(0, 160))
	ok('★★ A4 借来的 15253 入窗口（收紧未误杀借用）', !!winOf(g, '15253'),
		J((g.status_instant || []).map(e => faceOf(e.card_id))))
	ok('A5 窗口 by = 借用方意大利（不是德国）', (winOf(g, '15253') || {}).by === '意大利',
		J(winOf(g, '15253') && winOf(g, '15253').by))
	const ts = (R.view(g, 'Axis').table_status || []).find(x => faceOf(x.card) === '15253')
	ok('★ A6 ready=true（借用方回合可发动）', !!(ts && ts.ready === true),
		J(ts && { ready: ts.ready, why: ts.ready_reason }))

	/* 发动 15253：损耗 1 张 → 在战斗地区建设陆军（归属借用方意大利） */
	const armyBefore = I.list_pieces(g, { types: ['army'], nation: '意大利' }).length
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'activate_status', { card: face })
	I.refresh(g)
	const lg = logSince(g, n1)
	const armyAfter = I.list_pieces(g, { types: ['army'], nation: '意大利' }).length
	ok('★★ A7 发动后真在战斗地区建设了意大利陆军',
		armyAfter === armyBefore + 1 && armyAfter > 0,
		armyBefore + '→' + armyAfter + ' | ' + lg.slice(0, 160))
	ok('A8 日志写明建设陆军', /建设陆军/.test(lg), lg.slice(0, 160))
}

/* ================= B. 窗口里只有被借的那一张 ================= */
console.log('\n=== B. 不连带点亮其它卡 ===')
{
	const g = base('意大利', '15253')
	borrow(g, '15253')
	/* 额外放一张苏联喀秋莎，确认不会被一起点亮 */
	give(g, '17842', '苏联'); I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', '17842') })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	I.refresh(g)

	give(g, '17701', '意大利'); I.refresh(g)
	R.action(g, 'Axis', 'play_card', {
		card: instOf(g, '意大利', '17701'), space: NE, piece: 'jp1',
	})
	I.refresh(g)
	const faces = (g.status_instant || []).map(e => String(faceOf(e.card_id)))
	ok('★ B1 窗口只含 15253', faces.indexOf('15253') >= 0, J(faces))
	ok('★★ B2 苏联喀秋莎不被连带点亮（仍只认卡主发起）',
		faces.indexOf('17842') < 0, J(faces))
}

/* ================= C. 对照：德国自己发起 ================= */
console.log('\n=== C. 对照：德国自己发起陆战 ===')
{
	const g = base('德国', '15253')
	give(g, '15201', '德国'); I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', {
		card: instOf(g, '德国', '15201'), space: NE, piece: 'jp1',
	})
	I.refresh(g)
	ok('C1 德国陆战成功', !g.location['jp1'], logSince(g, n0).slice(0, 140))
	ok('★★ C2 德国自己发起 → 15253 入窗口（own===nation 路径未破坏）',
		!!winOf(g, '15253'), J((g.status_instant || []).map(e => faceOf(e.card_id))))
}

/* ================= D. 对照：英/美发起 → 苏联喀秋莎不入窗口 ================= */
console.log('\n=== D. 对照：方案 A 不回归 ===')
{
	const g = new_board(20261111, { nation: '苏联', phase: 'play' })
	clear_pending(g)
	give(g, '17842', '苏联'); I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', '17842') })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	place(g, 'uk_w', '英国', 'army', '中国西部'); I.refresh(g)
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' }); I.refresh(g)
	g.location['jp1'] = NE; g.piece_nation['jp1'] = '日本'; g.piece_type['jp1'] = 'army'
	I.refresh(g)
	I.grant_supply(g, 'uk_w', g.turn || 1); I.refresh(g); I.compute_supply(g)
	give(g, '15301', '英国'); I.refresh(g)
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp1',
	})
	I.refresh(g)
	ok('★ D1 英国发起 → 苏联喀秋莎仍不入窗口', !winOf(g, '17842'),
		J((g.status_instant || []).map(e => faceOf(e.card_id))))
}

/* ================= E. 静态守卫 ================= */
console.log('\n=== E. 静态守卫 ===')
{
	const fs = require('fs')
	const path = require('path')
	const src = fs.readFileSync(path.join(L.MOD, 'rules.js'), 'utf8')
	const code = src.split('\n').filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l)).join('\n')
	ok('E1 after_land 收紧仍在（own !== nation）', /window === 'after_land' && own !== nation/.test(code))
	ok('★ E2 收紧处含 italy_borrow 借用豁免', /_ib\.card_face\) === String\(cid\)/.test(code))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
