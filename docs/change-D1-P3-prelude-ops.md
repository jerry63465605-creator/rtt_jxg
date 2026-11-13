# D1 / P3 段执行器 op 补齐 + 持续段下发 + 手牌可选（2026-11-12）

> 行号为 2026-11-12 快照；定位请用符号名 grep。前置：`change-D1-P2-prelude-engine.md`。

## 1. 问题描述

P2 的 `prelude_run_op`（`rules.js:1639`）只接了 9 类 op，其余 ~12 类一律走 default 日志「尚未接线（P2 骨架）」—— 官方前奏卡大量效果静默不发生。同时 `view.prelude` 只有 `persistent_count`（军备卡持续段看不见）、客户端「打出 1 张手牌」只能打第一张。

## 2. 官方 125 张 op 分布（P3 基线，实测）

```
peek_reorder 11, play_prelude_top 4, draw_cards 4, execute_action_phase 1,
recruit 32, deploy_air 7, gain_score 23, lose_score 4,
attrition_prelude 17, play_prelude 10, always_supplied 2, eliminate 11,
build 22, discard 3, add_marker 6, shuffle_into_deck 2, peek_and_play 8,
join_hand 4, battle 10, attrition_deck 8, add_reserve 3, supply_point 1,
end_neutrality 1
```

## 3. 改动

| # | 位置 | 改法 |
|---|---|---|
| 1 | `prelude_compiler.js` `always_supplied` / `supply_point`（约 L300） | 正则捕获 `<地区>` → op 带 `space`（P2 时是 `space:null`，引擎无法执行）；`supply_point` 同时带 `nation` |
| 2 | `rules.js` 新增 `PRELUDE_OP_DEFERRED`（`prelude_run_op` 前） | 把散落的「未接线」日志收口成配置表，每条写明**缺什么**（参数/窗口/原子）；附 `rtt-atomic-operations` 铁律「服务端不得替玩家选」 |
| 3 | `rules.js` `prelude_run_op` | 新接 5 类**无需玩家选目标**的 op：`add_marker`→`add_marker`、`always_supplied`/`supply_point`→`set_supply_point`+`refresh`+`compute_supply`、`end_neutrality`→`end_neutral`、`join_hand`→从弃牌堆取回；default 改为查表给具体原因并累加 `p.unhandled_ops` |
| 4 | `rules.js` `view.prelude` | `persistent[]` 明细（nation/seg/tags/turn/current_nation，不含卡面）+ `unhandled_ops` 诊断；保留 `persistent_count` 兼容 |
| 5 | `play.js` `update_prelude_box` | 手牌逐张按钮（`prelude_play_hand` 带 `card`）、段窗口 `desc`、持续段列表 |
| 6 | `play.html` | 版本串 `20261112b → 20261112c`（7 处） |
| 7 | `_real_test_P2_prelude_engine.js` F 组 | 版本串断言由写死 `20261112b` 改为「统一且非空」，避免每次 bump 假红 |

**当时的「明确未接（P4）」已由 P4 处理** —— 见 `change-D1-P4-op-windows.md`：新增统一分步窗口 `p.op_window` 接了 `battle`/`eliminate`/`deploy_air`/`peek_reorder`/`peek_and_play`/`choice_attrition_or_skip`，4 类无需窗口的 op（`lose_score`/`add_reserve`/`shuffle_into_deck`/`execute_action_phase`）直接接；`PRELUDE_OP_DEFERRED` 保留真正缺原子/上下文的项。**P3 E 组断言已按 P4 新口径更新**（`peek_reorder` 不再走 default 日志、不再计入 `unhandled_ops`）。

## 4. 接线点索引（后续补 op 从这里入手）

| 符号 | 快照行 | 作用 |
|---|---:|---|
| `PRELUDE_OP_DEFERRED` | `rules.js` 约 1639 前 | **加/删未接线 op 只改这张表**；理由必须写清缺口类型 |
| `prelude_run_op(game,nation,op)` | `rules.js:1639`（P3 后约 1660） | op → 既有原子唯一映射点；新增 case 必须调 `_internal` 原子 |
| `prelude_run_segment(game,nation,seg)` | `rules.js:1694`（P3 后漂移） | 段级 cost/steps/ongoing；`p.unhandled_ops` 由 op 层写 |
| `view.prelude` | `rules.js:29523`（P3 后漂移） | `persistent[]` / `unhandled_ops` / `deck_top` 隐私判定 |
| `update_prelude_box` | `play.js:1431` | 客户端只读 `view.prelude`；按钮按 `view.actions` |
| `PRELUDE_TOKENS` `always_supplied`/`supply_point` | `prelude_compiler.js` 约 300 | 改 op 参数结构时**必须同步** `prelude_run_op` |
| `tools/_real_test_P3_prelude_ops.js` | 全文件 | 21 项；G 组打印 op 分布当诊断基线 |

## 5. 验证与回归

- `_real_test_P3_prelude_ops.js` **21/0**（编译层捕获地区、14901 add_marker、17201 end_neutrality、18308 always_supplied+persistent 明细、18300 DEFERRED 日志与诊断计数、静态守卫、op 分布）。
- `_test_prelude_compiler` 68/0、`_test_prelude_diy` 37/0、`_real_test_P2_prelude_engine` 39/0；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过。
- `test_basic_cards` 288/9（基线）、全量冒烟未登记失败 4 个与前几轮一致（零新增）、阶段 key 冒烟 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。

## 6. 后续修改指引（P4）

1. **补需分步窗口的 op**：~~P4 待办~~ → **P4 已完成**，实现为 `PRELUDE_OP_WINDOW` + `p.op_window`（见 `change-D1-P4-op-windows.md` §2）。后续再加同类 op 时：先在那张表声明 kind，候选一律由 `prelude_op_candidates` 用现成原子算，**不要**用 `find_battle_target` 自动选目标。
2. **军备卡响应栈（P5）**：`prelude.persistent` 目前只在 `prelude_run_segment` push、在 `view` 下发；尚未接 `request_responses` 派发点。按 D1 定稿「军备卡基本和响应卡完全一致」，**复用响应卡响应栈骨架**（`RESPONSE_EFFECTS`/`RESPONSE_EFFECT_IMPL`/`request_responses`/`top_response_frame`/两阶段 `view`/`resolve_response_choice`/`deferred_response_stack`+`promote_deferred_response`/`response_reconcile_active`），不是 17543 雷达的 `pending_status_ask`（状态卡排他挂起）。详见 `change-D1-P2-prelude-engine.md` §6 第 2 条。
3. **改 op 参数**：编译层 `PRELUDE_TOKENS[].emit` 与 `prelude_run_op` 的 case **成对改**，并跑 `_probe_prelude_full.js` 确认覆盖率不降、跑 P3 测试 A 组。
4. **改 UI**：`view.prelude` → `update_prelude_box` → bump 版本串，三处同源；改完跑 `_real_test_P3_prelude_ops.js` F 组。
5. **包**：`20261112a` 两个 zip 仍是 P2 之前产物，代码经 P4 已 `20261112d`；按玩家要求「打包等前奏基本完成后再说」。
