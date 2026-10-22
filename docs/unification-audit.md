# 统一化审计报告（rules.js / play.js）

> 建档：2026-10-23。状态：**D1–D8 全部结项**（D1 修缺陷 / D2 跳过 / D3 阶段 A / D4 完成 / D5 批 1+冻结 / D6 完成 / D7 部分+冻结 / D8 跳过）。
> 起缘：`de_units_near` 缺国别过滤（15218/15219/15220/15223 四个 bug）暴露了"同一件事有多种写法"的隐患。
> 本文是所有候选的统一方案底稿，每项讨论完把结论填进 §7 决策表。

---

## 0. 判据：什么才算"该统一"

三条**同时**满足，否则只是风格偏好，不动：

1. **同一语义有 ≥3 种写法**（或 ≥10 处手写）
2. **写法差异会导致"漏参数 / 漏副作用"的 bug**，而不是长得不一样
3. **统一后能被测试锁死**（否则改完无法验证）

反例（明确不做）：

| 项 | 为什么不做 |
|---|---|
| 几何邻接 vs 阵营连通 | 是**两种语义**，不能合并（只能加标注，见 D6） |
| `data.name_of` 239 次 | 单次 0.1 µs，反查名字是正常用法 |
| `faction_of_nation` 334 次 | 调用量大正说明**已统一**，是好事 |
| `inst_card_id` 106 次 | 已统一，只剩 3 处 `split('#')` |

---

## 1. 排查方法（三个脚本）

| 脚本 | 作用 | 关键输出 |
|---|---|---|
| `audit_dup.js` | 28 类可疑模式的频次统计 | 「这个写法有多普遍」 |
| `audit_where.js` | 把命中点**按所在函数聚类** | 行号 + 函数名 + 片段 →「这处是否绕过了统一函数」 |
| `audit_perf.js` | 调用频次 + 单次耗时 | 判断能否「自动统一到入口」（成本必须可忽略） |

核心是 `audit_where` 的**按函数聚类**：只看总数没有意义，要看"哪些函数在重复实现同一件事"。

> 现状：三个脚本目前是临时文件，讨论通过后落到 `tools/audit_*.js`（见 §5）。

---

## 2. 全量扫描数据（2026-10-23 实测）

`rules.js` 29,573 行 / 957 KB；`play.js` 9,396 行 / 282 KB。

| 模式 | 命中 | 判定 |
|---|---:|---|
| `faction_of_nation(` | 334 | ✅ 已统一 |
| 阶段 key 字面量（`'play'`/`'resource'`…） | 231 | ⚠ D4 |
| `log.push('【' + …)` | 148 | ⚠ D1 |
| `send_action(` | 138（play.js） | ✅ 前端发动作，正常 |
| 国名比较 `=== '德国'` | 127 | 逐类判定（见 D6 附） |
| `refresh(game)` | 109 | ⚠ D2 |
| `inst_card_id(` | 106 | ✅ 已统一 |
| `pieces_on(` | 98 | ✅ 基础原语 |
| 国名作参数传参 | 94 | ✅ 正常 |
| `piece_type ===` | 78 | ⚠ D7 |
| `piece_nation ===` | 71 | ⚠ D7 |
| `get_connections(` | 66 | ⚠ D6 |
| `discard_card(` | 43 | ✅ 已统一 |
| `pending_* = null` | 41 | ⚠ D8 |
| `compute_supply(` | 36 | 见 D2 |
| `hands[x].splice` | 33 | ⚠ D5 |
| `add_axis_score(` | 27 | ✅ 已统一（`score.axis=` 直赋仅 1） |
| `.connections` 直读 | 24 | ⚠ D6 |
| `delete game.location[` | 16 | ⚠ D3 |
| `try/catch 空捕获` | 9 | 顺手改，不立项 |
| `remove_piece(` | 6 | ⚠ D3 |
| 手写遍历 `game.location` | 4 | ✅ 基本收敛 |

### 性能基线（决定"能否自动化"）

| 调用 | 单次耗时 |
|---|---|
| `compute_connections` | **17.6 µs** |
| `compute_supply` | **27.4 µs** |
| `space_id('北欧')` | 0.1 µs |
| `JSON.stringify(game)` | 67 µs |
| `rollback_pack`（每步检查点） | 334 µs |

整局 JSON 11.7 KB；单步检查点 3.17 KB。

---

