/*
 * SUPP 逐国真实盘面测试 · 英国（4 张）
 *   12501 皇冠上的明珠 / 12502 告法国人民书 / 12503 道丁系统 / 12504 抵抗万岁
 *
 * 路线 B（调试布阵 + 真实 action + 三层断言：服务端 state / view / 日志 + 残留检查）
 * 骨架照 docs/test-supp-jp.md / -su.md / -it.md。
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

function base(nation = '英国', phase = 'play') {
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
const respIds = g => ((R.view(g, 'Allies').pending_trigger || {}).candidates || [])
	.map(c => (c && (c.card_face || c.card_id || c.id)) || c)
/* 清空西欧（开局法军驻守），让"敌方在西欧建设"成为可能 */
function clearWestEurope(g) {
	const fr = Object.keys(g.location).find(p => g.location[p] === d.id_of('西欧'))
	if (fr) R.action(g, 'Allies', 'debug_remove', { piece: fr })
	I.refresh(g)
}

/* ============ 1. 12501 皇冠上的明珠（EVENT · 在<印度>消灭敌方陆军）============ */
console.log('=== 1. 12501《皇冠上的明珠》[EVENT] ===')
{
	const g = base('英国', 'play')
	place(g, 'jp_ind', '日本', 'army', '印度')
	give(g, '12501', '英国')
	I.refresh(g)
	const n0 = (g.log || []).length
	const card = instOf(g, '英国', '12501')
	R.action(g, 'Allies', 'play_card', { card })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 220))
	console.log('  印度 = ' + JSON.stringify(I.pieces_on(g, d.id_of('印度')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★★ ① 在<印度>消灭敌方（日本）陆军', cnt(g, '日本', '印度', 'army') === 0, lg0.slice(0, 160))
	ok('★ ② 单步卡无残留挂起（不产生 pending_event_step）', !g.pending_event_step,
		JSON.stringify(g.pending_event_step && { step: g.pending_event_step.step }))
	ok('★ ③ 卡离手进弃牌堆', handOf(g, '英国').indexOf(card) < 0 && (g.discard['英国'] || []).indexOf(card) >= 0,
		JSON.stringify(handOf(g, '英国').map(faceOf)))

	/* 反例：印度只有友军陆军时，不应误杀自己人 */
	const g2 = base('英国', 'play')
	place(g2, 'uk_ind', '英国', 'army', '印度')
	give(g2, '12501', '英国')
	I.refresh(g2)
	const n2 = (g2.log || []).length
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '英国', '12501') })
	I.refresh(g2)
	const lg2 = logSince(g2, n2)
	console.log('  反例 log = ' + lg2.slice(0, 220))
	ok('★★ ④ 反例：<印度>只有友军时不误杀（英军仍在）', cnt(g2, '英国', '印度', 'army') === 1, lg2.slice(0, 160))
}

