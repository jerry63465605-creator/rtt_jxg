"use strict"
/*
 * 修复验证（2026-10-17）：
 *  A. card_matches_filter 曾【只有调用、无定义】，activate_status 的 cost.discard_is 路径
 *     一走到就 ReferenceError（坦克传输 17846 / 量与质兼得 17843 / 17539 / 15242 一发动即崩）。
 *     本部分单元验证补齐后的函数存在且 {type,name} 匹配正确。
 *  B. 17841 近卫军由 cost.skip_play（结束并推进阶段→跳空军）改为 run 内 mark_play_done
 *     （只占出牌名额、不结束/推进阶段）。本部分端到端验证发动后仍在出牌阶段。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

function freshSU() {
	const g = rules.setup(12345, 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '苏联'
	g.turn_phase = 'play'
	g.turn = 1
	const role = I.faction_of_nation('苏联') === 'allies' ? 'Allies' : 'Axis'
	g.table = g.table || {}
	g.discard = g.discard || {}
	g.hands = g.hands || {}
	I.compute_supply(g)
	return { g, role }
}

function firstBuildSpace(g, nation) {
	for (let sp = 1; sp < I.data.spaces.length; sp++) {
		if (!I.data.spaces[sp]) continue
		if (I.can_build_at(g, nation, sp, 'army').ok) return sp
	}
	return null
}

let ok = true
function check(name, cond) { console.log((cond ? '  [ok] ' : '  [FAIL] ') + name); ok = ok && !!cond }

/* ---------- A. card_matches_filter(card, {type,name}) 单元 ---------- */
console.log('A. card_matches_filter 单元（修 activate_status 的 discard_is ReferenceError）')
{
	const c = I.inst_card
	const cmf = I.card_matches_filter
	check('已导出到 _internal', typeof cmf === 'function')
	check('建设陆军 ~ {BASIC,建设陆军} = true', cmf(c('17800#1'), { type: 'BASIC', name: '建设陆军' }) === true)
	check('发起陆战 ~ {BASIC,建设陆军} = false', cmf(c('17801#1'), { type: 'BASIC', name: '建设陆军' }) === false)
	check('建设陆军 ~ {BASIC,发起陆战} = false', cmf(c('17800#1'), { type: 'BASIC', name: '发起陆战' }) === false)
	check('发起陆战 ~ {BASIC,发起陆战} = true', cmf(c('17801#1'), { type: 'BASIC', name: '发起陆战' }) === true)
	check('建设海军 ~ {BASIC,建设陆军} = false', cmf(c('17802#1'), { type: 'BASIC', name: '建设陆军' }) === false)
	check('空军力量 ~ {BASIC,建设陆军} = false', cmf(c('17804#1'), { type: 'BASIC', name: '建设陆军' }) === false)
	check('null 卡 = false（不误放行）', cmf(null, { type: 'BASIC', name: '建设陆军' }) === false)
	check('无 filter = true（不额外设限）', cmf(c('17800#1'), undefined) === true)
}

/* ---------- B. 17841 近卫军：mark_play_done——不跳阶段、只占名额 ---------- */
console.log('B. 17841 近卫军发动后：仍在出牌阶段、play_done 置位、skip_play_done 未写')
{
	const { g, role } = freshSU()
	g.table['苏联'] = ['17841#1']
	g.status_instant = [{ card_id: '17841#1', window: 'play_start', space: null }]
	g.discard['苏联'] = ['17800#1']
	g.hands['苏联'] = ['17800#3', '17800#4']
	I.compute_supply(g)
	const sp = firstBuildSpace(g, '苏联')
	rules.action(g, role, 'activate_status', { card: '17841#1', space: sp, discard: ['17800#3', '17800#4'] })
	check('仍在出牌阶段(未 advance_phase 跳空军)', g.turn_phase === 'play')
	check('play_done[苏联] 已置位(占用出牌行动)', !!((g.play_done || {})['苏联']))
	check('skip_play_done[苏联] 未写(不走 skip_play 收尾)', (g.skip_play_done || {})['苏联'] === undefined)
	check('log 不含"自动进入下一阶段"', !g.log.some(l => l.indexOf('自动进入') >= 0))
	console.log('    turn_phase =', g.turn_phase, '| play_done =', !!((g.play_done || {})['苏联']))
}

console.log('===')
console.log(ok ? 'PASS ✅ A(card_matches_filter 修 ReferenceError) + B(近卫军不跳阶段) 通过' : 'FAIL ❌')
process.exit(ok ? 0 : 1)
