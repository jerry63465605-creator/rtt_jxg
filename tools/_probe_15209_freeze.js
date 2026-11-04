/* 定位 game10 卡死：pending_echo(echo_need/step=choice, options=null) 的产生点与客户端渲染 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')
const play = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')

const show = (lines, re, label, ctx = 6, limit = 4) => {
	console.log('\n===== ' + label + ' =====')
	let n = 0
	lines.forEach((l, i) => {
		if (n >= limit || !re.test(l)) return
		n++
		console.log(lines.slice(Math.max(0, i - ctx), i + ctx + 1).map((x, k) => '  ' + (Math.max(0, i - ctx) + k + 1) + ': ' + x).join('\n'))
		console.log('  ---')
	})
	if (!n) console.log('  （无命中）')
}

/* 服务端：pending_echo 的写入点 */
show(rules, /pending_echo = \{/, 'rules: pending_echo 赋值点', 10, 3)
show(rules, /kind: .echo_need./, 'rules: echo_need 构造', 12, 3)

/* 客户端：echo_need 的渲染 */
show(play, /function update_pending_echo_box/, 'play: update_pending_echo_box', 4, 1)
show(play, /echo_need/, 'play: echo_need 引用', 6, 6)
