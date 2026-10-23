/*
 * 回归：开局（初始布阵）弃 3 张的正常流程 + role 容错（2026-10-24）
 *
 * 背景：本地对局能正常弃牌，别人线上部署后反馈"开局选中 3 张、点确认毫无反应、
 * 一直卡在初始阶段"。
 *
 * 机制：平台 common/client.js 的 send_action 先查 view.actions[verb]，
 * 没有登记就【静默 return false】；旧客户端在此之后照样 toast「已提交」并清空选择
 * -> 表现为"点了没反应"。
 * view.actions 是否含 opening_discard 取决于 server 端
 *   if (faction_of_nation(nation) === side) acts.opening_discard = 1
 * 而 side 由 role 精确比较推出：
 *   const side = current === ALLIES_ROLE ? ALLIES : AXIS
 * 只要外部传来的 role 不是【恰好】'Axis'/'Allies'（大小写/空格/中文国名），
 * 盟军玩家会被当成轴心：拿到不该有的动作、或提交被 do_opening_discard 拒绝。
 *
 * 修：rules.js 三个入口（action / view / query）统一走 norm_role 归一化；
 *     客户端 confirm_discard 提交前先查 view.actions，失败不再假报成功。
 *
 * 用法：node tools/_smoke_opening_discard.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const ORDER = ['德国', '英国', '日本', '苏联', '意大利', '美国']
const role_of = n => (['德国', '日本', '意大利'].indexOf(n) >= 0 ? 'Axis' : 'Allies')
const fresh = () => rules.setup(9100 + Math.floor(Math.random() * 500), rules.default_scenario, {})

console.log('=== A. 正常流程：轴心（德国）弃 3 张 ===')
{
	const g = fresh()
	const hand = g.hands['德国'].slice()
	ok('A1 开局手牌 10 张', hand.length === 10, hand.length)
	ok('A2 opening 从德国开始', g.opening && g.opening.index === 0 && g.current_nation === '德国',
		JSON.stringify(g.opening))
	const r = rules.action(g, 'Axis', 'opening_discard', { cards: hand.slice(0, 3) })
	ok('A3 弃牌成功，留 7 张', (r.hands['德国'] || []).length === 7, (r.hands['德国'] || []).length)
	ok('A4 推进到英国', r.opening && r.opening.index === 1 && r.current_nation === '英国',
		JSON.stringify(r.opening) + ' ' + r.current_nation)
	ok('A5 日志写明弃 3 张', /【德国】初始阶段弃 3 张/.test((r.log || []).join('\n')))
}

console.log('\n=== B. role 容错：大小写 / 首尾空格 归一；中文国名【不猜测】 ===')
{
	for (const role of ['Axis', 'axis', 'AXIS', ' Axis ']) {
		const g = fresh()
		const hand = g.hands['德国'].slice(0, 3)
		const r = rules.action(g, role, 'opening_discard', { cards: hand })
		ok('B role=' + JSON.stringify(role) + ' 弃牌成功', r.opening && r.opening.index === 1,
			JSON.stringify(r.opening))
	}
	/*
	 * 收窄后：中文国名不再被猜成阵营（否则 6 人按国家模式下
	 * `current === game.active` 会把每个国家都算成当前行动方）。
	 * 原样传入 -> 与 'Axis' 不匹配 -> 拒绝，保持旧行为。
	 */
	const g = fresh()
	const r = rules.action(g, '德国', 'opening_discard', { cards: g.hands['德国'].slice(0, 3) })
	ok('B5 中文国名不被猜成阵营（拒绝）', r.opening && r.opening.index === 0, JSON.stringify(r.opening))
	ok('B6 日志里提交方原样是德国', /提交方：德国/.test((r.log || []).join('\n')),
		(r.log || []).slice(-1)[0])
}

console.log('\n=== C. 盟军提交德国回合的弃牌 -> 拒绝，日志带双方 role ===')
{
	const g = fresh()
	const r = rules.action(g, 'Allies', 'opening_discard', { cards: (g.hands['德国'] || []).slice(0, 3) })
	const txt = (r.log || []).join('\n')
	ok('C1 未推进', r.opening && r.opening.index === 0, JSON.stringify(r.opening))
	ok('C2 日志含"不是当前操作国"', /不是当前操作国/.test(txt), (r.log || []).slice(-1)[0])
	ok('C3 日志带提交方与期望 role', /提交方：Allies/.test(txt) && /应为：Axis/.test(txt))
}

console.log('\n=== D. 张数必须恰好 3 ===')
{
	for (const n of [0, 2, 4]) {
		const g = fresh()
		const hand = g.hands['德国'].slice(0, n)
		const r = rules.action(g, 'Axis', 'opening_discard', { cards: hand })
		ok('D 选 ' + n + ' 张被拒', r.opening && r.opening.index === 0,
			(r.log || []).slice(-1)[0])
	}
}

console.log('\n=== E. 重复牌 / 不在手牌 ===')
{
	const g = fresh()
	const c = g.hands['德国'][0]
	const r = rules.action(g, 'Axis', 'opening_discard', { cards: [c, c, c] })
	ok('E1 重复同一张被拒', /不能重复弃同一张/.test((r.log || []).join('\n')), (r.log || []).slice(-1)[0])

	const g2 = fresh()
	const r2 = rules.action(g2, 'Axis', 'opening_discard', { cards: ['99999#1', '99999#2', '99999#3'] })
	ok('E2 手牌没有该牌被拒', /手牌中没有该牌/.test((r2.log || []).join('\n')), (r2.log || []).slice(-1)[0])
}

console.log('\n=== F. 六国依次弃完 -> 进入正式第一回合 ===')
{
	const g = fresh()
	let cur = g
	for (const n of ORDER) {
		const hand = (cur.hands[n] || []).slice(0, 3)
		ok('F ' + n + ' 手牌 ≥3', hand.length === 3, hand.length)
		cur = rules.action(cur, role_of(n), 'opening_discard', { cards: hand })
	}
	ok('F1 opening 已清空', !cur.opening, JSON.stringify(cur.opening))
	ok('F2 进入 turn 1', cur.turn === 1, cur.turn)
	ok('F3 回合回到德国', cur.current_nation === '德国' && cur.active === 'Axis',
		cur.current_nation + '/' + cur.active)
	ok('F4 六国手牌都是 7 张',
		ORDER.every(n => (cur.hands[n] || []).length === 7),
		ORDER.map(n => n + ':' + (cur.hands[n] || []).length).join(' '))
	ok('F5 日志有"初始阶段结束"', /初始阶段结束/.test((cur.log || []).join('\n')))
}

console.log('\n=== G. view.actions：只有当前弃牌国的阵营才有 opening_discard ===')
{
	const g = fresh()
	const vA = rules.view(g, 'Axis')
	const vB = rules.view(g, 'Allies')
	ok('G1 轴心视⻆有 opening_discard', !!(vA.actions && vA.actions.opening_discard),
		JSON.stringify(vA.actions))
	ok('G2 盟军视⻆没有', !(vB.actions && vB.actions.opening_discard), JSON.stringify(vB.actions))
	ok('G3 block_reason 指明等待德国', /等待【德国】/.test(vA.block_reason || ''), vA.block_reason)
	/* 归一化后小写也应一致 */
	const vL = rules.view(g, 'allies')
	ok('G4 role 小写 allies 也判为盟军（无该动作）', !(vL.actions && vL.actions.opening_discard),
		JSON.stringify(vL.actions))
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
