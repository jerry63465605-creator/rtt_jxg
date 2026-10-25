/*
 * 【2026-10-25 排查】意大利手牌【无响应卡】时打出 17721《钢铁条约》是否卡死。
 *
 * 卡面：打出1张[响应卡]。德国打出1张[状态卡]。
 * 实现：run 只 grant_extra_play(意大利, filter:'response')；
 *       意大利打出那张响应牌后（extra 通道）才 set_pending_delegate(chain) 给德国。
 * 疑点：若意大利手牌里根本没有响应牌，这次额外打出永远不会被消耗
 *       -> 链式委托永远不会建立 -> 卡停在"等意大利打响应牌"这一步。
 *
 * 用法：node tools/_repro_17721_no_response.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

function dump(tag, g) {
	const v = rules.view(g, 'Axis')
	console.log('\n---- ' + tag + ' ----')
	console.log('  current_nation =', g.current_nation, '  phase =', g.turn_phase)
	console.log('  extra_play     =', JSON.stringify(g.extra_play))
	console.log('  delegate       =', JSON.stringify(g.delegate))
	console.log('  pending_event_step =', JSON.stringify(g.pending_event_step))
	console.log('  block_reason   =', v.block_reason)
	console.log('  actions        =', JSON.stringify(Object.keys(v.actions || {}).sort()))
}

/* ==== 场景 A：意大利手牌【只有】17721，没有任何响应牌 ==== */
{
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '意大利'
	g.turn_phase = 'play'
	g.active = 'Axis'
	/* 只留一张 17721，确保手牌里没有 RESPONSE */
	g.hands['意大利'] = ['17721#1']
	const types = (g.hands['意大利'] || []).map(id => {
		const c = I.inst_card(id)
		return (c && c.type) || '?'
	})
	console.log('意大利手牌 =', JSON.stringify(g.hands['意大利']), ' 类型 =', JSON.stringify(types))
	dump('A0 打出前', g)

	const l0 = g.log.length
	rules.action(g, 'Axis', 'play_card', { card: '17721#1' })
	console.log('\n  出牌日志 =', g.log.slice(l0).join(' | '))
	dump('A1 打出 17721 之后', g)

	/* 试着推进阶段，看是否被拦 */
	const l1 = g.log.length
	rules.action(g, 'Axis', 'next_phase', {})
	console.log('\n  next_phase 日志 =', g.log.slice(l1).join(' | '))
	dump('A2 推进阶段之后', g)
}

/* ==== 场景 B（对照）：手牌里有响应牌 ==== */
{
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '意大利'
	g.turn_phase = 'play'
	g.active = 'Axis'
	/* 意大利响应卡：17730 贝尔萨列里神射手团 等；这里直接找一张 RESPONSE */
	g.hands['意大利'] = ['17721#1', '17730#1']
	const types = (g.hands['意大利'] || []).map(id => {
		const c = I.inst_card(id)
		return ((c && c.nation) || '?') + '/' + ((c && c.type) || '?')
	})
	console.log('\n\n================ 场景 B（有响应牌）===============')
	console.log('意大利手牌 =', JSON.stringify(g.hands['意大利']), ' 类型 =', JSON.stringify(types))
	let l0 = g.log.length
	rules.action(g, 'Axis', 'play_card', { card: '17721#1' })
	console.log('  打出 17721 日志 =', g.log.slice(l0).join(' | '))
	dump('B1', g)
	l0 = g.log.length
	rules.action(g, 'Axis', 'play_card', { card: '17730#1' })
	console.log('  打出响应牌日志 =', g.log.slice(l0).join(' | '))
	dump('B2 打出响应牌之后', g)

	/* 德国手牌清空 -> 委托链里德国没有状态卡可打，看是否有退出动作 */
	g.hands['德国'] = []
	const l2 = g.log.length
	rules.action(g, 'Axis', 'event_delegate_decline', {})
	console.log('  decline 日志 =', g.log.slice(l2).join(' | '))
	dump('B3 德国放弃之后', g)
}

/* ==== 场景 C：意大利打出响应牌后，德国手里【无状态卡】 -> 是否卡死 ==== */
{
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '意大利'
	g.turn_phase = 'play'
	g.active = 'Axis'
	g.hands['意大利'] = ['17721#1', '17730#1']
	g.hands['德国'] = ['15200#1']   /* 建设陆军 = BASIC，不是状态卡 */
	console.log('\n\n================ 场景 C（德国无状态卡）===============')
	let l0 = g.log.length
	rules.action(g, 'Axis', 'play_card', { card: '17721#1' })
	rules.action(g, 'Axis', 'play_card', { card: '17730#1' })
	console.log('  日志 =', g.log.slice(l0).join(' | '))
	dump('C1 委托给德国之后', g)
	const v = rules.view(g, 'Axis')
	console.log('  德国（=本方轴心）可点动作 =', JSON.stringify(Object.keys(v.actions || {}).sort()))
	console.log('  => 是否有放弃出口 event_delegate_decline：',
		!!v.actions['event_delegate_decline'])
}
