/* 线上 vs 本地 结构差异速查：行数 + 独有 id / 独有函数名 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const T = os.tmpdir()
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rd = p => { try { return fs.readFileSync(p, 'utf8') } catch (e) { return '' } }

const pairs = [
	{ k: 'play.html', on: rd(path.join(T, 'on_play.html')), lo: rd(path.join(MOD, 'play.html')) },
	{ k: 'play.js', on: rd(path.join(T, 'on_play.js')), lo: rd(path.join(MOD, 'play.js')) },
	{ k: 'rules.js', on: rd(path.join(T, 'on_rules.js')), lo: rd(path.join(MOD, 'rules.js')) },
]

for (const p of pairs) {
	if (!p.on) { console.log(p.k + '：线上文件缺失'); continue }
	const lo = p.lo.split('\n').length, on = p.on.split('\n').length
	console.log('\n=== ' + p.k + ' ===  线上 ' + on + ' 行 / 本地 ' + lo + ' 行')
	if (p.k === 'play.html') {
		const ids = s => new Set([...s.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m => m[1]))
		const a = ids(p.on), b = ids(p.lo)
		const onlyOn = [...a].filter(x => !b.has(x))
		const onlyLo = [...b].filter(x => !a.has(x))
		console.log('  线上独有 id(' + onlyOn.length + '): ' + JSON.stringify(onlyOn.slice(0, 20)))
		console.log('  本地独有 id(' + onlyLo.length + '): ' + JSON.stringify(onlyLo.slice(0, 20)))
	} else {
		const fns = s => new Set([...s.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map(m => m[1]))
		const a = fns(p.on), b = fns(p.lo)
		const onlyOn = [...a].filter(x => !b.has(x))
		const onlyLo = [...b].filter(x => !a.has(x))
		console.log('  线上独有函数(' + onlyOn.length + '): ' + JSON.stringify(onlyOn.slice(0, 20)))
		console.log('  本地独有函数(' + onlyLo.length + '): ' + JSON.stringify(onlyLo.slice(0, 25)))
	}
}
