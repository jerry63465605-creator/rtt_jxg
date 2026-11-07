/*
 * 修正上一步插入位置：把「## 〇、入口与互补」从 H1 之前挪到 H1 之后。
 * （上一步的 ^# 正则要求 H1 在正文第 0 字符，实际正文开头有空行 → 落到了 else 分支）
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const SK = path.join(os.homedir(), '.codebuddy', 'skills')
const MARK = '## 〇、入口与互补（先看这里）'

for (const name of fs.readdirSync(SK)) {
	const f = path.join(SK, name, 'SKILL.md')
	if (!fs.existsSync(f)) continue
	let t = fs.readFileSync(f, 'utf8')
	const p = t.indexOf(MARK)
	if (p < 0) continue
	const fmEnd = t.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
	const fm = fmEnd ? fmEnd[0] : ''
	let body = t.slice(fm.length)
	const bi = body.indexOf(MARK)
	if (bi < 0) continue
	/* 切出 block：到下一个以 "# " 开头的行为止（block 内不含 ## 标题） */
	const rest = body.slice(bi)
	const mNext = rest.slice(MARK.length).match(/\r?\n#\s/)
	const blockEnd = mNext ? bi + MARK.length + mNext.index + 1 : body.length
	const block = body.slice(bi, blockEnd).trim() + '\n'
	let remain = (body.slice(0, bi) + body.slice(blockEnd)).replace(/\n{3,}/g, '\n\n')
	/* 找 H1 */
	const h1 = remain.match(/^#\s+.+$/m)
	if (!h1) { console.log('no H1 in ' + name); continue }
	const idx = h1.index + h1[0].length
	remain = remain.slice(0, idx) + '\n\n' + block + remain.slice(idx)
	remain = remain.replace(/\n{3,}/g, '\n\n')
	fs.writeFileSync(f, fm + remain, 'utf8')
	console.log('✓ 重排 ' + name + '（H1 之后）')
}
