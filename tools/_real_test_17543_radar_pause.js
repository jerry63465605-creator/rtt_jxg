/*
 * #7 雷达 17543 —— 「立刻挂起询问美国，暂停响应链，答完再继续」真实测试
 *
 * 玩家口径（2026-11-11 确认）：
 *  1. 美国海军【每次】被移除都立刻弹框询问；
 *  2. 【必须回答】（发动 / 不发动）；
 *  3. 效果等价响应/增强的一次免死（17730 的时点与对飞机的处理）；
 *  4. 只给雷达开、不引入通用字段（配置开关驱动）；
 *  5. 仅对雷达例外，不推翻「配给优先」裁定；
 *  B. 每次被移除都弹，【只有发动过一次】后才不再弹（不发动不消耗次数）。
 *
 * 忠实复现铁律（rtt-card-bug-repro）：
 *  · 用 _board_lib.new_board 建真实盘面（含开局弃 3）；
 *  · 暗置【真实响应卡】到 table_responses，让引擎自然压栈；
 *  · 全程 R.action 驱动，绝不手填 response_queue 替代引擎流程；
 *  · 靶子/补给用 debug_place + grant_supply 摆初始局面。
 *
 * 用法：node tools/_real_test_17543_radar_pause.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const JP_SEA = d.id_of('东海')
const US_SEA = d.id_of('中太平洋')   /* <夏威夷> 是陆地；15438 实际打的是这个海域 */
const FAR_SEA = d.id_of('北大西洋')

function toTable(g, face, nation) {
	const inst = (g.hands[nation] || []).find(x => faceOf(x) === String(face))
	if (!inst) return null
	g.hands[nation] = (g.hands[nation] || []).filter(x => x !== inst)
	g.table[nation] = (g.table[nation] || []).concat([inst])
	I.refresh(g)
	return inst
}

/* 建盘：日本出牌阶段，桌面雷达，美国海军在中太平洋，日本海军在东海 */
function scene(opt = {}) {
	const g = new_board(20261111, { nation: '日本', phase: 'play' })
	clear_pending(g)
	g.current_nation = '日本'
	g.active = 'Axis'
	place(g, 'jp_nv', '日本', 'navy', d.name_of(JP_SEA))
	place(g, 'us_nv', '美国', 'navy', d.name_of(US_SEA))
	I.grant_supply(g, 'jp_nv', g.turn || 1)
	I.set_supply_point(g, JP_SEA, 'axis', true)
	I.refresh(g)
	I.compute_supply(g)
	give(g, '17543', '美国')
	I.refresh(g)
	const radar = toTable(g, '17543', '美国')
	if (!opt.noChain) {
		for (const face of ['15428', '15430', '15438'])
			g.table_responses.push({ card_id: face, owner_side: 'axis', nation: '日本' })
	}
	I.refresh(g)
	/* 真实动作进入出牌阶段 -> phase_play 派发 play_start 并压栈 */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	return { g, radar }
}

/* 用真实 action 推进响应链，直到雷达挂起建立 */
function driveToAsk(g, maxStep = 10) {
	for (let i = 0; i < maxStep; i++) {
		if (g.pending_status_ask) return true
		const vx = R.view(g, 'Axis')
		const va = R.view(g, 'Allies')
		const ax = Object.keys(vx.actions || {})
		const al = Object.keys(va.actions || {})
		const pt = vx.pending_trigger || va.pending_trigger
		if (ax.indexOf('response_confirm') >= 0 && pt && !pt.ordered &&
			(pt.candidates || []).length > 1) {
			R.action(g, 'Axis', 'response_confirm',
				{ order: (pt.candidates || []).map(c => c.card_id) })
			continue
		}
		const role = ax.indexOf('resolve_response_choice') >= 0 ? 'Axis'
			: (al.indexOf('resolve_response_choice') >= 0 ? 'Allies' : null)
		if (role) {
			const rc = R.view(g, role).response_choice
			const cands = (rc && rc.candidates) || []
			const pick = cands.find(c => Number(c.id) === Number(US_SEA)) || cands[0]
			if (!pick) break
			R.action(g, role, 'resolve_response_choice', { choice: pick.id })
			continue
		}
		if (ax.indexOf('trigger_response') >= 0) {
			R.action(g, 'Axis', 'trigger_response', {})
			continue
		}
		break
	}
	return !!g.pending_status_ask
}

