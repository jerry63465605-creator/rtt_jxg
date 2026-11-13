# D1 / P4 前奏统一分步窗口 + 剩余 op 接线（2026-11-12）

> 行号为 2026-11-12 快照；定位请用符号名 grep。前置：`change-D1-P3-prelude-ops.md`。

## 1. 问题描述

P3 把「未接线 op」收口进了 `PRELUDE_OP_DEFERRED`，但官方 125 张里仍有 11 类 op、约 56 次出现不执行。其中 `battle`/`eliminate`/`deploy_air`/`peek_*` **必须让玩家选目标或牌** —— `rtt-atomic-operations` 铁律禁止服务端用 `find_battle_target` 之类替玩家选。同时 `prelude.persistent`（军备卡持续段）只在 `view` 里可见、没有触发派发；客户端也只认段窗口。

## 2. 设计：统一分步窗口 `p.op_window`

按 `rtt-pending` 铁律实现：

| 铁律 | 落地 |
|---|---|
| 挂起必须能落盘 | `create_empty_game_state` 显式声明 `op_window:null` / `reserves:{}` / `extra_action:0`；窗口结构只含 JSON 可往返的字段 |
| 双门禁 | `build_actions` 前奏分支下发 `prelude_op_pick` / `prelude_op_skip`；`do_action` 分发到 `prelude_do_action`；`prelude_do_action` 里 **op 窗口优先于段窗口** |
| 判据用 side | 权限用 `faction_role_of_nation(w.nation) === current`；`build_actions` 的 `side` 用阵营常量 `faction_of_nation` |
| 错过即失效有出口 | `prelude_op_skip` 明确放弃并记日志；候选为空时记日志跳过，不留 limbo |
| 翻转成对 | 答完 `p.op_window=null`，排队 ops 续跑，全跑完再按 `p.pending` 决定是否推进到卡牌阶段 |

**五类窗口 kind**（`PRELUDE_OP_WINDOW` 表声明）：

| kind | 对应 op | 候选来源（现成原子/权威状态） |
|---|---|---|
| `piece` | `battle` / `eliminate` | 遍历 `game.location` 的敌方部队；`battle` 额外用 `battle_initiators` 过滤；执行走 `do_battle` / `eliminate_piece` / `seize_air` |
| `space` | `deploy_air` | `can_build_at(game,nation,sp,'air')` 过滤；执行走 `build_piece` |
| `card` | `peek_and_play` | 前奏牌堆顶 N 张；执行时从牌堆移除并 `prelude_resolve_card` |
| `choice` | `peek_reorder` / `choice_attrition_or_skip` | 顶/底二选一、损耗/跳过二选一 |
| `order` | 预留 | —— |

**ops 排队**：`prelude_run_steps` 遇到需窗口的 op 就落挂起并保存 `pendingOps = ops.slice(i+1)`；`prelude_answer_op_window` 答完后继续跑剩余 ops（可能再开新窗口），全部跑完才推进。避免「一张卡多个窗口只执行第一个」。

## 3. 改动清单

| # | 位置 | 改法 |
|---|---|---|
| 1 | `rules.js` 状态层 | 新增 `op_window` / `reserves` / `extra_action` |
| 2 | 同上 | 新增 `PRELUDE_OP_WINDOW`、`prelude_op_candidates`、`prelude_run_steps`、`prelude_apply_op_choice`、`prelude_answer_op_window` |
| 3 | `prelude_run_op` | 签名加 `seg`；新接 `lose_score`（敌方阵营扣分）、`add_reserve`（`p.reserves`）、`shuffle_into_deck`（从 `seg.refs` 找卡名 → 洗入正式牌堆）、`execute_action_phase`（`p.extra_action++`） |
| 4 | `prelude_run_segment` | for 循环改为 `prelude_run_steps`；持续段记账增加 `segObj` |
| 5 | `prelude_run_phase` ACTION 入口 | 军备卡持续段按「国家+段+轮」`persistent_used` 记账重跑，**只跑不需分步窗口的 op**（防反弹多窗口）；响应栈派发留 P5 |
| 6 | `prelude_advance` ACTION 分支 | `extra_action>0` 时消耗一次并留在 ACTION 再跑一次 |
| 7 | `prelude_answer_segment` / `prelude_resolve_card` | 段窗口答完时若 `p.op_window` 未决则不推进 |
| 8 | `build_actions` / `prelude_do_action` / `view.prelude` | op 窗口双门禁 + 候选**只下发给答复方**（对手只见 `waiting`） + `reserves`/`extra_action` 下发 |
| 9 | `play.js` `update_prelude_box` | 候选按钮（回传服务端给的 id）、`desc`、额外行动、未接线 op 诊断、结束后收成一行显示 `end_reason` |
| 10 | `play.html` | 版本串 `20261112c → 20261112d`（7 处） |
| 11 | 测试断言口径 | P2 D 组（14903 A 段连开两个 `peek_*` 窗口，先答完才轮到 C 段）、P3 E 组（`peek_reorder` 从 default 日志变窗口）按新口径更新，均注明「非功能回归」 |

