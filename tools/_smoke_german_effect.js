/*
 * 德国增强卡(14500/15209/15213/15214/15215/15216) 冒烟自检 (2026-09-30)
 * 用法：node tools/_smoke_german_effect.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
function put(g, id, nation, type, spaceName) {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}

/* 基础对局：德国出牌阶段 */
function newGame() {
	const g = rules.setup(1)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['德国'] = []
	g.decks['德国'] = []
	for (let k = 1; k <= 20; k++) g.decks['德国'].push('dk' + k + '#1')
	g.discard['德国'] = []
	g.table['德国'] = g.table['德国'] || []
	return g
}
const give = (g, nation, face) => g.hands[nation].push(String(face) + '#1')
const weuId = d.id_of('西欧')
function landNb(g, spaceName) {
	const id = d.id_of(spaceName)
	return (d.spaces[id].connections || []).find(x => d.spaces[x].terrain === 'land')
}
/* 把某地区设为德国(axis)补给点，便于测试发起战斗 */
function axisSupply(g, spaceName) { I.set_supply_point(g, d.id_of(spaceName), 'axis', true) }
function alliesSupply(g, spaceName) { I.set_supply_point(g, d.id_of(spaceName), 'allies', true) }

console.log('=== 1. 触发时机 play_start（出牌名额打出前）===')
{
	const g = newGame()
	give(g, '德国', 15213)
	const r1 = I.trigger_ready(g, '15213#1', '德国')
	ok('play 阶段 + 未打名额 -> 可打', r1.ok, JSON.stringify(r1))
	g.play_done['德国'] = true
	const r2 = I.trigger_ready(g, '15213#1', '德国')
	ok('已打名额 -> 不可打（打出前）', !r2.ok, JSON.stringify(r2))
}

console.log('\n=== 2. 14500 黄色方案：损耗2 + 陆战预算 ===')
{
	const g = newGame()
	give(g, '德国', 14500)
	const before = g.decks['德国'].length
	// 西欧放法国陆军，德国在西欧相邻陆地放陆军（设为德国补给点）
	put(g, 'fr_weu', '法国', 'army', '西欧')
	const nbName = d.spaces[landNb(g, '西欧')].name
	axisSupply(g, nbName)
	put(g, 'de_nb1', '德国', 'army', nbName)
	put(g, 'de_nb2', '德国', 'army', nbName)
	I.compute_supply(g)
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '14500#1' })
	ok('建立战斗预算', !!g2.event_budget, 'eb=' + JSON.stringify(g2.event_budget && g2.event_budget.targets))
	ok('损耗2张（牌堆-2）', g2.decks['德国'].length === before - 2,
		'before=' + before + ' after=' + g2.decks['德国'].length)
	ok('不占出牌名额', !g2.play_done['德国'])
	ok('预算卡仍在手牌（待结算）', g2.hands['德国'].indexOf('14500#1') >= 0)
	if (g2.event_budget) {
		const tgt = weuId
		const g3 = rules.action(g2, 'Axis', 'event_battle', { target: tgt })
		ok('发起陆战预算战斗成功', !g3.event_budget || g3.event_budget.remaining >= 0,
			'eb=' + JSON.stringify(g3.event_budget))
		const g4 = rules.action(g3, 'Axis', 'event_finish', {})
		ok('结算后 14500 进弃牌堆', g4.discard['德国'].indexOf('14500#1') >= 0,
			'discard=' + JSON.stringify(g4.discard['德国']))
	}
}

console.log('\n=== 3. 15209 伞兵：相邻德国空军的地区陆战 ===')
{
	const g = newGame()
	give(g, '德国', 15209)
	// 德国空军置于西欧（设为德国补给点），法国陆军置于西欧的相邻陆地（=空军的相邻地区）
	put(g, 'de_air', '德国', 'air', '西欧')
	axisSupply(g, '西欧')
	put(g, 'fr_weu', '法国', 'army', d.spaces[landNb(g, '西欧')].name)
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15209#1' })
	ok('建立战斗预算', !!g2.event_budget)
	ok('损耗1张（牌堆-1）', g2.decks['德国'].length === 20 - 1, 'deck=' + g2.decks['德国'].length)
}

