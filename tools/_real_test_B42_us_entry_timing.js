/*
 * 【本体 #3 / B42】美国 17526：轴心占 ≥3 补给点的参战时机
 * 真实 R.setup / R._internal 引擎函数驱动（初始局面只用工具摆）。
 * 用法：node tools/_real_test_B42_us_entry_timing.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const SUPPLY_SPACES = (() => {
	const out = []
	for (let i = 1; i < D.spaces.length; i++)
		if (D.spaces[i] && D.spaces[i].supply) out.push(i)
	return out
})()
/* 初始局面：清空棋子，摆 n 个德国陆军到补给点；可摆 17555 到美国桌面 */
function seed(n, withDepression) {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 12) {
		const nat = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[nat] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	for (let k = 0; k < (n === undefined ? 5 : n); k++) {
		const id = 'probe_ge_' + k
		g.location[id] = SUPPLY_SPACES[k]
		g.piece_nation[id] = '德国'
		g.piece_type[id] = 'army'
	}
	if (withDepression) g.table['美国'] = ['17555#x1']
	return g
}
const held = g => I.axis_supply_points_held(g).count
const neutralUS = g => I.is_neutral(g, '美国')

console.log('=== A. 计数/占领口径零改动（玩家确认沿用现状）===')
{
	const g = seed(0)
	ok('★★ 清空棋子后 3 点计数为 0', held(g) === 0, J(held(g)))
	const g5 = seed(5)
	ok('★★ 摆 5 个德国陆军到补给点后计数 ≥3（排除轴心自身大本营）',
		held(g5) >= 3 && held(g5) < 5, J({ held: held(g5), spaces: I.axis_supply_points_held(g5).spaces.map(x => x.name) }))
	ok('★ 初始美国仍中立', neutralUS(g5), J(I.neutral_status ? I.neutral_status(g5, '美国') : ''))
}

console.log('\n=== B. 主判定：轴心三国摸牌阶段开始时立即参战 ===')
for (const nat of ['德国', '日本', '意大利']) {
	const g = seed(5)
	ok('★★ ' + nat + ' 摸牌阶段开始时：美国立即结束中立（不等美国回合）',
		!!(I.run_phase_entry(g, I.PH.DRAW, nat), !neutralUS(g)) &&
		/轴心占领/.test(g.neutral_reason['美国'] || ''),
		J({ neutral: neutralUS(g), reason: g.neutral_reason['美国'] }))
}
for (const nat of ['英国', '苏联', '美国']) {
	const g = seed(5)
	I.run_phase_entry(g, I.PH.DRAW, nat)
	ok('★★ ' + nat + '（同盟）摸牌阶段开始时：不检测，美国仍中立',
		neutralUS(g), J(neutralUS(g)))
}
{
	const g = seed(5)
	I.run_phase_entry(g, I.PH.PLAY, '德国')
	ok('★★ 轴心非摸牌阶段（出牌）不检测，美国仍中立',
		neutralUS(g), J(neutralUS(g)))
}

console.log('\n=== C. 日本回合开始 / 美国回合开始的幂等兜底 ===')
{
	const g = seed(5)
	const fired = I.check_neutral_end_on_turn(g, '日本')
	ok('★★ 日本回合开始的轮转边界：触发参战',
		!neutralUS(g) && fired.indexOf('美国') >= 0, J(fired))
	const g2 = seed(5)
	const f2 = I.check_neutral_end_on_turn(g2, '德国')
	ok('★★ 其它国家回合开始不检测（只有日本）',
		neutralUS(g2) && f2.indexOf('美国') < 0, J(f2))
}
{
	const g = seed(5)
	const f1 = I.check_neutral_end_on_turn(g, '美国')
	const reason = g.neutral_reason['美国']
	const l0 = g.log.length
	const f2 = I.check_neutral_end_on_turn(g, '美国')
	ok('★★ 美国回合开始作幂等兜底：触发一次、第二次不再触发',
		f1.indexOf('美国') >= 0 && f2.indexOf('美国') < 0 &&
		g.neutral_reason['美国'] === reason &&
		!(g.log || []).slice(l0).some(x => /结束中立/.test(x)),
		J({ f1: f1, f2: f2 }))
}
{
	/* 未达 3 点时任何时点都不触发 */
	const g = seed(2)
	I.run_phase_entry(g, I.PH.DRAW, '德国')
	ok('★★ 只占 2 个补给点：不参战', neutralUS(g) && held(g) < 3,
		J({ held: held(g), neutral: neutralUS(g) }))
}

