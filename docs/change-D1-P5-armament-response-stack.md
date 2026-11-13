# D1 / P5 军备卡响应栈派发（2026-11-12）

> 行号为 2026-11-12 快照；定位请用符号名 grep。前置：`change-D1-P4-op-windows.md`。
> 本文档取代 P2/P3/P4 三份文档 §6 里所有「P5 待办」描述。

## 1. 问题描述

玩家三轮澄清后定稿的口径：

- 军备卡**与响应卡完全一致**：打出即**暗置在桌面留场待触发、只持有方可见**；不新建独立明置容器、不需要 `face_up`。
- **零分流**：不做「阶段型 / 事件型」分类。卡暗置在桌面，`fire_trigger` 在事件命中时压栈；前奏期没有计分/出牌阶段，声明这些 `on` 的卡自然不触发、留到正式局；前奏期有建设/战斗，`build`/`battle`/`piece_removed` 事件照常派发。日本 `18404`/`18412` 等前奏卡能**提前打出响应卡**令其在前奏对应时点触发，也是同一套机制。
- `:129`「前奏中正式牌无法触发，军备卡可以触发」理解为：前奏行动阶段不能主动打出正式牌；桌面已暗置的响应卡（含开局布阵与由前奏卡效果提前打出的）仍按事件时点触发。

**只读查证到的真缺口**：`18404 黑龙会`、`18412 近卫文麿上台组阁`、`18416 国家总动员法` 的「打出 1 张[响应卡]」被编译层产出为 `play_prelude` / `peek_and_play`（执行 `prelude_resolve_card` = **打出前奏牌**），但 `filters=['响应卡']` 指的是正式响应卡 —— 语义错位，导致「提前暗置响应」这条链断在编译层。

## 2. 改动清单

| # | 文件 / 符号 | 改动 |
|---|---|---|
| 1 | `prelude_compiler.js` `compile` 段组装处 | 段级收口：`filters` 含「响应卡」时，把 `play_prelude`/`play_prelude_top`/`peek_and_play` 改为 `play_response{filter:'响应卡'}`（类型筛选词条在动作之后出现，emit 时 `sc.filters` 未齐，故在段组装完成后处理） |
| 2 | `rules.js` `PRELUDE_OP_WINDOW` | 登记 `play_response: 'card'` |
| 3 | `rules.js` `prelude_op_candidates` / `prelude_apply_op_choice` | `play_response` 候选取**正式手牌**里 `is_card_type(face,'RESPONSE')` 的卡（先 `inst_card_id` 归一）；选中后复用 `facedown_response(game,owner,pick,'hand')` |
| 4 | `rules.js` `prelude_facedown`（新） | 军备卡暗置进 `game.table_responses`，字段与 `facedown_response` 完全一致 + `prelude:true`；**不复用**该原子（它从正式 `hands`/`discard` 取牌，前奏卡在 `p.hands`） |
| 5 | `rules.js` `prelude_resolve_card` | 军备卡打出即暗置返回，**不执行段效果、不进 `p.discard`**；打出/暗置日志不插值卡名（牌名保密） |
| 6 | `rules.js` `PRELUDE_ON_MAP` + `prelude_trigger_on_of` + `prelude_response_trigger_of`（新） | 编译层 `trigger.on` → 引擎 `request_responses` 的 `on`（配置驱动）；现场编译官方军备卡供 `fire_trigger` 查表 |
| 7 | `rules.js` `prelude_response_impl`（新） | 声明式 `segments` → 响应栈 effect 函数 `(game,side,ctx,choice,extra)`；首调遇需窗口 op 返回 `{pending:true,candidates,prompt}`，续调按 `choice` 执行 |
| 8 | `rules.js` `fire_trigger` | **一处查表分支**：`RESPONSE_EFFECTS[face]` 查不到且条目带 `prelude:true` 时查前奏表。不是按阶段分流 —— 所有 `on` 仍走同一套事件匹配 |
| 9 | `rules.js` `resolve_response_choice` / `trigger_response` | 两处 impl 查找加 `|| prelude_response_impl(...)`；正式卡优先命中、短路求值，正式行为不变 |
| 10 | `rules.js` `phase_scoring` | 补 `request_responses(game,'scoring',{nation},false)` 时点派发（正式 `RESPONSE_EFFECTS` 无 `scoring` 监听者，对正式局零影响）；前奏期被既有 `prelude_on` 早退，阶段型卡自然留到正式局；`__afterIntercept` 守卫防重复派发 |
| 11 | `rules.js` 三处门禁 | `build_actions` 前奏分支加 `&& !top_response_frame(game)`（响应栈未决时让出白名单给正式响应动作）；`do_action` 前奏分发与 `prelude_advance` 开头冻结推进，避免与 `handoff_to` 两套 `active` 写者互踩 |
| 12 | `tools/_probe_P5_response_stack.js` / `tools/_real_test_P5_armament_response_stack.js` | 只读端到端探针 + **33 项编号真实测试** |

