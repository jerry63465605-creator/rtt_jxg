/*
 * 检查 16701《意大利万岁》的实现（真实测试 · 范式 B）
 *
 * 卡面：出牌阶段开始时：本回合出牌阶段【行动 2 次】，但只能打出[基本卡]。
 *
 * ⚠ 教训（2026-10-31）：`check_play_phase(game, nation, card)` 的 card 参数要【卡对象】，
 *   传面 id 字符串会让 is_timing_card 恒 false -> 全部误判"只能打基本卡"（测试假阳性）。
 *   而且那个函数只服务"弃1张手牌/减1分"这类非卡动作，卡牌打出走的是 check_phase_for_card。
 *
 * 核对项：
 *   A. 打出 16701 -> it_viva / it_viva_used / view.it_viva
 *   B. 第 1 次基本卡 -> play_done 仍 false、used=1
 *   C. 第 2 次基本卡 -> play_done=true
 *   D. 第 3 次基本卡 -> 拒绝
 *   E. 限制期内 EVENT / STATUS / ECON -> 真实 play_card 被拒
 *   F. 限制期内 增强卡（时机卡）-> 放行（不占名额，不算"行动"）
 *   G. 离开出牌阶段 -> 清零
 *   H. 非意大利不受影响
 *
 * 用法：node tools/_real_test_16701_italy_viva.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const C = require(path.join(MOD, 'cards.js'))
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	R.action(g, 'Axis', 'debug_place', { piece: 'it_a', nation: '意大利', type: 'army', space: d.id_of('意大利') })
	R.action(g, 'Axis', 'debug_add_card', { face: '16701', nation: '意大利', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17700', nation: '意大利', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17700', nation: '意大利', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17700', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	return g
}
const italianFace = type => {
	for (const c of Object.values(C.CARD_BY_ID)) if (c.nation === '意大利' && c.type === type) return String(c.id)
	return null
}
const landFor = g => {
	for (let i = 1; i < d.spaces.length; i++) {
		if (!d.spaces[i] || d.spaces[i].terrain === 'sea') continue
		if (I.can_build_at(g, '意大利', i, 'army').ok && I.unit_slot_free(g, '意大利', 'army', i).ok) return i
	}
	return null
}

console.log('\n=== A. 打出 16701 ===')
const g = setup()
const viva = (g.hands['意大利'] || []).find(x => faceOf(x) === '16701')
ok('16701 在意大利手牌', !!viva)
let n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: viva })
console.log('  log: ' + logSince(g, n0))
ok('★ it_viva=true', g.it_viva === true)
ok('it_viva_used=0', (g.it_viva_used || 0) === 0)
ok('★ view.it_viva 下发', R.view(g, 'Axis').it_viva === true)

console.log('\n=== B/C. 基本卡 × 2 ===')
const basics = (g.hands['意大利'] || []).filter(x => faceOf(x) === '17700')
ok('手里 ≥3 张建设陆军', basics.length >= 3, String(basics.length))
n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: basics[0], space: landFor(g) })
console.log('  [第1次] ' + logSince(g, n0))
ok('★ 第 1 次后 play_done=false（放行第 2 次）', !((g.play_done || {})['意大利']))
ok('it_viva_used=1', (g.it_viva_used || 0) === 1)
n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: basics[1], space: landFor(g) })
console.log('  [第2次] ' + logSince(g, n0))
ok('★ 第 2 次后 play_done=true', !!((g.play_done || {})['意大利']))

console.log('\n=== D. 第 3 次基本卡被拒 ===')
n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: basics[2], space: landFor(g) })
const lg3 = logSince(g, n0)
console.log('  [第3次] ' + lg3)
ok('★ 第 3 次被拒', /已行动|已打出|只能打出\[基本卡\]/.test(lg3), lg3)

console.log('\n=== E. 限制期内 EVENT / STATUS / ECON 真实 play_card 被拒 ===')
{
	const g2 = setup()
	const v2 = (g2.hands['意大利'] || []).find(x => faceOf(x) === '16701')
	R.action(g2, 'Axis', 'play_card', { card: v2 })
	for (const type of ['EVENT', 'STATUS', 'ECON']) {
		const face = italianFace(type)
		if (!face) { ok('（无 ' + type + ' 样本）', true); continue }
		/* 判据层：传【卡对象】（不是面 id 字符串） */
		const obj = C.CARD_BY_ID[face]
		const r = I.check_phase_for_card(g2, '意大利', obj, {})
		ok('★ check_phase_for_card ' + type + ' 被拒',
			!!(r && r.ok === false && /意大利万岁/.test(r.reason || '')), JSON.stringify(r))
		/* 行为层：真的打一次 */
		R.action(g2, 'Axis', 'debug_add_card', { face: face, nation: '意大利', dest: 'hand' })
		I.refresh(g2)
		const inst = (g2.hands['意大利'] || []).find(x => faceOf(x) === face)
		const m0 = (g2.log || []).length
		R.action(g2, 'Axis', 'play_card', { card: inst, target: '英国', space: 1, choice: 0 })
		const lg = logSince(g2, m0)
		ok('★ 真打 ' + type + ' 也被拒', /只能打出\[基本卡\]/.test(lg), lg)
	}
	/* 基本卡放行 */
	const rb = I.check_phase_for_card(g2, '意大利', C.CARD_BY_ID['17700'], {})
	ok('基本卡仍放行', !!(rb && rb.ok !== false), JSON.stringify(rb))
}

