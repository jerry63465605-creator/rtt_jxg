/*
 * ECON 经济战卡冒烟自检（2026-09-26）
 * 只验证服务端核心逻辑，不写库。
 * 用法：node tools/_smoke_econ.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let g = rules.setup(1)
/* 15313/15314 都是英国的卡 -> 把行动国切到英国 */
g.current_nation = '英国'
g.active = 'Allies'
/* 经济战卡只能在【出牌阶段】打出 */
g.turn_phase = 'play'
g.play_done = {}
const lastLogs = n => (g.log || []).slice(-n)

function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) process.exitCode = 1
	return cond
}

/* 往版图放一枚棋子（与 test_counter_air.js 同款：手写三个字段） */
function put(id, nation, type, spaceName) {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}

console.log('=== init ===')
ok('对局已初始化', !!g && !!g.location)

/* 发牌 */
const give = (nation, cardFace) => g.hands[nation].push(String(cardFace) + '#1')
give('英国', 15313)
give('英国', 15314)

console.log('\n=== 15313 轰炸机军团 ===')
let disBefore = (g.discard['德国'] || []).length
g = rules.action(g, 'Allies', 'play_card', { card: '15313#1' })
ok('缺 target 时不结算（卡留在手上）',
	(g.hands['英国'] || []).indexOf('15313#1') >= 0, lastLogs(1)[0])

/* 版图上放 2 支英国空军 -> N = 2 + 2*2 = 6 */
put('uk_air1', '英国', 'air', '日耳曼')
put('uk_air2', '英国', 'air', '西欧')
console.log('  英国版图空军数 = 2 -> 期望损耗 6 张')

disBefore = (g.discard['德国'] || []).length
g = rules.action(g, 'Allies', 'play_card', { card: '15313#1', target: '德国' })
let actual = (g.discard['德国'] || []).length - disBefore
ok('德国损耗 6 张', actual === 6, 'actual=' + actual + ' | ' + lastLogs(2).join(' / '))
ok('15313 已进弃牌堆', (g.discard['英国'] || []).indexOf('15313#1') >= 0)
ok('占了出牌名额', !!(g.play_done && g.play_done['英国']))

console.log('\n=== 15314 马耳他潜艇群（链式） ===')
g.play_done = {}
/* 意大利在地中海放 1 海军 + 1 空军；德国不放 -> 德国的 remove 应不可选 */
put('it_navy', '意大利', 'navy', '地中海')
put('it_air', '意大利', 'air', '地中海')

g = rules.action(g, 'Allies', 'play_card', { card: '15314#1' })
ok('打出后建立挂起', !!g.pending_econ)
ok('等待方 = 德国', g.pending_econ.chain[g.pending_econ.step] === '德国')
ok('操作权让给轴心', g.active === 'Axis', 'active=' + g.active)

const vGer = rules.view(g, 'Axis')
const oGer = vGer.pending_econ.options
ok('德国面板可见', !!vGer.pending_econ)
ok('德国 remove 变灰（无地中海海军）',
	oGer.find(o => o.id === 'remove').enabled === false,
	JSON.stringify(oGer.map(o => o.id + ':' + o.enabled)))
const vUk1 = rules.view(g, 'Allies')
ok('英国看不到面板', !vUk1.pending_econ)
ok('英国看到 waiting_for', !!(vUk1.waiting_for || {}).text,
	(vUk1.waiting_for || {}).text)

/* 德国选 attrite */
disBefore = (g.discard['德国'] || []).length
g = rules.action(g, 'Axis', 'resolve_econ', { choice: 'attrite' })
actual = (g.discard['德国'] || []).length - disBefore
ok('德国损耗 3 张', actual === 3, 'actual=' + actual)
ok('step 推进到意大利', !!g.pending_econ && g.pending_econ.step === 1)

const vIta = rules.view(g, 'Axis')
const oIta = vIta.pending_econ.options
ok('意大利 remove 可选',
	oIta.find(o => o.id === 'remove').enabled === true)

/* 意大利选 remove -> 连带同地区意大利空军 */
g = rules.action(g, 'Axis', 'resolve_econ', { choice: 'remove', piece: 'it_navy' })
ok('意大利海军已移除', g.location['it_navy'] === undefined)
ok('连带意大利空军一起移除', g.location['it_air'] === undefined,
	'air loc=' + g.location['it_air'])
ok('挂起已清空', !g.pending_econ)
ok('操作权交还同盟', g.active === 'Allies', 'active=' + g.active)
ok('15314 已进弃牌堆', (g.discard['英国'] || []).indexOf('15314#1') >= 0)
ok('英国占了出牌名额', !!(g.play_done && g.play_done['英国']))

console.log('\n=== 最近日志 ===')
lastLogs(8).forEach(l => console.log('  ' + l))
console.log('\nDONE exitCode=' + (process.exitCode || 0))
