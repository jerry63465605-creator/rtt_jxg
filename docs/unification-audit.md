# 统一化审计报告（rules.js / play.js）

> 建档：2026-10-23。状态：**审计完成，待逐项讨论决策**。
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

---

### D4 · 阶段 key 常量 —— 231 处

**现状**：`'resource' / 'play' / 'airforce' / 'supply' / 'scoring' / 'discard' / 'draw'` 字面量 231 处（`rules.js` 185 + `play.js` 46）。拼错不会报错，只表现为"某阶段行为失效"。

**方案**：`PHASES` 已有定义（`rules.js` 顶部），改为 `PHASES.PLAY.key` 或独立常量 `PH_PLAY = 'play'`。纯机械替换 + 全量测试。

**待定问题**
- Q4.1 用 `PHASES.*` 对象引用，还是抽成 `PH_*` 字符串常量？（前者自文档化，后者替换更安全）
- Q4.2 `play.js` 的 46 处是否同批改？（前端与服务端同源更安全）

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
| D1 日志前缀 | 待定 | | |
| D2 refresh 兜底 | 待定 | | |
| D3 移除部队 | 待定 | | |
| D4 阶段 key | 待定 | | |
| D5 手牌原语 | 待定 | | |
| D6 连通性标注 | 待定 | | |
| D7 计数迁移 | 待定 | | |
| D8 挂起清理 | 待定 | | |
