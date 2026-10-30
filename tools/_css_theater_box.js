/* 把 #theater_box 加入 event_box 的共享样式组（边框/底色/.eb-* 视觉） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.css')
let s = fs.readFileSync(p, 'utf8')
let total = 0

function rep(from, to) {
	const n = s.split(from).length - 1
	if (!n) { console.log('MISS: ' + from.slice(0, 60).replace(/\n/g, ' | ')); return }
	s = s.split(from).join(to)
	total += n
	console.log('ok x' + n + ': ' + from.split('\n')[0])
}

/* ① 容器本体 + .hide */
rep('#event_budget_box,\n#autobahn_box,\n#event_step_box,\n#uranus_box {',
	'#event_budget_box,\n#autobahn_box,\n#event_step_box,\n#theater_box,\n#uranus_box {')
rep('#event_budget_box.hide,\n#autobahn_box.hide,\n#event_step_box.hide,\n#uranus_box.hide { display: none; }',
	'#event_budget_box.hide,\n#autobahn_box.hide,\n#event_step_box.hide,\n#theater_box.hide,\n#uranus_box.hide { display: none; }')
/* ② .eb-title / .eb-hint / .eb-log / button.action */
rep('#event_budget_box .eb-title,\n#autobahn_box .eb-title,\n#event_step_box .eb-title,\n#uranus_box .eb-title {',
	'#event_budget_box .eb-title,\n#autobahn_box .eb-title,\n#event_step_box .eb-title,\n#theater_box .eb-title,\n#uranus_box .eb-title {')
rep('#event_budget_box .eb-hint,\n#autobahn_box .eb-hint,\n#event_step_box .eb-hint,\n#uranus_box .eb-hint {',
	'#event_budget_box .eb-hint,\n#autobahn_box .eb-hint,\n#event_step_box .eb-hint,\n#theater_box .eb-hint,\n#uranus_box .eb-hint {')
rep('#event_budget_box .eb-log,\n#autobahn_box .eb-log,\n#event_step_box .eb-log,\n#uranus_box .eb-log {',
	'#event_budget_box .eb-log,\n#autobahn_box .eb-log,\n#event_step_box .eb-log,\n#theater_box .eb-log,\n#uranus_box .eb-log {')
rep('#event_budget_box button.action,\n#autobahn_box button.action,\n#event_step_box button.action,\n#uranus_box button.action {',
	'#event_budget_box button.action,\n#autobahn_box button.action,\n#event_step_box button.action,\n#theater_box button.action,\n#uranus_box button.action {')
/* ③ 禁用态 */
rep('#event_step_box button.action:disabled {',
	'#event_step_box button.action:disabled,\n#theater_box button.action:disabled {')

fs.writeFileSync(p, s, 'utf8')
console.log('changed groups: ' + total)
console.log('theater_box 出现次数: ' + (s.match(/#theater_box/g) || []).length)
