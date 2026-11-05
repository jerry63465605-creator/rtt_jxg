/* B15 标记为低优先级并跳过 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')
const i = s.indexOf('### B15')
if (i < 0) {
	console.log('未找到 B15 标题')
	process.exit(0)
}
const lineEnd = s.indexOf('\n', i)
const heading = s.slice(i, lineEnd)
if (/跳过/.test(heading)) {
	console.log('已是跳过状态：', heading)
	process.exit(0)
}
s = s.slice(0, i) + '### \u23ec B15. 增强卡"付不起代价"时从窗口静默消失（低优先级 · 玩家裁定跳过）' + s.slice(lineEnd)
s += `
> **B15 裁定（2026-11-05）**：玩家确认属**低优先级需求，直接跳过**。
> 现状保持：\`offer_armed_effects\` 在 \`cost.discard\` / \`cost.attrition\` 不足时静默剔除候选，
> 玩家表现为"这次没弹窗"。若要恢复，方案与测试草案见本节正文。
`
fs.writeFileSync(p, s, 'utf8')
console.log('B15 已标记跳过')
