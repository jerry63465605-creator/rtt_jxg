/*
 * 只读探针：完整走「英国回合打<中国东北> + 苏联 17900/建设陆军
 *            + 桌面喀秋莎 + <中国东部> 日本陆军+飞机」
 *
 * 当前 HEAD 已叠加两个改动，需联合验证：
 *   ① 17900 涉及战斗的让权【手动归还】（played / can_finish / finish_armed_delegate）
 *   ② after_land 只武装【发起国本人】（英国发起不点亮苏联喀秋莎；
 *      17900 第二步由苏联自己发起时才点亮）
 *
 * 用法：node tools/_probe_17900_katyusha_full.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const NE = d.id_of('中国东北')
const CE = d.id_of('中国东部')
const instOf = (g, nat, face) => (g.hands[nat] || []).find(x => faceOf(x) === String(face))
const piecesAt = (g, sp) => I.pieces_on(g, sp).map(p =>
	p + ':' + g.piece_nation[p] + '/' + g.piece_type[p])
const tsOf = (g, face) => (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === face)

function dump(g, tag) {
	console.log('\n--- ' + tag + ' ---')
	console.log('  active=' + g.active + ' current_nation=' + g.current_nation)
	console.log('  <中国东北> = ' + J(piecesAt(g, NE)))
	console.log('  <中国东部> = ' + J(piecesAt(g, CE)))
	console.log('  pending_armed_delegate = ' + J(g.pending_armed_delegate && {
		card: faceOf(g.pending_armed_delegate.card_id),
		played: !!g.pending_armed_delegate.played,
		return_nation: g.pending_armed_delegate.return_nation,
	}))
	console.log('  view.pending_armed_delegate.can_finish = ' +
		J(R.view(g, 'Allies').pending_armed_delegate &&
			R.view(g, 'Allies').pending_armed_delegate.can_finish))
	console.log('  armed_offers = ' + J((g.armed_offers || []).map(w => ({
		kind: w.kind, n: (w.cards || []).length, pending: !!(w.pending),
	}))))
	console.log('  pending_battle = ' + J(g.pending_battle && {
		stage: g.pending_battle.stage, space: g.pending_battle.space,
		defender: g.pending_battle.defender_nation,
	}))
	console.log('  status_instant = ' + J((g.status_instant || []).map(e =>
		faceOf(e.card_id) + '@' + e.window + ' by=' + e.by)))
	const ts = tsOf(g, '17842')
	console.log('  喀秋莎 table_status = ' + J(ts && {
		ready: ts.ready, space: ts.ready_space, why: ts.ready_reason,
	}))
	console.log('  acts(Allies) = ' + J(Object.keys(R.view(g, 'Allies').actions || {}).slice(0, 12)))
	console.log('  acts(Axis)  = ' + J(Object.keys(R.view(g, 'Axis').actions || {}).slice(0, 12)))
}

/** 建盘；neAir=true 时在<中国东北>额外放日本空军（让英国那一战也挂起代受） */
function scene(neAir) {
	const g = new_board(20261111, { nation: '苏联', phase: 'play' })
	clear_pending(g)
	give(g, '17842', '苏联'); I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', '17842') })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	place(g, 'uk_w', '英国', 'army', '中国西部')
	place(g, 'su_sib', '苏联', 'army', '西伯利亚')
	place(g, 'su_vl', '苏联', 'army', '海参崴')
	I.refresh(g)
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' }); I.refresh(g)
	g.location['jp_ne'] = NE; g.piece_nation['jp_ne'] = '日本'; g.piece_type['jp_ne'] = 'army'
	if (neAir) {
		g.location['jp_ne_air'] = NE; g.piece_nation['jp_ne_air'] = '日本'; g.piece_type['jp_ne_air'] = 'air'
	}
	g.location['jp_ce'] = CE; g.piece_nation['jp_ce'] = '日本'; g.piece_type['jp_ce'] = 'army'
	g.location['jp_air'] = CE; g.piece_nation['jp_air'] = '日本'; g.piece_type['jp_air'] = 'air'
	I.refresh(g)
	I.grant_supply(g, 'uk_w', g.turn || 1)
	I.refresh(g); I.compute_supply(g)
	give(g, '15301', '英国'); give(g, '17900', '苏联'); give(g, '17800', '苏联')
	I.refresh(g)
	return g
}

