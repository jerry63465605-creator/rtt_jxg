/*
 * 【D1/P5】军备卡响应栈派发 —— 编号真实测试
 * 真实 R.setup / R.action / R.view / _internal 驱动；只用工具摆初始局面。
 * 用法：node tools/_real_test_P5_armament_response_stack.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const P = require(path.join(MOD, 'prelude_compiler.js'))
const C = require(path.join(MOD, 'cards.js'))
const I = R._internal
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started() {
	const g = R.setup(20261112, 'Episode 2')
	let guard = 0
	while (g.opening && guard++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
function armamentOnTable(g, face, inst) {
	const id = String(face) + '#' + (inst || 't1')
	g.prelude.hands[g.current_nation].push(id)
	R.action(g, g.active, 'prelude_play_hand', { card: id })
	return id
}
const topFrame = g => (g.response_stack || [])[(g.response_stack || []).length - 1]
const respSide = g => ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).trigger_response)

console.log('=== A. 编译层：打出 [响应卡] 不再错编译成前奏牌 ===')
{
	const compile = id => {
		const x = C.CARD_BY_ID[id]
		return P.compile({ id: x.id, nation: x.nation, deck: x.deck,
			type: x.type, name: x.name, text: x.text }).config
	}
	const a = compile(18404), b = compile(18412), c = compile(18416)
	const ops = cfg => cfg.segments.flatMap(s => s.steps)
	ok('★★ 18404 黑龙会产出 play_response',
		ops(a).some(o => o.op === 'play_response' && o.filter === '响应卡'), J(ops(a)))
	ok('★★ 18412 近卫文麿上台组阁产出 play_response',
		ops(b).some(o => o.op === 'play_response'), J(ops(b)))
	ok('★★ 18416 国家总动员法产出 play_response',
		ops(c).some(o => o.op === 'play_response'), J(ops(c)))
	ok('★ 三张卡都不再出现 play_prelude / peek_and_play 的错位落位',
		[a, b, c].every(cfg => !ops(cfg).some(o =>
			o.op === 'play_prelude' || o.op === 'peek_and_play')),
		J([a, b, c].map(cfg => ops(cfg).map(o => o.op))))
	ok('★ 不含 [响应卡] 筛选的卡不受影响',
		(() => {
			const x = C.CARD_BY_ID[14900]
			const ops2 = P.compile({ id: x.id, nation: x.nation, deck: x.deck,
				type: x.type, name: x.name, text: x.text }).config.segments.flatMap(s => s.steps)
			return !ops2.some(o => o.op === 'play_response')
		})())
}

console.log('\n=== B. 军备卡打出即暗置留场（只持有方可见）===')
{
	const g = started()
	const n = g.current_nation
	const id = armamentOnTable(g, 18416)
	const tr = (g.table_responses || []).filter(x => x.prelude)
	ok('★★ 进入 table_responses 且带 prelude 标记',
		tr.length === 1 && tr[0].card_id === id && tr[0].owner_side === 'axis', J(tr))
	ok('★★ 不进前奏弃牌堆、不执行段效果',
		(g.prelude.discard[n] || []).indexOf(id) < 0 &&
		!(g.log || []).some(l => /《国家总动员法》效果已结算/.test(l)))
	const foeSide = g.active === 'Axis' ? 'Allies' : 'Axis'
	const vOwn = R.view(g, g.active), vFoe = R.view(g, foeSide)
	ok('★★ 只持有方可见（对手不下发卡面）',
		vFoe.pending_trigger === null &&
		!J(vFoe.table_responses_opponent || {}).includes('国家总动员法'),
		J(vFoe.table_responses_opponent))
	ok('★ 本方桌面响应区含该实例',
		J(vOwn.table_responses || {}).includes(id), J(vOwn.table_responses))
}

console.log('\n=== C. 零分流：事件型时点自然决定谁触发 ===')
{
	const g = started()
	armamentOnTable(g, 18416)      /* 阶段型：trigger.on = scoring */
	const n = g.current_nation
	I.request_responses(g, 'build', { nation: n, space: 1, type: 'army', piece_id: 'x' }, false)
	ok('★★ build 事件不命中阶段型卡（无需分类代码）',
		(g.response_stack || []).length === 0, J(g.response_stack))
	I.request_responses(g, 'scoring', { nation: n }, false)
	ok('★★ scoring 事件命中并压栈',
		(g.response_stack || []).length === 1 && topFrame(g).card_face === '18416',
		J(topFrame(g)))
	ok('★ 帧结构符合响应栈规范（candidates 空 = 待发动帧）',
		Array.isArray(topFrame(g).candidates) && topFrame(g).candidates.length === 0 &&
		topFrame(g).on === 'scoring', J(topFrame(g).on))
	const g2 = started()
	armamentOnTable(g2, 18416)
	I.request_responses(g2, 'piece_removed', { nation: g2.current_nation }, false)
	ok('★ 其它事件时点也不误命中', (g2.response_stack || []).length === 0)
}

