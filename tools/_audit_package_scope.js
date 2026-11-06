/*
 * 体检 quartermaster-sub-wars.zip：到底包含哪些内容、缺哪些运行必需项
 * 用法：node tools/_audit_package_scope.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const ZIP = path.join(ROOT, 'quartermaster-sub-wars.zip')
const UNZIP = path.join(ROOT, 'tmp', 'unzip_online')
const PUB = path.join(ROOT, 'server-official', 'public')

const walk = (dir, base = dir, out = []) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name)
		if (e.isDirectory()) walk(p, base, out)
		else out.push(path.relative(base, p).split(path.sep).join('/'))
	}
	return out
}

const files = walk(path.join(UNZIP, 'quartermaster-sub-wars')).filter(f => f !== '')
const sizes = files.map(f => fs.statSync(path.join(UNZIP, 'quartermaster-sub-wars', f)).size)
console.log('包大小: ' + (fs.statSync(ZIP).size / 1024 / 1024).toFixed(2) + ' MB')
console.log('文件数: ' + files.length)

/* 按扩展名/目录统计 */
const by = {}
for (const f of files) {
	const ext = path.extname(f).toLowerCase() || '(无)'
	by[ext] = by[ext] || { n: 0, bytes: 0 }
	by[ext].n++
	by[ext].bytes += fs.statSync(path.join(UNZIP, 'quartermaster-sub-wars', f)).size
}
console.log('\n=== 按类型 ===')
Object.entries(by).sort((a, b) => b[1].bytes - a[1].bytes)
	.forEach(([ext, v]) => console.log('  ' + ext.padEnd(8) + String(v.n).padStart(5) + ' 个   ' + (v.bytes / 1024 / 1024).toFixed(2) + ' MB'))

const top = {}
for (const f of files) { const t = f.includes('/') ? f.split('/')[0] + '/' : '(根)'; top[t] = (top[t] || 0) + 1 }
console.log('\n=== 顶层目录 ===')
Object.entries(top).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('  ' + k.padEnd(16) + n + ' 个'))

/* 运行必需项：模块内 + 平台层 */
const MOD = path.join(UNZIP, 'quartermaster-sub-wars')
const NEED_IN_MOD = ['play.html', 'play.css', 'play.js', 'data.js', 'layout.js', 'cards.js', 'rules.js',
	'map.webp', 'map_lo.webp', 'create.html', 'about.html', 'info/rules.html', 'preview-server.js']
const NEED_PLATFORM = ['fonts/fonts.css', 'common/client.css', 'common/client.js', 'images/cog.svg', 'images/wooden-sign.svg']

console.log('\n=== 运行必需项：模块内（包里有吗）===')
for (const f of NEED_IN_MOD) {
	const inPkg = fs.existsSync(path.join(MOD, f))
	const inLocal = fs.existsSync(path.join(PUB, 'quartermaster-sub-wars', f))
	const s = fs.existsSync(path.join(MOD, f)) ? Math.round(fs.statSync(path.join(MOD, f)).size / 1024) + ' KB' : ''
	console.log('  ' + (inPkg ? '✓' : '✗') + ' ' + f.padEnd(24) + (inPkg ? s.padEnd(10) : '(包内没有)'.padEnd(10)) + ' 本地=' + (inLocal ? '有' : '无'))
}

console.log('\n=== 运行必需项：平台层（包里有没有）===')
for (const f of NEED_PLATFORM) {
	const inPkg = fs.existsSync(path.join(UNZIP, f))      /* 包根只有 quartermaster-sub-wars/ */
	const inLocal = fs.existsSync(path.join(PUB, f))
	console.log('  ' + (inPkg ? '✓' : '✗ 不在包内') + '  ' + f.padEnd(24) + ' 本地=' + (inLocal ? '有' : '无'))
}

/* 卡图数量 */
const cardDir = ['cards', 'cards_webp', 'cards_tts'].map(d => [d, fs.existsSync(path.join(MOD, d)) ? walk(path.join(MOD, d)).length : 0])
console.log('\n=== 卡图目录 ===')
cardDir.forEach(([d, n]) => console.log('  ' + d.padEnd(12) + (n ? n + ' 个文件' : '不在包内')))