const acts = (g, side) => Object.keys(R.view(g, side).actions || {})
const frames = g => (g.response_stack || []).map(f =>
	(f.name || f.card_face) + ':' + f.owner_side)

/* ==================== A. 真实响应链：S3 当场挂起 ==================== */
console.log('\n=== A. 15428+15430+15438 响应链中打掉美国海军 -> 立刻挂起 ===')
{
	const { g } = scene()
	ok('A0 出牌阶段已压真实响应栈帧', (g.response_stack || []).length > 0,
		J(frames(g)))
	const reached = driveToAsk(g)
	ok('★★ A1 真实 action 驱动后雷达挂起已建立', reached, J(g.pending_status_ask))
	const ask = g.pending_status_ask || {}
	ok('A2 挂起归属美国/同盟', ask.nation === '美国' && ask.side === 'allies', J(ask.nation) + '/' + J(ask.side))
	ok('A3 挂起 ctx 含完整免死字段（piece_nation/piece_type/space/piece）',
		!!(ask.ctx && ask.ctx.piece_nation === '美国' && ask.ctx.piece_type === 'navy' &&
			ask.ctx.piece === 'us_nv' && Number(ask.ctx.space) === Number(US_SEA)), J(ask.ctx))
	ok('A4 雷达窗口仍武装（status_instant 未丢）',
		(g.status_instant || []).some(e => faceOf(e.card_id) === '17543'))
	ok('A5 让权给美国（active=Allies）', g.active === 'Allies', J(g.active))
	ok('A6 响应栈帧【原地不动】，栈顶仍是轴心响应帧',
		(g.response_stack || []).length > 0 &&
		(g.response_stack || []).every(f => f.owner_side === 'axis'), J(frames(g)))
	ok('A7 view(Allies).pending_status_ask 已下发', !!R.view(g, 'Allies').pending_status_ask,
		J(R.view(g, 'Allies').pending_status_ask))
	ok('A8 view(Axis).pending_status_ask 不下发（保密/只给应答方）',
		!R.view(g, 'Axis').pending_status_ask)
	ok('A9 双方 pending_trigger 均为 null（响应框暂停）',
		!R.view(g, 'Axis').pending_trigger && !R.view(g, 'Allies').pending_trigger)
	ok('A10 双方 response_choice 均为 null',
		!R.view(g, 'Axis').response_choice && !R.view(g, 'Allies').response_choice)
	const al = acts(g, 'Allies')
	ok('A11 应答方白名单含 activate_status / skip_status_ask',
		al.indexOf('activate_status') >= 0 && al.indexOf('skip_status_ask') >= 0, J(al))
	ok('A12 应答方白名单不含 play_card / trigger_response（排他）',
		al.indexOf('play_card') < 0 && al.indexOf('trigger_response') < 0, J(al))
	ok('A13 非应答方只剩 log/debug_*，无 trigger_response',
		acts(g, 'Axis').indexOf('trigger_response') < 0, J(acts(g, 'Axis')))
	ok('A14 view(Allies).table_status[雷达].ready=true（仅雷达例外）',
		(R.view(g, 'Allies').table_status || []).some(c =>
			faceOf(c.card) === '17543' && c.ready === true))
	ok('A15 view(Axis).waiting_for 明确"等待美国"',
		/wait|美国|雷达/.test(J(R.view(g, 'Axis').waiting_for || {})),
		J(R.view(g, 'Axis').waiting_for))
	ok('A16 block_reason 指明 pending_status_ask',
		/pending_status_ask/.test(R.view(g, 'Allies').block_reason || ''),
		J(R.view(g, 'Allies').block_reason))
}