## 3. 候选清单（按建议实施顺序编号）

### D1 · 日志前缀统一 —— 148 有前缀 + 247 无前缀

**现状**：两种写法各占一半

```js
game.log.push('【' + nation + '】打出《…》')          // 148 处（有前缀）
game.log.push('【' + (game.current_nation || '?') + '】…')  // 少数带 || 兜底
game.log.push('开局状态：…')                          // 247 处（无前缀，系统提示为主）
```

**危害**：行动记录（history）的 `label` 是从「该步第一条日志去掉 `【…】` 前缀」得来的（`record_action_history`）。前缀有无不一致 → 历史摘要忽长忽短，有的条目把国家名也带进去；玩家看日志时也无法一眼分出"谁做的"与"系统播报"。

**风险实测**：40 个 smoke 里，只有 **4 个文件、4 处**断言依赖 `【】` 文本（`_smoke_15328_attacked`、`_smoke_15352`、`_smoke_15353`、`_smoke_remove_ask`）→ 改动风险极低。

**统一目标**（只统一前缀拼接，不动正文一个字）：

```js
function log_nation(game, nation, msg) { game.log.push('【' + (nation || '?') + '】' + msg) }
function log_side(game, side, msg)     { log_nation(game, side === ALLIES ? '同盟国' : '轴心国', msg) }
function log_plain(game, msg)          { game.log.push(msg) }   // 系统播报，明确无前缀
```

**待定问题**
- Q1.1 是否接受「正文一字不改、只改前缀拼接」的保守做法？（推荐：测试几乎零影响）
- Q1.2 那 247 处无前缀日志怎么分类？建议三档：
  - 有明确归属国 → 补 `log_nation`（如"德国已收回部队"）
  - 多国/阵营级 → `log_side`
  - 纯系统播报（开局、警告、回合开始）→ `log_plain` 并统一加 `【系统】` 之类标识？还是保持裸文本？

### D1 补充：实测出的 3 个真实缺陷（2026-10-23）

> 讨论中玩家质疑"这步修改的意义"，故补测。**它不满足判据②（不防规则 bug）**，
> 但下面 3 处是玩家可见的显示缺陷，属于"显示正确性"而非"防 bug"。

**缺陷 1 · 阵营 key 泄漏进中文日志**（`rules.js:24489` / `24492`）

```js
game.log.push(side + ' 补给阶段【' + nation + '】：全部部队均处于补给状态')
```

`side` 是小写阵营 key → 玩家看到「**axis 补给阶段【日本】：…**」。
现成的 `side_label(side)`（21280，回退功能里已加）返回"轴心国/同盟国"，直接可用。

**缺陷 2 · 同一句话手工拼三元 + 多一个空格**（`toggle_ask_remove`）

```js
game.log.push((side === ALLIES ? '同盟国' : '轴心国') + ' 的"收回部队"已' + …)
// 输出：轴心国 的"收回部队"已开启  ←「的」前多一个空格，且没有【】包裹
```

**缺陷 3 · 历史摘要取决于"首行日志恰好带没带前缀"**

实测（合法参数驱动 154 个动作 / 120 条历史）：**首行带 `【国家】` 前缀的只有 56 条（47%）**。
不干净的条目按 action 归类主要是：

| action | 条数 | 摘要样例 |
|---|---:|---|
| `resolve_battle` | 10 | 当前没有等待结算的战斗（多为无效动作，随机驱动造成） |
| `toggle_ask_remove` | 10 | 轴心国 的"收回部队"已开启 ← **真实动作** |
| `resolve_supply` | 9 | axis 补给阶段【日本】：全部部队均处于补给状态 ← **含缺陷 1** |
| `next_nation` | 9 | axis 行动国交替为：苏联（操作权交给 Allies） ← 同样泄漏 key |
| `play_card` | 9 | 无效的卡牌（随机驱动传错参） |

**结论：范围应缩小。** 不需要改 148 处，只改「**动作成功后的第一条日志**」（会进历史的那些，约 30–50 处）+ 修上面 3 个缺陷；其余 100 多处错误提示类日志保持原样（它们不进历史，也不会被玩家当动作看）。

**修正后的工时**：约 40 min（原估 1 h）。

**待定问题（修正）**
- Q1.3 是否接受这个缩小版：只覆盖"成功动作的首行日志" + 修 3 个缺陷？
- Q1.4 `next_nation`（`axis 行动国交替为：…（操作权交给 Allies）`）两处 key 泄漏是否同批修？

