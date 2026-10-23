/*
 * 回归：《租借法案》(17535) 委托打出多步卡（17827 西伯利亚大铁路）卡死（2026-10-23）
 *
 * 现场 game 24：
 *   美国打 17535 → 委托苏联 → 苏联打出 17827《西伯利亚大铁路》
 *   → 建立 pending_autobahn{actor:'苏联', remaining:5}
 *   → 17535 立刻 finish_delegate 归还操作权，current_nation 变回美国
 *   → 此后每次点建设位都是「只有【苏联】能选择建设位置」，永远推不动 = 卡死
 *
 * 两个缺陷：
 *   ① 17535 收尾过早：卡"结算完成"不等于"委托可收尾"，17827 还要点 5 次建设位。
 *   ② autobahn_resolve 用 `nation !== pa.actor` 严格判定，而 build_actions 是按
 *      faction 放行 resolve_autobahn —— 白名单放行了、动作却被拒（白名单死锁）。
 *
 * 用法：node tools/_smoke_lend_lease_autobahn.js
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

/* 找一个苏联当前可建陆军的位置 */
function anyBuildable(game) {
	for (const sp of Object.keys(data.spaces)) {
		if (I.can_build_at(game, '苏联', Number(sp), 'army').ok) return Number(sp)
	}
	return null
}

console.log('=== A. 完整链路：美国打 17535 -> 委托苏联 -> 苏联打 17827 ===')
const g = rules.setup(1701, rules.default_scenario, {})
g.opening = null
g.current_nation = '美国'
g.active = 'Allies'
g.turn_phase = 'play'
g.log.length = 0
g.hands['美国'] = ['17535#1'].concat((g.hands['美国'] || []).slice(0, 6))
g.hands['苏联'] = ['17827#1'].concat((g.hands['苏联'] || []).slice(0, 6))
g.decks['苏联'] = (g.decks['苏联'] || []).slice()

{
	const r = rules.action(g, 'Allies', 'play_card', { card: '17535#1' })
	ok('A1 17535 打出后进入委托', !!(r.delegate && !r.delegate.done), JSON.stringify(r.delegate))
}
{
	const r = rules.action(g, 'Allies', 'resolve_us_lend_lease_select', { nation: '苏联' })
	ok('A2 委托对象 = 苏联', r.delegate && r.delegate.nation === '苏联', JSON.stringify(r.delegate && r.delegate.nation))
	ok('A3 操作权已切给苏联', r.current_nation === '苏联', r.current_nation)
}

const handBefore = (g.hands['苏联'] || []).length - 1   /* 扣掉即将打出的 17827 */
/* 收回的是【苏联全部陆军】，默认盘面可能只有 1 支，故按实际值断言（不写死 5） */
const armyBefore = I.count_pieces(g, { nation: '苏联', types: ['army'] })

{
	const r = rules.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: '17827#1', nation: '苏联' })
	ok('A4 17827 建立建设挂起（次数 = 收回的陆军数）',
		!!r.pending_autobahn && r.pending_autobahn.total === armyBefore &&
		r.pending_autobahn.remaining === armyBefore,
		JSON.stringify(r.pending_autobahn) + ' armyBefore=' + armyBefore)
	ok('A5 挂起 actor = 苏联', r.pending_autobahn && r.pending_autobahn.actor === '苏联')
	/* ① 的核心断言 */
	ok('A6 委托【未】收尾（delegate 仍在），操作权仍属苏联',
		!!r.delegate && !r.delegate.done && r.delegate.nat === '苏联',
		JSON.stringify(r.delegate))
	ok('A7 current_nation 仍是苏联（未被提前归还）', r.current_nation === '苏联', r.current_nation)
	ok('A8 日志提示委托待挂起完成',
		/待挂起完成后收尾/.test((r.log || []).join('\n')), (r.log || []).slice(-1)[0])
}