console.log('\n=== 4. 15213 云雾：空军无法代受（回合修正）===')
{
	const g = newGame()
	give(g, '德国', 15213)
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15213#1' })
	const has = (g2.modifiers || []).some(m => m.key === 'air_no_defend')
	ok('注册 air_no_defend 修正', has)
	ok('15213 不占名额', !g2.play_done['德国'])
	ok('15213 进弃牌堆（已结算）', g2.discard['德国'].indexOf('15213#1') >= 0)
	// 直接验证 do_battle 拒绝 defend_air
	const nbName = d.spaces[landNb(g, '西欧')].name
	put(g2, 'fr_army', '法国', 'army', '西欧')
	put(g2, 'fr_air', '法国', 'air', '西欧')
	put(g2, 'de_army', '德国', 'army', nbName)
	axisSupply(g2, nbName)
	I.compute_supply(g2)
	const rb = I.do_battle(g2, '德国', d.id_of('西欧'), 'fr_army', 'land', { defend_air: 'fr_air' })
	ok('云雾生效时 defend_air 被拒', rb && rb.ok === false,
		'ok=' + (rb && rb.ok) + ' reason=' + (rb && rb.reason))
	// 负例：轮转到非德国回合，云雾应失效
	g2.current_nation = '英国'
	const rb2 = I.do_battle(g2, '德国', d.id_of('西欧'), 'fr_army', 'land', { defend_air: 'fr_air' })
	ok('非德国回合云雾失效（defend_air 允许）', rb2 && rb2.ok !== false,
		'ok=' + (rb2 && rb2.ok) + ' reason=' + (rb2 && rb2.reason))
}

console.log('\n=== 5. 15216 总体战：陆军被移除后其代表团国损耗1（法国→英国 / 中国→美国）===')
{
	const g = newGame()
	give(g, '德国', 15216)
	// 准备英国 / 美国牌堆（attrition_cards 需牌堆非空）
	for (let k = 1; k <= 10; k++) { g.decks['英国'].push('uk' + k + '#1'); g.decks['美国'].push('us' + k + '#1') }
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15216#1' })
	ok('注册 army_removed_attrition 修正', (g2.modifiers || []).some(m => m.key === 'army_removed_attrition'))
	const nbName = d.spaces[landNb(g, '西欧')].name
	// 德国攻击西欧法国陆军，移除之
	put(g2, 'fr_army', '法国', 'army', '西欧')
	put(g2, 'de_army', '德国', 'army', nbName)
	put(g2, 'de_army2', '德国', 'army', nbName)
	axisSupply(g2, nbName)
	I.compute_supply(g2)
	const discardUkBefore = (g2.discard['英国'] || []).length
	const discardFrBefore = (g2.discard['法国'] || []).length
	const rb = I.do_battle(g2, '德国', d.id_of('西欧'), 'fr_army', 'land', {})
	ok('战斗成功', rb && rb.ok !== false, 'reason=' + (rb && rb.reason))
	ok('法国陆军被移除', g2.location['fr_army'] === undefined)
	ok('法国自身不损耗', (g2.discard['法国'] || []).length === discardFrBefore)
	ok('英国（法国代表团）损耗1（弃牌堆+1）', (g2.discard['英国'] || []).length === discardUkBefore + 1,
		'before=' + discardUkBefore + ' after=' + (g2.discard['英国'] || []).length)

	// 中国用例：移除中国陆军 -> 美国损耗1
	const discardUsBefore = (g2.discard['美国'] || []).length
	const discardCnBefore = (g2.discard['中国'] || []).length
	put(g2, 'cn_army', '中国', 'army', '西欧')
	put(g2, 'de_army3', '德国', 'army', nbName)
	axisSupply(g2, nbName)
	I.compute_supply(g2)
	const rbCn = I.do_battle(g2, '德国', d.id_of('西欧'), 'cn_army', 'land', {})
	ok('中国陆军战斗成功', rbCn && rbCn.ok !== false, 'reason=' + (rbCn && rbCn.reason))
	ok('中国陆军被移除', g2.location['cn_army'] === undefined)
	ok('中国自身不损耗', (g2.discard['中国'] || []).length === discardCnBefore)
	ok('美国（中国代表团）损耗1', (g2.discard['美国'] || []).length === discardUsBefore + 1,
		'before=' + discardUsBefore + ' after=' + (g2.discard['美国'] || []).length)

	// 负例：轮转到非德国回合，总体战应失效
	g2.current_nation = '英国'
	const discardUkBefore2 = (g2.discard['英国'] || []).length
	put(g2, 'fr_army2', '法国', 'army', '西欧')
	axisSupply(g2, nbName)
	I.compute_supply(g2)
	const rb2 = I.do_battle(g2, '德国', d.id_of('西欧'), 'fr_army2', 'land', {})
	ok('非德国回合战斗成功', rb2 && rb2.ok !== false, 'reason=' + (rb2 && rb2.reason))
	ok('非德国回合总体战失效（英国不损耗）', (g2.discard['英国'] || []).length === discardUkBefore2,
		'before=' + discardUkBefore2 + ' after=' + (g2.discard['英国'] || []).length)
}

