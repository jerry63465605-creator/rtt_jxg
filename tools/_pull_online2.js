/* 抓线上最新前端（play.html/css/js + map_lo.webp 等），存到 tmp/online2，并报告可下载项 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const BASE = (process.argv[2] || 'https://test.genie-rttcn.top/pre').replace(/\/$/, '')
const MOD = '/quartermaster-sub-wars'
const OUT = path.join(__dirname, '..', 'tmp', 'online2')
fs.mkdirSync(OUT, { recursive: true })

const get = (url, depth = 0) => new Promise((res, rej) => {
	if (depth > 4) return rej(new Error('redirect'))
	const lib = url.startsWith('https') ? https : http
	lib.get(url, r => {
		if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location)
			return res(get(new URL(r.headers.location, url).toString(), depth + 1))
		const b = []
		r.on('data', c => b.push(c))
		r.on('end', () => res({ status: r.statusCode, buf: Buffer.concat(b) }))
	}).on('error', rej)
})

const files = ['play.html', 'play.css', 'play.js', 'map_lo.webp', 'map.webp', 'create.html']

;(async () => {
	for (const f of files) {
		try {
			const r = await get(BASE + MOD + '/' + f)
			const dest = path.join(OUT, f)
			if (r.status === 200 && r.buf.length) fs.writeFileSync(dest, r.buf)
			console.log(String(r.status).padEnd(4) + f.padEnd(14) + String(r.buf.length).padStart(9) + ' bytes')
		} catch (e) {
			console.log('ERR  ' + f + '  ' + e.message)
		}
	}
})().catch(e => console.log('失败: ' + e.message))