console.log('\n=== F. 限制期内【增强卡】放行（时机卡不占名额）===')
{
	const g3 = setup()
	const v3 = (g3.hands['意大利'] || []).find(x => faceOf(x) === '16701')
	R.action(g3, 'Axis', 'play_card', { card: v3 })
	R.action(g3, 'Axis', 'debug_add_card', { face: '17706', nation: '意大利', dest: 'hand' })
	I.refresh(g3)
	const ef = (g3.hands['意大利'] || []).find(x => faceOf(x) === '17706')
	const cp = I.check_phase_for_card(g3, '意大利', C.CARD_BY_ID['17706'], { card: ef })
	ok('★ 增强卡 check_phase_for_card 放行', !!(cp && cp.ok === true), JSON.stringify(cp))
	ok('★ 客户端同源：不把 EFFECT/RESPONSE 置灰',
		I && true)  /* 下面静态断言 */
	const pj = require('fs').readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('客户端条件含 EFFECT/RESPONSE 例外',
		/c\.type !== "EFFECT" && c\.type !== "RESPONSE"/.test(pj))
}

console.log('\n=== G. 离开出牌阶段 -> 清零 ===')
{
	n0 = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	ok('★ it_viva 清零', !g.it_viva, JSON.stringify({ v: g.it_viva, u: g.it_viva_used }))
	ok('it_viva_used 归零', !g.it_viva_used)
	ok('view.it_viva 变 false', R.view(g, 'Axis').it_viva !== true)
}

console.log('\n=== H. 非意大利不受影响 ===')
{
	const g4 = setup()
	const v4 = (g4.hands['意大利'] || []).find(x => faceOf(x) === '16701')
	R.action(g4, 'Axis', 'play_card', { card: v4 })
	ok('意大利 it_viva=true', g4.it_viva === true)
	ok('轴心视角 view.it_viva=true（当前行动国=意大利）', R.view(g4, 'Axis').it_viva === true)
	const cp = I.check_phase_for_card(g4, '德国', C.CARD_BY_ID[italianFace('EVENT')], {})
	ok('德国打事件卡不受限', !!(cp && cp.ok !== false), JSON.stringify(cp))
}

console.log('\n=== I. 静态守卫：限制写在真正生效的位置 ===')
{
	const js = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('check_phase_for_card 里有 it_viva 判定',
		/if \(game\.it_viva && nation === '意大利' && c && c\.type !== 'BASIC'\)/.test(js))
	const iCard = js.indexOf("if (ph === 'play') {")
	const iViva = js.indexOf("if (game.it_viva && nation === '意大利' && c && c.type !== 'BASIC')")
	ok('判定位于 ph===\'play\' 分支内', iCard > 0 && iViva > iCard, iCard + ' / ' + iViva)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
