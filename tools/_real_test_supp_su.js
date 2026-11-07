/*
 * SUPP 逐国真实盘面测试 · 苏联（3 张）
 *   17900 八月风暴 / 17901 工业心脏 / 17902 敌后游击队
 *
 * 路线 B（调试布阵 + 真实 action + 三层断言：服务端 state / view / 日志 + 残留检查）
 * 骨架照 docs/test-supp-jp.md 与 tools/_real_test_supp_jp.js。
 *
 * 布阵说明（重要，避免"测出来的 bug 是假的"）：
 *   · 17900 需要"友方攻击<中国东北>"+ 苏联手牌有 17900 与[建设陆军]。
 *     友方攻击者用【英国陆军在<中国西部>】，补给用 I.grant_supply 叠
 *     （等价于卡牌授予"本回合内始终处于补给状态"，属 realboard-test 允许的场景叠加）。
 *     ⚠ 不用美国：开局美国对日本中立（NEUTRAL_RULES），do_battle 会拒绝
 *       "尚未参战（中立）"—— 那是布阵违规，不是 17900 的问题。
 *   · 17900 第二步"以此陆军发起陆战"要求新苏军处于补给状态 ——
 *     这层不造假：先在<西伯利亚><海参崴>铺一条真实补给链（莫斯科→西伯利亚→海参崴→中国东北）；
 *   · 17902 走"中国被发起陆战"分支（中国陆军开局即在<中国东部>，是真实补给源）。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function base(nation = '苏联', phase = 'play') {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null; g.pending_echo = null; g.pending_scoring = null
	g.pending_script = null; g.pending_event_step = null; g.pending_event_targets = null
	g.pending_trigger = null; g._resp_settling = false
	R.action(g, 'Axis', 'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}
const sideOf = nation => (I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis')
const place = (g, piece, nation, type, spaceName) =>
	R.action(g, sideOf(nation), 'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
const give = (g, face, nation) =>
	R.action(g, sideOf(nation), 'debug_add_card', { face, nation, dest: 'hand' })
const cnt = (g, nation, spaceName, type) =>
	I.pieces_on(g, d.id_of(spaceName)).filter(p => g.piece_nation[p] === nation && g.piece_type[p] === type).length
const handOf = (g, nation) => (g.hands[nation] || [])
const instOf = (g, nation, face) => handOf(g, nation).find(x => faceOf(x) === face) || null
const ts = (g, face) => (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === face) || null

/* ============ 1. 17900 八月风暴（EFFECT · 友方攻击中国东北后 · 弃1[建设陆军]）============ */
console.log('=== 1. 17900《八月风暴》[EFFECT · 友方攻击<中国东北>后] ===')
{
	const g = base('英国', 'play')
	/* 日军守<中国东北>；英军在<中国西部>（相邻，grant 补给后可发起）；蒙古放日军作为第二步目标 */
	place(g, 'jp_ne', '日本', 'army', '中国东北')
	place(g, 'jp_mo', '日本', 'army', '蒙古')
	place(g, 'uk_w', '英国', 'army', '中国西部')
	/* 苏联真实补给链：莫斯科(开局)→西伯利亚→海参崴→中国东北 */
	place(g, 'su_sib', '苏联', 'army', '西伯利亚')
	place(g, 'su_vl', '苏联', 'army', '海参崴')
	I.refresh(g)
	I.grant_supply(g, 'uk_w', g.turn)   /* 场景叠加：英国陆军本回合补给（相当于卡牌授予补给） */
	I.refresh(g)
	give(g, '15301', '英国')            /* 英国《发起陆战》 */
	give(g, '17900', '苏联')            /* 苏联增强卡 */
	give(g, '17800', '苏联')            /* 苏联[建设陆军]（代价） */
	I.refresh(g)

	const NE = d.id_of('中国东北')
	const inits = I.battle_initiators(g, '英国', NE, 'land')
	ok('★ ① 布阵合法：英国陆军可对<中国东北>发起陆战',
		(inits || []).length === 1, JSON.stringify(inits))

	const n0 = (g.log || []).length
	const ukCard = instOf(g, '英国', '15301')
	R.action(g, 'Allies', 'play_card', { card: ukCard, space: NE, piece: 'jp_ne' })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  战斗 log = ' + lg0.slice(0, 240))
	ok('★★ ② 友方攻击结算：<中国东北>日军被移除',
		cnt(g, '日本', '中国东北', 'army') === 0, lg0.slice(0, 140))

	/* 增强窗口 + 让权苏联 */
	const win = (g.armed_offers || []).find(w => w.when === 'after_battle' &&
		(w.cards || []).some(c => faceOf(c.card_id) === '17900'))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({
		when: w.when, kind: w.kind, faces: (w.cards || []).map(c => faceOf(c.card_id)),
	}))))
	console.log('  pending_armed_delegate = ' + JSON.stringify(g.pending_armed_delegate && {
		card: faceOf(g.pending_armed_delegate.card_id), space: g.pending_armed_delegate.space,
	}))
	ok('★★ ③ 开出 17900 专用增强窗口', !!win, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★ ④ 让权挂起（由苏联决定是否发动）',
		!!g.pending_armed_delegate && faceOf(g.pending_armed_delegate.card_id) === '17900',
		JSON.stringify(g.pending_armed_delegate))

	const c17900 = instOf(g, '苏联', '17900')
	const c17800 = instOf(g, '苏联', '17800')
	const hand0 = handOf(g, '苏联').length
	const n1 = (g.log || []).length
	/* 第一步：付代价（选 1 张[建设陆军]）→ 在战斗地区征召苏陆军 → 返回 need:'space' */
	R.action(g, 'Allies', 'use_armed_offer', { card: c17900, drop: [c17800] })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  发动 log = ' + lg1.slice(0, 260))
	console.log('  中国东北 = ' + JSON.stringify(I.pieces_on(g, NE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	const pend = (g.armed_offers || []).find(w => w.kind === 'special' && w.pending)
	console.log('  pending = ' + JSON.stringify(pend && { need: pend.pending.need, cands: pend.pending.candidates }))
	ok('★★ ⑤ 在战斗地区征召 1 支苏联陆军',
		cnt(g, '苏联', '中国东北', 'army') === 1, lg1.slice(0, 160))
	const cands = (pend && pend.pending && pend.pending.candidates) || []
	ok('★★ ⑥ 第二步给出"相邻敌占陆地"候选 = <蒙古>',
		cands.length === 1 && Number(cands[0]) === d.id_of('蒙古'), JSON.stringify(cands))

	/* 第二步：选目标 → 用新征召的苏军发起 1 次陆战 */
	const n2 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: c17900, space: d.id_of('蒙古') })
	I.refresh(g)
	const lg2 = logSince(g, n2)
	console.log('  陆战 log = ' + lg2.slice(0, 260))
	ok('★★ ⑦ 以此陆军对<蒙古>发起陆战：日军被移除',
		cnt(g, '日本', '蒙古', 'army') === 0, lg2.slice(0, 160))
	/* 代价在【成功结算时】才付（run 返回 need 时不付），故在这里量：弃 1[建设陆军] + 本卡离手 = -2 */
	ok('★ ⑧ 代价：弃置 1 张[建设陆军]（手牌 -2 含本卡离手、该卡入弃牌堆）',
		handOf(g, '苏联').length === hand0 - 2 &&
		(g.discard['苏联'] || []).indexOf(c17800) >= 0,
		hand0 + '→' + handOf(g, '苏联').length +
		' 弃牌堆含 17800=' + ((g.discard['苏联'] || []).indexOf(c17800) >= 0))
	ok('★ ⑨ 17900 打出后离手进弃牌堆、窗口清空',
		handOf(g, '苏联').indexOf(c17900) < 0 &&
		(g.discard['苏联'] || []).indexOf(c17900) >= 0 &&
		!(g.armed_offers || []).some(w => (w.cards || []).some(c => faceOf(c.card_id) === '17900')),
		JSON.stringify({ hand: handOf(g, '苏联').length, offers: (g.armed_offers || []).length }))
	ok('★ ⑩ 结算后归还行动权（current_nation 回到英国）',
		g.current_nation === '英国' && !g.pending_armed_delegate, String(g.current_nation))

	/* 反例：手牌缺[建设陆军]时不给窗口 */
	const g2 = base('英国', 'play')
	place(g2, 'jp_ne2', '日本', 'army', '中国东北')
	place(g2, 'jp_mo2', '日本', 'army', '蒙古')
	place(g2, 'uk_w2', '英国', 'army', '中国西部')
	I.refresh(g2)
	I.grant_supply(g2, 'uk_w2', g2.turn)
	I.refresh(g2)
	give(g2, '15301', '英国')
	give(g2, '17900', '苏联')
	/* 反例前提：手牌【没有】[建设陆军]（开局随机手牌里本就有，必须显式剥离） */
	g2.hands['苏联'] = handOf(g2, '苏联').filter(x => !(faceOf(x) === '17800'))
	I.refresh(g2)
	const n3 = (g2.log || []).length
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '英国', '15301'), space: d.id_of('中国东北'), piece: 'jp_ne2' })
	I.refresh(g2)
	const lg3 = logSince(g2, n3)
	ok('★ ⑪ 反例：无[建设陆军]时不开 17900 窗口',
		!(g2.armed_offers || []).some(w => (w.cards || []).some(c => faceOf(c.card_id) === '17900')) &&
		!g2.pending_armed_delegate,
		lg3.slice(0, 120))
}

