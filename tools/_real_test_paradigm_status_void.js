/*
 * 【真实测试范式 · 第 5 组】状态卡侧「拦截成立」：15353 成功 -> 状态卡本回合无效
 *
 * 与第 2 组的区别：
 *   第 2 组 = 15353 被 16700 反制（拦截失败，状态卡照常）；
 *   本组   = 16700 放弃反制（拦截成立）-> 状态卡【本回合无效】，但代价照付（S1）。
 *
 * 链路（合法单份）：
 *   ① debug 布阵：德国 15248 上桌 + 建设陆军；英国 15353 + 1 代价牌；意大利 16700（用于"放弃反制"）
 *   ② 德国 play 建设陆军 -> after_build_army 武装 15248
 *   ③ 德国 activate_status 15248（代价：损耗 2，前置）-> 英国 15353 拦截窗口
 *   ④ 英国 use 15353（弃 1）-> 15353 自身是增强卡 -> 意大利 16700 反制窗口
 *   ⑤ 意大利 skip_armed_offer（放弃反制）-> 15353 成立 -> 15248 本回合无效
 *
 * 断言：代价不退（损耗 2）/ 效果不发生（陆军数量不变）/ status_suppressed 命中 /
 *       之后 table_status.ready=false / 无残留。
 *
 * 用法：node tools/_real_test_paradigm_status_void.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))
const faceOf = id => String(id).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const inTable = (g, n, c) => (g.table[n] || []).indexOf(c) >= 0
const armies = (g, n) => Object.keys(g.location).filter(p => g.piece_nation[p] === n && g.piece_type[p] === 'army').length

console.log('\n=== §1 布阵（debug_*）===')
const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_a1', nation: '德国', type: 'army', space: d.id_of('德国') })
R.action(g, 'Axis', 'debug_add_card', { face: '15200', nation: '德国', dest: 'hand' })   /* 建设陆军 */
R.action(g, 'Axis', 'debug_add_card', { face: '15248', nation: '德国', dest: 'hand' })   /* 合成燃料 STATUS */
R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15341', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '16700', nation: '意大利', dest: 'hand' })

const build = (g.hands['德国'] || []).find(x => faceOf(x) === '15200')
const fuel = (g.hands['德国'] || []).find(x => faceOf(x) === '15248')
const ukCalm = (g.hands['英国'] || []).find(x => faceOf(x) === '15353')
const ukPay = (g.hands['英国'] || []).find(x => faceOf(x) === '15341')
const itLion = (g.hands['意大利'] || []).find(x => faceOf(x) === '16700')
ok('布阵齐全', !!build && !!fuel && !!ukCalm && !!ukPay && !!itLion,
	JSON.stringify({ build, fuel, ukCalm, ukPay, itLion }))

console.log('\n=== §2-A 15248 上桌 + 建设陆军武装 after_build_army ===')
let n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: fuel })
console.log('  log: ' + logSince(g, n0))
ok('15248 已在德国桌面', inTable(g, '德国', fuel), JSON.stringify(g.table['德国']))

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
R.view(g, 'Axis')   /* 窗口在 view 那一遍武装 */
ok('★ after_build_army 已武装 15248',
	(g.status_instant || []).some(x => faceOf(x.card_id) === faceOf(fuel)),
	JSON.stringify(g.status_instant || []))
const ts0 = (R.view(g, 'Axis').table_status || []).find(x => x.card === fuel) || {}
ok('客户端 ready=true', ts0.ready === true, JSON.stringify(ts0.reason))

console.log('\n=== §2-B 德国发动 15248（代价损耗 2）-> 英国 15353 拦 ===')
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
ok('开出 enemy_status_effect（英国 15353）',
	!!(vUk.armed_offer && vUk.armed_offer.when === 'enemy_status_effect' &&
		vUk.armed_offer.cards.some(c => c.card === ukCalm)),
	JSON.stringify(vUk.armed_offer && vUk.armed_offer.cards.map(c => c.card)))
ok('★ 代价已付（德国损耗 2）', (g.decks['德国'] || []).length === deDeck0 - 2,
	deDeck0 + ' -> ' + (g.decks['德国'] || []).length)

console.log('\n=== §2-C 英国 15353 拦 -> 意大利 16700 反制窗口 -> 放弃反制 ===')
n0 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: ukCalm, drop: [ukPay] })
console.log('  log: ' + logSince(g, n0))
const vIt = R.view(g, 'Axis')
ok('15353 的"使用"开出反制窗口（意大利 16700）',
	!!(vIt.armed_offer && vIt.armed_offer.when === 'enemy_echo_played' &&
		vIt.armed_offer.cards.some(c => c.card === itLion)),
	JSON.stringify(vIt.armed_offer && vIt.armed_offer.cards.map(c => c.card)))

n0 = (g.log || []).length
R.action(g, 'Axis', 'skip_armed_offer', {})   /* 意大利放弃反制 -> 15353 成立 */
console.log('  log: ' + logSince(g, n0))

console.log('\n=== §3 断言（拦截成立）===')
const supp = g.status_suppressed_this_turn || {}
ok('★ 15353 成立：15248 本回合被压制',
	supp[fuel] === true || supp[faceOf(fuel)] === true ||
	Object.keys(supp).some(k => faceOf(k) === faceOf(fuel)),
	JSON.stringify(supp))
ok('★ 效果不发生：德国陆军数量不变', armies(g, '德国') === deArmy0,
	deArmy0 + ' -> ' + armies(g, '德国'))
ok('★ 代价不退：损耗的 2 张没有回来', (g.decks['德国'] || []).length === deDeck0 - 2,
	String((g.decks['德国'] || []).length))
ok('15353 进英国弃牌堆 + 英国代价照付',
	inDisc(g, '英国', ukCalm) && inDisc(g, '英国', ukPay), JSON.stringify(g.discard['英国']))
ok('意大利 16700 未被消耗（放弃反制）', (g.discard['意大利'] || []).indexOf(itLion) < 0,
	JSON.stringify(g.discard['意大利']))
const ts1 = (R.view(g, 'Axis').table_status || []).find(x => x.card === fuel) || {}
ok('★ 之后 ready=false（本回合已失效）', ts1.ready !== true,
	JSON.stringify({ ready: ts1.ready, reason: ts1.reason }))
ok('无残留：pending_armed_use / armed_offers / chain_depth',
	!g.pending_armed_use && !(g.armed_offers || []).some(w => w.when === 'enemy_echo_played') &&
	!g.__echo_chain_depth,
	JSON.stringify({
		pu: !!g.pending_armed_use,
		ao: (g.armed_offers || []).map(w => w.when),
		cd: g.__echo_chain_depth,
	}))
for (const [label, role] of [['英国', 'Allies'], ['意大利', 'Axis'], ['德国', 'Axis']]) {
	ok('view(' + label + ') 无待表态窗口', !R.view(g, role).armed_offer,
		JSON.stringify(R.view(g, role).armed_offer && R.view(g, role).armed_offer.when))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
