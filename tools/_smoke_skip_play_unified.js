/*
 * 【2026-10-28】「跳过出牌阶段」统一实现验收
 *
 * 玩家口径：
 *   · 不自动推进（发动后由玩家自己点「下一阶段」）
 *   · 只能在实际出牌前发动
 *   · 发动占用出牌
 *
 * 此前有三套写法：
 *   ① activate_status 的 cost.skip_play 分支（三件套齐全）
 *   ② 自动派发路径（只写 skip_play_done）
 *   ③ 17841《近卫军》/ 17849《中国人民解放军》在 run 里手写 mark_play_done
 * ②③ 缺 skip_play_done / mark_play_acted。
 *
 * 本次统一为 apply_skip_play(game, nation)：
 *   skip_play_done[nation] = turn  +  mark_play_acted  +  mark_play_done
 *   （刻意不设 pending_advance_phase -> 不自动推进）
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

const EE = d.id_of('东欧')

function make(nation, hand) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = nation
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.turn = 3
	g.nations_done = 1
	g.score = { axis: 0, allies: 0 }
	g.log = []
	g.play_done = {}
	g.skip_play_done = {}
	for (const p of Object.keys(g.location)) delete g.location[p]
	g.hands[nation] = (hand || []).slice()
	I.refresh(g)
	return g
}
const skipDone = (g, n) => (g.skip_play_done || {})[n] === g.turn
const playDone = (g, n) => !!(g.play_done || {})[n]
/* play_acted 未导出，直接读内部键（与 rules.js 的 PLAY_ACTED_KEY 同源） */
const acted = (g, n) => !!(g.play_done && g.play_done['@acted:' + n])

/* ---------------- S1 声明式（15347 波兰主权）三件套齐全 ---------------- */
section('S1 15347《波兰主权》发动后：skip_play_done / play_done / play_acted 全为真')
let g1
{
	g1 = make('英国', ['15347#1'])
	g1.table['英国'] = ['15347#1']
	g1.hands['英国'] = []
	rules.action(g1, 'Allies', 'activate_status', { card: '15347#1' })
	ok('skip_play_done 已置（本回合跳过出牌）', skipDone(g1, '英国'), g1.skip_play_done)
	ok('play_done 已置（占用出牌名额）', playDone(g1, '英国'))
	ok('play_acted 已置（"本回合动过手"）', acted(g1, '英国'))
	ok('未设置 pending_advance_phase（不自动推进）', !g1.pending_advance_phase)
	ok('仍在出牌阶段（不替玩家推进）', g1.turn_phase === 'play', g1.turn_phase)
}

/* ---------------- S2 同回合不能再发动第二张「跳过出牌」卡 ---------------- */
section('S2 已跳过后，同回合再发动 15345 被拒')
{
	g1.hands['英国'] = ['15345#1']
	g1.table['英国'].push('15345#1')
	const before = g1.log.length
	rules.action(g1, 'Allies', 'activate_status', { card: '15345#1' })
	const lg = g1.log.slice(before)
	ok('被拒（已跳过出牌阶段 / 已打出过牌）',
		lg.some(x => /已跳过出牌阶段|已打出过牌/.test(x)), lg)
	ok('未执行第二张卡的效果（非洲南部无法军）',
		Object.keys(g1.location).every(p => g1.location[p] !== d.id_of('非洲南部') || g1.piece_nation[p] !== '法国'))
}

/* ---------------- S3 出过牌之后不能再发动 ---------------- */
section('S3 本回合已出过牌 -> 不能发动跳过出牌卡')
{
	const g = make('英国', ['15347#1'])
	g.table['英国'] = ['15347#1']
	g.hands['英国'] = []
	g.play_done['@acted:英国'] = true
	I.mark_play_done(g, '英国')
	const before = g.log.length
	rules.action(g, 'Allies', 'activate_status', { card: '15347#1' })
	ok('被拒（本回合已打出过牌）', g.log.slice(before).some(x => /已打出过牌/.test(x)), g.log.slice(before))
	ok('未设置 skip_play_done', !skipDone(g, '英国'))
}

