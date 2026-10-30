// 复现 17732 德国军事顾问 play_start 弹窗不出现
const { rules, I, ROLE, setupRepro, setTableResponse } = require('./rtt_repro.js')

const g = setupRepro({ nation: '意大利', active: 'Axis', phase: 'play' })
setTableResponse(g, '17732', 'axis') // 意大利暗置德国军事顾问（小写 axis）

console.log('[before] respQ=', (g.response_queue || []).length, 'table_responses=', JSON.stringify(g.table_responses))

// 触发意大利出牌阶段开始（play_start 时点）
I.run_phase_entry(g, 'play', '意大利')

console.log('[after] respQ=', (g.response_queue || []).length)
console.log('[after] active=', g.active)
console.log('[after] respQ detail=', JSON.stringify(g.response_queue, null, 2))

const v = rules.view(g, ROLE.AXIS)
console.log('[view] pending_trigger=', JSON.stringify(v.pending_trigger))

if (g.response_queue && g.response_queue.length) {
	console.log('>>> 17732 已入队，弹窗应当出现')
} else {
	console.log('>>> 17732 未入队，弹窗不会出现。定位过滤点：')
	// 手动跑 fire_trigger 看候选
	const ft = I.fire_trigger ? I.fire_trigger(g, 'play_start', { nation: '意大利' }) : 'no-expose'
	console.log('    fire_trigger=', JSON.stringify(ft))
}
