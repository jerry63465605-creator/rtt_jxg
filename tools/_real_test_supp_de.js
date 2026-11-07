/*
 * SUPP 逐国真实盘面测试 · 德国（6 张）
 *   6600 伊朗加入轴心国 / 6601 大德意志帝国 / 14500 黄色方案
 *   14501 攻陷阿斯特拉罕 / 14502 但泽或战争 / 14503 提尔比茨号
 *
 * 路线 B（调试布阵 + 真实 action + 三层断言），并遵守：
 *   · 事件卡多步：play_card 需带 spaces 预选 → 可能停 pending_event_step → event_step_next
 *   · 计分：phase_scoring 只暂存 pending_scoring，真正落账在 scoring→discard 边界（next_phase）
 *   · armed 窗口：必须由真实阶段入口（phase_play）武装，不能手工 offer
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

function base(nation = '德国', phase = 'play') {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null; g.pending_echo = null; g.pending_scoring = null
	g.pending_script = null; g.pending_event_step = null; g.pending_event_targets = null
	R.action(g, 'Axis', 'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}
const place = (g, piece, nation, type, spaceName) =>
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
		'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
const give = (g, face, nation) =>
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
		'debug_add_card', { face, nation, dest: 'hand' })
const cnt = (g, nation, spaceName, type) =>
	I.pieces_on(g, d.id_of(spaceName)).filter(p => g.piece_nation[p] === nation && g.piece_type[p] === type).length
const scoreAxis = g => Number(((g.score || {}).axis) || 0)
const markerSum = (g, spaceName) => {
	const arr = (g.markers || {})[d.id_of(spaceName)] || []
	return arr.reduce((a, x) => a + Number(x.value || 1), 0)
}
/* 走到下一阶段（真实推进），用于把 pending_scoring 落账 */
const advance = g => { R.action(g, 'Axis', 'next_phase', {}); I.refresh(g) }
/* 有挂起时先清掉（真实动作），避免卡住后续 */
function drain(g, role = 'Axis') {
	let guard = 0
	while (((g.armed_offers || []).some(w => (w.cards || []).length) || g.pending_script ||
		g.pending_event_step || g.pending_echo) && guard++ < 6) {
		if ((g.armed_offers || []).some(w => (w.cards || []).length)) R.action(g, role, 'skip_armed_offer', {})
		else if (g.pending_event_step) R.action(g, role, 'event_step_next', {})
		else break
		I.refresh(g)
	}
}

/* ============ 1. 6600 伊朗加入轴心国 ============ */
console.log('=== 1. 6600《伊朗加入轴心国》[EVENT] ===')
{
	const g = base()
	place(g, 'de_mid', '德国', 'army', '中东')
	place(g, 'su_uk', '苏联', 'army', '乌克兰')
	place(g, 'su_ca', '苏联', 'army', '中亚')
	give(g, '6600', '德国')
	I.refresh(g)
	I.grant_supply(g, 'de_mid', g.turn); I.refresh(g)
	const mk0 = markerSum(g, '中东')
	const suBefore = Object.keys(g.location).filter(p => g.piece_nation[p] === '苏联').length
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '6600')
	const n0 = (g.log || []).length
	/* 事件卡多步：先在 play_card 里预选"消灭地区"= 乌克兰 */
	R.action(g, 'Axis', 'play_card', { card, spaces: [null, d.id_of('乌克兰')] })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 260))
	console.log('  pending_event_step = ' + JSON.stringify(g.pending_event_step && g.pending_event_step.op))
	/* 若还停着，点"下一步" */
	let guard = 0
	while (g.pending_event_step && guard++ < 3) {
		const n1 = (g.log || []).length
		R.action(g, 'Axis', 'event_step_next', {})
		I.refresh(g)
		console.log('  下一步 → ' + logSince(g, n1).slice(0, 160))
	}
	const suAfter = Object.keys(g.location).filter(p => g.piece_nation[p] === '苏联').length
	const lg = logSince(g, n0)
	console.log('  苏联陆军 ' + suBefore + '→' + suAfter + '  中东标记 ' + mk0 + '→' + markerSum(g, '中东'))
	ok('★ ① 打出《伊朗加入轴心国》且日志命中', /伊朗加入轴心国/.test(lg), lg.slice(0, 120))
	ok('★★ ② 消灭 1 支苏联陆军', suAfter === suBefore - 1, suBefore + '→' + suAfter)
	ok('★★ ③ <中东>计分标记 +1', markerSum(g, '中东') === mk0 + 1, mk0 + '→' + markerSum(g, '中东'))
	ok('★ ④ 无残留', !g.pending_event_step && !g.pending_event_targets, JSON.stringify({ s: !!g.pending_event_step }))
}

