/* 打印标定文件里指定连线的原始文本块（含行号），供精确增删 */
const fs = require('fs')
const path = require('path')
const FILE = path.join(__dirname, '..', 'out', 'spaces_calibrated.json')
const lines = fs.readFileSync(FILE, 'utf8').split('\n')
const PAIRS = [['非洲北部', '阿拉伯海'], ['里海', '乌克兰'], ['南大西洋', '地中海']]

for (const [a, b] of PAIRS) {
	let i = -1
	for (let k = 0; k < lines.length - 1; k++) {
		if (lines[k].indexOf('"' + a + '"') >= 0 && lines[k + 1].indexOf('"' + b + '"') >= 0) { i = k; break }
	}
	console.log('--- ' + a + '-' + b + (i >= 0 ? (' at line ' + (i + 1)) : ' NOT FOUND'))
	if (i >= 0) console.log(lines.slice(i - 1, i + 6).map((l, k) => (i + k) + ': ' + l).join('\n'))
}
