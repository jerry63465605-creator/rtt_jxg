/*
 * B31 真 DOM 验证：pending_echo「选地区」弹框
 *   A ★★ 显示时用 classList（去掉 hide），不再用 style.display 覆盖 flex → 保持居中
 *   B ★★ 框内列出 6 个候选地区按钮（原来只有一句"请点击地图…"，框里空荡荡）
 *   C ★★ 点候选地区 → send_action('play_card', { card, choice, space })
 *   D ★  「不发动」→ send_action('play_card', { card, __cancel_need:true })
 *   E ★  收起（pe=null）时重新带上 hide 类
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const CANDS = [25, 30, 31, 32, 40, 41]
const spaces = new Array(54).fill(null).map((_, i) => ({ id: i, name: '地区' + i }))
const view = {
	armed_offer: null, pending_battle: null, pending_trigger: null, hand: [],
	spaces, pieces: [], pieces_by_id: {}, log: [], actions: {},
	table_status: [],
	pending_echo: {
		kind: 'echo_need', step: 'space', card: '17509#12', choice: null,
		cands: CANDS, title: '《王牌飞行员帕皮·博因顿》：《王牌飞行员帕皮·博因顿》需先选择目标地区',
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
const inject = c => { const s = win.document.createElement('script'); s.textContent = c; win.document.body.appendChild(s) }
inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
	await sleep(250)
	const d = win.document
	win.view = view
	win.on_update()
	await sleep(150)

	const modal = d.getElementById('pending_echo_modal')
	console.log('=== A. 显隐走 classList（保持 flex 居中）===')
	console.log('  class = ' + modal.className + '　inline display = ' + JSON.stringify(modal.style.display))
	ok('★★ 显示时不含 hide', !modal.classList.contains('hide'), modal.className)
	ok('★★ 没有被 inline display 覆盖（否则失去居中）', !modal.style.display || modal.style.display === '',
		JSON.stringify(modal.style.display))

	console.log('\n=== B. 框内列出候选地区按钮 ===')
	const candBtns = [...modal.querySelectorAll('.echo-cand')]
	console.log('  候选按钮数 = ' + candBtns.length + '　例：' + candBtns.slice(0, 3).map(b => b.textContent).join('/'))
	ok('★★ 候选按钮数 = 6', candBtns.length === CANDS.length, String(candBtns.length))

	console.log('\n=== C. 点候选 → 提交 play_card{card, choice, space} ===')
	win.sent = []
	if (candBtns[0]) candBtns[0].click()
	await sleep(60)
	console.log('  sent = ' + JSON.stringify(win.sent))
	const s0 = win.sent[0]
	ok('★★ 提交了正确的 space', !!s0 && s0.a === 'play_card' && CANDS.indexOf(s0.arg.space) >= 0,
		JSON.stringify(s0))

	console.log('\n=== D. 「不发动」===')
	win.view = JSON.parse(JSON.stringify(view))
	win.on_update()
	await sleep(100)
	win.sent = []
	const cancel = [...d.querySelectorAll('#pending_echo_modal button')].find(b => (b.textContent || '').trim() === '不发动')
	if (cancel) cancel.click()
	await sleep(60)
	console.log('  sent = ' + JSON.stringify(win.sent))
	ok('★ 派发 __cancel_need', !!win.sent[0] && win.sent[0].arg && win.sent[0].arg.__cancel_need === true,
		JSON.stringify(win.sent))

	console.log('\n=== E. 收起时加回 hide ===')
	win.view = Object.assign({}, view, { pending_echo: null })
	win.on_update()
	await sleep(100)
	console.log('  class = ' + modal.className + '　display = ' + JSON.stringify(modal.style.display))
	ok('★ 收起后带 hide', modal.classList.contains('hide'), modal.className)

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
