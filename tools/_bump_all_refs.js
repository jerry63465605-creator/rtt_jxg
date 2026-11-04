/*
 * 给 play.html 里【所有本地/公共资源引用】统一加版本串：
 *   · play.css / data.js / layout.js / play.js  -> ?v=<TAG>
 *   · /common/client.css /common/client.js      -> ?v=<TAG>（原来完全没有版本串，最容易吃到旧缓存）
 *   · /fonts/fonts.css                          -> ?v=<TAG>（本次改了字体路径，必须让浏览器重取）
 * 用法：node tools/_bump_all_refs.js 20261104g
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.html')
const TAG = process.argv[2] || '20261104g'

let h = fs.readFileSync(p, 'utf8')
const touched = []

h = h.replace(/\b(href|src)="([^"]+)"/g, (m, attr, url) => {
	if (!/\.(css|js)(\?.*)?$/i.test(url)) return m
	if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) return m
	const bare = url.split('?')[0]
	touched.push(bare + ' -> v=' + TAG)
	return attr + '="' + bare + '?v=' + TAG + '"'
})

fs.writeFileSync(p, h, 'utf8')
const after = [...h.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(m => m[1])
	.filter(u => /\.(css|js)(\?|$)/i.test(u) && !/^(https?:)?\/\//i.test(u))
console.log('已改写 ' + touched.length + ' 处：')
touched.forEach(x => console.log('  ' + x))
console.log('本地/公共 css|js 引用共 ' + after.length + ' 个，全部带 v= : ' + after.every(x => /[?&]v=/.test(x)))
