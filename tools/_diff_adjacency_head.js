/* 对比 HEAD 版 data.js 与当前 data.js 的邻接差异（按地区名列出增删边） */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

const oldSrc = execSync('git show HEAD:server-official/public/quartermaster-sub-wars/data.js',
	{ cwd: path.join(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }).toString()
const tmpOld = path.join(__dirname, '_head_data.js')
fs.writeFileSync(tmpOld, oldSrc)

const oldD = require(tmpOld).data || require(tmpOld)
const newD = require(path.join(MOD, 'data.js')).data || require(path.join(MOD, 'data.js'))
fs.unlinkSync(tmpOld)

const nameOf = (d, id) => (d.spaces[id] || {}).name || String(id)

for (let i = 1; i < Math.max(oldD.spaces.length, newD.spaces.length); i++) {
	const o = oldD.spaces[i] || {}
	const n = newD.spaces[i] || {}
	const oc = (o.connections || []).map(Number)
	const nc = (n.connections || []).map(Number)
	const removed = oc.filter(x => nc.indexOf(x) < 0)
	const added = nc.filter(x => oc.indexOf(x) < 0)
	const ol = JSON.stringify(o.limited_connections || {})
	const nl = JSON.stringify(n.limited_connections || {})
	if (removed.length || added.length || ol !== nl) {
		console.log((o.name || n.name) + '(' + i + ')')
		if (removed.length) console.log('   - connections: ' + removed.map(x => nameOf(oldD, x)).join(', '))
		if (added.length) console.log('   + connections: ' + added.map(x => nameOf(newD, x)).join(', '))
		if (ol !== nl) console.log('   limited: ' + ol + '  ->  ' + nl)
	}
}
