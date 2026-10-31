/*
 * 生成 15315 的「真实客户端」离线联调页（用于 agent-browser 真浏览器点击验证）
 *
 * 产物（都放在模块目录，跑完可删）：
 *   _harness_15315.html        —— 复制自 play.html，脚本换成 stub + data + boot
 *   _harness_15315_stub.js     —— 顶掉 common/client.js：send_action 记录、send_query 回放 event_targets
 *   _harness_15315_data.js     —— window.HARNESS_DATA = { view, need, card }
 *   _harness_15315_boot.js     —— 设置 view 并调用 on_update()
 *
 * 用法：node tools/_harness_15315_build.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

/* ---- ① 造局面：英国出牌阶段 + 德国陆军@非洲北部 + 15315 入手 ---- */
const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_na', nation: '德国', type: 'army', space: d.id_of('非洲北部') })
R.action(g, 'Allies', 'debug_add_card', { face: '15315', nation: '英国', dest: 'hand' })
I.refresh(g)

const card = (g.hands['英国'] || []).find(x => faceOf(x) === '15315')
const view = R.view(g, 'Allies')
const need = R.query(g, 'Allies', 'event_targets', { card })

/* ---- ② 生成 data.js ---- */
fs.writeFileSync(path.join(MOD, '_harness_15315_data.js'),
	'window.HARNESS_DATA = ' + JSON.stringify({
		view: view,
		need: need,
		card: card,
		africa: d.id_of('非洲北部'),
		middleEast: d.id_of('中东'),
	}) + ';\n', 'utf8')

/* ---- ③ 生成 stub.js（顶掉 common/client.js）---- */
fs.writeFileSync(path.join(MOD, '_harness_15315_stub.js'), `/*
 * 联调用 client.js 替身：只提供 play.js 需要的最小外部接口。
 *  - send_action：记录到 window.__sent，不发网络
 *  - send_query：event_targets 立刻回放预先算好的 need（模拟服务端应答）
 */
var view = null
var me = null
var game_id = 0
window.__sent = []
window.__toasts = []
function send_action(name, arg) {
	window.__sent.push({ name: name, arg: arg })
}
function send_query(q, params) {
	if (q === 'event_targets') {
		setTimeout(function () { on_reply('event_targets', window.HARNESS_DATA.need) }, 0)
		return
	}
	setTimeout(function () { on_reply(q, null) }, 0)
}
`, 'utf8')

/* ---- ④ 生成 boot.js ---- */
fs.writeFileSync(path.join(MOD, '_harness_15315_boot.js'), `/* 用真实 view 渲染一次；toast 覆盖成可读日志 */
try {
	view = window.HARNESS_DATA.view
	on_update()
	window.__bootOK = true
} catch (e) {
	window.__bootErr = String(e && e.stack || e)
}
`, 'utf8')

/* ---- ⑤ 生成 html：复制 play.html，替换四个 script 标签 ---- */
let html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
html = html.replace(/<script defer src="\/common\/client\.js"><\/script>/, '<script src="_harness_15315_stub.js"></script>')
	.replace(/<script defer src="data\.js[^"]*"><\/script>/, '<script src="_harness_15315_data.js"></script>\n<script src="data.js"></script>')
	.replace(/<script defer src="layout\.js[^"]*"><\/script>/, '<script src="layout.js"></script>')
	.replace(/<script defer src="play\.js[^"]*"><\/script>/, '<script src="play.js"></script>\n<script src="_harness_15315_boot.js"></script>')
fs.writeFileSync(path.join(MOD, '_harness_15315.html'), html, 'utf8')

console.log('已生成联调页：')
console.log('  ' + path.join(MOD, '_harness_15315.html'))
console.log('  card=' + card + '  hand=' + (view.hands['英国'] ? view.hands['英国'].length : '?') +
	'  need=' + JSON.stringify(need && { need: need.need, step: need.step, cands: (need.candidates || []).map(c => c.name) }))
