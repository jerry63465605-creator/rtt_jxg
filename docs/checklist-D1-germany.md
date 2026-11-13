# D1 前奏逐卡验收清单（德国专项）（只读语义审计，2026-11-12）

> 由 `node tools/_audit_prelude_semantics.js` 生成，**只读**，不改产品代码。
> 覆盖率 100% 只保证「卡面文字被识别」，不保证语义正确；本清单按可复核规则列出可疑项供实机验收。
> 行号会漂移，定位一律用符号名 grep；接线点索引见各 `docs/change-D1-*.md`。

## 一、审计摘要

| 项 | 数 |
|---|---|
| 德国前奏/军备卡 | 25 |
| 高优先级可疑卡 | 4 |
| 中优先级可疑卡 | 0 |
| 无命中（仍需实机抽检） | 21 |

| 规则 | 级别 | 命中 | 说明 | 改哪里 |
|---|---|---|---|---|
| R1 | 高 | 0 | 卡面类型筛选词与「打出」op 语义错位 | `prelude_compiler.js 段后处理（P5 收口）/ PRELUDE_OP_WINDOW` |
| R2 | 高 | 0 | 检视 op 缺合法 source | `PRELUDE_TOKENS.peek_deck / peek_deck_misc + validate` |
| R3 | 高 | 0 | 检视后续 op 缺 peek_scope / source | `prelude_compiler.js 段后处理（source/peek_scope 传播）` |
| R4 | 中 | 0 | 卡面类型筛选词未落到选牌 op.filter | `prelude_compiler.js 段后处理 / PRELUDE_FILTER_TYPE` |
| R5 | 高 | 4 | 段内含递归打牌 op（可能覆盖段窗口） | `rules.js:prelude_resolve_card / prelude_do_action` |
| R6 | 中 | 0 | op 既无 case 也无分步窗口（静默丢弃） | `rules.js:prelude_run_op / PRELUDE_OP_WINDOW` |
| R7 | 高 | 0 | trigger.on 不在 PRELUDE_ON_MAP（军备卡不会触发） | `rules.js:PRELUDE_ON_MAP / prelude_trigger_on_of` |
| R8 | 中 | 0 | 卡面关键词与产物不一致 | `PRELUDE_TOKENS / parse_text / coverage` |
| R9 | 高 | 0 | carrier 与 deck/type 不匹配 | `prelude_compiler.js:infer_carrier` |
| R10 | 中 | 0 | op 缺必要参数（space / refs） | `PRELUDE_TOKENS[].emit / prelude_run_op` |
| R11 | 高 | 0 | 段分类或代价异常 | `prelude_compiler.js:group_segments / compile / validate` |
| R12 | 高 | 0 | 编译层自身报 errors / warnings | `prelude_compiler.js:compile` |

接线集合（从 `rules.js` 源码自动提取）：`prelude_run_op` case 18 类、`PRELUDE_OP_WINDOW` 8 类、`PRELUDE_ON_MAP` 18 个 on、`PRELUDE_FILTER_TYPE` 6 类。

`PRELUDE_OP_DEFERRED` 仍有 10 条 P3 历史残留登记（P4 已把其中 op 全部接线，本审计不把它当作「已接线」依据）。

## 二、高优先级逐卡验收（建议先测这些）

- [ ] `14900` 德奥合并（德国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`[紧张度+1] 打出1张前奏手牌 或 前奏牌堆顶的牌。[弃置1张手牌] 检视牌堆，选择并将1张[战略卡]置入手牌。`
  - 段：seg0:mandatory/1op，seg1:optional/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `14902` 建设高速公路（德国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`将1张[高速公路]洗入正式牌堆。[失去2分] 打出1张前奏手牌。`
  - 段：seg0:mandatory/1op，seg1:optional/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `14903` 进军莱茵兰（德国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`[紧张度+2] 检视前奏牌堆，选择并打出1张[军备卡]。[除非英国弃置2张手牌] 打出1张前奏手牌。`
  - 段：seg0:mandatory/2op，seg1:opponentOptOut/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `14905` 四年计划（德国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`将1张[枪支与黄油]洗入正式牌堆。[紧张度+1] 打出1张前奏手牌。`
  - 段：seg0:mandatory/1op，seg1:mandatory/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」

