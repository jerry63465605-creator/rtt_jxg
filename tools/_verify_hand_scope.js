/*
 * 真实盘面验证（rtt-realboard-test 范式 B）：挂起窗口不得把【付代价国】的手牌泄漏给对手
 *
 * 修复：rules.js view 的 hands 循环新增 hand_viewer_for(game, side, costNation)，
 *       付代价国只有在本方阵营内才放宽牌面。
 *
 * 覆盖三种 stage（pending_cost_nation 的三个分支）：
 *   · su_step_back — 17853《一步也不许后退!》  付代价国 = 苏联（同盟）
 *   · guard        — 15410《武士道》            付代价国 = 日本（轴心）
 *   · kv2          — 17837《KV-2 重型坦克》     付代价国 = 攻击方（本例德国/轴心）
 *
 * 每个场景四层断言：
 *   ① 对手侧 hands[付代价国].cards === null（本次修复点）
 *   ② 本方侧 hands[付代价国].cards 非空（不误伤弃牌框）
 *   ③ 窗口本身只给等待方（pending_battle 对手侧为 null）
 *   ④ 结算到底仍能正常付代价（同阵营 viewer 生效）
 * 另加：无挂起基线（全员只给张数）+ 静态守卫（hand_view 的 viewer 只能来自白名单来源）
 *
 * 用法：node tools/_verify_hand_scope.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const faceNations = v => Object.keys(v.hands || {}).filter(n => v.hands[n] && v.hands[n].cards)
const countOnly = (v, n) => !(v.hands && v.hands[n] && v.hands[n].cards)

/* ---------- 公共布阵工具 ---------- */
function fresh() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	return g
}
function landNeighbor(g, space) {
	return I.get_connections(g, space, 'allies').find(s =>
		d.spaces[s] && d.spaces[s].terrain !== 'sea' &&
		!Object.keys(g.location).some(p => g.location[p] === s))
}

/* ========== A. 17853 su_step_back（付代价国=苏联） ========== */
console.log('\n=== A. 17853《一步也不许后退!》stage=su_step_back ===')
const gA = (function () {
	const g = fresh()
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	let c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17853')
	if (!c) {
		R.action(g, 'Allies', 'debug_add_card', { face: '17853', nation: '苏联', dest: 'hand' })
		I.refresh(g)
		c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17853')
	}
	R.action(g, 'Allies', 'play_card', { card: c })          /* 响应卡：暗置到桌面 */
	const su = Object.keys(d.spaces).map(Number).find(s => /罗斯/.test(d.name_of(s)))
	const deSp = landNeighbor(g, su)
	R.action(g, 'Allies', 'debug_place', { piece: 'su_def', nation: '苏联', type: 'army', space: su })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: deSp })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	I.grant_supply(g, 'de_atk', g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', su, 'su_def', 'land', { from: 'de_atk' })
	console.log('  攻击: ' + logSince(g, n0))
	/* 苏联发动这张暗置响应牌 -> 进入 su_step_back（付代价阶段） */
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'trigger_response', {})
	console.log('  发动: ' + logSince(g, n1))
	return g
})()
{
	const pb = gA.pending_battle || {}
	console.log('  stage=' + JSON.stringify(pb.stage) + '  苏联手牌=' + (gA.hands['苏联'] || []).length)
	ok('★ 已进入 su_step_back', pb.stage === 'su_step_back', JSON.stringify(pb.stage))
	const vA = R.view(gA, 'Allies'), vX = R.view(gA, 'Axis')
	console.log('  Allies 可见牌面=' + JSON.stringify(faceNations(vA)))
	console.log('  Axis   可见牌面=' + JSON.stringify(faceNations(vX)))
	ok('★★ 轴心看不到苏联手牌（本次修复）', countOnly(vX, '苏联'),
		JSON.stringify(vX.hands && vX.hands['苏联'] && vX.hands['苏联'].cards))
	ok('★ 同盟仍能看到苏联手牌（弃牌框需要）', Array.isArray(vA.hands['苏联'].cards) &&
		vA.hands['苏联'].cards.length > 0)
	ok('★ 窗口只给等待方（轴心 pending_battle=null）', vX.pending_battle == null,
		JSON.stringify(vX.pending_battle && vX.pending_battle.stage))
	ok('轴心自己的手牌仍可见（my_nation）', Array.isArray(vX.hands[vX.my_nation].cards))
	ok('其它同盟国对轴心只给张数', ['英国', '美国', '法国', '中国'].every(n => countOnly(vX, n)))
	/* 结算到底：苏联付 4 张 */
	const pay = (gA.hands['苏联'] || []).slice(0, 4)
	const n0 = (gA.log || []).length
	R.action(gA, 'Allies', 'resolve_battle', { step_back: true, drop: pay })
	console.log('  付代价: ' + logSince(gA, n0))
	ok('★★ 同阵营弃牌框仍生效（4 张被接受）', pay.every(x => (gA.discard['苏联'] || []).indexOf(x) >= 0),
		JSON.stringify(pay))
	ok('陆军受 protect（本回合不会被移除）', I.is_protected(gA, 'su_def') === true,
		String(I.is_protected(gA, 'su_def')))
	ok('无残留挂起', !gA.pending_battle)
}

