/* 验证 15215 卓越规划客户端提交路径的 id 体系（2026-10-12）。
 *
 * 客户端 update_peek_box 用 view.peek.cards[].id 构造 placement，
 * 服务端 deck_inspect 拿 placement[].id 与 game.peek.cards（实例 id）比对校验。
 * 若 view 下发的是【卡面 id】而 game.peek.cards 是【实例 id】，两边永远不等
 * -> 服务端返回"放置的牌与检视的牌不一致"，玩家点了确认却毫无效果。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { console.log('  [PASS] ' + name); pass++ }
	else { console.log('  [FAIL] ' + name + (extra ? ' :: ' + extra : '')); fail++ }
}
const j = x => JSON.stringify(x)
const logHas = (g, re) => (g.log || []).some(l => re.test(l))

/*
 * 造一个德国回合/出牌阶段的局面。
 * ⚠ 必须用【真实】牌堆：view.peek.cards 走 inst_card(实例id) 取卡面，
 *   假 id（如 dk1#1）解析不到会被 filter 掉，cards 变空数组，
 *   那样测出来的是"测试造数据错误"而不是真实 bug。
 */
function setup() {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	/* 保留 setup 自带的真实牌堆，只确保够 5 张 */
	g.decks['德国'] = (g.decks['德国'] || []).slice()
	g.hands['德国'] = ['15215#1']
	if (!g.discard) g.discard = {}
	g.discard['德国'] = g.discard['德国'] || []
	return g
}

console.log('=== 1. 打出 15215 -> 建立 game.peek ===')
let g = setup()
rules.action(g, 'Axis', 'play_card', { card: '15215#1' })
ok('game.peek 已建立', !!g.peek, j(g.peek))
ok('game.peek.cards 是【实例 id】', (g.peek.cards || []).every(id => String(id).indexOf('#') > 0), j(g.peek && g.peek.cards))

console.log('\n=== 2. 客户端视角：view.peek.cards 的 id 是什么 ===')
const v = rules.view(g, 'Axis')
const vpk = v && v.peek
ok('view.peek 已下发', !!vpk, j(vpk && { nation: vpk.nation, topBottom: vpk.topBottom, count: vpk.count }))
const vIds = (vpk.cards || []).map(c => c.id)
console.log('    game.peek.cards =', j(g.peek.cards))
console.log('    view.peek.cards[].id =', j(vIds))
ok('view 下发的 id 与 game.peek.cards【完全一致】（提交校验需要）',
	j(vIds.slice().sort()) === j(g.peek.cards.slice().sort()),
	'view=' + j(vIds) + ' game=' + j(g.peek.cards))

console.log('\n=== 3. 模拟客户端：用 view.peek.cards 的 id 提交 placement ===')
/* 取提交前的牌堆快照，用于判断"是否真的重组" */
const deckBefore = (g.decks['德国'] || []).slice()
/* 第 1 张置底、其余置顶 */
const placement = vIds.map((id, i) => ({ id: id, where: i === 0 ? 'bottom' : 'top', order: i }))
console.log('    placement =', j(placement))
rules.action(g, 'Axis', 'play_card', { card: '15215#1', placement: placement })
ok('提交被接受（未被"放置的牌与检视的牌不一致"拒绝）',
	!logHas(g, /放置的牌与检视的牌不一致/), j(g.log.slice(-2)))
ok('game.peek 已清空（结算完成）', !g.peek, j(g.peek))
const deckAfter = (g.decks['德国'] || [])
console.log('    牌堆前6 =', j(deckAfter.slice(0, 6)))
console.log('    牌堆末3 =', j(deckAfter.slice(-3)))
ok('牌堆已重组（与提交前不同）',
	j(deckAfter) !== j(deckBefore), 'before=' + j(deckBefore.slice(0, 6)))
ok('置底的牌（第 1 张）已落到牌堆最末位',
	deckAfter[deckAfter.length - 1] === vIds[0],
	'last=' + deckAfter[deckAfter.length - 1] + ' 期望=' + vIds[0])
ok('置顶组按 order 排在牌堆顶（第 2 张在最顶）',
	deckAfter[0] === vIds[1], 'top=' + deckAfter[0] + ' 期望=' + vIds[1])

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