/* ============ 2. 6601 大德意志帝国 ============ */
console.log('\n=== 2. 6601《大德意志帝国》[STATUS] ===')
{
	const g = base()
	/* 西欧开局通常有同盟部队 → 先按真实动作移除，才能让"被友方控制"成立 */
	for (const p of I.pieces_on(g, d.id_of('西欧'))) R.action(g, 'Axis', 'debug_remove', { piece: p })
	I.refresh(g)
	for (const [p, sp] of [['de_w', '西欧'], ['de_h', '德国'], ['de_e', '东欧']])
		place(g, p, '德国', 'army', sp)
	give(g, '6601', '德国')
	I.refresh(g)
	for (const p of ['de_w', 'de_h', 'de_e']) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	console.log('  控制判定 = ' + JSON.stringify(['西欧', '德国', '东欧'].map(n =>
		[ n, !!I.space_controlled_by?.(g, d.id_of(n), 'axis') ])))
	const mk0 = markerSum(g, '德国')
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '6601')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  打出 log = ' + lg.slice(0, 200) + '  标记 ' + mk0 + '→' + markerSum(g, '德国'))
	ok('★ ① 打出状态卡', /大德意志帝国/.test(lg), lg.slice(0, 120))
	ok('★★ ② <德国>计分标记 +1', markerSum(g, '德国') === mk0 + 1, mk0 + '→' + markerSum(g, '德国'))

	/* 计分 +1：phase_scoring 暂存 → next_phase 落账 */
	const sc0 = scoreAxis(g)
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'scoring' })
	I.refresh(g)
	console.log('  计分 log = ' + logSince(g, n1).slice(0, 200))
	console.log('  pending_scoring = ' + JSON.stringify(g.pending_scoring))
	advance(g)
	const lg2 = logSince(g, n1)
	console.log('  推进后 axis ' + sc0 + '→' + scoreAxis(g) + '  log=' + lg2.slice(-180))
	/* 计分基线对照：同样的盘面【不放 6601】，差值应正好 +1（盘面本身还有其它标记分） */
	const g2 = base()
	for (const p of I.pieces_on(g2, d.id_of('西欧'))) R.action(g2, 'Axis', 'debug_remove', { piece: p })
	I.refresh(g2)
	for (const [p, sp] of [['c_w', '西欧'], ['c_h', '德国'], ['c_e', '东欧']])
		place(g2, p, '德国', 'army', sp)
	I.refresh(g2)
	for (const p of ['c_w', 'c_h', 'c_e']) I.grant_supply(g2, p, g2.turn)
	I.refresh(g2)
	R.action(g2, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'scoring' })
	I.refresh(g2)
	advance(g2)
	const delta = scoreAxis(g) - scoreAxis(g2)
	console.log('  对照：有 6601=' + scoreAxis(g) + ' 无 6601=' + scoreAxis(g2) + ' 差=' + delta)
	ok('★★ ③ 计分比无卡基线多 2 分（标记 1 分 + 自动 1 分）', delta === 2, 'delta=' + delta)
}

/* ============ 3. 14500 黄色方案 ============ */
console.log('\n=== 3. 14500《黄色方案》[EFFECT，出牌阶段开始] ===')
{
	const g = base()
	place(g, 'de_h', '德国', 'army', '德国')
	place(g, 'uk_w', '英国', 'army', '西欧')
	give(g, '14500', '德国')
	I.refresh(g)
	I.grant_supply(g, 'de_h', g.turn); I.refresh(g)
	const deck0 = (g.decks['德国'] || []).length
	/* 14500 没有 armed 配置（不是机会卡）→ 应在出牌阶段直接 play_card 打出 */
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '14500')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  打出 log = ' + lg.slice(0, 280))
	console.log('  牌库 ' + deck0 + '→' + (g.decks['德国'] || []).length +
		'  pending_battle=' + JSON.stringify(g.pending_battle && g.pending_battle.stage) +
		'  step=' + JSON.stringify(g.pending_event_step && g.pending_event_step.op))
	ok('★ ① 出牌阶段可直接打出（日志命中卡名）', /黄色方案/.test(lg), lg.slice(0, 140))
	ok('★★ ② 损耗 2 张牌', (g.decks['德国'] || []).length === deck0 - 2, deck0 + '→' + (g.decks['德国'] || []).length)
	/* 14500 走「战斗预算」：打出后要先 event_battle 指定目标，才建立 pending_battle */
	console.log('  event_budget = ' + JSON.stringify(g.event_budget && { nation: g.event_budget.nation, remaining: g.event_budget.remaining }))
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'event_battle', { target: d.id_of('西欧') })
	I.refresh(g)
	console.log('  event_battle log = ' + logSince(g, n1).slice(0, 200) +
		'  pending_battle=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
	/* 防守方没有空军时不会停在 defend，而是当场结算（本次 西欧 是法国陆军 → 立即移除） */
	const battleStarted = !!(g.pending_battle && g.pending_battle.stage === 'defend' && g.pending_battle.space === d.id_of('西欧')) ||
		/在 西欧 进行陆战|从 西欧 移除/.test(logSince(g, n1))
	ok('★★ ③ 对<西欧>发起陆战（有空军则 defend，无空军当场结算）', battleStarted,
		JSON.stringify(g.pending_battle && { st: g.pending_battle.stage, sp: g.pending_battle.space }))
}

