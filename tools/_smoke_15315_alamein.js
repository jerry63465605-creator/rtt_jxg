/*
 * 【2026-10-28】15315《阿拉曼战役》分步停机验收
 *
 * 卡面：「在<非洲北部>消灭 1 支敌方国家陆军。在<中东><非洲北部>之一征召陆军」
 * 配置：steps = [eliminate(15), recruit(16|15)]，pick 缺省 1
 *
 * 修复前的两个问题：
 *   ① eliminate 分支【漏接】maybe_pause_event_step -> 多步卡一口气连跑，
 *      第二步失败又被 failStep 静默吞掉，玩家看到"只消灭没征召"，且没有「下一步」按钮；
 *   ② stepFails / spaceFails 只写 toast（game.last_card_fail），主日志查不到原因；
 *      分步停机后续跑还会丢掉前几步的失败记录。
 *
 * 修复：
 *   · eliminate 分支补分步停机（与 build / recruit 一致）
 *   · stepFails 支持 opt.fails 跨停机恢复，pending_event_step 落盘 fails
 *   · 收尾统一写主日志「《卡名》部分效果未执行：步骤 — 原因」
 *   · maybe_pause_event_step 增加「本步什么都没做成则不停机」守卫，
 *     保住「所有步都做不了 -> 整卡打不出」的既有判定
 *
 * 口径（玩家 2026-10-28）：
 *   · 分步停机 = 每完成一个原子步就停，点「下一步」继续
 *   · (b) 各步独立，能做的就做
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const data = I.data

const NA = data.id_of('非洲北部')
const ME = data.id_of('中东')
const UKRAINE = data.id_of('乌克兰')
const ROSS = data.id_of('罗斯')
const IT = data.id_of('意大利')

const CARD = '15315#1'
const CARD_17723 = '17723#1'

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

function make(pieces, hand, nation) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1
	g.current_nation = nation || '英国'
	g.active = nation === '意大利' ? 'Axis' : 'Allies'
	for (const pid of Object.keys(g.location)) delete g.location[pid]
	g.hands = g.hands || {}
	g.hands[nation || '英国'] = hand || [CARD]
	for (const [p, s, n, t] of (pieces || [])) {
		g.location[p] = s
		g.piece_nation[p] = n
		g.piece_type[p] = t
	}
	I.refresh(g)
	return g
}
const board = (g) => Object.keys(g.location).filter(p => g.location[p] != null)
	.map(p => p + '@' + data.name_of(g.location[p]) + '(' + g.piece_nation[p] + g.piece_type[p] + ')').join(', ')
const logsSince = (g, n) => (g.log || []).slice(n)
const at = (g, name) => Object.keys(g.location).filter(p => g.location[p] === data.id_of(name))

/* ---------------- S1 第一步后停机 ---------------- */
section('S1 eliminate 步后分步停机（非洲北部有德国陆军 + 中东空）')
let g1
{
	g1 = make([['de_a', NA, '德国', 'army']])
	const b = (g1.log || []).length
	rules.action(g1, 'Allies', 'play_card', { card: CARD, spaces: [NA, ME] })
	const lg = logsSince(g1, b)
	ok('第 1 步执行：消灭德国陆军', at(g1, '非洲北部').every(p => g1.piece_nation[p] !== '德国'))
	ok('挂起 pending_event_step（step=1/2）',
		!!g1.pending_event_step && g1.pending_event_step.step === 1 && g1.pending_event_step.total === 2,
		g1.pending_event_step && { step: g1.pending_event_step.step, total: g1.pending_event_step.total })
	ok('日志出现「第 1/2 步完成」', lg.some(x => /第 1\/2 步完成/.test(x)), lg)
	ok('日志出现「点「下一步」继续」', lg.some(x => /下一步/.test(x)))
	ok('此刻【尚未】征召（第二步未跑）', at(g1, '中东').length === 0 && at(g1, '非洲北部').length === 0, board(g1))
	ok('卡未进弃牌堆', (g1.discard['英国'] || []).indexOf(CARD) < 0)
}

/* ---------------- S2 下一步执行第二步 ---------------- */
section('S2 event_step_next 执行第二步（在中东征召）')
{
	const b = (g1.log || []).length
	rules.action(g1, 'Allies', 'event_step_next', {})
	const lg = logsSince(g1, b)
	ok('中东出现 1 支英国陆军', at(g1, '中东').length === 1 &&
		g1.piece_nation[at(g1, '中东')[0]] === '英国', board(g1))
	ok('pending_event_step 清空', !g1.pending_event_step)
	ok('卡进弃牌堆', (g1.discard['英国'] || []).indexOf(CARD) >= 0)
	ok('日志出现「分步结算完成」', lg.some(x => /分步结算完成/.test(x)), lg)
}

