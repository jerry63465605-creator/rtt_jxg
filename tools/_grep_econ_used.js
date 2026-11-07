/* 精确定位 offer_armed_effects(... 'econ_used' ...) 及其上下文 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
const hits = []
lines.forEach((l, i) => { if (l.indexOf("offer_armed_effects") >= 0 && l.indexOf("econ_used") >= 0) hits.push(i) })
console.log('offer_armed_effects(econ_used) = ' + hits.length + ' 处')
for (const i of hits) {
	console.log('\n=== L' + (i + 1) + ' ===')
	console.log(lines.slice(Math.max(0, i - 12), i + 8).map((x, k) => (Math.max(0, i - 12) + 1 + k) + ': ' + x).join('\n'))
}
