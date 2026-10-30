/* 追加：S1「代价照付、只拦效果」三批改造记录 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
---

## 2026-10-30 · S1「代价照付、只拦效果」（拦截窗口 vs 付代价 的顺序）

**玩家口径**：代价属于"打出/发动"的一部分，被拦截时**代价不退**，被取消的只有**效果**。
旧实现（D1）把拦截窗口派发在"付代价 + 执行效果"**之前**，于是被拦时：
卡进弃牌堆、代价一分没付、效果也没发生 —— 与"代价照付"相反。

### 两条轴与各自改法

| 轴 | 派发点 | 付代价点（旧→新） | 关键实现 |
|---|---|---|---|
| 增强卡打出 → \`enemy_echo_played\` | \`play_card\` ECHO 分支 | \`resolve_event_card\` 内 → **提前到派发前** | 抽 \`pay_event_cost()\`；\`__echo_cost_paid[cardId]=freq_key\` 防重扣；付不起则整张卡打不出 |
| 状态卡发动 → \`enemy_status_effect\` | \`activate_status\` | 窗口之后 → **移到窗口之前** | 代价段整体前移；\`_costPaidNow\`（一次性令牌 \`__status_cost_resume\`）；\`skip_play\` 例外 |

### 分批范围（玩家要求）

1. **批 1**：\`15214 战术革新\`（代价写在自己的两步 run 里，不在通用 cost 段）——
   新增 \`ECHO_COST_FIRST = new Set(['15214'])\`：\`play_card\` 对它**不派发**窗口；
   由 \`run_effect_tactics\` 在"弃置桌面状态卡"之后调 \`arm_intercept_after_cost()\` 才开窗；
   开窗期间用 \`pending_echo.wait_intercept\` 冻结效果（\`resolve_effect\` 拒收），
   拦截成功由 \`use_armed_offer\` 清 \`pending_echo\`（日志写明"代价不退"），放弃则解除冻结继续。
2. **批 2**：20 张"打出时付代价"的增强卡（损耗 6 + 需选牌弃置 14）——框架前移即可，无 UI 改动。
3. **批 3**：32 张带代价的状态卡 —— 代价段前移；**同时修了一个既有 bug**：
   \`skip_armed_offer\` 放弃 15353 拦截时只记放行标记+关窗，**不续跑 activate_status** →
   状态卡效果永远不执行（S1 之后就变成"付了代价没效果"）。现改为用 \`ctx.arg\` 原样续跑，
   并以一次性令牌 \`game.__status_cost_resume\` 保证续跑那次不重复扣代价。
4. **批 4（未做，待定）**：35 张 armed 触发型增强卡 —— 它们的代价在**触发时**付，
   被拦发生在"打出"那一刻（尚未装载），故现状"无代价可退"是正确的；第四批要议的是
   "装载被拦后是否允许重新打同一张"等口径。

### 两个待议口径（当前默认值）

- **\`skip_play\`（跳过出牌阶段）**：默认**被拦时不照付**（仍留在窗口之后）。
  理由：跳过阶段不可逆，被拦时照付会让玩家白丢整个出牌阶段。
  若要"一律照付"，把 \`activate_status\` 里 skip_play 那段也移到窗口之前即可（一处移动）。
- **付代价后能否取消**：当前**不能**（代价付完就进入效果/等拦截）。若要支持，
  需新增 \`cancel_echo_cost\`/\`cancel_status_cost\` 动作 + 客户端按钮。

### 踩坑记录

- **不要用"整段剪切-粘贴"改这类长函数**：我第一次用脚本按"注释块起点"定位，结果把
  一段代码插进了 \`module.exports\`（require 即 ReferenceError）。教训：
  (a) 定位要用**唯一的代码行**而不是注释块首行；(b) 大改后必须 \`node -e "require(...)"\` 实跑；
  (c) 改完先跑全量冒烟再重启服务器。
- **"已付代价"标记不能按回合记**：初版用 \`__status_cost_paid[cardId]=freq_key\`，
  导致同一回合第二次发动同一张状态卡（如 15348 殖民帝国可发动 3 次）被误判"已付"而不再扣分
  —— 被 \`_smoke_15348\` 抓住。正确做法是**一次性令牌**，只对"放弃拦截后的那次续跑"生效。
- **静态守卫会因代码搬移误报**：\`_smoke_114\` 用 \`src.indexOf('if (cost.discard...'))\` 比较行号，
  而该串在 \`pay_event_cost()\` 里也出现 → 断言失败。凡"顺序断言"都要先定位所属函数范围再比较。

### 回归

| 脚本 | 项数 | 覆盖 |
|---|---|---|
| \`tools/_probe_15214_intercept.js\` | 19 | 15214 代价前移 / 拦截只取消效果 / 放弃后续跑 |
| \`tools/_smoke_s1_cost_before_intercept.js\` | 24 | 增强卡 4 张代表（损耗/弃置/限定响应牌）+ 代价单元 + 防重扣 |
| \`tools/_smoke_s1_status_cost.js\` | 17 | 状态卡（15245）代价前移 / 拦与不拦 / 放弃续跑 / skip_play 默认 |
| 全量 | 111 脚本 | 全绿（含 \`_smoke_15348\`、\`_smoke_114\`） |
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
