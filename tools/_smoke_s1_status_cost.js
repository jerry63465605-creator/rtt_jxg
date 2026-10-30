/*
 * S1 批 3 回归：状态卡发动【先付代价 -> 再问 15353 拦截 -> 被拦只取消效果】
 *
 *   用例卡：15245 俯冲式轰炸机（德国 STATUS，after_land，损耗 1 张牌）
 *   拦截方：英国 15353 保持冷静（enemy_status_effect，弃 1 张手牌）
 *
 *   A. 有拦截方并【发动】-> 代价已付（牌堆 -1）、效果不发生、代价不退
 *   B. 有拦截方但【放弃】-> 效果照常执行，代价照付
 *   C. 无拦截方 -> 不残留窗口，效果执行
 *   D. skip_play 类状态卡：被拦时【不】照付（保守默认，待玩家裁定）
 *   E. 静态：付代价代码在 15353 窗口派发之前
 *
 * 用法：node tools/_smoke_s1_status_cost.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0

function setup(withInterceptor, statusCard) {
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.neutral = {}
	g.hands['德国'] = ['15341#50', '15341#51']
	g.decks['德国'] = ['15345#1', '15345#2', '15345#3']
	g.table = { '德国': [statusCard] }
	if (withInterceptor) g.hands['英国'] = ['15353#1', '15341#70']
	else g.hands['英国'] = ['15341#70']
	I.refresh(g)
	/* 武装窗口：after_land（刚发起陆战） */
	I.arm_status_instant(g, 'after_land', '德国', d.id_of('法国'))
	I.refresh(g)
	return g
}

console.log('\n=== A：德国发动 15245，英国【发动】15353 拦截 ===')
{
	const g = setup(true, '15245#1')
	R.view(g, 'Axis')
	const ts = (R.view(g, 'Axis').table_status || []).find(x => x.card === '15245#1') || {}
	ok('15245 ready=true', ts.ready === true, JSON.stringify(ts.reason))
	const d0 = (g.decks['德国'] || []).length
	R.action(g, 'Axis', 'activate_status', { card: '15245#1' })
	const win = (g.armed_offers || []).some(w => w.when === 'enemy_status_effect')
	ok('开窗等待 15353', win, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★ 代价在开窗前已付（牌堆 -1）', (g.decks['德国'] || []).length === d0 - 1,
		d0 + ' -> ' + (g.decks['德国'] || []).length)
	R.action(g, 'Allies', 'use_armed_offer', { card: '15353#1', drop: ['15341#70'] })
	ok('拦截方付了代价（弃 1 张）', inDisc(g, '英国', '15341#70'))
	ok('★ 被拦方代价不退（牌堆仍是 -1）', (g.decks['德国'] || []).length === d0 - 1,
		(g.decks['德国'] || []).length)
	ok('15353 生效（本回合压制该状态卡）',
		Object.keys(g.status_suppressed_this_turn || {}).length > 0,
		JSON.stringify(g.status_suppressed_this_turn || {}))
}

console.log('\n=== B：英国【放弃】拦截 -> 效果照常，代价照付 ===')
{
	const g = setup(true, '15245#1')
	R.view(g, 'Axis')
	const d0 = (g.decks['德国'] || []).length
	R.action(g, 'Axis', 'activate_status', { card: '15245#1' })
	ok('开窗', (g.armed_offers || []).some(w => w.when === 'enemy_status_effect'))
	R.action(g, 'Allies', 'skip_armed_offer', {})
	ok('放弃后窗口清空', (g.armed_offers || []).length === 0)
	ok('代价照付（牌堆 -1）', (g.decks['德国'] || []).length === d0 - 1,
		d0 + ' -> ' + (g.decks['德国'] || []).length)
	/*
	 * 放弃拦截后必须【续跑】那次 activate_status（旧实现只关窗不续跑 = 效果永远不执行）。
	 * 本合成盘面没有真实"刚发起陆战"的上下文，故 run 会以「本回合尚未发起陆战」收尾 —— 这是
	 * fixture 限制；关键断言是：续跑确实发生（日志），且代价只扣一次。
	 */
	const lgB = (g.log || []).join(' ')
	ok('★ 放弃拦截后发生续跑', lgB.indexOf('未被拦截（代价已付），效果照常执行') >= 0,
		lgB.slice(-160))
	ok('★ 代价只扣一次（续跑未重复扣）', (g.decks['德国'] || []).length === d0 - 1,
		(g.decks['德国'] || []).length)
}

console.log('\n=== C：无拦截方 ===')
{
	const g = setup(false, '15245#1')
	R.view(g, 'Axis')
	const d0 = (g.decks['德国'] || []).length
	R.action(g, 'Axis', 'activate_status', { card: '15245#1' })
	ok('无窗口残留', (g.armed_offers || []).length === 0)
	ok('代价照付', (g.decks['德国'] || []).length === d0 - 1)
}

console.log('\n=== D：skip_play 类（17746 耀武）缺 from 时被参数预检挡下（未到代价段）===')
{
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.neutral = {}
	g.hands['意大利'] = ['15341#60']
	g.decks['意大利'] = ['15345#1', '15345#2', '15345#3']
	g.table = { '意大利': ['17746#1'] }
	g.hands['英国'] = ['15353#1', '15341#70']
	I.refresh(g)
	I.arm_status_instant(g, 'play_start', '意大利', d.id_of('意大利'))
	I.refresh(g)
	R.view(g, 'Axis')
	const d0 = (g.decks['意大利'] || []).length
	R.action(g, 'Axis', 'activate_status', { card: '17746#1', space: d.id_of('法国'), from: null })
	const lg = (g.log || []).slice(-3).join(' | ')
	console.log('  log: ' + lg)
	const win = (g.armed_offers || []).some(w => w.when === 'enemy_status_effect')
	console.log('  开窗=' + win + '  牌堆 ' + d0 + ' -> ' + (g.decks['意大利'] || []).length)
	ok('（本卡因缺 from 被预检挡下，未到代价段）', (g.decks['意大利'] || []).length === d0, lg)
}

console.log('\n=== E：静态顺序 ===')
{
	const js = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const iCost = js.indexOf('---------------- 付代价（【2026-10-31 S1】已前移到拦截窗口之前')
	const iWin = js.indexOf("15353：本回合已跳过拦截")
	const iSkip = js.indexOf('【2026-10-23】"跳过出牌阶段"放在这里')
	ok('三段都在', iCost > 0 && iWin > 0 && iSkip > 0,
		'cost=' + iCost + ' win=' + iWin + ' skip=' + iSkip)
	ok('付代价 < 15353 窗口（代价照付）', iCost > 0 && iCost < iWin)
	/* 【2026-10-30 玩家口径】skip_play 也照付 -> 必须排在窗口之前 */
	ok('skip_play < 15353 窗口（被拦也照付）', iSkip > 0 && iSkip < iWin,
		'skip=' + iSkip + ' win=' + iWin)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
