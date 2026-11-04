/* 精确对比：ENHANCEMENT/ECHO 分支里 "③ 还缺玩家选择" 的处理（a8adb92 vs 0f9cb26） */
const { execSync } = require('child_process')
const REL = 'server-official/public/quartermaster-sub-wars/rules.js'
const blob = c => execSync('git show ' + c + ':' + REL, { maxBuffer: 1 << 28 }).toString().replace(/\r\n/g, '\n')
const KEY = '③ 还缺玩家选择'

const show = (src, label) => {
	const all = src.split('\n')
	const n = all.findIndex(l => l.indexOf(KEY) >= 0)
	console.log('\n===== ' + label + ' =====')
	console.log('  含 echo_need = ' + /echo_need/.test(src) + '  含关键句 = ' + (n >= 0))
	if (n < 0) return
	console.log(all.slice(Math.max(0, n - 2), n + 20).map((l, k) => (Math.max(0, n - 2) + k + 1) + ': ' + l).join('\n'))
}

show(blob('a8adb92'), '父提交 a8adb92（0f9cb26 之前）')
show(blob('0f9cb26'), '0f9cb26（引入）')

/* 统计：0f9cb26 到底在这个分支加了什么 */
const diff = execSync('git show 0f9cb26 -- ' + REL, { maxBuffer: 1 << 28 }).toString().replace(/\r\n/g, '\n')
const i = diff.indexOf(KEY)
console.log('\n===== 0f9cb26 的 diff 片段（该分支） =====')
console.log(i < 0 ? '(diff 中未出现该关键词)' : diff.slice(Math.max(0, i - 200), i + 1500))
