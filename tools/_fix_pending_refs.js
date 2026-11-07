/* 合并后收尾：① 校验伞形 frontmatter ② 把其它 skill 正文里对旧 skill 名的引用改成新路径 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const SK = path.join(os.homedir(), '.codebuddy', 'skills')

/* ① 校验 */
const umb = path.join(SK, 'rtt-pending', 'SKILL.md')
const t = fs.readFileSync(umb, 'utf8')
const head = t.split(/\r?\n/).slice(0, 5)
console.log('=== 伞形 SKILL.md 前 5 行（原始）===')
head.forEach((l, i) => console.log((i + 1) + ': ' + JSON.stringify(l)))
console.log('frontmatter 形态合法（首行 ---，含 name/description）= ' +
	(head[0].trim() === '---' && /^name:/.test(head[1]) && /^description:/.test(head[2])))

/* ② 旧名 → 新路径（只动正文散文，不动 frontmatter） */
const MAP = {
	'rtt-pending-suspend': 'rtt-pending（references/suspend.md）',
	'rtt-pending-clear-side': 'rtt-pending（references/clear-side.md）',
	'rtt-pending-whitelist-deadlock': 'rtt-pending（references/whitelist-deadlock.md）',
	'rtt-play-quota-windows': 'rtt-pending（references/quota-windows.md）',
}
let files = 0, subs = 0
for (const d of fs.readdirSync(SK)) {
	if (d === 'rtt-pending') continue
	const f = path.join(SK, d, 'SKILL.md')
	if (!fs.existsSync(f)) continue
	let txt = fs.readFileSync(f, 'utf8')
	const m = txt.match(/^---\r?\n[\s\S]*?\r?\n---/)
	if (!m) continue
	const fm = m[0]
	let body = txt.slice(fm.length)
	let n = 0
	for (const k of Object.keys(MAP)) {
		const before = body
		body = body.split(k).join(MAP[k])
		if (body !== before) n += (before.split(k).length - 1)
	}
	if (n) { fs.writeFileSync(f, fm + body, 'utf8'); files++; subs += n; console.log('  更新 ' + d + '：' + n + ' 处') }
}
console.log('共更新 ' + files + ' 个 skill / ' + subs + ' 处引用（frontmatter 未动）')
