# D1 / P6 前奏语义错位修正（2026-11-12）

> 行号为快照；定位请用符号名 grep。前置：`change-D1-P5-armament-response-stack.md`。
> 本条取代 P5 文档 §6 里第 2、3 条 P6 待办描述。

## 1. 问题描述（只读定性）

上一轮列了 6 个 P6 候选，实测后**只有 2 个是真 bug**：

| 候选 | 实测 | 处置 |
|---|---|---|
| 后续段 `mandatory` 误建「支付代价」窗口 | **9 张**（`14905`/`18404`/`18008`/`11305`/`11307`/`17204`~`17207`） | **P6 修** |
| 检视类卡牌堆来源错位 | **8 张**（`14900`/`14903`/`14907`/`14918`/`18412`/`18004`/`17204`/`17207`） | **P6 修** |
| 多步 / `defer` 军备卡 | 58 张军备卡 **全部单段**（`multiSegment=0`） | 当前无卡需要，顺延 |
| `order` kind 排序 UI | `peek_reorder` 现为「置于顶/底」二选一 | 增强，顺延 |
| 后备区与正式局对齐 | `p.reserves` 只写不读、正式局无对应机制 | 设计缺口，顺延 |
| 前奏 UI 打磨 | 功能可用 | 顺延 |

**Bug ①**：`prelude_resolve_card` 把 `cfg.segments.slice(1)` 无条件塞进 `p.pending` 当「是否支付代价」窗口，`prelude_answer_segment` 也不看 `kind`。后续 A 段明明必执行（如 `14905` 第二段 `[紧张度+1]`），却要玩家多点一次。

**Bug ②**：编译层 `peek_deck` 用 `/^检视(?:前奏)?牌堆(?:前(\d+)张牌)?$/`，把「检视牌堆」与「检视前奏牌堆」编译成同一个 `peek_reorder`；`peek_deck_misc` 同理吞掉「检视弃牌堆」。执行器一律操作 `p.decks`（前奏牌堆）。卡面实际分三类：正式牌堆（5 张）/ 前奏牌堆（2 张）/ 弃牌堆（1 张，且是**选牌**不是重排顶/底）。

## 2. 改动清单

| # | 文件 / 符号 | 改动 |
|---|---|---|
| 1 | `rules.js` `prelude_resolve_card` | `waiting` 里 `kind==='mandatory'` 的段**按顺序立即执行**；只有 `optional`/`opponentOptOut` 进 `p.pending`。若 A 段已开 `p.op_window`，后续必执行段排队到 `afterSegs` |
| 2 | `rules.js` `prelude_answer_op_window` | 窗口答完先跑 `pendingOps`，再执行 `afterSegs`；若后续段又开窗口则不推进阶段 |
| 3 | `rules.js` `prelude_answer_segment` | 防御：循环消耗 `pending` 里残留的 `mandatory` 段（直接执行、不询问），再处理需答复段 |
| 4 | `prelude_compiler.js` `peek_deck` / `peek_deck_misc` | 捕获来源，emit `peek_reorder{source:'formal'\|'prelude'\|'discard', n}`；**不改 op 名**，四套表结构不变 |
| 5 | `prelude_compiler.js` `validate` | 新增 1 条：`peek_reorder` 必须带合法 `source` |
| 6 | `rules.js` `prelude_op_window_kind`（新） | **窗口 kind 唯一判定点**：静态表 + `source==='discard' → 'card'` 特例；替换原 5 处散落的 `PRELUDE_OP_WINDOW[...]` 索引 |
| 7 | `rules.js` `prelude_peek_array` / `prelude_peek_set`（新） | 检视来源 → 真实数组（`game.decks` / `game.discard` / `p.decks`）成对 get/set |
| 8 | `rules.js` `prelude_op_candidates` / `prelude_apply_op_choice` | `card` 分支按 `source` 取候选；`choice` 分支重排按 `source` 写回；弃牌堆选牌后从 `game.discard` 取回手牌 |
| 9 | `rules.js` `prelude_do_action` 末尾 | **排查中修掉的真 bug**：门禁由 `if (!p.pending)` 补为 `if (!p.pending && !p.op_window)`。P6 起后续 mandatory 段不再建 `p.pending`，只判 `p.pending` 会在还有选牌窗口时提前推进到卡牌阶段 |
| 10 | `tools/_real_test_P6_semantics.js`（新） | 28 项编号真实测试；`tools/_real_test_P5_armament_response_stack.js` E 组按新口径更新 |
| 11 | 产物 | `prelude_specs.js`、`out/prelude_tokens.txt` 重生成 |

