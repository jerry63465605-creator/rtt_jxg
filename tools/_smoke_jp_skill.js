/*
 * 日本国家技能（一步式 facedown）回归自检 — 2026-10-11
 * 验证：共用原子 discard_and_facedown 在 mode='facedown'（默认）下，
 * 日本"弃 1 张响应 + 暗置打出 1 张响应"行为不变。
 * 用法：node tools/_smoke_jp_skill.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++; else pass++
}

function setupJP() {
	let g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'scoring'
	g.play_done = {}
	g.turn = g.turn || 1
	g.national_skill_used = {}
	g.hands['日本'] = ['15419#1', '15420#1', '15421#1']
	g.national_skill_offer = {
		nation: '日本', trigger: 'scoring', source: '日本国家技能',
		source_name: '日本国家技能', cost: { discard: 1, filter: 'response' },
		grant: { filter: 'response' },
	}
	return g
}

console.log('=== 日本国家技能：弃 1 响应 + 暗置 1 响应（15420）===')
let g = setupJP()
g = rules.action(g, '日本', 'use_national_skill', {
	drop: ['15419#1'], play: '15420#1',
})
ok('代价牌 15419 已从手牌移除', !g.hands['日本'].includes('15419#1'))
ok('打出牌 15420 已从手牌移除', !g.hands['日本'].includes('15420#1'))
ok('15420 进入桌面响应区 game.table_responses',
	(g.table_responses || []).some(r => r.card_id === '15420#1'),
	'responses=' + JSON.stringify(g.table_responses))
ok('一回合一次：national_skill_used[日本] === turn',
	g.national_skill_used['日本'] === g.turn)
ok('使用后 offer 已清空', g.national_skill_offer === null)

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