---

### D2 · `refresh(game)` 入口兜底 —— 109 处

**现状**：每次改动盘面（部队位置/存活）后手动调 `refresh(game)` 重算 `limited_connections`。109 处，漏一处就是"连通缓存过期"（难查、表现为海峡/相邻判定莫名不对）。

**实测成本**：`compute_connections` 17.6 µs/次 → 每步 action 多 17.6 µs，可忽略。

**方案**：**保留现有 109 处**（它们保证动作中途的中间态也正确），在 `exports.action` wrapper 的 `finally` 里兜底再调一次：

```js
finally {
  delete game._in_action
  try { refresh(game) } catch (e) {}          // 兜底，重复调用是幂等的
  ...
}
```

**待定问题**
- Q2.1 是否接受"双保险"（不删现有调用）？删掉中间调用有风险（战斗链中途要用连通性）。

---

### D3 · 移除部队收口 —— 16 处（**唯一已在产生缺陷的项**）

**现状**：`delete game.location[p]` 16 处，分散在 8 个函数：

```
 6  make_counter_pending     ← 自己拼了一遍"移除+计数+响应"
 2  econ_remove_piece
 2  eliminate_piece
 1  seize_air
 1  resolve_supply
 1  compute_supply          （断补移除，语义特殊）
 1  remove_piece            （本体）
 1  do_action
```

**证据**（`rules.js:17951`，空军代受+抵消）：

```js
delete game.location[defend_air]
delete game.location[counter_air]
note_removed(game, dfAirNation, 1)
note_removed(game, ctAirNation, 1)
if (is_protected(game, victim)) { … } else {
    delete game.location[victim]
    axis_pact_register(game, nation, space, victim)
    total_war_attrition(game, [{ nation: rmvNationC, type: rmvTypeC }])
    request_responses(game, 'piece_removed', { … })
}
```

这里手工补了 5 个副作用，但**没走 `remove_piece`**。一旦统一函数新增副作用（例：规则七"空军所在地区本国部队被移除后必须调度或移除该空军"），这 6 处必然漏。

**统一目标**：明确三档原语，其余全部改调

| 原语 | 语义 | 现有副作用 |
|---|---|---|
| `remove_piece(game, nation, piece)` | 玩家主动收回 | 校验归属、清 location、refresh、日志 |
| `eliminate_piece(game, piece, opts)` | 被消灭（战斗/卡牌） | 上面 + `note_removed` + 保护判定 + 总体战 + `axis_pact_register` + `request_responses('piece_removed')` + 空军连带 |
| `remove_piece_by_attrition(game, nation, piece)` | 断补移除 | 只计数 + 日志，不触发响应 |

**待定问题**
- Q3.1 `compute_supply` 内部那 1 处（断补）保持原样、不接入递归（推荐）？
- Q3.2 空军连带规则（地区内本国部队被移除后，空军必须调度/移除）现在**是否已实现**？若没有，这就是要补的副作用，D3 会顺手带上（需单独加测试）
- Q3.3 `econ_remove_piece` 是否等价于 `eliminate_piece`（经济战移除是否触发 `piece_removed` 响应）？

### D3 取证（2026-10-23）：副作用矩阵与已证实的缺陷

**隐含副作用集**（没有任何一处文档/函数完整定义过，全靠各实现"照抄自己需要的几条"）：

| 副作用 | 作用 |
|---|---|
| `note_removed` | 17512《战俘》本回合被移除计数 |
| `total_war_attrition` | 15216《总体战》陆军被移除→其所有者损耗 1 |
| `axis_pact_register` | 17749 轴心协定击杀信用 |
| `is_protected` | 15334 驱逐舰等"本回合不可被移除" |
| `request_responses('piece_removed')` | 事后还原类响应卡 |
| `offer_armed_effects('piece_removed')` | 15311 马奇诺等增强卡 |
| `refresh` | 连通缓存 |

**16 处实现对照**：

