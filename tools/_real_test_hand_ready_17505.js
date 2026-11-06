/*
 * B26-b：17505《P-51 野马》的「可打出」高亮与实打同源（只改 17505，不动 17805）
 *
 * A ★★ 17505·本方出牌阶段：hand_ready.ok=true 且实打成功
 * B ★  17505·本方资源/弃牌阶段：仍可打（被动修正随时可装载）
 * C ★★ 17505·敌方回合：hand_ready.ok=false，且实打被拒（不再"亮着打不出"）
 * D ★★ 17805《红色管弦乐队》·敌方回合：hand_ready **仍为 true**（卡面就是"任一出牌阶段开始时"），
 *      且 armed 窗口能真实打出（不受本次改动影响）
 * E ★  17513 四态回归（有/无已发动状态卡 × 本方/敌方回合）
 * F 静态守卫：17505 已声明时点；17805 仍无声明
 *
 * 用法：node tools/_real_test_hand_ready_17505.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const cards = require(path.join(MOD, 'cards.js'))
const byId = {}
for (const c of cards.CARDS) byId[String(c.id)] = c
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const base = () => {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null; g.pending_red = null
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	return g
}
const readyOf = (g, role, inst) => ((R.view(g, role).hand_ready) || {})[inst] || {}
const tryPlay = (g, role, inst) => {
	const n0 = (g.log || []).length
	R.action(g, role, 'play_card', { card: inst })
	I.refresh(g)
	const lg = logSince(g, n0)
	return { ok: !/无法打出|手中没有|暂不能打牌/.test(lg), log: lg }
}

console.log('=== A. 17505 本方出牌阶段 ===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17505')
	const h = readyOf(g, 'Allies', inst), r = tryPlay(g, 'Allies', inst)
	console.log('  hand_ready=' + JSON.stringify(h.ok) + '  实打=' + r.ok + '  us_p51=' + !!g.us_p51)
	ok('★★ 高亮=可打，且实打成功', h.ok === true && r.ok === true && g.us_p51 === true)
}

console.log('\n=== B. 17505 本方资源 / 弃牌阶段（保持任意阶段可装载）===')
for (const ph of ['resource', 'discard']) {
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: ph })
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17505')
	const h = readyOf(g, 'Allies', inst), r = tryPlay(g, 'Allies', inst)
	console.log('  ' + ph + '：hand_ready=' + h.ok + ' 实打=' + r.ok)
	ok('★ ' + ph + ' 阶段仍亮且能打（与之前口径一致）', h.ok === true && r.ok === true)
}

console.log('\n=== C. 17505 敌方（德国）回合 ===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17505')
	const h = readyOf(g, 'Allies', inst), r = tryPlay(g, 'Allies', inst)
	console.log('  hand_ready=' + JSON.stringify(h) + '  实打=' + r.ok + '  log=' + r.log.slice(0, 80))
	ok('★★ 敌方回合不再亮（hand_ready.ok=false）', h.ok === false, JSON.stringify(h))
	ok('★★ 实打仍被拒（与高亮一致）', r.ok === false && g.us_p51 !== true)
}

console.log('\n=== D. 17805 红色管弦乐队（敌方回合必须仍可用）===')
{
	const g = base()
	/* 德国桌面先放一张状态卡（17805 的候选） */
	R.action(g, 'Axis', 'debug_add_card', { face: '15254', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const de = (g.hands['德国'] || []).find(x => faceOf(x) === '15254')
	if (de) R.action(g, 'Axis', 'play_card', { card: de })
	I.refresh(g)
	console.log('  德国桌面状态卡 = ' + JSON.stringify((g.table['德国'] || []).map(faceOf)))

	R.action(g, 'Allies', 'debug_add_card', { face: '17805', nation: '苏联', dest: 'hand' })
	I.refresh(g)
	const inst = (g.hands['苏联'] || []).find(x => faceOf(x) === '17805')
	const h = readyOf(g, 'Allies', inst)
	console.log('  17805 hand_ready（德国回合）=' + JSON.stringify(h))
	ok('★★ 17805 在敌方回合仍亮（卡面"任一出牌阶段开始时"）', h.ok === true, JSON.stringify(h))

	/* 真实 armed 窗口：nation_turn_start */
	I.offer_armed_effects(g, 'nation_turn_start', { nation: '德国', window: 'nation_turn_start' })
	I.refresh(g)
	const v = R.view(g, 'Allies')
	const offer = v.armed_offer || {}
	const faces = (offer.cards || []).map(c => faceOf(c.card_id || c.card || c.id))
	console.log('  armed_offer.cards = ' + JSON.stringify(faces))
	ok('★ 17805 窗口开出（候选含 17805）', faces.indexOf('17805') >= 0, JSON.stringify(faces))
	if (faces.indexOf('17805') >= 0) {
		const cid = (offer.cards.find(c => faceOf(c.card_id || c.card || c.id) === '17805') || {}).card
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid })
		I.refresh(g)
		const lg = logSince(g, n0)
		console.log('  打出后 log = ' + lg.slice(0, 140))
		/* 打到"请选择德国状态卡"这一步即证明：敌方回合里 17805 能真实发动 */
		ok('★★ 17805 在敌方回合能真实发动（进入选卡步骤，未被本次改动影响）',
			/请做出选择|选择 1 张德国|红色管弦乐队/.test(lg), lg.slice(0, 120))
	}
}

console.log('\n=== E. 17513 四态回归 ===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
	I.refresh(g)
	let inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
	ok('★ 无已发动状态卡 → 不可打', readyOf(g, 'Allies', inst).ok === false)

	R.action(g, 'Allies', 'debug_add_card', { face: '17555', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const st = (g.hands['美国'] || []).find(x => faceOf(x) === '17555')
	if (st) R.action(g, 'Allies', 'play_card', { card: st })
	I.refresh(g)
	const ts = (g.table['美国'] || []).filter(x => (byId[faceOf(x)] || {}).type === 'STATUS')
	g.status_used = g.status_used || {}
	if (ts[0]) g.status_used[ts[0]] = (I.freq_key ? I.freq_key(g) : '1:美国')
	I.refresh(g)
	inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
	ok('★ 有已发动状态卡 → 可打', readyOf(g, 'Allies', inst).ok === true)

	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	ok('★ 敌方回合 → 不可打', readyOf(g, 'Allies', inst).ok === false)
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok("17505 已声明时点（conditional / 美国）", /CARD_TRIGGERS\['17505'\] = \{ kind: 'conditional', nation: '美国' \}/.test(src))
	ok("17805 仍无 CARD_TRIGGERS 声明（保持敌方回合可用）", !/CARD_TRIGGERS\['17805'\]/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
