# D1 / P7 检视链路补全 + 自定义排序（2026-11-12）

> 行号为快照；定位请用符号名 grep。前置：`change-D1-P6-semantics.md`。
> 本条取代 P6 文档 §6 里第 1、3、4、5 条 P7 待办描述。

## 1. 问题描述

P6 只修了 `peek_reorder` 自身的牌堆来源；同段后续的 `peek_and_play` / `join_hand` / `play_response` 仍从 `p.decks`（前奏牌堆）或 `game.hands` 取牌，导致 `18412`/`14907`/`18004` 这类「检视**正式牌堆**前 10 张，选择并打出 / 置入手牌」的卡语义错位。另外 `peek_reorder` 只有「置于顶/底」二选一，卡面常见「以任意顺序置于前奏牌堆顶或底」；`p.reserves` 只写不读、面板不可见；多段军备卡被静默只跑首段。

## 2. 改动清单

| # | 文件 / 符号 | 改动 |
|---|---|---|
| 1 | `prelude_compiler.js` 段级后处理 | 把同段 `peek_reorder` 的 `source` 与 **`peek_scope`**（检视范围 `peek.n`）传播给后续 `peek_and_play` / `join_hand` / `play_response`。**排查中修掉的真 bug**：旧代码用 `op.n`（「打出 1 张」）当候选范围，只看牌堆顶 1 张，检视前 10 张的卡几乎选不到牌 |
| 2 | `rules.js` `prelude_op_candidates` | `play_response{source:'formal'}` 候选取**正式牌堆顶 `peek_scope` 张**里的响应卡；`peek_and_play` 按继承的 `source` + `peek_scope` 取候选 |
| 3 | `rules.js` `prelude_apply_op_choice` | `play_response` 从正式牌堆选中时先取到手牌再复用 `facedown_response`（净效果牌堆→桌面，牌名保密）；`peek_and_play` 按 `source` 从对应牌堆取牌 —— formal/discard 只**取回正式手牌**并记日志，**不擅自触发 `card_effect_of`**；prelude 仍走 `prelude_resolve_card` |
| 4 | `rules.js` `prelude_run_op` 的 `join_hand` | 按继承 `source` 从正式牌堆/前奏弃牌堆取牌进对应手牌 |
| 5 | `rules.js` `order` kind | `peek_reorder` 的 `choice` 加第三项 `custom` → 建**二级 `order` 窗口**（候选 = 牌堆顶 N 张）→ 答复 `arg.order` 数组 → 服务端校验「元素都在候选内、无重复」后重排。允许**只排一部分**（未选牌保持原序），避免点不满就卡死 |
| 6 | `rules.js` `prelude_answer_op_window` | `choice` 选 custom 建的二级窗口不被答复流程清掉；`prelude_do_action` 按 `w.kind === 'order'` 把数组而非单值传给执行器 |
| 7 | `rules.js` `prelude_response_impl` | 多段军备卡**防御日志**（不静默吞后续段）；58 张实测全单段，多步 `defer` 续打按 `rtt-response-stack` 铁律继续顺延 |
| 8 | `view.prelude` / `play.js` | `reserves` 字段 P4 已下发，本轮补面板显示；新增 `order` 窗口「逐张点击累积顺序 → 确认」交互（客户端只回传 id 数组，不二次拼判定） |
| 9 | `play.html` | 版本串 `20261112d → 20261112e`（7 处） |
| 10 | `tools/_real_test_P7_inspect_chain.js`（新） | 24 项编号真实测试；`tools/_real_test_P3_prelude_ops.js` E 组按「三选一」更新断言 |

**零改动**：响应栈核心（`fire_trigger`/`resolve_response_choice`/`trigger_response`）、四套 `PRELUDE_*` 表结构、`cards.js`、正式局 `card_effect_of` 路径。

## 3. 排查中修掉的真 bug（与 P6 同类）

`18412` 卡面「检视牌堆前 10 张牌，选择并打出 1 张[响应卡]」。`play_response.op.n=1` 是**打出张数**，不是**检视范围**；P7 首版用它做 `slice(0, n)` 导致候选只有牌堆顶 1 张。改为编译层传播 `peek_scope = peek.n` 后，候选恢复为前 10 张里的全部响应卡。P7 测试 B 组用 4 张牌堆（2 张响应卡）实测覆盖。

## 4. 接线点索引（后续修改先查此表）

| 符号 | 作用 |
|---|---|
| `prelude_compiler.js` 段后处理里的 `const peek = ...` | `source` / `peek_scope` 传播**唯一**实现点；改检视规则时优先改这里 |
| `prelude_op_window_kind(op)` | 窗口 kind 唯一判定点（P6） |
| `prelude_peek_array` / `prelude_peek_set` | 检视牌堆来源唯一映射（P6） |
| `PRELUDE_OP_WINDOW` + `custom` 选项 | `order` 二级窗口的入口；新增窗口类型时同步 `prelude_do_action` 的 `w.kind` 分发 |
| `prelude_answer_op_window` 的 `if (p.op_window && p.op_window !== w) return` | 二级窗口保护；删掉会让 custom 排序窗口立刻消失 |
| `prelude_apply_op_choice` 的 `w.kind === 'order'` 分支 | 自定义顺序校验与重排唯一实现点 |
| `play.js:update_prelude_box` 的 `kind === "order"` 分支 | 客户端排序交互；`acc` 数组与「确认顺序」按钮共享引用 |
| `tools/_real_test_P7_inspect_chain.js` | A–F 六组 24 项验收 |

## 5. 验证与回归

- `_real_test_P7_inspect_chain.js` **24/0**：编译层传播（18412/14907/18004/14903）、`18412` 正式牌堆顶选响应卡→暗置留场且牌名保密、`14907` 选牌取回手牌 + `join_hand` 继承、`order` 三选一→二级窗口→部分自定义重排、非法顺序被拒、后备区下发/多段防御/静态守卫、覆盖率 100%。
- 前奏八套 68/37/41/25/25/33/28/24 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过。
- `test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。
- 产物：`prelude_specs.js`、`out/prelude_tokens.txt` 重生成；官方 125 张覆盖率 412/412 = 100%、待补 0。

## 6. 后续修改指引（P8 已实现，详见 `change-D1-P8-formal-play.md`）

1. **正式牌「选择并打出」**：**P8 已完成** —— 按类型留场（STATUS 明置 / RESPONSE 暗置 / 其它取回手牌），不触发 `card_effect_of`。⚠ 本条原写「走正式 `play_card` + 双门禁」经核对不采用（`play_status_card_impl` 会在前奏期触发正式牌并动配额，与 `:129` 冲突），依据见 P8 文档 §2。
2. **后备区**：**P8 已完成对齐** —— ⚠ 本条原写「正式局无对应后备原子」是错的，实际有 `add_army_bonus`（`rules.js:11030`）与 `unit_cap_ok`（`:11044`）；`add_reserve` 已复用该原子，`view` 下发同源 `reserves_bonus`。
3. **多步 / `defer` 军备卡**：P8 已让后续段**非窗口 op** 一并执行；**窗口 op 的 defer 续打顺延 P9**（含战斗的卡不能用 `pending` 续打）。
4. **`order` 窗口增强**：**P8 已完成** —— 点击累积 + HTML5 拖拽重排 + 撤销，服务端 `arg.order` 校验不变；跨牌堆排序顺延 P9。
5. **包**：`20261112a` 两个 zip 仍是旧产物，代码经 P8 已 `20261112f`；按玩家要求「打包等前奏基本完成后再说」。
