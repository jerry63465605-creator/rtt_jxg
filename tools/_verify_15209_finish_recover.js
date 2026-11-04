/*
 * S1+S2 验证：点「结束《伞兵》」之后，空框不得复活（真实动作驱动）
 *
 *  A. 存量脏存档（event_budget + 空 pending_echo）
 *     -> view.pending_echo 为空；actions 含 event_battle/event_finish
 *  B. 真实 event_finish
 *     -> g.pending_echo 被清空（S2）；view.pending_echo 仍为空；actions 不再被排他
 *  C. 真 DOM：结束后 #pending_echo_modal 的 inline display 不是 block（不会弹全屏遮罩）
 *  D. 不误伤：真实选择框（options/cands 非空）照常下发、照常冻结
 *
 * 用法：node --experimental-sqlite tools/_verify_15209_finish_recover.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const { DatabaseSync } = require('node:sqlite')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const acts = v => Object.keys(v.actions || {})

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state, snap_id from game_snap where game_id = 10 order by snap_id desc limit 1').get()
const base = JSON.parse(row.state)
if (typeof base.log === 'number') base.log = []
const clone = o => JSON.parse(JSON.stringify(o))

console.log('=== A. 存量脏存档（snap#' + row.snap_id + '）===')
{
	const g = clone(base)
	I.refresh(g)
	console.log('  g.pending_echo=' + JSON.stringify(g.pending_echo && { kind: g.pending_echo.kind, step: g.pending_echo.step }) +
		'  budget=' + JSON.stringify(g.event_budget && { remaining: g.event_budget.remaining }))
	const v = R.view(g, 'Axis')
	ok('view.pending_echo 为空（空框不下发）', !v.pending_echo, JSON.stringify(v.pending_echo))
	ok('actions 含 event_finish', acts(v).indexOf('event_finish') >= 0, JSON.stringify(acts(v)))
}

console.log('\n=== B. 真实点「结束《伞兵》」===')
let afterView = null
{
	const g = clone(base)
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_finish', {})
	console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
	console.log('  g.pending_echo = ' + JSON.stringify(g.pending_echo))
	console.log('  g.event_budget = ' + JSON.stringify(g.event_budget))
	ok('★ 预算已结束', !g.event_budget)
	ok('★★ S2：空框在动作出口被清空（存档不再带脏字段）', !g.pending_echo, JSON.stringify(g.pending_echo))
	afterView = R.view(g, 'Axis')
	console.log('  view.actions = ' + JSON.stringify(acts(afterView)))
	ok('★ view.pending_echo 仍为空（不复活）', !afterView.pending_echo, JSON.stringify(afterView.pending_echo))
	ok('★ actions 不再被空框排他（不止 resolve_effect）',
		!(acts(afterView).length === 1 && acts(afterView)[0] === 'resolve_effect'), JSON.stringify(acts(afterView)))
	ok('★ 结束预算后仍是本方回合，可继续出牌/推进',
		acts(afterView).some(a => ['play_card', 'next_phase', 'event_step_next', 'resource_swap'].indexOf(a) >= 0),
		JSON.stringify(acts(afterView)))
}

console.log('\n=== D. 不误伤：真实选择框照常下发/冻结 ===')
{
	const g = clone(base)
	I.refresh(g)
	/* 手工造一个"真的需要补参"的 echo_need（有 cands），模拟 17514 那种状态 */
	g.event_budget = null
	g.pending_echo = {
		card: '15209#75', nation: '德国', kind: 'echo_need', name: '伞兵',
		step: 'space', title: '请选择地区', options: null, cands: [5, 6, 8], pick: 1, choice: null,
	}
	const v = R.view(g, 'Axis')
	ok('有 cands 的选择框照常下发', !!v.pending_echo && v.pending_echo.step === 'space', JSON.stringify(v.pending_echo && v.pending_echo.step))
	ok('有候选时仍按排他处理（actions 只给 resolve_effect）',
		acts(v).indexOf('resolve_effect') >= 0 && acts(v).indexOf('event_finish') < 0, JSON.stringify(acts(v)))
	/* 再加 options 的形态 */
	g.pending_echo = { card: '15209#75', nation: '德国', kind: 'echo_need', name: '伞兵', step: 'choice', title: '选一个', options: [{ index: 0, label: 'A' }], cands: null, pick: 1, choice: null }
	const v2 = R.view(g, 'Axis')
	ok('有 options 的选择框照常下发', !!v2.pending_echo && (v2.pending_echo.options || []).length === 1)
}

console.log('\n=== C. 真 DOM：结束后不弹全屏遮罩 ===')
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('  （无 jsdom，跳过）') }
if (JSDOM && afterView) {
	const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
		runScripts: 'dangerously', url: 'http://localhost/quartermaster-sub-wars/play.html', pretendToBeVisual: true,
		beforeParse(win) {
			Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
			Object.defineProperty(win, 'innerHeight', { value: 900, configurable: true })
			win.player = 'Axis'; win.me = null; win.players = []; win.game_id = 10; win.view = null
			win.send_action = () => {}; win.send_query = () => {}; win.send_chat = () => {}
			win.update_log = () => {}
			win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
		}
	})
	const win = dom.window
	const inject = code => { const s = win.document.createElement('script'); s.textContent = code; win.document.body.appendChild(s) }
	inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
	inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
	inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))
	setTimeout(() => {
		win.view = afterView
		win.on_update()
		setTimeout(() => {
			const el = win.document.getElementById('pending_echo_modal')
			const disp = el && el.style.display
			console.log('  #pending_echo_modal class=' + JSON.stringify(el && el.className) + ' inline.display=' + JSON.stringify(disp))
			ok('★★ 结束后弹框保持隐藏（inline.display 不是 block）', disp !== 'block', JSON.stringify(disp))
			dom.window.close()
			console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
			process.exitCode = fail ? 1 : 0
		}, 200)
	}, 260)
} else {
	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
}
