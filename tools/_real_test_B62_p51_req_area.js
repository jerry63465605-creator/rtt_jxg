/*
 * 【B62】17505《P-51 野马》的「要求地区」改为读轰炸卡自己的声明（req）。
 *
 * 玩家报障（2026-11-27）：「野马应有 3 单位 -6 实际 -2」。
 *
 * 根因：卡面是「其【要求地区】内每有 1 支美国空军，损耗数加 2」，
 * 但旧代码里「要求地区」有【两份事实来源】：
 *   · 每张轰炸卡在 run() 里手写 { space: '日本', radius: bombing_radius(game, 3), ... }
 *   · P-51 在 p51_air_in_required_area() 另写 effective_home_base(target) + **2 环**
 * 17521 要求 <日本> **3 环** -> P-51 按 2 环数 -> 3 支里只数到 1 支 -> 只 -2。
 * 另外 17515/17517/17518/17521 手写【固定格名】，P-51 用 effective_home_base
 * （尊重迁都）-> 迁都时两者算的不是同一片地区。
 *
 * 修法：把「要求地区」提升为声明式 `req`（每张卡一次），
 *   run / targets_fn 的前置判定与 P-51 的空军计数都读它（econ_req_area），
 *   17542 的 +1 只在 bombing_radius 里生效一次。
 *   P-51 只借「地区范围」：不继承 req.types、不继承 req.supplied（玩家口径：不要求）。
 *
 * 用法：node tools/_real_test_B62_p51_req_area.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

function seed(extra) {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	if (extra) extra(g)
	return g
}
const MLB = D.id_of('日本')

/* 日本大本营 + r 环内的格集合（用真实 region_spaces） */
function ringSpaces(g, radius) {
	return I.region_spaces(g, { space: MLB, radius: radius })
}

console.log('=== A. 17521（<日本>3 环）：3 支美军空军应 -6（修复前 -2）===')
{
	const g = seed()
	const r2 = new Set(ringSpaces(g, 2))
	const r3only = ringSpaces(g, 3).filter(sp => !r2.has(sp))
	ok('★ 前提：3 环外圈存在可用格', r3only.length >= 2, J(r3only.length))
	/* 1 支在 2 环内、2 支只在 3 环 -> 旧口径只数到 1 支 */
	const inner = Array.from(r2)[0]
	g.location.a1 = inner; g.piece_nation.a1 = '美国'; g.piece_type.a1 = 'air'
	g.location.a2 = r3only[0]; g.piece_nation.a2 = '美国'; g.piece_type.a2 = 'air'
	g.location.a3 = r3only[1]; g.piece_nation.a3 = '美国'; g.piece_type.a3 = 'air'

	ok('★★ p51 数到 3 支（按 17521 的 3 环）',
		I.p51_air_in_required_area(g, '日本', '17521#c1') === 3,
		J(I.p51_air_in_required_area(g, '日本', '17521#c1')))
	ok('★★ 不传 cardId 时退回旧口径（2 环 -> 1 支）',
		I.p51_air_in_required_area(g, '日本') === 1,
		J(I.p51_air_in_required_area(g, '日本')))

	const ar = I.ECHO_EFFECTS['17505'].armed
	const ctx = {
		nation: '美国', tag: '轰炸行动', card: '17521#c1',
		targets: ['日本'], attrited: { '日本': 1 },
	}
	ok('★★ ready = true', ar.ready(g, ctx) === true)
	const r = ar.run(g, ctx)
	ok('★★ run 追加损耗 6 张（2 × 3 支空军）', r && r.ok && /共 6 张/.test(r.desc || ''), J(r.desc))
	ok('★ desc 写明 3 支空军', /3 支空军/.test(r && r.desc || ''), J(r.desc))
}

console.log('\n=== B. 17542《空中堡垒》在场：两边同向 +1，仍应 -6 ===')
{
	const g = seed(gg => { gg.table['美国'] = ['17542#s1'] })
	const r3 = ringSpaces(g, 3)
	/* 3 支都放在 3 环外边界（17542 后要求变 4 环） */
	const r4only = ringSpaces(g, 4).filter(sp => !new Set(r3).has(sp))
	const inner = r3[0]
	g.location.b1 = inner; g.piece_nation.b1 = '美国'; g.piece_type.b1 = 'air'
	for (let i = 0; i < 2; i++) {
		g.location['b' + (i + 2)] = r4only[i]; g.piece_nation['b' + (i + 2)] = '美国'; g.piece_type['b' + (i + 2)] = 'air'
	}
	ok('★★ 有 17542 时按 4 环数到 3 支',
		I.p51_air_in_required_area(g, '日本', '17521#c1') === 3,
		J(I.p51_air_in_required_area(g, '日本', '17521#c1')))
	const ar = I.ECHO_EFFECTS['17505'].armed
	const r = ar.run(g, { nation: '美国', tag: '轰炸行动', card: '17521#c1', targets: ['日本'], attrited: { '日本': 1 } })
	ok('★★ 仍追加 6 张', r && /共 6 张/.test(r.desc || ''), J(r.desc))
}