/* ==================== B. 必须回答（口径 2） ==================== */
console.log('\n=== B. 挂起期间其它动作一律拒绝，响应链真正暂停 ===')
{
	const { g } = scene()
	driveToAsk(g)
	const before = J(frames(g))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'trigger_response', {})
	ok('★ B1 轴心响应动作被拒且写入日志',
		/询问未决/.test(logSince(g, n0)), logSince(g, n0).slice(0, 120))
	ok('B2 响应栈帧未变化（没被偷偷结算）', J(frames(g)) === before, J(frames(g)))
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: (g.hands['美国'] || [])[0] })
	ok('B3 应答方出牌也被拒（必须回答）',
		/询问未决/.test(logSince(g, n1)), logSince(g, n1).slice(0, 120))
	ok('B4 挂起仍在', !!g.pending_status_ask)
}

/* ==================== C. 答「不发动」：不消耗次数（口径 B） ==================== */
console.log('\n=== C. 不发动 -> 清挂起、不消耗次数、响应链按原栈顶继续 ===')
{
	const { g } = scene()
	driveToAsk(g)
	const beforeFrames = J(frames(g))
	const deck0 = (g.decks['美国'] || []).length
	R.action(g, 'Allies', 'skip_status_ask', {})
	ok('★ C1 挂起已清', !g.pending_status_ask)
	ok('C2 未写 status_used（口径 B：不发动不消耗次数）',
		!Object.keys(g.status_used || {}).some(k => faceOf(k) === '17543'),
		J(g.status_used))
	ok('C3 未损耗牌（代价只在发动时付）',
		(g.decks['美国'] || []).length === deck0,
		deck0 + '→' + (g.decks['美国'] || []).length)
	ok('C4 本次雷达窗口条目已作废',
		!(g.status_instant || []).some(e => faceOf(e.card_id) === '17543'))
	/*
	 * 答完会触发 promote_deferred_response：之前被 deferToTail 的「奇袭」帧
	 * 按既有栈机制提升回活动栈 —— 这正是"响应链继续"的正确表现，
	 * 不能断言栈帧一字不变；只断言【原有帧没被吞掉】且链非空。
	 */
	const afterFrames = g.response_stack || []
	ok('C5 原有响应帧未被吞掉，链继续（deferred 帧按栈机制提升）',
		afterFrames.length > 0 &&
		JSON.parse(beforeFrames).every(n => frames(g).indexOf(n) >= 0),
		'before=' + beforeFrames + ' after=' + J(frames(g)))
	ok('C6 响应框恢复（链继续），轴心重新拿到 trigger_response',
		acts(g, 'Axis').indexOf('trigger_response') >= 0, J(acts(g, 'Axis')))
	ok('C7 让权归还轴心', g.active === 'Axis', J(g.active))
	ok('C8 view(Allies).pending_status_ask 已消失', !R.view(g, 'Allies').pending_status_ask)
}