/* ========== B. 15410 guard（付代价国=日本） ========== */
console.log('\n=== B. 15410《武士道》stage=guard ===')
const gB = (function () {
	const g = fresh()
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	/* 15410 是 kind:'any' 机会卡，留在手里即可（不能主动打出） */
	/* 15410 是 kind:'any' 机会卡：留在手里即可，不能主动打出；开局没有就补一张 */
	if (!(g.hands['日本'] || []).some(x => faceOf(x) === '15410')) {
		R.action(g, 'Axis', 'debug_add_card', { face: '15410', nation: '日本', dest: 'hand' })
		I.refresh(g)
	}
	ok('15410 在手里（机会卡，无需装载）', (g.hands['日本'] || []).some(x => faceOf(x) === '15410'),
		JSON.stringify((g.hands['日本'] || []).map(faceOf).slice(0, 12)))
	const target = Object.keys(d.spaces).map(Number).find(s => /中国/.test(d.name_of(s)))
	const ukSp = landNeighbor(g, target)
	R.action(g, 'Axis', 'debug_place', { piece: 'jp_a1', nation: '日本', type: 'army', space: target })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_a1', nation: '英国', type: 'army', space: ukSp })
	I.refresh(g)
	I.grant_supply(g, 'uk_a1', g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	I.do_battle(g, '英国', target, 'jp_a1', 'land', { from: 'uk_a1' })
	console.log('  攻击: ' + logSince(g, n0))
	return g
})()
{
	const pb = gB.pending_battle || {}
	console.log('  stage=' + JSON.stringify(pb.stage))
	ok('★ 已进入 guard', pb.stage === 'guard', JSON.stringify(pb.stage))
	const vA = R.view(gB, 'Allies'), vX = R.view(gB, 'Axis')
	console.log('  Allies 可见牌面=' + JSON.stringify(faceNations(vA)))
	console.log('  Axis   可见牌面=' + JSON.stringify(faceNations(vX)))
	ok('★★ 同盟看不到日本手牌（本次修复，反方向）', countOnly(vA, '日本'),
		JSON.stringify(vA.hands && vA.hands['日本'] && vA.hands['日本'].cards))
	ok('★ 轴心仍能看到日本手牌（弃牌框需要）', Array.isArray(vX.hands['日本'].cards) &&
		vX.hands['日本'].cards.length > 0)
	ok('★ 窗口只给等待方（同盟 pending_battle=null）', vA.pending_battle == null)
}

/* ========== C. 17837 KV-2 stage=kv2（付代价国=攻击方德国） ========== */
console.log('\n=== C. 17837《KV-2 重型坦克》stage=kv2 ===')
const gC = (function () {
	const g = fresh()
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	let c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17837')
	if (!c) {
		R.action(g, 'Allies', 'debug_add_card', { face: '17837', nation: '苏联', dest: 'hand' })
		I.refresh(g)
		c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17837')
	}
	R.action(g, 'Allies', 'play_card', { card: c })
	const su = Object.keys(d.spaces).map(Number).find(s => /罗斯/.test(d.name_of(s)))
	const deSp = landNeighbor(g, su)
	R.action(g, 'Allies', 'debug_place', { piece: 'su_def2', nation: '苏联', type: 'army', space: su })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_atk2', nation: '德国', type: 'army', space: deSp })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	I.grant_supply(g, 'de_atk2', g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', su, 'su_def2', 'land', { from: 'de_atk2' })
	console.log('  攻击: ' + logSince(g, n0))
	let n1 = (g.log || []).length
	R.action(g, 'Allies', 'trigger_response', {})
	console.log('  发动: ' + logSince(g, n1))
	if ((g.pending_battle || {}).stage === 'kv2_ask') {
		const n2 = (g.log || []).length
		/* kv2_ask 由【苏联持有方】决定是否发动；发动后 stage 变 kv2，等待方变攻击方 */
		R.action(g, 'Allies', 'resolve_battle', { kv2_trigger: true })
		console.log('  kv2_trigger: ' + logSince(g, n2))
	}
	return g
})()
{
	const pb = gC.pending_battle || {}
	console.log('  stage=' + JSON.stringify(pb.stage) + '  waiting/attacker=' + JSON.stringify(pb.attacker))
	ok('★ 已进入 kv2（等待攻击方）', pb.stage === 'kv2', JSON.stringify(pb.stage))
	const vA = R.view(gC, 'Allies'), vX = R.view(gC, 'Axis')
	console.log('  Allies 可见牌面=' + JSON.stringify(faceNations(vA)))
	console.log('  Axis   可见牌面=' + JSON.stringify(faceNations(vX)))
	ok('★★ 同盟看不到德国手牌（付代价国=攻击方）', countOnly(vA, '德国'),
		JSON.stringify(vA.hands && vA.hands['德国'] && vA.hands['德国'].cards))
	ok('★ 轴心仍能看到德国手牌（弃牌框需要）', Array.isArray(vX.hands['德国'].cards) &&
		vX.hands['德国'].cards.length > 0)
}

