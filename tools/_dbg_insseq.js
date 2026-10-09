/* 临时调试：验证两场之间能否插入闪电战(15253) */
const rules = require('../server-official/public/quartermaster-sub-wars/rules.js')
const data = rules.data
const I = rules._internal

function putId(g, id, nation, type, space) {
	g.pieces = g.pieces || {}
	g.location[id] = { id, nation, type, space, damaged: false }
	g.pieces[nation] = g.pieces[nation] || { army: 0, navy: 0, air: 0 }
	if (g.location[id].damaged) g.pieces[nation][type]++
	else g.pieces[nation][type]++
}
function armiesAt(g, space, nation) {
	return Object.values(g.location).filter(p => p.type === 'army' && p.space === space && p.nation === nation).length
}

let g = rules.setup(1)
g.current_nation = '德国'
g.active = 'Axis'
g.turn_phase = 'play'
g.play_done = {}
g.hands['德国'] = ['15226#1', '15200#1', '15204#1']
g.table['德国'] = ['15253#1']
putId(g, 'ger_a', '德国', 'army', 44)
putId(g, 'sov_a', '苏联', 'army', 5)
putId(g, 'sov_b', '苏联', 'army', 12)
putId(g, 'sov_c', '苏联', 'army', 13)
I.compute_supply(g)

// 打巴巴罗萨，3 目标，首战(5)
g = rules.action(g, 'Axis', 'play_card', { card: '15226#1', picks: [5, 12, 13] })
console.log('A) 首战后 pending_seq?', !!g.pending_seq, 'remaining=', g.pending_seq && g.pending_seq.remaining.length)
console.log('   status_instant=', JSON.stringify(g.status_instant))
console.log('   view.table_status 15253 ready=',
	(rules.view(g, 'Axis').table_status.find(t => t.card === '15253') || {}).ready)

// 在两场之间发动闪电战（15253），应在 space=5 建陆军
if (g.status_instant && g.status_instant.some(e => e.card_id === '15253')) {
	g = rules.action(g, 'Axis', 'activate_status', { card: '15253#1' })
	console.log('B) 发动闪电战后：5 号德国陆军数=', armiesAt(g, 5, '德国'),
		' status_instant=', JSON.stringify(g.status_instant),
		' pending_seq 仍在?', !!g.pending_seq, ' remaining=', g.pending_seq && g.pending_seq.remaining.length)
} else {
	console.log('B) 未武装 15253，无法在两场之间插入！')
}

// 续战（应有 15253 已用过 once_per_turn，但序列仍可继续）
g = rules.action(g, 'Axis', 'chain_continue')
console.log('C) 续战后 pending_seq?', !!g.pending_seq, ' remaining=', g.pending_seq && g.pending_seq.remaining.length,
	' status_instant=', JSON.stringify(g.status_instant))
