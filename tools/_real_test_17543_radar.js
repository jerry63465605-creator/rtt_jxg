/*
 * 真实测试：17543《雷达》（美国 STATUS，piece_removed 窗口）
 *
 * 修复目标（玩家实测）：同盟【非美国】部队被移除时，雷达也高亮 -> 点下去先损耗 2 张牌才报
 * 「仅当美国海军被移除后发动」= 白亏。
 *
 * 范式对齐：状态卡 trigger 支持 `ready(game, ctx)`（与 17808/17811/15351 的 armed.ready 同款），
 * arm_status_instant / status_window_ready 两处同源，不满足就不武装、也不置亮。
 *
 * 用法：node tools/_real_test_17543_radar.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const hasTable = (g, n, face) => ((g.table || {})[n] || []).some(x => faceOf(x) === String(face))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

/* 布阵：美国打出 17543 上桌（先过 17555《大萧条的余波》的前置弃牌） */
function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	let c = (g.hands['美国'] || []).find(x => faceOf(x) === '17543')
	if (!c) {
		R.action(g, 'Allies', 'debug_add_card', { face: '17543', nation: '美国', dest: 'hand' })
		I.refresh(g)
		c = (g.hands['美国'] || []).find(x => faceOf(x) === '17543')
	}
	R.action(g, 'Allies', 'play_card', { card: c })
	if (g.us_depression_discard && g.us_depression_discard.pending) {
		const pay = (g.hands['美国'] || []).find(x => faceOf(x) !== '17543')
		R.action(g, 'Allies', 'us_depression_discard', { card: pay })
	}
	I.refresh(g)
	return g
}
const radarInst = g => ((g.table['美国'] || []).find(x => faceOf(x) === '17543'))
const radarView = g => (R.view(g, 'Allies').table_status || []).filter(t => faceOf(t.card) === '17543')[0]
const armed = g => (g.status_instant || []).some(e => faceOf(e.card_id) === '17543')

console.log('\n=== 0. 雷达上桌 ===')
const g0 = setup()
ok('★ 美国桌面有《雷达》', hasTable(g0, '美国', 17543), JSON.stringify((g0.table['美国'] || []).map(faceOf)))

console.log('\n=== A. 英国陆军被移除（同盟非美国）→ 不武装、不置亮、点了不白亏 ===')
{
	const g = setup()
	const sp = d.id_of('西欧')
	/* 用原子走真实移除路径（会写 last_piece_removed 并 arm_status_instant） */
	g.last_piece_removed = null
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_a1', nation: '英国', type: 'army', space: sp })
	I.refresh(g)
	const n0 = (g.log || []).length
	I.eliminate_piece(g, '德国', sp, 'uk_a1', { type: 'army' })
	console.log('  eliminate 英国陆军: ' + logSince(g, n0))
	ok('英国陆军确实被移除', g.location['uk_a1'] == null)
	ok('★ 雷达【没有】被武装进 status_instant', !armed(g),
		JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id))))
	const tv = radarView(g)
	console.log('  view.table_status(17543)=' + JSON.stringify(tv && { ready: tv.ready, reason: tv.ready_reason }))
	ok('★ 客户端不会置亮（ready=false）', tv && tv.ready === false, JSON.stringify(tv && tv.ready))

	/* 强制提交也不能白亏：不扣牌 */
	const pile0 = (g.decks['美国'] || []).length
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: radarInst(g) })
	const lg = logSince(g, n1)
	console.log('  强制 activate_status: ' + lg)
	ok('★ 被拒（未进入效果）', /不能发动|不满足/.test(lg), lg)
	ok('★ 没有损耗代价（牌库张数不变）', (g.decks['美国'] || []).length === pile0,
		pile0 + ' -> ' + (g.decks['美国'] || []).length)
}

