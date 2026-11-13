# D1 / P21 军备卡触发前置代价 + `17555` 手牌不足改损耗（2026-11-13）

> 前置：`docs/change-D1-P20-build-navy.md`。玩家口径：「按你倾向的来（参考大萧条的余波），且 17555 遇到手牌不足之后也要改为损耗 1」。

## 1. 口径（按确认的 4 点倾向）

| 项 | 口径 |
|---|---|
| 适用范围 | **所有**前奏军备卡触发 |
| 弃什么 | **正式手牌** 1 张（开局 7 张那副） |
| 无手牌降级 | `attrition_cards(game,nation,1)` 磨**正式牌堆顶**（`rtt-discard` 术语铁律，不洗回、无选择） |
| 时机/UI | 玩家点「发动」时**先付代价**（照 `17555` 前置代价范式），弃完自动重放触发；复用 `echo_discard_modal`（第 6 个用户） |

⚠ 规则书 `docs/easy-rule.md` 全文只有 `:129`「前奏中，正式牌无法触发，军备卡可以触发。可以使用国家技能。」——**没有**触发代价条目，这是玩家新增口径，不是既有规则漏实现。

## 2. `17555 大萧条的余波` 值得参考的范式（已照抄）

| 要点 | 位置 |
|---|---|
| **代价前置**：挂起点在 `play_card` 入口，卡「未生效、未离手、未占名额」 | 旧实现事后补做会与结算中开出的 armed/★窗口抢 UI 且白名单漏登记 → 点了没反应 |
| `build_actions` 挂起期排他返回 `{log, us_depression_discard}` | 不登记 = 静默失效 |
| `view.us_depression_discard` 只给义务方阵营 | 不给对手弹无用框 |
| 弃完用 `internal_action` **重放**原动作 + 一次性 `__skip_depression` 标记 | 防二次挂起死循环 |
| `check_phase_for_card` 预检 ok 才付代价 | 避免白付一张 |

## 3. 改动清单

### 3.1 `17555`：手牌不足由「跳过代价」改为损耗 1

`play_card` 入口的 `17555` 段重构：把 `hands.length > 1` 从 `if` 条件移进分支内部；`_pre.ok && length > 1` 仍挂 `us_depression_discard` 自选弃牌窗口；`_pre.ok && length <= 1` 时 `attrition_cards(game,'美国',1)` 并记「无可弃手牌，改为损耗 N 张牌（正式牌堆顶）」，然后正常打出该卡。

### 3.2 前奏军备卡触发代价（服务端 `rules.js`）

| # | 位置 | 改法 |
|---|---|---|
| 1 | `trigger_response` 首调 `prelude_response_impl` **之前** | 判据：正式响应表没有该 face 但 `prelude_response_impl` 认得 → 前奏军备卡。有正式手牌 → 挂 `p.trigger_cost = {nation,need:1,candidates:正式手牌带卡图,resume:{role,action:'trigger_response',arg}}` 并 `return game`（**效果冻结**）；无正式手牌 → 直接 `attrition_cards` 损耗 1 并继续触发 |
| 2 | `do_action` **最开头**（前奏动作守卫之前） | 新 action `prelude_trigger_discard`：阵营校验 + `cards` 校验（恰好 1 张、`Set` 去重、都在该国正式手牌）→ `discard_card` 逐张 → 清 `trigger_cost` → `refresh` → `internal_action` 重放 `trigger_response`，用一次性 `__skip_prelude_trigger_cost` 防二次挂起。⚠ 必须放在守卫之前：响应栈未决时守卫会冻结一切 `prelude_*` 动作 |
| 3 | `build_actions` 最前总闸 | `trigger_cost` 挂起期间只放行义务方 `prelude_trigger_discard`，压过响应栈/前奏其它分支，避免 `trigger_response`/`pass_response` 跳过代价 |
| 4 | `view.prelude.trigger_cost` | 只下发给义务方阵营（牌面保密） |
| 5 | `BUDGET_ALLOWED` | 放行 `prelude_trigger_discard`，不被预算冻结挡住 |

