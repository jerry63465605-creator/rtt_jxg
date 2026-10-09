/*
 * 验证：ECHO/增强卡的【自选弃牌】代价（2026-09-28 玩家反馈"华沙起义未实现"）。
 *
 * 根因：单候选卡（15312 华沙起义只有<东欧>一个候选）
 *   -> event_card_needs 返回 null（cands.length > need 不成立）
 *   -> event_targets 返回 {need:null, actor} 【不带 cost】
 *   -> 客户端直接 send_action 不带 cards
 *   -> 服务端 .slice(0, cost) 【自动弃前 N 张】，玩家没得选。
 *
 * 修复后应：
 *   ① event_targets 在 need=null 时也返回 cost
 *   ② 客户端带 cards 时，服务端按【玩家选择】弃牌（不是前 N 张）
 *
 * 用法（从仓库根）：node tools/_verify_echo_discard.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

/* 华沙起义：CARD_TRIGGERS = {kind:'self', phase:'scoring'} -> 只能在计分阶段打出 */
function fresh() {
	const g = rules.setup(21)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'scoring'
	g.play_done = {}
	g.hands['英国'] = []
	return g
}

/* ---------- ① query 应返回 cost（修复关键） ---------- */
console.log('=== ① event_targets 对单候选卡返回 cost ===')
let g = fresh()
/* 手牌：本卡 + 另外 3 张（用于做代价） */
g.hands['英国'] = ['15312#1', '15340#2', '15341#3', '15342#4']
const tg = rules.query(g, 'Allies', 'event_targets', { card: '15312#1' })
console.log('  event_targets -> ' + JSON.stringify(tg))
ok('返回 need=null（单候选，无需选地区）', tg && tg.need === null, 'need=' + (tg && tg.need))
ok('【关键】need=null 时仍返回 cost.discard=2',
	!!(tg && tg.cost && tg.cost.discard === 2),
	'cost=' + JSON.stringify(tg && tg.cost))

/* ---------- ② 带 cards 时按玩家选择弃牌 ---------- */
console.log('\n=== ② 提交 cards -> 按【玩家选择】弃牌（不是前 N 张）===')
let g2 = fresh()
g2.hands['英国'] = ['15312#1', '15340#2', '15341#3', '15342#4']
/*
 * 玩家故意选【后两张】(15341#3, 15342#4) 作代价，
 * 而不是自动会取到的前两张 (15340#2, 15341#3)。
 * 若实现正确，弃牌堆应含 15341#3 + 15342#4 且【不含】15340#2。
 */
g2 = rules.action(g2, 'Allies', 'play_card', {
	card: '15312#1', cards: ['15341#3', '15342#4'],
})
const disc = g2.discard['英国'] || []
const hand = g2.hands['英国'] || []
ok('按玩家选择弃掉了 15341#3', disc.indexOf('15341#3') >= 0, 'discard=' + JSON.stringify(disc))
ok('按玩家选择弃掉了 15342#4', disc.indexOf('15342#4') >= 0)
ok('【关键】未自动弃掉 15340#2（证明不是取前 N 张）',
	disc.indexOf('15340#2') < 0 && hand.indexOf('15340#2') >= 0,
	'hand=' + JSON.stringify(hand))
ok('本卡 15312#1 已打出（进弃牌堆）', disc.indexOf('15312#1') >= 0)

/* ---------- ③ 效果：在东欧征召陆军 ---------- */
console.log('\n=== ③ 效果执行：东欧征召英国陆军 ===')
const SP_EE = d.id_of('东欧')
const hasArmy = Object.keys(g2.location).some(p =>
	g2.piece_nation[p] === '英国' && g2.piece_type[p] === 'army' && g2.location[p] === SP_EE)
ok('东欧出现英国陆军', hasArmy,
	'东欧的英国陆军数=' + Object.keys(g2.location).filter(p =>
		g2.piece_nation[p] === '英国' && g2.piece_type[p] === 'army' &&
		g2.location[p] === SP_EE).length)

/* ---------- ④ 其它单候选代价卡也应带 cost ---------- */
console.log('\n=== ④ 同类卡（15306 英联邦殖民地民兵，弃 2 张）===')
let g3 = fresh()
g3.hands['英国'] = ['15306#1', '15340#2', '15341#3', '15342#4']
const tg3 = rules.query(g3, 'Allies', 'event_targets', { card: '15306#1' })
ok('15306 也返回 cost.discard=2', !!(tg3 && tg3.cost && tg3.cost.discard === 2),
	'need=' + (tg3 && tg3.need) + ' cost=' + JSON.stringify(tg3 && tg3.cost))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
