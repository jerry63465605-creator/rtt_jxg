/*
 * 冒烟：「本次战斗中不会被移除」= battleOnly（2026-11-07 批 1）
 *
 * 修的是什么：
 *   17730 / 17735 / 17543 / 15410 的卡面都是「在【本次战斗】中不会被移除」，
 *   但实现只给 protect 加了 untilTurn + turnNation（= 整个国家回合），
 *   于是同一回合的**下一场战斗**仍然打不掉这支部队（17735 / 15410 已复现）。
 *
 * 修法：新增 battleOnly 修饰器 —— 只在"当前这场战斗"内有效，战斗真正结束时
 *       （无嵌套、无 pending_battle）由 do_battle 的 finally 物理清除。
 *
 * 断言结构：每张卡都跑「第 1 战被挡下 → 第 2 战能击杀」；
 *          外加对照组 17733《卡西诺山》（卡面是本回合）→ 第 2 战仍被挡（确认没有过度修正）。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const sideOf = nation => (I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis')
const place = (g, piece, nation, type, spaceName) =>
	R.action(g, sideOf(nation), 'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
const give = (g, face, nation) =>
	R.action(g, sideOf(nation), 'debug_add_card', { face, nation, dest: 'hand' })
const phase = (g, nation) => { R.action(g, sideOf(nation), 'debug_set_phase', { nation, phase: 'play' }); I.refresh(g) }

function newGame() {
	const g = R.setup(20261107)
	g.opening = null
	g.neutral['美国'] = false      /* 场景叠加：美国 / 苏联 均已参战（否则不能对轴心发起战斗） */
	g.neutral['苏联'] = false
	/* 开局美国桌面挂着《大萧条的余波》(17555)：美国打事件/状态卡前要先弃 1 张，
	 * 会打断本测试的 ACTIONS。属于另一套机制的专门测试，这里摘掉。 */
	if (g.table['美国']) g.table['美国'] = g.table['美国'].filter(x => faceOf(x) !== '17555')
	I.refresh(g)
	return g
}
const battleOnlyLeft = g => (g.modifiers || []).filter(m => m.battleOnly).length
const protectOf = g => (g.modifiers || []).filter(m => m.key === 'protect')

/* ============ 1. 17735 山地特种兵（意大利 RESPONSE）============ */
console.log('=== 1. 17735《山地特种兵》[RESPONSE] 本次战斗 ===')
{
	const g = newGame()
	/* 意大利陆军守<意大利>；英国陆军驻<西欧>（邻<意大利>） */
	place(g, 'it_it', '意大利', 'army', '意大利')
	place(g, 'uk_weu', '英国', 'army', '西欧')
	I.refresh(g)
	I.grant_supply(g, 'uk_weu', g.turn)
	/* 意大利暗置 17735 */
	phase(g, '意大利')
	give(g, '17735', '意大利')
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['意大利'] || []).find(x => faceOf(x) === '17735') })
	I.refresh(g)
	ok('① 17735 已暗置到桌面', (g.table_responses || []).some(x => faceOf(x.card_id) === '17735'),
		JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	/* 意大利自己留在<意大利>的陆军要清掉，避免与被攻击目标混淆 */
	const itAtHome = Object.keys(g.location).filter(p => g.location[p] === d.id_of('意大利') && g.piece_nation[p] === '意大利')
	console.log('   <意大利> 上的意大利陆军 = ' + JSON.stringify(itAtHome))

	/* 第 1 战 */
	phase(g, '英国')
	give(g, '15301', '英国')
	give(g, '15301', '英国')
	I.refresh(g)
	I.grant_supply(g, 'uk_weu', g.turn)
	let n = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['英国'] || []).find(x => faceOf(x) === '15301'), space: d.id_of('意大利'), piece: 'it_it' })
	I.refresh(g)
	const cand = (((R.view(g, 'Axis').pending_trigger || {}).candidates) || [])[0]
	if (cand) {
		R.action(g, 'Axis', 'trigger_response', { card: cand.card_id })
		I.refresh(g)
	}
	console.log('   第 1 战 log = ' + logSince(g, n).slice(0, 220))
	ok('② 第 1 战被挡下（部队还在）', g.location['it_it'] != null, logSince(g, n).slice(0, 160))
	ok('③ 保护标记为 battleOnly', protectOf(g).some(m => m.battleOnly === true),
		JSON.stringify(protectOf(g)))

	/* 第 2 战（同回合）*/
	phase(g, '英国')
	I.grant_supply(g, 'uk_weu', g.turn)
	I.refresh(g)
	n = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['英国'] || []).find(x => faceOf(x) === '15301'), space: d.id_of('意大利'), piece: 'it_it' })
	I.refresh(g)
	console.log('   第 2 战 log = ' + logSince(g, n).slice(0, 220))
	ok('★★ ④ 第 2 战能击杀（本次战斗已过）', g.location['it_it'] == null, logSince(g, n).slice(0, 160))
	ok('⑤ 战斗结束后无 battleOnly 残留', battleOnlyLeft(g) === 0, JSON.stringify(protectOf(g)))
}

