/*
 * 【B65】拦截放行重放时必须带回原 arg（15412 御前会议「扔的牌又回来了」）。
 *
 * 玩家报障（2026-11-27）：
 *   御前会议（15412）拦截不触发时 —— 日本弃 1 张响应、英国选「不康」，
 *   之后「再点增强只能从剩下六张里选」，手动补牌完成增强后，
 *   「之前扔的响应又回到手里」。
 *
 * 根因（不是 run 失败）：
 *   · play_card 入队只存 { card, nation }（L33330 / L33336），**没有 arg**；
 *   · 英国选「不发动」-> release_echo_entry 用 { card } 裸重放 play_card；
 *   · 15412 是 one_step 卡（一次提交要同时给 drop + play），arg.play 丢了
 *     -> event_card_needs 又返回 need:'one_step_pick' -> 窗口二次弹出；
 *   · 而代价记账 __echo_cost_paid[card] 已在第一次置位 -> 第二次提交【不再扣代价】
 *     -> 玩家选的 drop 牌留在手里（"扔的又回来了"），桌面却被多打出一张。
 *
 * 修法：
 *   ① 入队时保存 arg（entry.arg）；
 *   ② release_echo_entry 重放时 Object.assign({}, entry.arg, { card })（card 优先）。
 *   flush_echo_queue（窗口被无关动作清掉）走同一函数，一并受益。
 *
 * 用法：node tools/_real_test_B65_echo_replay_arg.js
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

function seed() {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.active = 'Axis'
	g.current_nation = '日本'
	g.turn_phase = 'draw'
	/*
	 * 日本手牌：御前会议本体（15412，重放要求它仍在手牌 —— 入队发生在卡离手之前）
	 * + 2 张响应卡（1 张作代价 drop、1 张打出 play）
	 */
	g.hands['日本'] = ['15412#e1', '15430#r1', '15426#r2', '15229#c1', '15239#c2']
	g.table_responses = []
	g.discard['日本'] = []
	g.echo_intercept_queue = []
	return g
}
const snap = g => ({
	hand: J(g.hands['日本']),
	discard: J(g.discard['日本']),
	facedown: J((g.table_responses || []).map(x => x.card_id || x.card_face || x)),
	pendingEcho: J(g.pending_echo && { kind: g.pending_echo.kind, card: g.pending_echo.card }),
})

console.log('=== A. 修复后：entry 带 arg -> 一次结算完成（不再二次弹窗）===')
{
	const g = seed()
	const entry = {
		card: '15412#e1', nation: '日本',
		/* 客户端真实形态：代价走 arg.cards（数组），打出走 arg.play（字符串） */
		arg: { cards: ['15430#r1'], play: '15426#r2' },
	}
	I.release_echo_entry(g, entry)
	const s = snap(g)
	ok('★★ 打出的响应已暗置桌面（15426）', /15426#r2/.test(s.facedown), s.facedown)
	ok('★★ 代价已弃置（15430 进弃牌堆）', /15430#r1/.test(s.discard), s.discard)
	ok('★★ 两张都离开手牌（不残留 -> 不会"又回到手里"）',
		!/15430#r1/.test(s.hand) && !/15426#r2/.test(s.hand), s.hand)
	ok('★★ 没有二次弹窗（pending_echo 为空）', !g.pending_echo, s.pendingEcho)
	ok('★★ 桌面恰好只多 1 张暗置', (g.table_responses || []).length === 1,
		J((g.table_responses || []).length))
}

console.log('\n=== B. 对照：entry 不带 arg（旧行为）-> 停在 need:one_step_pick ===')
{
	const g = seed()
	const entry = { card: '15412#e1', nation: '日本' }
	I.release_echo_entry(g, entry)
	const s = snap(g)
	ok('★ 旧行为：没有打出任何响应', (g.table_responses || []).length === 0, s.facedown)
	ok('★★ 旧行为：窗口二次挂起（pending_echo 或 need 态）',
		!!(g.pending_echo) || /15430#r1/.test(s.hand), J({ p: s.pendingEcho, hand: s.hand }))
	console.log('     （A 与 B 的差异即为本 bug 的表现：B 会要求玩家再选一次）')
}

console.log('\n=== C. 静态守卫 ===')
{
	ok('★★ 入队两处都保存了 arg', (() => {
		const n = (SRC.match(/_q\.push\(\{ card: card_id, nation: nation, arg: Object\.assign\(\{\}, arg \|\| \{\}\) \}\)/g) || []).length
		return n === 2
	})(), J((SRC.match(/_q\.push\(\{ card: card_id, nation: nation, arg: Object\.assign\(\{\}, arg \|\| \{\}\) \}\)/g) || []).length))
	ok('★★ release_echo_entry 重放带 entry.arg', /Object\.assign\(\{\}, entry\.arg \|\| \{\}, \{ card: entry\.card \}\)/.test(SRC))
	ok('★★ card 放在最后（防止被 arg 残留字段覆盖）', (() => {
		const m = SRC.match(/Object\.assign\(\{\}, entry\.arg \|\| \{\}, \{ card: entry\.card \}\)/)
		return !!m
	})())
	ok('★ 不再有裸重放 { card: entry.card }', !/'play_card', \{ card: entry\.card \}\)/.test(SRC))
	ok('★ flush_echo_queue 仍走 release_echo_entry（同一修法覆盖）', /flush_echo_queue[\s\S]{0,600}release_echo_entry\(game, e\)/.test(SRC))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
