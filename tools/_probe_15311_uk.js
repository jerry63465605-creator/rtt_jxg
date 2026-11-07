/*
 * 真实盘面排查：英国持 15311《马奇诺防线》，<西欧>法国陆军被移除时，
 * armed 窗口是否开出、以及英国到底能不能把这个"增强"打出去。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(20261107)
g.pending_battle = null; g.pending_econ = null
g.armed_offers = []; g.response_queue = []; g.response_stack = []
g.pending_echo = null; g.pending_status_react = null
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)

/* ① 英国手里：15311 + 4 张垫牌（弃 4 是代价） */
for (const f of ['15311', '15304', '15305', '15306', '15307']) {
	R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
}
I.refresh(g)
console.log('英国手牌 = ' + JSON.stringify((g.hands['英国'] || []).map(faceOf)))

/* ② <西欧> 的守军（真实开局通常有法国陆军；没有就补 1 支） */
const WE = d.id_of('西欧')
console.log('西欧初始部队 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
let frArmy = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
if (!frArmy) {
	R.action(g, 'Allies', 'debug_place', { piece: 'fr_w', nation: '法国', type: 'army', space: WE })
	I.refresh(g)
	frArmy = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
}
console.log('西欧法国陆军 = ' + frArmy + '（补给? ' + JSON.stringify(!!(g.supply && g.supply[frArmy])) + '）')
I.grant_supply(g, frArmy, g.turn)
I.refresh(g)

/* ③ 德国从相邻地区对<西欧>发起陆战（真实动作）→ 移除法国陆军 → piece_removed */
const DE = d.id_of('德国')
R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: DE })
I.refresh(g)
I.grant_supply(g, 'de_atk', g.turn)
I.refresh(g)
R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
I.refresh(g)
const bid = (g.hands['德国'] || []).find(x => faceOf(x) === '15201')
console.log('\n=== 德国发起陆战（打<西欧>的法国陆军）===')
let n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: bid, space: WE, piece: frArmy })
I.refresh(g)
console.log('  log = ' + logSince(g, n0).slice(0, 300))
console.log('  英国陆军 西欧是否还在 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
console.log('  armed_offers = ' + JSON.stringify((g.armed_offers || []).map(w => ({
	when: w.when, nation: w.nation,
	cards: (w.cards || []).map(c => ({ id: c.card_id, nation: c.nation, name: c.name })),
}))))
console.log('  response_queue = ' + JSON.stringify((g.response_queue || []).map(r => ({ nation: r.nation, face: faceOf(r.card_id || '') }))))
console.log('  pending_trigger = ' + JSON.stringify((() => {
	const v = R.view(g, 'Allies')
	return v.pending_trigger ? (v.pending_trigger.candidates || []).map(c => c.name || c.card_face) : null
})()))

/* ④ 真打：英国点这张"增强" */
const off = (g.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '15311'))
if (off) {
	const entry = (off.cards || []).find(c => faceOf(c.card_id) === '15311')
	console.log('\n=== 英国点 15311 ===')
	console.log('  entry = ' + JSON.stringify({ card_id: entry.card_id, nation: entry.nation, name: entry.name }))
	console.log('  g.hands["' + entry.nation + '"] 含本卡 = ' + ((g.hands[entry.nation] || []).indexOf(entry.card_id) >= 0))
	const drops = (g.hands['英国'] || []).filter(x => faceOf(x) !== '15311').slice(0, 4)
	n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: entry.card_id, drop: drops })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 320))
	console.log('  窗口还在 = ' + JSON.stringify((g.armed_offers || []).map(w => (w.cards || []).map(c => faceOf(c.card_id)))))
	console.log('  西欧部队 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
} else {
	console.log('\n✗ 没有为 15311 开出 armed 窗口')
	/* 也看看是否为响应队列形式 */
	const v = R.view(g, 'Allies')
	console.log('  view.pending_trigger = ' + JSON.stringify(v.pending_trigger && {
		nation: v.pending_trigger.nation,
		cands: (v.pending_trigger.candidates || []).map(c => c.name || c.card_face),
	}))
	console.log('  view.armed_offer = ' + JSON.stringify(v.armed_offer && {
		when: v.armed_offer.when, nation: v.armed_offer.nation,
		cards: (v.armed_offer.cards || []).map(c => c.name),
	}))
}
