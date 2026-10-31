/*
 * 真 DOM 验证：《大清洗》选牌框只能弹在苏联玩家屏幕上，轴心不得出现
 *
 * 用 jsdom 加载真实 play.html + play.js，分别用 Allies / Axis 的 view 渲染一帧，
 * 检查 #su_purge_modal 的 hide 状态与里面列出的状态卡数量。
 *
 * 前置：npm i jsdom --no-save
 * 用法：node tools/_dom_test_17850_modal.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) {
	console.log('⚠ 未安装 jsdom。请先：npm i jsdom --no-save')
	process.exit(2)
}

/* ---------- ① 造局面：苏联打出 17817 -> 结束中立 -> 大清洗机会开启 ---------- */
const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Allies', 'debug_place', { piece: 'su_def', nation: '苏联', type: 'army', space: d.id_of('莫斯科') })
R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: d.id_of('罗斯') })
R.action(g, 'Allies', 'debug_add_card', { face: '17817', nation: '苏联', dest: 'hand' })
R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
I.refresh(g)
{
	const card = (g.hands['苏联'] || []).find(x => faceOf(x) === '17817')
	R.action(g, 'Allies', 'play_card', { card })
}
console.log('=== 服务端 ===')
console.log('  su_17817_pending=' + JSON.stringify(g.su_17817_pending) + '  su_purge_offer=' + JSON.stringify(g.su_purge_offer))
const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
console.log('  Allies: my_nation=' + vA.my_nation + ' pending=' + vA.su_17817_pending)
console.log('  Axis  : my_nation=' + vX.my_nation + ' pending=' + vX.su_17817_pending)

/* ---------- ② jsdom 载入真实客户端 ---------- */
const htmlPath = path.join(MOD, 'play.html')
const dom = new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
	runScripts: 'dangerously',
	resources: 'usable',
	url: 'file:///' + htmlPath.replace(/\\/g, '/'),
	pretendToBeVisual: true,
	beforeParse(win) {
		win.player = 'Allies'
		win.me = null
		win.players = []
		win.game_id = 0
		win.view = null
		win.__sent = []
		win.send_action = (name, arg) => win.__sent.push({ name, arg })
		win.send_query = (q, params) => win.setTimeout(() => { try { win.on_reply(q, null) } catch (e) {} }, 0)
		win.send_chat = () => {}
		win.update_log = () => {}
	}
})
const win = dom.window
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitLoad = (ms = 8000) => new Promise((resolve, reject) => {
	if (win.document.readyState === 'complete') return resolve()
	const t = win.setTimeout(() => reject(new Error('加载超时')), ms)
	win.addEventListener('load', () => { win.clearTimeout(t); resolve() })
})

;(async () => {
	await waitLoad()
	ok('真实 play.html + play.js 已加载', typeof win.on_update === 'function')

	const modal = () => win.document.getElementById('su_purge_modal')
	const isHidden = () => !modal() || modal().classList.contains('hide')
	const statusCardsInModal = () => (modal() ? modal().querySelectorAll('.card, [data-card]').length : 0)

	/* ③ 苏联（Allies）视角：应弹框 */
	win.view = vA
	win.on_update()
	await sleep(120)
	console.log('  [Allies] hide=' + isHidden() + '  弹窗内卡片数=' + statusCardsInModal())
	ok('★ 苏联玩家能看到《大清洗》选牌框（未隐藏）', !isHidden())
	ok('★ 框里列出状态卡（>0）', statusCardsInModal() > 0, String(statusCardsInModal()))

	/* ④ 轴心视角：必须隐藏 */
	win.view = vX
	win.on_update()
	await sleep(120)
	console.log('  [Axis]   hide=' + isHidden() + '  弹窗内卡片数=' + statusCardsInModal())
	ok('★★ 轴心看不到《大清洗》选牌框（hide）', isHidden())
	ok('★★ 轴心弹窗内无卡片内容', statusCardsInModal() === 0, String(statusCardsInModal()))

	/* ⑤ 再切回苏联：还能正常出现（避免"hide 之后不再弹"） */
	win.view = vA
	win.on_update()
	await sleep(120)
	ok('★ 切回苏联视角仍能弹出', !isHidden())

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	dom.window.close()
	process.exitCode = fail ? 1 : 0
})().catch(e => {
	console.log('  ✗ 运行异常: ' + (e && e.stack || e))
	process.exitCode = 1
})
