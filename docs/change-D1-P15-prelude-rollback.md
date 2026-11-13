# D1 / P15 前奏期回退修复（沿用「需对方同意」语义）

> 前置：只读排查结论（玩家问「前奏阶段无法回退吗？」）。玩家确认「修复，沿用」= 沿用 PoG「提议回退 → 对方同意」语义。

## 1. 排查结论（修复前，真实 `R.setup`/`R.action`/`R.view` 复现）

**不是没有回退功能，是三处门禁/白名单把前奏期挡住了；快照机制本身是好的。**

| 检查 | 修复前 |
|---|---|
| 前奏动作压回退点 | **是**（开局 7 点 → 打一张牌 8 点，`view.rollback_points` 同步） |
| `view.can_propose_rollback` | **true** |
| `view.actions.propose_rollback` | **undefined** → 客户端 `can_propose_rollback()` false，流水里「↺ 回退」按钮不渲染、提示「现在不能提议回退」（与服务端矛盾） |
| 绕过白名单 `propose_rollback` | 成功建提议、`active` 切给对方 |
| 提议挂起时双方 `view.actions` | 我方 `["log","prelude_next"]`、对方 `["log"]` —— **无** `accept/reject/cancel`，顶部横幅按钮点了被 `send_action` 静默丢弃 → 双方卡死 |
| 挂起期间 `prelude_next` | **仍生效**（`prelude_action → prelude_cards`），会把提议冲掉 |
| 绕过白名单 `accept_rollback` | `prelude.phase/hands/decks/tension`、`active` 全部正确恢复 |
| `rollback_pack` 含 `game.prelude` | **含**（只剔除 `undo/history/rollback/rollback_proposal/log/_in_action/limited_connections`） |

三处根因：
1. `build_actions` 前奏分支（`rules.js:31740`）是排他式 `return acts`，回退四动作下发段在 `rules.js:31890`（之后）永远到不了。
2. `do_action` 开头的前奏分发（`rules.js:32114`）在 `rollback_proposal` 统一门禁（`rules.js:32153`）**之前**直接 return，前奏动作绕过「提议挂起期间除四动作外一律不接」。
3. `prelude_advance` 无提议冻结，内部续跑可能改 `active` / `current_nation`，踩到交给对方的操作权。

## 2. 改动清单（只改 `rules.js`，客户端零改动）

| # | 位置 | 改法 |
|---|---|---|
| 1 | `build_actions` 前奏分支开头 | `if (game.rollback_proposal)` 提前返回：提议方 `cancel_rollback`、对方 `accept_rollback` + `reject_rollback`，**不下发任何 `prelude_*`**（判据 `by_side === side`，与正式局回退段同源） |
| 2 | `build_actions` 前奏分支末尾 | 无提议时 `!game.game_over && is_my_turn && rollback_points_of(game).length` → `acts.propose_rollback = 1`（与正式局 `L31893` 同源，保证白名单给了 `do_propose_rollback` 也收得下） |
| 3 | `do_action` 前奏分发 | 条件加 `&& !game.rollback_proposal`：挂起时前奏动作不再提前 return，继续走到统一门禁被拒（实测不再冲掉提议） |
| 4 | `prelude_advance` | `top_response_frame` 门禁后加 `rollback_proposal` 冻结，记日志「回退提议待确认，暂不推进阶段」 |
| 5 | `tools/_real_test_P15_prelude_rollback.js`（新） | 29 项编号真实测试 |

**零改动**：`rollback_pack` / `rollback_unpack` / `push_rollback_point` / `do_propose_rollback` / `do_answer_rollback` / `rollback_points_of`、正式局回退行为、`view.can_propose_rollback` 字段、四套 `PRELUDE_*` 表、`cards.js`、`play.js` / `play.html`。**客户端零改动 → 版本串仍 `20261112k`（不 bump）**。

## 3. 为什么客户端不用改

`play.js:can_propose_rollback()` 只读 `view.actions.propose_rollback`，`update_rollback_bar()` 只读 `view.rollback_proposal`，`answer_rollback`/`cancel_rollback` 都走 `send_action`（按 `view.actions` 过滤）。白名单补齐后三者自动可用，且 `view.can_propose_rollback`（服务端算）与客户端判断不再矛盾。

## 4. 语义（沿用玩家确认）

前奏期回退仍需**对方同意**：`do_propose_rollback` 把 `game.active` 交给对方，`accept` 后从快照恢复（含 `game.prelude`），`reject`/`cancel` 归还 `saved_active`。前奏单国场景（`Episode 2 德国单国`）下对方阵营仍存在 role，可正常确认。

## 5. 验证与回归

- `_real_test_P15_prelude_rollback.js` **29/0**：A 压点+`propose_rollback` 白名单、B 提议挂起双方白名单 / 挂起期间 `prelude_next` 被拒 / `accept` 后前奏状态完整恢复、C `reject`/`cancel` 后恢复、D 正式局 `Standard` 回退不回归、E 静态守卫（三处门禁 + 快照零改动 + 客户端版本串）。
- 十五套 68/37/43/25/25/33/28/24/19/21/27/21/20/26/29 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；`test_basic_cards` 288/9、全量冒烟 4 个基线失败（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0。
- 改了 `rules.js` → 硬重启 8091 + 探活。

## 6. 接线点索引

| 符号 | 作用 |
|---|---|
| `build_actions` 前奏分支的 `if (game.rollback_proposal) { const rb ... }` | 提议挂起白名单唯一落点 |
| `build_actions` 前奏分支的 `acts.propose_rollback = 1` | 前奏期回退入口唯一落点 |
| `do_action` 前奏分发条件 `!game.rollback_proposal` | 防止前奏动作绕过统一门禁 |
| `prelude_advance` 的 `if (game.rollback_proposal)` | 冻结阶段推进，保护 `active` |
| `do_action:32153` 的 `rollback_proposal` 统一门禁 | 正式局既有，前奏动作现在能走到它 |
| `rollback_pack` / `do_answer_rollback` | 快照/恢复（含 `prelude`），本轮零改动 |
| `tools/_real_test_P15_prelude_rollback.js` | A–E 五组 29 项验收 |

## 7. 后续修改指引

1. 若将来把回退改成「本方直接回退、不需同意」，需新做分支（跳过 `do_propose_rollback` 的 `active` 交接与 `accept` 流程），不要删本轮门禁。
2. 新增其它前奏挂起分支时，**必须**在 `build_actions` 前奏分支的 `rollback_proposal` 提前返回之后处理，否则会再次出现「客户端看得见、点了被拒」。
3. 前奏期响应栈未决（`top_response_frame`）时白名单让给正式响应分支，与回退提议叠加的极端场景尚未实机覆盖；若出现卡住，优先检查这两处的优先级。

## 8. 状态

未打包、未提交；版本串 `20261112k`。逐卡核对仍可按 `docs/checklist-D1-germany.md` 继续（第 2 条候选 `14900` B 段编译层漏产出选牌 op 仍挂起）。