## 三、中优先级逐卡验收

（无中优先级命中）

## 四、全量逐卡索引（按主 op 分组，供打勾）

### `(无 op)`（1 张）

- [ ] `14919` 西墙（德国）

### `add_marker,recruit`（1 张）

- [ ] `14901` 瓜分捷克斯洛伐克（德国）

### `attrition_deck,gain_score`（3 张）

- [ ] `14915` 轰炸纽约（德国）
- [ ] `14916` 佩内明德研发中心（德国）
- [ ] `14920` 铀工程（德国）

### `attrition_prelude`（1 张）

- [ ] `14906` 秃鹰军团（德国）

### `battle`（4 张）

- [ ] `14909` 88mm 防空炮（德国）
- [ ] `14910` 俾斯麦级战列舰（德国）
- [ ] `14912` 滑翔机突击（德国）
- [ ] `14922` 古德里安（德国）

### `battle,build`（1 张）

- [ ] `14924` 曼施坦因（德国）

### `battle,recruit`（1 张）

- [ ] `14923` 隆美尔（德国）

### `build`（3 张）

- [ ] `14904` 撕毁海军协定（德国）
- [ ] `14911` 合成橡胶（德国）
- [ ] `14921` 装甲掷弹兵（德国）

### `build,eliminate`（1 张）

- [ ] `14913` 继续战争（德国）

### `deploy_air,eliminate`（1 张）

- [ ] `14914` 弗莱雅-维尔茨堡（德国）

### `deploy_air,gain_score`（1 张）

- [ ] `14908` 作战指挥条令（德国）

### `join_hand,peek_and_play,peek_reorder`（1 张）

- [ ] `14907` 威廉皇帝学会（德国）

### `peek_and_play,peek_reorder,play_prelude`（1 张）

- [ ] `14903` 进军莱茵兰（德国） ⚠ R5

### `peek_reorder`（1 张）

- [ ] `14918` 替代物资（德国）

### `peek_reorder,play_prelude`（1 张）

- [ ] `14900` 德奥合并（德国） ⚠ R5

### `play_prelude,shuffle_into_deck`（2 张）

- [ ] `14902` 建设高速公路（德国） ⚠ R5
- [ ] `14905` 四年计划（德国） ⚠ R5

### `recruit`（1 张）

- [ ] `14917` 斯洛伐克军事化（德国）

## 五、已知挂起项（不在本清单里重复）

- `14900` 的 A 段 `play_prelude` 连锁打出第二张手牌时，两次 `prelude_resolve_card` 都写 `p.pending`，**前一个段窗口被覆盖丢失**（见 `docs/change-D1-P11-play-flow-b.md` §4）。
- 含战斗的多步 `defer` 军备卡续打（58 张实测全单段，当前无卡触发）。
- EVENT/ECON 正式牌留场语义、`order` 跨牌堆排序（无现有卡需求）。

## 六、验收后怎么修（归类批量，别逐卡打补丁）

1. 记录三件事：卡 id + 期望行为 + 实际行为（日志/截图）。
2. 按接线点归类：编译层规则 / op 参数 / 执行器映射 / 窗口 kind / `view` 字段 / UI —— 一类问题改一处配置或函数，一次覆盖同组所有卡。
3. 每类落一条编号真实测试 + 分层回归，**不**按卡 id 写 `if-else`、**不**改 `cards.js` 卡面。
4. 一轮只修一类；改完重跑本审计脚本，命中数应下降。

## 七、配套编号测试（分层回归基线）

```
node tools/_test_prelude_compiler.js
node tools/_test_prelude_diy.js
node tools/_real_test_P2_prelude_engine.js
node tools/_real_test_P3_prelude_ops.js
node tools/_real_test_P4_op_windows.js
node tools/_real_test_P5_armament_response_stack.js
node tools/_real_test_P6_semantics.js
node tools/_real_test_P7_inspect_chain.js
node tools/_real_test_P8_formal_play.js
node tools/_test_prelude_hand_zone.js
node tools/_real_test_P11_play_flow.js
node tools/_real_test_P12_visibility.js
node tools/_run_smoke_report.js   # 4 个基线未登记失败 = 零新增
```
