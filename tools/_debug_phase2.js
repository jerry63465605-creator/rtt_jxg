/*
 * 模拟客户端判定流程，看各阶段下 15309 的 check_phase_for_card 返回什么。
 * 同时检查 event_targets 查询返回什么。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

const g = R.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.hands['英国'] = ['15309', 'a', 'b']
I.refresh(g)

for (const ph of ['resource', 'play', 'airforce', 'supply', 'scoring', 'discard', 'draw']) {
	g.turn_phase = ph
	const v = R.view(g, 'Allies')

	/* 模拟客户端 check_phase_for_card */
	const c = I.inst_card('15309')
	const tr = v.card_triggers && v.card_triggers['15309']
	let result
	if (!tr) {
		result = '无时点声明 -> ' + (I.is_enhance_card(c) ? '兜底放行' : '走旧逻辑')
	} else if (tr.kind === 'anytime') {
		result = 'anytime -> ok'
	} else if (tr.kind === 'any') {
		result = 'any -> 拒绝'
	} else if (tr.kind === 'self') {
		const phaseOk = (ph === tr.phase)
		const factionOk = (v.current_faction && v.my_faction && v.current_faction === v.my_faction)
		result = 'self/' + tr.phase + ': phaseOk=' + phaseOk + ' factionOk=' + factionOk +
			' -> ' + (phaseOk && factionOk ? 'ok' : '拒')
	}
	console.log('  ' + ph.padEnd(10) + ' -> ' + result)
}

/* 单独检查 event_targets 查询 */
console.log('\n=== event_targets 查询（计分阶段）===')
g.turn_phase = 'scoring'
const tg = R.query(g, 'Allies', 'event_targets', { card: '15309' })
console.log(JSON.stringify(tg, null, 1))

console.log('\n=== event_targets 查询（空军阶段）===')
g.turn_phase = 'airforce'
const tg2 = R.query(g, 'Allies', 'event_targets', { card: '15309' })
console.log(JSON.stringify(tg2, null, 1))

console.log('\n=== event_targets 查询（补给阶段）===')
g.turn_phase = 'supply'
const tg3 = R.query(g, 'Allies', 'event_targets', { card: '15309' })
console.log(JSON.stringify(tg3, null, 1))
