"use strict"
/*
 * 17816 RDS-1 自选弃牌验证（2026-10-17）。
 * 卡面：弃置 N 张手牌（场上有[曼哈顿计划]改 2、否则 3）：苏联获得 4 分。
 * 之前 bug：event_targets 查询出口透传函数式 eff.cost，tg.cost.discard 是【函数】，
 *           客户端 `tg.cost.discard>0` 恒 false -> 不弹自选弃牌框 -> 服务端
 *           resolve_event_card 走 pool.slice(0,cost) 自动弃前 N 张（玩家没得选）。
 * 修复：query 出口把函数式 cost.discard 求值成数字；客户端复用 echo_discard 选牌框，
 *       玩家选 N 张经 arg.cards 回传，服务端优先用 arg.cards（不再自动弃）。
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
	g.hands = g.hands || {}
	g.table = g.table || {}
	g.discard = g.discard || {}
	return { g, role }
}

let ok = true
function check(name, cond) { console.log((cond ? '  [ok] ' : '  [FAIL] ') + name); ok = ok && !!cond }

/* 1. event_targets 查询：函数式 cost.discard 应被求值成数字 */
console.log('1. query event_targets：cost.discard 求值为数字')
{
	const { g, role } = freshSU()
	g.hands['苏联'] = ['17816#1', '17800#1', '17801#1', '17802#1']
	const tg = rules.query(g, role, 'event_targets', { card: '17816#1', nation: '苏联' })
	check('need === null（无地区目标）', tg && tg.need === null)
	check('cost.discard 是数字 3（无曼哈顿计划）', tg && tg.cost && typeof tg.cost.discard === 'number' && tg.cost.discard === 3)
	console.log('    tg.cost =', JSON.stringify(tg && tg.cost))
}
{
	const { g, role } = freshSU()
	g.hands['苏联'] = ['17816#1', '17800#1', '17801#1', '17802#1']
	g.table['美国'] = ['17545#1']          // 场上有[曼哈顿计划]
	const tg = rules.query(g, role, 'event_targets', { card: '17816#1', nation: '苏联' })
	check('有曼哈顿计划 -> cost.discard === 2', tg && tg.cost && tg.cost.discard === 2)
}

/* 2. play_card 带 arg.cards：弃【玩家自选】的牌 */
console.log('2. play_card 带 cards：玩家自选弃牌生效（跳过 17800）')
{
	const { g, role } = freshSU()
	g.hands['苏联'] = ['17816#1', '17800#1', '17801#1', '17802#1', '17803#1']
	const before = g.score['allies'] || 0
	rules.action(g, role, 'play_card', { card: '17816#1', cards: ['17801#1', '17802#1', '17803#1'] })
	const hand = g.hands['苏联'] || []
	const dis = g.discard['苏联'] || []
	check('玩家选的 3 张进弃牌堆', ['17801#1', '17802#1', '17803#1'].every(id => dis.indexOf(id) >= 0))
	check('未选的 17800#1 留手牌（证明自选而非自动前 3 张）', hand.indexOf('17800#1') >= 0)
	check('苏联阵营 +4 分', (g.score['allies'] || 0) === before + 4)
	console.log('    hand =', JSON.stringify(hand), '| log tail:', g.log.slice(-2).join(' | '))
}

/* 3. 对照：不带 cards -> 旧行为：自动弃前 3 张（证明 arg.cards 才是自选入口） */
console.log('3. 对照：不带 cards -> 自动弃前 3 张')
{
	const { g, role } = freshSU()
	g.hands['苏联'] = ['17816#1', '17800#1', '17801#1', '17802#1', '17803#1']
	rules.action(g, role, 'play_card', { card: '17816#1' })
	const hand = g.hands['苏联'] || []
	const dis = g.discard['苏联'] || []
	check('自动弃前 3 张(17800/17801/17802)', ['17800#1', '17801#1', '17802#1'].every(id => dis.indexOf(id) >= 0))
	check('第 4 张 17803#1 留手', hand.indexOf('17803#1') >= 0)
}

console.log('===')
console.log(ok ? 'PASS ✅ 17816 RDS-1：query 求值 cost.discard + play_card 用 arg.cards 自选弃牌' : 'FAIL ❌')
process.exit(ok ? 0 : 1)
