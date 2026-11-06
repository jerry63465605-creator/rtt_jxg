/* 空军待死派发链修复：fix-log + todo 勾选 B16（写入后回读） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · 空军待死派发链修复：排队续派 / 窗口不再互踩 / 夺取制空权也派发',
	'',
	'- **背景**：上一轮"空军待死"讲清时点时实测到 3 个派发层缺陷（其中 1 个是 B10 部分回退时带进来的）。',
	'- **缺陷 1（回归）**：`pending_air_dispatch` 只写不读 —— 抵消时两国各掉 1 架，',
	'  第二架的 `piece_removed` 窗口排队后**永远不派发**，且队列永久残留。',
	'  → 新增 `flush_piece_removed_offers(game)`，在 `exports.action` 出口"当前窗口/响应栈都空"时补派一条。',
	'- **缺陷 2（B16）**：`offer_armed_effects` 以 `when` 合并窗口 —— 抵消时空军窗口刚开，',
	'  victim（陆军）紧接着的 `piece_removed` 派发会把整窗替换掉，17811 的 filter 不匹配 → **掉了飞机却打不出设计局**。',
	'  → 新增 `offer_armed_piece_removed(game, ctx)` 包装：窗口被占就入队，空闲才真派发；',
	'  全库 8 处 `offer_armed_effects(game, piece_removed, …)` 全部改走该包装。',
	'- **缺陷 3**：`seize_air`（夺取制空权 / 15407 秋水 / 15355 特种空勤团 / 中国卡）只有 `delete + note_removed`，',
	'  **从不派发** `piece_removed` → 被卡牌消灭的飞机永远不给 17811 窗口。',
	'  → 改走 `remove_air_with_piece_removed()`（内部已含 note_removed，避免重复计数）。',
	'- **顺带**：`remove_air_with_piece_removed` 在派发前先 `refresh(game)` —— 17811 的 `ready` 依赖',
	'  `su_air_deploy_spaces`（含补给计算），沿用删除前缓存会误判"无可部署地区"而把窗口过滤掉（seize 场景实测）。',
	'- **验证**：新增 `tools/_real_test_air_piece_removed_dispatch.js`（**16 项**）',
	'  A 抵消路径 17811 **开窗**（修复前 offers=[]）；B 战后可补机、陆军仍按原结果被移除；',
	'  C `pending_air_dispatch` 清空、无战斗挂起、窗口处理后 active 归还 Axis；',
	'  D `seize_air(by:card)` 消灭苏联空军 → 17811 开窗；E 可部署、队列无残留；F 静态守卫 5 条。',
	'  `_real_test_b10_design_bureau.js` 的 C 段已按新语义改写（22 项全过，含"窗口期间操作权归持有方、处理后归还"）。',
	'  回归：`_real_test_battle_air_return` 26、15353 23、17732 借用 88、15228 12、15210 11、秋水 14、B11 18、',
	'  `test_basic_cards` 288/9、`_smoke_piece_id_unified` 16、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('空军待死派发链修复') < 0) {
	const marker = '---\r\n\r\n'
	const i = s.indexOf(marker)
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + marker.length) + entry + s.slice(i + marker.length)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log 回读：', fs.readFileSync(p, 'utf8').indexOf('空军待死派发链修复') >= 0 ? 'OK' : 'FAIL')

/* todo：B16 标记完成 */
{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	const before = u
	u = u.replace('### B16. 17811《雅科夫列夫设计局》：抵消路径的窗口被 victim 派发覆盖（2026-11-06 登记）',
		'### ✅ B16. 17811《雅科夫列夫设计局》：抵消路径的窗口被 victim 派发覆盖（2026-11-06 已修）')
	if (u.indexOf('抵消路径窗口被覆盖') >= 0 && u.indexOf('（已修：改走排队包装') < 0) {
		u = u.replace('- 方案（未实施）：把 victim 的 `piece_removed` 派发也统一走"有同 `when` 窗口则排队"的逻辑，',
			'- 已修：新增 `offer_armed_piece_removed` 包装（窗口被占则入队，空闲才派发），全库 8 处改走它；\n' +
			'  配套 `flush_piece_removed_offers` 在 action 出口补派。验证：`_real_test_air_piece_removed_dispatch` 16 项。\n' +
			'- 原方案（保留作参考）：把 victim 的 `piece_removed` 派发也统一走"有同 `when` 窗口则排队"的逻辑，')
	}
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo 回读：', fs.readFileSync(t, 'utf8').indexOf('✅ B16') >= 0 ? 'OK' : 'FAIL', '（内容有变更:', u !== before, '）')
}
