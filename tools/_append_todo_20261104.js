/* 追加 2026-11-04 的待办（C1/C2/C3 及其他未开工项） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')

const text = `

---

## 待办：客户端窄屏浮层（C1+C2）与计分标记（C3） · 2026-11-04 登记（未开工）

**背景**：当前本地/线上客户端是**外部 UI 交付原版**（提交 \`9252f1d\` 回退），此前两版修复
（\`ca25ccc\` 面板收口、\`c5656db\` 标记定位）**不在代码里**，需要重新应用到交付版客户端。

| # | 问题 | 现状（当前代码） | 建议改法 |
|---|---|---|---|
| **C1** | 窄屏（≤800px）日志栏变成 78vw 固定浮层、开着就压住地图，面板内**无关闭入口** | \`play.js:9190 let log_open = true\`；\`play.css:2392 #log_panel{position:fixed;left:0;…width:min(78vw,320px);z-index:940}\`；\`play.html\` 的 \`#log_panel_head\` 只有标题 | ① \`load_panel_state\` 窄屏强制 \`false\` 且不读不写 localStorage；② \`#log_panel_head\` 加 \`#log_close\`（×）+ CSS；③ 窄屏 \`top: var(--qm-header-h)\`、宽度 72vw/300px |
| **C2** | 日志栏与右侧栏窄屏**不互斥**；\`apply_log_panel/apply_aside\` **每次刷新都 refit 地图** | 无 \`is_narrow_screen() && log_open\`；无 \`log_layout_open\` | 窄屏开一个自动关另一个；新增 \`log_layout_open/aside_layout_open\`，只在**开合变化**时 \`__qm_refit_map()\` |
| **C3** | 计分标记**漂移**（浮在格位上方外侧；宽度写死 46；海域仍按 118 算） | \`position_marker\` 无 \`layout[...]\`、无 \`offsetWidth\`、**定位在改文本之前** | 用 \`layout[data.name_of(id)]\` 真实 w/h（陆地 118/海域 106）+ 中心坐标（\`sp.x + w/2\`）+ 实测 \`offsetWidth\`，并把 \`position_marker\` 调用移到文本更新**之后** |

**共同注意**：纯客户端改动，改完 \`play.js/play.css/play.html\` 需 bump 4 处 \`?v=\`（当前 \`20261104h\`），
**不需要重启 8091**；jsdom 测试要用真实 \`play.html/play.js\`。

**验收**：
- 新增 \`tools/_dom_test_panel_narrow.js\`（11 项：窄屏默认隐藏 / 打开可见 / \`#log_close\` 可关 / 互斥 / 不写 localStorage；桌面仍常驻）；
- 新增 \`tools/_dom_test_marker_corner.js\`（8 项：右上角内侧、内容变宽不漂、缩放重排、海域按 106）；
- 回归：\`_dom_test_15315\` / \`_dom_test_17543_highlight\` / \`_dom_test_17850_modal\` / \`_dom_test_15209_budget\` / 全量冒烟 112。

---

## 其它仍未开工的项（同日盘点）

| # | 项 | 说明 |
|---|---|---|
| **S3** | 战斗/状态卡"运行期失败"时 \`attrition\` 仍不回滚 | S2-b 已把"参数非法"提前到扣代价之前；剩下的是 run 内部才失败的极少数路径（如内嵌战斗被拦截），要回滚需重排牌库并回退 \`su_attrition_score\` 计分 |
| **T1** | \`piece_removed\` 系列 20 张卡逐卡核对「国家/兵种/地区」三问 | 17543 雷达已完成，其余未核 |
| **T2** | 15410《武士道》× 空军免死窗口互抢疑似卡死 | 复现计划与三种候选方案见上文 |
| **T5** | \`game.log\` 轮转上限 / \`view\` 缓存 / 前端 log DOM 节点上限 | 大局面卡顿的另一半 |
| **T6** | 前奏卡（PRELUDE / ARMAMENT）整体未实装 | — |
`

const cur = fs.readFileSync(p, 'utf8')
if (cur.indexOf('待办：客户端窄屏浮层') >= 0) {
	console.log('已存在，跳过')
} else {
	fs.appendFileSync(p, text, 'utf8')
	console.log('已追加待办，行数 +' + text.split('\n').length)
}
