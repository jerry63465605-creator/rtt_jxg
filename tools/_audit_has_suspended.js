/*
 * 审计 #4 的共同模式：
 *   ① action 入口的 hasSuspended 清单（手写） vs 代码里实际存在的 game.pending_* 挂起态
 *   ② 状态卡窗口（status_instant）在哪些点会被清空
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const t = src.split('\n')

/* ① 提取 hasSuspended 表达式 */
const i = t.findIndex(l => /const hasSuspended\s*=/.test(l) || /hasSuspended\s*=/.test(l))
console.log('=== hasSuspended 定义处 (' + (i + 1) + ') ===')
console.log(t.slice(i - 2, i + 30).join('\n'))

/* ② 代码里出现过的 game.pending_* 字段 */
const fields = new Set()
const re = /game\.(pending_[a-z_]+|status_instant|us_theater_delegate|us_china_build|us_merchant|event_budget|delegate|handoff_stack|national_skill_offer)/g
let m
while ((m = re.exec(src))) fields.add(m[1])
console.log('\n=== 代码中出现过的挂起类字段 ===')
console.log([...fields].sort().join(', '))

/* ③ 哪些字段出现在 hasSuspended 区间里 */
const blockStart = i
let depth = 0, j = i
for (; j < t.length; j++) {
	blockStart
	const s = t[j]
	depth += (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length
	if (j > i && /^\s*(const|let|var|if|game\.|refresh)/.test(s) && depth <= 0) break
}
const block = t.slice(Math.max(0, i - 2), j + 2).join('\n')
const missing = [...fields].sort().filter(f => block.indexOf('game.' + f) < 0 && block.indexOf(f) < 0)
console.log('\n=== 未出现在 hasSuspended 里的挂起字段（疑似漏登记） ===')
console.log(missing.length ? missing.join(', ') : '（无）')

/* ④ status_instant 的清空点 */
console.log('\n=== status_instant = [] 的位置与上下文 ===')
t.forEach((l, k) => {
	if (/game\.status_instant\s*=\s*\[\]/.test(l)) {
		const head = t.slice(Math.max(0, k - 6), k + 1).map(x => x.trim()).filter(Boolean).slice(-4).join(' ⏎ ')
		console.log('  line ' + (k + 1) + ':  …' + head.slice(0, 200))
	}
})
