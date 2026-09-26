# 卡牌时点（Trigger）接口

> 版本 v1.0 · 2026-09-25 · 状态：**A 类已实现并接线，B/C 类已定义待接线**
>
> 实现：`server-official/public/quartermaster-sub-wars/rules.js`
> 测试：`tools/test_echo_cards.js`（113 项）
> 相关：`docs/echo-cards.md`（8 张增强卡）、`docs/card-icons.md`（类型图标）

---

## 1. 为什么要先建接口

增强卡(ECHO)、响应卡(RESPONSE)、状态卡(STATUS)都依赖"**时点**"，
而时点种类很多：

- 自己回合的摸牌/计分/空军阶段开始
- 任何人建设部队后、发起战斗后
- 部队被移除时
- 经济战/状态卡被打出时
- 有补给的英国陆军被移除时

**逐张硬编码时机会让逻辑散落各处且互相打架**。
所以统一抽象成三层，各卡只**声明**时点，由框架负责调度。

---

## 2. 时点的两大类（玩家 2026-09-25 明确）

> **A. 涉及【阶段】的时机 = 【自己】的回合**
> 例："摸牌阶段开始时" 指【自己】的摸牌阶段开始
>
> **B. 其余一切 = 【任何人】**
> 例："建设陆军后""经济战被打出时""增强卡打出时""有补给的英国陆军被移除时"

注意：法国卡的 actor 是法国，但阶段仍是**英国**的阶段
（法国委托给英国，`delegate_of_nation('法国') === '英国'`）。

---

## 3. 三层结构

```
┌────────────────────────────────────────────────┐
│ A 类 self    : 自己回合的阶段开始 -> 玩家主动打出 │  ✅ 已实现
│ B 类 any     : 任何人触发的事件  -> 挂起询问     │  ⏳ 已定义，未接线
│ C 类 passive : 被动修正器        -> 查询时过滤   │  🔶 protect 已接线
└────────────────────────────────────────────────┘
```

实测 `PHASES = [resource, play, airforce, supply, scoring, discard, draw]`

---

## 4. 数据结构

```javascript
CARD_TRIGGERS[card_id] = {
    kind: 'self' | 'any' | 'anytime',
    phase: 'draw' | 'scoring' | 'airforce' | ...   // 仅 self
    on: 'build' | 'battle' | 'remove' | 'card' | 'status',  // 仅 any
    filter: (game, ctx) => bool,                    // 可选附加条件
}
```

### 已声明的时点（8 张增强卡）

| id | 卡名 | kind | phase |
|---|---|---|---|
| 15305 | 双十字系统 | self | **draw** |
| 15306 | 英联邦殖民地民兵 | self | scoring |
| 15307 | 自由法国海军 | self | scoring |
| 15308 | 法国空军 | self | **airforce** |
| 15309 | 自由法国陆军 | self | scoring |
| 15310 | 法国外籍军团 | self | scoring |
| 15311 | 马奇诺防线 | **anytime** | — |
| 15312 | 华沙起义 | self | scoring |

---

## 5. A 类：自己回合阶段开始

### 校验 `trigger_ready(game, card_id, nation)`

```javascript
if (kind === 'anytime') return { ok: true }
if (kind === 'any')     return { ok: false, reason: '响应卡由事件驱动，不能主动打出' }
if (kind === 'self') {
    // ① 阶段必须匹配
    if (game.turn_phase !== tr.phase) return { ok: false }
    // ② 行动国必须属于持有国阵营
    if (faction_of_nation(game.current_nation) !== faction_of_nation(nation))
        return { ok: false }
    return { ok: true }
}
```

在 `play_card` 的 EFFECT 分支里调用，失败则拒绝打出。

### 与事件卡的核心差别：不占名额

| | 事件卡 EVENT | 增强卡 ECHO |
|---|---|---|
| 打出时机 | 出牌阶段 | 自己回合的对应阶段 |
| **占出牌名额** | **是**（`mark_play_done`） | **否** |
| 打出后 | 进弃牌堆 | 进弃牌堆 |

两者**共用同一套执行器**（`resolve_event_card` + `card_effect_of` 分发），
差别只在时点与名额。

