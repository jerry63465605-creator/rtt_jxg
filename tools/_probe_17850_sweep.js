/*
 * 横扫：苏联用《大清洗》机会打出【每一张】手牌里的状态卡后，
 * 逐字段比对 Allies / Axis 两侧 view，找出"只该苏联阵营有、却漏给轴心"的窗口字段。
 *
 * 用法：node tools/_probe_17850_sweep.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

/* 关注"待玩家表态"的字段 */
const KEYS = [
	'su_purge_offer', 'su_17817_pending', 'pending_status_play', 'pending_echo',
	'pending_armed_use', 'armed_offer', 'pending_trigger', 'response_choice',
	'pending_battle', 'pending_econ', 'pending_script', 'status_instant',
	'pending_ask', 'ask_remove', 'delegate', 'uk_build_delegate', 'su_build_delegate',
	'us_china_build', 'us_theater_delegate', 'us_replay', 'us_merchant', 'us_political',
	'pending_event_step', 'pending_autobahn', 'pending_uranus', 'pending_red',
]
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

function fresh() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	return g
}

const base = fresh()
const statusCards = ((base.hands['苏联'] || [])).filter(x =>
	I.is_card_type(String(I.inst_card_id(x)), 'STATUS'))
console.log('苏联手牌状态卡 = ' + JSON.stringify(statusCards.map(x => x + ' ' + (I.inst_card_name(x) || ''))))

for (const card of statusCards) {
	const g = fresh()
	I.end_neutral(g, '苏联')
	I.refresh(g)
	const before = { a: nonEmpty(R.view(g, 'Allies')), x: nonEmpty(R.view(g, 'Axis')) }
	let n0 = (g.log || []).length
	R.action(g, 'Allies', 'su_purge_play', { card })
	I.refresh(g)
	const after = { a: nonEmpty(R.view(g, 'Allies')), x: nonEmpty(R.view(g, 'Axis')) }
	const log = (g.log || []).slice(n0).join(' | ')
	const leak = Object.keys(after.x).filter(k =>
		after.x[k] != null && (after.a[k] == null || JSON.stringify(after.a[k]) !== JSON.stringify(after.x[k])))
	console.log('\n■ ' + card + ' ' + (I.inst_card_name(card) || '') +
		'  → ' + log.slice(0, 100))
	console.log('   Allies-only? A=' + JSON.stringify(after.a) + '  X=' + JSON.stringify(after.x))
	console.log('   漏给轴心的窗口 = ' + (leak.length ? JSON.stringify(leak) : '无'))
	const axActs = Object.keys((R.view(g, 'Axis').actions) || {}).filter(k => /^su_|delegate|_play$/.test(k))
	const alActs = Object.keys((R.view(g, 'Allies').actions) || {}).filter(k => /^su_|delegate|_play$/.test(k))
	if (JSON.stringify(axActs) !== JSON.stringify(alActs))
		console.log('   actions 差异：A=' + JSON.stringify(alActs) + '  X=' + JSON.stringify(axActs))
}
