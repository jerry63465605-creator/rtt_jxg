/*
 * 回归：响应卡的"候选地区"必须与执行端同源（能点的 == 能成功的）
 *
 * 背景（2026-10-28 玩家反馈）：15426《驱逐舰运输》在<北太平洋>海战后给出的相邻陆地候选
 * 是 海参崴/阿拉斯加/硫磺岛/夏威夷，其中只有海参崴能建 —— 选另外三个，effect 里
 * build_piece 失败、只留一行日志，客户端仍提示"已结算"。
 * 同类问题：15419 / 15423 / 15424 / 15425 / 15427 / 15431 / 15438。
 *
 * 修法：pick_space_then 支持 opt.act，用 step_space_candidates（can_build_at /
 * can_recruit_at / battle_initiators）把候选收窄。本脚本逐张卡校验：
 *   每个候选都必须通过"执行端那一套判定"。
 *
 * 用法：node tools/_smoke_cand_legality.js
 */
const path = require('path')
const rules = require(path.resolve(__dirname, '..',
	'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const data = I.data

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m + (extra ? '  ' + extra : '')) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  ' + extra : '')) }
}

const EAST = data.id_of('东海')
const MID = data.id_of('中太平洋')
const NORTH = data.id_of('北太平洋')
const IWO = data.id_of('硫磺岛')
const CN_E = data.id_of('中国东部')

function board() {
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'play'; g.turn = 1
	g.opening = null
	const clear = sp => { for (const p in g.location) if (g.location[p] === sp) delete g.location[p] }
	clear(EAST); clear(MID); clear(IWO); clear(NORTH); clear(CN_E)
	const put = (pid, nat, type, sp) => {
		g.location[pid] = sp; g.piece_nation[pid] = nat; g.piece_type[pid] = type
	}
	put('jp_e', '日本', 'navy', EAST)
	put('jp_m', '日本', 'navy', MID)
	put('jp_i', '日本', 'army', IWO)
	put('us_n', '美国', 'navy', NORTH)
	put('cn_1', '中国', 'army', CN_E)
	I.grant_supply(g, 'jp_e', 1)
	I.grant_supply(g, 'jp_m', 1)
	I.grant_supply(g, 'jp_i', 1)
	I.refresh && I.refresh(g)
	return g
}

const CASES = [
	{ face: '15426', name: '驱逐舰运输', ctx: { nation: '日本', space: NORTH, kind: 'sea' }, check: 'build_army' },
	{ face: '15424', name: '海军特别陆战队', ctx: { nation: '日本', space: EAST, kind: 'build' }, check: 'build_army' },
	{ face: '15423', name: '潜艇支援', ctx: { nation: '日本', space: EAST, kind: 'build' }, check: 'battle_sea' },
	{ face: '15425', name: '海军空降部队', ctx: { nation: '日本', space: EAST, kind: 'build' }, check: 'battle_land' },
	{ face: '15419', name: '（陆战后追加陆战）', ctx: { nation: '日本', space: CN_E, kind: 'land' }, check: 'battle_land' },
	{ face: '15431', name: '全面侵华', ctx: { nation: '日本', space: CN_E, kind: 'land' }, check: 'battle_land' },
	{ face: '15438', name: '偷袭珍珠港', ctx: { nation: '日本' }, check: 'battle_sea' },
	{ face: '15427', name: '机动舰队', ctx: { nation: '日本' }, check: 'recruit_navy' },
]

function whyNot(g, sp, check) {
	if (check === 'build_army') {
		const a = I.can_build_at(g, '日本', Number(sp), 'army')
		if (!a.ok) return a.reason || '不能建设陆军'
		const s = I.unit_slot_free(g, '日本', 'army', Number(sp))
		if (!s.ok) return s.reason || '槽位已满'
		return null
	}
	if (check === 'recruit_navy') {
		const a = I.can_recruit_at(g, '日本', Number(sp), 'navy')
		if (!a.ok) return a.reason || '不能征召海军'
		const s = I.unit_slot_free(g, '日本', 'navy', Number(sp))
		if (!s.ok) return s.reason || '槽位已满'
		return null
	}
	/* battle */
	if (!I.battle_initiators(g, '日本', Number(sp)).length) return '无可发起战斗的相邻补给部队'
	return null
}

console.log('\n=== 响应卡候选 × 执行端同源校验 ===')
for (const c of CASES) {
	const g = board()
	const impl = I.RESPONSE_EFFECT_IMPL[c.face]
	if (typeof impl !== 'function') { ok(c.face + ' impl 存在', false); continue }
	let r
	try { r = impl(g, 'axis', c.ctx, undefined) }
	catch (e) { ok(c.face + ' ' + c.name + ' 不抛异常', false, e.message); continue }
	if (!r || (!r.pending && !r.ok)) { ok(c.face + ' 返回结构合法', false, JSON.stringify(r)); continue }
	if (!r.pending) {
		/* 直接结束（无候选）也是合法结果 */
		console.log('  ·  ' + c.face + ' ' + c.name + '：无候选，直接结束（' + (r.desc || '') + '）')
		continue
	}
	const cands = r.candidates || []
	const bad = cands.filter(x => whyNot(g, x.id, c.check))
	ok(c.face + ' ' + c.name + '：' + cands.length + ' 个候选全部可执行',
		bad.length === 0,
		bad.length ? ('不可执行=' + bad.map(x => x.name + '(' + whyNot(g, x.id, c.check) + ')').join(' / '))
			: ('[' + cands.map(x => x.name).join(', ') + ']'))
}

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
