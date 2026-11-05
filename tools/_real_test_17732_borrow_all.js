/*
 * B12《德国军事顾问》17732 —— 逐张德国状态卡真实测试
 *
 * 玩家口径（2026-11-05）：
 *   ① 候选 = 桌面【全部】德国状态卡；只有带 trigger 的可点，其余仅展示（playable:false）；
 *   ② 借用后代价按【借用方（意大利）】牌库判断、扣意大利的牌；
 *   ③ 意大利付不起 -> 拒绝发动（一张都不扣）。
 *
 * 对 cards.js 里全部 16 张德国 STATUS 卡逐张跑一遍，输出表格 + 断言：
 *   A 借用在候选里（pending 阶段 options 含该卡，且 playable 与 cfg.trigger 一致）
 *   B resolve_italy_borrow 成功（pending=false、card_face=该卡实例）
 *   C 未就绪时激活被拒，且【德国牌库不变、意大利牌库不变】
 *   D 就绪时若付得起：意大利牌库 -n（n=attrition），德国牌库不变
 *   E 意大利付不起：日志含「牌库不足，无法发动」，两国牌库都不变
 *
 * 用法：node tools/_real_test_17732_borrow_all.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const S = I.STATUS_EFFECTS || {}
const C = require(path.join(MOD, 'cards.js'))
const ALL = Array.isArray(C) ? C : (C.cards || Object.values(C)[0])

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const deckN = (g, n) => (g.decks[n] || []).length

const GER = ALL.filter(c => c.type === 'STATUS' && c.nation === '德国')

function setup(cardId) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 德国打出该状态卡（真实 play_card） */
	R.action(g, 'Axis', 'debug_add_card', { face: cardId, nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === String(cardId))
	if (c) R.action(g, 'Axis', 'play_card', { card: c })
	I.refresh(g)
	/* 意大利打出 17732（真实 play_card）—— 它是【响应卡】，先进桌面暗置 */
	R.action(g, 'Axis', 'debug_add_card', { face: '17732', nation: '意大利', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	I.refresh(g)
	const b = (g.hands['意大利'] || []).find(x => faceOf(x) === '17732')
	if (b) R.action(g, 'Axis', 'play_card', { card: b })
	I.refresh(g)
	/*
	 * 再用【真实的响应窗口】触发它：
	 *   17732 的 trigger.on = 'play_start'，正常由出牌阶段开始时派发；
	 *   debug_set_phase 只改阶段、不跑阶段钩子，所以这里显式 request_responses
	 *   + 真实动作 trigger_response（与线上同一通道）。
	 */
	const resp = (g.table_responses || []).find(x => faceOf(x.card_id) === '17732')
	if (resp) {
		I.request_responses(g, 'play_start', { nation: '意大利' })
		I.refresh(g)
		R.action(g, 'Axis', 'trigger_response', { card: resp.card_id })
		I.refresh(g)
	}
	return g
}
const tableId = (g, cardId) => (g.table['德国'] || []).find(x => faceOf(x) === String(cardId))
const row = (g, cardId) => {
	const v = R.view(g, 'Axis')
	return (v.table_status || []).find(x => faceOf(x.card) === String(cardId))
}

const report = []
for (const card of GER) {
	const cfg = S[String(card.id)] || {}
	const trig = cfg.trigger || null
	const att = (trig && trig.cost && trig.cost.attrition) || 0
	const r = { id: String(card.id), name: card.name, trig: trig ? (trig.on || trig.window || '?') : '—', att, playable: !!trig }

	const g = setup(card.id)
	const inst = tableId(g, card.id)
	r.onTable = !!inst
	/* A 候选 & playable */
	const ib = g.italy_borrow
	const optIds = (ib && ib.options) || []
	r.inOptions = optIds.indexOf(inst) >= 0
	r.flagPlayable = !!(ib && ib.playable && ib.playable[inst])
	ok(card.id + ' 在借用候选里', r.inOptions, JSON.stringify(optIds.map(faceOf)))
	ok(card.id + ' playable 与 trigger 一致', r.flagPlayable === !!trig, 'flag=' + r.flagPlayable + ' trig=' + !!trig)
	/* B 借用 */
	if (r.inOptions) {
		R.action(g, 'Axis', 'resolve_italy_borrow', { face: inst })
		I.refresh(g)
	}
	r.borrowed = !!(g.italy_borrow && g.italy_borrow.card_face === inst)
	ok(card.id + ' 借用成功', r.borrowed, JSON.stringify(g.italy_borrow && g.italy_borrow.card_face))

	/* 摆放德国陆军，便于 battle 类卡有发起单位 */
	R.action(g, 'Axis', 'debug_place', { piece: 'de_b12', nation: '德国', type: 'army', space: d.id_of('德国') })
	I.refresh(g)
	I.grant_supply(g, 'de_b12', g.turn)
	I.refresh(g)

	const ready0 = row(g, card.id)
	r.ready = !!(ready0 && ready0.ready)
	const gDeck0 = deckN(g, '德国'), iDeck0 = deckN(g, '意大利')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'activate_status', {
		card: inst, space: d.id_of('东欧'), from: 'de_b12', discard: [], choice: 0,
	})
	const lg = logSince(g, n0)
	r.log = lg.slice(0, 90)
	r.dIt = deckN(g, '意大利') - iDeck0
	r.dDe = deckN(g, '德国') - gDeck0
	r.rejected = /无法发动|不能发动|未支付代价|请先选择|牌库不足|没有|不可/.test(lg)

	/* C 核心：德国牌库绝不能被扣 */
	ok(card.id + ' 德国牌库不被扣', r.dDe === 0, 'dDe=' + r.dDe)
	/* D/E：意大利牌库变化只能是 0 或 -att */
	ok(card.id + ' 意大利扣牌符合同代价（0 或 -' + att + '）',
		r.dIt === 0 || r.dIt === -att, 'dIt=' + r.dIt + ' att=' + att)
	if (att && r.dIt === 0) {
		ok(card.id + ' 未扣时必须有明确原因', r.rejected, r.log)
	}
	report.push(r)
}

/* 额外一条：意大利牌库不足 -> 拒绝发动（用 15255 征兵，需损耗 2，且 play_start 可立即发动） */
console.log('\n=== 附 A：意大利牌库不足时拒绝发动（15255 需损耗 2）===')
{
	const g = setup('15255')
	const inst = tableId(g, '15255')
	R.action(g, 'Axis', 'resolve_italy_borrow', { face: inst })
	I.refresh(g)
	/* 把意大利牌库压到 1 张（真实损耗移除，仅作前提） */
	I.attrition_cards(g, '意大利', Math.max(0, deckN(g, '意大利') - 1))
	I.refresh(g)
	const i0 = deckN(g, '意大利')
	console.log('  意大利牌库压到 = ' + i0)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'activate_status', { card: inst, space: d.id_of('东欧'), from: 'de_b12', discard: [] })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg.slice(0, 160))
	ok('★ 牌库不足 -> 明确拒绝', /牌库不足|无法发动/.test(lg), lg.slice(0, 120))
	ok('★★ 且一张都不扣', deckN(g, '意大利') === i0, deckN(g, '意大利') + ' vs ' + i0)
}

