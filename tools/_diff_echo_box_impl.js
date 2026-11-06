/* 对比「我们的基线 5b79eb0」与「外部 UI 交付 3ae0643」里 update_pending_echo_box 的实现 */
const { execSync } = require('child_process')
const REL = 'server-official/public/quartermaster-sub-wars/play.js'

const grab = commit => {
	const src = execSync('git show ' + commit + ':' + REL, { maxBuffer: 1 << 28 }).toString().replace(/\r\n/g, '\n')
	const i = src.indexOf('function update_pending_echo_box')
	if (i < 0) return '(未找到)'
	/* 取到下一个顶层 function 之前 */
	const rest = src.slice(i)
	const m = rest.slice(1).search(/\nfunction [A-Za-z0-9_]+\(/)
	return m < 0 ? rest : rest.slice(0, m + 1)
}

const A = grab('5b79eb0')
const B = grab('3ae0643')
const C = grab('HEAD')

console.log('基线 5b79eb0 函数长度 = ' + A.length)
console.log('外部交付 3ae0643 长度 = ' + B.length)
console.log('当前 HEAD 长度 = ' + C.length)
console.log('\n基线 == 外部交付 ? ' + (A === B))
console.log('外部交付 == HEAD ? ' + (B === C))

if (A !== B) {
	const al = A.split('\n'), bl = B.split('\n')
	console.log('\n=== 差异行 ===')
	const max = Math.max(al.length, bl.length)
	for (let k = 0; k < max; k++) {
		if (al[k] !== bl[k]) console.log('  L' + (k + 1) + '\n    - ' + (al[k] === undefined ? '(无)' : al[k].trim()) + '\n    + ' + (bl[k] === undefined ? '(无)' : bl[k].trim()))
		if (k > 120) { console.log('  ...（截断）'); break }
	}
}

console.log('\n=== 触发条件检查（当前 HEAD）===')
console.log('  出现 echo_need 就 display=block ? ' + /kind === 'echo_need'\)\s*\{\s*\n?\s*modal\.style\.display = "block"/.test(C))
console.log('  options 为空时是否跳过 choice 分支 ? ' + /pe\.step === 'choice' && Array\.isArray\(pe\.options\) && pe\.options\.length/.test(C))
console.log('  cands 为空时是否跳过 space 分支 ? ' + /pe\.step === 'space' && Array\.isArray\(pe\.cands\) && pe\.cands\.length/.test(C))
console.log('  有「不发动」按钮 ? ' + /不发动/.test(C))