/* ============ 2. 17730 贝尔萨列里神射手团（<巴尔干>）============ */
console.log('\n=== 2. 17730《贝尔萨列里神射手团》[RESPONSE] 本次战斗 ===')
{
	const g = newGame()
	place(g, 'it_ba', '意大利', 'army', '巴尔干')
	/* <巴尔干> 相邻陆地：东欧(5) / 意大利(13) / 黑海(14) / 德国(44) / 乌克兰(45) / 地中海(46)
	 * -> 用【苏联】陆军驻<乌克兰>发起（英国/西欧 与巴尔干不相邻，别踩这个）。 */
	place(g, 'su_ua', '苏联', 'army', '乌克兰')
	I.refresh(g)
	I.grant_supply(g, 'su_ua', g.turn)
	phase(g, '意大利')
	give(g, '17730', '意大利')
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['意大利'] || []).find(x => faceOf(x) === '17730') })
	I.refresh(g)

	phase(g, '苏联')
	give(g, '17801', '苏联')
	give(g, '17801', '苏联')
	I.refresh(g)
	I.grant_supply(g, 'su_ua', g.turn)
	let n = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['苏联'] || []).find(x => faceOf(x) === '17801'), space: d.id_of('巴尔干'), piece: 'it_ba' })
	I.refresh(g)
	const cand = (((R.view(g, 'Axis').pending_trigger || {}).candidates) || [])[0]
	ok('① 第 1 战真的打起来了（17730 弹窗）', !!cand, logSince(g, n).slice(0, 160))
	if (cand) {
		R.action(g, 'Axis', 'trigger_response', { card: cand.card_id })
		I.refresh(g)
	}
	ok('② 第 1 战被挡下', g.location['it_ba'] != null, logSince(g, n).slice(0, 160))

	phase(g, '苏联')
	I.grant_supply(g, 'su_ua', g.turn)
	I.refresh(g)
	n = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['苏联'] || []).find(x => faceOf(x) === '17801'), space: d.id_of('巴尔干'), piece: 'it_ba' })
	I.refresh(g)
	console.log('   第 2 战 log = ' + logSince(g, n).slice(0, 220))
	ok('★★ ③ 第 2 战能击杀', g.location['it_ba'] == null, logSince(g, n).slice(0, 160))
	ok('④ 无 battleOnly 残留', battleOnlyLeft(g) === 0, JSON.stringify(protectOf(g)))
}

