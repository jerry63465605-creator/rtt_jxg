/*
 * 【真实测试范式 · 第 4 组（重建 · 合法布阵）】两层反制链（合法上限）+ 触发生效
 *
 * ⚠ 违规布阵说明（旧版已作废）：
 *   旧版给英国发【两张 15352】、意大利【两张 16700】构造 4 层链 —— 【不可构造】：
 *   实测牌组里只有 BASIC（建设陆军/陆战/海战/建设海军/空军力量）有同名多份，
 *   EFFECT / EVENT / STATUS / RESPONSE / ECON 全部每面 1 份 → 15352、16700 各只有 1 张。
 *   => 拦截链最长 2 层（15352 ↔ 16700 互拦一次），CHAIN_CAP=3 在合法对局中【不可达】，
 *      仅作防御性上限保留。旧版那 4 项 KNOWN 是假问题，随之作废。
 *
 * 本组（合法）链路：
 *   ① 德国 建设海军 -> after_build_navy 窗口（15208 齐柏林；15210 施佩伯爵因 ready 不满足未入列）
 *   ② 德国 触发 15208 -> 英国 15352 拦（via=trigger）
 *   ③ 英国 15352 的"使用" -> 意大利 16700 反制（via=play，第 2 层 = 合法上限）
 *   ④ 意大利 反制成功 -> 15352 作废（代价照付）-> 15208 触发生效
 *   ⑤ 德国 完成 15208 的 need:choice -> 代价（损耗 1）照付、空军落地
 *
 * 用法：node tools/_real_test_paradigm_two_interceptors.js
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
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const inHand = (g, n, c) => (g.hands[n] || []).indexOf(c) >= 0
const airs = (g, n) => Object.keys(g.location).filter(p => g.piece_nation[p] === n && g.piece_type[p] === 'air').length

console.log('\n=== §1 布阵（debug_*，全部合法单份）===')
const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_a1', nation: '德国', type: 'army', space: d.id_of('德国') })
R.action(g, 'Axis', 'debug_add_card', { face: '15202', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15208', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15210', nation: '德国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15341', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '16700', nation: '意大利', dest: 'hand' })

const build = (g.hands['德国'] || []).find(x => String(x).indexOf('15202#') === 0)
const zepp = (g.hands['德国'] || []).find(x => String(x).indexOf('15208#') === 0)
const spee = (g.hands['德国'] || []).find(x => String(x).indexOf('15210#') === 0)
const ukBl = (g.hands['英国'] || []).find(x => String(x).indexOf('15352#') === 0)
const ukPay = (g.hands['英国'] || []).find(x => String(x).indexOf('15341#') === 0)
const itLion = (g.hands['意大利'] || []).find(x => String(x).indexOf('16700#') === 0)
ok('布阵齐全', !!build && !!zepp && !!spee && !!ukBl && !!itLion,
	JSON.stringify({ build, zepp, spee, ukBl, itLion }))

console.log('\n=== §2-A 德国建设海军 -> after_build_navy 窗口 ===')
const sea = (function () {
	for (let i = 1; i < d.spaces.length; i++)
		if (d.spaces[i] && d.spaces[i].terrain === 'sea' && I.can_build_at(g, '德国', i, 'navy').ok) return i
	return null
})()
ok('存在合法建海军海域', !!sea, NM(sea))
let n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: build, space: sea })
console.log('  log: ' + logSince(g, n0))
const w = (g.armed_offers || []).find(x => x.when === 'after_build_navy') || {}
const ids = (w.cards || []).map(c => c.card_id)
ok('窗口含 15208', ids.indexOf(zepp) >= 0, JSON.stringify(ids))
/* 15210 不满足 ready（缺少<亚速尔>方向的海军条件）—— 记录原因，避免误判成 bug */
const r210 = (function () {
	try {
		const ar = (I.ECHO_EFFECTS['15210'] || {}).armed || {}
		if (typeof ar.ready !== 'function') return 'no ready()'
		return ar.ready(g, { nation: '德国', space: sea }) ? 'ready=true' : 'ready=false'
	} catch (e) { return 'err:' + e.message }
})()
console.log('  15210 未入列原因：' + r210 + '（窗口候选=' + JSON.stringify(ids) + '）')
ok('窗口候选张数 = 1（15210 未 ready，不是同卡多份）', ids.length === 1, String(ids.length))

