/*
 * 排查「线上客户端 UI 重复」：抓线上 play.html / play.js，找重复 id、重复容器、
 * 以及会重复注入 DOM 的初始化代码（公共层 client.js 被跑两次之类）。
 *
 * 用法：node tools/_inspect_ui_dup.js [baseUrl]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const BASE = (process.argv[2] || 'https://test.genie-rttcn.top/pre').replace(/\/$/, '')
const MOD = '/quartermaster-sub-wars'
const OUT = path.join(__dirname, '..', 'tmp', 'ui_dup')

const get = (url, depth = 0) => new Promise((resolve, reject) => {
	if (depth > 4) return reject(new Error('too many redirects'))
	const lib = url.startsWith('https') ? https : http
	lib.get(url, res => {
		if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
			return resolve(get(new URL(res.headers.location, url).toString(), depth + 1))
		const b = []
		res.on('data', c => b.push(c))
		res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(b).toString('utf8') }))
	}).on('error', reject)
})

const norm = s => s.replace(/\r\n/g, '\n')

;(async () => {
	fs.mkdirSync(OUT, { recursive: true })
	const files = {}
	for (const f of ['play.html', 'play.js', 'play.css', '../common/client.js', '../common/client.css']) {
		const url = BASE + MOD + '/' + f
		const r = await get(url)
		const name = path.basename(f)
		files[name] = norm(r.body)
		fs.writeFileSync(path.join(OUT, name), norm(r.body))
		console.log('抓取 ' + f + ' -> HTTP ' + r.status + '  ' + r.body.length + ' 字符')
	}

	const html = files['play.html'] || ''
	const js = files['play.js'] || ''
	const cjs = files['client.js'] || ''

	/* ① 重复 id */
	const ids = [...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1])
	const cnt = {}
	ids.forEach(i => { cnt[i] = (cnt[i] || 0) + 1 })
	const dup = Object.keys(cnt).filter(k => cnt[k] > 1)
	console.log('\n=== play.html ===')
	console.log('  id 总数 ' + ids.length + '，重复：' + JSON.stringify(dup.map(k => k + '×' + cnt[k])))
	console.log('  <main> ×' + (html.match(/<main/g) || []).length +
		'  <body> ×' + (html.match(/<body/g) || []).length +
		'  #mapwrap ×' + (html.match(/id="mapwrap"/g) || []).length +
		'  #map ×' + (html.match(/id="map"/g) || []).length +
		'  #spaces ×' + (html.match(/id="spaces"/g) || []).length)

	console.log('\n  顶层容器（首个字符非空白的 block 标签）:')
	html.split('\n').forEach((l, i) => {
		const t = l.trim()
		if (/^<(div|main|section|header|aside|nav|body|template)\b/.test(t) && !/^\t{2}/.test(l))
			console.log('    L' + (i + 1) + ': ' + t.slice(0, 100))
	})

	/* ② 公共层脚本引用次数（同文件内应各 1 次） */
	const refs = name => (html.match(new RegExp('(?:src|href)="[^"]*' + name.replace('.', '\\.') + '[^"]*"', 'g')) || [])
	console.log('\n=== 脚本/样式引用次数 ===')
	for (const n of ['play.js', 'play.css', 'client.js', 'client.css', 'fonts.css'])
		console.log('  ' + n + ' ×' + refs(n).length + '  ' + JSON.stringify(refs(n)))

	/* ③ client.js 是否会重复包裹 DOM（pan_zoom 包装层） */
	console.log('\n=== common/client.js 关键初始化 ===')
	const guards = [
		['重复初始化保护（已有 pan_zoom_main 就跳过）', /getElementById\(["']pan_zoom_main["']\)[\s\S]{0,80}return/],
		['创建 #pan_zoom_main', /pan_zoom_main/],
		['把 main 的子节点搬进 e_inner', /while \(e_scroll\.firstChild\)/],
		['DOMContentLoaded/load 末尾自执行', /DOMContentLoaded|addEventListener\(["']load["']/],
	]
	for (const [n, re] of guards) console.log('  ' + (re.test(cjs) ? '✓' : '—') + ' ' + n)

	/* ④ play.js 里是否有"自己再造一份面板"的代码 */
	console.log('\n=== play.js 里可能重复注入的写法 ===')
	const pats = [
		['createElement("main")', /createElement\(["']main["']\)/],
		['document.body.appendChild', /document\.body\.appendChild/],
		['innerHTML += （重复追加）', /innerHTML\s*\+=/],
		['insertAdjacentHTML', /insertAdjacentHTML/],
		['重复 on_update 调用', /on_update\(\)/g],
	]
	for (const [n, re] of pats) {
		const c = (js.match(re) || []).length
		console.log('  ' + (c ? '⚠ ' : '— ') + n + ' ×' + c)
	}

	/* ⑤ 线上 play.html 与本地合并版差异（只看结构行） */
	const localPath = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.html')
	if (fs.existsSync(localPath)) {
		const lo = norm(fs.readFileSync(localPath, 'utf8'))
		const idsL = [...lo.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1])
		const onlyOnline = ids.filter(x => idsL.indexOf(x) < 0)
		const onlyLocal = idsL.filter(x => ids.indexOf(x) < 0)
		console.log('\n=== 线上 vs 本地 play.html ===')
		console.log('  线上独有 id: ' + JSON.stringify([...new Set(onlyOnline)]))
		console.log('  本地独有 id: ' + JSON.stringify([...new Set(onlyLocal)]))
	}
	console.log('\n产物: ' + OUT)
})().catch(e => { console.error('失败: ' + e.message); process.exitCode = 1 })
