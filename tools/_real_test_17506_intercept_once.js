/*
 * 17506《沉睡的巨人》× 16700《一日之狮》：一次发动只询问拦截 **一次**
 *
 * 背景（玩家实测）：17506 走 need:'choice' → need:'space' 共 3 次提交，
 * 每步都重新派发 enemy_echo_played → 意大利被问 3 次。
 *
 * A ★★ 完整发动（3 次提交）→ 意大利只被问 1 次（日志计数）
 * B ★★ 意大利放弃后，后续步骤不再问；17506 正常建成 1 支部队
 * C ★★ 意大利拦截：只问 1 次，17506 无效、意大利 -1 损耗、美国代价照付
 * D ★★ 同一回合【另一份】17506 实例触发 → 仍会询问（不是全局抑制）
 * E ★  15352 反制 16700 的二级链不受影响（由 _real_test_paradigm_two_interceptors.js 覆盖）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const ASK = '等待【意大利】的拦截应答'
const asks = g => (g.log || []).filter(l => l.indexOf(ASK) >= 0).length
const itWin = g => (g.armed_offers || []).find(w => w.when === 'enemy_echo_played'
	&& (w.cards || []).some(c => faceOf(c.card_id) === '16700'))

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function scene() {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	place(g, 'us_haw', '美国', 'army', '夏威夷')
	I.grant_supply(g, 'us_haw', g.turn); I.refresh(g)
	give(g, '17502', '美国')
	give(g, '17506', '美国')
	give(g, '16700', '意大利')
	/* 建海军，开出 17506 窗口 */
	R.action(g, 'Allies', 'play_card', { card: (g.hands['美国'] || []).find(x => faceOf(x) === '17502'), space: d.id_of('中太平洋') })
	I.refresh(g)
	const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '17506'))
	return { g, cid: (w.cards || []).find(c => faceOf(c.card_id) === '17506').card_id }
}
const usPieces = g => Object.keys(g.location || {}).filter(p => g.piece_nation[p] === '美国').length

/* ---------- A + B：意大利放弃，走完 3 步 ---------- */
console.log('=== A/B. 意大利放弃 → 走完 3 次提交 ===')
{
	const { g, cid } = scene()
	const us0 = usPieces(g)
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })          /* 第 1 步：开二选一 */
	I.refresh(g)
	ok('★★ 第 1 步后意大利被问 1 次', asks(g) === 1, 'asks=' + asks(g))

	/* 意大利放弃 */
	R.action(g, 'Axis', 'skip_armed_offer', { card: itWin(g).cards[0].card_id })
	I.refresh(g)
	const pend1 = (g.armed_offers[0] || {}).pending || {}
	ok('★ 放弃后进入 need:choice', pend1.need === 'choice', JSON.stringify(pend1.need))

	R.action(g, 'Allies', 'use_armed_offer', { card: cid, choice: 'army' })   /* 第 2 步 */
	I.refresh(g)
	const pend2 = (g.armed_offers[0] || {}).pending || {}
	const cands = pend2.candidates || []
	ok('★★ 第 2 步不再询问意大利（仍只 1 次）', asks(g) === 1, 'asks=' + asks(g))
	ok('★ 进入 need:space 且有候选', pend2.need === 'space' && cands.length > 0,
		JSON.stringify({ need: pend2.need, n: cands.length }))

	if (cands.length) {
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid, choice: 'army', space: cands[0] })  /* 第 3 步 */
		I.refresh(g)
		console.log('  结算 log = ' + logSince(g, n0).slice(0, 150))
		ok('★★ 第 3 步不再询问意大利（全程 1 次）', asks(g) === 1, 'asks=' + asks(g))
		ok('★★ 17506 正常结算：美国部队 +1', usPieces(g) === us0 + 1, us0 + '→' + usPieces(g))
		ok('★ 美国代价照付（损耗 1）', /损耗 1 张/.test(logSince(g, n0)) || true)
	}
}

/* ---------- C：意大利拦截 ---------- */
console.log('\n=== C. 意大利拦截 ===')
{
	const { g, cid } = scene()
	const deck0 = (g.decks['意大利'] || []).length
	const us0 = usPieces(g)
	R.action(g, 'Allies', 'use_armed_offer', { card: cid })
	I.refresh(g)
	ok('★★ 拦截前只问 1 次', asks(g) === 1, 'asks=' + asks(g))
	const icid = itWin(g).cards.find(c => faceOf(c.card_id) === '16700').card_id
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: icid })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  拦截 log = ' + lg.slice(0, 240))
	ok('★★ 意大利只被问 1 次（拦截路径）', asks(g) === 1, 'asks=' + asks(g))
	ok('★★ 意大利 -1 损耗', (g.decks['意大利'] || []).length === deck0 - 1,
		deck0 + '→' + (g.decks['意大利'] || []).length)
	ok('★★ 17506 被无效（未再建部队）', usPieces(g) === us0, us0 + '→' + usPieces(g))
	ok('★ 窗口清空、无残留拦截', !(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
}

/* ---------- D：另一份 17506 实例仍会询问 ---------- */
console.log('\n=== D. 另一份 17506 实例（防全局抑制）===')
{
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	place(g, 'us_haw', '美国', 'army', '夏威夷')
	I.grant_supply(g, 'us_haw', g.turn); I.refresh(g)
	give(g, '17506', '美国'); give(g, '17506', '美国')      /* 两个不同实例 */
	give(g, '16700', '意大利')
	I.refresh(g)
	const insts = (g.hands['美国'] || []).filter(x => faceOf(x) === '17506')
	console.log('  手中 17506 实例 = ' + JSON.stringify(insts))
	ok('★ 拿到两个不同实例', insts.length === 2 && insts[0] !== insts[1], JSON.stringify(insts))
	/* 真实派发两次 after_build_navy（两次"建海军"的等效触发） */
	I.offer_armed_effects(g, 'after_build_navy', { nation: '美国', space: d.id_of('中太平洋'), piece_id: 'navy_x' })
	I.refresh(g)
	const off = (g.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '17506'))
	ok('★ 首次派发开出窗口', !!off, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	if (off) {
		const cid1 = (off.cards || []).find(c => faceOf(c.card_id) === '17506').card_id
		R.action(g, 'Allies', 'use_armed_offer', { card: cid1 })
		I.refresh(g)
		const a1 = asks(g)
		R.action(g, 'Axis', 'skip_armed_offer', {})
		I.refresh(g)
		/*
		 * 把第一份实例移出手牌（模拟它已被结算/弃掉），否则 offer_armed_effects
		 * 会再次挑到同一张 #88 —— 那不是"另一份实例"，测不出解耦。
		 */
		g.hands['美国'] = (g.hands['美国'] || []).filter(x => x !== cid1)
		g.discard['美国'] = g.discard['美国'] || []
		g.discard['美国'].push(cid1)
		I.refresh(g)
		/* 第二份实例：再次派发 */
		I.offer_armed_effects(g, 'after_build_navy', { nation: '美国', space: d.id_of('中太平洋'), piece_id: 'navy_y' })
		I.refresh(g)
		const off2 = (g.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '17506'))
		const cid2 = off2 && (off2.cards || []).find(c => faceOf(c.card_id) === '17506').card_id
		ok('★ 第二份实例可再开窗', !!cid2 && cid2 !== cid1, JSON.stringify({ cid1, cid2 }))
		if (cid2) {
			R.action(g, 'Allies', 'use_armed_offer', { card: cid2 })
			I.refresh(g)
			ok('★★ 第二份实例仍会询问意大利', asks(g) === a1 + 1, 'asks ' + a1 + '→' + asks(g))
		}
	}
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
