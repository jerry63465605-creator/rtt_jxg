# D1 / P11 前奏打牌流程修正（乙口径，2026-11-12）

> ⚠ **部分口径已被 `change-D1-P12-no-draw-ally-visible.md` 推翻**：玩家随后明确「之前口径有误，**打出牌后不应该摸牌**」，故本条 §1/§2 里「打出 1 张手牌后从牌堆顶补 1 张进手牌」的实现**已撤销**。仍有效的部分：乙口径的「卡牌阶段点「继续」才执行」、弃 1+1 选牌与再行动、牌库/手牌空不可选、皆空跳过该国、轮转防死循环。文档保留供追溯，勿据已撤销条目继续修改。
>
> 前置：`change-D1-P10-real-card-hand.md`。本条来自玩家实机测试后的排查与口径补充。

## 1. 玩家口径

排查后玩家选 **乙** 并补充：

- 卡牌阶段改为**玩家点「继续」才执行**（不再自动弃光摸 2）；
- 打出 1 张牌后，**牌堆顶的牌放入手牌、出现新的牌堆顶**；
- 「弃 1 前奏手牌 + 弃 1 牌堆顶」后**再执行 1 次行动阶段**；手牌 >1 时**手动选择**要弃的手牌；
- **前奏牌库为空 或 前奏手牌为空** → 不可选择「弃 1+1」；
- **前奏牌库 + 前奏手牌皆空** → 跳过该国的前奏阶段。

只读实测（排查）结论：`prelude_play_hand` 不补牌（`deckLen`/牌堆顶都不变）；`prelude_advance(ACTION)` 自动跑卡牌阶段把补牌吞掉；`prelude_discard_1_1` 用 `h.shift()` 固定弃第一张。

## 2. 改动清单

| # | 文件 / 符号 | 改法 |
|---|---|---|
| 1 | `rules.js` `prelude_do_action` 的 `prelude_play_hand` | `h.splice` 后**先 `prelude_draw(game,n,1)` 再 `prelude_resolve_card`** —— 牌堆顶进手牌、露出新顶；顺序定为「先补牌后结算」，保证卡效果里的检视/排序窗口候选与当前牌堆同源（`rtt-client-server-contract`）。`prelude_play_top` 不动（本来就露出新顶） |
| 2 | `rules.js` `prelude_advance` ACTION→CARDS | **删除** `prelude_run_phase(game)`，只切 `phase` 并写日志提示；卡牌阶段不再自动执行 |
| 3 | `rules.js` `prelude_do_action` 的 `prelude_next` | 点「继续」时 `if (phase===CARDS) prelude_run_phase(game)` 执行「弃光手牌→摸 2 张」，再 `prelude_advance` 轮转 |
| 4 | `rules.js` `PRELUDE_OP_WINDOW` / `prelude_discard_one`（新） / `prelude_apply_op_choice` | 登记 `discard_prelude_hand: 'card'`；新增 helper 弃指定手牌 + 弃牌堆顶；card 窗口答复执行它 |
| 5 | `rules.js` `prelude_do_action` 的 `prelude_discard_1_1` | ① 牌库或手牌空 → 服务端拒绝；② 手牌 >1 且未给 `arg.card` → 建 `p.op_window`（候选 = 手牌，`keep_action:true`）等玩家点卡；③ 选完弃指定牌 + 弃牌堆顶，**留在 ACTION 再行动一次**；④ 牌库+手牌皆空 → 跳过该国 |
| 6 | `rules.js` `build_actions` 前奏分支 | `prelude_discard_1_1` 只在 `(hands[pn].length && decks[pn].length)` 时下发（双门禁同源） |
| 7 | `rules.js` `prelude_answer_op_window` | 答完 op 窗口后：`keep_action` → 留在 ACTION；牌库+手牌皆空 → 跳过该国；否则正常推进 |
| 8 | `rules.js` `prelude_advance` CARDS 轮转 | 轮转逻辑包进**带 `guard < ORDER_OF_NATIONS.length` 的循环**，遇到「牌库+手牌皆空」的国家跳过继续找下一个；每跳过一国仍计 `nations_done`，轮末结束条件②照常触发 |
| 9 | `play.js` | 「继续」文案改为「弃光手牌 → 摸 2 张，进入下个国家」；`update_prelude_hand_zone` 识别弃牌窗口，手牌卡片改为回传 `prelude_op_pick {pick}`，牌堆顶卡片置灰，标题提示选牌 |
| 10 | `play.html` | 版本串 `20261112h → 20261112i`（7 处） |
| 11 | `tools/_real_test_P11_play_flow.js`（新） | 27 项编号真实测试；P2 C/E 组、P7 D 组断言按乙口径更新 |

