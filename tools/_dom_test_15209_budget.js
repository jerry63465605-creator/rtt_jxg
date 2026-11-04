/*
 * 真 DOM 验证（game 10 / Axis）：空的全屏弹框不再出现，预算面板可用
 *   - #pending_echo_modal 必须处于隐藏（不再用 inset:0 遮罩盖住地图）
 *   - #event_budget_box 可见，含「结束《伞兵》」按钮
 *   - 地图上有高亮目标（.space.target）
 *
 * 用法：node --experimental-sqlite tools/_dom_test_15209_budget.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

/* 取 game 10 最新快照 */
const { DatabaseSync } = require('node:sqlite')
const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state from game_snap where game_id = 10 order by snap_id desc limit 1').get()
if (!row) { console.log('game 10 无快照'); process.exit(1) }
const g = JSON.parse(row.state)
if (typeof g.log === 'number') g.log = []
const R = require(path.join(MOD, 'rules.js'))
R._internal.refresh(g)
const view = R.view(g, 'Axis')
console.log('view: my_nation=' + view.my_nation +
	'  pending_echo=' + JSON.stringify(view.pending_echo && view.pending_echo.kind) +
	'  event_budget=' + JSON.stringify(view.event_budget && { remaining: view.event_budget.remaining, targets: (view.event_budget.targets || []).length }))

const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
	runScripts: 'dangerously',
	url: 'http://localhost/quartermaster-sub-wars/play.html',
	pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		win.player = 'Axis'; win.me = null; win.players = []; win.game_id = 10; win.view = null
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

const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
	await sleep(260)
	win.view = view
	win.on_update()
	await sleep(220)

	const pe = win.document.getElementById('pending_echo_modal')
	const eb = win.document.getElementById('event_budget_box')
	console.log('  #pending_echo_modal class=' + JSON.stringify(pe && pe.className) + ' style.display=' + JSON.stringify(pe && pe.style.display))
	console.log('  #event_budget_box class=' + JSON.stringify(eb && eb.className) + ' 文本=' + JSON.stringify(eb && (eb.textContent || '').slice(0, 60)))

	ok('★★ 空的全屏弹框不再显示', !!pe && (pe.classList.contains('hide') || pe.style.display === 'none'),
		JSON.stringify({ cls: pe && pe.className, disp: pe && pe.style.display }))
	ok('★ 预算面板可见', !!eb && !eb.classList.contains('hide'), eb && eb.className)
	ok('★★ 预算面板含「结束《伞兵》」按钮', !!eb && /结束《伞兵》/.test(eb.textContent || ''),
		JSON.stringify((eb && eb.textContent || '').slice(0, 80)))
	const hl = win.document.querySelectorAll('#spaces .space.target, #spaces .space.pickable')
	console.log('  地图高亮格数=' + hl.length)
	ok('★ 地图上有可点的高亮目标', hl.length > 0, String(hl.length))
	ok('日志栏/地图未被遮罩（body 无 modal-open 之类锁）',
		!(win.document.body.classList.contains('modal-open')), win.document.body.className)

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	dom.window.close()
	process.exitCode = fail ? 1 : 0
})().catch(e => { console.log('  ✗ 异常: ' + (e && e.stack || e)); process.exitCode = 1 })