/* ============ 3. 15410 武士道（日本 EFFECT，挂起 guard 通道）============ */
console.log('\n=== 3. 15410《武士道》[EFFECT] 本次战斗 ===')
{
	const g = newGame()
	place(g, 'us_dh', '美国', 'navy', '东海')
	I.refresh(g)
	I.grant_supply(g, 'us_dh', g.turn)
	phase(g, '日本')
	give(g, '15410', '日本')
	give(g, '15419', '日本')      /* 武士道的代价：1 张响应牌 */
	I.refresh(g)
	const jpArmy = Object.keys(g.location).find(p => g.location[p] === d.id_of('日本') && g.piece_nation[p] === '日本')

	phase(g, '美国')
	give(g, '17501', '美国')
	give(g, '17501', '美国')
	I.refresh(g)
	I.grant_supply(g, 'us_dh', g.turn)
	let n = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['美国'] || []).find(x => faceOf(x) === '17501'), space: d.id_of('日本'), piece: jpArmy })
	I.refresh(g)
	const pb = g.pending_battle
	const gcard = pb && (pb.guard_cards || []).find(x => faceOf(x.card_id) === '15410')
	if (gcard) {
		const drop = (g.hands['日本'] || []).find(x => faceOf(x) === '15419')
		R.action(g, 'Axis', 'resolve_battle', { guard: gcard.card_id, drop: [drop] })
		I.refresh(g)
	}
	console.log('   第 1 战 log = ' + logSince(g, n).slice(0, 260))
	ok('① 第 1 战被挡下', g.location[jpArmy] != null, logSince(g, n).slice(0, 160))
	ok('② 日志/描述已改为「本次战斗」', /本次战斗/.test(logSince(g, n)), logSince(g, n).slice(0, 160))

	phase(g, '美国')
	I.grant_supply(g, 'us_dh', g.turn)
	I.refresh(g)
	n = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['美国'] || []).find(x => faceOf(x) === '17501'), space: d.id_of('日本'), piece: jpArmy })
	I.refresh(g)
	console.log('   第 2 战 log = ' + logSince(g, n).slice(0, 240))
	ok('★★ ③ 第 2 战能击杀', g.location[jpArmy] == null, logSince(g, n).slice(0, 160))
	ok('④ 无 battleOnly 残留', battleOnlyLeft(g) === 0, JSON.stringify(protectOf(g)))
}

/* ============ 4. 对照组 17733 卡西诺山（卡面=本回合）============ */
console.log('\n=== 4. 对照：17733《卡西诺山》[RESPONSE] 本回合（应当仍然整回合有效）===')
{
	const g = newGame()
	place(g, 'it_it2', '意大利', 'army', '意大利')
	place(g, 'uk_weu3', '英国', 'army', '西欧')
	I.refresh(g)
	I.grant_supply(g, 'uk_weu3', g.turn)
	phase(g, '意大利')
	give(g, '17733', '意大利')
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['意大利'] || []).find(x => faceOf(x) === '17733') })
	I.refresh(g)

	phase(g, '英国')
	give(g, '15301', '英国')
	give(g, '15301', '英国')
	I.refresh(g)
	I.grant_supply(g, 'uk_weu3', g.turn)
	let n = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['英国'] || []).find(x => faceOf(x) === '15301'), space: d.id_of('意大利'), piece: 'it_it2' })
	I.refresh(g)
	const cand = (((R.view(g, 'Axis').pending_trigger || {}).candidates) || [])[0]
	if (cand) {
		R.action(g, 'Axis', 'trigger_response', { card: cand.card_id })
		I.refresh(g)
	}
	ok('① 第 1 战被挡下', g.location['it_it2'] != null, logSince(g, n).slice(0, 160))
	ok('② 本回合保护【没有】battleOnly 标记（未被误改）',
		protectOf(g).some(m => m.battleOnly !== true), JSON.stringify(protectOf(g)))

	phase(g, '英国')
	I.grant_supply(g, 'uk_weu3', g.turn)
	I.refresh(g)
	n = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['英国'] || []).find(x => faceOf(x) === '15301'), space: d.id_of('意大利'), piece: 'it_it2' })
	I.refresh(g)
	console.log('   第 2 战 log = ' + logSince(g, n).slice(0, 200))
	ok('★★ ③ 第 2 战【仍】被挡（本回合语义保持，未过度修正）',
		g.location['it_it2'] != null, logSince(g, n).slice(0, 160))
}