**零改动**：响应栈核心、四套 `PRELUDE_*` 表、`cards.js`、前奏手牌区真实卡图渲染逻辑。

## 3. 排查中发现的连带问题（本轮顺带修正）

把补牌放在 `prelude_resolve_card` **之后**时，`18300` 等带 `peek_reorder` 的卡会先按旧牌堆算出候选、随后补牌把顶牌取走，出现「候选里的牌已不在牌堆」。改为**先补牌后结算**后候选与牌堆同源，P7 排序测试按新牌堆更新断言。

## 4. 挂起项（本轮未修，按约定单独一条）

`14900` 的 A 段 `play_prelude` 会连锁打出第二张手牌，两次 `prelude_resolve_card` 都写 `p.pending`，日志出现两次「等待决定是否支付后续段代价」—— **前一个段窗口被覆盖丢失**。这是独立 bug，与本次乙口径无关，单独挂起待玩家指令。

## 5. 部署

改了 `rules.js` → **必须硬重启 8091**；`play.js`/`play.html` 为静态资源，刷新即生效。对局状态在 db，重启后可继续。

## 6. 验证与回归

- `_real_test_P11_play_flow.js` **27/0**：A 补牌/新顶、B 手动卡牌阶段、C 选牌弃 1+1 与再行动、D 两种「不可选」、E 两种「跳过」、F 静态守卫与客户端。
- 前奏十一套 68/37/41/25/25/33/28/24/19/19/27 全过（P2 由 41→43 项、新增乙口径断言）；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过。
- `test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。

## 7. 接线点索引

| 符号 | 作用 |
|---|---|
| `prelude_do_action` 的 `prelude_play_hand` | 补牌唯一实现点；顺序「先补牌后结算」不可随意调换 |
| `prelude_advance` ACTION 分支 | 卡牌阶段「只切不跑」的唯一约束 |
| `prelude_do_action` 的 `prelude_next` | 卡牌阶段「点继续才跑」的唯一实现点 |
| `prelude_discard_one` / `discard_prelude_hand` 窗口 | 弃 1+1 选牌与执行 |
| `p.op_window.keep_action` | 弃 1+1 后留在 ACTION 再行动一次的开关 |
| `prelude_advance` CARDS 轮转的 `while (guard++ < ...)` | 跳过空国 + 防死循环 |
| `build_actions` 的 `prelude_discard_1_1` 条件 | 可用性双门禁，改条件要同步服务端拒绝分支 |
| `tools/_real_test_P11_play_flow.js` | A–F 六组 27 项验收 |

## 8. 后续修改指引

1. **挂起项**：连锁打牌覆盖 `p.pending` —— 修时应把后续段窗口排队而非覆盖，参考 `afterSegs` / `pendingOps` 的排队范式。
2. 「打出牌堆顶」目前不补手牌（打出的就是牌堆顶）；若玩家要求也补，改 `prelude_play_top` 分支并同步 P11 A 组断言。
3. 结束条件①现在在「点继续 → 当前回合结束」时判定；若规则要求「打牌瞬间」判定，需把 `check_prelude_end(game,false)` 前移。
4. 包：`20261112a` 两个 zip 仍是旧产物，代码经 P11 已 `20261112i`；按玩家要求「打包等前奏基本完成后再说」。