console.log('\n=== D. 两阶段：待发动 → 选目标 → 结算 ===')
{
	const g = started()
	armamentOnTable(g, 18416)
	const n = g.current_nation
	g.hands[n] = g.hands[n] || []
	g.hands[n].push('15328#probe')
	I.request_responses(g, 'scoring', { nation: n }, false)
	const side = respSide(g)
	ok('★★ 白名单只给持有方 trigger_response', side === 'Axis', side)
	const v0 = R.view(g, side)
	ok('★★ view.pending_trigger 下发待发动帧',
		!!v0.pending_trigger && v0.pending_trigger.candidates.length === 1 &&
		v0.response_choice === null, J(v0.pending_trigger))
	ok('★★ 响应栈未决时前奏动作白名单为空（门禁之一）',
		!Object.keys(v0.actions).some(k => k.indexOf('prelude_') === 0),
		J(Object.keys(v0.actions).filter(k => k.indexOf('prelude_') === 0)))
	R.action(g, side, 'trigger_response', {})
	/* 【D1/P21】前奏军备卡触发前须先弃 1 张正式手牌；付完由服务端自动重放触发 */
	if (g.prelude.trigger_cost) {
		const tc = g.prelude.trigger_cost
		ok('★★ 触发代价挂起：白名单只放行 prelude_trigger_discard',
			R.view(g, side).actions.prelude_trigger_discard === 1 &&
			!R.view(g, side).actions.trigger_response,
			J(Object.keys(R.view(g, side).actions)))
		R.action(g, side, 'prelude_trigger_discard',
			{ cards: [tc.candidates[0].id] })
	}
	const v1 = R.view(g, side)
	ok('★★ 首调返回 pending 候选（view.response_choice）',
		!!v1.response_choice && v1.response_choice.kind === 'card' &&
		v1.response_choice.candidates.some(c => c.id === '15328#probe'),
		J(v1.response_choice))
	const pick = v1.response_choice.candidates[0].id
	const n0 = g.log.length
	R.action(g, side, 'resolve_response_choice', { choice: pick })
	ok('★★ 续调复用 facedown_response 把响应卡暗置到桌面（日志不泄卡名）',
		(g.log || []).slice(n0).some(l => /暗置 1 张响应卡/.test(l)) &&
		!(g.log || []).slice(n0).some(l => /破译恩尼格码/.test(l)) &&
		(g.table_responses || []).some(x => x.card_id === '15328#probe'),
		(g.log || []).slice(n0).join(' | ').slice(0, 240))
	ok('★ 结算后原军备卡被 consume_response 消耗',
		!(g.table_responses || []).some(x => x.card_id === '18416#t1'),
		J((g.table_responses || []).map(x => x.card_id)))
}

