/*
 * 把「线上已部署的模块」整份抓下来，并与本地逐文件比对 —— 用于接手别人改好的 UI。
 *
 * 玩法：
 *   node tools/_pull_online_module.js                 # 抓 + 对比（默认线上 /pre）
 *   node tools/_pull_online_module.js --url https://test.genie-rttcn.top/pre
 *
 * 会做三件事：
 *   ① 抓模块目录下的核心文件（play.html/play.css/play.js/rules.js/data.js/layout.js/cards.js/create.html）
 *   ② 从 play.html 里解析额外引用的资源（如 /pre/fonts/fonts.css、/pre/common/client.css）并一起抓
 *   ③ 与本地逐文件比对：一致 / 仅线上有 / 仅本地有 / 内容不同（附字符数）
 *
 * 产物：tmp/online/<文件名…>，便于 diff 或作为 vendor drop 入库。
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const argUrl = (process.argv.indexOf('--url') >= 0) ? process.argv[process.argv.indexOf('--url') + 1] : null
const BASE = (argUrl || 'https://test.genie-rttcn.top/pre').replace(/\/$/, '')
const MOD_NAME = 'quartermaster-sub-wars'
const ROOT = path.join(__dirname, '..')
const LOCAL = path.join(ROOT, 'server-official', 'public', MOD_NAME)
const OUT = path.join(ROOT, 'tmp', 'online')

const CORE = ['play.html', 'play.css', 'play.js', 'rules.js', 'data.js', 'layout.js', 'cards.js', 'create.html']

/* ---------- 极简 GET（跟随重定向） ---------- */
function get(url, depth = 0) {
	return new Promise((resolve, reject) => {
		if (depth > 4) return reject(new Error('重定向过多: ' + url))
		const lib = url.startsWith('https') ? https : http
		lib.get(url, { headers: { 'User-Agent': 'rtt-pull/1.0' } }, res => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.resume()
				return resolve(get(new URL(res.headers.location, url).toString(), depth + 1))
			}
			const chunks = []
			res.on('data', c => chunks.push(c))
			res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }))
		}).on('error', reject)
	})
}

function relOf(localPath) { return path.relative(LOCAL, localPath).split(path.sep).join('/') }
function readLocal(rel) {
	const p = path.join(LOCAL, rel)
	try { return fs.readFileSync(p, 'utf8') } catch (e) { return null }
}

;(async () => {
	fs.mkdirSync(OUT, { recursive: true })
	console.log('线上基址: ' + BASE + '/' + MOD_NAME)

	/* ① 核心文件 */
	const fetched = []
	for (const f of CORE) {
		const url = BASE + '/' + MOD_NAME + '/' + f
		const r = await get(url)
		if (r.status !== 200) { console.log('  ✗ ' + f + '  HTTP ' + r.status); continue }
		fs.writeFileSync(path.join(OUT, f), r.body)
		fetched.push(f)
	}

	/* ② 从 play.html 里挖额外引用的 CSS/JS（模块目录之外，例如 /pre/fonts/fonts.css） */
	const html = fetched.indexOf('play.html') >= 0 ? fs.readFileSync(path.join(OUT, 'play.html'), 'utf8') : ''
	const extra = new Set()
	for (const m of html.matchAll(/(?:href|src)="([^"]+\.(?:css|js))(\?[^"]*)?"/g)) {
		const u = m[1]
		if (!/^(https?:)?\//.test(u)) continue                     /* 只处理绝对路径引用 */
		const abs = u.startsWith('http') ? u : new URL(u, BASE + '/').toString()
		if (abs.indexOf('/' + MOD_NAME + '/') >= 0) continue        /* 模块内已抓 */
		extra.add(abs)
	}
	for (const u of extra) {
		const rel = u.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '')   /* pre/fonts/fonts.css */
		const dest = path.join(OUT, '_external', rel)
		fs.mkdirSync(path.dirname(dest), { recursive: true })
		const r = await get(u)
		if (r.status === 200) {
			fs.writeFileSync(dest, r.body)
			console.log('  + 外部资源 ' + rel + '  (' + r.body.length + ' bytes)')
		} else console.log('  ✗ 外部资源 ' + u + ' HTTP ' + r.status)
	}

	/* ③ 与本地比对 */
	console.log('\n=== 逐文件比对（线上 vs 本地）===')
	const rows = []
	for (const f of fetched) {
		const on = fs.readFileSync(path.join(OUT, f), 'utf8')
		const lo = readLocal(f)
		if (lo == null) { rows.push({ f, st: '仅线上有', on: on.length, lo: 0 }); continue }
		rows.push({ f, st: on === lo ? '完全一致' : '内容不同', on: on.length, lo: lo.length })
	}
	for (const f of CORE) if (rows.every(r => r.f !== f) && readLocal(f) != null) rows.push({ f, st: '仅本地有', on: 0, lo: (readLocal(f) || '').length })

	const pad = s => String(s).padEnd(12)
	console.log('  文件'.padEnd(16) + pad('状态') + '线上(字符)'.padEnd(14) + '本地(字符)')
	for (const r of rows) console.log('  ' + r.f.padEnd(15) + pad(r.st) + String(r.on).padEnd(14) + String(r.lo))

	/* 版本串 */
	const ver = s => [...new Set([...String(s).matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]
	console.log('\n线上版本串: ' + JSON.stringify(ver(fs.readFileSync(path.join(OUT, 'play.html'), 'utf8'))))
	console.log('本地版本串: ' + JSON.stringify(ver(readLocal('play.html') || '')))
	console.log('\n产物目录: ' + OUT)
	console.log('提示: 内容不同的文件请 `git diff --no-index` 或 Beyond Compare 对比；')
	console.log('      若线上 play.js/rules.js 比本地【小】很多，说明对方基于旧基线改的，直接采用会回退本地修复。')
})().catch(e => { console.error('失败: ' + e.message); process.exitCode = 1 })
