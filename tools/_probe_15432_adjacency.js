/*
 * 只读探针：#8 15432《神风敢死队》trigger.filter 的「相邻日本海军」判定
 *
 * 玩家报障：怀疑「和日本不相邻的建设海军也触发了 15432」。
 * 卡面：敌方国家【相邻日本海军】建设海军后：消灭建设的海军。
 *
 * 不改任何产品代码。用 _board_lib.new_board 建真实盘面、debug_place 摆棋子，
 * 再用引擎真实函数 fire_trigger / request_responses 派发 'build' 事件，
 * 不手填 response_queue、不手写状态替代引擎流程。
 *
 * 用法：node tools/_probe_15432_adjacency.js
 */
const path = require('path')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L

/* ---------- 地图：列出所有海域及其直接相邻 ---------- */
const seas = Object.keys(d.spaces).map(Number)
	.filter(s => d.spaces[s] && d.spaces[s].terrain === 'sea')
console.log('=== 海域清单（id:名称 -> 相邻） ===')
for (const s of seas) {
	const cs = (d.spaces[s].connections || []).map(Number)
	console.log(`  ${s}:${d.name_of(s)} -> [${cs.join(',')}]`)
}

const JP = d.id_of('东海')
console.log('\n日本海军所在海域 = ' + JP + '(' + (JP != null ? d.name_of(JP) : '?') + ')')

/* 双向相邻判定（按 data.spaces 原始连接，避免 limited_connections 干扰选点） */
const rawNb = s => (d.spaces[s].connections || []).map(Number)
function bidirAdj(a, b) {
	return rawNb(a).indexOf(b) >= 0 || rawNb(b).indexOf(a) >= 0
}
const NEAR = seas.find(s => s !== JP && bidirAdj(JP, s))
const FAR = seas.find(s => s !== JP && !bidirAdj(JP, s))
console.log(`选点：相邻海域 NEAR=${NEAR}(${d.name_of(NEAR)})　不相邻海域 FAR=${FAR}(${d.name_of(FAR)})`)

function diagFilter(g, space, tag) {
	/* 与 rules.js:16927 的 has_pieces 完全同一份 opt */
	const opt = { space: space, side: 'axis', excludeSelf: true, types: ['navy'], nation: '日本' }
	const regions = I.region_spaces(g, opt)
	const pieces = I.list_pieces(g, opt)
	const ctx = { nation: '美国', space: space, type: 'navy', piece_id: 'probe_new' }
	const cands = I.fire_trigger(g, 'build', ctx)
	console.log(`  [${tag}] space=${space}(${d.name_of(space)})`)
	console.log(`    region_spaces（filter 实际查的地区）= [${regions.join(',')}]`)
	console.log(`    命中的日本海军 = [${pieces.join(',')}]`)
	console.log(`    fire_trigger('build') 命中卡面 = [${cands.map(c => c.card_face).join(',')}]`)
	return { regions, pieces, cands }
}

function scene(jpSp, buildSp, label) {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	clear_pending(g)
	g.current_nation = '美国'
	g.active = 'Allies'
	if (jpSp != null) {
		place(g, 'jp_n1', '日本', 'navy', d.name_of(jpSp))
		I.refresh(g)
		console.log(`  日本海军是否真的落位 = ${(I.pieces_on(g, jpSp) || []).join(',')}`)
	}
	/* 暗置真实响应卡（owner_side 必须小写阵营） */
	g.table_responses.push({ card_id: '15432', owner_side: 'axis', nation: '日本' })
	I.refresh(g)

	console.log(`\n=== ${label} ===`)
	console.log(`  日本海军@${jpSp == null ? '（无）' : d.name_of(jpSp)}　美国建海军@${d.name_of(buildSp)}`)
	console.log(`  真实相邻（美国视角 is_adjacent）= ${I.is_adjacent(g, buildSp, jpSp, 'allies')}`)
	const r = diagFilter(g, buildSp, label)

	/* 引擎真实派发：request_responses('build') 会压入 response_queue */
	const ctx = { nation: '美国', space: buildSp, type: 'navy', piece_id: 'probe_new' }
	I.request_responses(g, 'build', ctx, false)
	const frames = (g.response_queue || []).flatMap(q => (q.candidates || []).map(c => c.card_face))
	console.log(`  response_queue 命中卡面 = [${frames.join(',')}]`)
	return Object.assign({}, r, { frames })
}