/* ---------------- S3 第二步失败 -> 主日志写明原因 ---------------- */
section('S3 第二步地点不可征召（中东已有英国陆军）-> 主日志写明原因')
{
	const g = make([['de_a', NA, '德国', 'army'], ['uk_me', ME, '英国', 'army']])
	rules.action(g, 'Allies', 'play_card', { card: CARD, spaces: [NA, ME] })
	ok('仍先停机第 1 步', !!g.pending_event_step && g.pending_event_step.step === 1)
	const b = (g.log || []).length
	rules.action(g, 'Allies', 'event_step_next', {})
	const lg = logsSince(g, b)
	ok('主日志出现「部分效果未执行」', lg.some(x => /部分效果未执行/.test(x)), lg)
	ok('主日志写明原因（已有本国部队）', lg.some(x => /已有本国部队/.test(x)), lg)
	ok('toast 数据仍在（last_card_fail）', !!g.last_card_fail && g.last_card_fail.fails.length > 0)
	ok('不出现「中东：中东」这类重复拼接',
		!(g.last_card_fail && g.last_card_fail.fails.some(f => /中东：中东/.test(f))),
		g.last_card_fail && g.last_card_fail.fails)
}

/* ---------------- S4 (b) 各步独立：第一步做不了，第二步照做 ---------------- */
section('S4 第一步没目标（非洲北部无敌方）+ 中东空 -> 不停机、卡打完、只征召')
{
	const g = make([])
	const b = (g.log || []).length
	rules.action(g, 'Allies', 'play_card', { card: CARD, spaces: [NA, ME] })
	const lg = logsSince(g, b)
	ok('不停机（没有可停的实步）', !g.pending_event_step)
	ok('在中东征召成功', at(g, '中东').length === 1, board(g))
	ok('日志写明第一步为何没做', lg.some(x => /部分效果未执行/.test(x) && /没有可消灭的敌方部队/.test(x)), lg)
	ok('卡进弃牌堆', (g.discard['英国'] || []).indexOf(CARD) >= 0)
}

/* ---------------- S5 两步都做不了 -> 整卡打不出 ---------------- */
section('S5 两步都做不了（非洲北部无敌方 + 中东已有英军）-> 整卡打不出')
{
	const g = make([['uk_me', ME, '英国', 'army']])
	const b = (g.log || []).length
	rules.action(g, 'Allies', 'play_card', { card: CARD, spaces: [NA, ME] })
	const lg = logsSince(g, b)
	ok('整卡无法执行', lg.some(x => /没有任何可执行的效果/.test(x)), lg)
	ok('手牌保留', (g.hands['英国'] || []).indexOf(CARD) >= 0, g.hands['英国'])
	ok('未产生新部队', at(g, '中东').length === 1 && at(g, '非洲北部').length === 0, board(g))
	ok('没有挂起', !g.pending_event_step)
}

/* ---------------- S6 回归：17723（两个 recruit 步）行为不变 ---------------- */
section('S6 回归：17723 进攻共产国际（两个 recruit 步）仍分步停机')
{
	const g = make([['it_a', IT, '意大利', 'army']], [CARD_17723], '意大利')
	rules.action(g, 'Axis', 'play_card', { card: CARD_17723 })
	ok('第 1 步后停机', !!g.pending_event_step && g.pending_event_step.step === 1,
		g.pending_event_step && g.pending_event_step.step)
	ok('第 1 步在乌克兰征召成功', at(g, '乌克兰').length === 1, board(g))
	const b = (g.log || []).length
	rules.action(g, 'Axis', 'event_step_next', {})
	ok('第 2 步在罗斯征召成功', at(g, '罗斯').length === 1, board(g))
	ok('卡进弃牌堆', (g.discard['意大利'] || []).indexOf(CARD_17723) >= 0)
	ok('无意外失败日志', !logsSince(g, b).some(x => /部分效果未执行/.test(x)), logsSince(g, b))
}

/* ---------------- S7 源码守卫 ---------------- */
section('S7 源码守卫')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	const seg = src.slice(src.indexOf('function resolve_event_card'), src.indexOf('function finish_event_card'))
	const elimIdx = seg.indexOf("if (st.op === 'eliminate')")
	const nextIdx = seg.indexOf("if (st.op === 'battle')")
	const elimSeg = (elimIdx >= 0 && nextIdx > elimIdx) ? seg.slice(elimIdx, nextIdx) : ''
	ok('eliminate 分支接入分步停机', /maybe_pause_event_step\(/.test(elimSeg))
	ok('eliminate 停机时携带 fails', /fails: stepFails\.concat\(spaceFails\)/.test(elimSeg))
	ok('stepFails 支持续跑恢复 opt.fails', /const stepFails = \(opt && Array\.isArray\(opt\.fails\)\)/.test(src))
	ok('pending_event_step 落盘 fails', /fails: Array\.isArray\(carry\.fails\)/.test(src))
	ok('空步不停机守卫存在', /if \(!descs \|\| !descs\.length\) return null/.test(src))
	ok('收尾写主日志', /部分效果未执行/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
