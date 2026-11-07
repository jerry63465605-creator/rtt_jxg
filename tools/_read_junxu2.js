/* 军需官包：卡表统计 + 变更记录 + 规则书大纲 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const X = path.join(ROOT, 'tmp', 'junxu_xlsx')
const W = path.join(ROOT, 'tmp', 'junxu_docx')
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
	.replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const ss = fs.readFileSync(path.join(X, 'xl', 'sharedStrings.xml'), 'utf8')
const shared = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
	unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')))

function rows(file) {
	const xml = fs.readFileSync(file, 'utf8')
	return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(rm => {
		const o = {}
		for (const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
			const v = (cm[3].match(/<v>([\s\S]*?)<\/v>/) || [])[1]
			const inline = (cm[3].match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/) || [])[1]
			o[cm[1]] = /t="s"/.test(cm[2]) && v != null ? shared[Number(v)] : (inline != null ? unesc(inline) : (v != null ? unesc(v) : ''))
		}
		return o
	})
}

/* ---- 卡表 ---- */
const cardRows = rows(path.join(X, 'xl', 'worksheets', 'sheet1.xml'))
const head = cardRows[0]
const body = cardRows.slice(1).filter(r => (r.B || '').trim())
console.log('=== 卡表 ===')
console.log('表头 = ' + Object.values(head).join(' | '))
console.log('卡片行数 = ' + body.length)

const byNation = {}, byType = {}, sumQty = {}
let qtyTotal = 0
for (const r of body) {
	const n = (r.C || '?').trim(), t = (r.D || '?').trim(), q = Number(r.H || 0)
	byNation[n] = (byNation[n] || 0) + 1
	byType[t] = (byType[t] || 0) + 1
	sumQty[n] = (sumQty[n] || 0) + (Number.isFinite(q) ? q : 0)
	qtyTotal += Number.isFinite(q) ? q : 0
}
console.log('\n按国家（卡名数 / 张数合计）：')
for (const k of Object.keys(byNation).sort()) console.log('  ' + k.padEnd(6, ' ') + String(byNation[k]).padStart(4) + ' 种 / ' + String(sumQty[k] || 0).padStart(4) + ' 张')
console.log('  合计 ' + body.length + ' 种 / ' + qtyTotal + ' 张')
console.log('\n按类型：' + JSON.stringify(byType))

/* ---- 变更记录 ---- */
const chg = rows(path.join(X, 'xl', 'worksheets', 'sheet2.xml'))
const chgBody = chg.slice(1).filter(r => (r.C || '').trim())
const kinds = {}
for (const r of chgBody) kinds[(r.A || '?').trim()] = (kinds[(r.A || '?').trim()] || 0) + 1
console.log('\n=== 变更记录（v0.4）===')
console.log('条目 = ' + chgBody.length + '  分类 = ' + JSON.stringify(kinds))
for (const k of Object.keys(kinds)) {
	const list = chgBody.filter(r => (r.A || '').trim() === k).map(r => r.C + '(' + r.B + ')')
	console.log('  ' + k + '（' + list.length + '）：' + list.join('、'))
}

/* ---- 数量核对 ---- */
const ck = rows(path.join(X, 'xl', 'worksheets', 'sheet4.xml'))
console.log('\n=== 数量核对 ===')
for (const r of ck.slice(1)) {
	const vals = Object.values(r).filter(x => String(x).trim() !== '')
	if (vals.length) console.log('  ' + vals.join(' | '))
}

/* ---- 规则书大纲（样式 3/4/16 视为标题） ---- */
const doc = fs.readFileSync(path.join(W, 'word', 'document.xml'), 'utf8')
const paras = [...doc.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(pm => {
	const st = (pm[0].match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || ''
	const txt = unesc([...pm[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(t => t[1]).join(''))
	return { st, txt: txt.trim() }
}).filter(p => p.txt)
console.log('\n=== 规则书大纲（样式 3/4/16）===')
let n = 0
for (const p of paras) {
	if (!['3', '4', '16'].includes(p.st)) continue
	n++
	console.log('  ' + '  '.repeat(p.st === '3' ? 0 : p.st === '4' ? 1 : 2) + p.txt.slice(0, 80))
}
console.log('（共 ' + n + ' 条标题）')
