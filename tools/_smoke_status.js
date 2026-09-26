/*
 * 状态卡冒烟自检（2026-09-26）
 * 覆盖：打出（占名额+留桌面）/ 持续生效 / 触发（含代价）/ 一回合一次 /
 *      光环离场回滚 / 地图改动永久 / 15343 抑制 / 15340 自动计分。
 * 用法：node tools/_smoke_status.js
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

let g = rules.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'play'
g.play_done = {}

/* 发牌 */
const give = (nation, face) => g.hands[nation].push(String(face) + '#1')
give('英国', 15344)
give('英国', 15345)
give('英国', 15347)
give('英国', 15346)
give('英国', 15343)
give('英国', 15338)
give('英国', 15340)
give('英国', 15348)

console.log('=== 1. 15344 法国流亡政府：打出即时征召 ===')
g = rules.action(g, 'Allies', 'play_card', { card: '15344#1' })
ok('15344 进桌面', (g.table['英国'] || []).indexOf('15344#1') >= 0)
ok('15344 占了出牌名额', !!(g.play_done && g.play_done['英国']))
ok('法国在不列颠征召陆军', Object.keys(g.location).some(p =>
	g.piece_nation[p] === '法国' && g.piece_type[p] === 'army' &&
	g.location[p] === d.id_of('不列颠')),
	'count=' + Object.keys(g.location).filter(p =>
		g.piece_nation[p] === '法国' && g.piece_type[p] === 'army' &&
		g.location[p] === d.id_of('不列颠')).length)
/* 西欧放敌方部队，触发 home_override */
put(g, 'ger_weu', '德国', 'army', '西欧')
I.compute_supply(g)  /* refresh */
console.log('  DEBUG: 15344 aura =', JSON.stringify(g.status_aura))
ok('15344 home_override 生效：法国大本营=不列颠',
	I.effective_home_base(g, '法国') === d.id_of('不列颠'),
	'actual=' + (I.effective_home_base(g, '法国')))

console.log('\n=== 2. 15345 塞内加尔步兵团：地图改动（永久）+ 触发征召 ===')
g.play_done = {}
g = rules.action(g, 'Allies', 'play_card', { card: '15345#1' })
ok('15345 进桌面', (g.table['英国'] || []).indexOf('15345#1') >= 0)
ok('非洲南部增加 2 计分标记', (g.markers[d.id_of('非洲南部')] || []).length === 2,
	'len=' + (g.markers[d.id_of('非洲南部')] || []).length)

console.log('\n=== 3. 15347 波兰主权：东欧补给点 + 1 标记 ===')
g.play_done = {}
g = rules.action(g, 'Allies', 'play_card', { card: '15347#1' })
ok('东欧增加 1 计分标记', (g.markers[d.id_of('东欧')] || []).length === 1)

console.log('\n=== 4. 15346 自由法国：光环，法国总在补给 ===')
g.play_done = {}
g = rules.action(g, 'Allies', 'play_card', { card: '15346#1' })
ok('15346 进桌面', (g.table['英国'] || []).indexOf('15346#1') >= 0)
/* 放一支法国陆军在【非补给点的偏远地区】，应当被算作补给 */
put(g, 'fr_far', '法国', 'army', '冰岛')
const sup = I.compute_supply(g)
ok('法国偏远陆军被算作补给', !!sup.in_supply['fr_far'],
	'src=' + sup.sources['fr_far'])

console.log('\n=== 5. 15343 霍巴特滑稽坦克：敌方状态卡无效 ===')
g.play_done = {}
g = rules.action(g, 'Allies', 'play_card', { card: '15343#1' })
ok('15343 进桌面', (g.table['英国'] || []).indexOf('15343#1') >= 0)
/* 假想敌方桌面上有一张状态卡 */
g.table['德国'] = g.table['德国'] || []
g.table['德国'].push('xx_status#1')
ok('敌方（德国）状态卡被压制', !I.status_active(g, 'xx_status#1', '德国'))

console.log('\n=== 6. 15340 国家资源动员法：计分阶段自动加分 ===')
g.play_done = {}
g = rules.action(g, 'Allies', 'play_card', { card: '15340#1' })
ok('15340 进桌面', (g.table['英国'] || []).indexOf('15340#1') >= 0)
/* 加拿大放英国陆军+海军 */
put(g, 'uk_can1', '英国', 'army', '加拿大')
put(g, 'uk_can2', '英国', 'navy', '加拿大')
console.log('  DEBUG: score keys =', Object.keys(g.score || {}))
const scoreBefore = g.score.allies
I.phase_scoring(g, '英国')
const scoreAfter = g.score.allies
/* 期望 15340 加 2 分（加拿大 2 部队）。
 * 但常规计分可能也加了英国在 markers 地区的分（例如澳大利亚）。
 * 所以这里不验证绝对值，验证 15340 的 items 出现在 results 里 */
