/* 注册名 vs 卡表 一致性扫描（只读） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const arr = Array.isArray(C) ? C : (C.cards || Object.values(C)[0])
const byId = {}
for (const c of arr) byId[String(c.id)] = c

const groups = [
	['ECHO_EFFECTS', I.ECHO_EFFECTS || {}],
	['STATUS_EFFECTS', I.STATUS_EFFECTS || {}],
]
let bad = 0, checked = 0, missing = 0
for (const [tag, map] of groups) {
	for (const id of Object.keys(map)) {
		const reg = map[id] || {}
		if (!reg.name) continue
		const c = byId[String(id)]
		checked++
		if (!c) { missing++; console.log('  ⚠ ' + tag + '[' + id + '] 卡表里没有这张卡（name=' + reg.name + '）'); continue }
		if (String(c.name) !== String(reg.name)) {
			bad++
			console.log('  ✗ ' + tag + '[' + id + '] 注册名《' + reg.name + '》 ≠ 卡表《' + c.name + '》')
		}
	}
}
console.log('扫描完成：检查 ' + checked + ' 条，不一致 ' + bad + ' 条，卡表缺失 ' + missing + ' 条')
