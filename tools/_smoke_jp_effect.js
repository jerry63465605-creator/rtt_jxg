/* 日本增强卡（EFFECT）回归测试 —— 2026-10-06
 *
 * 10 张：15405 15406 15407 15408 15409 15410 15411 15412 15413 7900
 *
 * 与德国增强卡的关键差异（本轮新增支持）：
 *   · 代价多为「弃置 1 张【响应卡】」= cost:{discard:1, filter:'response'}
 *     —— 本轮让 EFFECT 的 cost.discard 支持 filter（服务端校验 + 客户端过滤）
 *     —— 本轮也让 use_armed_offer（装载卡）支持 discard 代价
 *   · 德国多用「损耗 N 张牌」(attrition)
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data
const SPACE = require(path.join(MOD, 'data.js')).SPACE
const CARDS = require(path.join(MOD, 'cards.js')).CARDS

/* 干净的造局：清空棋子/手牌，置日本为当前国，便于自由摆放载体 */
function mkGame() {
	const g = rules.setup(1, 'Standard', {})
	g.current_nation = '日本'; g.active = 'Axis'
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.hands['日本'] = []
	I.refresh(g)
	return g
}
function put(g, id, nation, type, spaceName) {
	g.location[id] = SPACE[spaceName]
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	I.refresh(g)
}

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) }
}

const IDS = ['15405', '15406', '15407', '15408', '15409',
	'15410', '15411', '15412', '15413', '7900']

/*
 * 战斗挂起/结算走 exports.action(state, current, action, arg) 派发：
 * current 决定 side（'Allies' -> ALLIES，其它 -> AXIS）。
 * 保护卡窗口由【防守方】表态，日本属 Axis，所以传 'Axis'。
 */
function doBattleGuard(g, role, arg) {
	return rules.action(g, role, 'resolve_battle', arg)
}

function freshJp(phase) {
	const g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = phase || 'play'
	g.play_done = {}
	g.hands['日本'] = []
	g.decks['日本'] = []
	for (let k = 1; k <= 30; k++) g.decks['日本'].push('jpf' + k + '#1')
	g.discard['日本'] = []
	g.table_responses = []
	g.armed_offer = null
	g.armed_effects = []
	g.extra_play = null
	return g
}

/* 找一张日本响应牌（代价用） */
const JP_RESP = CARDS.find(c => c.nation === '日本' && c.type === 'RESPONSE')
ok('找得到日本响应牌样本', !!JP_RESP, 'id=' + (JP_RESP && JP_RESP.id))

console.log('\n=== 0. 10 张均已登记 CARD_TRIGGERS + ECHO_EFFECTS ===')
{
	const trig = I.CARD_TRIGGERS || {}
	const echo = I.ECHO_EFFECTS || {}
	const noTrig = IDS.filter(i => !trig[i])
	const noEcho = IDS.filter(i => !echo[i])
	ok('10 张都有 CARD_TRIGGERS', noTrig.length === 0, 'missing=' + noTrig.join(','))
	ok('10 张都有 ECHO_EFFECTS', noEcho.length === 0, 'missing=' + noEcho.join(','))
}

console.log('\n=== 1. 代价支持「弃置 1 张【响应卡】」(cost.filter) ===')
{
	/* 15408 / 15413 / 15412 / 15411 的代价都是 discard:1 + filter:response */
	for (const id of ['15408', '15413', '15412', '15411']) {
		const eff = (I.ECHO_EFFECTS || {})[id]
		const cost = eff && eff.cost
		ok(id + ' 代价 discard=1', cost && cost.discard === 1,
			'cost=' + JSON.stringify(cost))
		ok(id + ' 代价 filter=response', cost && cost.filter === 'response',
			'filter=' + (cost && cost.filter))
	}
	/* 7900 是弃 4 张手牌（无类型限定） */
	const e7900 = (I.ECHO_EFFECTS || {})['7900']
	ok('7900 代价 discard=4', e7900 && e7900.cost && e7900.cost.discard === 4,
		'cost=' + JSON.stringify(e7900 && e7900.cost))
	/* 德国卡对照片（attrition，无 filter） */
	const e15225 = (I.ECHO_EFFECTS || {})['15225']
	if (e15225) {
		ok('德国 15225 代价是 attrition（与日本不同）',
			!!(e15225.cost && e15225.cost.attrition),
			'cost=' + JSON.stringify(e15225.cost))
	}
}