| 行 | 函数 | 覆盖的副作用 | 判定 |
|---|---|---|---|
| 826 | `compute_supply` | 无 | ✅ 虚拟陆军注入/清理，故意 |
| 873 | `resolve_supply` | is_protected, request_responses, refresh | ⚠ 缺 total_war |
| 2812/2813 | `econ_remove_piece` | request_responses, refresh | ⚠ 缺 total_war / note_removed / axis_pact |
| 7908/7912 | `eliminate_piece` | note_removed, axis_pact, request_responses, refresh, armed | ⚠ 缺 total_war |
| 11668 | 17708 意空军（对象方法） | 仅 refresh | ⚠ 缺 note_removed（口径待定） |
| 17951/17952/17961 | `do_battle_inner` | 全部 7 项 | ✅ 但为**手工实现**，与 eliminate 重复 |
| 18032/18075/18127 | `do_battle_inner` | 全部 7 项 | ✅ 同上 |
| 18266 | `seize_air` | axis_pact, refresh | ⚠ 缺 note_removed（口径待定；空军不触发总体战正确） |
| 19564 | `remove_piece`（玩家主动收回） | request_responses, refresh | ✅ 主动收回不计数，合理 |
| 24455 | `do_action` 强制移除路径 | is_protected, request_responses, refresh, →remove_piece | ✅ |

**已证实缺陷 · 15216《总体战》漏 3 条路径**

卡面：「出牌阶段开始时：本回合内，**陆军被移除后**，其所有者损耗 1 张牌。」（无"战斗中"限定）

`total_war_attrition` 全库只有 **2 个调用点**，都在 `do_battle_inner`（17965、18078）。故：

| 路径 | 是否触发 |
|---|---|
| 战斗中被消灭（陆战/海战代受） | ✅ |
| 卡牌效果"消灭该陆军"（`eliminate_piece`） | ❌ **实测不触发** |
| 断补移除（`resolve_supply`） | ❌ |
| 经济战移除（`econ_remove_piece`） | ❌ |

实验（`eliminate_piece` + 手工注入 `army_removed_attrition` modifier，复刻 `echo_mod_active` 判定为 true）：
英国牌堆损耗 0 张（有/无 modifier 完全一致）→ 确认漏触发。

**待裁定的规则口径 · 17512《战俘》**

卡面：「计分阶段开始时：本回合内每有 1 支**敌方部队被移除**，获得 1 分。」
`note_removed` 目前只覆盖：卡牌消灭、战斗（代受空军/抵消空军/目标）。
**未覆盖**：断补移除、经济战移除、夺取制空权消灭敌空军。
→ 需玩家裁定"被移除"是否包含这三类（字面上包含；若只算战斗击杀则现状正确）。

**待定问题（补充）**
- Q3.4 15216《总体战》是否应覆盖 卡牌消灭 / 断补 / 经济战 三条路径？（我判断应覆盖：卡面无"战斗中"限定）
- Q3.5 17512《战俘》的"被移除"是否包含 断补 / 经济战 / 制空权？
- Q3.6 是否接受"两阶段"：**先补副作用（小改、可测）**，暂不做 6 处 `do_battle_inner` 的结构合并（合并会改变响应触发时序，风险高）？

---

### D4 · 阶段 key 常量 —— 231 处

**现状**：`'resource' / 'play' / 'airforce' / 'supply' / 'scoring' / 'discard' / 'draw'` 字面量 231 处（`rules.js` 185 + `play.js` 46）。拼错不会报错，只表现为"某阶段行为失效"。

**方案**：`PHASES` 已有定义（`rules.js` 顶部），改为 `PHASES.PLAY.key` 或独立常量 `PH_PLAY = 'play'`。纯机械替换 + 全量测试。

**实测修正（2026-10-23）**：原先统计的 231 处是**正则过宽**——把 `reason: 'supply'`、`choice: 'discard'`、
`dg.step === 'play'`、弃牌堆 key 等**非阶段语义**都算进来了。按语境分类后：

| 语境 | 处数 | 处理 |
|---|---:|---|
| `turn_phase` 比较 / 赋值 / 字段（真正阶段语境） | **30** | ✅ 已替换为 `PH.*` |
| `.phase` 比较（`cfg.auto.phase`） | 1（含在上） | ✅ |
| `reason:'supply'` / `choice:'discard'` / `dg.step:'play'` 等 | 124 | ❌ 不是阶段，保持字面量 |
| `play.js` 的 7 处 | 7 | ❌ 全是命令参数/step 名，非阶段 |

**已实施**：新增 `PH` 常量（7 个）+ 替换 30 处 + `_smoke_phase_keys.js`（18 项）做**源码级约定检查**
（禁止在阶段语境写字面量，新增代码也会被拦住）。

