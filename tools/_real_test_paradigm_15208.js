/*
 * 【真实测试范式】用调试动作布阵 + 真实 action 驱动 + 双方 view 断言
 *
 * 测例：德国「建设海军」-> 15208《齐柏林伯爵号》触发 -> 英国 15352 拦截
 *       -> 意大利 16700 反制 15352 -> 15208 触发生效
 *
 * 覆盖本轮改动的三条路径：
 *   ① 批 4：机会卡【触发】时也会开 enemy_echo_played（via='trigger'）
 *   ② 二级拦截：15352 是增强卡，用它的"动作"也会被 16700 反制（via='play'）
 *   ③ 16700 代价已声明式（armed.cost.attrition=1，不再写在 run 里）
 *
 * ── 范式要点（后续所有真实测试照抄） ─────────────────────────────
 *   1) 布阵只用【调试动作】：debug_set_phase（切国家/阶段并清挂起）、
 *      debug_add_card（发牌，指定 face + 国家 + 去向）、debug_place（放部队）。
 *      **不要手改 game.hands/game.location** —— 那样会绕过 card_inst、refresh、
 *      补给与窗口计数，测出来的行为不可信。
 *   2) 驱动只用【真实动作】：play_card / use_armed_offer / skip_armed_offer /
 *      activate_status / resolve_effect / 阶段动作。不直接调用内部函数当"作弊"。
 *   3) 断言分三层：
 *      · 服务端状态（手牌/弃牌堆/牌库/挂起字段）
 *      · 客户端视角（R.view(g,'Allies') / 'Axis' 的 actions、armed_offer、table_status）
 *      · 日志文案（关键分支必须写清"触发/打出/代价照付"）
 *   4) 每个测试必须验证【结算后无残留】：pending_armed_use / armed_offers /
 *      __echo_chain_depth，避免"测过了但留下悬挂状态"。
 *   5) 每步打印日志片段，便于人工核对（真实测试的价值在可读）。
 *
 * 用法：node tools/_real_test_paradigm_15208.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const NM = id => (id == null ? '?' : d.name_of(Number(id)))
const inHand = (g, n, c) => (g.hands[n] || []).indexOf(c) >= 0
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const side = n => (I.faction_of_nation(n) === 'allies' ? 'Allies' : 'Axis')
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

/* ─────────── §1 布阵（只用调试动作） ─────────── */
console.log('\n=== §1 布阵（debug_set_phase / debug_place / debug_add_card）===')
const g = R.setup(7)
g.opening = null
I.refresh(g)

/* 1.1 切到德国出牌阶段（会清空所有挂起，保证起点干净） */
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
ok('已切到德国出牌阶段', g.current_nation === '德国' && g.turn_phase === 'play',
	JSON.stringify({ n: g.current_nation, p: g.turn_phase }))

/* 1.2 放一支德国陆军在<德国>当建设支点（海军要邻接本国陆地部队） */
const DE = d.id_of('德国')
R.action(g, 'Axis', 'debug_place', { piece: 'de_army_1', nation: '德国', type: 'army', space: DE })
ok('德国陆军已放置', g.location['de_army_1'] === DE, JSON.stringify({ loc: g.location['de_army_1'] }))

/* 1.3 发牌：德国 建设海军(15202) + 15208；英国 15352 + 15353；意大利 16700 */
R.action(g, 'Axis', 'debug_add_card', { face: '15202', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15208', nation: '德国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '16700', nation: '意大利', dest: 'hand' })
/* 拦截代价：英国要弃 1 张、意大利要损耗 1 张（牌库要有牌） */
R.action(g, 'Allies', 'debug_add_card', { face: '15341', nation: '英国', dest: 'hand' })
console.log('  德国手牌=' + JSON.stringify(g.hands['德国']))
console.log('  英国手牌=' + JSON.stringify(g.hands['英国']))
console.log('  意大利手牌=' + JSON.stringify(g.hands['意大利']) +
	'  牌库=' + (g.decks['意大利'] || []).length)

const deNavy = (g.hands['德国'] || []).find(x => String(x).indexOf('15202#') === 0)
const deZepp = (g.hands['德国'] || []).find(x => String(x).indexOf('15208#') === 0)
const ukBl = (g.hands['英国'] || []).find(x => String(x).indexOf('15352#') === 0)
const ukCalm = (g.hands['英国'] || []).find(x => String(x).indexOf('15353#') === 0)
const itLion = (g.hands['意大利'] || []).find(x => String(x).indexOf('16700#') === 0)
const ukPay = (g.hands['英国'] || []).find(x => String(x).indexOf('15341#') === 0)
ok('四张关键卡都发到位', !!deNavy && !!deZepp && !!ukBl && !!ukCalm && !!itLion,
	JSON.stringify({ deNavy, deZepp, ukBl, ukCalm, itLion }))

/* ─────────── §2 驱动（真实动作链） ─────────── */
console.log('\n=== §2-A 德国建设海军 -> 触发 after_build_navy 窗口 ===')
const sea = (function () {
	for (let i = 1; i < d.spaces.length; i++) {
		if (!d.spaces[i] || d.spaces[i].terrain !== 'sea') continue
		if (I.can_build_at(g, '德国', i, 'navy').ok) return i
	}
	return null
})()
ok('存在合法建海军海域', !!sea, NM(sea))
let n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: deNavy, space: sea })
console.log('  log: ' + logSince(g, n0))
const winBuild = (g.armed_offers || []).find(w => w.when === 'after_build_navy')
ok('after_build_navy 窗口里有 15208',
	!!(winBuild && (winBuild.cards || []).some(c => c.card_id === deZepp)),
	JSON.stringify(winBuild && winBuild.cards && winBuild.cards.map(c => c.card_id)))

