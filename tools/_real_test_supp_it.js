/*
 * SUPP 逐国真实盘面测试 · 意大利（4 张）
 *   16700 一日之狮 / 16701 意大利万岁 / 16702 埃塞俄比亚战争后勤 / 16703 罗马尼亚铁卫团
 *
 * 路线 B（调试布阵 + 真实 action + 三层断言：服务端 state / view / 日志 + 残留检查）
 * 骨架照 docs/test-supp-jp.md / docs/test-supp-su.md。
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

function base(nation = '意大利', phase = 'play') {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null; g.pending_echo = null; g.pending_scoring = null
	g.pending_script = null; g.pending_event_step = null; g.pending_event_targets = null
	g.pending_trigger = null; g._resp_settling = false
	R.action(g, 'Axis', 'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}
const sideOf = nation => (I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis')
const place = (g, piece, nation, type, spaceName) =>
	R.action(g, sideOf(nation), 'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
const give = (g, face, nation) =>
	R.action(g, sideOf(nation), 'debug_add_card', { face, nation, dest: 'hand' })
const cnt = (g, nation, spaceName, type) =>
	I.pieces_on(g, d.id_of(spaceName)).filter(p => g.piece_nation[p] === nation && g.piece_type[p] === type).length
const handOf = (g, nation) => (g.hands[nation] || [])
const instOf = (g, nation, face) => handOf(g, nation).find(x => faceOf(x) === face) || null
const deckN = (g, nation) => (g.decks[nation] || []).length

/* ============ 1. 16700 一日之狮（EFFECT · armed enemy_echo_played）============ */
console.log('=== 1. 16700《一日之狮》[EFFECT · 敌方打出增强卡时] ===')
{
	/*
	 * 15354《加拿大进入动员》是【计分阶段开始时】的增强卡 —— 必须在计分阶段打出，
	 * 出牌阶段会被 check_phase_for_card 拒（"只能在本方的计分阶段开始时打出"）。
	 * 16700 卡面是"敌方国家打出[增强卡]时"，不限阶段，故计分阶段同样是真实时点。
	 */
	const g = base('英国', 'scoring')
	give(g, '15354', '英国')     /* 15354 加拿大进入动员（英国增强卡：弃2张 → 加拿大陆军 + 北大西洋海军） */
	give(g, '16700', '意大利')   /* 意大利拦截卡 */
	I.refresh(g)
	const hand0 = handOf(g, '英国').length
	const n0 = (g.log || []).length
	const ukEcho = instOf(g, '英国', '15354')
	R.action(g, 'Allies', 'play_card', { card: ukEcho })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  英国打增强卡 log = ' + lg0.slice(0, 240))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({
		when: w.when, kind: w.kind, nation: w.nation, faces: (w.cards || []).map(c => faceOf(c.card_id)),
	}))))
	const win = (g.armed_offers || []).find(w => w.when === 'enemy_echo_played')
	ok('★★ ① 敌方增强卡打出时开出拦截窗口', !!win && faceOf((win.cards || [{}])[0].card_id) === '16700',
		JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★ ② 挂起期间效果尚未发生（加拿大无英国陆军）',
		cnt(g, '英国', '加拿大', 'army') === 0, lg0.slice(0, 160))
	ok('★ ③ 增强卡代价已在窗口前付掉（S1 代价照付，英国手牌 -2）',
		handOf(g, '英国').length === hand0 - 2, hand0 + '→' + handOf(g, '英国').length)

	const it0 = deckN(g, '意大利')
	const c16700 = instOf(g, '意大利', '16700')
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: c16700 })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  拦截 log = ' + lg1.slice(0, 240))
	console.log('  意大利牌库 ' + it0 + '→' + deckN(g, '意大利'))
	ok('★★ ④ 意大利损耗 1 张牌（牌库 -1）', deckN(g, '意大利') === it0 - 1, it0 + '→' + deckN(g, '意大利'))
	ok('★★ ⑤ 增强卡效果无效：加拿大仍无英国陆军',
		cnt(g, '英国', '加拿大', 'army') === 0, lg1.slice(0, 160))
	ok('★ ⑥ 被拦的卡照常离手进英国弃牌堆',
		handOf(g, '英国').indexOf(ukEcho) < 0 && (g.discard['英国'] || []).indexOf(ukEcho) >= 0,
		'hand=' + JSON.stringify(handOf(g, '英国').map(faceOf)))
	ok('★ ⑦ 窗口结算后清空（无残留）',
		!(g.armed_offers || []).some(w => w.when === 'enemy_echo_played') && !g.pending_armed_use,
		JSON.stringify((g.armed_offers || []).map(w => w.when)))

	/* 对照组：放弃拦截 → 效果照常 */
	const g2 = base('英国', 'scoring')
	give(g2, '15354', '英国')
	give(g2, '16700', '意大利')
	I.refresh(g2)
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '英国', '15354') })
	I.refresh(g2)
	const n2 = (g2.log || []).length
	R.action(g2, 'Axis', 'skip_armed_offer', { card: instOf(g2, '意大利', '16700') })
	I.refresh(g2)
	const lg2 = logSince(g2, n2)
	console.log('  放弃拦截 log = ' + lg2.slice(0, 240))
	console.log('  加拿大 = ' + JSON.stringify(I.pieces_on(g2, d.id_of('加拿大')).map(p => g2.piece_nation[p] + '/' + g2.piece_type[p])))
	ok('★★ ⑧ 对照：放弃拦截 → 增强卡效果照常（加拿大出现英国陆军 + 北大西洋英国海军）',
		cnt(g2, '英国', '加拿大', 'army') === 1 && cnt(g2, '英国', '北大西洋', 'navy') === 1,
		lg2.slice(0, 160))
}

