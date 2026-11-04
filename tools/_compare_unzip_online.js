/* 比较「解压出来的 quartermaster-sub-wars」与「刚从线上抓的 tmp/online2」是否同版 */
const fs = require('fs')
const path = require('path')
const U = path.join(__dirname, '..', 'tmp', 'unzip_online', 'quartermaster-sub-wars')
const O = path.join(__dirname, '..', 'tmp', 'online2')
const L = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const norm = s => s.replace(/\r\n/g, '\n')
const rd = p => { try { return fs.readFileSync(p, 'utf8') } catch (e) { return null } }

const files = ['play.html', 'play.css', 'play.js', 'map_lo.webp', 'map.webp']
console.log('=== 解压包 vs 线上最新 ===')
for (const f of files) {
	const a = fs.existsSync(path.join(U, f)) ? fs.statSync(path.join(U, f)).size : null
	const b = fs.existsSync(path.join(O, f)) ? fs.statSync(path.join(O, f)).size : null
	let same = '?'
	if (a != null && b != null) same = (a === b) ? '✅ 同大小' : '⚠ 大小不同'
	console.log('  ' + f.padEnd(12) + ' 解压=' + String(a).padStart(8) + '  线上=' + String(b).padStart(8) + '   ' + same)
}
for (const f of ['play.html', 'play.css', 'play.js']) {
	const a = rd(path.join(U, f)), b = rd(path.join(O, f))
	if (a != null && b != null)
		console.log('  ' + f + ' 内容' + (norm(a) === norm(b) ? '完全一致' : '不同（解压=' + a.length + ' 线上=' + b.length + '）'))
}

console.log('\n=== 解压包 vs 当前本地 ===')
for (const f of ['play.html', 'play.css', 'play.js']) {
	const a = rd(path.join(U, f)), b = rd(path.join(L, f))
	if (a != null && b != null)
		console.log('  ' + f + ' ' + (norm(a) === norm(b) ? '一致' : '不同（本地多出 ' + (b.length - a.length) + ' 字符）'))
}

console.log('\n=== 解压包里的版本串 & 前缀写法 ===')
const h = rd(path.join(U, 'play.html')) || ''
console.log('  ?v= ' + JSON.stringify([...new Set([...h.matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]))
console.log('  SITE_PREFIX = ' + (h.match(/window\.SITE_PREFIX\s*=\s*"([^"]*)"/) ? JSON.stringify(h.match(/window\.SITE_PREFIX\s*=\s*"([^"]*)"/)[1]) : '(无)'))
console.log('  含 /pre/images = ' + /\/pre\/images\//.test(h))
console.log('  含 #log_close = ' + /id="log_close"/.test(h))
