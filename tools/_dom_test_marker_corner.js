/*
 * 真 DOM 验证：计分标记【已回退到"地块上方"】的旧定位（2026-11-06 玩家要求）。
 *
 * 断言：
 *   A 标记已渲染
 *   B left = cx + 59 - 46（half - badge_w）
 *   C top  = cy - 59 - (23 + 10)（在格位上方、且让出 10px 间隙）
 *   D 标记整体在格位上方（top < cy - 59），不侵入格位
 *   E 改文本（位数/国名变化）后位置【不变】（旧实现不看实测宽度）
 *   F 静态守卫：position_marker 不再读 offsetWidth / layout 尺寸
 *
 * 用法：node tools/_dom_test_marker_corner.js
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
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol

const g = R.setup(7)
g.opening = null
I.refresh(g)
const SP = 15   /* 非洲北部（陆地 118） */
g.markers = { [SP]: [{ owner: null, value: 3 }] }
const view = R.view(g, 'Allies')
console.log('测试格位 = ' + SP + ' ' + d.name_of(SP) + '  cx=' + d.spaces[SP].x + ' cy=' + d.spaces[SP].y)

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
	}
})
const win = dom.window
const inject = code => { const s = win.document.createElement('script'); s.textContent = code; win.document.body.appendChild(s) }
inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))

const sleep = ms => new Promise(r => setTimeout(r, ms))
const num = v => parseFloat(String(v || '0'))

;(async () => {
	await sleep(250)
	win.view = view
	win.on_update()
	await sleep(150)

	const sp = { cx: d.spaces[SP].x, cy: d.spaces[SP].y }
	const half = 59, badgeW = 46, badgeH = 23, gap = 10
	const badge = win.document.querySelector('#pieces .marker-badge')
	ok('标记元素已渲染', !!badge)
	if (!badge) { console.log('\nFAIL（未渲染）'); process.exitCode = 1; return }

	const left = num(badge.style.left), top = num(badge.style.top)
	const expL = sp.cx + half - badgeW
	const expT = sp.cy - half - (badgeH + gap)
	console.log('  left=' + left + ' (期望 ' + expL + ')   top=' + top + ' (期望 ' + expT + ')')

	ok('★★ left = cx + 59 - 46（旧口径）', near(left, expL), left + ' vs ' + expL)
	ok('★★ top = cy - 59 - 33（地块上方）', near(top, expT), top + ' vs ' + expT)
	ok('★ 整体在格位上方，不侵入格位', top < sp.cy - half, 'top=' + top + ' 格位上沿=' + (sp.cy - half))

	/* 改文本后位置不变（旧实现不依赖实测宽度） */
	const before = badge.style.left + '|' + badge.style.top
	win.view = JSON.parse(JSON.stringify(view))
	win.view.markers = win.view.markers || {}
	win.view.markers[String(SP)] = { total: 12, owners: ['英国', '法国'] }
	win.on_update()
	await sleep(150)
	const after = badge.style.left + '|' + badge.style.top
	console.log('  文本变更前/后位置 = ' + before + '  ->  ' + after + '  文本=' + (badge.textContent || '').slice(0, 20))
	ok('★★ 内容变宽后位置不变（不漂移）', before === after, before + ' -> ' + after)

	/* 静态守卫 */
	const src = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const seg = (() => {
		const i = src.indexOf('function position_marker(')
		return i < 0 ? '' : src.slice(i, i + 700)
	})()
	ok('★★ position_marker 已不含实测宽度（offsetWidth）', seg.indexOf('offsetWidth') < 0)
	ok('★ position_marker 已不读 layout 尺寸', !/layout\[data\.name_of/.test(seg))
	ok('★ 仍保留 half=59 与 10px 间隙', /const half = 59/.test(seg) && /badge_h \+ 10/.test(seg))

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})()
