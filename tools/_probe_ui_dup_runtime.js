/*
 * 运行时排查：线上 play.html + play.js 在 jsdom 里反复 on_update()，
 * 看 DOM 是否重复增长（「UI 重复 + 卡死」最典型的原因）。
 *
 * 用法：node tools/_probe_ui_dup_runtime.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) {
	console.log('⚠ 需要 jsdom：npm i jsdom --no-save'); process.exit(2)
}

const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

/* 一个"有东西可渲染"的真实局面：英国出牌阶段 + 几张手牌 + 桌面状态卡 */
function makeGame() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	return g
}
const g = makeGame()

const htmlPath = process.argv[2] || path.join(__dirname, '..', 'tmp', 'ui_dup', 'play.html')
const html = fs.readFileSync(htmlPath, 'utf8')

const dom = new JSDOM(html, {
	runScripts: 'dangerously',
	resources: undefined,          /* 不去拉网络资源（common/client.js 等由 stub 顶替） */
	url: 'http://localhost/quartermaster-sub-wars/play.html',
	pretendToBeVisual: true,
	beforeParse(win) {
		win.player = 'Allies'
		win.me = null
		win.players = []
		win.game_id = 0
		win.view = null
		win.__sent = []
		win.send_action = (n, a) => win.__sent.push({ n, a })
		win.send_query = (q, p) => win.setTimeout(() => { try { win.on_reply(q, null) } catch (e) {} }, 0)
		win.send_chat = () => {}
		win.update_log = () => {}
		/* 让 play.js 的 <script src> 不被 jsdom 去拉网络：直接注入代码 */
	}
})
const win = dom.window

/* 手动注入依赖脚本（避免依赖 jsdom 的 resources 加载）：data.js -> layout.js -> play.js */
const inject = code => {
	const s = win.document.createElement('script')
	s.textContent = code
	win.document.body.appendChild(s)
}
inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
inject(fs.readFileSync(path.join(__dirname, '..', 'tmp', 'ui_dup', 'play.js'), 'utf8'))

const sleep = ms => new Promise(r => setTimeout(r, ms))

function counts() {
	const d = win.document
	const q = s => d.querySelectorAll(s).length
	return {
		nodes: d.querySelectorAll('*').length,
		main: q('main'),
		pan_zoom: q('#pan_zoom_main'),
		phase_panel: q('#phase_panel'),
		roles: q('#roles'),
		table_status: q('#table_status'),
		hand_cards: q('#hand_cards'),
		hand_children: (d.getElementById('hand_cards') || {}).children ? d.getElementById('hand_cards').children.length : 0,
		panel_list: q('.panel-list'),
		modal: q('.modal'),
		space: q('.space'),
		unit: q('.unit'),
	}
}

;(async () => {
	await sleep(200)
	console.log('play.js 已注入，on_update 类型=' + typeof win.on_update)
	win.view = R.view(g, 'Allies')
	console.log('view.my_nation=' + win.view.my_nation +
		'  手牌=' + ((win.view.hands[win.view.my_nation] || {}).cards || []).length)

	const rows = []
	for (let i = 1; i <= 5; i++) {
		win.on_update()
		await sleep(150)
		const c = counts()
		rows.push(c)
		console.log('第 ' + i + ' 次 on_update -> ' + JSON.stringify(c))
	}

	const first = rows[0], last = rows[rows.length - 1]
	const growth = {
		nodes: last.nodes - first.nodes,
		phase_panel: last.phase_panel - first.phase_panel,
		table_status: last.table_status - first.table_status,
		hand_children: last.hand_children - first.hand_children,
		unit: last.unit - first.unit,
		space: last.space - first.space,
	}
	console.log('\n=== 5 次刷新后的增量（应为 0）===')
	console.log('  ' + JSON.stringify(growth))
	const leak = Object.keys(growth).filter(k => growth[k] > 0)
	console.log('\n结论: ' + (leak.length ? '❌ 存在重复增长: ' + leak.join(', ') : '✅ 无重复增长（DOM 稳定）'))

	dom.window.close()
})().catch(e => { console.log('异常: ' + (e && e.stack || e)); process.exitCode = 1 })
