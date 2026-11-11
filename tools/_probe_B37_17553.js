/*
 * B37 只读探针：17553《抗日义勇军》—— 「日本无手牌也扣分」定性。
 * 真实引擎函数 offer_us_japan_delegate / resolve_us_japan_delegate 驱动，不改产品代码。
 * 用法：node tools/_probe_B37_17553.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const J = x => JSON.stringify(x)
const faceOf = x => String(x).split('#')[0]

function board(opt) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_ask = null; g.us_japan_delegate = null
	g.econ_return_active = null
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.turn_phase = 'play'
	I.refresh(g)
	/* 美国桌面持有 17553（摆初始局面） */
	g.table['美国'] = ['17553#1']
	/* 日本手牌/牌库按场景设置 */
	g.hands['日本'] = opt.jpHand ? ['15300#1', '15300#2'] : []
	g.decks['日本'] = []
	for (let i = 0; i < opt.jpDeck; i++) g.decks['日本'].push('15300#' + (10 + i))
	g.score = { axis: 10, allies: 10 }
	I.refresh(g)
	return g
}

function trial(name, opt) {
	const g = board(opt)
	const before = { axis: g.score.axis, allies: g.score.allies }
	const hand0 = (g.hands['日本'] || []).length
	const deck0 = (g.decks['日本'] || []).length
	const n0 = (g.log || []).length
	/* 引擎函数触发（中国建设/征召/被攻击都会走到它） */
	I.offer_us_japan_delegate(g, '中国建设')
	const afterOffer = { axis: g.score.axis, allies: g.score.allies }
	let delegated = !!g.us_japan_delegate
	/* 若建立让权，走真实 action 结算 */
	if (delegated) {
		const card = (g.hands['日本'] || [])[0]
		R.action(g, 'Axis', 'resolve_japan_delegate', { card: card })
	}
	console.log('\n=== ' + name + ' ===')
	console.log('  初始: 日本手牌=' + hand0 + ' 牌库=' + deck0 +
		' 分数=' + J(before))
	console.log('  触发日志: ' + (g.log || []).slice(n0).join(' | ').slice(0, 320))
	console.log('  是否建立让权挂起 = ' + delegated)
	console.log('  分数变化: ' + J(before) + ' -> ' + J(g.score) +
		'（触发瞬间 ' + J(afterOffer) + '）')
	console.log('  日本 手牌=' + (g.hands['日本'] || []).length +
		' 牌库=' + (g.decks['日本'] || []).length +
		' 弃牌堆=' + (g.discard['日本'] || []).length)
	console.log('  us_japan_delegate = ' + J(g.us_japan_delegate))
	console.log('  active=' + g.active + ' current_nation=' + g.current_nation)
}

trial('A 日本有手牌 + 牌库有牌（正常）', { jpHand: true, jpDeck: 3 })
trial('B 日本有手牌 + 牌库空', { jpHand: true, jpDeck: 0 })
trial('C 日本无手牌 + 牌库有牌', { jpHand: false, jpDeck: 3 })
trial('D ★ 日本无手牌 + 牌库空（玩家报障场景）', { jpHand: false, jpDeck: 0 })

console.log('\n=== E. attrition_passive 语义对照（rtt-discard 铁律）===')
{
	const g = board({ jpHand: false, jpDeck: 0 })
	const n0 = (g.log || []).length
	const lost = I.attrition_passive(g, '日本', 1)
	console.log('  attrition_passive(日本,1) 返回长度=' + lost.length +
		' attrition_short=' + lost.attrition_short +
		' 分数=' + J(g.score))
	console.log('  日志: ' + (g.log || []).slice(n0).join(' | '))
}
