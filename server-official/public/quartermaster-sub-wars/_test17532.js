"use strict"
/* 回归测试：2026-10-21 两个反馈的修复。
 * A. 额外打出标记只给"取回的那一张"（17528 重打，filter='card' 实例级匹配）
 * B. 17532 战区移动：选项标签 / 选部队 total / 影子盘面候选 / 移除+两次建设全流程
 *    （B 段走共享点击序列驱动器 tools/event_click_seq.js，与客户端同路）
 *
 * 从模块目录运行：node _test17532.js
 */
const T = require('./rules.js')
const SEQ = require('./tools/event_click_seq.js')
const D = require('./data.js')
const SPACE = D.SPACE

let fails = 0
function check(name, cond, extra) {
	console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra != null ? '  [' + extra + ']' : ''))
	if (!cond) fails++
}
const sea = (n) => Number(SPACE[n])
const nm = (id) => D.data.name_of(id)

/* ============ A. 额外打出只标记那一张 ============ */
{
	const g = T.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.play_done = { 德国: false, 英国: false, 日本: false, 苏联: false, 意大利: false, 美国: false }
	g.hands['美国'] = ['17528#1', '15326#1', '15203#1']
	g.discard['美国'] = ['15326#2']
	T.action(g, 'Allies', 'play_card', { card: '17528#1' })
	T.action(g, 'Allies', 'resolve_us_replay', { card: '15326#2' })
	check('A1 filter=card', g.extra_play && g.extra_play.filter === 'card', JSON.stringify(g.extra_play))
	check('A2 cards 只含取回那张', JSON.stringify(g.extra_play.cards) === '["15326#2"]',
		JSON.stringify(g.extra_play.cards))
	/* 服务端 extra_play_allows：只有那一张放行（第 4 参 inst_id 由 check_phase_for_card 透传） */
	const allows = T._internal.extra_play_allows
	check('A3 允许取回的那张', allows(g, '美国', '15326', '15326#2') === true)
	check('A4 拒绝其它手牌', allows(g, '美国', '15326', '15326#1') === false &&
		allows(g, '美国', '15203', '15203#1') === false)
	/* 不传 inst_id 时退化为卡面比较（老调用方口径，不炸） */
	check('A4b 不传 inst_id 不报错', allows(g, '美国', '15326') === true)
	/* hand_ready：只有那一张 ok */
	const v = T.view(g, 'Allies')
	check('A5 hand_ready 只放行取回那张',
		v.hand_ready['15326#2'] && v.hand_ready['15326#2'].ok === true &&
		v.hand_ready['15326#1'] && v.hand_ready['15326#1'].ok === false,
		JSON.stringify({ a: v.hand_ready['15326#2'], b: v.hand_ready['15326#1'] }))
	/* 打出后权被消耗 */
	T.action(g, 'Allies', 'play_card', { card: '15326#2', picks: [sea('非洲北部'), sea('非洲南部')] })
	check('A6 打出后额外打出权已消耗', !g.extra_play || (g.extra_play.count || 0) <= 0)
}