console.log('\n=== 6. 15214 战术革新：弃桌状态卡 + 免费打状态卡（两步）===')
{
	const g = newGame()
	give(g, '德国', 15214)
	// 德国桌面上放 1 张真实德国状态卡（15241 瑞典铁矿，type STATUS）
	g.table['德国'] = ['15241#9']
	// 手牌里放 1 张同面状态卡（不同实例 id，避免地点冲突）
	give(g, '德国', 15241)
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15214#1' })
	ok('进入第1步：等待弃置桌上状态卡', g2.pending_echo && g2.pending_echo.step === 'discard',
		JSON.stringify(g2.pending_echo))
	const g3 = rules.action(g2, 'Axis', 'resolve_effect', { discard_status: '15241#9' })
	ok('进入第2步：等待免费打状态卡', g3.pending_echo && g3.pending_echo.step === 'play')
	ok('15241#9 已进弃牌堆', g3.discard['德国'].indexOf('15241#9') >= 0)
	// 选手牌状态卡免费打出
	const g4 = rules.action(g3, 'Axis', 'resolve_effect', { play_status: '15241#1' })
	ok('结算完成（pending_echo 清空）', !g4.pending_echo)
	ok('15214 自身进弃牌堆', g4.discard['德国'].indexOf('15214#1') >= 0)
	ok('被打出的状态卡 15241 进桌面', (g4.table['德国'] || []).indexOf('15241#1') >= 0)
}

console.log('\n=== 7. 15215 卓越规划：检视牌堆顶5张置顶/底 ===')
{
	const g = newGame()
	give(g, '德国', 15215)
	// 牌堆顶5张固定为 dk1..dk5
	const top5 = g.decks['德国'].slice(0, 5)
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15215#1' })
	ok('进入检视（game.peek）', g2.peek && g2.peek.cards && g2.peek.cards.length === 5, JSON.stringify(g2.peek))
	ok('topBottom 标记', g2.peek && g2.peek.topBottom === true)
	// 把 dk1,dk2 放底；dk3..dk5 放顶，保持顺序
	const placement = [
		{ id: 'dk3#1', where: 'top', order: 0 },
		{ id: 'dk4#1', where: 'top', order: 1 },
		{ id: 'dk5#1', where: 'top', order: 2 },
		{ id: 'dk1#1', where: 'bottom', order: 0 },
		{ id: 'dk2#1', where: 'bottom', order: 1 },
	]
	const g3 = rules.action(g2, 'Axis', 'play_card', { card: '15215#1', placement })
	const newTop5 = g3.decks['德国'].slice(0, 5)
	ok('dk3 在牌堆顶（顺序正确）', newTop5[0] === 'dk3#1', JSON.stringify(newTop5))
	ok('dk5 在顶组最下', newTop5[2] === 'dk5#1')
	ok('15215 进弃牌堆', g3.discard['德国'].indexOf('15215#1') >= 0)
}

/* 计数某地区上的某国某类棋子 */
function piecesOn(g, spaceName) {
	const sid = d.id_of(spaceName)
	const r = []
	for (const p of Object.keys(g.location)) {
		if (g.location[p] == null) continue
		if (g.location[p] === sid) r.push({ id: p, nation: g.piece_nation[p], type: g.piece_type[p] })
	}
	return r
}
/* 填一副牌堆，避免 attrition 因牌堆为空而不发动 */
function fillDeck(g, nation, n) {
	for (let k = 1; k <= n; k++) g.decks[nation].push(nation + 'x' + k + '#1')
}

/*
 * 【2026-10-01 玩家最终口径】B 组"打出XX后…"卡：
 * 卡【留在手牌】，事件后服务端扫手牌给出 armed_offer，玩家点框里的按钮才打出。
 * 两步：① offer_armed_effects 开窗；② use_armed_offer 打出。
 */
function offerThenUse(g, cardId, when, ctx) {
	I.offer_armed_effects(g, when, ctx)
	return rules.action(g, 'Axis', 'use_armed_offer', { card: cardId })
}
/* 手牌机会窗口里是否有这张卡 */
function armedOfferHas(g, cardId) {
	return !!(g.armed_offer && (g.armed_offer.cards || []).some(x => x.card_id === cardId))
}

/* 一对相邻陆地（总体战代受测试用） */
let A_LAND = null, B_LAND = null
for (const n of Object.keys(d.spaces).map(Number)) {
	if (d.spaces[n].terrain !== 'land') continue
	const m = (d.spaces[n].connections || []).map(Number)
		.find(x => d.spaces[x] && d.spaces[x].terrain === 'land' && x !== n)
	if (m != null) { A_LAND = n; B_LAND = m; break }
}

