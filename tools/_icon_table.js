const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const arr = C.CARDS || []

const txt = fs.readFileSync(path.join(__dirname, '..', 'out', 'icons.txt'), 'utf8')
const grids = {}
let cur = null
for (const raw of txt.split(/\r?\n/)) {
	const m = /^==\s+(\S+\.png)\s+\(/.exec(raw)
	if (m) { cur = m[1]; grids[cur] = []; continue }
	if (cur && /^\s+[.#+\-]{6}$/.test(raw)) grids[cur].push(raw.trim())
	if (cur && grids[cur].length >= 8) cur = null
}
function sig(rows) {
	const r = rows.slice()
	while (r.length && /^\.+$/.test(r[0])) r.shift()
	while (r.length && /^\.+$/.test(r[r.length - 1])) r.pop()
	return r.join('/')
}

/* icon signature -> label（依据 docs/card-icons.md 的用户确认映射 + 像素形状） */
const LABEL = {
	'..-+-./..#-#./..-.#./...#-./...+../...+../...-..': '? 响应 RESPONSE',
	'...+../...#../...#../...#../....../...#..': '! 事件 EVENT',
	'...+../...#../...#../...#../....../-+.#.+/+#+.##': '! 事件 EVENT',
	'...+../..+#+./.+###-/.-.#--/...#../...#..': '↑ 增强 ECHO',
	'...+../..+#+./.+###-/.--#--/...#../...#..': '↑ 增强 ECHO',
	'...--./..+##+/.+###./.###-.': '兵器 经济战 ECON',
}
const STATUS_SIGS = [
	'...+../..+#+./.-#-#-/..+#+./.-#.#-/---.-./#+..-.',
	'...+../..+#+./.-#-#-/..+#+./.-#.#-/..-.-.',
	'...+../..+#+./.-#+#-/..+#+./.-#.#-/-+-.-./#+..-.',
	'...+../..+#+./.-#+#-/..+#+./.-#.#-/..-.-.',
]
STATUS_SIGS.forEach(s => { LABEL[s] = '⇈ 状态 STATUS' })

console.log('id     | name                 | 声明type  | 图标识别            | 一致?')
console.log('-------|----------------------|-----------|---------------------|------')
const rows = []
for (const c of arr) {
	const img = path.basename(c.img || '')
	const g = grids[img]
	const s = g ? sig(g) : ''
	let lab = LABEL[s]
	if (!lab) {
		if (!s) lab = '(无图标)'
		else if (/-#-#-|-#+#-/.test(s)) lab = '⇈ 状态 STATUS'
		else lab = '未知: ' + s.slice(0, 30)
	}
	const declared = c.type
	let okk = '?'
	if (lab.indexOf('RESPONSE') >= 0) okk = declared === 'RESPONSE' ? '✓' : '✗ 应为RESPONSE'
	else if (lab.indexOf('EVENT') >= 0) okk = declared === 'EVENT' ? '✓' : '✗ 应为EVENT'
	else if (lab.indexOf('ECHO') >= 0) okk = declared === 'ECHO' ? '✓' : '✗ 应为ECHO'
	else if (lab.indexOf('STATUS') >= 0) okk = declared === 'STATUS' ? '✓' : '✗ 应为STATUS'
	else if (lab.indexOf('ECON') >= 0) okk = declared === 'ECON' ? '✓' : '✗ 应为ECON'
	else if (lab.indexOf('无图标') >= 0) okk = declared === 'BASIC' ? '✓' : '? BASIC?'
	rows.push([c.id, c.name, declared, lab, okk])
}
rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
for (const r of rows) {
	console.log(String(r[0]).padEnd(6) + '| ' + String(r[1]).padEnd(20) + ' | ' +
		String(r[2]).padEnd(9) + ' | ' + String(r[3]).padEnd(20) + ' | ' + r[4])
}

console.log('\n=== 不一致清单 ===')
rows.filter(r => r[4].indexOf('✗') >= 0 || r[4] === '? BASIC?').forEach(r => {
	console.log('  ' + r[0] + ' ' + r[1] + ' : 声明=' + r[2] + ' 图标=' + r[3] + ' -> ' + r[4])
})
