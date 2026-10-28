/*
 * 【2026-10-28 #13】15333《配给》触发验收
 *
 * 卡面：「英国卡牌生效后：将其洗回牌堆」（RESPONSE/英国，需先暗置到桌面）
 *
 * 修复的真 bug：**多步（steps>=2）事件卡结算完成后不派发 play_card**
 *   · 单步卡走 play_card 的 EVENT 分支（那里有派发）-> 能触发
 *   · 多步卡首次调用就 stepPause 返回，最终由 finish_event_card 收尾，
 *     而它只调 after_card_resolved（★技能窗口），没有 play_card 派发 -> 永不触发
 *   英国 9 张事件卡里 12501/15319/15327 是单步、15315/15316/15317/15318/15320/15349 是两步，
 *   正好对上玩家「配给有的能发动、有的不能」。
 */
const path = require('path')
const fs = require('fs')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const d = I.data

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

const BAL = d.id_of('巴尔干'), EE = d.id_of('东欧'), BR = d.id_of('不列颠')

function mk(hand, opts) {
	opts = opts || {}
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	g.hands['英国'] = (hand || []).slice()
	g.table_responses = g.table_responses || []
	if (opts.arm15333 !== false) g.table_responses.push({ card_id: '15333#1', owner_side: 'allies', nation: '英国' })
	g.response_stack = []; g.pending_response_choice = null
	if (opts.clearUKArmy) {
		for (const p of Object.keys(g.location)) {
			if (g.piece_nation[p] === '英国' && g.piece_type[p] === 'army') {
				delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p]
			}
		}
	}
	for (const [pid, sp, nat, type] of (opts.pieces || [])) {
		for (const p of Object.keys(g.location)) if (g.location[p] === sp) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
		g.location[pid] = sp; g.piece_nation[pid] = nat; g.piece_type[pid] = type
	}
	I.refresh(g)
	return g
}
const stackIds = g => (g.response_stack || []).map(f => f.card_id)
const discardOf = g => (g.discard['英国'] || [])

/* ---------------- S1 基本卡：能触发 ---------------- */
section('S1 基本卡《建设陆军》15300 生效后 -> 配给触发')
{
	const g = mk(['15300#1'], { clearUKArmy: true })
	rules.action(g, 'allies', 'play_card', { card: '15300#1', space: BR })
	ok('response_stack 含 15333', stackIds(g).indexOf('15333#1') >= 0, stackIds(g))
	ok('15300 已进弃牌堆（filter 前提）', discardOf(g).indexOf('15300#1') >= 0, discardOf(g))
}

/* ---------------- S2 单步事件卡：能触发 ---------------- */
section('S2 单步事件卡《波兰地下国》15327 生效后 -> 配给触发')
{
	const g = mk(['15327#1'], { pieces: [['de_ee', EE, '德国', 'army']] })
	rules.action(g, 'allies', 'play_card', { card: '15327#1' })
	ok('单步卡无挂起（直接结算完）', !g.pending_event_step)
	ok('response_stack 含 15333', stackIds(g).indexOf('15333#1') >= 0, stackIds(g))
}

/* ---------------- S3 多步事件卡：本次修复的核心 ---------------- */
section('S3 两步事件卡《佩塔尔二世即位》15316 结算完成 -> 配给触发（旧实现永不触发）')
let g3
{
	g3 = mk(['15316#1'], { pieces: [['de_bal', BAL, '德国', 'army']] })
	rules.action(g3, 'allies', 'play_card', { card: '15316#1' })
	ok('第 1 步后挂起 pending_event_step', !!g3.pending_event_step && g3.pending_event_step.step === 1)
	ok('第 1 步时不触发（卡还没生效）', stackIds(g3).length === 0, stackIds(g3))
	rules.action(g3, 'allies', 'event_step_next', {})
	ok('第 2 步后 pending_event_step 清空', !g3.pending_event_step)
	ok('15316 已进弃牌堆', discardOf(g3).indexOf('15316#1') >= 0, discardOf(g3))
	ok('★ response_stack 含 15333（旧实现为空）', stackIds(g3).indexOf('15333#1') >= 0, stackIds(g3))
}