## 4. 接线点索引（后续定位）

| 符号 | 作用 |
|---|---|
| `PRELUDE_OP_WINDOW` | **加/删需窗口 op 只改这张表**；kind 决定候选类型 |
| `PRELUDE_OP_DEFERRED` | P3 遗留登记表；P4 后只剩真正缺原子/上下文的项，default 日志仍查它 |
| `prelude_op_candidates(game,nation,op,kind)` | 候选唯一计算点；**禁止**在这里用 `find_battle_target` 替玩家选 |
| `prelude_run_steps(game,nation,ops,seg)` | 分步执行器 + ops 排队；`prelude_run_segment` 调它 |
| `prelude_apply_op_choice(game,w,pick)` | 答复后执行，全部复用 `_internal` 原子 |
| `prelude_answer_op_window(game,pick,skip)` | 答复出口；控制「何时推进到卡牌阶段」 |
| `prelude_do_action` 开头 op 窗口分支 | 双门禁之二，优先级高于 `p.pending` |
| `build_actions` 前奏分支 `if (p.op_window)` | 双门禁之一 |
| `view.prelude.op_window` | 候选隐私判定（答复方 vs waiting） |
| `play.js:update_prelude_box` | 候选按钮 / 结束原因 / 诊断 |
| `tools/_real_test_P4_op_windows.js` | 25 项验收 |

## 5. 验证与回归

- `_real_test_P4_op_windows.js` **25/0**：状态声明、双门禁与隐私、choice/card/piece/space 四类窗口答复、ops 排队续跑、放弃出口、无窗口 op 与额外行动阶段、静态守卫。
- 前奏编译 68/0、上传链 37/0、P2 41/0、P3 25/0；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过。
- `test_basic_cards` 288/9（基线）、全量冒烟未登记失败 4 个与前几轮一致（零新增）、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。

## 6. 后续修改指引（P5）

1. **军备卡响应栈（P5）**：当前 `prelude.persistent` 只在 ACTION 入口做 `once_per_turn` 重跑；尚未接 `request_responses` 派发点。按 D1 定稿「**军备卡基本和响应卡完全一致**」，应复用**响应卡响应栈骨架** —— `RESPONSE_EFFECTS`(`rules.js:17682`) / `RESPONSE_EFFECT_IMPL`(`18361`) / `request_responses`(`19810`) / `game.response_stack`+`top_response_frame` / `view.pending_trigger` 与 `view.response_choice` 两阶段 / `trigger_response`·`pass_response`·`resolve_response_choice` / `remove_response_frame` / `deferred_response_stack`+`promote_deferred_response` / `response_reconcile_active`+`handoff_to`。**不要**用 17543 雷达的 `pending_status_ask`（那是 B35 的状态卡排他挂起，曾误抄进本条）；**也不要**用 P4 的 `p.op_window`（那是前奏 event 卡选目标用）。P5 应新增 `PRELUDE_RESPONSE_EFFECT_IMPL` 同构独立表，并在上述时机压帧；四套 `PRELUDE_*` 产物表保持不变。**P5 已实现（2026-11-12），见 `docs/change-D1-P5-armament-response-stack.md`**：零分流 + 暗置留场 + `play_response` → `facedown_response`。⚠ 更正：本条曾写「`fire_trigger` 不改」，实测不成立 —— 它只认 `RESPONSE_EFFECTS`，P5 加了一处查表分支（性质是「查哪张表」，不是按阶段分流），另在 `resolve_response_choice`/`trigger_response` 加两处 effect 查表。
2. **`order` kind**：`peek_reorder` 目前简化为「置于顶/底」二选一；若要玩家自定义 N 张顺序，需新增 `kind:'order'` 与客户端排序 UI，并让 `prelude_apply_op_choice` 接受数组。
3. **剩余 DEFERRED 项**：`add_reserve` 现在只是 `p.reserves` 记账（正式后备区无对应原子），若正式局要消费后备，需与既有后备机制对齐；`shuffle_into_deck` 依赖 `seg.refs` 有卡名引用，编译层未捕获到名字的卡会跳过。
4. **改窗口优先级**：op 窗口 / 段窗口 / 结束判定三者的顺序集中在 `prelude_do_action`、`prelude_answer_op_window`、`prelude_answer_segment` 三处，改任一处都要跑 P2 D 组与 P4 E 组。
5. **包**：`20261112a` 两个 zip 仍是旧产物，代码已 `20261112d`；按玩家要求「打包等前奏基本完成后再说」。
