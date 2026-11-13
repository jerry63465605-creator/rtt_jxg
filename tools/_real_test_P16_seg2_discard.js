/*
 * 【D1/P16】14903 C 段「[除非英国弃置2张手牌] 打出1张前奏手牌」
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_real_test_P16_seg2_discard.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const C = require(path.join(MOD, 'cards.js'))
const P = require(path.join(MOD, 'prelude_compiler.js'))
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started() {
	const g = R.setup(20261112, 'Episode 2')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
const acts = (g, side) => R.view(g, side).actions || {}
const cfgOf = id => {
	const x = C.CARD_BY_ID[id]
	return P.compile({ id: x.id, nation: x.nation, deck: x.deck,
		type: x.type, name: x.name, text: x.text }).config
}
/* 到达 C 段：摆前奏牌堆（军备卡）走完 P14 检视选牌窗口，德国留 2 张手牌 */
function reachSeg2(handCount) {
	const g = started()
	const de = g.current_nation
	g.prelude.decks[de] = ['18416#p1', '18416#p2', '18416#p3']
	g.prelude.hands[de] = ['14903#t1']
	/* 用真实军备卡实例：有卡图，且 P5 打出即暗置留场、不会连锁开新窗口 */
	for (let i = 0; i < (handCount === undefined ? 2 : handCount); i++)
		g.prelude.hands[de].push('18416#h' + (i + 1))
	R.action(g, g.active, 'prelude_play_hand', { card: '14903#t1' })
	const w = g.prelude.op_window
	if (w && w.candidates && w.candidates.length) {
		const s = ['Axis', 'Allies'].find(x => (R.view(g, x).actions || {}).prelude_op_pick)
		R.action(g, s, 'prelude_op_pick', { pick: w.candidates[0].id })
	}
	return g
}

console.log('=== A. C 段编译产物与弃牌候选下发 ===')
{
	const cfg = cfgOf(14903)
	const seg = cfg.segments[1]
	ok('★★ C 段是 opponentOptOut、opponent=英国、代价=弃 2 张',
		seg.kind === 'opponentOptOut' && seg.opponent === '英国' &&
		seg.opponentCost && seg.opponentCost.discard === 2,
		J({ kind: seg.kind, opp: seg.opponent, cost: seg.opponentCost }))
	const g = reachSeg2()
	const vk = R.view(g, 'Allies')
	const vd = R.view(g, 'Axis')
	const od = vk.prelude.pending && vk.prelude.pending.opponentDiscard
	ok('★★ 英国视角拿到 opponentDiscard（need=2、候选=正式手牌带卡图）',
		!!od && od.nation === '英国' && od.need === 2 &&
		od.candidates.length === (g.hands['英国'] || []).length &&
		od.candidates.every(c => c.id && c.name && c.img && c.type),
		J(od && { need: od.need, n: od.candidates.length, first: od.candidates[0] }))
	ok('★★ 德国视角 opponentDiscard=null（英国手牌不泄露）',
		vd.prelude.pending && vd.prelude.pending.opponentDiscard === null,
		J(vd.prelude.pending && vd.prelude.pending.opponentDiscard))
	ok('★ 段窗口白名单仍只给答复方阵营',
		acts(g, 'Allies').prelude_pay === 1 && acts(g, 'Allies').prelude_skip === 1 &&
		!acts(g, 'Axis').prelude_pay && !acts(g, 'Axis').prelude_skip,
		J({ uk: acts(g, 'Allies'), de: acts(g, 'Axis') }))
}

console.log('\n=== B. prelude_pay 必须真的弃牌（拒绝非法提交）===')
{
	const g = reachSeg2()
	const uk0 = (g.hands['英国'] || []).length
	const disc0 = (g.discard['英国'] || []).length
	const ids = (g.hands['英国'] || []).slice(0, 3)
	R.action(g, 'Allies', 'prelude_pay', {})
	ok('★★ 无 cards 被拒：窗口保留、一张不弃',
		!!g.prelude.pending && (g.hands['英国'] || []).length === uk0 &&
		(g.discard['英国'] || []).length === disc0,
		J({ pending: !!g.prelude.pending, hand: (g.hands['英国'] || []).length }))
	R.action(g, 'Allies', 'prelude_pay', { cards: [ids[0]] })
	ok('★★ 数量不足被拒',
		!!g.prelude.pending && (g.hands['英国'] || []).length === uk0,
		J((g.log || []).slice(-2)))
	R.action(g, 'Allies', 'prelude_pay', { cards: [ids[0], ids[0]] })
	ok('★★ 重复实例被拒',
		!!g.prelude.pending && (g.hands['英国'] || []).length === uk0,
		J((g.log || []).slice(-2)))
	R.action(g, 'Allies', 'prelude_pay', { cards: [ids[0], '99999#fake'] })
	ok('★★ 非英国手牌被拒',
		!!g.prelude.pending && (g.hands['英国'] || []).length === uk0,
		J((g.log || []).slice(-2)))
	ok('★ 拒绝日志写明「所选弃牌不合法」',
		(g.log || []).some(l => /所选弃牌不合法/.test(l)),
		J((g.log || []).slice(-3)))
}

