/*
 * 真 DOM 验证：17543《雷达》"立刻询问"框 —— 用 jsdom 加载真实 play.html + play.js，
 * 检查 #ask_box 渲染两个答复按钮、点击后 send_action 的动作与参数，
 * 以及挂起清除后框自动收起（不残留）。
 *
 * 前置：npm i jsdom --no-save
 * 用法：node tools/_dom_test_17543_radar_ask.js
 */
const path = require('path')
const fs = require('fs')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) {
	console.log('⚠ 未安装 jsdom。请先：npm i jsdom --no-save'); process.exit(2)
}

const JP = d.id_of('东海'), US = d.id_of('中太平洋')

function toTable(g, face, nation) {
	const inst = (g.hands[nation] || []).find(x => faceOf(x) === String(face))
	if (!inst) return null
	g.hands[nation] = (g.hands[nation] || []).filter(x => x !== inst)
	g.table[nation] = (g.table[nation] || []).concat([inst])
	I.refresh(g)
	return inst
}

/* 真实盘面 + 真实响应链 -> 挂起建立 */
const g = new_board(20261111, { nation: '日本', phase: 'play' })
clear_pending(g)
g.current_nation = '日本'; g.active = 'Axis'
place(g, 'jp_nv', '日本', 'navy', d.name_of(JP))
place(g, 'us_nv', '美国', 'navy', d.name_of(US))
I.grant_supply(g, 'jp_nv', g.turn || 1)
I.set_supply_point(g, JP, 'axis', true)
I.refresh(g); I.compute_supply(g)
give(g, '17543', '美国'); I.refresh(g)
toTable(g, '17543', '美国')
for (const f of ['15428', '15438'])
	g.table_responses.push({ card_id: f, owner_side: 'axis', nation: '日本' })
I.refresh(g)
R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
for (let i = 0; i < 10 && !g.pending_status_ask; i++) {
	const vx = R.view(g, 'Axis'), va = R.view(g, 'Allies')
	const ax = Object.keys(vx.actions || {}), al = Object.keys(va.actions || {})
	const pt = vx.pending_trigger || va.pending_trigger
	if (ax.indexOf('response_confirm') >= 0 && pt && !pt.ordered && (pt.candidates || []).length > 1) {
		R.action(g, 'Axis', 'response_confirm', { order: pt.candidates.map(c => c.card_id) }); continue
	}
	const role = ax.indexOf('resolve_response_choice') >= 0 ? 'Axis'
		: (al.indexOf('resolve_response_choice') >= 0 ? 'Allies' : null)
	if (role) {
		const c = (R.view(g, role).response_choice || {}).candidates || []
		const pick = c.find(x => Number(x.id) === Number(US)) || c[0]
		if (!pick) break
		R.action(g, role, 'resolve_response_choice', { choice: pick.id }); continue
	}
	if (ax.indexOf('trigger_response') >= 0) { R.action(g, 'Axis', 'trigger_response', {}); continue }
	break
}
if (!g.pending_status_ask) { console.log('✗ 前置：未能建立雷达挂起'); process.exit(1) }

const htmlPath = path.join(L.MOD, 'play.html')
const dom = new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
	runScripts: 'dangerously', resources: 'usable',
	url: 'file:///' + htmlPath.replace(/\\/g, '/'),
	pretendToBeVisual: true,
	beforeParse(win) {
		win.player = 'Allies'; win.me = null; win.players = []
		win.game_id = 0; win.view = null; win.__sent = []
		win.send_action = (n, a) => win.__sent.push({ name: n, arg: a })
		win.send_query = (q, p) => win.setTimeout(() => { try { win.on_reply(q, null) } catch (e) {} }, 0)
		win.send_chat = () => {}; win.update_log = () => {}
	},
})
const win = dom.window
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitLoad = (ms = 8000) => new Promise((resolve, reject) => {
	if (win.document.readyState === 'complete') return resolve()
	const t = win.setTimeout(() => reject(new Error('加载超时')), ms)
	win.addEventListener('load', () => { win.clearTimeout(t); resolve() })
})
const box = () => win.document.getElementById('ask_box')
const buttons = () => [...(box() ? box().querySelectorAll('button') : [])]
const labels = () => buttons().map(b => (b.textContent || '').trim())

;(async () => {
	await waitLoad()
	ok('真实 play.html + play.js 已加载', typeof win.on_update === 'function')

	/* ① 应答方（Allies）：挂起询问框 */
	win.view = R.view(g, 'Allies')
	win.on_update()
	await sleep(150)
	ok('★ #ask_box 未隐藏', !!(box() && !box().classList.contains('hide')),
		box() ? box().className : '(无 #ask_box)')
	const head = box() ? (box().querySelector('.ask_head') || {}).textContent : ''
	ok('★ 标题含《雷达》与"等待决定"', /雷达/.test(head || '') && /等待决定/.test(head || ''),
		JSON.stringify(head))
	const lbs = labels()
	console.log('  [按钮] ' + JSON.stringify(lbs))
	ok('★ 恰好渲染「发动 / 不发动」两个答复按钮',
		lbs.some(x => x === '发动') && lbs.some(x => x === '不发动'), JSON.stringify(lbs))
	ok('不渲染响应卡的「发动响应 / 排序」按钮',
		!lbs.some(x => /发动响应|确认顺序/.test(x)), JSON.stringify(lbs))

	/* ② 点击两个按钮 -> send_action 动作与参数同源 */
	win.__sent = []
	const bUse = buttons().find(b => (b.textContent || '').trim() === '发动')
	if (bUse) bUse.click()
	await sleep(30)
	ok('★ 点「发动」发 activate_status，且 card=挂起里的桌面实例 id',
		win.__sent.length === 1 && win.__sent[0].name === 'activate_status' &&
		win.__sent[0].arg.card === g.pending_status_ask.card_id,
		JSON.stringify(win.__sent))

	win.view = R.view(g, 'Allies'); win.on_update(); await sleep(80)
	win.__sent = []
	const bSkip = buttons().find(b => (b.textContent || '').trim() === '不发动')
	if (bSkip) bSkip.click()
	await sleep(30)
	ok('★ 点「不发动」发 skip_status_ask',
		win.__sent.length === 1 && win.__sent[0].name === 'skip_status_ask',
		JSON.stringify(win.__sent))

	/* ③ 挂起清除后询问框自动收起（幂等、不残留） */
	R.action(g, 'Allies', 'skip_status_ask', {})
	win.view = R.view(g, 'Allies')
	win.on_update()
	await sleep(150)
	ok('★ 挂起清除后 #ask_box 收起（hide）或已清空',
		!!(box() && (box().classList.contains('hide') || !box().innerHTML.trim())),
		box() ? 'class=' + box().className + ' html=' + box().innerHTML.slice(0, 120) : '(无)')
	ok('挂起清除后不再含「发动 / 不发动」按钮',
		!labels().some(x => x === '发动' || x === '不发动'), JSON.stringify(labels()))

	/* ④ 非应答方（Axis）不得看到询问框 */
	win.view = R.view(g, 'Axis')
	win.on_update(); await sleep(120)
	ok('★ 非应答方 view.pending_status_ask=null', !win.view.pending_status_ask)

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	dom.window.close()
	process.exitCode = fail ? 1 : 0
})().catch(e => { console.log('  ✗ 运行异常: ' + (e && e.stack || e)); process.exitCode = 1 })