### 3.3 客户端 `play.js` / `play.html`

| # | 改法 |
|---|---|
| 6 | `echo_discard_modal` 第 **6** 个用户 `prelude_trigger_cost_sel`：`render_prelude_trigger_cost_box`（卡图网格 + `.sel` + `0/1` + 选满才亮确认）、点选、确认发 `prelude_trigger_discard{cards}`；`update_prelude_box` 每帧从 `view.prelude.trigger_cost` 同步（换一批牌才清选择） |
| 7 | `update_echo_discard_box` / `confirm_echo_discard` / `cancel_echo_discard` 三处分流；取消按钮按 `17555` 的强制代价口径**不提供出口**（toast 提示不可取消），无手牌走自动损耗不挂框，故无死局 |
| 8 | 版本串 `20261112m → 20261112n` |

**零改动**：`discard_card` / `attrition_cards` / `internal_action` 原子、正式局响应栈核心、前奏编译层、四套 `PRELUDE_*` 表、`cards.js`、`17555` 的自选弃牌窗口路径。

## 4. 验证与回归

- `_real_test_P21_trigger_cost.js` **22/0**：
  - A `17555` 手牌只剩一张时不挂弃牌窗口、`attrition_cards` 磨正式牌堆 1 张、日志正确；手牌充足仍走原自选弃牌窗口（不回归）。
  - B 前奏军备卡触发挂 `trigger_cost`、白名单只放行义务方支付动作、`view` 仅义务方可见、空 `cards` 被拒窗口保留、合法提交弃 1 张进弃牌堆 + 自动重放触发且**只结算一次** + 响应帧被消耗。
  - C 无正式手牌不挂框、自动损耗 1 张、效果照常结算。
  - D 静态守卫（挂起点、重放标记、双门禁、客户端第 6 用户、版本串）。
- P5 D 组按新口径补「先付代价再断言两阶段」（34/0）；P20 版本串断言改统一性校验。
- 二十一套全过；B34–B39 六套全过；`test_basic_cards` 288/9、全量冒烟 4 个基线失败（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0；覆盖率 408/408=100%、方括号零遗漏。
- 改了 `rules.js` + `play.js` → 硬重启 8091 + 探活。

## 5. 接线点索引

| 符号 | 作用 |
|---|---|
| `trigger_response` 首调的 `_isPreludeArm` 分支 | 前置代价挂起 / 无手牌损耗的唯一落点 |
| `p.trigger_cost`（含 `resume`） | 代价状态与重放上下文 |
| `do_action` 开头的 `prelude_trigger_discard` 分支 | 支付 + 重放唯一实现点 |
| `build_actions` 的 `trigger_cost` 总闸 | 白名单双门禁 |
| `view.prelude.trigger_cost` | 候选下发（仅义务方） |
| `play.js:render_prelude_trigger_cost_box` | 客户端第 6 用户 |
| `tools/_real_test_P21_trigger_cost.js` | A–D 四组 22 项验收 |

## 6. 边界与后续候选

- 代价是**强制**的（照 `17555`），玩家点「发动」即表示同意付代价；无正式手牌走自动损耗，不会挂框卡死。若将来要「放弃发动」逃生口，需在 `pass_response` 里同步清 `p.trigger_cost` 并在总闸放行该动作。
- `attrition_cards` 牌库空时不洗回、返回 0 张；日志会写「损耗 0 张牌」但触发继续（未引入新的扣分/拒绝语义，与 `rtt-discard` 的主动 `can_attrite` 拒绝不同）。
- 逐卡核对候选：`14900` B 段漏产出选牌 op、`deploy_air` 卡面地区限定未落进 op、带 `context`/`spaces:'one_of'`/`adjacent` 的建设征召卡尚无选地窗口。

未打包、未提交。