console.log('\n=== §2-B 德国【触发】15208 -> 应变 15352 拦截（via=trigger） ===')
n0 = (g.log || []).length
R.action(g, 'Axis', 'use_armed_offer', { card: deZepp, space: sea })
console.log('  log: ' + logSince(g, n0))
const vUk = R.view(g, 'Allies')
ok('★ 触发时开出了 enemy_echo_played 窗口（英国可见）',
	!!(vUk.armed_offer && vUk.armed_offer.when === 'enemy_echo_played'),
	JSON.stringify(vUk.armed_offer && { when: vUk.armed_offer.when, via: vUk.armed_offer.via }))
ok('★ 窗口来源标记 via=trigger', vUk.armed_offer && vUk.armed_offer.via === 'trigger',
	JSON.stringify(vUk.armed_offer && vUk.armed_offer.via))
ok('窗口候选=15352（15353 不该出现：它监听状态卡）',
	!!(vUk.armed_offer && vUk.armed_offer.cards.some(c => c.card === ukBl)) &&
	!(vUk.armed_offer && vUk.armed_offer.cards.some(c => c.card === ukCalm)),
	JSON.stringify(vUk.armed_offer && vUk.armed_offer.cards.map(c => c.card)))
ok('挂起记录 via=trigger',
	!!g.pending_armed_use && g.pending_armed_use.via === 'trigger',
	JSON.stringify(g.pending_armed_use && { via: g.pending_armed_use.via, card: g.pending_armed_use.card }))

console.log('\n=== §2-C 英国用 15352 拦截 -> 意大利 16700 反制（via=play） ===')
n0 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: ukBl, drop: [ukPay] })
console.log('  log: ' + logSince(g, n0))
const vIt = R.view(g, 'Axis')
ok('★ 15352 的"使用"本身又开出了拦截窗口（给意大利 16700）',
	!!(vIt.armed_offer && vIt.armed_offer.when === 'enemy_echo_played' &&
		vIt.armed_offer.cards.some(c => c.card === itLion)),
	JSON.stringify(vIt.armed_offer && vIt.armed_offer.cards.map(c => c.card)))
ok('二级拦截来源标记 via=play', vIt.armed_offer && vIt.armed_offer.via === 'play',
	JSON.stringify(vIt.armed_offer && vIt.armed_offer.via))

console.log('\n=== §2-D 意大利【反制】16700 -> 15352 作废，15208 触发生效 ===')
const deDeck0 = (g.decks['德国'] || []).length
const itDeck0 = (g.decks['意大利'] || []).length
n0 = (g.log || []).length
R.action(g, 'Axis', 'use_armed_offer', { card: itLion })
console.log('  log: ' + logSince(g, n0))

/* ─────────── §2-E 德国完成 15208 的第二步（选择"部署"） ─────────── */
console.log('\n=== §2-E 德国继续 15208（need:choice -> deploy）===')
const airBefore = Object.keys(g.location).filter(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'air').length
const pend = ((g.armed_offers || [])[0] || {}).pending
ok('15208 停在 need:choice（等待玩家选择）', !!(pend && pend.need === 'choice'),
	JSON.stringify(pend && pend.need))
const opt = (pend && pend.choiceOptions && pend.choiceOptions[0]) || { id: 'deploy' }
n0 = (g.log || []).length
R.action(g, 'Axis', 'use_armed_offer', { card: deZepp, choice: opt.id })
console.log('  log: ' + logSince(g, n0))

/* ─────────── §3 断言 ─────────── */
console.log('\n=== §3 结果断言 ===')
ok('15352 进英国弃牌堆（被反制）', inDisc(g, '英国', ukBl), JSON.stringify(g.discard['英国']))
ok('英国代价照付：额外弃 1 张手牌', inDisc(g, '英国', ukPay), JSON.stringify(g.discard['英国']))
ok('16700 进意大利弃牌堆（已使用）', inDisc(g, '意大利', itLion), JSON.stringify(g.discard['意大利']))
ok('★ 16700 代价照付：意大利损耗 1 张（声明式 cost）',
	(g.decks['意大利'] || []).length === itDeck0 - 1,
	itDeck0 + ' -> ' + (g.decks['意大利'] || []).length)
ok('★ 15208 触发生效：德国代价照付（损耗 1 张）',
	(g.decks['德国'] || []).length === deDeck0 - 1,
	deDeck0 + ' -> ' + (g.decks['德国'] || []).length)
const airAfter = Object.keys(g.location).filter(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'air').length
ok('★ 15208 效果落地：德国空军 +1（在该海域部署）', airAfter === airBefore + 1,
	airBefore + ' -> ' + airAfter)
ok('15353 全程未被误用（仍在美国? 英国手里）', inHand(g, '英国', ukCalm),
	JSON.stringify(g.hands['英国']))
ok('无残留挂起：pending_armed_use', !g.pending_armed_use)
ok('无残留挂起：armed_offers', (g.armed_offers || []).length === 0,
	JSON.stringify((g.armed_offers || []).map(w => w.when)))
ok('拦截链计数归零', !g.__echo_chain_depth || g.__echo_chain_depth === 0,
	String(g.__echo_chain_depth))

/* 客户端视角复核：三方都不该再看到待表态窗口 */
for (const [label, role] of [['英国', 'Allies'], ['意大利', 'Axis'], ['德国', 'Axis']]) {
	const v = R.view(g, role)
	ok('view(' + label + ') 无待表态窗口', !v.armed_offer,
		JSON.stringify(v.armed_offer && v.armed_offer.when))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
