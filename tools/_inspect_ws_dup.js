/* 查：play.js 是否自己又建了一个 WebSocket / 重复订阅（会导致每次事件渲染两遍 = UI 重复 + 卡死） */
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'tmp', 'ui_dup')
const play = fs.readFileSync(path.join(dir, 'play.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')
const cli = fs.readFileSync(path.join(dir, 'client.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')

const scan = (lines, file, pats) => {
	console.log('\n=== ' + file + ' ===')
	for (const [label, re] of pats) {
		const hits = []
		lines.forEach((l, i) => { if (re.test(l)) hits.push('L' + (i + 1) + ': ' + l.trim().slice(0, 110)) })
		console.log('  ' + label + ' ×' + hits.length)
		hits.slice(0, 6).forEach(h => console.log('    ' + h))
	}
}

scan(play, 'play.js', [
	['new WebSocket', /new\s+WebSocket/],
	['onmessage 订阅', /\.onmessage\s*=/],
	['addEventListener("message")', /addEventListener\(\s*["']message["']/],
	['on_update 定义', /^function on_update\(/m],
	['window.on_update 赋值', /window\.on_update\s*=/],
	['DOMContentLoaded', /DOMContentLoaded/],
	['window.onload', /window\.onload/],
	['直接调用 setInterval', /setInterval\(/],
])

scan(cli, 'client.js', [
	['new WebSocket', /new\s+WebSocket/],
	['onmessage 订阅', /\.onmessage\s*=/],
	['addEventListener("message")', /addEventListener\(\s*["']message["']/],
	['调用 on_update', /on_update\(/],
	['DOMContentLoaded', /DOMContentLoaded/],
])

/* 两边都会写 update_log 吗 */
console.log('\n=== 日志渲染是否两套 ===')
const has = (lines, s) => lines.some(l => l.indexOf(s) >= 0)
console.log('  client.js 有 update_log = ' + has(cli, 'function update_log'))
console.log('  play.js   有 update_log = ' + has(play, 'function update_log'))
console.log('  play.js   有 render_qm_log = ' + has(play, 'function render_qm_log'))
console.log('  play.js   有 on_log = ' + has(play, 'function on_log'))
