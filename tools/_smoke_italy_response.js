/*
 * 意大利响应牌 Group A（7 张：17730/17731/17733/17734/17735/17737/17738）冒烟自检（2026-10-08）
 * 仅验证服务端核心逻辑（filter 命中/不命中 + 效果原子），不写库、不起服务器。
 * 用法：node tools/_smoke_italy_response.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

const g = rules.setup(1)
g.current_nation = '意大利'
g.active = 'AXIS'
g.turn_phase = 'play'
I.ensure_markers(g)

let fails = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fails++
}

/* 在指定 space 直接放一枚单位并授予补给 */
function putPiece(nation, type, space) {
	const id = I.new_piece_id(g)
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	g.supply_granted = g.supply_granted || {}
	g.supply_granted[id] = (g.turn || 1) + 100
	return id
}
/* 暗置一张意大利响应卡（清空桌面已有响应卡，保证单卡测试） */
function facedown(face) {
	g.table_responses = [{ card_id: face + '#1', owner_side: 'axis', nation: '意大利' }]
}
/* 清空棋盘棋子与挂起状态，避免跨用例污染 */
function clearPieces() {
	for (const k of ['location', 'piece_nation', 'piece_type', 'piece_owners', 'supply_granted'])
		g[k] = {}
	g.table_responses = []
	g.response_queue = []
	g.modifiers = []
}
/* 找一个与给定 space 相邻的陆地 space（用于"意大利相邻"类触发） */
function adjLand(space) {
	const conns = I.get_connections(g, space, I.faction_of_nation('意大利')).map(Number)
	for (const c of conns)
		if (d.spaces[c] && d.spaces[c].terrain === 'land' && c !== space) return c
	return null
}
function countArmyAt(space) {
	return Object.keys(g.location).filter(id =>
		g.location[id] === space && g.piece_nation[id] === '意大利' && g.piece_type[id] === 'army').length
}

const balkan = I.space_id_of('巴尔干')
const italy = I.space_id_of('意大利')
const latam = I.space_id_of('拉丁美洲')
const mad = I.space_id_of('马达加斯加')
const italyNb = adjLand(italy)

console.log('=== 空间解析 ===')
ok('巴尔干/意大利/拉丁美洲/马达加斯加 均可解析', balkan != null && italy != null && latam != null && mad != null)
ok('意大利存在相邻陆地', italyNb != null, 'italyNb=' + italyNb)

/* ---------------- 17730 贝尔萨列里神射手团（piece_removed, 巴尔干/相邻 意陆军, 还原+保护） ---------------- */
console.log('\n=== 17730 贝尔萨列里神射手团 ===')
clearPieces(); facedown('17730')
{
	const p = putPiece('意大利', 'army', balkan)
	const ctx = { piece: p, piece_nation: '意大利', piece_type: 'army', space: balkan, was_supplied: true, reason: 'eliminate' }
	ok('正例：巴尔干意大利陆军触发', I.fire_trigger(g, 'piece_removed', ctx).some(f => f.card_face === '17730'))
	const p2 = putPiece('意大利', 'army', latam) // 非巴尔干/相邻
	const ctx2 = { piece: p2, piece_nation: '意大利', piece_type: 'army', space: latam, was_supplied: true }
	ok('负例：拉丁美洲不触发', I.fire_trigger(g, 'piece_removed', ctx2).length === 0)
	g.location[p] = null; g.piece_nation[p] = null; g.piece_type[p] = null
	I.RESPONSE_EFFECT_IMPL['17730'](g, 'axis', ctx)
	ok('效果：还原部队', g.location[p] === balkan && g.piece_nation[p] === '意大利')
	ok('效果：注册本回合保护', g.modifiers.some(m => m.key === 'protect' && m.spaces[0] === balkan && m.untilTurn === g.turn))
}

