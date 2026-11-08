/* 只看 offer_armed_effects(..., 'after_recruit'/'after_build_army', ...) 的派发 payload */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
const hits = []
lines.forEach((l, i) => {
	if (l.indexOf('offer_armed_effects') >= 0 &&
		(l.indexOf("'after_recruit'") >= 0 || l.indexOf("'after_build_army'") >= 0 || l.indexOf('after_recruit') >= 0)) hits.push(i)
	/* 多行写法：obj 里传 window 变量的，单独看 */
})
console.log('直接命中 = ' + hits.length)
for (const i of hits) {
	console.log('\n=== L' + (i + 1) + ' ===')
	console.log(lines.slice(Math.max(0, i - 6), i + 12).map((x, k) => (Math.max(0, i - 6) + 1 + k) + ': ' + x).join('\n'))
}

/* 另外找 after_recruit 的派发（可能用变量名） */
console.log('\n\n=== 所有含 after_recruit 的行 ===')
lines.forEach((l, i) => { if (/after_recruit/.test(l)) console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 120)) })
