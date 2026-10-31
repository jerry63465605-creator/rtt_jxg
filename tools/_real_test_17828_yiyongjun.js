/*
 * 真实测试：17553《抗日义勇军》在桌面时，苏联打 17828《百团大战》不能让双方卡死
 *
 * 场景（玩家实测 bug）：
 *   17828 第 1 步是「中国在<中国>征召 1 支陆军」-> 触发 17553 -> active 翻给日本（须弃1+损耗1）；
 *   但分步机随后仍建立 event_budget，而预算门禁对非预算国只给 { log: 1 } ——
 *   日本拿不到 resolve_japan_delegate、苏联又不是当前操作方 => 双方都点不动 = 卡死。
 *
 * 修复：让权类"必须回答"的挂起优先于预算冻结（build_actions + do_action 两处同步放行）。
 *
 * 断言：
 *   A. 17553 真正上到美国桌面（经 17555 前置弃牌的真实路径）
 *   B. 苏联打 17828 -> 让权成立：active=Axis / current_nation=日本
 *   C. ★ 日本侧 view.actions 含 resolve_japan_delegate（修复点：此前为空 = 卡死）
 *   D. 日本结算 -> 弃 1 手牌 + 损耗 1 张 + 操作权归还苏联，且 event_budget 保留
 *   E. 苏联能收尾（event_finish）-> 预算清空、无残留挂起
 *   F. 对照：美国桌面没有 17553 时不触发让权
 *
 * 用法：node tools/_real_test_17828_yiyongjun.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const hasTable = (g, n, face) => ((g.table || {})[n] || []).some(x => faceOf(x) === String(face))
const acts = v => Object.keys(v.actions || {})

/* 布阵：美国桌面放 17553（走真实 play_card + 17555 前置弃牌），日军@中亚，苏联手牌 17828 */
function setup({ withYiyongjun = true } = {}) {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)

	if (withYiyongjun) {
		R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
		I.refresh(g)
		const c = (g.hands['美国'] || []).find(x => faceOf(x) === '17553')
		R.action(g, 'Allies', 'play_card', { card: c })
		if (g.us_depression_discard && g.us_depression_discard.pending) {
			const pay = (g.hands['美国'] || []).find(x => faceOf(x) !== '17553')
			R.action(g, 'Allies', 'us_depression_discard', { card: pay })
		}
	}

	/* 日军放在与中国地区相邻的格（中亚 与中国西部相邻） */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	R.action(g, 'Allies', 'debug_place', { piece: 'jp_a1', nation: '日本', type: 'army', space: d.id_of('中亚') })
	R.action(g, 'Allies', 'debug_add_card', { face: '17828', nation: '苏联', dest: 'hand' })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	I.refresh(g)
	return g
}

const CN = d.id_of('中国西部')

console.log('\n=== A. 17553 上桌 ===')
const g = setup()
ok('★ 美国桌面有《抗日义勇军》', hasTable(g, '美国', 17553), JSON.stringify((g.table['美国'] || []).map(faceOf)))
ok('前提：中国西部与中国相邻格可用', CN != null)

console.log('\n=== B/C. 苏联打 17828 -> 让权日本，且日本拿得到动作 ===')
{
	const c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17828')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: c, space: CN, spaces: [CN] })
	console.log('  log: ' + logSince(g, n0))
}
ok('★ 触发让权：us_japan_delegate 已建立', !!g.us_japan_delegate, JSON.stringify(g.us_japan_delegate))
ok('★ 操作权已翻给轴心：active=Axis', g.active === 'Axis', String(g.active))
ok('★ current_nation=日本', g.current_nation === '日本', String(g.current_nation))

const vX = R.view(g, 'Axis')
const vA = R.view(g, 'Allies')
console.log('  Axis  actions = ' + JSON.stringify(acts(vX).filter(k => /japan|delegate|event_/.test(k))))
console.log('  Allies actions = ' + JSON.stringify(acts(vA).filter(k => /japan|delegate|event_/.test(k))))
ok('★★ 日本侧有 resolve_japan_delegate（修复点：此前为空 -> 卡死）',
	acts(vX).indexOf('resolve_japan_delegate') >= 0, JSON.stringify(acts(vX)))
ok('同盟侧只看到"等待日本"', !!(vA.us_japan_delegate && vA.us_japan_delegate.waiting_for === '日本'),
	JSON.stringify(vA.us_japan_delegate))