console.log('\n=== C. 不继承 supplied / types（17521 要求「补给中的海军」，P-51 只数空军）===')
{
	const g = seed()
	const sp = ringSpaces(g, 3)[0]
	g.location.c1 = sp; g.piece_nation.c1 = '美国'; g.piece_type.c1 = 'air'
	ok('★★ P-51 把空军算进去（不继承 17521 的 types=navy）',
		I.p51_air_in_required_area(g, '日本', '17521#c1') >= 1,
		J(I.p51_air_in_required_area(g, '日本', '17521#c1')))
	ok('★ 17521 自己的前置判定仍要求「海军」（此处只有空军 -> 0）',
		I.econ_req_count(g, '17521#c1', '日本') === 0,
		J(I.econ_req_count(g, '17521#c1', '日本')))
	/* supplied 不继承：静态验证 P-51 的 count_pieces 调用里没有 supplied 字段 */
	ok('★★ P-51 的查询不含 supplied（玩家口径：不要求补给）', (() => {
		const i = SRC.indexOf('function p51_air_in_required_area')
		const seg = SRC.slice(i, i + 1400)
		const call = seg.slice(seg.indexOf('count_pieces(game,'))
		const body = call.slice(0, call.indexOf('})') + 2)
		return !/supplied/.test(body)
	})())
}

console.log('\n=== D. 六张轰炸卡的 req 声明 ===')
{
	const want = {
		'17515': { space: '意大利', radius: 2, types: ['army'] },
		'17517': { space: '德国', radius: 2, types: ['army'] },
		'17518': { space: '日本', radius: 2, types: ['navy'] },
		'17521': { space: '日本', radius: 3, types: ['navy'], supplied: true },
		'17516': { home: true, radius: 2, types: ['army'] },
		'17519': { home: true, radius: 1, types: ['army', 'navy', 'air'] },
	}
	for (const [id, exp] of Object.entries(want)) {
		const got = I.ECON_CARDS[id] && I.ECON_CARDS[id].req
		ok('★★ ' + id + ' req 声明正确', JSON.stringify(got) === JSON.stringify(exp), J(got))
	}
}

console.log('\n=== E. 消灭重复：卡内不再手写 bombing_radius 判定 ===')
{
	/* run 里不该再出现 count_pieces(... radius: bombing_radius(game, N) ...) 这种手写前置 */
	const seg = SRC.slice(SRC.indexOf("'17515': {"), SRC.indexOf("'17520': {"))
	const code = seg.replace(/\/\*[\s\S]*?\*\//g, '')
	ok('★★ 17515~17519 区块内已无 count_pieces + bombing_radius 手写',
		!/count_pieces\(game, \{[\s\S]{0,120}bombing_radius\(game, \d\)/.test(code))
	ok('★★ 都改走 econ_req_met / econ_req_count',
		/econ_req_met\(game, \(this && this\.req\) \|\| card_id, target\)/.test(code) &&
		/econ_req_count\(game, \(this && this\.req\) \|\| card_id, target\)/.test(code))
}

console.log('\n=== F. P-51 走 req 且 econ_used 下发 card ===')
{
	ok('★★ p51_air_in_required_area 读 econ_req_area', (() => {
		const i = SRC.indexOf('function p51_air_in_required_area')
		const seg = SRC.slice(i, i + 1200)
		return /econ_req_area\(game, cardId, t\)/.test(seg)
	})())
	ok('★★ econ_used 派发带 card', /tag: cfg\.tag,\s*\n\s*\/\*[^*]*\*\/\s*\n\s*card: card_id,/.test(SRC) ||
		/card: card_id,\s*\n\s*targets: \[t\]/.test(SRC))
	ok('★★ run/targets_fn 调用点都传了卡 id',
		/cfg\.run\(game, nation, t, card_id\)/.test(SRC) && /cfg\.targets_fn\(game, nation, card_id\)/.test(SRC))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
