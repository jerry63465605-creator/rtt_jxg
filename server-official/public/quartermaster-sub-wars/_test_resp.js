"use strict"
const fs = require('fs')
const path = require('path')

/* 仅测试用：加载 rules.js 并暴露内部函数（不修改源文件） */
let src = fs.readFileSync(path.join(__dirname, 'rules.js'), 'utf8')
src = src.replace(/(?<!function )build_map\(\)/g, 'void 0')
src += '\n;globalThis.__T = { setup: exports.setup, request_responses, fire_trigger, consume_response, action: exports.action, RESPONSE_EFFECT_IMPL };'
eval(src)
const T = globalThis.__T
const { data } = require('./data.js')

const scenario = 'Standard'
const game = T.setup('seed-resp', scenario, {})

let britainKey = null
for (const [k, v] of Object.entries(data.spaces))
	if (v && v.name === '不列颠') { britainKey = k; break }
const allyNation = '英国', axisNation = '德国', frNation = '法国'
const has = (cid) => Object.values(game.discard).some(a => a.includes(cid))
let pass = true
const log = []

/* ---- T1：15331 国士警卫队（build 事后类）-> 触发消灭不列颠敌军 ---- */
game.location['p1'] = britainKey
game.piece_nation['p1'] = allyNation
game.piece_type['p1'] = 'army'
game.table_responses = [{ card_id: '15331#1', owner_side: 'axis', nation: axisNation }]
T.request_responses(game, 'build', { nation: allyNation, space: britainKey, type: 'army', piece_id: 'p1' }, false)
const q1 = (game.response_queue || [])[0]
const t1a = !!q1 && q1.candidates.some(c => c.card_face === '15331') && q1.owner_side === 'axis'
T.action(game, 'Axis', 'trigger_response', {})
const t1b = !game.location['p1'] && game.table_responses.length === 0 && has('15331#1')
log.push('[T1] 15331 入队?' + !!q1 + ' 阵营=axis?' + (q1 && q1.owner_side === 'axis') +
	' | 触发后: 敌兵消失?' + !game.location['p1'] + ' 卡消耗?' + (game.table_responses.length === 0) +
	' 进弃牌?' + has('15331#1') + ' => ' + (t1a && t1b))
if (!(t1a && t1b)) pass = false

/* ---- T2：15336 法兰西爱国者（battle 事后类）-> 触发在法国征召陆军 ---- */
const frSpaceList = ['西欧', '非洲南部', '非洲北部', '中东']
const frSpace = Object.keys(data.spaces).find(k => frSpaceList.includes(data.spaces[k].name))
game.table_responses = [{ card_id: '15336#1', owner_side: 'allies', nation: frNation }]
T.request_responses(game, 'battle', { nation: frNation, space: frSpace, kind: 'land', card: null, card_obj: null }, false)
const q2 = (game.response_queue || [])[0]
T.action(game, 'Allies', 'trigger_response', {})
const frenchRecruited = Object.entries(game.location).some(([p, sp]) =>
	sp === frSpace && game.piece_nation[p] === '法国' && game.piece_type[p] === 'army')
const t2 = !!q2 && frenchRecruited && game.table_responses.length === 0 && has('15336#1')
log.push('[T2] 15336 入队?' + !!q2 + ' | 触发后: 法军出现?' + frenchRecruited +
	' 卡消耗?' + (game.table_responses.length === 0) + ' 进弃牌?' + has('15336#1') + ' => ' + t2)
if (!t2) pass = false

/* ---- T3：15337 生命的飞跃（piece_removed 事后类）-> 触发还原法国陆军 ---- */
game.location['p2'] = britainKey
game.piece_nation['p2'] = frNation
game.piece_type['p2'] = 'army'
game.table_responses = [{ card_id: '15337#1', owner_side: 'allies', nation: frNation }]
/* 模拟"已被移除"后再挂起响应（与 eliminate_piece 流程一致） */
game.location['p2'] = undefined
T.request_responses(game, 'piece_removed', {
	nation: frNation, piece: 'p2', piece_nation: frNation, piece_type: 'army', space: britainKey, reason: 'eliminate',
}, false)
const q3 = (game.response_queue || [])[0]
T.action(game, 'Allies', 'trigger_response', {})
const restored = game.location['p2'] === britainKey && game.piece_nation['p2'] === frNation
const t3 = !!q3 && restored && game.table_responses.length === 0 && has('15337#1')
log.push('[T3] 15337 入队?' + !!q3 + ' | 触发后: 法军还原?' + restored +
	' 卡消耗?' + (game.table_responses.length === 0) + ' 进弃牌?' + has('15337#1') + ' => ' + t3)
