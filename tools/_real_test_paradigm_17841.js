/*
 * 【真实测试范式 · 第 2 组】状态卡侧：15248《合成燃料》发动被 15353 拦，15353 又被 16700 反制
 *
 * 链路（全真实动作）：
 *   ① 德国打出 15248 上桌（STATUS，占名额）→ 重入出牌阶段（清名额）
 *   ② 德国打出【建设陆军】→ after_build_army 武装 15248（status_instant）
 *   ③ 德国 activate_status 15248（代价：损耗 2，S1 已前置）-> 派发 enemy_status_effect 给英国 15353
 *   ④ 英国 use 15353（弃 1）-> 自身是增强卡 -> 意大利 16700 反制（via=trigger）
 *   ⑤ 意大利 use 16700（损耗 1）-> 15353 作废（代价照付）-> 15248 效果照常（相邻建陆军）
 *
 * 用法：node tools/_real_test_paradigm_17841.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const inTable = (g, n, c) => (g.table[n] || []).indexOf(c) >= 0
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const armies = (g, n) => Object.keys(g.location).filter(p => g.piece_nation[p] === n && g.piece_type[p] === 'army').length

console.log('\n=== §1 布阵 ===')
const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_a1', nation: '德国', type: 'army', space: d.id_of('德国') })
R.action(g, 'Axis', 'debug_add_card', { face: '15200', nation: '德国', dest: 'hand' })   /* 建设陆军 */
R.action(g, 'Axis', 'debug_add_card', { face: '15248', nation: '德国', dest: 'hand' })   /* 合成燃料（STATUS） */
R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15341', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '16700', nation: '意大利', dest: 'hand' })

const build = (g.hands['德国'] || []).find(x => String(x).indexOf('15200#') === 0)
const fuel = (g.hands['德国'] || []).find(x => String(x).indexOf('15248#') === 0)
const ukCalm = (g.hands['英国'] || []).find(x => String(x).indexOf('15353#') === 0)
const itLion = (g.hands['意大利'] || []).find(x => String(x).indexOf('16700#') === 0)
ok('四张关键卡到位', !!build && !!fuel && !!ukCalm && !!itLion,
	JSON.stringify({ build, fuel, ukCalm, itLion }))

console.log('\n=== §2-A 15248 上桌（STATUS） ===')
let n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: fuel })
console.log('  log: ' + logSince(g, n0))
ok('15248 已在德国桌面', inTable(g, '德国', fuel), JSON.stringify(g.table['德国']))

console.log('\n=== §2-B 重入出牌阶段 -> 建设陆军 -> 武装 after_build_army ===')
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
const L = (function () {
	for (let i = 1; i < d.spaces.length; i++) {
		if (!d.spaces[i] || d.spaces[i].terrain === 'sea') continue
		if (!I.can_build_at(g, '德国', i, 'army').ok) continue
		if (!I.unit_slot_free(g, '德国', 'army', i).ok) continue
		return i
	}
	return null
})()
ok('存在合法陆军建设地区', !!L, NM(L))
n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: build, space: L })
console.log('  log: ' + logSince(g, n0))
R.view(g, 'Axis')   /* 窗口在 view 那一遍才武装 */
const faceOf = id => String(id).split('#')[0]
const armed = (g.status_instant || []).some(x => faceOf(x.card_id) === faceOf(fuel))
const ts = (R.view(g, 'Axis').table_status || []).find(x => x.card === fuel) || {}
ok('★ after_build_army 窗口已武装 15248', armed, JSON.stringify(g.status_instant || []))
ok('客户端 table_status ready=true', ts.ready === true, JSON.stringify(ts.reason))

