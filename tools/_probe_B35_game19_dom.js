/*
 * 只读：把真实对局 game=19 的 view('Allies') 灌进 jsdom + 本地 play.js，
 * 看 #ask_box 到底渲染出什么按钮、点击派发什么 action。
 * 不改盘面、不发真实动作。用法：node tools/_probe_B35_game19_dom.js [gid]
 */
const path = require('path')
const fs = require('fs')
const Database = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const db = new Database(path.join(__dirname, '..', 'server-official', 'db'), { readonly: true })
const gid = Number(process.argv[2] || 19)
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('需要 jsdom'); process.exit(2) }

const row = db.prepare('SELECT * FROM game_state WHERE game_id = ?').get(gid)
const g = JSON.parse(row.state || row.data || row.json)
const v = R.view(g, 'Allies')
console.log('view.pending_status_ask.kind = ' + v.pending_status_ask.kind)
console.log('view.actions = ' + JSON.stringify(v.actions))
console.log('view.pending_trigger = ' + JSON.stringify(v.pending_trigger))
console.log('view.response_choice = ' + JSON.stringify(v.response_choice))
console.log('view.table_status ready 数 = ' +
	(v.table_status || []).filter(s => s.ready).length)

const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8'), {
	runScripts: 'dangerously',
	url: 'http://localhost/quartermaster-sub-wars/play.html',
	pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		win.player = 'Allies'; win.me = null; win.players = []; win.game_id = gid; win.view = null
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
	win.view = v
	win.on_update()
	await sleep(200)
	const box = win.document.getElementById('ask_box')
	console.log('\n=== #ask_box 渲染结果 ===')
	console.log('className = ' + (box ? box.className : '(无框)'))
	console.log('text = ' + (box ? (box.textContent || '').replace(/\s+/g, ' ').slice(0, 300) : ''))
	const btns = box ? [...box.querySelectorAll('button')] : []
	console.log('按钮 = ' + JSON.stringify(btns.map(b => (b.textContent || '').trim())))
	for (const b of btns) {
		win.sent = []
		b.click()
		await sleep(50)
		console.log('点「' + (b.textContent || '').trim() + '」-> ' + JSON.stringify(win.sent))
	}
	/* 状态卡区是否可点（table_status） */
	const tsBox = win.document.getElementById('table_status')
	console.log('\n#table_status 存在 = ' + !!tsBox +
		'  文本 = ' + (tsBox ? (tsBox.textContent || '').replace(/\s+/g, ' ').slice(0, 200) : ''))
	db.close()
})()
