// 复现「借用选卡窗口反复出」：探查 17732 是否在 play_start 反复重排、pending 是否被重置
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

function setup() {
	const game = rules.setup(12345, 'Standard', {})
	I.ensure_markers(game)
	game.current_nation = '意大利'
	game.turn_phase = 'play'
	game.turn = 1
	game.table = game.table || {}
	game.table['德国'] = ['15253#1']
	game.table_responses = [{ card_id: '17732#1', owner_side: 'axis', nation: '意大利', id: '17732#1' }]
	return game
}

// Step1: play_start 应把 17732 入队
const g = setup()
const c1 = I.request_responses(g, 'play_start', { nation: '意大利' }, false)
console.log('① play_start 候选:', JSON.stringify(c1 && c1.map(c => c.card_id)))

// Step2: 触发 17732 -> pending=true
const g2 = rules.action(g, 'Axis', 'trigger_response', {})
console.log('② 触发后 italy_borrow.pending:', !!(g2.italy_borrow && g2.italy_borrow.pending),
	' table_responses:', JSON.stringify(g2.table_responses))

// Step3: 同回合再次 play_start（应不再重排 17732）
const c3 = I.request_responses(g2, 'play_start', { nation: '意大利' }, false)
console.log('③ 同回合再 play_start 候选:', JSON.stringify(c3 && c3.map(c => c.card_id)))

// Step4: 借用选卡 resolve
const face = g2.italy_borrow.options[0]
const g4 = rules.action(g2, 'Axis', 'resolve_italy_borrow', { face })
console.log('④ resolve 后 pending:', !!(g4.italy_borrow && g4.italy_borrow.pending),
	' card_face:', g4.italy_borrow && g4.italy_borrow.card_face)

// Step5: 借用后再次 play_start（本回合内，应仍不重排）
const c5 = I.request_responses(g4, 'play_start', { nation: '意大利' }, false)
console.log('⑤ 借用后同回合 play_start 候选:', JSON.stringify(c5 && c5.map(c => c.card_id)))

// Step6: 模拟进入下一回合（current_nation 改变 -> 触发 italy_borrow 跨回合清理）
const g5 = JSON.parse(JSON.stringify(g4))
g5.current_nation = '德国'
// 跑一个正常 action 触发回合推进清理逻辑（请求一次其它响应）
I.request_responses(g5, 'play_start', { nation: '德国' }, false)
console.log('⑥ 跨回合后 italy_borrow:', g5.italy_borrow)

// Step7: 下一回合意大利 play_start 是否重排 17732（若 table_responses 已被消费则不再出现）
g5.current_nation = '意大利'
g5.turn = 2
const c7 = I.request_responses(g5, 'play_start', { nation: '意大利' }, false)
console.log('⑦ 下一回合 play_start 候选:', JSON.stringify(c7 && c7.map(c => c.card_id)))
console.log('⑦ table_responses:', JSON.stringify(g5.table_responses))