/* ---------------- 17733 卡西诺山（piece_removed, 意大利 轴心任意国陆军, 还原+保护） ---------------- */
console.log('\n=== 17733 卡西诺山 ===')
clearPieces(); facedown('17733')
{
	const p = putPiece('德国', 'army', italy) // 轴心国在意大利
	const ctx = { piece: p, piece_nation: '德国', piece_type: 'army', space: italy, was_supplied: true }
	ok('正例：德国（轴心）在意大利触发', I.fire_trigger(g, 'piece_removed', ctx).some(f => f.card_face === '17733'))
	const p2 = putPiece('美国', 'army', italy) // 非轴心
	const ctx2 = { piece: p2, piece_nation: '美国', piece_type: 'army', space: italy, was_supplied: true }
	ok('负例：美国在意大利不触发', I.fire_trigger(g, 'piece_removed', ctx2).length === 0)
	g.location[p] = null; g.piece_nation[p] = null; g.piece_type[p] = null
	I.RESPONSE_EFFECT_IMPL['17733'](g, 'axis', ctx)
	ok('效果：还原德国陆军', g.location[p] === italy && g.piece_nation[p] === '德国')
	ok('效果：注册本回合保护', g.modifiers.some(m => m.key === 'protect' && m.spaces[0] === italy))
}

/* ---------------- 17735 山地特种兵（piece_removed, 意大利/相邻 意陆军, 还原+保护） ---------------- */
console.log('\n=== 17735 山地特种兵 ===')
clearPieces(); facedown('17735')
{
	const p = putPiece('意大利', 'army', italyNb) // 意大利相邻
	const ctx = { piece: p, piece_nation: '意大利', piece_type: 'army', space: italyNb, was_supplied: true }
	ok('正例：意大利相邻触发', I.fire_trigger(g, 'piece_removed', ctx).some(f => f.card_face === '17735'))
	const p2 = putPiece('意大利', 'army', italy)
	const ctx2 = { piece: p2, piece_nation: '意大利', piece_type: 'army', space: italy, was_supplied: true }
	ok('正例：意大利本地也触发', I.fire_trigger(g, 'piece_removed', ctx2).some(f => f.card_face === '17735'))
	g.location[p] = null; g.piece_nation[p] = null; g.piece_type[p] = null
	I.RESPONSE_EFFECT_IMPL['17735'](g, 'axis', ctx)
	ok('效果：还原部队', g.location[p] === italyNb && g.piece_nation[p] === '意大利')
	ok('效果：注册本回合保护', g.modifiers.some(m => m.key === 'protect' && m.spaces[0] === italyNb))
}

/* ---------------- 17734 罗马尼亚增援（piece_removed, 德国补给陆军, 在所处地征召意陆军） ---------------- */
console.log('\n=== 17734 罗马尼亚增援 ===')
clearPieces(); facedown('17734')
{
	const sp = italyNb
	const p = putPiece('德国', 'army', sp)
	const ctx = { piece: p, piece_nation: '德国', piece_type: 'army', space: sp, was_supplied: true }
	ok('正例：德国补给陆军触发', I.fire_trigger(g, 'piece_removed', ctx).some(f => f.card_face === '17734'))
	const ctx2 = Object.assign({}, ctx, { was_supplied: false })
	ok('负例：非补给不触发', I.fire_trigger(g, 'piece_removed', ctx2).length === 0)
	g.location[p] = null; g.piece_nation[p] = null; g.piece_type[p] = null
	const before = countArmyAt(sp)
	I.RESPONSE_EFFECT_IMPL['17734'](g, 'axis', ctx)
	ok('效果：在所处地征召意大利陆军 +1', countArmyAt(sp) === before + 1)
}

/* ---------------- 17731 不可思议行动（build, 苏联建陆军 + 相邻英/美陆军 → 消灭） ---------------- */
console.log('\n=== 17731 不可思议行动 ===')
clearPieces(); facedown('17731')
{
	const nb = adjLand(latam)
	putPiece('英国', 'army', nb) // 与苏联建设地相邻
	const builtId = I.new_piece_id(g)
	g.location[builtId] = latam; g.piece_nation[builtId] = '苏联'; g.piece_type[builtId] = 'army'
	const ctx = { nation: '苏联', space: latam, type: 'army', piece_id: builtId }
	ok('正例：苏联建+英相邻触发', I.fire_trigger(g, 'build', ctx).some(f => f.card_face === '17731'))
	I.RESPONSE_EFFECT_IMPL['17731'](g, 'axis', ctx)
	ok('效果：消灭苏联陆军', g.location[builtId] == null)
	// 负例：无英/美相邻
	clearPieces(); facedown('17731')
	const builtId2 = I.new_piece_id(g)
	g.location[builtId2] = mad; g.piece_nation[builtId2] = '苏联'; g.piece_type[builtId2] = 'army'
	const ctx2 = { nation: '苏联', space: mad, type: 'army', piece_id: builtId2 }
	ok('负例：无英/美相邻不触发', I.fire_trigger(g, 'build', ctx2).length === 0)
}

