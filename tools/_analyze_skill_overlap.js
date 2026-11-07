/* 分析 1/2/3（event-card-framework / effect-recipes / atomic-operations）与 17/18 的重叠度 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const SK = path.join(os.homedir(), '.codebuddy', 'skills')
const PROJ = path.join(__dirname, '..', '.codebuddy', 'skills')
const find = n => [path.join(SK, n, 'SKILL.md'), path.join(PROJ, n, 'SKILL.md')].find(f => fs.existsSync(f))

const TARGETS = ['rtt-event-card-framework', 'rtt-effect-recipes', 'rtt-atomic-operations',
	'rtt-card-bug-repro', 'rtt-realboard-test']

const info = {}
for (const n of TARGETS) {
	const t = fs.readFileSync(find(n), 'utf8')
	const body = t.replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
	const heads = [...body.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(m => m[2].trim())
	const ids = new Set((body.match(/\b1[0-9]{4}\b/g) || []).map(String))
	info[n] = { heads, ids: [...ids], kb: +(Buffer.byteLength(body, 'utf8') / 1024).toFixed(1) }
}

const jac = (a, b) => {
	const A = new Set(a), B = new Set(b)
	const inter = [...A].filter(x => B.has(x)).length
	const uni = new Set([...A, ...B]).size
	return uni ? (inter / uni) : 0
}
const normHead = h => h.replace(/[（(].*?[）)]/g, '').replace(/^\d+[.、]\s*/, '').replace(/\s+/g, '').slice(0, 12)

console.log('=== 规模与结构 ===')
for (const n of TARGETS) {
	console.log(n.padEnd(30, ' ') + ' ' + String(info[n].kb).padStart(5) + ' KB  标题 ' +
		String(info[n].heads.length).padStart(2) + ' 个  提到卡 id ' + String(info[n].ids.length).padStart(3) + ' 个')
}

console.log('\n=== 卡 id 集合重叠（Jaccard）===')
const pairs = [['rtt-event-card-framework', 'rtt-effect-recipes'],
	['rtt-event-card-framework', 'rtt-atomic-operations'],
	['rtt-effect-recipes', 'rtt-atomic-operations'],
	['rtt-card-bug-repro', 'rtt-realboard-test']]
for (const [a, b] of pairs) {
	const A = info[a].ids, B = info[b].ids
	const inter = A.filter(x => B.includes(x))
	console.log(a.replace('rtt-', '') + ' ∩ ' + b.replace('rtt-', '') + ' = ' +
		inter.length + ' 个，Jaccard ' + jac(A, B).toFixed(2) + (inter.length ? '  例：' + inter.slice(0, 6).join(',') : ''))
}

console.log('\n=== 标题相似（归一后求交）===')
for (const [a, b] of pairs) {
	const A = info[a].heads.map(normHead), B = info[b].heads.map(normHead)
	const inter = A.filter(x => B.includes(x))
	console.log(a.replace('rtt-', '') + ' ∩ ' + b.replace('rtt-', '') + ' = ' + inter.length +
		(inter.length ? '：' + [...new Set(inter)].join('、') : ''))
}

console.log('\n=== 各自标题清单（判断职责边界）===')
for (const n of ['rtt-event-card-framework', 'rtt-effect-recipes', 'rtt-atomic-operations']) {
	console.log('\n--- ' + n + '（' + info[n].heads.length + ' 个标题）---')
	info[n].heads.forEach(h => console.log('   ' + h.slice(0, 70)))
}
