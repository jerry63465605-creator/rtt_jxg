/*
 * 初始阶段（opening）冒烟自检（2026-10-11）
 *   ① setup 后进入 opening，6 国各抽 10 张手牌
 *   ② 依次 opening_discard 弃 3 张：index 推进、active 按国家切换阵营
 *   ③ 6 国全弃完 -> opening 清除，进入 turn=1 resource，每国留 7 张
 *   ④ 非当前弃牌国提交被拒绝
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
function roleOf(n) {
	return I.faction_of_nation(n) === 'axis' ? 'Axis' : 'Allies'
}

const nations = I.ORDER_OF_NATIONS

/* ============ ① setup 进入初始阶段，每国 10 张 ============ */
console.log('=== 1. setup 进入初始阶段 ===')
const g = rules.setup(1)
ok('setup 后处于初始阶段', !!g.opening, 'opening=' + JSON.stringify(g.opening))
ok('初始阶段 index=0, 当前国=德国', g.opening && g.opening.index === 0 && g.current_nation === '德国')
for (const n of nations)
	ok(n + ' 抽 10 张手牌', (g.hands[n] || []).length === 10, 'len=' + (g.hands[n] || []).length)
ok('布阵后 8 国大本营陆军已在场', nations.length > 0 && Object.keys(g.piece_nation || {}).length >= 8,
	'pieces=' + Object.keys(g.piece_nation || {}).length)

/* ============ ② 依次弃 3 张，推进 + 切换操作权 ============ */
console.log('=== 2. 依次弃 3 张，推进与切换视角 ===')
for (let i = 0; i < nations.length; i++) {
	const n = nations[i]
	const role = roleOf(n)
	const cards = g.hands[n].slice(0, 3)
	const lenBefore = g.hands[n].length
	rules.action(g, role, 'opening_discard', { cards })
	if (i < nations.length - 1) {
		const next = nations[i + 1]
		ok(n + ' 弃完后推进到 ' + next, g.opening && g.opening.index === i + 1 && g.current_nation === next,
			'index=' + (g.opening && g.opening.index) + ' cur=' + g.current_nation)
		ok(n + ' 弃完后 active=' + roleOf(next), g.active === roleOf(next), 'active=' + g.active)
		ok(n + ' 弃 3 张后手牌 ' + lenBefore + '->' + (lenBefore - 3), g.hands[n].length === lenBefore - 3,
			'len=' + g.hands[n].length)
	} else {
		ok(n + ' 弃完后进入正式回合（opening 清除）', g.opening === null)
	}
}

/* ============ ③ 全部弃完 -> 正式第一回合，每国 7 张 ============ */
console.log('=== 3. 正式第一回合 ===')
ok('turn === 1', g.turn === 1, 'turn=' + g.turn)
ok('turn_phase === resource', g.turn_phase === 'resource', 'phase=' + g.turn_phase)
ok('current_nation === 德国', g.current_nation === '德国')
ok('active === Axis（德国所属）', g.active === 'Axis')
for (const n of nations)
	ok(n + ' 留 7 张手牌', (g.hands[n] || []).length === 7, 'len=' + (g.hands[n] || []).length)

/* ============ ④ 非当前国提交被拒绝 ============ */
console.log('=== 4. 权限校验 ===')
const g2 = rules.setup(2)
const rightRole = roleOf(nations[0])               /* 德国 -> Axis */
const wrongRole = rightRole === 'Axis' ? 'Allies' : 'Axis'
const before = g2.opening.index
const beforeLen = g2.hands[nations[0]].length
rules.action(g2, wrongRole, 'opening_discard', { cards: g2.hands[nations[0]].slice(0, 3) })
ok('非当前国弃牌被拒绝（index 不变）', g2.opening && g2.opening.index === before, 'index=' + (g2.opening && g2.opening.index))
ok('非当前国弃牌被拒绝（手牌不变）', g2.hands[nations[0]].length === beforeLen, 'len=' + g2.hands[nations[0]].length)
/* 错误张数（非3）被拒绝 */
const lenA = g2.hands[nations[0]].length
rules.action(g2, rightRole, 'opening_discard', { cards: g2.hands[nations[0]].slice(0, 2) })
ok('仅弃 2 张被拒绝（必须恰好 3）', g2.hands[nations[0]].length === lenA, 'len=' + g2.hands[nations[0]].length)

console.log('\n=== opening smoke: pass=' + pass + ' fail=' + fail + ' ===')
process.exit(fail ? 1 : 0)
