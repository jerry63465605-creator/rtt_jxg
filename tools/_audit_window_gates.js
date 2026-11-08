/*
 * 审计「窗口落在对手多步/排他挂起中途」这一类问题
 *
 * 目标：把所有"排他挂起 × 应答窗口"的组合列成矩阵，找出：
 *   ① build_actions 白名单漏放行（客户端 send_action 静默丢弃 → 点了没反应）
 *   ② do_action 冻结门禁漏豁免（服务端直接拒 → 报"等待…"）
 *
 * 输出：每个排他分支允许的动作键 + 每个冻结门禁的豁免清单
 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')

const start = lines.findIndex(l => /^function build_actions/.test(l))
const end = lines.findIndex((l, i) => i > start && /^function [a-z_]+\(/.test(l))
console.log('=== build_actions 区间 L' + (start + 1) + ' ~ L' + (end || lines.length) + ' ===\n')

/* 找排他分支：block_reason 赋值 + 其后 60 行内出现的 acts.xxx = 1 */
for (let i = start; i < (end || lines.length); i++) {
	if (/game\.block_reason\s*=/.test(lines[i])) {
		const block = lines.slice(i, i + 70)
		const keys = [...new Set([...block.join('\n').matchAll(/\b(?:t?acts)\.([a-z_]+)\s*=\s*1/g)].map(m => m[1]))]
		const cond = lines.slice(Math.max(start, i - 6), i).map(s => s.trim()).filter(s => /^if \(|^if\(/.test(s)).slice(-1)[0] || ''
		console.log('L' + (i + 1) + '  ' + lines[i].trim().slice(0, 70))
		if (cond) console.log('        条件: ' + cond.slice(0, 100))
		console.log('        允许: ' + (keys.length ? keys.join(', ') : '(仅 log)'))
		console.log('')
	}
}

/* do_action 的冻结门禁：找 game.log.push('…等待…') 与紧随其后的 return game */
console.log('\n=== do_action 冻结门禁 ===\n')
const dstart = lines.findIndex(l => /^function do_action/.test(l))
for (let i = dstart; i < lines.length; i++) {
	if (/game\.log\.push\(/.test(lines[i]) && /等待|不能|只能|请先|期间/.test(lines[i])) {
		/* 往上找最近的 if 条件 */
		let j = i
		while (j > dstart && !/^\tif \(/.test(lines[j]) && !/^\tif\(/.test(lines[j])) j--
		const cond = lines[j] ? lines[j].trim() : ''
		console.log('L' + (i + 1) + '  ' + lines[i].trim().slice(0, 90))
		console.log('        条件: ' + cond.slice(0, 130))
		console.log('')
	}
}
