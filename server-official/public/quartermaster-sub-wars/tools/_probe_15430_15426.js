/*
 * 探针：15430《奇袭》+ 15426《驱逐舰运输》同点触发（日本对<北太平洋>发起海战）
 *
 * 盘面（按玩家给定）：
 *   · <东海>      日本海军（补给）
 *   · <中太平洋>  日本海军（补给）
 *   · <硫磺岛>    日本陆军（补给）
 *   · <北太平洋>  美国海军（海战目标，非空打）
 *
 * 目的：验证「确认顺序 → 逐张询问 → 发动/不发动 → 选目标」这条新交互在
 *      「多步/延期（defer）」响应卡组合下是否仍然自洽 —— 尤其是
 *      15430 的陆战步要 defer 到「海战后响应」结算完之后再回来问。
 *
 * 用法：node tools/_probe_15430_15426.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

const EAST = data.id_of('东海')
const MID = data.id_of('中太平洋')
const IWO = data.id_of('硫磺岛')
const NORTH = data.id_of('北太平洋')

function put(g, pid, nation, type, space) {
	g.location[pid] = space
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
}
function clearAt(g, space) {
	for (const p in g.location)
		if (g.location[p] === space) delete g.location[p]
}

function setup(cards) {
	const g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.opening = null
	g.table_responses = cards.map((face, i) => ({
		card_id: face + '#' + (i + 1),
		card_face: face,
		nation: '日本',
		owner_side: 'axis',
		name: I.inst_card(face + '#' + (i + 1)).name,
	}))
	clearAt(g, EAST); clearAt(g, MID); clearAt(g, IWO); clearAt(g, NORTH)
	put(g, 'jp_e', '日本', 'navy', EAST)
	put(g, 'jp_m', '日本', 'navy', MID)
	put(g, 'jp_i', '日本', 'army', IWO)
	put(g, 'us_n', '美国', 'navy', NORTH)
	I.grant_supply(g, 'jp_e', g.turn || 1)
	I.grant_supply(g, 'jp_m', g.turn || 1)
	I.grant_supply(g, 'jp_i', g.turn || 1)
	I.refresh && I.refresh(g)
	return g
}

function board(g) {
	const out = []
	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] !== '日本') continue
		const t = g.piece_type[p] === 'army' ? '陆' : g.piece_type[p] === 'navy' ? '海'
			: g.piece_type[p] === 'air' ? '空' : g.piece_type[p]
		out.push(data.name_of(g.location[p]) + ':' + t)
	}
	const us = Object.keys(g.location)
		.filter(p => g.piece_nation[p] === '美国')
		.map(p => data.name_of(g.location[p]) + ':' + g.piece_type[p])
	return '日本=' + (out.sort().join(' ') || '（无）') +
		' | 美国=' + (us.join(' ') || '（无）')
}

/* 自动推进：确认顺序 -> 逐张询问 -> 选目标，直到没有响应窗口 */
function run(g, opt) {
	opt = opt || {}
	const steps = []
	let guard = 0
	while (guard++ < 40) {
		const v = rules.view(g, 'Axis')
		if (opt.trace) {
			steps.push('    · stack=[' + (g.response_stack || []).map(f => f.card_face + (f.pending ? '*' : '')).join(',') +
				'] deferred=[' + (g.deferred_response_stack || []).map(f => f.card_face + ':' + (f.extra && f.extra.step || '')).join(',') + ']')
		}
		if (v.response_choice) {
			const rc = v.response_choice
			let pick = opt.pick ? opt.pick(rc, g) : (rc.candidates || [])[0]
			if (!pick) { steps.push('  !! 《' + rc.name + '》无候选，停住'); break }
			const nm = pick.name || data.name_of(pick.id) || String(pick.id)
			steps.push('  选目标《' + rc.name + '》' + (rc.kind === 'option' ? '' : rc.kind + ' ') + nm)
			g = rules.action(g, 'Axis', 'resolve_response_choice', { choice: pick.id != null ? pick.id : pick })
			continue
		}
		const pt = v.pending_trigger
		if (!pt) break
		const cands = pt.candidates || []
		if (cands.length > 1 && !pt.ordered) {
			if (opt.order) {
				g = rules.action(g, 'Axis', 'response_reorder', { order: opt.order, skip: opt.skip || [] })
				steps.push('  排序 order=' + JSON.stringify(opt.order) +
					(opt.skip && opt.skip.length ? ' 跳过=' + JSON.stringify(opt.skip) : ''))
			} else if (opt.skip && opt.skip.length) {
				g = rules.action(g, 'Axis', 'response_reorder', { order: pt.order, skip: opt.skip })
				steps.push('  跳过=' + JSON.stringify(opt.skip))
			}
			g = rules.action(g, 'Axis', 'response_confirm', {})
			steps.push('  确认顺序（剩 ' + ((rules.view(g, 'Axis').pending_trigger || {}).candidates || []).length + ' 张待问）')
			continue
		}
		const curId = pt.current || (pt.order && pt.order[0])
		const cur = cands.find(c => c.card_id === curId) || cands[0]
		const wasSkipped = !!(opt.skip && opt.skip.indexOf(cur.card_id) >= 0)
		const want = opt.trigger ? opt.trigger(cur, g) : true
		steps.push('  ' + (wasSkipped ? '⚠ 被跳过的卡再次被问：' : '') +
			(want ? '发动' : '不发动') + '《' + cur.name + '》' +
			(cands.length > 1 ? '（还有 ' + (cands.length - 1) + ' 张）' : ''))
		g = rules.action(g, 'Axis', want ? 'trigger_response' : 'pass_response', {})
	}
	return { g, steps }
}

