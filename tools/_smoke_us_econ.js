/*
 * 美国经济战卡 冒烟自检（2026-10-10）
 * 覆盖：17516 / 17519 / 17520 / 17522 / 16805
 * 用法：node tools/_smoke_us_econ.js
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
function fresh() {
	const g = rules.setup(1)
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	return g
}

console.log('=== 1. 17516 B-26：动态目标（大本营2地区内有美国陆军） ===')
let g = fresh()
const homeDE = I.home_base_of('德国')
put(g, 'us_a1', '美国', 'army', d.name_of(homeDE))   /* 直接放大本营，必在半径2内 */
g.hands['美国'] = ['17516#1']
let tg = I.ECON_CARDS ? I.ECON_CARDS['17516'].targets_fn(g, '美国') : null
const tf = (rules._internal.ECON_CARDS || {})
ok('targets_fn 包含德国', (tf['17516'].targets_fn(g, '美国') || []).indexOf('德国') >= 0,
	JSON.stringify(tf['17516'].targets_fn(g, '美国')))
ok('不含盟国（英国/苏联）',
	(tf['17516'].targets_fn(g, '美国') || []).every(n => ['德国', '日本', '意大利'].indexOf(n) >= 0))
const deckDE = (g.decks['德国'] || []).length
g = rules.action(g, 'Allies', 'play_card', { card: '17516#1', target: '德国' })
ok('德国损耗 4 张', (g.decks['德国'] || []).length === Math.max(0, deckDE - 4),
	'before=' + deckDE + ' after=' + (g.decks['德国'] || []).length)

console.log('\n=== 2. 17519 燃烧弹轰炸：半径1内有美国部队 -> 损耗 8 ===')
g = fresh()
put(g, 'us_u1', '美国', 'army', d.name_of(homeDE))
ok('targets 含德国', (tf['17519'].targets_fn(g, '美国') || []).indexOf('德国') >= 0)
const deckDE2 = (g.decks['德国'] || []).length
g.hands['美国'] = ['17519#1']
g = rules.action(g, 'Allies', 'play_card', { card: '17519#1', target: '德国' })
ok('德国损耗 8 张', (g.decks['德国'] || []).length === Math.max(0, deckDE2 - 8),
	'before=' + deckDE2 + ' after=' + (g.decks['德国'] || []).length)

console.log('\n=== 3. 16805 B-25：结算后置入英国手牌（改为{英国}） ===')
g = fresh()
put(g, 'us_n1', '美国', 'navy', d.name_of(homeDE))
ok('targets 含德国（海军半径2）', (tf['16805'].targets_fn(g, '美国') || []).indexOf('德国') >= 0)
g.hands['美国'] = ['16805#1']
const ukHand0 = (g.hands['英国'] || []).length
g = rules.action(g, 'Allies', 'play_card', { card: '16805#1', target: '德国' })
ok('置入英国手牌', (g.hands['英国'] || []).indexOf('16805#1') >= 0,
	'ukHand=' + JSON.stringify(g.hands['英国']))
ok('英国手牌 +1', (g.hands['英国'] || []).length === ukHand0 + 1)
ok('不在美国弃牌堆（已取出）', (g.discard['美国'] || []).indexOf('16805#1') < 0)

console.log('\n=== 4. 17522 小男孩&胖子：需场上有[曼哈顿计划] ===')
g = fresh()
ok('无曼哈顿时无目标', (tf['17522'].targets_fn(g, '美国') || []).length === 0)
g.table['美国'] = ['17545#1']          /* 曼哈顿计划在场 */
put(g, 'us_f1', '美国', 'air', d.name_of(homeDE))
ok('有曼哈顿+空军相邻 -> 含德国', (tf['17522'].targets_fn(g, '美国') || []).indexOf('德国') >= 0)
put(g, 'de_home_army', '德国', 'army', d.name_of(homeDE))
const deckDE3 = (g.decks['德国'] || []).length
const score0 = g.score['allies'] || 0
g.hands['美国'] = ['17522#1']
g = rules.action(g, 'Allies', 'play_card', { card: '17522#1', target: '德国' })
ok('德国损耗 7 张', (g.decks['德国'] || []).length === Math.max(0, deckDE3 - 7),
	'before=' + deckDE3 + ' after=' + (g.decks['德国'] || []).length)
ok('美国获得 2 分', (g.score['allies'] || 0) === score0 + 2,
	'score=' + (g.score['allies'] || 0))
/* 注意：开局布阵已在大本营放了 1 支德国陆军，故这里是"减 1"而非"变 0" */
const deHomeArmies = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === homeDE)
ok('移除其大本营 1 支陆军（2 -> 1）', deHomeArmies.length === 1,
	'remain=' + deHomeArmies.length)

console.log('\n=== 5. 17520 石油禁运：链式让权，敌方依次二选一 ===')
g = fresh()
/* 场上给日本/德国一些部队以便"移除"选项可用 */
const homeJP = I.home_base_of('日本')
put(g, 'jp_a', '日本', 'army', d.name_of(homeJP))
put(g, 'de_a', '德国', 'army', d.name_of(homeDE))
g.hands['美国'] = ['17520#1']
const chain = tf['17520'].chain_fn(g, '美国')
ok('让权链=全部敌方国家', chain.length >= 2 && chain.indexOf('日本') >= 0,
	'chain=' + JSON.stringify(chain))
/* 打出 -> 挂起让权 */
g = rules.action(g, 'Allies', 'play_card', { card: '17520#1' })
ok('已挂起 pending_econ', !!g.pending_econ, 'pe=' + JSON.stringify(g.pending_econ && { step: g.pending_econ.step }))
const wait1 = g.pending_econ.chain[g.pending_econ.step]
ok('首个待答复国为敌方', chain.indexOf(wait1) >= 0, 'wait=' + wait1)
/* 该方选 attrite（损耗2） */
const deckW1 = (g.decks[wait1] || []).length
g = rules.action(g, I.faction_of_nation(wait1) === 'axis' ? 'Axis' : 'Allies',
	'resolve_econ', { choice: 'attrite' })
ok(wait1 + ' 损耗 2 张', (g.decks[wait1] || []).length === Math.max(0, deckW1 - 2),
	'before=' + deckW1 + ' after=' + (g.decks[wait1] || []).length)
ok('推进到下一个待答复国', !!g.pending_econ &&
	g.pending_econ.chain[g.pending_econ.step] !== wait1,
	'now=' + (g.pending_econ ? g.pending_econ.chain[g.pending_econ.step] : null))

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