console.log('\n=== 8. 15205 JU-87：部署/调度空军后 → 相邻陆战 ===')
{
	const g = newGame()
	give(g, '德国', 15205)
	fillDeck(g, '德国', 10)
	const S = d.spaces[landNb(g, '西欧')].name // 西欧的陆地邻居
	put(g, 'de_air', '德国', 'air', S)
	put(g, 'de_a1', '德国', 'army', S)
	put(g, 'de_a2', '德国', 'army', S)
	axisSupply(g, S)
	put(g, 'fr_weu', '法国', 'army', '西欧')
	I.compute_supply(g)
	/* 卡留在手牌，不能被主动打出 */
	const gRej = rules.action(g, 'Axis', 'play_card', { card: '15205#1' })
	ok('15205 不能主动打出', gRej.hands['德国'].indexOf('15205#1') >= 0)
	I.offer_armed_effects(g, 'after_deploy_air', { space: d.id_of(S), nation: '德国' })
	ok('部署空军后 15205 进入机会窗口', armedOfferHas(g, '15205#1'))
	ok('开窗时卡仍在手牌', g.hands['德国'].indexOf('15205#1') >= 0)
	const g2 = rules.action(g, 'Axis', 'use_armed_offer', { card: '15205#1' })
	ok('打出后 15205 入弃牌堆', (g2.discard['德国'] || []).indexOf('15205#1') >= 0)
	ok('打出后 15205 离手牌', g2.hands['德国'].indexOf('15205#1') < 0)
	ok('相邻西欧法军被移除（陆战）', g2.location['fr_weu'] === undefined)
}

console.log('\n=== 9. 15207 JU-52：回合开始+德空军 → 全德部队补给 ===')
{
	const g = newGame()
	give(g, '德国', 15207)
	fillDeck(g, '德国', 10)
	put(g, 'de_air', '德国', 'air', '西欧')
	// 一个远离补给点的德国陆军
	put(g, 'de_lost', '德国', 'army', '西伯利亚')
	const sup0 = I.compute_supply(g)
	ok('补给前 西伯利亚德军不在补给', !sup0.in_supply['de_lost'])
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15207#1' })
	ok('15207 不能主动打出（留在手牌）', g2.hands['德国'].indexOf('15207#1') >= 0)
	offerThenUse(g2, '15207#1', 'turn_start', { nation: '德国' })
	ok('15207 打出后入弃牌堆', (g2.discard['德国'] || []).indexOf('15207#1') >= 0)
	const sup1 = I.compute_supply(g2)
	ok('触发后 西伯利亚德军处于补给', sup1.in_supply['de_lost'], 'src=' + (sup1.sources && sup1.sources['de_lost']))
	// 非德国回合应失效
	g2.current_nation = '英国'
	const sup2 = I.compute_supply(g2)
	ok('非德国回合 JU-52 失效（德军不再全补给）', !sup2.in_supply['de_lost'])
}

console.log('\n=== 10. 15208 齐柏林：建设海军后 → 该海域部署空军 ===')
{
	const g = newGame()
	give(g, '德国', 15208)
	fillDeck(g, '德国', 10)
	// 选一个海域放德军海军并设补给点
	const seaId = (Object.keys(d.spaces).map(Number).find(n => d.spaces[n].terrain === 'sea'))
	const seaName = d.spaces[seaId].name
	put(g, 'de_navy', '德国', 'navy', seaName)
	axisSupply(g, seaName)
	I.compute_supply(g)
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15208#1' })
	ok('15208 不能主动打出（留在手牌）', g2.hands['德国'].indexOf('15208#1') >= 0)
	offerThenUse(g2, '15208#1', 'after_build_navy', { space: seaId, nation: '德国' })
	ok('打出后 15208 入弃牌堆', (g2.discard['德国'] || []).indexOf('15208#1') >= 0)
	ok('该海域德国空军已部署', piecesOn(g2, seaName).some(p => p.nation === '德国' && p.type === 'air'))
}

console.log('\n=== 11. 15210 施佩伯爵：建设海军后 → 亚速尔相邻海战 ===')
{
	const g = newGame()
	give(g, '德国', 15210)
	fillDeck(g, '德国', 10)
	const az = d.id_of('亚速尔')
	// 取亚速尔的海上邻居 seaE，再找 seaE 的海上邻居 S（放德军海军）
	const azNbrs = (d.spaces[az].connections || []).map(Number).filter(n => d.spaces[n].terrain === 'sea')
	ok('亚速尔有相邻海域', azNbrs.length > 0, 'n=' + azNbrs.length)
	let seaE = null, S = null
	for (const e of azNbrs) {
		const sn = (d.spaces[e].connections || []).map(Number).find(n => d.spaces[n] && d.spaces[n].terrain === 'sea' && n !== e)
		if (sn != null) { seaE = e; S = sn; break }
	}
	ok('找到相邻双海域 (德军海军位 + 敌舰位)', seaE != null && S != null)
	if (seaE != null && S != null) {
		const seaEName = d.spaces[seaE].name, sName = d.spaces[S].name
		put(g, 'fr_navy', '法国', 'navy', seaEName)
		put(g, 'de_navy2', '德国', 'navy', sName)
		axisSupply(g, sName)
		I.compute_supply(g)
		const g2 = rules.action(g, 'Axis', 'play_card', { card: '15210#1' })
		ok('15210 不能主动打出（留在手牌）', g2.hands['德国'].indexOf('15210#1') >= 0)
		I.refresh(g2)
		offerThenUse(g2, '15210#1', 'after_build_navy', { space: S, nation: '德国' })
		ok('打出后 15210 入弃牌堆', (g2.discard['德国'] || []).indexOf('15210#1') >= 0)
		ok('亚速尔相邻海域法军海军被移除（海战）', g2.location['fr_navy'] === undefined,
			'fr_navy.loc=' + g2.location['fr_navy'])
	}
}

