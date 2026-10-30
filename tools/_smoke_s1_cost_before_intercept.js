/*
 * S1 批 2 回归：增强卡【先付代价 -> 再问拦截 -> 被拦只取消效果】
 *
 *   ① pay_event_cost 单元（attrition / discard / filter / needBuild 函数代价）
 *   ② __echo_cost_paid 守卫：resolve_event_card 不二次扣代价
 *   ③ 集成：4 张代表卡（损耗型 / 弃置型 / 限定响应牌型）—— 有拦截方 与 无拦截方 两种
 *   ④ 静态：play_card 里"付代价"在"派发拦截窗口"之前
 *
 * 用法：node tools/_smoke_s1_cost_before_intercept.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0

console.log('\n=== ① pay_event_cost 单元 ===')
{
	const g = R.setup(7)
	g.opening = null
	g.hands['德国'] = ['15209#1', '15244#9', '15241#8', '15341#7']
	g.decks['德国'] = ['15345#1', '15345#2', '15345#3']
	I.refresh(g)

	/* attrition：牌堆 3 -> 2 */
	const d0 = (g.decks['德国'] || []).length
	const r1 = I.pay_event_cost(g, '德国', '15209#1', { cost: { attrition: 1 } }, {})
	ok('attrition 生效', r1.ok === true && (g.decks['德国'] || []).length === d0 - 1,
		JSON.stringify(r1) + ' deck ' + d0 + '->' + (g.decks['德国'] || []).length)
	ok('descs 记录代价', (r1.descs || []).join('.').indexOf('损耗 1 张牌') >= 0, JSON.stringify(r1.descs))

	/* discard 2 */
	const h0 = (g.hands['德国'] || []).length
	const r2 = I.pay_event_cost(g, '德国', '15209#1', { cost: { discard: 2 } }, {})
	ok('discard 2 生效', r2.ok === true && (g.hands['德国'] || []).length === h0 - 2,
		JSON.stringify(r2) + ' hand ' + h0 + '->' + (g.hands['德国'] || []).length)
	ok('被弃的牌进弃牌堆', (g.discard['德国'] || []).length >= 2)

	/* 付不起 -> ok:false 且不扣 */
	const d1 = (g.decks['德国'] || []).length
	const r3 = I.pay_event_cost(g, '德国', '15209#1', { cost: { attrition: 99 } }, {})
	ok('付不起返回 ok:false 且不扣', r3.ok === false && (g.decks['德国'] || []).length === d1,
		JSON.stringify(r3))

	/* 函数代价 */
	const r4 = I.pay_event_cost(g, '德国', '15209#1', { cost: { discard: () => 1 } }, {})
	ok('函数代价被求值', r4.ok === true, JSON.stringify(r4))
}

console.log('\n=== ② __echo_cost_paid 守卫（不二次扣） ===')
{
	const g = R.setup(7)
	g.opening = null
	g.hands['德国'] = ['15209#1', '15244#9', '15241#8']
	g.decks['德国'] = ['15345#1', '15345#2', '15345#3']
	I.refresh(g)
	const d0 = (g.decks['德国'] || []).length
	I.pay_event_cost(g, '德国', '15209#1', { cost: { attrition: 1 } }, {})
	const d1 = (g.decks['德国'] || []).length
	/* 标记"本次已付"，再走 resolve_event_card 的代价段不应重复扣 */
	g.__echo_cost_paid = { '15209#1': I.freq_key(g) }
	const r = I.resolve_event_card(g, '德国', '15209#1', {})
	ok('已付过 -> 不再扣', (g.decks['德国'] || []).length === d1,
		d1 + ' -> ' + (g.decks['德国'] || []).length + ' resolve.reason=' + JSON.stringify(r && r.reason))
}

console.log('\n=== ③ 集成：代表卡 ===')
function makeGame(nation, cards, interceptor, phase) {
	const g = R.setup(7)
	g.opening = null
	g.current_nation = nation
	g.active = I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis'
	g.turn_phase = phase || 'play'
	g.neutral = {}
	g.play_done = {}
	const isAllies = I.faction_of_nation(nation) === 'allies'
	g.hands[nation] = cards.slice()
	g.decks[nation] = ['15345#1', '15345#2', '15345#3', '15345#4']
	if (interceptor) {
		/* 拦截方 = 敌对阵营 */
		if (isAllies) { g.hands['意大利'] = ['16700#2', '15341#70']; g.decks['意大利'] = ['15345#80', '15345#81'] }
		else { g.hands['英国'] = ['15352#1', '15341#71']; g.decks['英国'] = ['15345#90', '15345#91'] }
	}
	I.refresh(g)
	return g
}
const SIDE = n => (I.faction_of_nation(n) === 'allies' ? 'Allies' : 'Axis')

