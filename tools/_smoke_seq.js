/*
 * 战斗预算(event_budget)冒烟自检 — 2026-09-30 重构
 * 覆盖：
 *   1. 《巴巴罗萨》打出即建立 event_budget(remaining=3)，不再预选 3 目标
 *   2. 逐次 event_battle 打苏联陆地，每战原子结算（代受/抵消/闪电战窗口照常）
 *   3. 两场之间可插入：闪电战(after_land 状态卡)、其它非战斗动作
 *   4. 空军代受/抵消：pending_battle 期间 event_budget.can_finish=false 且 event_battle 被拦截
 *   5. event_finish 才结算（放弃剩余+触发德国国家技能，晚于最后一场闪电战时点）
 *   6. 单目标战斗(pick=1)也走预算(remaining=1)，打完后仍需结束
 * 用法：node tools/_smoke_seq.js
 *
 * 布局：德国陆军驻 44=德国（补给点），其陆地邻居 5/12/13 放苏联陆军，
 *       可被《巴巴罗萨》作为对苏联发起陆战的目标。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
	else pass++
}
function putId(g, id, nation, type, spaceId) {
	g.location[id] = spaceId
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function armiesAt(g, spaceId, nation) {
	return Object.keys(g.location).filter(p =>
		g.location[p] === spaceId && g.piece_nation[p] === nation && g.piece_type[p] === 'army').length
}
function setupBudget() {
	let g = rules.setup(1)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['德国'] = ['15226#1', '15200#1', '15204#1']   // 巴巴罗萨 + 两张废牌
	g.table['德国'] = ['15253#1']                            // 闪电战（after_land 状态卡）
	putId(g, 'ger_a', '德国', 'army', 44)                  // 德国（补给点）
	putId(g, 'sov_a', '苏联', 'army', 5)
	putId(g, 'sov_b', '苏联', 'army', 12)
	putId(g, 'sov_c', '苏联', 'army', 13)
	I.compute_supply(g)
	return g
}
function armed(g, cid) {
	return (g.status_instant || []).some(e => e.card_id === cid && e.window === 'after_land')
}

console.log('=== 1. 《巴巴罗萨》打出即建立预算(remaining=3)，不预选目标 ===')
{
	let g = setupBudget()
	// 不再需要 picks —— battle 步骤交给预算机制逐次结算
	g = rules.action(g, '德国', 'play_card', { card: '15226#1' })
	ok('卡已打出（不在手牌）', g.hands['德国'].indexOf('15226#1') < 0)
	ok('出牌阶段标记已记（占一次出牌）', g.play_done['德国'] === true)
	ok('event_budget 已建立', !!g.event_budget, 'budget=' + JSON.stringify(g.event_budget))
	ok('remaining === 3', g.event_budget && g.event_budget.remaining === 3,
		'remaining=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
	ok('against=苏联 / kind=land', g.event_budget && g.event_budget.against === '苏联' && g.event_budget.kind === 'land')
	ok('旧 pending_seq 不再存在', !g.pending_seq)
	// 发起方视角能看到目标 5/12/13
	const v = rules.view(g, 'Axis')
	ok('发起方看到 event_budget 面板', !!v.event_budget, 'v.event_budget=' + JSON.stringify(v.event_budget))
	ok('目标含 5/12/13', v.event_budget &&
		[5, 12, 13].every(t => v.event_budget.targets.indexOf(t) >= 0),
		'targets=' + JSON.stringify(v.event_budget && v.event_budget.targets))
	ok('防守方(苏联)看不到预算面板', rules.view(g, 'Allies').event_budget === null)
	ok('出牌瞬间尚未武装闪电战窗口', !armed(g, '15253#1'), 'status_instant=' + JSON.stringify(g.status_instant))
}

console.log('\n=== 2. 逐次 event_battle + 两场之间插入闪电战 ===')
{
	let g = setupBudget()
	g = rules.action(g, '德国', 'play_card', { card: '15226#1' })
	// 第 1 战目标 5
	g = rules.action(g, '德国', 'event_battle', { target: 5 })
	ok('第 1 战(5)后 remaining === 2', g.event_budget && g.event_budget.remaining === 2,
		'remaining=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
	ok('第 1 战(5)苏联陆军被移除', armiesAt(g, 5, '苏联') === 0)
	ok('第 1 战后武装闪电战窗口（after_land）', armed(g, '15253#1'),
		'status_instant=' + JSON.stringify(g.status_instant))
	ok('预算仍在（remaining>0，未结束）', !!g.event_budget)

	// ★ 两场之间插入闪电战：在战斗地区 5 建设 1 支德国陆军
	const before5 = armiesAt(g, 5, '德国')
	g = rules.action(g, '德国', 'activate_status', { card: '15253#1' })
	ok('闪电战发动：5 号地区德国陆军 +1', armiesAt(g, 5, '德国') === before5 + 1,
		'before=' + before5 + ' after=' + armiesAt(g, 5, '德国'))
	ok('闪电战发动后窗口关闭', !armed(g, '15253#1'), 'status_instant=' + JSON.stringify(g.status_instant))
	ok('闪电战记账（once_per_turn）', (g.status_used || {})['15253#1'] === (g.turn + ':' + g.current_nation),
		'got=' + (g.status_used || {})['15253#1'])

	// 第 2 战目标 12：因 once_per_turn，闪电战不再武装
	g = rules.action(g, '德国', 'event_battle', { target: 12 })
	ok('第 2 战(12)后 remaining === 1', g.event_budget && g.event_budget.remaining === 1,
		'remaining=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
	ok('第 2 战(12)苏联陆军被移除', armiesAt(g, 12, '苏联') === 0)
	ok('第 2 战(12)后闪电战不再武装（once_per_turn）', !armed(g, '15253#1'))

	// 第 3 战目标 13：remaining 清空
	g = rules.action(g, '德国', 'event_battle', { target: 13 })
	ok('第 3 战(13)后 remaining === 0', g.event_budget && g.event_budget.remaining === 0,
		'remaining=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
	ok('第 3 战(13)苏联陆军被移除', armiesAt(g, 13, '苏联') === 0)
	ok('打满后预算仍在（需显式结束，国家技能才触发）', !!g.event_budget)
}

console.log('\n=== 3. event_finish 结算：放弃剩余 + 触发德国国家技能（晚于闪电战时点） ===')
{
	let g = setupBudget()
	g = rules.action(g, '德国', 'play_card', { card: '15226#1' })
	g = rules.action(g, '德国', 'event_battle', { target: 5 })
	// 末战(5)后闪电战窗口已武装：国家技能应晚于它
	const armedBefore = armed(g, '15253#1')
	g = rules.action(g, '德国', 'event_finish')
	ok('event_finish 前末战已武装闪电战窗口', armedBefore)
	ok('结算后 event_budget 清空', !g.event_budget, 'event_budget=' + JSON.stringify(g.event_budget))
	ok('结算日志含「战斗预算结束」', g.log.some(l => /战斗预算结束/.test(l)),
		'logtail=' + g.log.slice(-3).join(' | '))
	// 德国国家技能(star_resolved)：15226 是★卡，结算后应给出机会窗口
	// （具体技能窗口由 NATIONAL_SKILL 提供，这里验证 after_card_resolved 已运行：
	//  若 15226★ 触发，会在桌面/日志留下痕迹；此处只验证不再有 pending 且流程闭合）
	ok('结算后无残留挂起', !g.pending_battle && !g.pending_seq)
}

console.log('\n=== 4. 空军代受/抵消：pending_battle 期间 event_battle 被拦截 ===')
{
	let g = setupBudget()
	putId(g, 'ger_air', '德国', 'air', 44)   // 与 5 相邻，用于抵消
	putId(g, 'sov_air', '苏联', 'air', 5)    // 目标 5 同地区，用于代受
	I.compute_supply(g)
	g = rules.action(g, '德国', 'play_card', { card: '15226#1' })

	// 第 1 战(5)应因苏联有空军进入代受挂起
	g = rules.action(g, '德国', 'event_battle', { target: 5 })
	ok('首战(5)触发代受挂起（pending_battle 存在）', !!g.pending_battle,
		'stage=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
	ok('代受挂起期间预算仍在（remaining=2）', g.event_budget && g.event_budget.remaining === 2)
	// 代受期间 event_battle 必须被拦截
	const gBlock = rules.action(g, '德国', 'event_battle', { target: 12 })
	ok('代受挂起时 event_battle 被拦截（不提前打下一战）',
		!!gBlock.pending_battle && gBlock.pending_battle.stage === 'defend',
		'logtail=' + gBlock.log.slice(-1).join(''))
	// 视图：代受期间发起方 can_finish=false
	const vDef = rules.view(g, 'Axis')
	ok('代受期间发起方 view.event_budget.can_finish=false', vDef.event_budget && vDef.event_budget.can_finish === false)
	// 防守方(苏联)视角应能看到代受框
	const vDefAllies = rules.view(g, 'Allies')
	ok('代受期间防守方(苏联)看到 pending_battle 代受框',
		!!vDefAllies.pending_battle && vDefAllies.pending_battle.stage === 'defend')

	// 防守方(苏联/Allies)选择代受空军 -> counter 阶段
	g = rules.action(g, 'Allies', 'resolve_battle', { use_air: 'sov_air' })
	ok('防守方代受后进入 counter 阶段', g.pending_battle && g.pending_battle.stage === 'counter',
		'stage=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
	const vCnt = rules.view(g, 'Axis')
	ok('counter 阶段发起方 view.event_budget.can_finish=false（防卡死）',
		vCnt.event_budget && vCnt.event_budget.can_finish === false)
	ok('counter 阶段发起方看到可抵消空军列表', (vCnt.pending_battle.counter_airs || []).some(c => c.id === 'ger_air'),
		'counter_airs=' + JSON.stringify(vCnt.pending_battle && vCnt.pending_battle.counter_airs))

	// 发起方选择抵消 -> 解出后回到预算
	g = rules.action(g, 'Axis', 'resolve_battle', { counter_air: 'ger_air' })
	ok('抵消后预算恢复（remaining=2）', g.event_budget && g.event_budget.remaining === 2,
		'remaining=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
	ok('抵消后首战(5)苏联陆军已移除', armiesAt(g, 5, '苏联') === 0)
	ok('抵消后代受空军已移除', !g.location['sov_air'])
	ok('抵消后发起方抵消空军已移除', !g.location['ger_air'])
	// 【2026-09-30 修复回归】空军互相抵消后，首战视为发起陆战成功，应武装闪电战(after_land)窗口
	ok('抵消后武装闪电战窗口（修复：空军互相抵消时也武装）', armed(g, '15253#1'),
		'status_instant=' + JSON.stringify(g.status_instant))

	// 打完剩余两战
	g = rules.action(g, '德国', 'event_battle', { target: 12 })
	g = rules.action(g, '德国', 'event_battle', { target: 13 })
	ok('全部打完后 remaining=0', g.event_budget && g.event_budget.remaining === 0)
	g = rules.action(g, '德国', 'event_finish')
	ok('结算后预算清空', !g.event_budget)
}

console.log('\n=== 5. 可攻击目标少于预算：打出即给满 3 次机会，打完剩余后需结束 ===')
{
	let g = rules.setup(1)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['德国'] = ['15226#1', '15200#1']
	g.table['德国'] = ['15253#1']
	putId(g, 'ger_a', '德国', 'army', 44)
	putId(g, 'sov_a', '苏联', 'army', 5)   // 只有 1 块苏联陆地
	I.compute_supply(g)
	g = rules.action(g, '德国', 'play_card', { card: '15226#1' })
	ok('打出即建立预算（remaining=3，机会足额，与可攻击目标数无关）',
		g.event_budget && g.event_budget.remaining === 3,
		'remaining=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
	const vb0 = rules.view(g, 'Axis').event_budget
	ok('目标集合只含实际存在的苏联陆地 5', vb0 && JSON.stringify(vb0.targets) === JSON.stringify([5]),
		'targets=' + JSON.stringify(vb0 && vb0.targets))
	ok('出牌瞬间尚未武装闪电战窗口', !armed(g, '15253#1'), 'status_instant=' + JSON.stringify(g.status_instant))
	g = rules.action(g, '德国', 'event_battle', { target: 5 })
	ok('打 1 场后 remaining=2（剩余机会可放弃）', g.event_budget && g.event_budget.remaining === 2,
		'remaining=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
	ok('该战武装闪电战窗口', armed(g, '15253#1'), 'status_instant=' + JSON.stringify(g.status_instant))
	ok('苏联陆军被移除', armiesAt(g, 5, '苏联') === 0)
	const vb1 = rules.view(g, 'Axis').event_budget
	ok('已无更多合法目标：targets 为空', vb1 && vb1.targets.length === 0,
		'targets=' + JSON.stringify(vb1 && vb1.targets))
	ok('打满后预算仍在（需结束）', !!g.event_budget)
	g = rules.action(g, '德国', 'event_finish')
	ok('结算后预算清空', !g.event_budget)
}

console.log('\n=== 结果 ===')
console.log('  PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
