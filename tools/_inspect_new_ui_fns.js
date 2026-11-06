/* 读外部交付新增的 UI 函数，看是否"每次刷新都追加 DOM"（重复 + 卡死的典型成因） */
const fs = require('fs')
const path = require('path')
const t = fs.readFileSync(path.join(__dirname, '..', 'tmp', 'ui_dup', 'play.js'), 'utf8')
	.replace(/\r\n/g, '\n').split('\n')

const names = ['update_ally_hands', 'build_ally_card_elt', 'apply_aside', 'toggle_aside',
	'set_phase_float', 'render_qm_log', 'log_panel_el', 'sync_header_height', 'apply_log_panel']

for (const name of names) {
	const i = t.findIndex(l => l.startsWith('function ' + name + '('))
	console.log('\n===== ' + name + ' @L' + (i + 1) + ' =====')
	if (i < 0) { console.log('  （未找到）'); continue }
	console.log(t.slice(i, i + 22).map((l, k) => '  ' + (i + k + 1) + ': ' + l).join('\n'))
}

/* 统计 update_ally_hands / render_qm_log 里是否先清空容器 */
console.log('\n===== 关键判据 =====')
const body = (name) => {
	const i = t.findIndex(l => l.startsWith('function ' + name + '('))
	if (i < 0) return ''
	let depth = 0, out = []
	for (let k = i; k < t.length; k++) {
		out.push(t[k])
		depth += (t[k].match(/\{/g) || []).length - (t[k].match(/\}/g) || []).length
		if (k > i && depth <= 0) break
	}
	return out.join('\n')
}
for (const name of ['update_ally_hands', 'render_qm_log']) {
	const b = body(name)
	console.log('  ' + name + ': 清空容器=' + (/innerHTML\s*=\s*["']{2}|replaceChildren|innerHTML\s*=\s*''/.test(b) ? '有' : '❌无') +
		'  appendChild次数=' + (b.match(/appendChild/g) || []).length +
		'  createElement次数=' + (b.match(/createElement/g) || []).length)
}
