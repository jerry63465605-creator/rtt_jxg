const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))

console.log('exports keys:', Object.keys(C).join(', '))
const arr = C.CARDS || []
console.log('总数:', arr.length)
console.log('\n第一张卡的完整字段:')
console.log(JSON.stringify(arr[0], null, 1))

console.log('\n=== 按 nation 字段统计 ===')
const byNat = {}
arr.forEach(c => { byNat[c.nation] = (byNat[c.nation] || 0) + 1 })
console.log(JSON.stringify(byNat, null, 1))

console.log('\n=== 按 country/owner 等其他可能字段 ===')
const keySet = new Set()
arr.forEach(c => Object.keys(c).forEach(k => keySet.add(k)))
console.log('所有字段名:', [...keySet].join(', '))

for (const k of ['country', 'owner', 'side', 'faction', 'force', 'nation_name', 'camp']) {
	if (keySet.has(k)) {
		const m = {}
		arr.forEach(c => { m[c[k]] = (m[c[k]] || 0) + 1 })
		console.log(k, '->', JSON.stringify(m))
	}
}

console.log('\n=== 前 10 张卡的 名称/类型/nation ===')
arr.slice(0, 10).forEach(c => console.log(' ', c.id, c.name, '|', c.type, '| nation=', c.nation))