/* ============ 5. 17543 雷达（美国 STATUS，piece_removed 窗口）============ */
console.log('\n=== 5. 17543《雷达》[STATUS] 本次战斗 ===')
{
	const g = newGame()
	/* 美国海军守<东海>；日本海军驻<中太平洋>（邻<东海>） */
	place(g, 'us_dh2', '美国', 'navy', '东海')
	place(g, 'jp_mp', '日本', 'navy', '中太平洋')
	I.refresh(g)
	I.grant_supply(g, 'us_dh2', g.turn)
	I.grant_supply(g, 'jp_mp', g.turn)
	/* 美国把 17543 打到桌面（STATUS） */
	phase(g, '美国')
	give(g, '17543', '美国')
	I.refresh(g)
	let _n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['美国'] || []).find(x => faceOf(x) === '17543') })
	I.refresh(g)
	console.log('   打出 17543 log = ' + logSince(g, _n0).slice(0, 240))
	ok('① 17543 在桌面', (g.table['美国'] || []).some(x => faceOf(x) === '17543'),
		JSON.stringify((g.table['美国'] || []).map(faceOf)))

	/* 日本第 1 次海战 */
	phase(g, '日本')
	give(g, '15403', '日本')
	give(g, '15403', '日本')
	I.refresh(g)
	I.grant_supply(g, 'jp_mp', g.turn)
	let n = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: (g.hands['日本'] || []).find(x => faceOf(x) === '15403'), space: d.id_of('东海'), piece: 'us_dh2' })
	I.refresh(g)
	console.log('   第 1 战 log = ' + logSince(g, n).slice(0, 220))
	console.log('   status_instant = ' + JSON.stringify((g.status_instant || []).map(x => faceOf(x.card_id))))
	ok('② 美国海军被移除后 17543 被武装', (g.status_instant || []).some(x => faceOf(x.card_id) === '17543'),
		JSON.stringify((g.status_instant || []).map(x => faceOf(x.card_id))))

	const usDeck0 = (g.decks['美国'] || []).length
	const inst17543 = (g.table['美国'] || []).find(x => faceOf(x) === '17543')
	n = (g.log || []).length
	/* 注意：activate_status 要的是【桌面实例 id】（17543#77），不是卡面 id */
	R.action(g, 'Allies', 'activate_status', { card: inst17543 })
	I.refresh(g)
	console.log('   雷达结算 log = ' + logSince(g, n).slice(0, 240))
	console.log('   美国牌库 ' + usDeck0 + '→' + (g.decks['美国'] || []).length +
		'  modifiers = ' + JSON.stringify(protectOf(g)))
	ok('★★ ③ 损耗 2 张并还原海军', g.location['us_dh2'] != null &&
		(g.decks['美国'] || []).length === usDeck0 - 2, logSince(g, n).slice(0, 160))
	ok('④ 保护标记为 battleOnly', protectOf(g).some(m => m.battleOnly === true), JSON.stringify(protectOf(g)))

	/* 日本第 2 次海战（同回合）*/
	phase(g, '日本')
	I.grant_supply(g, 'jp_mp', g.turn)
	I.refresh(g)
	n = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: (g.hands['日本'] || []).find(x => faceOf(x) === '15403'), space: d.id_of('东海'), piece: 'us_dh2' })
	I.refresh(g)
	console.log('   第 2 战 log = ' + logSince(g, n).slice(0, 240))
	ok('★★ ⑤ 第 2 战能击杀（本次战斗已过）', g.location['us_dh2'] == null, logSince(g, n).slice(0, 160))
	ok('⑥ 无 battleOnly 残留', battleOnlyLeft(g) === 0, JSON.stringify(protectOf(g)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
