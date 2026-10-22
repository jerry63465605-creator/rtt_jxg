/*
 * 回归：两处"替玩家决定弃牌"的收口（2026-10-23 玩家裁定）
 *
 *  ① 武装增强卡的弃牌代价（use_armed_offer）
 *     原实现：玩家不选时退回 `pool.slice(0, discNeed)`，自动弃手牌最前面 N 张。
 *     现口径：照 17837 KV-2 —— 只认玩家指定的 drop，不足则拒绝并【保留窗口】。
 *     客户端已有自选 UI（pending_echo_discard.armed -> use_armed_offer{card, drop}）。
 *
 *  ③ 17553《抗日义勇军》让权日本弃牌
 *     原实现：japan 手牌为 0 时直接 return（既不挂起也不损耗）→ 卡的"损耗1张"被吞；
 *             有手牌但不传 card 时静默跳过弃牌（漏收代价）。
 *     现口径（玩家）：有手牌必须弃；没牌可弃时跳过弃手牌，只损耗。
 *
 * 用法：node tools/_smoke_discard_cost_selfpick.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { CARD_BY_ID } = require(path.join(MOD, 'cards.js'))

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const faceOf = id => CARD_BY_ID[String(id).split('#')[0]]
const typeOf = id => (faceOf(id) || {}).type

const JP = I.data.id_of('日本')
const EAST_SEA = I.data.id_of('东海')

/* 从牌堆里挑 n 张满足 pred 的牌，其余留在牌堆 */
function take(g, nation, pred, n) {
	const out = [], rest = []
	for (const id of (g.decks[nation] || [])) {
		if (out.length < n && pred(id)) out.push(id)
		else rest.push(id)
	}
	g.decks[nation] = rest
	return out
}

console.log('=== A/B. 15405 武装卡：弃牌代价必须玩家指定（不再自动挑前 N 张） ===')
{
	const g = rules.setup(701, rules.default_scenario, {})
	g.opening = null
	for (const p in g.location) delete g.location[p]
	/* 日本本土一支陆军 -> 相邻海域<东海>可以建海军（15405 的 ready 需要） */
	g.location['jp1'] = JP
	g.piece_nation['jp1'] = '日本'
	g.piece_type['jp1'] = 'army'

	const resp = take(g, '日本', id => typeOf(id) === 'RESPONSE', 2)
	ok('前置：造出 2 张响应牌', resp.length === 2, JSON.stringify(resp))
	g.hands['日本'] = ['15405#1'].concat(resp)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.log.length = 0

	I.offer_armed_effects(g, 'after_build_navy', { nation: '日本', space: EAST_SEA })
	const hasWin = (gg) => (gg.armed_offers || []).some(o => (o.cards || []).some(x => x.card_id === '15405#1'))
	ok('前置：武装窗口已建立', hasWin(g))

	const handBefore = g.hands['日本'].slice()

	/* A. 不带 drop */
	const g1 = rules.action(g, 'Axis', 'use_armed_offer', { card: '15405#1' })
	ok('A 不传 drop -> 拒绝（15405 仍在手牌）', g1.hands['日本'].indexOf('15405#1') >= 0)
	ok('A 一张手牌都没弃', g1.hands['日本'].length === handBefore.length, g1.hands['日本'].length)
	ok('A 日志提示需先选弃牌代价', /需先选择弃置 1 张手牌作为代价/.test((g1.log || []).join('\n')),
		(g1.log || []).slice(-1)[0])
	ok('A 卡牌效果未落地（<东海>没建出海军）',
		I.count_pieces(g1, { space: EAST_SEA, nation: '日本', types: ['navy'] }) === 0,
		I.count_pieces(g1, { space: EAST_SEA, nation: '日本', types: ['navy'] }))
	ok('A 窗口仍在（可重选）', hasWin(g1))

	/* B. 指定第 2 张响应牌（故意不是第一张） */
	const pick = resp[1]
	const g2 = rules.action(g1, 'Axis', 'use_armed_offer', { card: '15405#1', drop: [pick] })
	ok('B 所选响应牌已进弃牌堆', (g2.discard['日本'] || []).indexOf(pick) >= 0)
	ok('B 未选的响应牌仍在手牌', g2.hands['日本'].indexOf(resp[0]) >= 0)
	ok('B 15405 已进弃牌堆（卡被消耗）', (g2.discard['日本'] || []).indexOf('15405#1') >= 0)
	ok('B <东海>已建日本海军', I.count_pieces(g2, { space: EAST_SEA, nation: '日本', types: ['navy'] }) === 1,
		I.count_pieces(g2, { space: EAST_SEA, nation: '日本', types: ['navy'] }))
}

console.log('\n=== C/D. 17553 抗日义勇军：有手牌必须弃 ===')
function jp17553(handCount) {
	const g = rules.setup(801, rules.default_scenario, {})
	g.opening = null
	g.table['美国'] = ['17553#1']
	const pool = take(g, '日本', () => true, Math.max(handCount, 1))
	g.hands['日本'] = pool.slice(0, handCount)
	g.current_nation = '中国'
	g.active = 'Allies'
	g.log.length = 0
	return g
}
{
	const g = jp17553(2)
	I.offer_us_japan_delegate(g, '中国建设')
	ok('前置：挂起已建立', !!g.us_japan_delegate)
	ok('前置：操作权已切到日本', g.current_nation === '日本', g.current_nation)

	const handBefore = g.hands['日本'].slice()
	I.resolve_us_japan_delegate(g, {})
	ok('C 不传 card -> 拒绝（挂起仍在）', !!g.us_japan_delegate)
	ok('C 手牌未变', g.hands['日本'].length === handBefore.length, g.hands['日本'].length)
	ok('C 日志要求先选牌', /必须先选择要弃置的 1 张手牌/.test((g.log || []).join('\n')),
		(g.log || []).slice(-1)[0])

	const pick = handBefore[1]
	const deckBefore = (g.decks['日本'] || []).length
	I.resolve_us_japan_delegate(g, { card: pick })
	ok('D 挂起已清', !g.us_japan_delegate)
	ok('D 所选那张已进弃牌堆', (g.discard['日本'] || []).indexOf(pick) >= 0)
	ok('D 未选的那张仍在手牌', g.hands['日本'].indexOf(handBefore[0]) >= 0)
	ok('D 损耗 1 张（牌库 -1）', (g.decks['日本'] || []).length === deckBefore - 1,
		deckBefore + ' -> ' + (g.decks['日本'] || []).length)
	ok('D 操作权已归还', g.current_nation !== '日本', g.current_nation)
}

console.log('\n=== E. 17553：日本无手牌 -> 跳过弃牌，只损耗 ===')
{
	const g = jp17553(0)
	ok('前置：日本手牌为 0', (g.hands['日本'] || []).length === 0)
	const deckBefore = (g.decks['日本'] || []).length
	const discBefore = (g.discard['日本'] || []).length

	I.offer_us_japan_delegate(g, '中国建设')
	ok('E 不挂起（无需日本玩家操作）', !g.us_japan_delegate)
	ok('E 操作权未切走', g.current_nation === '中国', g.current_nation)
	ok('E 仍损耗 1 张（牌库 -1）', (g.decks['日本'] || []).length === deckBefore - 1,
		deckBefore + ' -> ' + (g.decks['日本'] || []).length)
	ok('E 弃牌堆 +1', (g.discard['日本'] || []).length === discBefore + 1)
	ok('E 日志写明"仅损耗"', /跳过弃牌，仅损耗/.test((g.log || []).join('\n')), (g.log || []).slice(-1)[0])
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
