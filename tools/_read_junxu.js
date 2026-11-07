/*
 * 只读解析军需官.zip 里的《全卡表 v0.4》与《E2 规则书 v0.7》
 * 输出：卡表行数与结构预览、规则书大纲（标题/章节）
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const X = path.join(ROOT, 'tmp', 'junxu_xlsx')
const W = path.join(ROOT, 'tmp', 'junxu_docx')

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
	.replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/* ---------- 1) 卡表 xlsx ---------- */
console.log('=== 一、卡表 xlsx ===')
const wb = fs.readFileSync(path.join(X, 'xl', 'workbook.xml'), 'utf8')
const sheets = [...wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="rId(\d+)"/g)].map(m => ({ name: m[1], rid: m[2] }))
console.log('工作表 = ' + JSON.stringify(sheets.map(s => s.name)))

const ss = fs.readFileSync(path.join(X, 'xl', 'sharedStrings.xml'), 'utf8')
const shared = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
	unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')))
console.log('共享字符串 = ' + shared.length + ' 条')

function readSheet(file) {
	const xml = fs.readFileSync(file, 'utf8')
	const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(rm => {
		const cells = {}
		for (const cm of rm[1].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
			const col = cm[1], attrs = cm[3], body = cm[4]
			const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
			const isStr = /t="s"/.test(attrs)
			const inline = (body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/) || [])[1]
			cells[col] = isStr && v != null ? shared[Number(v)] : (inline != null ? unesc(inline) : (v != null ? unesc(v) : ''))
		}
		return cells
	})
	return rows
}

const sheetFiles = fs.readdirSync(path.join(X, 'xl', 'worksheets')).filter(f => /^sheet\d+\.xml$/.test(f))
	.sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
for (const f of sheetFiles) {
	const rows = readSheet(path.join(X, 'xl', 'worksheets', f))
	const header = rows[0] || {}
	const cols = Object.keys(header).sort()
	console.log('\n--- ' + f + '：' + rows.length + ' 行（含表头）---')
	console.log('表头 = ' + JSON.stringify(cols.map(c => header[c])))
	for (const r of rows.slice(1, 4)) console.log('  样例 = ' + JSON.stringify(cols.map(c => r[c] || '')))
}

/* ---------- 2) 规则书 docx ---------- */
console.log('\n\n=== 二、规则书 docx ===')
const doc = fs.readFileSync(path.join(W, 'word', 'document.xml'), 'utf8')
const paras = [...doc.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(pm => {
	const st = (pm[0].match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || ''
	const txt = unesc([...pm[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(t => t[1]).join(''))
	return { st, txt }
}).filter(p => p.txt.trim())

const total = paras.reduce((a, p) => a + p.txt.length, 0)
console.log('段落数 = ' + paras.length + '，正文字数 ≈ ' + total)
const styles = {}
for (const p of paras) styles[p.st || '(正文)'] = (styles[p.st || '(正文)'] || 0) + 1
console.log('段落样式分布 = ' + JSON.stringify(styles))

console.log('\n--- 大纲（标题类样式 + 前 40 条）---')
const heads = paras.filter(p => /Heading|标题|Title/i.test(p.st))
console.log('识别到标题 = ' + heads.length + ' 条')
for (const h of heads.slice(0, 40)) console.log('  [' + h.st + '] ' + h.txt.slice(0, 70))

console.log('\n--- 正文开头 12 段 ---')
for (const p of paras.slice(0, 12)) console.log('  ' + p.txt.slice(0, 100))
