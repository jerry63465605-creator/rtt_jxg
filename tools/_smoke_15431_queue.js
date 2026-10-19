/* 15431《全面侵华》——「无法选择攻击地点」回归测试（2026-10-14 初版，2026-10-19 适配纯栈模型）。
 *
 * 第二期栈重构后 response_queue 只是从 response_stack 派生的只读视图，
 * 引擎层只写栈帧。本测试改用栈帧 API 真实驱动：
 *
 *   A. 15431 第①步建设触发了 build 响应卡 -> 走 defer -> 该 build 响应卡
 *      仍留在栈（未被整组出队丢弃）；
 *      栈清空后 15431 第②步提升回 pending_response_choice（kind=space，可选址）。
 *   B. 多卡同触发组：每张卡是独立栈帧（同 group_id），确认后均 ordered=true，
 *      派生 response_queue 聚合同组为 1 项（纯栈模型下每卡独立帧）。
 *
 * 前置（沿用 _dbg_15431.js）：中国东部=22，中国东北=21；21 设补给点。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  [PASS] ' + name) }
	else { fail++; console.log('  [FAIL] ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

const SP_CN_EAST = 22   /* 战斗地区：中国东部 */
const SP_CN_NE = 21     /* 发起地/候选：中国东北 */
const TEST_FACE = '99999'  /* 注入的 build 响应测试卡（15431 第①步建设触发） */
const TEST_A = '99998'     /* 注入的 battle 响应测试卡 甲 */
const TEST_B = '99997'     /* 注入的 battle 响应测试卡 乙 */

I.RESPONSE_EFFECTS[TEST_FACE] = {
	name: '测试-建设响应',
	trigger: { on: 'build', filter: (g, ctx) => ctx.type === 'army' && ctx.nation === '日本' },
}
I.RESPONSE_EFFECTS[TEST_A] = {
	name: '测试-甲',
	trigger: { on: 'battle', filter: (g, ctx) => ctx.kind === 'land' },
}
I.RESPONSE_EFFECTS[TEST_B] = {
	name: '测试-乙',
	trigger: { on: 'battle', filter: (g, ctx) => ctx.kind === 'land' },
}

function baseGame() {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	I.add_supply_point(g, SP_CN_NE)
	g.response_stack = []
	g.response_queue = []
	g.deferred_response_stack = []
	I.set_skip_turn_guard(true)
	return g
}
function putPiece(g, id, nation, type, space) {
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function findPiece(g, space, nation, type) {
	for (const p in g.location)
		if (g.location[p] === space && g.piece_nation[p] === nation && g.piece_type[p] === type) return p
	return null
}
function stackHas(g, cardId) {
	return (g.response_stack || []).some(f => f.card_id === cardId)
}
function topFrame(g) {
	const s = g.response_stack || []
	return s.length ? s[s.length - 1] : null
}

console.log('\n=== A. 15431 递延路径：建设触发的响应卡不得被丢弃 ===')
{
	let g = baseGame()
	putPiece(g, 'jp1', '日本', 'army', SP_CN_NE)
	g.table_responses = g.table_responses || []
	g.table_responses.push({ card_id: '15431#1', owner_side: 'axis', nation: '日本', id: '15431#1' })
	g.table_responses.push({ card_id: TEST_FACE + '#1', owner_side: 'axis', nation: '日本', id: TEST_FACE + '#1' })
	/* do_battle 触发 battle 响应（15431）压帧；同时 refresh 让 jp1 进入补给状态，使 22 可建设 */
	const cnArmy = findPiece(g, SP_CN_EAST, '中国', 'army')
	I.do_battle(g, '日本', SP_CN_EAST, cnArmy, 'land', { from: 'jp1' })
	g.response_queue = []
	g.deferred_response_stack = []

	ok('15431 已压入栈帧', stackHas(g, '15431#1'), g.response_stack.map(f => f.card_id))

	/* 第①步触发 15431：建设陆军 -> 触发 build 响应(TEST_FACE) -> defer 第②步 */
	rules.action(g, 'Axis', 'trigger_response', {})
	const deferred = (g.deferred_response_stack || [])[0]
	ok('15431 进入递延(deferred)', !!(deferred && deferred.card_face === '15431'), deferred && { face: deferred.card_face, kind: deferred.kind })
	ok('递延步骤是选地区(kind=space)', !!(deferred && deferred.kind === 'space'), deferred && deferred.kind)
	ok('建设触发的响应卡未被丢弃(仍在栈)', stackHas(g, TEST_FACE + '#1'),
		(g.response_stack || []).map(f => f.card_id))
	ok('15431 帧已消耗(不在栈)', !stackHas(g, '15431#1'))

	/* 处理 build 响应（栈清空 -> 自动提升 15431 第②步） */
	rules.action(g, 'Axis', 'trigger_response', {})
	const pc = topFrame(g)
	ok('队列清空后 15431 第②步提升为栈顶帧',
		!!(pc && pc.card_face === '15431'), pc && pc.card_face)
	ok('pending 是选地区(kind=space)', !!(pc && pc.kind === 'space'), pc && pc.kind)

	/* 第②步：选相邻陆地 37（东南亚）发起陆战 */
	putPiece(g, 'cnT', '中国', 'army', 37)
	const cands = (pc && pc.candidates) || []
	const target = cands.some(c => Number(c.id) === 37) ? 37 : (cands[0] || {}).id
	rules.action(g, 'Axis', 'resolve_response_choice', { choice: target })
	ok('resolve 后 pending 已清空', !topFrame(g), topFrame(g))
	ok('resolve 后 deferred 已清空', !((g.deferred_response_stack || []).length), g.deferred_response_stack)
	ok('陆战已发生（靶子被移除）', g.location['cnT'] == null || g.piece_nation['cnT'] !== '中国',
		{ loc: g.location['cnT'], nat: g.piece_nation['cnT'] })
}

console.log('\n=== B. 多卡同触发组：每张独立栈帧，确认后 ordered ===')
{
	let g2 = baseGame()
	g2.table_responses = g2.table_responses || []
	g2.table_responses.push({ card_id: TEST_A + '#1', owner_side: 'axis', nation: '日本', id: TEST_A + '#1' })
	g2.table_responses.push({ card_id: TEST_B + '#1', owner_side: 'axis', nation: '日本', id: TEST_B + '#1' })
	I.request_responses(g2, 'battle', { space: SP_CN_EAST, kind: 'land', nation: '日本' }, false)
	ok('多卡同触发压入 2 帧', g2.response_stack.length === 2, g2.response_stack.map(f => f.card_id))
	const gid = g2.response_stack[0].group_id
	ok('2 帧同 group_id', g2.response_stack.every(f => f.group_id === gid))
	/* 确认 */
	rules.action(g2, 'Axis', 'response_confirm', {})
	const gf = g2.response_stack.filter(f => f.group_id === gid)
	ok('确认后 2 帧仍独立存在于栈', gf.length === 2, gf.map(f => f.card_id))
	ok('两项均 ordered=true（可依次发动）', gf.every(f => f.ordered === true))
	ok('顺序保持 A→B（group_idx）',
		gf[0].group_idx < gf[1].group_idx && gf[0].card_id === TEST_A + '#1' && gf[1].card_id === TEST_B + '#1')
	/* 纯栈模型下每卡独立帧，派生 response_queue 聚合同组为 1 项 */
	ok('派生 response_queue 聚合为 1 项', (g2.response_queue || []).length === 1, (g2.response_queue || []).length)
}

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
