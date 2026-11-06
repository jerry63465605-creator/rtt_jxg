/* B26：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-07 · B26 17505《P-51 野马》/ 17513《战时生产委员会》三处修复',
	'',
	'- **17505-A**：轰炸卡自身无效果时仍罚对手 → 改为 run 前后对比目标国总牌数，**真的造成损耗才加成**。',
	'- **17505-B**：半径口径错（只数大本营+1 环）→ 改用轰炸卡同源的 `bombing_radius(game, 2)`；',
	'  实测 2 环（罗斯）的美国空军此前完全不计，现已计入。',
	'- **17513-D**：打出后无回退路径（`us_wartime` 永久挂起、卡离手、代价未付）→ 新增 `cancel_us_wartime`：',
	'  **卡退回手牌、不付代价**（玩家口径），客户端弹窗加「不发动」按钮。',
	'- **注册表**：17505 / 17513 补进 `CMD_IMPL`（预览页不再误红）。',
	'- **验证**：`tools/_real_test_17505_17513.js` 16 项、`tools/_dom_test_us_wartime_cancel.js` 4 项；',
	'  文档 `docs/change-17505-17513.md`。',
	'- **回归**：supp 9、15343 pair 12、15353 23、`test_basic_cards` 288/9、全量冒烟 112 全绿；',
	'  客户端版本串 bump 到 `?v=20261107a`。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B26 17505') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + 7) + entry + s.slice(i + 7)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B26 17505') >= 0)

{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B26. 17505《P-51 野马》/ 17513《战时生产委员会》待核查（疑似还有其它 bug）',
		'### ✅ B26. 17505《P-51 野马》/ 17513《战时生产委员会》——已修（3 处 + 注册表，见 docs/change-17505-17513.md）')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo B26 =', fs.readFileSync(t, 'utf8').indexOf('✅ B26.') >= 0)
}
