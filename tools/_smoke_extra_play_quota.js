/*
 * 回归测试：国家技能"额外打出（免费）"不应占出牌数。
 *
 * 复现 issue：发动国家技能后，手牌响应卡显示"免费打出"标识，但打出仍占出牌数。
 * 根因：check_phase_for_card 只在 play_done 已置位时才把一次打出标成 extra，
 *       导致"先打免费牌（play_done 尚未置位）"被当成普通打出而 mark_play_done。
 *
 * 覆盖三种情形（均用日本响应卡 15420=本土决战）：
 *   A. 普通响应卡（无额外打出）→ 应正常占名额（保证 mark 机制没坏）
 *   B. 先占名额(play_done=true)+额外打出 → 免费牌走额外通道，不二次标记
 *   C. 先打免费响应牌（play_done 未置位）→ 不应占出牌数（本次修复点）
 *
 * 用法：node tools/_smoke_extra_play_quota.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

function baseGame() {
	let g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.play_done = {}
	g.hands = g.hands || {}
	g.hands['日本'] = ['15420#1']
	return g
}

function setExtra(g, filter) {
	/* extra_play 的直接形态（引擎在 check_phase_for_card / extra_play_allows 读取的就是它） */
	g.extra_play = {
		nation: '日本',
		source: 'skill.日本',
		source_name: '日本国家技能',
		filter: filter || 'response',
		count: 1,
		turn: g.turn,
		phase: g.turn_phase,
	}
}

console.log('=== A. 控制组：普通响应卡占名额（mark 机制正常）===')
{
	let g = baseGame()
	g = rules.action(g, '日本', 'play_card', { card: '15420#1' })
	ok('普通响应卡打出后 play_done[日本]=true', !!(g.play_done && g.play_done['日本']),
		'play_done=' + JSON.stringify(g.play_done))
	ok('15420 进入桌面响应区', (g.table_responses || []).some(r => r.card_id === '15420#1'))
}

console.log('\n=== B. 先占名额 + 额外打出：免费牌走额外通道，不二次标记 ===')
{
	let g = baseGame()
	g.play_done['日本'] = true
	setExtra(g, 'response')
	const before = g.play_done['日本']
	g = rules.action(g, '日本', 'play_card', { card: '15420#1' })
	ok('免费响应牌打出后 play_done[日本] 仍为 true（未清零/未重复）',
		g.play_done['日本'] === before, 'play_done=' + JSON.stringify(g.play_done))
	ok('额外打出已消耗（extra_play 清空）', !g.extra_play)
}

console.log('\n=== C. 回归组：先打免费响应牌（play_done 未置位）不占出牌数 ===')
{
	let g = baseGame()
	setExtra(g, 'response')
	ok('授予 extra_play(response) 成功',
		!!(g.extra_play && g.extra_play.filter === 'response'))
	g = rules.action(g, '日本', 'play_card', { card: '15420#1' })
	ok('免费响应牌打出后 play_done[日本] 仍为 falsy（修复点：不占出牌数）',
		!(g.play_done && g.play_done['日本']), 'play_done=' + JSON.stringify(g.play_done))
	ok('15420 已从手牌移除', !g.hands['日本'].includes('15420#1'))
	ok('15420 进入桌面响应区', (g.table_responses || []).some(r => r.card_id === '15420#1'))
	ok('额外打出已消耗（extra_play 清空）', !g.extra_play)
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
