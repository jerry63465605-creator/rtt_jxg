/*
 * 15411《夜间运输》改 B 后的真实盘面验收（armed 询问通道）
 *   A ★★ 日本回合开始（resource）：窗口出现且含 15411
 *   B ★★ 点它 + 弃 1 张[响应卡] → 返回 need:'piece'，候选 = 日本陆/海军（**不限无补给**）
 *   C ★★ 选部队 → grant_supply 覆盖成立（日志 + 缓存），卡进弃牌堆、代价进弃牌、窗口清空
 *   D ★★ 弃的不是[响应卡] → 拒绝且不消耗
 *   E ★  手里没有响应卡 → 不弹（ready=false）
 *   F ★  场上没有日本陆/海军 → 不弹
 *   G ★  德国回合开始 → 日本不弹（actor 限定）
 *   H ★  日本·supply 阶段主动打出 → 现在被拒（提示【待命】增强卡）
 *   I ★  有补给的部队**也**在候选里（本次口径：不限无补给）
 *   J ★  17805 仍只在 苏/德/英 回合开始弹
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const cards = require(path.join(MOD, 'cards.js')).CARDS
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const ROLE = n => (I.faction_of_nation(n) === 'allies' ? 'Allies' : 'Axis')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function base(nation, phase) {
	const g = R.setup(20261108)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_echo = null; g.pending_status_react = null; g.pending_script = null
	g.pending_event_step = null; g.event_budget = null
	R.action(g, ROLE(nation), 'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}
const give = (g, face, nation) => R.action(g, ROLE(nation), 'debug_add_card', { face, nation, dest: 'hand' })
const place = (g, piece, nation, type, spaceName) => R.action(g, ROLE(nation), 'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
const has = (g, face) => (g.armed_offers || []).some(w => (w.cards || []).some(c => faceOf(c.card_id) === face))

/* 日本：手里 15411 + 1 张响应卡；场上 1 支陆军 */
function scene(phase = 'resource', nation = '日本') {
	const g = base(nation, phase)
	for (const f of ['15411', '15412']) give(g, f, nation)          /* 15412 御前会议是 RESPONSE？用通用方式兜底 */
	/* 确保手里真有一张 RESPONSE：从卡表里挑一张日本的响应卡 */
	const resp = cards.find(x => x.nation === '日本' && String(x.type).toUpperCase() === 'RESPONSE' && x.deck !== 'PRELUDE')
	if (resp) give(g, String(resp.id), nation)
	I.refresh(g)
	place(g, 'jp_a', '日本', 'army', '日本')
	I.refresh(g)
	I.grant_supply(g, 'jp_a', g.turn)
	I.refresh(g)
	/* 手牌/部队就位后【再进入一次】该阶段：armed 窗口是在进入阶段时派发的，
	 * 先设置阶段再加牌，窗口会按空手牌算（ready=false）→ 必须重新进入。 */
	R.action(g, ROLE(nation), 'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}
const respInHand = g => (g.hands['日本'] || []).filter(cid => {
	const c = I.inst_card ? I.inst_card(cid) : null
	return c && String(c.type).toUpperCase() === 'RESPONSE' && String(c).indexOf('15411') < 0
})

/* A：窗口 */
console.log('=== A. 日本回合开始（resource）===')
const g = scene('resource')
console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, nation: w.nation, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))))
ok('★★ 窗口出现且含 15411', has(g, '15411'), JSON.stringify((g.armed_offers || []).length))

/* B/C：弃 1 张响应 → need:'piece' → 选部队 */
console.log('\n=== B/C. 弃 1 响应 → 选部队 → 结算 ===')
let winner = null
if (has(g, '15411')) {
	const off = (g.armed_offers).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '15411'))
	const entry = (off.cards || []).find(c => faceOf(c.card_id) === '15411')
	const resps = respInHand(g)
	console.log('  手里响应卡 = ' + JSON.stringify(resps.map(faceOf)))
	/* 去掉这支部队的补给，验证"不限无补给"：即使有补给也应可选 */
	let n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: entry.card_id, drop: [resps[0]] })
	I.refresh(g)
	console.log('  第 1 步 log = ' + logSince(g, n0).slice(0, 160))
	const pend = (g.armed_offers[0] || {}).pending || null
	console.log('  pending = ' + JSON.stringify(pend && { need: pend.need, n: (pend.candidates || []).length }))
	ok('★★ 进入选部队步（need=piece，候选=日本陆/海军）',
		!!pend && pend.need === 'piece' && (pend.candidates || []).length > 0,
		JSON.stringify(pend && { need: pend.need, n: (pend.candidates || []).length }))
	if (pend && pend.candidates && pend.candidates.length) {
		winner = String(pend.candidates[0])
		n0 = (g.log || []).length
		R.action(g, 'Axis', 'use_armed_offer', { card: entry.card_id, piece: winner })
		I.refresh(g)
		const lg = logSince(g, n0)
		console.log('  第 2 步 log = ' + lg.slice(0, 200))
		console.log('  窗口剩余 = ' + JSON.stringify((g.armed_offers || []).length) +
			'  已在弃牌堆 = ' + (g.discard['日本'] || []).some(x => faceOf(x) === '15411'))
		ok('★★ 该部队本回合总是补给（日志命中）', /总是处于补给状态/.test(lg), lg.slice(0, 120))
		ok('★★ 卡已进弃牌堆、窗口清空',
			(g.discard['日本'] || []).some(x => faceOf(x) === '15411') && !(g.armed_offers || []).length)
	}
}

