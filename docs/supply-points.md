# 补给点（Supply Point）· 动态层

> 版本 v2.0 · 2026-09-23 · 状态：**动态层已实现，96 项测试全通过**
>
> v2.0 变更：删掉硬编码的 `EXTRA_ALLIED_SUPPLY_NAMES`；
> 引入 `game.supply_override` 动态层；补给点与计分标记**均区分阵营**，
> 并提供增删改与改阵营的方法。
>
> 相关：`docs/supply.md`（补给**链算法**）、`docs/neutral.md`（参战规则）

---

## 0. 什么是"动态层"？为什么不用直接修改？

这是本次改动的核心概念，先讲清楚再谈实现。

### 0.1 两种改法

假设某张卡要让"东欧变成补给点"。

**方案 A：直接修改（改 data）**

```javascript
data.spaces[5].supply = true      // 直接改地图数据
```

**方案 B：动态层（override）**

```javascript
game.supply_override[5] = { axis: true, allies: true }   // 记在 game 里

// 判定时叠加：
function is_supply_point(game, space, faction) {
    const ov = game.supply_override[space]
    if (ov && ov[faction] !== undefined) return ov[faction]   // 改过 -> 用它
    return !!data.spaces[space].supply                        // 否则回落地图标定
}
```

### 0.2 对比

| 维度 | A 直接修改 data | B 动态层 override |
|---|---|---|
| **存储位置** | `data.js` 模块级常量 | `game.supply_override`（state 内） |
| **是否进存档** | ❌ 不进。`data` 不参与 JSON 序列化 | ✅ 随 state 一起存/读 |
| **服务器重启后** | ❌ 丢失 | ✅ 保留 |
| **读档回放** | ❌ 回放时 data 已被改，历史步骤错乱 | ✅ 每步都从 state 读，可精确回放 |
| **对局隔离** | ❌ **全局共享**，A 局改了 B 局也变 | ✅ 每局独立 |
| **可撤销（undo）** | ❌ 改了就是改了，无法回滚 | ✅ 删掉 override 键即恢复 |
| **区分阵营** | ❌ 一个布尔，无法表达"仅对同盟" | ✅ `{axis, allies}` 各一个布尔 |
| **view 只读约束** | ❌ 违反。view 里改 data 是副作用 | ✅ 只读 game，安全 |
| **性能** | 无额外开销 | 多一次对象查表（可忽略） |
| **改动成本** | 一行 | 判定函数要传 `game`，所有调用点要同步改 |

### 0.3 结论

**直接修改只在"整个进程内、所有对局、永久生效"的场景才合适**——
比如修一个数据错误。而补给点是**对局内部的、可被卡牌反复改变的状态**，
本质上是 game state 的一部分，必须走动态层。

最致命的三点是：
1. **不进存档** —— 玩家打了一半，服务器重启，卡牌效果全丢；
2. **对局不隔离** —— 两局同时开，一局改了另一局跟着变；
3. **破坏回放** —— RTT 靠 state 快照重放，data 被改后历史步骤无法复现。

> 这三点与 `docs/pitfalls.md` 通用教训 6/13 同源：
> **凡是"每局可能不同"的信息，都必须住在 game 里，不能住在模块常量里。**

---

## 1. 数据模型

```javascript
game.supply_override = {
    <space_id>: { axis: true|false, allies: true|false },
}
```

- **只记录被卡牌改过的地区**。没出现的地区回落到 `data.spaces[i].supply`。
- 某个阵营字段缺省（`undefined`）也回落到地图标定 ——
  所以可以只改一个阵营、另一个保持默认。
- 空对象 `{}` = 没有任何 override，等价于纯静态。

### 判定优先级

```
1. game.supply_override[space][faction] 有值  ->  用它
2. 否则                                        ->  data.spaces[space].supply
```

---

## 2. 补给点 API

