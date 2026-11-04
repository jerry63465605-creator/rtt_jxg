/*
 * 扫 play.css / play.js / play.html 里引用的静态资源，逐个探活，列出 404。
 * 用法：node tools/_check_asset_404.js [baseUrl]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')

const BASE = process.argv[2] || 'http://localhost:8091'
const MODURL = '/quartermaster-sub-wars/'
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8')
const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')

const urls = new Set()
for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) urls.add(m[1])
for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) urls.add(m[1])
/* play.js 里以字符串形式出现的静态资源（地图/图片） */
for (const m of js.matchAll(/["']((?:map|images\/)[^"']+\.(?:webp|png|svg|jpg))["']/g)) urls.add(m[1])

const get = u => new Promise(res => {
	http.get(BASE + u, r => { r.resume(); res(r.statusCode) }).on('error', () => res(0))
})

;(async () => {
	const list = [...urls].filter(u => !/^(https?:)?\/\/(?!localhost)/.test(u) && u.indexOf('data:') !== 0)
	const bad = []
	for (const u of list) {
		/* 相对路径按模块目录解析；绝对路径直接用 */
		const target = u.charAt(0) === '/' ? u : MODURL + u.replace(/^\.\//, '')
		const code = await get(target.split('?')[0])
		if (code !== 200) bad.push({ u, target, code })
	}
	console.log('引用资源数 = ' + list.length + '，非 200 = ' + bad.length)
	for (const b of bad) console.log('  ' + b.code + '  ' + b.target + '   （源码里写的是 ' + b.u + '）')
	if (!bad.length) console.log('  ✅ 全部 200')
})()
