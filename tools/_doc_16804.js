/* fix-log 追加：16804 弹窗卡死修复 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(P, 'utf8')
const E = [
	'',
	'---',
	'',
	'## 2026-11-08 · 16804《花园口决堤》弹窗点不动（卡死）—— echo_need 门禁漏放行武装窗口',
	'',
	'- **现象**：`game 5986` 弹窗出现，点「发动」/「不发动」都无反应，卡死。',
	'- **根因（双层）**：16804 的触发发生在**对手多步事件中途**（`pending_echo` 仍在），',
	'  ① `build_actions` 的 pending_echo 分支只返回 `{log:1}` → 客户端 `view.actions` 无 key → `send_action` 静默不发；',
	'  ② `do_action` 的 `echo_need` 门禁只放行 `play_card`/`log` → 绕过客户端也会被拒。',
	'  （`pending_theater` / `pending_autobahn` 两处早就放行了武装窗口，唯独这里漏了。）',
	'- **改法**：两处都按 `hasArmedOfferForSide(game, side)` 追加 `use_armed_offer` / `skip_armed_offer`；',
	'  `do_action` 那段由三元嵌套重写为"允许列表"，逻辑等价、`wait_intercept` 口径不变。',
	'- **验证**：`_real_test_16804_echo_window.js` 10/10；basic 288/9；冒烟 112 全绿。',
	'',
].join('\n')
if (s.indexOf('16804《花园口决堤》弹窗点不动') < 0) {
	fs.writeFileSync(P, s.replace(/\s*$/, '\n') + E, 'utf8')
	console.log('✓ fix-log 已追加')
} else console.log('• fix-log 已有条目')
