/* 登记 B29（名将系列 armed 选地区无候选）/ B30（17509 白扣损耗） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(P, 'utf8')

const b29 = [
	'',
	'### B29. 名将系列 armed「再选一次地区」时客户端无候选（点了没反应）',
	'',
	'- **对象**：16800 艾森豪威尔 / 16801 哈尔西 / 16802 麦克阿瑟 / 16803 尼米兹（美国 SUPP，armed 再建/再战）。',
	'- **实测**（`tools/_probe_us_ace_detail2.js`）：建设陆军 → 窗口开出 16800 → 点它（不带 space）：',
	'  日志只有「请选择一个地区」，但 `game.pending_echo=null`、`view.pending_echo=null`、`view.pending_ask=null`、',
	'  `view.armed_offer.cards[]` 里没有 candidates、`build_actions` 也没有 choose/pick → **客户端没有任何可点项**。',
	'- **对照**：带 `space` 再发一次立刻成功（「在阿拉斯加再建设 1 支美国陆军」，陆军 2→3）。',
	'- **根因方向**：`run()` 返回 `{need:\'space\', candidates:[...]}`，通用持久化/下发读的是 `cands`/`options`，',
	'  候选被判空后被 `is_empty_echo_frame` 守卫当"脏空框"清掉 → 只剩日志。',
	'- **建议修法**：armed `need` 的统一处理处做 `candidates → cands` 归一化（早于空框守卫）；',
	'  补真实测试 4 条（四张上将各一条：不带 space 时 view 必须有候选）。',
	'',
].join('\n')

const b30 = [
	'',
	'### B30. 17509《王牌飞行员帕皮·博因顿》：无合法地时白扣损耗 + 提示像"未实现"',
	'',
	'- **实测**（`tools/_probe_us_ace_detail2.js`）：计分阶段打出，中太平洋及相邻无可部署空军的地 →',
	'  日志「无法执行：……没有任何可执行的效果」，但**牌库 76→75（代价已扣）**，卡仍在手。',
	'- **问题**：① 代价白扣；② 文案像"未实装"，玩家会以为卡坏了。',
	'- **建议修法**：`steps` 前先算合法目标，无目标 → `{ok:false, reason:\'<中太平洋>及相邻没有可部署空军的地区\'}` 且不扣 cost。',
	'',
].join('\n')

if (s.indexOf('B29. 名将系列') < 0) s = s.replace(/\s*$/, '\n') + b29
if (s.indexOf('B30. 17509') < 0) s = s.replace(/\s*$/, '\n') + b30
fs.writeFileSync(P, s, 'utf8')
console.log('B29 =', fs.readFileSync(P, 'utf8').indexOf('B29. 名将系列') >= 0,
	' B30 =', fs.readFileSync(P, 'utf8').indexOf('B30. 17509') >= 0)
