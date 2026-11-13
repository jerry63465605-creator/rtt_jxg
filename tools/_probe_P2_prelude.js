/*
 * 【D1/P2】只读探针：前奏引擎最小链路（真实 R.setup / R.action / R.view，不改产品代码）
 * 用法：node tools/_probe_P2_prelude.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const J = x => JSON.stringify(x)

const g = R.setup(20261112, 'Episode 2')
console.log('=== 1. 开局 ===')
console.log('prelude.enabled=', g.prelude.enabled, ' tension=', g.prelude.tension,
	' phase=', g.prelude.phase, ' opening=', !!g.opening)

let guard = 0
while (g.opening && guard++ < 12) {
	const n = g.current_nation
	const cards = (g.hands[n] || []).slice(0, 3)
	R.action(g, g.active, 'opening_discard', { cards: cards })
}
console.log('=== 2. opening 结束 ===')
console.log('opening=', g.opening, ' prelude.phase=', g.prelude.phase,
	' current_nation=', g.current_nation, ' active=', g.active)
console.log('日志尾:', (g.log || []).slice(-4).join(' | '))

const v = R.view(g, g.active)
console.log('=== 3. view ===')
console.log('view.prelude=', v.prelude ? J({
	enabled: v.prelude.enabled, phase: v.prelude.phase, tension: v.prelude.tension,
	deck_counts: v.prelude.deck_counts,
	hand_sizes: Object.fromEntries(Object.entries(v.prelude.hands).map(([k, x]) =>
		[k, Array.isArray(x) ? x.length : x])),
}) : null)
console.log('view.actions 前奏项=', J(Object.keys(v.actions || {}).filter(k => k.indexOf('prelude_') === 0)))
const own = g.current_nation
console.log('本国牌堆顶=', J(v.prelude && v.prelude.deck_top[own]))

console.log('=== 4. 行动阶段：打牌堆顶 ===')
const n1 = (g.log || []).length
R.action(g, g.active, 'prelude_play_top', {})
console.log('日志:', (g.log || []).slice(n1).join(' | ').slice(0, 400))
console.log('阶段=', g.prelude.phase, ' pending=', J(g.prelude.pending && {
	answerNation: g.prelude.pending.answerNation, name: g.prelude.pending.name,
	kind: (g.prelude.pending.segments[0] || {}).kind,
}))
console.log('本国前奏手牌数=', (g.prelude.hands[own] || []).length)

console.log('=== 5. 段窗口（若有）与推进 ===')
if (g.prelude.pending) {
	const side = R.view(g, g.active).my_nation
	const want = (function () {
		for (const s of ['Axis', 'Allies']) {
			const vv = R.view(g, s)
			if (vv.actions && vv.actions.prelude_pay) return s
		}
		return null
	})()
	console.log('答复方 role=', want)
	if (want) R.action(g, want, 'prelude_skip', {})
}
console.log('阶段=', g.prelude.phase)

console.log('=== 6. 结束条件①：紧张度 10 ===')
const g2 = R.setup(20261112, 'Episode 2')
let guard2 = 0
while (g2.opening && guard2++ < 12) {
	const n = g2.current_nation
	R.action(g2, g2.active, 'opening_discard', { cards: (g2.hands[n] || []).slice(0, 3) })
}
g2.prelude.tension = 10
R.action(g2, g2.active, 'prelude_discard_1_1', {})
console.log('discard_1_1 后 phase=', g2.prelude.phase, ' ended=', g2.prelude.ended)
if (!g2.prelude.ended) {
	R.action(g2, g2.active, 'prelude_next', {})
	R.action(g2, g2.active, 'prelude_next', {})
}
console.log('ended=', g2.prelude.ended, ' reason=', g2.prelude.end_reason)

console.log('=== 7. 结束条件②：牌堆与手牌皆空 ===')
const g3 = R.setup(20261112, 'Episode 2')
let guard3 = 0
while (g3.opening && guard3++ < 12) {
	const n = g3.current_nation
	R.action(g3, g3.active, 'opening_discard', { cards: (g3.hands[n] || []).slice(0, 3) })
}
for (const n of Object.keys(g3.prelude.decks)) {
	g3.prelude.decks[n] = []
	g3.prelude.hands[n] = []
}
let guard4 = 0
while (!g3.prelude.ended && guard4++ < 40) {
	R.action(g3, g3.active, 'prelude_next', {})
}
console.log('ended=', g3.prelude.ended, ' reason=', g3.prelude.end_reason,
	' rounds=', g3.prelude.rounds, ' 迭代=', guard4)
