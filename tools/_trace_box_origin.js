/* 追「那个空选择框」是怎么被引入的：对比 0f9cb26 前后 play_card 的 r.pending 分支 */
const { execSync } = require('child_process')
const REL = 'server-official/public/quartermaster-sub-wars/rules.js'

const blob = c => execSync('git show ' + c + ':' + REL, { maxBuffer: 1 << 28 }).toString().replace(/\r\n/g, '\n')

const seg = (src, key, before = 6, after = 26) => {
	const i = src.indexOf(key)
	if (i < 0) return '(未找到 ' + key + ')'
	const start = src.lastIndexOf('\n', i)
	const lines = src.slice(0, i).split('\n').length - 1
	const all = src.split('\n')
	return all.slice(Math.max(0, lines - before), lines + after).map((l, k) => (Math.max(0, lines - before) + k + 1) + ': ' + l).join('\n')
}

for (const [label, c] of [['0f9cb26 之前（' + '0f9cb26^' + '）', '0f9cb26^'], ['0f9cb26 之后（含）', '0f9cb26']]) {
	console.log('\n===== ' + label + '：play_card 的 r.pending 分支 =====')
	const s = blob(c)
	console.log(seg(s, '③ 还缺玩家选择', 4, 22))
}

console.log('\n===== 0f9cb26 对该文件的改动统计 =====')
console.log(execSync('git show --stat --oneline 0f9cb26 -- ' + REL, { maxBuffer: 1 << 28 }).toString().trim())

console.log('\n===== 0f9cb26 里 `game.pending_echo = {` 的完整块 =====')
{
	const diff = execSync('git show 0f9cb26 -- ' + REL, { maxBuffer: 1 << 28 }).toString().replace(/\r\n/g, '\n')
	const i = diff.indexOf("+					const nd = r.need")
	const j = i >= 0 ? i : diff.indexOf('+				if (!_ownPe)')
	if (i < 0 && j < 0) console.log('(未找到新增块)')
	else {
		const from = Math.min(...[i, j].filter(x => x >= 0))
		console.log(diff.slice(from, from + 1300))
	}
}