/* ============ 4. 14501 攻陷阿斯特拉罕 ============ */
console.log('\n=== 4. 14501《攻陷阿斯特拉罕》[ECON] ===')
{
	const g = base()
	place(g, 'de_uk', '德国', 'army', '乌克兰')
	place(g, 'de_ca', '德国', 'army', '中亚')
	give(g, '14501', '德国')
	I.refresh(g)
	const su0 = (g.decks['苏联'] || []).length
	const sc0 = scoreAxis(g)
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '14501')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card, target: '苏联' })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 220))
	ok('★★ ① 苏联损耗 4 张', (g.decks['苏联'] || []).length === su0 - 4, su0 + '→' + (g.decks['苏联'] || []).length)
	ok('★★ ② 德国 +2 分', scoreAxis(g) === sc0 + 2, sc0 + '→' + scoreAxis(g))
}

/* ============ 5. 14502 但泽或战争 ============ */
console.log('\n=== 5. 14502《但泽或战争》[EVENT，两步] ===')
{
	const g = base()
	give(g, '14502', '德国')
	I.refresh(g)
	const a0 = cnt(g, '德国', '东欧', 'army')
	const nv0 = cnt(g, '德国', '波罗的海', 'navy')
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '14502')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	console.log('  第 1 步 log = ' + logSince(g, n0).slice(0, 260))
	console.log('  pending_event_step = ' + JSON.stringify(g.pending_event_step && g.pending_event_step.op))
	let guard = 0
	while (g.pending_event_step && guard++ < 3) {
		const n1 = (g.log || []).length
		R.action(g, 'Axis', 'event_step_next', {})
		I.refresh(g)
		console.log('  下一步 → ' + logSince(g, n1).slice(0, 200))
	}
	console.log('  东欧陆军 ' + a0 + '→' + cnt(g, '德国', '东欧', 'army') +
		'  波罗的海海军 ' + nv0 + '→' + cnt(g, '德国', '波罗的海', 'navy'))
	ok('★★ ① <东欧>征召 1 支陆军', cnt(g, '德国', '东欧', 'army') === a0 + 1, a0 + '→' + cnt(g, '德国', '东欧', 'army'))
	ok('★★ ② <波罗的海>建设 1 支海军', cnt(g, '德国', '波罗的海', 'navy') === nv0 + 1, nv0 + '→' + cnt(g, '德国', '波罗的海', 'navy'))
}

/* ============ 6. 14503 提尔比茨号 ============ */
console.log('\n=== 6. 14503《提尔比茨号》[EVENT，让权英国暗弃响应] ===')
{
	const g = base()
	/* 英国真实暗置响应：手牌 → play_card（RESPONSE 落 table_responses） */
	for (const face of ['15330', '15334']) {
		give(g, face, '英国')
		I.refresh(g)
		R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
		I.refresh(g)
		const c = (g.hands['英国'] || []).find(x => faceOf(x) === face)
		if (c) R.action(g, 'Allies', 'play_card', { card: c })
		I.refresh(g)
	}
	console.log('  英国暗置响应 = ' + JSON.stringify((g.table_responses || []).map(x => ({ c: faceOf(x.card_id), side: x.owner_side, n: x.nation }))))
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	give(g, '14503', '德国')
	I.refresh(g)
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '14503')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  打出 log = ' + lg.slice(0, 220))
	console.log('  pending_script = ' + JSON.stringify(g.pending_script && g.pending_script.kind))
	const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
	const psA = vA.pending_script || null
	/* 候选走 query 'script_state'（客户端 on_reply 里 script_state = params），不在 view 里 */
	const ssA = R.query(g, 'Allies', 'script_state', {}) || {}
	const cands = (ssA.candidates || []).map(c => (c && typeof c === 'object') ? c.id : c)
	console.log('  Allies 候选(script_state) = ' + JSON.stringify(cands) +
		'  Axis.pending_script=' + JSON.stringify(!!vX.pending_script))
	ok('★★ ① 进入让权 uk_facedown_discard', !!(g.pending_script && g.pending_script.kind === 'uk_facedown_discard'))
	ok('★★ ② 只有英国侧看得到候选', !!psA && !vX.pending_script, 'A=' + !!psA)
	ok('★ ③ 公共日志不泄露卡名', !/15330|15334/.test(lg), lg.slice(0, 120))
	if (cands.length) {
		const t0 = (g.table_responses || []).length
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'resolve_script', { pick: [cands[0]] })
		I.refresh(g)
		console.log('  英国选择 log = ' + logSince(g, n1).slice(0, 200))
		console.log('  暗置 ' + t0 + '→' + (g.table_responses || []).length + '  让权结束=' + !g.pending_script)
		ok('★★ ④ 暗弃 1 张且让权结束', (g.table_responses || []).length === t0 - 1 && !g.pending_script,
			t0 + '→' + (g.table_responses || []).length)
	} else {
		ok('★★ ④ 暗弃 1 张且让权结束', false, '候选为空（英国桌面无可弃响应）')
	}
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
