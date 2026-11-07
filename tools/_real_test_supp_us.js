/*
 * SUPP 逐国真实盘面测试 · 美国（12 张）
 *   16300 火炬行动 / 16301 太平洋舰队 / 16302 诺曼底登陆 / 16303 中途岛海战 / 16304 中国远征军
 *   16800 艾森豪威尔 / 16801 哈尔西 / 16802 麦克阿瑟 / 16803 尼米兹
 *   16804 花园口决堤 / 16805 B-25 米切尔 / 16806 大规模部署
 *
 * 路线 B（调试布阵 + 真实 action + 三层断言 + 残留检查）。
 *
 * ⚠ 两处【场景叠加】，均等价于真实对局里已发生的事实，不掩盖任何判定：
 *   · `g.neutral['美国'] = false` —— 美国已结束中立（否则不能对轴心发起战斗/在禁地建设）；
 *   · `I.grant_supply(...)` —— 某支部队本回合处于补给状态（卡牌授予补给同款）。
 *   补给链能真铺的地方一律真铺（例：美国本土→东太平洋→夏威夷）。
 *
 * ⚠ 16302《诺曼底登陆》在合成盘面上【两步前置都不可满足】（美国需先在欧洲有立足点），
 *   故只断言"优雅失败、不死锁、卡正常收尾"，见 docs/test-supp-us.md §3。
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

const sideOf = nation => (I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis')
const place = (g, piece, nation, type, spaceName) =>
	R.action(g, sideOf(nation), 'debug_place', { piece, nation, type, space: d.id_of(spaceName) })
const give = (g, face, nation) =>
	R.action(g, sideOf(nation), 'debug_add_card', { face, nation, dest: 'hand' })
const cnt = (g, nation, spaceName, type) =>
	I.pieces_on(g, d.id_of(spaceName)).filter(p => g.piece_nation[p] === nation && g.piece_type[p] === type).length
const handOf = (g, nation) => (g.hands[nation] || [])
const instOf = (g, nation, face) => handOf(g, nation).find(x => faceOf(x) === face) || null
const deckN = (g, nation) => (g.decks[nation] || []).length

/* 美国已参战 + 太平洋真实补给链（本土陆军 → 东太平洋海军；夏威夷=补给点） */
function usBase(nation = '美国', phase = 'play') {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null; g.pending_echo = null; g.pending_scoring = null
	g.pending_script = null; g.pending_event_step = null; g.pending_event_targets = null
	g.pending_trigger = null; g._resp_settling = false
	R.action(g, 'Axis', 'debug_set_phase', { nation, phase })
	I.refresh(g)
	g.neutral['美国'] = false       /* 场景叠加：美国已结束中立 */
	/*
	 * 开局美国桌面挂着《大萧条的余波》17555：它会让"美国打出事件/状态卡"前
	 * 先自选弃 1 张手牌（us_depression_discard）。本批测的是 SUPP 卡本身，
	 * 故把它从桌面摘掉，避免每张卡都被这条代价打断（该机制另有专门测试）。
	 */
	if (g.table['美国']) g.table['美国'] = g.table['美国'].filter(x => faceOf(x) !== '17555')
	I.refresh(g)
	return g
}
function pacificChain(g) {
	place(g, 'us_ep', '美国', 'navy', '东太平洋')
	place(g, 'us_hw', '美国', 'army', '夏威夷')
	I.refresh(g)
}

