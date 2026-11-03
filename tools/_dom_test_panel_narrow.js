/*
 * 真 DOM 验证（窄屏 ≤800px）：日志栏 / 侧栏默认关闭、面板自带关闭按钮、窄屏不写 localStorage。
 *
 * 背景（玩家报的卡死）：窄屏下 #log_panel 是 position:fixed 覆盖层（z-index:940），
 * 若默认打开、又被 localStorage 记住，就会一直顶着左上角把地图盖住，且没有关闭入口。
 *
 * 前置：npm i jsdom --no-save
 * 用法：node tools/_dom_test_panel_narrow.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) {
	console.log('⚠ 需要 jsdom：npm i jsdom --no-save'); process.exit(2)
}

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

const g = R.setup(7)
g.opening = null
I.refresh(g)
const view = R.view(g, 'Allies')

const htmlPath = path.join(MOD, 'play.html')
const dom = new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
	runScripts: 'dangerously',
	url: 'http://localhost/quartermaster-sub-wars/play.html',
	pretendToBeVisual: true,
	beforeParse(win) {
		/* 窄屏：jsdom 的 innerWidth 默认 1024，这里钉死 700 */
		Object.defineProperty(win, 'innerWidth', { value: 700, configurable: true })
		Object.defineProperty(win, 'innerHeight', { value: 900, configurable: true })
		win.player = 'Allies'
		win.me = null
		win.players = []
		win.game_id = 0
		win.view = null
		win.send_action = () => {}
		win.send_query = () => {}
		win.send_chat = () => {}
		win.update_log = () => {}
		win.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} })
	}
})
const win = dom.window

const inject = code => {
	const s = win.document.createElement('script')
	s.textContent = code
	win.document.body.appendChild(s)
}
inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))

const sleep = ms => new Promise(r => setTimeout(r, ms))
const $ = id => win.document.getElementById(id)

;(async () => {
	await sleep(250)
	ok('play.js 已加载', typeof win.on_update === 'function')
	win.view = view
	win.on_update()
	await sleep(150)

	/* ① 默认关闭 */
	ok('★★ 窄屏：日志栏默认隐藏（#log_panel 带 hide）',
		!!($('log_panel') && $('log_panel').classList.contains('hide')),
		JSON.stringify($('log_panel') && $('log_panel').className))
	ok('★ 窄屏：右侧栏默认隐藏（aside.hidden）',
		!!win.document.querySelector('aside').hidden,
		String(win.document.querySelector('aside').hidden))
	ok('日志按钮未处于"开"状态',
		!!($('btn_log') && !$('btn_log').classList.contains('on')))

	/* ② 打开 → 有面板内关闭按钮 → 能关掉 */
	win.toggle_log()
	await sleep(80)
	ok('★ 打开后日志栏可见', !!($('log_panel') && !$('log_panel').classList.contains('hide')))
	ok('★★ 面板内存在关闭按钮 #log_close', !!$('log_close'))
	$('log_close').click()
	await sleep(80)
	ok('★★ 点 #log_close 能关掉（不再只能刷新）',
		!!($('log_panel') && $('log_panel').classList.contains('hide')),
		JSON.stringify($('log_panel') && $('log_panel').className))

	/* ③ 窄屏互斥：开日志会把侧栏关掉 */
	win.aside_open = true
	win.apply_aside()
	win.toggle_log()
	await sleep(80)
	ok('★ 窄屏开日志 → 侧栏自动关闭（避免左右夹死地图）',
		!!win.document.querySelector('aside').hidden, String(win.document.querySelector('aside').hidden))
	win.toggle_log()

	/* ④ 窄屏不持久化 */
	const keys = Object.keys(win.localStorage)
	console.log('  localStorage keys = ' + JSON.stringify(keys))
	ok('★ 窄屏不写 qm_log_open_m（否则下次进来又顶着）',
		keys.every(k => k.indexOf('qm_log_open') < 0), JSON.stringify(keys))

	dom.window.close()

	/* ⑤ 桌面（>800px）口径保持不变：日志栏默认常驻 */
	console.log('\n=== 桌面（1400px）===')
	const dom2 = new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
		runScripts: 'dangerously',
		url: 'http://localhost/quartermaster-sub-wars/play.html',
		pretendToBeVisual: true,
		beforeParse(w) {
			Object.defineProperty(w, 'innerWidth', { value: 1400, configurable: true })
			Object.defineProperty(w, 'innerHeight', { value: 900, configurable: true })
			w.player = 'Allies'; w.me = null; w.players = []; w.game_id = 0; w.view = null
			w.send_action = () => {}; w.send_query = () => {}; w.send_chat = () => {}
			w.update_log = () => {}
			w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
		}
	})
	const w2 = dom2.window
	const inject2 = code => { const s = w2.document.createElement('script'); s.textContent = code; w2.document.body.appendChild(s) }
	inject2(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
	inject2(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
	inject2(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))
	await sleep(250)
	w2.view = view
	w2.on_update()
	await sleep(150)
	ok('★ 桌面：日志栏默认常驻（不带 hide）',
		!!(w2.document.getElementById('log_panel') && !w2.document.getElementById('log_panel').classList.contains('hide')),
		JSON.stringify(w2.document.getElementById('log_panel') && w2.document.getElementById('log_panel').className))
	ok('★ 桌面：面板内关闭按钮同样可用',
		!!w2.document.getElementById('log_close'))
	dom2.window.close()

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})().catch(e => { console.log('  ✗ 异常: ' + (e && e.stack || e)); process.exitCode = 1 })
