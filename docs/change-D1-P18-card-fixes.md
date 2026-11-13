# D1 / P18 逐卡核对：`14905` 洗入 15234、`14907` 无条件检视二选一

> 前置：`docs/change-D1-P17-legacy-pending.md`。玩家逐卡核对反馈两条。

## 1. 玩家反馈与只读核对

### 1.1 `14905 四年计划` 洗入的是 `15234`

| 项 | 实际 |
|---|---|
| 卡面 | 「将 1 张`[枪支与黄油]`洗入正式牌堆。`[紧张度+1]` 打出 1 张前奏手牌。」 |
| 编译产物 | `seg0.refs=['枪支与黄油']`、`steps=[{op:'shuffle_into_deck',n:null}]` |
| 正式卡 `15234` | 名字是 **《枪支或黄油》**（「或」非「与」），`type=EVENT`、`deck=CORE` |
| 旧行为 | `prelude_run_op` 用 `CARDS.find(c => c.name === r)` 查不到 → 记「缺少卡名引用，跳过」，**一张都没洗入** |

### 1.2 `14907 威廉皇帝学会` 无条件检视 10 张、按类型二选一

| 项 | 实际 |
|---|---|
| 卡面 | 「`[紧张度+1]` 检视牌堆前 10 张牌，选择并打出 1 张`[状态卡]` **或 将 1 张牌置入手牌**。」 |
| 旧编译产物 | `peek_reorder{source:formal,n:10,silent}` + `peek_and_play{filter:'状态卡'}` + `join_hand{filter:'状态卡'}` |
| 旧行为 | 候选被筛成**只有状态卡**；答完 `peek_and_play` 还会排队 `join_hand` **额外再取 1 张** |

**同类卡对比**（避免误伤）：`18004 一国建成社会主义`、`17204 振兴公共事业` 卡面只有「选择并打出 1 张[状态卡]」，**没有**「或将 1 张牌置入手牌」→ 应继续只选状态卡。

## 2. 改动清单

| # | 文件 / 符号 | 改法 |
|---|---|---|
| 1 | `rules.js` `PRELUDE_CARD_ALIAS` | 新增配置表 `{'枪支与黄油': 15234}`（卡 id 只在配置出现，逻辑不硬编码） |
| 2 | `rules.js` `prelude_run_op` 的 `shuffle_into_deck` | 先查别名表（`CARD_BY_ID[aliasId]`），再回退按卡名查；日志改用**真实卡名**《枪支或黄油》 |
| 3 | `prelude_compiler.js` 段后处理 | **按结构**收口 14907 的二选一（不写卡 id）：同段有 `silent` 检视 + `peek_and_play` + `join_hand` 时，删 `join_hand`、`peek_and_play.filter=null`、打 `pick_mode='status_play_or_hand'` |
| 4 | `rules.js` `prelude_apply_op_choice` 的 `peek_and_play(formal)` | 新增 `pick_mode` 分流：状态卡 → `game.table` 明置留场「打出」；**其它（含响应卡）→ `game.hands` 加入手牌**；不再额外取牌。P8 原分支保留给 `18004`/`17204`/`18412` |
| 5 | `rules.js` `prelude_run_steps` 的窗口 desc | `pick_mode` 特判：「检视 10 张：选状态卡打出，选其它牌加入手牌」 |
| 6 | `play.html` | **零改动 → 版本串仍 `20261112l`（不 bump）** |
| 7 | 测试 | 新增 `tools/_real_test_P18_card_fixes.js`（21 项）；P7 A·C / P8 A·B 组断言按新口径更新 |

**零改动**：`cards.js` 官方卡面数据、四套 `PRELUDE_*` 产物表结构、P8 按类型留场的原分支、`18004`/`17204` 的过滤语义、响应栈、客户端。

## 3. 为什么按结构而不是按卡 id

「同段 `silent` 检视 + `peek_and_play` + `join_hand`」正是「打出[类型卡] **或** 将 1 张牌置入手牌」的编译形态。实测只有 `14907` 命中；`18004`/`17204` 只有 `peek_and_play` 无 `join_hand`，`18412`/`18010` 的 `join_hand` 不与 `peek_and_play` 同段 → 都不受影响。后续若新增同类「或」结构卡，会被自动收口。

## 4. 验证与回归

- `_real_test_P18_card_fixes.js` **21/0**：A 洗入 `15234#pd*` 实例 + 日志真实卡名 + 无跳过；B 编译层收口 + `18004`/`17204` 不误伤；C 候选 = 前 10 张全部（STATUS/RESPONSE/其它都在）+ 窗口标题；D 选状态卡留场且不多取牌；E 选非状态卡（含响应卡）进正式手牌且不多取牌；F 静态守卫。
- 十八套 68/37/43/25/25/33/28/24/19/21/27/21/20/26/29/33/14/21 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；`test_basic_cards` 288/9、全量冒烟 4 个基线失败（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0；覆盖率 408/408=100%、方括号零遗漏。
- 改了 `rules.js` + `prelude_compiler.js` → 硬重启 8091 + 探活。

## 5. 接线点索引

| 符号 | 作用 |
|---|---|
| `PRELUDE_CARD_ALIAS` | 卡面别名 → 正式卡 id 的唯一配置点 |
| `prelude_run_op` 的 `case 'shuffle_into_deck'` | 洗入执行；别名优先 + 真实卡名日志 |
| `prelude_compiler.js` 段后处理的 `pick_mode = 'status_play_or_hand'` | 二选一收口唯一落点（结构判据） |
| `prelude_apply_op_choice` 的 `op.pick_mode` 分支 | 状态卡留场 / 其它进手牌的分流 |
| `prelude_run_steps` 的 desc 特判 | 选牌弹窗标题 |
| `tools/_real_test_P18_card_fixes.js` | A–F 六组 21 项验收 |

## 6. 后续核对候选

- `14900 德奥合并` B 段「检视牌堆，选择并将 1 张[战略卡]置入手牌」编译层仍漏产出选牌 op，会弹无卡面依据的顶/底 choice 窗口。
- P11 挂起项：`14900` A 段 `play_prelude` 连锁打牌覆盖 `p.pending` 段窗口。
- `14902 建设高速公路` 也是 `[高速公路]` 别名引用（P7 提到），若正式卡名同音不同字，按 `PRELUDE_CARD_ALIAS` 同法补映射即可。

未打包、未提交。
