/*
 * 【B61】17900《八月风暴》：「友方」包含苏联自身 + 同盟国。
 *
 * 玩家报障（2026-11-27）：「八月风暴自己打也应该触发」（#4），
 * 并明确口径：「友方应该包含苏联自身 + 友方」。
 *
 * 根因：`maybe_arm_su_augstorm`（17900 的专用武装实现）开头有一行
 *   `if (attackerNation === '苏联') return`
 * —— 苏联自己打〈中国东北〉时直接返回，于是【不】set_pending_armed_delegate，
 *    也就没把 use_armed_offer 登记进动作白名单：
 *    窗口其实被 offer_armed_effects 武装了（actor 匹配自己），但玩家点了没反应。
 *    （同盟国发起时才走这条路径 → 所以「英国打能触发、苏联自己打不能」。）
 *
 * 修法：
 *   ① 删掉那行排除，改判 `faction_of_nation(attackerNation) === faction_of_nation('苏联')`
 *      —— 苏联自身与英/美同属 allies，天然都满足；
 *   ② `17900.armed` 加 `watch: true`，让 offer_armed_effects 在【同盟国发起】时也武装
 *      （原实现靠 maybe_arm_su_augstorm 兜，现在两条路径统一）；
 *   ③ `maybe_arm_su_augstorm` 加 `alreadyArmed` 去重 —— pushArmedWindow 本身不去重，
 *      否则苏联自己打会压出两个相同窗口。
 *
 * 用法：node tools/_real_test_B61_augstorm_friendly_self.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

const NE = D.id_of('中国东北')

/* 17900 走 maybe_arm_su_augstorm，它读【手牌】里的 17900；代价是手牌 1 张建设陆军(17800) */
function seed() {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.active = 'Allies'
	g.current_nation = '苏联'
	g.turn_phase = 'play'
	g.table['苏联'] = []
	g.hands['苏联'] = ['17900#s1', '17800#b1', '15101#h2']
	return g
}

/* 在〈中国〉放一支攻击方陆军（相邻〈中国东北〉），〈中国东北〉放中国陆军 */
function stageBattle(g, attackerNation) {
	g.location.atk = D.id_of('中国')
	g.piece_nation.atk = attackerNation
	g.piece_type.atk = 'army'
	I.grant_supply(g, 'atk', g.turn || 1)
	g.location.def = NE
	g.piece_nation.def = '中国'
	g.piece_type.def = 'army'
	I.compute_supply(g)
}

function windowsOf17900(g) {
	return (g.armed_offers || []).filter(w =>
		(w.cards || []).some(c => String(c.card_id || '').indexOf('17900') === 0))
}

console.log('=== A. 苏联自己打〈中国东北〉：窗口 + 让权（修复前 delegate 缺失 = 点不动）===')
{
	const g = seed()
	stageBattle(g, '苏联')
	I.arm_after_battle_status(g, '苏联', 'land', NE, {})
	const wins = windowsOf17900(g)
	ok('★★ 恰好 1 个 17900 窗口（去重生效，不是 2 个）', wins.length === 1, J(wins.length))
	ok('★★ 窗口 when = after_battle', wins.length === 1 && wins[0].when === 'after_battle')
	ok('★★ 已登记让权（pending_armed_delegate 存在 -> use_armed_offer 进白名单）',
		!!g.pending_armed_delegate, J(g.pending_armed_delegate))
	ok('★ 让权目标是苏联', !!(g.pending_armed_delegate && g.pending_armed_delegate.nation === '苏联'),
		J(g.pending_armed_delegate && g.pending_armed_delegate.nation))
}

console.log('\n=== B. 英国（同盟友方）打：同样窗口 + 让权 ===')
{
	const g = seed()
	stageBattle(g, '英国')
	I.arm_after_battle_status(g, '英国', 'land', NE, {})
	const wins = windowsOf17900(g)
	ok('★★ 恰好 1 个窗口', wins.length === 1, J(wins.length))
	ok('★★ 已登记让权', !!g.pending_armed_delegate)
}

console.log('\n=== C. 德国（敌方）打：完全不触发 ===')
{
	const g = seed()
	stageBattle(g, '德国')
	I.arm_after_battle_status(g, '德国', 'land', NE, {})
	ok('★★ 无 17900 窗口', windowsOf17900(g).length === 0, J(windowsOf17900(g).length))
	ok('★★ 无让权', !g.pending_armed_delegate)
}

console.log('\n=== D. ready 判据（阵营而非国别）===')
{
	const g = seed()
	const ar = I.ECHO_EFFECTS['17900'].armed
	ok('★★ 苏联自己打 -> ready true', ar.ready(g, { space: NE, attacker: '苏联' }) === true)
	ok('★★ 英国打 -> ready true', ar.ready(g, { space: NE, attacker: '英国' }) === true)
	ok('★★ 美国打 -> ready true', ar.ready(g, { space: NE, attacker: '美国' }) === true)
	ok('★★ 德国打 -> ready false', ar.ready(g, { space: NE, attacker: '德国' }) === false)
	ok('★ 非中国东北 -> false', ar.ready(g, { space: D.id_of('西欧'), attacker: '苏联' }) === false)
}

console.log('\n=== E. 静态守卫 ===')
{
	ok('★★ maybe_arm_su_augstorm 不再排除苏联自己', (() => {
		const i = SRC.indexOf('function maybe_arm_su_augstorm')
		const seg = SRC.slice(i, i + 900)
		const code = seg.replace(/\/\*[\s\S]*?\*\//g, '')
		return !/attackerNation === '苏联'\)\s*return/.test(code)
	})())
	ok('★★ 17900.armed 带 watch: true', (() => {
		const i = SRC.indexOf("'17900': {")
		const seg = SRC.slice(i, i + 800)
		return /when: 'after_battle', actor: '苏联', watch: true/.test(seg)
	})())
	ok('★★ 有 alreadyArmed 去重', /const alreadyArmed = \(game\.armed_offers \|\| \[\]\)\.some/.test(SRC))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
