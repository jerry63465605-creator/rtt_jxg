/* fix-log + todo：15411 改 B */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const fl = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(fl, 'utf8')
const entry = [
	'',
	'---',
	'',
	'## 2026-11-08 · 15411《夜间运输》改为「日本回合开始时」询问（方案 B）',
	'',
	'- **玩家口径**：从「补给阶段主动打出」改为「日本回合开始（resource）弹窗询问」；目标不再限定"无补给"。',
	'- **改法**：`ECHO_EFFECTS[\'15411\']` 改 armed（`when:\'nation_turn_start\'`, `actor:\'日本\'`,',
	'  `cost:{discard:1,filter:\'response\'}`, 两步 `run`：先付代价 → `need:\'piece\'` 选部队）；',
	'  删 `CARD_TRIGGERS[\'15411\']`；`phase_resource` 的 `nation_turn_start` 派发加日本；',
	'  `use_armed_offer` 代价预检补 `filter:\'response\'` 的**服务端**类型校验；',
	'  `trigger_ready` 对"只有 armed、没有 trigger"的卡改提示【待命】增强卡（不再说"未声明时点"）。',
	'- **验证**：`tools/_real_test_15411_armed.js` 11/11；`_smoke_jp_effect.js` 129/0；basic 288/9；冒烟 112 全绿。',
	'- **注意**：armed 语义 = 错过即失效（先做资源再分配则不弹）。',
	'',
].join('\n')
if (s.indexOf('15411《夜间运输》改为') < 0) s = s.replace(/\s*$/, '\n') + entry
fs.writeFileSync(fl, s, 'utf8')

const td = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
let t = fs.readFileSync(td, 'utf8')
const tEntry = [
	'',
	'### B33. 15411《夜间运输》改「日本回合开始时」询问（方案 B）—— ✅ 已完成',
	'',
	'- armed 通道（nation_turn_start / actor 日本 / 弃 1 响应 / 两步选部队），目标不再限无补给。',
	'- 派发点加日本；代价 filter 在服务端校验；提示文案改【待命】增强卡。',
	'- 真实测试 11 项；日本增强冒烟 129/0；basic 288/9；全量冒烟 112 全绿。',
	'',
].join('\n')
if (t.indexOf('B33. 15411') < 0) t = t.replace(/\s*$/, '\n') + tEntry
fs.writeFileSync(td, t, 'utf8')
console.log('fix-log / todo 已更新')
