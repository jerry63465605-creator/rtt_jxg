/*
 * B10 只读探针：苏联陆军【带空军】被【带空军】的德国陆军攻击时，
 * 17811《雅科夫列夫设计局》的窗口出现在什么时候？能否在"陆军被消灭之前"生效？
 *
 * 卡面：苏联空军被移除后：在该地区或相邻地区部署/调度1支苏联空军。
 * 玩家口径：应在【消灭陆军之前】给出时点（先打设计局 → 放空军 → 再免死/继续）。
 *
 * 用法：node tools/_probe_b10_design_bureau.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n)
const brief = g => ({
	东欧: I.pieces_on(g, d.id_of('东欧')).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')'),
	last_removed: g.last_piece_removed && {
		piece: g.last_piece_removed.piece, nation: g.last_piece_removed.nation,
		type: g.last_piece_removed.type, space: d.name_of(g.last_piece_removed.space),
	},
	offers: (g.armed_offers || []).map(w => w.when + '×' + (w.cards || []).map(c => faceOf(c.card_id)).join('/') +
		(w.pending ? '(pending:' + w.pending.need + ')' : '')),
	instant: (g.status_instant || []).map(e => faceOf(e.card_id) + '@' + e.window),
	pending_battle: g.pending_battle && { stage: g.pending_battle.stage, victim: g.pending_battle.victim, airs: g.pending_battle.airs },
})

function setup(with17811 = true) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	if (with17811) R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	const suSp = d.id_of('东欧'), deSp = d.id_of('德国')
	R.action(g, 'Allies', 'debug_place', { piece: 'su_army', nation: '苏联', type: 'army', space: suSp })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: suSp })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_army', nation: '德国', type: 'army', space: deSp })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: deSp })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	for (const p of ['su_army', 'su_air', 'de_army', 'de_air']) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	return { g, suSp, deSp }
}

console.log('########## A：防守方【用空军代受】（su_air 替 su_army 去死）##########')
{
	const { g, suSp } = setup(true)
	console.log('  开局: ' + JSON.stringify(brief(g)))
	const n0 = (g.log || []).length
	const r = I.do_battle(g, '德国', suSp, 'su_army', 'land', { from: 'de_army', defend_air: 'su_air' })
	console.log('  do_battle(opt.defend_air) = ' + JSON.stringify(r && { ok: r.ok, desc: r.desc, reason: r.reason }))
	for (const l of logSince(g, n0)) console.log('   log: ' + l)
	console.log('   ' + JSON.stringify(brief(g)))
	/* 攻击方决定是否用相邻空军抵消这次代受 —— 选"不抵消"，代受的苏联空军才会真的死 */
	const nC = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { declined_counter: true })
	console.log('\n  攻击方"不抵消" → ' + logSince(g, nC).join(' | ').slice(0, 260))
	console.log('   ' + JSON.stringify(brief(g)))
	const has = (g.armed_offers || []).some(w => (w.cards || []).some(c => faceOf(c.card_id) === '17811'))
	console.log('  ★ 17811 窗口 = ' + has + '   陆军还在 = ' + (g.location['su_army'] != null) +
		'   空军还在 = ' + (g.location['su_air'] != null))
	if (has) {
		const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '17811'))
		const card = (w.cards || []).find(c => faceOf(c.card_id) === '17811').card_id
		console.log('   ctx = ' + JSON.stringify(w.ctx && { piece: w.ctx.piece, type: w.ctx.piece_type, space: d.name_of(w.ctx.space) }))
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card })
		console.log('   点设计局 → ' + logSince(g, n1).join(' | ').slice(0, 180))
		const w2 = (g.armed_offers || []).find(x => x.pending && x.pending.need === 'space')
		if (w2) {
			const cands = (w2.pending.candidates || []).map(c => (c && c.id) || c)
			console.log('   候选 = ' + JSON.stringify(cands.map(s => d.name_of(Number(s)))))
			const n2 = (g.log || []).length
			R.action(g, 'Allies', 'use_armed_offer', { card, space: cands[0] })
			console.log('   选第一个 → ' + logSince(g, n2).join(' | ').slice(0, 200))
			console.log('   ' + JSON.stringify(brief(g)))
		}
	}
}

console.log('\n########## B（对照）：不代受 → 陆军死 + 空军"无处撤离"连带死 ##########')
{
	const { g, suSp } = setup(true)
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', suSp, 'su_army', 'land', { from: 'de_army', declined_defend_air: true })
	for (const l of logSince(g, n0)) console.log('   log: ' + l)
	console.log('   ' + JSON.stringify(brief(g)))
	const has = (g.armed_offers || []).some(w => (w.cards || []).some(c => faceOf(c.card_id) === '17811'))
	console.log('  ★ 17811 窗口 = ' + has + '（空军确实被移除了，理论上应该开窗）')
}

console.log('\n########## C（对照）：手里没有 17811 → 确认不是"误开窗" ##########')
{
	const { g, suSp } = setup(false)
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', suSp, 'su_army', 'land', { from: 'de_army', defend_air: 'su_air' })
	for (const l of logSince(g, n0)) console.log('   log: ' + l)
	console.log('   ' + JSON.stringify(brief(g)))
}
