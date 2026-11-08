/* 看 build_actions 里 pending_echo 排他分支，确认 armed 应答动作是否被挡、有没有先例放行 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
const i = lines.findIndex(l => /is_empty_echo_frame|pending_echo/.test(l) && /build_actions|function build_actions/.test(lines[Math.max(0, l.indexOf('function'))]) === false)
/* 先找 build_actions 函数体 */
const start = lines.findIndex(l => /^function build_actions/.test(l))
console.log('build_actions @' + (start + 1))
for (let k = start; k < start + 260 && k < lines.length; k++) {
	if (/pending_echo|is_empty_echo_frame|use_armed_offer|skip_armed_offer|trigger_response|return acts/.test(lines[k]))
		console.log('L' + (k + 1) + ': ' + lines[k].trim().slice(0, 130))
}
