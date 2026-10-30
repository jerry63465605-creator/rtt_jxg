/* 列出 data.js 里所有 limited_connections（阵营专属邻接表），并标出与基础表不同的"额外边" */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const d = rules._internal.data

console.log('=== 有 limited_connections 的格位 ===')
for (let i = 1; i < d.spaces.length; i++) {
	const s = d.spaces[i]
	if (!s || !s.limited_connections) continue
	const base = (s.connections || []).map(Number)
	for (const side of Object.keys(s.limited_connections)) {
		const list = (s.limited_connections[side] || []).map(Number)
		const extra = list.filter(x => base.indexOf(x) < 0)
		const missing = base.filter(x => list.indexOf(x) < 0)
		console.log(s.name + '(' + i + ') [' + side + ']  ' +
			list.map(x => d.name_of(x)).join('/') +
			(extra.length ? '\n      + 额外: ' + extra.map(x => d.name_of(x)).join('/') : '') +
			(missing.length ? '\n      - 缺少(基础有但该阵营无): ' + missing.map(x => d.name_of(x)).join('/') : ''))
	}
}
