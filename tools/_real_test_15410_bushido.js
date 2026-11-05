/*
 * 15410《武士道》真实测试（用户场景：日本陆军【带空军】被【带空军】的敌军攻击）
 *
 *  A 攻击发起 → 挂起阶段是否为 'guard'（保护卡先于空军代受，避免"窗口互抢"）
 *  B guard 候选里能拿到 15410；客户端视角 armed/prompt 正常
 *  C 打出 15410（弃 1 张响应卡）→ 陆军注册 protect、本次战斗不被移除、卡进弃牌堆
 *  D 打出后进入 defend（空军代受仍可选）→ 不代受也能保住陆军
 *  E 选择「不使用保护卡」→ 陆军按原结果被移除
 *  F 手里没有响应卡 → guard 不出现（不产生"点不了"的空窗），直接进 defend
 *  G 无残留（pending_battle / armed_offers / pending_echo）
 *
 * 用法：node tools/_real_test_15410_bushido.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const EAST = () => d.id_of('东欧'), ROSS = () => d.id_of('罗斯')

function setup(opts) {
	opts = opts || {}
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 日本：15410 + 1 张响应卡（15420 本土决战） */
	R.action(g, 'Axis', 'debug_add_card', { face: '15410', nation: '日本', dest: 'hand' })
	if (opts.withResponse !== false)
		R.action(g, 'Axis', 'debug_add_card', { face: '15420', nation: '日本', dest: 'hand' })
	/* 日本陆军(+空军) 在东欧 */
	R.action(g, 'Axis', 'debug_place', { piece: 'jp_army', nation: '日本', type: 'army', space: EAST() })
	if (opts.withAir !== false)
		R.action(g, 'Axis', 'debug_place', { piece: 'jp_air', nation: '日本', type: 'air', space: EAST() })
	/* 苏联陆军(+空军) 在罗斯（与东欧相邻） */
	R.action(g, 'Allies', 'debug_place', { piece: 'su_army', nation: '苏联', type: 'army', space: ROSS() })
	if (opts.withAir !== false)
		R.action(g, 'Allies', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: ROSS() })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	I.refresh(g)
	for (const p of ['jp_army', 'jp_air', 'su_army', 'su_air'])
		if (g.location[p] != null) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	return g
}
const guardCard = g => {
	const gs = (g.pending_battle && g.pending_battle.guard_cards) || []
	const hit = gs.find(x => faceOf(x.card_id || x.card || x.id) === '15410')
	return hit && (hit.card_id || hit.card || hit.id)
}
/* 手里真正的【响应卡】（15410 的代价要求 filter:'response'） */
const respCard = g => (g.hands['日本'] || []).find(x => {
	const c = I.inst_card(x) || {}
	return faceOf(x) !== '15410' && String(c.type || '').toUpperCase() === 'RESPONSE'
})

console.log('=== A. 攻击发起：先挂 guard（保护卡），不是 defend（代受）===')
let gA = null, cardA = null
{
	const g = setup(); gA = g
	const n0 = (g.log || []).length
	I.do_battle(g, '苏联', EAST(), 'jp_army', 'land', { from: 'su_army' })
	console.log('  log: ' + logSince(g, n0).slice(0, 220))
	console.log('  pending_battle = ' + JSON.stringify(g.pending_battle && {
		stage: g.pending_battle.stage,
		guard: (g.pending_battle.guard_cards || []).map(x => x.card_id || x.card || x.id),
		victim: g.pending_battle.victim,
	}))
	ok('★★ 首先挂在 guard 阶段（保护卡先问）', !!g.pending_battle && g.pending_battle.stage === 'guard',
		JSON.stringify(g.pending_battle && g.pending_battle.stage))
	ok('★★ guard 候选里含 15410', !!guardCard(g), JSON.stringify((g.pending_battle && g.pending_battle.guard_cards) || []))
	ok('★ 陆军仍在（尚未移除）', g.location['jp_army'] != null)
	cardA = guardCard(g)
}

