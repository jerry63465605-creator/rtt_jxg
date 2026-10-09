/*
 * 德国经济战卡冒烟自检（2026-09-27）
 * 用法：node tools/_smoke_de_econ.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let g = rules.setup(1)
g.current_nation = '德国'
g.active = 'Axis'
g.turn_phase = 'play'
g.play_done = {}

const give = (cardFace) => g.hands['德国'].push(String(cardFace) + '#1')
const put = (id, nation, type, spaceName) => {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
const score = () => (g.score['axis'] || 0)
const lastLogs = n => (g.log || []).slice(-n)

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : (fail++, process.exitCode = 1)
}

console.log('=== init ===')
ok('对局已初始化', !!g && !!g.location)

/* ---------- 15217 电动潜艇：选择敌方国，损耗3，+2分 ---------- */
console.log('\n=== 15217 电动潜艇 ===')
give(15217)
const disUSSR0 = (g.discard['苏联'] || []).length
const sc0 = score()
g = rules.action(g, 'Axis', 'play_card', { card: '15217#1', target: '苏联' })
const lost17 = (g.discard['苏联'] || []).length - disUSSR0
ok('苏联损耗 3 张', lost17 === 3, 'lost=' + lost17)
ok('德国 +2 分', score() - sc0 === 2, 'delta=' + (score() - sc0))
ok('15217 进弃牌堆', (g.discard['德国'] || []).indexOf('15217#1') >= 0)
g.play_done = {}

/* ---------- 15219 强行封锁：北海+相邻德兵每1 -> 英国损耗1 +1分 ---------- */
console.log('\n=== 15219 强行封锁（北海有德海军） ===')
give(15219)
put('de_navy1', '德国', 'navy', '北海')
const disUK0 = (g.discard['英国'] || []).length
const sc1 = score()
g = rules.action(g, 'Axis', 'play_card', { card: '15219#1', target: '英国' })
const lost19 = (g.discard['英国'] || []).length - disUK0
ok('北海有1德海军 -> 英国损耗 1 张', lost19 === 1, 'lost=' + lost19)
ok('德国 +1 分', score() - sc1 === 1, 'delta=' + (score() - sc1))
g.play_done = {}

/* ---------- 15219 北海无德兵：无效果 ---------- */
console.log('\n=== 15219 强行封锁（北海无德兵） ===')
delete g.location['de_navy1']		/* 清掉上一测试放的德海军 */
give(15219)
const disUK1 = (g.discard['英国'] || []).length
const sc2 = score()
g = rules.action(g, 'Axis', 'play_card', { card: '15219#1', target: '英国' })
ok('无德兵 -> 英国未损耗', (g.discard['英国'] || []).length === disUK1)
ok('无德兵 -> 未加分', score() - sc2 === 0)
g.play_done = {}

/* ---------- 15223 V2飞弹：西欧有德陆军 -> 英国损耗1 +3分 ---------- */
console.log('\n=== 15223 V2飞弹（西欧有德陆军） ===')
give(15223)
put('de_army1', '德国', 'army', '西欧')
const disUK2 = (g.discard['英国'] || []).length
const sc3 = score()
g = rules.action(g, 'Axis', 'play_card', { card: '15223#1', target: '英国' })
ok('西欧有德陆军 -> 英国损耗 1', (g.discard['英国'] || []).length - disUK2 === 1)
ok('德国 +3 分', score() - sc3 === 3)
g.play_done = {}

/* ---------- 15223 西欧无德陆军：无效果 ---------- */
console.log('\n=== 15223 V2飞弹（西欧无德陆军） ===')
delete g.location['de_army1']		/* 清掉上一测试放的德陆军 */
give(15223)
const sc4 = score()
g = rules.action(g, 'Axis', 'play_card', { card: '15223#1', target: '英国' })
ok('西欧无德陆军 -> 未加分', score() - sc4 === 0)
g.play_done = {}

/* ---------- 15224 攻陷阿尔汉格尔斯克：北欧+罗斯被德控制 -> 苏联损耗4 +2分 ---------- */
console.log('\n=== 15224 攻陷阿尔汉格尔斯克 ===')
give(15224)
put('de_army2', '德国', 'army', '北欧')
put('de_army3', '德国', 'army', '罗斯')
const disUSSR1 = (g.discard['苏联'] || []).length
const sc5 = score()
g = rules.action(g, 'Axis', 'play_card', { card: '15224#1', target: '苏联' })
ok('北欧+罗斯被控 -> 苏联损耗 4', (g.discard['苏联'] || []).length - disUSSR1 === 4,
	'lost=' + ((g.discard['苏联'] || []).length - disUSSR1))
ok('德国 +2 分', score() - sc5 === 2)
g.play_done = {}

/* ---------- 15222 主导大西洋海战：海域德兵每1 -> 英国损耗2 +1分 ---------- */
console.log('\n=== 15222 主导大西洋海战（北海有德海军） ===')
put('de_navy2', '德国', 'navy', '北海')	/* 北海是海域 */
give(15222)
const disUK3 = (g.discard['英国'] || []).length
const sc6 = score()
g = rules.action(g, 'Axis', 'play_card', { card: '15222#1', target: '英国' })
ok('海域有1德兵 -> 英国损耗 2', (g.discard['英国'] || []).length - disUK3 === 2,
	'lost=' + ((g.discard['英国'] || []).length - disUK3))
ok('德国 +1 分', score() - sc6 === 1)
g.play_done = {}

console.log('\n=== 最近日志 ===')
lastLogs(6).forEach(l => console.log('  ' + l))
console.log('\nDONE pass=' + pass + ' fail=' + fail)
