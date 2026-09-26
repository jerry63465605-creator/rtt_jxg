/*
 * 模拟客户端 update_hand_panel 的置灰逻辑，
 * 检查 8 张增强卡在各阶段的置灰状态。
 *
 * 置灰条件（play.js 修改后）：
 *   if (view.turn_phase !== "discard" && !check_phase_for_card(c).ok)
 *       d.classList.add("disabled")
 *
 * check_phase_for_card 对有 CARD_TRIGGERS 的卡：
 *   self + phase 匹配 + 本方回合 -> ok
 *   self + phase 不匹配 -> 拒
 *   anytime -> ok
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

const g = R.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.hands['英国'] = ['15305', '15306', '15307', '15308', '15309', '15310', '15311', '15312']
I.refresh(g)

const PHASES_CLIENT = ['resource', 'play', 'airforce', 'supply', 'scoring', 'discard', 'draw']
const PHASE_ZH = {
	resource: '资源', play: '出牌', airforce: '空军', supply: '补给',
	scoring: '计分', discard: '弃牌', draw: '摸牌',
}

console.log('=== 置灰矩阵（行=卡，列=阶段） ===')
console.log('卡名'.padEnd(16) + ' | ' + PHASES_CLIENT.map(p => PHASE_ZH[p].padEnd(4)).join(' '))
console.log('-'.repeat(60))

for (const id of ['15305', '15306', '15307', '15308', '15309', '15310', '15311', '15312']) {
	const c = I.inst_card(id)
	const line = c.name.padEnd(16) + ' | '

	const cells = []
	for (const ph of PHASES_CLIENT) {
		g.turn_phase = ph
		const v = R.view(g, 'Allies')

		/* 模拟 check_phase_for_card */
		const tr = v.card_triggers && v.card_triggers[String(c.id)]
		let ok = false
		let reason = ''

		if (tr) {
			if (tr.kind === 'anytime') ok = true
			else if (tr.kind === 'any') { ok = false; reason = '响应卡' }
			else if (tr.kind === 'self') {
				const phaseOk = (ph === tr.phase)
				const factionOk = (v.current_faction === v.my_faction)
				ok = phaseOk && factionOk
				if (!ok) reason = phaseOk ? '非本方' : ('需' + tr.phase)
			}
		} else {
			/* 兜底 */
			ok = true
		}

		/* 模拟置灰条件 */
		const isDiscard = (ph === 'discard')
		const disabled = !isDiscard && !ok

		cells.push(disabled ? ' ✗ ' : ' ✓ ')
	}
	console.log(line + cells.join(' '))
}

console.log('\n=== 重点检查：15309 在计分阶段 ===')
g.turn_phase = 'scoring'
const v = R.view(g, 'Allies')
console.log('view.turn_phase:', v.turn_phase)
console.log('view.my_faction:', v.my_faction)
console.log('view.current_faction:', v.current_faction)
const tr = v.card_triggers['15309']
console.log('trig:', JSON.stringify(tr))
console.log('phase match:', v.turn_phase === tr.phase)
console.log('faction match:', v.current_faction === v.my_faction)

/* 但关键问题：view.hands 里的卡对象长什么样？ */
console.log('\n=== view.hands[英国] 的卡对象 ===')
const hands = v.hands || {}
const ukHand = hands['英国']
if (ukHand && ukHand.cards) {
	console.log('cards 数量:', ukHand.cards.length)
	/* 看 15309 在不在 */
	const c309 = ukHand.cards.find(c => String(c.id) === '15309')
	console.log('15309 卡对象:', c309 ? JSON.stringify({id: c309.id, name: c309.name, type: c309.type}) : 'NOT IN HAND')
} else {
	console.log('hand 结构:', JSON.stringify(ukHand).slice(0, 200))
}
