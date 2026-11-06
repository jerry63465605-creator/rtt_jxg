/*
 * 清理上次 merge 时 `git add -A` 误入的临时文件（保留磁盘文件，只移出索引）
 * 用法：node tools/_cleanup_merge_junk.js
 */
const { execSync } = require('child_process')
const ROOT = require('path').join(__dirname, '..')
const sh = c => execSync(c, { cwd: ROOT, maxBuffer: 1 << 28 }).toString()

/* merge 提交默认不列文件，用与第一父的差异 */
const added = sh('git diff --name-status HEAD~1 HEAD')
	.split('\n')
	.filter(l => /^A\s/.test(l))
	.map(l => l.replace(/^A\s+/, '').trim())
	.filter(Boolean)

const isJunk = p =>
	/^out\//.test(p) && !/(adjacency|decks?|spaces)\.(json|txt)$/.test(p) ||
	/^cards_diff\.txt$/.test(p) ||
	/(^|\/)rtt_server\.(out|err)$/.test(p) ||
	/_harness_15315/.test(p) ||
	/(^|\/)_push_err\.txt$/.test(p)

const junk = added.filter(isJunk)
console.log('合并提交里新增 ' + added.length + ' 个文件，其中判定为临时文件 ' + junk.length + ' 个')
junk.slice(0, 12).forEach(p => console.log('  - ' + p))
if (junk.length > 12) console.log('  ...')

if (!junk.length) process.exit(0)
/* 分块执行，避免命令行过长 */
for (let i = 0; i < junk.length; i += 40) {
	const chunk = junk.slice(i, i + 40)
	sh('git rm --cached --quiet -- ' + chunk.map(p => JSON.stringify(p)).join(' '))
}
console.log('已从索引移除（磁盘保留），请配合 .gitignore 一起提交')
