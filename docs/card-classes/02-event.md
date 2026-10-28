# 02 事件卡 EVENT（86 张，已实现 79）

> **一句话判据**：`type === 'EVENT'`，在 `rules.js` 的 **`EVENT_EFFECTS`** 里登记，
> 由**声明式 `steps`** 驱动逐步执行，玩家打出即结算（不需要等窗口）。

## 一、怎么认出这类卡

```js
_internal.EVENT_EFFECTS['6600']   // 有 = 已接入；无 = 未实现（预览页显红）
```

`EVENT_EFFECTS[id]` 的字段全集（实测）：

```
name, actor, cond, steps, choice, choiceLabels, cost, desc, notes, extraPlay, pendingTheater, run
```

## 二、共性：`steps` 是主体（6 种 op）

| op | 用途 | 次数 |
|---|---|---:|
| `recruit` | 征召部队 | 39 |
| `build` | 建设部队 | 23 |
| `battle` | 发起战斗（受 `event_budget` 战斗预算约束） | 19 |
| `eliminate` | 消灭部队 | 13 |
| `run` | 走命令式 `run(game, ...)` | 6 |
| `marker` | 放/去计分标记 | 3 |

现状分布：**42 张是多步**（`steps.length > 1`），**9 张带 `choice`**（二选一分支）。

一条 step 的常见字段：

```js
{ op: 'build', type: 'army', spaces: [22], pickMin: 1, pick: 1 }
{ op: 'battle', kind: 'land', spaces: [6], count: 1 }
{ op: 'eliminate', type: 'army', onlyNation: '苏联', spaces: [45, 10] }
```

## 三、共性：执行流程

```
play_card(card, space?, ...)
  ↓
resolve_event_card()          // 主体：按 steps 顺序推进
  ├─ step_space_candidates()  // 服务端算"这一步能选哪些地区"
  ├─ event_budget             // 战斗预算（一场战斗消耗一次机会）
  └─ 返回 pending / need      // 需要玩家选地区/选部队时停机，等下一次 action
  ↓
cost 结算（attrition 损耗 / discard 弃牌）→ 卡进弃牌堆
```

**三种执行形态**（一张卡只会是其中一种）：

| 形态 | 表现 | 例子 |
|---|---|---|
| 纯自动 | 打出后立刻结算完，无弹窗 | 6600 伊朗加入轴心国 |
| 选地区 / 选部队 | 返回 `need`，客户端弹选择框 | 15226 类 |
| 多步停机 | 第 ① 步结算完再问第 ② 步（`steps` 逐步） | 15226 / 15430 |

## 四、共同范式（骨架）

```js
'6600': {
    name: '伊朗加入轴心国', actor: '德国',
    steps: [
        { op: 'marker', count: 1, spaces: [16] },
        { op: 'eliminate', type: 'army', onlyNation: '苏联', spaces: [45, 10] },
    ],
},
```

需要前提 / 代价 / 二选一时：

```js
'xxxx': {
    name: '…', actor: '美国',
    cond: (game) => game.turn >= 3,             // 不满足 -> 卡打不出（日志说明原因）
    cost: { attrition: 2 },                     // 损耗 2 张（注意：不是弃牌）
    choice: ['A 方案', 'B 方案'], choiceLabels: ['…', '…'],
    steps: [ … ],
    extraPlay: true,                            // 结算后额外获得一次出牌
}
```

## 五、共同易错点

| # | 坑 | 现象 / 后果 |
|---|---|---|
| 1 | **发起战斗不拆成分步**，一口气连打两场 | 第一场战斗的挂起/预算把第二场吞掉 → 只有一场生效（见 15226 式修复） |
| 2 | **在 `steps` 里自己写 `get_connections` 遍历** | 漏补给、漏连通快照 → 候选与执行不一致（高亮能点、点了无效） |
| 3 | `cost.attrition` 写成"弃牌"语义 | 损耗是牌库顶进弃牌堆；弃牌是玩家手选。两者混用 → 结算错 |
| 4 | 需要玩家选地区却没有 `spaces` 候选（或候选两端不一致） | 客户端没有可点格子 |
| 5 | 多个 `battle` step 但没管 `event_budget` | 预算耗尽后静默不执行 |
| 6 | `run` 里返回 `{ok:false}` 但不写原因 | 玩家只看到"点了没反应" |
| 7 | 用 EVENT 做"敌方回合才生效"的效果 | 事件卡是**自己回合打出即结算**，跨回合要用 EFFECT（armed）或 STATUS |

## 六、参考实现（照抄优先级）

| 想做 | 抄哪张 |
|---|---|
| 纯自动多步（放标记 + 消灭） | **6600 伊朗加入轴心国** |
| 建设/征召 + 选地区 | 带 `spaces` + `pick` 的标准 step |
| 发起战斗（单场） | 带 `op:'battle'` 的卡 |
| 二选一分支 | 带 `choice` / `choiceLabels` 的 9 张之一 |
| 需要命令式逻辑 | `op:'run'` + `run(game, ...)` |

## 七、验收写法

事件卡的验收**必须覆盖"逐步"而不是只看最终盘面**：

```js
// 1. 打出前：候选由服务端算
const cands = I.step_space_candidates(g, ...)
ok(cands.length > 0, '有合法候选')

// 2. 打出：第一步结算 + 停机
rules.action(g, 'Axis', 'play_card', { card: ID, space: ... })
ok(!!g.pending_event || g.event_budget, '多步卡在第一步后停机')

// 3. 继续第二步
rules.action(g, 'Axis', 'event_step', { ... })
ok(g.location[...] != null, '第二步生效')

// 4. 卡在弃牌堆、不在手牌
ok((g.discard['德国'] || []).includes(ID), '结算后进弃牌堆')
```

> 写脚本时先把 `cond` / `cost` 摆好（手牌数、牌库数），否则会得到"卡打不出"的假失败。
