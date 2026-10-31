/*
 * 真实测试（rtt-realboard-test §7 范式 B）：云雾 × 复原卡的交互
 *
 * 玩家口径（2026-10-31 最终裁定）：**空军应该可以复原** ——
 * 云雾只限制"不能代受、不能撤离、只能原地移除"，并不禁止复原类卡把它救回来。
 * 15330《防御姿态》/ 15311《马奇诺防线》等救陆军时，同场空军一并归位（与无云雾时一致）。
 *
 * 断言：
 *   A. 云雾 + 15330：陆军复原、**空军也复原到<西欧>**
 *   B. 云雾 + 15311 马奇诺（法国陆军@西欧）：法国陆军复原、**法国空军也复原**
 *   C. 对照（无云雾）+ 15330：陆军复原、空军先撤<北海>再归位<西欧>
 *   D. 静态守卫：三处 retreated_airs 派发【不】受 air_no_defend 约束（口径一致）
 *   E. 纪律：不重复发同一张非 BASIC 卡（15311 用开局手牌）
 *
 * 用法：node tools/_real_test_15213_restore.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

const W = d.id_of('西欧')
const DE_HOME = d.id_of('德国')

function attack(g, space, victim) {
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15201')
	const atk = Object.keys(g.location).find(p =>
		g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === DE_HOME)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card, space, piece: victim, from: atk })
	return logSince(g, n0)
}

console.log('\n=== A. 云雾 + 15330《防御姿态》：陆军与空军都复原 ===')
{
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15330', nation: '英国', dest: 'hand' })
	I.refresh(g)
	{
		const c = (g.hands['英国'] || []).find(x => faceOf(x) === '15330')
		R.action(g, 'Allies', 'play_card', { card: c })
	}
	ok('15330 已暗置到桌面', (g.table_responses || []).some(x => faceOf(x.card_id) === '15330'))

	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_def', nation: '英国', type: 'army', space: W })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_air', nation: '英国', type: 'air', space: W })
	R.action(g, 'Axis', 'debug_add_card', { face: '15213', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	{
		const cl = (g.hands['德国'] || []).find(x => faceOf(x) === '15213')
		R.action(g, 'Axis', 'play_card', { card: cl })
	}
	ok('云雾已生效', (g.modifiers || []).some(m => m.key === 'air_no_defend'),
		JSON.stringify((g.modifiers || []).map(m => m.key)))

	console.log('  ' + attack(g, W, 'uk_def'))
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	ok('★ 战斗后陆军与空军都被移除（云雾：空军原地移除）',
		g.location['uk_def'] == null && g.location['uk_air'] == null,
		JSON.stringify({ a: g.location['uk_def'], b: g.location['uk_air'] }))

	const v = R.view(g, 'Allies')
	ok('弹出 15330 的 piece_removed 响应窗',
		!!(v.pending_trigger && v.pending_trigger.on === 'piece_removed'),
		JSON.stringify(v.pending_trigger && v.pending_trigger.on))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'trigger_response', {})
	console.log('  trigger: ' + logSince(g, n0))
	ok('★ 陆军被救回（西欧）', g.location['uk_def'] === W, String(g.location['uk_def']))
	ok('★★ 空军【也】复原（玩家 2026-10-31 口径）', g.location['uk_air'] === W,
		'air loc=' + String(g.location['uk_air']))
}

console.log('\n=== B. 云雾 + 15311《马奇诺防线》（法国陆军@西欧）===')
{
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	const sasInHand = (g.hands['英国'] || []).filter(x => faceOf(x) === '15311')
	ok('15311 在开局英国手牌里（V1：不能 debug_add 第二份）', sasInHand.length === 1,
		JSON.stringify(sasInHand))

	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	R.action(g, 'Allies', 'debug_place', { piece: 'fr_def', nation: '法国', type: 'army', space: W })
	R.action(g, 'Allies', 'debug_place', { piece: 'fr_air', nation: '法国', type: 'air', space: W })
	R.action(g, 'Axis', 'debug_add_card', { face: '15213', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
	for (const f of ['15300', '15301', '15302', '15303'])
		R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	{
		const cl = (g.hands['德国'] || []).find(x => faceOf(x) === '15213')
		R.action(g, 'Axis', 'play_card', { card: cl })
	}
	console.log('  ' + attack(g, W, 'fr_def'))
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	ok('★ 法国陆军与法国空军都被移除',
		g.location['fr_def'] == null && g.location['fr_air'] == null,
		JSON.stringify({ a: g.location['fr_def'], b: g.location['fr_air'] }))

	const v = R.view(g, 'Allies')
	const ao = v.armed_offer
	ok('弹出 15311 的 armed 窗口（piece_removed）',
		!!(ao && ao.when === 'piece_removed' && (ao.cards || []).some(c => faceOf(c.card) === '15311')),
		JSON.stringify(ao && { when: ao.when, cards: (ao.cards || []).map(c => faceOf(c.card)) }))
	{
		const cd = (ao.cards || []).find(c => faceOf(c.card) === '15311')
		const pay = (g.hands['英国'] || []).filter(x =>
			['15300', '15301', '15302', '15303'].indexOf(faceOf(x)) >= 0).slice(0, 4)
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cd.card, drop: pay })
		console.log('  15311: ' + logSince(g, n0))
	}
	ok('★ 法国陆军被救回（西欧）', g.location['fr_def'] === W, String(g.location['fr_def']))
	ok('★★ 法国空军【也】复原（与 15330 同口径）', g.location['fr_air'] === W,
		'air loc=' + String(g.location['fr_air']))
}

console.log('\n=== C. 对照（无云雾）+ 15330：空军先撤离再归位 ===')
{
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15330', nation: '英国', dest: 'hand' })
	I.refresh(g)
	{
		const c = (g.hands['英国'] || []).find(x => faceOf(x) === '15330')
		R.action(g, 'Allies', 'play_card', { card: c })
	}
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_def', nation: '英国', type: 'army', space: W })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_air', nation: '英国', type: 'air', space: W })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_navy', nation: '英国', type: 'navy', space: d.id_of('北海') })
	R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	console.log('  ' + attack(g, W, 'uk_def'))
	const pb = g.pending_battle || {}
	ok('无云雾：可代受、可撤退（对照前提成立）',
		(pb.airs || []).length > 0 && (pb.retreats || []).length > 0,
		JSON.stringify({ airs: pb.airs, retreats: (pb.retreats || []).map(r => r && r.name) }))
	R.action(g, 'Allies', 'resolve_battle', { declined: true })
	ok('无云雾：空军撤离到<北海>', g.location['uk_air'] === d.id_of('北海'), String(g.location['uk_air']))
	R.action(g, 'Allies', 'trigger_response', {})
	ok('★ 陆军被救回（西欧）', g.location['uk_def'] === W, String(g.location['uk_def']))
	ok('★ 空军归位（西欧）', g.location['uk_air'] === W, String(g.location['uk_air']))
}

console.log('\n=== D. 静态守卫：三处派发不受云雾约束（口径一致）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const plain = (src.match(/retreated_airs: victimProtected \? \[\] : guardAirs\.slice\(\)\.sort\(\),/g) || []).length
	ok('★ do_battle 的 3 处派发均为原样（不按 air_no_defend 置空）', plain === 3, String(plain))
	ok('★ 不存在 retreatAirsRestorable 这类"云雾禁复原"分支',
		src.indexOf('retreatAirsRestorable') < 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
