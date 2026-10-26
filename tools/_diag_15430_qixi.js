/*
 * 15430《奇袭》—— 候选不应限定"相邻"
 *
 * 卡面：「发起海战后：发起 1 次海战，发起 1 次陆战。」**没有"相邻"字样**。
 * 旧实现以 ctx.space（刚打完的那场海战地区）为 base 取相邻，把可打范围压成"那一格旁边"，
 * 玩家反馈"奇袭应该没相邻的需求"。
 *
 * 本脚本断言：
 *   ① 第 1 步（选海域）候选里存在【与 ctx.space 不相邻】的海域；
 *   ② 陆战步候选里同样存在与"奇袭海战地区"不相邻的陆地。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = require(path.join(MOD, 'data.js')).data

const IMPL = I.RESPONSE_EFFECT_IMPL
const QIXI = '15430'

let bad = 0
const flag = (name, ok, extra) => {
	console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '   [' + extra + ']' : ''))
	if (!ok) bad++
}
const info = (k, v) => console.log('    ' + k + ' =', typeof v === 'object' ? JSON.stringify(v) : v)
const nm = sp => data.name_of(sp) || String(sp)

function nextPieceId(g) {
	const ids = Object.keys(g.location).map(Number).filter(n => Number.isFinite(n))
	return (ids.length ? Math.max(...ids) : 0) + 1
}

function seas() { return I.all_sea_space_ids().map(Number) }
function lands() {
	const out = []
	for (let i = 1; i < data.spaces.length; i++) {
		const s = data.spaces[i]
		if (s && s.terrain === 'land') out.push(i)
	}
	return out
}

/* 日本海军铺开在若干相隔很远的海域，保证"全图"有多个可发起海战的位置 */
function freshGame(ctxSea) {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'

	const all = seas()
	/* 取 3 个尽量分散的海域（首、中、尾），确保不全在 ctxSea 的相邻圈里 */
	const picks = [...new Set([all[0], all[Math.floor(all.length / 2)], all[all.length - 1]])]
		.filter(sp => sp !== ctxSea)
	info('日本海军布置海域', picks.map(x => nm(x) + '(' + x + ')'))
	for (const sp of picks) {
		const id = nextPieceId(g)
		g.piece_nation[id] = '日本'
		g.piece_type[id] = 'navy'
		g.location[id] = sp
		I.grant_supply(g, id, 1)
	}
	/* 每个海域放一支同盟舰队当靶子，避免"无敌军打不了" */
	for (const sp of picks) {
		const id = nextPieceId(g)
		g.piece_nation[id] = '英国'
		g.piece_type[id] = 'navy'
		g.location[id] = sp
	}
	return g
}

const ctxSea = 8 /* 波罗的海：相邻海域很少，最能暴露"限相邻"的实现 */
const g = freshGame(ctxSea)
const ctx = { nation: '日本', space: ctxSea }
const adj = new Set([ctxSea].concat(I.get_connections(g, ctxSea, 'axis').map(Number)))
info('ctx.space', nm(ctxSea) + '(' + ctxSea + ')，其相邻圈', [...adj].map(nm))

console.log('\n=== S1 第 1 步（选海域）候选应覆盖全图，不只 ctx.space 的相邻 ===')
{
	const r = IMPL[QIXI](g, 'axis', ctx, undefined)
	const ids = (r && r.candidates || []).map(c => Number(c.id))
	info('候选', ids.map(x => nm(x) + '(' + x + ')'))
	flag('返回 pending(space)', !!(r && r.pending && r.kind === 'space'), r && r.kind)
	flag('候选非空', ids.length > 0, '候选数=' + ids.length)

	const outside = ids.filter(x => !adj.has(x))
	flag('★ 候选含【不与 ctx.space 相邻】的海域（证明不限相邻）',
		outside.length > 0,
		'圈外候选=' + JSON.stringify(outside.map(x => nm(x) + '(' + x + ')')))
	info('候选里有多少在 ctx.space 相邻圈内', ids.filter(x => adj.has(x)).length)
}

console.log('\n=== S2 陆战步候选也应覆盖全图 ===')
{
	/* 选一个候选海域发起海战，进入陆战步 */
	const r1 = IMPL[QIXI](g, 'axis', ctx, undefined)
	const seaId = (r1.candidates || []).length ? Number(r1.candidates[0].id) : null
	if (seaId == null) {
		console.log('  （第 1 步无候选，跳过）')
	} else {
		const r2 = IMPL[QIXI](g, 'axis', ctx, seaId, { step: 'sea' })
		info('海战步返回', r2 && { defer: !!r2.defer, pending: !!r2.pending, desc: r2.desc })
		const landIds = (r2 && r2.candidates || []).map(c => Number(c.id))
		info('陆战候选', landIds.map(x => nm(x)))
		if (!landIds.length) {
			console.log('  （无陆战候选，跳过 S2 断言）')
		} else {
			const seaAdj = new Set([seaId].concat(I.get_connections(g, seaId, 'axis').map(Number)))
			const outside = landIds.filter(x => !seaAdj.has(x))
			flag('★ 陆战候选含【不与奇袭海战地区相邻】的陆地',
				outside.length > 0,
				'圈外=' + JSON.stringify(outside.slice(0, 6).map(x => nm(x))))
		}
	}
}

console.log('\n发现 BUG 项 = ' + bad)