console.log('\n=== C. 合法弃 2 张：弃完才阻止段、归还德国 ===')
{
	const g = reachSeg2()
	const de = g.current_nation
	const handDe0 = (g.prelude.hands[de] || []).slice()
	const uk0 = (g.hands['英国'] || []).length
	const disc0 = (g.discard['英国'] || []).length
	const ids = (g.hands['英国'] || []).slice(0, 2)
	const l0 = g.log.length
	R.action(g, 'Allies', 'prelude_pay', { cards: ids })
	ok('★★ 英国正式手牌 -2、弃牌堆 +2（逐张 discard_card）',
		(g.hands['英国'] || []).length === uk0 - 2 &&
		(g.discard['英国'] || []).length === disc0 + 2 &&
		ids.every(id => (g.discard['英国'] || []).indexOf(id) >= 0),
		J({ hand: (g.hands['英国'] || []).length,
			disc: (g.discard['英国'] || []).length }))
	ok('★★ 段未执行（德国前奏手牌不变）',
		J(g.prelude.hands[de]) === J(handDe0),
		J({ before: handDe0, after: g.prelude.hands[de] }))
	ok('★★ 段窗口清空、没有遗留选牌窗口',
		!g.prelude.pending && !g.prelude.op_window,
		J({ pending: !!g.prelude.pending, win: !!g.prelude.op_window }))
	ok('★★ 日志有「弃置 2 张正式手牌」与「操作权归还」',
		(g.log || []).slice(l0).some(l => /弃置 2 张正式手牌作为代价/.test(l)) &&
		(g.log || []).slice(l0).some(l => /操作权归还/.test(l)),
		J((g.log || []).slice(l0)))
	ok('★★ current_nation / active 未被物理切换（按确认口径）',
		g.current_nation === de && g.active === 'Axis',
		J({ nation: g.current_nation, active: g.active }))
	ok('★★ 德国白名单恢复（继续卡牌阶段）',
		g.prelude.phase === 'prelude_cards' && acts(g, 'Axis').prelude_next === 1,
		J({ phase: g.prelude.phase, acts: acts(g, 'Axis') }))
}

console.log('\n=== D. 不支付 → 德国多张前奏手牌时弹选牌窗口 ===')
{
	const g = reachSeg2(3)
	const de = g.current_nation
	const hand0 = (g.prelude.hands[de] || []).slice()
	const l0 = g.log.length
	R.action(g, 'Allies', 'prelude_skip', {})
	const w = g.prelude.op_window
	ok('★★ 开出 card 选牌窗口（复用 P14 卡图弹窗）',
		!!w && w.kind === 'card' && w.op.op === 'play_prelude' &&
		w.inspect === true && w.cancellable === false,
		J(w && { kind: w.kind, op: w.op.op, inspect: w.inspect }))
	ok('★★ 候选 = 当前德国前奏手牌（带卡图、不是第一张默认）',
		!!w && w.candidates.length === hand0.length &&
		w.candidates.every(c => hand0.indexOf(c.id) >= 0 && c.img && c.type),
		J(w && w.candidates.map(c => c.id)))
	ok('★ 标题是「选择 1 张前奏手牌打出」',
		w && /选择 1 张前奏手牌打出/.test(w.desc || ''),
		J(w && w.desc))
	ok('★ 日志有归还（段窗口结算完成）',
		(g.log || []).slice(l0).some(l => /操作权归还/.test(l)),
		J((g.log || []).slice(l0)))
	/* 选第 2 张（不是第一张） */
	const pick = hand0[1]
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	R.action(g, side, 'prelude_op_pick', { pick: pick })
	ok('★★ 打出的正是玩家选中的那张，手牌移除该张',
		(g.prelude.hands[de] || []).indexOf(pick) < 0 &&
		(g.prelude.hands[de] || []).length === hand0.length - 1,
		J({ before: hand0, after: g.prelude.hands[de] }))
	ok('★★ 选完窗口清空、流程继续（进卡牌阶段）',
		!g.prelude.op_window && g.prelude.phase === 'prelude_cards',
		J({ win: !!g.prelude.op_window, phase: g.prelude.phase }))
}