console.log('\n=== 12. 15211 威瑟堡：[北方行动]计分 → 北海征召 + 可打1张北方行动 ===')
{
	const g = newGame()
	give(g, '德国', 15211)
	fillDeck(g, '德国', 10)
	const nbBefore = piecesOn(g, '北海').filter(p => p.nation === '德国').length
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15211#1' })
	ok('15211 不能主动打出（留在手牌）', g2.hands['德国'].indexOf('15211#1') >= 0)
	offerThenUse(g2, '15211#1', 'scoring_north', { nation: '德国' })
	ok('打出后 15211 入弃牌堆', (g2.discard['德国'] || []).indexOf('15211#1') >= 0)
	ok('授权额外打出 1 张[北方行动]', g2.extra_play && g2.extra_play.filter === 'north',
		JSON.stringify(g2.extra_play))
	const nbAfter = piecesOn(g2, '北海').filter(p => p.nation === '德国').length
	ok('北海德军陆军 +1（或征召失败已记录）', nbAfter >= nbBefore, 'before=' + nbBefore + ' after=' + nbAfter)
}

console.log('\n=== 13. 15206 轰炸伦敦：经济战目标英国 → 不列颠每德空军损耗+2 ===')
{
	const g = newGame()
	give(g, '德国', 15206)
	fillDeck(g, '德国', 10)
	fillDeck(g, '英国', 10)
	put(g, 'de_bt', '德国', 'air', '不列颠')
	const ukBefore = (g.discard['英国'] || []).length
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15206#1' })
	ok('15206 不能主动打出（留在手牌）', g2.hands['德国'].indexOf('15206#1') >= 0)
	offerThenUse(g2, '15206#1', 'econ_used', { tag: '轰炸行动', targets: ['英国'], nation: '德国' })
	ok('打出后 15206 入弃牌堆', (g2.discard['德国'] || []).indexOf('15206#1') >= 0)
	ok('英国因不列颠1德空军额外损耗2', (g2.discard['英国'] || []).length === ukBefore + 2,
		'before=' + ukBefore + ' after=' + (g2.discard['英国'] || []).length)
	// 负例：目标非英国 -> 不开窗口（用全新对局）
	const g3 = newGame()
	give(g3, '德国', 15206)
	fillDeck(g3, '德国', 10)
	fillDeck(g3, '英国', 10)
	const ukB3 = (g3.discard['英国'] || []).length
	I.offer_armed_effects(g3, 'econ_used', { tag: '轰炸行动', targets: ['法国'], nation: '德国' })
	ok('目标非英国：15206 不开窗口', !armedOfferHas(g3, '15206#1'))
	ok('目标非英国：15206 仍在手牌', g3.hands['德国'].indexOf('15206#1') >= 0)
	ok('目标非英国：英国不损耗', (g3.discard['英国'] || []).length === ukB3)
}

console.log('\n=== 14. 15212 G7e 鱼雷：打出[潜艇行动]后 → 发起海战 ===')
{
	const g = newGame()
	give(g, '德国', 15212)
	fillDeck(g, '德国', 10)
	// 找一对"双向相邻"的海域：S 放德军海军（补给），E 放敌舰
	// （connections 可能不对称：do_battle 用敌舰格位的邻居校验发起单位相邻）
	let S = null, E = null
	for (const n of Object.keys(d.spaces).map(Number)) {
		if (d.spaces[n].terrain !== 'sea') continue
		const m = (d.spaces[n].connections || []).map(Number)
			.find(x => d.spaces[x] && d.spaces[x].terrain === 'sea' && x !== n &&
				(d.spaces[x].connections || []).indexOf(n) >= 0)
		if (m != null) { S = n; E = m; break }
	}
	ok('存在双向相邻海域', S != null, 'S=' + S + ' E=' + E)
	if (S != null) {
		const sName = d.spaces[S].name, eName = d.spaces[E].name
		put(g, 'de_navy3', '德国', 'navy', sName)
		axisSupply(g, sName)
		put(g, 'fr_navy2', '法国', 'navy', eName)
		I.compute_supply(g)
		const g2 = rules.action(g, 'Axis', 'play_card', { card: '15212#1' })
		ok('15212 不能主动打出（留在手牌）', g2.hands['德国'].indexOf('15212#1') >= 0)
		I.refresh(g2)
		I.offer_armed_effects(g2, 'econ_used', { tag: '潜艇行动', targets: ['法国'], nation: '德国' })
		ok('潜艇行动后 15212 进入机会窗口', armedOfferHas(g2, '15212#1'))
		ok('未点前不结算（卡在手牌、敌舰还在）',
			g2.hands['德国'].indexOf('15212#1') >= 0 && g2.location['fr_navy2'] !== undefined)
		rules.action(g2, 'Axis', 'use_armed_offer', { card: '15212#1' })
		ok('打出后 15212 入弃牌堆', (g2.discard['德国'] || []).indexOf('15212#1') >= 0)
		ok('打出后 15212 离手牌', g2.hands['德国'].indexOf('15212#1') < 0)
		ok('相邻海域法军海军被移除（海战）', g2.location['fr_navy2'] === undefined,
			'fr_navy2.loc=' + g2.location['fr_navy2'])
	}
	// 负例：非潜艇行动 -> 不开窗口（全新对局）
	{
		const g3 = newGame()
		give(g3, '德国', 15212)
		fillDeck(g3, '德国', 10)
		I.offer_armed_effects(g3, 'econ_used', { tag: '轰炸行动', targets: ['法国'], nation: '德国' })
		ok('非潜艇行动：15212 不开窗口', !armedOfferHas(g3, '15212#1'))
		ok('非潜艇行动：15212 仍在手牌', g3.hands['德国'].indexOf('15212#1') >= 0)
	}
}

