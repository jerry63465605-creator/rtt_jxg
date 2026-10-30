/*
 * 回归：调试面板三项能力（调试单位保持 / 调试卡牌 / 调试阶段）
 *   ① query debug_card_catalog：只返回【当前国家】的牌面
 *   ② action debug_add_card：实例 id 唯一、手牌 +1、日志有记录
 *   ③ action debug_set_phase：挂起态清空 + 国家/阶段落位 + 阶段入口真的执行
 *
 * 用法：node tools/_verify_debug_panel.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.turn_phase = 'play'
	I.refresh && I.refresh(g)
	return g
}

console.log('\n=== ① debug_card_catalog 只给当前国家的牌 ===')
{
	const g = fresh()
	const list = R.query(g, 'Axis', 'debug_card_catalog', {})
	console.log('  返回 ' + list.length + ' 张；样例: ' +
		list.slice(0, 4).map(c => c.face + '·' + c.name).join(', '))
	ok('数量 > 0', list.length > 0)
	ok('全部属于当前国家（意大利）', list.every(c => c.nation === '意大利'),
		JSON.stringify(Array.from(new Set(list.map(c => c.nation)))))
	ok('字段齐全（face/name/type/text）',
		list.every(c => c.face && c.name && c.type && typeof c.text === 'string'))
	const list2 = R.query(g, 'Axis', 'debug_card_catalog', { nation: '英国' })
	ok('可按参数指定国家（英国）', list2.every(c => c.nation === '英国'), 'n=' + list2.length)
}

console.log('\n=== ①b 德国目录：增强卡 type 必须是 EFFECT（曾误用 ECHO 导致筛选为空）===')
{
	const g = fresh()
	g.current_nation = '德国'
	const list = R.query(g, 'Axis', 'debug_card_catalog', {})
	const types = {}
	list.forEach(c => { types[c.type] = (types[c.type] || 0) + 1 })
	console.log('  德国目录 ' + list.length + ' 张，类型分布: ' + JSON.stringify(types))
	ok('德国目录有增强卡', (types.EFFECT || 0) > 0, JSON.stringify(types))
	ok('增强卡数量 = 13（与卡库一致）', types.EFFECT === 13, 'EFFECT=' + types.EFFECT)
	ok('不存在 type=ECHO 的牌', !types.ECHO, JSON.stringify(types))
	ok('按 EFFECT 过滤能得到这 13 张',
		list.filter(c => c.type === 'EFFECT').length === 13)
}

console.log('\n=== ② debug_add_card：加牌进当前国手牌 ===')
{
	const g = fresh()
	const before = (g.hands['意大利'] || []).length
	const face = '17746'
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'debug_add_card', { face })
	const hand = g.hands['意大利'] || []
	const added = hand[hand.length - 1]
	ok('手牌 +1', hand.length === before + 1, before + ' -> ' + hand.length)
	ok('实例 id 形如 face#N 且属于该面', /^17746#\d+$/.test(added), added)
	ok('实例 id 在整手牌中唯一', hand.filter(x => x === added).length === 1)
	ok('实例可解析回牌面', (I.inst_card(added) || {}).name === '耀武',
		(I.inst_card(added) || {}).name)
	ok('日志有记录', (g.log || []).slice(n0).join(' ').indexOf('加入《耀武》') >= 0,
		(g.log || []).slice(n0).join(' | '))
	/* 重复加同一张面：实例号必须继续递增 */
	R.action(g, 'Axis', 'debug_add_card', { face })
	const hand2 = g.hands['意大利'] || []
	ok('再加一张同名牌得到不同实例 id', hand2[hand2.length - 1] !== added,
		hand2.slice(-2).join(','))
	ok('未知面被拒绝', (() => {
		const n = hand2.length
		R.action(g, 'Axis', 'debug_add_card', { face: '999999' })
		return (g.hands['意大利'] || []).length === n
	})())
}