if (!t3) pass = false

/* ---- T4：15333 配给（play_card 事后类）-> 触发把英国卡洗回牌堆 ---- */
game.table_responses = [{ card_id: '15333#1', owner_side: 'allies', nation: allyNation }]
game.discard[allyNation] = game.discard[allyNation] || []
game.discard[allyNation].push('15300#x')
T.request_responses(game, 'play_card', { nation: allyNation, card: '15300#x', card_obj: { id: '15300#x', nation: '英国', name: '建设陆军', type: 'BASIC' } }, false)
const q4 = (game.response_queue || [])[0]
T.action(game, 'Allies', 'trigger_response', {})
const t4 = (game.discard[allyNation].indexOf('15300#x') < 0) && game.table_responses.length === 0 && has('15333#1')
log.push('[T4] 15333 入队?' + !!q4 + ' | 触发后: 卡洗回?' + (game.discard[allyNation].indexOf('15300#x') < 0) +
	' 卡消耗?' + (game.table_responses.length === 0) + ' 进弃牌?' + has('15333#1') + ' => ' + t4)
if (!t4) pass = false

/* ---- T5：放弃响应（pass_response）-> 卡留桌面、效果不发动 ---- */
game.location['p3'] = britainKey
game.piece_nation['p3'] = allyNation
game.piece_type['p3'] = 'army'
game.table_responses = [{ card_id: '15331#2', owner_side: 'axis', nation: axisNation }]
T.request_responses(game, 'build', { nation: allyNation, space: britainKey, type: 'army', piece_id: 'p3' }, false)
T.action(game, 'Axis', 'pass_response', {})
const t5 = !!game.location['p3'] && game.table_responses.length === 1 && !has('15331#2')
log.push('[T5] 放弃后: 敌兵仍在?' + !!game.location['p3'] +
	' 卡留桌面?' + (game.table_responses.length === 1) + ' 未进弃牌?' + !has('15331#2') + ' => ' + t5)
if (!t5) pass = false

/* ---- T6：全局拦截：响应结算中禁止其它动作 ---- */
game.table_responses = [{ card_id: '15331#3', owner_side: 'axis', nation: axisNation }]
game.location['p4'] = britainKey
game.piece_nation['p4'] = allyNation
game.piece_type['p4'] = 'army'
T.request_responses(game, 'build', { nation: allyNation, space: britainKey, type: 'army', piece_id: 'p4' }, false)
const before = JSON.stringify(game.response_queue)
T.action(game, 'Axis', 'next_phase', {})
const t6 = JSON.stringify(game.response_queue) === before &&
	game.log[game.log.length - 1].includes('响应结算中')
log.push('[T6] 结算中被拦截?' + t6 + ' (末条日志: ' + game.log[game.log.length - 1] + ')')
if (!t6) pass = false

/* ---- T7：非持有方不能触发 ---- */
game.response_queue = []
game.table_responses = [{ card_id: '15331#4', owner_side: 'axis', nation: axisNation }]
game.location['p5'] = britainKey
game.piece_nation['p5'] = allyNation
game.piece_type['p5'] = 'army'
T.request_responses(game, 'build', { nation: allyNation, space: britainKey, type: 'army', piece_id: 'p5' }, false)
T.action(game, 'Allies', 'trigger_response', {}) // 同盟国尝试触发轴心国卡
const t7 = !!(game.response_queue && game.response_queue.length) && game.table_responses.length === 1
log.push('[T7] 非持有方被拒?' + t7 + ' => ' + t7)
if (!t7) pass = false

console.log(log.join('\n'))
console.log('\n=== 总结论 ===', pass ? 'PASS（交互式响应卡 7/7 通过）' : 'FAIL')
process.exit(pass ? 0 : 1)
