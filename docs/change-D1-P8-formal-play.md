# D1 / P8 正式牌「选择并打出」留场 + 后备区对齐（2026-11-12）

> 行号为快照；定位请用符号名 grep。前置：`change-D1-P7-inspect-chain.md`。
> 本条取代 P7 文档 §6 的 P8 待办描述。

## 1. 玩家口径澄清

上一轮玩家说「牌堆顶的牌也看能打，所以实际上一个语意吧，只是仍在前奏牌库内」，经结构化确认选择：**「打手牌 / 打牌堆顶」两个行动是同一语义（P2 已统一走 `prelude_resolve_card`），不再改动；检视类仍按卡面分正式牌堆与前奏牌堆；P8 第 1 项照原计划做「正式牌选择并打出」**。

只读证据：前奏牌库 125 张全是 `PRELUDE`/`ARMAMENT`，**0 张** `STATUS`/`RESPONSE`/`STRATEGY`；`18412`/`14907`/`18004`/`17204` 的「检视牌堆前 10 张，选 1 张[响应卡]/[状态卡]」筛的是正式牌类型，`14903`/`17207` 的「检视**前奏**牌堆，选 1 张[军备卡]」才落在前奏牌库。P6 的 `source` 三分法成立，不推翻。

## 2. 一处有依据的技术判断（与 P8 原计划文字的差异）

P7 文档 §6 第 1 条曾建议「走正式 `play_card` 动作并同步双门禁」。只读核对后**未采用**，依据：

- `play_status_card_impl`（`rules.js:31756`）会调 `apply_status_ongoing` + `request_responses('play_card')` + `after_card_resolved` + `game.card_actions_this_nation++` —— 等于在**前奏期触发正式牌并动出牌配额**，与规则书 `:129`「前奏中正式牌无法触发」冲突；
- 前奏期 `build_actions` 是独占分支，客户端只有独立的前奏面板、没有正式出牌按钮 —— 下发 `play_card` 会造成「白名单给了却点不中」的假绿。

**实际落地**：「选择并打出」= 按牌面类型**留场**（复用现成容器/原子，不触发 `card_effect_of`），动作入口沿用既有的 `prelude_op_pick`（双门禁 P4 已就绪，不新增 action）。这与玩家此前「军备卡/响应卡暗置留场待触发」的口径一致。

## 3. 改动清单

| # | 文件 / 符号 | 改动 |
|---|---|---|
| 1 | `prelude_compiler.js` 段后处理 | 把卡面类型筛选 `s.filters[0]` 传播到同段后续 op 的 `filter` 字段（14907/18004/17204→`状态卡`，14903→`军备卡`；`建设陆军` 排除） |
| 2 | `rules.js` `PRELUDE_FILTER_TYPE`（新） | 中文类型名 → `cards.js` 的 type 枚举配置表；映射不到的（如「战略卡」全库无对应 type）返回空数组 = **不过滤**，避免误筛光。`prelude_filter_ok()` 先 `inst_card_id` 归一再 `is_card_type` |
| 3 | `rules.js` `prelude_op_candidates` | `peek_and_play` 候选按 `op.filter` 过滤；仍保留 P7 的 `source` + `peek_scope` |
| 4 | `rules.js` `prelude_apply_op_choice` | `peek_and_play`（formal/discard）选中牌按类型留场：`STATUS`→`game.table[owner]`（明置，不走 `play_status_card_impl`）；`RESPONSE`→先放手牌再 `facedown_response`（暗置，牌名保密）；其它→取回 `game.hands` 并记「不自动打出正式卡」。`prelude` 来源仍走 `prelude_resolve_card` |
| 5 | `rules.js` `prelude_run_op` 的 `add_reserve` | **复用现成原子 `add_army_bonus`**（含 `ARMY_BONUS_MAX` 按国封顶），由正式局 `unit_cap_ok` 读 `army_bonus_of` 生效；`p.reserves` 保留前奏累加记账，另记 `p.reserves_bonus` 同源值 |
| 6 | `view.prelude` / `play.js` | 下发 `reserves_bonus`，面板显示「后备 ×N · 正式局陆军上限 +M」 |
| 7 | `rules.js` `prelude_response_impl` | 多段军备卡**遍历后续段的非窗口 op** 一并执行（不再只跑 `segments[0]`）；窗口 op 记日志留给 `defer` 续打，绝不自动替玩家选 |
| 8 | `play.js` `order` 窗口 | 「逐张点击」升级为**点击累积 + HTML5 拖拽重排 + 撤销**；服务端 `arg.order` 校验逻辑不变 |
| 9 | `play.html` | 版本串 `20261112e → 20261112f`（7 处） |
| 10 | `tools/_real_test_P8_formal_play.js`（新） | 19 项编号真实测试；P6 D 组 / P7 C、F 组按卡面口径更新断言 |

