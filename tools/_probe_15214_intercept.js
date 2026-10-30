/*
 * #6 战术革新（15214，EFFECT·德国）
 *
 * 【2026-10-31 S1 玩家口径】代价照付、只拦效果。新时序：
 *   ① play_card      -> pending_echo(step 'discard')：选择要弃置的德国桌面状态卡
 *   ② resolve_effect -> 弃置那张状态卡（★代价照付）-> 派发 enemy_echo_played 窗口 -> step 'play' 等待
 *   ③a 拦截成功      -> 15214 进弃牌堆、pending_echo 清空、免费打出不发生（代价已付不退）
 *   ③b 拦截放弃      -> 玩家用 resolve_effect{play_status} 继续 -> 免费打出（效果照常）
 *
 * 用法：node tools/_probe_15214_intercept.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const inHand = (g, n, c) => (g.hands[n] || []).indexOf(c) >= 0
const inDisc = (g, n, c) => (g.discard[n] || []).indexOf(c) >= 0
const onTable = (g, n, c) => (g.table[n] || []).indexOf(c) >= 0

function setup(withInterceptor) {
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.neutral = {}
	g.play_done = {}
	g.hands['德国'] = ['15214#1', '15244#9']     /* 15244 丰富的资源（STATUS·德国）在手里 */
	g.decks['德国'] = ['15345#1', '15345#2']
	g.table = { '德国': ['15241#1'] }             /* 桌上 1 张状态卡（瑞典铁矿） */
	if (withInterceptor) g.hands['英国'] = ['15352#1', '15341#7']
	else g.hands['英国'] = ['15341#7']
	I.refresh(g)
	return g
}

console.log('\n=== A：打出 -> 先付代价 -> 被英国 15352 拦截 ===')
{
	const g = setup(true)
	/* ① 打出：直接进入"选择要弃置的状态卡"（代价步骤），此时【还没有】拦截窗口 */
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: '15214#1' })
	;(g.log || []).slice(n0).forEach(l => console.log('  log| ' + l))
	ok('打出后进入代价步骤（step=discard）',
		g.pending_echo && g.pending_echo.step === 'discard',
		JSON.stringify(g.pending_echo && g.pending_echo.step))
	ok('此时【还没开窗】（代价在开窗之前）',
		!(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))

	/* ② 付代价：弃置桌面那张状态卡 -> 然后才开窗 */
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_effect', { discard_status: '15241#1' })
	;(g.log || []).slice(n1).forEach(l => console.log('  log| ' + l))
	ok('★ 代价已付：桌面状态卡进弃牌堆', !onTable(g, '德国', '15241#1') && inDisc(g, '德国', '15241#1'),
		JSON.stringify(g.table['德国']))
	ok('付代价后才开窗', (g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	ok('停在 step=play（效果暂停）',
		g.pending_echo && g.pending_echo.step === 'play',
		JSON.stringify(g.pending_echo && g.pending_echo.step))

	/* ③a 拦截成功 */
	const n2 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: '15352#1', drop: ['15341#7'] })
	;(g.log || []).slice(n2).forEach(l => console.log('  log| ' + l))
	ok('15214 进德国弃牌堆（照常打出）', inDisc(g, '德国', '15214#1'), JSON.stringify(g.discard['德国'] || []))
	ok('★ 代价不退：弃置的状态卡仍留在弃牌堆', inDisc(g, '德国', '15241#1'))
	ok('★ 效果取消：手里的状态卡没有被免费打出', inHand(g, '德国', '15244#9') && !onTable(g, '德国', '15244#9'))
	ok('pending_echo 已清空', !g.pending_echo, JSON.stringify(g.pending_echo))
	ok('英国付了自己的代价（弃 1 张）', inDisc(g, '英国', '15341#7') && !inHand(g, '英国', '15341#7'))
	ok('日志写明"代价不退"', (g.log || []).slice(n2).join(' ').indexOf('代价不退') >= 0,
		(g.log || []).slice(n2).join(' | '))
}

console.log('\n=== B：打出 -> 先付代价 -> 英国放弃 -> 效果照常 ===')
{
	const g = setup(false)
	R.action(g, 'Axis', 'play_card', { card: '15214#1' })
	R.action(g, 'Axis', 'resolve_effect', { discard_status: '15241#1' })
	ok('无拦截卡 -> 不停在等待（直接 step=play 可选牌）',
		g.pending_echo && g.pending_echo.step === 'play' &&
		(g.pending_echo.candidates || []).length > 0, JSON.stringify(g.pending_echo && g.pending_echo.step))
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_effect', { play_status: '15244#9' })
	;(g.log || []).slice(n1).forEach(l => console.log('  log| ' + l))
	ok('效果执行：手里的状态卡免费打到桌面',
		onTable(g, '德国', '15244#9') && !inHand(g, '德国', '15244#9'), JSON.stringify(g.table['德国']))
	ok('15214 自身进弃牌堆', inDisc(g, '德国', '15214#1'))
	ok('增强卡不占出牌名额', !g.play_done['德国'], JSON.stringify(g.play_done))
}

console.log('\n=== C：有拦截卡但【放弃】拦截 -> 效果继续（pending_echo 不被重放冲掉）===')
{
	const g = setup(true)
	R.action(g, 'Axis', 'play_card', { card: '15214#1' })
	R.action(g, 'Axis', 'resolve_effect', { discard_status: '15241#1' })
	ok('开窗中', (g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	R.action(g, 'Allies', 'skip_armed_offer', {})
	ok('放弃后仍停在 step=play（未被 play_card 重放影响）',
		g.pending_echo && g.pending_echo.step === 'play' &&
		(g.pending_echo.candidates || []).length > 0,
		JSON.stringify(g.pending_echo && { step: g.pending_echo.step, n: (g.pending_echo.candidates || []).length }))
	R.action(g, 'Axis', 'resolve_effect', { play_status: '15244#9' })
	ok('效果照常执行', onTable(g, '德国', '15244#9'))
	ok('代价也照付（弃掉的状态卡在弃牌堆）', inDisc(g, '德国', '15241#1'))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