console.log('\n=== B. 打出 15410（弃 1 张响应卡）→ 陆军受保护 ===')
{
	const g = gA
	const resp = respCard(g)
	console.log('  弃置代价 = ' + resp)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { guard: cardA, drop: [resp] })
	console.log('  log: ' + logSince(g, n0).slice(0, 300))
	console.log('  pending_battle = ' + JSON.stringify(g.pending_battle && { stage: g.pending_battle.stage }))
	console.log('  日本陆军 = ' + JSON.stringify(g.location['jp_army']) + '  日本空军 = ' + JSON.stringify(g.location['jp_air']))
	ok('★★ 陆军未被移除（protect 生效）', g.location['jp_army'] != null, JSON.stringify(g.location['jp_army']))
	ok('★ 15410 已进弃牌堆', (g.discard['日本'] || []).some(x => faceOf(x) === '15410'),
		JSON.stringify((g.discard['日本'] || []).map(faceOf)))
	ok('★ 响应卡已弃置', !(g.hands['日本'] || []).includes(resp))
	ok('★★ 之后仍可进入空军代受阶段（不是被保护卡吞掉）',
		!g.pending_battle || g.pending_battle.stage === 'defend',
		JSON.stringify(g.pending_battle && g.pending_battle.stage))
}

console.log('\n=== C. 不代受收尾：陆军保住、无残留 ===')
{
	const g = gA
	if (g.pending_battle && g.pending_battle.stage === 'defend') {
		const n0 = (g.log || []).length
		R.action(g, 'Axis', 'resolve_battle', { declined_defend_air: true })
		console.log('  不代受 log: ' + logSince(g, n0).slice(0, 220))
	}
	ok('★★ 陆军仍在（整个战斗结束）', g.location['jp_army'] != null)
	ok('★ 空军仍在（未白白代受）', g.location['jp_air'] != null)
	ok('★ 无残留挂起', !g.pending_battle, JSON.stringify(g.pending_battle && g.pending_battle.stage))
}

console.log('\n=== D. 选择「不使用保护卡」→ 陆军被移除 ===')
{
	const g = setup()
	I.do_battle(g, '苏联', EAST(), 'jp_army', 'land', { from: 'su_army' })
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', {})
	console.log('  log: ' + logSince(g, n0).slice(0, 260))
	console.log('  陆军 = ' + JSON.stringify(g.location['jp_army']) + '  pending=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
	ok('★ 不使用保护卡 → 之后进入空军代受阶段',
		!g.pending_battle || g.pending_battle.stage === 'defend',
		JSON.stringify(g.pending_battle && g.pending_battle.stage))
	if (g.pending_battle && g.pending_battle.stage === 'defend') {
		R.action(g, 'Axis', 'resolve_battle', { declined_defend_air: true })
		console.log('  再不代受后：陆军 = ' + JSON.stringify(g.location['jp_army']) +
			'  pending=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
	}
	ok('★★ 不使用保护卡且不代受 → 陆军被移除', g.location['jp_army'] == null, JSON.stringify(g.location['jp_army']))
	ok('★ 15410 仍留在手里（未消耗）', (g.hands['日本'] || []).some(x => faceOf(x) === '15410'))
}

console.log('\n=== E. 代价可付性：有响应卡才进 guard；付不起则不出现 ===')
{
	const g = setup()
	const n0 = (g.log || []).length
	I.do_battle(g, '苏联', EAST(), 'jp_army', 'land', { from: 'su_army' })
	console.log('  log: ' + logSince(g, n0).slice(0, 200))
	console.log('  pending = ' + JSON.stringify(g.pending_battle && {
		stage: g.pending_battle.stage, guard: (g.pending_battle.guard_cards || []).length,
	}))
	ok('★ 起手有响应卡 → 正常挂 guard', !!g.pending_battle && g.pending_battle.stage === 'guard')

	/* 纯函数级验证：把日本手牌临时压成"只有 15410"（不参与真实对局，仅供这次审计） */
	const c15410 = (g.hands['日本'] || []).find(x => faceOf(x) === '15410')
	const saved = g.hands['日本']
	g.hands['日本'] = [c15410]
	const cands = I.guard_card_candidates(g, 'jp_army', '苏联', EAST(), 'land')
	g.hands['日本'] = saved
	console.log('  手里只剩 15410 时的 guard 候选 = ' + JSON.stringify(cands.map(x => x.card_id)))
	ok('★★ 付不起代价（没有响应卡）→ 15410 不进 guard 候选（不产生空窗口）',
		!cands.some(x => faceOf(x.card_id) === '15410'), JSON.stringify(cands.map(x => x.card_id)))
}

console.log('\n=== F. 静态守卫 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('15410 走 suspend（挂起战斗再问）', /when: 'piece_attacked', actor: '日本'[\s\S]{0,300}suspend: true/.test(src))
	ok('guard 候选由 guard_card_candidates 统一筛选', /function guard_card_candidates/.test(src))
	ok('guard 阶段允许玩家选弃哪张响应卡（arg.drop）', /const drop = \(\(arg && arg\.drop\) \|\| \[\]\)/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
