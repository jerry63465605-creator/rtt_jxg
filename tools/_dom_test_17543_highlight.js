/*
 * 真 DOM 验证：17543《雷达》只在【美国海军被移除】时高亮；同盟非美国部队被移除时不得高亮。
 *
 * 用 jsdom 加载真实 play.html + play.js，分别渲染两个局面的 Allies view，
 * 检查桌面状态区里 17543 卡片的 `ready` 类（客户端就靠它高亮）。
 *
 * 前置：npm i jsdom --no-save
 * 用法：node tools/_dom_test_17543_highlight.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) {
	console.log('⚠ 未安装 jsdom。请先：npm i jsdom --no-save'); process.exit(2)
}

function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	let c = (g.hands['美国'] || []).find(x => faceOf(x) === '17543')
	if (!c) {
		R.action(g, 'Allies', 'debug_add_card', { face: '17543', nation: '美国', dest: 'hand' })
		I.refresh(g)
		c = (g.hands['美国'] || []).find(x => faceOf(x) === '17543')
	}
	R.action(g, 'Allies', 'play_card', { card: c })
	if (g.us_depression_discard && g.us_depression_discard.pending) {
		const pay = (g.hands['美国'] || []).find(x => faceOf(x) !== '17543')
		R.action(g, 'Allies', 'us_depression_discard', { card: pay })
	}
	I.refresh(g)
	return g
}

/* ① 英国陆军被移除 */
const gA = setup()
R.action(gA, 'Allies', 'debug_place', { piece: 'uk_a1', nation: '英国', type: 'army', space: d.id_of('西欧') })
I.refresh(gA)
I.eliminate_piece(gA, '德国', d.id_of('西欧'), 'uk_a1', { type: 'army' })

/* ② 美国海军被移除 */
const gB = setup()
R.action(gB, 'Allies', 'debug_place', { piece: 'us_n1', nation: '美国', type: 'navy', space: d.id_of('北海') })
I.refresh(gB)
I.eliminate_piece(gB, '德国', d.id_of('北海'), 'us_n1', { type: 'navy' })

const htmlPath = path.join(MOD, 'play.html')
const dom = new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
	runScripts: 'dangerously',
	resources: 'usable',
	url: 'file:///' + htmlPath.replace(/\\/g, '/'),
	pretendToBeVisual: true,
	beforeParse(win) {
		win.player = 'Allies'
		win.me = null
		win.players = []
		win.game_id = 0
		win.view = null
		win.__sent = []
		win.send_action = (n, a) => win.__sent.push({ name: n, arg: a })
		win.send_query = (q, p) => win.setTimeout(() => { try { win.on_reply(q, null) } catch (e) {} }, 0)
		win.send_chat = () => {}
		win.update_log = () => {}
	}
})
const win = dom.window
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitLoad = (ms = 8000) => new Promise((resolve, reject) => {
	if (win.document.readyState === 'complete') return resolve()
	const t = win.setTimeout(() => reject(new Error('加载超时')), ms)
	win.addEventListener('load', () => { win.clearTimeout(t); resolve() })
})

function radarEl() {
	const els = [...win.document.querySelectorAll('[data-card]')]
		.filter(el => faceOf(el.dataset.card) === '17543')
	return els[0] || null
}

;(async () => {
	await waitLoad()
	ok('真实 play.html + play.js 已加载', typeof win.on_update === 'function')

	/* ① 英国陆军被移除 */
	win.view = R.view(gA, 'Allies')
	win.on_update()
	await sleep(120)
	{
		const el = radarEl()
		const cls = el ? el.className : '(无元素)'
		console.log('  [英国陆军被移除] 雷达元素 class = ' + JSON.stringify(cls))
		ok('雷达卡片已渲染', !!el)
		ok('★★ 不高亮（无 ready 类）', !!(el && !/\bready\b/.test(el.className)), cls)
	}

	/* ② 美国海军被移除 */
	win.view = R.view(gB, 'Allies')
	win.on_update()
	await sleep(120)
	{
		const el = radarEl()
		const cls = el ? el.className : '(无元素)'
		console.log('  [美国海军被移除] 雷达元素 class = ' + JSON.stringify(cls))
		ok('★★ 高亮（有 ready 类）', !!(el && /\bready\b/.test(el.className)), cls)
	}

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	dom.window.close()
	process.exitCode = fail ? 1 : 0
})().catch(e => { console.log('  ✗ 运行异常: ' + (e && e.stack || e)); process.exitCode = 1 })
