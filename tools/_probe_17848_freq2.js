/*
 * 探查 v2：直接武装 after_land 窗口，连点两次 activate_status，看"一回合一次"是否真的挡住。
 * 用法：node tools/_probe_17848_freq2.js
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
R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })

/* 苏联桌面放 17848（走真实 play_card） */
R.action(g, 'Allies', 'debug_add_card', { face: '17848', nation: '苏联', dest: 'hand' })
I.refresh(g)
{
	const c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17848')
	R.action(g, 'Allies', 'play_card', { card: c })
}
const inst = (g.table['苏联'] || []).find(x => faceOf(x) === '17848')
console.log('17848 实例 = ' + inst + '  桌面 = ' + JSON.stringify((g.table['苏联'] || []).map(faceOf)))

/* 苏联陆军@罗斯 + 德国陆军@北欧（可打） */
const su = Object.keys(d.spaces).map(Number).find(s => /罗斯/.test(d.name_of(s)))
const nb = I.get_connections(g, su, 'allies').find(s => d.spaces[s] && d.spaces[s].terrain !== 'sea')
R.action(g, 'Allies', 'debug_place', { piece: 'su_atk', nation: '苏联', type: 'army', space: su })
R.action(g, 'Axis', 'debug_place', { piece: 'de_def', nation: '德国', type: 'army', space: nb })
/* 手里备 2 张代价牌 */
for (const f of ['17800', '17801']) R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '苏联', dest: 'hand' })
I.refresh(g)

console.log('\n=== 手动武装 after_land 窗口 ===')
I.arm_status_instant(g, 'after_land', '苏联', nb)
I.refresh(g)
console.log('  status_instant = ' + JSON.stringify((g.status_instant || []).map(e => ({
	card: e.card_id, window: e.window, space: e.space,
}))))

function useOnce(tag) {
	const pay = (g.hands['苏联'] || []).slice(0, 2)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: inst, discard: pay })
	console.log('  [' + tag + '] log: ' + logSince(g, n0))
	console.log('    status_used=' + JSON.stringify(g.status_used || {}) +
		'  turn/current=' + g.turn + '/' + g.current_nation +
		'  status_instant=' + JSON.stringify((g.status_instant || []).map(e => e.card_id)))
}
useOnce('第一次')

console.log('\n=== 同一回合再武装一次（模拟"再次发起陆战后）===')
I.arm_status_instant(g, 'after_land', '苏联', nb)
I.refresh(g)
console.log('  重新武装后 status_instant=' + JSON.stringify((g.status_instant || []).map(e => e.card_id)))
useOnce('第二次')

console.log('\n=== view 侧展示 ===')
const v = R.view(g, 'Allies')
console.log('  table_status(17848) = ' + JSON.stringify(
	(v.table_status || []).filter(t => faceOf(t.card) === '17848')
		.map(t => ({ ready: t.ready, used: t.used, used_this_turn: t.used_this_turn }))))
console.log('  status_instant = ' + JSON.stringify((v.status_instant || []).map(e => e.card_id || e.card)))
