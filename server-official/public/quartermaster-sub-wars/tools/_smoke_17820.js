/*
 * 回归测试：17820《方面军》
 *   卡面：在<莫斯科>或相邻地区建设1支陆军。以此陆军发起1次陆战。
 *
 * 玩家 2026-10-22：方面军给了战斗预算，却无法实际发起战斗。
 * 根因三处：
 *   ① can_build_at 不校验槽位 -> 候选含"已有本国陆军"的大本营 -> 建设静默失败；
 *   ② 分步停机只存 arg，续跑到 battle 步时 useNewPiece 的 newPiece 丢失 -> 预算目标恒空；
 *   ③ 即便建设失败，battle 步仍建立 newPiece=null 的预算 -> 永远点不出目标。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_17820.js
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}
function base() {
	const g = rules.setup(12345, 'Standard', {})
	g.opening = null
	g.active = 'Allies'
	g.current_nation = '苏联'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	/* 苏联开局中立，不参战不能发起战斗；本卡测的是预算/发起链路，先结束中立 */
	g.neutral = Object.assign({}, g.neutral, { '苏联': false })
	g.hands['苏联'] = g.hands['苏联'] || []
	g.hands['苏联'].push('17820#1')
	return g
}

console.log('=== A. 建设候选不得包含"已有本国陆军"的大本营 ===')
{
	const g = base()
	const n0 = I.event_card_needs(g, '苏联', '17820#1', {})
	const cands = n0.candidates || []
	const hasHome = cands.indexOf(9) >= 0
	ok('莫斯科(9) 不在候选内', !hasHome, JSON.stringify(cands))
	ok('仍有其它合法建设地', cands.length > 0, JSON.stringify(cands))
	ok('can_build_at(9) 现在会拒绝', I.can_build_at(g, '苏联', 9, 'army').ok === false,
		JSON.stringify(I.can_build_at(g, '苏联', 9, 'army')))
}

console.log('\n=== B. 建设成功 -> 暂停 -> 下一步 -> 预算带 newPiece 且目标非空 ===')
let g = base()
{
	const n0 = I.event_card_needs(g, '苏联', '17820#1', {})
	const sp = n0.candidates.find(x => x === 7) != null ? 7 : n0.candidates[0]
	g = rules.action(g, 'Allies', 'play_card', { card: '17820#1', spaces: [sp], space: sp })
	ok('第 1 步后暂停', !!(g.pending_event_step && g.pending_event_step.step === 1),
		JSON.stringify(g.pending_event_step && g.pending_event_step.step))
	ok('挂起里带着 newPiece', !!(g.pending_event_step && g.pending_event_step.newPiece),
		JSON.stringify(g.pending_event_step && g.pending_event_step.newPiece))

	g = rules.action(g, 'Allies', 'event_step_next', {})
	const b = g.event_budget
	ok('建立了战斗预算', !!b, JSON.stringify(b))
	ok('newPiece 已恢复', !!(b && b.newPiece), JSON.stringify(b && b.newPiece))
	const v = rules.view(g, 'Allies')
	ok('targets 非空', !!((v.event_budget || {}).targets || []).length,
		JSON.stringify(v.event_budget && v.event_budget.targets))
	ok('actions 含 event_battle', !!(v.actions && v.actions.event_battle), JSON.stringify(v.actions))
}

console.log('\n=== C. 真实发起战斗（event_battle）===')
{
	const v = rules.view(g, 'Allies')
	const target = (v.event_budget.targets || [])[0]
	const before = (g.log || []).length
	g = rules.action(g, 'Allies', 'event_battle', { target: target })
	const tail = (g.log || []).slice(before).join(' | ')
	ok('没有"不是合法目标"报错', tail.indexOf('不是合法目标') < 0, tail)
	ok('战斗已发生（remaining 减少）', g.event_budget && g.event_budget.remaining === 0,
		JSON.stringify(g.event_budget && g.event_budget.remaining))
	ok('日志含陆战', tail.indexOf('陆战') >= 0, tail)
}

console.log('\n=== D. 建设失败时不建立空预算（不给死预算）===')
{
	let g2 = base()
	/* 显式指定已占用的莫斯科（绕过候选过滤，模拟"建设这一步没做成"） */
	g2 = rules.action(g2, 'Allies', 'play_card', { card: '17820#1', spaces: [9], space: 9 })
	ok('未建立战斗预算', !g2.event_budget, JSON.stringify(g2.event_budget))
	ok('卡未被打掉（仍留手牌）', (g2.hands['苏联'] || []).indexOf('17820#1') >= 0,
		JSON.stringify(g2.hands['苏联']))
	ok('日志说明无法执行', (g2.log || []).some(l => l.indexOf('无法执行') >= 0),
		(g2.log || []).slice(-1)[0])
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
