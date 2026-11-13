# D1 / P2 前奏引擎接入 Episode 2（2026-11-12）

> 行号为 2026-11-12 快照；定位请用符号名 grep。前置：`change-D1-P0-*`、`change-D1-P1-*`。

## 1. 问题描述

编译层/上传链/分段 IR 已就绪，但引擎零接入：`rules.js` 对 `prelude/tension` 无引用、`init_nation_deck` 仍排除前奏牌堆、`game` 无前奏状态、`exports.scenarios` 只有 `['Standard']`、客户端无前奏 UI。P1 产物只是数据。

## 2. 设计口径

- **分层**：`prelude_compiler.js`（纯函数编译）→ `rules.js` 集中区块（牌堆/紧张度/段窗口/阶段骨架）→ 既有原子执行动作。既有四张效果表一字不改。
- **阶段**：前奏回合只有「行动阶段（三选一，不可跳过）+ 卡牌阶段（弃置所有前奏手牌 → 摸 2 张，自动执行）」；`PHASES`/`PH` 七常量不动，`advance_phase` 开头分流绕开 7 阶段。
- **不做**分数/补给结算（`phase_scoring`/`phase_supply` 早退），但建造战斗仍参考补给。
- **紧张度全局单值**非负初值 0；结束条件**只有两个**（紧张度 ≥10 当前前奏回合结束 / 一轮结束后所有玩家手牌与牌堆皆空）。术语按 `rtt-turn-system`：前者=一个国家回合 `current_nation`，后者=6 国一圈 `game.turn`。
- **正式牌无法触发**（前奏局不派发 `turn_start` 武装卡）；军备卡持续段走 `prelude.persistent`。
- **牌堆顶始终对自己可见**（规则书 :128），照抄 `rules.js:18991` 三暗区保密口径：敌方只给张数。
- 双入口：`scenario='Episode 2'`（创建对局页，`server.js:1545` 自动列出）或 `options.prelude=true`（测试直调）。
- 前奏结束后正式局从**第 1 轮干净开始**（盘面/正式牌堆保留）。

## 3. 接线点索引（★ 后续修改必查）

| 文件 | 符号 | 快照行 | 作用 |
|---|---|---:|---|
| `rules.js` | `exports.scenarios` | 23 | 加 `'Episode 2'`；**改场景名要同步 `PRELUDE_SCENARIO`** |
| 同上 | `PRELUDE_SCENARIO` / `PRELUDE_TENSION_MAX` / `PRELUDE_PHASE` | 1496/1497/1498 | 配置常量；阶段 key 与 `PH.*` 分开，避免污染 7 阶段机 |
| 同上 | `PRELUDE_SPECS` / `PRELUDE_COMPILER` | 1501/1618 | `try/require` 容错；产物或编译层不存在时自动降级 |
| 同上 | `prelude_on(game)` | 1504 | **判据含 `!game.opening`**（否则抢 `opening_discard` 白名单） |
| 同上 | `prelude_effect_of` / `prelude_compile_official` / `prelude_config_of` | 1520/1622/1633 | 派发器一处分支：先查四套 `PRELUDE_*` 表，官方卡现场编译 |
| 同上 | `init_prelude_decks` / `prelude_draw` / `prelude_deck_discard` / `prelude_top` | 1533/1559/1575/1583 | 牌堆；**不改** `init_nation_deck` 的 CORE/SUPP 排除判据 |
| 同上 | `check_prelude_end(game, at_round_end)` | 1588 | 两个结束条件 + 正式局重启收尾（`turn=1`、调 `run_phase_entry`） |
| 同上 | `prelude_run_op(game,nation,op)` | 1639（P3 后漂移，用符号名 grep） | **op → 既有原子映射**；P2 时未接线 op 只记日志，P3 已补 5 类并新增 `PRELUDE_OP_DEFERRED` 登记表，详见 `change-D1-P3-prelude-ops.md` |
| 同上 | `prelude_run_segment` | 1694 | 段级 cost/steps/ongoing 记账（`tension` 是全局） |
| 同上 | `prelude_resolve_card` / `prelude_answer_segment` | 1721/1746 | A 立即执行；B/C 建窗口（`answerNation`/`owner` 分离） |
| 同上 | `prelude_run_phase` / `prelude_advance` | 1766/1780 | 两段骨架 + 国家轮转 + 轮末结束判定 + `on_turn_start` |
| 同上 | `prelude_do_action` | 1813 | 三选一 / 段窗口答复 / `prelude_next`；**双门禁之二** |
| 同上 | `phase_supply` / `phase_scoring` 早退 | 25017/26170 | 规则书 :127 |
| 同上 | `do_opening_discard` 收尾分流 | 26814 | opening 结束进前奏或正式首回合 |
| 同上 | `advance_phase` 前奏分流 | 26860 | 绕开 7 阶段状态机 |
| 同上 | `create_empty_game_state` 的 `prelude` | 27307 | 状态**显式声明**，随存档落盘 |
| 同上 | `setup` 的 `game.options.prelude` + 开局摸 2 张 | 27568/27573 | 双入口 |
| 同上 | `view.prelude` | 29523 | 牌堆顶己方可见 / 敌方只给张数；客户端只读 |
| 同上 | `build_actions` 前奏分支 | 30894 | **双门禁之一**；`side` 是阵营常量 `'axis'/'allies'`，不是 role 名 |
| 同上 | `do_action` 前奏动作分发 | 31257 | 放在所有正式期守卫**之前** |
| `play.js` | `update_prelude_box` | 1431 | 最小 UI；调用点 `update_map` L235 |
| `play.html` | `?v=` | 7 处 | P2 时 `20261112b`，**P3 已 bump 到 `20261112c`**；改客户端必 bump，测试只校验「统一且非空」 |
| `tools/_real_test_P2_prelude_engine.js` | A–F 六组 39 项 | 全文件 | 端到端验收 |
| `tools/_probe_P2_prelude.js` | 只读链路探针 | 全文件 | 快速定位阶段/窗口/结束条件 |