/* ============ B. 17532 战区移动全流程 ============ */
function setup17532() {
	const g = T.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.play_done = { 德国: false, 英国: false, 日本: false, 苏联: false, 意大利: false, 美国: false }
	/* 清掉初始美国棋子，自摆：一支海军在阿拉伯海、一支陆军在印度 */
	for (const p of Object.keys(g.location).slice()) {
		if (g.piece_nation[p] === '美国') { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	}
	g.location['usaN'] = sea('阿拉伯海'); g.piece_nation['usaN'] = '美国'; g.piece_type['usaN'] = 'navy'
	g.location['usaA'] = sea('印度'); g.piece_nation['usaA'] = '美国'; g.piece_type['usaA'] = 'army'
	g.hands['美国'] = ['17532#1']
	g.discard['美国'] = []
	T._internal.add_supply_point(g, sea('阿拉伯海'))
	T._internal.add_supply_point(g, sea('印度'))
	T._internal.compute_supply(g)
	return g
}

/* B1 选项标签（走真实 query 出口，与客户端所见一致） */
{
	const g = setup17532()
	const r = T.query(g, 'Allies', 'event_targets', { card: '17532#1' })
	check('B1a need=choice', r && r.need === 'choice', JSON.stringify(r))
	check('B1b 选项标签正确',
		r && r.options && r.options.length === 2 &&
		r.options[0].label === '先建设海军，再建设陆军' &&
		r.options[1].label === '先建设陆军，再建设海军',
		r && r.options ? JSON.stringify(r.options.map(o => o.label)) : 'null')
}

/* B2 选 choice 后 -> need:'piece' 且带 total=3（query 出口必须透传 step/total） */
{
	const g = setup17532()
	const r = T.query(g, 'Allies', 'event_targets', { card: '17532#1', choice: 0 })
	check('B2a need=piece', r && r.need === 'piece', JSON.stringify(r && r.need))
	check('B2b step=0 total=3', r && r.step === 0 && r.total === 3,
		'step=' + (r && r.step) + ' total=' + (r && r.total))
	check('B2c 候选是美国陆军/海军且 id/name 形状正确',
		r && r.candidates.length === 2 &&
		r.candidates.every(c => (c.id === 'usaN' || c.id === 'usaA') &&
			typeof c.name === 'string' && c.name.indexOf('@') > 0),
		JSON.stringify(r && r.candidates))
}

/* B3 全流程：选海军移除 -> 选两地建设 -> 断言结果（全程走 query 出口） */
{
	const g = setup17532()
	const q = (arg) => T.query(g, 'Allies', 'event_targets', Object.assign({ card: '17532#1' }, arg))
	/* 第 0 步：选要移除的部队（海军） */
	let r = q({ choice: 0 })
	check('B3a 第0步问部队', r && r.need === 'piece' && r.step === 0 && r.total === 3)
	/* 带上 piece 重查 -> 应问第 1 步的建设地区 */
	r = q({ choice: 0, pieces: ['usaN'] })
	check('B3b 带上 piece 后问建设地区', r && r.need === 'space' && r.step === 1,
		JSON.stringify(r && { need: r.need, step: r.step }))
	/* 带上 pieces + spaces[1] 重查 -> 应问第 2 步 */
	r = q({ choice: 0, pieces: ['usaN'], spaces: [null, sea('印度洋')] })
	check('B3c 带上 spaces[1] 后问第2步', r && r.need === 'space' && r.step === 2,
		JSON.stringify(r && { need: r.need, step: r.step }))
	/* 第 2 步是建陆军：从服务端候选里取一个合法陆地 */
	const armySpace = r && r.candidates && r.candidates.length ? r.candidates[0].id : null
	check('B3c2 第2步有合法候选', armySpace != null, JSON.stringify(r && r.candidates))
	/* 全齐 -> need 为 null（query 出口包装成 {need:null,actor,cost}，客户端判 tg.need===null） */
	r = q({ choice: 0, pieces: ['usaN'], spaces: [null, sea('印度洋'), armySpace] })
	check('B3d 全齐后 need=null', r && r.need === null, JSON.stringify(r))

	/* 真正提交 */
	T.action(g, 'Allies', 'play_card', {
		card: '17532#1', choice: 0, pieces: ['usaN'],
		spaces: [null, sea('印度洋'), armySpace],
	})
	const logs = g.log.slice(-6).join(' | ')
	check('B3e 选中的海军被移除', !g.location['usaN'])
	check('B3f 未选中的陆军保留', !!g.location['usaA'])
	check('B3g 印度洋建成海军',
		Object.keys(g.location).some(p => g.location[p] === sea('印度洋') &&
			g.piece_nation[p] === '美国' && g.piece_type[p] === 'navy'))
	check('B3h ' + nm(armySpace) + '建成陆军',
		Object.keys(g.location).some(p => g.location[p] === armySpace &&
			g.piece_nation[p] === '美国' && g.piece_type[p] === 'army'))
	check('B3i 日志含两步建设', logs.indexOf('各建设 1 支海军') >= 0 && logs.indexOf('各建设 1 支陆军') >= 0, logs)
	check('B3j 卡入弃牌堆', (g.discard['美国'] || []).indexOf('17532#1') >= 0)
}

/* B4 反向顺序（choice=1：先陆军后海军） */
{
	const g = setup17532()
	T.action(g, 'Allies', 'play_card', {
		card: '17532#1', choice: 1, pieces: ['usaA'],
		spaces: [null, sea('印度'), sea('阿拉伯海')],
	})
	check('B4a 选中的陆军被移除', !g.location['usaA'])
	check('B4b 印度建成陆军',
		Object.keys(g.location).some(p => g.location[p] === sea('印度') &&
			g.piece_nation[p] === '美国' && g.piece_type[p] === 'army'))
	check('B4c 阿拉伯海建成海军',
		Object.keys(g.location).some(p => g.location[p] === sea('阿拉伯海') &&
			g.piece_nation[p] === '美国' && g.piece_type[p] === 'navy'))
}

console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' FAILED'))
process.exit(fails === 0 ? 0 : 1)
