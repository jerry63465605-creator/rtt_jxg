/* B19：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · B19 增强卡拦截窗口强挂起（15352 布莱切利园 / 15353 / 16700）',
	'',
	'- **玩家报**：增强拦截窗口未挂起，没时间点就被跳过。',
	'- **根因**：`do_action` 的「对方时点」门禁只读 `ctx.piece_nation / ctx.target_nation`，',
	'  而 `enemy_echo_played` / `enemy_status_effect` 的 ctx 是 `{nation, card, …}`，两个字段都没有',
	'  → 门禁失效，打牌方可继续 `next_phase / play_card`，窗口过期。',
	'- **改法**：① 判据改为「窗口内**卡片的归属国**不属于本方阵营」（`cards[0].nation` 优先，回退 ctx 的两个字段）；',
	'  ② 新增 `internal_action()` 包裹引擎内部重放（8 处），门禁加 `!game.__internal_depth` ——',
	'  否则“英国点不发动 → 引擎重放德国的 play_card”会被自己的门禁拦住 = 死锁。',
	'- **验证**：`tools/_real_test_15352_suspend.js` 11 项（含 next_phase / play_card 被拒、表态后恢复、',
	'  15353 同款、自有窗口不阻塞、静态守卫）；设计文档 `docs/change-15352-suspend.md`。',
	'- **回归**：15311 15、15353 23、17732 88、17811 21、15410 18、15226 14、',
	'  `_smoke_echo_intercept_queue` 22（修复前 4 项失败）、`_smoke_17555_depression` 39、',
	'  `test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B19 增强卡拦截窗口强挂起') < 0) {
	const marker = '---\r\n\r\n'
	const i = s.indexOf(marker)
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + marker.length) + entry + s.slice(i + marker.length)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B19 增强卡拦截窗口强挂起') >= 0)

{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B19. 增强卡拦截窗口（15352 布莱切利园）未强挂起 —— 玩家没时间点就被跳过',
		'### ✅ B19. 增强卡拦截窗口（15352 布莱切利园）未强挂起 —— 已修（判据改为卡片归属国 + internal_action 豁免）')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo B19 =', fs.readFileSync(t, 'utf8').indexOf('✅ B19') >= 0)
}