/* A. 15209 伞兵（德国，损耗 1） */
{
	const g = makeGame('德国', ['15209#1', '15244#9', '15241#8'], true)
	const d0 = (g.decks['德国'] || []).length
	R.action(g, 'Axis', 'play_card', { card: '15209#1' })
	const win = (g.armed_offers || []).some(w => w.when === 'enemy_echo_played')
	ok('开窗等待拦截', win, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★ 代价在开窗前已付（牌堆 -1）', (g.decks['德国'] || []).length === d0 - 1,
		d0 + ' -> ' + (g.decks['德国'] || []).length)
	/* 拦截方发动 */
	R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#71'] })
	ok('拦截后卡进弃牌堆', inDisc(g, '德国', '15209#1'), JSON.stringify(g.discard['德国'] || []))
	ok('★ 代价不退（牌堆仍是 -1）', (g.decks['德国'] || []).length === d0 - 1)
	ok('拦截方付了自己代价', inDisc(g, '英国', '15341#71'))
}

/* B. 15306 英联邦殖民地民兵（英国，弃 2 手牌，【计分阶段开始时】），拦截方 16700 */
{
	const g = makeGame('英国', ['15306#1', '15341#1', '15341#2', '15341#3'], true, 'scoring')
	const h0 = (g.hands['英国'] || []).length
	R.action(g, 'Allies', 'play_card', { card: '15306#1' })
	ok('开窗', (g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	ok('★ 代价在开窗前已付（手牌 -2）', (g.hands['英国'] || []).length === h0 - 2,
		h0 + ' -> ' + (g.hands['英国'] || []).length)
	R.action(g, 'Axis', 'use_armed_offer', { card: '16700#2' })
	ok('拦截后卡进弃牌堆', inDisc(g, '英国', '15306#1'), JSON.stringify(g.discard['英国'] || []))
	/* 手牌 = h0 - 2(代价) - 1(本卡进弃牌堆)；代价不退 = 弃牌堆里的代价牌不会回来 */
	ok('★ 代价不退（手牌 = 4-2-1，代价牌未退回）',
		(g.hands['英国'] || []).length === h0 - 3,
		'hand=' + (g.hands['英国'] || []).length + ' expect=' + (h0 - 3))
	ok('★ 代价牌仍在弃牌堆（未回滚）',
		(g.discard['英国'] || []).filter(x => x.indexOf('15341#') === 0).length >= 2,
		JSON.stringify(g.discard['英国'] || []))
}

/* C. 对照：无拦截方 -> 效果照常执行（不崩、卡进弃牌堆） */
{
	const g = makeGame('德国', ['15209#1', '15244#9', '15241#8'], false)
	const d0 = (g.decks['德国'] || []).length
	R.action(g, 'Axis', 'play_card', { card: '15209#1' })
	ok('无拦截方 -> 不残留窗口', (g.armed_offers || []).length === 0)
	ok('代价照付', (g.decks['德国'] || []).length === d0 - 1)
	ok('《' + nm('15209') + '》已打出（进弃牌堆或已装载）',
		inDisc(g, '德国', '15209#1') || (g.hands['德国'] || []).indexOf('15209#1') >= 0 ||
		!!g.us_fallschirm, JSON.stringify({ disc: g.discard['德国'] || [], flag: !!g.us_fallschirm }))
}

console.log('\n=== ④ 静态：付代价在派发之前 ===')
{
	const js = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const iPay = js.indexOf('S1】代价照付：在派发拦截窗口【之前】先把代价付掉')
	/* 只看 play_card 分支里那次派发（arm_intercept_after_cost 里也有一处，在文件更前面） */
	const iBranch = js.indexOf('const _echoSkipped =')
	const iArm = js.indexOf("offer_armed_effects(game, 'enemy_echo_played'", iBranch)
	ok('两段都存在', iPay > 0 && iArm > 0, 'pay=' + iPay + ' arm=' + iArm)
	ok('付代价代码在派发点之前', iPay > 0 && iPay < iArm)
	ok('pay_event_cost 已定义', js.indexOf('function pay_event_cost(') > 0)
	ok('resolve_event_card 有防重复守卫', js.indexOf("__echo_cost_paid || {})[card_id] !== freq_key(game)") > 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
