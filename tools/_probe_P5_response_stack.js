/*
 * 【D1/P5】只读探针：军备卡暗置 → 响应栈触发 → 两阶段 effect → play_response
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_probe_P5_response_stack.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const J = x => JSON.stringify(x)

const g = R.setup(20261112, 'Episode 2')
let guard = 0
while (g.opening && guard++ < 12) {
	const n = g.current_nation
	R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
}
const nation = g.current_nation
console.log('=== 0. 前奏局就绪 ===', nation, g.active, 'phase=', g.prelude.phase)

console.log('\n=== 1. 军备卡打出即暗置留场 ===')
g.prelude.hands[nation].push('18416#t1')       /* 国家总动员法 type=ARMAMENT, trigger=scoring */
R.action(g, g.active, 'prelude_play_hand', { card: '18416#t1' })
const tr = (g.table_responses || []).filter(x => x.prelude)
console.log('table_responses[prelude]=', J(tr))
console.log('前奏弃牌堆含该卡?', (g.prelude.discard[nation] || []).indexOf('18416#t1') >= 0)
console.log('日志尾:', (g.log || []).slice(-3).join(' | '))

console.log('\n=== 2. 事件型时点不命中阶段型卡（零分流）===')
I.request_responses(g, 'build', { nation: nation, space: 1, type: 'army', piece_id: 'x' }, false)
console.log('build 后 response_stack 长度=', (g.response_stack || []).length)
I.request_responses(g, 'scoring', { nation: nation }, false)
console.log('scoring 后 response_stack 长度=', (g.response_stack || []).length)
console.log('栈顶帧=', J((g.response_stack || [])[(g.response_stack || []).length - 1]))

console.log('\n=== 3. 白名单与门禁 ===')
for (const s of ['Axis', 'Allies']) {
	const v = R.view(g, s)
	console.log(s, 'trigger_response=', !!v.actions.trigger_response,
		'前奏动作=', J(Object.keys(v.actions).filter(k => k.indexOf('prelude_') === 0)),
		'pending_trigger=', J(v.pending_trigger))
}

console.log('\n=== 4. play_response 候选（正式手牌里的响应卡）===')
g.hands[nation] = g.hands[nation] || []
g.hands[nation].push('15328#probe')
I.request_responses(g, 'scoring', { nation: nation }, false)
const owner = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).trigger_response)
console.log('答复方=', owner)
if (owner) {
	const n0 = g.log.length
	R.action(g, owner, 'trigger_response', {})
	console.log('trigger_response 日志:', (g.log || []).slice(n0).join(' | ').slice(0, 260))
	const v = R.view(g, owner)
	console.log('response_choice=', J(v.response_choice))
	console.log('response_stack 长度=', (g.response_stack || []).length)
	if (v.response_choice && v.response_choice.candidates && v.response_choice.candidates.length) {
		const pick = v.response_choice.candidates[0].id ||
			(v.response_choice.candidates[0].id != null ? v.response_choice.candidates[0].id : null)
		console.log('候选首个=', J(v.response_choice.candidates[0]), 'pick=', pick)
		const n1 = g.log.length
		R.action(g, owner, 'resolve_response_choice', { choice: pick })
		console.log('resolve 日志:', (g.log || []).slice(n1).join(' | ').slice(0, 300))
		console.log('桌面卡片=', J((g.table_responses || []).map(x => x.card_id)))
	}
}
