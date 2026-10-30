/* 追加：分步机中间插入状态卡（战区移动 + 先进造船厂）的排查与修法 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
---

## 2026-10-30 · 分步机中间插入状态卡（战区移动 + 先进造船厂）

**症状**（zjr 报）：17532《战区移动》第 2 步建设海军后，桌面 17550《先进造船厂》的窗口
在提示里看得见，但**点不出效果**——点地图没反应，或被"不是《战区移动》的合法建设目标"拦掉。

**排查结论（关键：先分清是哪一段坏了）**：

1. **窗口武装**没问题：建完海军后 \`status_instant\` 里有
   \`{card_id:'17550#1', window:'after_build_navy', space:<刚建的海>}\`，
   \`view.table_status[17550].ready === true\`。
   ⚠ 武装发生在 **view/build_actions 那一遍**（读 \`game.last_built\` 后写 \`status_instant\` 并清空 last_built），
   所以**探针若在 view 之前断言 status_instant 会读到空** —— 别误判成"没武装"。
2. **服务端协议**没问题：\`query status_build_spaces\` → 选另一格海域 → \`activate_status{card,space}\`
   实测扣 1 张损耗、海军 +1、窗口消耗、\`status_used\` 写入、ready 归 false。
3. **真因在客户端点击优先级**：\`on_click_space()\` 里战区移动建设分支排在**最前**且 \`return\`
   （\`view.pending_theater.stage === 'build_navy'/'build_army'\` → \`resolve_theater\`），
   状态卡"选地"分支（\`status_act_phase === 'space'\`）在它后面 → 永远收不到点击。

**修复（A + 弱严格）**：

- 客户端：把状态卡选地抽成 \`handle_status_space_pick(s)\`，并在 \`on_click_space\` **最前面**拦下
  （原则：**玩家显式点某张卡发起的流程 > 隐式流程**，同 2026-10-15 把高速公路让位给状态卡选地）；
- 客户端 UI：\`#theater_box\` 改用 \`#event_step_box\` 同款视觉（\`.eb-title/.eb-hint/.eb-log\` + 边框底色，
  CSS 7 组选择器都加上 \`#theater_box\`），并给「发动《X》」与「下一步」两个按钮；
- 服务端：新增 \`theater_next\`（\`build_actions\` 与 \`pending_theater\` 门禁都要放行）：
  - 有候选 → 清掉上一步的状态窗口并提示继续点地图；
  - **无候选 → 跳过该步**（否则全图海域占满时会永久卡死）；
- 服务端弱严格：\`theater_resolve\` 入口调用 \`discard_theater_status_windows(actor)\`——
  推进即视为放弃上一步的窗口并记「【X】放弃发动《Y》」。
  为什么必须显式清：action 入口只在 \`hasSuspended\` 为假时清 \`status_instant\`，而它**包含
  \`pending_theater\`**，所以窗口在整个分步期间都不会被自动清 → 不清就能"建完陆军再回头点海军那刻的窗口"。

**回归**：\`tools/_verify_theater_next_ui.js\`（26 项：静态优先级/CSS 分组/actions 可见性/
theater_next 放弃窗口/弱严格清窗/无候选跳过）、\`tools/_sim_17550_client.js\`（14 项：完整客户端协议）。

**通用教训**：新增任何"等玩家点地图"的分步机（theater / autobahn / delegate / 战斗预算…）时，
必须把它排在 \`status_act_phase === 'space'\` **之后**，否则玩家的显式选地会被静默吞掉。
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，当前行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