/* ============ 2. 12502 告法国人民书（EVENT · 法国四选一）============ */
console.log('\n=== 2. 12502《告法国人民书》[EVENT] ===')
{
	const g = base('英国', 'play')
	clearWestEurope(g)   /* 空出<西欧>（法国大本营）槽位 */
	place(g, 'fr_na', '法国', 'army', '非洲北部')
	give(g, '12502', '英国')
	I.refresh(g)
	const labels = (I.EVENT_EFFECTS['12502'] || {}).choiceLabels || []
	console.log('  选项标签 = ' + JSON.stringify(labels))
	ok('★ ① 四选一选项齐全（建陆军 / 陆战 / 建海军 / 海战）', labels.length === 4, JSON.stringify(labels))

	const card = instOf(g, '英国', '12502')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card, choice: 0, spaces: [d.id_of('西欧')] })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  分支0 log = ' + lg0.slice(0, 240))
	console.log('  西欧 = ' + JSON.stringify(I.pieces_on(g, d.id_of('西欧')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★★ ② 分支0：法国在<西欧>建设 1 支陆军（法国自己的兵）',
		cnt(g, '法国', '西欧', 'army') === 1, lg0.slice(0, 160))
	ok('★ ③ 卡离手进弃牌堆、无挂起残留',
		handOf(g, '英国').indexOf(card) < 0 && (g.discard['英国'] || []).indexOf(card) >= 0 &&
		!g.pending_event_step, JSON.stringify(handOf(g, '英国').map(faceOf)))
}

/* ============ 3. 12503 道丁系统（RESPONSE · 敌方在<北海>建设海军后）============ */
console.log('\n=== 3. 12503《道丁系统》[RESPONSE] ===')
{
	const g = base('英国', 'play')
	give(g, '12503', '英国')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '英国', '12503') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	const onTable = (g.table_responses || []).some(x => faceOf(x.card_id) === '12503')
	console.log('  暗置 log = ' + lg0.slice(0, 140))
	console.log('  table_responses = ' + JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	ok('★ ① 响应卡可暗置到桌面', onTable, lg0.slice(0, 120))

	/* 意大利在<西欧>放陆军 → 可在<北海>建设海军（邻接本国陆军 + 连回补给源） */
	clearWestEurope(g)
	place(g, 'it_weu', '意大利', 'army', '西欧')
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	I.refresh(g)
	give(g, '17702', '意大利')
	I.refresh(g)
	const legal = I.can_build_at(g, '意大利', d.id_of('北海'), 'navy')
	console.log('  意大利建海军@北海 = ' + JSON.stringify(legal))
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '意大利', '17702'), space: d.id_of('北海') })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  建海军 log = ' + lg1.slice(0, 220))
	console.log('  pending_trigger = ' + JSON.stringify(respIds(g)))
	ok('★★ ② 敌方在<北海>建设海军后开出 12503 窗口',
		respIds(g).map(String).some(x => x.indexOf('12503') >= 0), JSON.stringify(respIds(g)))

	const pt = R.view(g, 'Allies').pending_trigger || {}
	const cand = (pt.candidates || []).find(c => String(c.card_face || c.card_id || '').indexOf('12503') >= 0)
	if (cand) {
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'trigger_response', { card: cand.card_id })
		I.refresh(g)
		const lg2 = logSince(g, n2)
		console.log('  触发 log = ' + lg2.slice(0, 240))
		console.log('  北海 = ' + JSON.stringify(I.pieces_on(g, d.id_of('北海')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
		ok('★★ ③ 消灭刚建成的德国…（本次为意大利）海军',
			cnt(g, '意大利', '北海', 'navy') === 0, lg2.slice(0, 160))
		ok('★ ④ 响应卡结算后离桌', !(g.table_responses || []).some(x => faceOf(x.card_id) === '12503'),
			JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	}

	/* 反例：在别的海域建海军（真建成）→ 不开窗 */
	const g2 = base('英国', 'play')
	give(g2, '12503', '英国')
	I.refresh(g2)
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '英国', '12503') })
	I.refresh(g2)
	/* 意大利陆军在西欧（海岸邻接多片海域），才可能建海军 */
	place(g2, 'it_weu2', '意大利', 'army', '西欧')
	I.refresh(g2)
	R.action(g2, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	I.refresh(g2)
	give(g2, '17702', '意大利')
	I.refresh(g2)
	const n3 = (g2.log || []).length
	/*
	 * 反例必须是【真的建成】的海军（合法但不在<北海>）：
	 * 否则测到的是"建不出来"，而不是"12503 不该触发"。故动态挑一个合法海域。
	 */
	const otherSea = Object.keys(d.spaces).map(Number).find(id => {
		const sp = d.spaces[id]
		if (!sp || sp.terrain !== 'sea') return false
		if (Number(id) === Number(d.id_of('北海'))) return false
		return I.can_build_at(g2, '意大利', Number(id), 'navy').ok
	})
	console.log('  反例合法性：意大利可建海军的非<北海>海域 = ' +
		(otherSea ? d.name_of(otherSea) : '（无）'))
	R.action(g2, 'Axis', 'play_card', { card: instOf(g2, '意大利', '17702'), space: otherSea })
	I.refresh(g2)
	const builtOther = otherSea ? cnt(g2, '意大利', d.name_of(otherSea), 'navy') : -1
	console.log('  反例实际建成 = ' + builtOther)
	const lg3 = logSince(g2, n3)
	console.log('  反例 log = ' + lg3.slice(0, 200))
	console.log('  候选 = ' + JSON.stringify(respIds(g2)))
	ok('★★ ⑤ 反例：非<北海>建海军不开窗（且该海军真的建成）',
		builtOther === 1 && !respIds(g2).map(String).some(x => x.indexOf('12503') >= 0),
		JSON.stringify({ built: builtOther, ids: respIds(g2) }))
}

