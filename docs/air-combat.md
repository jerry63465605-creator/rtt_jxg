# 空军介入战斗：代受 + 抵消

> 版本 v1.0 · 2026-09-23 · 状态：**两阶段均已实现，80 项测试全通过**
>
> 规则来源：`docs/easy-rule.md` 七（空军）/ `docs/basic-cards.md` §4.2
> 实现：`server-official/public/quartermaster-sub-wars/rules.js`
> 测试：`tools/test_counter_air.js`
> 客户端：`play.js` 的 `update_pending_battle_box()`

---

## 1. 规则原文（easy_rule 七）

```
- 当与空军位于同一地区的本国部队被发起战斗时，
  可以移除此空军来代替移除受到攻击的部队
  - 然后，战斗的发起方可以移除 1 支相邻的空军来抵消此效果
```

这是**两句连着**的规则，对应两个决策环节：

| 环节 | 决策方 | 内容 |
|---|---|---|
| ① 代受 | **防守方** | 要不要用同地区的本国空军代替受创 |
| ② 抵消 | **发起方** | 代受已成立后，要不要用一支相邻的空军抵消它 |

> 2026-09-22 曾把 ② 整个删掉（当时理解为"代受由防守方决定，
> 所以发起方抵消是多余的"）。2026-09-23 核对规则书后**恢复**——
> 二者是独立的两步，不是同一件事的两种说法。

---

## 2. 两阶段挂起

`game.pending_battle` 增加 `stage` 字段：

```
  发起战斗
     │
     ├─ 该地区没有可代受的空军 ──> 直接结算
     │
     ▼
  stage='defend'   等待方 = defender_nation（防守方）
     │
     ├─ 不代受  ──> 移除 victim，同地区空军撤离（无处可撤则移除）
     │
     └─ 代受（defend_air）
           │
           ├─ 发起方没有可抵消的空军 ──> 直接结算（代受成立）
           │
           ▼
        stage='counter'  等待方 = attacker（发起方）
           │
           ├─ 不抵消 ──> 移除 defend_air，victim 保住
           │
           └─ 抵消（counter_air）
                 └─> 移除 defend_air + counter_air + victim
```

### 结算对照表

| 防守方 | 发起方 | 移除的东西 |
|---|---|---|
| 不代受 | — | `victim`（空军撤离或移除） |
| 代受 | 不抵消 | `defend_air`（`victim` 保住） |
| 代受 | 抵消 | `defend_air` + `counter_air` + `victim` |

最后一行即"双方各损失 1 支空军，原目标照常被移除"：
- 防守方损失：代受空军 + 原目标部队
- 发起方损失：用于抵消的空军

---

## 3. 数据模型

```javascript
game.pending_battle = {
    stage: 'defend' | 'counter',

    /* 战斗本身 */
    space, kind,                  // kind: 'land' | 'sea'
    attacker,                     // 发起方国家
    attacker_faction,
    attacker_piece,               // 发起单位（重放要用）
    victim, victim_type, victim_nation,

    /* 决策身份 */
    defender, defender_nation,    // 谁决定"代受"（经代表团映射）
    air_nation,                   // 哪国的空军能代受（法国飞机替法国部队）

    /* stage 专属 */
    airs, retreats,               // 'defend'：可代受的空军 / 不代受时的撤离候选
    defend_air, counter_airs,     // 'counter'：已选的代受空军 / 可抵消的空军
}
```

### 谁在等（`pending_wait_nation`）

```javascript
stage === 'counter'  ->  pb.attacker          （发起方）
stage === 'defend'   ->  pb.defender_nation   （防守方）
```

**两阶段的等待方属于不同阵营**，所以任何"该不该显示/能不能提交"
的判断都必须走这个函数，不能写死 `defender_nation`。

---

## 4. 提交方式（`resolve_battle`）

两个阶段**共用同一个 action**，靠 `stage` 分流：

```javascript
/* stage='defend'：防守方提交 */
{ use_air:  <piece_id> }              // 代受
{ declined: true, retreat: <space> }  // 不代受（可指定空军撤往哪里）

/* stage='counter'：发起方提交 */
{ counter_air: <piece_id> }           // 抵消
{ declined:    true }                 // 不抵消
```

提交方不对（例如 `defend` 阶段由发起方提交）会被拒绝，
挂起状态保留，不做结算。

---

## 5. 可抵消空军的判定（`counter_air_options`）