console.log('\n=== §2-C 德国发动 15248（代价：损耗 2）-> 应变 15353 拦截 ===')
const L2 = (function () {
	for (let i = 1; i < d.spaces.length; i++) {
		if (!d.spaces[i] || d.spaces[i].terrain === 'sea') continue
		if (!I.can_build_at(g, '德国', i, 'army').ok) continue
		if (!I.unit_slot_free(g, '德国', 'army', i).ok) continue
		if (Number(i) === Number(L)) continue
		return i
	}
	return null
})()
const deDeck0 = (g.decks['德国'] || []).length
const deArmy0 = armies(g, '德国')
n0 = (g.log || []).length
R.action(g, 'Axis', 'activate_status', { card: fuel, space: L2 })
console.log('  log: ' + logSince(g, n0))
const vUk = R.view(g, 'Allies')
ok('★ 开出 enemy_status_effect（英国可见）',
	!!(vUk.armed_offer && vUk.armed_offer.when === 'enemy_status_effect'),
	JSON.stringify(vUk.armed_offer && vUk.armed_offer.when))
ok('窗口候选=15353', !!(vUk.armed_offer && vUk.armed_offer.cards.some(c => c.card === ukCalm)),
	JSON.stringify(vUk.armed_offer && vUk.armed_offer.cards.map(c => c.card)))
ok('★ 代价已付（德国损耗 2 张）', (g.decks['德国'] || []).length === deDeck0 - 2,
	deDeck0 + ' -> ' + (g.decks['德国'] || []).length)

console.log('\n=== §2-D 英国 15353 拦 -> 意大利 16700 反制 ===')
const ukPay = (g.hands['英国'] || []).find(x => x !== ukCalm)
const itDeck0 = (g.decks['意大利'] || []).length
n0 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: ukCalm, drop: [ukPay] })
console.log('  log: ' + logSince(g, n0))
const vIt = R.view(g, 'Axis')
ok('★ 15353 的"使用"又开出拦截窗口（意大利 16700）',
	!!(vIt.armed_offer && vIt.armed_offer.when === 'enemy_echo_played' &&
		vIt.armed_offer.cards.some(c => c.card === itLion)),
	JSON.stringify(vIt.armed_offer && vIt.armed_offer.cards.map(c => c.card)))
ok('二级拦截 via=trigger（15353 的 when 是 enemy_status_effect）',
	vIt.armed_offer && vIt.armed_offer.via === 'trigger',
	JSON.stringify(vIt.armed_offer && vIt.armed_offer.via))

n0 = (g.log || []).length
R.action(g, 'Axis', 'use_armed_offer', { card: itLion })
console.log('  log: ' + logSince(g, n0))

console.log('\n=== §3 断言 ===')
ok('15353 进英国弃牌堆（被反制）', inDisc(g, '英国', ukCalm), JSON.stringify(g.discard['英国']))
ok('英国代价照付（额外弃 1 张）', inDisc(g, '英国', ukPay), JSON.stringify(g.discard['英国']))
ok('16700 进意大利弃牌堆', inDisc(g, '意大利', itLion), JSON.stringify(g.discard['意大利']))
ok('★ 16700 代价照付（意大利损耗 1）',
	(g.decks['意大利'] || []).length === itDeck0 - 1,
	itDeck0 + ' -> ' + (g.decks['意大利'] || []).length)
ok('★ 15248 未被压制（拦截者被反制）',
	!(g.status_suppressed_this_turn && g.status_suppressed_this_turn[fuel]),
	JSON.stringify(g.status_suppressed_this_turn || {}))
ok('★ 15248 效果落地：德国陆军 +1（相邻建设）', armies(g, '德国') === deArmy0 + 1,
	deArmy0 + ' -> ' + armies(g, '德国'))
ok('代价只扣一次（续跑未重复扣）',
	(g.decks['德国'] || []).length === deDeck0 - 2, String((g.decks['德国'] || []).length))
ok('无残留挂起：pending_armed_use', !g.pending_armed_use)
ok('无残留挂起：armed_offers', (g.armed_offers || []).length === 0,
	JSON.stringify((g.armed_offers || []).map(w => w.when)))
ok('拦截链计数归零', !g.__echo_chain_depth, String(g.__echo_chain_depth))
for (const [label, role] of [['英国', 'Allies'], ['意大利', 'Axis'], ['德国', 'Axis']]) {
	const v = R.view(g, role)
	ok('view(' + label + ') 无待表态窗口', !v.armed_offer,
		JSON.stringify(v.armed_offer && v.armed_offer.when))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