**待定问题**
- ~~Q4.1 用 `PHASES.*` 对象引用，还是抽成 `PH_*` 字符串常量？~~ → 定为 `PH.*` 常量对象（自文档化 + 短）
- ~~Q4.2 `play.js` 的 46 处是否同批改？~~ → 实测这 7 处不是阶段语义，不改

---

### D5 · 手牌增删原语 —— 33 处

**现状**：`game.hands[nat].splice(...)` 33 处。典型问题（`rules.js:6005`，租借法案）：

```js
const hi = game.hands[nat].indexOf(card)
game.hands[nat].splice(hi, 1)      // 取出
…
game.hands[nat].splice(hi, 0, card)  // 失败回滚：用旧索引
```

两个问题：① 中途若摸牌，`hi` 偏移 → 插错位置；② 绕过 `discard_card` 的弃牌堆/日志口径。

**统一目标**：

```js
take_from_hand(game, nation, card)   // → { card, index } | null
put_back_to_hand(game, nation, card, index)   // 索引失效时 append
```

**待定问题**
- Q5.1 手牌顺序是否影响任何规则/显示？（若不影响，`put_back` 追加到末尾即可，不必记索引）
- Q5.2 `resolve_us_lend_lease_play` 的 8 处是"取-结算-回滚"模式，是否抽成 `try_play_from_hand()` 高阶封装？（与 RTT 同步直白风格冲突，慎）

### D5 取证与实施（2026-10-23）

**实测修正**：原估"33 处 splice"，实扫是 **85 处手牌写操作 / 26 个函数**，分四类：

| 类型 | 处数 | 说明 |
|---|---:|---|
| 取牌 `splice(i,1)` | 26 | 含 `discard_card` / `take_from_hand` 两个原语本体；其余 23 处**全部有 `indexOf` 校验** |
| 放回 `splice(hi,0,card)` | **7** | 全在 `resolve_us_lend_lease_play`，用**取牌时的旧索引**插回 |
| 给牌 `push` | 12 | 含 `draw_cards` / `put_back_to_hand` / `give_to_hand` 三个本体 |
| 查询 `indexOf` | ~40 | 只读，无副作用 |

**真实风险只有一处**：7 处放回用旧索引 —— 结算过程中若又取走过更靠前的牌，索引左移，插回位置就错了。
（其余 23 处取牌都有校验，功能正确；`rules.js:1078` 那条"卡凭空消失"事故的补丁 `push_discard_direct` 仍在。）

**玩家裁定**：手牌顺序**无规则与显示意义**；`discard_card` 与 `push_discard_direct` **不合并**。

**已实施**
- 3 个原语：`take_from_hand` / `put_back_to_hand`（幂等、一律追加末尾）/ `give_to_hand`
- 批 1：7 处放回 → `put_back_to_hand`，并删掉不再需要的旧索引变量
- `_smoke_card_conservation.js`（19 项）：
  - 原语语义（取/放/给、幂等、重复取返回 null）
  - **卡牌守恒不变量**：`hands+decks+discard+table` 总张数恒定（基线 431）、同一张卡不得出现在两个容器；3 局 × 250 步逐步校验
  - **源码基线冻结**：取牌手写 ≤26、给牌手写 ≤12、"旧索引放回"必须为 0 处

**明确不做（批 2 / 批 3）**：23 处取牌 + 9 处给牌不迁移。理由：它们都有 `indexOf` 校验、功能正确，
迁移只带来一致性收益，却要改 30+ 处高风险位置；改为**基线冻结 + 源码断言**，新增代码必须用原语，
手写数量一上升测试即报警。

---

### D6 · 连通性语义标注 —— 24 处直读

**现状**：`.connections` 直读 24 处 vs `get_connections` 66 处。直读处：`hasArmy`(4)、`can_attrite`、`de_soviet_armies_near_german`、`is_protected`、`fn_adjacent_german_air`、`build_candidate_spaces`、`step_space_candidates` 等。

**判定**：多数**可能是对的**（几何邻接），但代码里没有任何标注，后来者无法判断是"刻意"还是"忘了阵营视角"——15219 那类 bug 就是这么来的。

**方案**：不改语义，只做三件事
1. 每处加注释：`/* 几何邻接：此处【不用】阵营视角，因为… */`
2. 新增 `geometry_neighbors(space)` 包装 `data.spaces[s].connections`，直读处改为调它 —— **名字自解释**
3. `region_spaces({side})` 已在 D7 前置实现，文档里说明两者关系

