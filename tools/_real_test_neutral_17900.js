/*
 * 2026-11-11 · 中立攻击判定 + 17900 让权 真实测试
 *
 * 玩家口径：
 *  ①「苏联中立时，应该仍然可以攻击日本，仅仅不能攻击意大利和德国」
 *  ②「仍有 17900 未让权的问题」→ 让权必须切 current_nation 到苏联
 *  ③ 组合场景：英国回合对中国东北发起陆战 + 苏联持 17900/建设陆军
 *     + 桌面有喀秋莎 + 日本中国东部陆军 + 飞机
 *
 * 忠实复现：_board_lib.new_board 建真实盘面，全程 R.action 驱动；
 * 判定矩阵直接调引擎函数 neutral_attack_check / seize_air（非手写状态）。
 *
 * 用法：node tools/_real_test_neutral_17900.js
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
const acts = (g, side) => Object.keys(R.view(g, side).actions || {})

const NE = d.id_of('中国东北')
const CE = d.id_of('中国东部')

/* 建盘：who 为当前回合国；目标地区按需要放守军 */
function scene(who, targetNation, withArmy) {
	const g = new_board(20261111, { nation: who, phase: 'play' })
	clear_pending(g)
	g.current_nation = who
	g.active = (who === '苏联' || who === '英国' || who === '美国') ? 'Allies' : 'Axis'
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' })   /* <中国东部> 开局中国陆军 */
	I.refresh(g)
	place(g, 'uk_w', '英国', 'army', '中国西部')
	place(g, 'su_sib', '苏联', 'army', '西伯利亚')
	place(g, 'su_vl', '苏联', 'army', '海参崴')
	place(g, 'su_ne', '苏联', 'army', '中国东北')
	I.refresh(g)
	if (withArmy) {
		g.location['tgt'] = CE
		g.piece_nation['tgt'] = targetNation
		g.piece_type['tgt'] = 'army'
		I.refresh(g)
	}
	I.grant_supply(g, 'uk_w', g.turn || 1)
	I.grant_supply(g, 'su_ne', g.turn || 1)
	I.refresh(g)
	I.compute_supply(g)
	return g
}

/* ================= A. 判定矩阵 ================= */
console.log('\n=== A. neutral_attack_check 判定矩阵 ===')
{
	const g = scene('苏联', '日本', true)
	ok('A1 苏联 vs 日本 → 放行', I.neutral_attack_check(g, '苏联', '日本').ok === true)
	ok('A2 苏联 vs 德国 → 拒绝', I.neutral_attack_check(g, '苏联', '德国').ok === false)
	ok('A3 苏联 vs 意大利 → 拒绝', I.neutral_attack_check(g, '苏联', '意大利').ok === false)
	ok('A4 美国 vs 日本 → 拒绝（美国 enemies 含日本）',
		I.neutral_attack_check(g, '美国', '日本').ok === false)
	ok('A5 英国 vs 日本 → 放行（英国不中立）',
		I.neutral_attack_check(g, '英国', '日本').ok === true)
	ok('A6 配置：苏联 enemies 只含德/意',
		J(I.NEUTRAL_RULES['苏联'].enemies) === J(['德国', '意大利']),
		J(I.NEUTRAL_RULES['苏联'].enemies))
}

/* ================= B. 有敌军：真实打牌 ================= */
console.log('\n=== B. 苏联中立 + 对<中国东部>发起陆战（真实 action）===')
for (const [nat, expect] of [['日本', true], ['德国', false], ['意大利', false]]) {
	const g = scene('苏联', nat, true)
	give(g, '17801', '苏联')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '苏联', '17801'), space: CE, piece: 'tgt',
	})
	I.refresh(g)
	const removed = !g.location['tgt']
	ok('B ' + nat + (expect ? ' → 成功移除' : ' → 被拒绝'),
		removed === expect, logSince(g, n0).slice(0, 160))
}

/* ================= C. 空打 ================= */
console.log('\n=== C. 空打（无敌军）：苏联放行、美国拒绝 ===')
{
	const g = scene('苏联', '日本', false)
	give(g, '17801', '苏联')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '苏联', '17801'), space: CE, piece: 0,
	})
	I.refresh(g)
	const lg = logSince(g, n0)
	ok('★★ C1 苏联中立空打放行（旧实现一刀切拒绝）',
		/空打/.test(lg) && !/尚未参战/.test(lg), lg.slice(0, 180))
}
{
	const g = scene('美国', '日本', false)
	/* 美国发起单位：<中国西部> 与<中国东部>相邻，且处于补给 */
	place(g, 'us_w', '美国', 'army', '中国西部')
	I.refresh(g)
	I.grant_supply(g, 'us_w', g.turn || 1)
	I.refresh(g)
	give(g, '17501', '美国')       /* 美国 BASIC 发起陆战 */
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '美国', '17501'), space: CE, piece: 0,
	})
	I.refresh(g)
	const lg = logSince(g, n0)
	ok('★ C2 美国中立空打仍被拒绝（enemies 覆盖整个敌对阵营）',
		/尚未参战/.test(lg), lg.slice(0, 180))
}

