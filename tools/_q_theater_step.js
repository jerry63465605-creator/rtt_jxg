/* 排查 #4：分步机（pending_theater 等）中间为什么不派发状态卡窗口 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

/* 17532 战区移动 与 17550 先进造船厂 的配置 */
for (const id of ['17532', '17550']) {
	const c = C.CARD_BY_ID[id] || {}
	console.log('\n===== ' + id + ' ' + (c.name || '?') + ' [' + c.type + '·' + c.nation + '] =====')
	console.log('  卡面: ' + String(c.text || ''))
	const ee = (I.ECHO_EFFECTS || {})[id]
	if (ee) console.log('  ECHO keys=' + Object.keys(ee).join(',') +
		(ee.armed ? '  armed.when=' + (Array.isArray(ee.armed.when) ? ee.armed.when.join('/') : ee.armed.when) : ''))
	const se = (I.STATUS_EFFECTS || {})[id]
	if (se) console.log('  STATUS keys=' + JSON.stringify(Object.keys(se)) +
		'  trigger=' + JSON.stringify(se.trigger && { window: se.trigger.window, cost: se.trigger.cost }))
}

console.log('\n=== pending_theater 相关行 ===')
t.forEach((l, i) => { if (l.indexOf('pending_theater') >= 0) console.log((i + 1) + ': ' + l.trim().slice(0, 130)) })

console.log('\n=== 状态窗口派发点（status_instant / offer_status / maybe_status） ===')
t.forEach((l, i) => {
	if (/status_instant|offer_status|maybe_offer_status|status_window_ready/.test(l) && /function |push\(|offer/.test(l))
		console.log((i + 1) + ': ' + l.trim().slice(0, 130))
})