/* ============ 2. 16701 意大利万岁（EFFECT · play_start）============ */
console.log('\n=== 2. 16701《意大利万岁》[EFFECT · 出牌阶段开始时] ===')
{
	const g = base('意大利', 'play')
	give(g, '16701', '意大利')
	give(g, '17700', '意大利')
	give(g, '17700', '意大利')
	give(g, '17700', '意大利')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '意大利', '16701') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 200))
	console.log('  it_viva=' + g.it_viva + ' used=' + g.it_viva_used)
	ok('★ ① 打出 16701 → 本回合双行动生效', g.it_viva === true && (g.it_viva_used || 0) === 0, lg0.slice(0, 140))

	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '意大利', '17700'), space: d.id_of('巴尔干') })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  第1次 log = ' + lg1.slice(0, 180))
	console.log('  巴尔干意军=' + cnt(g, '意大利', '巴尔干', 'army') +
		' play_done=' + JSON.stringify(g.play_done) + ' used=' + g.it_viva_used)
	ok('★★ ② 第 1 次行动（基本卡）成功，且名额未被用掉', cnt(g, '意大利', '巴尔干', 'army') === 1 &&
		g.play_done['意大利'] !== true && (g.it_viva_used || 0) === 1,
		JSON.stringify({ done: g.play_done, used: g.it_viva_used }))

	const n2 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '意大利', '17700'), space: d.id_of('东欧') })
	I.refresh(g)
	const lg2 = logSince(g, n2)
	console.log('  第2次 log = ' + lg2.slice(0, 180))
	console.log('  东欧意军=' + cnt(g, '意大利', '东欧', 'army') + ' play_done=' + g.play_done['意大利'])
	ok('★★ ③ 第 2 次行动（基本卡）成功，随后名额用尽', cnt(g, '意大利', '东欧', 'army') === 1 &&
		g.play_done['意大利'] === true, lg2.slice(0, 160))

	/* 第 3 次：名额已尽 */
	const hand3 = handOf(g, '意大利').length
	const n3 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '意大利', '17700'), space: d.id_of('非洲北部') })
	I.refresh(g)
	const lg3 = logSince(g, n3)
	console.log('  第3次 log = ' + lg3.slice(0, 180))
	ok('★★ ④ 只有 2 次行动：第 3 次被拒（卡未离手）',
		handOf(g, '意大利').length === hand3, lg3.slice(0, 160))

	/* 非基本卡被拒（只允许基本卡）：用【状态卡】——它在出牌阶段本来合法，唯一拒绝原因就是 16701 */
	const g4 = base('意大利', 'play')
	give(g4, '16701', '意大利')
	give(g4, '17739', '意大利')   /* 巴尔干资源（STATUS，出牌阶段可打出） */
	I.refresh(g4)
	R.action(g4, 'Axis', 'play_card', { card: instOf(g4, '意大利', '16701') })
	I.refresh(g4)
	const n4 = (g4.log || []).length
	R.action(g4, 'Axis', 'play_card', { card: instOf(g4, '意大利', '17739') })
	I.refresh(g4)
	const lg4 = logSince(g4, n4)
	console.log('  非基本卡 log = ' + lg4.slice(0, 200))
	ok('★★ ⑤ 只能打出基本卡（状态卡被 16701 拒）', /意大利万岁/.test(lg4) && /基本卡/.test(lg4), lg4.slice(0, 160))
}

