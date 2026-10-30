/*
 * 批 4 回归：15352/16700 扩展为「打出 + 触发」均可拦截
 *
 *   A. 15205（德国·装载型）触发 -> 英国 15352 拦：效果不发生、卡进弃牌堆、代价照付
 *   B. 同上但英国【放弃】：效果照常（15205 建立战斗预算）
 *   C. 无拦截方：不问、不残留窗口
 *   D. 多步卡（16803 尼米兹，need:'space'）触发被拦：gathered 作废、无残留 pending_armed_use
 *   E. 层级上限：__echo_chain_depth 达 3 时不再开窗（日志提示）
 *   F. 16700 代价已改为声明式（view 里能拿到 attrition 1，客户端可显示）
 *   G. 静态：suspend 函数按 via 分流、日志措辞"触发/打出"
 *
 * 用法：node tools/_smoke_armed_trigger_intercept.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const C = require(path.join(MOD, 'cards.js'))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const inHand = (g, n, c) => (g.hands[n] || []).indexOf(c) >= 0

/* 通用布阵：德国持有 15205 待触发；英国握 15352（拦截方） */
function setup(withUk = true, chainDepth = 0) {
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'; g.neutral = {}
	g.hands['德国'] = ['15205#1', '15341#1', '15341#2']
	g.decks['德国'] = ['15345#1', '15345#2', '15345#3', '15345#4']
	g.hands['英国'] = withUk ? ['15352#1', '15341#70'] : ['15341#70']
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.location['de_a'] = d.id_of('德国'); g.piece_nation['de_a'] = '德国'; g.piece_type['de_a'] = 'army'
	I.refresh(g)
	if (chainDepth) g.__echo_chain_depth = chainDepth
	return g
}

/* 让 15205 进入 after_deploy_air 触发窗口 */
function armTrigger(g) {
	I.offer_armed_effects(g, 'after_deploy_air', { nation: '德国', space: d.id_of('德国') })
	const w = (g.armed_offers || []).find(x => x.when === 'after_deploy_air')
	return w && (w.cards || []).some(c => c.card_id === '15205#1')
}

