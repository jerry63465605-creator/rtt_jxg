/*
 * 探查：苏联结束中立拿到《大清洗》状态卡出牌机会后，**轴心侧**是否也能看到窗口（应为仅苏联可见）。
 *
 * 用法：node tools/_probe_17850_purge_axis_window.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

/* 只列出"看起来像窗口/待决"的字段，避免整份 view 打印 */
const WINDOW_KEYS = [
	'pending_status_play', 'pending_echo', 'pending_armed_use', 'armed_offer', 'armed_offers',
	'pending_trigger', 'response_choice', 'pending_battle', 'pending_econ', 'pending_script',
	'su_purge_offer', 'pending_ask', 'ask_remove', 'delegate', 'status_instant',
	'uk_build_delegate', 'su_build_delegate', 'us_china_build', 'pending_event_step',
]
function win(v) {
	const o = {}
	for (const k of WINDOW_KEYS) {
		const val = v[k]
		if (val == null) continue
		if (val === false || val === 0) continue
		if (Array.isArray(val) && !val.length) continue
		o[k] = typeof val === 'object' ? JSON.parse(JSON.stringify(val)) : val
	}
	return o
}

const g = R.setup(7)
g.opening = null
I.refresh(g)
console.log('=== 初始 ===')
console.log('  苏联中立 = ' + JSON.stringify((g.neutral || {})['苏联'] || null))
console.log('  苏联桌面 = ' + JSON.stringify((g.table['苏联'] || []).map(faceOf)))
console.log('  苏联手牌状态卡 = ' + JSON.stringify(((g.hands['苏联'] || [])).map(x =>
	faceOf(x) + (I.is_card_type(String(I.inst_card_id(x)), 'STATUS') ? '(STATUS)' : ''))))

/* 让苏联结束中立（走原子，不手改状态） */
let n0 = (g.log || []).length
I.end_neutral(g, '苏联')
I.refresh(g)
console.log('\n=== 苏联结束中立 ===')
console.log('  log: ' + logSince(g, n0))
console.log('  su_purge_offer = ' + JSON.stringify(g.su_purge_offer))
console.log('  pending_status_play = ' + JSON.stringify(g.pending_status_play))

const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
console.log('\n=== view 窗口对比（苏联结束中立后，尚未出牌）===')
console.log('  Allies : ' + JSON.stringify(win(vA)))
console.log('  Axis   : ' + JSON.stringify(win(vX)))
{
	const suActs = v => Object.keys(v.actions || {}).filter(k => /^su_/.test(k))
	console.log('  Allies.actions(su_*) = ' + JSON.stringify(suActs(vA)))
	console.log('  Axis.actions(su_*)   = ' + JSON.stringify(suActs(vX)) +
		'   ← 客户端大清洗弹窗判据 = su_17817_pending || actions.su_purge_play')
	console.log('  Allies.su_17817_pending = ' + JSON.stringify(vA.su_17817_pending))
	console.log('  Axis.su_17817_pending   = ' + JSON.stringify(vX.su_17817_pending))
}

/* 苏联打出状态卡（大清洗给的一次性机会） */
const st = ((g.hands['苏联'] || [])).find(x => I.is_card_type(String(I.inst_card_id(x)), 'STATUS'))
console.log('\n=== 苏联用大清洗机会打出状态卡 ===')
console.log('  选中的状态卡 = ' + (st ? st + ' ' + (I.inst_card_name(st) || '') : '(手上没有状态卡)'))
if (st) {
	n0 = (g.log || []).length
	R.action(g, 'Allies', 'su_purge_play', { card: st })
	console.log('  log: ' + logSince(g, n0))
	console.log('  pending_status_play = ' + JSON.stringify(g.pending_status_play))
	console.log('  pending_echo = ' + JSON.stringify(g.pending_echo))
	const a2 = R.view(g, 'Allies'), x2 = R.view(g, 'Axis')
	console.log('\n=== 出牌后 view 窗口对比 ===')
	console.log('  Allies : ' + JSON.stringify(win(a2)))
	console.log('  Axis   : ' + JSON.stringify(win(x2)))
	const suActs = v => Object.keys(v.actions || {}).filter(k => /^su_/.test(k))
	console.log('  Allies.actions(su_*) = ' + JSON.stringify(suActs(a2)))
	console.log('  Axis.actions(su_*)   = ' + JSON.stringify(suActs(x2)))
	console.log('  Allies.top_text = ' + JSON.stringify((a2.status_bar || {}).text || a2.top_text))
	console.log('  Axis.top_text   = ' + JSON.stringify((x2.status_bar || {}).text || x2.top_text))
}
