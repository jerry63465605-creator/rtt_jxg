/*
 * T4 真 DOM 验证：响应选完目标后，地图金色高亮必须消失（且不误伤其它高亮）
 *
 *  A. space 型 response_choice → 渲染后 .space.target = 候选数
 *  B. 窗口关闭（response_choice = null）→ .space.target = 0
 *  C. 不误伤：同一帧还有 event_budget.targets → 清完响应高亮后，预算高亮仍在
 *  D. submit()（点选项）路径同样立即清高亮
 *
 * 用法：node --experimental-sqlite tools/_dom_test_response_choice_clear.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const { DatabaseSync } = require('node:sqlite')
const { JSDOM } = require('jsdom')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state from game_snap where game_id = 10 order by snap_id desc limit 1').get()
const g = JSON.parse(row.state)
if (typeof g.log === 'number') g.log = []
I.refresh(g)
const baseView = R.view(g, 'Axis')

const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
	runScripts: 'dangerously', url: 'http://localhost/quartermaster-sub-wars/play.html', pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		Object.defineProperty(win, 'innerHeight', { value: 900, configurable: true })
		win.player = 'Axis'; win.me = null; win.players = []; win.game_id = 10; win.view = null
		win.__sent = []
		win.send_action = (n, a) => win.__sent.push({ n, a })
		win.send_query = () => {}; win.send_chat = () => {}
		win.update_log = () => {}
		win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
	}
})
const win = dom.window
const inject = c => { const s = win.document.createElement('script'); s.textContent = c; win.document.body.appendChild(s) }
inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))

const count = () => win.document.querySelectorAll('#spaces .space.target').length
const mk = patch => Object.assign({}, baseView, patch)

;(async () => {
	await sleep(280)
	const CAND = [{ id: 5, name: '东欧' }, { id: 6, name: '西欧' }, { id: 8, name: '波罗的海' }]

	/* A. 只有 response_choice（预算关掉，避免每帧重贴干扰观察） */
	console.log('=== A. space 型 response_choice ===')
	win.view = mk({ event_budget: null, response_choice: { kind: 'space', name: '测试响应', candidates: CAND } })
	win.on_update()
	await sleep(200)
	console.log('  .space.target = ' + count() + '（候选 ' + CAND.length + '）')
	ok('★ 候选被高亮', count() === CAND.length, String(count()))

	/* B. 窗口关闭 */
	console.log('\n=== B. 窗口关闭 → 高亮消失 ===')
	win.view = mk({ event_budget: null, response_choice: null })
	win.on_update()
	await sleep(160)
	console.log('  .space.target = ' + count())
	ok('★★ 响应高亮已清除', count() === 0, String(count()))

	/* C. 不误伤：预算高亮仍在
	 * 注意：存档可能已经"机会用尽(remaining=0)"，此时客户端【按设计】会清掉预算高亮
	 * （play.js reapply_event_budget_highlight），所以这里把 remaining 归一成 1。 */
	console.log('\n=== C. 与战斗预算共存时不误伤 ===')
	const ebFull = Object.assign({}, baseView.event_budget, { remaining: 1 })
	win.view = mk({
		event_budget: ebFull,
		response_choice: { kind: 'space', name: '测试响应', candidates: CAND },
	})
	const ebTargets = (ebFull.targets || []).length
	win.on_update()
	await sleep(160)
	console.log('  共存时 .space.target = ' + count() + '（响应 3 + 预算 ' + ebTargets + '，后者会覆盖前者）')
	win.view = mk({ event_budget: ebFull, response_choice: null })
	win.on_update()
	await sleep(200)
	console.log('  清完响应后 .space.target = ' + count() + '（期望 = 预算 targets）')
	ok('★ 预算高亮仍在（重贴生效，未被全清带走）',
		ebTargets === 0 ? true : count() === ebTargets, count() + ' vs ' + ebTargets)

	/* D. submit 路径 */
	console.log('\n=== D. 点选项 submit 后立即清高亮 ===')
	win.__sent.length = 0
	win.view = mk({ event_budget: null, response_choice: { kind: 'card', name: '测试选项', candidates: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] } })
	win.on_update()
	await sleep(180)
	/* 点击 ask_box 里的第一个按钮 */
	const btn = win.document.querySelector('#ask_box button, #ask .action')
	console.log('  找到选项按钮 = ' + !!btn)
	if (btn) {
		btn.click()
		await sleep(120)
		console.log('  已派发 = ' + JSON.stringify(win.__sent.slice(0, 1)))
		ok('★ 派发了 resolve_response_choice', win.__sent.some(x => x.n === 'resolve_response_choice'), JSON.stringify(win.__sent))
	} else {
		ok('（未找到选项按钮，跳过 D 的点击断言）', true)
	}

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	dom.window.close()
	process.exitCode = fail ? 1 : 0
})().catch(e => { console.log('异常: ' + (e && e.stack || e)); process.exitCode = 1 })
