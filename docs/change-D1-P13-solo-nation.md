# D1 / P13 单国前奏验收场景 + 逐国审计清单（2026-11-12）

> 前置：`docs/checklist-D1-per-card.md`。玩家决定「按国家逐个测试」，先测德国。本轮只加**测试入口与清单**，不改前奏规则/引擎逻辑。

## 1. 玩家需求

1. 「在设置中移除除了德国以外的其他国家的全部前奏牌」 —— 让实机对局只跑德国前奏，便于逐卡验收。
2. 「告诉我当前德国前奏有哪些需要特别关注的，可能是一类问题的」。

## 2. 改动清单

| # | 文件 / 符号 | 改法 |
|---|---|---|
| 1 | `rules.js` `exports.scenarios` | 增 `'Episode 2 德国单国'`。创建对局页 `views/create_title.pug` 直接渲染该数组、`POST /create` 无白名单校验 → **无需改模板/服务端表单** |
| 2 | `rules.js` 配置区 | 增 `PRELUDE_SCENARIO_SOLO_DE` / `PRELUDE_SOLO_NATION_DE`（国家名只在配置里，逻辑不硬编码） |
| 3 | `rules.js` `setup` 的 `game.options` | 增 `prelude_solo_nation`：单国场景 → `'德国'`；也支持测试直调 `options.prelude_solo_nation` 换国家；传 `null`/不传 = 恢复正常 6 国。单国场景同时启用 `prelude` |
| 4 | `rules.js` `init_prelude_decks` | `solo` 时只给该国建前奏牌堆，其余 5 国 `decks/hands/discard` 全空；DIY 卡注入同步跳过其它国家 |
| 5 | `rules.js` 开局日志 | 标注「单国验收（仅德国）」与「其余国家牌库/手牌为空（轮转自动跳过）」 |
| 6 | `tools/_audit_prelude_semantics.js` | 增 `--nation=XX` 参数，按国家生成专项清单（`docs/checklist-D1-germany.md` 等，文件名走 `NATION_FILE` 配置）；无参数仍是全 125 张全量清单 |
| 7 | `tools/_real_test_P13_solo_nation.js`（新） | 20 项编号真实测试 |

**零改动**：原 `'Episode 2'` 场景行为（6 国各摸 2 张）、`Standard`、前奏规则与结算逻辑、四套 `PRELUDE_*` 表、`cards.js`、`play.js` / `play.html`。**客户端零改动 → 不 bump 版本串**（仍 `20261112j`）。

## 3. 为什么这样设计

- **不改动现有场景**：十二套编号测试全部用 `R.setup(..., 'Episode 2')`，若直接把「只给德国」设成默认会大面积回归。做成可选场景后零回归。
- **轮转不会卡在空国**：P11 的「牌库+手牌皆空 → 跳过该国」在 6 国循环里正好跳过 5 个空国、第 6 次回到德国，`nations_done` 累积到 6 触发 `turn++`。P13 C 组用真实 action 验证「轮转后仍是德国、`turn+1`、有跳过日志、前奏未误判结束」。
- **测完直接恢复**：创建对局时选回 `'Episode 2'` 即可，不需要回滚代码。

## 4. 使用方式

1. 创建对局页 http://localhost:8091/create/quartermaster-sub-wars → Scenario 选 **`Episode 2 德国单国`**。
2. 德国 25 张官方前奏/军备卡 + 1 张德国 DIY 卡，开局摸 2 张；其余 5 国前奏区显示空块（敌方/友军隐私口径不变）。
3. 换国家测：`node tools/_audit_prelude_semantics.js --nation=日本` 生成该国专项清单；若要实机也只跑该国，改配置区的 `PRELUDE_SOLO_NATION_DE`（以及场景名）或测试直调 `options.prelude_solo_nation`。

## 5. 德国专项审计结果（只读）

`_audit_prelude_semantics.js --nation=德国`：25 张，高 4 / 中 0 / 无命中 21。唯一命中规则 **R5 递归打牌**：`14900`/`14902`/`14903`/`14905`（已知 `14900` 段窗口覆盖挂起项的同源问题）。

按 op 归出的「一类问题」（供实机逐类验收，详见 `docs/checklist-D1-germany.md` §4）：

| 类 | 德国卡 | 关注点 |
|---|---|---|
| 递归打牌 | `14900` `14902` `14903` `14905` | `play_prelude`/`play_prelude_top` 递归 `prelude_resolve_card`，段窗口覆盖 |
| 需选目标的分步窗口 | `14909` `14910` `14912` `14922` `14923` `14924`（battle）、`14904` `14911` `14921`（build）、`14913` `14914`（eliminate/deploy_air） | P4 `piece`/`space` 候选是否同源、放弃出口、答完 ops 是否继续排队 |
| 检视链路 | `14907` `14903` `14918` `14900` | P6 `source`（正式/前奏/弃牌堆）、P7 `peek_scope`、按类型 `filter`、选中后留场/取回手牌 |
| 洗入正式牌堆 + 卡名引用 | `14902` `14905` | `seg.refs` 能否定位卡名、洗入数量与位置 |
| 损耗 + 计分 | `14915` `14916` `14920` `14906` | 计分增减方向、损耗对象（正式牌堆 vs 前奏牌堆） |
| 无 op 卡 | `14919` 西墙 | 军备卡暗置留场（P5），应不执行段效果、不进弃牌堆 |

## 6. 验证与回归

- `_real_test_P13_solo_nation.js` **20/0**：场景入口/状态、只有德国有牌、轮转跳过空国回到德国且 `turn+1`、原 `Episode 2` 六国各 2 张零回归、`options` 可换国家、`Standard` 不启用前奏、静态守卫。
- 十三套 68/37/43/25/25/33/28/24/19/21/27/21/20 全过；B34–B39 六套全过；`test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0。
- 改了 `rules.js` → 硬重启 8091 + 探活。

## 7. 接线点索引

| 符号 | 作用 |
|---|---|
| `exports.scenarios` | 创建页下拉唯一来源；加/删测试场景改这里 |
| `PRELUDE_SCENARIO_SOLO_DE` / `PRELUDE_SOLO_NATION_DE` | 单国验收配置；**换国家只改这两行** |
| `game.options.prelude_solo_nation` | `init_prelude_decks` 的唯一判据；`null` = 全 6 国 |
| `init_prelude_decks` 的 `if (solo && n !== solo)` | 空国置空唯一实现点；与 DIY 注入的跳过条件成对 |
| `prelude_advance` 的跳过空国循环（P11） | 保证单国场景每轮回到该国 |
| `tools/_audit_prelude_semantics.js --nation=XX` | 逐国专项清单生成；`NATION_FILE` 决定输出文件名 |
| `tools/_real_test_P13_solo_nation.js` | A–E 五组 20 项验收 |
