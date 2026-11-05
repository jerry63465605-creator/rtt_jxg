/* 15226 巴巴罗萨：fix-log 条目 + todo 备注（写入后回读校验） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · 15226《巴巴罗萨》：目标改为「德国回合开始时」的相邻快照（服务端）',
	'',
	'- **症状**（玩家报）：卡面写「选择在**本回合开始时**与德国陆军相邻的 3 支苏联陆军」，',
	'  实际却是**点击时实时**算 —— 回合中途把德国陆军移过去，就能选中"新变相邻"的苏联陆军。',
	'- **探针证据**：苏联陆军@罗斯、德国陆军@德国（不相邻）→ 打出后 targets=[]；',
	'  回合中途把一支德国陆军放到<东欧>（与罗斯相邻）→ targets=["罗斯"]。',
	'- **根因**：`15226` 走战斗预算，合法目标由 `event_battle_targets → step_space_candidates → spacesFn`',
	'  **每次点击实时重算**；而 `de_soviet_armies_near_german()` 扫的是**当前**德国陆军位置，',
	'  且用**静态** `data.spaces[].connections`（忽略海峡控制/阵营限制），与 `get_connections` 口径不一致。',
	'- **改法**（3 处）：',
	'  1. 新增 `refresh_barbarossa_snapshot()`：**德国回合开始**那一刻（`current_nation` 切成德国）冻结',
	'     `game.de_turn_start_adjacent = { round, units:[苏联陆军实例 id] }`；',
	'  2. 新增 `barbarossa_target_spaces()`：候选 = 快照里**仍在场**的苏联陆军所在地区（中途被消灭的自动消失）；',
	'     快照缺失（老存档/调试盘面）→ 回退实时计算并写一次性日志，避免老局打不出牌；',
	'  3. `15226` 的 `spacesFn` 改为读快照；`de_soviet_armies_near_german()` 的邻接改用 `get_connections(game, sp, 轴心)`。',
	'- **验证**：`tools/_real_test_15226_barbarossa.js` **14/14**',
	'  A 回合开始 3 支相邻 → 目标 3；B ★★ 中途移动造出的"新相邻"**不进**候选（修复点）、原有 3 个不变；',
	'  C ★★ 回合开始相邻但中途被消灭 → 从候选消失；D 只相邻 2 支 → 目标 2；',
	'  E 重新进入德国回合 → 快照按新局面重建；F 无快照 → 兜底 + 一次性日志；G 静态守卫 4 条。',
	'  回归：`test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'- **口径**：快照锚点 = **德国回合开始**（`current_nation`）；「相邻」按 `get_connections`（含海峡/阵营限制）；',
	'  `pick:3 / pickMin:1`（最多 3 支、可少选）保持不变 —— 若要"必须选满 3"，改 `pickMin:3` 并在快照不足 3 时禁止打出。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('15226《巴巴罗萨》') >= 0 && s.indexOf('回合开始时') >= 0 && s.indexOf('refresh_barbarossa_snapshot') >= 0) {
	console.log('fix-log 已存在该条目')
} else {
	const marker = '---\r\n\r\n'
	const i = s.indexOf(marker)
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + marker.length) + entry + s.slice(i + marker.length)
	fs.writeFileSync(p, s, 'utf8')
}
/* 回读校验 */
const back = fs.readFileSync(p, 'utf8')
console.log('回读校验：', back.indexOf('refresh_barbarossa_snapshot') >= 0 ? 'OK' : 'FAIL')

/* todo 备注 */
{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	if (u.indexOf('15226《巴巴罗萨》目标快照（2026-11-06 完成）') < 0) {
		u += [
			'',
			'### ✅ 15226《巴巴罗萨》目标快照（2026-11-06 完成）',
			'',
			'- 目标改为「德国回合开始时」与德国陆军相邻的苏联陆军快照（`game.de_turn_start_adjacent`）；',
			'  中途移动造出的"新相邻"不再可选，被消灭的自动剔除；邻接口径统一走 `get_connections`。',
			'- 真实测试：`tools/_real_test_15226_barbarossa.js`（14 项）。',
			''
		].join('\n')
		fs.writeFileSync(t, u, 'utf8')
		console.log('todo 已补 15226')
	} else console.log('todo 已有 15226')
}
