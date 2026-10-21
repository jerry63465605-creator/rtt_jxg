/*
 * 回归测试：17512《战俘》
 *   卡面：计分阶段开始时：本回合内每有 1 支【敌方】部队被移除，获得 1 分。
 *
 * 2026-10-22 检查（口径见 rtt-turn-system：本回合 = 1 个国家回合，不是整轮）：
 *   ① 旧实现读全局 removed_this_turn，同轮内别国回合的移除也被算给美国；
 *   ② 同盟自己的部队被移除同样 +1（方向反了，卡面写"敌方"）。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_17512.js
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}
const WEST = I.space_ids_of(['西欧'])[0]
const NORDIC = I.space_ids_of(['北欧'])[0]

function base() {
	const g = rules.setup(12345, 'Standard', {})
	g.opening = null
	g.active = 'Allies'
	g.current_nation = '美国'
	g.turn_phase = 'scoring'
	g.turn = g.turn || 1
	g.hands['美国'] = g.hands['美国'] || []
	g.hands['美国'].push('17512#1')
	/* 清掉可能存在的旧计数，按"美国回合刚开始"起步 */
	I.reset_removed_this_turn(g)
	return g
}
function alliesScore(g) { return (g.score && g.score.allies) || 0 }

console.log('=== A. 美国回合内消灭 2 支德国部队 -> +2 ===')
{
	let g = base()
	for (const [pid, sp] of [['de1', WEST], ['de2', NORDIC]]) {
		g.location[pid] = sp
		g.piece_nation[pid] = '德国'
		g.piece_type[pid] = 'army'
	}
	ok('消灭德国陆军 #1', I.eliminate_piece(g, '美国', WEST, 'de1').ok === true)
	ok('消灭德国陆军 #2', I.eliminate_piece(g, '美国', NORDIC, 'de2').ok === true)
	const before = alliesScore(g)
	g = rules.action(g, 'Allies', 'play_card', { card: '17512#1' })
	ok('同盟分 +2', alliesScore(g) - before === 2, before + ' -> ' + alliesScore(g))
	ok('计数已清零', I.removed_this_turn_of_faction(g, 'axis') === 0)
}

console.log('\n=== B. 只有同盟部队被移除 -> 0 分（卡面是"敌方部队"）===')
{
	let g = base()
	g.location['uk1'] = WEST
	g.piece_nation['uk1'] = '英国'
	g.piece_type['uk1'] = 'army'
	/* 德国消灭英国陆军（同盟损失） */
	ok('德国消灭英国陆军', I.eliminate_piece(g, '德国', WEST, 'uk1').ok === true)
	ok('阵营计数记在 allies', I.removed_this_turn_of_faction(g, 'allies') === 1,
		String(I.removed_this_turn_of_faction(g, 'allies')))
	const before = alliesScore(g)
	g = rules.action(g, 'Allies', 'play_card', { card: '17512#1' })
	ok('同盟分不变', alliesScore(g) - before === 0, before + ' -> ' + alliesScore(g))
}

console.log('\n=== C. 本回合=国家回合：国家轮转后清零 ===')
{
	let g = base()
	g.location['de3'] = WEST
	g.piece_nation['de3'] = '德国'
	g.piece_type['de3'] = 'army'
	I.eliminate_piece(g, '美国', WEST, 'de3')
	ok('美国回合内记到 1', I.removed_this_turn_of_faction(g, 'axis') === 1)
	/* 走真实的行动国轮转动作（next_phase 跑完 7 阶段后也走同一停点） */
	g = rules.action(g, 'Allies', 'next_nation', {})
	ok('轮转后清零', I.removed_this_turn_of_faction(g, 'axis') === 0,
		'current=' + g.current_nation + ' axis=' + I.removed_this_turn_of_faction(g, 'axis'))
}

console.log('\n=== D. 敌方与友方混合 -> 只数敌方 ===')
{
	let g = base()
	g.location['de4'] = WEST; g.piece_nation['de4'] = '德国'; g.piece_type['de4'] = 'army'
	g.location['uk4'] = NORDIC; g.piece_nation['uk4'] = '英国'; g.piece_type['uk4'] = 'army'
	I.eliminate_piece(g, '美国', WEST, 'de4')     /* 敌方损失 */
	I.eliminate_piece(g, '德国', NORDIC, 'uk4')   /* 友方损失 */
	const before = alliesScore(g)
	g = rules.action(g, 'Allies', 'play_card', { card: '17512#1' })
	ok('同盟分只 +1', alliesScore(g) - before === 1, before + ' -> ' + alliesScore(g))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
