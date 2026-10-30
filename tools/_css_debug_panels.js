/* 让两个新调试面板复用 #debug_panel 的样式（分组选择器），并给卡牌面板加宽 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.css')
let s = fs.readFileSync(p, 'utf8')

const GROUP = '#debug_panel, #debug_card_panel, #debug_phase_panel'
let n = 0
function rep(from, to) {
	if (s.indexOf(from) < 0) { console.log('MISS: ' + from); return }
	const cnt = s.split(from).length - 1
	s = s.split(from).join(to)
	n += cnt
	console.log('ok x' + cnt + ': ' + from)
}

rep('#debug_panel:hover {', '#debug_panel:hover, #debug_card_panel:hover, #debug_phase_panel:hover {')
rep('#debug_panel .panel-head {', '#debug_panel .panel-head, #debug_card_panel .panel-head, #debug_phase_panel .panel-head {')
rep('#debug_panel .panel-body {', '#debug_panel .panel-body, #debug_card_panel .panel-body, #debug_phase_panel .panel-body {')
rep('#debug_panel .panel-body p {', '#debug_panel .panel-body p, #debug_card_panel .panel-body p, #debug_phase_panel .panel-body p {')
rep('#debug_panel label {', '#debug_panel label, #debug_card_panel label, #debug_phase_panel label {')
rep('#debug_panel select {', '#debug_panel select, #debug_card_panel select, #debug_phase_panel select {')
rep('#debug_panel button {', '#debug_panel button, #debug_card_panel button, #debug_phase_panel button {')
rep('#debug_panel button.on {', '#debug_panel button.on, #debug_card_panel button.on, #debug_phase_panel button.on {')
rep('#debug_panel .panel-body p.sep {', '#debug_panel .panel-body p.sep, #debug_card_panel .panel-body p.sep, #debug_phase_panel .panel-body p.sep {')
/* 主块（带定位的那条）：只替换行首独立一条 */
rep('\n#debug_panel {\n', '\n' + GROUP + ' {\n')

/* 追加：卡牌面板更宽；网格用 6 列小卡 */
if (s.indexOf('/* 【2026-10-29】调试卡牌面板') < 0) {
	s += `
/* 【2026-10-29】调试卡牌面板：比单位面板宽，卡图网格紧凑 */
#debug_card_panel { width: 460px; left: 10px; bottom: 34px; }
#debug_card_panel .card-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
	gap: 4px;
}
#debug_card_panel #dbg_card_hint { color: #a33; min-height: 16px; }
#debug_phase_panel #dbg_phase_hint { color: #a33; min-height: 16px; }
`
	console.log('appended overrides')
}
fs.writeFileSync(p, s, 'utf8')
console.log('done, ' + n + ' selector(s) grouped')
