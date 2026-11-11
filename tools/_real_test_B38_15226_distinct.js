/*
 * B38 真实测试 —— 15226《巴巴罗萨》「至多三支不同的目标部队依次结算战斗」
 *
 * 玩家口径（2026-11-12）：① 预算次数收缩到实际目标数，但【仍保留手动「结束」】；
 * ② 同一支部队禁止第二次再打（即使被保护未移除）；③ 快照外新部队应禁止。
 *
 * A 3 支不同地区：3 次独立结算
 * B ★★ 2 支：预算 = 2、打完仍需手动结束
 * C ★★ 3 支挤 2 个地区：预算按【部队数 3】而非地区数，三支各打一次
 * D ★★ 已打过的部队仍在场（等价保护未移除）→ 第二次被拒
 * E ★★ 快照外新部队（落在快照地区内）→ 不下发、指定为 victim 被拒
 * F 不传 victim 时服务端自动取未打过的快照部队
 * G 静态守卫（配置驱动、helper 复用、其它卡不受影响）
 *
 * 用法：node tools/_real_test_B38_15226_distinct.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const J = x => JSON.stringify(x)
const faceOf = x => String(x).split('#')[0]
const nm = s => d.name_of(Number(s))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const cands = g => (I.event_battle_targets(g, g.event_budget) || []).map(nm)

function board(soviet) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'de_b38', nation: '德国', type: 'army', space: d.id_of('东欧') })
	soviet.forEach((s, i) => R.action(g, 'Allies', 'debug_place',
		{ piece: 'su_b38_' + i, nation: '苏联', type: 'army', space: d.id_of(s) }))
	I.refresh(g)
	for (const p of Object.keys(g.location || {})) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15226', nation: '德国', dest: 'hand' })
	I.refresh(g)
	return g
}
function play(g) {
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === '15226')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: c })
	return logSince(g, n0)
}
function fight(g, where, victim) {
	const n0 = (g.log || []).length
	const arg = { target: d.id_of(where), from: 'de_b38' }
	if (victim !== undefined) arg.victim = victim
	R.action(g, 'Axis', 'event_battle', arg)
	return logSince(g, n0)
}
const enemiesAt = (g, where) => {
	const v = R.view(g, 'Axis')
	return ((v.event_budget && v.event_budget.enemies &&
		v.event_budget.enemies[d.id_of(where)]) || []).map(x => x.id)
}

console.log('=== A. 3 支不同地区 → 3 次独立结算 ===')
{
	const g = board(['罗斯', '乌克兰', '巴尔干'])
	const lg = play(g)
	ok('A1 预算 = 3', g.event_budget && g.event_budget.remaining === 3, J(g.event_budget && g.event_budget.remaining))
	ok('A2 unitTargets 是 3 个部队实例', (g.event_budget.unitTargets || []).length === 3,
		J(g.event_budget.unitTargets))
	for (let i = 0; i < 3; i++) fight(g, ['罗斯', '乌克兰', '巴尔干'][i], 'su_b38_' + i)
	ok('A3 ★ 三次独立 do_battle、battleOk=3', g.event_budget.battleOk === 3 &&
		g.event_budget.remaining === 0, J({ battleOk: g.event_budget.battleOk, remaining: g.event_budget.remaining }))
	ok('A4 ★ usedVictims 记下 3 个不同实例', (g.event_budget.usedVictims || []).length === 3 &&
		new Set(g.event_budget.usedVictims).size === 3, J(g.event_budget.usedVictims))
	ok('A5 打完后候选为空', cands(g).length === 0, J(cands(g)))
	R.action(g, 'Axis', 'event_finish', {})
	ok('A6 手动结束后预算清空', !g.event_budget)
}

console.log('\n=== B. ★★ 只有 2 支 → 预算收缩到 2，仍保留手动结束 ===')
{
	const g = board(['罗斯', '乌克兰'])
	const lg = play(g)
	ok('★★ B1 预算 = 2（不是 3）', g.event_budget.remaining === 2, J(g.event_budget.remaining))
	ok('★ B2 打出日志写「可进行 2 次」', /可进行 2 次/.test(lg), lg.slice(0, 160))
	fight(g, '罗斯', 'su_b38_0')
	fight(g, '乌克兰', 'su_b38_1')
	ok('★★ B3 打完 remaining=0 但【预算仍在】（未自动结算）',
		g.event_budget && g.event_budget.remaining === 0, J(g.event_budget && g.event_budget.remaining))
	const v = R.view(g, 'Axis')
	ok('★★ B4 手动「结束」按钮仍可用', !!(v.event_budget && v.event_budget.can_finish),
		J(v.event_budget))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_finish', {})
	ok('★ B5 点结束才清空预算', !g.event_budget && /战斗预算结束（2 场已结算/.test(logSince(g, n0)),
		logSince(g, n0).slice(0, 160))
}

console.log('\n=== C. ★★ 3 支挤在 2 个地区 → 按部队数计次，三支各打一次 ===')
{
	const g = board(['罗斯', '罗斯', '乌克兰'])
	play(g)
	ok('★★ C1 预算 = 3（按部队实例数，不是地区数 2）',
		g.event_budget.remaining === 3, J(g.event_budget.remaining))
	ok('★ C2 候选地区仍是 2 个', cands(g).length === 2, J(cands(g)))
	ok('★ C3 view.enemies[罗斯] 下发 2 支部队', enemiesAt(g, '罗斯').length === 2,
		J(enemiesAt(g, '罗斯')))
	const l0 = fight(g, '罗斯', 'su_b38_0')
	ok('★ C4 第 1 战成功', /进行陆战/.test(l0), l0.slice(0, 120))
	ok('★ C5 打过一支后罗斯仍在候选（还有未打过的）', cands(g).indexOf('罗斯') >= 0, J(cands(g)))
	ok('★ C6 view.enemies[罗斯] 只剩未打过的那一支', enemiesAt(g, '罗斯').length === 1 &&
		enemiesAt(g, '罗斯')[0] === 'su_b38_1', J(enemiesAt(g, '罗斯')))
	const l1 = fight(g, '罗斯', 'su_b38_1')
	const l2 = fight(g, '乌克兰', 'su_b38_2')
	ok('★★ C7 同格 2 支 + 另 1 支共 3 战全部成功', /进行陆战/.test(l1) && /进行陆战/.test(l2) &&
		g.event_budget.battleOk === 3, J({ l1: l1.slice(0, 80), l2: l2.slice(0, 80), battleOk: g.event_budget.battleOk }))
}

console.log('\n=== D. ★★ 已打过的部队仍在场（等价保护未移除）→ 禁止第二次 ===')
{
	const g = board(['罗斯', '乌克兰'])
	play(g)
	fight(g, '罗斯', 'su_b38_0')
	/* 摆初始局面：把第一战的目标放回场（等价于被保护/代受未移除） */
	g.location['su_b38_0'] = d.id_of('罗斯')
	g.piece_nation['su_b38_0'] = '苏联'
	g.piece_type['su_b38_0'] = 'army'
	I.refresh(g)
	ok('D1 前置：该部队确实仍在场', g.location['su_b38_0'] != null)
	const lg = fight(g, '罗斯', 'su_b38_0')
	ok('★★ D2 第二次被拒（记账生效，不依赖"已被移除"）', /已打过，不能重复/.test(lg), lg.slice(0, 160))
	ok('★★ D3 remaining 未被扣', g.event_budget.remaining === 1, J(g.event_budget.remaining))
	ok('★ D4 已打过的部队不再下发', enemiesAt(g, '罗斯').length === 0, J(enemiesAt(g, '罗斯')))
	ok('★ D5 另一支未打过的仍可打', /进行陆战/.test(fight(g, '乌克兰', 'su_b38_1')))
}

