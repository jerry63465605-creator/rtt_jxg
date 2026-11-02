/* 列出「本地有、线上没有」的 play.js 顶层函数（带行号 + 就近注释摘要），按功能归类 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const on = fs.readFileSync(path.join(os.tmpdir(), 'on_play.js'), 'utf8')
const lo = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')

const fnSet = s => new Set([...s.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map(m => m[1]))
const onFns = fnSet(on)
const lines = lo.split('\n')
const rows = []
lines.forEach((l, i) => {
	const m = l.match(/^function ([A-Za-z0-9_]+)\(/)
	if (!m || onFns.has(m[1])) return
	/* 向上找最近的注释行作为摘要 */
	let doc = ''
	for (let k = i - 1; k >= Math.max(0, i - 6); k--) {
		const t = lines[k].trim()
		if (/^\/\*|^\*|^\/\//.test(t)) { doc = t.replace(/^\/\*+|\*+\/|^\*|^\/\/+/g, '').trim(); break }
		if (t === '') continue
		break
	}
	rows.push({ name: m[1], line: i + 1, doc })
})

const CAT = [
	['状态卡（STATUS）', /status|ts_|table_status/i],
	['响应选择 / 响应栈', /response/i],
	['事件卡分步 / 战斗预算', /event_budget|event_step|echo_need|space_id_of_name|event_/i],
	['专项弹窗（天王星/恩尼格玛/大清洗）', /uranus|enigma|17817|political/i],
	['其余（卡牌/手牌/日志/工具）', /./],
]
const used = new Set()
console.log('本地独有顶层函数共 ' + rows.length + ' 个\n')
for (const [title, re] of CAT) {
	const hit = rows.filter(r => !used.has(r.name) && re.test(r.name))
	if (!hit.length) continue
	hit.forEach(r => used.add(r.name))
	console.log('## ' + title + '（' + hit.length + '）')
	for (const r of hit) console.log('  L' + String(r.line).padStart(5) + '  ' + r.name.padEnd(30) + (r.doc ? '— ' + r.doc.slice(0, 60) : ''))
	console.log('')
}
const rest = rows.filter(r => !used.has(r.name))
if (rest.length) {
	console.log('## 未归类（' + rest.length + '）')
	for (const r of rest) console.log('  L' + String(r.line).padStart(5) + '  ' + r.name)
}
