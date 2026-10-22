/*
 * 回归测试：「询问收回部队」三项口径（玩家 2026-10-22）
 *   ① 只能在本方回合内打开/关闭开关
 *   ② 询问挂起时【不能推进阶段】（须先移除或点「跳过」）
 *   ③ 打开后可移除【本方阵营任意部队】（不限当前行动国）
 *
 * 用法：node tools/_smoke_remove_ask.js
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

function base(currentNation, side) {
	const g = rules.setup(1)
	for (const p in g.location) delete g.location[p]      /* 清空开局棋子 */
	g.current_nation = currentNation
	g.active = (side === 'allies') ? 'Allies' : 'Axis'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.ask_remove = g.ask_remove || {}
	g.pending_ask = null
	return g
}
function put(g, pid, nation, type, space) {
	g.location[pid] = space !== undefined ? space : I.data.id_of('东欧')
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
}

console.log('=== A. 非本方回合不能打开开关 ===')
{
	let g = base('德国', 'allies')            /* 当前行动国=德国(轴心)，操作方=同盟 */
	g = rules.action(g, 'Allies', 'toggle_ask_remove', { value: true })
	ok('被拒绝并留日志', (g.log || []).some(l => /只能在【本方回合】内/.test(l)), (g.log || []).slice(-1)[0])
	ok('开关未被打开', !(g.ask_remove || {})['allies'])
}

console.log('\n=== B. 本方回合可以打开 ===')
{
	const g0 = base('德国', 'axis')
	const g = rules.action(g0, 'Axis', 'toggle_ask_remove', { value: true })
	ok('开关已打开', (g.ask_remove || {})['axis'] === true)
	ok('日志提示已开启', (g.log || []).some(l => /已开启/.test(l)), (g.log || []).slice(-1)[0])
}

console.log('\n=== C. 询问列出【本方阵营】全部部队（德/意/日），不含敌方 ===')
{
	const g = base('德国', 'axis')
	put(g, 'de1', '德国', 'army', I.data.id_of('东欧'))
	put(g, 'it1', '意大利', 'army', I.data.id_of('意大利'))
	put(g, 'jp1', '日本', 'navy', I.data.id_of('东海'))
	put(g, 'uk1', '英国', 'army', I.data.id_of('不列颠'))
	g.ask_remove.axis = true
	const pa = I.prepare_remove_ask(g, '德国')
	ok('已挂起询问', !!pa)
	const ids = (pa.pieces || []).map(x => x.id)
	ok('含德国部队', ids.indexOf('de1') >= 0, JSON.stringify(ids))
	ok('含意大利部队', ids.indexOf('it1') >= 0, JSON.stringify(ids))
	ok('含日本部队', ids.indexOf('jp1') >= 0, JSON.stringify(ids))
	ok('不含敌方(英国)部队', ids.indexOf('uk1') < 0, JSON.stringify(ids))
	ok('pending_ask 记录阵营', pa.faction === 'axis', pa.faction)
}

console.log('\n=== D. 询问挂起时不能推进阶段 ===')
{
	let g = base('德国', 'axis')
	put(g, 'de1', '德国', 'army', I.data.id_of('东欧'))
	put(g, 'it1', '意大利', 'army', I.data.id_of('意大利'))
	g.ask_remove.axis = true
	g = I.prepare_remove_ask(g, '德国') ? g : g
	const before = g.turn_phase
	g = rules.action(g, 'Axis', 'next_phase', {})
	ok('阶段未推进', g.turn_phase === before, 'phase=' + g.turn_phase)
	ok('日志要求先处理/跳过', (g.log || []).some(l => /收回部队】请先选择/.test(l)), (g.log || []).slice(-1)[0])
	const v = rules.view(g, 'Axis')
	ok('view.actions.next_phase 为 0', !v.actions || !v.actions.next_phase, JSON.stringify(v.actions && v.actions.next_phase))
}

console.log('\n=== E. 可移除盟军部队；移完后挂起自动清空 ===')
{
	let g = base('德国', 'axis')
	put(g, 'de1', '德国', 'army', I.data.id_of('东欧'))
	put(g, 'it1', '意大利', 'army', I.data.id_of('意大利'))
	g.ask_remove.axis = true
	I.prepare_remove_ask(g, '德国')
	g = rules.action(g, 'Axis', 'remove_piece', { piece: 'it1' })
	ok('意大利部队已收回', g.location['it1'] == null)
	ok('询问列表随之减少', (g.pending_ask.pieces || []).every(x => x.id !== 'it1'),
		JSON.stringify((g.pending_ask.pieces || []).map(x => x.id)))
	g = rules.action(g, 'Axis', 'remove_piece', { piece: 'de1' })
	ok('全部收回后询问清空', g.pending_ask === null)
}

console.log('\n=== F. 不能收回敌方部队 ===')
{
	let g = base('德国', 'axis')
	put(g, 'uk1', '英国', 'army', I.data.id_of('不列颠'))
	g = rules.action(g, 'Axis', 'remove_piece', { piece: 'uk1' })
	ok('敌方部队未被移除', g.location['uk1'] != null)
	ok('日志说明只能收回本方', (g.log || []).some(l => /只能收回本方阵营的部队/.test(l)), (g.log || []).slice(-1)[0])
}

console.log('\n=== G. 点「跳过」后可推进阶段 ===')
{
	let g = base('德国', 'axis')
	put(g, 'de1', '德国', 'army', I.data.id_of('东欧'))
	g.ask_remove.axis = true
	I.prepare_remove_ask(g, '德国')
	g = rules.action(g, 'Axis', 'clear_ask', {})
	ok('询问已清空', g.pending_ask === null)
	const before = g.turn_phase
	g = rules.action(g, 'Axis', 'next_phase', {})
	ok('阶段可推进', g.turn_phase !== before, before + ' -> ' + g.turn_phase)
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
