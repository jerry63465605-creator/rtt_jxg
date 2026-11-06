/* B25-a：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · B25-a 15343 压不掉「海峡强制轴心」——status_card_effective 归属判定丢失',
	'',
	'- **玩家报**：局内实测海峡强制轴心（15254 战争海军 / 17747 直布罗陀）没被 15343《霍巴特滑稽坦克》压制。',
	'- **根因**：`status_card_effective()` 只用 `status_config_of(cardId).actor` 取归属，',
	'  而**所有状态卡配置都没有 `actor` 字段** → 传 null → `faction_of_nation(null)=null` →',
	'  `status_active` 提前 `return true`（视为有效）。',
	'  于是凡走它的路径（`compute_connections` 的海峡强制、`compute_supply` 的波罗的海中继）**恒不压制**；',
	'  其它路径显式传桌面国，所以一直正常 —— 这就是"部分能压、海峡不行"。',
	'- **改法**：归属三级回退 `cfg.actor → inst_card().nation → 桌面归属国`（1 处）。',
	'- **验证**：`tools/_real_test_15343_strait.js` 11 项（基准/强制/英国回合恢复/缓存与现算一致/',
	'  非英国回合不压制/15353 压制同款/17747 同判据/静态守卫）；设计文档 `docs/change-15343-strait.md`。',
	'- **回归**：15353 23、空军派发 16、17811 21、15226 14、17732 auto 11、15215 10、',
	'  `test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B25-a 15343 压不掉') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + 7) + entry + s.slice(i + 7)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B25-a 15343 压不掉') >= 0)

{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B25. 15343《霍巴特滑稽坦克》压制不全：光环类状态卡照旧生效（玩家口径"应该全能压制"）',
		'### B25. 15343 压制不全（光环类）——**B25-a 已修**（海峡强制轴心/中继）；b/c 待评估')
	u = u.replace('  - `15254 战争海军`（strait_force_axis）：**也压不掉**',
		'  - ✅ **已修（B25-a）**：`15254 战争海军`（strait_force_axis）此前**也压不掉**')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo =', fs.readFileSync(t, 'utf8').indexOf('B25-a 已修') >= 0)
}
