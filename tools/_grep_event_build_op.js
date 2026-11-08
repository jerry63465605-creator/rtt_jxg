/* 事件 steps 的 build/recruit 是否走 build_piece/recruit_piece（决定 16804 窗口会不会派发） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
lines.forEach((l, i) => {
	if (/build_piece\(|recruit_piece\(/.test(l) && /op|step|case|if\s*\(/.test(l)) console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 120))
})
console.log('\n--- 事件 step 执行器里 build/recruit 分支 ---')
lines.forEach((l, i) => {
	if (/k === 'build'|k === 'recruit'|op === 'build'|op === 'recruit'/.test(l)) {
		console.log('\n=== L' + (i + 1) + ' ===')
		console.log(lines.slice(i, i + 14).map((x, k) => (i + 1 + k) + ': ' + x).join('\n'))
	}
})
