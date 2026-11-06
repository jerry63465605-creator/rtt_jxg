/*
 * B28：调试卡牌面板「损耗 x / 复原 x」+ 调试阶段面板「分数 ±」
 *
 * A ★★ 损耗 3：牌库 -3、弃牌堆 +3，且顺序 = 原牌库顶 3 张依次进弃牌堆末尾
 * B ★★ 复原 3：牌库顶恢复为损耗前那 3 张、顺序一致；弃牌堆 -3
 * C ★  复原超量：弃牌堆只有 2 张时请求 5 → 只复原 2、日志提示不足
 * D ★  非法张数（0 / 负数 / NaN）→ 明确拒绝且无副作用
 * E ★★ 分数 +2 / -5（含穿越 0 变负）
 * F ★  非法阵营 → 拒绝
 * G ★  执行调试动作不破坏 pending_battle / armed_offers / status_used
 * H ★  委托国：current=法国 时损耗落到英国牌库（NATION_DELEGATE）
 *
 * 用法：node tools/_real_test_debug_tools.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const base = () => {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	return g
}

console.log('=== A. 损耗 3（美国）===')
let G = null, snapTop3 = null, deckLen0 = 0
{
	const g = base()
	const deck0 = (g.decks['美国'] || []).slice()
	snapTop3 = deck0.slice(0, 3)
	deckLen0 = deck0.length
	const disc0 = (g.discard['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_attrition', { n: 3 })
	I.refresh(g)
	const deck1 = g.decks['美国'] || []
	const disc1 = g.discard['美国'] || []
	console.log('  牌库 ' + deck0.length + '→' + deck1.length + '  弃牌堆 ' + disc0 + '→' + disc1.length)
	console.log('  期望进弃牌 = ' + JSON.stringify(snapTop3))
	console.log('  实际弃牌末尾 = ' + JSON.stringify(disc1.slice(-3)))
	console.log('  log = ' + logSince(g, n0))
	ok('★★ 牌库 -3 且弃牌堆 +3', deck1.length === deck0.length - 3 && disc1.length === disc0 + 3)
	ok('★★ 顺序正确（原牌库顶 3 张，按序进弃牌堆末尾）',
		disc1.slice(-3).join(',') === snapTop3.join(','), disc1.slice(-3).join(','))
	ok('★ 日志可见', /【调试】美国 损耗 3 张牌/.test(logSince(g, n0)), logSince(g, n0))
	G = g
}

console.log('\n=== B. 复原 3（回到牌库顶，顺序一致）===')
{
	const g = JSON.parse(JSON.stringify(G))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_restore', { n: 3 })
	I.refresh(g)
	const deck1 = g.decks['美国'] || []
	console.log('  牌库顶 3 张 = ' + JSON.stringify(deck1.slice(0, 3)))
	console.log('  log = ' + logSince(g, n0))
	ok('★★ 牌库顶恢复为损耗前那 3 张（顺序一致）',
		deck1.slice(0, 3).join(',') === snapTop3.join(','), deck1.slice(0, 3).join(','))
	ok('★★ 牌库总数回到损耗前', deck1.length === deckLen0, deck1.length + ' vs ' + deckLen0)
}

console.log('\n=== C. 复原超量（弃牌堆不足）===')
{
	const g = base()
	/* 清空弃牌堆，只留 2 张 */
	g.discard['美国'] = []
	R.action(g, 'Allies', 'debug_attrition', { n: 2 })
	I.refresh(g)
	const disc0 = (g.discard['美国'] || []).length
	const deck0 = (g.decks['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_restore', { n: 5 })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  弃牌堆 ' + disc0 + '→' + (g.discard['美国'] || []).length +
		'  牌库 ' + deck0 + '→' + (g.decks['美国'] || []).length)
	console.log('  log = ' + lg)
	ok('★ 只复原现有张数并提示不足', (g.discard['美国'] || []).length === 0 && /不足/.test(lg), lg)
}

