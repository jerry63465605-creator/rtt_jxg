/*
 * 审计：所有 "piece_removed" 类触发（状态卡 / 增强卡 / 响应卡）用的是哪种"条件过滤范式"。
 * 目的：确认有没有统一的 ready/filter 范式可以直接套用到 17543。
 *
 * 用法：node tools/_audit_piece_removed_paradigm.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const faceOf = x => String(x).split('#')[0]
const nm = f => ((C.CARD_BY_ID[f] || {}).name || f) + '(' + f + ')'

const TABLES = ['STATUS_EFFECTS', 'ECHO_EFFECTS', 'RESPONSE_EFFECTS', 'EVENT_EFFECTS']
const found = { STATUS: [], ECHO: [], RESPONSE: [], EVENT: [] }

for (const tn of TABLES) {
	const tbl = I[tn] || {}
	const key = tn.replace('_EFFECTS', '')
	for (const [f, cfg] of Object.entries(tbl)) {
		const trig = cfg && (cfg.trigger || (cfg.armed && cfg.armed.trigger))
		const win = trig && trig.window
		const on = trig && trig.on
		const armedWhen = cfg && cfg.armed && cfg.armed.when
		const hit = win === 'piece_removed' || on === 'piece_removed' || armedWhen === 'piece_removed'
		if (!hit) continue
		found[key].push({
			face: f,
			name: nm(f),
			window: win || armedWhen || on,
			keys: Object.keys(trig || (cfg.armed || {}) || {}),
			hasReady: !!(trig && trig.ready) || !!(cfg.armed && cfg.armed.ready),
			hasFilter: !!(trig && trig.filter) || !!(cfg.armed && cfg.armed.filter),
			readyArity: (trig && trig.ready && trig.ready.length) || (cfg.armed && cfg.armed.ready && cfg.armed.ready.length) || 0,
		})
	}
}

for (const k of Object.keys(found)) {
	if (!found[k].length) continue
	console.log('\n=== ' + k + ' 表（' + found[k].length + ' 项）===')
	for (const r of found[k]) {
		console.log('  ' + r.name + '  window=' + r.window +
			'  ready=' + (r.hasReady ? '✓(arity ' + r.readyArity + ')' : '✗') +
			'  filter=' + (r.hasFilter ? '✓' : '✗') +
			'  keys=' + JSON.stringify(r.keys))
	}
}

/* 顺带看 status_window_ready 是否调用 trigger.ready、arm_status_instant 是否调用 */
const fs = require('fs')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const seg = (name, from) => {
	const i = src.indexOf(name, from)
	return i < 0 ? '' : src.slice(i, i + 200)
}
console.log('\n=== 机制现状 ===')
console.log('  status_window_ready 里出现 trig.ready? ' + /function status_window_ready[\s\S]{0,4000}?tr\.ready/.test(src))
console.log('  arm_status_instant 里出现 ready 调用? ' +
	/function arm_status_instant[\s\S]{0,3000}?\.ready\s*\(/.test(src))
console.log('  存在 status_window_ready 的 ready 兜底调用点: ')
{
	const re = /status_window_ready\(/g
	let m, n = 0
	while ((m = re.exec(src)) && n < 8) {
		const line = src.slice(0, m.index).split('\n').length
		console.log('    L' + line + ': ' + src.slice(m.index, m.index + 90).split('\n')[0])
		n++
	}
}
