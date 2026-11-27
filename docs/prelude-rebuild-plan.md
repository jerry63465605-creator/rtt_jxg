# 前奏（Prelude）重做与安全清空手册

> 状态：**准备阶段**（总开关已就绪，尚未删除任何代码）
> 适用：`server-official/public/quartermaster-sub-wars/`
> 最后更新：2026-11-27

---

## 0. 一句话结论

前奏是「**中文卡面文本 → ops → 解释器**」的编译器架构。**24 种 ops + 执行器 + 阶段机**是真资产；
**802 行文本解析 + 三张硬编码补丁表**是要重做的部分。
清空必须**先关后删**，因为前奏与主游戏有 **6 处共享边界**，直接删必然误伤。

---

## 1. 现状分层（约 2,200 行代码 + 11 个测试）

| 层 | 位置 | 规模 | 职责 |
|---|---|---|---|
| 数据 | `cards.js`（`deck/type = PRELUDE/ARMAMENT`）+ `prelude_specs.js`（4 张 DIY） | 421 行 | 元数据 + `text`（**效果唯一来源**） |
| 编译 | `prelude_compiler.js` | **802 行 / 42.7 KB** | 中文卡面 → ops（24 种） |
| 执行 | `rules.js` L1529–L2800 `prelude_*` | **37 函数 / ~1,270 行** | ops 解释器 + 阶段机 + 交互窗口 + 回滚 |
| UI | `play.js` `update_prelude_box` / `_hand_zone` / `_peek_modal` | 3 函数 / ~108 行 + 4 本地变量 | 面板 / 手牌区 / 检视 |
| 测试 | `tools/*prelude*` | 11 文件 / ~105 KB | 编译器 / 引擎 / ops / 回滚 |

数据流：

```
cards.js 的 text
  → prelude_compiler.compile()        （802 行解析 → { ops:[...], trigger:{...} }）
  → prelude_run_steps / prelude_run_op（解释器，调主游戏原子）
  → prelude_run_phase / prelude_advance（阶段机）
  → play.js update_prelude_box（UI）
```

---

## 2. 保留清单（重做时直接沿用）

| # | 内容 | 位置 | 理由 |
|---|---|---|---|
| 1 | **24 种 ops 抽象** | `prelude_compiler.js` + `prelude_run_op` | 前奏语义已基本覆盖，是完备清单 |
| 2 | **ops 执行器**（~430 行） | `prelude_run_steps` / `prelude_run_op` | 直接调用主游戏原子，语义与正式局一致；重写会产生两套规则 |
| 3 | **阶段机** | `prelude_run_phase` / `prelude_advance` / `prelude_do_action` | 国别顺序、紧张度、分段推进，逻辑独立且正确 |
| 4 | **跨玩家交互窗口** | `PRELUDE_OP_WINDOW` / `prelude_answer_op_window` / `prelude_answer_segment` / `prelude_ensure_opponent_discard` | 「让对手弃牌」「触发代价」现成能力 |
| 5 | **事件映射** | `PRELUDE_ON_MAP` | 让前奏卡复用 `fire_trigger`，不另造事件总线（正确架构） |
| 6 | **测试脚手架** | `_test_prelude_compiler`（68 项）/ `P2`（43）/ `P3`（25）/ `P15`（29） | 重做后改断言即可复用 |

**24 种 ops**：
`add_marker` `add_reserve` `always_supplied` `attrition_deck` `attrition_prelude` `battle`
`build` `choice_attrition_or_skip` `deploy_air` `discard` `draw_cards` `eliminate`
`end_neutrality` `execute_action_phase` `gain_score` `join_hand` `lose_score`
`peek_and_play` `peek_reorder` `play_prelude` `play_prelude_top` `recruit`
`shuffle_into_deck` `supply_point`

---

## 3. 建议重做清单

| # | 内容 | 问题 |
|---|---|---|
| 1 | `prelude_compiler.js` 的文本解析（802 行） | 表达力天花板就在这里 |
| 2 | 三张硬编码补丁表：`PRELUDE_CARD_ALIAS` / `PRELUDE_FILTER_TYPE` / `PRELUDE_ON_MAP` | 每张新卡都可能往里加一行 |
| 3 | `update_prelude_box`（L1561-1766，单函数约 200 行） | 一个函数做太多事 |
| 4 | `prelude_specs.js` 的 4 张 DIY 试作 | 若 DIY 重做可直接废弃 |

**架构建议**：重做时**别再走「中文文本 → 编译」**，改成**声明式 ops 直写**：

```js
{ id: 15401, ops: [
    { op: 'attrition_deck', nation: '苏联', n: 1 },
    { op: 'recruit', nation: '德国', space: '乌克兰' },
] }
```

编译器保留为**老卡迁移工具**（`coverage()` / `renderSpecs()` 现成）。

---

## 4. 安全清空清单

### 4.1 可安全删除

