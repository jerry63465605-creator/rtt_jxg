/*
 * B32：窄屏（<=800px）询问面板必须脱离 <aside>
 *   A ★★ 768px：三个面板 parentNode === body，且带 .floating-ask
 *   B ★★ 768px + aside.hidden：三者 display 仍不是 none
 *   C ★★ 1440px：三者回到"原始父元素"（不是 body），且不带 .floating-ask（桌面零变化）
 *   D ★★ 768→1440→768 往返：插回原父元素、不重复、不丢
 *   E ★★ aside 关闭时仍能渲染「打出《马奇诺防线》」并可点（进入代价流程）
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }
let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const IDS = ['ask_box', 'resource_box', 'national_skill_box']

function boot(width) {
	const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8'), {
		runScripts: 'dangerously', url: 'http://localhost/quartermaster-sub-wars/play.html', pretendToBeVisual: true,
		beforeParse(win) {
			Object.defineProperty(win, 'innerWidth', { value: width, writable: true, configurable: true })
			Object.defineProperty(win, 'innerHeight', { value: 1024, writable: true, configurable: true })
			win.player = 'Allies'; win.me = null; win.players = []; win.game_id = 0; win.view = null
			win.sent = []; win.__err = []
			win.send_action = (a, arg) => { win.sent.push({ a, arg }) }
			win.send_query = () => {}; win.send_chat = () => {}
			win.update_log = () => {}
			win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
			win.addEventListener('error', e => win.__err.push(String(e.message || e.error)))
		},
	})
	const win = dom.window
	/* 先记录"原始父元素"，再注入 play.js（注入前 DOM 已就绪） */
	win.__home = {}
	for (const id of IDS) {
		const el = win.document.getElementById(id)
		win.__home[id] = el ? el.parentNode : null
	}
	const inject = c => { const s = win.document.createElement('script'); s.textContent = c; win.document.body.appendChild(s) }
	inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
	inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
	inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))
	return win
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const parentTag = (win, id) => { const el = win.document.getElementById(id); return el && el.parentNode ? (el.parentNode.tagName || '').toLowerCase() : '(missing)' }
const isBody = (win, id) => parentTag(win, id) === 'body'
const isHome = (win, id) => { const el = win.document.getElementById(id); return !!el && el.parentNode === win.__home[id] }
const hasFloat = (win, id) => { const el = win.document.getElementById(id); return !!(el && el.classList.contains('floating-ask')) }

;(async () => {
	const w1 = boot(768)
	await sleep(300)
	console.log('=== A. 768px（平板/手机）===')
	for (const id of IDS) console.log('  ' + id.padEnd(20, ' ') + 'parent=' + parentTag(w1, id) + '  floating=' + hasFloat(w1, id))
	ok('★★ 三个询问面板都挂到 body', IDS.every(id => isBody(w1, id)))
	ok('★★ 三者都带 .floating-ask', IDS.every(id => hasFloat(w1, id)))

	console.log('\n=== B. aside 关闭（hidden）后仍可见 ===')
	w1.document.querySelector('aside').hidden = true
	w1.apply_aside ? w1.apply_aside() : null
	await sleep(80)
	const vis = IDS.map(id => ({ id, display: w1.getComputedStyle(w1.document.getElementById(id)).display, body: isBody(w1, id) }))
	console.log('  ' + JSON.stringify(vis))
	ok('★★ aside 关掉后三者 display 仍不是 none', vis.every(v => v.display !== 'none' && v.body), JSON.stringify(vis.map(v => v.display)))

	console.log('\n=== C. 1440px（桌面）===')
	const w2 = boot(1440)
	await sleep(300)
	for (const id of IDS) console.log('  ' + id.padEnd(20, ' ') + 'parent=' + parentTag(w2, id) + '  home=' + isHome(w2, id) + '  floating=' + hasFloat(w2, id))
	ok('★★ 桌面：三者仍在原始父元素里（桌面布局零变化）', IDS.every(id => isHome(w2, id)))
	ok('★★ 桌面：不带 .floating-ask', IDS.every(id => !hasFloat(w2, id)))

	console.log('\n=== D. 768 → 1440 → 768 往返 ===')
	Object.defineProperty(w1, 'innerWidth', { value: 1440, writable: true, configurable: true })
	w1.dispatchEvent(new w1.Event('resize'))
	await sleep(300)
	console.log('  变宽后 parent=' + JSON.stringify(IDS.map(id => parentTag(w1, id))) + '  home=' + JSON.stringify(IDS.map(id => isHome(w1, id))))
	ok('★★ 变宽后插回原父元素', IDS.every(id => isHome(w1, id)))
	ok('★★ 变宽后不带 floating', IDS.every(id => !hasFloat(w1, id)))
	Object.defineProperty(w1, 'innerWidth', { value: 390, writable: true, configurable: true })
	w1.dispatchEvent(new w1.Event('resize'))
	await sleep(300)
	const dup = IDS.filter(id => w1.document.querySelectorAll('#' + id).length !== 1)
	console.log('  再变窄后 parent=' + JSON.stringify(IDS.map(id => parentTag(w1, id))) + '  重复=' + JSON.stringify(dup))
	ok('★★ 再变窄又回到 body', IDS.every(id => isBody(w1, id)))
	ok('★★ 没有产生重复元素', dup.length === 0, JSON.stringify(dup))

	console.log('\n=== E. aside 关闭时仍能渲染并点（真实盘面 view）===')
	const w3 = boot(390)
	await sleep(300)
	w3.document.querySelector('aside').hidden = true
	/* 用真实引擎造一个 armed 状态，取真 view（避免手写 mock 缺字段导致假报错） */
	const R = require(path.join(MOD, 'rules.js'))
	const I = R._internal
	const d = I.data
	const faceOf = x => String(x).split('#')[0]
	const g = R.setup(20261107)
	g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []; g.pending_echo = null
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	for (const f of ['15311', '15304', '15305', '15306', '15307'])
		R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
	I.refresh(g)
	const WE = d.id_of('西欧')
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'de_e', nation: '德国', type: 'army', space: d.id_of('德国') })
	I.refresh(g); I.grant_supply(g, 'de_e', g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' }); I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || []).find(x => faceOf(x) === '15201'), space: WE, piece: fr })
	I.refresh(g)
	w3.view = R.view(g, 'Allies')
	w3.on_update()
	await sleep(200)
	const box = w3.document.getElementById('ask_box')
	const btn = box ? [...box.querySelectorAll('button')].find(b => /马奇诺防线/.test(b.textContent || '')) : null
	console.log('  ask_box parent=' + parentTag(w3, 'ask_box') + '  有按钮=' + !!btn)
	ok('★★ 渲染出「打出《马奇诺防线》」按钮', !!btn, ((box && box.textContent) || '').slice(0, 60))
	if (btn) {
		w3.sent = []
		try { btn.click() } catch (e) { console.log('  click 抛错: ' + e.message) }
		await sleep(150)
		const dm = w3.document.getElementById('echo_discard_modal')
		console.log('  sent=' + JSON.stringify(w3.sent) + '  选牌框显示=' + (dm ? !dm.classList.contains('hide') : 'n/a') +
			'  err=' + JSON.stringify(w3.__err.slice(0, 2)))
		ok('★ 点击进入代价流程（开选牌框或派发动作）',
			!!btn && (w3.sent.length > 0 || (dm && !dm.classList.contains('hide'))))
	}

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