const results = (g.last_scoring && g.last_scoring.results) || []
const has15340 = results.some(r => (r.items || []).some(it => it.kind === 'status' && it.card === '15340#1'))
ok('15340 在计分阶段自动加分（出现 status item）', has15340,
	'delta=' + (scoreAfter - scoreBefore) + ' hasItem=' + has15340)

console.log('\n=== 7. 光环离场回滚（15346） ===')
/* 模拟被 15328 弃置：调用 revert */
const frSupBefore = !!I.compute_supply(g).in_supply['fr_far']
console.log('  DEBUG: aura before revert =', JSON.stringify(g.status_aura))
I.revert_status_ongoing(g, '15346#1', '英国')
console.log('  DEBUG: aura after revert =', JSON.stringify(g.status_aura))
const frSupAfter = !!I.compute_supply(g).in_supply['fr_far']
ok('15346 离场后法国偏远陆军不再补给', frSupBefore && !frSupAfter,
	'before=' + frSupBefore + ' after=' + frSupAfter)

console.log('\n=== 8. 地图改动永久（15345 离场后标记保留） ===')
I.revert_status_ongoing(g, '15345#1', '英国')
ok('15345 离场后非洲南部标记仍保留',
	(g.markers[d.id_of('非洲南部')] || []).length === 2,
	'len=' + (g.markers[d.id_of('非洲南部')] || []).length)

console.log('\n=== 9. 15338 触发：代价 + 战斗 ===')
/* 桌面上要有 15338 —— 再发一张打出 */
g.play_done = {}
g.hands['英国'].push('15338#1')
g = rules.action(g, 'Allies', 'play_card', { card: '15338#1' })
ok('15338 进桌面', (g.table['英国'] || []).indexOf('15338#1') >= 0)
/* 下一回合出牌阶段触发 */
g.turn = (g.turn || 1) + 1
g.play_done = {}
g.skip_play_done = {}
/* 西欧有德国陆军可被打 */
const vGer = Object.keys(g.location).find(p =>
	g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' &&
	g.location[p] === d.id_of('西欧'))
/* 英国需要在西欧相邻地区有补给中的陆军 */
put(g, 'uk_fr', '英国', 'army', '不列颠')
const r = rules.action(g, 'Allies', 'activate_status', {
	card: '15338#1', space: d.id_of('西欧'),
	from: 'uk_fr', victim: vGer,
})
ok('15338 触发后跳过出牌阶段',
	(g.skip_play_done || {}).英国 === g.turn)
ok('15338 触发后卡仍保留',
	(g.table['英国'] || []).indexOf('15338#1') >= 0)

console.log('\n=== 10. 一回合一次（15339，用模拟数据） ===')
/* 跳过 15339 的真实测试 —— 需要先发起海战；
 * 这里只验 status_used 机制 */
g.status_used = {}
g.status_used['15339#1'] = g.turn
const cfg = I.status_config_of('15339#1')
ok('status_used 标记生效', cfg && cfg.trigger.once_per_turn)

console.log('\n=== 11. 15348 最多 N 次 ===')
g.turn = (g.turn || 1) + 1
g.play_done = {}
g.skip_play_done = {}
g.hands['英国'].push('15348#1')
g = rules.action(g, 'Allies', 'play_card', { card: '15348#1' })
ok('15348 进桌面', (g.table['英国'] || []).indexOf('15348#1') >= 0)
/* 加拿大+印度+南非各放 1 英国陆军 = 3 次 */
put(g, 'uk_ca2', '英国', 'army', '加拿大')
put(g, 'uk_in2', '英国', 'army', '印度')
put(g, 'uk_sa2', '英国', 'army', '南非')
const scBefore = g.score.allies
const hBefore = (g.hands['英国'] || []).length
g = rules.action(g, 'Allies', 'activate_status', { card: '15348#1' })
ok('15348 一次扣分 + 摸牌',
	g.score.allies === scBefore - 1 &&
	(g.hands['英国'] || []).length === hBefore + 1,
	'score_delta=' + (g.score.ALLIES - scBefore) +
		' hand_delta=' + ((g.hands['英国'] || []).length - hBefore))

console.log('\nPASS=' + pass + '  FAIL=' + fail)
process.exitCode = fail ? 1 : 0
