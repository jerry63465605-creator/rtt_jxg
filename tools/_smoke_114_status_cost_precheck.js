/*
 * 【2026-10-28 待办 #14】状态卡「损耗了牌却没触发」验收
 *
 * 玩家原话：「都有 bug，损耗了牌却没触发」（15255 征兵 / 17746 耀武，window='play_start'）
 *
 * 根因：
 *   ① 代价（attrition / skip_play）在效果之前扣掉；
 *   ② effect.kind='battle' 的效果要求 arg.from（发起单位），客户端对这类卡不弹选择框；
 *   ③ 效果失败时只回滚 cost.discard，attrition 不回滚
 *   => 牌白扣、出牌阶段白跳、效果零。
 *
 * 修复：
 *   · 付代价【之前】做 battle 参数预检（arg.from 缺失 -> 提示并 return，未支付代价）
 *   · 15255《征兵》的建设候选补上「大本营自身」（旧实现只看相邻）
 */
const path = require('path')
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

const IT = d.id_of('意大利')
const GE = d.id_of('德国')

function make(nation, hand, phase) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = nation
	g.active = nation === '意大利' ? 'Axis' : 'Axis'
	g.turn_phase = phase || 'play'
	g.turn = 3
	g.nations_done = 1
	g.score = { axis: 0, allies: 0 }
	g.log = []
	g.hands[nation] = g.hands[nation] || []
	g.hands[nation] = hand.slice()
	return g
}
const deckSize = (g, n) => ((g.decks && g.decks[n]) || []).length

/* ---------------- S1 17746：不带 from -> 不付代价 ---------------- */
section('S1 17746《耀武》不带发起单位 -> 拒绝且【不扣损耗、不跳出牌】')
{
	const g = make('意大利', ['17746#1'])
	g.table['意大利'] = ['17746#1']
	g.hands['意大利'] = []
	/* 造一支可发起陆战的意大利陆军（意大利本土，供给充足） */
	g.location['it_a'] = IT; g.piece_nation['it_a'] = '意大利'; g.piece_type['it_a'] = 'army'
	I.refresh(g)
	const deckBefore = deckSize(g, '意大利')
	const skipBefore = !!(g.skip_play_done || {})['意大利']
	rules.action(g, 'Axis', 'activate_status', { card: '17746#1' })
	ok('拒绝并提示「请先选择发起战斗的单位与地区」',
		(g.log || []).some(x => /请先选择发起战斗的单位与地区/.test(x)), g.log.slice(-2))
	ok('★ 未扣损耗（牌库不减）', deckSize(g, '意大利') === deckBefore, { before: deckBefore, after: deckSize(g, '意大利') })
	ok('★ 未跳过出牌阶段', !(g.skip_play_done || {})['意大利'] === !skipBefore,
		{ before: skipBefore, after: (g.skip_play_done || {})['意大利'] })
	ok('日志写明「未支付代价」', (g.log || []).some(x => /未支付代价/.test(x)))
}

/* ---------------- S2 17746：带 from 且目标合法 -> 正常发起战斗 ---------------- */
section('S2 17746 带发起单位 -> 扣损耗并真的发起陆战')
{
	const g = make('意大利', ['17746#1'])
	g.table['意大利'] = ['17746#1']
	g.hands['意大利'] = []
	g.location['it_a'] = IT; g.piece_nation['it_a'] = '意大利'; g.piece_type['it_a'] = 'army'
	g.location['uk_a'] = d.id_of('西欧'); g.piece_nation['uk_a'] = '英国'; g.piece_type['uk_a'] = 'army'
	I.refresh(g)
	const deckBefore = deckSize(g, '意大利')
	const r = rules.action(g, 'Axis', 'activate_status', { card: '17746#1', from: 'it_a', space: d.id_of('西欧') })
	ok('已扣 2 张损耗', deckSize(g, r, '意大利') === deckBefore - 2 || deckSize(r, '意大利') === deckBefore - 2,
		{ before: deckBefore, after: deckSize(r, '意大利') })
	ok('发起了陆战（挂起 pending_battle 或英国陆军减少）',
		!!r.pending_battle || (r.location['uk_a'] == null) || (r.log || []).some(x => /陆战/.test(x)),
		{ pending: !!r.pending_battle, log: (r.log || []).slice(-2) })
}

/* ---------------- S3 15255：候选含大本营自身 ---------------- */
section('S3 15255《征兵》大本营相邻全不可建时，仍可在大本营建设')
{
	const g = make('德国', ['15255#1'])
	g.table['德国'] = ['15255#1']
	g.hands['德国'] = []
	/*
	 * 造局：德国大本营（德国本土）清空、自身可建；
	 * 把所有【相邻陆地】塞满德国陆军，使相邻全部 can_build_at 失败。
	 */
	for (const p of Object.keys(g.location)) delete g.location[p]
	const home = I.effective_home_base(g, '德国')
	const nbrs = (I.get_connections(g, home, 'axis') || []).map(Number)
	let k = 0
	for (const nb of nbrs) {
		const sp = d.spaces[nb]
		if (!sp || sp.terrain === 'sea') continue
		g.location['blk' + (k++)] = nb
		g.piece_nation['blk' + (k - 1)] = '德国'
		g.piece_type['blk' + (k - 1)] = 'army'
	}
	I.refresh(g)
	const deckBefore = deckSize(g, '德国')
	const r = rules.action(g, 'Axis', 'activate_status', { card: '15255#1' })
	const gained = Object.keys(r.location).filter(p => r.location[p] === home && r.piece_nation[p] === '德国').length
	ok('扣了 2 张损耗', deckSize(r, '德国') === deckBefore - 2, { before: deckBefore, after: deckSize(r, '德国') })
	ok('★ 在大本营建出陆军（旧实现会「无德控陆地可建设」）', gained >= 1,
		{ home: d.name_of(home), pieces: gained, log: (r.log || []).slice(-2) })
}

/* ---------------- S4 源码守卫 ---------------- */
section('S4 源码守卫')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('battle 效果参数预检存在',
		/tr\.effect\.kind === 'battle' && \(\(arg \|\| \{\}\)\.from == null\)/.test(src))
	ok('预检位于付代价之前（在 cost.discard 之前）',
		src.indexOf("arg || {}).from == null") < src.indexOf('if (cost.discard && !borrowed)'))
	ok('15255 候选含大本营自身',
		/can_build_at\(game, '德国', home, 'army'\)\.ok\) cands\.push\(home\)/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