**待定问题**
- Q6.1 是否接受"只加包装+注释，不改语义"？（推荐：零行为变化的可读性改造）
- Q6.2 国名比较 127 处是否同批分类（哪些该改 `faction_of_nation`，哪些是合法数据）？

### D6 取证与实施（2026-10-23）

**实测**：`.connections` 直读 **24 处 / 12 个函数**，`get_connections` 66 处；
其中 **3 个函数在内部混用两种口径**：`region_spaces`（有意区分）、`get_connections`（本体回退）、
`step_space_candidates`（**业务逻辑，可疑**）。

**口径差异是真实存在的**（初始局面实测，几何 vs 阵营共 **9 处 格×阵营 不同**）：

| 格 | 差异 |
|---|---|
| 东太平洋 (52) | 同盟视角多出**北大西洋**（拉丁美洲海峡默认归同盟） |
| 北大西洋 (53) | 同盟视角多出东太平洋 |
| 波罗的海 (8) | 轴心视角多出**北海**（北欧海峡默认归轴心） |
| 北海 (17) | 轴心多出波罗的海；同盟多出地中海 |
| 地中海 (46) | 同盟多出北海/阿拉伯海 |
| 阿拉伯海 (34) | 同盟多出地中海 |
| 西欧 (6) / 非洲北部 (15) | 轴心视角互相多出 |

**已修 2 处"同函数内口径不一致"**（都有规则依据：easy_rule 八、海峡"对控制方相邻，对另一方不相邻"）：

| 位置 | 原来 | 改为 |
|---|---|---|
| `step_space_candidates` 的 `st.around` 分支 | 几何邻接（而同函数 `useNewPiece` 用阵营视角） | `neighbors_of(game, center, faction_of_nation(effActor))` |
| `build_candidate_spaces` 的 `opt.near` 分支 | 几何邻接（而同函数末尾注释写着"必须带阵营"却用 get_connections） | `neighbors_of(game, center, faction_of_nation(nation))` |

**行为影响面**：

- `around` 分支 → **9 张卡**的候选地区变化（8672/8697 莫斯科、8809 西伯利亚、8937 非洲北部、
  9009/9010 东太平洋、9019 夏威夷、9031 新西兰、9385 大本营相邻）
- `opt.near` 分支 → **死代码**（`build_candidate_spaces` 全库只有 1 处调用且不传 near），零影响

**新增**：`neighbors_of(game, space, side)` 作为邻接查询唯一入口（省略 side = 几何，给出 side = 阵营视角），
注释里写明两种语义、规则依据与实测差异格。

**新增测试**：`_smoke_adjacency_view.js`（12 项）
东太平洋/波罗的海两组正反例、差异格基线（9）、around 分支源码断言、返回类型稳定。

---

### D7 · 棋子计数迁移 —— 71 + 78 处

**现状**：上轮建的 `region_spaces / list_pieces / count_pieces / has_pieces` 只接管了 5 个旧函数定义（`air_piece_count`、`nation_unit_count`、`it_air_pieces`、`su_army_pieces`、`has_piece`），**调用点还没迁**；`piece_nation ===` 71 处、`piece_type ===` 78 处仍是手写。

**危害**：这正是 15218/15219/15220/15223 四个 bug 的温床（漏传国别 = 数到别国部队）。

**方案**：按卡组分批迁移，每批对着卡面复核
- 批 1：德国经济战（15218/15219/15220/15223 已修，迁到新原语）
- 批 2：日本经济战（15414/15416/15417/15409）
- 批 3：美国轰炸 / 半径类（15206/15418/17715/17515-17522）
- 批 4：各国计分卡 / 状态卡

**待定问题**
- Q7.1 是否强制 `list/count/has_pieces` 的归属参数（`nation|nations|faction|enemyOf` 四选一必填，缺省返回 0 + 警告）？（当前实现已是这样，确认保留）
- Q7.2 迁移时是否顺手修掉 D6 里发现的其余口径问题（如 15206 半径、15445 兵种）？

---

### D8 · 挂起清理收口 —— 41 处

**现状**：`pending_* = null` 41 处，12+ 个函数各清各的：`autobahn_resolve`、`suspend_autobahn`、`maybe_resume_autobahn`、`script_clear`、`clear_armed_offer(_for_side)`、`removeArmedWindow`、`finish_su_build_budget`、`buildList`、`respList`、`do_action` 等。