| 范围 | 具体 |
|---|---|
| 服务端 | `rules.js` L1529–L2800：39 个 `prelude_*` 函数 + `PRELUDE_*` 常量/表（`SCENARIO`/`TENSION_MAX`/`PHASE`/`SPECS`/`COMPILER`/`ON_MAP`/`OP_DEFERRED`/`OP_WINDOW`/`FILTER_TYPE`/`CARD_ALIAS`）+ `game.prelude` 字段 + `prelude_do_action` 分发 |
| 客户端 | `play.js`：`update_prelude_box` / `update_prelude_hand_zone` / `update_prelude_peek_modal` + `prelude_opponent_discard_sel` / `prelude_trigger_cost_sel` / `prelude_peek_sel` / `prelude_peek_key` |
| 数据 | `prelude_specs.js`、`prelude_compiler.js`（若连编译器一起换） |
| 测试 | `tools/*prelude*` 共 11 个文件 |
| 卡 | `cards.js` 里 `deck ∈ {PRELUDE, ARMAMENT}` 的卡 |

### 4.2 ⚠️ 绝对不能删（6 处共享边界）

| 项 | 为什么不能删 |
|---|---|
| `build_piece` / `can_build_at` / `can_deploy_air` / `air_host_check` | 前奏 `recruit`/`build`/`deploy_air` 与正式局**共用** |
| `attrition_passive` / `discard_card` / `draw_cards` / `eliminate_piece` | 同上 |
| `facedown_response` / `table_responses` / `fire_trigger` / `request_responses` | 前奏暗置（`prelude_facedown`）复用**主游戏响应栈** |
| `resolve_event_card` / `RESPONSE_EFFECTS` / `ECON_CARDS` / `STATUS_EFFECTS` | 前奏卡的 `carrier` 语义最终落到这些通道 |
| `gain_score` / `lose_score` / `register_modifier` | ops 调用，正式局也调用 |
| `_run_all_tests.js` / 冒烟清单 | **删前奏测试后必须同步移除条目**，否则整个回归跑挂 |

### 4.3 已知「死字段」（重做时别再留）

`prelude_specs.js` 里的 **`carrier`**（event/response/econ/status）——
`rules.js` 里**没有任何地方消费它**（只有 2 处无关的 `carrier` 字样）。要么正式用起来，要么删掉。

---

## 5. 清理顺序（先关后删，每步一个提交）

### 第 0 步（已完成 ✅）：总开关

`game.options.prelude === false` 可**强制关闭**（即使 `scenario = 'Episode 2'`）：

```js
prelude: (options && options.prelude === false)
    ? false
    : (scenario === PRELUDE_SCENARIO || scenario === PRELUDE_SCENARIO_SOLO_DE || !!(options && options.prelude)),
```

关闭后：`prelude_on()` 恒 `false`、不建前奏牌堆、不走前奏阶段骨架、客户端 `view.prelude.enabled = false`。

**实测**（2026-11-27）：

| 场景 | `prelude.enabled` | 建牌堆 | 能否正常开局 |
|---|---|---|---|
| `Episode 2` | true | ✓ | ✓ |
| `Episode 2` + `{prelude:false}` | **false** | ✗ | ✓（推进到 play 阶段正常） |
| `Standard` | false | ✗ | ✓ |

### 第 1 步：全局关闭，观察

- 所有测试/对局用 `prelude:false` 或普通场景
- 跑：`test_basic_cards` / `_run_smoke_report` / `_run_all_tests` / 前奏 8 套（此时应仍全过，因为代码未删）
- **目的**：确认「关掉前奏后正式局零影响」，暴露所有隐性依赖
- 若发现正式局功能依赖前奏字段（例如某条 `view` 逻辑），在这里就能暴露

### 第 2 步：删客户端 UI

- 删 3 个 `update_prelude_*` + 4 个本地变量 + `update_map()` 里的调用
- 跑回归（服务端还在，客户端不显示：应无影响）

### 第 3 步：删服务端阶段机 + ops 执行器

- 删 `prelude_run_phase` / `prelude_advance` / `prelude_do_action` / `prelude_run_steps` / `prelude_run_op` / 交互窗口
- **同时删** `do_action` 顶部与各处的 `if (prelude_on(game))` 分支
- 跑回归

### 第 4 步：删编译器 + 数据 + 卡

- 删 `prelude_compiler.js` / `prelude_specs.js` / `cards.js` 的前奏卡
- **同步删** `tools/*prelude*` 11 个测试 + `_run_all_tests.js` 里的条目
- 跑回归

### 第 5 步：清理残留

- 删 `PRELUDE_*` 常量、`game.prelude` 字段、`view.prelude` 下发
- 全文搜索 `prelude` 应仅剩注释
- 跑回归 + 打包

---

## 6. 每一步的验证手段

| 层 | 命令 |
|---|---|
| 语法 | `node --check rules.js && node --check play.js` |
| 基本卡 | `node tools/test_basic_cards.js`（应为 288/9） |
| 全量冒烟 | `node tools/_run_smoke_report.js`（应全绿，未登记失败 0） |
| 前奏专用 | `_test_prelude_compiler` / `_test_prelude_diy` / `_test_prelude_hand_zone` / `P2` / `P3` / `P15` |
| 行为等价（重构期） | `tools/_verify_action_split.js`（若涉及 `do_action` 改动） |

---

## 7. 重做时的建议边界

| 保留 | 重做 |
|---|---|
| ops 的**语义**（24 种） | ops 的**来源**（文本编译 → 声明式直写） |
| 执行器 + 阶段机 + 窗口 | 卡面文本 / 硬编码补丁表 |
| 与主游戏原子的调用关系 | 客户端 UI |
| 测试脚手架 | DIY 数据 |
