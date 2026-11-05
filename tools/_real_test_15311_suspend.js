/*
 * B8 真实测试：15311《马奇诺防线》等"对方时点"窗口必须【强挂起】
 *
 *  A 阿登第一步移除法国陆军 -> 窗口出现（Allies 可见 / Axis 不可见）
 *  B ★★ 德国 event_finish 被拒（阿登不推进，西欧仍空）
 *  C ★★ 德国 play_card / next_phase 同样被拒
 *  D 英国发动 15311 -> 法国陆军复原；随后德国 event_finish 放行
 *  E 英国选「不发动」-> 德国立刻可推进（无死锁）
 *  F 自己回合的"自有窗口"（15247 after_build_army）仍"错过即失效"（不受影响）
 *  G 静态守卫
 *
 * 用法：node tools/_real_test_15311_suspend.js
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
const offs = g => (g.armed_offers || []).filter(w => w.when === 'piece_removed' && (w.cards || []).length > 0)
const offCard = (g, face) => {
	for (const w of offs(g)) for (const c of (w.cards || [])) if (faceOf(c.card_id) === face) return c.card_id
	return null
}
const we = () => d.id_of('西欧')
const weUnits = g => I.pieces_on(g, we()).map(p => p + '(' + g.piece_nation[p] + ')')

/* 阿登场景：英国 15311 + 补足手牌；德国 阿登 + 一支可发起陆战的陆军 */
function setupArdennes(ukHand) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '15311', nation: '英国', dest: 'hand' })
	while ((g.hands['英国'] || []).length < ukHand)
		R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15225', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: d.id_of('德国') })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	I.grant_supply(g, 'de_atk', g.turn)
	I.refresh(g)
	/* 打阿登 + 发起第一步陆战（顺手把法国陆军移除） */
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15225') })
	I.refresh(g)
	R.action(g, 'Axis', 'event_battle', { target: we(), from: 'de_atk' })
	I.refresh(g)
	return g
}
const ukPay = (g, n) => (g.hands['英国'] || []).filter(x => faceOf(x) !== '15311').slice(0, n)

console.log('=== A. 窗口出现（可见性正确）===')
let gA = null, cardA = null
{
	const g = setupArdennes(7); gA = g
	console.log('  西欧 = ' + JSON.stringify(weUnits(g)) + '  窗口 = ' + JSON.stringify(offs(g).map(w => (w.cards || []).map(c => c.card_id))))
	const vA = R.view(g, 'Axis'), vL = R.view(g, 'Allies')
	ok('★★ 出现 piece_removed 窗口', offs(g).length > 0, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★ Allies 可见', !!vL.armed_offer && (vL.armed_offer.cards || []).length > 0, JSON.stringify(vL.armed_offer && vL.armed_offer.cards && vL.armed_offer.cards.length))
	ok('★ Axis 不可见（保密）', !vA.armed_offer, JSON.stringify(vA.armed_offer))
	cardA = offCard(g, '15311')
}

console.log('\n=== B. 德国 event_finish 被拒（阿登不推进）===')
{
	const g = gA
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_finish', {})
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 200))
	console.log('  西欧 = ' + JSON.stringify(weUnits(g)) + '  budget=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
	ok('★★ 被拒并说明在等对方表态', /等待【.+】决定是否发动《马奇诺防线》/.test(lg), lg.slice(0, 140))
	ok('★★ 阿登第二步没有执行（西欧仍无德国陆军）', !weUnits(g).some(x => /德国/.test(x)), JSON.stringify(weUnits(g)))
}

console.log('\n=== C. 德国 play_card / next_phase 同样被拒 ===')
{
	const g = gA
	for (const [act, arg] of [['next_phase', {}], ['play_card', { card: (g.hands['德国'] || [])[0] }]]) {
		if (act === 'play_card' && !arg.card) { console.log('  （德国无手牌，跳过 play_card）'); continue }
		const n0 = (g.log || []).length
		R.action(g, 'Axis', act, arg)
		const lg = logSince(g, n0)
		console.log('  [' + act + '] ' + lg.slice(0, 120))
		/* 两种拒绝都算通过：① 本卡 B8 门禁（等对方表态）② 战斗预算冻结（先结束阿登） */
		ok('★★ ' + act + ' 被拒（不能继续推进）',
			/等待【.+】决定是否发动|战斗预算进行中|请先/.test(lg), lg.slice(0, 120))
	}
}

console.log('\n=== D. 英国发动 15311 -> 陆军复原；德国随之可推进 ===')
{
	const g = setupArdennes(7)
	const card = offCard(g, '15311')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card, drop: ukPay(g, 4) })
	const lg = logSince(g, n0)
	console.log('  15311 log = ' + lg.slice(0, 220))
	console.log('  西欧 = ' + JSON.stringify(weUnits(g)))
	ok('★★ 法国陆军被复原到西欧', weUnits(g).some(x => /法国/.test(x)), JSON.stringify(weUnits(g)))
	/* 英国手里可能有【多张】15311（同款不同实例）：用完一张仍会剩下一张待表态 */
	while ((g.armed_offers || []).some(w => w.when === 'piece_removed' && (w.cards || []).length))
		R.action(g, 'Allies', 'skip_armed_offer', {})
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'event_finish', {})
	const lg2 = logSince(g, n1)
	console.log('  event_finish log = ' + lg2.slice(0, 200))
	ok('★ 窗口全部处理完后德国可继续推进', !/等待【.+】决定/.test(lg2), lg2.slice(0, 140))
}

console.log('\n=== E. 英国选「不发动」-> 德国立刻可推进（无死锁）===')
{
	const g = setupArdennes(7)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'skip_armed_offer', {})
	console.log('  skip log = ' + logSince(g, n0).slice(0, 160))
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'event_finish', {})
	const lg2 = logSince(g, n1)
	console.log('  event_finish log = ' + lg2.slice(0, 200))
	ok('★ 不发动后无阻塞', !/等待【.+】决定/.test(lg2), lg2.slice(0, 140))
}

console.log('\n=== F. 自己回合的"自有窗口"仍"错过即失效"（不受影响）===')
{
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15247', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15202', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	/* 打 15247 上桌，再建一支陆军 -> 触发 after_build_army 窗口 */
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15247') })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15202'), space: d.id_of('巴尔干') })
	I.refresh(g)
	const hasWin = (g.armed_offers || []).some(w => w.when === 'after_build_army' && (w.cards || []).length)
	console.log('  after_build_army 窗口 = ' + hasWin + '  offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when)))
	/* 自有窗口（本方部队被移除/本方建设触发）：做别的动作应放行（错过即失效） */
	g.armed_offers = [{
		when: 'after_build_army', ctx: { nation: '德国' },
		cards: [{ card_id: '15247#1', nation: '德国', name: '贵在行动' }],
	}]
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	const lg = logSince(g, n0)
	console.log('  next_phase log = ' + lg.slice(0, 140))
	ok('★ 自有窗口不阻塞本回合推进（仍"错过即失效"）',
		!/等待【.+】决定是否发动/.test(lg), lg.slice(0, 140))
}

console.log('\n=== G. 静态守卫 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('do_action 里有"对方时点"强挂起门禁', /_oppMoment/.test(src))
	ok('只放行表态类动作', /action !== 'use_armed_offer' && action !== 'skip_armed_offer'/.test(src))
	ok('判据取 piece_nation / target_nation 的阵营', /w\.ctx\.piece_nation \|\| w\.ctx\.target_nation/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