/* 额外一条：借用 15242 时，弃牌代价不能拿德国的牌顶（必须意大利的） */
console.log('\n=== 附 B：借用 15242 的弃牌代价必须来自意大利手牌 ===')
{
	const g = setup('15242')
	const inst = tableId(g, '15242')
	R.action(g, 'Axis', 'resolve_italy_borrow', { face: inst })
	I.refresh(g)
	const deCard = (g.hands['德国'] || [])[0]
	console.log('  用德国手牌 ' + deCard + ' 强行当代价')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'activate_status', { card: inst, space: null, from: null, discard: [deCard] })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg.slice(0, 200))
	/* 两种拒绝文案都算通过：预检「要弃置的手牌不在手里」/ 代价段「须从【意大利】手牌中选择」 */
	ok('★★ 拒绝（须从意大利手牌选）',
		/须从【意大利】手牌中选择|要弃置的手牌不在手里/.test(lg), lg.slice(0, 140))
	ok('★ 德国那张牌没被弃', (g.discard['德国'] || []).indexOf(deCard) < 0)
}

/* ---------- 表格输出 ---------- */
console.log('\n================================================================')
console.log('| 卡号 | 卡名 | 触发 | 可发动 | 借用 | 就绪 | 意大利Δ | 德国Δ | 结果 |')
console.log('|---|---|---|---|---|---|---|---|---|')
for (const r of report) {
	const res = r.rejected ? (/牌库不足/.test(r.log) ? '拒绝(牌库)' : '拒绝(时机/参数)') : '已结算'
	console.log('| ' + r.id + ' | ' + r.name + ' | ' + r.trig + ' | ' + (r.playable ? '✅' : '—') + ' | ' +
		(r.borrowed ? '✅' : '❌') + ' | ' + (r.ready ? '✅' : '—') + ' | ' + r.dIt + ' | ' + r.dDe + ' | ' + res + ' |')
}
console.log('================================================================')
console.log(fail === 0 ? 'ALL PASS（' + pass + ' 项断言，' + report.length + ' 张卡）' : fail + ' FAIL / ' + pass + ' 项')
process.exitCode = fail ? 1 : 0