| 条件 | 说明 |
|---|---|
| 必须是**发起方本国**的空军 | `piece_nation === nation` |
| 位于目标地区的**相邻**地区 | 走 `get_connections`（与 `battle_initiators` 同口径） |
| 不要求处于补给状态 | 规则只说"相邻的空军"，无补给要求 |

发起方**没有**可抵消的空军时，跳过 `counter` 阶段直接结算——
没必要问一个答不了的问题。

---

## 6. 可见性与权限

| 环节 | 谁能看到 `view.pending_battle` |
|---|---|
| `defend` | 只有防守方阵营 |
| `counter` | 只有发起方阵营 |

**按阵营判定，不按国家名比**（见第 8 节的踩坑）。

### 白名单层面做不到分流

`view.actions` 在 `pending_battle` 期间给等待方 `{resolve_battle, log}`；
但**当前行动方**拿到的是完整动作列表，里面本来就有 `resolve_battle`
（它是常驻动作）。所以白名单层面两方都有这个动作，
**真正的权限校验在服务端提交时按 stage 做**。这不是缺陷，
白名单只负责"动作是否存在"，不负责"这次能不能提交"。

---

## 7. 客户端

`play.js` 的 `update_pending_battle_box()` 一个函数服务两个阶段：

- `stage='defend'` → "【X】是否用空军代受？" + 代受/不代受按钮
- `stage='counter'` → "【X】是否用空军抵消这次代受？" + 抵消/不抵消按钮

服务端已按 stage 把 `pending_battle` 只发给该表态的一方，
所以客户端拿到 `pb` 就等于"轮到我决定了"，不需要再判断身份。

---

## 8. 踩坑记录

### 坑 1：等待方不是"本方首个国家"时拿不到面板

原写法：

```javascript
const pendingBattle = (pb.defender_nation === my_nation) ? pb : null
```

但 `my_nation` 是"**本方阵营在行动顺序里排最前的国家**"
（轴心=德国、同盟=英国）。于是当等待方是**意大利 / 日本 / 法国**时，
名字对不上 —— 那一方根本看不到面板。

**修法：按阵营比较**

```javascript
const wait = pending_wait_nation(pb)
return (faction_of_nation(wait) === side) ? pb : null
```

同一阵营只有一个玩家位，所以按阵营判定才是正确口径。
测试 `test_counter_air.js` §14 专门覆盖了"意大利防守"这个场景。

### 坑 2：抵消校验失败时挂起丢失

`do_battle` 里 `game.pending_battle = null` 排在 `defend_air` 校验**之前**。
于是发起方选了一支非法空军时：

- 返回 `{ok:false}`
- 但挂起已经被清掉了 → **这一战悬空**，谁也结不掉

**修法**：把构造挂起对象抽成 `make_counter_pending()`，
校验失败时 `game.pending_battle = make_counter_pending()` 放回去，
让发起方重选。

> 与 `docs/pitfalls.md` 通用教训 2「清理须排在校验之后」同源。

---

## 9. 测试（`tools/test_counter_air.js`，80 项）

| 组 | 内容 |
|---|---|
| 0 | 测试前提（德国是★、与东欧相邻、发起单位有补给） |
| 1 | 发起战斗 → 挂起 `stage='defend'` |
| 2 | 防守方代受 → 挂起 `stage='counter'` |
| 3 | 发起方抵消 → `defend_air` + `counter_air` + `victim` 全移除 |
| 4 | 发起方不抵消 → 只移除 `defend_air`，`victim` 保住 |
| 5 | 无可用空军 → 跳过 counter 直接结算 |
| 6 | 合法性校验（敌方空军 / 陆军均被拒，挂起保留可重选） |
| 7 | `counter_air_options`：本国 + 相邻 |
| 8 | 不代受 → 不进入 counter |
| 9–10 | view 可见性与 actions 按 stage 分发 |
| 11 | 完整 `resolve_battle` 两阶段流程 |
| 12 | 权限：错误的一方提交被拒 |
| 13 | 全局挂起：counter 期间其它动作被拦 |
| 14 | 修复验证：意大利（非本方首个国家）防守时也能看到面板 |

回归全通过：`basic 294` · `supply 36` · `neutral 89` · `dynamic_supply 96`

---

## 10. 相关文档

| 文档 | 内容 |
|---|---|
| `docs/basic-cards.md` §4.2 | `do_battle` 参数规格 |
| `docs/supply.md` | 补给链算法 |
| `docs/unit-coexistence.md` | 同格共存规则 |
| `docs/pitfalls.md` | 通用教训 1/2/6/13/14/15/16/17 |
| `docs/place-names.md` | 地名对照（日耳曼=德国 等） |