console.log('\n=== 2. 15409 太平洋帝国：<太平洋>每有1支日本海军 +1分 ===')
{
	const g = freshJp('scoring')
	const pacIds = I.space_ids_expand(['太平洋'])
	ok('<太平洋> 地区组非空', pacIds.length > 0, 'n=' + pacIds.length)
	const eff = (I.ECHO_EFFECTS || {})['15409']
	ok('15409 有 run', eff && typeof eff.run === 'function')
	/* 无海军时应拒绝 */
	let r = eff.run(g, {})
	ok('无日本海军 -> 不结算', !r.ok, JSON.stringify(r))
	/* 放 2 支日本海军在太平洋 */
	const sp = pacIds[0]
	g.location['jp_n1'] = sp; g.piece_nation['jp_n1'] = '日本'; g.piece_type['jp_n1'] = 'navy'
	g.location['jp_n2'] = sp; g.piece_nation['jp_n2'] = '日本'; g.piece_type['jp_n2'] = 'navy'
	const before = g.score.axis || 0
	r = eff.run(g, {})
	ok('2 支海军 -> 触发', r && r.ok, JSON.stringify(r))
	ok('获得 2 分', (g.score.axis || 0) === before + 2,
		'before=' + before + ' after=' + (g.score.axis || 0))
}

console.log('\n=== 3. 15407 秋水火箭战斗机：消灭1支相邻日本空军的敌方空军 ===')
{
	const g = freshJp('discard')
	const eff = (I.ECHO_EFFECTS || {})['15407']
	ok('15407 有 run', eff && typeof eff.run === 'function')
	/*
	 * 卡面是「消灭 1 支【相邻日本空军】的敌方空军」——
	 * 敌机必须在日本空军的【相邻地区】。
	 * ⚠ seize_air 要求发起空军与目标地区【相邻】（同格不算其自己的邻居），
	 *   且发起空军要处于补给状态。所以敌机不能放在日本空军同一格。
	 */
	const sid = I.space_id_of('东海')
	const nb = (d.spaces[sid].connections || []).map(Number)[0]
	ok('东海 有相邻地区可放敌机', nb != null, 'nb=' + nb +
		(nb != null ? ('(' + d.spaces[nb].name + ')') : ''))
	g.location['jp_air'] = sid
	g.piece_nation['jp_air'] = '日本'
	g.piece_type['jp_air'] = 'air'
	g.location['us_air'] = nb          /* 相邻地区的敌方空军 */
	g.piece_nation['us_air'] = '美国'
	g.piece_type['us_air'] = 'air'
	/* 让日本空军处于补给状态 */
	I.grant_supply(g, 'jp_air', g.turn)
	I.compute_supply(g)
	const r = eff.run(g, {})
	console.log('    -> ' + JSON.stringify(r))
	ok('消灭了敌方空军', g.location['us_air'] === undefined,
		'loc=' + g.location['us_air'])
	ok('日本空军还在（发起方留原地）', g.location['jp_air'] === sid,
		'loc=' + g.location['jp_air'])
}

console.log('\n=== 4. 15412 御前会议：一步式「弃1响应 + 暗置打出1响应」 ===')
{
	/*
	 * 【2026-10-06 玩家口径】复用日本国家技能的一步式机制：
	 *   同一个弹窗里同时选「要弃的响应牌」+「要暗置打出的响应牌」。
	 * 因此 run 只在【已指定 arg.play】时执行；没指定时
	 * event_card_needs 返回 need:'one_step_pick'，服务端【不】替玩家挑。
	 */
	const g = freshJp('draw')
	const respId = String(JP_RESP.id) + '#1'
	const costId = String(JP_RESP.id) + '#2'
	g.hands['日本'] = [respId, costId]
	const eff = (I.ECHO_EFFECTS || {})['15412']
	ok('15412 有 run', eff && typeof eff.run === 'function')
	ok('15412 声明 one_step', !!(eff && eff.one_step),
		'one_step=' + JSON.stringify(eff && eff.one_step))
	ok('15412 one_step.filter=response',
		eff && eff.one_step && eff.one_step.filter === 'response')

	/* ① 没指定要打出的牌 -> 回报 need:'one_step_pick'（不是替玩家挑一张） */
	const need = I.event_card_needs(g, '日本', '15412#1', { cards: [costId] })
	console.log('    -> ' + JSON.stringify(need))
	ok('未指定 play -> need=one_step_pick',
		need && need.need === 'one_step_pick', JSON.stringify(need))
	ok('need 带 cost.filter=response',
		need && need.cost && need.cost.filter === 'response')

	/* ② 指定非响应牌 -> 拒绝 */
	const rBad = eff.run(g, { arg: { cards: [costId], play: 'other#1' } })
	ok('play 不是响应牌 -> 拒绝', !(rBad && rBad.ok), JSON.stringify(rBad))

	/* ③ 正常：弃 costId、暗置打出 respId */
	const r = eff.run(g, { arg: { cards: [costId], play: respId } })
	console.log('    -> ' + JSON.stringify(r))
	ok('触发成功', r && r.ok, JSON.stringify(r))
	ok('响应牌进入【桌面暗置区】',
		(g.table_responses || []).some(x => x.card_id === respId),
		'table=' + JSON.stringify(g.table_responses))
	ok('响应牌已离手牌', g.hands['日本'].indexOf(respId) < 0,
		'hand=' + JSON.stringify(g.hands['日本']))
	ok('【未】进弃牌堆（暗置≠弃牌）',
		(g.discard['日本'] || []).indexOf(respId) < 0)

	/* ④ 与国家技能同一原子：jp_facedown_play / discard_and_facedown 存在 */
	ok('共用原子 jp_facedown_play 已导出',
		typeof I.jp_facedown_play === 'function')
	ok('共用原子 discard_and_facedown 已导出',
		typeof I.discard_and_facedown === 'function')
	/* ⑤ 同一张牌不能既作代价又打出 */
	const g2 = freshJp('draw')
	g2.hands['日本'] = [respId]
	const r2 = I.discard_and_facedown(g2, '日本', [respId], respId,
		{ discard: 1, filter: 'response' }, 'response')
	ok('同一张牌既作代价又打出 -> 拒绝', !(r2 && r2.ok), JSON.stringify(r2))
	/* ⑥ 共用原子：国家技能同款流程能跑通 */
	const g3 = freshJp('draw')
	g3.hands['日本'] = [respId, costId]
	const r3 = I.discard_and_facedown(g3, '日本', [costId], respId,
		{ discard: 1, filter: 'response' }, 'response')
	ok('discard_and_facedown 走通（国家技能同款）', r3 && r3.ok, JSON.stringify(r3))
	ok('代价进了弃牌堆', (g3.discard['日本'] || []).indexOf(costId) >= 0,
		'discard=' + JSON.stringify(g3.discard['日本']))
	ok('打出的牌进了桌面暗置区',
		(g3.table_responses || []).some(x => x.card_id === respId),
		'table=' + JSON.stringify(g3.table_responses))
}

