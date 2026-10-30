/*
 * 场景模拟：意大利【出牌阶段开始时】打出 16701《意大利万岁》
 *   意大利手里另有 16700《一日之狮》（只拦"非轴心"的增强卡 -> 对自己无效）
 *   英国手里 15352《布莱切利园》（拦"非同盟"的增强卡 -> 命中了 16701）
 *   英国还有其它手牌、意大利牌库有牌
 *
 * 分别构建：英国【发动】拦截 / 【不发动】
 * 每种情况都同时打印【服务端结果】与【双方客户端 view】（按钮文案、可点性）
 *
 * 用法：node tools/_sim_16701_15352.js
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
const handLen = (g, n) => (g.hands[n] || []).length

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['意大利'] = ['16701#1', '16700#2', '15341#20']
	g.hands['英国'] = ['15352#1', '15341#7', '15342#8']
	g.decks['意大利'] = ['15345#80', '15345#81', '15345#82', '15345#83', '15345#84']
	g.table_responses = []
	g.armed_offers = []
	g.echo_intercept_queue = []
	g.echo_intercept_skipped = {}
	delete g.__skip_echo_intercept
	I.refresh && I.refresh(g)
	return g
}

/* 客户端（play.js:2462-2504）会渲染成的按钮 + 点击后要发的 action */
function clientButtons(v) {
	const ao = v && v.armed_offer
	if (!ao || !ao.cards || !ao.cards.length) return []
	const out = ao.cards.map(c => {
		const att = (c.cost && c.cost.attrition) || 0
		const dis = (c.cost && c.cost.discard) || 0
		return {
			label: '打出《' + c.name + '》' + (att ? '（损耗 ' + att + '）' : (dis ? '（弃 ' + dis + ' 张）' : '')),
			card: c.card, name: c.name,
			sends: dis ? 'use_armed_offer {card, drop:[选 ' + dis + ' 张]}'
				: 'use_armed_offer {card}',
		}
	})
	out.push({ label: '不打出', sends: 'skip_armed_offer {}' })
	return out
}

function dump(name, g, role) {
	const v = view(g, role)
	console.log('  [' + name + '·' + role + ' view] armed_offer=' +
		JSON.stringify(v.armed_offer ? {
			nation: v.armed_offer.nation,
			cards: (v.armed_offer.cards || []).map(c => c.name),
		} : null))
	console.log('  [' + name + '·' + role + ' view] 按钮=' + JSON.stringify(clientButtons(v).map(b => b.label)))
}

console.log('\n==================================================')
console.log('阶段说明：16701 的时点 = 出牌阶段开始时（CARD_TRIGGERS.kind="play_start"）')
console.log('  允许条件：turn_phase=play、本方回合、play_done 未置位')
console.log('==================================================')

console.log('\n=== 步骤 0：意大利打出 16701（尚未有人应答） ===')
const g0 = fresh()
R.action(g0, 'Axis', 'play_card', { card: '16701#1' })
console.log('  日志: ' + (g0.log || []).slice(-2).join(' | '))
console.log('  窗口: ' + JSON.stringify((g0.armed_offers || []).map(w => w.when + '@' + w.nation)))
console.log('  it_viva=' + g0.it_viva + '  active=' + g0.active)
dump('待应答', g0, 'Axis')
dump('待应答', g0, 'Allies')
ok('挂起并让权给英国', g0.active === 'Allies', 'active=' + g0.active)
ok('窗口归属英国且只有 15352', (g0.armed_offers || []).length === 1 &&
	(g0.armed_offers[0].cards || []).length === 1 &&
	g0.armed_offers[0].cards[0].card_id === '15352#1',
	JSON.stringify((g0.armed_offers[0] || {}).cards))
ok('意大利的 16700 没有参与（它只拦非轴心的增强卡）',
	(g0.armed_offers[0].cards || []).every(c => c.card_id !== '16700#2'))
ok('16701 尚未结算、仍在手牌', inHand(g0, '意大利', '16701#1'))
ok('效果未生效（it_viva 未置位）', !g0.it_viva)
ok('英国客户端按钮带代价文案「弃 1 张」',
	clientButtons(view(g0, 'Allies'))[0].label === '打出《布莱切利园》（弃 1 张）',
	clientButtons(view(g0, 'Allies'))[0].label)
