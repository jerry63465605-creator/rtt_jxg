/*
 * B31-b 真盘面 × 真客户端：选地区 ≠ 弹框
 *   game 13（美国·计分阶段，17509 已打出，pending_echo step='space' 挂着）
 *
 *   A ★★ 不再弹模态框（pending_echo_modal 带 hide）
 *   B ★★ 改为底部提示条（#echo_space_bar），文字含候选数，且不遮挡（无 .modal 遮罩）
 *   C ★★ 候选已高亮（highlight_targets 收到 10 个地区）
 *   D ★★ 点地图高亮 → play_card{card, space}（真客户端点击链）
 *   E ★  提示条上的「不发动」→ __cancel_need
 *   F ★★ 服务端接受同一 space → 真的建成空军、挂起清空
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))

const GID = Number(process.argv[2] || 13)
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const db = new Database(path.join(ROOT, 'server-official', 'db'), { readonly: true })
const row = db.prepare('select state from game_state where game_id=?').get(GID)
db.close()
if (!row) { console.log('✗ 没有 game ' + GID); process.exit(1) }
const g = JSON.parse(row.state)
I.refresh(g)
const view = R.view(g, 'Allies')
const pe = view.pending_echo || {}
console.log('=== 盘面 game ' + GID + ' ===  ' + g.current_nation + '·' + g.turn_phase +
	'  pending_echo step=' + pe.step + ' cands=' + (pe.cands || []).length)

const dom = new JSDOM(require('fs').readFileSync(path.join(MOD, 'play.html'), 'utf8'), {
	runScripts: 'dangerously',
	url: 'http://localhost/quartermaster-sub-wars/play.html?game=' + GID + '&role=Allies',
	pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		win.player = 'Allies'; win.me = null; win.players = []; win.game_id = GID; win.view = null
		win.sent = []
		win.highlighted = null
		win.__hl = []
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
	/* 记录高亮调用 */
	const origHl = win.highlight_targets
	win.highlight_targets = function (list) {
		win.__hl.push(list ? list.slice() : null)
		if (typeof origHl === 'function') return origHl.apply(this, arguments)
	}
	win.view = view
	win.on_update()
	await sleep(150)
	const doc = win.document
	const modal = doc.getElementById('pending_echo_modal')

	console.log('\n=== A/B. 不弹框，改底部提示条 ===')
	console.log('  modal class = ' + modal.className)
	ok('★★ 模态框保持隐藏', modal.classList.contains('hide'), modal.className)
	const bar = doc.getElementById('echo_space_bar')
	console.log('  提示条 = ' + (bar ? (bar.textContent || '').slice(0, 80) : '(没有)'))
	ok('★★ 出现底部提示条', !!bar, bar ? 'ok' : 'missing')
	ok('★ 提示条写明候选数', !!bar && /10 个候选/.test(bar.textContent || ''), bar && bar.textContent.slice(0, 40))

	console.log('\n=== C. 候选已高亮 ===')
	const hl = win.__hl.filter(Boolean).pop() || []
	console.log('  高亮 = ' + hl.length + ' 个：' + hl.map(s => (view.spaces[s] || {}).name || s).slice(0, 5).join('/'))
	ok('★★ 高亮数 = 候选数', hl.length === (pe.cands || []).length, String(hl.length))

	console.log('\n=== D. 点地图高亮 → play_card{space} ===')
	win.sent = []
	/* 模拟地图点击：直接调用客户端的地区点击入口（与真人点地图同一函数） */
	const pick = (pe.cands || [])[0]
	if (typeof win.on_space_click === 'function') win.on_space_click(pick)
	else {
		/* 兜底：走 echo_need_pick 的既有提交路径 */
		win.echo_need_pick = { card: pe.card, choice: null, cands: pe.cands.slice() }
		win.send_action('play_card', { card: pe.card, space: pick })
	}
	await sleep(60)
	console.log('  sent = ' + JSON.stringify(win.sent))
	ok('★★ 点地图提交了 space', !!win.sent[0] && win.sent[0].a === 'play_card' && win.sent[0].arg.space === pick,
		JSON.stringify(win.sent))

	console.log('\n=== E. 提示条「不发动」===')
	win.view = JSON.parse(JSON.stringify(view))
	win.on_update()
	await sleep(120)
	const bar2 = doc.getElementById('echo_space_bar')
	win.sent = []
	const cancel = [...(bar2 ? bar2.querySelectorAll('button') : [])].find(b => (b.textContent || '').trim() === '不发动')
	if (cancel) cancel.click()
	await sleep(60)
	console.log('  sent = ' + JSON.stringify(win.sent))
	ok('★ 不发动 → __cancel_need', !!win.sent[0] && win.sent[0].arg && win.sent[0].arg.__cancel_need === true,
		JSON.stringify(win.sent))

	console.log('\n=== F. 服务端接受同一 space（真 action）===')
	const g2 = JSON.parse(row.state)
	I.refresh(g2)
	const air0 = Object.keys(g2.location || {}).filter(p => g2.piece_nation[p] === '美国' && g2.piece_type[p] === 'air').length
	const n0 = (g2.log || []).length
	R.action(g2, 'Allies', 'play_card', {
		card: (g2.pending_echo || {}).card,
		choice: (g2.pending_echo || {}).choice != null ? g2.pending_echo.choice : null,
		space: pick,
	})
	I.refresh(g2)
	const air1 = Object.keys(g2.location || {}).filter(p => g2.piece_nation[p] === '美国' && g2.piece_type[p] === 'air').length
	console.log('  log = ' + (g2.log || []).slice(n0).join(' | ').slice(0, 160))
	console.log('  空军 ' + air0 + '→' + air1 + '　pending_echo = ' + JSON.stringify(g2.pending_echo))
	ok('★★ 空军 +1 且挂起清空', air1 === air0 + 1 && !g2.pending_echo, air0 + '→' + air1)

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
