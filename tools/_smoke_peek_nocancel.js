/* 【2026-10-01 玩家口径】观看【对手】手牌的弹框不能取消（回归测试）
 *
 * 起因：双十字系统(15305) 会随机展示对手 2 张手牌。
 * 若允许取消，玩家等于【白看】对手秘密信息而不付出任何代价 —— 不公平。
 *
 * 【2026-10-01 玩家最终口径】+ 卓越规划(15215) 看【自己】牌堆顶 5 张
 * 也【不能取消】—— 知道牌堆顶顺序 = 知道接下来会摸什么，同样是信息优势。
 * => 结论：**任何 peek 弹窗一律不可取消**，必须排完序点【确认】。
 *
 * ⚠ 关键事实（测试 1 验证，别再搞错）：
 *   15305 双十字走的是 **query 路径**（event_card_needs 返回
 *   need:'peek_reorder'），query 是只读 RPC，**服务端不建立 game.peek**；
 *   弹框由客户端用 pending_peek_for_card / peek_cards / peek_target 本地渲染。
 *   => 真正拦截取消的是【客户端】：peek_target(对手) != view.my_nation(我方)。
 *   服务端 clear_peek 的 opponent 守卫只是【兜底】
 *   （防直接发 action / 旧客户端 / 脚本绕过，以及将来启用路径 A 时）。
 *
 * 对照：15215 卓越规划 检视【自己】牌堆顶，无信息泄露，取消无害，照常允许。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) }
}
function logHas(g, s) {
	return (g.log || []).some(x => String(x).indexOf(s) >= 0)
}

/* ---- 1. 双十字系统：客户端判定依据 = 被看方是对手 ---- */
console.log('\n=== 1. 双十字系统(15305)：query 路径判定"看的是对手" ===')
{
	const g = rules.setup(1)
	g.current_nation = '英国'; g.active = 'Allies'; g.turn_phase = 'draw'
	g.hands['德国'] = ['deA#1', 'deB#1', 'deC#1', 'deD#1']
	g.hands['英国'] = ['15305#1']
	g.decks['德国'] = ['deDeck1#1', 'deDeck2#1']

	/* 服务端先随机挑出对手手牌，客户端据此弹框 */
	const need = I.event_card_needs(g, '英国', '15305#1', {})
	console.log('  need ->', JSON.stringify(need))
	ok('query 返回 need=peek_reorder',
		!!need && need.need === 'peek_reorder', 'need=' + JSON.stringify(need))
	const picked = (need && need.cards) || []
	ok('挑出 2 张对手手牌', picked.length === 2, 'picked=' + JSON.stringify(picked))
	ok('target 是对手【德国】', need && need.target === '德国',
		'target=' + (need && need.target))

	/* 客户端判定：被看方 != 我方 -> 隐藏取消 */
	const myNat = rules.view(g, 'Allies').my_nation
	ok('我方是英国', myNat === '英国', 'my_nation=' + myNat)
	ok('被看方(德国) != 我方(英国) -> 客户端判"看对手"，应隐藏取消',
		need && need.target !== myNat,
		'target=' + (need && need.target) + ' my=' + myNat)

	/* query 是只读的：不应写 game.peek（否则 view 也不广播，弹框会失效） */
	ok('query 未建立 game.peek（只读 RPC）', !g.peek,
		'peek=' + JSON.stringify(g.peek))
}

/* ---- 2. 服务端兜底：任何 peek 都禁止 clear_peek ---- */
console.log('\n=== 2. 服务端兜底：任何 peek 的 clear_peek 都被拒 ===')
{
	const g = rules.setup(1)
	g.current_nation = '英国'; g.active = 'Allies'

	/* ① 看【对手】手牌（双十字系统 15305） */
	g.peek = { nation: '德国', cards: ['deA#1', 'deB#1'], card: '15305#1' }
	const g2 = rules.action(g, 'Allies', 'clear_peek', {})
	ok('双十字/看对手手牌 -> clear_peek 被拒（peek 保留）', !!g2.peek,
		'peek=' + JSON.stringify(g2.peek))
	ok('给出"不能取消"提示', logHas(g2, '不能取消'),
		'log=' + JSON.stringify(g2.log.slice(-2)))

	/* ②【2026-10-01 新口径】看【自己】牌堆顶（卓越规划 15215）也【不能】取消：
	 *    看到自己牌堆顶 5 张 = 知道接下来会摸什么，同样是信息，取消等于免费偷看。 */
	g.peek = { nation: '德国', cards: ['dk1#1', 'dk2#1'], card: '15215#1', topBottom: true }
	const g3 = rules.action(g, 'Axis', 'clear_peek', {})
	ok('卓越规划/看自己牌堆 -> clear_peek 也【被拒】', !!g3.peek,
		'peek=' + JSON.stringify(g3.peek))
	ok('同样给出"不能取消"提示', logHas(g3, '不能取消'),
		'log=' + JSON.stringify(g3.log.slice(-2)))

	/* 不再有 opponent 字段（口径统一后已移除，避免客户端靠它分支） */
	const v = rules.view(g3, 'Axis')
	ok('view.peek 不再下发 opponent（口径统一）',
		v.peek && v.peek.opponent === undefined,
		'view.peek=' + JSON.stringify(v.peek && {
			nation: v.peek.nation, topBottom: v.peek.topBottom, count: v.peek.count
		}))
}