/* ============ 1. 16300 火炬行动 ============ */
console.log('=== 1. 16300《火炬行动》[EVENT] ===')
{
	const g = usBase()
	place(g, 'it_na', '意大利', 'army', '非洲北部')      /* 陆战目标 */
	place(g, 'us_med', '美国', 'navy', '地中海')          /* 使<中东>可建（补给用场景叠加；地中海邻 中东/非洲北部） */
	I.refresh(g)
	I.grant_supply(g, 'us_med', g.turn)
	I.refresh(g)
	give(g, '16300', '美国')
	I.refresh(g)
	const NA = d.id_of('非洲北部'), ME = d.id_of('中东')
	console.log('  建陆军@中东 = ' + JSON.stringify(I.can_build_at(g, '美国', ME, 'army')))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '16300'), spaces: [ME, NA] })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 260))
	console.log('  中东 = ' + JSON.stringify(I.pieces_on(g, ME).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★★ ① 在<中东>（<非洲北部>相邻）建设 1 支美国陆军', cnt(g, '美国', '中东', 'army') === 1, lg0.slice(0, 180))

	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'event_step_next', {})
	I.refresh(g)
	const lg1 = logSince(g, n1)
	const bud = g.event_budget
	console.log('  下一步 log = ' + lg1.slice(0, 200) + '  budget=' + JSON.stringify(bud && { kind: bud.kind, remaining: bud.remaining }))
	ok('★ ② 第 2 步生成陆战预算（对<非洲北部>）', !!bud && bud.kind === 'land' && bud.remaining === 1,
		JSON.stringify(bud && { kind: bud.kind, remaining: bud.remaining }))
	if (bud) {
		const newArmy = Object.keys(g.location).find(p => g.location[p] === ME && g.piece_nation[p] === '美国' && g.piece_type[p] === 'army')
		/* 场景叠加：刚征召的那支本回合处于补给状态（否则不能发起战斗） */
		I.grant_supply(g, newArmy, g.turn)
		I.refresh(g)
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'event_battle', { target: NA, from: newArmy, victim: 'it_na' })
		I.refresh(g)
		const lg2 = logSince(g, n2)
		console.log('  陆战 log = ' + lg2.slice(0, 220))
		ok('★★ ③ 以新建陆军对<非洲北部>发起陆战：意大利陆军被移除',
			cnt(g, '意大利', '非洲北部', 'army') === 0, lg2.slice(0, 160))
		const n3 = (g.log || []).length
		R.action(g, 'Allies', 'event_finish', {})
		I.refresh(g)
		const lg3 = logSince(g, n3)
		console.log('  收尾 log = ' + lg3.slice(0, 240))
		ok('★ ④ 收尾：预算清空、卡进弃牌堆', !g.event_budget &&
			(g.discard['美国'] || []).some(x => faceOf(x) === '16300'),
			JSON.stringify({ budget: !!g.event_budget }) + ' | ' + lg3.slice(0, 160))
	}
}

/* ============ 2. 16301 太平洋舰队 ============ */
console.log('\n=== 2. 16301《太平洋舰队》[EVENT] ===')
{
	const g = usBase()
	pacificChain(g)
	place(g, 'jp_n28', '日本', 'navy', '中太平洋')
	I.refresh(g)
	give(g, '16301', '美国')
	I.refresh(g)
	const MP = d.id_of('中太平洋'), NP = d.id_of('北太平洋')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '16301'), spaces: [MP, NP] })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 260))
	/* 海战步 = 战斗预算：下一步 → event_battle → 结束 */
	R.action(g, 'Allies', 'event_step_next', {})
	I.refresh(g)
	R.action(g, 'Allies', 'event_battle', { target: MP, from: 'us_ep' })
	I.refresh(g)
	const lgMid = logSince(g, n0)
	console.log('  海战 log = ' + lgMid.slice(0, 300))
	ok('★★ ① 对<中太平洋>发起海战：日本海军被移除',
		cnt(g, '日本', '中太平洋', 'navy') === 0, lgMid.slice(0, 200))
	R.action(g, 'Allies', 'event_finish', {})
	I.refresh(g)
	/* 收尾后再推进到第 2 步（建海军） */
	if (g.pending_event_step) {
		R.action(g, 'Allies', 'event_step_next', {})
		I.refresh(g)
	}
	const lg1 = logSince(g, n0)
	console.log('  后续 log = ' + lg1.slice(-320))
	console.log('  北太平洋 = ' + JSON.stringify(I.pieces_on(g, NP).map(p => g.piece_nation[p] + '/' + g.piece_type[p])) +
		'  中太平洋 = ' + JSON.stringify(I.pieces_on(g, MP).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★★ ② 在<太平洋>之一再建设 1 支美国海军（本次落在日志所示海域）',
		cnt(g, '美国', '北太平洋', 'navy') + cnt(g, '美国', '中太平洋', 'navy') === 1, lg1.slice(-200))
	ok('★ ③ 卡进弃牌堆、无预算残留',
		(g.discard['美国'] || []).some(x => faceOf(x) === '16301') && !g.event_budget,
		JSON.stringify({ budget: !!g.event_budget, step: !!g.pending_event_step }))
}

