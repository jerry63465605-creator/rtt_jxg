/* 本地 8091 到底提供了几套页面？逐一探 / 与 /pre/ 前缀，看返回的是哪一版 */
const http = require('http')
const get = u => new Promise((res, rej) => {
	http.get(u, r => {
		const b = []
		r.on('data', c => b.push(c))
		r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(b).toString('utf8'), hdr: r.headers }))
	}).on('error', rej)
})

const paths = [
	'/quartermaster-sub-wars/play.html',
	'/pre/quartermaster-sub-wars/play.html',
	'/pre/pre/quartermaster-sub-wars/play.html',
	'/quartermaster-sub-wars/play.css',
	'/pre/quartermaster-sub-wars/play.css',
	'/common/client.css',
	'/pre/common/client.css',
]

;(async () => {
	for (const p of paths) {
		try {
			const r = await get('http://localhost:8091' + p)
			const vers = [...new Set([...r.body.matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]
			const isHtml = /html/.test(r.hdr['content-type'] || '')
			console.log((String(r.status) + '  ' + p).padEnd(60) +
				' ' + String(r.body.length).padStart(7) + ' 字符' +
				(isHtml ? '  v=' + JSON.stringify(vers) : '') +
				'  cache=' + (r.hdr['cache-control'] || '(无)'))
		} catch (e) {
			console.log('ERR ' + p + ' -> ' + e.message)
		}
	}
})()