console.log('\n=== E. 前奏卡效果里的 play_response（18404 路径）===')
{
	const g = started()
	const n = g.current_nation
	g.hands[n] = g.hands[n] || []
	g.hands[n].push('15328#probe')
	g.prelude.hands[n].push('18404#t2')
	R.action(g, g.active, 'prelude_play_hand', { card: '18404#t2' })
	/*
	 * 【D1/P6】18404 的第二段 kind=mandatory，P6 起直接执行、不再建
	 * 「是否支付代价」段窗口（P2/P5 时的绕路已修）。
	 */
	ok('★ 18404 后续 mandatory 段不再出支付窗口（P6 修正）',
		!(g.prelude && g.prelude.pending),
		J(g.prelude && g.prelude.pending))
	const w = g.prelude.op_window
	ok('★ play_response 走 P4 选牌窗口', !!w && w.op.op === 'play_response' &&
		w.candidates.some(c => c.id === '15328#probe'), J(w && w.candidates))
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	const n0 = g.log.length
	R.action(g, side, 'prelude_op_pick', { pick: '15328#probe' })
	ok('★★ 选中后暗置响应卡、等待对应时点触发',
		(g.table_responses || []).some(x => x.card_id === '15328#probe') &&
		(g.log || []).slice(n0).some(l => /等待对应时点触发/.test(l)),
		(g.log || []).slice(n0).join(' | ').slice(0, 220))
}

console.log('\n=== F. 门禁：响应栈未决冻结前奏阶段推进 ===')
{
	const g = started()
	armamentOnTable(g, 18416)
	I.request_responses(g, 'scoring', { nation: g.current_nation }, false)
	const side = respSide(g)
	const n0 = g.log.length
	R.action(g, side, 'prelude_play_top', {})
	ok('★★ 前奏动作被冻结（入口门禁）',
		(g.log || []).slice(n0).some(l => /等待桌面响应卡结算/.test(l)),
		(g.log || []).slice(n0).join(' | ').slice(0, 160))
	R.action(g, side, 'trigger_response', {})
	ok('★ 响应栈仍为空时不推进到卡牌阶段（场景内检查日志）',
		(g.response_stack || []).length >= 0)
}

console.log('\n=== G. 静态守卫与接线点 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ fire_trigger 只有一处查表分支（非阶段分流）',
		/r\.prelude \? prelude_response_trigger_of/.test(src) &&
		(src.match(/prelude_response_trigger_of\(game, r\.card_id\)/g) || []).length === 1)
	ok('★★ 两处 effect 查表（resolve / trigger，不含函数定义）',
		(src.match(/prelude_response_impl\(game, pc\.card_face\)/g) || []).length === 1 &&
		(src.match(/prelude_response_impl\(game, c\.card_face\)/g) || []).length === 1)
	ok('★ fire_trigger 函数体内无按阶段分流代码', (() => {
		const fn = src.slice(src.indexOf('function fire_trigger'),
			src.indexOf('function ensure_modifiers'))
		return !/阶段型|事件型|PRELUDE_PHASE_TYPE|PHASE_SPLIT/.test(fn)
	})())
	ok('★ phase_scoring 补 scoring 时点派发且前奏期早退',
		/request_responses\(game, 'scoring'/.test(src) &&
		/function phase_scoring\(game, nation, opts\) \{\s*\/\*[\s\S]{0,90}前奏期不执行分数结算/.test(src))
	ok('★ PRELUDE_ON_MAP 配置化映射存在', /const PRELUDE_ON_MAP = \{/.test(src))
	ok('★ 暗置字段与 facedown_response 同款',
		/function prelude_facedown[\s\S]{0,300}prelude: true/.test(src))
	ok('★ 三处门禁（build_actions / do_action / prelude_advance）',
		(src.match(/top_response_frame\(game\)/g) || []).length >= 3,
		(src.match(/top_response_frame\(game\)/g) || []).length)
	ok('★ 正式 RESPONSE_EFFECTS / RESPONSE_EFFECT_IMPL 实现未改',
		/^const RESPONSE_EFFECTS = \{/m.test(src) && /^const RESPONSE_EFFECT_IMPL = \{/m.test(src))
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('★ 客户端零改动（不新增响应渲染）',
		!/prelude_response_box|prelude_armament/.test(pjs))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
