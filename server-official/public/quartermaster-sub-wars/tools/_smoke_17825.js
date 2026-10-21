/*
 * 回归测试：17825《铁托游击队》
 *   卡面：在<巴尔干>消灭1支敌方国家陆军。在<巴尔干>征召英国或苏联陆军。
 *
 * 玩家 2026-10-22：当前没给选择"苏联还是英国"。
 * 根因：
 *   ① need:'piece' 缺 step/total -> 客户端按单步直接 play_card -> 服务端返回 need:'choice'
 *      时客户端已清空状态，选择框不再出现；
 *   ② 只读 arg.piece、不读多步累积的 arg.pieces -> 重查永远停在阶段①；
 *   ③ 选项 disabled 按"消灭前"盘面算 -> 巴尔干有敌军时英/苏都灰掉。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_17825.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}
function base(withEnemy) {
	let g = rules.setup(1)
	g.opening = null
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.hands['苏联'] = g.hands['苏联'] || []
	g.hands['苏联'].push('17825#1')
	if (withEnemy) {
		g.location['de_bal_probe'] = data.id_of('巴尔干')
		g.piece_nation['de_bal_probe'] = '德国'
		g.piece_type['de_bal_probe'] = 'army'
	}
	return g
}
function britishAt(g, sp) {
	let n = 0
	for (const p of Object.keys(g.piece_nation || {}))
		if (g.piece_nation[p] === '英国' && g.piece_type[p] === 'army' && g.location[p] === sp) n++
	return n
}
function sovietAt(g, sp) {
	let n = 0
	for (const p of Object.keys(g.piece_nation || {}))
		if (g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army' && g.location[p] === sp) n++
	return n
}

const BAL = data.id_of('巴尔干')
const PID = 'de_bal_probe'

console.log('=== A. 阶段① need:piece 必须带 step/total（客户端才会累积重查）===')
{
	const g = base(true)
	const n = I.event_card_needs(g, '苏联', '17825#1', {})
	ok('返回 need:piece', !!(n && n.need === 'piece'), JSON.stringify(n))
	ok('带 total=2', !!(n && n.total === 2), 'total=' + (n && n.total))
	ok('带 step=0', !!(n && n.step === 0), 'step=' + (n && n.step))
}

console.log('\n=== B. 阶段② 选择英国/苏联：两个选项都必须可选（按消灭后盘面）===')
{
	const g = base(true)
	const n = I.event_card_needs(g, '苏联', '17825#1', { pieces: [PID] })
	ok('返回 need:choice', !!(n && n.need === 'choice'), JSON.stringify(n && n.need))
	const opts = (n && n.options) || []
	ok('有 2 个选项', opts.length === 2, 'labels=' + opts.map(o => o.label).join('/'))
	ok('"征召英国陆军"可点', opts[0] && opts[0].disabled === false, JSON.stringify(opts[0]))
	ok('"征召苏联陆军"可点', opts[1] && opts[1].disabled === false, JSON.stringify(opts[1]))
	ok('不再是"消灭前"导致的灰置', !opts.every(o => o.disabled))
}

console.log('\n=== C. 最终执行（choice=0 英国）：消灭敌方 + 英国在巴尔干征召 + 卡进弃牌堆 ===')
{
	let g = base(true)
	g = rules.action(g, 'Allies', 'play_card', { card: '17825#1', piece: PID, choice: 0 })
	ok('巴尔干敌方陆军已被消灭', !g.location[PID])
	ok('巴尔干英国陆军 +1', britishAt(g, BAL) === 1, 'count=' + britishAt(g, BAL))
	ok('17825 已进弃牌堆', (g.discard['苏联'] || []).indexOf('17825#1') >= 0)
	ok('占出牌名额 play_done[苏联]', !!(g.play_done && g.play_done['苏联']),
		'play_done=' + JSON.stringify(g.play_done))
}

console.log('\n=== D. 最终执行（choice=1 苏联）：征召苏联陆军 ===')
{
	let g = base(true)
	g = rules.action(g, 'Allies', 'play_card', { card: '17825#1', piece: PID, choice: 1 })
	ok('巴尔干苏联陆军 +1', sovietAt(g, BAL) === 1, 'count=' + sovietAt(g, BAL))
	ok('英国陆军未增加', britishAt(g, BAL) === 0)
}

console.log('\n=== E. 巴尔干无敌军：直接进入国别选择（无阶段①）===')
{
	const g = base(false)
	const n = I.event_card_needs(g, '苏联', '17825#1', {})
	ok('直接 need:choice', !!(n && n.need === 'choice'), JSON.stringify(n && n.need))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
