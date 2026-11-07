/*
 * SUPP 逐国真实盘面测试 · 日本（8 张）
 *   7900 竭泽而渔 / 7901 强占马六甲海峡 / 7902 澳洲海岸线攻势 / 7903 菊水特攻
 *   7904 亡命之计 / 7905 豫湘桂战役 / 8600 南方作战计划 / 8601 远东共和国
 *
 * 路线 B（调试布阵 + 真实 action + 三层断言）。日本这几张多是
 * 「出牌阶段开始时」触发的响应卡，测试手法：先真实 play_card 暗置到桌面，
 * 再重新进入出牌阶段让 phase_play 派发窗口。
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

function base(nation = '日本', phase = 'play') {
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
const place = (g, piece, nation, type, spaceName) =>
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
		'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
const give = (g, face, nation) =>
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
		'debug_add_card', { face, nation, dest: 'hand' })
const cnt = (g, nation, spaceName, type) =>
	I.pieces_on(g, d.id_of(spaceName)).filter(p => g.piece_nation[p] === nation && g.piece_type[p] === type).length

/* 把响应卡暗置到桌面（真实动作），然后重新进入出牌阶段触发 play_start 窗口 */
function armPlayStart(g, face) {
	give(g, face, '日本')
	I.refresh(g)
	const c = (g.hands['日本'] || []).find(x => faceOf(x) === face)
	if (!c) return null
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: c })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'resource' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	return (g.table_responses || []).find(x => faceOf(x.card_id) === face)
}
const respIds = g => ((R.view(g, 'Axis').pending_trigger || {}).candidates || [])
	.map(c => (c && (c.card_face || c.card_id || c.id)) || c)

/* ============ 1. 7900 竭泽而渔（EFFECT，play_start，弃4张手牌→从弃牌堆取1张）============ */
console.log('=== 1. 7900《竭泽而渔》[EFFECT · 出牌阶段开始] ===')
{
	const g = base('日本', 'play')
	for (let k = 0; k < 6; k++) give(g, '7906', '日本')      /* 垫手牌（7906 是日本 SUPP? 若不存在则忽略） */
	I.refresh(g)
	give(g, '7900', '日本')
	I.refresh(g)
	/* 手牌不足 4 张时补 BASIC */
	while ((g.hands['日本'] || []).length < 5) { give(g, '15400', '日本'); I.refresh(g) }
	const hand0 = (g.hands['日本'] || []).length
	const card = (g.hands['日本'] || []).find(x => faceOf(x) === '7900')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  手牌 ' + hand0 + '→' + (g.hands['日本'] || []).length)
	console.log('  log = ' + lg.slice(0, 260))
	console.log('  pending_script = ' + JSON.stringify(g.pending_script && { kind: g.pending_script.kind, step: g.pending_script.step, need: g.pending_script.need_discard }))
	ok('★ ① 打出《竭泽而渔》', /竭泽而渔/.test(lg), lg.slice(0, 140))

	/* 第 1 步：选 4 张手牌弃置（脚本 need_discard） */
	if (g.pending_script) {
		const handNow = (g.hands['日本'] || []).filter(x => faceOf(x) !== '7900')
		const four = handNow.slice(0, 4)
		const n1 = (g.log || []).length
		R.action(g, 'Axis', 'resolve_script', { discard: four })
		I.refresh(g)
		console.log('  弃 4 张 log = ' + logSince(g, n1).slice(0, 160) +
			'  手牌 →' + (g.hands['日本'] || []).length)
		/* 11 → 10（本卡离手）→ 6（再弃 4 张） */
		ok('★★ ② 弃置 4 张手牌', (g.hands['日本'] || []).length === hand0 - 5,
			hand0 + '→' + (g.hands['日本'] || []).length)
	}
	/* 第 2 步：从弃牌堆挑 1 张回手 */
	if (g.pending_script) {
		const st = R.query(g, 'Axis', 'script_state', {}) || {}
		/* 候选给的是【牌面 id】，提交需要【实例 id】→ 从弃牌堆按牌面反查 */
		/* 候选结构 = { id: '7903#1'(实例), card_id: '7903'(牌面), name, type, nation } → 提交用 id */
		const cands = (st.candidates || []).map(c => (c && (c.id || c.card_id)) || c)
		console.log('  弃牌堆候选 = ' + JSON.stringify(cands.slice(0, 4)))
		const h1 = (g.hands['日本'] || []).length
		const n2 = (g.log || []).length
		if (cands.length) R.action(g, 'Axis', 'resolve_script', { pick: [cands[0]] })
		I.refresh(g)
		console.log('  取牌 log = ' + logSince(g, n2).slice(0, 160) + '  手牌 →' + (g.hands['日本'] || []).length)
		ok('★★ ③ 从弃牌堆取回 1 张（手牌 +1、脚本结束）',
			(g.hands['日本'] || []).length === h1 + 1 && !g.pending_script,
			h1 + '→' + (g.hands['日本'] || []).length)
	}
}