console.log('\n=== 5. 7900 竭泽而渔：复用德国脚本机（弃4张 -> 弃牌堆取1张） ===')
{
	/*
	 * 【2026-10-06 玩家口径】不用 run，整张卡由 SCRIPT_CARD_KIND 驱动，
	 * 候选来源从德国的【牌堆】换成【弃牌堆】。
	 */
	const g = freshJp('play')
	g.discard['日本'] = ['take_me#1']
	g.hands['日本'] = ['7900#1', 'h1#1', 'h2#1', 'h3#1', 'h4#1']

	ok('7900 登记为脚本卡', I.SCRIPT_CARD_KIND['7900'] === 'discard_pay_pick',
		'kind=' + I.SCRIPT_CARD_KIND['7900'])
	ok('7900【没有】run（改由脚本机驱动）',
		!((I.ECHO_EFFECTS || {})['7900'] || {}).run)

	I.script_start(g, '日本', '7900#1', true, 'discard_pay_pick')
	const ps = g.pending_script
	ok('脚本已挂起', !!ps, JSON.stringify(ps && ps.kind))
	ok('第 1 阶段是 discard（先弃后进，与卡面一致）',
		I.script_step_kind(ps) === 'discard', 'step=' + I.script_step_kind(ps))
	ok('需要弃 4 张', ps && ps.need_discard === 4, 'need_discard=' + (ps && ps.need_discard))
	ok('卡已离手（增强卡不占名额但确实打出去了）',
		g.hands['日本'].indexOf('7900#1') < 0,
		'hand=' + JSON.stringify(g.hands['日本']))

	/* ① 弃牌数不对 -> 拒绝，且挂起保留（服务端不替玩家挑） */
	I.script_resolve(g, '日本', { discard: ['h1#1', 'h2#1'] })
	ok('只弃 2 张 -> 拒绝（挂起仍在）',
		!!g.pending_script && I.script_step_kind(g.pending_script) === 'discard',
		JSON.stringify(g.hands['日本']))

	/* ② 正常弃 4 张 -> 进入第 2 阶段 pick */
	I.script_resolve(g, '日本', { discard: ['h1#1', 'h2#1', 'h3#1', 'h4#1'] })
	ok('弃 4 张 -> 进入 pick 阶段',
		I.script_step_kind(g.pending_script) === 'pick',
		'step=' + I.script_step_kind(g.pending_script))
	const cands = I.script_raw_candidates(g, g.pending_script)
	console.log('    -> candidates=' + JSON.stringify(cands))
	ok('候选来自【弃牌堆】（含刚弃掉的 h1）',
		cands.indexOf('h1#1') >= 0, JSON.stringify(cands))
	ok('候选【不含】本卡 7900（否则能白嫖回自己）',
		cands.indexOf('7900#1') < 0, JSON.stringify(cands))

	/* ③ 从弃牌堆取 1 张回手牌 */
	/* ⚠ 脚本机的选择参数名是 arg.pick（数组），不是 picks —— 与德国卡同款 */
	I.script_resolve(g, '日本', { pick: ['take_me#1'] })
	ok('目标牌回到手牌', g.hands['日本'].indexOf('take_me#1') >= 0,
		'hand=' + JSON.stringify(g.hands['日本']))
	ok('目标牌已离弃牌堆', (g.discard['日本'] || []).indexOf('take_me#1') < 0,
		'discard=' + JSON.stringify(g.discard['日本']))
	ok('脚本走完 -> 挂起清空', !g.pending_script)

	/* ④ 手牌不够 4 张 -> 跳过弃牌阶段（服务端不替玩家挑） */
	const g2 = freshJp('play')
	g2.discard['日本'] = ['x#1']
	g2.hands['日本'] = ['7900#1', 'h1#1']
	I.script_start(g2, '日本', '7900#1', true, 'discard_pay_pick')
	ok('手牌不够 -> 跳到 pick 或直接走完',
		!g2.pending_script || I.script_step_kind(g2.pending_script) === 'pick',
		'ps=' + JSON.stringify(g2.pending_script))

	/*
	 * ⑤ 开局弃牌堆为空【不等于】取牌阶段会被跳过：
	 *    卡面是"先弃 4 张、再检视弃牌堆"—— 那 4 张【立刻】成为取牌候选。
	 *    所以这里应停在 pick 且候选 = 刚弃掉的 4 张（本卡 7900 除外）。
	 */
	const g3 = freshJp('play')
	g3.discard['日本'] = []
	g3.hands['日本'] = ['7900#1', 'h1#1', 'h2#1', 'h3#1', 'h4#1']
	I.script_start(g3, '日本', '7900#1', true, 'discard_pay_pick')
	I.script_resolve(g3, '日本', { discard: ['h1#1', 'h2#1', 'h3#1', 'h4#1'] })
	ok('先弃后进：弃掉的 4 张成为取牌候选',
		g3.pending_script && I.script_step_kind(g3.pending_script) === 'pick',
		'ps=' + JSON.stringify(g3.pending_script))
	const c3 = g3.pending_script ? I.script_raw_candidates(g3, g3.pending_script) : []
	ok('候选含刚弃掉的 h1#1', c3.indexOf('h1#1') >= 0, JSON.stringify(c3))
	ok('候选含刚弃掉的 h4#1', c3.indexOf('h4#1') >= 0, JSON.stringify(c3))
	ok('候选【不含】本卡 7900#1', c3.indexOf('7900#1') < 0, JSON.stringify(c3))
	/* 取回 h2 -> 脚本走完 */
	I.script_resolve(g3, '日本', { pick: ['h2#1'] })
	ok('取回 h2 后脚本结束', !g3.pending_script)
	ok('h2 回到手牌', g3.hands['日本'].indexOf('h2#1') >= 0,
		'hand=' + JSON.stringify(g3.hands['日本']))
}