console.log('\n=== B. 美国海军被移除 → 武装 + 置亮 + 发动后还原 ===')
{
	const g = setup()
	const sp = d.id_of('北海')
	R.action(g, 'Allies', 'debug_place', { piece: 'us_n1', nation: '美国', type: 'navy', space: sp })
	I.refresh(g)
	const n0 = (g.log || []).length
	I.eliminate_piece(g, '德国', sp, 'us_n1', { type: 'navy' })
	console.log('  eliminate 美国海军: ' + logSince(g, n0))
	ok('美国海军被移除', g.location['us_n1'] == null)
	ok('★ 雷达被武装进 status_instant', armed(g),
		JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id))))
	const tv = radarView(g)
	ok('★ 客户端置亮（ready=true）', tv && tv.ready === true, JSON.stringify(tv && tv))
	/* 发动：损耗 2 张 -> 海军还原 */
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: radarInst(g) })
	console.log('  activate_status: ' + logSince(g, n1))
	ok('★★ 美国海军被还原到原地区', g.location['us_n1'] === sp, String(g.location['us_n1']))
	ok('本回合受保护（protect 修饰器生效）', I.is_protected(g, 'us_n1') === true,
		String(I.is_protected(g, 'us_n1')))
	ok('once_per_turn 已记账', (g.status_used || {})[String(radarInst(g))] != null,
		JSON.stringify(g.status_used || {}))
}

console.log('\n=== C. 德国陆军被移除 → 完全不武装 ===')
{
	const g = setup()
	const sp = d.id_of('东欧')
	R.action(g, 'Axis', 'debug_place', { piece: 'de_x1', nation: '德国', type: 'army', space: sp })
	I.refresh(g)
	I.eliminate_piece(g, '苏联', sp, 'de_x1', { type: 'army' })
	ok('★ 雷达未被武装', !armed(g), JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id))))
	ok('★ 未置亮', radarView(g) && radarView(g).ready === false)
}

console.log('\n=== D. 同回合第二次美国海军被移除 → once_per_turn 不再武装 ===')
{
	const g = setup()
	const sp = d.id_of('北海')
	R.action(g, 'Allies', 'debug_place', { piece: 'us_n1', nation: '美国', type: 'navy', space: sp })
	I.refresh(g)
	I.eliminate_piece(g, '德国', sp, 'us_n1', { type: 'navy' })
	R.action(g, 'Allies', 'activate_status', { card: radarInst(g) })
	ok('第一次已发动', (g.status_used || {})[String(radarInst(g))] != null)
	/* 再移除一支美国海军 */
	R.action(g, 'Allies', 'debug_place', { piece: 'us_n2', nation: '美国', type: 'navy', space: sp })
	I.refresh(g)
	I.eliminate_piece(g, '德国', sp, 'us_n2', { type: 'navy' })
	ok('★ 同回合不再武装', !armed(g),
		JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id))))
}

console.log('\n=== E. 范式一致性：17808 / 17811 / 15351 的 armed.ready 不受影响 ===')
{
	const E = I.ECHO_EFFECTS || {}
	ok('17808 有 ready 且是函数', typeof (E['17808'] || {}).armed?.ready === 'function')
	ok('17811 有 ready 且是函数', typeof (E['17811'] || {}).armed?.ready === 'function')
	ok('15351 有 ready 且是函数', typeof (E['15351'] || {}).armed?.ready === 'function')
	/* 传不匹配 ctx 应返回 false（与改前一致） */
	ok('17808 ready(非苏联陆军)=false',
		E['17808'].armed.ready({ location: {} }, { piece_nation: '英国', piece_type: 'army' }) === false)
	ok('17811 ready(非苏联空军)=false',
		E['17811'].armed.ready({ location: {} }, { piece_nation: '英国', piece_type: 'air' }) === false)
	/* 17543 自身 ready 契约 */
	const T = (I.STATUS_EFFECTS || {})['17543'].trigger
	ok('17543 ready 已声明且为函数', typeof T.ready === 'function')
	ok('17543 ready(美国海军)=true', T.ready({}, { piece_nation: '美国', piece_type: 'navy' }) === true)
	ok('17543 ready(英国陆军)=false', T.ready({}, { piece_nation: '英国', piece_type: 'army' }) === false)
	ok('17543 ready(美国陆军)=false', T.ready({}, { piece_nation: '美国', piece_type: 'army' }) === false)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
