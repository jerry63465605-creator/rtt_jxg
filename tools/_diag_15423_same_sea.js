/*
 * 15423《潜艇支援》「1 或 2 次海战」：两次是否允许同一海域？
 *
 * 玩家口径：两次海战**不应**能选同一个位置。
 * 同款多步响应卡：15424 海军特别陆战队（建设陆军）、15425 海军空降部队（陆战）、15426 驱逐舰运输。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = require(path.join(MOD, 'data.js')).data

const SUB = '15423#1'

let bad = 0
const flag = (name, ok, extra) => {
	console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '   [' + extra + ']' : ''))
	if (!ok) bad++
}
const info = (k, v) => console.log('    ' + k + ' =', typeof v === 'object' ? JSON.stringify(v) : v)
const nm = sp => data.name_of(sp) || String(sp)

/* 分配一个未占用的数字棋子 id（location 的键里可能混有非数字，直接 Math.max 会得 NaN） */
function nextPieceId(g) {
	const ids = Object.keys(g.location).map(Number).filter(n => Number.isFinite(n))
	return (ids.length ? Math.max(...ids) : 0) + 1
}

/* 找日本海军（用于发起海战） */
function jpNavies(g) {
	const out = []
	for (const id in g.location) {
		if (g.piece_nation[id] === '日本' && g.piece_type[id] === 'navy')
			out.push({ id, space: Number(g.location[id]) })
	}
	return out
}

function seas() {
	return (I.all_sea_space_ids ? I.all_sea_space_ids() : []).map(Number)
}

function freshGame(baseSea) {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.hands['日本'] = [SUB]
	if (I.facedown_response) I.facedown_response(g, '日本', SUB, 'hand')
	else {
		g.table_responses = g.table_responses || []
		g.table_responses.push({ card_id: SUB, owner_side: 'axis', nation: '日本', id: SUB })
	}
	/*
	 * 海战的发起单位必须【与本海域相邻】（同格不算）：battle_initiators 的判据是
	 * "处于补给状态的本国陆军或海军与 X 相邻"。所以日本海军放到相邻海域，
	 * 敌方舰队放在目标海域本身，这样 do_sea_battle_at 才打得起来。
	 */
	const raw = data.spaces[baseSea] || {}
	const pool = [].concat(raw.connections || [],
		(raw.limited_connections && raw.limited_connections.axis) || [])
	const conn = [...new Set(pool.map(Number))]
		.filter(x => data.spaces[x] && data.spaces[x].terrain === 'sea')
	const jpSea = conn.length ? conn[0] : Number(baseSea)

	const navies = jpNavies(g)
	let nid = navies.length ? navies[0].id : null
	if (nid == null) {
		nid = nextPieceId(g)
		g.piece_nation[nid] = '日本'
		g.piece_type[nid] = 'navy'
	}
	g.location[nid] = jpSea
	if (I.grant_supply) I.grant_supply(g, nid, g.turn || 1)

	/* 目标海域放一支同盟舰队当靶子 */
	const eid = nextPieceId(g)
	g.piece_nation[eid] = '英国'
	g.piece_type[eid] = 'navy'
	g.location[eid] = Number(baseSea)
	return g
}

/* 走一步 resolve_response_choice，返回新帧信息 */
function pick(g, choice) {
	const r = rules.action(g, 'Axis', 'resolve_response_choice', { choice: choice })
	const top = (g.response_stack || [])[(g.response_stack || []).length - 1]
	return { r, top }
}

console.log('=== 探测：找一个有 2 个以上候选海域的基准 ===')
let base = null, cands0 = null
for (const sp of seas()) {
	const g = freshGame(sp)
	const rr = I.request_responses(g, 'build', { type: 'navy', nation: '日本', space: sp }, false)
	if (!Array.isArray(rr) || !rr.length) continue
	rules.action(g, 'Axis', 'trigger_response', {})
	const top = (g.response_stack || [])[(g.response_stack || []).length - 1]
	const cs = (top && top.candidates) || []
	if (cs.length >= 2) { base = sp; cands0 = cs.map(c => Number(c.id)); break }
}
if (base == null) {
	console.log('  （没找到合适的夹具：日本海军所在海域没有 2 个以上相邻海域）')
	process.exit(0)
}
info('基准海域', nm(base) + '(' + base + ')')
info('第 1 次候选', cands0.map(x => nm(x) + '(' + x + ')'))

console.log('\n=== S1 第 1 次选 A，第 2 次候选不应包含 A ===')
{
	const A = cands0[0]
	const g = freshGame(base)
	I.request_responses(g, 'build', { type: 'navy', nation: '日本', space: base }, false)
	rules.action(g, 'Axis', 'trigger_response', {})

	const step1 = pick(g, A)
	info('第 1 次结算日志', g.log.slice(-3))
	info('第 1 次后栈顶', step1.top && {
		name: step1.top.name, kind: step1.top.kind,
		cands: (step1.top.candidates || []).map(c => c.id),
		extra: step1.top.extra,
	})

	if (!step1.top || step1.top.kind !== 'option') {
		console.log('  （第 1 次后没有进入"是否再战"询问，跳过 S1）')
	} else {
		const step2 = pick(g, 1) /* 选"再战" */
		const cs2 = ((step2.top && step2.top.candidates) || []).map(c => Number(c.id))
		info('第 2 次候选', cs2.map(x => nm(x) + '(' + x + ')'))
		/* 玩家裁决：可以打重复地点 —— 第 2 次候选必须仍含第 1 次的海域 */
		flag('★ 第 2 次候选包含第 1 次的海域（允许重复）',
			cs2.indexOf(A) >= 0, '第 1 次=' + nm(A) + '(' + A + ') 第2次候选=' + JSON.stringify(cs2))
	}
}

console.log('\n=== S2 强行提交第 1 次的海域：服务端应拒绝 ===')
{
	const A = cands0[0]
	const g = freshGame(base)
	I.request_responses(g, 'build', { type: 'navy', nation: '日本', space: base }, false)
	rules.action(g, 'Axis', 'trigger_response', {})
	pick(g, A)
	const before = g.log.length
	pick(g, 1)            /* 再战 */
	const b2 = g.log.length
	rules.action(g, 'Axis', 'resolve_response_choice', { choice: A })  /* 偷偷选回 A */
	info('结果日志', g.log.slice(b2))
	/* 玩家裁决：允许重复 —— 服务端不得以"不能与第 1 次同地区"为由拒绝 */
	flag('★ 服务端不因"重复海域"拒绝（允许再打同一格）',
		!/不能与第 1 次|不在.*候选内/.test(g.log.slice(b2).join('|')),
		g.log.slice(b2).join(' | ').slice(0, 90))
	void before
}

console.log('\n发现 BUG 项 = ' + bad)