console.log('\n=== §2-B 德国触发 15208 -> 英国 15352 拦（via=trigger）===')
n0 = (g.log || []).length
R.action(g, 'Axis', 'use_armed_offer', { card: zepp, space: sea })
console.log('  log: ' + logSince(g, n0))
const vUk = R.view(g, 'Allies')
ok('开出 enemy_echo_played（英国）', !!(vUk.armed_offer && vUk.armed_offer.when === 'enemy_echo_played'))
ok('via=trigger', vUk.armed_offer && vUk.armed_offer.via === 'trigger',
	JSON.stringify(vUk.armed_offer && vUk.armed_offer.via))
ok('候选只有 15352（16700 阵营互斥）',
	!!(vUk.armed_offer && vUk.armed_offer.cards.length === 1 &&
		vUk.armed_offer.cards[0].card === ukBl),
	JSON.stringify(vUk.armed_offer && vUk.armed_offer.cards.map(c => c.card)))

console.log('\n=== §2-C 英国 15352 拦 -> 意大利 16700 反制（第 2 层 = 合法上限）===')
const itDeck0 = (g.decks['意大利'] || []).length
n0 = (g.log || []).length
R.action(g, 'Allies', 'use_armed_offer', { card: ukBl, drop: [ukPay] })
console.log('  log: ' + logSince(g, n0))
const vIt = R.view(g, 'Axis')
ok('第 2 层窗口给意大利 16700',
	!!(vIt.armed_offer && vIt.armed_offer.cards.some(c => c.card === itLion)),
	JSON.stringify(vIt.armed_offer && vIt.armed_offer.cards.map(c => c.card)))
const depthAfterL1 = g.__echo_chain_depth || 0
ok('chain_depth 已记录第 1 层（>=1）', depthAfterL1 >= 1, String(depthAfterL1))

const deDeck0 = (g.decks['德国'] || []).length
const deAir0 = airs(g, '德国')
n0 = (g.log || []).length
R.action(g, 'Axis', 'use_armed_offer', { card: itLion })
console.log('  log: ' + logSince(g, n0))

console.log('\n=== §2-D 德国完成 15208（need:choice -> deploy）===')
const pend = ((g.armed_offers || [])[0] || {}).pending
ok('15208 停在 need:choice', !!(pend && pend.need === 'choice'), JSON.stringify(pend && pend.need))
const opt = (pend && pend.choiceOptions && pend.choiceOptions[0]) || { id: 'deploy' }
n0 = (g.log || []).length
R.action(g, 'Axis', 'use_armed_offer', { card: zepp, choice: opt.id })
console.log('  log: ' + logSince(g, n0))

console.log('\n=== §3 断言 ===')
ok('15352 进英国弃牌堆（被反制）', inDisc(g, '英国', ukBl), JSON.stringify(g.discard['英国']))
ok('英国代价照付（弃 1 张）', inDisc(g, '英国', ukPay), JSON.stringify(g.discard['英国']))
ok('16700 进意大利弃牌堆', inDisc(g, '意大利', itLion), JSON.stringify(g.discard['意大利']))
ok('★ 16700 代价照付（意大利损耗 1）',
	(g.decks['意大利'] || []).length === itDeck0 - 1,
	itDeck0 + ' -> ' + (g.decks['意大利'] || []).length)
ok('★ 15208 生效：德国代价照付（损耗 1）',
	(g.decks['德国'] || []).length === deDeck0 - 1,
	deDeck0 + ' -> ' + (g.decks['德国'] || []).length)
ok('★ 15208 效果落地：德国空军 +1', airs(g, '德国') === deAir0 + 1,
	deAir0 + ' -> ' + airs(g, '德国'))
ok('15208 未被压制', !((g.status_suppressed_this_turn || {})[zepp]))
ok('无残留拦截窗口（enemy_echo_played）',
	!(g.armed_offers || []).some(x => x.when === 'enemy_echo_played'),
	JSON.stringify((g.armed_offers || []).map(x => x.when)))
ok('无残留：pending_armed_use', !g.pending_armed_use)
ok('chain_depth 归零', !g.__echo_chain_depth, String(g.__echo_chain_depth))
ok('15210 全程未被误用（仍在德国手牌）', inHand(g, '德国', spee), JSON.stringify(g.hands['德国']))
for (const [label, role] of [['英国', 'Allies'], ['意大利', 'Axis'], ['德国', 'Axis']]) {
	const v = R.view(g, role)
	ok('view(' + label + ') 无 enemy_echo_played 窗口',
		!(v.armed_offer && v.armed_offer.when === 'enemy_echo_played'),
		JSON.stringify(v.armed_offer && v.armed_offer.when))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