---

## 6. B 类：任何人触发（**本期只定义，未接线**）

```javascript
function fire_trigger(game, on, ctx)   // 返回可响应的卡 id 列表
```

触发事件 key：

| key | 触发源 | 将来用到它的卡 |
|---|---|---|
| `build` | `build_piece` | 15331、15335、12503、12504 |
| `battle` | `do_battle` | 15336、15346 |
| `remove` | 断补结算/消灭/战斗 | 15330、15332、15334、15337 |
| `card` | `play_card` | 15329（经济战）、15333（英国卡生效） |
| `status` | 状态卡发动 | 15328 |

**接线方式（将来做响应卡时）**：
在上述函数里调用 `fire_trigger()`，若返回非空则挂起询问
（`game.pending_trigger`），复用 `pending_battle` 那套
"挂起期间只放行响应动作"的全局守卫。

---

## 7. C 类：被动修正器

修正器**不是事件**，而是**查询时的过滤条件**。

```javascript
game.modifiers = [
    { key, nation, types, spaces, untilTurn, card }
]
```

| 函数 | 作用 |
|---|---|
| `register_modifier(game, mod)` | 注册 |
| `prune_modifiers(game)` | 清掉过期（回合推进时调用） |
| `has_modifier(game, key, piece)` | 查询某支部队是否受该类修正 |
| `is_protected(game, piece)` | `has_modifier('protect')` 的便捷封装 |

### 已接线：`protect`

`resolve_supply()` 的移除循环里：

```javascript
if (is_protected(game, pid)) {
    protectedIds.push(pid)
    continue        // 不被移除
}
```

被跳过的部队记录在 `resolve_supply.last_protected`（供 UI/日志用）。

### 待接线（状态卡/响应卡时再接）

| 修正器 | 挂载点 | 卡 |
|---|---|---|
| `always_supply` | `compute_supply` | 15346 |
| `status_immune` | 状态卡生效 | 15343 |
| `score_bonus` | `phase_scoring` | 15340 |

---

## 8. 新增的两个 op

### `protect`

```javascript
{ op:'protect', nation:'法国', types:['army'], spaces:[6], until:'turn' }
```

`until:'turn'` = 到本回合结束（回合推进时 `prune_modifiers` 清掉）。

### `peek_reorder`

```javascript
{ op:'peek_reorder', target:'德国', count:2 }
```

两步交互：
1. 随机挑 `count` 张对手手牌 → 写入 `game.peek`，返回 `pending` 等玩家
2. 玩家提交 `arg.order`（这 N 张的排列）→ 按该顺序压到对手**牌堆顶**

校验：`order` 必须是刚挑出的那几张（排序后比对），否则拒绝。
压栈用 `unshift` 逆序，保证 `order[0]` 在最顶。

---

## 9. 踩坑

### 配置里的 `const` 有 TDZ

`ECHO_EFFECTS` 里调用 `space_ids_of()`，而它依赖 `const PLACE_ALIAS`。
若把 `ECHO_EFFECTS` 放在 `PLACE_ALIAS` **之前**，会抛：

```
ReferenceError: Cannot access 'PLACE_ALIAS' before initialization
```

**约定**：凡在配置里调用 `space_ids_of()` 的表，
都必须放在 `PLACE_ALIAS` 定义**之后**（`EVENT_EFFECTS` 同理）。

### 测试里改了共享状态要还原

我在用例里把 `g.turn_phase` 改成 `scoring` 验证增强卡，
没还原 → 后面"状态卡配额"用例在 scoring 阶段跑，行为变了，报错。

**约定**：测试里改 `turn_phase` / `current_nation` 等共享状态，
块结束前必须还原。

---

## 10. 测试（`tools/test_echo_cards.js`，113 项）

