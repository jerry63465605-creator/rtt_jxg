/*
 * 另一条参战路径：苏联【被轴心攻击】而结束中立（此时大清洗只给"跳过"，没有 17817 待结算）。
 * 比对 Allies / Axis 两侧 view 的"待表态"字段与 actions，检查是否又把苏联专属窗口漏给轴心。
 *
 * 用法：node tools/_probe_17850_attack_path.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const KEYS = ['su_purge_offer', 'su_17817_pending', 'pending_status_play', 'pending_echo',
	'pending_armed_use', 'armed_offer', 'pending_trigger', 'response_choice', 'pending_battle',
	'status_instant', 'pending_ask', 'delegate', 'pending_event_step']
const nonEmpty = v => {
	const o = {}
	for (const k of KEYS) {
		const val = v[k]
		if (val == null || val === false || val === 0) continue
		if (Array.isArray(val) && !val.length) continue
		o[k] = typeof val === 'object' ? JSON.parse(JSON.stringify(val)) : val
	}
	return o
}

/* 找一对"德国 → 苏联"相邻格，把苏联陆军放上去 */
const g0 = R.setup(7)
g0.opening = null
I.refresh(g0)
const sovietSpaces = Object.keys(d.spaces).map(Number).filter(s => {
	const nm = d.name_of(s)
	return /苏联|乌克兰|白俄罗斯|莫斯科|列宁格勒|斯大林格勒|高加索|西伯利亚|中亚|远东/.test(nm || '')
})
let pair = null
for (const s of sovietSpaces) {
	for (const nb of I.get_connections(g0, s, 'axis')) {
		if (nb === d.id_of('德国')) { pair = { target: s, from: nb }; break }
	}
	if (pair) break
}
console.log('相邻对（德国 -> 苏联） = ' + JSON.stringify(pair && { from: d.name_of(pair.from), target: d.name_of(pair.target) }))
if (!pair) { console.log('没找到相邻对，改用 东欧/乌克兰 手工确认'); process.exit(1) }

const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
R.action(g, 'Allies', 'debug_place', { piece: 'su_def', nation: '苏联', type: 'army', space: pair.target })
R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
I.refresh(g)

console.log('攻击前 苏联中立 = ' + JSON.stringify((g.neutral || {})['苏联']))
let n0 = (g.log || []).length
const card = (g.hands['德国'] || []).find(x => faceOf(x) === '15201')
const atk = Object.keys(g.location).find(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === pair.from)
R.action(g, 'Axis', 'play_card', { card, space: pair.target, piece: 'su_def', from: atk })
console.log('攻击 log: ' + logSince(g, n0))
console.log('攻击后 苏联中立 = ' + JSON.stringify((g.neutral || {})['苏联']) + '  su_purge_offer = ' + JSON.stringify(g.su_purge_offer))

const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
console.log('\n=== 参战后 view ===')
console.log('  Allies : ' + JSON.stringify(nonEmpty(vA)))
console.log('  Axis   : ' + JSON.stringify(nonEmpty(vX)))
console.log('  Allies.actions(su_*) = ' + JSON.stringify(Object.keys(vA.actions || {}).filter(k => /^su_/.test(k))))
console.log('  Axis.actions(su_*)   = ' + JSON.stringify(Object.keys(vX.actions || {}).filter(k => /^su_/.test(k))))
console.log('  pending_battle: A=' + JSON.stringify(vA.pending_battle && vA.pending_battle.stage) +
	'  X=' + JSON.stringify(vX.pending_battle && vX.pending_battle.stage))