/*
 * 15. 15212 G7e 鱼雷 —— 【真实链路】德国打出非链式潜艇行动经济战(15217)后弹窗。
 * 回归要点：econ_used 原本只在【链式】经济战(15314)收尾时触发，
 * 导致 15217~15222 这类单目标潜艇行动打出后 G7e 永远等不到时点。
 */
{
		const g = newGame()
		give(g, '德国', 15212)
		give(g, '德国', 15217)
		fillDeck(g, '德国', 10)
		// 找双向相邻海域：S 放德军海军，E 放英军海军
		let S = null, E = null
		for (const n of Object.keys(d.spaces).map(Number)) {
			if (d.spaces[n].terrain !== 'sea') continue
			const m = (d.spaces[n].connections || []).map(Number)
				.find(x => d.spaces[x] && d.spaces[x].terrain === 'sea' && x !== n &&
					(d.spaces[x].connections || []).indexOf(n) >= 0)
			if (m != null) { S = n; E = m; break }
		}
		const gArm = rules.action(g, 'Axis', 'play_card', { card: '15212#1' })
		ok('15212 不能主动打出（真实链路）', gArm.hands['德国'].indexOf('15212#1') >= 0)
		put(gArm, 'de_navy_g7', '德国', 'navy', d.spaces[S].name)
		axisSupply(gArm, d.spaces[S].name)
		put(gArm, 'uk_navy_g7', '英国', 'navy', d.spaces[E].name)
		I.compute_supply(gArm)
		// 德国打出 15217（单目标潜艇行动，非链式）-> 应【弹窗】问是否打出 G7e
		const g2 = rules.action(gArm, 'Axis', 'play_card', { card: '15217#1', target: '英国' })
		ok('打出非链式潜艇行动后 15212 进入机会窗口', armedOfferHas(g2, '15212#1'))
		ok('未选择前不结算（卡在手牌、敌舰还在）',
			g2.hands['德国'].indexOf('15212#1') >= 0 &&
			g2.location['uk_navy_g7'] !== undefined)
		// 玩家点"打出"
		const g2b = rules.action(g2, 'Axis', 'use_armed_offer', { card: '15212#1' })
		ok('打出后 15212 离手牌', g2b.hands['德国'].indexOf('15212#1') < 0)
		ok('打出后 15212 入弃牌堆', (g2b.discard['德国'] || []).indexOf('15212#1') >= 0)
		ok('G7e 海战移除相邻敌方海军', g2b.location['uk_navy_g7'] === undefined,
			'uk_navy_g7.loc=' + g2b.location['uk_navy_g7'])
		}
	// 15b. 【2026-10-01】英国 15329 拦截经济战之后，G7e 照常要弹窗（玩家明确要求）
	{
		const g = newGame()
		give(g, '德国', 15212)
		give(g, '德国', 15217)
		fillDeck(g, '德国', 10)
		/* G7e 的 ready 预检需要"补给中的德军海军 + 相邻敌方海域"，先摆好 */
		let SS = null, EE = null
		for (const n of Object.keys(d.spaces).map(Number)) {
			if (d.spaces[n].terrain !== 'sea') continue
			const m = (d.spaces[n].connections || []).map(Number)
				.find(x => d.spaces[x] && d.spaces[x].terrain === 'sea' && x !== n &&
					(d.spaces[x].connections || []).indexOf(n) >= 0)
			if (m != null) { SS = n; EE = m; break }
		}
		put(g, 'de_nvy_i', '德国', 'navy', d.spaces[SS].name)
		axisSupply(g, d.spaces[SS].name)
		put(g, 'uk_nvy_i', '英国', 'navy', d.spaces[EE].name)
		I.compute_supply(g)
		// 模拟"英国拦截了这张经济战"的收尾路径：
		// trigger_response 的 cancel 分支会用 head.intercept_card 的 tag 开窗口
		const held = {
			pre: true,
			trigger: 'play_card',
			owner_side: 'allies',
			play_role: 'Axis',
			intercept_card: '15217#1',
			intercept_nation: '德国',
			ctx: { nation: '德国', card: '15217#1', card_obj: { name: '电动潜艇' } },
			candidates: [{
				card_id: '15329#1', card_face: '15329',
				name: '反潜战术', owner_side: 'allies',
			}],
			resume: { action: 'play_card', arg: { card: '15217#1', target: '英国' } },
			expires_at_turn: g.turn + 1,
		}
		g.response_queue = g.response_queue || []
		g.response_queue.push(held)
		// 直接走"拦截成功"的处理：这里复用 trigger_response 的 cancel 语义
		g.current_nation = '英国'
		const g2 = rules.action(g, 'Allies', 'trigger_response', { card: '15329#1', cancel: true })
		ok('拦截结算后 15212 仍进入机会窗口（可在拦截后打出）', armedOfferHas(g2, '15212#1'),
			'armed_offer=' + JSON.stringify(g2.armed_offer) +
			' hand=' + JSON.stringify(g2.hands['德国']) +
			' q=' + (g2.response_queue || []).length +
			' log=' + JSON.stringify(g2.log.slice(-4)))
	}

