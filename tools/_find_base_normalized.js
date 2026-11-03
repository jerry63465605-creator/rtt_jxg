/*
 * 归一化换行（CRLF -> LF）后，找出线上 rules.js 对应的本地 base commit。
 * 方法：把线上与各历史版本都写到 tmp/ 下，用 `git diff --no-index --numstat` 数改动行数，取最小者。
 *
 * 用法：node tools/_find_base_normalized.js
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const ROOT = path.join(__dirname, '..')
const REL = 'server-official/public/quartermaster-sub-wars/rules.js'
const TMP = path.join(ROOT, 'tmp', 'basecmp')
fs.mkdirSync(TMP, { recursive: true })

const norm = s => s.replace(/\r\n/g, '\n')
const sh = cmd => execSync(cmd, { cwd: ROOT, maxBuffer: 1 << 28 }).toString()

const online = norm(fs.readFileSync(path.join(ROOT, 'tmp', 'online', 'rules.js'), 'utf8'))
const onPath = path.join(TMP, 'online.js')
fs.writeFileSync(onPath, online, 'utf8')

const commits = sh('git log --format=%h -- ' + REL + ' -18').trim().split('\n')
const rows = []
for (const c of commits) {
	const blob = norm(sh('git show ' + c + ':' + REL))
	const p = path.join(TMP, c + '.js')
	fs.writeFileSync(p, blob, 'utf8')
	let numstat = ''
	try {
		numstat = sh('git diff --no-index --numstat ' + JSON.stringify(p) + ' ' + JSON.stringify(onPath)).trim()
	} catch (e) { /* git diff 有差异时返回非 0，但 stdout 仍在 e.stdout */ }
	if (!numstat) {
		try { numstat = e => '' } catch (_) {}
	}
	let add = '?', del = '?'
	try {
		const out = execSync('git diff --no-index --numstat "' + p + '" "' + onPath + '"', { cwd: ROOT, maxBuffer: 1 << 28 }).toString()
		if (out.trim()) { const [a, d] = out.trim().split(/\s+/); add = a; del = d }
		else { add = 0; del = 0 }
	} catch (err) {
		const out = (err.stdout || '').toString()
		if (out.trim()) { const [a, d] = out.trim().split(/\s+/); add = a; del = d }
		else { add = 0; del = 0 }
	}
	rows.push({ c, add: Number(add), del: Number(del), total: Number(add) + Number(del), len: blob.length })
}
rows.sort((a, b) => a.total - b.total)
console.log('线上 rules.js（归一化后）= ' + online.length + ' 字符\n')
console.log('commit'.padEnd(10) + '+行'.padEnd(8) + '-行'.padEnd(8) + '合计'.padEnd(8) + '字符数')
for (const r of rows) console.log(r.c.padEnd(10) + String(r.add).padEnd(8) + String(r.del).padEnd(8) + String(r.total).padEnd(8) + r.len)
console.log('\n★ 最接近的 base: ' + rows[0].c + '（改动 ' + rows[0].total + ' 行）')