**危害**：pitfalls 里记录最多的一类问题（"窗口凭空消失"、"只在某种出牌顺序下才出 bug"）。

**方案**：`clear_pending(game, kinds, opts)` 统一收口，每次清理统一写一条日志（便于追溯是谁清掉的）；按 pending 类型分 4 批迁移。

**待定问题**
- Q8.1 是否接受"清理必须留痕"（日志）？会显著增加日志行数
- Q8.2 分几批？我建议：armed → script/echo → autobahn/uranus → delegate 系

---

## 4. 建议实施顺序与工时

| 序 | 项 | 处数 | 工时 | 风险 | 能否被现有测试锁死 |
|---|---|---|---:|---|---|
| 0 | 审计工具 + 基线（§5） | — | 40 min | 无 | — |
| 1 | D1 日志前缀 | 148 | 1 h | 极低 | ✅ |
| 2 | D2 refresh 兜底 | 1 | 20 min | 极低 | ✅ |
| 3 | **D3 移除部队** | 16 | 2–3 h | 中 | ✅（需补空军连带测试） |
| 4 | D4 阶段 key | 231 | 1 h | 低 | ✅ |
| 5 | D5 手牌原语 | 33 | 2 h | 中 | ✅ |
| 6 | D6 连通性标注 | 24 | 1–2 h | 低 | ✅ |
| 7 | D7 计数迁移 | ~35 调用 | 3–4 h | 中 | ✅（逐卡） |
| 8 | D8 挂起清理 | 41 | 3 h | **高** | 部分（需新测） |

---

## 5. 防漏机制（比改代码更重要）

1. **脚本落地**：`tools/audit_dup.js`、`tools/audit_where.js`、`tools/audit_perf.js`
2. **基线快照** `tools/audit_baseline.json`：记录每类模式命中数；每次改完跑一次，**命中数上升即报警**（新增代码不得引入新写法）
3. **契约测试** `_smoke_unified.js`：对每个原语做"副作用齐全"断言
   - `remove_piece` → `location` 清空 + `refresh` 已调 + 日志
   - `eliminate_piece` → 上述 + `note_removed` +1 + `request_responses` 已发
   - `count_pieces` → 缺归属参数时返回 0 且写警告
   - `log_nation` → 前缀格式唯一
4. **每批必跑**：模块 40 个 smoke + 仓库 75 个差分（现有流程）

---

## 6. 不建议动的项（留档，避免反复讨论）

| 项 | 结论 |
|---|---|
| 前端 `view.actions` 判断（5 处） | 客户端复制规则极少，风险低 |
| `try/catch 空捕获`（9 处） | 数量少，改为"至少写日志"即可，不立项 |
| `data.name_of` / `space_id` | 0.1 µs 级，不是瓶颈 |
| `_internal` 导出增大 | 测试依赖，可接受 |
| 四套卡牌实现通道（EVENT/ECHO/STATUS/ECON） | 属结构性重构，另立项目 |

---

## 7. 决策记录（逐项讨论后填写）