| 组 | 内容 |
|---|---|
| 1 | **8 张卡面文本已更正**（逐字对照 GLM 读图结果） |
| 2 | 配置与时点声明完整（8+8） |
| 3–4 | 时点校验：错阶段被拒、对阶段可打、非本方回合被拒、**不占名额** |
| 5–9 | 逐张验证（弃牌代价、地区候选、actor 国籍） |
| 10 | **马奇诺防线 protect**：受保护/不受保护（地区·国籍·军种）、跨回合失效、anytime |
| 11 | **双十字系统 peek_reorder**：随机挑牌、排序压栈、不一致被拒、无手牌失败 |
| 12 | 时点语义：涉及阶段=自己回合、响应卡不能主动打 |
| 13 | `fire_trigger` 本期无接线 |
| 14 | 事件卡不受影响（回归） |

全量回归 **1004 项 0 失败**：
`basic 297` · `supply 36` · `neutral 89` · `dynamic 96` ·
`counter_air 80` · `event 199` · `echo 113`

---

## 8. 响应卡 UI 设计（2026-09-25 待实现，第 3 步）

> 参考 **pog 的 CC 战斗卡持续生效时的 UI 方式**——
> 玩家 2026-09-25 明确："暗置（背面向上）的响应卡，
> 其他人可以看到卡背有几张，而拥有者能看到实际卡。"

### 8.1 数据可见性

服务端 `view.table_responses` 已做阵营过滤（rules.js 5162-5175）：
- **本方阵营**的响应卡：暴露 `{card_id, instance_id, name, owner_side}`
- **对方阵营**的响应卡：不返回（在 view 里不可见）

所以客户端拿到的就只有本方响应卡的对象数据，
对方响应卡在客户端**根本不存在**——需要单独暴露"对方有几张"的计数。

### 8.2 暴露对方响应卡数量的方案

在 `view` 里加一个**仅数量**的字段：
```js
opponent_response_count: (game.table_responses || [])
    .filter(r => r.owner_side !== side).length
```
不暴露任何卡 id / name，只给数字，让客户端渲染"对方有 N 张暗置响应卡"。

### 8.3 客户端 UI 渲染（参考 pog CC 卡）

桌面响应卡区（建议放在 #table_cards 区域旁边或下方）：

```
本方响应卡区                  对方响应卡区
┌────┬────┬────┐             ┌────┬────┐
│ 卡 │ 卡 │ 卡 │             │ ?  │ ?  │
│ 牌 │ 牌 │ 牌 │             │ ?  │ ?  │
│ 正 │ 正 │ 正 │             │ 背 │ 背 │
└────┴────┴────┘             └────┴────┘
（拥有者视角：                  （非拥有者视角：
 卡面朝上、可点触发）            只显示卡背 + 数量）
```

**本方响应卡区**（拥有者视角）：
- 渲染 `view.table_responses` 每张卡的完整卡面（复用 `card_elt(c, onClick)`）
- 点击 → 弹触发询问框（第 3 步实现）
- 卡背正面向上（拥有者可见）

**对方响应卡区**（非拥有者视角）：
- 用 `view.opponent_response_count` 渲染 N 个卡背占位
- 不显示任何卡面信息
- 鼠标悬停只显示"对方暗置响应卡（数量：N）"
- 不可点击

### 8.4 同阵营但不同代表国

特殊问题：同盟阵营有英国和苏联两个代表国，
它们都看得到对方的响应卡，但**只看得到自己阵营的卡**。
所以"对方"= 阵营对立方，"本方"= 同一阵营内的所有代表国。
- 同盟方玩家看到：英法集团 + 苏联集团 + 美中集团 自己阵营的所有响应卡
- 但要看具体某张卡是哪国打出的（？规则书没明确，留待后续决定）

### 8.5 触发询问弹框（第 3 步）

触发事件发生时（如敌方建设陆军后）：
- 服务端在 `view` 暴露 `pending_trigger`（类似 `pending_battle`）
- 客户端弹模态框，列出可触发的响应卡（本方）
- 玩家可选"触发"或"不触发"
- 多人触发时按 `ORDER_OF_NATIONS` 顺序询问（玩家 2026-09-25 明确）：
  - 当前行动方阵营之后开始，按 ORDER 顺序循环一圈
  - 例：德国行动 → 先问同盟（英国集团→苏联集团→美国集团）再问轴心
  - 例：苏联行动 → 先问意大利→美国集团→英国集团→日本→苏联

