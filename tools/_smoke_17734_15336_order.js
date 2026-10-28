/*
 * 【2026-10-28 #1】响应链的事件顺序：piece_removed 先于 battle
 *
 * 玩家报告：17734《罗马尼亚增援》与 15336《法兰西爱国者》都往战斗地区征召，
 * 结果意大利（17734）必失败。
 *
 * 根因：do_battle 里先压 piece_removed（victim 被移除），后压 battle（战斗结算），
 * 而响应栈是 LIFO -> 后压的 battle 先结算，与事件发生顺序相反。
 * 实测：正常栈序下法国先进西欧 -> 意大利再征召被「有敌方部队」拒；
 *       把栈序对调则结果完全相反 —— 即"谁先结算谁赢"，玩家无从预期。
 *
 * 改法（方案 S）：request_responses 加 opt.deferToTail，do_battle 的 4 处 battle 派发
 * 都传 { deferToTail: true } —— 新帧压完后立刻摘到 deferred_response_stack，
 * 靠现有 promote_deferred_response（活动栈空 + 无 pending_battle 才提升）实现串行化。
 *
 * 覆盖：
 *   S1 battle 帧被延后（活动栈只剩 piece_removed，延后栈有 battle）
 *   S2 17734 先在战斗地区征召成功
 *   S3 15336 随后失败（该地区已有敌方部队）—— 此时失败才是正确的
 *   S4 没有 piece_removed 卡时：不 defer，battle 卡照常结算（行为不变）
 *   S5 源码守卫：4 处 battle 派发都传了 deferToTail
 *   S6 结算完：活动栈与延后栈都清空（无死锁）
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const data = I.data

const WE = data.id_of('西欧')
const GE = data.id_of('德国')

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* 造局：西欧德国陆军（victim，补给中），德国本土英国陆军（发起者） */
function make(cards) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1
	g.current_nation = '英国'
	g.active = 'Allies'
	for (const pid of Object.keys(g.location)) delete g.location[pid]
	const put = (p, s, n, t) => { g.location[p] = s; g.piece_nation[p] = n; g.piece_type[p] = t }
	put('de_army', WE, '德国', 'army')
	put('uk_army', GE, '英国', 'army')
	I.refresh(g)
	/* 夹具简化：两张卡都用 'allies' 作 owner_side，避免跨阵营让权干扰顺序断言 */
	g.table_responses = (cards || []).map(cid => ({ card_id: cid, nation: '英国', owner_side: 'allies' }))
	g.response_stack = []
	g.deferred_response_stack = []
	return g
}
function fight(g) {
	I.do_battle(g, '英国', WE, 'de_army', 'land', { from: 'uk_army' })
	if (g.pending_battle) rules.action(g, 'Allies', 'resolve_battle', { declined: true })
}
/* 交替推进：栈空则提升延后帧，然后结算栈顶 */
function settleAll(g, max) {
	let n = 0
	while (((g.response_stack || []).length || (g.deferred_response_stack || []).length) && n++ < (max || 8)) {
		if (!(g.response_stack || []).length) I.promote_deferred_response(g)
		rules.action(g, 'Allies', 'trigger_response', {})
	}
	return n
}
function logsSince(g, n) { return (g.log || []).slice(n) }
function piecesAt(g, sid) {
	return Object.keys(g.location).filter(p => g.location[p] === sid)
		.map(p => g.piece_nation[p] + g.piece_type[p])
}

/* ============================================================ */
section('S1 battle 帧被延后：活动栈只剩 piece_removed')
{
	const g = make(['17734#1', '15336#1'])
	fight(g)
	const active = (g.response_stack || []).map(f => f.card_face + '/' + f.on)
	const def = (g.deferred_response_stack || []).map(f => f.card_face + '/' + f.on)
	ok('★ 活动栈只剩 piece_removed', active.length === 1 && /piece_removed/.test(active[0]), active)
	ok('★ battle 帧进了延后栈', def.length === 1 && /battle/.test(def[0]), def)
}

section('S2 / S3 先 17734 后 15336：意大利成功、法国失败')
{
	const g = make(['17734#1', '15336#1'])
	const b0 = (g.log || []).length
	fight(g)
	settleAll(g)
	const logs = logsSince(g, b0).join('\n')
	const iRome = logs.indexOf('罗马尼亚增援')
	const iFrance = logs.indexOf('法兰西爱国者')
	ok('★ 罗马尼亚增援（piece_removed）先结算', iRome >= 0 && (iFrance < 0 || iRome < iFrance),
		{ iRome: iRome, iFrance: iFrance })
	ok('★ 意大利在西欧征召成功', /罗马尼亚增援》触发：在西欧征召意大利陆军/.test(logs),
		logs.split('\n').filter(l => /罗马尼亚/.test(l))[0])
	ok('★ 法国随后被拒（该地区已有敌方部队）', /法兰西爱国者加入同盟》触发：（无法征召）/.test(logs),
		logs.split('\n').filter(l => /法兰西/.test(l)))
	ok('★ 西欧最终是意大利陆军', piecesAt(g, WE).join(',') === '意大利army', piecesAt(g, WE))
}

section('S4 没有 piece_removed 卡时：不 defer，battle 卡照常结算')
{
	const g = make(['15336#1'])
	fight(g)
	const def = (g.deferred_response_stack || []).length
	ok('★ 未进延后栈（栈里没有别的链可等）', def === 0, def)
	const b0 = (g.log || []).length
	settleAll(g)
	ok('★ battle 卡正常结算（法国征召成功）',
		/法兰西爱国者加入同盟》触发：在西欧征召法国陆军/.test(logsSince(g, b0).join('\n')))
	ok('★ 西欧是法国陆军', piecesAt(g, WE).join(',') === '法国army', piecesAt(g, WE))
}

section('S5 源码守卫：4 处 battle 派发都传了 deferToTail')
{
	const src = require('fs').readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	const all = src.match(/request_responses\(game, 'battle'/g) || []
	const withDefer = src.match(/request_responses\(game, 'battle'[\s\S]{0,400}?deferToTail: true/g) || []
	ok('★ battle 派发点共 4 处', all.length === 4, all.length)
	ok('★ 全部带 deferToTail', withDefer.length === 4, withDefer.length)
}

section('S6 结算完不留残帧（无死锁）')
{
	const g = make(['17734#1', '15336#1'])
	fight(g)
	settleAll(g)
	ok('★ 活动栈清空', (g.response_stack || []).length === 0, (g.response_stack || []).length)
	ok('★ 延后栈清空', (g.deferred_response_stack || []).length === 0, (g.deferred_response_stack || []).length)
	ok('★ 没有挂起战斗', !g.pending_battle)
}

console.log('\n' + (fails.length ? ('有失败断言：' + fails.join(', ')) : '全部通过') +
	'  PASS ' + pass + ' / FAIL ' + fails.length)
process.exitCode = fails.length ? 1 : 0
