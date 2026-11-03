/*
 * 探针：日本出牌阶段开始时，同时暗置 15434《伪满洲国》+ 15438《偷袭珍珠港》
 * 全程用真实引擎入口（rules.action）驱动，逐步打印【客户端能看到的 view】，
 * 目的是找出"客户端有控件但点了没实际效果"的环节。
 *
 * 用法：node tools/_probe_15434_15438_start.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

const CN_NE = data.id_of('中国东北')
const HI = data.id_of('夏威夷')

function put(g, pid, nation, type, space) {
	g.location[pid] = space
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
}

function clearAt(g, space) {
	for (const p in g.location)
		if (g.location[p] === space) delete g.location[p]
}

/* 夏威夷的相邻海域（用于摆日本海军） */
function nbrs(sp) {
	return (data.spaces[sp] && data.spaces[sp].connections || []).map(Number)
}

function setup(cards, opt) {
	opt = opt || {}
	const g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	/* 关键：setup() 会进初始弃牌阶段；不关掉的话 build_actions 只给 opening_discard，
	 * 响应动作一个都不下发（探针第一版就被这个假象坑过） */
	g.opening = null
	g.table_responses = cards.map((face, i) => ({
		card_id: face + '#' + (i + 1),
		card_face: face,
		nation: '日本',
		owner_side: 'axis',
		name: I.inst_card(face + '#' + (i + 1)).name,
	}))

	/* 中国东北：中国陆军（作为 15434 的消灭目标），清掉本土日本陆军避免干扰 */
	clearAt(g, CN_NE)
	put(g, 'cn1', '中国', 'army', CN_NE)

	/* 夏威夷：美国海军（作为 15438 的海战目标） */
	clearAt(g, HI)
	put(g, 'us1', '美国', 'navy', HI)

	/* 日本海军：摆在夏威夷的相邻海域，并给补给（否则 do_sea_battle_at 无发起单位） */
	if (!opt.no_navy) {
		const sea = nbrs(HI).find(s => data.spaces[s] && data.spaces[s].terrain === 'sea')
		if (sea != null) {
			clearAt(g, sea)
			put(g, 'jp_n1', '日本', 'navy', sea)
			I.grant_supply(g, 'jp_n1', g.turn || 1)
		}
	}
	I.refresh && I.refresh(g)
	return g
}

function dump(label, g) {
	const v = rules.view(g, 'Axis')
	const pt = v.pending_trigger
	const rc = v.response_choice
	const acts = v.actions ? Object.keys(v.actions) : null
	console.log('\n--- ' + label)
	console.log('  pending_trigger: ' + (pt
		? ('n=' + (pt.candidates || []).length +
			' ordered=' + !!pt.ordered +
			' names=[' + (pt.candidates || []).map(c => c.name).join(' / ') + ']' +
			' order=' + JSON.stringify(pt.order || null) +
			' skip=' + JSON.stringify(pt.skip || null))
		: 'null'))
	console.log('  response_choice: ' + (rc
		? ('kind=' + rc.kind + ' card=' + rc.name + ' n=' + (rc.candidates || []).length +
			' sample=' + JSON.stringify((rc.candidates || []).slice(0, 4)) +
			' prompt=' + (rc.prompt || ''))
		: 'null'))
	console.log('  view.actions: ' + (acts ? acts.join(', ') : 'null'))
	console.log('  stack=' + (g.response_stack || []).length +
		' queue=' + (g.response_queue || []).length +
		' deferred=' + (g.deferred_response_stack || []).length +
		' battle_in_progress=' + (g.battle_in_progress || 0) +
		' pending_battle=' + !!g.pending_battle +
		' active=' + g.active + ' cur=' + g.current_nation)
	return v
}

function act(g, action, params, label) {
	const before = (g.log || []).length
	g = rules.action(g, 'Axis', action, params || {})
	const added = (g.log || []).slice(before)
	console.log('  >> ' + action + ' ' + JSON.stringify(params || {}) +
		(added.length ? ('\n     log: ' + added.join(' | ')) : '  (无新日志)'))
	return g
}