/* ==================== D. 每次被移除都弹（口径 1 + B） ==================== */
console.log('\n=== D. 不发动后第二次移除仍弹；无响应链也弹 ===')
{
	const { g } = scene()
	driveToAsk(g)
	R.action(g, 'Allies', 'skip_status_ask', {})
	/* 摆第二支美国海军，用引擎真实 eliminate_piece 再派发一次 piece_removed */
	place(g, 'us_nv2', '美国', 'navy', d.name_of(FAR_SEA))
	I.refresh(g)
	const r = I.eliminate_piece(g, '日本', Number(FAR_SEA), 'us_nv2')
	ok('D1 第二次移除走引擎真实路径成功', !!(r && r.ok), J(r))
	ok('★★ D2 第二次移除【再次】建立雷达挂起（不发动不消耗）',
		!!g.pending_status_ask, J(g.pending_status_ask))
	ok('D3 第二次挂起 ctx 指向新 victim',
		!!(g.pending_status_ask && g.pending_status_ask.ctx &&
			g.pending_status_ask.ctx.piece === 'us_nv2'), J(g.pending_status_ask && g.pending_status_ask.ctx))
}
{
	/* 无响应链场景：只摆一张美国海军，用引擎真实派发点 */
	const { g } = scene({ noChain: true })
	place(g, 'us_solo', '美国', 'navy', d.name_of(FAR_SEA))
	I.refresh(g)
	I.eliminate_piece(g, '日本', Number(FAR_SEA), 'us_solo')
	ok('★ D4 没有响应链时，美国海军被移除也立刻挂起（口径 1）',
		!!g.pending_status_ask, J(g.pending_status_ask))
	ok('D5 无链场景应答方白名单仍含两个答复动作',
		acts(g, 'Allies').indexOf('activate_status') >= 0 &&
		acts(g, 'Allies').indexOf('skip_status_ask') >= 0, J(acts(g, 'Allies')))
}

