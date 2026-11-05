/*
 * B11 真实测试：《卡佩里尼》捞出德国《建设陆军》后，德国的 after_build_army 状态卡
 *      必须能点亮并真的发动（之前 current_nation 被链推进到别国 -> "不能触发非本方的状态卡"）
 *
 *  A 基准：德国自己建设陆军 → 15247 ready=true，可发动
 *  B ★★ 卡佩里尼捞德国《建设陆军》→ 出现「分步机」pending_event_step，链停在德国这一步
 *  C ★★ 此时 15247 ready=true 且 activate_status 成功（扣牌 + 发起陆战/空打）
 *  D 点「下一步」(event_step_next) → 链续跑到下一国，pending_event_step 清空
 *  E 不发动直接点「下一步」→ 同样续跑（无死锁）
 *  F 15247 不在场时 → 链照常推进（不因新逻辑卡住）
 *  G 静态守卫
 *
 * 用法：node tools/_real_test_b11_window_activate.js
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
const deckN = (g, n) => (g.decks[n] || []).length
const ARMY = '15300'   /* 建设陆军 */

function base(withStatus) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	if (withStatus) {
		R.action(g, 'Axis', 'debug_add_card', { face: '15247', nation: '德国', dest: 'hand' })
		R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
		I.refresh(g)
		const c = (g.hands['德国'] || []).find(x => faceOf(x) === '15247')
		if (c) R.action(g, 'Axis', 'play_card', { card: c })
	}
	I.refresh(g)
	return g
}

/* A. 基准：德国自己建设陆军 */
console.log('=== A. 基准：德国自建陆军 → 15247 可发动 ===')
{
	const g = base(true)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: ARMY, nation: '德国', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === ARMY)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: c, space: d.id_of('巴尔干') })
	console.log('  build log: ' + logSince(g, n0).slice(0, 160))
	R.view(g, 'Axis')
	const v = R.view(g, 'Axis')
	const row = (v.table_status || []).find(x => faceOf(x.card) === '15247')
	console.log('  table_status[15247] = ' + JSON.stringify(row && { ready: row.ready, reason: row.reason }))
	ok('★ 建设后 15247 ready=true', !!row && row.ready === true, JSON.stringify(row && row.ready))
}

/* B/C/D：卡佩里尼 */
console.log('\n=== B. 卡佩里尼捞德国《建设陆军》→ 分步机停在德国步 ===')
let gB = null, builtId = null, tgtSp = null
{
	const g = base(true); gB = g
	/* 德国弃牌堆只放一张《建设陆军》，保证随机抽到它 */
	g.discard['德国'] = [ARMY + '#901']
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17729', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['意大利'] || []).find(x => faceOf(x) === '17729') })
	R.action(g, 'Axis', 'resolve_italy_chain', { choice: 'play' })
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_italy_play', { space: d.id_of('巴尔干') })
	console.log('  play log: ' + logSince(g, n1).slice(0, 220))
	const ps = g.pending_event_step
	console.log('  pending_event_step = ' + JSON.stringify(ps && { name: ps.card_name, step: ps.step, total: ps.total, chain: ps.chain, nation: ps.nation }))
	console.log('  current_nation = ' + g.current_nation + '  delegate.step = ' + (g.delegate && g.delegate.step))
	ok('★★ 出现「分步机」面板（chain=italy）', !!ps && ps.chain === 'italy', JSON.stringify(ps && ps.chain))
	ok('★★ 链停在德国这一步（current_nation 未被切走）', g.current_nation === '德国', g.current_nation)
	builtId = (I.pieces_on(g, d.id_of('巴尔干')) || []).find(p => g.piece_nation[p] === '德国')
	console.log('  新建陆军 = ' + builtId + '  西欧/巴尔干邻格 = ' +
		JSON.stringify(I.get_connections(g, d.id_of('巴尔干'), 'axis').map(Number).slice(0, 4)))
	ok('★ 陆军确实建成', !!builtId, JSON.stringify(I.pieces_on(g, d.id_of('巴尔干'))))
	void n0
}