console.log('======== 场景 1：两卡都暗置，日本出牌阶段开始 ========')
console.log('夏威夷 id=' + HI + ' terrain=' + (data.spaces[HI] && data.spaces[HI].terrain))
{
	let g = setup(['15434', '15438'])
	console.log('日本海军位置=' + g.location['jp_n1'] + '（' + data.name_of(g.location['jp_n1']) + '）')
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	dump('① play_start 触发后（客户端此刻看到的）', g)

	/* 客户端会先要求"确认结算顺序"（multi 分支） */
	g = act(g, 'response_confirm', {}, '')
	dump('② 确认结算顺序后', g)

	/* 点【发动响应】 */
	g = act(g, 'trigger_response', {}, '')
	dump('③ 发动第一张后', g)

	/* 此时应是 选目标（piece 或 space），按 kind 提交 */
	let v = rules.view(g, 'Axis')
	const rc = v.response_choice
	if (rc && rc.kind === 'piece') {
		const cand = (rc.candidates || [])[0]
		console.log('  客户端此刻可点的算子 id=' + JSON.stringify(cand && cand.id) +
			'（view.pieces 里的 id 类型=' +
			JSON.stringify((v.pieces || []).filter(p => p.id === (cand && cand.id)).map(p => p.id)) + '）')
		g = act(g, 'resolve_response_choice', { choice: cand && cand.id })
	} else if (rc && rc.kind === 'space') {
		const cand = (rc.candidates || []).find(c => c.id === HI) || (rc.candidates || [])[0]
		console.log('  客户端此刻可点的地区 id=' + JSON.stringify(cand && cand.id))
		g = act(g, 'resolve_response_choice', { choice: cand && cand.id })
	} else {
		console.log('  !! 没有 response_choice，无法继续')
	}
	dump('④ 第一张结算完', g)

	/* 第二张：还会再问一次发动 */
	v = rules.view(g, 'Axis')
	if (v.pending_trigger) {
		g = act(g, 'trigger_response', {}, '')
		dump('⑤ 发动第二张后', g)
		v = rules.view(g, 'Axis')
		const rc2 = v.response_choice
		if (rc2) {
			/* 选一个"确实有日本补给海军可发起"的候选（客户端就是这样一个个试的） */
			let cand = null
			for (const c of (rc2.candidates || [])) {
				if (rc2.kind !== 'space') { cand = c; break }
				const ini = I.battle_initiators(g, '日本', c.id)
				if (ini.length) { cand = c; break }
			}
			cand = cand || (rc2.candidates || [])[0]
			if (cand && rc2.kind === 'space') {
				const ini = I.battle_initiators(g, '日本', cand.id)
				console.log('  选中的海域=' + cand.name + ' 可发起单位=' + JSON.stringify(ini.map(x => x.id || x)))
			}
			g = act(g, 'resolve_response_choice', { choice: cand && cand.id })
			dump('⑥ 全部结算完', g)
		}
	}
}

console.log('\n\n======== 场景 2：中国东北没有敌方陆军（15434 无目标） ========')
{
	let g = setup(['15434', '15438'])
	clearAt(g, CN_NE)
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	dump('① 触发后', g)
	g = act(g, 'response_confirm', {}, '')
	g = act(g, 'trigger_response', {}, '')
	dump('② 发动 15434（本格无敌方陆军）', g)
	const v = rules.view(g, 'Axis')
	if (v.response_choice) {
		const cand = (v.response_choice.candidates || [])[0]
		g = act(g, 'resolve_response_choice', { choice: cand && cand.id })
		dump('③ 结算后', g)
	} else {
		console.log('  → 直接 ok 结算（无候选，不发 response_choice）')
	}
}

console.log('\n\n======== 场景 3：日本没有任何可发起海战的海军（15438 选完地区会失败） ========')
{
	let g = setup(['15438'], { no_navy: true })
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	dump('① 触发后', g)
	g = act(g, 'trigger_response', {}, '')
	dump('② 发动后（有地区候选，但无发起单位）', g)
	const v = rules.view(g, 'Axis')
	if (v.response_choice) {
		const cand = (v.response_choice.candidates || []).find(c => c.id === HI) ||
			(v.response_choice.candidates || [])[0]
		g = act(g, 'resolve_response_choice', { choice: cand && cand.id })
		dump('③ 选完地区后', g)
	}
}

