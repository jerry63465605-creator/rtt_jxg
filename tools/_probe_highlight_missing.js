/* 为什么 remaining=0 时地图不高亮：检查渲染顺序与 highlight_targets 是否可生效 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const { DatabaseSync } = require('node:sqlite')
const { JSDOM } = require('jsdom')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const g = JSON.parse(db.prepare('select state from game_snap where game_id = 10 order by snap_id desc limit 1').get().state)
if (typeof g.log === 'number') g.log = []
I.refresh(g)
const view = R.view(g, 'Axis')

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
const inject = c => { const s = win.document.createElement('script'); s.textContent = c; win.document.body.appendChild(s) }
inject(fs.readFileSync(path.join(MOD, 'data.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'layout.js'), 'utf8'))
inject(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))

setTimeout(() => {
	win.view = view
	win.on_update()
	setTimeout(() => {
		const spaces = win.document.querySelectorAll('#spaces .space')
		const targets = win.document.querySelectorAll('#spaces .space.target')
		console.log('  #spaces .space = ' + spaces.length + '   .target = ' + targets.length)
		console.log('  view.event_budget = ' + JSON.stringify({ remaining: view.event_budget.remaining, can_finish: view.event_budget.can_finish, targets: view.event_budget.targets }))
		/* 手动调一次，验证函数本身可用 */
		try {
			win.highlight_targets({ spaces: [{ id: 5 }, { id: 6 }] })
			console.log('  手动 highlight 后 .target = ' + win.document.querySelectorAll('#spaces .space.target').length)
		} catch (e) { console.log('  手动 highlight 异常: ' + e.message) }
		/* 再 on_update 一次看会不会被清掉 */
		win.on_update()
		setTimeout(() => {
			console.log('  再 on_update 后 .target = ' + win.document.querySelectorAll('#spaces .space.target').length)
			/* 看客户端哪一处决定是否高亮 */
			const src = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')
			console.log('  --- play.js 310-335 ---')
			console.log(src.slice(309, 334).map((l, i) => '  ' + (310 + i) + ': ' + l).join('\n'))
			dom.window.close()
		}, 150)
	}, 220)
}, 260)
