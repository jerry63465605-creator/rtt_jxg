/*
 * 真盘面 × 真客户端：15311《马奇诺防线》在英国玩家界面里能不能点得动
 *   盘面：德国对<西欧>发起陆战，移除法国陆军 → 英国 armed 窗口里同时有 15351 / 15311
 *   断言：
 *     A ★★ ask 框列出「打出《马奇诺防线》（弃 4 张）」
 *     B ★★ 点它 → 打开弃牌选牌框（echo_discard_modal），不是"点了没反应"
 *     C ★★ 选满 4 张确认 → 派发 use_armed_offer{card, drop:[4]}
 *     D ★★ 服务端接受同一提交 → 法国陆军回到<西欧>
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }
let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

/* ① 造盘面（与 _probe_15311_uk.js 同一条真实链路） */
const g = R.setup(20261107)
g.pending_battle = null; g.pending_econ = null
g.armed_offers = []; g.response_queue = []; g.response_stack = []; g.pending_echo = null
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
for (const f of ['15311', '15304', '15305', '15306', '15307']) R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
I.refresh(g)
const WE = d.id_of('西欧')
const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
I.grant_supply(g, fr, g.turn); I.refresh(g)
R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: d.id_of('德国') })
I.refresh(g)
I.grant_supply(g, 'de_atk', g.turn); I.refresh(g)
R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
I.refresh(g)
R.action(g, 'Axis', 'play_card', {
	card: (g.hands['德国'] || []).find(x => faceOf(x) === '15201'), space: WE, piece: fr,
})
I.refresh(g)

const view = R.view(g, 'Allies')
console.log('=== 盘面 ===  西欧=' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
console.log('  view.armed_offer = ' + JSON.stringify(view.armed_offer && {
	when: view.armed_offer.when, nation: view.armed_offer.nation,
	cards: (view.armed_offer.cards || []).map(c => ({ name: c.name, cost: c.cost })),
}))

/* ② 真客户端渲染 */
const dom = new JSDOM(require('fs').readFileSync(path.join(MOD, 'play.html'), 'utf8'), {
	runScripts: 'dangerously', url: 'http://localhost/quartermaster-sub-wars/play.html', pretendToBeVisual: true,
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
inject(require('fs').readFileSync(path.join(MOD, 'data.js'), 'utf8'))
inject(require('fs').readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
inject(require('fs').readFileSync(path.join(MOD, 'play.js'), 'utf8'))
const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
	await sleep(250)
	win.view = view
	win.on_update()
	await sleep(200)
	const doc = win.document

	/* A. ask 框里有没有这张卡 */
	const ask = doc.getElementById('ask_box') || doc.querySelector('#ask_box')
	const allText = doc.body.textContent || ''
	console.log('\n=== A. ask 框内容 ===')
	const btn = [...doc.querySelectorAll('button')].find(b => /马奇诺防线/.test(b.textContent || ''))
	console.log('  含"马奇诺防线"的按钮 = ' + (btn ? JSON.stringify(btn.textContent) : '(没有)'))
	ok('★★ ask 框列出「打出《马奇诺防线》（弃 4 张）」', !!btn && /弃\s*4/.test(btn.textContent || ''),
		btn ? btn.textContent : allText.slice(0, 80))

	/* B. 点它 → 弃牌框 */
	if (btn) { btn.click(); await sleep(150) }
	const discardModal = doc.getElementById('echo_discard_modal')
	console.log('\n=== B. 弃牌选牌框 ===')
	console.log('  echo_discard_modal class = ' + (discardModal ? discardModal.className : '(无元素)'))
	ok('★★ 点击后打开选牌框（不是点了没反应）',
		!!discardModal && !discardModal.classList.contains('hide'),
		discardModal ? discardModal.className : 'missing')

	/* C. 选满 4 张并确认 */
	console.log('\n=== C. 选 4 张 → 确认 ===')
	win.sent = []
	const cand = (win.pending_echo_discard && win.pending_echo_discard.drop) || null
	/* 直接构造：取英国手牌里非 15311 的 4 张（与玩家点选等价） */
	const picks = (g.hands['英国'] || []).filter(x => faceOf(x) !== '15311').slice(0, 4)
	if (win.pending_echo_discard) win.pending_echo_discard.drop = picks.slice()
	const confirmBtn = [...doc.querySelectorAll('button')].find(b => /确认|确定/.test(b.textContent || ''))
	if (confirmBtn) confirmBtn.click()
	await sleep(120)
	console.log('  sent = ' + JSON.stringify(win.sent))
	const s0 = win.sent.find(x => x.a === 'use_armed_offer')
	ok('★★ 确认后派发 use_armed_offer{card, drop:4}',
		!!s0 && Array.isArray(s0.arg.drop) && s0.arg.drop.length === 4, JSON.stringify(win.sent).slice(0, 200))

	/* D. 服务端接受同一提交 */
	console.log('\n=== D. 服务端接受同一提交 ===')
	if (s0) {
		const g2 = JSON.parse(JSON.stringify(g))
		I.refresh(g2)
		R.action(g2, 'Allies', 'use_armed_offer', { card: s0.arg.card, drop: s0.arg.drop })
		I.refresh(g2)
		const lg = (g2.log || []).slice(-3).join(' | ')
		console.log('  log = ' + lg.slice(0, 200))
		console.log('  西欧 = ' + JSON.stringify(I.pieces_on(g2, WE).map(p => g2.piece_nation[p] + '/' + g2.piece_type[p])))
		ok('★★ 法国陆军回到<西欧>', I.pieces_on(g2, WE).some(p => g2.piece_nation[p] === '法国'), lg.slice(0, 120))
	}

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