/* ================= 主线：<中国东北> 无空军 ================= */
console.log('================ 主线：<中国东北> 只放日本陆军 ================')
{
	const g = scene(false)
	dump(g, 'S0 布阵完成')
	console.log('  [复查] 英国发起单位 = ' + J(I.battle_initiators(g, '英国', NE).map(x => x.id)))

	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp_ne',
	})
	I.refresh(g)
	console.log('\n=== S1 英国打<中国东北> ===\n  ' + logSince(g, n0).slice(0, 260))
	dump(g, 'S1 英国陆战后')

	const pd1 = g.pending_armed_delegate
	if (pd1) {
		const c17900 = instOf(g, '苏联', '17900')
		const c17800 = instOf(g, '苏联', '17800')
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: c17900, drop: [c17800] })
		I.refresh(g)
		console.log('\n=== S2 17900 第一步（弃建设陆军+征召） ===\n  ' + logSince(g, n1).slice(0, 260))
		dump(g, 'S2 待选目标')

		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: instOf(g, '苏联', '17900'), space: CE })
		I.refresh(g)
		console.log('\n=== S3 第二步打<中国东部> ===\n  ' + logSince(g, n2).slice(0, 320))
		dump(g, 'S3 第二步后（战斗应挂起）')

		if (g.pending_battle) {
			/* 【玩家口径】日本【代受】：用同地区日本空军替陆军挨打（空军被移除、陆军保住） */
			const n3 = (g.log || []).length
			R.action(g, 'Axis', 'resolve_battle', { use_air: 'jp_air' })
			I.refresh(g)
			console.log('\n=== S4 日本代受 ===\n  ' + logSince(g, n3).slice(0, 320))
			dump(g, 'S4 代受后')
			/* 若进入 counter（等攻击方抵消），苏联没有相邻空军 -> 明确不抵消 */
			if (g.pending_battle && g.pending_battle.stage === 'counter') {
				const n3b = (g.log || []).length
				R.action(g, 'Allies', 'resolve_battle', { declined: true })
				I.refresh(g)
				console.log('\n=== S4b 攻击方不抵消 ===\n  ' + logSince(g, n3b).slice(0, 240))
				dump(g, 'S4b 抵消阶段结束')
			}
		}

		/* 喀秋莎此时应可用（苏联自己发起的那一场触发 after_land） */
		const ts = tsOf(g, '17842')
		if (ts && ts.ready) {
			const cid = (g.table['苏联'] || []).find(x => faceOf(x) === '17842')
			const newP = I.pieces_on(g, NE).find(p =>
				g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army')
			/* 代受后<中国东部>仍留有日本陆军 -> 喀秋莎应能真实移除它（不是空打） */
			const remain = I.pieces_on(g, CE).find(p => g.piece_nation[p] === '日本')
			const n4 = (g.log || []).length
			R.action(g, 'Allies', 'activate_status', {
				card: cid, discard: (g.hands['苏联'] || []).slice(0, 1),
				space: CE, from: newP, victim: remain || 0,
			})
			I.refresh(g)
			console.log('\n=== S5 发动喀秋莎（target=' + J(remain) + '）===\n  ' +
				logSince(g, n4).slice(0, 300))
			dump(g, 'S5 喀秋莎发动后')
			console.log('  ★ 剩余日军是否被移除 = ' + J(!remain || !g.location[remain]))
		}

		if (g.pending_armed_delegate) {
			const n5 = (g.log || []).length
			R.action(g, 'Allies', 'finish_armed_delegate', {})
			I.refresh(g)
			console.log('\n=== S6 结束委托 ===\n  ' + logSince(g, n5).slice(0, 200))
			dump(g, 'S6 结束委托后')
		}
	}
}

/* ================= 变体：<中国东北> 也有日本空军 ================= */
console.log('\n\n================ 变体：<中国东北> 也有日本空军 ================')
{
	const g = scene(true)
	dump(g, 'V0 布阵完成')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp_ne',
	})
	I.refresh(g)
	console.log('\n=== V1 英国打<中国东北>（有日机 -> 应挂起代受）===\n  ' +
		logSince(g, n0).slice(0, 300))
	dump(g, 'V1 英国陆战后')
	if (g.pending_battle) {
		const n1 = (g.log || []).length
		R.action(g, 'Axis', 'resolve_battle', { declined: true, retreat: null })
		I.refresh(g)
		console.log('\n=== V2 日本不代受 ===\n  ' + logSince(g, n1).slice(0, 300))
		dump(g, 'V2 战斗结算后（17900 应在此武装）')
	}
}
