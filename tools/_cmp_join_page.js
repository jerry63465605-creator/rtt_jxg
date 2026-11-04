/*
 * 对比本地 /join/10 与线上 /pre/join/5893：
 *   HTML 结构、引用的 css/js、以及 style.css 是否同版
 * 目的：判断"本地页面明显更大"是【浏览器按站点记忆的缩放】还是【CSS 真的不同】
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const get = (url, depth = 0) => new Promise((res, rej) => {
	if (depth > 4) return rej(new Error('redirect'))
	const lib = url.startsWith('https') ? https : http
	lib.get(url, { headers: { 'User-Agent': 'cmp/1.0' } }, r => {
		if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location)
			return res(get(new URL(r.headers.location, url).toString(), depth + 1))
		const b = []
		r.on('data', c => b.push(c))
		r.on('end', () => res({ code: r.statusCode, buf: Buffer.concat(b) }))
	}).on('error', rej)
})

const norm = s => s.replace(/\r\n/g, '\n')

;(async () => {
	const LOCAL = 'http://localhost:8091/join/10'
	const ONLINE = 'https://test.genie-rttcn.top/pre/join/5893'

	for (const [label, url] of [['本地', LOCAL], ['线上', ONLINE]]) {
		const r = await get(url)
		const h = norm(r.buf.toString('utf8'))
		const css = [...h.matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1])
		const js = [...h.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1])
		const meta = [...h.matchAll(/<meta[^>]+>/g)].map(m => m[0]).filter(m => /viewport|charset/.test(m))
		console.log('\n=== ' + label + '  ' + url + ' ===')
		console.log('  HTTP ' + r.code + '  ' + r.buf.length + ' bytes  ' + h.split('\n').length + ' 行')
		console.log('  css: ' + JSON.stringify(css))
		console.log('  js : ' + JSON.stringify(js))
		console.log('  meta: ' + JSON.stringify(meta))
		const htmlTag = (h.match(/<html[^>]*>/) || [])[0]
		const bodyTag = (h.match(/<body[^>]*>/) || [])[0]
		console.log('  html 标签: ' + htmlTag)
		console.log('  body 标签: ' + bodyTag)
		/* 关键：有没有 inline 的 font-size / zoom / transform: scale */
		const scaleHits = [...h.matchAll(/(font-size|zoom|scale)\s*:\s*[^;"']+/g)].map(m => m[0])
		console.log('  页面内 font-size/zoom/scale 出现: ' + JSON.stringify(scaleHits.slice(0, 8)))
	}

	/* style.css 逐字节比较 */
	console.log('\n=== style.css 对比 ===')
	const lo = await get('http://localhost:8091/style.css')
	const on = await get('https://test.genie-rttcn.top/pre/style.css')
	console.log('  本地 ' + lo.code + ' ' + lo.buf.length + ' bytes   线上 ' + on.code + ' ' + on.buf.length + ' bytes   内容一致=' +
		(lo.code === 200 && on.code === 200 && norm(lo.buf.toString()) === norm(on.buf.toString())))
	if (lo.code === 200) {
		const s = norm(lo.buf.toString('utf8'))
		const roots = [...s.matchAll(/:root\s*\{[^}]*\}/g)].map(m => m[0])
		console.log('  :root 变量块: ' + JSON.stringify(roots.slice(0, 2)))
		const fs_ = [...s.matchAll(/font-size\s*:\s*[^;]+/g)].map(m => m[0].trim())
		console.log('  font-size 声明（前 10 条）: ' + JSON.stringify(fs_.slice(0, 10)))
	}
})().catch(e => console.log('失败: ' + (e && e.stack || e)))
