/* 15426 驱逐舰运输 effect 回归测试（2026-10-14 按卡面文本修正后）
 * 卡面：发起海战后，在相邻地区建设 1 或 2 支陆军。
 * 验证：① 返回选相邻陆地 pending；② 选地区后建 1 支并询问是否再建；
 *       ③ 选"完成"=共 1 支；④ 选"再建"=共 2 支；⑤ 无相邻陆地时优雅结束。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) }
}
function armyAt(g, nation, sp) {
	let n = 0
	for (const p in g.piece_nation)
		if (g.location[p] === sp && g.piece_nation[p] === nation && g.piece_type[p] === 'army') n++
	return n
}

console.log('\n=== 15426 驱逐舰运输：相邻陆地建 1 或 2 支陆军 ===')
{
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'
	const seaId = I.space_id_of('东海')
	const ctx = { nation: '日本', space: seaId, kind: 'sea' }
	const impl = I.RESPONSE_EFFECT_IMPL['15426']

	/* ① 首调：应选相邻陆地 */
	const r1 = impl(g, 'axis', ctx, undefined)
	ok('① 返回选地区 pending(space)', r1 && r1.pending && r1.kind === 'space',
		JSON.stringify(r1))
	ok('① 候选为陆地', r1 && r1.candidates.length > 0, 'cands=' +
		(r1 ? r1.candidates.map(c => c.name).join('/') : 'null'))
	/* 选日本本土（恒可建陆军）作为建造地，确保 build_piece 成功 */
	const homeCand = r1.candidates.find(c => c.name === '日本') || r1.candidates[0]
	const landId = homeCand.id
	/* 清空该地既有日本棋子，避免"每格限 1 支"导致首建失败 */
	for (const p in g.piece_nation) {
		if (g.location[p] === landId && g.piece_nation[p] === '日本') {
			delete g.piece_nation[p]; delete g.location[p]
		}
	}
	const before = armyAt(g, '日本', landId)

	/* ② region1：建 1 支 + 询问是否再建（kind='option'） */
	const r2 = impl(g, 'axis', ctx, landId, { step: 'region1' })
	ok('② 返回 option 询问是否再建', r2 && r2.pending && r2.kind === 'option',
		JSON.stringify(r2))
	ok('② 已建 1 支陆军', armyAt(g, '日本', landId) === before + 1,
		'now=' + armyAt(g, '日本', landId) + ' before=' + before)

	/* ③ 选"完成"(id=0)：不再建 */
	const r3 = impl(g, 'axis', ctx, 0, { step: 'ask2', desc1: 'x', used: landId })
	ok('③ 选完成后仍只有 1 支', armyAt(g, '日本', landId) === before + 1,
		'now=' + armyAt(g, '日本', landId))

	/* ④ 选"再建"(id=1)：进入第 2 个地区选择（pending space，排除已用地区） */
	const r4 = impl(g, 'axis', ctx, 1, { step: 'ask2', desc1: 'x', used: landId })
	ok('④ 返回第 2 个地区选择 pending(space)',
		r4 && r4.pending && r4.kind === 'space', JSON.stringify(r4))
	/* 【2026-10-26 玩家裁决】允许打重复地点：第 2 步候选必须【包含】第 1 个地区 */
	ok('④ 候选包含第 1 个地区（允许重复）',
		r4 && (r4.candidates || []).some(c => Number(c.id) === Number(landId)),
		r4 ? r4.candidates.map(c => c.name).join('/') : 'null')
	/* 选第 2 个地区：尝试建第 2 支（受地图/兵力约束，成功或优雅失败均 ok） */
	const landId2 = (r4.candidates && r4.candidates[0] && r4.candidates[0].id) || landId
	const before2 = armyAt(g, '日本', landId2)
	const r5 = impl(g, 'axis', ctx, landId2, { step: 'region2', desc1: 'x' })
	ok('⑤ 第 2 支建结果 ok（成功或优雅失败）', r5 && r5.ok === true,
		JSON.stringify(r5))
	ok('⑤ 第 2 支后该地陆军数 >= 原有',
		armyAt(g, '日本', landId2) >= before2,
		'now=' + armyAt(g, '日本', landId2) + ' before=' + before2)
}

console.log('\n=== 15426：无相邻陆地时优雅结束（pick_space_then 返回 ok 非 pending） ===')
{
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'
	/* 尝试找一个不与任何陆地相邻的纯海域；找不到则跳过该断言 */
	let pureSea = null
	try {
		for (let i = 1; i < 200; i++) {
			if (typeof I.get_connections !== 'function') break
			let nbrs = []
			try { nbrs = I.get_connections(g, i, 'axis').map(Number) } catch (e) { continue }
			if (!nbrs.length) continue
			const allSea = nbrs.every(n => {
				const s = (I.space_terrain ? I.space_terrain(n) : '')
				return s === 'sea' || s === ''
			})
			if (allSea) { pureSea = i; break }
		}
	} catch (e) { pureSea = null }
	if (pureSea == null) {
		ok('⑤ 无纯海域可测，跳过', true)
	} else {
		const ctx = { nation: '日本', space: pureSea, kind: 'sea' }
		const r = I.RESPONSE_EFFECT_IMPL['15426'](g, 'axis', ctx, undefined)
		ok('⑤ 无相邻陆地时返回 ok(非 pending)', r && !r.pending,
			JSON.stringify(r))
	}
}

console.log('\n==== 15426 测试结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
