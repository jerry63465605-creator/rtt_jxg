/* fix-log 追加：17505 一次性改造 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(P, 'utf8')
const ENTRY = [
	'',
	'---',
	'',
	'## 2026-11-08 · 17505 P-51 野马：永久装载 → 一次性额外损耗（对照 17705）',
	'',
	'- **玩家口径**：卡面「打出[轰炸行动]时」= 一次性加成，不是永久被动；旧实现装载 `game.us_p51` 后永久生效。',
	'- **改法**：新增 `ECHO_EFFECTS[\'17505\'].armed`（`when:\'econ_used\'`，run 用 `attrition_passive` 追加 2×空军数）；',
	'  删除 play_card 装载特例 / `CARD_TRIGGERS[\'17505\']` / ECON 内联加成 / CMD_IMPL 条目；',
	'  顺手修 `check_phase_for_card` 的 EFFECT 兜底 —— 只有 armed、没有 trigger 的卡不再「高亮可打却点了被拒」。',
	'- **实测坑**：`econ_used` 的 `ctx.attrited` 是 `{国家: 张数}` **对象**，ready 里必须归一化，否则窗口永不弹。',
	'- **验证**：`_real_test_17505_oneshot.js` 9/9；旧两个测试改写后 16 / 13 项全绿；basic 288/9；冒烟 112 全绿。',
	'',
].join('\n')
if (s.indexOf('P-51 野马：永久装载 → 一次性额外损耗') < 0) {
	fs.writeFileSync(P, s.replace(/\s*$/, '\n') + ENTRY, 'utf8')
	console.log('✓ fix-log 已追加')
} else console.log('• fix-log 已有条目')