console.log('\n=== E. ★★ 快照外新部队（落在快照地区内）→ 禁止 ===')
{
	const g = board(['罗斯', '乌克兰'])
	play(g)
	/* 快照建立之后，在【罗斯】再放一支新苏联陆军 */
	R.action(g, 'Allies', 'debug_place',
		{ piece: 'su_b38_new', nation: '苏联', type: 'army', space: d.id_of('罗斯') })
	I.refresh(g)
	I.grant_supply(g, 'su_b38_new', g.turn)
	I.refresh(g)
	ok('★ E1 新部队不在 unitTargets', (g.event_budget.unitTargets || []).indexOf('su_b38_new') < 0,
		J(g.event_budget.unitTargets))
	ok('★★ E2 view.enemies[罗斯] 不下发新部队',
		enemiesAt(g, '罗斯').indexOf('su_b38_new') < 0, J(enemiesAt(g, '罗斯')))
	const lg = fight(g, '罗斯', 'su_b38_new')
	ok('★★ E3 指定新部队为 victim 被拒', /只能攻击本回合开始时已确定的目标部队/.test(lg), lg.slice(0, 160))
	ok('★ E4 快照内的部队仍可打', /进行陆战/.test(fight(g, '罗斯', 'su_b38_0')))
}

console.log('\n=== F. 不传 victim → 服务端自动取未打过的快照部队 ===')
{
	const g = board(['罗斯', '乌克兰'])
	play(g)
	R.action(g, 'Allies', 'debug_place',
		{ piece: 'su_b38_new2', nation: '苏联', type: 'army', space: d.id_of('罗斯') })
	I.refresh(g)
	const lg = fight(g, '罗斯', undefined)
	ok('★ F1 自动战斗成功且打的是快照内部队', /进行陆战/.test(lg) &&
		(g.event_budget.usedVictims || []).indexOf('su_b38_0') >= 0 &&
		(g.event_budget.usedVictims || []).indexOf('su_b38_new2') < 0,
		J({ lg: lg.slice(0, 100), used: g.event_budget.usedVictims }))
}

console.log('\n=== G. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('G1 step 用声明式 pickCappedByUnits / unitTargets（不写死卡 id 在框架里）',
		/pickCappedByUnits: true/.test(src) && /unitTargets: \(game\) => barbarossa_unit_targets/.test(src))
	ok('G2 budget_unit_unused 被候选/view/校验三处复用',
		(src.match(/budget_unit_unused\(/g) || []).length >= 4)
	ok('G3 event_battle 校验快照归属与重复',
		/只能攻击本回合开始时已确定的目标部队/.test(src) && /已打过，不能重复发起战斗/.test(src))
	ok('G4 未声明 unitTargets 的预算不受影响（helper 首行短路）',
		/if \(!b \|\| !b\.unitTargets\) return true/.test(src))
	ok('G5 仍保留手动结束（event_finish 无自动结算分支改动）',
		/action === 'event_finish'/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
