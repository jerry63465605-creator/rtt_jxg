/*
 * 同一份 play.html 用不同 URL 形式/头去取，看是否被网关或缓存区分对待
 *   ① 无查询串  ② 带 ?game=5895&role=Axis  ③ 带随机查询串
 * 逐份报告：HTTP 码 / 字节数 / sha256 / 关键标记 / 响应头（etag/last-modified/x-cache/age/via）
 */
const crypto = require('crypto')
const https = require('https')

const BASE = 'https://test.genie-rttcn.top/pre/quartermaster-sub-wars/play.html'

const get = (url, extraHeaders, depth = 0) => new Promise((res, rej) => {
	if (depth > 4) return rej(new Error('redirect loop'))
	https.get(url, { headers: Object.assign({ 'User-Agent': 'Mozilla/5.0 probe' }, extraHeaders || {}) }, r => {
		if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location)
			return res(get(new URL(r.headers.location, url).toString(), extraHeaders, depth + 1))
		const b = []
		r.on('data', c => b.push(c))
		r.on('end', () => res({ code: r.statusCode, buf: Buffer.concat(b), hdr: r.headers }))
	}).on('error', rej)
})

const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16)

const probe = async (label, url, hdr) => {
	const r = await get(url, hdr)
	const t = r.buf.toString('utf8')
	const vers = [...new Set([...t.matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]
	const marks = {
		log_panel: /log_panel/.test(t),
		client_css_v20261104h: /20261104h/.test(t),
		prefix_shim: /data-site-prefix/.test(t),
	}
	console.log('\n--- ' + label)
	console.log('  URL   ' + url)
	console.log('  HTTP  ' + r.code + '   字节 ' + r.buf.length + '   sha256 ' + sha(r.buf))
	console.log('  版本串 ' + JSON.stringify(vers))
	console.log('  标记   ' + JSON.stringify(marks))
	console.log('  头     etag=' + (r.hdr.etag || '-') + '  LM=' + (r.hdr['last-modified'] || '-') +
		'  cache=' + (r.hdr['cache-control'] || '-') + '  age=' + (r.hdr.age || '-') +
		'  via=' + (r.hdr.via || '-') + '  x-cache=' + (r.hdr['x-cache'] || '-') +
		'  server=' + (r.hdr.server || '-') + '  enc=' + (r.hdr['content-encoding'] || '-'))
	return r
}

;(async () => {
	const a = await probe('① 无查询串', BASE)
	const b = await probe('② 带 ?game=5895&role=Axis（用户给的 URL）', BASE + '?game=5895&role=Axis')
	const c = await probe('③ 带随机查询串（破缓存）', BASE + '?cb=' + Date.now())
	const d = await probe('④ 带 no-cache 头', BASE, { 'Cache-Control': 'no-cache', Pragma: 'no-cache' })

	console.log('\n=== 结论 ===')
	const same = sha(a.buf) === sha(b.buf) && sha(b.buf) === sha(c.buf) && sha(c.buf) === sha(d.buf)
	console.log('  四种取法内容' + (same ? '完全一致 ✅（不存在按查询串分发）' : '不同 ⚠（网关/缓存按 URL 分发）'))
	if (!same) {
		for (const [n, r] of [['①', a], ['②', b], ['③', c], ['④', d]])
			console.log('    ' + n + '  ' + r.buf.length + ' B  sha=' + sha(r.buf))
	}
})().catch(e => console.log('失败: ' + (e && e.stack || e)))
