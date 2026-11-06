/* 抓线上当前 5 个核心文件，报告大小/行数/版本串/关键标记 + Last-Modified */
const fs = require('fs')
const path = require('path')
const https = require('https')

const BASE = 'https://test.genie-rttcn.top/pre/quartermaster-sub-wars'
const OUT = path.join(__dirname, '..', 'tmp', 'online_now')
fs.mkdirSync(OUT, { recursive: true })

const get = (url, depth = 0) => new Promise((res, rej) => {
	if (depth > 4) return rej(new Error('redirect'))
	https.get(url, r => {
		if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location)
			return res(get(new URL(r.headers.location, url).toString(), depth + 1))
		const b = []
		r.on('data', c => b.push(c))
		r.on('end', () => res({ code: r.statusCode, buf: Buffer.concat(b), hdr: r.headers }))
	}).on('error', rej)
})

const FILES = ['play.html', 'play.css', 'play.js', 'rules.js', 'data.js', 'layout.js', 'create.html']

const marks = [
	['日志栏（外部 UI 交付）', /log_panel/],
	['友军手牌区 ally_hands', /ally_hands/],
	['空弹框 update_pending_echo_box', /update_pending_echo_box/],
	['状态卡主动发动 activate_status', /activate_status/],
	['turn_owner（S1）', /turn_owner/],
	['is_empty_echo_frame（15209 修复）', /is_empty_echo_frame/],
	['precheck_launch_battle（S2-b）', /precheck_launch_battle/],
	['hand_viewer_for（手牌保密）', /hand_viewer_for/],
]

;(async () => {
	for (const f of FILES) {
		const r = await get(BASE + '/' + f)
		const out = path.join(OUT, f)
		if (r.code === 200) fs.writeFileSync(out, r.buf)
		const text = r.buf.toString('utf8')
		const lines = text.split('\n').length
		const vers = [...new Set([...text.matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]
		console.log(String(r.code).padEnd(4) + f.padEnd(12) + String(r.buf.length).padStart(9) + ' B  ' +
			String(lines).padStart(6) + ' 行' +
			(vers.length ? '  v=' + JSON.stringify(vers) : '') +
			'  LM=' + (r.hdr['last-modified'] || '-'))
	}

	console.log('\n=== 线上 play.js 关键标记 ===')
	const pj = fs.readFileSync(path.join(OUT, 'play.js'), 'utf8')
	for (const [n, re] of marks) console.log('  ' + (re.test(pj) ? '✅' : '❌') + ' ' + n)

	console.log('\n=== 线上 play.js 顶层函数数 / 行数 ===')
	console.log('  行数=' + pj.split('\n').length + '  顶层 function=' + (pj.match(/^function /gm) || []).length)

	console.log('\n=== 线上 rules.js 关键标记 ===')
	const rj = fs.readFileSync(path.join(OUT, 'rules.js'), 'utf8')
	for (const [n, re] of marks.slice(4)) console.log('  ' + (re.test(rj) ? '✅' : '❌') + ' ' + n)
})().catch(e => console.log('失败: ' + (e && e.stack || e)))
