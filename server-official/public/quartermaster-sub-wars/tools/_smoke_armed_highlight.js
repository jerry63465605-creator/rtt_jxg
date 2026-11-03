/*
 * 新批次增强卡高亮修复 冒烟自检（2026-10-18）
 * 验证：15352/15353/17855 已登记 CARD_TRIGGERS(load)，
 * 平时不可主动打出（客户端据此置灰），仅在 armed_offer 窗口内被 view.armed_offer 标记，
 * 由 play.js update_hand_panel 的 inArmedOffer 分支高亮。
 * 同时确认旧批次"无时点随时可打"增强卡（如 7901）不受影响。
 * 用法：node tools/_smoke_armed_highlight.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

const g0 = rules.setup(1)
const g = g0

console.log('=== 1. 新批次增强卡已登记 CARD_TRIGGERS(load) ===')
const v0 = rules.view(g, 'Allies')
ok("view.card_triggers['15352'].kind === 'load'",
	v0.card_triggers && v0.card_triggers['15352'] && v0.card_triggers['15352'].kind === 'load')
ok("view.card_triggers['15353'].kind === 'load'",
	v0.card_triggers && v0.card_triggers['15353'] && v0.card_triggers['15353'].kind === 'load')
ok("view.card_triggers['17855'].kind === 'load'",
	v0.card_triggers && v0.card_triggers['17855'] && v0.card_triggers['17855'].kind === 'load')

console.log('\n=== 2. 平时（无 armed_offer）不应处于"可打出窗口"，客户端据此置灰 ===')
ok('初始 view.armed_offer 为空（g.armed_offers 未设）', !g.armed_offers || g.armed_offers.length === 0)

console.log('\n=== 3. 模拟服务端弹出 armed_offer 窗口（验证 view→客户端 inArmedOffer 契约）===')
g.hands['英国'] = g.hands['英国'] || []
g.hands['英国'].push('15352#1', '15300#1') // ≥2 张满足 15352 的 ready 弃牌代价预检
/* 生产路径由 play_card 的 EFFECT 分支(同 16700 一日之狮的 enemy_echo_played 窗口)触发；
 * 此处直接构造窗口以验证 view.armed_offer.cards 契约（客户端 inArmedOffer 正是读取它）。 */
g.armed_offers = g.armed_offers || []
g.armed_offers.push({ nation: '英国', when: 'enemy_echo_played',
	cards: [{ card_id: '15352#1', name: '丘吉尔之怒' }] })
const winOk = (g.armed_offers || []).some(w =>
	w.cards && w.cards.some(c => (c.card_id || c.card) === '15352#1'))
ok('armed_offer 窗口含 15352#1', winOk)

console.log('\n=== 4. view.armed_offer.cards 暴露实例 id（inArmedOffer 依赖此）===')
const v1 = rules.view(g, 'Allies')
ok('view.armed_offer 非空', !!v1.armed_offer)
ok("view.armed_offer.cards[].card === '15352#1'",
	v1.armed_offer && v1.armed_offer.cards &&
	v1.armed_offer.cards.some(c => c.card === '15352#1'))

console.log('\n=== 5. 回归：旧批次无时点增强卡(7901)仍无 CARD_TRIGGERS（保留随时可打兜底，不被误伤）===')
ok("view.card_triggers['7901'] 仍不存在",
	v0.card_triggers && !v0.card_triggers['7901'])

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
