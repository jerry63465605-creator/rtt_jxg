/*
 * S2-b 真实测试 ③：发起单位非法（不存在 / 不属于本方）→ 预检拒，代价（损耗）不付
 *
 * 场景：15245《俯冲式轰炸机》（损耗 1 张）在"发起陆战后"被武装，
 * 但玩家/客户端可能传来错误的 from（敌方部队 id、或不存在的 id）。
 * 改动前：先损耗 1 张 → run 里 do_battle 拒绝 → 白亏。
 * 现在：precheck_launch_battle 在付代价前拦下。
 *
 *  A. from = 敌方部队 id → 拒「不属于本方」，牌库/弃牌堆不变
 *  B. from = 不存在的 id → 拒「不在场上」，牌库/弃牌堆不变
 *  C. 缺 space → 拒「请指定战斗地区」，代价不付
 *  D. 合法 from → 成功（对照，证明没把正常路径拦死）
 *
 * 用法：node tools/_real_test_precheck_from.js
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
	I.do_battle(g, '苏联', foeSpace, 'de_x', 'land', { from: 'su_atk' })
	R.view(g, 'Allies')
	return { g, foeSpace }
}

const snap = g => ({
	deck: (g.decks['苏联'] || []).length,
	disc: (g.discard['苏联'] || []).length,
})

const { g, foeSpace } = setup()

console.log('=== A. from = 敌方部队 id ===')
{
	const s0 = snap(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: inst(g), from: 'de_x', space: foeSpace })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★★ 预检拒（不属于本方）', /不属于本方|现在不能发动/.test(lg), lg)
	ok('★★ 无损耗（牌库/弃牌堆不变）', snap(g).deck === s0.deck && snap(g).disc === s0.disc, JSON.stringify([s0, snap(g)]))
}

console.log('\n=== B. from = 不存在的 id ===')
{
	const s0 = snap(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: inst(g), from: 'ghost_1', space: foeSpace })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★★ 预检拒（不在场上）', /不在场上|不属于本方|现在不能发动/.test(lg), lg)
	ok('★★ 无损耗', snap(g).deck === s0.deck && snap(g).disc === s0.disc, JSON.stringify([s0, snap(g)]))
}

console.log('\n=== C. 缺 space ===')
{
	const s0 = snap(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: inst(g), from: 'su_atk' })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★★ 预检拒（请指定战斗地区）', /请指定战斗地区|现在不能发动/.test(lg), lg)
	ok('★★ 无损耗', snap(g).deck === s0.deck && snap(g).disc === s0.disc, JSON.stringify([s0, snap(g)]))
}

console.log('\n=== D. 对照：合法 from + 目标 → 正常发动（真损耗 1 张）===')
{
	const s0 = snap(g)
	const victim = I.pieces_on(g, foeSpace).find(p => g.piece_nation[p] === '德国')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: inst(g), from: 'su_atk', space: foeSpace, victim })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★ 成功发动', /发起陆战|空打/.test(lg), lg)
	ok('★ 这次真的损耗 1 张', snap(g).deck === s0.deck - 1, JSON.stringify([s0, snap(g)]))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
