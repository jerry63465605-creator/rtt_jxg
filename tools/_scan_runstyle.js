/*
 * 扫描所有【run() 函数式】实现的事件卡 —— 这类卡【不会询问玩家】，
 * 与声明式 steps 卡（会逐步询问）形成对比。
 *
 * 用途：排查"卡面写了多步/可选，实现却自动执行"的规则不符问题（R45）。
 *
 * 用法（从仓库根）：node tools/_scan_runstyle.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal || {}
const { CARDS } = require(path.join(MOD, 'cards.js'))

const EV = I.EVENT_EFFECTS || {}
const nameOf = {}
for (const c of CARDS) nameOf[String(c.id)] = { name: c.name, text: c.text, nation: c.nation }

const runStyle = []
const declStyle = []
for (const id of Object.keys(EV)) {
	const e = EV[id]
	if (!e) continue
	if (typeof e.run === 'function') runStyle.push(id)
	else if (e.steps || e.choice) declStyle.push(id)
}

console.log('== 声明式（steps/choice，会询问玩家）：' + declStyle.length + ' 张 ==')
for (const id of declStyle.sort()) {
	const e = EV[id]
	const n = e.steps ? e.steps.length : (e.choice ? 'choice×' + e.choice.length : '?')
	console.log('  ' + id + ' 《' + ((nameOf[id] || {}).name || e.name || '?') + '》 steps=' + n)
}

console.log('\n== run() 函数式（【不询问】，打出即自动执行）：' + runStyle.length + ' 张 ==')
for (const id of runStyle.sort()) {
	const meta = nameOf[id] || {}
	console.log('  ' + id + ' 《' + (meta.name || '?') + '》 [' + (meta.nation || '?') + ']')
	console.log('      卡面: ' + (meta.text || '(无)'))
}

/* 哪些 run() 卡面暗示"需要玩家选择"？关键词扫描 */
const KEYWORDS = /(选择|或|1或2|任意|指定|其|以此)/;
console.log('\n== run() 卡中，卡面【疑似需要玩家选择】的（重点排查）==')
let suspicious = 0
for (const id of runStyle.sort()) {
	const meta = nameOf[id] || {}
	const t = meta.text || ''
	if (KEYWORDS.test(t)) {
		suspicious++
		console.log('  ⚠ ' + id + ' 《' + (meta.name || '?') + '》')
		console.log('      ' + t)
	}
}
if (!suspicious) console.log('  （无）')

console.log('\n== 汇总 ==')
console.log('  声明式 ' + declStyle.length + ' 张 / run() 式 ' + runStyle.length + ' 张')
console.log('  其中 run() 式且卡面疑似需选择: ' + suspicious + ' 张')
