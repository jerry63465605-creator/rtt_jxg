/*
 * 说清「包内版 play.html」与「线上 play.html」到底差在哪：
 *   ① 资源引用是否加了 /pre 前缀
 *   ② 是否有那段 SITE_PREFIX 注入脚本
 *   ③ css/js/地图 是否完全一致
 */
const fs = require('fs')
const path = require('path')
const norm = s => s.replace(/\r\n/g, '\n')
const PKG = path.join(__dirname, '..', 'tmp', 'unzip_online', 'quartermaster-sub-wars')
const ON = path.join(__dirname, '..', 'tmp', 'online2')
const LOC = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rd = p => norm(fs.readFileSync(p, 'utf8'))

const pkg = rd(path.join(PKG, 'play.html'))
const on = rd(path.join(ON, 'play.html'))
const loc = rd(path.join(LOC, 'play.html'))

const stat = (label, h) => {
	const refs = [...h.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1])
	const preRefs = refs.filter(r => r.startsWith('/pre/'))
	const rootRefs = refs.filter(r => /^\/(?!pre\/)/.test(r) && !r.startsWith('//'))
	const shim = /data-site-prefix="1"/.test(h)
	console.log('\n=== ' + label + ' ===')
	console.log('  字符数 = ' + h.length + '   行数 = ' + h.split('\n').length)
	console.log('  含 SITE_PREFIX 注入脚本 = ' + (shim ? '是' : '否'))
	console.log('  /pre/ 前缀引用 = ' + preRefs.length + '  ' + JSON.stringify(preRefs.slice(0, 8)))
	console.log('  根路径引用(/xxx) = ' + rootRefs.length + '  ' + JSON.stringify(rootRefs.slice(0, 8)))
}

stat('① 包内版 play.html（压缩包里的原始文件）', pkg)
stat('② 线上版 play.html（部署后）', on)
stat('③ 当前本地 play.html（= 包内版 + 一个 ?v=）', loc)

console.log('\n=== css / js / 地图：三份是否一致 ===')
for (const f of ['play.css', 'play.js']) {
	const a = rd(path.join(PKG, f)), b = rd(path.join(ON, f)), c = rd(path.join(LOC, f))
	console.log('  ' + f.padEnd(10) + ' 包内=线上: ' + (a === b) + '   包内=本地: ' + (a === c))
}
for (const f of ['map.webp', 'map_lo.webp']) {
	const A = fs.readFileSync(path.join(PKG, f)), B = fs.readFileSync(path.join(ON, f)), C = fs.readFileSync(path.join(LOC, f))
	console.log('  ' + f.padEnd(12) + '包内=线上: ' + A.equals(B) + '   包内=本地: ' + A.equals(C))
}

console.log('\n=== 包内版 vs 线上版：play.html 的差异行（前 12 条非空）===')
{
	const cnt = s => { const m = new Map(); s.split('\n').forEach(l => m.set(l, (m.get(l) || 0) + 1)); return m }
	const a = cnt(pkg), b = cnt(on)
	const onlyOn = []
	for (const [l, n] of b) { const k = a.get(l) || 0; if (n > k) onlyOn.push(l) }
	onlyOn.filter(x => x.trim()).slice(0, 12).forEach(x => console.log('  + ' + x.trim().slice(0, 120)))
}