/* ============ 3. 16302 诺曼底登陆（合成盘面无法满足前置 → 优雅失败）============ */
console.log('\n=== 3. 16302《诺曼底登陆》[EVENT] ===')
{
	const g = usBase()
	give(g, '16302', '美国')
	I.refresh(g)
	console.log('  美国建海军@北海 = ' + JSON.stringify(I.can_build_at(g, '美国', d.id_of('北海'), 'navy')))
	const card = instOf(g, '美国', '16302')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 300))
	ok('★★ ① 前置不满足时给出明确原因（不是静默失败）', /无法执行|不能|须|不足/.test(lg0), lg0.slice(0, 200))
	ok('★ ② 不死锁：卡留在手牌或正常进弃牌堆，无挂起残留',
		!g.event_budget && !g.pending_event_step && !g.delegate && !(g.response_stack || []).length,
		JSON.stringify({
			inHand: handOf(g, '美国').indexOf(card) >= 0,
			budget: !!g.event_budget, step: !!g.pending_event_step,
		}))
}

/* ============ 4. 16303 中途岛海战 ============ */
console.log('\n=== 4. 16303《中途岛海战》[EVENT] ===')
{
	const g = usBase()
	pacificChain(g)
	place(g, 'jp_n28', '日本', 'navy', '中太平洋')
	I.refresh(g)
	give(g, '16303', '美国')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '16303') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 260))
	console.log('  jp_response_suppressed = ' + JSON.stringify(g.jp_response_suppressed) + '  turn=' + g.turn)
	ok('★★ ① 本回合压制日本响应卡', !!g.jp_response_suppressed, JSON.stringify(g.jp_response_suppressed))
	/* 海战步 = 战斗预算 */
	R.action(g, 'Allies', 'event_step_next', {})
	I.refresh(g)
	R.action(g, 'Allies', 'event_battle', { target: d.id_of('中太平洋'), from: 'us_ep' })
	I.refresh(g)
	const lg1 = logSince(g, n0)
	console.log('  海战 log = ' + lg1.slice(0, 300))
	ok('★★ ② 对<中太平洋>发起海战：日本海军被移除', cnt(g, '日本', '中太平洋', 'navy') === 0, lg1.slice(0, 200))
	R.action(g, 'Allies', 'event_finish', {})
	I.refresh(g)
	ok('★ ③ 卡进弃牌堆', (g.discard['美国'] || []).some(x => faceOf(x) === '16303'),
		JSON.stringify(handOf(g, '美国').map(faceOf)))
}