console.log('\n=== B. 逐次建设（同阵营代操作，修 ① 后 current=苏联 也应能提交） ===')
let guard = 0
while (g.pending_autobahn && guard < 8) {
	guard++
	const before = g.pending_autobahn.remaining
	const sp = anyBuildable(g)
	if (!sp) { ok('B 有可建位置', false, '无'); break }
	const r = rules.action(g, 'Allies', 'resolve_autobahn', { space: sp })
	const after = r.pending_autobahn ? r.pending_autobahn.remaining : null
	ok('B' + guard + ' remaining ' + before + ' -> ' + after + '（' + data.name_of(sp) + '）',
		after === before - 1 || after === null, (r.log || []).slice(-1)[0])
}

console.log('\n=== C. 建完后补做委托收尾 ===')
{
	ok('C1 建设挂起已清', !g.pending_autobahn, JSON.stringify(g.pending_autobahn))
	/* finish_delegate 成功后会把 game.delegate 置空（或标 done），两种情况都算完成 */
	ok('C2 委托已收尾（delegate 已清 / done）',
		!g.delegate || g.delegate.done === true, JSON.stringify(g.delegate))
	ok('C3 操作权归还美国', g.current_nation === '美国', g.current_nation)
	ok('C4 苏联摸 1 张（含打出的 17827 共净 +1）',
		(g.hands['苏联'] || []).length === handBefore + 1,
		handBefore + ' -> ' + (g.hands['苏联'] || []).length)
	ok('C5 日志有"操作权归还美国"', /《租借法案》.*操作权归还美国/.test((g.log || []).join('\n')))
	ok('C6 苏联陆军数量复原（收回多少建回多少）',
		I.count_pieces(g, { nation: '苏联', types: ['army'] }) === armyBefore,
		I.count_pieces(g, { nation: '苏联', types: ['army'] }) + ' vs ' + armyBefore)
}

console.log('\n=== D. 修 ②：同阵营代操作（current=美国，actor=苏联）应放行 ===')
{
	const g2 = rules.setup(1702, rules.default_scenario, {})
	g2.opening = null
	g2.current_nation = '美国'
	g2.active = 'Allies'
	g2.turn_phase = 'play'
	g2.log.length = 0
	/* 直接构造挂起：actor 是苏联，但此刻回合属于美国（game 24 的现状） */
	g2.pending_autobahn = { remaining: 2, total: 2, actor: '苏联', timing: false }
	g2.delegate = null
	const sp = anyBuildable(g2)
	ok('D0 有可建位置', sp != null, sp && data.name_of(sp))
	const r = rules.action(g2, 'Allies', 'resolve_autobahn', { space: sp })
	ok('D1 美国（同阵营）提交被接受', r.pending_autobahn && r.pending_autobahn.remaining === 1,
		JSON.stringify(r.pending_autobahn))
	ok('D2 不是"只有【苏联】能选择"',
		!/只有【苏联】能选择建设位置/.test((r.log || []).join('\n')), (r.log || []).slice(-1)[0])
	ok('D3 建设的是苏联陆军（不变成美国）',
		I.count_pieces(r, { nation: '苏联', types: ['army'] }) ===
		I.count_pieces(g2, { nation: '美国', types: ['army'] }) + 0 ||
		I.count_pieces(r, { nation: '苏联', types: ['army'] }) > 0)
}

console.log('\n=== E. 跨阵营仍应被拒（不能越权） ===')
{
	const g3 = rules.setup(1703, rules.default_scenario, {})
	g3.opening = null
	g3.current_nation = '德国'
	g3.active = 'Axis'
	g3.turn_phase = 'play'
	g3.log.length = 0
	g3.pending_autobahn = { remaining: 2, total: 2, actor: '苏联', timing: false }
	const sp = anyBuildable(g3)
	if (sp) {
		const r = rules.action(g3, 'Axis', 'resolve_autobahn', { space: sp })
		ok('E1 轴心国提交被拒（剩余不变）',
			r.pending_autobahn && r.pending_autobahn.remaining === 2,
			JSON.stringify(r.pending_autobahn))
		ok('E2 日志写明只有苏联可选',
			/只有【苏联】能选择建设位置/.test((r.log || []).join('\n')))
	} else {
		ok('E0 有可建位置', false, '无')
	}
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
