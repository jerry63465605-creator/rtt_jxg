/* B9 标记为已完成（15353 拦截已覆盖 15250 的"被拦"路径） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')

s = s.replace('### B9. 15250《陆地巡航者》：应可被「康」',
  '### ✅ B9. 15250《陆地巡航者》：应可被「康」（已随 2026-11-05 的 15353 拦截改动覆盖）')

if (s.indexOf('### B9 备注：') < 0) {
	s = s.replace('### ✅ B9. 15250《陆地巡航者》：应可被「康」（已随 2026-11-05 的 15353 拦截改动覆盖）',
		`### ✅ B9. 15250《陆地巡航者》：应可被「康」（已随 2026-11-05 的 15353 拦截改动覆盖）

> **完成依据**（2026-11-05，提交 \`2f30cb7\`）：\`status_on_attacked\` 改为「结算前询问」，
> 15250/15243/15252 的触发进入 \`enemy_status_effect\` 窗口，15353 可拦下并让该卡本回合不生效
> （真实测试 A/B/C 三段：询问期间不扣牌 → 发动后 0 损耗 → 同回合不再触发）。
> **未覆盖部分**：16700《一日之狮》这类"响应卡"对 15250 的反制（拦上拦）仍走不到，
> 因为它需要 \`request_responses\` 响应栈而不是 armed 窗口 —— 若将来需要，另立条目。`)
}
fs.writeFileSync(p, s, 'utf8')
console.log('B9 已标记完成:', s.indexOf('✅ B9.') >= 0)