/* ============ 5. 16304 中国远征军（STATUS · 征召 + 被移除后让权美国）============ */
console.log('\n=== 5. 16304《中国远征军》[STATUS] ===')
{
	const g = usBase()
	give(g, '16304', '美国')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '16304') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 240))
	console.log('  东南亚 = ' + JSON.stringify(I.pieces_on(g, d.id_of('东南亚')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★ ① 打出后中国在<东南亚>征召 1 支陆军', cnt(g, '中国', '东南亚', 'army') === 1, lg0.slice(0, 180))
	ok('★ ② 状态卡留在桌面', (g.table['美国'] || []).some(x => faceOf(x) === '16304'),
		JSON.stringify((g.table['美国'] || []).map(faceOf)))

	/* 日本攻击<东南亚>的中国陆军 → 移除 → 让权美国 */
	/* <中国东部> 开局有中国陆军占着，先清空才能让日本陆军进驻（否则 debug_place 静默失败） */
	const cnEast = Object.keys(g.location).find(p => g.location[p] === d.id_of('中国东部'))
	if (cnEast) R.action(g, 'Allies', 'debug_remove', { piece: cnEast })
	I.refresh(g)
	place(g, 'jp_se', '日本', 'army', '中国东部')   /* <中国东部> 邻 <东南亚> */
	I.refresh(g)
	I.grant_supply(g, 'jp_se', g.turn)
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	give(g, '15401', '日本')
	I.refresh(g)
	const cnArmy = Object.keys(g.location).find(p => g.location[p] === d.id_of('东南亚') && g.piece_nation[p] === '中国')
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '日本', '15401'), space: d.id_of('东南亚'), piece: cnArmy })
	I.refresh(g)
	const lg1 = logSince(g, n1)
	console.log('  日本陆战 log = ' + lg1.slice(0, 260))
	console.log('  us_china_delegate = ' + JSON.stringify(g.us_china_delegate && { step: g.us_china_delegate.step, sea: g.us_china_delegate.sea }))
	ok('★★ ③ <东南亚>中国陆军被移除后让权美国', !!g.us_china_delegate, lg1.slice(0, 180))
	if (g.us_china_delegate) {
		const cands = g.us_china_delegate.candidates || []
		console.log('  让权候选 = ' + JSON.stringify(cands))
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'resolve_china_delegate', { space: cands[0] })
		I.refresh(g)
		const lg2 = logSince(g, n2)
		console.log('  让权结算 log = ' + lg2.slice(0, 220))
		ok('★★ ④ 美国选定相邻地区后中国在该地征召陆军',
			!!cands.length && cnt(g, '中国', d.name_of(cands[0]), 'army') === 1, lg2.slice(0, 160))
		ok('★ ⑤ 让权结束后归还（delegate 清空）', !g.us_china_delegate, String(g.current_nation))
	}
}

/* ============ 6. 16800 艾森豪威尔（建设陆军后：再建设 1 支陆军）============ */
console.log('\n=== 6. 16800《艾森豪威尔》[EFFECT] ===')
{
	const g = usBase()
	place(g, 'us_sa', '美国', 'army', '非洲南部')   /* 提供建设邻接的补给部队 */
	I.refresh(g)
	I.grant_supply(g, 'us_sa', g.turn)
	I.refresh(g)
	give(g, '17500', '美国')   /* 建设陆军 */
	give(g, '16800', '美国')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '17500'), space: d.id_of('非洲北部') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	const win = (g.armed_offers || []).find(w => w.when === 'after_build_army' &&
		(w.cards || []).some(c => faceOf(c.card_id) === '16800'))
	console.log('  建设 log = ' + lg0.slice(0, 200))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★★ ① 建设陆军后开出 16800 窗口', !!win, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	if (win) {
		const c = instOf(g, '美国', '16800')
		R.action(g, 'Allies', 'use_armed_offer', { card: c })
		I.refresh(g)
		const pend = (g.armed_offers || []).find(w => w.pending)
		const cands = (pend && pend.pending && pend.pending.candidates) || []
		console.log('  候选 = ' + JSON.stringify(cands))
		const n1 = (g.log || []).length
		if (cands.length) R.action(g, 'Allies', 'use_armed_offer', { card: c, space: cands[0] })
		I.refresh(g)
		const lg1 = logSince(g, n1)
		console.log('  发动 log = ' + lg1.slice(0, 220))
		ok('★★ ② 发动后再建设 1 支美国陆军',
			!!cands.length && cnt(g, '美国', d.name_of(cands[0]), 'army') === 1, lg1.slice(0, 160))
	}
}

