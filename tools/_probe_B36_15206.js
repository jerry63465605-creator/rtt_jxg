/*
 * B36 只读探针：15206《轰炸伦敦》「没给打出时点」定性。
 * 对照 17505《P-51 野马》（armed + ready 一次性范式）。
 * 真实 R.action 驱动，不改产品代码。用法：node tools/_probe_B36_15206.js
 *
 * 【2026-11-12 更新】卡面无德国代价，旧 armed.cost:{attrition:1} 已删（只删 cost）。
 * 因此下面 C 场景的标题「牌库不足付 cost」已过时：牌库为空时【应仍能开窗】，
 * 输出里的「仍弹窗? true」现在是正确结果；B 场景（不列颠无德机仍弹空窗）是已知遗留，
 * 本条按「一次只做一条」不处理。权威断言见 tools/_real_test_B36_15206_nocost.js。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const J = x => JSON.stringify(x)
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const BT = d.id_of('不列颠')

function ring(g, n) {
	const all = I.region_spaces(g, { space: BT, radius: n }).map(Number)
	const prev = I.region_spaces(g, { space: BT, radius: n - 1 }).map(Number)
	return all.filter(x => prev.indexOf(x) < 0)
}

function board(opt = {}) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	/* 清掉牌库/手牌里已有的 15206 副本，确保恰好 1 张 */
	g.hands['德国'] = (g.hands['德国'] || []).filter(x => faceOf(x) !== '15206')
	g.decks['德国'] = (g.decks['德国'] || []).filter(x => faceOf(x) !== '15206')
	I.refresh(g)
	for (const f of (opt.faces || ['15206', '15217']))
		R.action(g, 'Axis', 'debug_add_card', { face: f, nation: '德国', dest: 'hand' })
	I.refresh(g)
	if (opt.emptyDeck) g.decks['德国'] = []
	I.refresh(g)
	return g
}
function playEcon(g, target) {
	const ec = (g.hands['德国'] || []).find(x => faceOf(x) === '15217')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: ec, target: target })
	return logSince(g, n0)
}
function dump(tag, g) {
	const v = R.view(g, 'Axis')
	const off = (g.armed_offers || []).find(w =>
		(w.cards || []).some(c => faceOf(c.card_id) === '15206'))
	const card = off && (off.cards || []).find(c => faceOf(c.card_id) === '15206')
	console.log('\n  [' + tag + ']')
	console.log('   日志: ' + (g.log || []).slice(-2).join(' | ').slice(0, 220))
	console.log('   armed_offers = ' + J((g.armed_offers || []).map(w => w.when + ':' +
		(w.cards || []).map(c => faceOf(c.card_id)).join('/'))))
	console.log('   view.armed_offer = ' + J(v.armed_offer && {
		when: v.armed_offer.when,
		cards: (v.armed_offer.cards || []).map(c => ({ card: c.card_id, name: c.name, cost: c.cost })),
	}))
	console.log('   actions.use_armed_offer = ' + !!v.actions.use_armed_offer +
		'  skip_armed_offer = ' + !!v.actions.skip_armed_offer)
	const h = Object.keys(v.hand_ready || {}).find(k => faceOf(k) === '15206')
	console.log('   hand_ready[15206] = ' + J(h ? v.hand_ready[h] : null))
	console.log('   block_reason = ' + J(v.block_reason))
	return { card: card && card.card_id, v }
}

console.log('=== A. 正常路径：德国打出 15217 目标英国，不列颠半径2内 1 支德国空军 ===')
{
	const g = board()
	const sp = ring(g, 1)[0]
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air_a', nation: '德国', type: 'air', space: sp })
	I.refresh(g)
	console.log('  空军@' + d.name_of(sp))
	playEcon(g, '英国')
	const r = dump('A', g)
	console.log('   -> 窗口卡实例 = ' + r.card)
	if (r.card) {
		const n = g.log.length
		R.action(g, 'Axis', 'use_armed_offer', { card: r.card, left: 1 })
		console.log('   点「打出」日志: ' + logSince(g, n).slice(0, 220))
	}
}

console.log('\n=== B. 不列颠半径2内【无】德国空军（对照 17505 的 ready 不弹空窗）===')
{
	const g = board()
	playEcon(g, '英国')
	const r = dump('B', g)
	console.log('   -> 仍弹窗? ' + !!r.card + '（17505 范式应为 false）')
}

console.log('\n=== C. 德国牌库不足付 cost.attrition=1 ===')
{
	const g = board({ emptyDeck: true })
	playEcon(g, '英国')
	const r = dump('C', g)
	console.log('   -> 仍弹窗? ' + !!r.card)
}

console.log('\n=== D. 目标非英国（现有测试已覆盖）===')
{
	const g = board()
	const sp = ring(g, 1)[0]
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air_d', nation: '德国', type: 'air', space: sp })
	I.refresh(g)
	playEcon(g, '苏联')
	const r = dump('D', g)
	console.log('   -> 仍弹窗? ' + !!r.card)
}

console.log('\n=== E. 对照：17505 同场景（美国打轰炸行动）的窗口与预检 ===')
{
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	g.hands['美国'] = (g.hands['美国'] || []).filter(x => faceOf(x) !== '17505')
	g.decks['美国'] = (g.decks['美国'] || []).filter(x => faceOf(x) !== '17505')
	I.refresh(g)
	for (const f of ['17505', '17517'])
		R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '美国', dest: 'hand' })
	I.refresh(g)
	const ec = (g.hands['美国'] || []).find(x => faceOf(x) === '17517')
	const n0 = g.log.length
	R.action(g, 'Allies', 'play_card', { card: ec, target: '德国' })
	console.log('  日志: ' + logSince(g, n0).slice(0, 200))
	const v = R.view(g, 'Allies')
	console.log('  view.armed_offer = ' + J(v.armed_offer && {
		when: v.armed_offer.when,
		cards: (v.armed_offer.cards || []).map(c => faceOf(c.card_id)),
	}))
	console.log('  hand_ready[17505] = ' + J((() => {
		const k = Object.keys(v.hand_ready || {}).find(k => faceOf(k) === '17505')
		return k ? v.hand_ready[k] : null
	})()))
}

console.log('\n=== F. 静态对照：两张卡的配置差异 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	console.log('  CARD_TRIGGERS[15206] = ' +
		(/CARD_TRIGGERS\['15206'\][^\n]*/.exec(src) || ['(无)'])[0])
	console.log('  CARD_TRIGGERS[17505] = ' +
		(/CARD_TRIGGERS\['17505'\][^\n]*/.exec(src) || ['(无，已删)'])[0])
	console.log('  15206 armed 有 ready = ' +
		/'15206': \{[\s\S]{0,700}?ready\s*\(/.test(src))
	console.log('  17505 armed 有 ready = ' +
		/ECHO_EFFECTS\['17505'\] = \{[\s\S]{0,700}?ready\s*\(/.test(src))
	console.log('  15206 run 用 attrition_cards = ' +
		/'15206': \{[\s\S]{0,1200}?attrition_cards\(game, '英国'/.test(src))
	console.log('  17505 run 用 attrition_passive = ' +
		/ECHO_EFFECTS\['17505'\] = \{[\s\S]{0,1500}?attrition_passive/.test(src))
}
