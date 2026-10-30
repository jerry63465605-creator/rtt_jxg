/*
 * 客户端视角模拟：16700《一日之狮》现有实现（armed 窗口）
 *
 * 说明：16700 只拦【敌方】= 非轴心国的增强卡，所以发起方取英国（同盟）。
 * 英国在"出牌阶段"没有可直接打出的增强卡（15305/15306 都是特定阶段、
 * 15311/15352/15353/15355 是响应/触发驱动），故这里用【派发点等价调用】
 * I.offer_armed_effects(g,'enemy_echo_played',{nation:'英国',card:...})
 * 直接模拟"英国刚打出一张增强卡"，拦截侧的 UI/结算全部走真实 view/action。
 *
 * 模拟依据 play.js:2462-2504：
 *   · 每张候选一个按钮「打出《X》（损耗N）/（弃N张）」—— N 取自 cost.attrition/discard
 *   · 点按钮 -> use_armed_offer {card}；「不打出」-> skip_armed_offer {}
 *
 * 用法：node tools/_sim_16700_client.js
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
const view = (g, role) => R.view(g, role)
const inHand = (g, n, c) => (g.hands[n] || []).indexOf(c) >= 0
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const deckLen = (g, n) => ((g.decks && g.decks[n]) || []).length

function fresh(opt) {
	opt = opt || {}
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.hands['英国'] = ['15305#1', '15341#7']
	g.hands['意大利'] = opt.itHand || ['16700#1', '15341#11']
	g.decks['意大利'] = []
	for (let i = 0; i < (opt.deck == null ? 5 : opt.deck); i++) g.decks['意大利'].push('15345#8' + i)
	g.table_responses = []
	g.echo_intercept_queue = []
	I.refresh && I.refresh(g)
	return g
}
/* 客户端会渲染出的按钮（含代价文案） */
function clientButtons(v) {
	const ao = v.armed_offer
	if (!ao || !ao.cards || !ao.cards.length) return []
	return ao.cards.map(c => {
		const att = (c.cost && c.cost.attrition) || 0
		const dis = (c.cost && c.cost.discard) || 0
		return {
			card: c.card, name: c.name, nation: c.nation, att: att, dis: dis,
			label: '打出《' + c.name + '》' + (att ? '（损耗 ' + att + '）' : (dis ? '（弃 ' + dis + ' 张）' : '')),
		}
	})
}
const fire = (g, card) => I.offer_armed_effects(g, 'enemy_echo_played', { nation: '英国', card: card })

console.log('\n=== S1｜意大利有 16700、牌库 5 张 → 客户端看到的窗口 ===')
{
	const g = fresh()
	fire(g, '15305#1')
	const vi = view(g, '意大利')
	const btns = clientButtons(vi)
	console.log('  客户端按钮: ' + JSON.stringify(btns))
	console.log('  窗口归属=' + (vi.armed_offer && vi.armed_offer.nation) + '  active=' + g.active)
	ok('窗口给出且归属意大利', !!(vi.armed_offer && vi.armed_offer.nation === '意大利'))
	ok('⚠ 客户端不显示代价（cost 里没有 attrition，代价在 run 内部扣）',
		btns.length === 1 && btns[0].att === 0 && btns[0].dis === 0, JSON.stringify(btns[0]))

	/* 客户端点「打出《一日之狮》」 */
	const d0 = deckLen(g, '意大利')
	R.action(g, 'Axis', 'use_armed_offer', { card: '16700#1' })
	ok('意大利损耗 1 张', deckLen(g, '意大利') === d0 - 1, 'deck ' + d0 + ' -> ' + deckLen(g, '意大利'))
	ok('16700 进意大利弃牌堆', inDisc(g, '意大利', '16700#1'))
	ok('被拦的英国增强卡进弃牌堆', inDisc(g, '英国', '15305#1'))
	ok('窗口关闭', !view(g, '意大利').armed_offer)
	ok('操作权归还发起方（Allies）', g.active === 'Allies', 'active=' + g.active)
}

console.log('\n=== S2｜客户端点「不打出」 ===')
{
	const g = fresh()
	fire(g, '15305#1')
	R.action(g, 'Axis', 'skip_armed_offer', {})
	ok('窗口关闭', !view(g, '意大利').armed_offer)
	ok('意大利没付代价', deckLen(g, '意大利') === 5)
	ok('16700 仍在手牌', inHand(g, '意大利', '16700#1'))
	ok('英国那张卡没被丢弃（仍在手，交由续跑结算）', inHand(g, '英国', '15305#1'))
	console.log('  日志: ' + (g.log || []).slice(-3).join(' | '))
}

console.log('\n=== S3｜意大利牌库 0 → 不该开窗 ===')
{
	const g = fresh({ deck: 0 })
	fire(g, '15305#1')
	ok('没有窗口', !view(g, '意大利').armed_offer)
}

console.log('\n=== S4｜窗口开着时意大利牌库被清空（代价付不起）→ 点「打出」会怎样 ===')
{
	const g = fresh()
	fire(g, '15305#1')
	ok('先有窗口', !!(view(g, '意大利').armed_offer))
	g.decks['意大利'] = []                    /* 代价被别的东西吃掉（模拟） */
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: '16700#1' })
	const lg = (g.log || []).slice(n0).join(' | ')
	console.log('  点打出后: ' + (lg || '（无日志）'))
	const vAfter = view(g, '意大利')
	console.log('  窗口=' + JSON.stringify((vAfter.armed_offer || {}).nation || null) +
		' 16700=' + (inHand(g, '意大利', '16700#1') ? '仍在手' : '已消耗') +
		' 英国卡=' + (inHand(g, '英国', '15305#1') ? '仍在手' : '已丢弃') +
		' active=' + g.active)
	ok('⚠ 付不起时点「打出」= 什么都没发生（不扣牌、不拦截、窗口仍在）',
		!!vAfter.armed_offer && inHand(g, '意大利', '16700#1') && inHand(g, '英国', '15305#1'))
}

console.log('\n=== S5｜同阵营双卡：15352(英) 与 16700(意) 会不会被塞进同一窗口 ===')
{
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '英国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.hands['英国'] = ['15352#1', '15341#7']
	g.hands['意大利'] = ['16700#1', '15341#11']
	g.decks['意大利'] = ['15345#80']
	I.refresh && I.refresh(g)
	/* 英国打增强卡：15352 的 ready 排除同盟自己 -> 只剩 16700 候选；反之亦然 */
	fire(g, '15305#1')
	const v1 = view(g, '意大利')
	console.log('  英国发起时窗口卡: ' + JSON.stringify(clientButtons(v1).map(b => b.nation + '/' + b.name)))
	ok('英国发起：只有意大利的 16700 进窗口（15352 不拦自己的阵营）',
		clientButtons(v1).every(b => b.nation === '意大利'), JSON.stringify(clientButtons(v1)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
