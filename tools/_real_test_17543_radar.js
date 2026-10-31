/*
 * 真实测试（rtt-realboard-test §7 范式 B）：17543《雷达》（美国 STATUS，piece_removed 窗口）
 *
 * 玩家实测：同盟【非美国】部队被移除时，雷达也高亮 -> 点下去先损耗 2 张牌才报
 * 「仅当美国海军被移除后发动」= 白亏。
 *
 * 本轮按铁律改：
 *   ① 布阵只用 debug_*（debug_set_phase / debug_place / debug_add_card）；
 *   ② 驱动只用真实路径 —— 移除一律走 do_battle（= play_card「发起陆战/海战」的核心），
 *      不再用 I.eliminate_piece 走"卡外捷径"；
 *   ③ 三层断言（服务端状态 / view / 日志）+ 残留检查。
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
	if (!c) {                                   /* 开局手牌没有才补发（V1：避免同卡多份） */
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

/* 真实战斗：德国陆军从<德国>打<西欧>，受害者是英国陆军 */
function landBattleRemoveUK(g) {
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_a1', nation: '英国', type: 'army', space: d.id_of('西欧') })
	I.refresh(g)
	const atk = Object.keys(g.location).find(p =>
		g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === d.id_of('德国'))
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', d.id_of('西欧'), 'uk_a1', 'land', { from: atk })
	return logSince(g, n0)
}

/* 真实战斗：德国海军打美国海军（海战）；动态找一对"目标海域 ↔ 相邻海域有空槽" */
function seaBattleRemoveUS(g, tag, avoid) {
	avoid = avoid || []
	const seas = Object.keys(d.spaces).map(Number).filter(s =>
		d.spaces[s] && d.spaces[s].terrain === 'sea' && avoid.indexOf(s) < 0)
	let pick = null
	for (const target of seas) {
		if (Object.keys(g.location).some(p => g.location[p] === target)) continue
		for (const nb of I.get_connections(g, target, 'axis')) {
			if (!d.spaces[nb] || d.spaces[nb].terrain !== 'sea') continue
			if (Object.keys(g.location).some(p => g.location[p] === nb)) continue
			pick = { target, from: nb }
			break
		}
		if (pick) break
	}
	if (!pick) throw new Error('找不到可用的海战海域对')
	R.action(g, 'Allies', 'debug_place', { piece: 'us_' + tag, nation: '美国', type: 'navy', space: pick.target })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_' + tag, nation: '德国', type: 'navy', space: pick.from })
	I.refresh(g)
	/* 薄局面：显式给发起海军补给（skill §十 技巧 1），否则 do_battle 会因「发起单位不处于补给状态」拒绝 */
	I.grant_supply(g, 'de_' + tag, g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	const r = I.do_battle(g, '德国', pick.target, 'us_' + tag, 'sea', { from: 'de_' + tag })
	return { log: logSince(g, n0) + (r && r.ok === false ? ' 【do_battle 拒绝】' + r.reason : ''),
		target: pick.target, us: 'us_' + tag }
}

console.log('\n=== 0. 布阵合规自检（skill §8）===')
const g0 = setup()
ok('美国桌面有《雷达》', hasTable(g0, '美国', 17543), JSON.stringify((g0.table['美国'] || []).map(faceOf)))
{
	/*
	 * V1 自检（只查"在场"的实例：手牌 + 桌面）。
	 * 17543 开局不在手牌（在牌库深处），本测试用 debug_add_card 取一份上来；
	 * 牌库里那份仍躺着，但它不参与任何判定 —— 断言只看在场份数。
	 */
	const inPlay = []
	for (const n of Object.keys(g0.hands || {}))
		for (const id of (g0.hands[n] || [])) if (faceOf(id) === '17543') inPlay.push('hand:' + n)
	for (const n of Object.keys(g0.table || {}))
		for (const id of (g0.table[n] || [])) if (faceOf(id) === '17543') inPlay.push('table:' + n)
	const deckCopies = Object.values(g0.decks || {}).flat().filter(x => faceOf(x) === '17543').length
	console.log('  17543 在场合计=' + inPlay.length + '（' + JSON.stringify(inPlay) + '），牌库中=' + deckCopies)
	ok('V1：在场（手牌+桌面）只有 1 份', inPlay.length === 1, JSON.stringify(inPlay))
}

console.log('\n=== A. 英国陆军在陆战中被移除（同盟非美国）→ 不武装、不置亮、点了不白亏 ===')
{
	const g = setup()
	const lg = landBattleRemoveUK(g)
	console.log('  battle log: ' + lg)
	ok('英国陆军确实被移除', g.location['uk_a1'] == null)
	ok('★ 雷达【没有】被武装进 status_instant', !armed(g),
		JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id))))
	const tv = radarView(g)
	console.log('  view.table_status(17543)=' + JSON.stringify(tv && { ready: tv.ready, reason: tv.ready_reason }))
	ok('★ 客户端不置亮（ready=false）', tv && tv.ready === false, JSON.stringify(tv && tv.ready))

	/* 强制提交：必须被拒且不扣牌（白亏回归） */
	const deck0 = (g.decks['美国'] || []).length
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: radarInst(g) })
	const lg2 = logSince(g, n1)
	console.log('  强制 activate_status: ' + lg2)
	ok('★ 被拒（未进入效果）', /不能发动|不满足/.test(lg2), lg2)
	ok('★ 代价没扣（牌库张数不变）', (g.decks['美国'] || []).length === deck0,
		deck0 + ' -> ' + (g.decks['美国'] || []).length)
}

