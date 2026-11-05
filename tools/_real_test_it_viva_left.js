/*
 * P3-3 真实测试：16701《意大利万岁》下发「剩余额外行动次数」
 *
 *  A 未打出 16701 -> view.it_viva=false, it_viva_left=0
 *  B 打出 16701（意大利出牌阶段）-> it_viva=true, it_viva_left=1
 *  C 用掉 1 次（打一张意大利基本卡）-> it_viva_left=0
 *  D 离开出牌阶段 -> it_viva=false, it_viva_left=0
 *  E 真 DOM：it_viva_left=1 时 #phase_note 出现「还可额外行动 1 次」；=0 时不出现
 *  F 静态守卫：view 字段由 it_italy_viva_left 算出（服务端同源）
 *
 * 用法：node --experimental-sqlite tools/_real_test_it_viva_left.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	I.refresh(g)
	return g
}

console.log('=== A. 未打出 16701 ===')
// 用 gam 保存一局，供后面复用
let g = setup()
{
	const v = R.view(g, 'Axis')
	console.log('  view.it_viva=' + v.it_viva + '  view.it_viva_left=' + v.it_viva_left)
	ok('★ it_viva=false', v.it_viva === false)
	ok('★ it_viva_left=0', v.it_viva_left === 0, String(v.it_viva_left))
}

console.log('\n=== B. 打出 16701 → 剩 1 次 ===')
{
	g = setup()
	R.action(g, 'Axis', 'debug_add_card', { face: '16701', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	const card = (g.hands['意大利'] || []).find(x => String(x).startsWith('16701'))
	console.log('  卡 = ' + card)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	console.log('  log: ' + logSince(g, n0))
	console.log('  it_viva=' + g.it_viva + '  it_viva_used=' + g.it_viva_used)
	const v = R.view(g, 'Axis')
	console.log('  view.it_viva=' + v.it_viva + '  view.it_viva_left=' + v.it_viva_left)
	ok('★ 16701 生效（game.it_viva）', g.it_viva === true)
	ok('★★ view.it_viva_left = 1', v.it_viva_left === 1, String(v.it_viva_left))
}

console.log('\n=== C. 用掉 1 次 → 0 ===')
{
	const n0 = (g.log || []).length
	if (!(g.hands['意大利'] || []).some(x => String(x).startsWith('17700')))
		R.action(g, 'Axis', 'debug_add_card', { face: '17700', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	const basic = (g.hands['意大利'] || []).find(x => String(x).startsWith('17700'))
	console.log('  打基本卡 = ' + basic)
	/* 建设陆军需要合法地区：依次试几个，取第一个真的建成的 */
	for (const nm of ['巴尔干', '东欧', '北欧', '非洲北部']) {
		const sp = d.id_of(nm)
		const mark = (g.log || []).length
		R.action(g, 'Axis', 'play_card', { card: basic, space: sp })
		const lg = logSince(g, mark)
		if (!/无法执行|不能|请在/.test(lg)) { console.log('  建成于 ' + nm + ' → ' + lg); break }
		console.log('  ' + nm + ' 不可建：' + lg)
	}
	console.log('  it_viva_used=' + g.it_viva_used)
	const v = R.view(g, 'Axis')
	console.log('  view.it_viva_left=' + v.it_viva_left)
	ok('★ 用掉后 it_viva_used>=1', (g.it_viva_used || 0) >= 1, String(g.it_viva_used))
	ok('★★ view.it_viva_left 归 0', v.it_viva_left === 0, String(v.it_viva_left))
}

console.log('\n=== D. 离开出牌阶段 → 关闭 ===')
{
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	console.log('  log: ' + logSince(g, n0))
	console.log('  phase=' + g.turn_phase + '  it_viva=' + g.it_viva)
	const v = R.view(g, 'Axis')
	ok('★ 非出牌阶段 it_viva_left=0', v.it_viva_left === 0, String(v.it_viva_left))
}

console.log('\n=== E. 真 DOM：#phase_note 提示 ===')
let JSDOM = null
try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('  （无 jsdom，跳过）') }
if (JSDOM) {
	const mk = async (left) => {
		const base = R.view(setup(), 'Axis')
		const view = Object.assign({}, base, {
			it_viva: true, it_viva_left: left,
			phase_note: '出牌阶段', phases: base.phases || [],
		})
		const dom = new JSDOM(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
			runScripts: 'dangerously', url: 'http://localhost/quartermaster-sub-wars/play.html', pretendToBeVisual: true,
			beforeParse(win) {
				Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
				win.player = 'Axis'; win.me = null; win.players = []; win.game_id = 10; win.view = null
				win.send_action = () => {}; win.send_query = () => {}; win.send_chat = () => {}
				win.update_log = () => {}
				win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
			}
		})
		const win = dom.window
		const inj = c => { const s = win.document.createElement('script'); s.textContent = c; win.document.body.appendChild(s) }
		inj(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
		inj(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
		inj(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))
		await new Promise(r => setTimeout(r, 260))
		win.view = view
		win.on_update()
		await new Promise(r => setTimeout(r, 160))
		const txt = (win.document.getElementById('phase_note') || {}).textContent || ''
		dom.window.close()
		return txt
	}
	;(async () => {
		const t1 = await mk(1)
		console.log('  left=1 → ' + JSON.stringify(t1.slice(0, 80)))
		ok('★★ 显示「还可额外行动 1 次」', /还可额外行动 1 次/.test(t1), t1.slice(0, 80))
		const t0 = await mk(0)
		console.log('  left=0 → ' + JSON.stringify(t0.slice(0, 80)))
		ok('★ left=0 时不显示该提示', !/还可额外行动/.test(t0), t0.slice(0, 80))
		finish()
	})()
} else finish()

function finish() {
	console.log('\n=== F. 静态守卫 ===')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('view.it_viva_left 由 it_italy_viva_left 计算', /it_viva_left: it_italy_viva_left\(game, game\.current_nation\)/.test(src))
	ok('客户端读 view.it_viva_left（不自己猜）', /view\.it_viva_left/.test(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')))
	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
}