console.log('\n=== 6. 15411 夜间运输：补给阶段开始时 + 选 1 支【无补给】单位 ===')
{
	/*
	 * 【2026-10-06 玩家口径】两处改动：
	 *   ① 时点：anytime -> 补给阶段开始时
	 *   ② 目标：任意日本陆/海军 -> 必须玩家【选 1 支无补给的】
	 *      （旧实现是服务端自动挑第一支，违反"服务端不替玩家做选择"）
	 */
	const trig = (I.CARD_TRIGGERS || {})['15411']
	ok('15411 时点改为补给阶段',
		trig && trig.kind === 'self' && trig.phase === 'supply',
		'trig=' + JSON.stringify(trig))
	const eff = (I.ECHO_EFFECTS || {})['15411']
	ok('15411 声明 pickUnit', !!(eff && eff.pickUnit),
		'pickUnit=' + JSON.stringify(eff && eff.pickUnit))
	ok('15411 pickUnit.supplied=false（只收无补给的）',
		eff && eff.pickUnit && eff.pickUnit.supplied === false)

	const g = freshJp('supply')
	/* 造一支【无补给】的日本海军：没接补给点、不邻接补给中的友军 */
	const sid = I.space_id_of('东海')
	g.location['jp_bad'] = sid
	g.piece_nation['jp_bad'] = '日本'
	g.piece_type['jp_bad'] = 'navy'
	I.compute_supply(g)
	const cands = I.pick_unit_candidates(g, eff.pickUnit)
	console.log('    -> candidates=' + JSON.stringify(cands))
	ok('无补给部队进入候选', cands.indexOf('jp_bad') >= 0, JSON.stringify(cands))

	/* ① 未选 -> need:'piece'（服务端不替玩家挑） */
	const need = I.event_card_needs(g, '日本', '15411#1', { cards: ['x#1'] })
	ok('未指定 piece -> need=piece', need && need.need === 'piece',
		JSON.stringify(need))
	ok('need.candidates 含 jp_bad',
		need && (need.candidates || []).indexOf('jp_bad') >= 0)

	/* ② 选了无补给部队 -> 成功并授予补给 */
	const r = eff.run(g, { arg: { piece: 'jp_bad' } })
	console.log('    -> ' + JSON.stringify(r))
	ok('触发成功', r && r.ok, JSON.stringify(r))
	ok('已登记补给授予', !!(g.supply_granted && g.supply_granted['jp_bad']),
		'granted=' + JSON.stringify(g.supply_granted))

	/* ③ 选【有补给】的部队 -> 拒绝（这是本次改动的核心） */
	const g2 = freshJp('supply')
	g2.location['jp_ok'] = sid
	g2.piece_nation['jp_ok'] = '日本'
	g2.piece_type['jp_ok'] = 'navy'
	I.grant_supply(g2, 'jp_ok', g2.turn)
	I.compute_supply(g2)
	const cands2 = I.pick_unit_candidates(g2, eff.pickUnit)
	ok('补给中的部队【不在】候选', cands2.indexOf('jp_ok') < 0, JSON.stringify(cands2))
	const r2 = eff.run(g2, { arg: { piece: 'jp_ok' } })
	ok('选补给中的部队 -> 拒绝', !(r2 && r2.ok), JSON.stringify(r2))

	/* ④ 场上没有无补给部队 -> 拒绝 */
	const g3 = freshJp('supply')
	const r3 = eff.run(g3, { arg: { piece: 'nobody' } })
	ok('无合法目标 -> 拒绝', !(r3 && r3.ok), JSON.stringify(r3))
}

