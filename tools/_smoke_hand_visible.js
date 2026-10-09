/* 【2026-10-05】手牌可见性回归测试
 *
 * 玩家报告：到日本玩家时，应该显示日本手牌。
 *
 * 根因：my_nation 取 nation_of_player() = 本阵营【排最前】的国家
 *       （ORDER_OF_NATIONS = 德/英/日/苏/意/美 -> 轴心=德国、同盟=英国）。
 *       于是轮到日本/意大利/苏联/美国行动时，my_nation 仍是德国/英国，
 *       hand_view(日本, 德国) 判 own=false -> cards=null，客户端画不出手牌。
 *
 * 修复：当前行动国属于本方阵营时，my_nation = 当前行动国；
 *       否则退回"排最前"代表国（保留"对方回合也有身份"的历史修复）。
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

/* 轴心：德国 / 日本 / 意大利；同盟：英国 / 苏联 / 美国 */
const AXIS_N = ['德国', '日本', '意大利']
const ALLIES_N = ['英国', '苏联', '美国']
const ROLE = { 德国: 'Axis', 日本: 'Axis', 意大利: 'Axis', 英国: 'Allies', 苏联: 'Allies', 美国: 'Allies' }

function setup(nation, otherHands) {
	const g = rules.setup(1)
	g.current_nation = nation
	g.active = ROLE[nation]
	g.turn_phase = 'play'
	g.play_done = {}
	/* 每个国家手牌放 2 张，便于检查 */
	for (const n of AXIS_N.concat(ALLIES_N)) {
		g.hands[n] = g.hands[n] || []
		if (!g.hands[n].length) {
			g.hands[n].push('fill_' + n + '_1#1')
			g.hands[n].push('fill_' + n + '_2#1')
		}
	}
	return g
}

console.log('\n=== 1. 轮到某国行动时，该国手牌必须可见（cards 非 null）===')
for (const n of AXIS_N.concat(ALLIES_N)) {
	const g = setup(n)
	const v = rules.view(g, ROLE[n])
	const h = v.hands && v.hands[n]
	ok('轮到【' + n + '】：my_nation 是 ' + n, v.my_nation === n,
		'my_nation=' + v.my_nation)
	ok('轮到【' + n + '】：本国手牌 cards 非 null', !!(h && h.cards),
		'count=' + (h && h.count) + ' cards=' + (h && (h.cards ? '有' : 'null')))
}

console.log('\n=== 2. 同阵营其它国家手牌【不可见】（只看张数）===')
{
	const g = setup('日本')
	const v = rules.view(g, 'Axis')
	for (const n of ['德国', '意大利']) {
		const h = v.hands && v.hands[n]
		ok('日本回合：【' + n + '】手牌 cards=null（仅张数）',
			!!h && h.cards === null, 'cards=' + (h && (h.cards === null ? 'null' : '有')))
		ok('日本回合：【' + n + '】仍有 count', !!h && typeof h.count === 'number',
			'count=' + (h && h.count))
	}
	/* 敌对阵营一律不可见 */
	for (const n of ALLIES_N) {
		const h = v.hands && v.hands[n]
		ok('日本回合：敌方【' + n + '】不可见', !!h && h.cards === null)
	}
}

console.log('\n=== 3. 对方回合时仍保留身份（退回排最前代表国，不退化成 null）===')
{
	/* 同盟行动 -> 轴心视角 my_nation 应仍是德国（排最前），不是 null */
	const g = setup('英国')
	const vAxis = rules.view(g, 'Axis')
	ok('同盟回合：轴心 my_nation = 德国（排最前，非 null）',
		vAxis.my_nation === '德国', 'my_nation=' + vAxis.my_nation)
	ok('同盟回合：轴心能看到德国手牌（用于防守方代受等面板）',
		!!(vAxis.hands && vAxis.hands['德国'] && vAxis.hands['德国'].cards))
	/* 轴心行动 -> 同盟视角 my_nation = 英国 */
	const g2 = setup('德国')
	const vAllies = rules.view(g2, 'Allies')
	ok('轴心回合：同盟 my_nation = 英国（排最前，非 null）',
		vAllies.my_nation === '英国', 'my_nation=' + vAllies.my_nation)
	ok('轴心回合：同盟能看到英国手牌',
		!!(vAllies.hands && vAllies.hands['英国'] && vAllies.hands['英国'].cards))
}

console.log('\n=== 4. 意大利回合（轴心第三个国家）同样可见 ===')
{
	const g = setup('意大利')
	const v = rules.view(g, 'Axis')
	ok('意大利回合：my_nation = 意大利', v.my_nation === '意大利',
		'my_nation=' + v.my_nation)
	ok('意大利回合：意大利手牌可见',
		!!(v.hands && v.hands['意大利'] && v.hands['意大利'].cards))
	ok('意大利回合：德国手牌不可见',
		v.hands['德国'].cards === null)
}

console.log('\n=== 5. 手牌张数与内容一致（cards.length === count）===')
{
	for (const n of AXIS_N.concat(ALLIES_N)) {
		const g = setup(n)
		const v = rules.view(g, ROLE[n])
		const h = v.hands[n]
		ok('【' + n + '】cards.length === count',
			h.cards.length === h.count, 'cards=' + h.cards.length + ' count=' + h.count)
	}
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
