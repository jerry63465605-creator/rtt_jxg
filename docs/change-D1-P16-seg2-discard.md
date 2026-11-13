# D1 / P16 `14903` C 段：对手弃牌反制 + 选打前奏手牌（2026-11-12）

> 前置：`docs/change-D1-P14-inspect-ui.md`。玩家逐卡核对条目：「`[除非英国弃置2张手牌] 打出1张前奏手牌` 当前有问题，应该根据正常的选择弃牌客户端 UI 实现，弃牌后才归还德国，如果此时德国有多前奏手牌，参考通用情况 UI，玩家选择一个打出」。

## 1. 玩家确认的 3 点口径

1. 英国弃的是 **正式手牌 2 张**（卡面只写「手牌」；前奏牌会明写「前奏手牌」）。
2. **不物理切** `current_nation` / `active`：白名单已做到「英国答完前德国不能动」，用显式等待状态 + 归还日志表达「弃牌后才归还德国」，避免踩前奏阶段机。
3. 德国选前奏手牌 **复用 P14 `prelude_peek_modal` 卡图弹窗**（走现成 `p.op_window` + `prelude_op_pick`）。

## 2. 修复前的真实复现

| 期望 | 修复前实测 |
|---|---|
| 英国按通用弃牌 UI 弃 2 张 | `prelude_pay` 只记日志「后续段未执行（对手已支付代价阻止）」，正式手牌 7→7、弃牌堆 3→3；客户端只有两个纯文字按钮 |
| 弃牌后归还德国 | 没有弃牌过程、没有等待/归还状态；`current_nation`/`active` 一直是德国，只是 `p.pending` 被清空 |
| 多张前奏手牌时选一张打出 | `prelude_run_op` 的 `case 'play_prelude'` 直接 `h.shift()` 打第一张 |

附带复现 P11 挂起项：打第一张 `14900 德奥合并` 时其 A 段 `play_prelude` 连锁把第二张也打了，日志出现两次「等待…决定是否支付后续段代价」。

C 段编译产物：`kind='opponentOptOut'`、`opponent='英国'`、`opponentCost={discard:2}`、`steps=[{op:'play_prelude',n:1}]`。

## 3. 改动清单

| # | 文件 / 符号 | 改法 |
|---|---|---|
| 1 | `rules.js` `prelude_resolve_card` 建 `p.pending` 时 | 首段 `opponentOptOut` 且 `opponentCost.discard>0` 时挂 `opponentDiscard:{nation,need,candidates}`，候选 = 答复国**正式手牌**带 `img/type/text`（`prelude_cand_info`），随存档落盘；日志改为「等待【英国】选 2 张正式手牌弃置」 |
| 2 | `rules.js` `view.prelude.pending` | 加 `opponentDiscard`，**只下发给答复方阵营**（`faction_role_of_nation(answerNation) === current`），对手为 `null`（牌面保密） |
| 3 | `rules.js` `prelude_answer_segment(game,pay,arg)` | `pay && opponentDiscard` 时校验 `arg.cards`：数量恰好、按实例 id 去重、都在该国正式手牌；不合法则**保留窗口**并记日志；合法则逐张 `discard_card`（`rtt-discard` 铁律，不用 `attrition`），之后才阻止段执行。清空 `p.pending` 时记「操作权归还【owner】」 |
| 4 | `rules.js` `prelude_do_action` | 段答复透传 `arg`，让 `prelude_pay {cards}` 到达服务端 |
| 5 | `rules.js` `PRELUDE_OP_WINDOW` / `prelude_inspect_op` / `prelude_run_steps` | 登记 `play_prelude:'card'`；加入 P14 检视/选牌类（走卡图 modal、不可放弃、空候选跳过段）；**手牌 0/1 张时直接执行不弹窗**；窗口 desc 特判「选择 1 张前奏手牌打出」 |
| 6 | `rules.js` `prelude_op_candidates` / `prelude_apply_op_choice` | 新增 `play_prelude` 两条分支：候选 = 该国前奏手牌带卡图；选中后从手牌移除该张并 `prelude_resolve_card`（不再默认第一张） |
| 7 | `play.js` `echo_discard_modal` 第 5 个用户 | 新增 `prelude_opponent_discard_sel` + `render_prelude_opponent_discard_box()`（共用 `card-grid` 真实卡图、`.sel` 高亮、`picked/need` 计数）+ 点选/确认/取消；`update_echo_discard_box` / `confirm_echo_discard` / `cancel_echo_discard` 三处分流 |
| 8 | `play.js` `update_prelude_box` | 每帧从 `view.prelude.pending.opponentDiscard` 同步候选（换一批牌才清空选择）；有弃牌代价时**移除「支付代价」文字按钮**，改由弹框选满 N 张确认发 `prelude_pay{cards}`；「不支付」保留。取消弹框 = 发 `prelude_skip`（不阻止） |
| 9 | `play.js` P14 弹窗 | 文案「检视到的牌」改为通用「候选牌（点击选择）」，复用作打牌选牌框 |
| 10 | `play.html` | 版本串 `20261112k → 20261112l`（7 处） |
| 11 | 测试 | 新增 `tools/_real_test_P16_seg2_discard.js`（33 项）；P2 C·D / P4 C / P6 C / P14 D / P15 E 断言按「连锁选牌窗口」与版本串 bump 更新 |

