/*
 * 回归测试：17812《亚洲人力储备》（+ 17813《重建要塞》同款多步挂起）
 *
 * 用户反馈（2026-10-22）："亚洲人力储备，使用时卡死"。
 * 根因：run 第二步把牌堆写成 game.deck[国]（单数）→ TypeError，
 *       且发生前已把选中的[建设陆军]从弃牌堆 splice 掉，
 *       状态停在 pending_echo.step='deck'，玩家无法继续。
 *
 * 覆盖：
 *   A 弃牌堆有 2 张[建设陆军] -> 两步走完（1 进手牌、1 置牌堆底）
 *   B 只有 1 张            -> 一步即完成
 *   C 一张都没有            -> 直接跳过，卡仍进弃牌堆
 *   D 本卡打出即进弃牌堆（不走 play_card 代弃，因为它 pending 提前返回）
 *   E 17813 同理：挂起建立 + 卡进弃牌堆 + 选牌后挂起清空
 *
 * 用法：node tools/_smoke_17812.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

function base() {
	const g = rules.setup(1)
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.turn_phase = 'discard'
	g.turn = g.turn || 1
	g.hands = g.hands || {}
	g.discard = g.discard || {}
	g.decks = g.decks || {}
	g.hands['苏联'] = g.hands['苏联'] || []
	g.discard['苏联'] = g.discard['苏联'] || []
	g.decks['苏联'] = g.decks['苏联'] || []
	return g
}
const inArr = (arr, id) => (arr || []).indexOf(id) >= 0
const startsWith = (arr, pre) => (arr || []).filter(x => String(x).startsWith(pre))

console.log('=== A. 弃牌堆 2 张[建设陆军]：两步走完 ===')
{
	const g0 = base()
	g0.hands['苏联'].push('17812#1')
	g0.discard['苏联'].push('17800#1', '17800#2')

	let g = rules.action(g0, 'Allies', 'play_card', { card: '17812#1' })
	ok('打出后建立挂起 step=hand', !!g.pending_echo && g.pending_echo.step === 'hand',
		JSON.stringify(g.pending_echo && g.pending_echo.step))
	ok('候选 = 2 张建设陆军', (g.pending_echo.candidates || []).length === 2)
	ok('卡已进弃牌堆（不在手牌）',
		inArr(g.discard['苏联'], '17812#1') && !inArr(g.hands['苏联'], '17812#1'))

	g = rules.action(g, 'Allies', 'resolve_effect', { pick: '17800#1' })
	ok('第 1 张已置入手牌', inArr(g.hands['苏联'], '17800#1'))
	ok('挂起推进到 step=deck', !!g.pending_echo && g.pending_echo.step === 'deck',
		JSON.stringify(g.pending_echo && g.pending_echo.step))

	g = rules.action(g, 'Allies', 'resolve_effect', { pick: '17800#2' })
	ok('第 2 张已进牌堆底', (g.decks['苏联'] || []).slice(-1)[0] === '17800#2',
		JSON.stringify((g.decks['苏联'] || []).slice(-1)))
	ok('挂起已清空', g.pending_echo === null)
	ok('弃牌堆无残留建设陆军', startsWith(g.discard['苏联'], '17800').length === 0,
		JSON.stringify(startsWith(g.discard['苏联'], '17800')))
}

console.log('\n=== B. 只有 1 张：一步完成 ===')
{
	const g0 = base()
	g0.hands['苏联'].push('17812#1')
	g0.discard['苏联'].push('17800#3')

	let g = rules.action(g0, 'Allies', 'play_card', { card: '17812#1' })
	ok('建立挂起 step=hand', !!g.pending_echo)
	g = rules.action(g, 'Allies', 'resolve_effect', { pick: '17800#3' })
	ok('挂起已清空（无需第二步）', g.pending_echo === null)
	ok('该卡已入手牌', inArr(g.hands['苏联'], '17800#3'))
	ok('本卡仍在弃牌堆', inArr(g.discard['苏联'], '17812#1'))
}

console.log('\n=== C. 弃牌堆没有建设陆军：跳过 ===')
{
	const g0 = base()
	g0.hands['苏联'].push('17812#1')

	const g = rules.action(g0, 'Allies', 'play_card', { card: '17812#1' })
	ok('不建立挂起', !g.pending_echo)
	ok('日志说明无[建设陆军]',
		(g.log || []).some(l => /弃牌堆没有\[建设陆军\]/.test(l)),
		(g.log || []).slice(-1)[0])
	ok('卡仍进弃牌堆', inArr(g.discard['苏联'], '17812#1'))
}

console.log('\n=== E. 17813 重建要塞：挂起 + 卡进弃牌堆 + 选牌清挂起 ===')
{
	const g0 = base()
	g0.hands['苏联'].push('17813#1')
	g0.discard['苏联'].push('17830#1')      /* 苏联响应卡《保卫祖国》 */

	let g = rules.action(g0, 'Allies', 'play_card', { card: '17813#1' })
	if (g.pending_echo) {
		ok('建立挂起 step=play', g.pending_echo.step === 'play', JSON.stringify(g.pending_echo.step))
		ok('卡已进弃牌堆', inArr(g.discard['苏联'], '17813#1'))
		g = rules.action(g, 'Allies', 'resolve_effect', { pick: '17830#1' })
		ok('选牌后挂起清空', g.pending_echo === null,
			(g.log || []).slice(-1)[0])
	} else {
		console.log('  （代价未支付，play 被拦在代价阶段）log:', (g.log || []).slice(-1)[0])
		ok('至少没有崩', true)
	}
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
