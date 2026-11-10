/*
 * 2026-11-11 · 17900《八月风暴》：涉及战斗的让权【手动归还】真实测试
 *
 * 玩家口径：「所有可能涉及到战斗的让权，都应该手动归还而不是自动归还，
 *            避免未能正确成功触发状态」+「要求无硬挂起」
 *
 * 场景：英国回合对中国东北发起陆战 → 苏联持 17900 + 建设陆军
 *       → 桌面有喀秋莎(17842) + 日本中国东部陆军 + 同地区日本空军。
 *
 * 忠实复现：new_board + 全程 R.action，不手写挂起。
 * 用法：node tools/_real_test_17900_manual_finish.js
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
const acts = (g, side) => Object.keys(R.view(g, 'Allies').actions || {}).length
		? Object.keys(R.view(g, side).actions || {}) : []
const pdOf = g => g.pending_armed_delegate

const NE = d.id_of('中国东北')
const CE = d.id_of('中国东部')

/** 建盘：英国回合 → 打<中国东北> → 17900 让权 → 第二步打<中国东部>（日军+日机） */
function scene() {
	const g = new_board(20261111, { nation: '苏联', phase: 'play' })
	clear_pending(g)
	/* 苏联桌面：喀秋莎 */
	give(g, '17842', '苏联'); I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', '17842') })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	place(g, 'jp_ne', '日本', 'army', '中国东北')
	place(g, 'uk_w', '英国', 'army', '中国西部')
	/* 苏联补给链（新征召苏军要靠它才能发起陆战） */
	place(g, 'su_sib', '苏联', 'army', '西伯利亚')
	place(g, 'su_vl', '苏联', 'army', '海参崴')
	I.refresh(g)
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' })
	I.refresh(g)
	g.location['jp_ce'] = CE; g.piece_nation['jp_ce'] = '日本'; g.piece_type['jp_ce'] = 'army'
	g.location['jp_air'] = CE; g.piece_nation['jp_air'] = '日本'; g.piece_type['jp_air'] = 'air'
	I.refresh(g)
	I.grant_supply(g, 'uk_w', g.turn || 1); I.refresh(g); I.compute_supply(g)
	give(g, '15301', '英国'); give(g, '17900', '苏联'); give(g, '17800', '苏联')
	I.refresh(g)
	return g
}

/** 推到"第二步已发起陆战、战斗挂起" */
function toBattlePending(g) {
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp_ne',
	})
	I.refresh(g)
	R.action(g, 'Allies', 'use_armed_offer', {
		card: instOf(g, '苏联', '17900'), drop: [instOf(g, '苏联', '17800')],
	})
	I.refresh(g)
	R.action(g, 'Allies', 'use_armed_offer', {
		card: instOf(g, '苏联', '17900'), space: CE,
	})
	I.refresh(g)
}

/* ================= A. 打出后不自动归还 ================= */
console.log('\n=== A. 第二步发起陆战（战斗挂起）后，委托必须仍在 ===')
{
	const g = scene()
	toBattlePending(g)
	const pd = pdOf(g)
	ok('A1 让权委托仍在（旧实现此处已自动归还）', !!pd, J(pd))
	ok('★ A2 pd.played = true', !!(pd && pd.played), J(pd))
	ok('★★ A3 current_nation 仍是苏联（战斗未结算完不归还）',
		g.current_nation === '苏联', J(g.current_nation))
	ok('A4 战斗确实挂起（等日本代受）',
		!!(g.pending_battle && g.pending_battle.stage === 'defend'), J(g.pending_battle))
	const v = R.view(g, 'Allies').pending_armed_delegate
	ok('A5 view 下发 played/can_finish/name',
		!!(v && v.played === true && v.can_finish === false && /八月风暴/.test(v.name || '')), J(v))
	ok('★ A6 can_finish=false（有硬挂起不许结束）', v && v.can_finish === false, J(v && v.can_finish))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'finish_armed_delegate', {})
	const lg = logSince(g, n0)
	ok('★★ A7 战斗未结算时点「结束委托」被拒',
		!!pdOf(g) && /尚未结算完/.test(lg), lg.slice(0, 160))
	ok('A8 被拒后委托仍在、current_nation 未变',
		!!pdOf(g) && g.current_nation === '苏联', J({ pd: !!pdOf(g), cur: g.current_nation }))
	ok('A9 防守方（Axis）白名单含 resolve_battle',
		Object.keys(R.view(g, 'Axis').actions || {}).includes('resolve_battle'),
		J(Object.keys(R.view(g, 'Axis').actions || {}).slice(0, 8)))
	ok('A10 被让权方（Allies）白名单含 finish_armed_delegate',
		Object.keys(R.view(g, 'Allies').actions || {}).includes('finish_armed_delegate'),
		J(Object.keys(R.view(g, 'Allies').actions || {}).slice(0, 14)))
}

