/* 查计分标记（marker badge）的渲染与定位逻辑 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')
const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8').replace(/\r\n/g, '\n').split('\n')

const show = (lines, re, label, ctx = 10) => {
	console.log('\n=== ' + label + ' ===')
	let n = 0
	lines.forEach((l, i) => {
		if (n >= 6) return
		if (re.test(l)) {
			n++
			console.log(lines.slice(Math.max(0, i - 2), i + ctx).map((x, k) => '  ' + (Math.max(0, i - 2) + k + 1) + ': ' + x).join('\n'))
			console.log('  ---')
		}
	})
}

show(js, /function update_markers/, 'update_markers')
show(js, /function position_marker/, 'position_marker')
show(js, /marker-badge|marker_badge/, 'marker-badge 引用')
show(css, /marker-badge/, 'CSS .marker-badge', 12)
