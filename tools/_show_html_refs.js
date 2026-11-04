/* 打印本地 8091 实际返回的 play.html 的资源引用 & SITE_PREFIX */
const http = require('http')
http.get('http://localhost:8091/quartermaster-sub-wars/play.html', r => {
	const b = []
	r.on('data', c => b.push(c))
	r.on('end', () => {
		const h = Buffer.concat(b).toString('utf8')
		const refs = [...h.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1])
		console.log('资源引用：')
		refs.forEach(x => console.log('  ' + x))
		console.log('/pre 前缀引用数 = ' + refs.filter(x => x.indexOf('/pre') === 0).length)
		const m = h.match(/window\.SITE_PREFIX\s*=\s*"([^"]*)"/)
		console.log('SITE_PREFIX = ' + (m ? JSON.stringify(m[1]) : '(无)'))
	})
}).on('error', e => console.log('ERR ' + e.message))