/* ================= D. 夺取制空权 ================= */
console.log('\n=== D. 夺取制空权（seize_air 原子）===')
for (const [nat, expect] of [['日本', true], ['德国', false]]) {
	const g = scene('苏联', nat, false)
	g.location['air_tgt'] = CE
	g.piece_nation['air_tgt'] = nat
	g.piece_type['air_tgt'] = 'air'
	g.location['su_air'] = NE
	g.piece_nation['su_air'] = '苏联'
	g.piece_type['su_air'] = 'air'
	I.refresh(g)
	I.grant_supply(g, 'su_air', g.turn || 1)
	I.refresh(g)
	const r = I.seize_air(g, '苏联', CE, 'su_air', { by: 'action' })
	ok('★★ D ' + nat + (expect ? ' → 放行并移除' : ' → 拒绝'),
		(!!r.ok) === expect && ((!g.location['air_tgt']) === expect), J(r))
}
{
	const g = scene('美国', '日本', false)
	g.location['air_tgt'] = CE
	g.piece_nation['air_tgt'] = '日本'
	g.piece_type['air_tgt'] = 'air'
	g.location['us_air'] = NE
	g.piece_nation['us_air'] = '美国'
	g.piece_type['us_air'] = 'air'
	I.refresh(g)
	I.grant_supply(g, 'us_air', g.turn || 1)
	I.refresh(g)
	const r = I.seize_air(g, '美国', CE, 'us_air', { by: 'action' })
	ok('★ D3 美国中立对日本空军仍被拒绝', !r.ok && !!g.location['air_tgt'], J(r))
}

/* ================= E. 17900 让权切 current_nation ================= */
console.log('\n=== E. 17900 让权：current_nation 必须切到苏联 ===')
{
	const g = scene('英国', '日本', false)
	/* 英国陆军在<中国西部>；<中国东北>只放日本守军 */
	delete g.location['su_ne']; delete g.piece_nation['su_ne']; delete g.piece_type['su_ne']
	g.location['jp_ne'] = NE
	g.piece_nation['jp_ne'] = '日本'
	g.piece_type['jp_ne'] = 'army'
	/* 苏联桌面：喀秋莎 */
	give(g, '17842', '苏联'); I.refresh(g)
	const c17842 = (g.hands['苏联'] || []).find(x => faceOf(x) === '17842')
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	R.action(g, 'Allies', 'play_card', { card: c17842 })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	/* 手牌：英国 15301；苏联 17900 + 建设陆军 */
	give(g, '15301', '英国'); give(g, '17900', '苏联'); give(g, '17800', '苏联')
	I.refresh(g)
	ok('E0 布阵：喀秋莎在苏联桌面',
		(g.table['苏联'] || []).some(x => faceOf(x) === '17842'),
		J(g.table['苏联']))
	ok('E1 攻击前 current_nation=英国', g.current_nation === '英国', J(g.current_nation))
	ok('E2 攻击前喀秋莎不可发动（不是苏联回合）',
		(R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')?.ready === false)

	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp_ne',
	})
	I.refresh(g)
	ok('E3 英国陆战成功移除日军', !g.location['jp_ne'], logSince(g, n0).slice(0, 160))
	ok('★★ E4 17900 让权后 current_nation 切到苏联（旧实现恒为英国）',
		g.current_nation === '苏联', J(g.current_nation))
	ok('E5 pending_armed_delegate 已建立且记录归还国',
		!!(g.pending_armed_delegate && g.pending_armed_delegate.return_nation === '英国'),
		J(g.pending_armed_delegate))
	const ts = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
	ok('★★ E6 让权期间喀秋莎 ready=true（旧实现灰显"当前是英国"）',
		!!(ts && ts.ready === true), J(ts && { ready: ts.ready, why: ts.ready_reason }))
}

