/*
 * 【真实测试范式 · 第 3 组】S1：15214《战术革新》被 15352 拦 -> 代价不退、效果不发生
 *
 * 两支：
 *   A. 意大利在二级反制窗口【放弃】-> 15352 拦截成立 -> 15214 效果取消，但代价（弃桌面状态卡）不退
 *   B. 英国直接【放弃】拦截      -> 15214 免费打出照常（对照组）
 *
 * 链路 A（全真实动作）：
 *   ① debug 布阵：德国桌面 1 张状态卡、手里 15214 + 1 张状态卡；英国握 15352；意大利握 16700
 *   ② 德国 play_card 15214 -> pending_echo step=discard（先付代价）
 *   ③ resolve_effect{discard_status} -> 弃桌面状态卡（★代价照付）-> 才派发 enemy_echo_played
 *   ④ 英国 use 15352 {drop} -> 触发拦截 -> 15352 自身是增强卡 -> 意大利 16700 反制窗口
 *   ⑤ 意大利 skip_armed_offer -> 恢复 15352 -> 拦截成立 -> 15214 进弃牌堆、pending_echo 清空
 *
 * 用法：node tools/_real_test_paradigm_15214.js
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
const inTable = (g, n, c) => (g.table[n] || []).indexOf(c) >= 0
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

/* 布阵：德国桌面 1 张状态卡 + 手里 15214 与 1 张状态卡；英国 15352+代价；意大利 16700 */
function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15241', nation: '德国', dest: 'hand' })  /* 瑞典铁矿 STATUS */
	R.action(g, 'Axis', 'debug_add_card', { face: '15214', nation: '德国', dest: 'hand' })  /* 战术革新 */
	R.action(g, 'Axis', 'debug_add_card', { face: '15244', nation: '德国', dest: 'hand' })  /* 丰富的资源 STATUS */
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15341', nation: '英国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '16700', nation: '意大利', dest: 'hand' })

	const onTable = (g.hands['德国'] || []).find(x => String(x).indexOf('15241#') === 0)
	const tactic = (g.hands['德国'] || []).find(x => String(x).indexOf('15214#') === 0)
	const spare = (g.hands['德国'] || []).find(x => String(x).indexOf('15244#') === 0)
	const ukBl = (g.hands['英国'] || []).find(x => String(x).indexOf('15352#') === 0)
	const ukPay = (g.hands['英国'] || []).find(x => String(x).indexOf('15341#') === 0)
	const itLion = (g.hands['意大利'] || []).find(x => String(x).indexOf('16700#') === 0)

	/* 把 15241 打到桌面（STATUS，占名额）-> 重入出牌阶段清名额 */
	R.action(g, 'Axis', 'play_card', { card: onTable })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	return { g, onTable, tactic, spare, ukBl, ukPay, itLion }
}

console.log('\n=== §1 布阵校验 ===')
{
	const { g, onTable, tactic, spare, ukBl, itLion } = setup()
	ok('德国桌面已有状态卡', inTable(g, '德国', onTable), JSON.stringify(g.table['德国']))
	ok('四张关键卡到位', !!tactic && !!spare && !!ukBl && !!itLion,
		JSON.stringify({ tactic, spare, ukBl, itLion }))
}

