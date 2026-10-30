/* 列出 STATUS_EFFECTS 每张卡的窗口/代价/效果形态，供审计 STATUS_UI 缺口 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const SE = I.STATUS_EFFECTS || {}
const fs = require('fs')
const playSrc = fs.readFileSync(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'play.js'), 'utf8')

/* 解析客户端 STATUS_UI */
const lines = playSrc.split('\n')
const s = lines.findIndex(l => /^const STATUS_UI = \{/.test(l))
let e = s + 1
while (e < lines.length && lines[e] !== '}') e++
const uiMap = {}
let cur = null
for (const raw of lines.slice(s + 1, e)) {
	const l = raw.trim()
	const m = l.match(/^'(\d{5})':\s*\{(.*)$/)
	if (m) { cur = m[1]; uiMap[cur] = (uiMap[cur] || '') + l }
	else if (cur && l.indexOf('/*') < 0 && l.charAt(0) !== '*') uiMap[cur] += ' ' + l
}

const rows = []
for (const face of Object.keys(SE)) {
	const t = SE[face].trigger || {}
	const eff = t.effect || {}
	const cost = t.cost || {}
	const ui = uiMap[face] || ''
	rows.push({
		face,
		window: t.window || '',
		cost: Object.keys(cost).join('+') || '-',
		eff: eff.kind || (SE[face].auto ? 'auto' : (t.run ? 'run' : '-')),
		ui: ui ? ui.replace(/\s+/g, ' ').slice(0, 78) : '（无条目）',
	})
}
console.log('face  window            cost              eff        STATUS_UI')
for (const r of rows)
	console.log(r.face + '  ' + r.window.padEnd(17) + r.cost.padEnd(17) + r.eff.padEnd(10) + r.ui)
