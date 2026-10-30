/* 追加：批 4（armed 触发型）可被 15352/16700 拦截 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
---

## 2026-10-30 · 批 4：机会卡（armed 触发型）也可被 15352/16700 拦截

### 排查结论：这类卡此前【完全不可拦】，不是"漏了某个环节"

三道门叠在一起：

| # | 门 | 位置 | 后果 |
|---|---|---|---|
| 1 | **不能主动打出** | \`trigger_ready\`：\`CARD_TRIGGERS[face].kind === 'load'/'any'\` → 直接拒绝「机会卡」 | 35 张里 **0 张**能走 \`play_card\`；\`play_card\` 里的 \`enemy_echo_played\` 派发点永不执行 |
| 2 | **触发时不派发** | \`suspend_armed_use_for_counter\` 首行 \`if (!off || off.when !== 'enemy_echo_played') return false\` | 只服务「反制别人拦截」，普通触发窗口（after_deploy_air / after_battle…）直接早退 |
| 3 | **按 when 精确匹配** | \`scan_armed_cards\` 按 \`ar.when\` 匹配 | 即使有窗口，触发型 when 也匹配不到 15352/16700 |

⚠ 另外一条实测更正：装载型卡在「装载」后**仍在手牌**（不在弃牌堆），所以 15352 的 \`discard_card(owner, cardId)\` 在触发时**能**生效 —— 这是纯逻辑门控，不是结构不可行。

### 实现（玩家 2026-10-30 裁定：扩展为「打出 + 触发」）

- 窗口**复用** \`enemy_echo_played\`，用 \`ctx.via\` 区分来源：
  - \`via='play'\` = 敌方主动打出/装载（原反制链）
  - \`via='trigger'\` = 敌方机会卡触发（新增）
- \`suspend_armed_use_for_counter\` → **\`suspend_armed_use_for_intercept\`**（旧名保留别名）：
  - 删掉 \`off.when !== 'enemy_echo_played'\` 早退；
  - \`CHAIN_CAP = 3\`（触发层 +1），超限写「拦截链已达上限（3 层）」；
  - 触发侧防抖 \`__trigger_intercept_done[cardId|when] = freq_key\`（同一张卡同一触发每回合只问一次）；
  - 派发 ctx 追加 \`via / srcWhen / triggerCtx\`；\`pending_armed_use\` 记 \`via / srcWhen\`。
- \`void_pending_armed_use\` 分来源：
  - \`via='play'\`：原逻辑（代价照付 + 卡进弃牌 + 放行被压住的出牌）；
  - \`via='trigger'\`：代价照付（attrition/discard）+ 卡进弃牌 + **本次触发作废**（丢弃 gathered、清 \`pending_echo\`、摘掉残留窗口），日志「触发《X》—— 被《Y》无效（代价照付）」「本次触发作废（已选目标全部放弃）」。
- \`use_armed_offer\` **开窗前代价预检**：\`attrition\` 付不起就不开窗（\`discard\` 张数早已由 \`_discNeed0\` 预检），避免"对方白表一次态、随后才报付不起"。
- **未做**「代价前置到 run 之前」：\`r.skip\`（条件不满足）与 \`r.budget\`（15205 等延后到 event_finish 付）依赖"先 run 后付"，硬前置会破坏既有口径；被拦时的"代价照付"由 \`void_pending_armed_use\` 补付，玩家可见结果等价。
- \`16700 一日之狮\` 代价改声明式 \`cost:{attrition:1}\`（从 run 里删掉 \`attrition_cards('意大利',1)\`，否则双扣）——顺带修好客户端按钮不显示「（损耗 1）」。
- 视图：\`view.armed_offer.via / src_when\` 下发；客户端按钮文案 \`via='trigger'\` 时写「拦截《X》（敌方触发）」，否则「打出《X》」。

### 语义约定（易混，务必记住）

卡面写「敌方**打出**增强卡时」——口语里「触发」也算「打出」，**卡面文案不改**；
代码/日志用 \`via\` 区分：主动打出/装载 = 打出，机会卡生效 = 触发。

### 回归

\`tools/_smoke_armed_trigger_intercept.js\`（**29 项**）：触发被拦（效果不发生/卡进弃牌/代价照付/无预算）、放弃后照常、无拦截方不问、多步卡（16803 need:'space'）被拦后 gathered 作废、层级上限 3、16700 声明式代价、静态结构。
全量冒烟 **112 脚本全绿**；已重启 8091；客户端 \`?v=20261030e\`。
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