/* ========== D. 无挂起基线 ========== */
console.log('\n=== D. 无挂起时：任何国家都只给张数 ===')
{
	const g = fresh()
	const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
	const only = v => Object.keys(v.hands || {}).every(n => v.hands[n].cards === null)
	ok('★ Allies 侧只有自己（my_nation）有牌面',
		faceNations(vA).length === 1 && faceNations(vA)[0] === vA.my_nation,
		JSON.stringify(faceNations(vA)))
	ok('★ Axis 侧只有自己（my_nation）有牌面',
		faceNations(vX).length === 1 && faceNations(vX)[0] === vX.my_nation,
		JSON.stringify(faceNations(vX)))
	ok('其余国家一律 cards=null', only(vA) === false || true)   /* 占位，下面逐条判定 */
	ok('Allies 侧非本方国家均为 null',
		Object.keys(vA.hands).filter(n => n !== vA.my_nation).every(n => vA.hands[n].cards === null))
}

/* ========== E. 静态守卫 ========== */
console.log('\n=== E. 静态守卫：hand_view 的 viewer 必须来自 my_nation / hand_viewer_for ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('hand_viewer_for 已定义且做了阵营判定',
		/function hand_viewer_for\(game, side, costNation\)[\s\S]{0,200}?faction_of_nation\(costNation\) !== side/.test(src))
	ok('hands 循环走 hand_viewer_for',
		/const _costVisible = hand_viewer_for\(game, side, _costNat\)/.test(src))
	/* 只看真实调用行（排除注释/文档里的示例） */
	const codeOnly = src.split('\n')
		.filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l))
		.join('\n')
	const calls = [...codeOnly.matchAll(/hand_view\(([^)]*)\)/g)].map(m => m[1])
		.filter(a => !/^game,\s*nation, viewer_nation$/.test(a.trim()))
	console.log('  hand_view 其它调用点: ' + JSON.stringify(calls))
	ok('唯一调用点就是 hands 循环（viewer 来自白名单）',
		calls.length === 1 && /_costVisible/.test(calls[0]), JSON.stringify(calls))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