console.log('\n=== D. 日本结算：弃1+损耗1，归还操作权 ===')
{
	const hand0 = (g.hands['日本'] || []).length
	const disc0 = (g.discard['日本'] || []).length
	const pay = (g.hands['日本'] || [])[0]
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_japan_delegate', { card: pay })
	console.log('  log: ' + logSince(g, n0))
	ok('★ 日本弃掉 1 张手牌', (g.hands['日本'] || []).length === hand0 - 1,
		hand0 + ' -> ' + (g.hands['日本'] || []).length)
	ok('★ 弃牌进日本弃牌堆', (g.discard['日本'] || []).indexOf(pay) >= 0)
	ok('★ 另损耗 1 张（弃牌堆净增 ≥2）', (g.discard['日本'] || []).length >= disc0 + 2,
		disc0 + ' -> ' + (g.discard['日本'] || []).length)
	ok('★ 让权已清除', !g.us_japan_delegate)
	ok('★ 操作权归还苏联（active=Allies / current_nation=苏联）',
		g.active === 'Allies' && g.current_nation === '苏联',
		JSON.stringify({ a: g.active, n: g.current_nation }))
	ok('★ 卡仍停在步骤边界（pending_event_step），可继续推进', !!g.pending_event_step,
		JSON.stringify(g.pending_event_step && g.pending_event_step.step))
}

console.log('\n=== D2. 玩家实测路径：先点「下一步」建预算，再让日本结算也不卡死 ===')
{
	const g2 = setup()
	const c2 = (g2.hands['苏联'] || []).find(x => faceOf(x) === '17828')
	R.action(g2, 'Allies', 'play_card', { card: c2, space: CN, spaces: [CN] })
	ok('让权已建立', !!g2.us_japan_delegate)
	/* 苏联玩家真的点了「下一步」（真实客户端在让权期间仍会派发这个动作），于是建出战斗预算 */
	const n0 = (g2.log || []).length
	R.action(g2, 'Allies', 'event_step_next', {})
	console.log('  下一步 log: ' + logSince(g2, n0))
	console.log('  event_budget=' + JSON.stringify(g2.event_budget && { remaining: g2.event_budget.remaining }))
	ok('★ 预算已建立且让权仍在（正是原来卡死的组合）',
		!!g2.event_budget && !!g2.us_japan_delegate,
		JSON.stringify({ b: !!g2.event_budget, d: !!g2.us_japan_delegate }))
	const vX2 = R.view(g2, 'Axis')
	ok('★★ 预算期间日本【仍】拿得到 resolve_japan_delegate（本次修复点）',
		acts(vX2).indexOf('resolve_japan_delegate') >= 0, JSON.stringify(acts(vX2)))
	const pay = (g2.hands['日本'] || [])[0]
	const n1 = (g2.log || []).length
	R.action(g2, 'Axis', 'resolve_japan_delegate', { card: pay })
	console.log('  日本结算 log: ' + logSince(g2, n1))
	ok('★ 日本结算成功（预算不再挡住它）', !g2.us_japan_delegate)
	ok('★ 操作权归还苏联', g2.active === 'Allies' && g2.current_nation === '苏联',
		JSON.stringify({ a: g2.active, n: g2.current_nation }))
	ok('★ 预算仍保留，苏联可自行发起或结束', !!g2.event_budget,
		JSON.stringify(g2.event_budget && g2.event_budget.remaining))
	R.action(g2, 'Allies', 'event_finish', {})
	ok('★ 苏联 event_finish 收尾后无残留',
		!g2.event_budget && !g2.pending_event_step && !g2.us_japan_delegate,
		JSON.stringify({ b: !!g2.event_budget, s: !!g2.pending_event_step, d: !!g2.us_japan_delegate }))
}

console.log('\n=== E. 苏联收尾：event_finish -> 预算清空、无残留 ===')
{
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'event_finish', {})
	console.log('  log: ' + logSince(g, n0))
	ok('★ 预算已清空', !g.event_budget, JSON.stringify(g.event_budget))
	ok('无残留挂起（delegate/pending_event_step/armed）',
		!g.us_japan_delegate && !g.pending_event_step && !g.pending_armed_use,
		JSON.stringify({ d: !!g.us_japan_delegate, s: !!g.pending_event_step, a: !!g.pending_armed_use }))
	ok('回合仍在苏联手里', g.current_nation === '苏联' && g.active === 'Allies',
		JSON.stringify({ a: g.active, n: g.current_nation }))
}

console.log('\n=== F. 对照：桌面无 17553 时不触发让权 ===')
{
	const g2 = setup({ withYiyongjun: false })
	ok('对照盘面：美国桌面无《抗日义勇军》', !hasTable(g2, '美国', 17553))
	const c2 = (g2.hands['苏联'] || []).find(x => faceOf(x) === '17828')
	const n0 = (g2.log || []).length
	R.action(g2, 'Allies', 'play_card', { card: c2, space: CN, spaces: [CN] })
	console.log('  log: ' + logSince(g2, n0))
	ok('★ 不触发让权', !g2.us_japan_delegate, JSON.stringify(g2.us_japan_delegate))
	ok('★ 操作权仍在苏联（active=Allies）', g2.active === 'Allies', String(g2.active))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