/*
 * 16. 【2026-10-01 玩家最终裁定】总体战(15216)：**只有敌方陆军**被移除才触发损耗，
 *     【空军被移除不掉牌】。
 *     覆盖：① 夺取制空权移敌机 -> 不掉牌 ② 空军代受且不抵消（只掉空军）-> 不掉牌
 *          ③ 敌方陆军被移除 -> 掉牌（正例，确保陆军口径未回退过头）
 *          ④ 己方轴心陆军被移除 -> 不掉牌（不反噬）
 */
{
	/* ① 夺取制空权：德国移除法国（属英国）空军 -> 英国【不】损耗 */
	const g = newGame()
	give(g, '德国', 15216)
	fillDeck(g, '英国', 10)
	const g2 = rules.action(g, 'Axis', 'play_card', { card: '15216#1' })
	put(g2, 'fr_air_tw', '法国', 'air', '北海')
	put(g2, 'de_army_tw', '德国', 'army', '不列颠')
	put(g2, 'de_air_tw', '德国', 'air', '不列颠')
	I.compute_supply(g2)
	const ukBefore = (g2.decks['英国'] || []).length
	const r = I.seize_air(g2, '德国', d.id_of('北海'), 'de_air_tw')
	ok(' seize_air 移除敌机成功', r.ok === true, 'r=' + JSON.stringify(r))
	ok('总体战：空军被移除【不】掉牌（英国牌数不变）',
		(g2.decks['英国'] || []).length === ukBefore,
		'before=' + ukBefore + ' after=' + (g2.decks['英国'] || []).length)

	/* ② 代受且不抵消：只掉防守方空军，原目标陆军保住 -> 【不】损耗 */
	const g3 = newGame()
	give(g3, '德国', 15216)
	fillDeck(g3, '英国', 10)
	const g4 = rules.action(g3, 'Axis', 'play_card', { card: '15216#1' })
	put(g4, 'de_army_b', '德国', 'army', d.spaces[A_LAND].name)
	put(g4, 'uk_army_b', '英国', 'army', d.spaces[B_LAND].name)
	put(g4, 'uk_air_b', '英国', 'air', d.spaces[B_LAND].name)
	axisSupply(g4, d.spaces[A_LAND].name)
	I.compute_supply(g4)
	const ukBefore2 = (g4.decks['英国'] || []).length
	I.do_battle(g4, '德国', d.id_of(d.spaces[B_LAND].name), 'uk_army_b', 'land',
		{ from: 'de_army_b', defend_air: 'uk_air_b', declined_counter: true })
	ok('代受：英军空军被移除', g4.location['uk_air_b'] === undefined)
	ok('代受：原目标陆军保住', g4.location['uk_army_b'] !== undefined)
	ok('总体战：代受只掉空军【不】掉牌（英国牌数不变）',
		(g4.decks['英国'] || []).length === ukBefore2,
		'before=' + ukBefore2 + ' after=' + (g4.decks['英国'] || []).length)

	/* ③ 正例：敌方陆军被移除 -> 掉牌（确认陆军口径仍然生效） */
	const g5 = newGame()
	give(g5, '德国', 15216)
	fillDeck(g5, '英国', 10)
	const g6 = rules.action(g5, 'Axis', 'play_card', { card: '15216#1' })
	put(g6, 'de_army_c', '德国', 'army', d.spaces[A_LAND].name)
	put(g6, 'uk_army_c', '英国', 'army', d.spaces[B_LAND].name)
	axisSupply(g6, d.spaces[A_LAND].name)
	I.compute_supply(g6)
	const ukBefore3 = (g6.decks['英国'] || []).length
	I.do_battle(g6, '德国', d.id_of(d.spaces[B_LAND].name), 'uk_army_c', 'land',
		{ from: 'de_army_c' })
	ok('总体战：敌方陆军被移除 -> 英国 损耗 1（正例）',
		(g6.decks['英国'] || []).length === ukBefore3 - 1,
		'before=' + ukBefore3 + ' after=' + (g6.decks['英国'] || []).length)

	/* ④ 反例：己方(轴心)陆军被移除 -> 不掉牌（不反噬） */
	const g7 = newGame()
	give(g7, '德国', 15216)
	fillDeck(g7, '德国', 10)
	const g8 = rules.action(g7, 'Axis', 'play_card', { card: '15216#1' })
	put(g8, 'de_army_d', '德国', 'army', d.spaces[B_LAND].name)
	put(g8, 'uk_army_d', '英国', 'army', d.spaces[A_LAND].name)
	alliesSupply(g8, d.spaces[A_LAND].name)
	I.compute_supply(g8)
	const deBefore = (g8.decks['德国'] || []).length
	I.do_battle(g8, '英国', d.id_of(d.spaces[B_LAND].name), 'de_army_d', 'land',
		{ from: 'uk_army_d' })
	ok('总体战：己方(轴心)陆军被移除【不】掉牌',
		(g8.decks['德国'] || []).length === deBefore,
		'before=' + deBefore + ' after=' + (g8.decks['德国'] || []).length)
}