/* ---- 3. 双十字系统完整流程：query -> 提交 order -> 牌堆顶顺序正确 ---- */
console.log('\n=== 3. 双十字系统完整流程：按 order 逆序置于对手牌堆顶 ===')
{
	const g = rules.setup(1)
	g.current_nation = '英国'; g.active = 'Allies'; g.turn_phase = 'draw'
	g.hands['德国'] = ['deA#1', 'deB#1', 'deC#1', 'deD#1']
	g.hands['英国'] = ['15305#1']
	g.decks['德国'] = ['deDeck1#1', 'deDeck2#1']

	const need = I.event_card_needs(g, '英国', '15305#1', {})
	const picked = (need && need.cards) || []
	ok('query 挑出 2 张', picked.length === 2, 'picked=' + JSON.stringify(picked))

	/*
	 * 走【真实客户端路径】play_card（不是内部 resolve_event_card）：
	 * 客户端 query 拿到 picked 后，玩家排好序点"确认顺序"，
	 * 就发 play_card { card, order, peek_cards }。
	 * 这样才能覆盖"弃牌"等完整结算（resolve_event_card 只做效果，不弃牌）。
	 */
	const g2 = rules.action(g, 'Allies', 'play_card', {
		card: '15305#1',
		order: picked.slice(),
		peek_cards: picked.slice(),
	})
	console.log('  play_card log ->', JSON.stringify(g2.log.slice(-3)))
	ok('提交后 game.peek 清除', !g2.peek, 'peek=' + JSON.stringify(g2.peek))
	ok('被看的 2 张已从对手手牌移除',
		picked.length === 2 && picked.every(id => (g2.hands['德国'] || []).indexOf(id) < 0),
		'hand=' + JSON.stringify(g2.hands['德国']))
	ok('order[0] 位于牌堆最顶',
		(g2.decks['德国'] || [])[0] === picked[0],
		'deckTop=' + (g2.decks['德国'] || [])[0] + ' expect=' + picked[0])
	ok('order[1] 位于牌堆次顶',
		(g2.decks['德国'] || [])[1] === picked[1],
		'deck[1]=' + (g2.decks['德国'] || [])[1] + ' expect=' + picked[1])
	ok('双十字系统已离手牌',
		(g2.hands['英国'] || []).indexOf('15305#1') < 0,
		'hand=' + JSON.stringify(g2.hands['英国']))
	ok('双十字系统已进弃牌堆',
		(g2.discard['英国'] || []).indexOf('15305#1') >= 0,
		'discard=' + JSON.stringify(g2.discard['英国']))
}

/* ---- 4. 卓越规划：看自己牌堆，同样【不能】取消（2026-10-01 新口径）---- */
console.log('\n=== 4. 卓越规划(15215)：看自己牌堆，clear_peek 也【不允许】 ===')
{
	const g = rules.setup(1)
	g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'
	g.decks['德国'] = ['dk1#1', 'dk2#1', 'dk3#1', 'dk4#1', 'dk5#1', 'dk6#1']
	g.hands['德国'] = ['15215#1']

	const r = I.resolve_event_card(g, '德国', '15215#1', {})
	console.log('  resolve ->', JSON.stringify(r))
	ok('进入 pending（等待玩家决定顶/底）', !!(r && r.pending), 'r=' + JSON.stringify(r))
	if (g.peek) {
		ok('peek 已建立', !!g.peek, 'peek=' + JSON.stringify(g.peek))
		ok('peek 不再带 opponent 字段', g.peek.opponent === undefined,
			'opponent=' + g.peek.opponent)
		/*
		 * 新口径：即便看的是【自己】牌堆（nation == 我方），
		 * 依然不允许取消 —— 知道牌堆顶顺序本身就是信息。
		 */
		const g2 = rules.action(g, 'Axis', 'clear_peek', {})
		ok('clear_peek 被拒（peek 保留）', !!g2.peek, 'peek=' + JSON.stringify(g2.peek))
		ok('提示"不能取消"', logHas(g2, '不能取消'),
			'log=' + JSON.stringify(g2.log.slice(-2)))
	} else {
		ok('（本路径未建立 game.peek，跳过）', true)
	}
}

console.log('\n=== 5. 无 peek 时 clear_peek 安全返回 ===')
{
	const g = rules.setup(1)
	g.current_nation = '英国'; g.active = 'Allies'
	g.peek = null
	const g2 = rules.action(g, 'Allies', 'clear_peek', {})
	ok('无 peek 时提示并返回（不崩溃）', logHas(g2, '当前没有等待排序的手牌'),
		'log=' + JSON.stringify(g2.log.slice(-1)))
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
