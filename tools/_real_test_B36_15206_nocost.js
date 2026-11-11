/*
 * B36 真实测试 —— 15206《轰炸伦敦》卡面无德国代价
 *
 * 卡面原文：「打出[经济战]时，若目标是英国：<不列颠>2地区内每有1支德国空军，
 *           该经济战损耗数加2。」
 * 旧实现多写 armed.cost:{attrition:1}，导致德国牌库空时
 * offer_armed_effects 的 can_attrite 预检静默不弹窗（「没给打出时点」）。
 * 本测试只覆盖「删 cost」这一条最小修复；不列颠无德机仍弹空窗属已知遗留，不在本条。
 *
 * ★★ 断言会因旧 cost 变红：牌库空仍能开窗、cost.attrition=0、德国牌库不变。
 *
 * 用法：node tools/_real_test_B36_15206_nocost.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const deckOf = (g, n) => (g.decks[n] || []).length
const BT = d.id_of('不列颠')
function ring(g, n) {
	const all = I.region_spaces(g, { space: BT, radius: n }).map(Number)
	const prev = I.region_spaces(g, { space: BT, radius: n - 1 }).map(Number)
	return all.filter(x => prev.indexOf(x) < 0)
}
function setup(opt = {}) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	for (const f of ['15206', '15217'])
		if (!(g.hands['德国'] || []).some(x => String(x).startsWith(f)))
			R.action(g, 'Axis', 'debug_add_card', { face: f, nation: '德国', dest: 'hand' })
	I.refresh(g)
	/* 德国牌库按场景设置；英国牌库给足，便于断言「额外损耗 2」 */
	g.decks['德国'] = []
	for (let i = 0; i < (opt.deDeck || 0); i++) g.decks['德国'].push('15300#' + (20 + i))
	/* 给足牌库：15217 本身先损耗英国 3 张，15206 还要追加 2 张 */
	g.decks['英国'] = []
	for (let i = 0; i < 10; i++) g.decks['英国'].push('15400#' + (1 + i))
	I.refresh(g)
	/* 不列颠 1 跳格放 1 支德国空军 */
	if (!opt.noAir) {
		const sp = ring(g, 1)[0]
		R.action(g, 'Axis', 'debug_place', { piece: 'de_air_b36', nation: '德国', type: 'air', space: sp })
		I.refresh(g)
	}
	return g
}
function playEcon(g) {
	const ec = (g.hands['德国'] || []).find(x => String(x).startsWith('15217'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: ec, target: '英国' })
	const offer = (g.armed_offers || []).find(w =>
		(w.cards || []).some(c => String(c.card_id).startsWith('15206')))
	const c = offer && (offer.cards || []).find(x => String(x.card_id).startsWith('15206'))
	return { card: c && c.card_id, cost: c && c.cost, log: (g.log || []).slice(n0).join(' | ') }
}

console.log('=== A. ★★ 德国牌库为空仍能开窗（旧 cost 会静默过滤）===')
{
	const g = setup({ deDeck: 0 })
	const r = playEcon(g)
	console.log('  日志: ' + r.log.slice(0, 200))
	const v = R.view(g, 'Axis')
	ok('★★ 牌库空 → armed_offers 有 15206', !!r.card, J((g.armed_offers || []).map(w => w.when)))
	ok('★★ view.armed_offer 已下发', !!v.armed_offer &&
		(v.armed_offer.cards || []).some(c => String(c.card_id || '').startsWith('15206') ||
			/轰炸伦敦/.test(c.name || '')), J(v.armed_offer))
	ok('★★ 动作表 use_armed_offer 在册', !!v.actions.use_armed_offer, J(v.actions))
	ok('★★ 窗口 cost.attrition=0（卡面无代价）',
		!(r.cost && r.cost.attrition), J(r.cost))
	const de0 = deckOf(g, '德国'), uk0 = deckOf(g, '英国')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: r.card, left: 1 })
	const lg = (g.log || []).slice(n0).join(' | ')
	console.log('  点「打出」: ' + lg.slice(0, 200))
	ok('★★ 德国牌库不变（不再多扣 1 张）', deckOf(g, '德国') === de0,
		de0 + ' -> ' + deckOf(g, '德国'))
	ok('★★ 日志无「德国损耗」/「需损耗」', !/德国】损耗|需损耗/.test(lg), lg)
	ok('★ 英国仍额外损耗 2 张（效果未变）', uk0 - deckOf(g, '英国') === 2,
		uk0 + ' -> ' + deckOf(g, '英国'))
}

console.log('\n=== B. 德国牌库有牌时也不扣（卡面无代价，与牌库无关）===')
{
	const g = setup({ deDeck: 3 })
	const r = playEcon(g)
	const de0 = deckOf(g, '德国'), uk0 = deckOf(g, '英国')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: r.card, left: 1 })
	const lg = (g.log || []).slice(n0).join(' | ')
	ok('★ 德国牌库仍不变', deckOf(g, '德国') === de0, de0 + ' -> ' + deckOf(g, '德国'))
	ok('★ 英国额外损耗 2 张', uk0 - deckOf(g, '英国') === 2, uk0 + ' -> ' + deckOf(g, '英国'))
	ok('★ 日志无德国损耗', !/德国】损耗|需损耗/.test(lg), lg)
}

console.log('\n=== C. 目标非英国仍不弹窗（原有 cond 未动）===')
{
	const g = setup({ deDeck: 0 })
	const ec = (g.hands['德国'] || []).find(x => String(x).startsWith('15217'))
	R.action(g, 'Axis', 'play_card', { card: ec, target: '苏联' })
	ok('★ cond 仍生效', !(g.armed_offers || []).some(w =>
		(w.cards || []).some(c => String(c.card_id).startsWith('15206'))),
		J((g.armed_offers || []).map(w => w.when)))
}

console.log('\n=== D. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const block = (/\/\*\s*15206 轰炸伦敦[\s\S]{0,800}?'15206': \{[\s\S]{0,300}?when: 'econ_used'[^\n]*/.exec(src) || [''])[0]
	ok('★★ 15206 armed 配置已无 cost.attrition', !/cost:\s*\{\s*attrition/.test(block), block.slice(0, 220))
	ok('★ 注释已改为卡面原文、不再写「损耗1」',
		!/15206 轰炸伦敦[^\n]*损耗1/.test(src) && /卡面原文/.test(src))
	ok('★ run 仍按不列颠 radius:2 计数（效果未动）',
		/const k = count_pieces\(game, \{ space: '不列颠', radius: 2/.test(src))
	const p0 = fs.readFileSync(path.join(__dirname, '..', 'docs', 'impact-p0-window-fallback.md'), 'utf8')
	ok('★ p0 窗口文档代价列已更正', /15206 \| 轰炸伦敦 \| 德国 \| econ_used \| \| 无/.test(p0))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
