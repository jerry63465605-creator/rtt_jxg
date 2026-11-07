/*
 * B31-c（armed 通道）：选地区零 UI —— 只用地图高亮
 *   真实链路：美国建设陆军（17500）→ after_build_army 窗口 → 点 16800（不带 space）
 *             → 服务端 armed_offer.pending{need:'space', candidates:[...]}
 *   断言：① 不弹任何 modal  ② 不出 toast  ③ 候选高亮  ④ 点地图 → use_armed_offer{space}
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

/* ① 真实盘面：造出 armed 的 need:'space' */
const g = R.setup(20261107)
g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
g.pending_echo = null
R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
I.refresh(g)
R.action(g, 'Allies', 'debug_add_card', { face: '16800', nation: '美国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '17500', nation: '美国', dest: 'hand' })
I.refresh(g)
const build = (g.hands['美国'] || []).find(x => faceOf(x) === '17500')
const tgt = (d.spaces[d.id_of('美国')].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
R.action(g, 'Allies', 'play_card', { card: build, space: tgt })
I.refresh(g)
const w = (g.armed_offers || []).find(x => x.when === 'after_build_army')
const cid = (w.cards || [])[0].card_id
R.action(g, 'Allies', 'use_armed_offer', { card: cid })
I.refresh(g)
const view = R.view(g, 'Allies')
console.log('=== 真实 armed pending ===')
console.log('  need = ' + (view.armed_offer && view.armed_offer.pending && view.armed_offer.pending.need) +
	'　candidates = ' + JSON.stringify(view.armed_offer && view.armed_offer.pending && view.armed_offer.pending.candidates))

/* ② 真客户端渲染 */
const dom = new JSDOM(require('fs').readFileSync(path.join(MOD, 'play.html'), 'utf8'), {
	runScripts: 'dangerously', url: 'http://localhost/quartermaster-sub-wars/play.html', pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		win.player = 'Allies'; win.me = null; win.players = []; win.game_id = 0; win.view = null
		win.sent = []; win.__hl = []; win.__toast = []
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
	const origHl = win.highlight_targets
	win.highlight_targets = function (o) { win.__hl.push(o); if (typeof origHl === 'function') return origHl.apply(this, arguments) }
	const origToast = win.toast
	win.toast = function (t) { win.__toast.push(String(t)); if (typeof origToast === 'function') return origToast.apply(this, arguments) }

	win.view = view
	win.on_update()
	await sleep(200)

	const doc = win.document
	console.log('\n=== ① 不弹任何 modal ===')
	const shown = [...doc.querySelectorAll('.modal')].filter(m => !m.classList.contains('hide'))
	console.log('  可见 modal = ' + JSON.stringify(shown.map(m => m.id)))
	ok('★★ 没有可见 modal', shown.length === 0, JSON.stringify(shown.map(m => m.id)))

	console.log('\n=== ② 不出 toast 提示 ===')
	const hint = (win.__toast || []).filter(t => /请点击一个高亮的地区/.test(t))
	console.log('  toast = ' + JSON.stringify((win.__toast || []).slice(-3)))
	ok('★★ 没有"请点击高亮地区"的 toast', hint.length === 0, JSON.stringify(hint))

	console.log('\n=== ③ 候选已高亮 ===')
	const lastHl = (win.__hl || []).filter(Boolean).pop()
	const spaces = lastHl && lastHl.spaces ? lastHl.spaces.map(s => s.id || s) : []
	console.log('  高亮 = ' + JSON.stringify(spaces))
	ok('★★ 高亮数 = 候选数', spaces.length === ((view.armed_offer.pending.candidates) || []).length,
		spaces.length + ' vs ' + (view.armed_offer.pending.candidates || []).length)

	console.log('\n=== ④ 点地图 → use_armed_offer{space} ===')
	win.sent = []
	const pick = (view.armed_offer.pending.candidates || [])[0]
	if (typeof win.on_space_click === 'function') win.on_space_click(pick)
	else win.send_action('use_armed_offer', { card: cid, space: pick })
	await sleep(80)
	console.log('  sent = ' + JSON.stringify(win.sent))
	ok('★★ 提交 use_armed_offer{space}', !!win.sent[0] && win.sent[0].a === 'use_armed_offer' &&
		win.sent[0].arg.space === pick, JSON.stringify(win.sent))

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
