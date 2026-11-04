/* 用显式 hash 对比 a8adb92（0f9cb26 的父）与 0f9cb26 的 r.pending 分支（避免 ^ 被 cmd 吃掉） */
const { execSync } = require('child_process')
const REL = 'server-official/public/quartermaster-sub-wars/rules.js'
const blob = c => execSync('git show ' + c + ':' + REL, { maxBuffer: 1 << 28 }).toString().replace(/\r\n/g, '\n')

const showAround = (src, key, before = 3, after = 16) => {
	const all = src.split('\n')
	const n = all.findIndex(l => l.indexOf(key) >= 0)
	if (n < 0) return '(未找到：' + key + ')'
	return all.slice(Math.max(0, n - before), n + after).map((l, k) => (Math.max(0, n - before) + k + 1) + ': ' + l).join('\n')
}

for (const [label, c] of [['父提交 a8adb92（0f9cb26 之前）', 'a8adb92'], ['0f9cb26（引入 need 通道）', '0f9cb26']]) {
	const s = blob(c)
	console.log('\n===== ' + label + ' =====')
	console.log('  含 echo_need = ' + /echo_need/.test(s))
	console.log(showAround(s, 'if (r.pending)', 3, 14))
}