/* ============ 2. 17901 工业心脏（STATUS · <罗斯>标记 + 建设陆军后追加建设）============ */
console.log('\n=== 2. 17901《工业心脏》[STATUS] ===')
{
	const g = base('苏联', 'play')
	give(g, '17901', '苏联')
	I.refresh(g)
	const mk0 = ((g.markers || {})[d.id_of('罗斯')] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', '17901') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 200))
	const mk1 = ((g.markers || {})[d.id_of('罗斯')] || []).length
	console.log('  <罗斯>标记 ' + mk0 + '→' + mk1)
	ok('★ ① 打出状态卡（留桌、占出牌名额）', /工业心脏/.test(lg0), lg0.slice(0, 120))
	ok('★★ ② <罗斯>增加 1 个计分标记', mk1 === mk0 + 1, mk0 + '→' + mk1)

	/* 下一个出牌阶段：在<罗斯>建设陆军（真实 play_card） */
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	I.refresh(g)
	give(g, '17800', '苏联')
	I.refresh(g)
	const army0 = cnt(g, '苏联', '罗斯', 'army')
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', '17800'), space: d.id_of('罗斯') })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  建设 log = ' + lg1.slice(0, 200))
	console.log('  status_instant = ' + JSON.stringify((g.status_instant || []).map(e => faceOf(e.card_id) + '@' + e.window)))
	const t1 = ts(g, '17901')
	console.log('  table_status 17901 = ' + JSON.stringify(t1 && { ready: t1.ready, reason: t1.ready_reason, space: t1.ready_space }))
	ok('★ ③ 在<罗斯>建设陆军成功', cnt(g, '苏联', '罗斯', 'army') === army0 + 1, lg1.slice(0, 120))
	ok('★★ ④ 建设后武装 17901 窗口（ready=true、地区=<罗斯>）',
		!!t1 && t1.ready === true && Number(t1.ready_space) === d.id_of('罗斯'),
		JSON.stringify(t1 && { ready: t1.ready, reason: t1.ready_reason, space: t1.ready_space }))

	/* 发动：在相邻地区建设 1 支苏联陆军 */
	const cardId = (g.table['苏联'] || []).find(x => faceOf(x) === '17901')
	const armyBefore = new Set(Object.keys(g.location)
		.filter(p => g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army'))
	const n2 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: cardId })
	I.refresh(g)
	const lg2 = logSince(g, n2)
	const newArmy = Object.keys(g.location).filter(p =>
		g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army' && !armyBefore.has(p))
	const adjRo = (d.spaces[d.id_of('罗斯')].connections || []).map(Number)
	console.log('  发动 log = ' + lg2.slice(0, 220))
	console.log('  新增苏军 = ' + JSON.stringify(newArmy.map(p => d.name_of(g.location[p]))))
	ok('★★ ⑤ 在<罗斯>相邻地区建设 1 支苏联陆军',
		newArmy.length === 1 && adjRo.indexOf(Number(g.location[newArmy[0]])) >= 0,
		JSON.stringify(newArmy.map(p => d.name_of(g.location[p]))) + ' | ' + lg2.slice(0, 120))
	/* 一回合一次：记账 + 窗口转灰 */
	const t2 = ts(g, '17901')
	ok('★ ⑥ 一回合一次记账（used_this_turn=true、ready=false）',
		!!t2 && t2.used_this_turn === true && t2.ready === false,
		JSON.stringify(t2 && { used: t2.used_this_turn, ready: t2.ready, reason: t2.ready_reason }))

	/* 反例：在<西伯利亚>（非<罗斯>）建设陆军 → 不应点亮 17901 */
	const g2 = base('苏联', 'play')
	give(g2, '17901', '苏联')
	I.refresh(g2)
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '苏联', '17901') })
	I.refresh(g2)
	R.action(g2, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	I.refresh(g2)
	give(g2, '17800', '苏联')
	I.refresh(g2)
	const n3 = (g2.log || []).length
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '苏联', '17800'), space: d.id_of('西伯利亚') })
	I.refresh(g2)
	const lg3 = logSince(g2, n3)
	const t3 = ts(g2, '17901')
	console.log('  非罗斯建设 log = ' + lg3.slice(0, 180))
	console.log('  table_status 17901 = ' + JSON.stringify(t3 && { ready: t3.ready, reason: t3.ready_reason }))
	ok('★★ ⑦ 反例：在<西伯利亚>建设陆军时 17901 不点亮（卡面限 <罗斯>）',
		!!t3 && t3.ready === false,
		JSON.stringify(t3 && { ready: t3.ready, reason: t3.ready_reason }))
}

