/*
 * 【真实测试范式 · 第 6 组】经济战侧 pre-cancel：15329《反潜战术》让 [经济战] 无效
 *
 * 这是唯一还没被真实测试覆盖的拦截范式（响应栈 pre=true，卡必须【暗置到桌面】）。
 *
 * 链路 A（拦截成立）：
 *   ① debug：切到英国出牌阶段 -> 英国 play 15329（暗置到桌面，占名额）
 *   ② 切回德国出牌阶段 -> debug_place 德国陆军@西欧（15217 的前提）
 *   ③ 德国 play 15217《电动潜艇》（[潜艇行动]：选择 1 个敌方国家，其损耗 3 张牌，德国 +2 分）
 *      -> 响应栈 pre-cancel 窗口给英国
 *   ④ 英国 trigger_response（发动 15329）-> 15217 效果不发生
 *   ⑤ 断言：英国牌库不变、德国分数不变、15217 进弃牌堆、15329 消耗、栈清空
 *
 * 链路 B（对照，放弃发动）：
 *   同上但英国 pass_response -> 15217 生效（英国 -1 牌、德国 +3 分）
 *
 * 用法：node tools/_real_test_paradigm_econ_cancel.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = id => String(id).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const decks = (g, n) => (g.decks[n] || []).length
const score = (g, f) => {
	const sc = g.score || {}
	return (sc[f] || 0) + (sc[String(f).toLowerCase()] || 0)
}

/* 布阵：英国暗置 15329，德国手里 15217，德国陆军@西欧 */
function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	/* ① 英国出牌阶段：暗置响应卡 15329 */
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15329', nation: '英国', dest: 'hand' })
	const calm = (g.hands['英国'] || []).find(x => faceOf(x) === '15329')
	R.action(g, 'Allies', 'play_card', { card: calm })
	/* ② 切回德国出牌阶段 + 放陆军到西欧 + 发 15217 */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
		R.action(g, 'Axis', 'debug_add_card', { face: '15217', nation: '德国', dest: 'hand' })
	const v2 = (g.hands['德国'] || []).find(x => faceOf(x) === '15217')
	return { g, calm, v2 }
}

console.log('\n=== §1 布阵 ===')
{
	const { g, calm, v2 } = setup()
	ok('15329 已暗置到英国桌面（facedown）',
		(g.table_responses || []).some(x => x.card_id === calm),
		JSON.stringify(g.table_responses || []))
	ok('德国手里有 15217', !!v2, JSON.stringify(g.hands['德国']))
	ok('德国手里有经济战卡（无需地面前提）', !!v2)
}

console.log('\n=== §2-A 德国打出 15217 -> 响应窗口给英国 ===')
{
	const { g, calm, v2 } = setup()
	let n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: v2, target: '英国' })
	console.log('  log: ' + logSince(g, n0))
	const vUk = R.view(g, 'Allies')
	const hasResp = !!((g.response_stack || []).length || vUk.response_choice || vUk.response_prompt ||
		(g.response_stack || []).length)
	console.log('  view.response_choice=' + JSON.stringify(vUk.response_choice || null).slice(0, 160))
	ok('★ 英国看到响应窗口（pre-cancel）', hasResp,
		JSON.stringify({ rc: !!vUk.response_choice, rs: (g.response_stack || []).length }))

	console.log('\n=== §2-B 英国发动 15329 -> 经济战无效 ===')
	const ukDeck0 = decks(g, '英国')
	const deScore0 = score(g, 'Axis')
	n0 = (g.log || []).length
	R.action(g, 'Allies', 'trigger_response', { card: calm })
	console.log('  log: ' + logSince(g, n0))
	ok('★ 英国牌库不变（效果不发生）', decks(g, '英国') === ukDeck0,
		ukDeck0 + ' -> ' + decks(g, '英国'))
	ok('★ 德国分数不变', score(g, 'Axis') === deScore0,
		deScore0 + ' -> ' + score(g, 'Axis'))
	ok('15217 进德国弃牌堆（照常打出）', inDisc(g, '德国', v2), JSON.stringify(g.discard['德国']))
	ok('15329 已消耗', inDisc(g, '英国', calm) || !(g.table_responses || []).some(x => x.card_id === calm),
		JSON.stringify({ disc: g.discard['英国'], table: g.table_responses || [] }))
	ok('响应栈清空', (g.response_stack || []).length === 0, String((g.response_stack || []).length))
	ok('无残留 pending_econ', !g.pending_econ, JSON.stringify(g.pending_econ || null))
}

console.log('\n=== §3 对照组：英国放弃发动 -> 经济战生效 ===')
{
	const { g, calm, v2 } = setup()
	R.action(g, 'Axis', 'play_card', { card: v2, target: '英国' })
	const ukDeck0 = decks(g, '英国')
	const deScore0 = score(g, 'Axis')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'pass_response', {})
	console.log('  log: ' + logSince(g, n0))
	ok('★ 英国损耗 3 张（效果生效）', decks(g, '英国') === ukDeck0 - 3,
		ukDeck0 + ' -> ' + decks(g, '英国'))
	ok('★ 德国 +2 分', score(g, 'Axis') === deScore0 + 2,
		deScore0 + ' -> ' + score(g, 'Axis'))
	ok('15217 进弃牌堆', inDisc(g, '德国', v2))
	ok('15329 仍在桌面（未发动）', (g.table_responses || []).some(x => x.card_id === calm),
		JSON.stringify(g.table_responses || []))
	ok('响应栈清空', (g.response_stack || []).length === 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