/* ---------------- 17737 以逸待劳（build, 敌方建/征召陆军 且意大利相邻 → 在意大利征召德+意陆军） ---------------- */
console.log('\n=== 17737 以逸待劳 ===')
clearPieces(); facedown('17737')
{
	const builtId = I.new_piece_id(g)
	g.location[builtId] = italyNb; g.piece_nation[builtId] = '美国'; g.piece_type[builtId] = 'army'
	const ctx = { nation: '美国', space: italyNb, type: 'army', piece_id: builtId }
	ok('正例：敌方建意大利相邻触发', I.fire_trigger(g, 'build', ctx).some(f => f.card_face === '17737'))
	const b2 = I.new_piece_id(g)
	g.location[b2] = italyNb; g.piece_nation[b2] = '意大利'; g.piece_type[b2] = 'army'
	const ctx2 = { nation: '意大利', space: italyNb, type: 'army', piece_id: b2 }
	ok('负例：友方不触发', I.fire_trigger(g, 'build', ctx2).length === 0)
	const before = countArmyAt(italy)
	I.RESPONSE_EFFECT_IMPL['17737'](g, 'axis', ctx)
	ok('效果：在意大利征召德+意陆军（≥+1）', countArmyAt(italy) >= before + 1)
}

/* ---------------- 17738 殖民地游击队（build, 敌方建陆军 拉丁美洲/马达加斯加 → 消灭） ---------------- */
console.log('\n=== 17738 殖民地游击队 ===')
clearPieces(); facedown('17738')
{
	const builtId = I.new_piece_id(g)
	g.location[builtId] = latam; g.piece_nation[builtId] = '美国'; g.piece_type[builtId] = 'army'
	const ctx = { nation: '美国', space: latam, type: 'army', piece_id: builtId }
	ok('正例：敌建拉丁美洲触发', I.fire_trigger(g, 'build', ctx).some(f => f.card_face === '17738'))
	I.RESPONSE_EFFECT_IMPL['17738'](g, 'axis', ctx)
	ok('效果：消灭该陆军', g.location[builtId] == null)
	clearPieces(); facedown('17738')
	const b2 = I.new_piece_id(g)
	g.location[b2] = italyNb; g.piece_nation[b2] = '美国'; g.piece_type[b2] = 'army'
	const ctx2 = { nation: '美国', space: italyNb, type: 'army', piece_id: b2 }
	ok('负例：非拉美/马达加斯加不触发', I.fire_trigger(g, 'build', ctx2).length === 0)
}

/* ==================== Group B：17736 / 17732 ==================== */
console.log('\n=== 17736 王牌飞行员（econ_bombing 拦截，镜像 15329）===')
/* filter 正/负例 */
clearPieces(); facedown('17736')
ok('17736 过滤器：目标意大利 命中',
	I.RESPONSE_EFFECTS['17736'].trigger.filter(g, { target: '意大利' }, 'axis') === true)
ok('17736 过滤器：目标德国 不命中',
	I.RESPONSE_EFFECTS['17736'].trigger.filter(g, { target: '德国' }, 'axis') === false)
