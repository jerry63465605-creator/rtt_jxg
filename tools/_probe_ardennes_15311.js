/*
 * B8 只读探针②：阿登闪击战(15225) 打到<西欧>、法国陆军被移除时，
 * 英国手里有 15311《马奇诺防线》+ 7 张手牌 —— 窗口是否真的"挂起"，
 * 德国能不能在窗口期间继续推进阿登的下一步？
 *
 * 用法：node tools/_probe_ardennes_15311.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const snap = g => ({
	budget: g.event_budget && { remaining: g.event_budget.remaining, targets: g.event_budget.targets, card: g.event_budget.card_id },
	pendingBattle: g.pending_battle && g.pending_battle.stage,
	pendingStep: g.pending_event_step && g.pending_event_step.card_id,
	offers: (g.armed_offers || []).map(w => ({ when: w.when, cards: (w.cards || []).map(c => c.card_id) })),
	westEurope: I.pieces_on(g, d.id_of('西欧')).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')'),
})

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
I.refresh(g)

/* 英国：15311 + 补到 7 张手牌 */
R.action(g, 'Allies', 'debug_add_card', { face: '15311', nation: '英国', dest: 'hand' })
while ((g.hands['英国'] || []).length < 7)
	R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
/* 德国：阿登闪击战 + 一支能发起陆战的陆军@德国 */
R.action(g, 'Axis', 'debug_add_card', { face: '15225', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: d.id_of('德国') })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
I.grant_supply(g, 'de_atk', g.turn)
I.refresh(g)

console.log('=== 开局 ===')
console.log('  西欧守军 = ' + JSON.stringify(snap(g).westEurope))
console.log('  英国手牌 = ' + (g.hands['英国'] || []).length + '  含 15311 = ' +
	(g.hands['英国'] || []).some(x => faceOf(x) === '15311'))

console.log('\n=== 打阿登闪击战 ===')
{
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === '15225')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: c })
	console.log('  log = ' + logSince(g, n0).slice(0, 260))
	console.log('  状态 = ' + JSON.stringify(snap(g)))
}

console.log('\n=== 德国发起阿登的第一步陆战（event_battle） ===')
{
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_battle', { target: d.id_of('西欧'), from: 'de_atk' })
	console.log('  log = ' + logSince(g, n0).slice(0, 320))
	console.log('  状态 = ' + JSON.stringify(snap(g)))
}

console.log('\n=== 若出现 15311 窗口：德国还能不能继续推进？ ===')
{
	const has = (g.armed_offers || []).some(w => w.when === 'piece_removed' && (w.cards || []).length)
	console.log('  15311 窗口存在 = ' + has)
	if (has) {
		/* 依次试几种"继续推进"的动作，看服务端是否放行 */
		for (const [act, arg] of [
			['event_finish', {}],
			['event_battle', { target: d.id_of('西欧'), from: 'de_atk' }],
			['next_phase', {}],
		]) {
			const before = JSON.stringify(snap(g))
			const n0 = (g.log || []).length
			R.action(g, 'Axis', act, arg)
			const lg = logSince(g, n0)
			const after = JSON.stringify(snap(g))
			console.log('  [' + act + '] log=' + (lg ? lg.slice(0, 120) : '(无)') +
				'  状态变化=' + (before !== after))
			if (before !== after) {
				console.log('     after = ' + after.slice(0, 220))
				break
			}
		}
		console.log('  最终窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, n: (w.cards || []).length }))))
	}
}

console.log('\n=== 两侧视角 ===')
for (const side of ['Axis', 'Allies']) {
	const v = R.view(g, side)
	console.log('  ' + side + ': armed_offer=' + JSON.stringify(v.armed_offer && { when: v.armed_offer.when, n: (v.armed_offer.cards || []).length }) +
		'  event_budget=' + JSON.stringify(v.event_budget && v.event_budget.remaining) +
		'  actions=' + JSON.stringify(Object.keys(v.actions || {})))
}
