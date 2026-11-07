/*
 * 美国「王牌/名将」系列 × 15209《伞兵》同款问题（空框 / 左上角多余 UI）排查
 *
 * 对象：17509 王牌飞行员帕皮·博因顿（EFFECT，计分阶段）
 *       16800 艾森豪威尔 / 16801 哈尔西 / 16802 麦克阿瑟 / 16803 尼米兹（EFFECT，armed 再建/再战）
 *
 * 判据（15209 事故的三条防线）：
 *   ① 触发后若产生 pending_echo，其 options/cands **不得为空**（否则客户端渲染空框）
 *   ② view.pending_echo 不得是空框
 *   ③ 不得因"等挂起"而冻结推进（next_phase 仍可用）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function base(phase = 'play', nation = '美国') {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null; g.pending_echo = null; g.pending_scoring = null
	g.pending_script = null; g.pending_event_step = null; g.pending_event_targets = null
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
		'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}
const give = (g, face, nation = '美国') =>
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
		'debug_add_card', { face, nation, dest: 'hand' })
const place = (g, piece, nation, type, spaceName) =>
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
		'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
const cnt = (g, nation, spaceName, type) =>
	I.pieces_on(g, d.id_of(spaceName)).filter(p => g.piece_nation[p] === nation && g.piece_type[p] === type).length

/* 空框三判据 */
function frameState(g) {
	const pe = g.pending_echo || null
	const isEmpty = !!(pe && pe.kind === 'echo_need' &&
		!(pe.options && pe.options.length) && !(pe.cands && pe.cands.length))
	const v = R.view(g, 'Allies')
	const vpe = v.pending_echo || null
	const vEmpty = !!(vpe && vpe.kind === 'echo_need' &&
		!(vpe.options && vpe.options.length) && !(vpe.cands && vpe.cands.length))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'next_phase', {})
	I.refresh(g)
	const frozen = /请先处理|等待|不能推进/.test(logSince(g, n0))
	return { raw: pe && { kind: pe.kind, step: pe.step, opts: (pe.options || []).length, cands: (pe.cands || []).length },
		isEmpty, vEmpty, vHas: !!vpe, frozen, peek: !!g.peek }
}

console.log('=== ① 17509 王牌飞行员帕皮·博因顿（计分阶段）===')
{
	const g = base('scoring')
	give(g, '17509')
	I.refresh(g)
	const card = (g.hands['美国'] || []).find(x => faceOf(x) === '17509')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 200))
	const f = frameState(g)
	console.log('  pending_echo = ' + JSON.stringify(f.raw) + '  view 有挂起=' + f.vHas + ' 冻结=' + f.frozen)
	ok('★★ 不产生空框（服务端）', !f.isEmpty, JSON.stringify(f.raw))
	ok('★★ 不产生空框（view）', !f.vEmpty)
	ok('★ 不冻结推进', !f.frozen)
}

console.log('\n=== ② 16800 艾森豪威尔（建设陆军后）===')
{
	const g = base('play')
	give(g, '16800'); give(g, '17500')
	I.refresh(g)
	/* 先打《建设陆军》触发 after_build_army */
	const build = (g.hands['美国'] || []).find(x => faceOf(x) === '17500')
	const target = (d.spaces[d.id_of('美国')].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
	R.action(g, 'Allies', 'play_card', { card: build, space: target })
	I.refresh(g)
	const w = (g.armed_offers || []).find(x => x.when === 'after_build_army' && (x.cards || []).some(c => faceOf(c.card_id) === '16800'))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(x => ({ when: x.when, faces: (x.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★ 建设陆军后开出 16800 窗口', !!w)
	if (w) {
		const c = (w.cards || []).find(x => faceOf(x.card_id) === '16800')
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: c.card_id })
		I.refresh(g)
		console.log('  使用后 log = ' + logSince(g, n0).slice(0, 200))
		const cands = ((g.pending_echo || {}).cands || (g.pending_echo || {}).options || [])
		console.log('  pending_echo = ' + JSON.stringify({ kind: (g.pending_echo || {}).kind, step: (g.pending_echo || {}).step, n: cands.length }))
		const f = frameState(g)
		ok('★★ 需要选地区时不要空框（有候选或已自动完成）', !f.isEmpty, JSON.stringify(f.raw))
		ok('★★ view 不出现空框', !f.vEmpty)
		ok('★ 不冻结推进', !f.frozen)
	}
}

console.log('\n=== ③ 16803 尼米兹（建设海军后）===')
{
	const g = base('play')
	give(g, '16803'); give(g, '17502')
	I.refresh(g)
	const sea = d.spaces.findIndex(sp => sp && sp.terrain === 'sea')
	const build = (g.hands['美国'] || []).find(x => faceOf(x) === '17502')
	/* 找美国相邻海域 */
	const US = d.id_of('美国')
	const seaAdj = (d.spaces[US].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'sea')
	R.action(g, 'Allies', 'play_card', { card: build, space: seaAdj })
	I.refresh(g)
	const w = (g.armed_offers || []).find(x => x.when === 'after_build_navy' && (x.cards || []).some(c => faceOf(c.card_id) === '16803'))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(x => ({ when: x.when, faces: (x.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★ 建设海军后开出 16803 窗口', !!w)
	if (w) {
		const c = (w.cards || []).find(x => faceOf(x.card_id) === '16803')
		R.action(g, 'Allies', 'use_armed_offer', { card: c.card_id })
		I.refresh(g)
		const f = frameState(g)
		console.log('  pending_echo = ' + JSON.stringify(f.raw) + '  冻结=' + f.frozen)
		ok('★★ 16803 不产生空框（服务端/view）', !f.isEmpty && !f.vEmpty, JSON.stringify(f.raw))
		ok('★ 不冻结推进', !f.frozen)
	}
}

console.log('\n=== ④ 全局守卫：三处空框防线是否都在 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('is_empty_echo_frame 定义存在', /function is_empty_echo_frame/.test(src))
	ok('view.pending_echo 走该判据', /is_empty_echo_frame\(game\.pending_echo\)/.test(src))
	ok('exports.action finally 清脏字段', /finally[\s\S]{0,200}is_empty_echo_frame/.test(src))
	ok('build_actions 排他分支用它', (src.match(/is_empty_echo_frame/g) || []).length >= 3)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
