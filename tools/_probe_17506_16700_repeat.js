/*
 * 排查：17506《沉睡的巨人》一次发动过程中，意大利 16700 被询问了 3 次
 *
 * 走两条真实分支，每步都打印「意大利的 enemy_echo_played 窗口数量」：
 *   A 意大利【放弃】→ 美国继续选地区 → 是否再次询问意大利？
 *   B 意大利【拦截】→ 结算后是否再次询问？
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function scene() {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	place(g, 'us_haw', '美国', 'army', '夏威夷')
	I.grant_supply(g, 'us_haw', g.turn); I.refresh(g)
	give(g, '17502', '美国')
	give(g, '17506', '美国')
	give(g, '16700', '意大利')
	return g
}
/* 意大利侧 enemy_echo_played 窗口（含 pending 的也算） */
const itWindows = g => (g.armed_offers || []).filter(w => w.when === 'enemy_echo_played'
	&& (w.cards || []).some(c => faceOf(c.card_id) === '16700'))
const dump = (tag, g) => console.log('    ' + tag +
	'  意大利窗口=' + itWindows(g).length +
	'  全部窗口=' + JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation + ':' + (w.cards || []).map(c => faceOf(c.card_id)).join('/'))) +
	'  skip标记=' + !!g.__skip_echo_intercept +
	'  pending_armed_use=' + JSON.stringify(g.pending_armed_use && g.pending_armed_use.card))

/* ---------- A. 意大利放弃 ---------- */
console.log('=== A. 意大利【放弃】===')
{
	const g = scene()
	let n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['美国'] || []).find(x => faceOf(x) === '17502'), space: d.id_of('中太平洋') })
	I.refresh(g)
	dump('A1 建海军后（美国窗口）', g)
	const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '17506'))
	const cid = (w.cards || []).find(c => faceOf(c.card_id) === '17506').card_id

	n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })          /* 美国点 17506（未选目标） */
	I.refresh(g)
	console.log('  A2 点 17506 → ' + logSince(g, n0).slice(0, 140))
	dump('   ', g)

	n0 = (g.log || []).length
	R.action(g, 'Axis', 'skip_armed_offer', { card: (itWindows(g)[0] || {}).cards ? itWindows(g)[0].cards[0].card_id : cid })
	I.refresh(g)
	console.log('  A3 意大利放弃 → ' + logSince(g, n0).slice(0, 140))
	dump('   ', g)

	/* 美国继续：选地区完成 17506 */
	const pend = (g.armed_offers[0] || {}).pending
	const cand = (pend && pend.candidates) || []
	console.log('  A4 pending=' + JSON.stringify(pend && { need: pend.need, n: cand.length }))
	if (cand.length) {
		n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid, space: cand[0] })
		I.refresh(g)
		console.log('  A5 选地区结算 → ' + logSince(g, n0).slice(0, 200))
		dump('   ', g)
	}
}

/* ---------- B. 意大利拦截 ---------- */
console.log('\n=== B. 意大利【拦截】===')
{
	const g = scene()
	R.action(g, 'Allies', 'play_card', { card: (g.hands['美国'] || []).find(x => faceOf(x) === '17502'), space: d.id_of('中太平洋') })
	I.refresh(g)
	const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '17506'))
	const cid = (w.cards || []).find(c => faceOf(c.card_id) === '17506').card_id
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })
	I.refresh(g)
	dump('B1 点 17506 后', g)
	const icid = itWindows(g)[0].cards.find(c => faceOf(c.card_id) === '16700').card_id
	const deck0 = (g.decks['意大利'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: icid })
	I.refresh(g)
	console.log('  B2 意大利拦截 → ' + logSince(g, n0).slice(0, 220))
	console.log('     意大利牌库 ' + deck0 + '→' + (g.decks['意大利'] || []).length)
	dump('   ', g)
	/* 美国再点一次（模拟玩家继续操作）会不会又弹给意大利？ */
	if (itWindows(g).length) {
		const again = itWindows(g)[0].cards.find(c => faceOf(c.card_id) === '16700').card_id
		const n1 = (g.log || []).length
		R.action(g, 'Axis', 'use_armed_offer', { card: again })
		I.refresh(g)
		console.log('  B3 再点一次 → ' + logSince(g, n1).slice(0, 200))
		dump('   ', g)
	}
}

/* ---------- C. 统计：一次 17506 一共派发了几次 enemy_echo_played ---------- */
console.log('\n=== C. 全流程日志里 enemy_echo_played 相关行 ===')
{
	const g = scene()
	R.action(g, 'Allies', 'play_card', { card: (g.hands['美国'] || []).find(x => faceOf(x) === '17502'), space: d.id_of('中太平洋') })
	I.refresh(g)
	const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '17506'))
	const cid = (w.cards || []).find(c => faceOf(c.card_id) === '17506').card_id
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })
	I.refresh(g)
	const logs = g.log || []
	logs.forEach((l, i) => {
		if (/拦截应答|一日之狮|沉睡的巨人|错过|作废/.test(l)) console.log('  [' + i + '] ' + l.slice(0, 150))
	})
}
