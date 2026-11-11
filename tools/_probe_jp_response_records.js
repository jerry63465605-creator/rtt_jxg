/*
 * 只读排查：日本 RESPONSE 卡「记录」是否错配
 * 对照 cards.js（卡面 text） vs 触发表 vs RESPONSE_EFFECT_IMPL 实现（用函数 toString，
 * 不用正则猜源码块）。不修改任何文件。
 * 用法：node tools/_probe_jp_response_records.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const cards = require(path.join(MOD, 'cards.js'))
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const csv = fs.readFileSync(path.join(__dirname, '..', 'out', 'ja_cards.csv'), 'utf8')

const jp = cards.CARDS.filter(c => c.nation === '日本' && c.type === 'RESPONSE')
const IMPL = I.RESPONSE_EFFECT_IMPL || {}
console.log('日本 RESPONSE 卡 ' + jp.length + ' 张；RESPONSE_EFFECT_IMPL 共 ' +
	Object.keys(IMPL).length + ' 项\n')

for (const c of jp) {
	const id = String(c.id)
	const face = c.text || ''
	const csvLine = csv.split(/\r?\n/).find(l => l.split(',')[1] === id) || ''
	const hasImpl = typeof IMPL[id] === 'function'
	const body = hasImpl ? IMPL[id].toString().replace(/\s+/g, ' ').slice(0, 260) : '(无实现)'
	/* 触发表（该 id 在 RESPONSE 声明块里的 on: 值） */
	const trigRe = new RegExp("'" + id + "':\\s*\\{[\\s\\S]{0,300}?trigger:\\s*\\{\\s*on:\\s*'([^']+)'", 'm')
	const trig = trigRe.exec(src)
	/* 卡面里的地区关键字是否出现在实现里 */
	const kws = [...new Set((face.match(/<[^>]+>/g) || []).map(s => s.slice(1, -1)))]
	const hit = hasImpl ? kws.filter(k => body.indexOf(k) >= 0 || IMPL[id].toString().indexOf(k) >= 0) : []

	console.log('=== ' + id + ' 《' + c.name + '》 ===')
	console.log('  卡面: ' + face)
	console.log('  CSV : ' + csvLine.split(',').slice(6, 9).join(' | '))
	console.log('  触发: ' + (trig ? trig[1] : '(未找到 trigger.on)'))
	console.log('  实现: ' + (hasImpl ? '有' : '★ 无') + ' ' + body)
	if (kws.length)
		console.log('  卡面地区 [' + kws.join(',') + '] → 实现命中 [' + hit.join(',') + ']')
	console.log('')
}

/* 单独详查 8600：卡面要求 vs 实现选项 */
console.log('=== ★ 8600 详查 ===')
const impl8600 = IMPL['8600']
if (typeof impl8600 === 'function') {
	const g = R.setup(1)
	const first = impl8600(g, 'Axis', {}, undefined)
	console.log('  首次调用返回: ' + JSON.stringify(first))
	console.log('  卡面要求: 对<印度尼西亚><新几内亚><东南亚><菲律宾>之一发起1次陆战 + 在战斗地区建设陆军')
	console.log('  实现选项: ' + JSON.stringify((first && first.candidates || []).map(x => x.name)))
}
