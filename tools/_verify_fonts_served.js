/* 验证服务端返回的 fonts.css 已无 /pre 绝对路径，且引用字体全部 200 */
const http = require('http')
const get = u => new Promise((res, rej) => {
	http.get(u, r => { const b = []; r.on('data', c => b.push(c)); r.on('end', () => res({ code: r.statusCode, body: Buffer.concat(b).toString('utf8'), hdr: r.headers })) }).on('error', rej)
})

;(async () => {
	const css = await get('http://localhost:8091/fonts/fonts.css')
	console.log('fonts.css HTTP ' + css.code + '  cache=' + (css.hdr['cache-control'] || '(无)'))
	console.log('残留 /pre/fonts 引用 = ' + (css.body.match(/\/pre\/fonts/g) || []).length)
	const urls = [...new Set([...css.body.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]))]
	console.log('引用字体 ' + urls.length + ' 个，逐个探活：')
	let bad = 0
	for (const u of urls) {
		const code = (await get('http://localhost:8091/fonts/' + u.split('/').pop().split('?')[0])).code
		if (code !== 200) { bad++; console.log('  ✗ ' + u + '  HTTP ' + code) }
	}
	console.log(bad === 0 ? '  ✅ 全部 200' : '  ❌ ' + bad + ' 个失败')

	const html = await get('http://localhost:8091/quartermaster-sub-wars/play.html')
	console.log('\nplay.html 的 fonts.css 引用 = ' + (html.body.match(/href="[^"]*fonts\.css[^"]*"/) || ['(无)'])[0])
})()
