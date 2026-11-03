/*
 * 静态审计：view 里各个「待表态/挂起」字段，构造时是否带阵营（side / faction_of_nation）判定。
 * 目的：找出"窗口/手牌对双方可见"的字段。
 *
 * 用法：node tools/_audit_view_side_guard.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const lines = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

const KEYS = [
	'hands', 'pending_battle', 'pending_trigger', 'response_choice', 'response_stack',
	'response_pending', 'armed_offer', 'pending_status_play', 'pending_econ', 'pending_red',
	'pending_event_step', 'event_budget', 'pending_echo', 'delegate', 'it_delegate',
	'uk_build_delegate', 'su_build_delegate', 'us_theater_delegate', 'us_china_build',
	'pending_autobahn', 'pending_uranus', 'us_political', 'su_purge_offer',
	'su_17817_pending', 'us_depression_offer', 'status_instant', 'table_responses_opponent',
]

const GUARD = /side\b|faction_of_nation|my_nation/
const rows = []
for (const k of KEYS) {
	/* 找 view 对象字面量里的 `k:`（行首缩进 + 键名 + 冒号） */
	let idx = -1
	for (let i = 0; i < lines.length; i++) {
		const t = lines[i].trim()
		if (t.startsWith(k + ':')) { idx = i; break }
	}
	if (idx < 0) { rows.push({ k, line: null, guard: null }); continue }
	/* 取该字段表达式（含向后 12 行）判断是否出现阵营判定 */
	const seg = lines.slice(idx, idx + 14).join('\n')
	rows.push({ k, line: idx + 1, guard: GUARD.test(seg), seg: lines[idx].trim().slice(0, 70) })
}

console.log('字段'.padEnd(26) + '行号     阵营判定')
for (const r of rows) {
	console.log(
		r.k.padEnd(26) +
		String(r.line == null ? '—' : 'L' + r.line).padEnd(9) +
		(r.line == null ? '（view 里没有这个字段）' : (r.guard ? '✅ 有' : '❌ 未见')))
}

console.log('\n注意：`hands` 的判定在上一行的 `_costNat` 上（见 rules.js ~25260），')
console.log('      即使本行出现 side，也要看 _costNat 属于哪一方 —— 这是当前确认泄漏点。')
