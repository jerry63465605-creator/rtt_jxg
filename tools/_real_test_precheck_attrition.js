/*
 * S2-b 真实测试 ②：15245（损耗 1 张）—— 预检不过时【绝不损耗】
 *
 * 对照价值：改动前 17544/15245 这类卡"先损耗、再执行"，run 发现目标非法就白亏 1 张
 * （实测 17544 对空地连点 3 次各损耗 1 张）。本测试固定住"预检在前"。
 *
 *  A. 目标格 = 本方地区 → 预检拒：牌库/弃牌堆张数不变（未损耗）、卡仍可重试
 *  B. 合法目标（敌方 + victim）→ 成功：牌库 -1、弃牌堆 +1、记账、窗口消费
 *  C. 日志三层断言：拒绝文案 / 成功文案含「损耗」
 *
 * 用法：node tools/_real_test_precheck_attrition.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const inst = g => (g.table['苏联'] || []).find(x => faceOf(x) === '15245')

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = g.neutral || {}
	g.neutral['苏联'] = false
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	if (!(g.hands['苏联'] || []).some(x => faceOf(x) === '15245'))
		R.action(g, 'Allies', 'debug_add_card', { face: '15245', nation: '苏联', dest: 'hand' })
	I.refresh(g)
	const card = (g.hands['苏联'] || []).find(x => faceOf(x) === '15245')
	R.action(g, 'Allies', 'play_card', { card })
	I.refresh(g)
	R.action(g, 'Allies', 'debug_place', { piece: 'su_atk', nation: '苏联', type: 'army', space: d.id_of('罗斯') })
	const foeSpace = I.get_connections(g, d.id_of('罗斯'), 'allies')
		.find(s => d.spaces[s] && d.spaces[s].terrain !== 'sea' &&
			!Object.keys(g.location).some(p => g.location[p] === s))
	R.action(g, 'Axis', 'debug_place', { piece: 'de_x', nation: '德国', type: 'army', space: foeSpace })
	I.refresh(g)
	I.grant_supply(g, 'su_atk', g.turn)
	I.grant_supply(g, 'de_x', g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	I.do_battle(g, '苏联', foeSpace, 'de_x', 'land', { from: 'su_atk' })
	console.log('  触发战斗: ' + logSince(g, n0))
	R.view(g, 'Allies')
	return { g, foeSpace }
}

const { g, foeSpace } = setup()

console.log('=== 布阵与窗口 ===')
{
	ok('15245 已上桌', !!inst(g), JSON.stringify((g.table['苏联'] || []).map(faceOf)))
	ok('★ 15245 被武装（after_land）', (g.status_instant || []).some(e => String(e.card_id) === String(inst(g))),
		JSON.stringify((g.status_instant || []).map(e => e.card_id)))
}

console.log('\n=== A. 目标 = 本方地区 → 预检拒，且【不损耗】 ===')
{
	const deck0 = (g.decks['苏联'] || []).length
	const disc0 = (g.discard['苏联'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: inst(g), from: 'su_atk', space: d.id_of('罗斯') })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★★ 被预检拦下', /有我方部队|不能攻击|现在不能发动/.test(lg), lg)
	ok('★★ 牌库未减（没损耗）', (g.decks['苏联'] || []).length === deck0,
		deck0 + ' -> ' + (g.decks['苏联'] || []).length)
	ok('★★ 弃牌堆未增', (g.discard['苏联'] || []).length === disc0,
		disc0 + ' -> ' + (g.discard['苏联'] || []).length)
	ok('★ 未记账', !(g.status_used || {})[String(inst(g))], JSON.stringify(g.status_used))
	ok('★ 窗口仍保留（可重试）', (g.status_instant || []).some(e => String(e.card_id) === String(inst(g))))
}

console.log('\n=== B. 合法目标 → 真损耗 1 张并成功 ===')
{
	const victim = I.pieces_on(g, foeSpace).find(p => g.piece_nation[p] === '德国')
	const deck0 = (g.decks['苏联'] || []).length
	const disc0 = (g.discard['苏联'] || []).length
	const n0 = (g.log || []).length
	console.log('  victim = ' + JSON.stringify(victim))
	R.action(g, 'Allies', 'activate_status', { card: inst(g), from: 'su_atk', space: foeSpace, victim })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★ 成功（发起陆战 / 空打都算合法）', /发起陆战|空打/.test(lg), lg)
	ok('★ 确实损耗了 1 张（牌库 -1 / 弃牌堆 +1）',
		(g.decks['苏联'] || []).length === deck0 - 1 && (g.discard['苏联'] || []).length === disc0 + 1,
		JSON.stringify({ deck: [deck0, (g.decks['苏联'] || []).length], disc: [disc0, (g.discard['苏联'] || []).length] }))
	ok('★ 已记账', (g.status_used || {})[String(inst(g))] != null, JSON.stringify(g.status_used))
}

console.log('\n=== C. 客户端视角 ===')
{
	const v = R.view(g, 'Allies')
	const ts = (v.table_status || []).find(x => String(x.card) === String(inst(g)))
	console.log('  table_status = ' + JSON.stringify(ts && { ready: ts.ready, used_this_turn: ts.used_this_turn }))
	ok('★ ready=false 且 used_this_turn=true', !!ts && ts.ready === false && ts.used_this_turn === true,
		JSON.stringify(ts && { r: ts.ready, u: ts.used_this_turn }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