**零改动**：响应栈骨架（`fire_trigger`/`resolve_response_choice`/`trigger_response`）、四套 `PRELUDE_*` 表结构、`cards.js`、`play.js`/`play.html`。客户端本轮零改动 → **不 bump 版本串**（仍 `20261112d`）。

## 3. 接线点索引（后续修改先查此表）

| 符号 | 作用 |
|---|---|
| `prelude_op_window_kind(op)` | 窗口 kind **唯一**判定点；新增需按参数分流的 op 只改这里 |
| `prelude_peek_array` / `prelude_peek_set` | 检视牌堆来源唯一映射；新增牌堆来源只改这两个 |
| `peek_deck` / `peek_deck_misc`（编译层） | 检视来源的唯一捕获点；正则捕获组顺序与 `source`/`n` 绑定，改正则要同步 emit |
| `prelude_resolve_card` 的 `needAnswer` 循环 | 后续段「立即执行 vs 开窗」的唯一分流点 |
| `p.op_window.afterSegs` | A 段开窗口时后续必执行段的排队容器 |
| `prelude_do_action` 末尾 `!p.pending && !p.op_window` | 阶段推进门禁；新增窗口类型时**必须**同步这里 |
| `tools/_real_test_P6_semantics.js` | A–E 五组 28 项验收 |

## 4. 验证与回归

- `_real_test_P6_semantics.js` **28/0**：8 张检视来源捕获 + `validate` 拒绝缺 source；9 张后续 mandatory 段不再开窗（`14905` tension=1、`18404` 直接落 `play_response`、`14900` 的 B 段仍开窗）；三类检视候选/执行按 source；`14903` ops 排队续跑；静态守卫；覆盖率 100%。
- **排查中修掉的真 bug**（第 9 项）：`14918`/`18404` 诊断发现「有 `op_window` 却已进 `prelude_cards`」，根因是阶段推进门禁漏判 `op_window`。已修，测试 C/D 组覆盖。
- 回归：前奏七套 68/37/41/25/25/33/28 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；`test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（**零新增**）、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。
- 覆盖率：官方 125 张真实片段 **412/412 = 100%**、方括号零遗漏、待补 0、噪声 43；段类别 A 135 / B 26 / C 12、once 162 / ongoing 11。

## 5. 后续修改指引（P7 已实现，详见 `change-D1-P7-inspect-chain.md`）

1. **`peek_and_play` / `join_hand` / `play_response` 的来源**：**P7 已完成** —— 编译层段后处理传播 `source` + `peek_scope`，引擎按来源取候选/执行。注意 P7 排查出的真 bug：候选范围必须用检视 `peek_scope`，不能用 `op.n`（打出张数）。
2. **`14918` 是 `type=ARMAMENT`**：按 P5 口径打出即暗置留场，弃牌堆检视窗口到正式局触发时才出现，该行为未改。
3. **`order` kind 排序 UI**：**P7 已完成** —— `custom` → 二级 `order` 窗口 → 数组校验重排 + 客户端逐张点击交互。
4. **后备区**：P7 补了面板显示；`p.reserves` 仍只写不读（正式局无对应原子），消费机制顺延 P8。
5. **多步 / `defer` 军备卡**：P7 补了防御日志（不静默吞后续段）；58 张实测全单段，多步 `defer` 续打顺延 P8。
6. **包**：`20261112a` 两个 zip 仍是旧产物，代码经 P7 已 `20261112e`；按玩家要求「打包等前奏基本完成后再说」。
