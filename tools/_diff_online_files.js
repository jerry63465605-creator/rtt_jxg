/*
 * 逐文件 diff 摘要：tmp/online/*（线上抓下来的） vs 本地模块目录
 * 输出：行数、增删行数、各文件"新增/删除"的前若干行样例（带行号）
 *
 * 用法：node tools/_diff_online_files.js [rules.js play.js]
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const ON = path.join(__dirname, '..', 'tmp', 'online')

const files = process.argv.slice(2).length ? process.argv.slice(2)
	: ['play.html', 'play.css', 'play.js', 'rules.js']

/* 逐行 diff（简版 LCS：按块对齐，够看"增删了什么"） */
function diffLines(a, b) {
	const setA = new Map(), setB = new Map()
	a.forEach((l, i) => { const k = l; if (!setA.has(k)) setA.set(k, []) ; setA.get(k).push(i) })
	b.forEach((l, i) => { const k = l; if (!setB.has(k)) setB.set(k, []) ; setB.get(k).push(i) })
	const removed = [], added = []
	for (const [k, idxs] of setA) {
		const n = (setB.get(k) || []).length
		if (idxs.length > n) removed.push(k)
	}
	for (const [k, idxs] of setB) {
		const n = (setA.get(k) || []).length
		if (idxs.length > n) added.push(k)
	}
	return { added, removed }
}

for (const f of files) {
	const onP = path.join(ON, f), loP = path.join(MOD, f)
	if (!fs.existsSync(onP)) { console.log('\n' + f + '：线上未抓取'); continue }
	const on = fs.readFileSync(onP, 'utf8').split('\n')
	const lo = fs.readFileSync(loP, 'utf8').split('\n')
	const same = on.join('\n') === lo.join('\n')
	console.log('\n=== ' + f + ' ===  线上 ' + on.length + ' 行 / 本地 ' + lo.length + ' 行' + (same ? '  ✅ 完全一致' : ''))
	if (same) continue
	const { added, removed } = diffLines(on, lo)
	console.log('  仅线上有的行：' + added.length + '  仅本地有的行：' + removed.length)
	const show = arr => arr.filter(s => s.trim()).slice(0, 8).forEach(s => console.log('    ' + s.trim().slice(0, 120)))
	if (added.length) { console.log('  —— 线上新增（样例）:'); show(added) }
	if (removed.length) { console.log('  —— 线上缺失/本地新增（样例）:'); show(removed) }
}