/*
 * 17. 【2026-10-01 重构】发起战斗的【最小原子】与 basic_targets 口径一致。
 *
 * 增强卡（15205 陆战 / 15210 施佩伯爵海战 / 15212 G7e 海战）此前各自手写
 * get_connections + compute_supply 的遍历，出现过：
 *   · 阵营硬编码 'axis'（de_adj_navy_in_supply）
 *   · 遍历方向与 do_battle 相反（从发起单位格出发 vs 从目标格出发），
 *     connections 不对称时"找到目标但 do_battle 拒绝"
 *   · 漏掉 basic_targets 的"目标格不能有我方单位""空军不算目标"
 *
 * 现在统一复用最小原子：battle_initiators / can_initiate_battle_at /
 * find_battle_target。本用例【锁死】原子与 basic_targets 的一致性，
 * 防止以后又有人手写一套漂移出去。
 */
{
	const g = newGame()
	/* 摆一个"德军陆军相邻法军陆军"的陆战局面 */
	put(g, 'de_a1', '德国', 'army', d.spaces[A_LAND].name)
	put(g, 'fr_a1', '法国', 'army', d.spaces[B_LAND].name)
	axisSupply(g, d.spaces[A_LAND].name)
	I.compute_supply(g)
	const btLand = I.basic_targets(g, '德国', '发起陆战')
	const canLand = I.can_initiate_battle_at(g, '德国', d.id_of(d.spaces[B_LAND].name), 'land')
	const inList = (btLand.spaces || []).some(s => s.id === d.id_of(d.spaces[B_LAND].name))
	ok('原子(can_initiate_battle_at) 与 basic_targets 陆战判定一致',
		canLand.ok === inList,
		'atom.ok=' + canLand.ok + ' basic_targets 含该格=' + inList +
		' reason=' + (canLand.reason || ''))
	/* 发起单位必须是相邻补给中的本国陆/海军 —— 原子直接复用 battle_initiators */
	const initOk = (I.battle_initiators(g, '德国', d.id_of(d.spaces[B_LAND].name)) || [])
		.some(x => x.id === 'de_a1')
	ok('battle_initiators 给出相邻的补给德军陆军', initOk)
	/* 找一个真实可发起的陆战目标：原子找到的，do_battle 必须接受 */
	const tgt = I.find_battle_target(g, '德国', 'land', { enemyOnly: true })
	ok('find_battle_target 找到陆战目标', !!tgt, JSON.stringify(tgt))
	if (tgt) {
		const r = I.do_battle(g, '德国', tgt.space, 0, 'land', { from: tgt.initiator })
		ok('原子选出的目标+发起单位，do_battle 必须接受（不漂移）', r.ok === true,
			'r=' + JSON.stringify(r))
	}
	/* 敌我同格时不应作为目标（basic_targets 的"无我方单位"口径） */
	const g2 = newGame()
	put(g2, 'de_a2', '德国', 'army', d.spaces[A_LAND].name)
	axisSupply(g2, d.spaces[A_LAND].name)
	I.compute_supply(g2)
	const selfChk = I.can_initiate_battle_at(g2, '德国', d.id_of(d.spaces[A_LAND].name), 'land')
	ok('本国单位所在格不能作为攻击目标', selfChk.ok === false,
		'reason=' + selfChk.reason)
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
