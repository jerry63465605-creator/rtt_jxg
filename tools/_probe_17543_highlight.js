/*
 * 探查：17543《雷达》（美国 STATUS）在【同盟非美国】部队被移除时是否也会高亮/可点。
 *
 * 现象来源：arm_status_instant 按【同阵营】武装所有持有国的卡，17543 的 trigger 没有 ready/filter，
 *          于是英国/苏联部队被移除时，美国桌面的《雷达》也被武装 + table_status.ready=true。
 *
 * 用法：node tools/_probe_17543_highlight.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function fresh() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	/* 美国开局手牌里有 17543 吗？没有就发一张（先查再发，避免 V1 同卡多份） */
	let c = (g.hands['美国'] || []).find(x => faceOf(x) === '17543')
	if (!c) {
		R.action(g, 'Allies', 'debug_add_card', { face: '17543', nation: '美国', dest: 'hand' })
		I.refresh(g)
		c = (g.hands['美国'] || []).find(x => faceOf(x) === '17543')
	}
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: c })
	/* 17555《大萧条的余波》：美国打出状态卡须先自选弃 1 张，弃完服务端重放这张卡 */
	if (g.us_depression_discard && g.us_depression_discard.pending) {
		const pay = (g.hands['美国'] || []).find(x => faceOf(x) !== '17543')
		R.action(g, 'Allies', 'us_depression_discard', { card: pay })
	}
	console.log('打出 17543: ' + logSince(g, n0) + '  美国桌面=' + JSON.stringify((g.table['美国'] || []).map(faceOf)))
	return g
}

function show(g, tag) {
	const v = R.view(g, 'Allies')
	const ts = (v.table_status || []).filter(t => faceOf(t.card) === '17543')
	console.log('  [' + tag + ']')
	console.log('    my_nation=' + v.my_nation + '  current_nation=' + g.current_nation)
	console.log('    status_instant=' + JSON.stringify((g.status_instant || []).map(e => ({
		card: faceOf(e.card_id), window: e.window, space: e.space,
	}))))
	console.log('    table_status(17543)=' + JSON.stringify(ts.map(t => ({
		ready: t.ready, reason: t.ready_reason, window: t.window,
	}))))
	console.log('    last_piece_removed=' + JSON.stringify(g.last_piece_removed && {
		nation: g.last_piece_removed.nation, type: g.last_piece_removed.type,
	}))
}

/* ① 英国陆军被移除（同盟非美国） */
console.log('\n=== ① 英国陆军被移除（同盟非美国）===')
{
	const g = fresh()
	const sp = d.id_of('西欧')
	g.last_piece_removed = { nation: '英国', type: 'army', space: sp }
	I.arm_status_instant(g, 'piece_removed', '英国', sp)
	I.refresh(g)
	show(g, '英国陆军被移除后')

	/* 试着发动（期望：不该允许） */
	const inst = (g.table['美国'] || []).find(x => faceOf(x) === '17543')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: inst })
	console.log('    activate_status -> ' + logSince(g, n0))
}

/* ② 美国海军被移除（正常路径） */
console.log('\n=== ② 美国海军被移除（应高亮且可发动）===')
{
	const g = fresh()
	const sp = d.id_of('北海')
	g.last_piece_removed = { nation: '美国', type: 'navy', space: sp, piece: 'us_navy_x' }
	I.arm_status_instant(g, 'piece_removed', '美国', sp)
	I.refresh(g)
	show(g, '美国海军被移除后')
}

/* ③ 轴心部队被移除（不该武装同盟的卡） */
console.log('\n=== ③ 德国陆军被移除（不应武装同盟卡）===')
{
	const g = fresh()
	const sp = d.id_of('西欧')
	g.last_piece_removed = { nation: '德国', type: 'army', space: sp }
	I.arm_status_instant(g, 'piece_removed', '德国', sp)
	I.refresh(g)
	show(g, '德国陆军被移除后')
}