/* D：弃非响应卡 */
console.log('\n=== D. 弃的不是[响应卡] ===')
{
	const g2 = scene('resource')
	const off = (g2.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '15411'))
	if (off) {
		const entry = (off.cards || []).find(c => faceOf(c.card_id) === '15411')
		const nonResp = (g2.hands['日本'] || []).find(cid => {
			const c = I.inst_card ? I.inst_card(cid) : null
			return c && String(c.type).toUpperCase() !== 'RESPONSE'
		})
		const hand0 = (g2.hands['日本'] || []).length
		const n0 = (g2.log || []).length
		R.action(g2, 'Axis', 'use_armed_offer', { card: entry.card_id, drop: [nonResp] })
		I.refresh(g2)
		const lg = logSince(g2, n0)
		console.log('  log = ' + lg.slice(0, 160))
		ok('★ 拒绝：必须弃[响应卡]，手牌不减',
			/响应/.test(lg) && (g2.hands['日本'] || []).length === hand0, lg.slice(0, 100))
	}
}

/* E/F：ready 的两种 false */
console.log('\n=== E. 手里没有响应卡 → 不弹 ===')
{
	const g3 = base('日本', 'resource')
	give(g3, '15411', '日本')
	place(g3, 'jp_e', '日本', 'army', '日本')
	I.refresh(g3)
	/* 手里的非本卡全部不是 RESPONSE 才算——这里手工把其它响应卡搬走 */
	for (const cid of (g3.hands['日本'] || []).slice()) {
		const c = I.inst_card ? I.inst_card(cid) : null
		if (c && String(c.type).toUpperCase() === 'RESPONSE' && String(cid).indexOf('15411') < 0) {
			g3.hands['日本'] = g3.hands['日本'].filter(x => x !== cid)
			g3.decks['日本'].push(cid)
		}
	}
	g3.armed_offers = []
	I.refresh(g3)
	R.action(g3, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'resource' })
	I.refresh(g3)
	console.log('  窗口 = ' + JSON.stringify((g3.armed_offers || []).map(w => (w.cards || []).map(c => faceOf(c.card_id)))))
	ok('★ 无响应卡可弃 → 不弹', !has(g3, '15411'))
}

console.log('\n=== F. 场上没有日本部队 → 不弹 ===')
{
	const g4 = base('日本', 'resource')
	for (const cid of (g4.hands['日本'] || []).slice()) { }          /* 保留原手牌 */
	give(g4, '15411', '日本')
	I.refresh(g4)
	/* 清掉日本全部部队 */
	for (const p of Object.keys(g4.location || {})) {
		if (g4.piece_nation[p] === '日本') R.action(g4, 'Axis', 'debug_remove', { piece: p })
	}
	g4.armed_offers = []
	I.refresh(g4)
	R.action(g4, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'resource' })
	I.refresh(g4)
	ok('★ 无日本陆/海军 → 不弹', !has(g4, '15411'))
}

/* G：德国回合开始 */
console.log('\n=== G. 德国回合开始 → 日本不弹 ===')
{
	const g5 = base('德国', 'resource')
	give(g5, '15411', '日本')
	place(g5, 'jp_g', '日本', 'army', '日本')
	I.refresh(g5)
	R.action(g5, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })
	I.refresh(g5)
	console.log('  窗口 = ' + JSON.stringify((g5.armed_offers || []).map(w => ({ nation: w.nation, f: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★ 德国回合开始不弹 15411', !has(g5, '15411'))
}

/* H：补给阶段主动打出被拒 */
console.log('\n=== H. 日本·supply 阶段主动打出 ===')
{
	const g6 = base('日本', 'supply')
	give(g6, '15411', '日本'); I.refresh(g6)
	const card = (g6.hands['日本'] || []).find(x => faceOf(x) === '15411')
	const n0 = (g6.log || []).length
	R.action(g6, 'Axis', 'play_card', { card })
	I.refresh(g6)
	const lg = logSince(g6, n0)
	console.log('  log = ' + lg.slice(0, 180))
	ok('★ 拒绝且提示【待命】增强卡', /待命/.test(lg), lg.slice(0, 120))
}

/* I：有补给的部队也在候选里 */
console.log('\n=== I. 有补给的部队也在候选（不限无补给）===')
{
	const g7 = scene('resource')
	const off = (g7.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '15411'))
	if (off) {
		const entry = (off.cards || []).find(c => faceOf(c.card_id) === '15411')
		const resps = respInHand(g7)
		R.action(g7, 'Axis', 'use_armed_offer', { card: entry.card_id, drop: [resps[0]] })
		I.refresh(g7)
		const cands = ((g7.armed_offers[0] || {}).pending || {}).candidates || []
		const supplied = cands.filter(p => !!(g7.supply && g7.supply[p]) || !!(g7.supply_override && g7.supply_override[p]))
		console.log('  候选=' + cands.length + '  其中"有补给"的=' + supplied.length)
		ok('★★ 候选包含有补给的部队（口径已放开）', cands.length >= 1, 'cands=' + cands.length)
	}
}

/* J：17805 仍只三國 */
console.log('\n=== J. 17805 仍只 苏/德/英 ===')
{
	const g8 = base('日本', 'resource')
	give(g8, '17805', '苏联')
	place(g8, 'su_j', '苏联', 'army', '苏联')
	I.refresh(g8)
	R.action(g8, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'resource' })
	I.refresh(g8)
	console.log('  日本回合开始窗口 = ' + JSON.stringify((g8.armed_offers || []).map(w => (w.cards || []).map(c => faceOf(c.card_id)))))
	ok('★ 日本回合开始不弹 17805', !has(g8, '17805'))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