**零改动**：响应栈核心、四套 `PRELUDE_*` 表结构、`cards.js`、正式局 `play_card` 路径、正式局 `unit_cap_ok` 实现。

## 4. 测试断言按卡面口径更新（非功能回归）

- P6 D 组：`14903` 是「选 1 张[军备卡]」，原摆 `15400#p*`（BASIC 建设陆军）在新过滤下无候选 → 改摆 `18416#p*`（ARMAMENT）。
- P7 C 组：`14907` 是「选 1 张[状态卡]」，原摆 `15300#f*`（BASIC）→ 改摆 `15255#f*`（STATUS）；选中后的断言由「加入正式手牌」改为「明置留场于 `game.table`、不进手牌」。
- P7 F 组：多段防御日志文案按 P8 更新为「后续段非窗口 op 一并执行」。

## 5. 接线点索引（后续修改先查此表）

| 符号 | 作用 |
|---|---|
| `PRELUDE_FILTER_TYPE` / `prelude_filter_ok` | 卡面类型过滤**唯一**配置点；新增牌类型只改这里 |
| `prelude_compiler.js` 段后处理的 `op.filter = ...` | 类型筛选传播唯一实现点（P7 `source`/`peek_scope` 同处） |
| `prelude_apply_op_choice` 的 `peek_and_play` formal/discard 分支 | 「选择并打出」按类型留场唯一实现点；**不要**改成 `play_status_card_impl` / `card_effect_of` |
| `add_reserve` case → `add_army_bonus` / `army_bonus_of` | 前奏后备 ↔ 正式局棋子上限的唯一对齐点 |
| `prelude_response_impl` 的 `for (let si = 1; ...)` | 多段军备卡后续段执行点 |
| `play.js` 的 `item.draggable` / `ondrop` | order 拖拽交互；服务端校验在 `prelude_apply_op_choice` 的 `order` 分支 |
| `tools/_real_test_P8_formal_play.js` | A–E 五组 19 项验收 |

## 6. 验证与回归

- `_real_test_P8_formal_play.js` **19/0**：filter 传播（14907/18004/17204/14903 + 18412 不回归）、候选只留状态卡、三种牌类型各自留场（STATUS 明置 / RESPONSE 暗置保密 / 其它取回手牌）、后备区 `add_army_bonus` 与 `reserves_bonus` 同源、多段遍历与 defer 守卫、拖拽/撤销静态守卫、覆盖率 100%。
- 前奏九套 68/37/41/25/25/33/28/24/19 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过。
- `test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。
- 产物：`prelude_specs.js`、`out/prelude_tokens.txt` 重生成；官方 125 张覆盖率 412/412 = 100%、待补 0。

## 7. 后续修改指引（P9）

1. **含战斗的多步 `defer` 军备卡**：58 张实测全单段，当前多段只跑「非窗口 op」；窗口 op 需按 `rtt-response-stack` 铁律用 `defer`（含战斗不能用 `pending` 续打），接时同步 `pc.extra.prelude_segment`。
2. **EVENT/ECON 类型正式牌的留场语义**：目前「其它类型」统一取回正式手牌；若卡面要求「打出 1 张[事件卡]」，需明确是留场还是取回，再扩 `peek_and_play` 分支。
3. **`order` 跨牌堆排序 / 服务端排序预览**：服务端 `arg.order` 校验不变，只需扩客户端与 `prelude_peek_array` 的 source 组合。
4. **包**：`20261112a` 两个 zip 仍是旧产物，代码经 P8 已 `20261112f`；按玩家要求「打包等前奏基本完成后再说」。
