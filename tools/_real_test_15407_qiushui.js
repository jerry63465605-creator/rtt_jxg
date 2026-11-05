/*
 * B3 真实测试：15407《秋水火箭战斗机》—— 消灭哪一支敌机要玩家选（need:'piece' + 确认）
 *
 *  A 打出（不带 piece）-> 下发候选（pending_echo.step='piece'），敌机仍在（未自动挑）
 *  B 带 piece 重发       -> 只消灭选中的那一支，另一支仍存活
 *  C 没有合法目标        -> 明确拒绝（不误伤、不空转）
 *  D 乱传 piece          -> 拒绝且不消灭
 *  E 不打算打出（可选性）-> 敌机全在
 *  F 静态守卫：run 里用 need:'piece'，不再 for 循环自动挑第一支
 *
 * 用法：node tools/_real_test_15407_qiushui.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function setup(withTargets = true) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15407', nation: '日本', dest: 'hand' })
	if (withTargets) {
		/* 日本空军@硫磺岛（大本营，补给中）；两架美机：中太平洋（相邻）、东海（相邻） */
		R.action(g, 'Axis', 'debug_place', { piece: 'jp_air', nation: '日本', type: 'air', space: d.id_of('硫磺岛') })
		R.action(g, 'Allies', 'debug_place', { piece: 'us_a1', nation: '美国', type: 'air', space: d.id_of('中太平洋') })
		R.action(g, 'Allies', 'debug_place', { piece: 'us_a2', nation: '美国', type: 'air', space: d.id_of('东海') })
		I.refresh(g)
		I.grant_supply(g, 'jp_air', g.turn)
		I.grant_supply(g, 'us_a1', g.turn)
		I.grant_supply(g, 'us_a2', g.turn)
	}
	I.refresh(g)
	/* 15407 只能在弃牌阶段打出 */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'discard' })
	I.refresh(g)
	return g
}
const cardOf = g => (g.hands['日本'] || []).find(x => String(x).startsWith('15407'))

console.log('=== A. 打出（不带 piece）→ 下发候选 ===')
let gA = null, cardA = null
{
	const g = setup(); gA = g; cardA = cardOf(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cardA })
	console.log('  log: ' + logSince(g, n0))
	console.log('  pending_echo = ' + JSON.stringify(g.pending_echo && {
		kind: g.pending_echo.kind, step: g.pending_echo.step,
		options: (g.pending_echo.options || []).map(o => o.label),
	}))
	ok('★★ 下发了选择框（choice 候选 = 两架敌机）',
		!!g.pending_echo && g.pending_echo.step === 'choice' && (g.pending_echo.options || []).length === 2,
		JSON.stringify(g.pending_echo && g.pending_echo.step))
	ok('★★ 敌机未被自动消灭（两架都在）',
		g.location['us_a1'] != null && g.location['us_a2'] != null,
		JSON.stringify({ a1: g.location['us_a1'], a2: g.location['us_a2'] }))
}

console.log('\n=== B. 带 piece 重发 → 只消灭选中的那一支 ===')
{
	const g = gA
	/* 选项 0 = 「美国空军@中太平洋」= us_a1；另一架 us_a2 必须活着 */
	const target = 'us_a1'
	const other = 'us_a2'
	console.log('  选中第 0 项（' + (g.pending_echo.options || [{}])[0].label + '）=> ' + target + '（另一架 ' + other + '）')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cardA, choice: 0 })
	console.log('  log: ' + logSince(g, n0))
	console.log('  ' + target + '=' + JSON.stringify(g.location[target]) + '  ' + other + '=' + g.location[other])
	ok('★★ 选中的那一支被消灭', g.location[target] == null, target + '=' + g.location[target])
	ok('★★ 另一架仍存活', g.location[other] != null, other + '=' + g.location[other])
}

console.log('\n=== C. 没有合法目标 → 明确拒绝 ===')
{
	const g = setup(false)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cardOf(g) })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★ 明确说明没有可消灭的敌机', /没有相邻日本空军的敌方空军|无法执行/.test(lg), lg)
	ok('★ 没有残留 pending_echo', !g.pending_echo, JSON.stringify(g.pending_echo))
}

console.log('\n=== D. 乱传 choice → 拒绝且不消灭 ===')
{
const g = setup()
/* 先进入选择态，再传一个越界 choice */
R.action(g, 'Axis', 'play_card', { card: cardOf(g) })
I.refresh(g)
const n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: cardOf(g) || '15407', choice: 99 })
const lg = logSince(g, n0)
console.log('  log: ' + lg)
ok('★ 拒绝（所选目标无效）', /无效|无法执行|不在候选/.test(lg), lg)
ok('★ 两架敌机都还在', g.location['us_a1'] != null && g.location['us_a2'] != null)
}

console.log('\n=== E. 不打算打出（可选性）===')
{
	const g = setup()
	/* 直接跳过弃牌阶段（不打出 15407） */
	R.action(g, 'Axis', 'next_phase', {})
	console.log('  phase=' + g.turn_phase)
	ok('★ 不打出时敌机全在', g.location['us_a1'] != null && g.location['us_a2'] != null)
	ok('★ 卡仍在手里', !!cardOf(g), JSON.stringify((g.hands['日本'] || []).filter(x => String(x).startsWith('15407'))))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const i = src.indexOf("'15407': {")
	const seg = src.slice(i, i + 1800)
	ok('run 里按 arg.choice 精确消灭', /arg\.choice/.test(seg))
	ok('候选由 event_card_needs 下发', /faceId === '15407'/.test(src))
	ok('不再是 for 循环自动挑第一支', !/for \(const p in game\.piece_nation\)/.test(seg))
	ok('qiushui_targets 助手已实现', /function qiushui_targets/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
