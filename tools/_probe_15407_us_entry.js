/*
 * 复现：15407 秋水火箭战斗机（卡效果消灭敌方空军）是否误触发美国参战。
 *
 *   甲：卡效果消灭美军空军 -> 玩家口径「被卡消灭不算被攻击」=> 美国应【仍中立】
 *   乙：直接调用 seize_air（= 玩家"夺取制空权"动作）=> 美国应【参战】（对照组）
 *
 * 布阵（满足 seize_air 的前置）：
 *   · 日本陆军 + 日本空军 都在<日本>（大本营格，陆军给空军供补给）
 *   · 美国空军放在<日本>的相邻格（seize_air 要求发起空军与目标"相邻"，不接受同格）
 *
 * 用法：node tools/_probe_15407_us_entry.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

const JP = d.id_of('日本')
const US_SPACE = (d.spaces[JP].connections || []).map(Number)[0]

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'discard'
	g.hands['日本'] = ['15407#1', '15341#50']
	g.decks['日本'] = ['15345#90', '15345#91']
	g.neutral = { '美国': true, '苏联': true }
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.location['jp_army'] = JP
	g.piece_nation['jp_army'] = '日本'
	g.piece_type['jp_army'] = 'army'
	g.location['jp_air'] = JP
	g.piece_nation['jp_air'] = '日本'
	g.piece_type['jp_air'] = 'air'
	g.location['us_air'] = US_SPACE
	g.piece_nation['us_air'] = '美国'
	g.piece_type['us_air'] = 'air'
	I.refresh && I.refresh(g)
	const sup = I.compute_supply(g)
	console.log('  布阵：日本陆军+空军@' + d.name_of(JP) + '，美国空军@' +
		d.name_of(US_SPACE) + '（jp_air 补给=' + !!(sup.in_supply || {})['jp_air'] + '）')
	return g
}

console.log('\n=== 甲：15407 卡效果消灭美军空军 ===')
{
	const g = fresh()
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15407#1' })
	console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
	ok('美军空军被消灭', g.location['us_air'] == null, 'loc=' + g.location['us_air'])
	ok('★ 美国【仍中立】（被卡消灭不算被攻击）', I.is_neutral(g, '美国') === true,
		'neutral=' + JSON.stringify(g.neutral))
	ok('日志无「美国】结束中立」',
		(g.log || []).slice(n0).join(' ').indexOf('美国】结束中立') < 0,
		(g.log || []).slice(n0).join(' | '))
}

console.log('\n=== 乙（对照）：seize_air 作为"动作" ===')
{
	const g = fresh()
	const n0 = (g.log || []).length
	const r = I.seize_air(g, '日本', US_SPACE, 'jp_air')
	console.log('  seize_air = ' + JSON.stringify(r))
	console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
	ok('美军空军被消灭', g.location['us_air'] == null)
	ok('美国参战（动作=攻击，应触发）', I.is_neutral(g, '美国') === false,
		'neutral=' + JSON.stringify(g.neutral))
}

console.log('\n=== 丙：静态覆盖检查（以后新增"卡效果消灭"的卡不许漏 by:\'card\'）===')
{
	const src = require('fs').readFileSync(path.join(__dirname, '..', 'server-official',
		'public', 'quartermaster-sub-wars', 'rules.js'), 'utf8')
	const lines = src.split('\n')
	const calls = []
	lines.forEach((l, i) => {
		if (/seize_air\(/.test(l) && !/^\s*function seize_air/.test(l)) calls.push({ line: i + 1, text: l.trim() })
	})
	const actionCalls = calls.filter(c => /arg\.from/.test(c.text))
	const cardCalls = calls.filter(c => /\{\s*by:\s*'card'\s*\}/.test(c.text))
	console.log('  调用点共 ' + calls.length + ' 处：动作 ' + actionCalls.length +
		'，卡效果带 by:card ' + cardCalls.length)
	ok('只有 1 处是"玩家动作"路径（不传 by）', actionCalls.length === 1,
		JSON.stringify(actionCalls))
	ok('其余 4 处卡效果都带 by:\'card\'', cardCalls.length === 4,
		JSON.stringify(calls.map(c => c.line)))
	ok('没有"两者都不像"的漏网调用', calls.length === actionCalls.length + cardCalls.length,
		JSON.stringify(calls))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
