/* 追加：真实测试范式 + 两组真实测试抓到的两个 bug */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
---

## 2026-10-30 · 真实测试范式（调试面板布阵 + 真实 action 驱动）

### 范式（后续所有真实测试照抄）

1. **布阵只用调试动作**：\`debug_set_phase\`（切国家/阶段并清挂起）、\`debug_add_card\`（face + 国家 + 去向）、
   \`debug_place\`（放部队）。**禁止手改** \`game.hands/location\` —— 会绕过 \`card_inst\`、\`refresh\`、
   补给与窗口计数，测出来的行为不可信。
2. **驱动只用真实动作**：\`play_card\` / \`use_armed_offer\` / \`skip_armed_offer\` / \`activate_status\` /
   \`resolve_effect\` / 阶段动作。不直接调内部函数"作弊"。
3. **断言三层**：服务端状态（手牌/弃牌堆/牌库/挂起字段）＋ 客户端视角（\`R.view(g,'Allies'|'Axis')\`
   的 \`armed_offer.via\` / \`actions\` / \`table_status\`）＋ 日志文案。
4. **必查残留**：\`pending_armed_use\`、\`armed_offers\`、\`__echo_chain_depth\`。
5. **每步打印日志** \`logSince()\`：真实测试的价值在可读、能人工核对。
6. ⚠ 窗口类断言要放在 \`R.view()\` **之后**：\`status_instant\` 是在 view/build_actions 那一遍才武装的。

### 已建成的两组（可作模板）

| 脚本 | 链路 | 断言 |
|---|---|---|
| \`tools/_real_test_paradigm_15208.js\` | 德国建设海军 → 15208 触发 → 英国 15352 拦 → 意大利 16700 反制 → 15208 生效 | 25 项 |
| \`tools/_real_test_paradigm_17841.js\` | 德国 15248 上桌 → 建设陆军武装 after_build_army → 发动 15248 → 英国 15353 拦 → 意大利 16700 反制 → 15248 生效 | 23 项 |

### 这两组真实测试当场抓到的两个真 bug（已修）

1. **反制成功后，被"压住"的那次若是【触发】，恢复时却走 \`play_card\`** →
   日志「《齐柏林伯爵号》未被打断，直接生效」紧跟「不能主动打出」，效果丢失。
   修法：\`pending_armed_use\` 增加 \`outer\`（链式保存上一级）；新增 \`resume_suspended_use()\`
   统一"放回原窗口 + 重跑 \`use_armed_offer\`"；\`void_pending_armed_use\` 按 \`outer.via\` 分流。
2. **反制掉拦截卡后，它本要拦的【状态卡】永远不恢复**（15248 抓到的）：
   15353 自己的 \`when\` 是 \`enemy_status_effect\` → 它的 \`pending_armed_use.via\` 也是 \`trigger\`，
   于是被"本级是触发、被拦则作废"的分支误吞。
   修法：给两类窗口 ctx 打 \`window\` 标记（\`enemy_echo_played\` / \`enemy_status_effect\`），
   \`void_pending_armed_use\` 的**恢复逻辑排到"作废"之前**，并按 \`pu.orig.window\` 分流：
   \`enemy_status_effect\` → 续跑 \`activate_status\`（一次性令牌 \`__status_cost_resume\` 免重扣代价）；
   \`enemy_echo_played\` → 有 outer 走 \`resume_suspended_use\`，否则 \`release_echo_entry\`。

**通用教训**：\`via\` 只能表达"这张卡是怎么被用起来的"，**不能**表达"这一级到底是拦截者还是被拦者"。
判断后者要看 \`pu.outer\`（有没有压住东西）与 \`pu.orig.window\`（它应答的是哪类窗口）。
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
