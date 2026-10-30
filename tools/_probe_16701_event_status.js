/*
 * 真实模拟排查：16701《意大利万岁》生效期间，事件卡 / 状态卡 到底能不能打出？
 *
 * 上一版检查的 E 段用【面 id 字符串】调 check_play_phase（该函数要卡对象），
 * 导致 is_timing_card 恒 false -> 全部被判"只能打基本卡"，是【测试假阳性】。
 * 这里改为：
 *   ① 用卡【对象】调 check_phase_for_card（线上真实入口）
 *   ② 真的 play_card 一张张试，打印服务端日志（最可信）
 *
 * 用法：node tools/_probe_16701_event_status.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const C = require(path.join(MOD, 'cards.js'))
const faceOf = x => String(x).split('#')[0]

const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'it_a', nation: '意大利', type: 'army', space: d.id_of('意大利') })
R.action(g, 'Axis', 'debug_add_card', { face: '16701', nation: '意大利', dest: 'hand' })
I.refresh(g)

const viva = (g.hands['意大利'] || []).find(x => faceOf(x) === '16701')
R.action(g, 'Axis', 'play_card', { card: viva })
console.log('=== 阶段1：打出 16701 ===')
console.log('it_viva=' + g.it_viva + '  used=' + g.it_viva_used +
	'  play_done=' + JSON.stringify(g.play_done || {}))

/* 收集意大利的 EVENT / STATUS / ECON 样本（每类 3 张） */
const pick = (type, n = 3) => Object.values(C.CARD_BY_ID)
	.filter(c => c.nation === '意大利' && c.type === type)
	.slice(0, n).map(c => String(c.id))

console.log('\n=== 阶段2：check_phase_for_card（传卡对象，线上真实入口）===')
for (const type of ['EVENT', 'STATUS', 'ECON', 'EFFECT', 'BASIC']) {
	for (const face of pick(type, 3)) {
		const obj = C.CARD_BY_ID[face]
		const r = I.check_phase_for_card(g, '意大利', obj, {})
		console.log('  ' + type.padEnd(7) + ' ' + face + ' ' + String(obj.name).padEnd(12) +
			' -> ' + JSON.stringify(r))
	}
}

console.log('\n=== 阶段3：真的 play_card 试打（每类 1 张）===')
const tries = []
;['EVENT', 'STATUS', 'ECON', 'EFFECT'].forEach(t => {
	const f = pick(t, 1)[0]
	if (f) tries.push(f)
})
for (const face of tries) {
	R.action(g, 'Axis', 'debug_add_card', { face: face, nation: '意大利', dest: 'hand' })
	I.refresh(g)
}
for (const face of tries) {
	const inst = (g.hands['意大利'] || []).find(x => faceOf(x) === face)
	if (!inst) { console.log('  ' + face + ' 未入手，跳过'); continue }
	const n0 = (g.log || []).length
	/* 尽量带上常见参数，避免"缺参数"与"限制"混为一谈 */
	R.action(g, 'Axis', 'play_card', { card: inst, target: '英国', space: 1, choice: 0 })
	const lg = (g.log || []).slice(n0).join(' | ')
	const okPlayed = !/无法打出|不能主动打出|只能打出\[基本卡\]/.test(lg)
	console.log('  ' + face + ' ' + String((C.CARD_BY_ID[face] || {}).name).padEnd(12) +
		' 打出=' + (okPlayed ? 'YES' : 'NO') + '  log=' + lg)
}

console.log('\n=== 阶段4：限制期内 增强卡 是否放行（对照）===')
{
	const g2 = R.setup(7)
	g2.opening = null
	I.refresh(g2)
	R.action(g2, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	R.action(g2, 'Axis', 'debug_add_card', { face: '16701', nation: '意大利', dest: 'hand' })
	R.action(g2, 'Axis', 'debug_add_card', { face: '17706', nation: '意大利', dest: 'hand' })
	I.refresh(g2)
	const v2 = (g2.hands['意大利'] || []).find(x => faceOf(x) === '16701')
	R.action(g2, 'Axis', 'play_card', { card: v2 })
	const ef = (g2.hands['意大利'] || []).find(x => faceOf(x) === '17706')
	const cp = I.check_phase_for_card(g2, '意大利', C.CARD_BY_ID['17706'], { card: ef })
	console.log('  增强卡 check_phase_for_card=' + JSON.stringify(cp))
	const n0 = (g2.log || []).length
	R.action(g2, 'Axis', 'play_card', { card: ef })
	console.log('  增强卡 play_card log=' + (g2.log || []).slice(n0).join(' | '))
}