/* A 正例：相邻 */
const A = scene(JP, NEAR, 'A 正例：美国在与日本海军【相邻】海域建海军 → 应触发')
/* B 反例：不相邻（玩家怀疑的 bug） */
const B = scene(JP, FAR, 'B 反例：美国在【不相邻】海域建海军 → 不应触发')
/* C 对照：无日本海军 */
const C = scene(null, NEAR, 'C 对照：地图上没有日本海军 → 不应触发')

/* D 视角差异：日本海军在 axis 专属邻接才连得上的格（北海），美国在波罗的海建 */
const D = scene(d.id_of('北海'), d.id_of('波罗的海'),
	'D 视角差异：axis 视角相邻、allies 视角不相邻')
/* E 玩家报障标题里的「南太平洋」：看它按地图数据是否与<东海>相连 */
const E = scene(JP, d.id_of('南太平洋'),
	'E 南太平洋：日本海军@东海，美国@南太平洋建海军')

/* ---------- 结论 ---------- */
const has = x => (x.frames || []).indexOf('15432') >= 0
console.log('\n=== 结论 ===')
console.log(`  A 相邻触发 = ${has(A)}（期望 true）`)
console.log(`  B 不相邻触发 = ${has(B)}（期望 false；若为 true 即坐实玩家报障）`)
console.log(`  C 无日本海军触发 = ${has(C)}（期望 false）`)
console.log(`  B 的 region_spaces = [${B.regions.join(',')}]  其中日本海军 = [${B.pieces.join(',')}]`)
console.log(`  D axis 视角过宽触发 = ${has(D)}（若 true：filter 用 axis 视角比建设方视角多算邻居）`)
console.log(`  D 的 region_spaces = [${D.regions.join(',')}]  命中日本海军 = [${D.pieces.join(',')}]`)
console.log(`  E 南太平洋触发 = ${has(E)}（若 true：地图数据把<南太平洋>与<东海>相连）`)
console.log(`  E 的 region_spaces = [${E.regions.join(',')}]  命中日本海军 = [${E.pieces.join(',')}]`)

/* 诊断：filter 用 'axis' 视角连通与『美国视角』是否不同 */
console.log('\n=== 附加诊断：视角差异 ===')
{
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	clear_pending(g)
	place(g, 'jp_n1', '日本', 'navy', d.name_of(JP))
	I.refresh(g)
	for (const sp of [NEAR, FAR]) {
		const axisNb = (I.get_connections(g, sp, 'axis') || []).map(Number)
		const alliesNb = (I.get_connections(g, sp, 'allies') || []).map(Number)
		console.log(`  ${sp}(${d.name_of(sp)}): axis邻居=[${axisNb.join(',')}] allies邻居=[${alliesNb.join(',')}] 含日本海军格=${axisNb.indexOf(JP) >= 0}`)
	}
	/* ctx.space 为 null 时会怎样（诊断 ② 全场分支） */
	const optNull = { space: null, side: 'axis', excludeSelf: true, types: ['navy'], nation: '日本' }
	const regNull = I.region_spaces(g, optNull)
	console.log(`  ctx.space=null 时 region_spaces 长度 = ${regNull.length}（全场分支，excludeSelf 失效）`)
	console.log(`  ctx.space=null 时命中日本海军 = [${I.list_pieces(g, optNull).join(',')}]`)
}