console.log('\n=== 7. 装载卡(armed)配置：15405 / 15406 / 15410 ===')
{
	for (const [id, when] of [['15405', 'after_build_navy'],
	['15406', 'after_deploy_air'], ['15410', 'piece_attacked']]) {
		const eff = (I.ECHO_EFFECTS || {})[id]
		const ar = eff && eff.armed
		ok(id + ' 有 armed 配置', !!ar)
		ok(id + ' when=' + when, ar && ar.when === when, 'when=' + (ar && ar.when))
		ok(id + ' actor=日本', ar && ar.actor === '日本', 'actor=' + (ar && ar.actor))
		ok(id + ' 代价含 discard=1', ar && ar.cost && ar.cost.discard === 1,
			'cost=' + JSON.stringify(ar && ar.cost))
		ok(id + ' 代价 filter=response',
			ar && ar.cost && ar.cost.filter === 'response')
		ok(id + ' 有 run', ar && typeof ar.run === 'function')
	}
}

console.log('\n=== 8. 15413 诸岛要塞 / 15408 山本五十六：候选地区(steps.spaces) ===')
{
	const e13 = (I.ECHO_EFFECTS || {})['15413']
	const st13 = e13 && e13.steps && e13.steps[0]
	ok('15413 是 recruit 步骤', st13 && st13.op === 'recruit',
		JSON.stringify(st13))
	ok('15413 候选含四岛（硫磺岛/菲律宾/印度尼西亚/新几内亚）',
		st13 && (st13.spaces || []).length >= 1,
		'n=' + (st13 && (st13.spaces || []).length))
	const e08 = (I.ECHO_EFFECTS || {})['15408']
	ok('15408 改为 run 实现（复用空军力量原子）',
		e08 && typeof e08.run === 'function' && !e08.steps, JSON.stringify(e08 && e08.steps))
	ok('15408 代价=弃1[响应卡]',
		e08 && e08.cost && e08.cost.discard === 1 && e08.cost.filter === 'response',
		JSON.stringify(e08 && e08.cost))

	/* 【2026-10-06】15408 复用空军力量原子（air_host_check + build_piece）。
	 * 卡面：出牌阶段开始时，弃1张[响应卡]，在海域【部署或调度】1支空军。
	 * 造局：找"日本本土陆军已能供给"的海域做部署目标；再做第二个补给海域做调度目标。
	 * 注：海军补给靠"相邻本国补给陆军"，故载体需用 forward army / set_supply_point 搭出。 */

	const RES = '15419#1'   // 万岁冲锋（日本响应卡），用于支付 15408 弃响应代价
	function giveResp(g) { g.hands['日本'] = [RES] }
	const seaNames = Object.keys(SPACE).filter(n => d.spaces[SPACE[n]] && d.spaces[SPACE[n]].terrain === 'sea')

	// 自然补给海域：仅放本土陆军 + 该海域海军即可供给（链上连通）
	function findNaturalSea() {
		for (const sn of seaNames) {
			const g = mkGame(); giveResp(g)
			put(g, 'ja', '日本', 'army', '日本')
			put(g, 'jn', '日本', 'navy', sn)
			if (I.air_host_check(g, '日本', SPACE[sn]).ok) { cleanup(g); return sn }
		}
		return null
	}
	// 任意海域搭出"补给中日本海军"：相邻陆地放补给中陆军
	function carrierAt(g, seaName, tag) {
		const seaId = SPACE[seaName]
		const nbs = I.get_connections(g, seaId, 'Axis')
		for (const nb of nbs) {
			const sp = d.spaces[nb]
			if (sp && sp.terrain === 'land') {
				g.location[tag + '_army'] = nb
				g.piece_nation[tag + '_army'] = '日本'
				g.piece_type[tag + '_army'] = 'army'
				I.set_supply_point(g, nb, 'Axis', true)
				break
			}
		}
		g.location[tag + '_navy'] = seaId
		g.piece_nation[tag + '_navy'] = '日本'
		g.piece_type[tag + '_navy'] = 'navy'
		I.refresh(g)
	}
	function cleanup(g) { /* noop，便于扩展 */ }

	const S1 = findNaturalSea()
	ok('找到一个日本自然补给海域作为部署目标', !!S1, 'S1=' + S1)

	/* 部署：东海(或其他)放补给中海军 -> 候选/打出 */
	{
		const g = mkGame(); giveResp(g)
		put(g, 'ja', '日本', 'army', '日本')
		put(g, 'jn', '日本', 'navy', S1)
		I.refresh(g)
		ok('15408 海域载体满足 air_host_check（复用空军力量原子）',
			I.air_host_check(g, '日本', SPACE[S1]).ok,
			JSON.stringify(I.air_host_check(g, '日本', SPACE[S1])))
		ok('15408 海域满足 can_deploy_air（sea 限定）',
			I.can_deploy_air(g, '日本', SPACE[S1], { terrain: 'sea' }).ok,
			JSON.stringify(I.can_deploy_air(g, '日本', SPACE[S1], { terrain: 'sea' })))

		const nd0 = I.event_card_needs(g, '日本', '15408#1', {})
		ok('15408 第一步 need=choice', nd0 && nd0.need === 'choice', JSON.stringify(nd0))
		ok('15408 choice 同时给出"部署"与"调度"两个选项（暗置而非隐藏）',
			nd0 && nd0.options && nd0.options.length === 2
				&& nd0.options.some(o => /部署/.test(o.label))
				&& nd0.options.some(o => /调度/.test(o.label)),
			JSON.stringify(nd0 && nd0.options))
		ok('15408 choice：调度选项此时 disabled（无日本空军可调度）',
			nd0 && nd0.options && nd0.options.find(o => /调度/.test(o.label)).disabled === true,
			JSON.stringify(nd0 && nd0.options))
		ok('15408 choice 步带代价(弃1响应) —— 选项 A：代价前置',
			nd0 && nd0.cost && nd0.cost.discard === 1 && nd0.cost.filter === 'response')

		const ndD = I.event_card_needs(g, '日本', '15408#1', { choice: 0 })
		ok('15408 部署need=space', ndD && ndD.need === 'space', JSON.stringify(ndD))
		ok('15408 部署候选含该海域', ndD && ndD.candidates && ndD.candidates.indexOf(SPACE[S1]) >= 0,
			'cands=' + JSON.stringify(ndD && ndD.candidates))
		ok('15408 space 步【不再】带代价（代价已在 choice 步收）',
			ndD && (!ndD.cost || ndD.cost.discard !== 1))

		const before = I.my_air_pieces(g, '日本').length
		const rD = I.resolve_event_card(g, '日本', '15408#1', { choice: 0, space: SPACE[S1], cards: [RES] })
		ok('15408 部署成功', rD && rD.ok, JSON.stringify(rD))
		ok('15408 部署后日本空军+1',
			I.my_air_pieces(g, '日本').length === before + 1,
			'before=' + before + ' after=' + I.my_air_pieces(g, '日本').length)
	}

	/* 调度：再搭一个补给海域 S2，把 S1 上的日本空军调度到 S2 */
	{
		const S2 = (() => {
			for (const sn of seaNames) {
				if (sn === S1) continue
				const g = mkGame(); carrierAt(g, sn, 'x')
				if (I.air_host_check(g, '日本', SPACE[sn]).ok) return sn
			}
			return null
		})()
		ok('找到第二个补给海域作为调度目标', !!S2, 'S2=' + S2)
		if (S1 && S2) {
			const g = mkGame(); giveResp(g)
			put(g, 'ja', '日本', 'army', '日本')
			carrierAt(g, S1, 'a')
			g.location['jpAirZ'] = SPACE[S1]; g.piece_nation['jpAirZ'] = '日本'; g.piece_type['jpAirZ'] = 'air'
			carrierAt(g, S2, 'b')
			I.refresh(g)
			ok('15408 调度前置：jpAirZ 已置于 S1', g.location['jpAirZ'] === SPACE[S1], 'loc=' + g.location['jpAirZ'])
			const nd0m = I.event_card_needs(g, '日本', '15408#1', {})
			ok('15408 有空军时 choice 同时含"部署"与"调度"',
				nd0m && nd0m.options && nd0m.options.some(o => /部署/.test(o.label))
					&& nd0m.options.some(o => /调度/.test(o.label)),
				JSON.stringify(nd0m && nd0m.options))
			const ndM = I.event_card_needs(g, '日本', '15408#1', { choice: 1 })
			ok('15408 调度need=space', ndM && ndM.need === 'space', JSON.stringify(ndM))
			ok('15408 调度space步【不再】带代价',
				ndM && (!ndM.cost || ndM.cost.discard !== 1))
			ok('15408 调度候选排除 S1（已有本国空军）',
				ndM && ndM.candidates && ndM.candidates.indexOf(SPACE[S1]) < 0,
				'cands=' + JSON.stringify(ndM && ndM.candidates))
			const rM = I.resolve_event_card(g, '日本', '15408#1', { choice: 1, space: SPACE[S2], cards: [RES] })
			ok('15408 调度成功', rM && rM.ok, JSON.stringify(rM))
			ok('15408 调度后空军移到了 S2',
				g.location['jpAirZ'] === SPACE[S2], 'loc=' + g.location['jpAirZ'])
		}
	}
}

