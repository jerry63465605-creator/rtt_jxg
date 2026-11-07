/*
 * 拆分 skill 的辅助器（两阶段）
 *   阶段 A：node tools/_split_skill_helper.js list <skill>        列出 ## 章节 + 字节数
 *   阶段 B：node tools/_split_skill_helper.js apply <skill> <plan.json>
 *           plan.json = { "references/xxx.md": ["章节标题前缀", ...], ... }
 *           → 把匹配到的章节从 SKILL.md 剪出、写入 references（逐字），
 *             SKILL.md 保留 H1 + 未移动章节 + 生成的索引表
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const SK = path.join(os.homedir(), '.codebuddy', 'skills')

const [mode, skill, planPath] = process.argv.slice(2)
if (!mode || !skill) { console.log('usage: list <skill> | apply <skill> <plan.json>'); process.exit(1) }
const dir = path.join(SK, skill)
const file = path.join(dir, 'SKILL.md')
if (!fs.existsSync(file)) { console.log('no skill: ' + skill); process.exit(1) }

const raw = fs.readFileSync(file, 'utf8')
const fmM = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
const fm = fmM ? fmM[0] : ''
let body = raw.slice(fm.length)

/* 按二级标题切块（保留标题行） */
function blocks(text) {
	const parts = text.split(/(?=^##\s)/m)
	return parts.map(p => ({ text: p, title: (p.match(/^##\s+(.+)$/m) || [])[1] || '' })).filter(b => b.text.trim())
}

if (mode === 'list') {
	const bs = blocks(body)
	const total = Buffer.byteLength(body, 'utf8')
	console.log('=== ' + skill + '：正文 ' + (total / 1024).toFixed(1) + ' KB，' + bs.length + ' 块 ===')
	bs.forEach((b, i) => {
		const kb = (Buffer.byteLength(b.text, 'utf8') / 1024).toFixed(1)
		console.log(String(i).padStart(2) + '  ' + String(kb).padStart(5) + ' KB  ' + (b.title || '(前言/无标题)').slice(0, 60))
	})
	process.exit(0)
}

if (mode === 'apply') {
	const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
	const bs = blocks(body)
	const refDir = path.join(dir, 'references')
	fs.mkdirSync(refDir, { recursive: true })
	const index = []
	const moved = new Set()
	for (const refName of Object.keys(plan)) {
		const pats = plan[refName]
		const picked = []
		bs.forEach((b, i) => {
			if (moved.has(i)) return
			if (!b.title) return
			if (pats.some(p => b.title.indexOf(p) >= 0)) { picked.push(b); moved.add(i) }
		})
		if (!picked.length) { console.log('⚠ ' + refName + ' 没匹配到任何章节：' + JSON.stringify(pats)); continue }
		const payload = '# ' + refName.replace(/^references\//, '').replace(/\.md$/, '') + '\n\n' +
			'> 由 `' + skill + '/SKILL.md` 拆分而来（2026-11-07），内容逐字未改。\n\n' +
			picked.map(b => b.text).join('')
		fs.writeFileSync(path.join(dir, refName), payload, 'utf8')
		index.push({ ref: refName, titles: picked.map(b => b.title), kb: +(Buffer.byteLength(payload, 'utf8') / 1024).toFixed(1) })
	}
	/* 剩余章节重组 SKILL.md */
	const rest = bs.filter((b, i) => !moved.has(i)).map(b => b.text).join('')
	const idx = [
		'## 细则索引（按需读，别一次全读）',
		'',
		'| 文件 | 覆盖章节 | 体积 |',
		'|---|---|---|',
		...index.map(x => '| `' + x.ref + '` | ' + x.titles.map(t => t.replace(/\|/g, '/')).join('；').slice(0, 90) + ' | ' + x.kb + ' KB |'),
		'',
	].join('\n')
	const newBody = rest.replace(/\s*$/, '\n') + '\n' + idx
	fs.writeFileSync(file, fm + newBody, 'utf8')
	console.log('=== 拆分完成 ===')
	for (const x of index) console.log('  ' + x.ref.padEnd(30, ' ') + x.kb + ' KB  ← ' + x.titles.length + ' 节')
	console.log('  SKILL.md 剩余 ' + (Buffer.byteLength(newBody, 'utf8') / 1024).toFixed(1) + ' KB')
	process.exit(0)
}
console.log('unknown mode ' + mode)
