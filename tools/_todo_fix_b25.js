/* 修正 B25：把"15254 已被压制"改成实测结论（也压不掉），并写明根因 cfg.actor 缺失 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(P, 'utf8')

const oldLine = "  - `15254 战争海军`（strait_force_axis）：走 `status_card_effective`，**已被压制** ✅（对照组）"
const newLine = [
	"  - `15254 战争海军`（strait_force_axis）：**也压不掉** ❌ —— 虽然读取处调了 `status_card_effective()`，",
	"    但该函数用 `cfg.actor` 取归属，而**所有状态卡配置都没有 actor 字段**（15254/17747/15343/15444/8601 全是 undefined），",
	"    于是 `status_active(game, card, null)` → `faction_of_nation(null)=null` → 提前 `return true`（= 视为有效）。",
	"    实测（`tools/_probe_15343_strait5.js`）：`status_active(card,null)=true`、`status_active(card,'德国')=false`。",
].join('\n')

if (s.indexOf(oldLine) >= 0) {
	s = s.replace(oldLine, newLine)
}
/* 在根因段补一条"③ 归属判定拿不到国家" */
const anchor = '  ② **读取不走统一判据**'
if (s.indexOf('③ **归属判定拿不到国家**') < 0 && s.indexOf(anchor) >= 0) {
	s = s.replace(anchor, [
		'  ③ **归属判定拿不到国家**：`status_card_effective(game, cardId)` 只用 `status_config_of(cardId).actor`，',
		'    而状态卡配置里根本没有 actor → 传 null → `status_active` 提前返回 true（视为有效），',
		'    所以即便读取处调了它（海峡强制轴心 15254 / 17747）也等于没判。',
		'    修法：`status_card_effective` 的归属改为 `cfg.actor || inst_card(...).nation || 桌面归属国`。',
		'',
		anchor,
	].join('\n'))
}
fs.writeFileSync(P, s, 'utf8')
const back = fs.readFileSync(P, 'utf8')
console.log('回读：已改 15254 结论 =', back.indexOf('15254 战争海军`（strait_force_axis）：**也压不掉**') >= 0,
	' 已补 ③ =', back.indexOf('③ **归属判定拿不到国家**') >= 0)
