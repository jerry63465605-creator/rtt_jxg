"use strict"
/*
 * 17844 女性在兵役 修复验证：
 *   · 情形1：手牌有 1 张[建设陆军]，17844 在桌面；主 play_card 打出后手牌应为 1 张（循环，不翻倍）。
 *   · 情形2：无 17844；打出后手牌应为 0 张（正常弃牌入堆）。
 * 忠实走真实引擎路径 rules.action('play_card', {card, space})。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

function freshSU(with17844) {
	const g = rules.setup(12345, 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '苏联'
	g.turn_phase = 'play'
	g.turn = 1
	const role = I.faction_of_nation('苏联') === 'allies' ? 'Allies' : 'Axis'
	g.table = g.table || {}
	g.hands = g.hands || {}
	g.discard = g.discard || {}
	g.play_done = g.play_done || {}
	if (with17844) g.table['苏联'] = ['17844#1']
	return { g, role }
}

function firstBuildSpace(g, nation) {
	for (let sp = 1; sp < I.data.spaces.length; sp++) {
		if (!I.data.spaces[sp]) continue
		if (I.can_build_at(g, nation, sp, 'army').ok) return sp
	}
	return null
}

// 情形1：17844 在桌面，手牌 1 张建设陆军
{
	const { g, role } = freshSU(true)
	g.hands['苏联'] = ['17800#3']
	const sp = firstBuildSpace(g, '苏联')
	const before = (g.hands['苏联'] || []).filter(id => I.inst_card(id).name === '建设陆军').length
	rules.action(g, role, 'play_card', { card: '17800#3', space: sp })
	const after = (g.hands['苏联'] || []).filter(id => I.inst_card(id).name === '建设陆军').length
	const built = Object.keys(g.location).some(id => g.location[id] === sp && g.piece_nation[id] === '苏联' && g.piece_type[id] === 'army')
	console.log(`情形1(17844在桌面): 建设陆军 手牌前=${before} 手牌后=${after} 已建成=${built} 弃牌堆=${JSON.stringify(g.discard['苏联'])}`)
	if (before === 1 && after === 1 && built) {
		console.log('PASS 情形1：手牌未翻倍，建设陆军循环留手，且已建成陆军')
	} else {
		console.log('FAIL 情形1')
		process.exitCode = 1
	}
}

// 情形2：无 17844，手牌 1 张建设陆军
{
	const { g, role } = freshSU(false)
	g.hands['苏联'] = ['17800#3']
	const sp = firstBuildSpace(g, '苏联')
	const before = (g.hands['苏联'] || []).filter(id => I.inst_card(id).name === '建设陆军').length
	rules.action(g, role, 'play_card', { card: '17800#3', space: sp })
	const after = (g.hands['苏联'] || []).filter(id => I.inst_card(id).name === '建设陆军').length
	const inDiscard = (g.discard['苏联'] || []).some(id => I.inst_card(id).name === '建设陆军')
	console.log(`情形2(无17844): 建设陆军 手牌前=${before} 手牌后=${after} 弃牌堆含建设陆军=${inDiscard}`)
	if (before === 1 && after === 0 && inDiscard) {
		console.log('PASS 情形2：正常弃牌入堆，手牌清空')
	} else {
		console.log('FAIL 情形2')
		process.exitCode = 1
	}
}

console.log(process.exitCode ? 'RESULT=FAIL' : 'RESULT=PASS')
