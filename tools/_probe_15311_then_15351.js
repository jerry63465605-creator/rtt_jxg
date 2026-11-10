/*
 * 诊断：同一窗口里先打 15311（弃4）再打 15351（弃2）——服务端是否还保留第二个卡
 * 以及第二次 use_armed_offer 需要的参数形态
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const WE = Number(d.id_of('西欧'))

const g = new_board(20261108, { nation: '英国', phase: 'play' })
g.hands['英国'] = (g.hands['英国'] || []).filter(x => !['15311', '15351'].includes(faceOf(x)))
g.decks['英国'] = (g.decks['英国'] || []).filter(x => !['15311', '15351'].includes(faceOf(x)))
I.refresh(g)
give(g, '15311', '英国')
give(g, '15351', '英国')
for (let i = 0; i < 8; i++) give(g, '15304', '英国')
I.refresh(g)
place(g, 'de_mk', '德国', 'army', '德国'); I.refresh(g)
I.grant_supply(g, 'de_mk', g.turn); I.refresh(g)
give(g, '15225', '德国'); I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' }); I.refresh(g)
R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15225') }); I.refresh(g)
R.action(g, 'Axis', 'event_battle', { target: WE }); I.refresh(g)

const show = (tag) => {
	const w = (g.armed_offers || [])[0]
	console.log('  [' + tag + '] armed_offers = ' + JSON.stringify((g.armed_offers || []).map(x =>
		x.when + '@' + x.nation + ':' + (x.cards || []).map(c => faceOf(c.card_id)).join('/'))))
	if (w) console.log('        cards = ' + JSON.stringify((w.cards || []).map(c => ({ card: c.card_id, name: c.name, cost: c.cost }))))
}

console.log('=== 窗口创建 ===')
show(' création')

const w0 = (g.armed_offers || [])[0]
const cid11 = (w0.cards.find(c => faceOf(c.card_id) === '15311') || {}).card_id
const cid51 = (w0.cards.find(c => faceOf(c.card_id) === '15351') || {}).card_id
console.log('  15311 实例 = ' + cid11 + '　15351 实例 = ' + cid51)

console.log('\n=== 先打 15311（弃 4）===')
{
	const drops = (g.hands['英国'] || []).filter(x => x !== cid11).slice(0, 4)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cid11, drop: drops })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 220))
	console.log('  手牌数 = ' + (g.hands['英国'] || []).length)
	show('after 15311')
}

console.log('\n=== 再打 15351（弃 2）===')
{
	const still = (g.armed_offers || []).some(x => (x.cards || []).some(c => faceOf(c.card_id) === '15351'))
	if (!still) { console.log('  ✗ 15351 已不在窗口（服务端把窗口关了）'); }
	else {
		const drops = (g.hands['英国'] || []).filter(x => x !== cid51).slice(0, 2)
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid51, drop: drops })
		I.refresh(g)
		console.log('  log = ' + logSince(g, n0).slice(0, 240))
		show('after 15351')
		console.log('  北海/不列颠 = ' + JSON.stringify(['北海', '不列颠'].map(n =>
			n + ':' + I.pieces_on(g, Number(d.id_of(n))).map(p => g.piece_nation[p] + '/' + g.piece_type[p]).join(','))))
	}
}

console.log('\n=== 视图（客户端拿到的 armed_offer）===')
const v = R.view(g, 'Allies')
console.log('  ' + JSON.stringify(v.armed_offer && {
	when: v.armed_offer.when, nation: v.armed_offer.nation,
	cards: (v.armed_offer.cards || []).map(c => ({ card: c.card, name: c.name, cost: c.cost })),
	pending: v.armed_offer.pending,
}))