**零改动**：`discard_card` / `attrition_cards` 语义、`opponentOptOut` 判定（`pay→不执行段`、`skip→执行段` 仍正确）、四套 `PRELUDE_*` 表、`cards.js`、响应栈、正式局段窗口（无 `opponentDiscard` 时 `prelude_pay{}` 原行为保留）。

## 4. 双门禁与隐私

- `build_actions` 段窗口分支仍按 `faction_of_nation(p.pending.answerNation) === side` 只给答复方 `prelude_pay`/`prelude_skip`；德国视角 `opponentDiscard=null`。
- 服务端二次校验 `arg.cards`，非法提交保留窗口，防止绕过 UI 直接「点一下就算付了」。
- 弃牌候选带正式卡牌名/图，只下发给英国阵营；德国侧看不到。

## 5. 验证与回归

- `_real_test_P16_seg2_discard.js` **33/0**：A 候选下发与隐私、B 四种非法提交被拒、C 合法弃 2 张进弃牌堆 + 段未执行 + 归还 + 不物理切 `current_nation`/`active`、D 多张手牌弹 P14 选牌窗口且打出选中的那张、E 仅 1 张直接打不弹窗、F 无弃牌代价段窗口不回归、G 静态守卫。
- 十六套 68/37/43/25/25/33/28/24/19/21/27/21/20/26/29/33 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；`test_basic_cards` 288/9、全量冒烟 4 个基线失败（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0；覆盖率 408/408=100%、方括号零遗漏。
- 改了 `rules.js` → 硬重启 8091 + 探活。

## 6. 接线点索引

| 符号 | 作用 |
|---|---|
| `p.pending.opponentDiscard` | 对手弃牌候选与数量唯一落点（随存档落盘） |
| `view.prelude.pending.opponentDiscard` | 只给答复方阵营；客户端弹框的唯一数据源 |
| `prelude_answer_segment` 的 `cards` 校验 + `discard_card` 循环 | 「弃牌后才归还」的唯一实现点 |
| `PRELUDE_OP_WINDOW.play_prelude` / `prelude_inspect_op` | 选打前奏手牌走 P14 卡图弹窗的唯一登记 |
| `prelude_run_steps` 的 `length <= 1` 特判 | 仅 1 张手牌时不多弹窗口 |
| `prelude_op_candidates` / `prelude_apply_op_choice` 的 `play_prelude` 分支 | 候选与执行（不再 `h.shift()` 默认第一张） |
| `play.js:render_prelude_opponent_discard_box` | `echo_discard_modal` 第 5 个用户 |
| `play.js:finish_prelude_opponent_discard` / `skip_prelude_opponent_discard` | 确认发 `prelude_pay{cards}`、取消发 `prelude_skip` |
| `tools/_real_test_P16_seg2_discard.js` | A–G 七组 33 项验收 |

## 7. 后续核对候选

- **`14900 德奥合并` B 段**：卡面「检视牌堆，选择并将 1 张`[战略卡]`置入手牌」编译层仍只产出 `peek_reorder`、没有选牌 op，会弹无卡面依据的顶/底 choice 窗口（P14 §7 已记）。
- **P11 挂起项**：`14900` A 段 `play_prelude` 连锁打牌覆盖 `p.pending` 段窗口；P16 让玩家自选「哪张」后，若选到连锁卡仍可能复现。
- 其它 `opponentOptOut` 卡若代价不是弃牌（分数/前奏牌），当前仍走「点按钮即付」旧路径；可按同一范式接 `opponentDiscard` 之外的代价类型。

## 8. 状态

未打包、未提交；版本串 `20261112l`。
