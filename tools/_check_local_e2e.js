/*
 * 本地端到端检查：8091 实际提供的资源 + game 8 真实盘面 + jsdom 真渲染
 *
 * 用法：node --experimental-sqlite tools/_check_local_e2e.js
 * 覆盖：
 *   A. HTTP 资源（play.html/css/js、data、layout、common、fonts）→ 200 + 版本串一致 + 关键修复在位
 *   B. 真实盘面（DB game 8）→ 引擎 view
 *   C. jsdom 真渲染 → 计分标记贴右上角、日志栏默认可见且有关闭键、无重复 id、两次刷新 DOM 稳定
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const BASE = 'http://localhost:8091'

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const get = url => new Promise((res, rej) => {
	http.get(url, r => {
		const b = []
		r.on('data', c => b.push(c))
		r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(b).toString('utf8') }))
	}).on('error', rej)
})

;(async () => {
	console.log('=== A. HTTP 资源检查 ===')
	const urls = {
		'play.html': '/quartermaster-sub-wars/play.html',
		'play.css': '/quartermaster-sub-wars/play.css',
		'play.js': '/quartermaster-sub-wars/play.js',
		'data.js': '/quartermaster-sub-wars/data.js',
		'layout.js': '/quartermaster-sub-wars/layout.js',
		'rules.js': '/quartermaster-sub-wars/rules.js',
		'common/client.js': '/common/client.js',
		'fonts/fonts.css': '/fonts/fonts.css',
	}
	const bodies = {}
	for (const [k, u] of Object.entries(urls)) {
		const r = await get(BASE + u)
		bodies[k] = r.body
		ok(k + ' 可访问 (' + r.status + ', ' + r.body.length + ' 字符)', r.status === 200, String(r.status))
	}

	const vers = [...new Set([...bodies['play.html'].matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]
	console.log('  版本串: ' + JSON.stringify(vers))
	ok('★ 四处版本串一致（1 个值）', vers.length === 1, JSON.stringify(vers))
	ok('★ 版本 ≥ 20261104b', vers[0] >= '20261104b', String(vers[0]))

	console.log('\n=== A2. 今天三处修复是否已在服务端文件里 ===')
	ok('① 窄屏日志栏默认关闭（load_panel_state 分支）',
		/if \(narrow\) \{\s*\n\s*log_open = false/.test(bodies['play.js']))
	ok('② 面板自带关闭键 #log_close（html + css）',
		bodies['play.html'].indexOf('id="log_close"') >= 0 && bodies['play.css'].indexOf('#log_close') >= 0)
	ok('③ refit 收敛（log_layout_open 守卫）',
		/log_layout_open !== log_open/.test(bodies['play.js']))
	ok('④ 计分标记用 layout 真实尺寸 + 中心坐标',
		/layout\[data\.name_of\(space_id\)\]/.test(bodies['play.js']) &&
		/sp\.x \+ spW \/ 2/.test(bodies['play.js']))
	ok('⑤ #budget_hud.hide 已补', /#budget_hud\.hide\s*\{\s*display:\s*none/.test(bodies['play.css']))

	/* ---------- B. 真实盘面 ---------- */
	console.log('\n=== B. 真实盘面（DB game 8）===')
	let DatabaseSync
	try { ({ DatabaseSync } = require('node:sqlite')) } catch (e) {
		console.log('  ⚠ 需要 --experimental-sqlite，跳过 B/C')
		process.exitCode = fail ? 1 : 0
		return
	}
	const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
	const row = db.prepare('select state from game_snap where game_id = 8 order by snap_id desc limit 1').get()
	if (!row) { console.log('  ⚠ game 8 无快照，跳过'); process.exitCode = fail ? 1 : 0; return }
	const g = JSON.parse(row.state)
	if (typeof g.log === 'number') g.log = []
	const R = require(path.join(MOD, 'rules.js'))
	const I = R._internal
	I.refresh(g)
	const view = R.view(g, 'Allies')
	console.log('  turn=' + g.turn + '  current_nation=' + g.current_nation +
		'  my_nation=' + view.my_nation + '  标记格=' + Object.keys(view.markers || {}).length +
		'  部队=' + Object.keys(g.location || {}).length)

	/* ---------- C. jsdom 真渲染 ---------- */
	console.log('\n=== C. jsdom 真渲染（真实 play.html + play.js + 真 view）===')
	let JSDOM
	try { ({ JSDOM } = require('jsdom')) } catch (e) { console.log('  ⚠ 无 jsdom，跳过'); return }
	const layoutSrc = fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8')
	const layout = (0, eval)(layoutSrc + ';\nlayout')

	const dom = new JSDOM(bodies['play.html'].replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
		runScripts: 'dangerously',
		url: BASE + '/quartermaster-sub-wars/play.html',
		pretendToBeVisual: true,
		beforeParse(win) {
			Object.defineProperty(win, 'innerWidth', { value: 1400, configurable: true })
			win.player = 'Allies'; win.me = null; win.players = []; win.game_id = 8; win.view = null
			win.send_action = () => {}; win.send_query = () => {}; win.send_chat = () => {}
			win.update_log = () => {}
			win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
		}
	})
	const win = dom.window
	const inject = code => { const s = win.document.createElement('script'); s.textContent = code; win.document.body.appendChild(s) }
	inject(bodies['data.js']); inject(bodies['layout.js']); inject(bodies['play.js'])
	const sleep = ms => new Promise(r => setTimeout(r, ms))
	await sleep(250)

	const errs = []
	win.addEventListener('error', e => errs.push(String(e && e.message)))
	win.view = view
	win.on_update()
	await sleep(250)
	ok('渲染无 JS 异常', errs.length === 0, JSON.stringify(errs))

	const nodes1 = win.document.querySelectorAll('*').length
	win.on_update()
	await sleep(200)
	const nodes2 = win.document.querySelectorAll('*').length
	ok('★ 两次刷新 DOM 不增长（' + nodes1 + ' → ' + nodes2 + '）', nodes2 === nodes1, nodes1 + ' vs ' + nodes2)

	/* 重复 id */
	const ids = [...win.document.querySelectorAll('[id]')].map(e => e.id)
	const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i)
	ok('★ 渲染后无重复 id', dupIds.length === 0, JSON.stringify([...new Set(dupIds)].slice(0, 5)))

	/* 日志栏：桌面默认可见 + 有关闭键 */
	const lp = win.document.getElementById('log_panel')
	ok('★ 桌面：日志栏默认可见', !!lp && !lp.classList.contains('hide'),
		JSON.stringify(lp && lp.className))
	ok('★ 日志栏有关闭键', !!win.document.getElementById('log_close'))

	/* 计分标记：贴在格位右上角内侧 */
	const badges = [...win.document.querySelectorAll('#pieces .marker-badge')]
	console.log('  标记元素数 = ' + badges.length + '（view.markers 有 ' + Object.keys(view.markers || {}).length + ' 格）')
	if (badges.length) {
		let bad = []
		for (const el of badges) {
			const sid = el.__space_id != null ? el.__space_id : (el.dataset && el.dataset.space)
			if (sid == null) continue
			const box = layout[I.data.name_of(Number(sid))]
			if (!box) continue
			const cx = I.data.spaces[Number(sid)].x, cy = I.data.spaces[Number(sid)].y
			const w = box[2], h = box[3]
			const s = Number(win.document.getElementById('mapwrap').dataset.scale || 1) || 1
			const wCss = el.offsetWidth || 46
			const zmark = Math.max(8, Math.min(20, 60 * s)) / (20 * s)
			const left = parseFloat(el.style.left || '0')
			const top = parseFloat(el.style.top || '0')
			const rightEdge = left + wCss * zmark            /* 地图坐标右边缘 */
			const wantRight = cx + w / 2 - 3 / s
			const wantTop = cy - h / 2 + 3 / s
			if (Math.abs(rightEdge - wantRight) > 1.5 || Math.abs(top - wantTop) > 1.5)
				bad.push(I.data.name_of(Number(sid)) + ' right=' + rightEdge.toFixed(1) + '/' + wantRight.toFixed(1) +
					' top=' + top.toFixed(1) + '/' + wantTop.toFixed(1))
		}
		ok('★★ 所有计分标记都贴在格位右上角内侧', bad.length === 0, JSON.stringify(bad.slice(0, 4)))
	}

	/* 地图/算子规模自检（防止空盘面假通过） */
	const spaces = win.document.querySelectorAll('#spaces .space').length
	const units = win.document.querySelectorAll('#pieces .unit').length
	console.log('  渲染规模: .space=' + spaces + '  .unit=' + units)
	ok('★ 地图格位已渲染（>40）', spaces > 40, String(spaces))
	ok('★ 部队算子已渲染（>0）', units > 0, String(units))

	dom.window.close()
	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	process.exitCode = fail ? 1 : 0
})().catch(e => { console.log('异常: ' + (e && e.stack || e)); process.exitCode = 1 })
