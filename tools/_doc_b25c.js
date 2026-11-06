/* B25-c：fix-log + todo（B25-c ✅ / B25-b 记录不改） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · B25-c 17744/17747 成对邻接可被 15343 压制（B25-b 评估为不改）',
	'',
	'- **问题**：17744《土耳其开放海峡》/ 17747《西班牙控制直布罗陀》给轴心加的永久成对邻接',
	'  写入 `game.status_connections` 时**不带卡 id**，读取只按 side 过滤 → 英国回合挂 15343 也照旧可走。',
	'- **改法**：① 写入带 `card`；② `get_connections` 读取时 `if (sc.card && !status_card_effective(...)) continue`；',
	'  ③ `revert_status_ongoing` 的 `pair_adjacency` 分支按 card 摘除（顺带补上历史上"不实现撤销"的妥协）。',
	'  老存档无 `card` 字段 → 视为常驻有效，行为不变。',
	'- **语义**：17744 是"给轴心加一组邻接"，压制后正确表现是**轴心失去**该邻接（不是"同盟恢复"）。',
	'- **验证**：`tools/_real_test_15343_pair_adjacency.js` 12 项（基准/加邻接/英国回合失去/非英回合不压制/',
	'  15353 同款/老存档兼容/17747 同判据/离场摘除/静态守卫）；文档 `docs/change-15343-pair-adjacency.md`。',
	'- **B25-b 评估结论：不改** —— 15444（port_as）/ 8601（space_immune）的光环使用时机都在日本/苏联回合，',
	'  而 15343 只在英国回合生效，窗口不重叠（8601 实际零影响；15444 仅"英国回合算日本海军补给"这一边角）。',
	'  改造需要老存档迁移，收益极低，登记为"已评估不改"。',
	'- **回归**：15343 海峡 11、15353 23、空军派发 16、17811 21、15226 14、',
	'  `test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B25-c 17744/17747 成对邻接') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + 7) + entry + s.slice(i + 7)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B25-c 17744/17747 成对邻接') >= 0)

{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B25. 15343 压制不全（光环类）——**B25-a 已修**（海峡强制轴心/中继）；b/c 待评估',
		'### B25. 15343 压制不全（光环类）——**B25-a/B25-c 已修**；B25-b 已评估（不改，理由见 docs/change-15343-pair-adjacency.md）')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo =', fs.readFileSync(t, 'utf8').indexOf('B25-a/B25-c 已修') >= 0)
}
