/*
 * 真 DOM 验证：17811 特例的 bureau_wait 阶段不再错误渲染「是否用空军代受」的框。
 *
 * 症状（玩家实测）：抵消成立后面板显示「可代受的空军 0 支：无」，只剩
 * 「不代受（部队被移除，空军撤离）」；点它没有任何反应 = 卡死，也无法打出增强卡。
 *
 * 断言：
 *  A bureau_wait 时 #ask_box 被隐藏（不再出现"不代受"按钮）
 *  B 页面上仍能看到增强卡窗口（《雅科夫列夫设计局》可点）
 *  C defend 阶段（对照）仍然正常渲染代受框（没把正常流程改坏）
 *
 * 用法：node tools/_dom_test_bureau_box.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('⚠ 需要 jsdom'); process.exit(2) }

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const EAST = d.id_of('东欧')
const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
for (const [p, sp] of [['su_m', '莫斯科'], ['su_r', '罗斯'], ['su_u', '乌克兰'], ['su_e', '东欧']])
	R.action(g, 'Allies', 'debug_place', { piece: p, nation: '苏联', type: 'army', space: d.id_of(sp) })
R.action(g, 'Allies', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: EAST })
R.action(g, 'Axis', 'debug_place', { piece: 'de_army', nation: '德国', type: 'army', space: d.id_of('德国') })
R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: d.id_of('德国') })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)

I.do_battle(g, '德国', EAST, 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
console.log('服务端状态：pending=' + JSON.stringify(g.pending_battle && g.pending_battle.stage) +
	'  offers=' + JSON.stringify((g.armed_offers || []).map(w => (w.cards || []).map(c => String(c.card_id).split('#')[0]))))
ok('★★ 服务端确实进入 bureau_wait', !!(g.pending_battle && g.pending_battle.stage === 'bureau_wait'),
	JSON.stringify(g.pending_battle && g.pending_battle.stage))

/* 用真实 view 喂给客户端 */
const viewAllies = R.view(g, 'Allies')

const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8'), {
	runScripts: 'dangerously',
	url: 'http://localhost/quartermaster-sub-wars/play.html',
	pretendToBeVisual: true,
	beforeParse(win) {
		Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
		win.player = 'Allies'; win.me = null; win.players = []; win.game_id = 0; win.view = null
		win.send_action = () => {}; win.send_query = () => {}; win.send_chat = () => {}
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
	win.view = viewAllies
	win.on_update()
	await sleep(120)

	const ask = win.document.getElementById('ask_box')
	const askTxt = (ask.textContent || '').replace(/\s+/g, ' ')
	console.log('  #ask_box hidden=' + ask.classList.contains('hide') + '  text=' + JSON.stringify(askTxt.slice(0, 80)))
	ok('★★ bureau_wait 不再渲染"是否用空军代受"框（#ask_box 隐藏）',
		ask.classList.contains('hide') || askTxt.indexOf('不代受') < 0, askTxt.slice(0, 80))
	ok('★★ 面板里不再出现"可代受的空军 0 支"', askTxt.indexOf('可代受的空军 0 支') < 0, askTxt.slice(0, 80))

	const bodyTxt = (win.document.body.textContent || '').replace(/\s+/g, ' ')
	ok('★ 页面上能看到《雅科夫列夫设计局》（增强窗口仍在）',
		bodyTxt.indexOf('雅科夫列夫设计局') >= 0, bodyTxt.slice(0, 120))

	/* 对照：把 pending 换成 defend，确认代受框正常 */
	win.view = JSON.parse(JSON.stringify(viewAllies))
	win.view.pending_battle = Object.assign({}, win.view.pending_battle, {
		stage: 'defend', airs: ['su_air'],
	})
	win.on_update()
	await sleep(120)
	const ask2 = win.document.getElementById('ask_box')
	const t2 = (ask2.textContent || '').replace(/\s+/g, ' ')
	console.log('  defend 对照：#ask_box hidden=' + ask2.classList.contains('hide') + '  text=' + JSON.stringify(t2.slice(0, 60)))
	ok('★★ defend 阶段仍正常渲染代受框（未误伤）', /是否用空军代受/.test(t2), t2.slice(0, 60))

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
