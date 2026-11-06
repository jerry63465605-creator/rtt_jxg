/* B20：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · B20 被压制的状态卡 / 计分类状态卡，15328 也能弃掉',
	'',
	'- **玩家报**：被《保持冷静·继续前进》(15353) 无效掉的状态卡，应该也可以被《破译恩尼格码》(15328) 弃掉。',
	'- **根因**：`step_status_react()` 的压制分支直接 `continue`、没记 `p.fired`；',
	'  收尾又是 `if (fired.length && mode !== \'scoring\') notify_german_status_used(...)`，',
	'  计分类（auto）整类不上报 → `status_attacked` 请求里永远缺目标。',
	'- **改法**：① 压制分支也 `p.fired.push(it.cid)`；② 去掉 `mode !== \'scoring\'` 限制。',
	'- **验证**：`tools/_real_test_15328_discard_suppressed.js` 11 项 —— 真实链路',
	'  `phase_scoring → 15353 拦截窗口 → drop 付代价压制 → status_attacked → pending_trigger(15328)`',
	'  `→ resolve_response_choice{choice:15241} → 15241 进德国弃牌堆`；并验证计分类未压制时同样可触发。',
	'  设计文档 `docs/change-15328-suppressed.md`。',
	'- **回归**：15353 拦截 23、17732 auto 计分 11、17732 借用 88、15352 suspend 11、',
	'  `test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B20 被压制的状态卡') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + 7) + entry + s.slice(i + 7)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B20 被压制的状态卡') >= 0)

{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B20. 被 15353 压制（无效）的状态卡，15328 密码机也应能弃掉',
		'### ✅ B20. 被 15353 压制（无效）的状态卡，15328 密码机也能弃掉 —— 已修')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo B20 =', fs.readFileSync(t, 'utf8').indexOf('✅ B20') >= 0)
}
