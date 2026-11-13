/*
 * D1 / P0 编号测试：前奏 DIY 编译层（纯编译层，不接引擎）
 *
 * T1  全量方括号词条 100% 覆盖
 * T2  四类 carrier 各能落位
 * T3  普通前奏 → event 同构（steps/choice/cost）
 * T4  军备卡 → response 同构（trigger{on,filter}+effect，无 steps/cost）
 * T5  让权链 → econ 同构（tag/targets/chain/run）
 * T6  [持续]/标签 → status 同构（trigger.window + once_per_turn + status_used 记账）
 * T7  未知方括号词条拒绝
 * T8  代价参数越界 / 负值拒绝
 * T9  地区不存在 / 地形-兵种不匹配拒绝
 * T10 非法国家名 / 未登记 filter 拒绝（兜底拒绝）
 * T11 未注册 card_ref 拒绝
 * T12 载体一致性（军备卡不得 emit steps、普通前奏不得 emit trigger/effect、status 必须 once_per_turn）
 * T13 标签已注册 + 冲突标签拒绝
 * T14 只新增不覆盖（id≥90000、无冲突、官方 125 张不变、编译不读写 cards.js）
 *
 * 用法：node tools/_test_prelude_compiler.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const P = require(path.join(MOD, 'prelude_compiler.js'))
const cards = require(path.join(MOD, 'cards.js'))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const J = x => JSON.stringify(x)
const spec = (id, over) => Object.assign({
	id, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE', name: 'P0 测试卡',
	tokens: ['[紧张度+1]', '在<乌克兰>征召陆军'],
}, over || {})

const preludeCards = cards.CARDS.filter(c =>
	c.deck === 'PRELUDE' || c.deck === 'ARMAMENT' ||
	c.type === 'PRELUDE' || c.type === 'ARMAMENT')
const officialIds = Object.keys(cards.CARD_BY_ID).map(Number)

console.log('=== T1. 全量方括号词条覆盖 ===')
{
	const cov = P.coverage(preludeCards.map(c => c.text))
	console.log('  覆盖率: ' + J({ total: cov.total, hit: cov.hit,
		rate: Number(cov.rate.toFixed(3)), bracketKinds: cov.bracketKinds,
		actionKinds: cov.actionKinds }))
	ok('★★ 125 张卡的方括号词条零遗漏', cov.unmatchedBracket.length === 0,
		J(cov.unmatchedBracket.slice(0, 10)))
	ok('★ 未命中的动作片段只记 warning、不阻断',
		P.compile(spec(90001, { tokens: ['获得1分', '某个未登记的后续动作'] }))
			.warnings.length === 1)
}

console.log('\n=== T2. 四类 carrier 落位 ===')
const samples = {
	event: spec(90001),
	response: spec(90002, {
		nation: '英国', deck: 'ARMAMENT', type: 'ARMAMENT',
		tokens: ['出牌阶段开始时', '建设1支海军'],
	}),
	econ: spec(90003, {
		nation: '日本', tokens: ['苏联损耗1张前奏牌'],
	}),
	status: spec(90004, {
		nation: '美国', tokens: ['[持续]', '获得2分'],
	}),
}
{
	const got = {}
	for (const [k, s] of Object.entries(samples)) {
		const ir = P.compile(s)
		got[k] = ir.carrier
		console.log('  ' + k + ' → ' + ir.carrier + ' errors=' + J(ir.errors))
	}
	ok('★★ 四类 carrier 全部落位正确',
		got.event === 'event' && got.response === 'response' &&
		got.econ === 'econ' && got.status === 'status', J(got))
}

console.log('\n=== T3/T4/T5/T6. 四套同构配置 ===')
{
	const ev = P.compile(samples.event)
	ok('T3 ★ event 有 steps/choice/cost 且 op 名与 EVENT steps 同构',
		Array.isArray(ev.config.steps) && ev.config.steps[0].op === 'recruit' &&
		'choice' in ev.config && 'cost' in ev.config, J(ev.config.steps))
	ok('T3 ★ 代价编译进 cost.tension', ev.config.cost.tension === 1, J(ev.config.cost))

	const rs = P.compile(samples.response)
	ok('T4 ★★ response 有 trigger{on,filter}+effect、且不含 steps/cost',
		!!rs.config.trigger && !!rs.config.effect &&
		!rs.config.steps && !rs.config.cost, J(rs.config))
	ok('T4 ★ 触发 on 取阶段 key（非中文字面量）',
		rs.config.trigger.on === 'play_start', J(rs.config.trigger.on))

	const ec = P.compile(samples.econ)
	ok('T5 ★★ econ 有 tag/targets/chain/run', !!ec.config.tag &&
		Array.isArray(ec.config.targets) && Array.isArray(ec.config.chain) &&
		!!ec.config.run, J(ec.config))
	ok('T5 ★ chain 保留了让权对象与张数',
		ec.config.chain[0].op === 'attrition_prelude' &&
		ec.config.chain[0].target === '苏联' && ec.config.chain[0].n === 1,
		J(ec.config.chain))

	const st = P.compile(samples.status)
	ok('T6 ★★ status 有 trigger.window + once_per_turn + status_used 记账',
		!!st.config.trigger && !!st.config.trigger.window &&
		st.config.once_per_turn === true && st.config.bookkeeping === 'status_used',
		J(st.config))
	ok('T6 ★ [持续] 编译成 persistent 标签',
		st.config.ongoing.tags.indexOf('persistent') >= 0, J(st.config.ongoing))
}

console.log('\n=== T7~T13. Validator ===')
{
	const bad = P.compile(spec(90005, { tokens: ['[完全未知词条]', '获得1分'] }))
	ok('T7 ★★ 未知方括号词条 → compile.errors 且 validate 拒绝',
		bad.errors.length === 1 && !P.validate(spec(90005), bad).ok, J(bad.errors))

	const s8 = spec(90006)
	const ir8 = P.compile(s8)
	ir8.config.cost.tension = 999
	ok('T8 ★ 紧张度越界拒绝', !P.validate(s8, ir8).ok)
	const ir8b = P.compile(s8); ir8b.config.cost.score = -1
	ok('T8 ★ 失去分数为负拒绝', !P.validate(s8, ir8b).ok)

	const nope = P.compile(spec(90007, { tokens: ['在<不存在的地区>征召陆军'] }))
	ok('T9 ★ 地区不存在拒绝', !P.validate(spec(90007), nope).ok,
		J(P.validate(spec(90007), nope).errors))
	const sea = P.compile(spec(90008, { tokens: ['在<南海>征召陆军'] }))
	ok('T9 ★★ 地形-兵种不匹配拒绝（陆军需 land）',
		!P.validate(spec(90008), sea).ok, J(P.validate(spec(90008), sea).errors))

	const badNation = P.compile(spec(90009, { nation: '火星' }))
	ok('T10 ★ 非法国家名拒绝', !P.validate(spec(90009, { nation: '火星' }), badNation).ok)
	const badFilter = P.compile(samples.response)
	badFilter.config.trigger.filter = ['未登记类型']
	ok('T10 ★ 未登记 filter 兜底拒绝',
		!P.validate(samples.response, badFilter).ok)

	const badRef = P.compile(samples.event)
	badRef.config.refs = ['完全不存在的卡名']
	ok('T11 ★ 未注册 card_ref 拒绝', !P.validate(samples.event, badRef).ok)

	const r12a = P.compile(samples.response); r12a.config.steps = [{ op: 'gain_score', n: 1 }]
	ok('T12 ★★ 军备卡不得 emit steps', !P.validate(samples.response, r12a).ok)
	const r12b = P.compile(samples.event); r12b.config.trigger = { on: 'play_card' }; r12b.config.effect = { ops: [] }
	ok('T12 ★ 普通前奏不得 emit RESPONSE 的 trigger/effect',
		!P.validate(samples.event, r12b).ok)
	const r12c = P.compile(samples.status); r12c.config.once_per_turn = false
	ok('T12 ★ status 必须 once_per_turn', !P.validate(samples.status, r12c).ok)

	const r13a = P.compile(samples.event); r13a.config.tags = ['未注册标签']
	ok('T13 ★ 未注册标签拒绝', !P.validate(samples.event, r13a).ok)
	const r13b = P.compile(samples.status); r13b.config.ongoing.tags = ['persistent', 'persistent']
	ok('T13 ★ 重复 [持续] 冲突拒绝', !P.validate(samples.status, r13b).ok)
}

console.log('\n=== T14. 只新增不覆盖 ===')
{
	const tooSmall = P.compile(spec(80001))
	ok('★ id < 90000 拒绝', !P.validate(spec(80001), tooSmall).ok)
	const collide = P.compile(spec(15300))
	ok('★ 与现有卡 id 冲突拒绝', !P.validate(spec(15300), collide).ok)
	const nowIds = Object.keys(cards.CARD_BY_ID).map(Number)
	ok('★★ 编译前后官方 125 张 id 集合不变',
		preludeCards.length === 125 && nowIds.length === officialIds.length &&
		nowIds.every(x => officialIds.includes(x)), J({ before: officialIds.length, after: nowIds.length }))
	const src = fs.readFileSync(path.join(MOD, 'prelude_compiler.js'), 'utf8')
	ok('★ 编译层不读写 cards.js / 不 require rules.js',
		!/writeFileSync|require\(['"]\.\/rules\.js['"]\)/.test(src))
	ok('★ renderSpecs 只返回字符串，不落盘',
		typeof P.renderSpecs([P.compile(samples.event)]) === 'string' &&
		!/writeFileSync/.test(P.renderSpecs.toString()))
	ok('★ 四类样例全部通过 validate',
		Object.values(samples).every(s => P.validate(s, P.compile(s)).ok))
}

console.log('\n=== T15. 嵌套方括号解析（P1 修正）===')
{
	const txt = '[弃置2张[建设陆军]] 在<乌克兰>征召陆军'
	const ts = P.parse_text(txt)
	const brs = ts.filter(t => t.bracket).map(t => t.raw)
	ok('★★ 最外层整段只作为 1 个词条',
		brs.length === 1 && brs[0] === '[弃置2张[建设陆军]]', J(brs))
	ok('★★ rest 不再残留半截「[弃置2张」',
		!ts.some(t => !t.bracket && /^\[弃置/.test(t.raw)),
		J(ts.filter(t => !t.bracket).map(t => t.raw)))
	const ir = P.compile(spec(90010, {
		tokens: ['[弃置2张[建设陆军]]', '在<乌克兰>征召陆军'],
	}))
	ok('★ 嵌套代价词条编译成 cost.discard',
		ir.config.cost.discard.some(d => d.n === 2 && d.filter === '建设陆军'),
		J(ir.config.cost))
	ok('★ 未出现未知方括号词条错误', ir.errors.length === 0, J(ir.errors))
}

console.log('\n=== T16. 切分噪声不计未命中 ===')
{
	const n1 = '和手牌共3张'
	ok('★ is_noise 命中已登记噪声', P.is_noise(n1))
	const ir = P.compile(spec(90011, { tokens: ['获得1分', n1] }))
	ok('★★ 噪声不产生 warning 也不产生 error',
		ir.warnings.length === 0 && ir.errors.length === 0,
		J({ w: ir.warnings, e: ir.errors }))
	ok('★ 噪声在 matched 里标为 noise',
		ir.matched.some(m => m.id === 'noise'), J(ir.matched))
	const cov = P.coverage(preludeCards.map(c => c.text))
	ok('★ coverage 有独立 noise 计数', cov.noise > 0, J(cov.noise))
}

console.log('\n=== T17. strict 严格编译 ===')
{
	const bad = spec(90012, { tokens: ['获得1分', '一个完全没登记的动作'] })
	const loose = P.compile(bad)
	const strict = P.compile(bad, { strict: true })
	ok('★ 宽松模式只记 warning',
		loose.warnings.length === 1 && loose.errors.length === 0, J(loose.warnings))
	ok('★★ strict 把未登记动作升级为 error',
		strict.errors.length === 1 && /未登记动作片段/.test(strict.errors[0]), J(strict.errors))
	ok('★★ strict + validate 整批拒绝', !P.validate(bad, strict).ok)
	ok('★ 四类样例在 strict 下全部通过',
		Object.values(samples).every(s => {
			const ir = P.compile(s, { strict: true })
			return P.validate(s, ir).ok
		}))
}

console.log('\n=== T18. 官方 125 张覆盖率达标 ===')
{
	const cov = P.coverage(preludeCards.map(c => c.text))
	ok('★★ 方括号词条零遗漏', cov.unmatchedBracket.length === 0, J(cov.unmatchedBracket))
	ok('★★ 真实动作片段零未登记', cov.unmatchedAction.length === 0, J(cov.unmatchedAction))
	ok('★★ 真实片段覆盖率 100%', cov.rate === 1,
		J({ total: cov.total, hit: cov.hit, rate: cov.rate, noise: cov.noise }))
}

const specFromText = (id, text) => ({
	id: 90000 + id, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
	name: '分段探针', text,
})
const realText = id => cards.CARD_BY_ID[id].text

console.log('\n=== T19. 按「。」分段、原文顺序保留 ===')
{
	const txt = '[紧张度+1] 打出1张前奏手牌。[弃置1张手牌] 检视牌堆。'
	const ts = P.parse_text(txt)
	ok('★★ 第一个 token 是段首代价（bracket 不再全部提前）',
		ts[0].raw === '[紧张度+1]' && ts[0].bracket === true, J(ts.slice(0, 3)))
	ok('★★ 段号按「。」切分',
		ts.find(t => t.raw === '[弃置1张手牌]').seg === 1,
		J(ts.map(t => t.raw + '@' + t.seg)))
	ok('★ 所有 token 带 pos 且严格递增',
		ts.every((t, i) => i === 0 || t.pos > ts[i - 1].pos), J(ts.map(t => t.pos)))
}

console.log('\n=== T20. A mandatory + B optional（14900 形态）===')
{
	const ir = P.compile(specFromText(1, '[紧张度+1] 打出1张前奏手牌。[弃置1张手牌] 检视牌堆。'))
	const segs = ir.config.segments
	ok('★★ 2 段且为 A + B', segs.length === 2 &&
		segs[0].kind === 'mandatory' && segs[1].kind === 'optional',
		J(segs.map(s => s.kind)))
	ok('★★ 必付/选付代价分离（紧张度在第一段、弃牌在第二段）',
		segs[0].cost.tension === 1 && segs[0].cost.discard.length === 0 &&
		segs[1].cost.discard.length === 1,
		J(segs.map(s => s.cost)))
	ok('★ 兼容别名 cost/steps 只取第一段',
		ir.config.cost.tension === 1 && ir.config.cost.discard.length === 0 &&
		ir.config.steps.length === segs[0].steps.length)
	ok('★ B 段语义：不支付跳过、卡照常消耗',
		/不支付则跳过/.test(segs[1].semantics) && /卡照常消耗/.test(segs[1].semantics))
	ok('★ validate 通过', P.validate(specFromText(1, ''), ir).ok)
}

console.log('\n=== T21. A + C opponentOptOut（14903 形态）===')
{
	const ir = P.compile(specFromText(2,
		'[紧张度+2] 检视前奏牌堆。[除非英国弃置2张手牌] 打出1张前奏手牌。'))
	const s1 = ir.config.segments[1]
	ok('★★ 第二段为 C 且对手=英国',
		s1.kind === 'opponentOptOut' && s1.opponent === '英国', J(s1))
	ok('★ 对手不支付才执行', /不支付才执行/.test(s1.semantics))
	ok('★ 对手代价单独记录、不混入我方 cost',
		!!s1.opponentCost && s1.cost.discard.length === 0, J(s1.opponentCost))
}

console.log('\n=== T22. 标签不是代价 + 6601 式 ongoing/auto ===')
{
	const irA = P.compile(specFromText(3,
		'[紧张度+1][持续] 获得2分。[失去2分] 苏联损耗1张前奏牌。'))
	ok('★★ 标签不进 cost', irA.config.segments[0].cost.discard.length === 0 &&
		irA.config.segments[0].tags.includes('persistent'),
		J(irA.config.segments[0].cost))
	ok('★★ 首段带 [持续] → status + ongoing/auto 并存（6601 范式）',
		irA.carrier === 'status' && !!irA.config.ongoing.segments &&
		Array.isArray(irA.config.auto) && irA.config.auto.length === 1,
		J({ carrier: irA.carrier, auto: irA.config.auto }))
	const irB = P.compile(specFromText(4, realText(18308)))
	ok('★★ 首段无标签 → 不整卡推 status', irB.carrier !== 'status', irB.carrier)
	ok('★★ 第二段带 [持续] 仍产出 ongoing/auto',
		irB.config.segments[1].effectMode === 'ongoing' && !!irB.config.auto,
		J(irB.config.segments.map(s => s.effectMode)))
}

console.log('\n=== T23. 不支付时第一段照常执行（18300 形态）===')
{
	const ir = P.compile(specFromText(5, realText(18300)))
	const segs = ir.config.segments
	ok('★★ 第一段无代价仍 mandatory 且有动作',
		segs[0].kind === 'mandatory' && segs[0].steps.length > 0 &&
		segs[0].cost.tension === 0, J(segs[0]))
	ok('★ 第二段 B 带代价', segs[1].kind === 'optional' && segs[1].cost.score === 2,
		J(segs[1].cost))
}

console.log('\n=== T24. validate 段级 4 条 ===')
{
	const s = spec(90041)
	const mk = () => P.compile(s)
	const e1 = mk(); e1.config.segments[0].steps = []
	ok('★ 第一段（A）不得为空', !P.validate(s, e1).ok)
	const e2 = mk(); e2.config.segments.push({
		index: 1, kind: 'optional', cost: { tension: 0, score: 0, discard: [] },
		steps: [{ op: 'gain_score' }], tags: [], guards: [], triggers: [],
		refs: [], filters: [], headTokens: [], effectMode: 'once',
	})
	ok('★ B 段必须带代价', !P.validate(s, e2).ok)
	const e3 = mk(); e3.config.segments.push({
		index: 1, kind: 'opponentOptOut', cost: { tension: 0, score: 0, discard: [] },
		steps: [{ op: 'gain_score' }], opponent: null, tags: [], guards: [],
		triggers: [], refs: [], filters: [], headTokens: [], effectMode: 'once',
	})
	ok('★ C 段必须指定对手', !P.validate(s, e3).ok)
	const e4 = mk(); e4.config.segments[0].cost.discard.push({ n: 1, filter: '持续' })
	ok('★ 标签被误计入 cost 时拒绝', !P.validate(s, e4).ok)
}

console.log('\n=== T25. 14905 例外 + 覆盖率不回归 ===')
{
	const ir = P.compile(specFromText(6, realText(14905)))
	ok('★★ 第二段 [紧张度+1] 仍是 mandatory（按段首类型判定）',
		ir.config.segments[1].kind === 'mandatory' &&
		ir.config.segments[1].cost.tension === 1,
		J(ir.config.segments.map(s => s.kind)))
	const cov = P.coverage(preludeCards.map(c => c.text))
	ok('★★ 官方 125 张覆盖率仍 100% 且零未登记',
		cov.rate === 1 && cov.unmatchedAction.length === 0 && cov.unmatchedBracket.length === 0,
		J({ total: cov.total, hit: cov.hit, noise: cov.noise }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
