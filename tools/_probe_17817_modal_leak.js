/*
 * 复现《大清洗》弹窗漏给轴心：走 17817《进攻是最好的防守》路径（su_17817_pending 置位）。
 *
 * 客户端弹窗判据（play.js:8325）：view.su_17817_pending || view.actions.su_purge_play
 * 期望：轴心两侧都应为 false / 无 su_purge_play。
 *
 * 用法：node tools/_probe_17817_modal_leak.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

/* 找一对「苏联陆军格」+「相邻可放德国陆军的空地」 */
const probeG = R.setup(7)
probeG.opening = null
I.refresh(probeG)
const land = s => d.spaces[s] && d.spaces[s].terrain !== 'sea'
const soviets = Object.keys(d.spaces).map(Number).filter(s => land(s) && /莫斯科|乌克兰|白俄罗斯|基辅|列宁格勒|斯大林格勒/.test(d.name_of(s) || ''))
let plan = null
for (const sov of soviets) {
	for (const nb of I.get_connections(probeG, sov, 'axis')) {
		if (!land(nb)) continue
		const pieces = Object.keys(probeG.location).filter(p => probeG.location[p] === nb)
		if (pieces.length) continue
		plan = { sov, de: nb }
		break
	}
	if (plan) break
}
console.log('计划：苏联陆军@' + (plan && d.name_of(plan.sov)) + '，德国陆军@' + (plan && d.name_of(plan.de)))
if (!plan) { console.log('没找到合适相邻对'); process.exit(1) }

const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Allies', 'debug_place', { piece: 'su_def', nation: '苏联', type: 'army', space: plan.sov })
R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: plan.de })
R.action(g, 'Allies', 'debug_add_card', { face: '17817', nation: '苏联', dest: 'hand' })
R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
I.refresh(g)
console.log('苏联中立 = ' + JSON.stringify((g.neutral || {})['苏联']) + '  桌面 = ' + JSON.stringify((g.table['苏联'] || []).map(faceOf)))

const card = (g.hands['苏联'] || []).find(x => faceOf(x) === '17817')
console.log('17817 在手 = ' + !!card)
let n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', { card })
console.log('play log: ' + logSince(g, n0))
console.log('su_17817_pending = ' + JSON.stringify(g.su_17817_pending) + '  su_purge_offer = ' + JSON.stringify(g.su_purge_offer))

const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
const suActs = v => Object.keys(v.actions || {}).filter(k => /^su_/.test(k))
console.log('\n=== 客户端弹窗判据对比 ===')
console.log('  Allies: su_17817_pending=' + JSON.stringify(vA.su_17817_pending) +
	'  su_purge_offer=' + JSON.stringify(vA.su_purge_offer) +
	'  actions=' + JSON.stringify(suActs(vA)))
console.log('  Axis  : su_17817_pending=' + JSON.stringify(vX.su_17817_pending) +
	'  su_purge_offer=' + JSON.stringify(vX.su_purge_offer) +
	'  actions=' + JSON.stringify(suActs(vX)))
console.log('\n  期望：Axis 三项都应为 false / []；若 su_17817_pending=true，轴心会看到《大清洗》弹窗 = bug')
