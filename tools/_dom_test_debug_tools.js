/*
 * 真 DOM：调试面板新增控件
 *   A ★ 调试卡牌面板有「损耗」张数输入 + 执行损耗按钮 + 「复原」输入 + 复原按钮
 *   B ★★ 点「执行损耗」→ send_action('debug_attrition', {n})
 *   C ★★ 点「复原到牌库顶」→ send_action('debug_restore', {n})
 *   D ★★ 调试阶段面板「+ / −」→ send_action('debug_score', {faction, delta})
 *   E ★  非法张数（0）→ 不派发，只提示
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

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
	const d = win.document

	console.log('=== A. 控件存在 ===')
	ok('★ 损耗输入/按钮', !!d.getElementById('dbg_attrition_n') && !!d.getElementById('dbg_restore_n'))
	const btnAttr = [...d.querySelectorAll('#debug_card_panel button')].map(b => (b.getAttribute('onclick') || ''))
	console.log('  卡牌面板按钮 onclick = ' + JSON.stringify(btnAttr))
	ok('★ 有 debug_do_attrition / debug_do_restore 入口',
		btnAttr.some(x => /debug_do_attrition/.test(x)) && btnAttr.some(x => /debug_do_restore/.test(x)))
	ok('★ 阶段面板有 debug_do_score(1) / (−1)',
		[...d.querySelectorAll('#debug_phase_panel button')].map(b => b.getAttribute('onclick') || '')
			.join(' ').match(/debug_do_score\(-?1\)/g)?.length === 2)

	console.log('\n=== B. 损耗派发 ===')
	win.sent = []
	d.getElementById('dbg_attrition_n').value = '3'
	win.debug_do_attrition()
	await sleep(30)
	console.log('  sent = ' + JSON.stringify(win.sent))
	ok('★★ 派发 debug_attrition {n:3}',
		win.sent.length === 1 && win.sent[0].a === 'debug_attrition' && win.sent[0].arg.n === 3)

	console.log('\n=== C. 复原派发 ===')
	win.sent = []
	d.getElementById('dbg_restore_n').value = '2'
	win.debug_do_restore()
	await sleep(30)
	console.log('  sent = ' + JSON.stringify(win.sent))
	ok('★★ 派发 debug_restore {n:2}',
		win.sent.length === 1 && win.sent[0].a === 'debug_restore' && win.sent[0].arg.n === 2)

	console.log('\n=== D. 分数 ± ===')
	win.sent = []
	d.getElementById('dbg_score_faction').value = 'allies'
	d.getElementById('dbg_score_n').value = '2'
	win.debug_do_score(1)
	win.debug_do_score(-1)
	await sleep(30)
	console.log('  sent = ' + JSON.stringify(win.sent))
	ok('★★ 加：delta +2', win.sent[0] && win.sent[0].a === 'debug_score' &&
		win.sent[0].arg.faction === 'allies' && win.sent[0].arg.delta === 2)
	ok('★★ 减：delta -2', win.sent[1] && win.sent[1].arg.delta === -2)

	console.log('\n=== E. 非法张数不派发 ===')
	win.sent = []
	d.getElementById('dbg_attrition_n').value = '0'
	win.debug_do_attrition()
	await sleep(20)
	const hint = (d.getElementById('dbg_pile_hint') || {}).textContent || ''
	console.log('  sent=' + JSON.stringify(win.sent) + '  hint=' + hint)
	ok('★ 0 张不派发且给出提示', win.sent.length === 0 && /正整数/.test(hint))

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
