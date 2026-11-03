/*
 * 找出「线上那份 rules.js」是基于本地哪个 commit 改的（用于三方合并的 base）
 * 判据：逐个历史版本读 rules.js，比对字符数 + 若干功能标记，取最接近者。
 *
 * 用法：node tools/_find_their_base.js
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const REL = 'server-official/public/quartermaster-sub-wars/rules.js'
const online = fs.readFileSync(path.join(ROOT, 'tmp', 'online', 'rules.js'), 'utf8')

const MARKERS = [
	['hand_viewer_for', /function hand_viewer_for/],
	['su_17817 side过滤', /su_17817_pending && faction_of_nation/],
	['15315 连带空军', /随陆军一起被消灭的空军/],
	['义勇军死锁修', /必须回答】的让权/],
	['雷达 ready', /只有【美国海军】被移除的那一刻才武装/],
	['云雾 原地移除', /_airNoRetreat/],
	['云雾 复原回退', /retreatAirsRestorable/, 'absent' ],
	['qm_piece_snapshot', /function qm_piece_snapshot/],
]

const sh = cmd => execSync(cmd, { cwd: ROOT, maxBuffer: 1 << 28 }).toString()

const commits = sh('git log --format=%h -- ' + REL + ' -40').trim().split('\n')
console.log('线上 rules.js 字符数 = ' + online.length + '\n')
console.log('commit'.padEnd(10) + '字符数'.padEnd(10) + '差值'.padEnd(10) + '标记')
for (const c of commits) {
	let blob
	try { blob = sh('git show ' + c + ':' + REL) } catch (e) { continue }
	const onMarks = MARKERS.filter(([n, re, mode]) => (mode === 'absent' ? !re.test(online) : re.test(online))).map(x => x[0])
	const cm = MARKERS.filter(([n, re, mode]) => (mode === 'absent' ? !re.test(blob) : re.test(blob))).map(x => x[0])
	const match = MARKERS.filter(([n, re, mode]) => {
		const a = mode === 'absent' ? !re.test(online) : re.test(online)
		const b = mode === 'absent' ? !re.test(blob) : re.test(blob)
		return a === b
	}).length
	console.log(c.padEnd(10) + String(blob.length).padEnd(10) + String(online.length - blob.length).padEnd(10) +
		match + '/' + MARKERS.length + '  缺: ' + JSON.stringify(MARKERS.map(x => x[0]).filter(n => !cm.includes(n))) )
}
console.log('\n（线上独有 = ' + JSON.stringify(onMarks) + '）')
