/* 把 #debug_view_panel 精确并入调试面板的 12 个选择器组（逐条替换，避免正则误伤） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.css')
let raw = fs.readFileSync(p, 'utf8')
const crlf = raw.indexOf('\r\n') >= 0
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw
let n = 0

/* 每条：把 "#debug_phase_panel<suffix>" 扩成 "#debug_phase_panel<suffix>, #debug_view_panel<suffix>" */
const pairs = [
	['#debug_panel, #debug_card_panel, #debug_phase_panel {',
		'#debug_panel, #debug_card_panel, #debug_phase_panel, #debug_view_panel {'],
	['#debug_panel:hover, #debug_card_panel:hover, #debug_phase_panel:hover { opacity: 1; }',
		'#debug_panel:hover, #debug_card_panel:hover, #debug_phase_panel:hover, #debug_view_panel:hover { opacity: 1; }'],
	['#debug_panel .panel-head, #debug_card_panel .panel-head, #debug_phase_panel .panel-head {',
		'#debug_panel .panel-head, #debug_card_panel .panel-head, #debug_phase_panel .panel-head, #debug_view_panel .panel-head {'],
	['#debug_panel .panel-body, #debug_card_panel .panel-body, #debug_phase_panel .panel-body { padding: 6px 8px; font-size: 12px; }',
		'#debug_panel .panel-body, #debug_card_panel .panel-body, #debug_phase_panel .panel-body, #debug_view_panel .panel-body { padding: 6px 8px; font-size: 12px; }'],
	['#debug_panel .panel-body p, #debug_card_panel .panel-body p, #debug_phase_panel .panel-body p { margin: 5px 0; }',
		'#debug_panel .panel-body p, #debug_card_panel .panel-body p, #debug_phase_panel .panel-body p, #debug_view_panel .panel-body p { margin: 5px 0; }'],
	['#debug_panel label, #debug_card_panel label, #debug_phase_panel label { display: block; margin: 4px 0; }',
		'#debug_panel label, #debug_card_panel label, #debug_phase_panel label, #debug_view_panel label { display: block; margin: 4px 0; }'],
	['#debug_panel select, #debug_card_panel select, #debug_phase_panel select { width: 100%; }',
		'#debug_panel select, #debug_card_panel select, #debug_phase_panel select, #debug_view_panel select { width: 100%; }'],
	['#debug_panel button, #debug_card_panel button, #debug_phase_panel button { width: 100%; margin-top: 3px; }',
		'#debug_panel button, #debug_card_panel button, #debug_phase_panel button, #debug_view_panel button { width: 100%; margin-top: 3px; }'],
	['#debug_panel button.on, #debug_card_panel button.on, #debug_phase_panel button.on { background-color: #0a5; color: #fff; }',
		'#debug_panel button.on, #debug_card_panel button.on, #debug_phase_panel button.on, #debug_view_panel button.on { background-color: #0a5; color: #fff; }'],
	['#debug_panel .panel-body p.sep, #debug_card_panel .panel-body p.sep, #debug_phase_panel .panel-body p.sep {',
		'#debug_panel .panel-body p.sep, #debug_card_panel .panel-body p.sep, #debug_phase_panel .panel-body p.sep, #debug_view_panel .panel-body p.sep {'],
	['#debug_panel .panel-close,', '#debug_panel .panel-close,'],
]

for (const [a, b] of pairs) {
	if (s.indexOf(a) < 0) { console.log('MISS: ' + a.slice(0, 60)); continue }
	if (a !== b) { s = s.split(a).join(b); n++ }
}

/* .panel-close 组与 :hover 组（多行选择器，需在 #debug_phase_panel .panel-close 后补一行） */
s = s.replace('#debug_card_panel .panel-close,\n#debug_phase_panel .panel-close {',
	'#debug_card_panel .panel-close,\n#debug_phase_panel .panel-close,\n#debug_view_panel .panel-close {')
s = s.replace('#debug_card_panel .panel-close:hover,\n#debug_phase_panel .panel-close:hover {',
	'#debug_card_panel .panel-close:hover,\n#debug_phase_panel .panel-close:hover,\n#debug_view_panel .panel-close:hover {')

/* 面板提示文字样式（与 phase_hint 同款） */
if (s.indexOf('#debug_view_panel #dbg_view_hint') < 0) {
	s = s.replace('#debug_phase_panel #dbg_phase_hint { color: #a33; min-height: 16px; }',
		'#debug_phase_panel #dbg_phase_hint { color: #a33; min-height: 16px; }\n' +
		'#debug_view_panel #dbg_view_hint { color: #a33; min-height: 16px; }\n' +
		'#debug_view_panel .dbg-note { color: #666; font-size: 11px; }')
}

fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('替换 ' + n + ' 组')