/* ============ 3. 16702 埃塞俄比亚战争后勤（EVENT · 二选一）============ */
console.log('\n=== 3. 16702《埃塞俄比亚战争后勤》[EVENT] ===')
{
	/* 分支 1：<北非>建陆军 + 对<东非>发起陆战 */
	const g = base('意大利', 'play')
	place(g, 'it_med', '意大利', 'navy', '地中海')     /* 让<非洲北部>可建（邻接补给中海军） */
	place(g, 'uk_ea', '英国', 'army', '非洲东部')      /* 陆战目标 */
	I.refresh(g)
	give(g, '16702', '意大利')
	I.refresh(g)
	const card = instOf(g, '意大利', '16702')
	const NA = d.id_of('非洲北部'), EA = d.id_of('非洲东部')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card, choice: 0, spaces: [NA, EA] })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  选分支1 log = ' + lg0.slice(0, 240))
	console.log('  北非 = ' + JSON.stringify(I.pieces_on(g, NA).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★★ ① 分支1：在<非洲北部>建设 1 支意大利陆军',
		cnt(g, '意大利', '非洲北部', 'army') === 1, lg0.slice(0, 160))

	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'event_step_next', {})
	I.refresh(g)
	const lg1 = logSince(g, n1)
	const bud = g.event_budget
	console.log('  下一步 log = ' + lg1.slice(0, 200))
	console.log('  event_budget = ' + JSON.stringify(bud && { kind: bud.kind, remaining: bud.remaining }))
	ok('★ ② 第 2 步生成陆战预算（剩余 1 次）',
		!!bud && bud.kind === 'land' && bud.remaining === 1, JSON.stringify(bud && { kind: bud.kind, remaining: bud.remaining }))

	const fromId = Object.keys(g.location).find(p => g.location[p] === NA && g.piece_nation[p] === '意大利')
	const n2 = (g.log || []).length
	R.action(g, 'Axis', 'event_battle', { target: EA, from: fromId, victim: 'uk_ea' })
	I.refresh(g)
	const lg2 = logSince(g, n2)
	console.log('  陆战 log = ' + lg2.slice(0, 240))
	ok('★★ ③ 对<非洲东部>发起陆战：英国陆军被移除',
		cnt(g, '英国', '非洲东部', 'army') === 0, lg2.slice(0, 160))

	const n3 = (g.log || []).length
	R.action(g, 'Axis', 'event_finish', {})
	I.refresh(g)
	const lg3 = logSince(g, n3)
	console.log('  收尾 log = ' + lg3.slice(0, 200))
	ok('★ ④ 收尾：预算清空、卡进弃牌堆',
		!g.event_budget && (g.discard['意大利'] || []).indexOf(card) >= 0, lg3.slice(0, 160))

	/* 分支 2：<北非> + <东非> 各建 1 支陆军 */
	const g2 = base('意大利', 'play')
	place(g2, 'it_med', '意大利', 'navy', '地中海')
	I.refresh(g2)
	give(g2, '16702', '意大利')
	I.refresh(g2)
	const card2 = instOf(g2, '意大利', '16702')
	const n4 = (g2.log || []).length
	R.action(g2, 'Axis', 'play_card', { card: card2, choice: 1, spaces: [NA, EA] })
	I.refresh(g2)
	R.action(g2, 'Axis', 'event_step_next', {})
	I.refresh(g2)
	R.action(g2, 'Axis', 'event_step_next', {})
	I.refresh(g2)
	const lg4 = logSince(g2, n4)
	console.log('  选分支2 log = ' + lg4.slice(0, 300))
	console.log('  北非 = ' + JSON.stringify(I.pieces_on(g2, NA).map(p => g2.piece_nation[p] + '/' + g2.piece_type[p])) +
		'  东非 = ' + JSON.stringify(I.pieces_on(g2, EA).map(p => g2.piece_nation[p] + '/' + g2.piece_type[p])))
	ok('★★ ⑤ 分支2：<北非><东非> 各建设 1 支意大利陆军',
		cnt(g2, '意大利', '非洲北部', 'army') === 1 && cnt(g2, '意大利', '非洲东部', 'army') === 1,
		lg4.slice(0, 200))
	ok('★ ⑥ 分支2 收尾：无战斗预算残留、卡进弃牌堆',
		!g2.event_budget && (g2.discard['意大利'] || []).indexOf(card2) >= 0,
		JSON.stringify({ budget: !!g2.event_budget }))
}