/* ================= F. 组合场景：17900 + 喀秋莎 + 日陆军/飞机 ================= */
console.log('\n=== F. 组合：英国打<中国东北> → 17900 → <中国东部>日本陆军+飞机 → 喀秋莎 ===')
{
	const g = scene('英国', '日本', false)
	delete g.location['su_ne']; delete g.piece_nation['su_ne']; delete g.piece_type['su_ne']
	g.location['jp_ne'] = NE
	g.piece_nation['jp_ne'] = '日本'
	g.piece_type['jp_ne'] = 'army'
	/* <中国东部>：日本陆军 + 同地区日本空军 */
	g.location['jp_ce'] = CE; g.piece_nation['jp_ce'] = '日本'; g.piece_type['jp_ce'] = 'army'
	g.location['jp_air'] = CE; g.piece_nation['jp_air'] = '日本'; g.piece_type['jp_air'] = 'air'
	/* 苏联桌面喀秋莎 */
	give(g, '17842', '苏联'); I.refresh(g)
	const c17842 = (g.hands['苏联'] || []).find(x => faceOf(x) === '17842')
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	R.action(g, 'Allies', 'play_card', { card: c17842 })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	give(g, '15301', '英国'); give(g, '17900', '苏联'); give(g, '17800', '苏联')
	I.refresh(g)
	ok('F0 <中国东部> = 日本陆军+日本空军',
		I.pieces_on(g, CE).length === 2, J(I.pieces_on(g, CE)))

	/* ① 英国打<中国东北> -> 17900 让权 */
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp_ne',
	})
	I.refresh(g)
	ok('F1 17900 让权建立、current_nation=苏联',
		!!g.pending_armed_delegate && g.current_nation === '苏联', J(g.current_nation))

	/* ② 17900 第一步：弃建设陆军、在<中国东北>征召苏军 */
	const c17900 = instOf(g, '苏联', '17900')
	const c17800 = instOf(g, '苏联', '17800')
	R.action(g, 'Allies', 'use_armed_offer', { card: c17900, drop: [c17800] })
	I.refresh(g)
	ok('F2 17900 第二步候选含<中国东部>',
		((g.armed_offers || []).find(w => w.kind === 'special')?.pending?.candidates || [])
			.some(c => Number(c.id != null ? c.id : c) === Number(CE)),
		J((g.armed_offers || []).find(w => w.kind === 'special')?.pending))

	/* ③ 第二步：打<中国东部>（有日军+日机 -> 空军代受挂起） */
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: c17900, space: CE })
	I.refresh(g)
	ok('F3 第二步真实发起陆战', /发起1次陆战/.test(logSince(g, n0)),
		logSince(g, n0).slice(0, 160))
	ok('★★ F4 日军有同地区空军 -> 挂起等日本代受',
		!!(g.pending_battle && g.pending_battle.stage === 'defend'), J(g.pending_battle))
	ok('F5 日本端白名单含 resolve_battle', acts(g, 'Axis').indexOf('resolve_battle') >= 0,
		J(acts(g, 'Axis').slice(0, 8)))
	ok('F6 此时日军+日机都还在', !!g.location['jp_ce'] && !!g.location['jp_air'])

	/* ④ 日本「不代受」-> 按空战口径移除陆军，空军同场被移除 */
	R.action(g, 'Axis', 'resolve_battle', { declined: true, retreat: null })
	I.refresh(g)
	ok('F7 日本不代受后 <中国东部> 清空（陆军+空军都被移除）',
		I.pieces_on(g, CE).length === 0, J(I.pieces_on(g, CE)))

	/* ⑤ 喀秋莎 after_land 窗口转绿，指向战斗地区<中国东部> */
	const ts = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
	ok('★★ F8 喀秋莎窗口转绿且指向<中国东部>',
		!!(ts && ts.ready === true && Number(ts.ready_space) === Number(CE)),
		J(ts && { ready: ts.ready, space: ts.ready_space }))
	ok('F9 17900 已结算并归还控制权', !g.pending_armed_delegate && g.current_nation === '英国',
		J({ pd: g.pending_armed_delegate, cur: g.current_nation }))

	/* ⑥ 喀秋莎对战斗地区再发起陆战（目标已空 -> 苏联中立空打，必须放行） */
	const cid = (g.table['苏联'] || []).find(x => faceOf(x) === '17842')
	const drop = (g.hands['苏联'] || []).slice(0, 1)
	const newP = I.pieces_on(g, NE).find(p =>
		g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army')
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', {
		card: cid, discard: drop, space: CE, from: newP, victim: 0,
	})
	I.refresh(g)
	const lg = logSince(g, n1)
	ok('★★ F10 喀秋莎发动成功（苏联中立空打不再被拦）',
		/喀秋莎/.test(lg) && !/尚未参战/.test(lg), lg.slice(0, 180))
	ok('F11 喀秋莎次数已消耗（本回合不能再用）',
		(R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')?.ready === false)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