| 项 | 结论 | 讨论日期 | 备注 |
|---|---|---|---|
| 审计工具落地 | 待定 | | |
| D1 日志前缀 | **只修 3 处缺陷，不做封装** | 2026-10-23 | 已实施 `4b8e8a0`：补给日志/行动国交替/收回部队开关的阵营 key 泄漏与格式问题 |
| D2 refresh 兜底 | **跳过** | 2026-10-23 | 取证结论：现状 0 处漏调（14 个写 location 的函数，12 个有 refresh、2 个是 compute_supply 虚拟陆军故意不调；4 seed×400 步动态检测 0 次不一致；阳性对照有效）。兜底仅"防未来"，收益不足 |
| D3 移除部队 | **阶段 A（补洞）已做，阶段 B（结构合并）延后** | 2026-10-23 | 已实施：`resolve_supply` / `eliminate_piece` / `econ_remove_piece` 三条路径补 15216《总体战》；`_smoke_total_war_paths.js` 14 项。阶段 B 见 §8。17512《战俘》口径（Q3.5）仍未裁定 |
| D4 阶段 key | **已做** | 2026-10-23 | 实测 231 → 真正阶段语境仅 **30 处**（其余 124+7 处是 reason/choice/step 等非阶段语义）。新增 `PH` 常量 + 替换 30 处 + `_smoke_phase_keys.js` 18 项（含源码约定检查，禁止新增字面量） |
| D5 手牌原语 | **部分实施（批 1）+ 基线冻结** | 2026-10-23 | 3 个原语 + 7 处旧索引放回迁移 + 守恒检查器 19 项；批 2/3（23+9 处）因"都有校验、功能正确"改为源码基线冻结 |
| D6 连通性标注 | **已做（并修 2 处口径不一致）** | 2026-10-23 | 实测 9 处 格×阵营 差异；新增 `neighbors_of` 唯一入口；修 `step_space_candidates.around`（影响 9 张卡）与 `build_candidate_spaces.near`（死代码）；`_smoke_adjacency_view.js` 12 项 |
| D7 计数迁移 | **已做（12 处迁移 + 5 处保留）** | 2026-10-23 | 实测"35 处待迁"是误估：原语早已用 86 处、循环手写计数 **0** 处、漏国别高危 **0** 处。真实剩余仅 17 处筛选类：迁 12（含 `home_base_of` 21 调用、`step_space_candidates` 6 调用、17505 P-51）、保留 5（阵营反义×2 / every / occupants 外部传入 / 跨全图扫描）。改前先做 4028 项等价性验证。新增 `_smoke_count_contract.js` 33 项 + `_smoke_count_baseline.js` 5 项。见 `docs/d7-piece-count-migration.md` |
| D8 挂起清理 | **跳过（不做统一收口）** | 2026-10-23 | 实测 60 处清点 / 28 字段，**所在函数体 82% 已有日志**（初版"72% 无留痕"是只看邻近 3 行的错误口径）；按 `rtt-pending-clear-side` 铁律扫描"清理守卫误用 current_nation" **0 处**；无已知 bug。纯收口方案（0 行为变化）中 `pending_battle` 17 处全为 `decided`、按 Q8.1=B 不写日志 → **净收益≈0 而风险>0**。另：静态猜函数名误判率高（抽样 3 处错 2 处）。详见 `docs/d8-pending-clear-status.md`（含重启条件与手工排查法） |

---

## 8. 未来可做事项（Backlog）

> 讨论中被明确"先不做 / 留到以后"的项，写在这里避免遗忘。开工前请重新评估风险。

### B1 · D3 阶段 B：`do_battle_inner` 6 处手工移除的结构合并

**现状**：`rules.js` 的 `do_battle_inner` 里 6 处直接 `delete game.location[...]`（17951/17952/17961/18032/18075/18127 一带），
每条都手工补了 `note_removed` / `is_protected` / `total_war_attrition` / `axis_pact_register` /
`request_responses` / `refresh` —— 与 `eliminate_piece` 高度重复，但**副作用集没有单一出处**。

**目标**：抽出 `destroy_piece(game, { piece, by, reason, space })`，把「移除 1 支部队要做哪几件事」收敛到一处，
让 8 种移除路径（战斗代受 / 抵消 / 正面击杀 / 卡牌消灭 / 经济战 / 断补 / 制空权 / 主动收回）各自只声明"参数差异"。

**为什么现在不做**：合并会改变 `request_responses('piece_removed')` 与
`offer_armed_effects` 的**触发顺序**，而响应栈是已知坑区（见 `rtt-response-stack` skill）。
一旦顺序变了，15330/15334（事后还原）、15311（马奇诺）、16304（中国远征军）等卡的时序都可能受影响，
测试无法完全覆盖。

**前置条件**：先补一组"每种移除路径 × 每种响应卡"的时序快照测试，再动合并。

**预估**：4–6 h + 大量回归。

### B2 · 17512《战俘》的"被移除"口径 —— **已裁定并实施（2026-10-23）**

玩家裁定：卡面「本回合内每有 1 支敌方部队被移除」**包含**断补移除、经济战移除、夺取制空权消灭敌空军。
已实施 `c77af6e`：`note_removed` 补 3 条路径。

### B3 · D8 挂起清理 —— **已决议跳过（2026-10-23）**

D4 / D5 / D6 / D7 已完成或已冻结，D8 也已决议跳过 → **统一化路线（D1–D8）全部结项**。
跳过依据：60 处清点中所在函数体 82% 已有日志、禁用守卫 0 处、无已知 bug，且纯收口方案净收益≈0。
详见 `docs/d8-pending-clear-status.md`（含 4 条重启条件与手工排查方法）。
