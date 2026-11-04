/* 排查字体：fonts.css 与它引用的字体文件，线上 vs 本地 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const P = path.join(__dirname, '..', 'server-official', 'public')
const cssPath = path.join(P, 'fonts', 'fonts.css')

const getBuf = u => new Promise((res, rej) => {
	const lib = u.startsWith('https') ? https : http
	lib.get(u, r => {
		if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location)
			return res(getBuf(new URL(r.headers.location, u).toString()))
		const b = []
		r.on('data', c => b.push(c))
		r.on('end', () => res({ code: r.statusCode, buf: Buffer.concat(b) }))
	}).on('error', rej)
})

;(async () => {
	console.log('=== 本地 fonts.css 引用的字体文件 ===')
	const local = fs.readFileSync(cssPath, 'utf8')
	const urls = [...local.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(m => m[1])
	console.log('  共 ' + urls.length + ' 个引用')
	for (const u of urls) {
		/* fonts.css 位于 /fonts/ 下，相对路径 -> public/fonts/ */
		const p = path.resolve(path.dirname(cssPath), u.split('?')[0])
		const exists = fs.existsSync(p)
		console.log('  ' + (exists ? '✓' : '✗ 缺失') + '  ' + u + (exists ? '  (' + Math.round(fs.statSync(p).size / 1024) + ' KB)' : ''))
	}

	console.log('\n=== 线上 fonts.css 与本地是否一致 ===')
	const on = await getBuf('https://test.genie-rttcn.top/pre/fonts/fonts.css')
	const n = s => s.replace(/\r\n/g, '\n')
	console.log('  线上 ' + on.buf.length + ' bytes  本地 ' + Buffer.byteLength(local) + ' bytes  内容一致=' +
		(on.code === 200 && n(on.buf.toString('utf8')) === n(local)))

	console.log('\n=== 线上引用的字体文件（逐个探活）===')
	const onCss = on.buf.toString('utf8')
	const onUrls = [...new Set([...onCss.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(m => m[1]))]
	for (const u of onUrls) {
		const abs = u.startsWith('http') ? u : 'https://test.genie-rttcn.top/pre/fonts/' + u.replace(/^\.\//, '').split('/').pop()
		const r = await getBuf(abs)
		const localHas = fs.existsSync(path.resolve(path.dirname(cssPath), u.split('?')[0]))
		console.log('  ' + (r.code === 200 ? '线上✓' : '线上✗' + r.code) + '  ' + (localHas ? '本地✓' : '本地✗') + '  ' + u)
	}
})()