/* ============ 4. 12504 抵抗万岁（RESPONSE · 敌方在<西欧>建设陆军后）============ */
console.log('\n=== 4. 12504《抵抗万岁》[RESPONSE] ===')
{
	const g = base('英国', 'play')
	give(g, '12504', '英国')
	I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '英国', '12504') })
	I.refresh(g)
	ok('★ ① 响应卡可暗置到桌面', (g.table_responses || []).some(x => faceOf(x.card_id) === '12504'),
		JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))

	clearWestEurope(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	I.refresh(g)
	give(g, '17700', '意大利')
	I.refresh(g)
	const legal = I.can_build_at(g, '意大利', d.id_of('西欧'), 'army')
	console.log('  意大利建陆军@西欧 = ' + JSON.stringify(legal))
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '意大利', '17700'), space: d.id_of('西欧') })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  建陆军 log = ' + lg1.slice(0, 220))
	console.log('  pending_trigger = ' + JSON.stringify(respIds(g)))
	ok('★★ ② 敌方在<西欧>建设陆军后开出 12504 窗口',
		respIds(g).map(String).some(x => x.indexOf('12504') >= 0), JSON.stringify(respIds(g)))

	const pt = R.view(g, 'Allies').pending_trigger || {}
	const cand = (pt.candidates || []).find(c => String(c.card_face || c.card_id || '').indexOf('12504') >= 0)
	if (cand) {
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'trigger_response', { card: cand.card_id })
		I.refresh(g)
		const lg2 = logSince(g, n2)
		console.log('  触发 log = ' + lg2.slice(0, 240))
		console.log('  西欧 = ' + JSON.stringify(I.pieces_on(g, d.id_of('西欧')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
		ok('★★ ③ 消灭刚建成的意大利陆军', cnt(g, '意大利', '西欧', 'army') === 0, lg2.slice(0, 160))
		ok('★ ④ 响应卡结算后离桌', !(g.table_responses || []).some(x => faceOf(x.card_id) === '12504'),
			JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	}

	/* 反例：在<巴尔干>建陆军 → 不开窗 */
	const g2 = base('英国', 'play')
	give(g2, '12504', '英国')
	I.refresh(g2)
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '英国', '12504') })
	I.refresh(g2)
	R.action(g2, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	I.refresh(g2)
	give(g2, '17700', '意大利')
	I.refresh(g2)
	const n3 = (g2.log || []).length
	R.action(g2, 'Axis', 'play_card', { card: instOf(g2, '意大利', '17700'), space: d.id_of('巴尔干') })
	I.refresh(g2)
	const lg3 = logSince(g2, n3)
	console.log('  反例 log = ' + lg3.slice(0, 200))
	console.log('  候选 = ' + JSON.stringify(respIds(g2)))
	ok('★★ ⑤ 反例：非<西欧>建陆军不开窗', !respIds(g2).map(String).some(x => x.indexOf('12504') >= 0),
		JSON.stringify(respIds(g2)))
}

/* ============ 残留检查 ============ */
console.log('\n=== 5. 残留检查 ===')
{
	const g = base('英国', 'play')
	ok('★ 干净盘面：无挂起窗口', !(g.armed_offers || []).length && !g.pending_armed_use &&
		!(g.response_stack || []).length && !g.event_budget && !g.delegate && !g.pending_event_step,
		JSON.stringify({ offers: (g.armed_offers || []).length, resp: (g.response_stack || []).length }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
