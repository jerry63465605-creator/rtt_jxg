/*
 * 复现「高亮但点不上」：用 game 10 的 Axis view 渲染，真实点击高亮格位，
 * 抓客户端到底有没有派发 event_battle、参数是什么；再把同一参数喂给引擎看服务端是否接受。
 *
 * 用法：node --experimental-sqlite tools/_dom_test_15209_click.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const { DatabaseSync } = require('node:sqlite')
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state from game_snap where game_id = 10 order by snap_id desc limit 1').get()
const gRaw = JSON.parse(row.state)
if (typeof gRaw.log === 'number') gRaw.log = []
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
I.refresh(gRaw)
const viewRaw = R.view(gRaw, 'Axis')
/* 机会用尽(remaining=0) 时客户端按设计清掉地图高亮（reapply_event_budget_highlight）；
 * 本测试验证“可点击”，所以把 remaining 归一成 1，不改服务端状态。 */
const view = JSON.parse(JSON.stringify(viewRaw))
if (view.event_budget && view.event_budget.remaining === 0) view.event_budget.remaining = 1

const eb = view.event_budget
console.log('=== view.event_budget ===')
console.log('  remaining=' + eb.remaining + ' can_finish=' + eb.can_finish + ' kind=' + eb.kind)
console.log('  targets=' + JSON.stringify(eb.targets) + '  targets 元素类型=' + JSON.stringify((eb.targets || []).map(x => typeof x)))
console.log('  initiators keys=' + JSON.stringify(Object.keys(eb.initiators || {})))
for (const t of (eb.targets || [])) {
	const inits = (eb.initiators || {})[t] || (eb.initiators || {})[String(t)] || []
	const enemies = (eb.enemies || {})[t] || (eb.enemies || {})[String(t)] || []
	console.log('    target ' + t + ' (' + d.name_of(Number(t)) + ') initiators=' + inits.length + ' enemies=' + enemies.length)
}

/* 渲染 + 真实点击 */
const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
	runScripts: 'dangerously',
	url: 'http://localhost/quartermaster-sub-wars/play.html',
	pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		win.player = 'Axis'; win.me = null; win.players = []; win.game_id = 10; win.view = null
		win.__sent = []; win.__toast = []
		win.send_action = (n, a) => win.__sent.push({ n, a })
		win.send_query = (q, p) => win.__sent.push({ query: q, p })
		win.send_chat = () => {}
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

	const els = [...win.document.querySelectorAll('#spaces .space.target')]
	console.log('\n=== 高亮格位元素 ===')
	console.log('  数量=' + els.length + '  space_id 类型=' + JSON.stringify(els.map(e => typeof e.space_id)))
	console.log('  space_id 值=' + JSON.stringify(els.map(e => e.space_id)))

	/* 依次点击，直到有派发 */
	for (const el of els) {
		win.__sent.length = 0
		win.on_click_space({ currentTarget: el })
		await sleep(120)
		if (win.__sent.length) {
			console.log('\n=== 点击 ' + JSON.stringify(el.space_id) + ' 后客户端派发 ===')
			console.log('  ' + JSON.stringify(win.__sent).slice(0, 300))
			break
		} else {
			console.log('  点 ' + JSON.stringify(el.space_id) + ' 无派发（客户端内部提前 return）')
		}
	}

	const sent = win.__sent.filter(x => x.n)
	if (!sent.length) {
		console.log('\n❌ 客户端从未派发 event_battle —— 卡在客户端侧')
		/* 打印 ask_state / battle_flow 以定位分支 */
		console.log('  ask_state=' + JSON.stringify(win.ask_state))
		console.log('  battle_flow=' + JSON.stringify(win.battle_flow && { origin: win.battle_flow.origin, step: win.battle_flow.step }))
	} else {
		/* 把客户端发的参数喂给引擎，看服务端是否接受 */
		console.log('\n=== 服务端对同参数的响应 ===')
		const g = JSON.parse(row.state)
		if (typeof g.log === 'number') g.log = []
		I.refresh(g)
		const s0 = sent[0]
		const n0 = (g.log || []).length
		R.action(g, 'Axis', s0.n, s0.a || {})
		const lg = (g.log || []).slice(n0).join(' | ')
		console.log('  log: ' + lg)
		console.log('  budget remaining=' + JSON.stringify(g.event_budget && g.event_budget.remaining))
		console.log('  pending_battle=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
		let pass = 0, fail = 0
		const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
		ok('★ 客户端派发了 event_battle（点击链通）', !!s0, JSON.stringify(sent))
		ok('★★ 服务端接受了 event_battle（不再被 pending_echo 门禁拒回）',
			!/等待你选择目标/.test(lg) && (/发起陆战|发起海战|代受待结算/.test(lg) || !!g.pending_battle ||
				(g.event_budget && g.event_budget.remaining === 0) ||
				(g.event_budget && (g.event_budget.battleOk || 0) > 0)), lg)
		console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	}
	dom.window.close()
})().catch(e => console.log('异常: ' + (e && e.stack || e)))
