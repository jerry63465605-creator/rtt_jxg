/* 拆分校验：① 章节标题一个不少、不重复 ② 正文字节守恒 ③ frontmatter 未变 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const skill = process.argv[2]
const before = process.argv[3]
const dir = path.join(os.homedir(), '.codebuddy', 'skills', skill)
const read = f => fs.readFileSync(f, 'utf8')
const titles = t => [...t.matchAll(/^##\s+(.+)$/gm)].map(m => m[1].trim())
const bodyOf = t => t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
const kb = t => +(Buffer.byteLength(t, 'utf8') / 1024).toFixed(1)

const oldT = read(before)
const oldBody = bodyOf(oldT)
const newMain = read(path.join(dir, 'SKILL.md'))
const refDir = path.join(dir, 'references')
const refs = fs.existsSync(refDir) ? fs.readdirSync(refDir).filter(f => f.endsWith('.md')) : []
const allText = newMain + refs.map(f => read(path.join(refDir, f))).join('\n')

const oldTitles = titles(oldBody)
const newTitles = titles(allText)
const missing = oldTitles.filter(t => newTitles.indexOf(t) < 0)
const dup = newTitles.filter((t, i) => newTitles.indexOf(t) !== i)

console.log('=== ' + skill + ' 拆分校验 ===')
console.log('原正文 ' + kb(oldBody) + ' KB ／ 现 SKILL.md ' + kb(newMain) + ' KB + references ' + refs.length + ' 份')
console.log('原章节 ' + oldTitles.length + ' 个 ／ 现（含 references）' + newTitles.length + ' 个')
console.log((missing.length ? '✗ 丢失章节：' + missing.join('、') : '✓ 章节一个不少'))
console.log((dup.length ? '✗ 重复章节：' + dup.join('、') : '✓ 无重复章节'))
console.log('字节：原 ' + Buffer.byteLength(oldBody, 'utf8') + ' → 现合计 ' +
	Buffer.byteLength(bodyOf(newMain) + refs.map(f => read(path.join(refDir, f))).join(''), 'utf8') +
	'（差额 = 新增的"来源"注 + 索引表）')
const fmOld = (oldT.match(/^---\r?\n[\s\S]*?\r?\n---/) || [''])[0]
const fmNew = (newMain.match(/^---\r?\n[\s\S]*?\r?\n---/) || [''])[0]
console.log('frontmatter 未变 = ' + (fmOld === fmNew))
refs.forEach(f => {
	const t = read(path.join(refDir, f))
	console.log('  references/' + f + '  ' + kb(t) + ' KB  ' + titles(t).length + ' 节')
})
process.exitCode = (missing.length || dup.length) ? 1 : 0
