/* 对比线上 /pre/common/client.css 与本地，找"深/浅色"差异来源 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const get = u => new Promise((res, rej) => {
	https.get(u, r => { const b = []; r.on('data', c => b.push(c)); r.on('end', () => res(Buffer.concat(b).toString('utf8'))) }).on('error', rej)
})

const L = path.join(__dirname, '..', 'server-official', 'public', 'common', 'client.css')

;(async () => {
	const on = await get('https://test.genie-rttcn.top/pre/common/client.css')
	const lo = fs.readFileSync(L, 'utf8')
	const n = s => s.replace(/\r\n/g, '\n')
	console.log('线上 client.css = ' + on.length + ' 字符')
	console.log('本地 client.css = ' + lo.length + ' 字符')
	console.log('内容' + (n(on) === n(lo) ? '完全一致' : '不同'))

	const themeRe = /prefers-color-scheme|data-theme|\.dark|--bg|background:\s*#(0|1|2)/i
	console.log('线上含主题/深色线索 = ' + themeRe.test(on))
	console.log('本地含主题/深色线索 = ' + themeRe.test(lo))
	fs.writeFileSync(path.join(__dirname, '..', 'tmp', 'online2', 'client.css'), n(on), 'utf8')

	/* 只报关键差异行 */
	const A = n(on).split('\n'), B = n(lo).split('\n')
	const cnt = arr => { const m = new Map(); arr.forEach(l => m.set(l, (m.get(l) || 0) + 1)); return m }
	const a = cnt(A), b = cnt(B)
	const onlyOn = [], onlyLo = []
	for (const [l, c] of a) { const k = b.get(l) || 0; if (c > k) onlyOn.push(l) }
	for (const [l, c] of b) { const k = a.get(l) || 0; if (c > k) onlyLo.push(l) }
	console.log('\n只有线上有的行（前 12 条）：')
	onlyOn.filter(x => x.trim()).slice(0, 12).forEach(x => console.log('  + ' + x.trim().slice(0, 120)))
	console.log('\n只有本地有的行（前 12 条）：')
	onlyLo.filter(x => x.trim()).slice(0, 12).forEach(x => console.log('  - ' + x.trim().slice(0, 120)))
})()
