# 07 状态卡·被动反应（`react`，6 张 / 3 种时机）

> **一句话判据**：`STATUS_EFFECTS[id].react` 存在 → 被别人**打到/经济战到**时**自动**结算，
> 没有窗口、不问玩家、不占出牌名额。

## 一、怎么认出这类卡

```js
STATUS_EFFECTS[id].react = { when, ... }
```

## 二、共性：3 种 `react.when` 全表

| when | 张数 | 卡 | 触发位置 |
|---|---:|---|---|
| `attacked` | 3 | 15243 大西洋防线 / 15250 陆地巡航者 / 15252 齐格飞防线 | 陆地战斗结算内部（受害方是本国时） |
| `econ_target` | 2 | 15246 Flak-40 高射炮 / 15251 喷气式战斗机 | 成为经济战**目标**时（对轰炸行动） |
| `econ_used` | 1 | 15249 狼群战术 | 自己**使用**经济战后 |

## 三、共性：与另两种状态卡的区别

| | `react`（本篇） | `trigger`（06） | `ongoing`（05） |
|---|---|---|---|
| 玩家是否表态 | ❌ 自动 | ✅ 弹「是否发动」 | ❌ 自动 |
| 是否有窗口字段 | `react.when` | `trigger.window` | 无（写 aura） |
| 生效期 | 一次事件 | 一个阶段内 | 卡在桌面期间 |
| 典型卡面表述 | 「被攻击时，X」 | 「X 后，你是否 Y」 | 「始终 / 永久」 |

**判断口诀**：卡面写「**被……时**，自动 X」= react；写「**……时**，你可以 Y」= trigger。

## 四、共同易错点

| # | 坑 | 后果 |
|---|---|---|
| 1 | `react` 里调 `request_responses` / 弹窗 | 玩家在战斗中突然被问，流程错乱（react 必须**同步结算完**） |
| 2 | react 效果依赖"之后的盘面" | 此时 victim 可能已被移除，`pieces_on` 查不到 |
| 3 | 在 react 里移除棋子却不走 `eliminate_piece` | 补给/标记/日志没更新 |
| 4 | `attacked` 与 `piece_attacked`（增强卡时点）混为一谈 | 一个走 react（同步），一个走 suspend（挂起），改错地方永远不生效 |
| 5 | react 结算里再次发起战斗 | 嵌套战斗 + 代受挂起 → 状态污染（需 `silent_status` 类保护） |
| 6 | 忘了 `once_per_turn` 语义 | 同一场战斗结算多次（代受/抵消分支会重复进） |

## 五、验收写法

```js
// 摆好防守方（react 卡在桌面）+ 攻击方（发起战斗）
rules.action(g, 'Axis', 'play_card', { card: WAR, space: SP, piece: 'victimPiece' })
rules.action(g, 'Allies', 'resolve_battle', { declined: true })

// 断言 react 已自动生效（无需任何 trigger_response）
ok(g.location['victimPiece'] != null, '★ react 生效：目标被保住')
ok(frames(g).length === 0, '★ 不产生响应帧（react 不该弹窗）')
```

**必测**：① 被攻击时自动生效 ② 不被攻击时**不**生效 ③ 不产生窗口/帧。

## 六、参考实现

| 想做 | 抄哪张 |
|---|---|
| 战斗中被攻击时自动加/减 | 15243 大西洋防线 / 15252 齐格飞防线 |
| 成为经济战目标时反应 | 15246 / 15251 |
| 自己用经济战后反应 | 15249 狼群战术 |
