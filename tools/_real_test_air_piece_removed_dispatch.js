/*
 * 空军「被移除」派发链 —— 三处修复的真实测试
 *
 *  ① 排队窗口续派（pending_air_dispatch 不再永远不消费）
 *  ② victim 的 piece_removed 不再覆盖刚开出的空军窗口（B16）
 *  ③ seize_air（夺取制空权 / 秋水 / 特种空勤团 / 中国卡）消灭敌机时也派发窗口
 *
 * A 抵消成立 → 苏联 17811 必须开窗（修复前 offers=[]）
 * B 用 17811 原地部署 → 新机在场；陆军仍被移除（不改战斗结果）
 * C 全部表态后：pending_air_dispatch 清空、pending_battle=null、active 归还
 * D seize_air(by:'card') 消灭苏联空军 → 17811 开窗（修复前完全没有）
 * E D 之后部署成功，且队列无残留
 * F 静态守卫
 *
 * 用法：node tools/_real_test_air_piece_removed_dispatch.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const faceOf = x => String(x).split('#')[0]
const EAST = () => d.id_of('东欧'), GER = () => d.id_of('德国')

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	for (const [p, sp] of [['su_m', '莫斯科'], ['su_r', '罗斯'], ['su_u', '乌克兰'], ['su_e', '东欧']])
		R.action(g, 'Allies', 'debug_place', { piece: p, nation: '苏联', type: 'army', space: d.id_of(sp) })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: EAST() })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_army', nation: '德国', type: 'army', space: GER() })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: GER() })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	return g
}
const off = (g, face) => {
	for (const w of (g.armed_offers || []))
		for (const c of (w.cards || [])) if (faceOf(c.card_id) === face) return { w, card: c.card_id }
	return null
}

console.log('=== A/B/C. 抵消成立 → 17811 开窗 → 部署 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	console.log('  抵消后 offers=' + JSON.stringify((g.armed_offers || []).map(w => (w.cards || []).map(c => faceOf(c.card_id)))))
	const o = off(g, '17811')
	/*
	 * 【2026-11-06 · 17811 特例】抵消 + 手里有 17811 → 进入 bureau_wait（陆军被挂起保护），
	 * 这里验证"17611 窗口照常开出"，并走"不发动 → 陆军按原结果移除"的收尾。
	 */
	ok('★★ 抵消后进入 17811 特例询问（bureau_wait）',
		!!(g.pending_battle && g.pending_battle.stage === 'bureau_wait'),
		JSON.stringify(g.pending_battle && g.pending_battle.stage))
	ok('★★ 17811 窗口已开出', !!o, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★★ 陆军此时【尚未】被移除', g.location['su_e'] != null, String(g.location['su_e']))
	let guard = 0
	while ((g.armed_offers || []).some(w => (w.cards || []).length) && guard++ < 4)
		R.action(g, 'Allies', 'skip_armed_offer', {})
	console.log('  skip 后 pending=' + JSON.stringify(g.pending_battle && g.pending_battle.stage) +
		' 陆军=' + String(g.location['su_e']) +
		' queue=' + JSON.stringify((g.pending_air_dispatch || []).length) +
		' active=' + g.active + ' ret=' + g.battle_return_active)
	ok('★★ 不发动 → 陆军按原结果被移除', g.location['su_e'] == null, String(g.location['su_e']))
	ok('★★ pending_air_dispatch 已清空（队列被续派消费）', !(g.pending_air_dispatch || []).length,
		JSON.stringify(g.pending_air_dispatch))
	ok('★★ 无战斗挂起残留', !g.pending_battle)
	ok('★ 操作权归还 Axis', g.active === 'Axis' && !g.battle_return_active, g.active + '/' + g.battle_return_active)
}

console.log('\n=== D/E. 夺取制空权消灭敌机 → 也应开窗（修复缺陷 3）===')
{
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	/* 苏联真实补给链（莫斯科/罗斯/乌克兰），东欧再放一支陆军+空军作为被消灭目标 */
	for (const [p, sp] of [['su_m', '莫斯科'], ['su_r', '罗斯'], ['su_u', '乌克兰']])
		R.action(g, 'Allies', 'debug_place', { piece: p, nation: '苏联', type: 'army', space: d.id_of(sp) })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_a', nation: '苏联', type: 'army', space: EAST() })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_f', nation: '苏联', type: 'air', space: EAST() })
	/* 日本发起机放在相邻的<巴尔干>，并给一支日本陆军做载体（空军需要载体+补给才能交战） */
	const BALKAN = d.id_of('巴尔干')
	R.action(g, 'Axis', 'debug_place', { piece: 'jp_a', nation: '日本', type: 'army', space: BALKAN })
	R.action(g, 'Axis', 'debug_place', { piece: 'jp_k', nation: '日本', type: 'air', space: BALKAN })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	for (const p of ['su_a', 'su_f', 'jp_a', 'jp_k']) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	const n = (g.log || []).length
	const r = I.seize_air(g, '日本', EAST(), 'jp_k', { by: 'card' })
	I.refresh(g)
	console.log('  seize=' + JSON.stringify(r && { ok: r.ok, removed: r.removed }) +
		'  log=' + (g.log || []).slice(n).join(' | ').slice(0, 160))
	ok('★ 夺取制空权成功', !!(r && r.ok), JSON.stringify(r))
	const o = off(g, '17811')
	ok('★★ 被卡牌消灭的苏联空军也开 17811 窗口', !!o, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	if (o) {
		R.action(g, 'Allies', 'use_armed_offer', { card: o.card })
		R.action(g, 'Allies', 'use_armed_offer', { card: o.card, space: EAST() })
		const airs = I.pieces_on(g, EAST()).filter(p => g.piece_nation[p] === '苏联' && g.piece_type[p] === 'air')
		console.log('  部署后东欧=' + JSON.stringify(I.pieces_on(g, EAST())))
		ok('★★ 可部署新机（旧机已被消灭）', airs.length >= 1, JSON.stringify(airs))
	}
	let guard = 0
	while ((g.armed_offers || []).some(w => (w.cards || []).length) && guard++ < 4)
		R.action(g, 'Allies', 'skip_armed_offer', {})
	ok('★ 队列无残留', !(g.pending_air_dispatch || []).length, JSON.stringify(g.pending_air_dispatch))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('包装 offer_armed_piece_removed 存在', /function offer_armed_piece_removed/.test(src))
	ok('续派 flush 存在', /function flush_piece_removed_offers/.test(src))
	ok('action 出口调用 flush', /flush_piece_removed_offers\(game\)/.test(src))
	ok('seize_air 走统一助手', /remove_air_with_piece_removed\(game, enemies\[0\], space, nation\)/.test(src))
	ok('空军的 armed 派发走包装', /offer_armed_piece_removed\(game, ctx\)/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
