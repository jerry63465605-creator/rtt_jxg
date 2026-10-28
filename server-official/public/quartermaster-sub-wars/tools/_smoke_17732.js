// 复现 17732「德国军事顾问」链路：
// ① 触发(play_start)后是否弹出意大利国家技能
// ② 借用(选闪电战)能否锁定 italy_borrow.pending=false
// ③ 触发后 17732 是否被消费，play_start 是否还会重新入队（导致"又弹借用框"）
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

const game = rules.setup(12345, 'Standard', {})
I.ensure_markers(game)

// 准备：意大利回合、出牌阶段
game.current_nation = '意大利'
game.turn_phase = 'play'
game.turn = 1

// 17732 暗置（axis/意大利）
game.table_responses = [
  { card_id: '17732#1', owner_side: 'axis', nation: '意大利', id: '17732#1' },
]
// 德国桌面放一张状态卡（闪电战 15253），供 17732 借用
game.table = game.table || {}
game.table['德国'] = ['15253#1']
// 意大利手牌放一张状态/响应卡，使国家技能可用（grant=status_response）
game.hands = game.hands || {}
game.hands['意大利'] = ['17736#1'] // 17736 意大利响应卡

console.log('--- 入队 play_start ---')
const cands = I.request_responses(game, 'play_start', { nation: '意大利' }, false)
console.log('候选响应:', JSON.stringify(cands && cands.map(c => c.card_id)))
console.log('response_queue 长度:', (game.response_queue || []).length)

console.log('--- 触发 trigger_response ---')
const g2 = rules.action(game, 'Axis', 'trigger_response', {})
const afterTrigger = {
  italy_borrow_pending: !!(g2.italy_borrow && g2.italy_borrow.pending),
  italy_borrow_options: g2.italy_borrow && g2.italy_borrow.options,
  national_skill_offer: g2.national_skill_offer,
  table_responses_len: (g2.table_responses || []).length,
}
console.log('触发后:', JSON.stringify(afterTrigger))

console.log('--- 借用：resolve_italy_borrow 选 options[0] ---')
const face = g2.italy_borrow && g2.italy_borrow.options && g2.italy_borrow.options[0]
const g3 = rules.action(g2, 'Axis', 'resolve_italy_borrow', { face: face })
const afterResolve = {
  italy_borrow_pending: !!(g3.italy_borrow && g3.italy_borrow.pending),
  italy_borrow_card_face: g3.italy_borrow && g3.italy_borrow.card_face,
  national_skill_offer: g3.national_skill_offer,
}
console.log('借用后:', JSON.stringify(afterResolve))

console.log('--- 借用后打一张牌（验证国家技能窗口不被清掉）---')
const g4 = rules.action(g3, 'Axis', 'play_card', { card_id: game.hands['意大利'][0] })
const afterPlay = {
  italy_borrow_pending: !!(g4.italy_borrow && g4.italy_borrow.pending),
  national_skill_offer: g4.national_skill_offer,
}
console.log('打牌后:', JSON.stringify(afterPlay))

console.log('--- 再次 play_start：17732 应已消费，不应重新入队 ---')
const cands2 = I.request_responses(g3, 'play_start', { nation: '意大利' }, false)
console.log('再次候选:', JSON.stringify(cands2 && cands2.map(c => c.card_id)))
console.log('再次 response_queue 长度:', (g3.response_queue || []).length)
console.log('table_responses:', JSON.stringify(g3.table_responses))

const pass1 = !!(afterTrigger.national_skill_offer && afterTrigger.national_skill_offer.nation === '意大利')
const pass2 = afterTrigger.italy_borrow_pending === true
const pass3 = afterResolve.italy_borrow_pending === false
const pass4 = (cands2 || []).length === 0
// 修复①：借用(选闪电战)后国家技能窗口不应被清掉
const pass5 = !!afterResolve.national_skill_offer
// 修复②：借用后打任意牌，国家技能窗口在 17732 窗口期内仍保留
const pass6 = !!afterPlay.national_skill_offer
console.log('---')
console.log('① 触发后弹国家技能 :', pass1, JSON.stringify(afterTrigger.national_skill_offer))
console.log('② 触发后借用框待选 :', pass2)
console.log('③ 借用后已锁定     :', pass3)
console.log('④ 不重复入队       :', pass4)
console.log('⑤ 借用后技能仍在   :', pass5, JSON.stringify(afterResolve.national_skill_offer))
console.log('⑥ 借用后打牌技能不丢:', pass6, JSON.stringify(afterPlay.national_skill_offer))
const pass = pass1 && pass2 && pass3 && pass4 && pass5 && pass6
console.log(pass ? 'PASS(核心链路)' : 'CHECK ABOVE')
