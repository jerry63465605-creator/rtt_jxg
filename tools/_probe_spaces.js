/* 临时探针：查「日本」等地区的地形与邻接（用完即删） */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const d = require(path.join(MOD, 'data.js')).data
const I = require(path.join(MOD, 'rules.js'))._internal

for (const nm of ['日本', '东海', '中国东北', '朝鲜', '菲律宾']) {
	const id = I.space_id_of(nm)
	if (id == null) { console.log(nm + ' -> 无此地区'); continue }
	const s = d.spaces[id]
	console.log(nm + ' -> id=' + id + ' terrain=' + s.terrain)
	console.log('   conns=' + JSON.stringify((s.connections || []).map(x => {
		const n = Number(x)
		return [n, d.spaces[n] && d.spaces[n].name, d.spaces[n] && d.spaces[n].terrain]
	})))
}
