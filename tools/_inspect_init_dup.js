/* 查 on_init 是否幂等、client.js 的三处兜底会不会重复调用 */
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'tmp', 'ui_dup')
const play = fs.readFileSync(path.join(dir, 'play.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')
const cli = fs.readFileSync(path.join(dir, 'client.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')

const block = (lines, startRe, max = 40) => {
	const i = lines.findIndex(l => startRe.test(l))
	if (i < 0) return '（未找到）'
	let depth = 0, out = []
	for (let k = i; k < lines.length && out.length < max; k++) {
		out.push((k + 1) + ': ' + lines[k])
		depth += (lines[k].match(/\{/g) || []).length - (lines[k].match(/\}/g) || []).length
		if (k > i && depth <= 0) break
	}
	return out.join('\n')
}

console.log('===== play.js on_init =====')
console.log(block(play, /^function on_init\(/))

console.log('\n===== client.js ensure_on_init =====')
console.log(block(cli, /function ensure_on_init/, 30))

console.log('\n===== client.js init_connect_when_ready =====')
console.log(block(cli, /function init_connect_when_ready/, 24))

/* 幂等性判据 */
const body = []
{
	const i = play.findIndex(l => /^function on_init\(/.test(l))
	let depth = 0
	for (let k = i; k < play.length; k++) {
		body.push(play[k])
		depth += (play[k].match(/\{/g) || []).length - (play[k].match(/\}/g) || []).length
		if (k > i && depth <= 0) break
	}
}
const b = body.join('\n')
console.log('\n===== on_init 幂等性 =====')
console.log('  有 init_done 守卫 = ' + /init_done|inited|__qm_inited/.test(b))
console.log('  调用 build_map = ' + /build_map\(/.test(b))
console.log('  调用 addEventListener = ' + /addEventListener/.test(b))
console.log('  调用 setup_map_zoom/ensure_hi_map = ' + /setup_map_zoom|ensure_hi_map/.test(b))