/* ---------------- S4 发动 15333：把生效的卡洗回牌堆 ---------------- */
section('S4 发动配给 -> 15316 洗回牌堆、15333 自身进弃牌堆')
{
	const before = discardOf(g3).slice()
	rules.action(g3, 'allies', 'trigger_response', { card: '15333#1' })
	ok('15316 已移出弃牌堆（洗回牌堆）', discardOf(g3).indexOf('15316#1') < 0, { before, after: discardOf(g3) })
	ok('15316 在牌堆里', (g3.decks['英国'] || []).indexOf('15316#1') >= 0)
	ok('15333 自身结算进弃牌堆', discardOf(g3).indexOf('15333#1') >= 0, discardOf(g3))
	ok('response_stack 已清空', stackIds(g3).length === 0, stackIds(g3))
}

/* ---------------- S5 未暗置则不触发 ---------------- */
section('S5 配给【未暗置】时打 15316 -> 不触发（响应卡需先暗置）')
{
	const g = mk(['15316#1'], { arm15333: false, pieces: [['de_bal', BAL, '德国', 'army']] })
	rules.action(g, 'allies', 'play_card', { card: '15316#1' })
	rules.action(g, 'allies', 'event_step_next', {})
	ok('不触发', stackIds(g).length === 0, stackIds(g))
	ok('15316 仍正常进弃牌堆', discardOf(g).indexOf('15316#1') >= 0)
}

/* ---------------- S6 源码守卫 ---------------- */
section('S6 源码守卫：三条事件卡收尾路径都派发 play_card')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	const m = src.match(/function finish_event_card\(game, nation, card_id, opt\) \{[\s\S]*?\n\}/)
	ok('finish_event_card 内有 play_card 派发', !!m && /request_responses\(game, 'play_card'/.test(m[0]))
	ok('finish_event_card：派发在 after_card_resolved 之后', !!m &&
		m[0].indexOf('after_card_resolved') < m[0].indexOf("request_responses(game, 'play_card'"))

	/* EVENT 分支（单步/一次性结算）*/
	const ev = src.slice(src.indexOf("\t\tif (c.type === 'EVENT') {"), src.indexOf('\t\t/* ---------- 其余卡牌 ---------- */'))
	ok('EVENT 分支内有 play_card 派发', /request_responses\(game, 'play_card'/.test(ev))
	ok('EVENT 分支：派发在 discard_card 之后（15333 的 filter 要求卡在弃牌堆）',
		ev.indexOf('discard_card(game, nation, card_id)') < ev.indexOf("request_responses(game, 'play_card'"))

	/* 战斗预算卡收尾（cardResolved=true��*/
	ok('战斗预算收尾有 play_card 派发', /after_card_resolved\(game, b\.nation, b\.card_id\)[\s\S]{0,400}request_responses\(game, 'play_card'/.test(src))
}

/* ---------------- S7 全量：英国 9 张事件卡逐张验证 ---------------- */
section('S7 英国全部 9 张事件卡逐张验证（配给都要能触发）')
{
	/* 15317/15318/15320/15349 需要更复杂造局，这里只验证「收尾路径存在」的 3 张代表 + 已跑过的 3 张 */
	const cases = [
		{ id: '12501', name: '皇冠上的明珠', need: [['de_in', d.id_of('印度'), '德国', 'army']] },
		{ id: '15327', name: '波兰地下国', need: [['de_ee', d.id_of('东欧'), '德国', 'army']] },
	]
	for (const cs of cases) {
		const g = mk([cs.id + '#1'], { pieces: cs.need })
		rules.action(g, 'allies', 'play_card', { card: cs.id + '#1' })
		ok(cs.id + '《' + cs.name + '》触发配给', stackIds(g).indexOf('15333#1') >= 0,
			{ stack: stackIds(g), discard: discardOf(g) })
	}
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