console.log('\n\n======== 场景 4：海战目标格有美国空军 -> 防守方代受询问 ========')
{
	let g = setup(['15438'])
	/* 在日本海军（中太平洋 28）之外，把美国海军 + 空军放到【北太平洋 49】，
	 * 让 15438 选 49 时真的打起来（有守军 + 有可代受的空军） */
	const TARGET = 49
	put(g, 'us_n2', '美国', 'navy', TARGET)
	put(g, 'us_a2', '美国', 'air', TARGET)
	I.refresh && I.refresh(g)

	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	dump('① 触发后', g)
	g = act(g, 'trigger_response', {}, '')
	dump('② 发动后', g)
	const v = rules.view(g, 'Axis')
	const cand = (v.response_choice && v.response_choice.candidates || [])
		.find(c => c.id === TARGET) || { id: TARGET }
	g = act(g, 'resolve_response_choice', { choice: cand.id })
	dump('③ 日本选完海域（战斗挂起时）', g)
	console.log('  —— 防守方（同盟）视角 ——')
	const va = rules.view(g, 'Allies')
	console.log('  Allies pending_battle=' + (va.pending_battle
		? (va.pending_battle.space_name || va.pending_battle.space) : 'null') +
		' actions=' + (va.actions ? Object.keys(va.actions).join(', ') : 'null'))
	/* 日本侧此刻还能不能再点一次地区（重复提交） */
	const vj = rules.view(g, 'Axis')
	console.log('  Axis 此刻 response_choice=' + (vj.response_choice ? vj.response_choice.name : 'null') +
		' actions=' + (vj.actions ? Object.keys(vj.actions).join(', ') : 'null'))
}

console.log('\n\n======== 场景 5：排序 + 跳过/恢复（跳过 = 本次移出本组） ========')
{
	let g = setup(['15434', '15438'])
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	dump('① 触发后', g)
	g = act(g, 'response_reorder', { order: ['15438#2', '15434#1'] })
	dump('② 排序后（客户端 ↑/↓ 按钮发出的动作）', g)
	g = act(g, 'response_reorder', { order: ['15438#2', '15434#1'], skip: ['15434#1'] })
	dump('③ 点「跳过」15434 后（skip 数组随 reorder 上送）', g)
	g = act(g, 'response_reorder', { order: ['15438#2', '15434#1'], skip: [] })
	dump('④ 点「恢复」后', g)
}

/* ---------- 新口径断言 ---------- */
let fail = 0
function chk(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}
function pt(g) { return rules.view(g, 'Axis').pending_trigger }

console.log('\n\n======== 场景 6：逐张询问（发动1 走完 -> 才问 2） ========')
{
	let g = setup(['15434', '15438'])
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	chk('触发后 current = 15434#1', pt(g) && pt(g).current === '15434#1', JSON.stringify(pt(g) && pt(g).current))
	g = act(g, 'response_confirm', {}, '')
	chk('确认后 current 仍是 15434#1', pt(g) && pt(g).current === '15434#1', JSON.stringify(pt(g) && pt(g).current))
	chk('确认后整组 2 张都还在', pt(g) && pt(g).candidates.length === 2)

	g = act(g, 'trigger_response', {}, '')
	chk('发动 15434 -> 进入选目标（kind=piece）',
		!!(rules.view(g, 'Axis').response_choice &&
			rules.view(g, 'Axis').response_choice.kind === 'piece'))
	/* 关键：此时 15438 绝不能被自动执行 */
	chk('15438 仍在桌面且未消耗',
		(g.table_responses || []).some(r => r.card_face === '15438'))
	g = act(g, 'resolve_response_choice', { choice: 'cn1' })
	const v6 = rules.view(g, 'Axis')
	chk('15434 结算后：15438 仍在排队等询问',
		!!v6.pending_trigger && v6.pending_trigger.current === '15438#2',
		JSON.stringify(v6.pending_trigger && v6.pending_trigger.current))
	chk('15434 已消耗（离开桌面）', !(g.table_responses || []).some(r => r.card_face === '15434'))
	/* 第二张仍要显式发动 */
	g = act(g, 'trigger_response', {}, '')
	const v6b = rules.view(g, 'Axis')
	chk('发动第二张 -> 选海域（kind=space）',
		!!(v6b.response_choice && v6b.response_choice.kind === 'space'))
}

console.log('\n\n======== 场景 7：不发动只丢当前一张 ========')
{
	let g = setup(['15434', '15438'])
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	g = act(g, 'response_confirm', {}, '')
	g = act(g, 'pass_response', {}, '')
	const v7 = rules.view(g, 'Axis')
	chk('只丢 1 张：剩下 15438 仍在等询问',
		!!v7.pending_trigger && v7.pending_trigger.current === '15438#2',
		JSON.stringify(v7.pending_trigger && v7.pending_trigger.current))
	chk('被放弃的 15434 仍留在桌面（未发动 = 不消耗）',
		(g.table_responses || []).some(r => r.card_face === '15434'))
	chk('操作权仍在本方（Axis）', g.active === 'Axis', String(g.active))
	g = act(g, 'pass_response', {}, '')
	const v7b = rules.view(g, 'Axis')
	chk('两张都不发动后响应窗口清空', !v7b.pending_trigger)
	chk('15438 也仍在桌面', (g.table_responses || []).some(r => r.card_face === '15438'))
	chk('栈与队列均已清空',
		(g.response_stack || []).length === 0 && (g.response_queue || []).length === 0)
}

