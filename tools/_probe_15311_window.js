/*
 * B8 只读探针：15311《马奇诺防线》等「被移除时」的增强卡，是否真的挂起给另一方
 *
 *  场景：德国（敌方、其回合）攻击<西欧>的法国陆军 -> 该陆军被移除
 *  检查：① 全局 armed_offers 有没有 15311 的窗口
 *        ② Axis / Allies 两侧 view 里能不能看到
 *        ③ 英国/法国手牌够不够付 cost.discard=4
 *        ④ restore_piece 能不能成功复原
 *  另外：列出所有 armed.when='piece_removed' 的卡（同类盘点）
 *
 * 用法：node tools/_probe_15311_window.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const offBrief = g => (g.armed_offers || []).map(w => ({
	when: w.when,
	cards: (w.cards || []).map(c => c.card_id + '/' + faceOf(c.card_id)),
}))
const viewOff = (g, side) => {
	const v = R.view(g, side)
	return v.armed_offer ? { when: v.armed_offer.when, n: (v.armed_offer.cards || []).length } : null
}

console.log('=== 0. 同类盘点：armed.when === "piece_removed" 的卡 ===')
{
	const E = I.ECHO_EFFECTS || {}
	for (const k of Object.keys(E)) {
		const ar = E[k] && E[k].armed
		if (!ar) continue
		console.log('  ' + k + '  ' + (E[k].name || '') +
			'  actor=' + (ar.actor || '-') + '  watch=' + !!ar.watch +
			'  when=' + ar.when + '  discard=' + ((ar.cost && ar.cost.discard) || 0) +
			'  hasFilter=' + (typeof ar.filter === 'function'))
	}
}

/* 造局：15311 上桌（法国卡，按委托放在英国桌）+ 法国陆军@西欧 */
function setup(trimUkHand) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 15311 放英国手牌，用英国回合打出（法国是委托国，卡由英国玩家持有） */
	R.action(g, 'Allies', 'debug_add_card', { face: '15311', nation: '英国', dest: 'hand' })
	I.refresh(g)
	let placedAs = null
	for (const nat of ['英国', '法国']) {
		R.action(g, 'Allies', 'debug_set_phase', { nation: nat, phase: 'play' })
		const c = (g.hands[nat] || []).find(x => faceOf(x) === '15311')
		if (c) {
			R.action(g, 'Allies', 'play_card', { card: c })
			break
		}
	}
	for (const nat of Object.keys(g.table || {}))
		if ((g.table[nat] || []).some(x => faceOf(x) === '15311')) placedAs = nat
	console.log('  15311 上桌归属 = ' + placedAs + '  桌面 = ' +
		JSON.stringify(Object.keys(g.table || {}).map(k => k + ':' + (g.table[k] || []).map(faceOf).join(','))))
	console.log('  英国手牌 = ' + (g.hands['英国'] || []).length + '  法国手牌 = ' + ((g.hands['法国'] || []).length))
	if (trimUkHand) {
		const keep = (g.hands['英国'] || []).slice(0, trimUkHand)
		g.hands['英国'] = keep
		console.log('  【裁剪】英国手牌裁到 ' + keep.length + ' 张')
	}
	I.refresh(g)
	return g
}

/* 德国在自己回合攻击<西欧>的法国陆军（真实 do_battle） */
function attackWestEurope(g) {
	const we = d.id_of('西欧')
	R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: d.id_of('德国') })
	R.action(g, 'Allies', 'debug_place', { piece: 'fr_def', nation: '法国', type: 'army', space: we })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	I.grant_supply(g, 'de_atk', g.turn)
	I.grant_supply(g, 'fr_def', g.turn)
	I.refresh(g)
	console.log('  西欧守军 = ' + JSON.stringify(I.pieces_on(g, we).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')')))
	const n0 = (g.log || []).length
	const r = I.do_battle(g, '德国', we, 'fr_def', 'land', { from: 'de_atk' })
	console.log('  do_battle = ' + JSON.stringify(r && { ok: r.ok, reason: r.reason }))
	console.log('  log = ' + logSince(g, n0).slice(0, 300))
	return { ok: r && r.ok, log: logSince(g, n0) }
}

console.log('\n=== 1. 手牌充足（>=5）时：德国回合移除法国陆军 ===')
{
	const g = setup(0)
	attackWestEurope(g)
	console.log('  g.armed_offers = ' + JSON.stringify(offBrief(g)))
	console.log('  Axis 视角 armed_offer = ' + JSON.stringify(viewOff(g, 'Axis')))
	console.log('  Allies 视角 armed_offer = ' + JSON.stringify(viewOff(g, 'Allies')))
	console.log('  法国陆军还在? ' + JSON.stringify(g.location['fr_def']))
}

console.log('\n=== 2. 手牌不足（裁到 2 张，不够弃 4） ===')
{
	const g = setup(2)
	attackWestEurope(g)
	console.log('  g.armed_offers = ' + JSON.stringify(offBrief(g)))
	console.log('  Allies 视角 armed_offer = ' + JSON.stringify(viewOff(g, 'Allies')))
}

console.log('\n=== 3. 若窗口存在：restore_piece 能否复原 ===')
{
	const g = setup(0)
	const probeCtx = { piece_id: 'fr_def', piece: 'fr_def', piece_nation: '法国', piece_type: 'army', space: d.id_of('西欧') }
	/* 先摆一支法国陆军（不经过战斗），单独验证 restore_piece 契约 */
	R.action(g, 'Allies', 'debug_place', { piece: 'fr_x', nation: '法国', type: 'army', space: d.id_of('西欧') })
	I.refresh(g)
	delete g.location['fr_x']
	const r1 = (typeof I.restore_piece === 'function') ? I.restore_piece(g, Object.assign({}, probeCtx, { piece_id: 'fr_x' })) : 'no-export'
	console.log('  restore_piece(ctx={piece_id}) = ' + JSON.stringify(r1) + '  → location=' + g.location['fr_x'])
	const r2 = (typeof I.restore_piece === 'function') ? I.restore_piece(g, Object.assign({}, probeCtx, { piece_id: undefined, piece: 'fr_x' })) : 'no-export'
	console.log('  restore_piece(ctx={piece})    = ' + JSON.stringify(r2) + '  → location=' + g.location['fr_x'])
}