console.log('\n=== D. defer：17555 延到美国回合开始，不当场触发 ===')
{
	const g = seed(5, true)
	I.run_phase_entry(g, I.PH.DRAW, '德国')
	ok('★★ 占领参战传 defer:true -> pending_neutral_effect[美国]',
		!neutralUS(g) && !!(g.pending_neutral_effect && g.pending_neutral_effect['美国']),
		J(g.pending_neutral_effect))
	ok('★★ 17555 没有当场给出 us_depression_offer',
		!g.us_depression_offer, J(g.us_depression_offer))
	ok('★★ 公共日志写明「发动延迟」',
		(g.log || []).some(x => /发动延迟/.test(x)),
		J((g.log || []).filter(x => /大萧条/.test(x))))
}

console.log('\n=== E. 「进入第 10 回合」与「被攻击参战」不回归 ===')
{
	const g = seed(0, true)
	g.turn = 10
	I.check_neutral_end_on_turn(g, '美国')
	ok('★★ 第 10 回合仍当场参战、且 17555 当场给机会（不 defer）',
		!neutralUS(g) && g.us_depression_offer === true &&
		!(g.pending_neutral_effect && g.pending_neutral_effect['美国']),
		J({ reason: g.neutral_reason['美国'], offer: g.us_depression_offer }))
}
{
	const g = seed(0, true)
	I.maybe_end_neutral_by_attack(g, '美国', '德国')
	ok('★★ 被轴心攻击参战仍走既有 defer 链',
		!neutralUS(g) && !!(g.pending_neutral_effect && g.pending_neutral_effect['美国']),
		J({ reason: g.neutral_reason['美国'], pending: g.pending_neutral_effect }))
}

console.log('\n=== F. 静态守卫（同源 / 三时点 / 无 action 出口 / 客户端零改动）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ 唯一幂等函数：沿用 axis_supply_points_held + defer:true',
		/function check_us_join_by_axis_hold\(game\)/.test(src) &&
		/const c = axis_supply_points_held\(game\)/.test(src) &&
		/'轴心占领 ' \+ c\.count \+ ' 个补给点', \{ defer: true \}\)/.test(src))
	ok('★★ 恰好三处调用 + 定义（无 exports.action 出口检测）',
		(src.match(/check_us_join_by_axis_hold\(game\)/g) || []).length === 4,
		J((src.match(/check_us_join_by_axis_hold\(game\)/g) || []).length))
	ok('★★ 主判定只在轴心摸牌阶段开始（switch 之前）',
		/if \(phase === PH\.DRAW && faction_of_nation\(nation\) === AXIS\)\s*\n\s*check_us_join_by_axis_hold\(game\)\s*\n\s*switch \(phase\)/.test(src))
	ok('★★ 日本回合边界 + 美国回合幂等兜底都在 check_neutral_end_on_turn',
		/if \(nation === '日本' && check_us_join_by_axis_hold\(game\)\)/.test(src) &&
		/if \(check_us_join_by_axis_hold\(game\)\) fired\.push\('美国'\)/.test(src))
	ok('★ 计数/占领口径未改（仍按 2026-10-19 玩家口径注释）',
		/"战略点"口径（玩家 2026-10-19 口径）/.test(src) &&
		/has_pieces\(game, \{ space: sp\.id, faction: AXIS \}\)/.test(src))
	/* 【B46】卡表找回 bump 过版本串，这里只校验统一性 */
	ok('★ 版本串统一且非空（B42 当轮为 20261112p）',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v && v === (phtml.match(/\?v=([0-9a-z]+)/) || [])[1]),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