console.log('\n=== C. 15247 现在能点亮并发动 ===')
{
	const g = gB
	I.grant_supply(g, builtId, g.turn)
	I.refresh(g)
	R.view(g, 'Axis')
	const v = R.view(g, 'Axis')
	const row = (v.table_status || []).find(x => faceOf(x.card) === '15247')
	console.log('  table_status[15247] = ' + JSON.stringify(row && { ready: row.ready, reason: row.reason }))
	ok('★★ 15247 ready=true（之前是 false）', !!row && row.ready === true, JSON.stringify(row && row.ready))

	/* 目标：巴尔干的相邻地区（15247 只允许 建设地区 的相邻地区） */
	const neigh = I.get_connections(g, d.id_of('巴尔干'), 'axis').map(Number)
	tgtSp = neigh.find(s => d.spaces[s] && d.spaces[s].terrain === 'land')
	console.log('  目标地区 = ' + d.name_of(tgtSp))
	const deck0 = deckN(g, '德国')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'activate_status', {
		card: (g.table['德国'] || []).find(x => faceOf(x) === '15247'),
		space: tgtSp, from: builtId, discard: [],
	})
	const lg = logSince(g, n0)
	console.log('  activate log: ' + lg.slice(0, 240))
	console.log('  牌库 ' + deck0 + ' -> ' + deckN(g, '德国'))
	ok('★★ 不再被"非本方"拒绝', !/不能触发非本方的状态卡/.test(lg), lg.slice(0, 120))
	ok('★★ 发动成功（扣 1 张 + 发起陆战/空打）',
		deck0 - deckN(g, '德国') === 1 && /发起陆战|空打/.test(lg), (deck0 - deckN(g, '德国')) + ' | ' + lg.slice(0, 160))
}

console.log('\n=== D. 点「下一步」→ 链继续处置下一位 ===')
{
	const g = gB
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_step_next', {})
	const lg = logSince(g, n0)
	console.log('  log: ' + lg.slice(0, 200))
	console.log('  pending_event_step = ' + JSON.stringify(g.pending_event_step && g.pending_event_step.chain) +
		'  delegate.step = ' + (g.delegate && g.delegate.step) + '  pickedNation = ' + (g.delegate && g.delegate.pickedNation))
	ok('★★ 面板已清空', !g.pending_event_step, JSON.stringify(g.pending_event_step))
	ok('★★ 链推进到下一位（意大利）', !!g.delegate && g.delegate.step >= 1, JSON.stringify(g.delegate && g.delegate.step))
}

console.log('\n=== E. 不发动，直接点「下一步」→ 也能续跑（无死锁）===')
{
	const g = base(true)
	g.discard['德国'] = [ARMY + '#902']
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17729', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['意大利'] || []).find(x => faceOf(x) === '17729') })
	R.action(g, 'Axis', 'resolve_italy_chain', { choice: 'play' })
	R.action(g, 'Axis', 'resolve_italy_play', { space: d.id_of('巴尔干') })
	ok('★ 同样出现分步机', !!g.pending_event_step, JSON.stringify(g.pending_event_step && g.pending_event_step.chain))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_step_next', {})
	const lg = logSince(g, n0)
	console.log('  log: ' + lg.slice(0, 200))
	ok('★★ 未发动也能继续（日志含"放弃未处理的"）', /放弃未处理的|继续处置/.test(lg), lg.slice(0, 140))
	ok('★ 面板清空且链已推进', !g.pending_event_step && !!g.delegate && g.delegate.step >= 1)
}

console.log('\n=== F. 15247 不在场 → 链照常推进（不因新逻辑卡住）===')
{
	const g = base(false)
	g.discard['德国'] = [ARMY + '#903']
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17729', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['意大利'] || []).find(x => faceOf(x) === '17729') })
	R.action(g, 'Axis', 'resolve_italy_chain', { choice: 'play' })
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_italy_play', { space: d.id_of('巴尔干') })
	console.log('  log: ' + logSince(g, n0).slice(0, 200))
	ok('★ 无窗口时不显示分步机', !g.pending_event_step, JSON.stringify(g.pending_event_step))
	ok('★ 链已推进到下一位', !!g.delegate && g.delegate.step >= 1, JSON.stringify(g.delegate && g.delegate.step))
}

console.log('\n=== G. 静态守卫 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('status_instant_covers 已实现', /function status_instant_covers/.test(src))
	ok('activate_status 的 owner 判据含豁免', /!status_instant_covers\(game, cardId/.test(src))
	ok('status_window_ready 含豁免', /!status_instant_covers\(game, card_id/.test(src))
	ok('卡佩里尼链会挂起为分步机', /chain: 'italy'/.test(src) && /_italy_chain_card_id/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
