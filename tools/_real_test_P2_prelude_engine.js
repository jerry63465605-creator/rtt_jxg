/*
 * 【D1/P2】前奏引擎编号真实测试（真实 R.setup / R.action / R.view，不改产品代码）
 * 用法：node tools/_real_test_P2_prelude_engine.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 走完正常开局（6 国抽 10 弃 3 留 7），返回进入前奏/正式局的 game */
function started(scenario, options) {
	const g = R.setup(20261112, scenario, options)
	let guard = 0
	while (g.opening && guard++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
const preludeActions = g => Object.keys(R.view(g, g.active).actions || {})
	.filter(k => k.indexOf('prelude_') === 0)
console.log('=== A. 开局与双入口 ===')
{
	const g = R.setup(20261112, 'Episode 2')
	ok('★★ scenario 含 Episode 2', R.scenarios.indexOf('Episode 2') >= 0, J(R.scenarios))
	ok('★★ enabled / tension=0 / phase=action',
		g.prelude.enabled === true && g.prelude.tension === 0 && g.prelude.phase === 'action')
	ok('★★ 各国摸 2 张前奏牌',
		Object.keys(g.prelude.hands).length === 6 &&
		Object.values(g.prelude.hands).every(h => h.length === 2),
		J(Object.values(g.prelude.hands).map(h => h.length)))
	ok('★ 前奏牌堆按国建立（官方 125 张 + 4 张 DIY）',
		Object.values(g.prelude.decks).reduce((a, d) => a + d.length, 0) === 117,
		J(Object.values(g.prelude.decks).map(d => d.length)))
	const s = R.setup(20261112, 'Standard')
	ok('★★ Standard 零影响（enabled=false）', s.prelude.enabled === false)
	const o = R.setup(20261112, 'Standard', { prelude: true })
	ok('★ options.prelude=true 也能启用', o.prelude.enabled === true)
	ok('★ opening 期间不抢前奏白名单',
		Object.keys(R.view(g, 'Axis').actions || {}).some(k => k === 'opening_discard'),
		J(Object.keys(R.view(g, 'Axis').actions || {}).slice(0, 8)))
}

console.log('\n=== B. opening 结束进入前奏两段骨架 ===')
{
	const g = started('Episode 2')
	ok('★★ opening 已结束、阶段=prelude_action',
		!g.opening && g.prelude.phase === 'prelude_action', g.prelude.phase)
	const v = R.view(g, g.active)
	ok('★★ view.prelude 已下发', !!v.prelude && v.prelude.enabled === true)
	ok('★★ actions 有三个前奏动作（双门禁之一）',
		['prelude_play_hand', 'prelude_play_top', 'prelude_discard_1_1']
			.every(a => preludeActions(g).indexOf(a) >= 0), J(preludeActions(g)))
	const own = g.current_nation
	ok('★★ 牌堆顶对【自己】可见（带卡面）',
		!!(v.prelude.deck_top[own] && v.prelude.deck_top[own].name),
		J(v.prelude.deck_top[own]))
	const foeNation = Object.keys(v.prelude.deck_top).find(n => n !== own &&
		['英国', '苏联', '美国'].indexOf(n) >= 0)
	ok('★★ 敌方牌堆顶不下发卡面（三暗区保密口径）',
		!foeNation || v.prelude.deck_top[foeNation] === null,
		J(v.prelude.deck_top[foeNation]))
	ok('★ 敌方手牌只给张数', typeof v.prelude.hands[foeNation] === 'number',
		J(v.prelude.hands[foeNation]))
	ok('★ 前奏期 game.turn_phase 不污染 7 阶段机',
		g.turn_phase === 'resource', g.turn_phase)
}

console.log('\n=== C. 行动阶段三选一 + 卡牌阶段 ===')
{
	const g = started('Episode 2')
	const own = g.current_nation
	const before = (g.prelude.decks[own] || []).length
	R.action(g, g.active, 'prelude_play_top', {})
	ok('★ 打牌堆顶后牌堆 -1（或递归打出）',
		(g.prelude.decks[own] || []).length < before, before + '→' + (g.prelude.decks[own] || []).length)
	ok('★ 打出的牌进前奏弃牌堆', (g.prelude.discard[own] || []).length >= 1)
	if (g.prelude.pending) {
		const w = g.prelude.pending
		const side = ['Axis', 'Allies'].find(s => {
			const vv = R.view(g, s)
			return vv.actions && (vv.actions.prelude_pay || vv.actions.prelude_op_pick)
		})
		ok('★★ B/C 段挂起窗口答复方在白名单（双门禁同源）', !!side, J(w.answerNation))
	}
	/* 【D1/P16】打牌堆顶可能连锁出 play_prelude 选牌窗口；逐层答完所有
	 * 段窗口 / op 窗口，才轮到卡牌阶段（否则停在 action 造成假绿）。 */
	let guard = 0
	while ((g.prelude.pending || g.prelude.op_window) && guard++ < 8) {
		if (g.prelude.op_window) {
			const ow = ['Axis', 'Allies'].find(s => {
				const vv = R.view(g, s)
				return vv.actions && vv.actions.prelude_op_pick
			})
			const cand = ow && (g.prelude.op_window.candidates || [])[0]
			if (!cand) break
			R.action(g, ow, 'prelude_op_pick', { pick: cand.id })
		} else {
			const side = ['Axis', 'Allies'].find(s => {
				const vv = R.view(g, s)
				return vv.actions && vv.actions.prelude_pay
			})
			if (!side) break
			R.action(g, side, 'prelude_skip', {})
		}
	}
	ok('★★ 行动阶段完成后进入卡牌阶段（不可跳过）',
		g.prelude.phase === 'prelude_cards', g.prelude.phase)
	/* 【D1/P11】乙口径：卡牌阶段不自动执行，点「继续」才弃光摸 2 */
	ok('★★ 卡牌阶段尚未自动执行',
		!(g.log || []).slice(-3).some(l => /弃置前奏手牌/.test(l)),
		J((g.log || []).slice(-3)))
	R.action(g, g.active, 'prelude_next', {})
	ok('★★ 点「继续」后才弃光手牌 → 摸 2 张',
		(g.prelude.hands[own] || []).length === 2 &&
		(g.log || []).some(l => /弃置前奏手牌/.test(l)),
		J((g.prelude.hands[own] || []).length))
	const g2 = started('Episode 2')
	const n2 = g2.current_nation
	const h2 = (g2.prelude.hands[n2] || []).length
	const d2 = (g2.prelude.decks[n2] || []).length
	const firstCard = (g2.prelude.hands[n2] || [])[0]
	R.action(g2, g2.active, 'prelude_discard_1_1', {})
	ok('★★ 第三项：手牌 >1 时开选牌窗口（玩家手动选）',
		!!(g2.prelude.op_window &&
			g2.prelude.op_window.op.op === 'discard_prelude_hand'),
		J(g2.prelude.op_window && g2.prelude.op_window.candidates))
	const ds = ['Axis', 'Allies'].find(s =>
		(R.view(g2, s).actions || {}).prelude_op_pick)
	R.action(g2, ds, 'prelude_op_pick', { pick: firstCard })
	ok('★ 选定后弃 1 手牌 + 弃 1 牌堆顶，且留在 ACTION 再行动一次',
		(g2.prelude.hands[n2] || []).length === h2 - 1 &&
		(g2.prelude.decks[n2] || []).length === d2 - 1 &&
		g2.prelude.phase === 'prelude_action',
		J({ hand: (g2.prelude.hands[n2] || []).length, deck: (g2.prelude.decks[n2] || []).length }))
}

console.log('\n=== D. 段级 A/B/C 与官方卡现场编译 ===')
{
	/* 用官方卡测现场编译路径：14900 德奥合并 = A+B，14903 进军莱茵兰 = A+C */
	const g = started('Episode 2')
	const own = g.current_nation
	/* 【D1/P16】摆 1 张军备卡陪跑：14900 A 段的「打出 1 张前奏手牌」现在
	 * 由玩家选牌；选中军备卡只会暗置留场，不会连锁开新窗口干扰 B 段测试。 */
	g.prelude.hands[own] = ['14900#t1', '18416#h1']
	R.action(g, g.active, 'prelude_play_hand', { card: '14900#t1' })
	ok('★★ 官方 14900 现场编译：A 段立即执行（紧张度 +1）',
		g.prelude.tension === 1, g.prelude.tension)
	ok('★★ 官方 14900 B 段建窗口（我方选付）', !!g.prelude.pending &&
		g.prelude.pending.segments[0].kind === 'optional', J(g.prelude.pending))
	if (g.prelude.op_window) {
		const ow = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
		const cand = (g.prelude.op_window.candidates || [])[0]
		if (ow && cand) R.action(g, ow, 'prelude_op_pick', { pick: cand.id })
	}
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_pay)
	ok('★ B 段答复方在白名单', !!side, side)
	R.action(g, side, 'prelude_pay', {})
	ok('★ 支付后续段代价后段执行、窗口清空', !g.prelude.pending, J(g.prelude.pending))
	const g3 = started('Episode 2')
	g3.prelude.hands[g3.current_nation].push('14903#t1')
	R.action(g3, g3.active, 'prelude_play_hand', { card: '14903#t1' })
	ok('★★ 官方 14903 C 段由卡面指定对手答复（不是打出方）',
		!!(g3.prelude.pending && g3.prelude.pending.answerNation === '英国'),
		J(g3.prelude.pending && g3.prelude.pending.answerNation))
	/*
	 * 【D1/P14】14903 的「检视前奏牌堆，选择并打出 1 张[军备卡]」收口为
	 * 单一检视选牌窗口（不再先弹顶/底 choice）；检视窗口【不可放弃】，
	 * 必须选一张牌才能轮到 C 段答复。
	 */
	if (g3.prelude && g3.prelude.op_window) {
		ok('★ A 段建立单一检视选牌 card 窗口（不可放弃）',
			g3.prelude.op_window.kind === 'card' &&
			g3.prelude.op_window.inspect === true &&
			g3.prelude.op_window.cancellable === false,
			J(g3.prelude.op_window && { kind: g3.prelude.op_window.kind,
				inspect: g3.prelude.op_window.inspect,
				cancellable: g3.prelude.op_window.cancellable }))
		let guard = 0
		while (g3.prelude && g3.prelude.op_window && guard++ < 5) {
			const ow = ['Axis', 'Allies'].find(s =>
				(R.view(g3, s).actions || {}).prelude_op_pick)
			if (!ow) break
			const cand = (g3.prelude.op_window.candidates || [])[0]
			if (!cand) break
			R.action(g3, ow, 'prelude_op_pick', { pick: cand.id })
		}
		ok('★ op 窗口全部答完后清空', !g3.prelude.op_window, J(g3.prelude.op_window))
	}
	const foe = ['Axis', 'Allies'].find(s => (R.view(g3, s).actions || {}).prelude_pay)
	ok('★★ C 段答复权在对手阵营（op 窗口答完后）', foe === 'Allies', foe)
	R.action(g3, foe, 'prelude_skip', {})
	ok('★ C 段：对手不支付 → 后续段执行', !g3.prelude.pending, J(g3.prelude.pending))
	const g4 = started('Episode 2')
	R.action(g4, g4.active, 'prelude_play_top', {})
	ok('★ 打牌堆顶的官方卡也能现场编译',
		(g4.log || []).some(l => /打出前奏牌/.test(l)), J((g4.log || []).slice(-3)))
}

console.log('\n=== E. 两个结束条件（只有两个） ===')
{
	const g = started('Episode 2')
	g.prelude.tension = 10
	/* 【D1/P11】乙口径：直接摆到卡牌阶段，点「继续」= 当前前奏回合结束 */
	g.prelude.phase = 'prelude_cards'
	R.action(g, g.active, 'prelude_next', {})
	ok('★★ 条件①：紧张度 ≥10 且当前前奏回合结束 → 结束',
		g.prelude.ended === true && /紧张度达到 10/.test(g.prelude.end_reason || ''),
		J({ ended: g.prelude.ended, reason: g.prelude.end_reason }))
	ok('★ 结束后正式局从第 1 轮干净开始',
		g.turn === 1 && g.turn_phase === 'resource' && g.current_nation === '德国',
		J({ turn: g.turn, phase: g.turn_phase, nation: g.current_nation }))
	const g2 = started('Episode 2')
	for (const n of Object.keys(g2.prelude.decks)) {
		g2.prelude.decks[n] = []
		g2.prelude.hands[n] = []
	}
	let guard = 0
	while (!g2.prelude.ended && guard++ < 40) R.action(g2, g2.active, 'prelude_next', {})
	ok('★★ 条件②：一轮结束后手牌与牌堆皆空 → 结束',
		g2.prelude.ended === true && /皆空/.test(g2.prelude.end_reason || ''),
		J({ ended: g2.prelude.ended, reason: g2.prelude.end_reason, guard: guard }))
	const g3 = started('Episode 2')
	ok('★ 紧张度未达 10 且牌堆非空时不结束', g3.prelude.ended === false)
}

console.log('\n=== F. 不执行分数/补给结算 + 静态守卫 ===')
{
	const g = started('Episode 2')
	const score0 = J(g.score)
	R.action(g, g.active, 'prelude_discard_1_1', {})
	R.action(g, g.active, 'prelude_next', {})
	ok('★ 前奏推进不触发正式计分落账', J(g.score) === score0, score0 + '→' + J(g.score))
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★ phase_scoring / phase_supply 有前奏早退守卫',
		/function phase_scoring\(game, nation, opts\) \{\s*\/\*[\s\S]{0,80}前奏期不执行分数结算/.test(src) &&
		/function phase_supply\(game, nation\) \{\s*\/\*[\s\S]{0,80}前奏期不做分数与补给结算/.test(src))
	ok('★ PHASES / PH 七常量未改', /const PH = \{[\s\S]{0,300}DRAW: 'draw'/.test(src))
	ok('★ init_nation_deck 排除判据未改',
		/c\.deck !== 'CORE' && c\.deck !== 'SUPP'/.test(src))
	ok('★ 派发器只查 PRELUDE_* 表（既有四张效果表不写入）',
		src.indexOf("'PRELUDE_EVENT_EFFECTS'") >= 0 &&
		src.indexOf("'PRELUDE_RESPONSE_EFFECTS'") >= 0 &&
		src.indexOf("'PRELUDE_ECON_EFFECTS'") >= 0 &&
		src.indexOf("'PRELUDE_STATUS_EFFECTS'") >= 0)
	const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	const vers = (html.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	/* 不写死具体 tag：每次出包/改客户端都会 bump，只校验所有 ?v= 统一且非空 */
	ok('★ play.html 版本串统一且非空',
		vers.length >= 5 && vers.every(v => v && v === vers[0]), J(vers))
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('★ 客户端面板只读 view.prelude 且按 actions 下发按钮',
		/function update_prelude_box\(\)/.test(pjs) && /view\.actions\[action\]/.test(pjs))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
