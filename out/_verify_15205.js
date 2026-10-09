/*
 * 验证：15205《JU-87 俯冲轰炸机》改为【分步原子】后的行为（2026-10-07）
 *
 * 卡面：部署或调度空军后，损耗1张牌：对相邻地区发起1次陆战。
 * 语义（用户裁定）：它【规定发起位置】（空军所在地区的相邻陆地）
 *                 + 给【1 次发起陆战的机会】，打谁由玩家选。
 *
 * 旧实现（错）：run 里 find_battle_target 自动挑第一个目标并立即 do_battle。
 * 新实现：armed.run 建立 game.event_budget（remaining=1，anchor=空军所在格），
 *        由 event_battle / event_finish 驱动（与 15226 同款）。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of

let pass = 0, fail = 0
function ok(cond, label, extra) {
	if (cond) { pass++; console.log('  OK  ' + label) }
	else { fail++; console.log('  FAIL  ' + label + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')) }
}

const GERMANY = SP('德国')   /* 44 */
const EASTEU = SP('东欧')    /* 5 */
const AIR_CARD = '15205#1'

function fresh(withEnemy) {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null; g.phase_note = ''; g.markers = {}
	g.event_budget = null; g.armed_offer = null; g.armed_effects = []
	g.table_responses = []; g.response_queue = []; g.pending_response_choice = null
	g.modifiers = []; g.status_instant = []
	g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'airforce'
	g.hands['德国'] = [AIR_CARD]
	g.discard['德国'] = []
	/* 德国陆军在本土（作为发起单位），苏联陆军在东欧（相邻） */
	const a = 'T' + (++g.piece_seq)
	g.location[a] = GERMANY; g.piece_nation[a] = '德国'; g.piece_type[a] = 'army'
	if (withEnemy) {
		const e = 'T' + (++g.piece_seq)
		g.location[e] = EASTEU; g.piece_nation[e] = '苏联'; g.piece_type[e] = 'army'
	}
	I.refresh && I.refresh(g)
	return g
}

function deckLen(g) { return (g.decks['德国'] || []).length }

console.log('=== 15205 JU-87 分步原子验证 ===')

/* ---------- ① 触发窗口：部署空军后弹出可用窗口 ---------- */
;(() => {
	console.log('[① armed_offer 窗口]')
	const g = fresh(true)
	I.offer_armed_effects(g, 'after_deploy_air', { space: GERMANY, nation: '德国' })
	ok(!!g.armed_offer, '部署空军后弹出 armed_offer')
	ok(!!g.armed_offer && (g.armed_offer.cards || []).some(x => x.card_id === AIR_CARD),
		'窗口内包含 15205', g.armed_offer && g.armed_offer.cards)
})()

/* ---------- ② 相邻无目标 -> ready=false，不弹窗口 ---------- */
;(() => {
	console.log('[② 相邻无合法目标]')
	const g = fresh(true)
	/* 德国陆军放到孤立位置：把唯一陆军移到澳大利亚（与东欧不相邻） */
	const a = Object.keys(g.location)[0]
	g.location[a] = SP('澳大利亚')
	I.refresh && I.refresh(g)
	I.offer_armed_effects(g, 'after_deploy_air', { space: GERMANY, nation: '德国' })
	ok(!g.armed_offer || !(g.armed_offer.cards || []).some(x => x.card_id === AIR_CARD),
		'无合法目标时不给窗口（玩家不会白付代价）', g.armed_offer)
})()

/* ---------- ③ 发动 -> 建立战斗预算，卡仍留在手牌 ---------- */
;(() => {
	console.log('[③ 建立战斗预算]')
	const g = fresh(true)
	I.offer_armed_effects(g, 'after_deploy_air', { space: GERMANY, nation: '德国' })
	R.action(g, 'Axis', 'use_armed_offer', { card: AIR_CARD })
	const b = g.event_budget
	ok(!!b, '已建立 event_budget', b)
	ok(!!b && b.remaining === 1, 'remaining = 1（1 次机会）', b && b.remaining)
	ok(!!b && b.anchor === GERMANY, 'anchor = 空军所在地区（德国）', b && b.anchor)
	ok(!!b && b.source === 'armed', 'source = armed', b && b.source)
	ok((g.hands['德国'] || []).indexOf(AIR_CARD) >= 0, '卡仍留在手牌（代价未付）')
	ok(deckLen(g) === deckLen(g), '牌库未被提前损耗')

	/* 候选：必须是 anchor 的相邻陆地 */
	const v = R.view(g, 'Axis')
	const tg = (v.event_budget && v.event_budget.targets) || []
	ok(tg.indexOf(EASTEU) >= 0, '候选含东欧（德国的相邻陆地）', tg)
	ok(tg.every(sp => (d.spaces[sp].connections || []).indexOf(GERMANY) >= 0),
		'所有候选都在 anchor 相邻', tg)
	/* 非相邻陆地不应出现，例如澳大利亚 */
	ok(tg.indexOf(SP('澳大利亚')) < 0, '候选不含非相邻地区（澳大利亚）', tg)
})()