/* ==================== E. 答「发动」：等价一次免死（口径 3） ==================== */
console.log('\n=== E. 发动 -> 损耗2 + 还原海军 + 飞机复原 + 本次战斗保护 ===')
{
	const { g, radar } = scene()
	driveToAsk(g)
	/* 构造同场"因不代受撤退"的空军：真实战斗中它会撤到【相邻陆地】，
	 * 这里摆一块陆地（debug_place 的空军载体校验不允许把飞机放海域），
	 * 再登记进挂起 ctx.retreated_airs（引擎 do_battle 就是这么记的）。 */
	const LAND = (Object.keys(d.spaces).map(Number)
		.find(s => d.spaces[s] && d.spaces[s].terrain === 'land' && Number(s) !== Number(US_SEA)))
	place(g, 'us_air', '美国', 'air', d.name_of(LAND))
	I.refresh(g)
	ok('E0 撤退空军已落位（摆盘有效）', g.location['us_air'] != null,
		J({ land: LAND, name: d.name_of(LAND), loc: g.location['us_air'] }))
	g.pending_status_ask.ctx.retreated_airs = ['us_air']
	const deck0 = (g.decks['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: radar })
	const lg = logSince(g, n0)
	ok('★ E1 损耗 2 张牌', (g.decks['美国'] || []).length <= deck0 - 2,
		deck0 + '→' + (g.decks['美国'] || []).length)
	ok('★ E2 美国海军被还原回中太平洋',
		g.location['us_nv'] === Number(US_SEA), J(g.location['us_nv']))
	ok('★ E3 撤退的空军被拉回原地区（等价 17730 的飞机处理）',
		g.location['us_air'] === Number(US_SEA), J(g.location['us_air']))
	ok('E4 日志写明发动《雷达》', /雷达/.test(lg), lg.slice(0, 160))
	ok('E5 注册 battleOnly 的 protect 修饰器（本次战斗免死）',
		(g.modifiers || []).some(m => m.key === 'protect' && m.nation === '美国' &&
			m.type === 'navy' && m.battleOnly === true), J((g.modifiers || []).slice(-2)))
	ok('E6 挂起已清', !g.pending_status_ask)
	ok('E7 已写 status_used（口径 B：发动过一次才消耗）',
		Object.keys(g.status_used || {}).some(k => faceOf(k) === '17543'), J(g.status_used))
	ok('E8 响应栈帧仍在，链未被吞掉', (g.response_stack || []).length > 0, J(frames(g)))
	ok('E9 让权归还轴心', g.active === 'Axis', J(g.active))
	ok('E10 响应框恢复，轴心可继续表态',
		acts(g, 'Axis').indexOf('trigger_response') >= 0, J(acts(g, 'Axis')))
	ok('E11 last_piece_removed 已清', !g.last_piece_removed)
	/* 发动过一次后，本回合再移除不再问 */
	place(g, 'us_nv3', '美国', 'navy', d.name_of(FAR_SEA))
	I.refresh(g)
	I.eliminate_piece(g, '日本', Number(FAR_SEA), 'us_nv3')
	ok('★ E12 发动过一次后本回合不再弹（一回合一次）',
		!g.pending_status_ask, J(g.pending_status_ask))
}

/* ==================== F. 仅对雷达例外（口径 4/5） ==================== */
console.log('\n=== F. 不推翻「配给优先」：其它状态卡仍置灰 ===')
{
	const { g } = scene()
	driveToAsk(g)
	const ts = R.view(g, 'Allies').table_status || []
	const others = ts.filter(c => faceOf(c.card) !== '17543')
	ok('★ F1 其它状态卡在挂起期间仍全部 ready=false（配给优先不变）',
		others.length > 0 && others.every(c => c.ready === false),
		J(others.map(c => ({ name: c.name, ready: c.ready, why: c.ready_reason }))))
	const radarCard = ts.find(c => faceOf(c.card) === '17543')
	ok('F2 只有雷达那一张放开', !!radarCard && radarCard.ready === true)
	/* 同盟非美国部队被移除不弹（ready 声明式条件不变） */
	const g2 = scene({ noChain: true }).g
	place(g2, 'uk_nv', '英国', 'navy', d.name_of(FAR_SEA))
	I.refresh(g2)
	I.eliminate_piece(g2, '日本', Number(FAR_SEA), 'uk_nv')
	ok('F3 英国海军被移除不弹雷达（只认美国海军）', !g2.pending_status_ask)
}

/* ==================== G. 静态守卫（配置驱动 / 复用原子） ==================== */
console.log('\n=== G. 静态守卫 ===')
{
	const fs = require('fs')
	const path = require('path')
	const rulesSrc = fs.readFileSync(path.join(L.MOD, 'rules.js'), 'utf8')
	const playSrc = fs.readFileSync(path.join(L.MOD, 'play.js'), 'utf8')
	const cfg = I.STATUS_EFFECTS && I.STATUS_EFFECTS['17543']
	ok('G1 17543 trigger 声明 askImmediately（配置驱动，不写死 id）',
		!!(cfg && cfg.trigger && cfg.trigger.askImmediately === true))
	ok('G2 run 复用 protect_restored 原子',
		/protect_restored\(game, ctx, \{[^}]*battleOnly: true/.test(rulesSrc))
	ok('G3 run 不再手写 register_modifier',
		!/'17543'[\s\S]{0,2600}?register_modifier\(game, \{[\s\S]{0,200}?key: 'protect', nation: '美国'/.test(rulesSrc))
	ok('G4 skip_status_ask 登记在 build_actions 与 do_action',
		/acts\.skip_status_ask = 1/.test(rulesSrc) &&
		/action === 'skip_status_ask'/.test(rulesSrc))
	ok('G5 客户端有询问框且挂在响应框之后',
		/update_pending_status_ask_box\(\)/.test(playSrc) &&
		playSrc.indexOf('update_pending_trigger_box()\n\t/*\n\t * 【2026-11-11】') <
		playSrc.indexOf('update_pending_status_ask_box()\n}') ||
		/update_pending_trigger_box\(\)[\s\S]{0,400}update_pending_status_ask_box\(\)/.test(playSrc))
	ok('G6 play.html 版本串已 bump',
		/20261111a/.test(fs.readFileSync(path.join(L.MOD, 'play.html'), 'utf8')))
	ok('G7 逻辑里不出现卡面字面量 17543（除配置/测试/注释）',
		!/if \([^)]*=== '17543'\)/.test(rulesSrc) &&
		!/if \([^)]*=== '17543'\)/.test(playSrc))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