/* ---------------- S4 17849（run 内手写）也要走统一原子 ---------------- */
section('S4 17849《中国人民解放军》run 内发动 -> skip_play_done 也置位（旧实现缺失）')
{
	const g = make('苏联', ['17849#1'])
	g.table['苏联'] = ['17849#1']
	g.hands['苏联'] = []
	/* 17849 在<中国>/<蒙古>之一征召中国陆军；苏联发动，中国部队 */
	const cnEast = d.id_of('中国东部')
	rules.action(g, 'Allies', 'activate_status', { card: '17849#1', space: cnEast })
	ok('skip_play_done 已置（本次统一的关键）', skipDone(g, '苏联'), g.skip_play_done)
	ok('play_done 已置', playDone(g, '苏联'))
	ok('play_acted 已置', acted(g, '苏联'))
	ok('不自动推进', !g.pending_advance_phase)
}

/* ---------------- S5 15255 牌库不足 -> 不能发动、不扣牌 ---------------- */
section('S5 15255《征兵》：牌库不足 2 张时不能发动（attrition 已迁到 cost）')
{
	const g = make('德国', ['15255#1'])
	g.table['德国'] = ['15255#1']
	g.hands['德国'] = []
	g.decks['德国'] = ['dk1#1']       /* 只有 1 张 */
	const deckBefore = g.decks['德国'].length
	const before = g.log.length
	rules.action(g, 'Axis', 'activate_status', { card: '15255#1' })
	ok('被拒（牌库不足）', g.log.slice(before).some(x => /牌库不足|损耗/.test(x)), g.log.slice(before))
	ok('未扣牌', g.decks['德国'].length === deckBefore, { before: deckBefore, after: g.decks['德国'].length })
	ok('未设置 skip_play_done', !skipDone(g, '德国'))
}

/* ---------------- S6 15255 牌库充足 -> 扣 2 张 + 三件套 ---------------- */
section('S6 15255 牌库充足 -> 扣 2 张损耗 + 三件套齐全')
{
	const g = make('德国', ['15255#1'])
	g.table['德国'] = ['15255#1']
	g.hands['德国'] = []
	g.decks['德国'] = ['dk1#1', 'dk2#1', 'dk3#1', 'dk4#1']
	const deckBefore = g.decks['德国'].length
	rules.action(g, 'Axis', 'activate_status', { card: '15255#1' })
	ok('扣了 2 张损耗（由 cost.attrition 统一处理）',
		g.decks['德国'].length === deckBefore - 2, { before: deckBefore, after: g.decks['德国'].length })
	ok('skip_play_done 已置', skipDone(g, '德国'))
	ok('play_done 已置', playDone(g, '德国'))
}

/* ---------------- S7 源码守卫 ---------------- */
section('S7 源码守卫：skip_play_done 只在 apply_skip_play 里写')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	const lines = src.split('\n')
	const writers = []
	lines.forEach((l, i) => {
		if (/skip_play_done\[[^\]]+\]\s*=/.test(l)) writers.push({ ln: i + 1, text: l.trim() })
	})
	ok('只有一处写 skip_play_done（统一原子）', writers.length === 1,
		writers.map(w => w.ln + ':' + w.text.slice(0, 60)))
	ok('apply_skip_play 存在且做三件套',
		/function apply_skip_play\(game, nation\) \{[\s\S]{0,400}mark_play_acted\(game, nation\)[\s\S]{0,200}mark_play_done\(game, nation\)/.test(src))
	ok('apply_skip_play 不设 pending_advance_phase',
		!/apply_skip_play[\s\S]{0,400}pending_advance_phase\s*=/.test(src))
	ok('activate_status 走 apply_skip_play', /cost\.skip_play && !borrowed[\s\S]{0,200}apply_skip_play\(game, costPayer\)/.test(src))
	ok('自动派发走 apply_skip_play', /if \(tr\.cost\.skip_play\) apply_skip_play\(game, n\)/.test(src))
	ok('15255 的 attrition 在 cost 里', /cost: \{ skip_play: true, attrition: 2 \}/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