/* ============ 2. 7901 强占马六甲海峡（ECON）============ */
console.log('\n=== 2. 7901《强占马六甲海峡》[ECON] ===')
{
	const g = base('日本', 'play')
	place(g, 'jp_sea_army', '日本', 'army', '东南亚')
	/* 相邻海域才有海军；找一个相邻海域 */
	const seaN = (d.spaces[d.id_of('东南亚')].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'sea')
	place(g, 'jp_n1', '日本', 'navy', d.name_of(seaN))
	I.refresh(g)
	give(g, '7901', '日本')
	I.refresh(g)
	const uk0 = (g.decks['英国'] || []).length
	const sc0 = Number((g.score || {}).axis || 0)
	const card = (g.hands['日本'] || []).find(x => faceOf(x) === '7901')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card, target: '英国' })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 220))
	console.log('  英国牌库 ' + uk0 + '→' + (g.decks['英国'] || []).length + '  axis ' + sc0 + '→' + Number((g.score || {}).axis || 0))
	ok('★★ ① 英国损耗 2 张', (g.decks['英国'] || []).length === uk0 - 2, uk0 + '→' + (g.decks['英国'] || []).length)
	ok('★★ ② 日本 +2 分', Number((g.score || {}).axis || 0) === sc0 + 2, sc0 + '→' + Number((g.score || {}).axis || 0))

	/* 条件不满足对照：撤掉海军 → 无效果 */
	const g2 = base('日本', 'play')
	place(g2, 'jp_sea_army2', '日本', 'army', '东南亚')
	give(g2, '7901', '日本')
	I.refresh(g2)
	const uk1 = (g2.decks['英国'] || []).length
	const c2 = (g2.hands['日本'] || []).find(x => faceOf(x) === '7901')
	R.action(g2, 'Axis', 'play_card', { card: c2, target: '英国' })
	I.refresh(g2)
	ok('★ ③ 无相邻海军时无效果', (g2.decks['英国'] || []).length === uk1,
		uk1 + '→' + (g2.decks['英国'] || []).length)
}

