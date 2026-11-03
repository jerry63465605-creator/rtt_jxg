/*
 * 15209《伞兵》：用真实动作触发，看服务端下发哪些窗口字段
 * （客户端按这些字段渲染；多出来的那个"固定在左上角的 UI"必然对应其中某个字段）
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(7)
g.opening = null
I.refresh(g)

/* 德国出牌阶段开始：德国陆军+空军@德国；15209 在德国手牌 */
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
let c = (g.hands['德国'] || []).find(x => faceOf(x) === '15209')
if (!c) {
	R.action(g, 'Axis', 'debug_add_card', { face: '15209', nation: '德国', dest: 'hand' })
	I.refresh(g)
	c = (g.hands['德国'] || []).find(x => faceOf(x) === '15209')
}
console.log('15209 实例 = ' + c)

/* 触发 play_start 机会窗口（真实动作：走阶段推进/或直接派发 armed offer 的事件） */
const n0 = (g.log || []).length
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'air' })
I.refresh(g)
console.log('切阶段 log: ' + logSince(g, n0))

const win = {}
for (const k of Object.keys(g)) {
	if (/^pending_|^armed_offers$|^event_budget$|^last_piece_removed$|^response_stack$/.test(k)) {
		const v = g[k]
		if (v == null) continue
		if (Array.isArray(v) && !v.length) continue
		win[k] = Array.isArray(v) ? 'array(' + v.length + ')' : typeof v === 'object' ? Object.keys(v).slice(0, 8) : v
	}
}
console.log('\n=== game 上的挂起字段 ===')
console.log(JSON.stringify(win, null, 1))

const v = R.view(g, 'Axis')
const vw = {}
for (const k of Object.keys(v)) {
	const val = v[k]
	if (val == null) continue
	if (Array.isArray(val) && !val.length) continue
	if (/pending|armed_offer|event_budget|ask|choice|budget|status_instant|response/i.test(k)) vw[k] = val
}
console.log('\n=== view(Axis) 里的窗口类字段 ===')
console.log(JSON.stringify(vw, null, 1).slice(0, 2000))