/* ---------- ④ 玩家点目标发起陆战 ---------- */
;(() => {
	console.log('[④ event_battle]')
	const g = fresh(true)
	I.offer_armed_effects(g, 'after_deploy_air', { space: GERMANY, nation: '德国' })
	R.action(g, 'Axis', 'use_armed_offer', { card: AIR_CARD })
	const inits = I.battle_initiators(g, '德国', EASTEU)
	ok(inits.length > 0, '东欧有可发起单位', inits.map(x => x.id))
	R.action(g, 'Axis', 'event_battle', { target: EASTEU, from: inits[0].id })
	const b = g.event_budget
	ok(!!b && b.battleOk === 1, '战斗已结算 1 场', b && b.battleOk)
	ok(!!b && b.remaining === 0, '机会已用尽', b && b.remaining)
	/* 苏联陆军应被移除 */
	const su = Object.keys(g.location).filter(p =>
		g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army' && g.location[p] === EASTEU)
	ok(su.length === 0, '东欧的苏联陆军已被移除', su)
})()

/* ---------- ⑤ 结束预算：付代价（损耗1）+ 卡进弃牌堆 ---------- */
;(() => {
	console.log('[⑤ event_finish · 已发动]')
	const g = fresh(true)
	I.offer_armed_effects(g, 'after_deploy_air', { space: GERMANY, nation: '德国' })
	R.action(g, 'Axis', 'use_armed_offer', { card: AIR_CARD })
	const inits = I.battle_initiators(g, '德国', EASTEU)
	R.action(g, 'Axis', 'event_battle', { target: EASTEU, from: inits[0].id })
	const deckBefore = deckLen(g)
	const discBefore = (g.discard['德国'] || []).length
	R.action(g, 'Axis', 'event_finish', {})
	ok((g.hands['德国'] || []).indexOf(AIR_CARD) < 0, '卡已离手')
	ok((g.discard['德国'] || []).indexOf(AIR_CARD) >= 0, '卡进入弃牌堆')
	/*
	 * 损耗 1 张 = 牌堆顶 1 张直接进弃牌堆（deck-1、discard+1）；
	 * 本卡也从手牌进弃牌堆（discard 再 +1），手牌不在计数里。
	 */
	ok(deckLen(g) === deckBefore - 1, '牌堆 -1（损耗 1 张）',
		{ before: deckBefore, after: deckLen(g) })
	ok((g.discard['德国'] || []).length === discBefore + 2, '弃牌堆 +2（损耗的牌 + 本卡）',
		{ before: discBefore, after: (g.discard['德国'] || []).length })
	ok(!g.event_budget, '预算已清空')
})()

/* ---------- ⑥ 一场都没打就结束：卡留手牌、不付代价 ---------- */
;(() => {
	console.log('[⑥ event_finish · 未发动]')
	const g = fresh(true)
	I.offer_armed_effects(g, 'after_deploy_air', { space: GERMANY, nation: '德国' })
	R.action(g, 'Axis', 'use_armed_offer', { card: AIR_CARD })
	const discBefore = (g.discard['德国'] || []).length
	R.action(g, 'Axis', 'event_finish', {})
	ok((g.hands['德国'] || []).indexOf(AIR_CARD) >= 0, '卡仍在手牌（未发动 = 不消耗）')
	ok((g.discard['德国'] || []).length === discBefore, '未付代价（弃牌堆无新增）',
		g.discard['德国'])
	ok(!g.event_budget, '预算已清空')
})()

/* ---------- ⑦ 空打：相邻陆地无敌军也可作为候选 ---------- */
;(() => {
	console.log('[⑦ 空打候选]')
	const g = fresh(false)   /* 东欧没有苏军 */
	I.offer_armed_effects(g, 'after_deploy_air', { space: GERMANY, nation: '德国' })
	ok(!!g.armed_offer, '仍给窗口（可空打）')
	R.action(g, 'Axis', 'use_armed_offer', { card: AIR_CARD })
	const v = R.view(g, 'Axis')
	const tg = (v.event_budget && v.event_budget.targets) || []
	ok(tg.indexOf(EASTEU) >= 0, '空地(东欧无守军)仍在候选内 —— 允许空打', tg)
})()

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
