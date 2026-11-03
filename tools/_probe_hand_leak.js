/*
 * 探查：挂起窗口是否把「付代价国」的手牌泄漏给对手。
 *
 * 疑点（代码层）：
 *   rules.js ~25260
 *     const _costNat = pending_cost_nation(game.pending_battle)
 *     hands[n] = hand_view(game, n, (n === my_nation || n === _costNat) ? n : my_nation)
 *   view 是【按 side】下发的，若 _costNat 属于对手阵营，对手就会拿到该国手牌牌面。
 *
 * 例：17853《一步也不许后退!》-> pending_battle.stage='su_step_back'，
 *     pending_cost_nation 返回【苏联】-> 轴心 view.hands['苏联'].cards 应有值（= 泄漏）。
 *
 * 用法：node tools/_probe_hand_leak.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function setup17853() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	/* 苏联：暗置 17853 到桌面（响应卡必须暗置才会被询问） */
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	let c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17853')
	if (!c) {
		R.action(g, 'Allies', 'debug_add_card', { face: '17853', nation: '苏联', dest: 'hand' })
		I.refresh(g)
		c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17853')
	}
	R.action(g, 'Allies', 'play_card', { card: c })
	/* 苏联陆军@罗斯；德国陆军@相邻格（发起攻击） */
	const su = Object.keys(d.spaces).map(Number).find(s => /罗斯/.test(d.name_of(s)))
	const deSp = I.get_connections(g, su, 'allies').find(s =>
		d.spaces[s] && d.spaces[s].terrain !== 'sea' &&
		!Object.keys(g.location).some(p => g.location[p] === s))
	R.action(g, 'Allies', 'debug_place', { piece: 'su_def', nation: '苏联', type: 'army', space: su })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: deSp })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	I.grant_supply(g, 'de_atk', g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	const r = I.do_battle(g, '德国', su, 'su_def', 'land', { from: 'de_atk' })
	console.log('攻击: ' + logSince(g, n0) + (r && r.ok === false ? ' 【拒绝】' + r.reason : ''))
	return g
}

const g = setup17853()
/* 先让苏联发动这张响应卡，才会进入 su_step_back（付代价）阶段 */
{
	const v0 = R.view(g, 'Allies')
	console.log('响应窗: ' + (v0.pending_trigger ? '有（' + v0.pending_trigger.on + '）' : 'null'))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'trigger_response', {})
	console.log('trigger: ' + logSince(g, n0))
}
const pb = g.pending_battle || {}
console.log('pending_battle.stage = ' + JSON.stringify(pb.stage) +
	'  苏联手牌张数 = ' + (g.hands['苏联'] || []).length)

const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
const show = (v, tag) => {
	const rows = Object.keys(v.hands || {}).map(n => {
		const h = v.hands[n]
		return n + ':' + (h && h.cards ? '牌面×' + h.cards.length : '仅张数(' + (h && h.count) + ')')
	})
	console.log('\n[' + tag + '] my_nation=' + v.my_nation)
	console.log('  ' + rows.join('  '))
	console.log('  pending_battle=' + (v.pending_battle ? '有(stage=' + v.pending_battle.stage + ')' : 'null'))
	console.log('  pending_trigger=' + (v.pending_trigger ? '有' : 'null') +
		'  response_pending=' + JSON.stringify(v.response_pending))
}
show(vA, 'Allies')
show(vX, 'Axis')

const leak = []
for (const n of ['苏联', '英国', '美国', '法国', '中国'])
	if (vX.hands && vX.hands[n] && vX.hands[n].cards) leak.push(n)
console.log('\n★ 轴心能看到牌面的国家: ' + JSON.stringify(leak))
console.log('★ 若包含任何同盟国 -> 手牌泄漏（本探查目标）')
