"use strict"
/*
 * 17841 近卫军 bug 复现：run 用 is_card_type(BASIC) 取弃牌堆【第一张任意 BASIC】，
 * 未限定 name==='建设陆军'；play_build_army_from 又按 c.name 分派。
 * => 弃牌堆第一张 BASIC 若不是[建设陆军]（如[发起陆战]/[建设海军]/[空军力量]），
 *    会取错牌 -> resolve_basic_card 走错分支 -> 失败/回滚，
 *    表现为：代价（弃2张）已付，却没建成陆军、也没回手[建设陆军]。
 * 忠实走真实引擎路径 rules.action('activate_status')，参数与客户端提交同形。
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
	g.table['苏联'] = ['17841#1']
	g.discard = g.discard || {}
	g.hands = g.hands || {}
	g.status_instant = [{ card_id: '17841#1', window: 'play_start', space: null }]
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

function armyAt(g, sp, nation) {
	for (const id in g.location)
		if (g.location[id] === sp && g.piece_nation[id] === nation && g.piece_type[id] === 'army') return true
	return false
}

function run(label, discardPile) {
	const { g, role } = freshSU()
	g.discard['苏联'] = discardPile.slice()
	g.hands['苏联'] = ['17800#3', '17800#4']
	const sp = firstBuildSpace(g, '苏联')
	rules.action(g, role, 'activate_status', { card: '17841#1', space: sp, discard: ['17800#3', '17800#4'] })
	console.log('--- ' + label + ' ---')
	console.log('space =', sp, '| armyThere =', armyAt(g, sp, '苏联'),
		'| handLeft =', (g.hands['苏联'] || []).length,
		'| discard =', JSON.stringify(g.discard['苏联']))
	console.log('log tail:', g.log.slice(-3).join(' | '))
	return { army: armyAt(g, sp, '苏联'), hand: (g.hands['苏联'] || []).length, log: g.log.slice(-3).join(' | ') }
}

const A = run('局A 首张 BASIC=[发起陆战](17801)，其后才是[建设陆军]', ['17801#1', '17800#2'])
const B = run('局B 首张 BASIC=[建设陆军]（对照，应成功）', ['17800#1'])
const C = run('局C 首张 BASIC=[建设海军](17802)', ['17802#1'])
const D = run('局D 首张 BASIC=[空军力量](17804)', ['17804#1'])
const E = run('局E 多张[建设陆军]（应成功：取第一张）', ['17800#5', '17800#6', '17800#7'])
const F = run('局F 混合·首张即[建设陆军]后掺[发起陆战]（应成功）', ['17800#5', '17801#6', '17800#7'])
const G = run('局G 混合·首张[发起陆战]后接多张[建设陆军]（现状:bug）', ['17801#5', '17800#6', '17800#7'])

console.log('===')
console.log('建成? A=' + A.army + ' B=' + B.army + ' C=' + C.army + ' D=' + D.army +
	' E=' + E.army + ' F=' + F.army + ' G=' + G.army +
	' | 无建设陆军时未白弃牌(handLeft=2)? C=' + C.hand + ' D=' + D.hand)
/* 修复后预期：
 *  · 弃牌堆只要有[建设陆军]（单张/多张17800/非建设陆军在前但建设陆军在后）→ 取对牌、建成
 *  · 弃牌堆无[建设陆军]（C=建设海军 / D=空军力量）→ 闸门置灰、不弃牌（handLeft 仍为 2）
 */
const hasArmy = (A.army && B.army && E.army && F.army && G.army)
const noArmyGated = (C.army === false && C.hand === 2) && (D.army === false && D.hand === 2)
console.log((hasArmy && noArmyGated)
	? 'PASS：有[建设陆军]即取对牌建成；无[建设陆军]则置灰、不白弃 2 张'
	: 'FAIL：修复后行为不符预期')
process.exit((hasArmy && noArmyGated) ? 0 : 1)
