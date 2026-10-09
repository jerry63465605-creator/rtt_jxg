/*
 * 苏联增强卡 17810/17812/17813（+ 17815 验证）冒烟自检（2026-10-07）
 * 仅验证服务端核心逻辑，不写库。
 * 用法：node tools/_smoke_su_effect.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

const me = '苏联'
const side = 'Allies' // action 第二参是阵营 role，不是 nation

function fresh() {
	let g = rules.setup(1)
	g.current_nation = me
	g.active = 'Allies'
	g.hands = g.hands || {}
	g.discard = g.discard || {}
	g.deck = g.deck || {}
	g.hands[me] = g.hands[me] || []
	g.discard[me] = g.discard[me] || []
	g.deck[me] = g.deck[me] || []
	return g
}
let g = null
const lastLogs = n => (g.log || []).slice(-n)

function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) process.exitCode = 1
	return cond
}

/* 往版图放一枚敌方棋子 */
function putEnemy(id, nation, type, spaceName) {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function A(act, arg) { g = rules.action(g, side, act, arg) }

console.log('=== 17810 维捷布斯克之门（计分：弃1[建设陆军]+2手牌，消灭1敌方陆军）===')
g = fresh()
g.turn_phase = 'scoring'
g.play_done = {}
g.hands[me] = ['17810#1', '15300#1', '17804#1', '17805#1'] // 17810 + 建设陆军 + 2 其它手牌
g.discard[me] = []
putEnemy('ger1', '德国', 'army', '莫斯科')
const moId = d.id_of('莫斯科')
ok('德国陆军已置于莫斯科', g.location['ger1'] != null && g.piece_nation['ger1'] === '德国')
A('play_card', { card: '17810#1', cards: ['15300#1', '17804#1', '17805#1'], space: moId, spaces: [moId] })
ok('17810 已离手（进弃牌堆）', (g.hands[me] || []).indexOf('17810#1') < 0)
ok('代价已付（3 张手牌进弃牌堆，含 1 张[建设陆军]）',
	(['15300#1', '17804#1', '17805#1'].every(c => (g.discard[me] || []).indexOf(c) >= 0)),
	'discard=' + JSON.stringify(g.discard[me]))
ok('莫斯科的德国陆军被消灭', !g.location['ger1'])
/* self 卡在计分/弃牌阶段打出，不占出牌阶段三选一名额（play_done 不适用），此处仅确认卡已离手即可 */

console.log('\n=== 17810 反面：代价不含[建设陆军]应被拒 ===')
g = fresh()
g.turn_phase = 'scoring'
g.play_done = {}
g.hands[me] = ['17810#1', '17805#1', '17806#1', '17807#1'] // 无建设陆军
putEnemy('ger2', '德国', 'army', '罗斯')
const before = JSON.stringify(g.hands[me])
A('play_card', { card: '17810#1', cards: ['17805#1', '17806#1', '17807#1'], space: d.id_of('罗斯') })
ok('缺[建设陆军]时卡保留在手', JSON.stringify(g.hands[me]) === before, 'log=' + lastLogs(1)[0])

console.log('\n=== 17812 亚洲人力储备（弃牌：弃牌堆取1[建设陆军]置手牌、1[建设陆军]洗入牌堆）===')
g = fresh()
g.turn_phase = 'discard'
g.hands[me] = ['17812#1']
g.discard[me] = ['15300#1', '15300#2'] // 两张[建设陆军]
g.deck[me] = ['99999#1']
A('play_card', { card: '17812#1' })
ok('建立挂起（pending_echo, kind=su, step=hand）',
	!!g.pending_echo && g.pending_echo.kind === 'su' && g.pending_echo.step === 'hand',
	'pe=' + JSON.stringify(g.pending_echo && { k: g.pending_echo.kind, s: g.pending_echo.step }))
const c1 = g.pending_echo.candidates.map(c => c.id)
ok('候选=弃牌堆的[建设陆军]', c1.indexOf('15300#1') >= 0 && c1.indexOf('15300#2') >= 0, 'cands=' + JSON.stringify(c1))
A('resolve_effect', { pick: '15300#1' })
ok('第一步后进入 step=deck', !!g.pending_echo && g.pending_echo.step === 'deck')
ok('15300#1 已置入手牌', (g.hands[me] || []).indexOf('15300#1') >= 0)
ok('deck 步候选=剩余[建设陆军]', g.pending_echo.candidates.map(c => c.id).indexOf('15300#2') >= 0)
A('resolve_effect', { pick: '15300#2' })
ok('挂起已清空', !g.pending_echo)
ok('15300#2 已洗入牌堆', (g.deck[me] || []).indexOf('15300#2') >= 0, 'deck=' + JSON.stringify(g.deck[me]))
ok('17812#1 已离手', (g.hands[me] || []).indexOf('17812#1') < 0)
ok('弃牌堆已清空[建设陆军]', (g.discard[me] || []).indexOf('15300#1') < 0 && (g.discard[me] || []).indexOf('17804#1') < 0)

console.log('\n=== 17813 重建要塞（弃牌：弃1[建设陆军]，选1[响应卡]打出）===')
g = fresh()
g.turn_phase = 'discard'
g.hands[me] = ['17813#1', '15300#1'] // 17813 + 代价[建设陆军]
g.discard[me] = ['17830#1', '15300#2'] // 苏联响应卡《保卫祖国》+ 多余牌（代价已先付 15300#1）
g.deck[me] = ['99998#1']
A('play_card', { card: '17813#1', cards: ['15300#1'] })
ok('代价已付（15300#1 进弃牌堆）', (g.discard[me] || []).indexOf('15300#1') >= 0)
ok('建立挂起（step=play，候选=响应卡）',
	!!g.pending_echo && g.pending_echo.step === 'play' &&
		g.pending_echo.candidates.map(c => c.id).indexOf('17830#1') >= 0)
A('resolve_effect', { pick: '17830#1' })
ok('挂起已清空', !g.pending_echo)
ok('17830#1 已打出（进入面下响应 table_responses）',
	(g.table_responses || []).some(r => r.card_id === '17830#1'),
	'table_responses=' + JSON.stringify(g.table_responses))
ok('17813#1 已离手', (g.hands[me] || []).indexOf('17813#1') < 0)

console.log('\n=== 17813 反面：弃牌堆无[响应卡]应直接跳过 ===')
g = fresh()
g.turn_phase = 'discard'
g.hands[me] = ['17813#1', '15300#1']
g.discard[me] = []
A('play_card', { card: '17813#1', cards: ['15300#1'] })
ok('无响应卡时不挂起（直接跳过）', !g.pending_echo, 'pe=' + JSON.stringify(g.pending_echo))

console.log('\n=== 17815 Z计划（空军阶段，self/airforce，run+need:space 两分支）验证不崩 ===')
g = fresh()
g.turn_phase = 'airforce'
g.hands[me] = ['17815#1']
g.discard[me] = []
const _g15 = g
const r15 = rules.action(_g15, side, 'play_card', { card: '17815#1' })
ok('17815 打出未抛异常，返回二项选择提示（走 查询→选向→打出 标准流程）',
	!!r15 && (_g15.log || []).join('').indexOf('Z 计划') >= 0,
	'logLen=' + (_g15.log ? _g15.log.length : 'null'))

console.log('\n=== 17805 红色管弦乐队（苏/德/英出牌阶段开始：挂起苏联询问使用 -> 苏联选卡 -> 挂起德国二选一）===')
const I = rules._internal

console.log('--- 1) 触发派发：苏/德/英 出牌阶段开始时挂起苏联（su_red_ask）---')
{
	const g2 = rules.setup(1)
	if (!g2.hands['苏联']) g2.hands['苏联'] = []
	g2.hands['苏联'].push('17805#1')
	if (!g2.table['德国']) g2.table['德国'] = []
	g2.table['德国'].push('15340#1') // 德国 STATUS 卡《压制》
	for (const n of ['苏联', '德国', '英国']) {
		g2.su_red_ask = null
		I.offer_su_red(g2, n)
		ok(n + ' 出牌阶段开始挂起苏联(su_red_ask)', !!g2.su_red_ask, 'ask=' + JSON.stringify(g2.su_red_ask))
	}
	// 法国/美国/意大利 不应触发
	g2.su_red_ask = null
	I.offer_su_red(g2, '法国')
	ok('法国出牌阶段不触发', !g2.su_red_ask)
}

console.log('--- 2) 苏联逐步：询问使用 -> 选卡 -> 挂起 pending_red ---')
{
	const g2 = rules.setup(1)
	if (!g2.hands['苏联']) g2.hands['苏联'] = []
	g2.hands['苏联'].push('17805#1')
	if (!g2.table['德国']) g2.table['德国'] = []
	g2.table['德国'].push('15340#1', '15341#1') // 两张德国 STATUS
	I.offer_su_red(g2, '苏联')
	ok('已挂起苏联询问', !!g2.su_red_ask)
	rules.action(g2, 'Allies', 'su_red_use', {})
	ok('苏联使用 -> 转交选卡(su_red_pick)', !!g2.su_red_pick && !g2.su_red_ask, 'pick=' + JSON.stringify(g2.su_red_pick))
	ok('17805#1 已离手（进弃牌堆）',
		(g2.hands['苏联'] || []).indexOf('17805#1') < 0 && (g2.discard['苏联'] || []).indexOf('17805#1') >= 0)
	rules.action(g2, 'Allies', 'su_red_pick', { status: '15340#1' })
	ok('挂起 pending_red（target=15340#1, waiting_for=德国）',
		!!g2.pending_red && g2.pending_red.target === '15340#1' && g2.pending_red.waiting_for === '德国',
		'pr=' + JSON.stringify(g2.pending_red))
	ok('su_red_pick 已清空', !g2.su_red_pick)
}

console.log('--- 3) 苏联可放弃使用（su_red_decline）---')
{
	const g2 = rules.setup(1)
	if (!g2.hands['苏联']) g2.hands['苏联'] = []
	g2.hands['苏联'].push('17805#1')
	if (!g2.table['德国']) g2.table['德国'] = []
	g2.table['德国'].push('15340#1')
	I.offer_su_red(g2, '德国')
	ok('德国出牌阶段也挂起苏联', !!g2.su_red_ask)
	rules.action(g2, 'Allies', 'su_red_decline', {})
	ok('放弃后 su_red_ask 清空（卡仍在手）',
		!g2.su_red_ask && (g2.hands['苏联'] || []).indexOf('17805#1') >= 0)
}

console.log('--- 4) 跨国守卫：苏联（同盟）不能替德国选择 ---')
{
	const g2 = rules.setup(1)
	g2.pending_red = { target: '15340#1', target_name: '压制', waiting_for: '德国', card_name: '红色管弦乐队' }
	rules.action(g2, 'Allies', 'resolve_red', { choice: 0 })
	ok('苏联尝试 resolve_red 被拒（pending_red 仍在）', !!g2.pending_red)
}

console.log('--- 5) 德国 choice=0：本回合内无效（status_active 返回 false）---')
{
	const g2 = rules.setup(1)
	g2.turn = 7
	g2.pending_red = { target: '15340#1', target_name: '压制', waiting_for: '德国', card_name: '红色管弦乐队' }
	if (!g2.table['德国']) g2.table['德国'] = []
	g2.table['德国'].push('15340#1')
	g2.current_nation = '德国'
	g2.active = 'Axis'
	rules.action(g2, 'Axis', 'resolve_red', { choice: 0 })
	ok('su_red_suppressed[15340]===game.turn',
		g2.su_red_suppressed && g2.su_red_suppressed['15340'] === 7, 'val=' + JSON.stringify(g2.su_red_suppressed))
	ok('status_active(15340,德国) 本回合为 false', I.status_active(g2, '15340#1', '德国') === false)
	ok('pending_red 已清空', !g2.pending_red)
}

console.log('--- 6) 德国 choice=1：损耗 2 张牌（deck -> discard）---')
{
	const g2 = rules.setup(1)
	g2.pending_red = { target: '15340#1', target_name: '压制', waiting_for: '德国', card_name: '红色管弦乐队' }
	g2.deck = g2.deck || {}
	g2.discard = g2.discard || {}
	if (!g2.discard['德国']) g2.discard['德国'] = []
	/* attrition_cards 实际作用于 game.decks[nation]（init_nation_deck 初始化），这里只确保弃牌堆可收 */
	const beforeDeck = (g2.decks && g2.decks['德国'] || []).length
	const beforeDis = (g2.discard['德国'] || []).length
	g2.current_nation = '德国'
	g2.active = 'Axis'
	rules.action(g2, 'Axis', 'resolve_red', { choice: 1 })
	ok('德国损耗 2 张（decks 减 2）', (g2.decks && g2.decks['德国'] || []).length === beforeDeck - 2, 'deck=' + ((g2.decks && g2.decks['德国']) || []).length)
	ok('德国弃牌堆 +2', (g2.discard['德国'] || []).length === beforeDis + 2)
	ok('pending_red 已清空', !g2.pending_red)
}

console.log('--- 7) 把关：德国无[状态卡] / 苏联无 17805 时不触发 ---')
{
	const g2 = rules.setup(1)
	if (!g2.hands['苏联']) g2.hands['苏联'] = []
	g2.hands['苏联'].push('17805#1')
	// 故意不放德国 STATUS
	g2.su_red_ask = null
	I.offer_su_red(g2, '苏联')
	ok('无德国状态卡时不挂起', !g2.su_red_ask)
	// 苏联无 17805
	const g3 = rules.setup(1)
	if (!g3.table['德国']) g3.table['德国'] = []
	g3.table['德国'].push('15340#1')
	g3.su_red_ask = null
	I.offer_su_red(g3, '苏联')
	ok('苏联无 17805 时不挂起', !g3.su_red_ask)
}

console.log('\n=== 语法校验 ===')
require('child_process').execSync('node --check ' + path.join(MOD, 'rules.js'))
console.log('  PASS  rules.js 语法 OK')
console.log('\n完成。')
