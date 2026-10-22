/*
 * 回归测试：15434《伪满洲国》+ 7905《豫湘桂战役》+ 15433《皖南事变》
 *
 * 用户 2026-10-22 口径：
 *   ① 消灭范围【只本格】（不是"本格+相邻"）；
 *   ② 征召失败也照常尝试，并在日志写"未征召：原因"；
 *   ③ 15433《皖南事变》校准为只消灭【中国】陆军。
 *
 * 覆盖：
 *   A 15434：敌方陆军在本格 -> 消灭 + 征召成功
 *   B 15434：敌方陆军只在相邻格 -> 不消灭，但仍征召（本格空）
 *   C 15434：本格还剩敌方陆军 -> 征召失败，日志含"未征召："
 *   D 15433：候选只含中国陆军（英国陆军不在候选）
 *   E 7905：只认<中国东部>，<中国东北>的陆军不在候选
 *
 * 用法：node tools/_smoke_15434.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}
const CN_NE = I.data.id_of('中国东北')
const CN_E = I.data.id_of('中国东部')
const MONGOLIA = I.data.id_of('蒙古')
const WEST = I.data.id_of('西欧')

function base(cardFace) {
	const g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.table_responses = g.table_responses || []
	g.table_responses.push({
		card_id: cardFace + '#1', card_face: cardFace, nation: '日本',
		owner_side: 'axis', name: I.inst_card(cardFace + '#1').name,
	})
	return g
}
function put(g, pid, nation, type, space) {
	g.location[pid] = space
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
}
function clearAt(g, space) {
	for (const p in g.location) if (g.location[p] === space) delete g.location[p]
}
function jpArmyAt(g, space) {
	return Object.keys(g.location).filter(p =>
		g.piece_nation[p] === '日本' && g.piece_type[p] === 'army' && g.location[p] === space).length
}
function fire(g) {
	I.request_responses(g, 'play_start', { nation: '日本' }, false)
	g = rules.action(g, 'Axis', 'trigger_response', {})
	return g
}
function topCands(g) {
	/* 活动帧在 response_stack 栈顶（response_queue 只是给客户端的派生视图） */
	const s = g.response_stack || []
	const f = s[s.length - 1]
	if (!f) return null
	return (f.candidates || []).map(c => (c && c.id != null) ? c.id : c)
}

console.log('=== A. 15434：敌方陆军在本格 -> 消灭 + 征召 ===')
{
	let g = base('15434')
	clearAt(g, CN_NE)
	put(g, 'cn1', '中国', 'army', CN_NE)
	g = fire(g)
	const cands = topCands(g)
	ok('候选含本格中国陆军', cands && cands.indexOf('cn1') >= 0, JSON.stringify(cands))
	g = rules.action(g, 'Axis', 'resolve_response_choice', { choice: 'cn1' })
	ok('中国陆军已被消灭', g.location['cn1'] == null)
	ok('已在<中国东北>征召 1 支日本陆军', jpArmyAt(g, CN_NE) === 1, 'n=' + jpArmyAt(g, CN_NE))
	ok('日志含征召成功', (g.log || []).some(l => /征召陆军/.test(l)), (g.log || []).slice(-1)[0])
}

console.log('\n=== B. 15434：敌方陆军只在相邻格 -> 不消灭，但照常征召 ===')
{
	let g = base('15434')
	clearAt(g, CN_NE)
	const nb = (I.data.spaces[CN_NE].connections || [])[0]
	clearAt(g, nb)
	put(g, 'cn2', '中国', 'army', nb)
	g = fire(g)
	const cands = topCands(g)
	ok('相邻格的中国陆军不在候选', !cands || cands.indexOf('cn2') < 0, JSON.stringify(cands))
	ok('相邻格陆军仍存在', g.location['cn2'] != null)
	ok('本格仍完成了征召', jpArmyAt(g, CN_NE) === 1, 'n=' + jpArmyAt(g, CN_NE))
}

console.log('\n=== C. 15434：杀完还剩敌方陆军 -> 征召失败并写明原因 ===')
{
	let g = base('15434')
	clearAt(g, CN_NE)
	put(g, 'cn3', '中国', 'army', CN_NE)
	put(g, 'uk3', '英国', 'army', CN_NE)
	g = fire(g)
	const cands = topCands(g)
	ok('候选含两支敌方陆军', cands && cands.indexOf('cn3') >= 0 && cands.indexOf('uk3') >= 0,
		JSON.stringify(cands))
	g = rules.action(g, 'Axis', 'resolve_response_choice', { choice: 'cn3' })
	ok('选中的中国陆军已被消灭', g.location['cn3'] == null)
	ok('剩余英国陆军仍在', g.location['uk3'] != null)
	ok('未征召（本格仍有敌方部队）', jpArmyAt(g, CN_NE) === 0, 'n=' + jpArmyAt(g, CN_NE))
	ok('日志写明"未征召：原因"', (g.log || []).some(l => /未征召：/.test(l)), (g.log || []).slice(-1)[0])
}

console.log('\n=== D. 15433 皖南事变：只消灭中国陆军 ===')
{
	let g = base('15433')
	clearAt(g, MONGOLIA); clearAt(g, WEST)
	put(g, 'cn4', '中国', 'army', MONGOLIA)
	put(g, 'uk4', '英国', 'army', WEST)
	g = fire(g)
	const cands = topCands(g) || []
	ok('候选含中国陆军', cands.indexOf('cn4') >= 0, JSON.stringify(cands))
	ok('英国陆军不在候选', cands.indexOf('uk4') < 0, JSON.stringify(cands))
	ok('候选全部是中国陆军（不限地区）',
		cands.length > 0 && cands.every(p => g.piece_nation[p] === '中国' && g.piece_type[p] === 'army'),
		JSON.stringify(cands.map(p => p + ':' + g.piece_nation[p])))
}

console.log('\n=== E. 7905 豫湘桂战役：只认<中国东部> ===')
{
	let g = base('7905')
	clearAt(g, CN_E); clearAt(g, CN_NE)
	put(g, 'cn5', '中国', 'army', CN_E)
	put(g, 'cn6', '中国', 'army', CN_NE)
	g = fire(g)
	const cands = topCands(g)
	ok('候选含<中国东部>的中国陆军', cands && cands.indexOf('cn5') >= 0, JSON.stringify(cands))
	ok('<中国东北>的中国陆军不在候选', cands && cands.indexOf('cn6') < 0, JSON.stringify(cands))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
