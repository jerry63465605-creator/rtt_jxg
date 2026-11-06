/*
 * 真 DOM 验证：17513《战时生产委员会》弹窗必须有「不发动」按钮，
 * 点击后派发 cancel_us_wartime（卡退回手牌、不付代价）。
 *
 * A ★★ 弹窗渲染出「不发动」按钮
 * B ★★ 点击「不发动」→ send_action('cancel_us_wartime', {})
 * C ★  对照：选中一张已发动状态卡后「确认重置」仍派发 resolve_us_wartime
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
	log: [], actions: { cancel_us_wartime: 1, resolve_us_wartime: 1 },
	us_wartime: {
		candidates: [
			{ id: '17555#3', name: '大萧条的余波', used: true, img: null, text: '' },
			{ id: '16304#4', name: '中国远征军', used: false, img: null, text: '' },
		],
		waiting_for: null,
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

	const modal = win.document.getElementById('us_wartime_modal')
	ok('★ 弹窗已显示（未 hide）', !!modal && !modal.classList.contains('hide'),
		modal ? modal.className : '(无 modal)')

	const btns = [...modal.querySelectorAll('button')]
	const labels = btns.map(b => (b.textContent || '').trim())
	console.log('  按钮 = ' + JSON.stringify(labels))
	ok('★★ 有「不发动」按钮', labels.indexOf('不发动') >= 0, JSON.stringify(labels))

	const quit = btns.find(b => (b.textContent || '').trim() === '不发动')
	if (quit) quit.click()
	await sleep(80)
	const sentQuit = (win.sent || []).filter(x => x.a === 'cancel_us_wartime')
	console.log('  send_action 记录 = ' + JSON.stringify(win.sent))
	ok('★★ 点「不发动」派发 cancel_us_wartime', sentQuit.length === 1, JSON.stringify(win.sent))

	/* 对照：选中"已发动"的卡 → 确认重置仍走 resolve_us_wartime */
	win.sent = []
	const cards = [...modal.querySelectorAll('.card-grid > *')]
	console.log('  卡片元素数 = ' + cards.length)
	if (cards.length) {
		cards[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
		await sleep(80)
		const btns2 = [...win.document.querySelectorAll('#us_wartime_modal button')]
		const okBtn = btns2.find(b => (b.textContent || '').trim() === '确认重置')
		if (okBtn && !okBtn.disabled) okBtn.click()
		await sleep(80)
		const sentResolve = (win.sent || []).filter(x => x.a === 'resolve_us_wartime')
		ok('★ 确认重置仍派发 resolve_us_wartime', sentResolve.length === 1, JSON.stringify(win.sent))
	} else {
		ok('★ 确认重置仍派发 resolve_us_wartime（跳过：卡片未渲染）', false, 'cards=0')
	}

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