console.log('\n=== 9. all_sea_space_ids 辅助函数 ===')
{
	ok('all_sea_space_ids 存在', typeof I.all_sea_space_ids === 'function')
	if (typeof I.all_sea_space_ids === 'function') {
		const ids = I.all_sea_space_ids()
		ok('返回非空海域列表', ids.length > 0, 'n=' + ids.length)
		ok('全部是 sea', ids.every(sp => d.spaces[sp] && d.spaces[sp].terrain === 'sea'))
	}
}

console.log('\n=== 10. 15410 武士道：挂起战斗再问（不是"可选窗口"） ===')
{
	/*
	 * 【2026-10-06 玩家口径】旧实现用 offer_armed_effects 弹"可选窗口"，
	 * do_battle 却同步结算到底 —— 受击单位在玩家表态前就被移除，
	 * 保护永远来不及生效（只有碰巧因空军代受挂起时才有效）。
	 * 现在改成 pending_battle(stage='guard')：victim 确定后【挂起】，
	 * 玩家表态后再重放 do_battle 完成结算。
	 */
	const eff = (I.ECHO_EFFECTS || {})['15410']
	ok('15410 armed.suspend=true（要求挂起）',
		eff && eff.armed && eff.armed.suspend === true,
		'suspend=' + (eff && eff.armed && eff.armed.suspend))
	ok('15410 不再走 offer_armed_effects（由 guard_card_candidates 筛选）',
		typeof I.guard_card_candidates === 'function')

	/*
	 * 造局：日本陆军放在【中国东北】，美国陆军放在相邻的【中国东部】发起陆战。
	 *
	 * ⚠ 不能用「日本本土」当战场：它的唯一邻接是【东海】(sea)，
	 *   没有相邻陆地 —— 陆战根本发起不了（do_battle 会拒"发起单位不合法"）。
	 *   这是"先挑地区再想当然"的典型坑，地区必须按【邻接表】验证过再用。
	 */
	function freshGuard() {
		const g = freshJp('play')
		g.current_nation = '美国'
		g.active = 'Allies'
		/*
		 * ⚠ 苏联/美国【开局中立】，不结束中立就发起不了战斗
		 * （do_battle 会返回 neutral:true 拒掉，看起来像"挂起没生效"）。
		 * 测试造局必须显式 end_neutral。
		 */
		g.neutral = g.neutral || {}
		g.neutral['美国'] = false
		return g
	}
	const g = freshGuard()
	const landId = I.space_id_of('中国东北')
	const nb = I.space_id_of('中国东部')
	ok('中国东北 是陆地', d.spaces[landId].terrain === 'land',
		'terrain=' + d.spaces[landId].terrain)
	ok('中国东部 与 中国东北 相邻',
		(d.spaces[landId].connections || []).map(Number).indexOf(nb) >= 0)
	g.location['jp_army'] = landId
	g.piece_nation['jp_army'] = '日本'
	g.piece_type['jp_army'] = 'army'
	g.location['us_army'] = nb
	g.piece_nation['us_army'] = '美国'
	g.piece_type['us_army'] = 'army'
	I.grant_supply(g, 'us_army', g.turn)
	I.compute_supply(g)

	const respId = String(JP_RESP.id) + '#1'
	g.hands['日本'] = ['15410#1', respId]

	/* ① 候选里应出现武士道 */
	const gc = I.guard_card_candidates(g, 'jp_army', '美国', landId, 'land')
	console.log('    -> guard_cards=' + JSON.stringify(gc))
	ok('武士道进入保护卡候选', gc.some(x => x.card_id === '15410#1'))
	ok('候选带 cost=1 / filter=response',
		gc.some(x => x.cost === 1 && x.cost_filter === 'response'))

	/* ② 手牌【没有】响应牌可弃 -> 不该挂起（付不起代价就不问） */
	const gPoor = freshGuard()
	gPoor.location['jp_army'] = landId
	gPoor.piece_nation['jp_army'] = '日本'
	gPoor.piece_type['jp_army'] = 'army'
	gPoor.hands['日本'] = ['15410#1']      /* 没有响应牌作代价 */
	ok('付不起代价 -> 候选为空（不弹框）',
		I.guard_card_candidates(gPoor, 'jp_army', '美国', landId, 'land').length === 0)

	/*
	 * ③ 发起战斗 -> 应【挂起】(pending_battle.stage='guard')，
	 *    且日本陆军【还在】桌上（没被同步移除）。
	 */
	const r = I.do_battle(g, '美国', landId, 'jp_army', 'land', { from: 'us_army' })
	console.log('    -> ' + JSON.stringify(r))
	ok('战斗被挂起(resolve 前不结算)', r && r.pending === true, JSON.stringify(r))
	ok('挂起 stage=guard',
		g.pending_battle && g.pending_battle.stage === 'guard',
		'stage=' + (g.pending_battle && g.pending_battle.stage))
	ok('受击单位【未被】移除（保护来得及生效）',
		g.location['jp_army'] === landId, 'loc=' + g.location['jp_army'])
	ok('挂起下发了 guard_cards',
		(g.pending_battle && (g.pending_battle.guard_cards || []).length > 0))

	/* ④ 代价没指定 -> 拒绝，挂起保留（服务端不替玩家挑） */
	doBattleGuard(g, 'Axis', { guard: '15410#1', drop: [] })
	ok('未指定代价 -> 拒绝且挂起保留',
		g.pending_battle && g.pending_battle.stage === 'guard' &&
		g.hands['日本'].indexOf('15410#1') >= 0,
		'ps=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))

	/* ⑤ 正常表态：弃 1 张响应 -> 保护生效，部队存活 */
	doBattleGuard(g, 'Axis', { guard: '15410#1', drop: [respId] })
	console.log('    -> after guard: loc=' + g.location['jp_army'] +
		' hand=' + JSON.stringify(g.hands['日本']) +
		' discard=' + JSON.stringify(g.discard['日本']))
	ok('挂起已清空', !g.pending_battle)
	ok('日本陆军【存活】（保护生效）', g.location['jp_army'] === landId,
		'loc=' + g.location['jp_army'])
	ok('武士道已离手' + '', g.hands['日本'].indexOf('15410#1') < 0,
		'hand=' + JSON.stringify(g.hands['日本']))
	ok('代价（响应牌）进了弃牌堆',
		(g.discard['日本'] || []).indexOf(respId) >= 0,
		'discard=' + JSON.stringify(g.discard['日本']))

	/* ⑥ 选"不使用" -> 部队照常被移除 */
	const g2 = freshGuard()
	g2.location['jp_army'] = landId
	g2.piece_nation['jp_army'] = '日本'
	g2.piece_type['jp_army'] = 'army'
	g2.location['us_army'] = nb
	g2.piece_nation['us_army'] = '美国'
	g2.piece_type['us_army'] = 'army'
	I.grant_supply(g2, 'us_army', g2.turn)
	I.compute_supply(g2)
	g2.hands['日本'] = ['15410#1', respId]
	const r2 = I.do_battle(g2, '美国', landId, 'jp_army', 'land', { from: 'us_army' })
	ok('同样挂起', r2 && r2.pending === true, JSON.stringify(r2))
	doBattleGuard(g2, 'Axis', { declined: true })
	ok('不使用保护卡 -> 部队被移除', g2.location['jp_army'] === undefined,
		'loc=' + g2.location['jp_army'])
	ok('不使用保护卡 -> 武士道留在手里',
		g2.hands['日本'].indexOf('15410#1') >= 0,
		'hand=' + JSON.stringify(g2.hands['日本']))
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