console.log('\n=== E. 仅 1 张前奏手牌时直接打、不多弹窗口 ===')
{
	const g = reachSeg2(1)
	const de = g.current_nation
	const hand0 = (g.prelude.hands[de] || []).slice()
	R.action(g, 'Allies', 'prelude_skip', {})
	ok('★★ 无选牌窗口、唯一那张直接打出',
		!g.prelude.op_window && (g.prelude.hands[de] || []).length === 0,
		J({ win: !!g.prelude.op_window, hand: g.prelude.hands[de] }))
	ok('★ 流程走完（进卡牌阶段）', g.prelude.phase === 'prelude_cards',
		J(g.prelude.phase))
	console.log('    [info] 打出前手牌=' + J(hand0))
}

console.log('\n=== F. 无弃牌代价的段窗口保持原行为（不回归）===')
{
	const g = reachSeg2()
	/* 模拟一张「无弃牌代价」的 C 段：清掉 opponentDiscard 与段代价。
	 * 【D1/P17】只删字段会被旧存档兼容逻辑按 opponentCost 自动补建。 */
	delete g.prelude.pending.opponentDiscard
	g.prelude.pending.segments[0].opponentCost = {}
	const de = g.current_nation
	const hand0 = (g.prelude.hands[de] || []).length
	R.action(g, 'Allies', 'prelude_pay', {})
	ok('★★ 无代价时 prelude_pay{} 仍可支付、清窗口',
		!g.prelude.pending,
		J({ pending: !!g.prelude.pending, hand: (g.prelude.hands[de] || []).length }))
	ok('★ 段未执行（对手已阻止）',
		(g.prelude.hands[de] || []).length === hand0,
		J((g.prelude.hands[de] || []).length))
}

console.log('\n=== G. 静态守卫（客户端第 5 用户 + P14 弹窗复用）===')
{
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ 服务端：候选落盘 + 只给答复方 + 校验 + discard_card + 归还',
		/opponentDiscard = \{/.test(src) &&
		/faction_role_of_nation\(p\.pending\.answerNation\) === current/.test(src) &&
		/所选弃牌不合法/.test(src) &&
		/for \(const id of cards\) discard_card\(/.test(src) &&
		/操作权归还/.test(src))
	ok('★★ 服务端：play_prelude 登记 card 窗口、多张才弹、选中执行',
		/play_prelude: 'card'/.test(src) &&
		/op\.op === 'play_prelude' && \(p\.hands\[nation\] \|\| \[\]\)\.length <= 1/.test(src) &&
		/选择 1 张前奏手牌打出/.test(src) &&
		/prelude_resolve_card\(game, owner, pick\)/.test(src))
	ok('★★ 客户端：echo_discard_modal 第 5 个用户',
		/let prelude_opponent_discard_sel = null/.test(pjs) &&
		/function render_prelude_opponent_discard_box\(\)/.test(pjs) &&
		/if \(prelude_opponent_discard_sel\) \{/.test(pjs) &&
		/send_action\("prelude_pay", \{ cards: s\.picked\.slice\(\) \}\)/.test(pjs))
	ok('★★ 确认/取消分流：确认发 cards、取消发 prelude_skip',
		/finish_prelude_opponent_discard\(\)/.test(pjs) &&
		/skip_prelude_opponent_discard\(\)/.test(pjs) &&
		/send_action\("prelude_skip", \{\}\)/.test(pjs))
	ok('★★ 段窗口不再给「支付代价」文字按钮（有代价时）',
		/p\.pending\.opponentDiscard\) \{/.test(pjs) &&
		/请在弃牌弹框中选/.test(pjs))
	ok('★ P14 弹窗文案通用化（复用作打牌选牌）',
		/候选牌（点击选择）/.test(pjs))
	ok('★ 客户端零新增 modal（复用 echo_discard_modal 与 prelude_peek_modal）',
		/id="echo_discard_modal"/.test(phtml) &&
		/id="prelude_peek_modal"/.test(phtml))
	const vers = (phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	/* 【D1/P20】后续期因客户端改动 bump 过，这里只校验统一性 */
	ok('★ 版本串统一且非空',
		vers.length >= 5 && vers.every(v => v && v === vers[0]),
		[...new Set(vers)])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