console.log('\n=== A：触发 -> 英国 15352 拦截 ===')
{
	const g = setup(true)
	ok('触发窗口里有 15205', armTrigger(g))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: '15205#1', space: d.id_of('法国') })
	const lg = (g.log || []).slice(n0).join(' | ')
	console.log('  log: ' + lg)
	ok('开窗等待英国', (g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	ok('日志用「触发」措辞', lg.indexOf('触发增强《JU-87 俯冲轰炸机》') >= 0, lg)
	ok('pending_armed_use 已挂起', !!g.pending_armed_use && g.pending_armed_use.via === 'trigger',
		JSON.stringify(g.pending_armed_use && { via: g.pending_armed_use.via, card: g.pending_armed_use.card }))

	const d0 = (g.decks['德国'] || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#70'] })
	ok('15205 进德国弃牌堆（本次触发作废）', inDisc(g, '德国', '15205#1'),
		JSON.stringify(g.discard['德国']))
	ok('★ 代价照付：德国损耗 1 张', (g.decks['德国'] || []).length === d0 - 1,
		d0 + ' -> ' + (g.decks['德国'] || []).length)
	ok('没有建立战斗预算（效果不发生）', !g.event_budget && !g.pending_battle,
		JSON.stringify({ budget: !!g.event_budget, battle: !!g.pending_battle }))
	ok('pending_armed_use 已清空', !g.pending_armed_use)
	ok('15352 已消耗', inDisc(g, '英国', '15352#1'))
}

console.log('\n=== B：触发 -> 英国【放弃】-> 效果照常 ===')
{
	const g = setup(true)
	armTrigger(g)
	R.action(g, 'Axis', 'use_armed_offer', { card: '15205#1', space: d.id_of('法国') })
	ok('已开窗', (g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	R.action(g, 'Allies', 'skip_armed_offer', {})
	ok('放弃后无残留挂起', !g.pending_armed_use)
	ok('放弃后无拦截窗口', !(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	/* 15205 run 建立战斗预算（r.budget）-> 卡留手牌 */
	ok('效果继续（15205 仍在手牌，等待打战斗）', inHand(g, '德国', '15205#1'),
		JSON.stringify(g.hands['德国']))
	ok('15352 未被消耗', inHand(g, '英国', '15352#1'))
}

console.log('\n=== C：无拦截方 ===')
{
	const g = setup(false)
	armTrigger(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: '15205#1', space: d.id_of('法国') })
	const lg = (g.log || []).slice(n0).join(' | ')
	ok('不问拦截（无窗口）', !(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'), lg)
	ok('直接执行（无"等待应答"日志）', lg.indexOf('等待【') < 0, lg)
}

console.log('\n=== D：多步卡触发被拦 -> gathered 作废 ===')
{
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'; g.neutral = {}
	g.hands['美国'] = ['16803#1', '15341#1']
	g.decks['美国'] = ['15345#1', '15345#2']
	g.hands['意大利'] = ['16700#1', '15341#70', '15341#71'] /* 意大利 16700 拦 Enhancement */
	g.decks['意大利'] = ['15345#80', '15345#81']
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.location['us_a'] = d.id_of('美国'); g.piece_nation['us_a'] = '美国'; g.piece_type['us_a'] = 'army'
	I.refresh(g)
	I.offer_armed_effects(g, 'after_build_navy', { nation: '美国', space: d.id_of('美国') })
	const w = (g.armed_offers || []).find(x => x.when === 'after_build_navy')
	ok('16803 出现在 after_build_navy 窗口',
		!!(w && (w.cards || []).some(c => c.card_id === '16803#1')),
		JSON.stringify(w && w.cards && w.cards.map(c => c.card_id)))
	/* 触发 -> 需要选地区（need:'space'），此时不该先问拦截（要等有实际效果时） */

	if (w && (w.cards || []).some(c => c.card_id === '16803#1')) {
		R.action(g, 'Allies', 'use_armed_offer', { card: '16803#1' })
		const win2 = (g.armed_offers || []).some(x => x.when === 'enemy_echo_played')
		console.log('  触发(未选地区) 开窗=' + win2 + ' pending=' + JSON.stringify(g.pending_armed_use && {
			via: g.pending_armed_use.via, card: g.pending_armed_use.card,
		}))
		ok('触发需选参数时也先问拦截（效果尚未落地）', win2)
		if (win2) {
			R.action(g, 'Axis', 'use_armed_offer', { card: '16700#1' })
			ok('被拦后 gathered 作废（无残留 pending_armed_use）', !g.pending_armed_use,
				JSON.stringify(g.pending_armed_use))
			ok('16803 进美国弃牌堆', inDisc(g, '美国', '16803#1'), JSON.stringify(g.discard['美国']))
		}
	}
}

console.log('\n=== E：层级上限（__echo_chain_depth >= 3 不再开窗）===')
{
	const g = setup(true, 3)
	armTrigger(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: '15205#1', space: d.id_of('法国') })
	const lg = (g.log || []).slice(n0).join(' | ')
	console.log('  log: ' + lg)
	ok('不再开窗', !(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'), lg)
	ok('日志提示层级上限', lg.indexOf('拦截链已达上限') >= 0, lg)
}

console.log('\n=== F：16700 代价声明式（客户端可显示）===')
{
	const EE = I.ECHO_EFFECTS || {}
	const ar = (EE['16700'] || {}).armed || {}
	ok('armed.cost.attrition === 1', ar.cost && ar.cost.attrition === 1, JSON.stringify(ar.cost))
	ok('run 里不再自己扣损耗', String(ar.run).indexOf("attrition_cards(game, '意大利', 1)") < 0)
}

console.log('\n=== G：静态结构 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('suspend_armed_use_for_intercept 存在', src.indexOf('function suspend_armed_use_for_intercept(') > 0)
	ok('via 分流存在', /const via = \(off\.when === 'enemy_echo_played'\) \? 'play' : 'trigger'/.test(src))
	ok('CHAIN_CAP = 3', /const CHAIN_CAP = 3/.test(src))
	ok('触发防抖 __trigger_intercept_done', src.indexOf('__trigger_intercept_done') > 0)
	ok('开窗前代价预检（损耗不足不开窗）', src.indexOf('需损耗 \' + _attrNeed + \' 张牌，但牌库不足（未发动）') > 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