function report(title, opt, g0) {
	const { g, steps } = run(g0, opt)
	console.log('\n===== ' + title + ' =====')
	for (const s of steps) console.log(s)
	console.log('  结果：' + board(g))
	console.log('  stack=' + (g.response_stack || []).length +
		' deferred=' + (g.deferred_response_stack || []).length +
		' queue=' + (g.response_queue || []).length +
		' pending_battle=' + !!g.pending_battle +
		' active=' + g.active)
	const newLog = (g.log || []).filter(l => /【响应】|响应|陆战|海战|陆军/.test(l)).slice(-6)
	for (const l of newLog) console.log('    log: ' + l)
	return { g, steps }
}

function start(cards) {
	const g = setup(cards)
	/* 真实引擎路径：等价于 do_sea_battle_at(g, 北太平洋, '日本')
	 * （_internal 没导出 do_sea_battle_at，这里照它的实现调 do_battle；
	 *   do_battle 内部会 request_responses('battle') 触发两张响应卡） */
	const inits = I.battle_initiators(g, '日本', NORTH)
	console.log('\n[可发起单位] ' + JSON.stringify(inits.map(x => x.id || x)))
	const r = I.do_battle(g, '日本', NORTH, null, 'sea', { from: inits[0] && inits[0].id })
	console.log('[发起海战] ok=' + r.ok + ' ' + (r.reason || r.desc || ''))
	return g
}

/* ---------- 路径 A：15430 先、15426 后，都发动，15426 只建 1 支 ---------- */
report('A. order=[15430,15426]，两张都发动，15426 选「完成（共1支）」', {
	order: ['15430#1', '15426#2'],
	trace: true,
	trigger: () => true,
	pick: (rc, g) => {
		if (rc.kind === 'space' && rc.name === '奇袭') {
			const first = (rc.candidates || [])[0]
			/* 海战步优先选<北太平洋>；陆战步选第一个陆地 */
			const north = (rc.candidates || []).find(c => c.id === NORTH)
			return /海战/.test(rc.prompt) ? (north || first) : first
		}
		if (rc.kind === 'option') return (rc.candidates || []).find(c => c.id === 0) || rc.candidates[0]
		return (rc.candidates || [])[0]
	},
}, start(['15430', '15426']))

/* ---------- 路径 B：15426 先、15430 后 ---------- */
report('B. order=[15426,15430]，两张都发动', {
	order: ['15426#2', '15430#1'],
	trigger: () => true,
	pick: (rc) => {
		if (rc.kind === 'option') return (rc.candidates || []).find(c => c.id === 0) || rc.candidates[0]
		const north = (rc.candidates || []).find(c => c.id === NORTH)
		return /海战/.test(rc.prompt || '') ? (north || rc.candidates[0]) : rc.candidates[0]
	},
}, start(['15430', '15426']))

/* ---------- 路径 C：跳过 15430，只发动 15426（选海参崴，建 1 支） ---------- */
report('C. 跳过 15430，只发动 15426（选<海参崴>建 1 支、第 2 支选「完成」）', {
	skip: ['15430#1'],
	trigger: () => true,
	pick: (rc) => {
		const cands = rc.candidates || []
		console.log('    候选：' + cands.map(c => c.name || c.id).join(' / '))
		if (rc.kind === 'option') return cands.find(c => c.id === 0) || cands[0]
		return cands.find(c => c.name === '海参崴') || cands[0]
	},
}, start(['15430', '15426']))

/* ---------- 路径 D：跳过 15426，只发动 15430 ---------- */
report('D. 跳过 15426，只发动 15430（海战 + 陆战两步）', {
	skip: ['15426#2'],
	trigger: () => true,
	pick: (rc) => {
		const north = (rc.candidates || []).find(c => c.id === NORTH)
		return /海战/.test(rc.prompt || '') ? (north || rc.candidates[0]) : rc.candidates[0]
	},
}, start(['15430', '15426']))

/* ---------- 路径 E：两张都跳过 ---------- */
report('E. 两张都跳过（确认后窗口应关闭，卡留桌面）', {
	skip: ['15430#1', '15426#2'],
	trigger: () => true,
}, start(['15430', '15426']))

/* ---------- 路径 F：15430 先，15426 选「再建 2 支」（观察 defer 交错） ---------- */
const f = report('F. order=[15430,15426]，15426 选「再建 1 支」（defer 交错）', {
	order: ['15430#1', '15426#2'],
	trace: true,
	trigger: () => true,
	pick: (rc) => {
		if (rc.kind === 'option') return (rc.candidates || []).find(c => c.id === 1) || rc.candidates[0]
		const north = (rc.candidates || []).find(c => c.id === NORTH)
		return /海战/.test(rc.prompt || '') ? (north || rc.candidates[0]) : rc.candidates[0]
	},
}, start(['15430', '15426']))
console.log('  两卡是否都已消耗：' + (f.g.table_responses || []).map(r => r.card_face).join(',') || '（桌面已空）')
