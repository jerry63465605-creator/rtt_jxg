/* 线上 play.js / play.css / rules.js 与本地逐项对比：行数、函数集合、关键差异 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const ON = path.join(ROOT, 'tmp', 'online_now')
const norm = s => s.replace(/\r\n/g, '\n')

for (const f of ['play.html', 'play.css', 'play.js', 'rules.js']) {
	const on = norm(fs.readFileSync(path.join(ON, f), 'utf8'))
	const lo = norm(fs.readFileSync(path.join(MOD, f), 'utf8'))
	const fns = s => new Set([...s.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map(m => m[1]))
	const a = fns(on), b = fns(lo)
	const onlyOn = [...a].filter(x => !b.has(x)).sort()
	const onlyLo = [...b].filter(x => !a.has(x)).sort()
	console.log('\n=== ' + f + ' ===')
	console.log('  行数  线上 ' + on.split('\n').length + '   本地 ' + lo.split('\n').length)
	console.log('  字节  线上 ' + Buffer.byteLength(on) + '   本地 ' + Buffer.byteLength(lo))
	console.log('  函数  线上 ' + a.size + '   本地 ' + b.size)
	console.log('  仅线上函数(' + onlyOn.length + '): ' + JSON.stringify(onlyOn.slice(0, 18)))
	console.log('  仅本地函数(' + onlyLo.length + '): ' + JSON.stringify(onlyLo.slice(0, 18)))
}

/* play.html 的引用与版本串 */
{
	const h = norm(fs.readFileSync(path.join(ON, 'play.html'), 'utf8'))
	console.log('\n=== 线上 play.html 引用 ===')
	console.log('  ' + JSON.stringify([...h.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1])))
}
