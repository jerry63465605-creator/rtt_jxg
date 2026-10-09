/*
 * 全量统计【德国卡组】的实现状态（2026-09-29）。
 *
 * 对每个德国卡 id，查它落在哪个配置表：
 *   EVENT_EFFECTS（事件卡）  ECHO_EFFECTS（增强卡）
 *   STATUS_EFFECTS（状态卡） ECON_CARDS（经济战）
 *   RESPONSE_EFFECTS（响应卡）
 *   BASIC -> 走通用的 resolve_basic_card（不分国别）
 *
 * 并区分事件卡是【声明式 steps/choice】还是【函数式 run()】（后者无交互）。
 *
 * 用法（从仓库根）：node tools/_scan_de_impl.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal || {}
const { CARDS } = require(path.join(MOD, 'cards.js'))

const EV = I.EVENT_EFFECTS || {}
const EC = I.ECHO_EFFECTS || {}
const ST = I.STATUS_EFFECTS || {}
const RP = I.RESPONSE_EFFECTS || {}
const ECON = I.ECON_CARDS || {}

const DE = CARDS.filter(c => c.nation === '德国')
console.log('德国卡总数 = ' + DE.length)

const byType = {}
for (const c of DE) (byType[c.type] = byType[c.type] || []).push(c)

function kindOf(id) {
	const s = String(id)
	if (EV[s]) {
		const e = EV[s]
		if (typeof e.run === 'function') return 'EVENT:run()（无交互）'
		if (e.steps) return 'EVENT:steps（有交互）'
		if (e.choice) return 'EVENT:choice（有交互）'
		return 'EVENT:空配置'
	}
	if (EC[s]) {
		const e = EC[s]
		if (typeof e.run === 'function') return 'ECHO:run()'
		if (e.steps) return 'ECHO:steps'
		if (e.choice) return 'ECHO:choice'
		return 'ECHO:空配置'
	}
	if (ST[s]) return 'STATUS:已实现'
	if (ECON[s]) return 'ECON:已实现'
	if (RP[s]) return 'RESPONSE:已实现'
	return null
}

console.log('\n================ 按类型统计 ================\n')
const order = ['BASIC', 'EVENT', 'EFFECT', 'STATUS', 'ECON', 'PRELUDE', 'ARMAMENT', 'RESPONSE']
for (const t of order) {
	const list = byType[t] || []
	if (!list.length) continue
	const done = [], todo = []
	for (const c of list.sort((a, b) => a.id - b.id)) {
		const k = t === 'BASIC' ? 'BASIC:通用实现' : kindOf(c.id)
		;(k ? done : todo).push({ c, k })
	}
	console.log('## ' + t + '  共 ' + list.length + ' 张 —— 已实现 ' +
		done.length + ' / 未实现 ' + todo.length)
	for (const x of done)
		console.log('   ✅ ' + x.c.id + ' 《' + x.c.name + '》  [' + x.k + ']')
	for (const x of todo)
		console.log('   ❌ ' + x.c.id + ' 《' + x.c.name + '》  未实现' +
			(x.c.text ? '  卡面:' + x.c.text.slice(0, 34) : ''))
	console.log('')
}

/* 汇总 */
let totalDone = 0, totalTodo = 0
const stat = {}
for (const t of order) {
	const list = byType[t] || []
	if (!list.length) continue
	let d = 0
	for (const c of list) {
		const k = t === 'BASIC' ? 1 : kindOf(c.id)
		if (k) d++
	}
	stat[t] = d + '/' + list.length
	totalDone += d
	totalTodo += (list.length - d)
}
console.log('================ 汇总 ================')
for (const t of order) if (stat[t]) console.log('  ' + t + ': ' + stat[t])
console.log('\n  德国合计：已实现 ' + totalDone + ' / 共 ' + DE.length +
	'  （未实现 ' + totalTodo + '）')
