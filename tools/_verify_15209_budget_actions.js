/*
 * 15209《伞兵》战斗步建立预算后必须能继续操作（客户端卡死修复验证）
 *
 *  A. 存量局面（DB game 10 快照：event_budget + 空 pending_echo 共存）
 *     -> 预算国拿得到 event_battle / event_finish；对手仍只有 log
 *  B. 新建局面（真实 play_card 15209）
 *     -> 不再产生 pending_echo，动作含 event_battle / event_finish
 *  C. 真实 event_finish 收尾后无残留、卡不丢
 *
 * 用法：node --experimental-sqlite tools/_verify_15209_budget_actions.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const acts = v => Object.keys(v.actions || {})

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

/* ---------- A. 存量局面 ---------- */
console.log('=== A. 存量局面（DB game 10 快照）===')
{
	const { DatabaseSync } = require('node:sqlite')
	const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
	const row = db.prepare('select state from game_snap where game_id = 10 order by snap_id desc limit 1').get()
	if (!row) console.log('  （无快照，跳过 A）')
	else {
		const g = JSON.parse(row.state)
		if (typeof g.log === 'number') g.log = []
		I.refresh(g)
		console.log('  budget=' + JSON.stringify(g.event_budget && { nation: g.event_budget.nation, remaining: g.event_budget.remaining }) +
			'  pending_echo=' + JSON.stringify(g.pending_echo && { kind: g.pending_echo.kind, step: g.pending_echo.step, options: g.pending_echo.options, cands: g.pending_echo.cands }))
		const vA = R.view(g, 'Axis'), vX = R.view(g, 'Allies')
		console.log('  Axis actions=' + JSON.stringify(acts(vA)) + '  Allies actions=' + JSON.stringify(acts(vX)))
		ok('★★ 预算国拿得到 event_battle', acts(vA).indexOf('event_battle') >= 0, JSON.stringify(acts(vA)))
		ok('★★ 预算国拿得到 event_finish（「结束」按钮）', acts(vA).indexOf('event_finish') >= 0, JSON.stringify(acts(vA)))
		ok('对手侧仍被冻结（只有 log）', acts(vX).length <= 1, JSON.stringify(acts(vX)))
		ok('不再返回只有 resolve_effect 的排他集',
			!(acts(vA).length === 1 && acts(vA)[0] === 'resolve_effect'), JSON.stringify(acts(vA)))
		ok('★★ 空框不再下发（客户端不会弹全屏空框）',
			!vA.pending_echo, JSON.stringify(vA.pending_echo))
	}
}

/* ---------- B. 新建局面 ---------- */
function setup15209() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: d.id_of('德国') })
	if (!(g.hands['德国'] || []).some(x => faceOf(x) === '15209'))
		R.action(g, 'Axis', 'debug_add_card', { face: '15209', nation: '德国', dest: 'hand' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	return g
}

console.log('\n=== B. 新建局面：真实 play_card 15209 ===')
{
	const g = setup15209()
	const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15209')
	ok('15209 在德国手牌', !!card)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	console.log('  log: ' + logSince(g, n0))
	console.log('  event_budget=' + JSON.stringify(g.event_budget && {
		card: g.event_budget.card_id, nation: g.event_budget.nation, remaining: g.event_budget.remaining,
	}))
	console.log('  pending_echo=' + JSON.stringify(g.pending_echo))
	ok('★ 已建立战斗预算', !!g.event_budget)
	ok('★★ 不再产生空 pending_echo（本次修复点）', !g.pending_echo, JSON.stringify(g.pending_echo))
	const v = R.view(g, 'Axis')
	console.log('  actions=' + JSON.stringify(acts(v)))
	ok('★ 客户端拿到 event_battle', acts(v).indexOf('event_battle') >= 0, JSON.stringify(acts(v)))
	ok('★ 客户端拿到 event_finish', acts(v).indexOf('event_finish') >= 0, JSON.stringify(acts(v)))
	ok('对手侧只有 log', acts(R.view(g, 'Allies')).length <= 1, JSON.stringify(acts(R.view(g, 'Allies'))))

	/* ---------- C. 收尾 ---------- */
	console.log('\n=== C. event_finish 收尾 ===')
	const n2 = (g.log || []).length
	R.action(g, 'Axis', 'event_finish', {})
	console.log('  log: ' + logSince(g, n2))
	ok('★ 结束后无残留', !g.event_budget && !g.pending_echo && !g.pending_event_step,
		JSON.stringify({ b: !!g.event_budget, pe: !!g.pending_echo, ps: !!g.pending_event_step }))
	ok('★ 15209 不丢（手牌或弃牌堆）',
		(g.discard['德国'] || []).concat(g.hands['德国'] || []).some(x => faceOf(x) === '15209'),
		JSON.stringify({ disc: (g.discard['德国'] || []).map(faceOf) }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