## 4. 排查中修掉的两处假绿（改这里时务必回归）

1. `prelude_on` 未排除 `game.opening` → 开局 `opening_discard` 白名单被前奏抢走。
2. `build_actions` 的 `side` 是阵营常量 `'axis'/'allies'`，误用 `faction_role_of_nation`（返回 `'Axis'/'Allies'`）比较 → `view.actions` 没有前奏动作，但 `do_action` 能执行（服务端能点、客户端看不见）。正确写法 `faction_of_nation(n) === side`。

## 5. 验证与回归

- `_real_test_P2_prelude_engine.js` **39/0**；`_probe_P2_prelude.js` 全链路通。
- 前奏编译 68/0、上传链 37/0、B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；阶段 key 冒烟 18/0；`test_basic_cards` 288/9、全量冒烟未登记失败 4 个与前几轮一致（零新增）、`check_reuse` B/C 干净、lints 0。
- `LISTEN 8091 HTTP=200`（重启时用精确命令行匹配，未误杀 8090 预览服）。

## 6. 后续修改指引（P3 从这里入手）

1. **补 op**：~~P2 的 default「尚未接线（P2 骨架）」~~ → **P3 已处理**：新增 `PRELUDE_OP_DEFERRED` 登记表（写明缺口类型）、接了 `add_marker`/`always_supplied`/`supply_point`/`end_neutrality`/`join_hand`，`view` 增 `persistent[]` 与 `unhandled_ops`。剩余需分步窗口的 op 见 `change-D1-P3-prelude-ops.md` §3 与登记表；补时**必须复用 `exports._internal` 原子**，不要自己遍历（见 `rtt-atomic-operations`）。
2. **军备卡响应栈（P5）**：按 D1 定稿「**军备卡基本和响应卡完全一致**」，应复用**响应卡响应栈骨架**，不是 17543 雷达的 `pending_status_ask`（那是【状态卡排他询问挂起】，B35 修 17513 时用过，曾被误抄进本条）。正确骨架：`RESPONSE_EFFECTS`(`rules.js:17682`) / `RESPONSE_EFFECT_IMPL`(effect 签名 `(game,side,ctx,choice,extra)`，`18361`) / `request_responses`(压栈，`19810`) / `game.response_stack`+`top_response_frame` / 两阶段 `view.pending_trigger`(待发动→`trigger_response`/`pass_response`) 与 `view.response_choice`(选目标→`resolve_response_choice`) / `remove_response_frame`(按引用移除) / `deferred_response_stack`+`promote_deferred_response`(含战斗卡用 defer) / `response_reconcile_active`+`handoff_to`(跨阵营让权)。P5 应新增 `PRELUDE_RESPONSE_EFFECT_IMPL` 同构独立表并在这些时机压帧；**不要**新造 `pending_*_ask`，也**不要**用 P4 的 `p.op_window`（那是前奏 event 卡选目标用的）。`prelude.persistent` 目前只在 `prelude_run_segment` push、在 ACTION 入口按 `persistent_used` 重跑。**P5 已实现，最终口径与接线点见 `docs/change-D1-P5-armament-response-stack.md`**（零分流 + 暗置留场 + 补 `play_response`）。⚠ 本条曾写「`fire_trigger` 无需改动」，实测不成立：P5 在 `fire_trigger` 加了一处查表分支、在 `resolve_response_choice`/`trigger_response` 各加一处 effect 查表，并在 `phase_scoring` 补 `scoring` 时点派发。
3. **改阶段/结束条件**：`check_prelude_end`（1588）与 `prelude_advance`（1780）成对；改完必须同时跑 P2 测试的 E 组。
4. **改 view 字段**：`view.prelude`（29523）→ `play.js:update_prelude_box`（1431）→ bump 版本串，三处同源。
5. **改动作**：`build_actions`（30894）+ `prelude_do_action`（1813）+ `do_action`（31257）**三处**同时改，缺一即「点了没反应」。
6. **包与版本串**：`20261112a` 两个 zip 是 P2 之前产物，代码经 P4 已 `20261112d`；按玩家要求「打包等前奏基本完成后再说」，重出包时按 `rtt-release-packaging` 走。