| 函数 | 作用 |
|---|---|
| `is_supply_point(game, space, faction)` | 判定。`faction` 省略 = 宽松查询（任一阵营算就算） |
| `add_supply_point(game, space, faction)` | **增加**补给点。`faction` 省略 = 两阵营同时 |
| `remove_supply_point(game, space, faction)` | **减少**（让补给点失效）。`faction` 省略 = 两阵营同时 |
| `set_supply_point(game, space, faction, value)` | **改阵营**：直接设某阵营的 true/false |
| `reset_supply_point(game, space)` | 清除 override，回落地图标定（撤销卡牌效果） |
| `list_supply_points(game)` | 列出全部补给点，含 `axis/allies/base/overridden` |

### 示例

```javascript
/* 波兰(东欧)变成补给点，只对同盟有效 */
add_supply_point(game, SPACE['东欧'], 'allies')

/* 焦土：乌克兰对轴心不再是补给点，对同盟仍是 */
remove_supply_point(game, SPACE['乌克兰'], 'axis')

/* 改主意：改成只对轴心有效 */
set_supply_point(game, SPACE['东欧'], 'axis',   true)
set_supply_point(game, SPACE['东欧'], 'allies', false)

/* 撤销，回到地图标定 */
reset_supply_point(game, SPACE['东欧'])
```

---

## 3. 补给种子按阵营判定（重要行为变化）

`compute_supply()` 里"站在★上的部队自动有补给"这条，
现在**按部队所属阵营判定**：

```javascript
const f = faction_of_nation(game.piece_nation[pid])
if (!is_supply_point(game, Number(loc), f)) continue
```

后果：**轴心部队站在"仅对同盟的补给点"上不会获得补给**，反之亦然。
这正是规则"仅对同盟国视为补给点"想要的效果。

---

## 4. 计分标记的阵营维度

标记结构扩展为两个维度：

```javascript
{ owner: null|'英国', faction: null|'axis'|'allies', value: 1 }
```

| 组合 | 含义 |
|---|---|
| `owner=null, faction=null` | 谁都能拿（默认） |
| `owner='英国'` | 只有英国能拿 |
| `faction='allies'` | 只有同盟国能拿 |
| `owner='英国', faction='allies'` | 需**同时满足**（是英国，且属同盟） |

### 标记 API

| 函数 | 作用 |
|---|---|
| `add_marker(game, space, n, owner, faction)` | 增加 n 个标记 |
| `remove_marker(game, space, n, owner, faction)` | 移除；可按国家/阵营筛选 |
| `set_marker_owner(game, space, owner, n)` | **改国家**归属 |
| `set_marker_faction(game, space, faction, n)` | **改阵营**归属 |
| `move_marker(game, from, to, n, owner, faction)` | 转移（**保留** owner/faction） |
| `marker_applies_to(mk, nation)` | 判定某国能否拿这个标记 |

> `remove_marker` / `move_marker` 的 `owner`/`faction` 参数语义：
> 传 `undefined` = 该条件不参与筛选；传 `null` = 只匹配"该条件为空"的标记。

### 摊分规则（扩展）

`allocate_space_score` 现在按**有资格的国家集合**分三类处理：

| 资格者 | 处理方式 |
|---|---|
| = pool 全体 | 归入公共池，全体摊分 |
| = 1 个 | 直接给该国（专属） |
| = pool 的真子集（>1） | **在该子集内摊分** |

第三类是新增的：例"仅同盟可拿"的标记，
会在同格的 英/法/苏 之间摊分，德国拿不到。

---

## 5. 本次删除的东西

```javascript
// 已删除
const EXTRA_ALLIED_SUPPLY_NAMES = ['中国西部', '非洲南部', '西伯利亚']
```

**为什么删**：它无条件把这三个地区算作补给点，
但按玩家口径它们**初始不是**补给点，只有卡牌能让它们变成补给点。
而且它还**漏了波兰（东欧）**。