console.log('\n=== D. 非法张数 ===')
{
	const g = base()
	const deck0 = (g.decks['美国'] || []).length
	const disc0 = (g.discard['美国'] || []).length
	const n0 = (g.log || []).length
	for (const bad of [0, -3, 'abc', null]) {
		R.action(g, 'Allies', 'debug_attrition', { n: bad })
		R.action(g, 'Allies', 'debug_restore', { n: bad })
	}
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 200))
	ok('★ 全部被拒', /需要正数张数/.test(lg))
	ok('★ 无副作用（牌库/弃牌堆不变）',
		(g.decks['美国'] || []).length === deck0 && (g.discard['美国'] || []).length === disc0)
}

console.log('\n=== E. 分数 +2 / -5 ===')
{
	const g = base()
	g.score = { axis: 0, allies: 0 }
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_score', { faction: 'allies', delta: 2 })
	I.refresh(g)
	const a1 = (R.view(g, 'Allies').score || {}).allies
	R.action(g, 'Allies', 'debug_score', { faction: 'axis', delta: -5 })
	I.refresh(g)
	const v = R.view(g, 'Allies').score || {}
	console.log('  score = ' + JSON.stringify(v))
	console.log('  log = ' + logSince(g, n0))
	ok('★★ 同盟 +2', a1 === 2, String(a1))
	ok('★★ 轴心 -5（可为负）', v.axis === -5, String(v.axis))
	ok('★ view.score 已下发', typeof v.allies === 'number' && typeof v.axis === 'number')
}

console.log('\n=== F. 非法阵营 ===')
{
	const g = base()
	g.score = { axis: 1, allies: 1 }
	const n0 = (g.log || []).length
	for (const bad of ['', 'neutral', 'AXIS!']) R.action(g, 'Allies', 'debug_score', { faction: bad, delta: 3 })
	R.action(g, 'Allies', 'debug_score', { faction: 'axis', delta: 0 })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 160))
	ok('★ 全被拒且分数不变', g.score.axis === 1 && g.score.allies === 1 && /需要阵营/.test(logSince(g, n0)))
}

console.log('\n=== G. 不破坏挂起/窗口/已发动 ===')
{
	const g = base()
	/* 用【真实】窗口（引擎自己派发），不要手写假结构（refresh 会按 ready 剪枝） */
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	I.refresh(g)
	I.offer_armed_effects(g, 'enemy_echo_played', {
		nation: '德国', card: '15205#999', space: null, via: 'play', window: 'enemy_echo_played',
	})
	I.refresh(g)
	g.status_used = g.status_used || {}
	g.status_used['17555#1'] = 'x'
	const ao0 = (g.armed_offers || []).filter(w => (w.cards || []).length).length
	const before = JSON.stringify({ ao: ao0, su: Object.keys(g.status_used).length })
	R.action(g, 'Allies', 'debug_attrition', { n: 2 })
	R.action(g, 'Allies', 'debug_restore', { n: 1 })
	R.action(g, 'Allies', 'debug_score', { faction: 'allies', delta: 1 })
	I.refresh(g)
	const ao1 = (g.armed_offers || []).filter(w => (w.cards || []).length).length
	const after = JSON.stringify({ ao: ao1, su: Object.keys(g.status_used || {}).length })
	console.log('  before=' + before + ' after=' + after)
	ok('★ 挂起/窗口/已发动均未被动到', before === after && !g.pending_battle)
}

console.log('\n=== H. 委托国（法国 → 英国牌库）===')
{
	const g = R.setup(20261107)
	g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
	R.action(g, 'Allies', 'debug_set_phase', { nation: '法国', phase: 'play' })
	I.refresh(g)
	const uk0 = (g.decks['英国'] || []).length
	const fr0 = (g.decks['法国'] || []).length
	if (!fr0) console.log('  （法国无独立牌库，按委托落到英国）')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'debug_attrition', { n: 2 })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0))
	console.log('  英国牌库 ' + uk0 + '→' + (g.decks['英国'] || []).length +
		'  法国牌库 ' + fr0 + '→' + (g.decks['法国'] || []).length)
	ok('★ 损耗落到控制国（英国）牌库', (g.decks['英国'] || []).length === uk0 - 2)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
