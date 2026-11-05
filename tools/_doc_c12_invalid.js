/* C1/C2 标记为"无效需求"（玩家口径），跳过 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')

s = s.replace('| **C1** | 窄屏（≤800px）日志栏变成 78vw 固定浮层、开着就压住地图，面板内**无关闭入口**',
	'| ~~**C1**~~ ⛔ | ~~窄屏日志栏浮层~~ —— **玩家判定为无效需求，跳过**（保持交付原版行为）')
s = s.replace('| **C2** | 日志栏与右侧栏窄屏**不互斥**；`apply_log_panel/apply_aside` **每次刷新都 refit 地图**',
	'| ~~**C2**~~ ⛔ | ~~窄屏互斥 + refit 收敛~~ —— **玩家判定为无效需求，跳过**')

if (s.indexOf('### ⛔ C1 / C2') < 0) {
	s += `
### ⛔ C1 / C2. 窄屏日志栏浮层与 refit 收敛（玩家判定：无效需求，不做）

- 现象（曾报）：≤800px 时 \`#log_panel\` 变 78vw 固定浮层、无关闭键、localStorage 记住"开"、每次日志刷新都 refit 地图。
- 处理：**玩家 2026-11-05 明确"标记为无效需求，直接跳过"** —— 保持外部交付原版行为，不再改动。
- 备注：相关实现若将来需要，历史提交 \`ca25ccc\` 有完整版本（窄屏默认关 + \`#log_close\` + 互斥 + \`log_layout_open\` 收敛），可参照。
`
}
fs.writeFileSync(p, s, 'utf8')
console.log('C1/C2 已标记无效并跳过:', s.indexOf('~~**C1**~~ ⛔') >= 0)
