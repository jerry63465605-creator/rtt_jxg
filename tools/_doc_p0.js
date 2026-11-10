/* fix-log 追加：P0 统一兜底 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(P, 'utf8')
const E = [
	'',
	'---',
	'',
	'## 2026-11-10 · P0 应答窗口 × 排他挂起统一兜底（finish_acts / p0_armed_escape）',
	'',
	'- **背景**：16804《花园口决堤》在对手多步事件中途弹窗点不动；审计确认是**一类**问题——',
	'  13 个排他分支 / 17 段冻结门禁各自手写白名单，"本方持有 armed 窗口"的兜底只补过 3 处。',
	'- **改法**：① `build_actions` 出口统一 `finish_acts()`（覆盖全部 13 个排他分支）；',
	'  ② `do_action` 统一 `p0_armed_escape()`，追加到原先漏豁免的 5 段（econ/red/uranus/status_play/script）。',
	'- **语义不变**：对手窗口本方不能代答；行动方强挂起（B19）不回退；动作合法性仍由 use/skip 自校验。',
	'- **验证**：`_real_test_window_in_pending.js` 8×3=24 项全绿；basic 288/9；冒烟 112 全绿；',
	'  16804/17505/16805/17506/15411/两拦截卡/15352/17505高亮/15311 等既有测试全绿。',
	'- **影响面**：37 张 armed 卡（13 张 watch 为唯一行为变化子集、20 张多步收益最大）。',
	'',
].join('\n')
if (s.indexOf('P0 应答窗口 × 排他挂起统一兜底') < 0) {
	fs.writeFileSync(P, s.replace(/\s*$/, '\n') + E, 'utf8')
	console.log('✓ fix-log 已追加')
} else console.log('• fix-log 已有条目')