/* ============ 3. 17902 敌后游击队（RESPONSE · 中国发起/被发起陆战后）============ */
console.log('\n=== 3. 17902《敌后游击队》[RESPONSE] ===')
{
	const g = base('苏联', 'play')
	give(g, '17902', '苏联')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '苏联', '17902') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	const onTable = (g.table_responses || []).some(x => faceOf(x.card_id) === '17902')
	console.log('  暗置 log = ' + lg0.slice(0, 160))
	console.log('  table_responses = ' + JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	ok('★ ① 响应卡可暗置到桌面', onTable, lg0.slice(0, 120))

	/* 日本从<中国东北>攻击<中国东部>的中国陆军 —— "中国被发起陆战" */
	place(g, 'jp_ne', '日本', 'army', '中国东北')
	I.refresh(g)
	I.grant_supply(g, 'jp_ne', g.turn)
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	give(g, '15401', '日本')
	I.refresh(g)
	const cn0 = cnt(g, '中国', '中国东部', 'army')
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '日本', '15401'), space: d.id_of('中国东部'), piece: 'p8' })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  陆战 log = ' + lg1.slice(0, 220))
	console.log('  中国东部 = ' + JSON.stringify(I.pieces_on(g, d.id_of('中国东部')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★ ② 日本对中国陆军发起陆战（中国陆军被移除）', cn0 === 1 && cnt(g, '中国', '中国东部', 'army') === 0, lg1.slice(0, 140))

	const pt = R.view(g, 'Allies').pending_trigger
	const cands = ((pt && pt.candidates) || []).map(c => (c && (c.card_face || c.card_id || c.id)) || c)
	console.log('  pending_trigger = ' + JSON.stringify(cands))
	ok('★★ ③ 开出 17902 响应窗口', cands.map(String).some(x => x.indexOf('17902') >= 0), JSON.stringify(cands))

	if (cands.map(String).some(x => x.indexOf('17902') >= 0)) {
		const id = ((pt.candidates || []).find(c => String(c.card_face || c.card_id || '').indexOf('17902') >= 0) || {}).card_id
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'trigger_response', { card: id })
		I.refresh(g)
		const lg2 = logSince(g, n2)
		console.log('  触发 log = ' + lg2.slice(0, 220))
		console.log('  中国东部 = ' + JSON.stringify(I.pieces_on(g, d.id_of('中国东部')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
		ok('★★ ④ 中国在战斗地区（<中国东部>）征召陆军',
			cnt(g, '中国', '中国东部', 'army') === 1, lg2.slice(0, 160))
		ok('★ ⑤ 响应卡结算后离桌（进弃牌堆）',
			!(g.table_responses || []).some(x => faceOf(x.card_id) === '17902'),
			JSON.stringify((g.table_responses || []).map(x => faceOf(x.card_id))))
	}

	/* 反例：陆战不涉及中国（日本打苏联）→ 不开窗 */
	const g2 = base('苏联', 'play')
	give(g2, '17902', '苏联')
	I.refresh(g2)
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '苏联', '17902') })
	I.refresh(g2)
	place(g2, 'jp_ne2', '日本', 'army', '中国东北')
	place(g2, 'su_sib2', '苏联', 'army', '西伯利亚')
	I.refresh(g2)
	I.grant_supply(g2, 'jp_ne2', g2.turn)
	I.refresh(g2)
	R.action(g2, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g2)
	give(g2, '15401', '日本')
	I.refresh(g2)
	/* <中国东北>(21) 与 <西伯利亚>(18) 不相邻 → 用蒙古中转不合适；直接打海参崴方向的苏军 */
	place(g2, 'su_mo', '苏联', 'army', '蒙古')
	I.refresh(g2)
	const n3 = (g2.log || []).length
	R.action(g2, 'Axis', 'play_card', { card: instOf(g2, '日本', '15401'), space: d.id_of('蒙古'), piece: 'su_mo' })
	I.refresh(g2)
	const lg3 = logSince(g2, n3)
	const pt2 = R.view(g2, 'Allies').pending_trigger
	const c2 = ((pt2 && pt2.candidates) || []).map(x => String(x.card_face || x.card_id || ''))
	console.log('  非中国陆战 log = ' + lg3.slice(0, 180))
	console.log('  候选 = ' + JSON.stringify(c2))
	ok('★★ ⑥ 反例：陆战不涉及中国时不开窗', !c2.some(x => x.indexOf('17902') >= 0), JSON.stringify(c2))
}

/* ============ 残留检查 ============ */
console.log('\n=== 4. 残留检查 ===')
{
	const g = base('苏联', 'play')
	ok('★ 干净盘面：无挂起窗口', !(g.armed_offers || []).length && !g.pending_armed_delegate &&
		!(g.response_stack || []).length && !g.pending_battle, JSON.stringify({
			offers: (g.armed_offers || []).length, resp: (g.response_stack || []).length,
		}))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
