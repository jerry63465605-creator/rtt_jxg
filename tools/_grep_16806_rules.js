/* 列出 rules.js 里 16806 / 16899 的出现，判断哪些属于衍生 token（要改 16899） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
lines.forEach((l, i) => {
	if (l.indexOf('16806') >= 0 || l.indexOf('16899') >= 0) console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 130))
})
