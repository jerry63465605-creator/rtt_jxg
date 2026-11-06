/*
 * 检查 15215《卓越规划》近期有没有被改动 / 误改动
 *
 * 两个角度：
 *   ① 【大括号配平】精确取出 15215 配置块、deck_inspect 处理块、CARD_TRIGGERS 行，
 *      与 11-05 之前的基线逐字符比较（统一换行、忽略行尾空白）；
 *   ② 【diff 扫描】看 11-05 起的改动里，有没有任何 hunk 碰到这三处的关键字
 *      （这才是"误改动"的真正证据：隔壁改动把这一块牵连了）。
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const FILE = 'server-official/public/quartermaster-sub-wars/rules.js'
const CLIENT = 'server-official/public/quartermaster-sub-wars/play.js'

const git = cmd => execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
const norm = s => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '')

const baseLine = git('git log --before="2026-11-05 00:00" -1 --format=%h').trim()
const base = norm(git('git show ' + baseLine + ':' + FILE))
const now = norm(fs.readFileSync(path.join(ROOT, FILE), 'utf8'))

/* 从 key 起，配平大括号取出整块 */
function blockOf(src, key) {
	const i = src.indexOf(key)
	if (i < 0) return null
	const open = src.indexOf('{', i)
	if (open < 0) return null
	let depth = 0
	for (let p = open; p < src.length; p++) {
		const ch = src[p]
		if (ch === '{') depth++
		else if (ch === '}') {
			depth--
			if (depth === 0) return src.slice(i, p + 1)
		}
	}
	return null
}

console.log('基线提交 = ' + baseLine + '（2026-11-05 之前最后一个）\n')
let drift = 0
const cases = [
	{ name: '15215 配置块', key: "'15215': {" },
	{ name: 'deck_inspect 处理块', key: "if (st.op === 'deck_inspect') {" },
	{ name: 'CARD_TRIGGERS 15215', key: "CARD_TRIGGERS['15215']" },
]
for (const c of cases) {
	const a = blockOf(base, c.key)
	const b = blockOf(now, c.key)
	if (!a || !b) { console.log('  ✗ ' + c.name + ' 缺失（基线 ' + !!a + ' / 现在 ' + !!b + '）'); drift++; continue }
	if (a === b) console.log('  ✓ ' + c.name + ' 与基线逐字符一致（' + a.split('\n').length + ' 行）')
	else {
		drift++
		console.log('  ✗ ' + c.name + ' 有差异：')
		const al = a.split('\n'), bl = b.split('\n')
		let shown = 0
		for (let i = 0; i < Math.max(al.length, bl.length) && shown < 4; i++) {
			if (al[i] !== bl[i]) {
				console.log('      基线 L' + (i + 1) + ': ' + (al[i] || '(无)'))
				console.log('      现在 L' + (i + 1) + ': ' + (bl[i] || '(无)'))
				shown++
			}
		}
	}
}

/* ② 11-05 起的 diff 里，有没有 hunk 碰到这些关键字 */
console.log('\n11-05 起的改动中，命中关键字的 hunk（误改动的真正信号）：')
const diff = git('git diff -U0 ' + baseLine + '..HEAD -- ' + FILE)
const hunks = diff.split(/\n(?=@@)/)
const KEYS = ['15215', 'deck_inspect', 'game.peek', 'peek']
let hit = 0
for (const h of hunks) {
	if (!h.startsWith('@@')) continue
	const body = h.split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
	if (!body.length) continue
	const touched = body.some(l => KEYS.some(k => l.indexOf(k) >= 0))
	if (touched) {
		hit++
		if (hit <= 8) console.log('  · ' + h.split('\n')[0] + '  →  ' + body.slice(0, 2).map(x => x.slice(0, 90)).join(' ‖ '))
	}
}
console.log(hit ? '  共 ' + hit + ' 个 hunk 命中（见上）' : '  （无 hunk 命中 → 这两天没有改动牵连 15215 / deck_inspect / peek）')

/* ③ 客户端 placement 提交段是否被动过 */
const cbase = norm(git('git show ' + baseLine + ':' + CLIENT))
const cnow = norm(fs.readFileSync(path.join(ROOT, CLIENT), 'utf8'))
const ckey = 'const payload = isTB'
const ca = blockOf(cbase, ckey), cb = blockOf(cnow, ckey)
console.log('\n客户端 placement 提交段：')
if (ca && cb) console.log('  ' + (ca === cb ? '✓ 与基线一致' : '✗ 有差异') + '（' + ca.split('\n').length + ' 行）')
else console.log('  ✗ 未找到（基线 ' + !!ca + ' / 现在 ' + !!cb + '）')
if (ca && cb && ca !== cb) drift++

console.log('\n' + (drift === 0 ? '结论：15215 相关实现【无近期改动、无误改动】' : '结论：发现 ' + drift + ' 处差异，需逐条核对'))
process.exitCode = drift ? 1 : 0
