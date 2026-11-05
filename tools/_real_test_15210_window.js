/*
 * B7 真实测试：15210《施佩伯爵海军上将号》—— 建设海军【失败】也要给触发时点
 *
 *  A 建海军成功 + 亚速尔相邻有敌方海军 -> 开窗、可发动、扣 1 张、真发起海战
 *  B 建海军【失败】（对着陆地建）        -> 仍开窗，15210 在候选里
 *  C 在 B 的窗口点发动                  -> ok:false「无可发起的海战目标」，德国牌库不变（不扣代价）
 *  D 未建海军                           -> 不开窗
 *  E 静态守卫：失败路径派发窗口 + ready 不再要求目标 + run 失败走 ok:false
 *
 * 用法：node tools/_real_test_15210_window.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const deck = (g, n) => (g.decks[n] || []).length
const offer15210 = g => {
	for (const w of (g.armed_offers || []))
		for (const c of (w.cards || []))
			if (String(c.card_id).startsWith('15210')) return c.card_id
	return null
}

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15210', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15202', nation: '德国', dest: 'hand' })   /* 建设海军 */
	I.refresh(g)
	return g
}
const cardOf = (g, face) => (g.hands['德国'] || []).find(x => String(x).startsWith(face))

console.log('=== A. 建海军成功 + 亚速尔相邻有敌方 → 可发动 ===')
let gA = null
{
	const g = setup(); gA = g
	/* 亚速尔相邻的海域放一支英国海军（作为海战目标），德国改在另一片海建海军避免撞车 */
	const az = d.id_of('亚速尔')
	const azSeas = I.get_connections(g, az, 'allies').map(Number)
		.filter(s => d.spaces[s] && d.spaces[s].terrain === 'sea')
	const buildSp = d.id_of('波罗的海')
	const tgtSp = azSeas.find(s => s !== buildSp)
	console.log('  亚速尔相邻海域=' + azSeas.map(s => d.name_of(s)).join(',') +
		'  建海军于=' + d.name_of(buildSp) + '  敌方目标=' + d.name_of(tgtSp))
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_n', nation: '英国', type: 'navy', space: tgtSp })
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cardOf(g, '15202'), space: buildSp })
	console.log('  build log: ' + logSince(g, n0))
	const c = offer15210(g)
	console.log('  窗口里的 15210 = ' + c)
	ok('★ 建海军成功后开窗、15210 在候选', !!c)
	const d0 = deck(g, '德国')
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: c })
	console.log('  trigger log: ' + logSince(g, n1))
	console.log('  德国牌库 ' + d0 + ' -> ' + deck(g, '德国'))
	ok('★ 发动后扣 1 张（损耗）', d0 - deck(g, '德国') === 1, (d0 - deck(g, '德国')) + ' 张')
	ok('★ 真的发起了海战', /海战/.test(logSince(g, n1)), logSince(g, n1).slice(0, 120))
}

console.log('\n=== B. 建海军【失败】（对陆地建）→ 仍开窗 ===')
let gB = null, cardB = null
{
	const g = setup(); gB = g
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cardOf(g, '15202'), space: d.id_of('德国') })   /* 陆军格 → 失败 */
	console.log('  build log: ' + logSince(g, n0))
	console.log('  armed_offers = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, n: (w.cards || []).length, failed: !!(w.ctx && w.ctx.failed) }))))
	cardB = offer15210(g)
	ok('★★ 建海军失败后仍开窗（after_build_navy）', (g.armed_offers || []).some(w => w.when === 'after_build_navy'),
		JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★★ 15210 出现在候选里', !!cardB, String(cardB))
}

console.log('\n=== C. 在失败窗口里点发动 → 拒绝且不扣代价 ===')
{
	const g = gB
	const d0 = deck(g, '德国')
	const disc0 = (g.discard['德国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: cardB })
	const lg = logSince(g, n0)
	console.log('  trigger log: ' + lg)
	console.log('  牌库 ' + d0 + ' -> ' + deck(g, '德国') + '；弃牌堆 ' + disc0 + ' -> ' + (g.discard['德国'] || []).length)
	ok('★★ 明确拒绝（无可发起的海战目标）', /无可发起|未发动|不能/.test(lg), lg)
	ok('★★ 没有扣代价（牌库/弃牌堆都不变）',
		deck(g, '德国') === d0 && (g.discard['德国'] || []).length === disc0,
		JSON.stringify({ deck: [d0, deck(g, '德国')], disc: [disc0, (g.discard['德国'] || []).length] }))
}

console.log('\n=== D. 未建海军 → 不开窗 ===')
{
	const g = setup()
	R.action(g, 'Axis', 'debug_place', { piece: 'de_a', nation: '德国', type: 'army', space: d.id_of('德国') })
	I.refresh(g)
	ok('★ 没建海军时没有 after_build_navy 窗口',
		!(g.armed_offers || []).some(w => w.when === 'after_build_navy'),
		JSON.stringify((g.armed_offers || []).map(w => w.when)))
}

console.log('\n=== E. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('失败路径会派发 after_build_navy', /function emit_build_navy_failed/.test(src) && /offer_armed_effects\(game, 'after_build_navy'/.test(src))
	const seg = src.slice(src.indexOf("'15210': {"), src.indexOf("'15210': {") + 1200)
	ok('15210 ready 不再要求"已有目标"', !/find_battle_target\(game, '德国', 'sea'/.test(seg.split('run(game, ctx)')[0]))
	ok('15210 run 无目标时返回 ok:false（不扣代价）', /if \(!tgt\) return \{ ok: false/.test(seg))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