console.log('\n=== ③ debug_set_phase：清空挂起 + 落位 + 执行入口 ===')
{
	const g = fresh()
	/* 人为堆一些挂起态，验证会被清掉 */
	g.armed_offers = [{ when: 'enemy_echo_played', nation: '英国', cards: [] }]
	g.armed_offer = g.armed_offers[0]
	g.echo_intercept_queue = [{ card: '16701#1', nation: '意大利' }]
	g.response_stack = [{ x: 1 }]
	g.response_queue = [{ y: 1 }]
	g.status_instant = ['15341#1']
	g.pending_battle = { space: 1 }
	g.pending_event_step = { card_id: 'x' }
	g.play_done = { '意大利': true }
	g.__echo_chain_depth = 2

	const handBefore = (g.hands['英国'] || []).length
	R.action(g, 'Axis', 'debug_set_phase', { nation: '英国', phase: 'draw' })

	ok('挂起窗口全清', (g.armed_offers || []).length === 0 && !g.armed_offer)
	ok('队列/响应/状态窗口全清',
		(g.echo_intercept_queue || []).length === 0 &&
		(g.response_stack || []).length === 0 &&
		(g.response_queue || []).length === 0 &&
		(g.status_instant || []).length === 0)
	ok('战斗/分步挂起全清', !g.pending_battle && !g.pending_event_step)
	ok('本回合标记重置（play_done 清空）', !(g.play_done || {})['意大利'])
	ok('防抖标记归零', (g.__echo_chain_depth || 0) === 0)
	ok('国家落位', g.current_nation === '英国', g.current_nation)
	ok('阵营落位（英国→Allies）', g.active === 'Allies', g.active)
	ok('阶段落位', g.turn_phase === 'draw', g.turn_phase)
	ok('★ 阶段入口真的执行了（摸牌阶段写入 phase_note）',
		typeof g.phase_note === 'string' && g.phase_note.indexOf('摸牌阶段') >= 0,
		String(g.phase_note || '') + ' | 手牌 ' + handBefore + ' -> ' + (g.hands['英国'] || []).length)
	ok('日志有跳转记录', (g.log || []).join(' ').indexOf('跳到【英国】') >= 0)

	/* 非法阶段不应改动 */
	const n = (g.log || []).length
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'nope' })
	ok('未知阶段被拒绝且不改国家', g.current_nation === '英国',
		g.current_nation + ' / ' + (g.log || []).slice(n).join(' | '))
}

console.log('\n=== ③b 国家技能"本回合已用"会被重置 ===')
{
	const g = fresh()
	g.national_skill_used = { '意大利': g.turn, '德国': g.turn }
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	ok('目标国（意大利）已重置', !(g.national_skill_used || {})['意大利'],
		JSON.stringify(g.national_skill_used))
	ok('其它国（德国）保持原样', (g.national_skill_used || {})['德国'] === g.turn,
		JSON.stringify(g.national_skill_used))
}

console.log('\n=== ③c debug_add_card 的去向（牌库顶/牌库底/弃牌堆） ===')
{
	const g = fresh()
	const deck0 = (g.decks['意大利'] || []).slice()
	R.action(g, 'Axis', 'debug_add_card', { face: '17746', dest: 'deck_top' })
	const deck1 = g.decks['意大利'] || []
	ok('牌库顶：长度 +1 且位于最前', deck1.length === deck0.length + 1 &&
		/^17746#\d+$/.test(deck1[0]) && deck1[0] !== deck0[0],
		deck1.slice(0, 2).join(','))

	R.action(g, 'Axis', 'debug_add_card', { face: '16700', dest: 'deck_bottom' })
	const deck2 = g.decks['意大利'] || []
	ok('牌库底：位于最后', /^16700#\d+$/.test(deck2[deck2.length - 1]),
		deck2.slice(-2).join(','))

	const d0 = (g.discard['意大利'] || []).length
	R.action(g, 'Axis', 'debug_add_card', { face: '17731', dest: 'discard' })
	ok('弃牌堆：长度 +1', (g.discard['意大利'] || []).length === d0 + 1)
	ok('日志写明去向', (g.log || []).join(' ').indexOf('的牌库顶加入') >= 0,
		(g.log || []).slice(-3).join(' | '))
}

console.log('\n=== ④ 白名单：两个新动作对 AI/客户端可见 ===')
{
	const g = fresh()
	const acts = (typeof I.build_actions === 'function')
		? I.build_actions(g, 'Axis')
		: (R.view(g, 'Axis').actions || {})
	ok('debug_add_card 在 actions 里', !!acts.debug_add_card,
		Object.keys(acts).slice(0, 12).join(','))
	ok('debug_set_phase 在 actions 里', !!acts.debug_set_phase)
	ok('原有 debug_place 仍在', !!acts.debug_place)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