ok('意大利客户端看不到该窗口（窗口属于英国）', !view(g0, 'Axis').armed_offer)

console.log('\n=== 情况 A：英国【发动】15352（弃 1 张手牌）—— 2026-10-29 起会先问意大利 16700 反制 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '16701#1' })
	const ukHand0 = handLen(g, '英国')
	/* 客户端：点「打出《布莱切利园》（弃 1 张）」-> 弹弃牌框 -> 选 15341#7 -> use_armed_offer{card,drop} */
	R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#7'] })
	console.log('  英国打出后日志: ' + (g.log || []).slice(-2).join(' | '))
	ok('★ 英国打 15352 时给意大利开了反制窗',
		(g.armed_offers || []).some(w => w.when === 'enemy_echo_played' && w.nation === '意大利'),
		JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation)))
	/* 客户端：意大利点「不打出」（放弃反制） */
	R.action(g, 'Axis', 'skip_armed_offer', {})
	console.log('  日志: ' + (g.log || []).slice(-4).join(' | '))
	console.log('  英国手牌 ' + ukHand0 + ' -> ' + handLen(g, '英国') +
		'，active=' + g.active + '，it_viva=' + g.it_viva)
	ok('15352 进英国弃牌堆', inDisc(g, '英国', '15352#1'))
	ok('代价手牌 15341#7 也已弃置（共 -2 张）', handLen(g, '英国') === ukHand0 - 2,
		ukHand0 + ' -> ' + handLen(g, '英国'))
	ok('16701 被拦，进意大利弃牌堆', inDisc(g, '意大利', '16701#1'))
	ok('16701 效果【不生效】（it_viva 未置位）', !g.it_viva)
	ok('窗口关闭', !view(g, 'Allies').armed_offer)
	ok('操作权归还意大利（Axis）', g.active === 'Axis', 'active=' + g.active)
	ok('日志含"效果无效"', /无效/.test((g.log || []).join(' ')))
	ok('意大利的 16700 仍在手牌（没被误用）', inHand(g, '意大利', '16700#2'))
	dump('A 结算后', g, 'Axis')
}

console.log('\n=== 情况 B：英国【不发动】 ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '16701#1' })
	const ukHand0 = handLen(g, '英国')
	/* 客户端：点「不打出」-> skip_armed_offer {} */
	R.action(g, 'Allies', 'skip_armed_offer', {})
	console.log('  日志: ' + (g.log || []).slice(-3).join(' | '))
	console.log('  英国手牌 ' + ukHand0 + ' -> ' + handLen(g, '英国') +
		'，active=' + g.active + '，it_viva=' + g.it_viva)
	ok('16701 照常结算（进意大利弃牌堆）', inDisc(g, '意大利', '16701#1'))
	ok('16701 效果【生效】（it_viva=true）', g.it_viva === true, 'it_viva=' + g.it_viva)
	ok('英国没付代价（手牌数不变）', handLen(g, '英国') === ukHand0)
	ok('15352 仍在英国手里', inHand(g, '英国', '15352#1'))
	ok('窗口关闭', !view(g, 'Allies').armed_offer)
	ok('操作权归还意大利', g.active === 'Axis', 'active=' + g.active)
	dump('B 结算后', g, 'Axis')
}

console.log('\n=== 附：不发动后，同一张 15352 再遇下一张意大利增强卡（是否仍会问） ===')
{
	const g = fresh()
	R.action(g, 'Axis', 'play_card', { card: '16701#1' })
	R.action(g, 'Allies', 'skip_armed_offer', {})
	/* 意大利再打一张增强卡（16700 自己不行，用 16701 已用过；这里直接派发等价事件验证窗口会重开） */
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '意大利', card: '15341#20' })
	const w = (g.armed_offers || [])[0]
	ok('换一张卡时会重新开窗（按卡实例记忆，不粘）', !!w && w.cards[0].card_id === '15352#1',
		JSON.stringify((w || {}).cards))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