/* ================= B. 战斗结算后 can_finish 放开 ================= */
console.log('\n=== B. 日本不代受、战斗结算完后 ===')
{
	const g = scene()
	toBattlePending(g)
	R.action(g, 'Axis', 'resolve_battle', { declined: true, retreat: null })
	I.refresh(g)
	ok('B1 战斗已结算', !g.pending_battle, J(g.pending_battle))
	ok('B2 日军+日机同场被移除', I.pieces_on(g, CE).length === 0, J(I.pieces_on(g, CE)))
	ok('★★ B3 current_nation 仍是苏联（未自动归还）', g.current_nation === '苏联', J(g.current_nation))
	const v = R.view(g, 'Allies').pending_armed_delegate
	ok('★★ B4 can_finish 转 true（无硬挂起）', !!(v && v.can_finish === true), J(v))
	/* 状态卡窗口此时才武装：喀秋莎应可发动 */
	const ts = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
	ok('★★ B5 喀秋莎窗口已武装且 ready（状态能正确触发）',
		!!(ts && ts.ready === true && Number(ts.ready_space) === Number(CE)),
		J(ts && { ready: ts.ready, space: ts.ready_space, why: ts.ready_reason }))
	const cid = (g.table['苏联'] || []).find(x => faceOf(x) === '17842')
	const newP = I.pieces_on(g, NE).find(p =>
		g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', {
		card: cid, discard: [(g.hands['苏联'] || [])[0]], space: CE, from: newP, victim: 0,
	})
	const lg = logSince(g, n0)
	ok('★★ B6 委托期间喀秋莎能真实发动（旧实现会落在别人回合）',
		/喀秋莎/.test(lg) && !/尚未参战/.test(lg), lg.slice(0, 180))
}

/* ================= C. 手动结束才归还 ================= */
console.log('\n=== C. 点「结束委托」才归还控制权 ===')
{
	const g = scene()
	toBattlePending(g)
	R.action(g, 'Axis', 'resolve_battle', { declined: true, retreat: null })
	I.refresh(g)
	const before = g.current_nation
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'finish_armed_delegate', {})
	I.refresh(g)
	const lg = logSince(g, n0)
	ok('C0 结束前 current_nation=苏联', before === '苏联', J(before))
	ok('★★ C1 结束后归还英国', g.current_nation === '英国', J(g.current_nation))
	ok('C2 委托已清空', !pdOf(g), J(pdOf(g)))
	ok('C3 special 窗口已移除',
		!(g.armed_offers || []).some(w => w.kind === 'special'),
		J((g.armed_offers || []).map(w => w.kind)))
	ok('C4 日志写明委托结束', /委托结束/.test(lg), lg.slice(0, 160))
	ok('C5 结束后 Allies 不再有 finish_armed_delegate',
		!Object.keys(R.view(g, 'Allies').actions || {}).includes('finish_armed_delegate'))
}

/* ================= D. 未打出前仍是「打出/不打出」 ================= */
console.log('\n=== D. 对照：刚建窗口（未 played）仍是打出/不打出 ===')
{
	const g = scene()
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp_ne',
	})
	I.refresh(g)
	const v = R.view(g, 'Allies').pending_armed_delegate
	ok('D1 未 played', !!(v && v.played === false), J(v))
	const a = Object.keys(R.view(g, 'Allies').actions || {})
	ok('D2 白名单是 use/skip，不含 finish',
		a.includes('use_armed_offer') && a.includes('skip_armed_offer') &&
		!a.includes('finish_armed_delegate'), J(a.slice(0, 10)))
}

/* ================= E. 静态守卫 ================= */
console.log('\n=== E. 静态守卫（防回退成自动归还）===')
{
	const fs = require('fs')
	const path = require('path')
	const src = fs.readFileSync(path.join(L.MOD, 'rules.js'), 'utf8')
	const code = src.split('\n').filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l)).join('\n')
	ok('E1 存在 armed_delegate_can_finish 且判 pending_battle',
		/function armed_delegate_can_finish/.test(code) &&
		/game\.pending_battle/.test(code.split('function armed_delegate_can_finish')[1].slice(0, 900)))
	ok('E2 special 窗口在 refresh_armed_window 里保留（不自动 remove）',
		/win\.kind === 'special' && game\.pending_armed_delegate/.test(code))
	ok('E3 新增 finish_armed_delegate 动作与白名单',
		/action === 'finish_armed_delegate'/.test(code) &&
		/finish_armed_delegate: 1/.test(code))
	ok('E4 战斗守卫与响应守卫都放行 finish_armed_delegate',
		(action => (action.match(/action !== 'finish_armed_delegate'/g) || []).length >= 2)(code))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