现在 `axis_supply_points_held()`（美国参战条件）改为纯动态判定：
当前是什么就是什么，卡牌把东欧变成补给点后它会自动进入统计。

---

## 6. 地名映射

> **完整对照表见 `docs/place-names.md`**（唯一权威来源，含"日耳曼=德国"
> "法国地块用西欧"等歧义消解约定）。此处只列与补给点相关的部分。

| 规则原文 | 本作地区 | id | 初始 supply |
|---|---|---|---|
| 〈波兰〉 | **东欧** | 5 | false |
| 〈奥斯陆〉 | 北欧 | 4 | false |
| 〈中国西部〉 | 中国西部 | 19 | false |
| 〈非洲南部〉 | 非洲南部 | 31 | false |
| 〈西伯利亚〉 | 西伯利亚 | 18 | false |
| 〈不列颠群岛〉 | 不列颠 | 2 | **true** |
| 〈乌克兰〉 | 乌克兰 | 45 | **true** |
| 〈印度〉 | 印度 | 35 | **true** |

> **波兰 = 东欧** 由玩家 2026-09-23 确认。
>
> **注意**：代码里引用地块要用**本体名**（`data.id_of('德国')`），
> "日耳曼"这类别称目前仅用于文档与沟通。

---

## 7. 计分标记与补给点仍是"分离"的

`init_markers()` **只在开局按初始补给点播种一次**，之后独立演化：

- 卡牌让某地**变成**补给点 → 它**不会**自动获得计分标记
- 卡牌让补给点**失效** → 它已有的标记**不会**消失

这是 2026-09-22 确定的口径（标记与补给点是两件事）。
若将来需要"新增补给点自动补标记"，那是一条**新的规则决定**，
不是技术默认值 —— 需要玩家确认后再加。

---

## 8. view / query

| 字段 | 内容 |
|---|---|
| `view.supply_points` | `[{ id, name, axis, allies, base, overridden }]` |
| `view.supply_by_id` | 按 id 索引的简表，供渲染 O(1) 查 |
| `query('supply_points', {faction})` | 可按阵营过滤 |

### 客户端

`play.js` 的 `markup_classes()` 与地区说明**不再读 `sp.supply`**，
改读 `view.supply_by_id`。
新增 `update_supply_classes()` 在每次 `update_map` 时同步 CSS class ——
因为补给点现在会变，只在 `build_map` 画一次就会"改了但没画出来"。
（见 `docs/pitfalls.md` 通用教训 1：渲染时机 ≠ 状态时机。）

仅对单一阵营有效的补给点加 `.half` class：虚线边框 + 半透明★。

---

## 9. 向后兼容

| 项 | 处理 |
|---|---|
| 老对局缺 `supply_override` | `ensure_supply_override()` 在 view/action/query 入口补 `{}` |
| `is_supply_point(space)` 老签名 | 保留兼容：首参若是 number 则按老式单参处理 |
| 老标记无 `faction` 字段 | `marker_applies_to` 用 `!= null` 判定，`undefined` 等同"不限" |

---

## 10. 测试

`tools/test_dynamic_supply.js` — **96 项**，22 组：

| 组 | 内容 |
|---|---|
| 1–6 | 增加/减少/改阵营/reset 补给点 |
| 7 | 补给种子按阵营判定（轴心站"仅同盟点"不得补给） |
| 8 | `list_supply_points` |
| 9 | 删掉硬编码名单后行为正确，卡牌加的补给点能触发美国参战 |
| 10 | 焦土让补给点失效后美国不参战 |
| 11–13 | 标记的 faction 维度、`marker_applies_to` 双维度 |
| 14–16 | 计分：仅同盟标记不给轴心、子集摊分、owner+faction 同时限定 |
| 17–18 | 按阵营筛选移除、转移保留属性 |
| 19–22 | view/query、向后兼容、JSON 存档往返 |

回归全通过：`test_supply.js` 36 · `test_basic_cards.js` 294 · `test_neutral.js` 89
