/*
 * 回归：15406《南云忠一指挥航空队》的打出时点（2026-10-23）
 *
 * 卡面：**在海域部署或调度飞机后**，弃置 1 张[响应卡]：对相邻地区发起 1 次战斗。
 *
 * 现场（game 24）：日本打出 15408《山本五十六指挥大和号》在北太平洋部署了空军
 * （同格有补给中的日本海军），却【没有出现南云忠一的打出时点】。
 *
 * 读库结论：
 *   日本手牌 = 15406(南云) / 15439 / 15401 / 15415 / 15416 —— **没有一张 RESPONSE**，
 *   而 15406 的代价是 {discard:1, filter:'response'}。
 *   offer_armed_effects 对"弃牌代价"有预检（手牌够弃才进候选），故按设计不弹窗。
 *   → 塞一张响应卡后窗口立刻正常开出（见 C 段）。
 *
 * 顺带发现并修复的真 bug：
 *   run_sea_air_deploy 的【调度】分支直接改 game.location 就 return，
 *   **没有上报 after_deploy_air** —— 卡面明写"部署【或调度】"，但选调度时
 *   15406 / 17511 等所有 after_deploy_air 卡永远不触发。已在调度分支补上报。
 *
 * 用法：node tools/_smoke_15406_nagumo.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const NP = data.id_of('北太平洋')
const ES = data.id_of('东海')

/* 造一个"北太平洋有补给中的日本海军 + 东太平洋有日本空军"的盘面 */
function mk(withResponseCard) {
	const g = rules.setup(1601, rules.default_scenario, {})
	g.opening = null
	for (const p in g.location) delete g.location[p]
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.log.length = 0

	g.location['jp_n1'] = NP; g.piece_nation['jp_n1'] = '日本'; g.piece_type['jp_n1'] = 'navy'
	I.add_supply_point(g, NP, '日本')
	g.location['jp_a1'] = ES; g.piece_nation['jp_a1'] = '日本'; g.piece_type['jp_a1'] = 'air'

	/* 手牌：15406 必在手；可选再给一张日本响应卡 */
	const hand = ['15406#1']
	if (withResponseCard) {
		const resp = (g.decks['日本'] || []).find(id => I.filter_matches_card(id, 'response'))
		if (resp) {
			hand.push(resp)
			g.decks['日本'] = g.decks['日本'].filter(x => x !== resp)
		}
	}
	g.hands['日本'] = hand
	g.armed_offers = []
	return g
}

const wins = g => (g.armed_offers || []).filter(w => w.when === 'after_deploy_air')
const has15406 = g => wins(g).some(w => (w.cards || []).some(c => String(I.inst_card_id(c.card_id)) === '15406'))

console.log('=== A. 前提 ===')
{
	const g = mk(true)
	const sup = I.compute_supply(g)
	ok('北太平洋是海域', (data.spaces[NP] || {}).terrain === 'sea')
	ok('同格日本海军在补给', !!sup.in_supply['jp_n1'], sup.sources['jp_n1'])
	ok('15406 的 armed.ready 为真', I.ECHO_EFFECTS['15406'].armed.ready(g, { space: NP, nation: '日本' }))
}

console.log('\n=== B. 手牌没有响应卡 -> 按设计不弹窗（game 24 的现场） ===')
{
	const g = mk(false)
	I.offer_armed_effects(g, 'after_deploy_air', { space: NP, nation: '日本' })
	ok('armed_offers 为空', wins(g).length === 0, JSON.stringify(wins(g)))
	ok('日志未产生“可打出南云”的提示（静默跳过）', !/南云/.test((g.log || []).join('\n')))
}

console.log('\n=== C. 手牌有响应卡 -> 部署后正常开窗 ===')
{
	const g = mk(true)
	const r = I.run_sea_air_deploy(g, { arg: { space: NP, choice: 0 } }, '日本')
	ok('部署成功', r.ok, r.desc || r.reason)
	ok('弹出 15406 窗口', has15406(g), JSON.stringify(wins(g).map(w => (w.cards || []).map(c => c.name))))
	const card = wins(g)[0] && wins(g)[0].cards[0]
	ok('代价 = 弃 1 张[响应卡]',
		card && card.cost && card.cost.discard === 1 && card.cost.filter === 'response',
		JSON.stringify(card && card.cost))
}

console.log('\n=== D. 【调度】分支也要开窗（本次修复） ===')
{
	const g = mk(true)
	ok('调度前空军在东海', g.location['jp_a1'] === ES)
	const r = I.run_sea_air_deploy(g, { arg: { space: NP, choice: 1 } }, '日本')
	ok('调度成功', r.ok, r.desc || r.reason)
	ok('空军已移到北太平洋', g.location['jp_a1'] === NP, data.name_of(g.location['jp_a1']))
	ok('调度后同样弹出 15406 窗口', has15406(g), JSON.stringify(wins(g).map(w => (w.cards || []).map(c => c.name))))
}

console.log('\n=== E. 调度到非海域 -> 拒绝且不开窗 ===')
{
	const g = mk(true)
	const land = data.id_of('海参崴')
	const r = I.run_sea_air_deploy(g, { arg: { space: land, choice: 1 } }, '日本')
	ok('被拒绝', !r.ok, r.reason)
	ok('未开窗', wins(g).length === 0)
	ok('空军没被移动', g.location['jp_a1'] === ES)
}

console.log('\n=== F. 部署路径回归：仍然只开一次窗 ===')
{
	const g = mk(true)
	I.run_sea_air_deploy(g, { arg: { space: NP, choice: 0 } }, '日本')
	ok('after_deploy_air 窗口数 = 1', wins(g).length === 1, wins(g).length)
	ok('窗口内 15406 出现 1 次',
		wins(g)[0].cards.filter(c => String(I.inst_card_id(c.card_id)) === '15406').length === 1)
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
