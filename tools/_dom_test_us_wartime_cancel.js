/*
 * 真 DOM 验证：B35 后 17513《战时生产委员会》改由【状态卡发动后的强制窗口】打出。
 *
 * A ★★ view.pending_status_ask(kind=wartime) 渲染出「打出 / 放弃」两个按钮
 * B ★★ 点「打出」→ send_action('use_wartime_window')
 * C ★★ 点「放弃」→ send_action('skip_status_ask')
 * D ★  旧 #us_wartime_modal（二级选卡弹窗）不再显示
 *
 * 旧版测的是 #us_wartime_modal + cancel_us_wartime / resolve_us_wartime，
 * 2026-11-11 B35 取消手牌主动打出与二级弹窗后按新口径重写。
 *
 * 用法：node tools/_dom_test_us_wartime_cancel.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const view = {
	armed_offer: null, pending_battle: null, pending_trigger: null,
	table_status: [], hand: [], spaces: {}, pieces: [], pieces_by_id: {},
	log: [], actions: { use_wartime_window: 1, skip_status_ask: 1 },
	us_wartime: null,
	pending_status_ask: {
		kind: 'wartime', card: '17513#1', name: '战时生产委员会',
		desc: '损耗 1 张牌：使刚发动的那张状态卡本回合可再发动 1 次',
		cost: { attrition: 1 }, nation: '美国',
		target_card: '17547#1', target_name: '人工港',
		space: null, space_name: '',
	},
}

const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8'), {
	runScripts: 'dangerously',
	url: 'http://localhost/quartermaster-sub-wars/play.html',
	pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		win.player = 'Allies'; win.me = null; win.players = []; win.game_id = 0; win.view = null
		win.sent = []
		win.send_action = (a, arg) => { win.sent.push({ a, arg }) }
		win.send_query = () => {}; win.send_chat = () => {}
		win.update_log = () => {}
		win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
	},
})
const win = dom.window
const inject = code => { const s = win.document.createElement('script'); s.textContent = code; win.document.body.appendChild(s) }
inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
	await sleep(250)
	win.view = view
	win.on_update()
	await sleep(150)

	const box = win.document.getElementById('ask_box')
	const btns = box ? [...box.querySelectorAll('button')] : []
	const labels = btns.map(b => (b.textContent || '').trim())
	console.log('  #ask_box 按钮 = ' + JSON.stringify(labels))
	ok('★★ A 强制窗口渲染出「打出 / 放弃」', labels.indexOf('打出') >= 0 && labels.indexOf('放弃') >= 0,
		JSON.stringify(labels))
	ok('★ A 文案含刚发动的状态卡名（服务端下发，客户端不二次拼）',
		!!box && /人工港/.test(box.textContent || ''), box ? (box.textContent || '').slice(0, 160) : '(无框)')

	const use = btns.find(b => (b.textContent || '').trim() === '打出')
	if (use) use.click()
	await sleep(80)
	ok('★★ B 点「打出」派发 use_wartime_window',
		(win.sent || []).filter(x => x.a === 'use_wartime_window').length === 1,
		JSON.stringify(win.sent))

	win.sent = []
	const quit = btns.find(b => (b.textContent || '').trim() === '放弃')
	if (quit) quit.click()
	await sleep(80)
	ok('★★ C 点「放弃」派发 skip_status_ask',
		(win.sent || []).filter(x => x.a === 'skip_status_ask').length === 1,
		JSON.stringify(win.sent))

	const oldModal = win.document.getElementById('us_wartime_modal')
	ok('★ D 旧二级选卡弹窗未显示', !!oldModal && oldModal.classList.contains('hide'),
		oldModal ? oldModal.className : '(无 modal)')

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