**零改动**：`RESPONSE_EFFECTS` / `RESPONSE_EFFECT_IMPL` 实现、`request_responses` / `resolve_response_choice` / `response_reconcile_active` / `handoff_to` / `consume_response` / `stillOnTable` 校验、四套 `PRELUDE_*` 产物表结构、`cards.js` 官方 125 张、`play.js` / `play.html`（本轮未改客户端，故**不 bump 版本串**，仍 `20261112d`）。

## 3. 与设计预期的差异（重要，供后续定位）

上一轮设计写「`fire_trigger` 零改动」，**实测不成立**：`fire_trigger`（`rules.js:11637`）只认 `RESPONSE_EFFECTS[faceId]`，军备卡不在该表；`resolve_response_choice` / `trigger_response` 也只认 `RESPONSE_EFFECT_IMPL[face]`。因此 P5 一共加了 **3 处查表分支**（1 处触发 + 2 处 effect）。这些分支是「查哪张表」，不是「按阶段分流触发」，与玩家「零分流」口径不冲突 —— 也正是 D1 定稿「派发器加一处分支」的确切落点（effect 侧两处是同一分支的对称点）。

另一个实测缺口：编译层 `计分阶段开始时 → scoring`，但引擎原本**没有** `scoring` 事件派发点。补在 `phase_scoring` 后，阶段型卡才真能在正式局触发。

## 4. 接线点索引（后续修改先查此表）

| 符号 | 作用 |
|---|---|
| `PRELUDE_ON_MAP` | 编译层 `on` → 引擎 `on` 唯一映射表；加新触发短语只改这里 |
| `prelude_trigger_on_of(cfg)` / `prelude_response_trigger_of(game,cardId)` | 触发查表（供 `fire_trigger` 一处分支） |
| `prelude_response_impl(game,face)` | effect 适配工厂；多步续打 / `defer` 若扩展，改这里 |
| `prelude_facedown(game,nation,cardId)` | 军备卡暗置；`prelude:true` 标记是查表分支的判据 |
| `PRELUDE_OP_WINDOW.play_response` | `play_response` 选牌窗口（复用 P4 `prelude_op_candidates` / `prelude_apply_op_choice`） |
| `compile` 段组装处的 `filters` 收口 | 改「打出[响应卡]」语义时只改这里，不动 `PRELUDE_TOKENS` |
| `fire_trigger` 的 `r.prelude` 分支 | 派发器唯一入口；**不要**在这里按 `on` 分类 |
| `phase_scoring` 的 `scoring` 派发 | 阶段型卡的正式局时点 |
| `tools/_real_test_P5_armament_response_stack.js` | A–G 七组 33 项验收 |

## 5. 验证与回归

- `_real_test_P5_armament_response_stack.js` **33/0**：编译层三张卡 IR 修正、暗置留场只持有方可见、零分流（build 不命中 / scoring 命中）、两阶段待发动→选目标→结算、`facedown_response`、`18404` 的 `play_response` 路径、三处门禁、静态守卫。
- 端到端探针实测链路：`18416` 打出 → `table_responses[prelude]` → `build` 不命中 → `scoring` 命中压栈 → `trigger_response` 首调 pending → `resolve_response_choice` 暗置 `15328` → 原卡被 `consume_response` 消耗。
- **排查中修掉一个真 bug**：暗置日志插值了卡名，触发 `_smoke_facedown_privacy.js` 静态兜底失败（全量冒烟一度 4→5 个未登记失败）。已改为「暗置 1 张响应卡（牌面保密）」并把断言改为验收保密；修复后该脚本 20/0、全量冒烟回到 4 个基线失败。
- 回归：前奏编译 68/0、上传链 37/0、P2 41/0、P3 25/0、P4 25/0；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；`test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（零新增）、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。

## 6. 后续修改指引（P6）

1. **多步 / 含战斗的军备卡**：`prelude_response_impl` 目前只跑 `segments[0]` 的单步；若卡面有多步或 `battle` 引起的嵌套响应，按 `rtt-response-stack` 铁律用 `defer`（不要用 `pending` 续打问「是否再战」），并透传 `pc.extra.prelude_step`。
2. **18412 的 `peek_reorder` / 后续段 `mandatory` 窗口**：**均已由 P6 实现**，见 `docs/change-D1-P6-semantics.md`（编译层 `source` 捕获 + `prelude_op_window_kind` 唯一判定点 + 后续 mandatory 直接执行）。P6 另修了 `prelude_do_action` 阶段推进门禁漏判 `op_window` 的 bug。
2b. **P6 仍留的局限**：同段后续的 `peek_and_play`/`join_hand` 仍从 `p.decks` 取牌，未继承检视 op 的 `source`；`18412`/`14907` 这类「检视正式牌堆后打出」的卡在 P7 补。
4. **阶段型卡在正式局的 `owner_side`**：跨阵营让权沿用 `handoff_to`；若前奏结束前桌面仍有军备卡，正式局开始时无需迁移（本就在 `table_responses`）。
5. **包**：`20261112a` 两个 zip 仍是旧产物，代码经 P5 仍为 `20261112d`（客户端未改）；按玩家要求「打包等前奏基本完成后再说」。