/* ============ 7. 16801 哈尔西（发起海战后：再发起 1 次海战）============ */
console.log('\n=== 7. 16801《哈尔西》[EFFECT] ===')
{
	const g = usBase()
	pacificChain(g)
	place(g, 'jp_n28', '日本', 'navy', '中太平洋')
	I.refresh(g)
	give(g, '17503', '美国')   /* 发起海战 */
	give(g, '16801', '美国')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '17503'), space: d.id_of('中太平洋'), piece: 'jp_n28' })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	const win = (g.armed_offers || []).find(w => w.when === 'after_battle' &&
		(w.cards || []).some(c => faceOf(c.card_id) === '16801'))
	console.log('  海战 log = ' + lg0.slice(0, 220))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★★ ① 发起海战后开出 16801 窗口', !!win, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	if (win) {
		const c = instOf(g, '美国', '16801')
		R.action(g, 'Allies', 'use_armed_offer', { card: c })
		I.refresh(g)
		let pend = (g.armed_offers || []).find(w => w.pending)
		const spCands = (pend && pend.pending && pend.pending.candidates) || []
		console.log('  海域候选 = ' + JSON.stringify(spCands))
		if (spCands.length) R.action(g, 'Allies', 'use_armed_offer', { card: c, space: spCands[0] })
		I.refresh(g)
		pend = (g.armed_offers || []).find(w => w.pending)
		const fromCands = (pend && pend.pending && pend.pending.candidates) || []
		console.log('  发起单位候选 = ' + JSON.stringify(fromCands))
		const n1 = (g.log || []).length
		if (fromCands.length) R.action(g, 'Allies', 'use_armed_offer', { card: c, piece: fromCands[0] })
		I.refresh(g)
		const lg1 = logSince(g, n1)
		console.log('  发动 log = ' + lg1.slice(0, 240))
		ok('★★ ② 再发起 1 次海战（日志出现第二次海战）',
			/海战/.test(lg1) && !/未发动|skip|失败/.test(lg1), lg1.slice(0, 200))
	}
}

/* ============ 8. 16802 麦克阿瑟（发起陆战后：再发起 1 次陆战）============ */
console.log('\n=== 8. 16802《麦克阿瑟》[EFFECT] ===')
{
	const g = usBase()
	place(g, 'us_med', '美国', 'navy', '地中海')
	place(g, 'it_me', '意大利', 'army', '中东')
	I.refresh(g)
	I.grant_supply(g, 'us_med', g.turn)
	I.refresh(g)
	give(g, '17501', '美国')   /* 发起陆战 */
	give(g, '16802', '美国')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '17501'), space: d.id_of('中东'), piece: 'it_me' })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	const win = (g.armed_offers || []).find(w => w.when === 'after_battle' &&
		(w.cards || []).some(c => faceOf(c.card_id) === '16802'))
	console.log('  陆战 log = ' + lg0.slice(0, 220))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★★ ① 发起陆战后开出 16802 窗口', !!win, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	if (win) {
		const c = instOf(g, '美国', '16802')
		R.action(g, 'Allies', 'use_armed_offer', { card: c })
		I.refresh(g)
		let pend = (g.armed_offers || []).find(w => w.pending)
		const spCands = (pend && pend.pending && pend.pending.candidates) || []
		console.log('  地区候选 = ' + JSON.stringify(spCands))
		if (spCands.length) R.action(g, 'Allies', 'use_armed_offer', { card: c, space: spCands[0] })
		I.refresh(g)
		pend = (g.armed_offers || []).find(w => w.pending)
		const fromCands = (pend && pend.pending && pend.pending.candidates) || []
		console.log('  发起单位候选 = ' + JSON.stringify(fromCands))
		const n1 = (g.log || []).length
		if (fromCands.length) R.action(g, 'Allies', 'use_armed_offer', { card: c, piece: fromCands[0] })
		I.refresh(g)
		const lg1 = logSince(g, n1)
		console.log('  发动 log = ' + lg1.slice(0, 240))
		ok('★★ ② 再发起 1 次陆战', /陆战/.test(lg1) && !/未发动|skip/.test(lg1), lg1.slice(0, 200))
	}
}

