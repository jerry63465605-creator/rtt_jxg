/* 登记 B25：15343 霍巴特滑稽坦克——光环类状态卡未被压制（应"全能压制"） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(P, 'utf8')
const block = [
	'',
	'### B25. 15343《霍巴特滑稽坦克》压制不全：光环类状态卡照旧生效（玩家口径"应该全能压制"）',
	'',
	'- 实测（`tools/_probe_15343_aura.js`，英国回合 + 15343 在桌面）：',
	'  - `15444 丘克群岛`（port_as 港口光环）：**坦克在场仍然可建**（应失效）❌',
	'  - `8601 远东共和国`（space_immune 地区免疫）：**坦克在场仍然免补给/免移除** ❌',
	'  - `15254 战争海军`（strait_force_axis）：走 `status_card_effective`，**已被压制** ✅（对照组）',
	'- 根因（两类叠加）：',
	'  ① **存储没带卡 id**：`aura.port_as[sp] = og.nation`、`aura.space_immune[sp] = og.nation`',
	'    （`rules.js:8566 / 8575`）——只知道"哪国"，无法反查"哪张卡"，压制无处落地；',
	'  ② **读取不走统一判据**：`supply_aura_covers()`（L762）、`navy_ab_check()` 的 port_as 分支（L816）、',
	'    `supply_immune`（L765/1038）、`shared_supply_group`（L714）、`pair_adjacency`（L8612 直接改连接表）',
	'    都直接读持久字段，**从不调用 `status_card_effective()`**。',
	'- 另外待确认的口径：`status_active()` 目前只在 `current_nation === \'英国\'` 时让 15343 生效',
	'  （L7443，2026-10-25 修复）——"本回合"是指英国自己的回合，还是"只要在桌面就一直压制"？',
	'- 方案（3 步）：',
	'  1. 写入改存 **card_id**：`port_as[sp] = {card, nation}`、`space_immune[sp] = {card, nation}`',
	'     （老存档兼容：值是字符串国名时视为"无卡可压制"，按原样生效）；',
	'  2. 读取统一走 `status_card_effective(game, card)`（新增 `aura_owner_effective()` 小助手），',
	'     覆盖 `supply_aura_covers` / `navy_ab_check` / `compute_supply` 的 supply_immune /',
	'     `supply_group_partner` / `pair_adjacency` 注入的连接；',
	'  3. `pair_adjacency` 改为**每次重算**（写进 `status_aura` 摘要，由 `compute_connections` 注入）',
	'     而不是直接改连接表，否则无法撤销。',
	'- 测试：`_real_test_15343_aura_full.js` —— 每类光环 2 条断言（无坦克生效 / 有坦克失效），',
	'  覆盖 15444、8601、15254、17744、17549、15346(方向相反的对照)、15443/6601(标记类回归)。',
	'',
].join('\n')
if (s.indexOf('B25. 15343《霍巴特滑稽坦克》压制不全') < 0) {
	s = s.replace(/\s*$/, '\n') + block
	fs.writeFileSync(P, s, 'utf8')
}
console.log('B25 =', fs.readFileSync(P, 'utf8').indexOf('B25. 15343《霍巴特滑稽坦克》压制不全') >= 0)
