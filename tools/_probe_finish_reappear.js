/*
 * 复现「点「结束《伞兵》」后左上角框再现并卡死」
 *   ① 取 game 10 最新存档（event_budget 存在、pending_echo 是空框）
 *   ② 真实发 event_finish
 *   ③ 看 g / view 的每个窗口字段 + actions
 *   ④ 用真实客户端渲染，看哪个元素变为可见
 *
 * 用法：node --experimental-sqlite tools/_probe_finish_reappear.js [gameId] [role]
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const GID = Number(process.argv[2] || 10)
const ROLE = process.argv[3] || 'Axis'
const { DatabaseSync } = require('node:sqlite')

const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state, snap_id from game_snap where game_id = ? order by snap_id desc limit 1').get(GID)
const base = JSON.parse(row.state)
if (typeof base.log === 'number') base.log = []

const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const clone = o => JSON.parse(JSON.stringify(o))
const acts = v => Object.keys(v.actions || {})

const g0 = clone(base)
I.refresh(g0)
console.log('=== 初始（snap#' + row.snap_id + '）===')
console.log('  event_budget   = ' + JSON.stringify(g0.event_budget && { card: g0.event_budget.card_id, remaining: g0.event_budget.remaining }))
console.log('  pending_echo   = ' + JSON.stringify(g0.pending_echo && { card: g0.pending_echo.card, kind: g0.pending_echo.kind, step: g0.pending_echo.step, options: g0.pending_echo.options, cands: g0.pending_echo.cands }))
let v0
try { v0 = R.view(g0, ROLE) } catch (e) { console.log('  view 异常: ' + e.message) }
if (v0) {
	console.log('  view.pending_echo = ' + JSON.stringify(v0.pending_echo && { kind: v0.pending_echo.kind, step: v0.pending_echo.step }))
	console.log('  view.actions = ' + JSON.stringify(acts(v0)))
}

/* 真实点「结束《伞兵》」 */
const g = clone(base)
I.refresh(g)
const n0 = (g.log || []).length
R.action(g, ROLE, 'event_finish', {})
console.log('\n=== 点「结束《伞兵》」之后 ===')
console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
console.log('  event_budget   = ' + JSON.stringify(g.event_budget))
console.log('  pending_echo   = ' + JSON.stringify(g.pending_echo && { card: g.pending_echo.card, kind: g.pending_echo.kind, step: g.pending_echo.step, options: g.pending_echo.options, cands: g.pending_echo.cands }))
const v = R.view(g, ROLE)
console.log('  view.pending_echo = ' + JSON.stringify(v.pending_echo && { kind: v.pending_echo.kind, step: v.pending_echo.step, options: v.pending_echo.options, cands: v.pending_echo.cands }))
console.log('  view.actions = ' + JSON.stringify(acts(v)))

/* 其余挂起也列一下 */
const pend = {}
for (const k of Object.keys(g)) {
	if (!/^pending_|armed_offers$|status_instant$|response_|event_budget$|delegate$|su_|us_|uk_/.test(k)) continue
	const x = g[k]
	if (x == null || (Array.isArray(x) && !x.length) || (typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length)) continue
	pend[k] = Array.isArray(x) ? 'array(' + x.length + ')' : (typeof x === 'object' ? Object.keys(x).slice(0, 5) : x)
}
console.log('\n  服务端剩余挂起 = ' + JSON.stringify(pend))

/* 渲染看元素 */
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('\n（无 jsdom，跳过渲染）'); process.exit(0) }
const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
	runScripts: 'dangerously', url: 'http://localhost/quartermaster-sub-wars/play.html', pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		Object.defineProperty(win, 'innerHeight', { value: 900, configurable: true })
		win.player = ROLE; win.me = null; win.players = []; win.game_id = GID; win.view = null
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
setTimeout(() => {
	win.view = v
	try { win.on_update() } catch (e) { console.log('  on_update 异常: ' + e.message) }
	setTimeout(() => {
		console.log('\n=== 渲染后弹框元素 ===')
		for (const id of ['pending_echo_modal', 'event_budget_box', 'ask_box', 'log_panel', 'budget_hud']) {
			const el = win.document.getElementById(id)
			if (!el) { console.log('  ' + id.padEnd(22) + ' 不存在'); continue }
			const inline = el.style && el.style.display
			console.log('  ' + id.padEnd(22) + ' class=' + JSON.stringify((el.className || '').toString()) + ' inline.display=' + JSON.stringify(inline) +
				' 文本=' + JSON.stringify((el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34)))
		}
		dom.window.close()
	}, 200)
}, 260)