/* effect 返回 cancel（镜像 15329 拦截口径） */
{
	const r = I.RESPONSE_EFFECT_IMPL['17736'](g, 'axis', {})
	ok('17736 effect 返回 cancel:true', r && r.cancel === true)
}
/* 集成：15313 选意大利 → 拦截挂起，不结算 */
{
	clearPieces(); facedown('17736')
	g.current_nation = '英国'; g.active = 'Allies'; g.turn_phase = 'play'; g.play_done = {}
	const econId = '15313#e1'
	g.hands['英国'] = [econId]
	const discBefore = (g.discard && g.discard['英国'] ? g.discard['英国'].length : 0)
	try { rules.action(g, 'Allies', 'play_card', { card: econId, target: '意大利' }) }
	catch (e) { ok('15313 拦截流程不抛异常', false, e.message) }
	const q = (g.response_queue || [])
	ok('15313 选意大利触发 econ_bombing 拦截挂起',
		q.some(x => x.on === 'econ_bombing' && x.intercept_card === econId))
	ok('拦截时 15313 尚未结算（仍在英国手牌）', (g.hands['英国'] || []).includes(econId))
	/* 发动响应 → 取消：15313 进弃牌堆且无损耗 */
	rules.action(g, 'Axis', 'trigger_response', {})
	ok('发动拦截后 15313 进英国弃牌堆', (g.discard['英国'] || []).includes(econId))
	ok('取消后仅 15313 入弃牌堆（无损耗）',
		(g.discard['英国'] || []).length === discBefore + 1)
}
/* 集成：放弃响应 → 重放 15313 → 实际损耗 */
{
	clearPieces(); facedown('17736')
	g.current_nation = '英国'; g.active = 'Allies'; g.turn_phase = 'play'; g.play_done = {}
	const econId = '15313#e2'
	g.hands['英国'] = [econId]
	const discBefore = (g.discard && g.discard['英国'] ? g.discard['英国'].length : 0)
	/* 损耗作用于【受击方意大利】的牌堆 -> 观察意大利弃牌堆 */
	const itDiscBefore = (g.discard && g.discard['意大利'] ? g.discard['意大利'].length : 0)
	rules.action(g, 'Allies', 'play_card', { card: econId, target: '意大利' })
	rules.action(g, 'Axis', 'pass_response', {})
	ok('放弃响应后 15313 重新结算（入弃牌堆）', (g.discard['英国'] || []).includes(econId))
	ok('放弃后意大利产生损耗（弃牌堆增长）',
		(g.discard['意大利'] || []).length > itDiscBefore)
}

console.log('\n=== 17732 德国军事顾问（借用德国状态卡，免费激活）===')
{
	clearPieces()
	g.italy_borrow = null
	const gst = '15242#1'   /* 德国状态卡：play_start 窗口，代价 skip_play + discard:1 */
	g.table = g.table || {}
	g.table['德国'] = [gst]
	g.current_nation = '意大利'; g.active = 'AXIS'; g.turn_phase = 'play'
	facedown('17732')
	ok('play_start 触发 17732',
		I.fire_trigger(g, 'play_start', { nation: '意大利' }).some(f => f.card_face === '17732'))
	const r32 = I.RESPONSE_EFFECT_IMPL['17732'](g, 'axis', { nation: '意大利' })
	ok('17732 effect 置 pending 借用', g.italy_borrow && g.italy_borrow.pending === true)
	ok('17732 候选含德国状态卡 15242#1', (g.italy_borrow.options || []).includes(gst))
	rules.action(g, 'Axis', 'resolve_italy_borrow', { face: gst })
	ok('借用锁定 card_face', g.italy_borrow && g.italy_borrow.card_face === gst && g.italy_borrow.pending === false)
	/* 免代价激活：放苏联陆军于<德国>以便效果 ok */
	const ger = I.space_id_of('德国')
	const sovId = putPiece('苏联', 'army', ger)
	const deHandBefore = (g.hands['德国'] || []).length
	rules.action(g, 'Axis', 'activate_status', { card: gst })
	ok('借用激活免代价：德国未弃手牌', (g.hands['德国'] || []).length === deHandBefore)
	ok('借用激活免代价：未置 skip_play', !g.skip_play_done || !g.skip_play_done['德国'])
	ok('借用激活执行效果：苏联陆军被消除', g.location[sovId] == null)
}

console.log('\n' + (fails === 0 ? 'ALL PASS' : (fails + ' FAIL')))
process.exit(fails === 0 ? 0 : 1)
