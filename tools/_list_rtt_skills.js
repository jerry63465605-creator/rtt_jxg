/* 列出所有 rtt-* skill：描述（=触发条件）+ 正文规模 + references 数量 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const DIRS = [
	{ scope: '用户级', dir: path.join(os.homedir(), '.codebuddy', 'skills') },
	{ scope: '项目级', dir: path.join(path.join(__dirname, '..'), '.codebuddy', 'skills') },
]

function descOf(fm) {
	const lines = fm.split(/\r?\n/)
	const i = lines.findIndex(l => /^description:/.test(l))
	if (i < 0) return ''
	const first = lines[i].replace(/^description:\s*/, '')
	if (/^[>|][+-]?\s*$/.test(first)) {
		const buf = []
		for (let j = i + 1; j < lines.length; j++) {
			if (/^[A-Za-z_]+:/.test(lines[j])) break
			buf.push(lines[j].trim())
		}
		return buf.join(' ').replace(/\s+/g, ' ').trim()
	}
	return first.replace(/^['"]|['"]$/g, '').trim()
}

const rows = []
for (const { scope, dir } of DIRS) {
	if (!fs.existsSync(dir)) continue
	for (const d of fs.readdirSync(dir)) {
		if (!/^rtt-/.test(d)) continue
		const f = path.join(dir, d, 'SKILL.md')
		if (!fs.existsSync(f)) continue
		const t = fs.readFileSync(f, 'utf8')
		const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/)
		const fm = m ? m[1] : ''
		const body = m ? t.slice(m[0].length) : t
		const refDir = path.join(dir, d, 'references')
		const refs = fs.existsSync(refDir) ? fs.readdirSync(refDir).length : 0
		rows.push({ name: d, scope, desc: descOf(fm), kb: +(Buffer.byteLength(body, 'utf8') / 1024).toFixed(1), refs })
	}
}
rows.sort((a, b) => a.name.localeCompare(b.name))
console.log('rtt-* skill 数 = ' + rows.length + '\n')
for (const r of rows) {
	console.log('### ' + r.name + '（' + r.scope + '，正文 ' + r.kb + ' KB' + (r.refs ? '，references ' + r.refs + ' 份' : '') + '）')
	console.log('触发：' + r.desc)
	console.log('')
}