console.log('\n=== B. 美国海军在海战中被移除 → 武装 + 置亮 + 发动后还原且受保护 ===')
{
	const g = setup()
	const r = seaBattleRemoveUS(g, 'n1')
	console.log('  battle log: ' + r.log + '  （海域=' + d.name_of(r.target) + '）')
	ok('美国海军被移除', g.location[r.us] == null, String(g.location[r.us]))
	ok('★ 雷达被武装进 status_instant', armed(g),
		JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id))))
	const tv = radarView(g)
	ok('★ 客户端置亮（ready=true）', tv && tv.ready === true, JSON.stringify(tv && tv))
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: radarInst(g) })
	console.log('  activate_status: ' + logSince(g, n1))
	ok('★★ 美国海军被还原到原地区', g.location[r.us] === r.target, String(g.location[r.us]))
	ok('★★ 还原后不是幽灵部队（nation/type 都在）',
		g.piece_nation[r.us] === '美国' && g.piece_type[r.us] === 'navy',
		JSON.stringify({ n: g.piece_nation[r.us], t: g.piece_type[r.us] }))
	ok('本回合受保护（protect 生效）', I.is_protected(g, r.us) === true, String(I.is_protected(g, r.us)))
	ok('once_per_turn 已记账', (g.status_used || {})[String(radarInst(g))] != null,
		JSON.stringify(g.status_used || {}))
}

console.log('\n=== C. 德国部队被移除（轴心自己）→ 完全不武装 ===')
{
	const g = setup()
	/* 英国陆军@<西欧>（已参战、位于本国补给圈内）打<德国>的德国陆军 -> 被移除方是【德国】 */
	const W = d.id_of('西欧'), DE = d.id_of('德国')
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_a2', nation: '英国', type: 'army', space: W })
	I.refresh(g)
	const deVictim = Object.keys(g.location).find(p =>
		g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === DE)
	I.grant_supply(g, 'uk_a2', g.turn)      /* 薄局面：显式补给（skill §十） */
	I.refresh(g)
	const n0 = (g.log || []).length
	const r = I.do_battle(g, '英国', DE, deVictim, 'land', { from: 'uk_a2' })
	console.log('  battle log: ' + logSince(g, n0) +
		(r && r.ok === false ? ' 【do_battle 拒绝】' + r.reason : ''))
	ok('德国陆军被移除', g.location[deVictim] == null, String(g.location[deVictim]))
	ok('★ 雷达未被武装', !armed(g), JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id))))
	ok('★ 未置亮', radarView(g) && radarView(g).ready === false)
}

console.log('\n=== D. 同回合第二次美国海军被移除 → once_per_turn 不再武装 ===')
{
	const g = setup()
	const r1 = seaBattleRemoveUS(g, 'n1')
	R.action(g, 'Allies', 'activate_status', { card: radarInst(g) })
	ok('第一次已发动', (g.status_used || {})[String(radarInst(g))] != null)
	/* 再打一场海战移除【另一支】美国海军（换一对海域，避免与第一场的格子/保护冲突） */
	const r2 = seaBattleRemoveUS(g, 'n2', [r1.target, r1.from])
	console.log('  第二场 battle log: ' + r2.log + '  （海域=' + d.name_of(r2.target) + '）')
	ok('第二支美国海军也被移除', g.location[r2.us] == null, String(g.location[r2.us]))
	ok('★ 同回合不再武装', !armed(g),
		JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id))))
}

console.log('\n=== E. 残留检查（skill §7.1 铁律 5）===')
{
	const g = setup()
	landBattleRemoveUK(g)
	ok('无 pending_armed_use', !g.pending_armed_use)
	ok('无 armed_offers 残留', !(g.armed_offers || []).length, String((g.armed_offers || []).length))
	ok('无 pending_echo', !g.pending_echo)
	ok('无 pending_battle', !g.pending_battle, JSON.stringify(g.pending_battle && g.pending_battle.stage))
}

console.log('\n=== F. 范式一致性：17808 / 17811 / 15351 的 armed.ready 契约不变 ===')
{
	const E = I.ECHO_EFFECTS || {}
	ok('17808 有 ready', typeof (E['17808'] || {}).armed?.ready === 'function')
	ok('17811 有 ready', typeof (E['17811'] || {}).armed?.ready === 'function')
	ok('15351 有 ready', typeof (E['15351'] || {}).armed?.ready === 'function')
	ok('17808 ready(非苏联陆军)=false',
		E['17808'].armed.ready({ location: {} }, { piece_nation: '英国', piece_type: 'army' }) === false)
	ok('17811 ready(非苏联空军)=false',
		E['17811'].armed.ready({ location: {} }, { piece_nation: '英国', piece_type: 'air' }) === false)
	const T = (I.STATUS_EFFECTS || {})['17543'].trigger
	ok('17543 ready 已声明', typeof T.ready === 'function')
	ok('17543 ready(美国海军)=true', T.ready({}, { piece_nation: '美国', piece_type: 'navy' }) === true)
	ok('17543 ready(英国陆军)=false', T.ready({}, { piece_nation: '英国', piece_type: 'army' }) === false)
	ok('17543 ready(美国陆军)=false', T.ready({}, { piece_nation: '美国', piece_type: 'army' }) === false)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