/* ---------- F：真实 play_card 打「建设海军」复现 D（不直调 fire_trigger） ---------- */
console.log('\n=== F 真实 play_card：日本海军@北海，美国@波罗的海建海军 ===')
{
	const CARDS = require(path.join(L.MOD, 'cards.js')).CARDS
	/* 用英国（非中立国）做建设方，避开「美国尚未参战」的中立限制 */
	const bn = CARDS.find(c => c.nation === '英国' && c.name === '建设海军')
	console.log('  英国《建设海军》face = ' + (bn && bn.id))
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	clear_pending(g)
	g.current_nation = '英国'
	g.active = 'Allies'
	place(g, 'jp_n1', '日本', 'navy', '北海')
	I.refresh(g)
	/* 摆英国陆军在<波罗的海>的相邻陆地，让 can_build_at(navy) 有 A/B 两条依据 */
	const BALTIC = d.id_of('波罗的海')
	const landNbs = (d.spaces[BALTIC].connections || []).map(Number)
		.filter(s => d.spaces[s] && d.spaces[s].terrain === 'land')
	console.log('  波罗的海陆地邻居 = [' + landNbs.map(s => s + ':' + d.name_of(s)).join(', ') + ']')
	/* 避开北欧(4)：把部队/补给点放那儿会改变海峡控制者，使 axis/allies 邻居反转 */
	const landNb = landNbs.find(s => s !== 4) != null ? landNbs.find(s => s !== 4) : landNbs[0]
	if (landNb != null) {
		place(g, 'uk_a1', '英国', 'army', d.name_of(landNb))
		I.grant_supply(g, 'uk_a1', g.turn || 1)
		I.set_supply_point(g, landNb, 'allies', true)
	}
	I.refresh(g)
	I.compute_supply(g)
	g.table_responses.push({ card_id: '15432', owner_side: 'axis', nation: '日本' })
	if (bn) give(g, bn.id, '英国')
	I.refresh(g)
	const cid = (g.hands['英国'] || []).find(x => faceOf(x) === String(bn && bn.id))
	const chk = I.can_build_at(g, '英国', BALTIC, 'navy')
	console.log('  相邻陆地 = ' + landNb + '(' + (landNb != null ? d.name_of(landNb) : '?') + ')')
	console.log('  can_build_at(英国, 波罗的海, navy) = ' + JSON.stringify(chk))
	console.log('  建设牌实例 = ' + cid)
	console.log('  建设方视角 is_adjacent(波罗的海, 北海) = ' + I.is_adjacent(g, BALTIC, d.id_of('北海'), 'allies'))
	const NORTH = d.id_of('北海')
	console.log('  日本海军@北海 落位 = [' + (I.pieces_on(g, NORTH) || []).join(',') + ']')
	console.log('  table_responses = ' + JSON.stringify(g.table_responses))
	console.log('  axis邻居(波罗的海) = [' + (I.get_connections(g, BALTIC, 'axis') || []).map(Number).join(',') + ']')
	console.log('  allies邻居(波罗的海) = [' + (I.get_connections(g, BALTIC, 'allies') || []).map(Number).join(',') + ']')
	const candsPre = I.fire_trigger(g, 'build', { nation: '英国', space: BALTIC, type: 'navy', piece_id: 'x' })
	console.log('  play_card 前 fire_trigger 命中 = [' + candsPre.map(c => c.card_face).join(',') + ']')
	if (cid) {
		const l0 = (g.log || []).length
		R.action(g, 'Allies', 'play_card', { card: cid, space: BALTIC })
		I.refresh(g)
		const frames = (g.response_queue || []).flatMap(q => (q.candidates || []).map(c => c.card_face))
		console.log('  真实 play_card 后 response_queue 命中 = [' + frames.join(',') + ']')
		console.log('  日志尾部 = ' + (g.log || []).slice(l0).join(' | ').slice(0, 260))
		console.log('  ★ 真实打牌路径是否误触发 15432 = ' + (frames.indexOf('15432') >= 0))
	}
}
