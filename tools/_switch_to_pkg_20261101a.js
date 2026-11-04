/*
 * 把本地切到「UI 外部修改前」的 20261101a 版本，用于对照测试。
 *
 * 做法：
 *   ① 备份当前（外部交付版）的客户端 + 公共层到 tmp/backup_vendor_ui/
 *   ② 用解压出来的 quartermaster-sub-wars-20261101a-full.zip 覆盖模块目录
 *   ③ 从 git 4af8905（打包该 zip 的那次提交）取回 public 层：
 *        fonts/fonts.css · common/client.css · common/client.js
 *      —— 这三个文件不在 zip 里，但属于"外部 UI 修改前"的一部分
 *
 * 用法：node tools/_switch_to_pkg_20261101a.js [--restore]
 *   --restore  撤销：用备份把当前状态还回去（回到外部交付版）
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const PUB = path.join(ROOT, 'server-official', 'public')
const MOD = path.join(PUB, 'quartermaster-sub-wars')
const PKG = path.join(ROOT, 'tmp', 'pkg1101a', 'quartermaster-sub-wars')
const BK = path.join(ROOT, 'tmp', 'backup_vendor_ui')
const COMMIT = '4af8905'

const MODULE_FILES = ['play.html', 'play.css', 'play.js', 'rules.js', 'data.js', 'layout.js', 'cards.js', 'about.html', 'create.html']
const PUBLIC_FILES = ['fonts/fonts.css', 'common/client.css', 'common/client.js']

const restore = process.argv.includes('--restore')
const ensureDir = d => fs.mkdirSync(d, { recursive: true })
const kb = p => (fs.statSync(p).size / 1024).toFixed(1) + ' KB'

if (restore) {
	console.log('== 恢复外部交付版（从备份）==')
	if (!fs.existsSync(BK)) { console.log('✗ 没有备份目录 ' + BK); process.exit(1) }
	for (const f of MODULE_FILES) {
		const src = path.join(BK, 'module', f)
		if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(MOD, f)); console.log('  还原 ' + f) }
	}
	for (const f of PUBLIC_FILES) {
		const src = path.join(BK, 'public', f.replace('/', path.sep))
		if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(PUB, f)); console.log('  还原 ' + f) }
	}
	report()
	process.exit(0)
}

/* ① 备份 */
ensureDir(path.join(BK, 'module'))
ensureDir(path.join(BK, 'public', 'fonts'))
ensureDir(path.join(BK, 'public', 'common'))
for (const f of MODULE_FILES) {
	const p = path.join(MOD, f)
	if (fs.existsSync(p)) fs.copyFileSync(p, path.join(BK, 'module', f))
}
for (const f of PUBLIC_FILES) {
	const p = path.join(PUB, f)
	if (fs.existsSync(p)) fs.copyFileSync(p, path.join(BK, 'public', f.replace('/', path.sep)))
}
console.log('① 已备份当前（外部交付版）到 tmp/backup_vendor_ui/')

/* ② 包内模块 → 本地 */
if (!fs.existsSync(PKG)) { console.log('✗ 没找到解压目录 ' + PKG); process.exit(1) }
let n = 0
const walk = (dir, base) => {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const sp = path.join(dir, e.name)
		const rel = path.relative(base, sp)
		const dp = path.join(MOD, rel)
		if (e.isDirectory()) { ensureDir(dp); walk(sp, base) }
		else { fs.copyFileSync(sp, dp); n++ }
	}
}
walk(PKG, PKG)
console.log('② 已用 20261101a 包覆盖模块目录（' + n + ' 个文件）')

/* ③ public 层回到 4af8905 */
for (const f of PUBLIC_FILES) {
	const buf = execSync('git show ' + COMMIT + ':server-official/public/' + f, { cwd: ROOT, maxBuffer: 1 << 28 })
	fs.writeFileSync(path.join(PUB, f), buf)
	console.log('③ 已从 ' + COMMIT + ' 取回 ' + f + '（' + kb(path.join(PUB, f)) + '）')
}

report()

function report() {
	const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	const vers = [...new Set([...html.matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]
	console.log('\n=== 当前状态 ===')
	console.log('  版本串 = ' + JSON.stringify(vers))
	console.log('  play.html 引用 = ' + JSON.stringify([...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js))(?:\?[^"]*)?"/g)].map(m => m[1])))
	for (const f of ['play.html', 'play.css', 'play.js', 'rules.js']) console.log('  ' + f.padEnd(10) + kb(path.join(MOD, f)))
	console.log('  备份目录 = tmp/backup_vendor_ui/（撤销：node tools/_switch_to_pkg_20261101a.js --restore）')
}
