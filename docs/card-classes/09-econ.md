# 09 经济战 ECON（32 张，全部已登记）

> **一句话判据**：`type === 'ECON'`，登记在 `rules.js` 的 **`ECON_CARDS`**，
> 效果是**损耗对方牌库**（不是弃牌），可能带链式让权（对方选方案）。

## 一、怎么认出这类卡

```js
_internal.ECON_CARDS[id] = { tag, targets: ['英国', ...], run? }
```

实测 32 张全部登记，`tag` 分布：

| tag | 张数 | 语义 |
|---|---:|---|
| （空 tag） | 15 | 单步：直接损耗 |
| `潜艇行动` | 8 | 潜艇链 |
| `轰炸行动` | 8 | 轰炸链 |
| `北方行动` | 1 | 特殊链 |

## 二、共性：三要素

| 要素 | 字段 | 说明 |
|---|---|---|
| **谁被打** | `targets: ['英国','美国']` | 目标国家数组，不是阵营 |
| **走哪条链** | `tag` | 空 = 单步；非空 = 该 tag 的链式实现（`options_for` + `answer`） |
| **结算什么** | 统一损耗 | `attrition_cards(game, nation, n)` —— 牌库顶进弃牌堆 |

## 三、共性：执行流程（含链式让权）

```
play_card(econCard)
  ↓
set_pending_econ({ tag, scheme, step, total, targets, ... })
     ↓ 让权给目标国（handoff_to）
目标国选方案：rules.action(side, 'resolve_econ', { scheme })
  ↓
resolve_econ() 按 tag 走该链的第 N 步
  ├─ 单步：attrition_cards(target, n)
  └─ 多步：推进 step，仍有多步则重新挂起
  ↓
reconcile_handoff() 归还操作权
```

关键函数：`set_pending_econ` / `resolve_econ` / `attrition_cards` /
`econ_remove_piece` / `econ_config_of` / `econ_discard_snapshot` / `econ_attrited_count`

## 四、共同易错点

| # | 坑 | 后果 |
|---|---|---|
| 1 | **把"损耗"写成"弃牌"** | 经济战一律**损耗**（牌库顶进弃牌堆，玩家不能选）；代价支付才是弃牌 |
| 2 | 目标写阵营而非国家 | `targets` 是国家名数组 |
| 3 | 链式多步不记录 `step / total` | 客户端不知道"现在是第几步"（`view.pending_econ` 需要） |
| 4 | 让权后不 `reconcile_handoff` | 操作权停在目标国 → 全场卡死 |
| 5 | 损耗数量用 `Math.min` 兜底但没写日志 | 牌库不足时玩家看到"少了 1 张"却不知道为什么 |
| 6 | `tag` 拼错 | 找不到链实现 → 卡打出后无效果（静默） |
| 7 | 经济战期间又触发别的挂起（响应栈/战斗） | 挂起互斥，`pending_econ` 会被挤掉（见坑 8） |
| 8 | 多挂起并存 | `pending_battle` / `pending_econ` / `pending_trigger` 三者应互斥，已用守卫拦截 |

## 五、验收写法

```js
// 摆好：目标国牌库有 N 张，桌面/手牌有经济战卡
const before = (g.decks['英国'] || []).length

rules.action(g, 'Axis', 'play_card', { card: ECON_ID, target: '英国' })
ok(!!g.pending_econ, '挂起等目标国选方案')

rules.action(g, 'Allies', 'resolve_econ', { scheme: '...' })
ok((g.decks['英国'] || []).length === before - n, '★ 牌库被损耗 n 张')
ok((g.discard['英国'] || []).length === discardBefore + n, '★ 损耗的牌进了弃牌堆')
ok(!g.pending_econ, '挂起解除')
ok(typeof g.active === 'string', '操作权已归还')
```

**必测**：① 损耗的是**牌库**不是手牌 ② 张数正确 ③ 操作权归还 ④ 多步链的每一步。

## 六、参考实现

| 想做 | 抄哪张 |
|---|---|
| 单步损耗 | 15 张空 tag 卡 |
| **链式让权（多步、对方选）** | **15314 马耳他潜艇群**（`cfg.chain` + `options_for` + `answer` + `resolve_econ`） |
| 分支不同的损耗方案 | 带 `tag` 的 17 张 |
