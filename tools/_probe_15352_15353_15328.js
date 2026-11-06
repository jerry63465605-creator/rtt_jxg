/*
 * 只读排查：① 增强拦截窗口(15352)是否强挂起 ② 15353 压制后的卡能否被 15328 弃掉
 * 用法：node tools/_probe_15352_15353_15328.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function fresh() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	return g
}

console.log('########## ① 15352《丘吉尔之怒》：敌方打出增强卡后的拦截窗口 ##########')
{
	const g = fresh()
	/* 德国手里一张增强卡（15245 俯冲轰炸机），英国桌面 15352 */
	R.action(g, 'Axis', 'debug_add_card', { face: '15245', nation: '德国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const uk = (g.hands['英国'] || []).find(x => faceOf(x) === '15352')
	/* 先把 15352 打到桌面（它是响应/增强类，走 play_card 暗置） */
	R.action(g, 'Allies', 'play_card', { card: uk })
	I.refresh(g)
	console.log('  英国桌面响应区 =', JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))),
		' 桌面 =', JSON.stringify((g.table['英国'] || []).map(faceOf)))

	const de = (g.hands['德国'] || []).find(x => faceOf(x) === '15245')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: de })
	console.log('  德国打出《俯冲轰炸机》log = ' + logSince(g, n0).slice(0, 200))
	console.log('  offers = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, n: (w.cards || []).length }))))
	console.log('  echo_queue = ' + JSON.stringify(I.echo_queue ? I.echo_queue(g) : '(未导出)'))

	/* ★ 关键：窗口存在时，德国还能不能继续动作？ */
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	const lg = logSince(g, n1)
	console.log('  窗口存在时德国 next_phase → ' + (lg || '(无日志/动作生效)'))
	console.log('  ★ 是否被拦 = ' + /等待【.+】决定是否发动/.test(lg))
	console.log('  当前 phase = ' + g.turn_phase + '  current_nation = ' + g.current_nation)
}

console.log('\n########## ② 15353 压制后的状态卡，15328 能否弃掉 ##########')
{
	const g = fresh()
	/* 德国桌面放一张 auto 计分状态卡（15241 瑞典铁矿），英国手里 15353 + 15328 */
	R.action(g, 'Axis', 'debug_add_card', { face: '15241', nation: '德国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15328', nation: '英国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	/* 打出 15241（状态卡 → 桌面） */
	const st = (g.hands['德国'] || []).find(x => faceOf(x) === '15241')
	R.action(g, 'Axis', 'play_card', { card: st })
	I.refresh(g)
	console.log('  德国桌面状态卡 =', JSON.stringify((g.table['德国'] || []).map(faceOf)))
	/* 英国把 15353 暗置 */
	const uk2 = (g.hands['英国'] || []).find(x => faceOf(x) === '15353')
	if (uk2) R.action(g, 'Allies', 'play_card', { card: uk2 })
	I.refresh(g)
	console.log('  英国桌面响应区 =', JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))

	/* 直接调用内部：派发 enemy_status_effect 窗口，模拟德国状态卡被触发 */
	const cid = (g.table['德国'] || []).find(x => faceOf(x) === '15241')
	console.log('  15241 实例 =', cid)
	const n0 = (g.log || []).length
	I.queue_status_react(g, 'scoring', { nation: '德国' }, [{ cid: cid, name: '瑞典铁矿' }])
	console.log('  queue 后 offers = ' + JSON.stringify((g.armed_offers || []).map(w => ({
		when: w.when, cards: (w.cards || []).map(c => faceOf(c.card_id)),
	}))))
	/* 英国用 15353 压制 */
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_status_effect')
	if (win && (win.cards || []).length) {
		const c = win.cards[0]
		R.action(g, 'Allies', 'use_armed_offer', { card: c.card_id, discard: (g.hands['英国'] || [])[0] })
		console.log('  用 15353 log = ' + logSince(g, n0).slice(0, 240))
	}
	console.log('  suppressed = ' + JSON.stringify(g.status_suppressed_this_turn))
	console.log('  ★ 15328 候选（uk_enigma_targets）= ' + JSON.stringify(g.uk_enigma_targets || null))
	console.log('  pending_status_react = ' + JSON.stringify(g.pending_status_react && { mode: g.pending_status_react.mode, fired: g.pending_status_react.fired }))
}
