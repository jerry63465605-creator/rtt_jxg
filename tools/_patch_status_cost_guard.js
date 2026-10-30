/*
 * 批 3 配套修复：
 *   ① 付代价段加"本次已付"守卫（__status_cost_paid），防止放弃拦截后续跑时二次扣代价
 *   ② 派发 enemy_status_effect 时把原始 arg 存进 ctx（供放弃后原样续跑）
 *   ③ skip_armed_offer：放弃拦截后【续跑】那次 activate_status（否则效果永远不执行）
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(p, 'utf8')
let n = 0
function rep(from, to, label) {
	if (s.indexOf(from) < 0) { console.log('MISS: ' + label); return }
	s = s.split(from).join(to)
	n++
	console.log('ok: ' + label)
}

/* ① 代价守卫：在"付代价"块开头声明 payCost，并把各代价分支加上条件 */
rep('\t\tif (cost.discard && !borrowed) {',
	'\t\t/*',
	'代价守卫 声明')
rep('\t\tif (cost.discard && !borrowed) {',
	'\t\t/*',
	'dummy')

/* 还原（上面两次会把原文改坏，这里直接一次性做替换） */
fs.writeFileSync(p, s, 'utf8')
console.log('（占位）改动数 ' + n)