console.log('\n\n======== 场景 8：全部跳过（pass_response all:true） ========')
{
	let g = setup(['15434', '15438'])
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	g = act(g, 'pass_response', { all: true }, '')
	const v8 = rules.view(g, 'Axis')
	chk('整组一次放弃：响应窗口清空', !v8.pending_trigger)
	chk('两张都留在桌面',
		(g.table_responses || []).filter(r => ['15434', '15438'].indexOf(r.card_face) >= 0).length === 2)
	chk('栈已清空', (g.response_stack || []).length === 0)
}

console.log('\n\n======== 场景 9：第一张"秒结算"也不会把第二张一起带走 ========')
{
	/* 15433《皖南事变》= 消灭 1 支中国陆军（不限地区）。把场上中国陆军全部清掉
	 * => 本卡没有合法目标，effect 立即返回 ok（不需要选目标）。
	 * 旧实现会在同一次 trigger 里继续执行 15438 并直接进入"选海域"；
	 * 新口径必须停在"待发动"，让玩家单独决定 15438 是否发动。 */
	let g = setup(['15433', '15438'])
	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] === '中国' && g.piece_type[p] === 'army')
			delete g.location[p]
	}
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	g = act(g, 'response_confirm', {}, '')
	g = act(g, 'trigger_response', {}, '')
	const v9 = rules.view(g, 'Axis')
	chk('15433 已消耗', !(g.table_responses || []).some(r => r.card_face === '15433'))
	chk('没有直接进入 15438 的选目标', !v9.response_choice)
	chk('15438 仍在"待发动"等询问',
		!!v9.pending_trigger && v9.pending_trigger.current === '15438#2',
		JSON.stringify(v9.pending_trigger && v9.pending_trigger.current))
}

console.log('\n\n======== 场景 10：跳过一张后确认 —— 被跳过的卡不再询问 ========')
{
	let g = setup(['15434', '15438'])
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	g = act(g, 'response_reorder', { order: ['15434#1', '15438#2'], skip: ['15434#1'] })
	const v10a = rules.view(g, 'Axis')
	chk('view.pending_trigger.skip 回显（客户端据此显示"（跳过）"）',
		!!(v10a.pending_trigger && v10a.pending_trigger.skip['15434#1']),
		JSON.stringify(v10a.pending_trigger && v10a.pending_trigger.skip))
	chk('current 跳过被跳过的卡 -> 指向 15438',
		!!(v10a.pending_trigger && v10a.pending_trigger.current === '15438#2'),
		JSON.stringify(v10a.pending_trigger && v10a.pending_trigger.current))

	g = act(g, 'response_confirm', {}, '')
	const v10 = rules.view(g, 'Axis')
	chk('确认后只剩 15438 待询问',
		!!v10.pending_trigger && v10.pending_trigger.candidates.length === 1 &&
		v10.pending_trigger.current === '15438#2',
		JSON.stringify(v10.pending_trigger && {
			n: v10.pending_trigger.candidates.length, cur: v10.pending_trigger.current,
		}))
	chk('被跳过的 15434 已移出本组（栈里没有它）',
		!(g.response_stack || []).some(f => f.card_id === '15434#1'))
	chk('15434 仍留在桌面（未消耗）',
		(g.table_responses || []).some(r => r.card_face === '15434'))
	/* 只剩一张：发动后直接进选海域，不会再冒出 15434 */
	g = act(g, 'trigger_response', {}, '')
	const v10c = rules.view(g, 'Axis')
	chk('发动 15438 进入选海域',
		!!(v10c.response_choice && v10c.response_choice.kind === 'space'))
}

console.log('\n\n======== 场景 11：两张都跳过 -> 确认后窗口关闭、卡都留桌面 ========')
{
	let g = setup(['15434', '15438'])
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	g = act(g, 'response_reorder', { order: ['15434#1', '15438#2'], skip: ['15434#1', '15438#2'] })
	g = act(g, 'response_confirm', {}, '')
	const v11 = rules.view(g, 'Axis')
	chk('响应窗口清空', !v11.pending_trigger)
	chk('两张都留在桌面',
		(g.table_responses || []).filter(r => ['15434', '15438'].indexOf(r.card_face) >= 0).length === 2)
	chk('栈清空', (g.response_stack || []).length === 0)
	chk('操作权在本方（Axis）', g.active === 'Axis', String(g.active))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0


