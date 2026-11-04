/*
 * 用 game 10 的真实 view 渲染真实客户端，列出【当前可见】的浮层（fixed/absolute）及其位置，
 * 以及与弹框相关的状态字段——用来定位"多出来的那个框"到底是哪个元素。
 *
 * 用法：node tools/_dump_visible_panels.js [gameId] [role]
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const GID = Number(process.argv[2] || 10)
const ROLE = process.argv[3] || 'Axis'
const { DatabaseSync } = require('node:sqlite')

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state, snap_id from game_snap where game_id = ? order by snap_id desc limit 1').get(GID)
const g = JSON.parse(row.state)
if (typeof g.log === 'number') g.log = []
const R = require(path.join(MOD, 'rules.js'))
R._internal.refresh(g)
const view = R.view(g, ROLE)

console.log('=== game ' + GID + ' snap#' + row.snap_id + ' / view(' + ROLE + ') ===')
console.log('  turn=' + view.turn + ' my_nation=' + view.my_nation + ' actions=' + JSON.stringify(Object.keys(view.actions || {})))
const win2 = {}
for (const k of Object.keys(view)) {
	if (!/pending|armed|budget|choice|ask|step|echo|status_instant|delegate|response/i.test(k)) continue
	const v = view[k]
	if (v == null || (Array.isArray(v) && !v.length)) continue
	win2[k] = JSON.stringify(v).slice(0, 160)
}
console.log('  窗口类字段: ' + (Object.keys(win2).length ? '' : '（无）'))
for (const k in win2) console.log('    ' + k + ' = ' + win2[k])

const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
	runScripts: 'dangerously',
	url: 'http://localhost/quartermaster-sub-wars/play.html',
	pretendToBeVisual: true,
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

const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
	await sleep(280)
	win.view = view
	win.on_update()
	await sleep(240)

	const els = [...win.document.querySelectorAll('body *')]
	const shown = []
	for (const el of els) {
		const cs = win.getComputedStyle(el)
		if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
		if (cs.position !== 'fixed' && cs.position !== 'absolute') continue
		/* 只要"有可见内容/尺寸"的浮层 */
		const id = el.id || ''
		const cls = (el.className || '').toString()
		if (!id && !cls) continue
		shown.push({
			sel: (id ? '#' + id : '') + (cls ? '.' + cls.split(/\s+/).filter(Boolean).join('.') : ''),
			pos: cs.position, z: cs.zIndex, left: cs.left, top: cs.top, w: cs.width, h: cs.height,
			txt: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
		})
	}
	console.log('\n=== 渲染后可见的 fixed/absolute 浮层 ===')
	shown
		.filter(x => !/^(#spaces|#pieces|#map|#mapwrap)/.test(x.sel))
		.slice(0, 24)
		.forEach(x => console.log('  ' + x.sel.padEnd(34) + ' z=' + String(x.z).padEnd(5) + ' ' + x.pos +
			' left=' + x.left + ' top=' + x.top + ' ' + x.w + 'x' + x.h + '  「' + x.txt + '」'))

	/* 逐个弹框的显隐 */
	console.log('\n=== 弹框类元素状态 ===')
	for (const id of ['pending_echo_modal', 'event_budget_box', 'ask_box', 'pending_event_step_box',
		'armed_offer_box', 'response_choice_box', 'pending_trigger_box', 'budget_hud', 'log_panel']) {
		const el = win.document.getElementById(id)
		if (!el) { console.log('  ' + id.padEnd(24) + ' 不存在'); continue }
		const cs = win.getComputedStyle(el)
		console.log('  ' + id.padEnd(24) + ' class=' + JSON.stringify((el.className || '').toString()) +
			' display=' + cs.display + ' pos=' + cs.position + ' left=' + cs.left + ' top=' + cs.top)
	}
	dom.window.close()
})().catch(e => console.log('异常: ' + (e && e.stack || e)))