/* ============ 9. 16803 尼米兹（建设海军后：再建设 1 支海军）============ */
console.log('\n=== 9. 16803《尼米兹》[EFFECT] ===')
{
	const g = usBase()
	pacificChain(g)
	give(g, '17502', '美国')   /* 建设海军 */
	give(g, '16803', '美国')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '17502'), space: d.id_of('北太平洋') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	const win = (g.armed_offers || []).find(w => w.when === 'after_build_navy' &&
		(w.cards || []).some(c => faceOf(c.card_id) === '16803'))
	console.log('  建设 log = ' + lg0.slice(0, 200))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★★ ① 建设海军后开出 16803 窗口', !!win, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	if (win) {
		const c = instOf(g, '美国', '16803')
		R.action(g, 'Allies', 'use_armed_offer', { card: c })
		I.refresh(g)
		const pend = (g.armed_offers || []).find(w => w.pending)
		const cands = (pend && pend.pending && pend.pending.candidates) || []
		console.log('  候选 = ' + JSON.stringify(cands))
		const n1 = (g.log || []).length
		if (cands.length) R.action(g, 'Allies', 'use_armed_offer', { card: c, space: cands[0] })
		I.refresh(g)
		const lg1 = logSince(g, n1)
		console.log('  发动 log = ' + lg1.slice(0, 220))
		ok('★★ ② 发动后再建设 1 支美国海军',
			!!cands.length && cnt(g, '美国', d.name_of(cands[0]), 'navy') === 1, lg1.slice(0, 160))
	}
}

/* ============ 10. 16804 花园口决堤（敌方在<中国东部>建/征陆军时：损耗2 消灭之）============ */
console.log('\n=== 10. 16804《花园口决堤》[EFFECT] ===')
{
	const g = usBase()
	/* 清空<中国东部>（开局中国陆军驻守） */
	const cn = Object.keys(g.location).find(p => g.piece_nation[p] === '中国' && g.location[p] === d.id_of('中国东部'))
	if (cn) R.action(g, 'Allies', 'debug_remove', { piece: cn })
	I.refresh(g)
	give(g, '16804', '美国')
	I.refresh(g)
	place(g, 'jp_ne', '日本', 'army', '中国东北')
	I.refresh(g)
	I.grant_supply(g, 'jp_ne', g.turn)
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	give(g, '15400', '日本')   /* 建设陆军 */
	I.refresh(g)
	const usDeck0 = deckN(g, '美国')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: instOf(g, '日本', '15400'), space: d.id_of('中国东部') })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	const win = (g.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '16804'))
	console.log('  日本建陆军 log = ' + lg0.slice(0, 200))
	console.log('  中国东部 = ' + JSON.stringify(I.pieces_on(g, d.id_of('中国东部')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★★ ① 敌方在<中国东部>建设陆军后开出 16804 窗口', !!win,
		JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	if (win) {
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: instOf(g, '美国', '16804') })
		I.refresh(g)
		const lg1 = logSince(g, n1)
		console.log('  发动 log = ' + lg1.slice(0, 240))
		console.log('  美国牌库 ' + usDeck0 + '→' + deckN(g, '美国'))
		ok('★★ ② 消灭刚建成的日本陆军', cnt(g, '日本', '中国东部', 'army') === 0, lg1.slice(0, 180))
		ok('★ ③ 代价：美国损耗 2 张牌', deckN(g, '美国') === usDeck0 - 2, usDeck0 + '→' + deckN(g, '美国'))
	}
}

/* ============ 11. 16805 B-25 米切尔（ECON 轰炸行动 + 置入英国手牌）============ */
console.log('\n=== 11. 16805《B-25 米切尔》[ECON] ===')
{
	const g = usBase()
	place(g, 'us_dh', '美国', 'navy', '东海')   /* <日本>大本营 2 地区内 */
	I.refresh(g)
	give(g, '16805', '美国')
	I.refresh(g)
	const jp0 = deckN(g, '日本')
	const card = instOf(g, '美国', '16805')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card, target: '日本' })
	I.refresh(g)
	const lg0 = logSince(g, n0)
	console.log('  打出 log = ' + lg0.slice(0, 260))
	console.log('  日本牌库 ' + jp0 + '→' + deckN(g, '日本'))
	console.log('  英国手牌含 16805? ' + handOf(g, '英国').some(x => faceOf(x) === '16805'))
	ok('★★ ① [轰炸行动]：日本损耗 4 张牌', deckN(g, '日本') === jp0 - 4, jp0 + '→' + deckN(g, '日本'))
	ok('★★ ② 打出后置入英国手牌（改归英国）',
		handOf(g, '英国').some(x => faceOf(x) === '16805') &&
		!handOf(g, '美国').some(x => faceOf(x) === '16805'),
		JSON.stringify({ uk: handOf(g, '英国').map(faceOf), us: handOf(g, '美国').map(faceOf) }))

	/* 反例：日本大本营 2 地区内没有美国海军 → 不可选为目标 */
	const g2 = usBase()
	give(g2, '16805', '美国')
	I.refresh(g2)
	const n2 = (g2.log || []).length
	R.action(g2, 'Allies', 'play_card', { card: instOf(g2, '美国', '16805'), target: '日本' })
	I.refresh(g2)
	const lg2 = logSince(g2, n2)
	const jp2 = deckN(g2, '日本')
	console.log('  反例 log = ' + lg2.slice(0, 240) + '  日本牌库=' + jp2)
	ok('★ ③ 反例：2 地区内无美国海军时日本不损耗（目标不可选）',
		jp2 === deckN(g2, '日本') && /无满足条件的目标|无美国海军|无法|不可/.test(lg2),
		lg2.slice(0, 200))
}

