/*
 * 「本地显示 = 线上显示」结构级证明：
 *   用【同一份 view】分别渲染「线上 play.html」与「本地 play.html」（两者注入同一份 play.js），
 *   然后对比渲染后的 DOM 结构（元素数 / class 分布 / 关键面板文本）。
 *
 * 用法：node --experimental-sqlite tools/_dom_parity.js
 */
const fs = require('fs')
const path = require('path')
const https = require('https')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const ORIGIN = 'https://test.genie-rttcn.top'

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

const get = url => new Promise((res, rej) => {
	https.get(url, r => { const b = []; r.on('data', c => b.push(c)); r.on('end', () => res({ code: r.statusCode, buf: Buffer.concat(b) })) }).on('error', rej)
})

/* 取真实盘面（game 8 最新快照） */
function realView() {
	const { DatabaseSync } = require('node:sqlite')
	const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
	const row = db.prepare('select state from game_snap where game_id = 8 order by snap_id desc limit 1').get()
	if (!row) throw new Error('game 8 无快照')
	const g = JSON.parse(row.state)
	if (typeof g.log === 'number') g.log = []
	const R = require(path.join(MOD, 'rules.js'))
	R._internal.refresh(g)
	return { g, view: R.view(g, 'Axis'), R }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function render(html, tag) {
	const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
		runScripts: 'dangerously',
		url: 'http://localhost/quartermaster-sub-wars/play.html',
		pretendToBeVisual: true,
		beforeParse(win) {
			Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
			win.player = 'Axis'; win.me = null; win.players = []; win.game_id = 8; win.view = null
			win.send_action = () => {}; win.send_query = () => {}; win.send_chat = () => {}
			win.update_log = () => {}
			win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
		}
	})
	const win = dom.window
	const inject = code => { const s = win.document.createElement('script'); s.textContent = code; win.document.body.appendChild(s) }
	inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
	inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
	inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))
	await sleep(260)
	return { dom, win }
}

const classesOf = win => {
	const m = new Map()
	for (const el of win.document.querySelectorAll('*')) {
		const c = (el.className || '').toString().trim()
		if (!c) continue
		for (const k of c.split(/\s+/)) m.set(k, (m.get(k) || 0) + 1)
	}
	return m
}

;(async () => {
	const { view } = realView()
	console.log('view: my_nation=' + view.my_nation + '  turn=' + view.turn +
		'  部队=' + Object.keys(view.pieces || {}).length)

	const onHtml = (await get(ORIGIN + '/pre/quartermaster-sub-wars/play.html')).buf.toString('utf8')
	const loHtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')

	const A = await render(onHtml, 'online')
	const B = await render(loHtml, 'local')
	for (const x of [A, B]) { x.win.view = view; x.win.on_update(); await sleep(220) }

	const stat = win => ({
		nodes: win.document.querySelectorAll('*').length,
		ids: win.document.querySelectorAll('[id]').length,
		classes: classesOf(win),
	})
	const a = stat(A.win), b = stat(B.win)
	console.log('\n=== 规模 ===')
	console.log('  元素数   线上 ' + a.nodes + '   本地 ' + b.nodes + (a.nodes === b.nodes ? '  ✅' : '  ⚠'))
	console.log('  带 id 元素 线上 ' + a.ids + '   本地 ' + b.ids + (a.ids === b.ids ? '  ✅' : '  ⚠'))

	const keys = new Set([...a.classes.keys(), ...b.classes.keys()])
	const diff = []
	for (const k of keys) {
		const x = a.classes.get(k) || 0, y = b.classes.get(k) || 0
		if (x !== y) diff.push(k + ': 线上' + x + ' / 本地' + y)
	}
	console.log('\n=== class 分布差异（共 ' + diff.length + ' 项）===')
	diff.slice(0, 20).forEach(d => console.log('  ' + d))
	if (!diff.length) console.log('  ✅ 完全一致')

	/* 关键面板文本对比 */
	const pick = (win, sel) => {
		const el = win.document.querySelector(sel)
		return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) : '(无)'
	}
	console.log('\n=== 关键面板文本 ===')
	for (const sel of ['#score_panel', '#phase_panel', '#hand_cards', '#log_panel', '#roles']) {
		const x = pick(A.win, sel), y = pick(B.win, sel)
		console.log('  ' + sel.padEnd(14) + (x === y ? '✅ ' : '⚠  ') + '线上=' + JSON.stringify(x.slice(0, 46)) +
			(x === y ? '' : '  本地=' + JSON.stringify(y.slice(0, 46))))
	}

	A.dom.window.close(); B.dom.window.close()
	const okAll = a.nodes === b.nodes && !diff.length
	console.log('\n' + (okAll ? '✅ 结构级一致：本地渲染结果与线上相同' : '⚠ 存在结构差异，见上'))
	process.exitCode = okAll ? 0 : 1
})().catch(e => { console.log('异常: ' + (e && e.stack || e)); process.exitCode = 2 })
