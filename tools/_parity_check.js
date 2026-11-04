/*
 * 「本地显示 = 线上显示」资源一致性核查
 *   ① 取线上 play.html 的全部资源引用（含 /pre 前缀），逐个下载；
 *   ② 与本地 public/ 下对应文件逐字节比较；
 *   ③ 递归检查 css 里的 url()（fonts.css → woff2、client.css → images）；
 *   ④ 输出差异清单 + 缺失清单。
 *
 * 用法：node tools/_parity_check.js [--fix]   （--fix 会把不一致/缺失的文件从线上抓下来覆盖本地）
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const PUB = path.join(__dirname, '..', 'server-official', 'public')
const MOD = 'quartermaster-sub-wars'
const ORIGIN = 'https://test.genie-rttcn.top'
const PREFIX = '/pre'
const FIX = process.argv.includes('--fix')

const get = (url, depth = 0) => new Promise((res, rej) => {
	if (depth > 5) return rej(new Error('redirect loop'))
	const lib = url.startsWith('https') ? https : http
	lib.get(url, { headers: { 'User-Agent': 'parity/1.0' } }, r => {
		if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location)
			return res(get(new URL(r.headers.location, url).toString(), depth + 1))
		const b = []
		r.on('data', c => b.push(c))
		r.on('end', () => res({ code: r.statusCode, buf: Buffer.concat(b) }))
	}).on('error', rej)
})

const norm = b => b.toString('utf8').replace(/\r\n/g, '\n')

/* 线上 URL → 本地磁盘路径 */
function localPathOf(u) {
	let p = u.replace(/^https?:\/\/[^/]+/, '')
	if (p.startsWith(PREFIX + '/')) p = p.slice(PREFIX.length)
	p = p.split('?')[0]
	return path.join(PUB, p.replace(/^\//, ''))
}

const rows = []
const seen = new Set()

async function check(url, label) {
	if (seen.has(url)) return
	seen.add(url)
	const r = await get(url)
	if (r.code !== 200) { rows.push({ label, url, status: '线上 ' + r.code, local: '-' }); return }
	const lp = localPathOf(url)
	if (!fs.existsSync(lp)) {
		rows.push({ label, url, status: '本地缺失', local: lp })
		if (FIX) { fs.mkdirSync(path.dirname(lp), { recursive: true }); fs.writeFileSync(lp, r.buf); console.log('  [fix] 已补 ' + path.relative(PUB, lp)) }
		return
	}
	const lb = fs.readFileSync(lp)
	const isText = /\.(css|js|html|json|svg)$/i.test(url.split('?')[0])
	const same = isText ? norm(lb) === norm(r.buf) : lb.equals(r.buf)
	if (!same) {
		rows.push({ label, url, status: '内容不同', local: lp })
		if (FIX) { fs.writeFileSync(lp, r.buf); console.log('  [fix] 已覆盖 ' + path.relative(PUB, lp)) }
	} else {
		rows.push({ label, url, status: '一致', local: lp })
	}
	return r
}

;(async () => {
	console.log('== 拉取线上 play.html ==')
	const html = await get(ORIGIN + PREFIX + '/' + MOD + '/play.html')
	if (html.code !== 200) { console.log('拿不到线上 play.html：' + html.code); return }
	const h = norm(html.buf)

	/* ① HTML 引用的资源（相对路径按模块目录解析） */
	const PAGE_URL = ORIGIN + PREFIX + '/' + MOD + '/play.html'
	const refs = [...h.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1])
		.map(u => { try { return new URL(u, PAGE_URL).toString() } catch (e) { return null } })
		.filter(u => u && u.startsWith(ORIGIN))
	console.log('  引用 ' + refs.length + ' 个')
	for (const u of refs) await check(u, 'html')

	/* ② css 里的 url() —— 再跑一层 */
	const cssUrls = []
	for (const r of rows.filter(r => /\.css$/.test(r.url) && r.status === '一致')) {
		const local = fs.readFileSync(r.local, 'utf8')
		const base = r.url.replace(/[^/]+$/, '')          /* 线上同目录 */
		for (const m of local.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
			const v = m[1]
			if (/^data:/.test(v)) continue
			const abs = v.startsWith('http') ? v : (v.startsWith('/') ? ORIGIN + v : base + v)
			cssUrls.push(abs)
		}
	}
	console.log('  css 内 url() 共 ' + cssUrls.length + ' 个')
	for (const u of cssUrls) await check(u, 'css')

	/* ③ 汇总 */
	const bad = rows.filter(r => r.status !== '一致')
	console.log('\n=== 结果 ===')
	console.log('  检查 ' + rows.length + ' 项，非一致 ' + bad.length + ' 项')
	for (const r of bad) console.log('  ✗ [' + r.label + '] ' + r.status + '  ' + r.url)
	if (!bad.length) console.log('  ✅ 线上与本地资源完全一致（字节级）')

	/* ④ 逐类统计 */
	const byLabel = {}
	for (const r of rows) { byLabel[r.label] = byLabel[r.label] || { ok: 0, bad: 0 }; r.status === '一致' ? byLabel[r.label].ok++ : byLabel[r.label].bad++ }
	console.log('\n  分类：' + Object.entries(byLabel).map(([k, v]) => k + '=' + v.ok + '/' + (v.ok + v.bad)).join('  '))
})().catch(e => console.log('失败: ' + (e && e.stack || e)))