/* ============ 4. 16703 罗马尼亚铁卫团（EVENT · 委托德国弃牌摸牌）============ */
console.log('\n=== 4. 16703《罗马尼亚铁卫团》[EVENT] ===')
{
	const g = base('意大利', 'play')
	give(g, '16703', '意大利')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '意大利', '16703') })
	I.refresh(g)
	/* 分步机：第 1 步（征召）执行后停机，第 2 步（委托德国）须点「下一步」才建立 */
	R.action(g, 'Axis', 'event_step_next', {})
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 260))
	console.log('  delegate = ' + JSON.stringify(g.delegate && { mode: g.delegate.mode, delegate: g.delegate.delegate }))
	ok('★ ① 在<巴尔干>征召 1 支意大利陆军', cnt(g, '意大利', '巴尔干', 'army') === 1,
		JSON.stringify(I.pieces_on(g, d.id_of('巴尔干')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★★ ② 委托德国挂起（german_draw）', !!g.delegate && g.delegate.mode === 'german_draw',
		JSON.stringify(g.delegate && { mode: g.delegate.mode }))

	const deHand0 = handOf(g, '德国').length
	const deDisc0 = (g.discard['德国'] || []).length
	const deDeck0 = deckN(g, '德国')
	const target = handOf(g, '德国')[0]
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'italy_german_draw', { card_id: target })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  德国结算 log = ' + lg1.slice(0, 200))
	console.log('  德国手牌 ' + deHand0 + '→' + handOf(g, '德国').length +
		' 弃牌堆 ' + deDisc0 + '→' + (g.discard['德国'] || []).length +
		' 牌库 ' + deDeck0 + '→' + deckN(g, '德国'))
	ok('★★ ③ 德国弃 1 张手牌并摸 1 张（手牌数不变、弃牌堆 +1、牌库 -1）',
		handOf(g, '德国').length === deHand0 &&
		(g.discard['德国'] || []).length === deDisc0 + 1 &&
		deckN(g, '德国') === deDeck0 - 1,
		JSON.stringify({ h: handOf(g, '德国').length, d: (g.discard['德国'] || []).length, deck: deckN(g, '德国') }))
	ok('★★ ④ 结算后归还意大利（delegate 清空、current_nation=意大利）',
		!g.delegate && g.current_nation === '意大利',
		JSON.stringify({ delegate: !!g.delegate, cur: g.current_nation }))

	/* 对照组：德国放弃 */
	const g2 = base('意大利', 'play')
	give(g2, '16703', '意大利')
	I.refresh(g2)
	R.action(g2, 'Axis', 'play_card', { card: instOf(g2, '意大利', '16703') })
	I.refresh(g2)
	R.action(g2, 'Axis', 'event_step_next', {})
	I.refresh(g2)
	const n2 = (g2.log || []).length
	R.action(g2, 'Axis', 'italy_german_draw', {})
	I.refresh(g2)
	const lg2 = logSince(g2, n2)
	console.log('  放弃 log = ' + lg2.slice(0, 180))
	ok('★ ⑤ 对照：德国放弃 → 仍归还意大利、委托清空',
		!g2.delegate && g2.current_nation === '意大利', lg2.slice(0, 160))
}

/* ============ 残留检查 ============ */
console.log('\n=== 5. 残留检查 ===')
{
	const g = base('意大利', 'play')
	ok('★ 干净盘面：无挂起窗口', !(g.armed_offers || []).length && !g.pending_armed_use &&
		!(g.response_stack || []).length && !g.event_budget && !g.delegate &&
		!g.pending_event_step && !g.it_viva, JSON.stringify({
			offers: (g.armed_offers || []).length, budget: !!g.event_budget,
			delegate: !!g.delegate, viva: !!g.it_viva,
		}))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
