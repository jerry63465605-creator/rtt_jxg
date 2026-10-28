/*
 * 【2026-10-28 #15】17535《租借法案》委托归还基准验收
 *
 * 玩家症状：让权期间与轴心再交互（战斗、飞机免死）后，战斗结束行动轮
 *   **回到被委托国（英/苏）而不是美国**。
 *
 * 根因：resolve_us_lend_lease_play 里有 5 处【重建 game.delegate 对象】，
 *   全部漏了 `mode: 'single'`。于是两处按 mode 分派的判定失效：
 *     ① battle_reconcile_active：`mode==='single' && resume_after_battle` 才收尾
 *        -> 漏 mode 就【永不归还】，操作权停在被委托国；
 *     ② build_actions：`mode==='single'` 才登记 resolve_us_lend_lease_*。
 *
 * 修复：5 处重建对象补 mode；并给 battle_reconcile_active 加
 *   「战斗预算未打完不收尾」守卫（否则多场预算卡第一场结束就提前归还），
 *   预算收尾改在 event_finish 里补。
 */
const path = require('path')
const fs = require('fs')
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

const ME = d.id_of('中东'), IN = d.id_of('印度')

function mk() {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	g.hands['美国'] = ['17535#1']
	g.hands['英国'] = ['15349#1']        /* 萨宾行动：对<中东>发起 1 次陆战（战斗预算） */
	for (const p of Object.keys(g.location)) if (g.location[p] === ME) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	g.location['de_me'] = ME; g.piece_nation['de_me'] = '德国'; g.piece_type['de_me'] = 'army'
	g.location['uk_in'] = IN; g.piece_nation['uk_in'] = '英国'; g.piece_type['uk_in'] = 'army'
	I.refresh(g)
	return g
}

/* ---------------- S1 委托建立 ---------------- */
section('S1 美国打出 17535：委托对象带 mode=single')
let g
{
	g = mk()
	rules.action(g, 'Allies', 'play_card', { card: '17535#1' })
	ok('delegate 存在', !!g.delegate)
	ok('mode=single', g.delegate && g.delegate.mode === 'single', g.delegate)
	ok('尚未选国（nation 为空）', g.delegate && !g.delegate.nation)
	ok('current_nation 仍是美国', g.current_nation === '美国')
}

/* ---------------- S2 选英国 -> 翻转 ---------------- */
section('S2 美国选英国：current_nation 翻给英国，return_nation 记美国')
{
	rules.action(g, 'Allies', 'resolve_us_lend_lease_select', { nation: '英国' })
	ok('current_nation=英国', g.current_nation === '英国', g.current_nation)
	ok('return_nation=美国', g.delegate && g.delegate.return_nation === '美国', g.delegate)
	ok('return_active 已记', g.delegate && !!g.delegate.return_active, g.delegate && g.delegate.return_active)
}

/* ---------------- S3 英国打出战斗预算卡 -> 重建对象仍带 mode ---------------- */
section('S3 英国打出《萨宾行动》：重建的委托对象仍带 mode=single（本次根因修复点）')
{
	rules.action(g, 'Allies', 'resolve_us_lend_lease_play', { nation: '英国', card: '15349#1' })
	ok('★ 重建对象带 mode=single', g.delegate && g.delegate.mode === 'single', g.delegate)
	ok('★ resume_after_battle=true', g.delegate && g.delegate.resume_after_battle === true, g.delegate)
	ok('nat=英国（收尾时给它摸牌）', g.delegate && g.delegate.nat === '英国', g.delegate)
	ok('return_nation 仍是美国（未被覆盖）', g.delegate && g.delegate.return_nation === '美国', g.delegate)
	ok('战斗预算已建立', !!(g.event_budget && g.event_budget.remaining > 0), g.event_budget)
}

/* ---------------- S4 打完战斗但不结束 -> 不提前归还 ---------------- */
section('S4 发起并结算战斗后（预算尚未点「结束」）：不提前归还')
{
	rules.action(g, 'Allies', 'event_battle', { target: ME, from: 'uk_in' })
	ok('战斗已结算（德军中东部队消失或预算减少）',
		!(g.event_budget && g.event_budget.remaining > 0) || !g.location['de_me'], g.event_budget)
	ok('★ 仍未归还（current_nation=英国）', g.current_nation === '英国', g.current_nation)
	ok('★ 委托仍在（未提前收尾）', !!g.delegate, g.delegate)
}

/* ---------------- S5 event_finish -> 归还美国 ---------------- */
section('S5 点「结束」-> 摸牌 + 操作权归还美国 + 委托清空')
{
	const deckBefore = (g.decks['英国'] || []).length
	rules.action(g, 'Allies', 'event_finish', {})
	ok('★ current_nation=美国（归还）', g.current_nation === '美国', g.current_nation)
	ok('★ delegate 已清空', !g.delegate, g.delegate)
	ok('被委托国摸了 1 张', (g.decks['英国'] || []).length === deckBefore - 1,
		{ before: deckBefore, after: (g.decks['英国'] || []).length })
	ok('卡片进弃牌堆', (g.discard['英国'] || []).indexOf('15349#1') >= 0, g.discard['英国'])
}

/* ---------------- S6 无委托时 event_finish 不受影响 ---------------- */
section('S6 无租借委托时 event_finish 正常结束（本修复不外溢）')
{
	const g2 = mk()
	g2.hands['英国'] = []
	g2.event_budget = { nation: '英国', as: '英国', card_id: '15349#1', kind: 'land', against: '德国', remaining: 1, descs: [], battleOk: 0, targetSpaces: [] }
	rules.action(g2, 'Allies', 'event_finish', {})
	ok('delegate 仍为空', !g2.delegate)
	ok('current_nation 仍为美国', g2.current_nation === '美国', g2.current_nation)
}

/* ---------------- S7 源码守卫 ---------------- */
section('S7 源码守卫：重建点都带 mode、收尾判定与预算守卫齐全')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	/* 所有 `game.delegate = {` 的重建点都必须紧跟 mode:'single' */
	const lines = src.split('\n')
	const rebuilds = []
	lines.forEach((l, i) => {
		if (!/game\.delegate = \{/.test(l)) return
		/* 重建对象的特征：带 return_nation，后面紧跟 resume_after_battle / step: null */
		const blob = lines.slice(i, i + 22).join('\n')
		if (!/return_nation/.test(blob)) return
		if (!/resume_after_battle|step: null/.test(blob)) return
		rebuilds.push({ ln: i + 1, hasMode: /mode:\s*'single'/.test(blob) })
	})
	ok('找到 >=5 处重建点', rebuilds.length >= 5, rebuilds.map(x => x.ln))
	ok('★ 全部带 mode:single', rebuilds.every(x => x.hasMode), rebuilds.filter(x => !x.hasMode))
	ok('mode:single 出现次数 >= 6（5 处重建 + offer 一处）',
		(src.match(/mode: 'single'/g) || []).length >= 6, (src.match(/mode: 'single'/g) || []).length)

	ok('battle_reconcile_active 用 mode===\'single\' 判定',
		/game\.delegate\.mode === 'single' && game\.delegate\.resume_after_battle/.test(src))
	ok('★ 收尾加「预算未打完不归还」守卫',
		/!\(game\.event_budget && game\.event_budget\.remaining > 0\)/.test(src))
	ok('event_finish 里有委托收尾', /after_card_resolved\(game, b\.nation, b\.card_id\)[\s\S]{0,900}finish_us_lend_lease\(game, game\.delegate, game\.delegate\.nat\)/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
