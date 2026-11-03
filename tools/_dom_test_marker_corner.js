/*
 * 真 DOM 验证：计分标记贴在【格位右上角内侧】，且内容变宽/缩放变化时不漂移。
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

/* 一局真实状态 + 人为塞几个计分标记 */
const g = R.setup(7)
g.opening = null
I.refresh(g)
/* 格位尺寸在 layout.js（data.spaces 只有 x/y）：陆地 118、海域 106。
 * layout.js 是浏览器脚本（`const layout = {...}`，没有 module.exports），
 * Node 侧只能 eval 出来；浏览器里由 play.html 的 <script src="layout.js"> 提供同名全局。 */
const layout = (() => {
	const src = fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8')
	try { return (0, eval)(src + ';\nlayout') } catch (e) { return {} }
})()
const boxOf = id => layout[d.name_of(id)] || [d.spaces[id].x, d.spaces[id].y, 118, 118]
const SP = 15   /* 非洲北部（陆地） */
g.markers = { [SP]: [{ owner: null, value: 3 }] }
const view = R.view(g, 'Allies')
const SP_BOX = boxOf(SP)
console.log('测试格位 = ' + SP + ' ' + d.name_of(SP) + '  x=' + SP_BOX[0] + ' y=' + SP_BOX[1] +
	' w=' + SP_BOX[2] + ' h=' + SP_BOX[3])

const htmlPath = path.join(MOD, 'play.html')
const dom = new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
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

	/* jsdom 无排版：offsetWidth=0 -> 走兜底 46×20；总缩放=1、z.mark=1 */
	/* data.spaces 的 x/y 是【中心】，layout 的 w/h 是尺寸（见 play.js position_marker 注释） */
	const sp = { cx: d.spaces[SP].x, cy: d.spaces[SP].y, w: SP_BOX[2], h: SP_BOX[3] }
	const badge = win.document.querySelector('#pieces .marker-badge')
	ok('标记元素已渲染', !!badge)
	const left = num(badge && badge.style.left)
	const top = num(badge && badge.style.top)
	const expectLeft = sp.cx + sp.w / 2 - (46 + 3)
	const expectTop = sp.cy - sp.h / 2 + 3
	console.log('  left=' + left + ' (期望 ' + expectLeft + ')   top=' + top + ' (期望 ' + expectTop + ')')
	ok('★★ 右边缘贴格位右边缘内侧 3px', near(left, expectLeft), left + ' vs ' + expectLeft)
	ok('★★ 上边缘贴格位上边缘内侧 3px', near(top, expectTop), top + ' vs ' + expectTop)
	ok('★ 不再浮在格位上方外侧（旧版 y-half-(h+10) 会 < sp.y-59）',
		top > sp.cy - sp.h / 2, 'top=' + top)

	/* 模拟"内容变宽"（多位数 + 归属国名）：offsetWidth 变大 -> 应左移，右边缘不变 */
	Object.defineProperty(badge, 'offsetWidth', { value: 88, configurable: true })
	Object.defineProperty(badge, 'offsetHeight', { value: 20, configurable: true })
	win.view = Object.assign({}, view, {
		markers: { [SP]: [{ owner: '英国', value: 12 }] },
	})
	win.on_update()
	await sleep(120)
	const left2 = num(badge.style.left)
	const right2 = left2 + 88          /* s=1, z.mark=1 -> 屏幕宽度=88 */
	const spaceRight = sp.cx + sp.w / 2
	console.log('  变宽后 left=' + left2 + '  右边缘=' + right2 + '  格位右边缘=' + spaceRight)
	ok('★★ 内容变宽后右边缘仍对齐（不再漂移）', near(right2, spaceRight - 3, 1), right2 + ' vs ' + (spaceRight - 3))
	ok('★ 文字更新为 12 + 英国', (badge.textContent || '').indexOf('12') >= 0 && /英国/.test(badge.textContent),
		JSON.stringify(badge.textContent))

	/* 缩放变化：把 mapwrap.dataset.scale 设成 0.5，apply_piece_zoom 重排，右边缘仍对齐 */
	win.document.getElementById('mapwrap').dataset.scale = '0.5'
	if (typeof win.apply_piece_zoom === 'function') win.apply_piece_zoom()
	await sleep(80)
	const s = 0.5
	const zmark = Math.max(8, Math.min(20, 60 * s)) / (20 * s)   /* piece_zoom().mark */
	const left3 = num(badge.style.left)
	/* 元素在地图坐标里的宽度 = CSS 宽 × z.mark（transform 在 #pieces 内已含 s 的父级缩放） */
	const right3 = left3 + (88 * zmark)
	console.log('  scale=0.5 -> left=' + left3 + '  右边缘=' + right3 + '  期望=' + (spaceRight - 3 / s) + ' (z.mark=' + zmark.toFixed(3) + ')')
	ok('★★ 缩放变化后仍贴右上角（重排生效）', near(right3, spaceRight - 3 / s, 1.5), right3 + ' vs ' + (spaceRight - 3 / s))

	/* 海域格 106×106：验证用的是 layout 的真实宽度，而不是写死 118 */
	{
		const SEA = Object.keys(d.spaces).map(Number).find(id => {
			const b = layout[d.name_of(id)]
			return b && b[2] === 106
		})
		if (SEA) {
			const box = boxOf(SEA)
			win.view = Object.assign({}, view, { markers: { [SEA]: [{ owner: null, value: 1 }] } })
			win.on_update()
			await sleep(120)
			const el = win.document.querySelector('#pieces .marker-badge')
			const l = num(el && el.style.left)
			/* 注意：上一步把 mapwrap.dataset.scale 设成了 0.5，偏移要按 /s 换算 */
			const curS = num(win.document.getElementById('mapwrap').dataset.scale) || 1
			const exp = d.spaces[SEA].x + 106 / 2 - (46 + 3) / curS
			console.log('  海域 ' + d.name_of(SEA) + '(w=106) left=' + l + ' 期望=' + exp + ' (s=' + curS + ')')
			ok('★ 海域格按 106 宽对齐（不写死 118）', near(l, exp), l + ' vs ' + exp)
		}
	}

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	dom.window.close()
	process.exitCode = fail ? 1 : 0
})().catch(e => { console.log('  ✗ 异常: ' + (e && e.stack || e)); process.exitCode = 1 })