/* ============ 12. 16806 大规模部署 ============ */
console.log('\n=== 12. 16806《大规模部署》[EVENT] ===')
{
	const g = usBase()
	give(g, '16806', '美国')
	I.refresh(g)
	const n0 = (g.log || []).length
	/* 两步都要选区：<东太平洋>相邻陆地（征召陆军）/ 相邻海域（征召海军） */
	const EP = d.id_of('东太平洋')
	const landAdj = d.spaces[EP].connections.find(c => d.spaces[c] && d.spaces[c].terrain === 'land')
	const seaAdj = d.spaces[EP].connections.find(c => d.spaces[c] && d.spaces[c].terrain === 'sea' && c !== EP)
	console.log('  候选：陆军@' + d.name_of(landAdj) + ' 海军@' + (seaAdj ? d.name_of(seaAdj) : '（无）'))
	R.action(g, 'Allies', 'play_card', { card: instOf(g, '美国', '16806'), spaces: [landAdj, seaAdj] })
	I.refresh(g)
	let lg = logSince(g, n0)
	let ps = g.pending_event_step
	console.log('  打出 log = ' + lg.slice(0, 260))
	console.log('  pending = ' + JSON.stringify(ps && { step: ps.step, need: ps.need }))
	if (ps) {
		R.action(g, 'Allies', 'event_step_next', {})
		I.refresh(g)
		ps = g.pending_event_step
		lg = logSince(g, n0)
		console.log('  推进后 log = ' + lg.slice(0, 300))
		if (ps) {
			R.action(g, 'Allies', 'event_step_next', {})
			I.refresh(g)
			console.log('  再推进 log = ' + logSince(g, n0).slice(0, 300))
		}
	}
	const usArmy = Object.keys(g.location).filter(p => g.piece_nation[p] === '美国' && g.piece_type[p] === 'army').length
	const usNavy = Object.keys(g.location).filter(p => g.piece_nation[p] === '美国' && g.piece_type[p] === 'navy').length
	console.log('  美国陆军=' + usArmy + ' 海军=' + usNavy)
	ok('★★ ① 在<东太平洋>及相邻征召 1 支陆军 + 1 支海军',
		usArmy >= 2 && usNavy >= 1, JSON.stringify({ army: usArmy, navy: usNavy }))
	ok('★ ② 无挂起残留', !g.event_budget && !g.pending_event_step,
		JSON.stringify({ budget: !!g.event_budget, step: !!g.pending_event_step }))
}

/* ============ 残留检查 ============ */
console.log('\n=== 13. 残留检查 ===')
{
	const g = usBase()
	ok('★ 干净盘面：无挂起窗口', !(g.armed_offers || []).length && !g.pending_armed_use &&
		!(g.response_stack || []).length && !g.event_budget && !g.delegate && !g.pending_event_step &&
		!g.us_china_delegate, JSON.stringify({
			offers: (g.armed_offers || []).length, budget: !!g.event_budget,
			delegate: !!g.delegate, china: !!g.us_china_delegate,
		}))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
