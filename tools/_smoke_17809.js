/*
 * 17809 骑兵师时点修复冒烟自检（2026-10-07）
 * 背景：卡面「出牌阶段开始时」= play_start 时点，原误用 turn_start。
 * 修复：① phase_play 新增 armed 的 play_start 派发点；② 17809 when:'turn_start'→'play_start'。
 * 检验：
 * 1) play_start 窗口下，苏联 17809 应被纳入 armed_offer
 * 2) turn_start 窗口下，苏联 17809 不再出现（已切换时点）
 * 3) build_candidate_spaces 统一候选 helper 正常
 * 4) 17809 run 第一步返回选己方陆军候选
 * 用法：node tools/_smoke_17809.js
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

const g = rules.setup(1)
if (!g.hands['苏联']) g.hands['苏联'] = []
/* 场上放一支苏联陆军（满足 17809 ready 的 su_army_pieces>0） */
put(g, 'suA', '苏联', 'army', '莫斯科')
/* 苏联手牌放入 17809 */
g.hands['苏联'].push('17809#1')

console.log('=== 1. play_start 窗口（17809 应被纳入 armed_offer） ===')
I.offer_armed_effects(g, 'play_start', { nation: '苏联' })
const cardsNew = (g.armed_offer && g.armed_offer.cards) || []
ok('17809 出现在 armed_offer(play_start)', cardsNew.some(c => c.card_id && c.card_id.indexOf('17809') === 0),
	'cards=' + JSON.stringify(cardsNew.map(c => c.card_id)))

console.log('=== 2. turn_start 窗口（17809 不应再出现） ===')
I.offer_armed_effects(g, 'turn_start', {})
const cardsOld = (g.armed_offer && g.armed_offer.cards) || []
ok('17809 已不在 turn_start', !cardsOld.some(c => c.card_id && c.card_id.indexOf('17809') === 0),
	'cards=' + JSON.stringify(cardsOld.map(c => c.card_id)))

console.log('=== 3. build_candidate_spaces 统一 helper 不崩 + 返回数组 ===')
const cands = I.build_candidate_spaces(g, '苏联', 'army', {})
ok('返回数组', Array.isArray(cands), 'len=' + cands.length)

console.log('=== 4. 17809 武装 run 第一步返回选己方陆军 ===')
const eff = I.ECHO_EFFECTS['17809']
const step1 = eff.armed.run(g, { tag: 'play_start' }, {})
ok('第一步返回 need:piece', step1 && step1.need === 'piece', 'cands=' + JSON.stringify(step1 && step1.candidates))
ok('候选含场上苏军 suA', step1 && Array.isArray(step1.candidates) && step1.candidates.indexOf('suA') >= 0)

console.log('\n=== 结果: ' + pass + ' pass / ' + fail + ' fail ===')
process.exit(fail ? 1 : 0)
