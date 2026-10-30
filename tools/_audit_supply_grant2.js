/* 补充审计：4 张疑似超额卡的具体步骤 + 征召点是否本来就是补给点/在补给链上 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const C = require(path.join(MOD, 'cards.js'))
const lines = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

/* 直接打印这几张卡的配置块（按 id 精确定位，不限缩进） */
for (const id of ['17828', '17533', '17527', '17536', '15317']) {
	const idx = lines.findIndex(l => new RegExp("^\\s*'" + id + "':\\s*\\{").test(l))
	console.log('\n=== ' + id + ' ' + ((C.CARD_BY_ID[id] || {}).name || '?') + ' (line ' + (idx + 1) + ') ===')
	if (idx >= 0) console.log(lines.slice(idx, idx + 22).join('\n'))
}

const g = R.setup(1)
g.opening = null
I.refresh(g)
console.log('\n=== 相关地区是否补给点 / 连通 ===')
for (const nmx of ['夏威夷', '新西兰', '中国', '中国东部', '中国西部', '非洲南部']) {
	const id = d.id_of(nmx)
	if (id == null) { console.log('  ' + nmx + ' 不存在'); continue }
	console.log('  ' + nmx + '(' + id + ') 补给点=' + I.is_supply_point(g, id) +
		'  相邻=' + (I.get_connections(g, id, 'axis') || []).map(x => d.name_of(x)).join(','))
}