/* ============ 3. 7902 澳洲海岸线攻势（RESPONSE · 对澳/新发起陆战后）============ */
console.log('\n=== 3. 7902《澳洲海岸线攻势》[RESPONSE] ===')
{
	const g = base('日本', 'play')
	const inst = armPlayStart(g, '7902')
	console.log('  暗置响应 = ' + JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	ok('★ ① 响应卡可暗置到桌面', !!inst, JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	/*
	 * 日本【海军】从相邻海域对<澳大利亚>发起陆战 → 触发 7902 窗口。
	 * （上一轮误判成"陆军才能发起、澳洲只邻海域所以打不了"；实际
	 *   battle_initiators 明确接受 navy —— 澳洲登陆战本来就是海军发起的。）
	 */
	const AU = d.id_of('澳大利亚')
	const sea = (d.spaces[AU].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'sea')
	place(g, 'jp_nv', '日本', 'navy', d.name_of(sea))
	place(g, 'au_def', '英国', 'army', '澳大利亚')
	I.refresh(g)
	I.grant_supply(g, 'jp_nv', g.turn)
	I.refresh(g)
	const inits = I.battle_initiators(g, '日本', AU, 'land')
	console.log('  battle_initiators = ' + JSON.stringify((inits || []).map(x => x.type + '@' + x.space_name)))
	ok('★ ① 海军可作陆战发起单位（引擎口径）',
		(inits || []).some(x => x.type === 'navy'), JSON.stringify(inits))
	give(g, '15401', '日本')
	I.refresh(g)
	const n0 = (g.log || []).length
	const basic = (g.hands['日本'] || []).find(x => faceOf(x) === '15401')
	R.action(g, 'Axis', 'play_card', { card: basic, space: AU, piece: 'au_def' })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  发起陆战 log = ' + lg.slice(0, 220))
	/*
	 * 地图事实：<澳大利亚>/<新西兰> 只与海域相邻（澳=印度洋/南海/南太平洋，新=南太平洋/东太平洋），
	 * 真实对局里无法从陆地发起陆战 → 这里改为直接验 7902 的触发判据（trigger.filter），
	 * 并保留\"响应卡能暗置到桌面\"这条真实动作断言。
	 */
	const ids = respIds(g)
	console.log('  pending_trigger 候选 = ' + JSON.stringify(ids))
	const offered = ids.map(String).some(x => x.indexOf('7902') >= 0) ||
		(g.armed_offers || []).some(w => (w.cards || []).some(c => faceOf(c.card_id) === '7902'))
	ok('★★ ② 对澳陆战后 7902 开出窗口', offered,
		JSON.stringify({ ids, offers: (g.armed_offers || []).map(w => w.when) }))
	if (offered) {
		const n1 = (g.log || []).length
		const id = ids.map(String).find(x => x.indexOf('7902') >= 0) || (inst && inst.card_id)
		R.action(g, 'Axis', 'trigger_response', { card: id })
		I.refresh(g)
		const lg2 = logSince(g, n1)
		console.log('  触发 log = ' + lg2.slice(0, 240))
		console.log('  澳大利亚 = ' + JSON.stringify(I.pieces_on(g, AU).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
		ok('★★ ③ 在战斗地区建设陆军（澳大利亚出现日本陆军）',
			I.pieces_on(g, AU).some(p => g.piece_nation[p] === '日本' && g.piece_type[p] === 'army'),
			lg2.slice(0, 140))
	}
}

/* ============ 4. 8601 远东共和国（STATUS）============ */
console.log('\n=== 4. 8601《远东共和国》[STATUS] ===')
{
	const g = base('日本', 'play')
	give(g, '8601', '日本')
	I.refresh(g)
	place(g, 'jp_vl', '日本', 'army', '海参崴')
	I.refresh(g)
	const card = (g.hands['日本'] || []).find(x => faceOf(x) === '8601')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  打出 log = ' + lg.slice(0, 200))
	console.log('  aura.space_immune = ' + JSON.stringify((g.status_aura || {}).space_immune))
	ok('★ ① 打出状态卡', /远东共和国/.test(lg), lg.slice(0, 120))
	ok('★ ② 海参崴获得免补给移除光环',
		JSON.stringify((g.status_aura || {}).space_immune || {}).indexOf(String(d.id_of('海参崴'))) >= 0 ||
		/gB/ && /免/.test(lg),
		JSON.stringify((g.status_aura || {}).space_immune))

	/* 补给阶段：海参崴的日本陆军不应被移除 */
	const before = cnt(g, '日本', '海参崴', 'army')
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'supply' })
	I.refresh(g)
	console.log('  补给 log = ' + logSince(g, n1).slice(0, 200))
	console.log('  海参崴日本陆军 ' + before + '→' + cnt(g, '日本', '海参崴', 'army'))
	ok('★★ ③ 断补也不移除（光环生效）', cnt(g, '日本', '海参崴', 'army') === before,
		before + '→' + cnt(g, '日本', '海参崴', 'army'))
}

/* ============ 5. 剩余四张 play_start 响应卡：窗口是否开出 ============ */
console.log('\n=== 5. 7903 / 7904 / 7905 / 8600（play_start 响应卡）===')
for (const face of ['7903', '7904', '7905', '8600']) {
	const g = base('日本', 'play')
	const inst = armPlayStart(g, face)
	const ids = respIds(g)
	const offers = (g.armed_offers || []).map(w => ({ when: w.when, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))
	console.log('  ' + face + '：暗置=' + !!inst + ' 候选=' + JSON.stringify(ids) + ' 窗口=' + JSON.stringify(offers))
	ok(face + ' 出牌阶段开始开出窗口',
		ids.map(String).some(x => x.indexOf(face) >= 0) ||
		offers.some(w => w.faces.indexOf(face) >= 0),
		JSON.stringify({ ids, offers }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