console.log('\n=== §2-A 德国打出 15214 -> 先付代价（弃桌面状态卡）===')
{
	const { g, onTable, tactic, spare, ukBl, ukPay, itLion } = setup()
	let n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: tactic })
	console.log('  log: ' + logSince(g, n0))
	ok('进入代价步骤（pending_echo.step=discard）',
		g.pending_echo && g.pending_echo.step === 'discard',
		JSON.stringify(g.pending_echo && g.pending_echo.step))
	ok('此时【还没开窗】（代价在开窗之前）',
		!(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))

	n0 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_effect', { discard_status: onTable })
	console.log('  log: ' + logSince(g, n0))
	ok('★ 代价已付：桌面状态卡进德国弃牌堆',
		!inTable(g, '德国', onTable) && inDisc(g, '德国', onTable),
		JSON.stringify({ table: g.table['德国'], disc: g.discard['德国'] }))
	ok('付代价后才开窗（英国可见）',
		!!(R.view(g, 'Allies').armed_offer &&
			R.view(g, 'Allies').armed_offer.when === 'enemy_echo_played'),
		JSON.stringify(R.view(g, 'Allies').armed_offer && R.view(g, 'Allies').armed_offer.when))
	ok('窗口来源 via=play（15214 是主动打出，非触发）',
		R.view(g, 'Allies').armed_offer && R.view(g, 'Allies').armed_offer.via === 'play',
		JSON.stringify(R.view(g, 'Allies').armed_offer && R.view(g, 'Allies').armed_offer.via))

	console.log('\n=== §2-B 英国 15352 拦 -> 意大利 16700 反制窗口 -> 放弃 ===')
	n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: ukBl, drop: [ukPay] })
	console.log('  log: ' + logSince(g, n0))
	const vIt = R.view(g, 'Axis')
	ok('★ 15352 的"使用"又开出反制窗口（意大利 16700）',
		!!(vIt.armed_offer && vIt.armed_offer.when === 'enemy_echo_played' &&
			vIt.armed_offer.cards.some(c => c.card === itLion)),
		JSON.stringify(vIt.armed_offer && vIt.armed_offer.cards.map(c => c.card)))

	n0 = (g.log || []).length
	R.action(g, 'Axis', 'skip_armed_offer', {})   /* 意大利放弃反制 -> 15352 成立 */
	console.log('  log: ' + logSince(g, n0))

	console.log('\n=== §3-A 断言（拦截成立）===')
	ok('15214 进德国弃牌堆（照常打出）', inDisc(g, '德国', tactic), JSON.stringify(g.discard['德国']))
	ok('★ 代价不退：桌面那张状态卡仍在弃牌堆', inDisc(g, '德国', onTable))
	ok('★ 效果取消：手里的状态卡没有被免费打出',
		inHand(g, '德国', spare) && !inTable(g, '德国', spare), JSON.stringify(g.table['德国']))
	ok('pending_echo 已清空', !g.pending_echo, JSON.stringify(g.pending_echo))
	ok('15352 已消耗 + 英国代价照付',
		inDisc(g, '英国', ukBl) && inDisc(g, '英国', ukPay), JSON.stringify(g.discard['英国']))
	ok('意大利 16700 未被消耗（放弃反制）', inHand(g, '意大利', itLion),
		JSON.stringify(g.hands['意大利']))
	ok('无残留：pending_armed_use / armed_offers / chain_depth',
		!g.pending_armed_use && (g.armed_offers || []).length === 0 && !g.__echo_chain_depth,
		JSON.stringify({ pu: !!g.pending_armed_use, ao: (g.armed_offers || []).length, cd: g.__echo_chain_depth }))

	console.log('\n=== §4 对照组：英国直接放弃拦截 -> 15214 效果照常 ===')
	const s2 = setup()
	const g2 = s2.g
	let m0 = (g2.log || []).length
	R.action(g2, 'Axis', 'play_card', { card: s2.tactic })
	R.action(g2, 'Axis', 'resolve_effect', { discard_status: s2.onTable })
	ok('对照组：已开窗', (g2.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	m0 = (g2.log || []).length
	R.action(g2, 'Allies', 'skip_armed_offer', {})
	console.log('  log: ' + logSince(g2, m0))
	ok('放弃后仍停在 step=play（未被打断）',
		g2.pending_echo && g2.pending_echo.step === 'play' &&
		(g2.pending_echo.candidates || []).length > 0,
		JSON.stringify(g2.pending_echo && { step: g2.pending_echo.step }))
	m0 = (g2.log || []).length
	R.action(g2, 'Axis', 'resolve_effect', { play_status: s2.spare })
	console.log('  log: ' + logSince(g2, m0))
	ok('★ 效果照常：手里的状态卡免费打到桌面',
		inTable(g2, '德国', s2.spare) && !inHand(g2, '德国', s2.spare),
		JSON.stringify(g2.table['德国']))
	ok('对照组代价同样已付', inDisc(g2, '德国', s2.onTable))
	ok('对照组无残留', !g2.pending_echo && !g2.pending_armed_use &&
		(g2.armed_offers || []).length === 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
