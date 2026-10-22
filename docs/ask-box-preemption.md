# ask_box 抢占类 bug（2026-10-23）

> 客户端所有"等待玩家表态"的面板共用同一个 `#ask_box` DOM：
> 谁最后 `render_ask_box()` 谁赢，先渲染的直接被覆盖。
> 本文记录这类 bug 的成因、已发生的两次事故、以及现在加的兜底。

---

## 一、机制

`update_map()` 每帧按固定顺序调用一串 `update_*_box()`：

```
update_pending_battle_box()      ← 战斗代受 / 撤退
update_pending_trigger_box()     ← 响应卡「发动 / 不发动」
update_pending_econ_box()        ← 经济战方案
update_event_budget_box()
update_event_step_box()
update_uranus_box()
...
update_italy_borrow_box()        ← 17732 德国军事顾问（本次事故点）
update_us_japan_box()            ← 17553 抗日义勇军
update_us_china_box()            ← 16304 中国远征军
...
```

每个函数内部都直接 `render_ask_box(title, text, buttons)`。
**没有优先级仲裁** —— 后调的框无条件覆盖先调的框。

于是只要"高优先级阻塞询问"之后还有一个非阻塞提示框在渲染，前者的按钮就会消失：
顶部横幅（`view.prompt`，由服务端下）写着"请决定是否发动《X》"，
界面上却只剩另一个框的按钮 —— 玩家**无处可点，对局卡死**。

---

## 二、事故一：`view.response_choice` 在"待发动"帧也下发（已修）

服务端把 `response_choice` 从"待发动"帧也算出来发给客户端，
而客户端 `update_pending_trigger_box()` 开头有：

```js
if (view.response_choice) return   /* 认为在选目标，让给选择框 */
```

于是发动框自己早退了。修法：服务端只在帧**确有 candidates** 时才下发 `response_choice`（`rules.js:23084`）。

---

## 三、事故二：17732 借用框盖掉响应卡决策框（本次）

### 现象（玩家截图）

- 顶部：`响应卡结算中：请决定是否发动《破译恩尼格码》`
- 底部：`德国军事顾问：已借用《闪电战》/ [激活《闪电战》]`
- **发动 / 不发动按钮不存在**

### 根因（两处叠加）

| # | 位置 | 问题 |
|---|---|---|
| ① | `view.italy_borrow` | **不判 side** → 对手（英国/同盟）也收到，客户端在对手界面渲染意大利的借用框 |
| ② | `update_italy_borrow_box()` | 在 `update_pending_trigger_box()` **之后**调用，且无条件 `render_ask_box` → 把发动按钮整个盖掉 |

### 修法（三道）

**① 服务端按阵营裁剪**

```js
italy_borrow: (function () {
    if (!game.italy_borrow) return null
    const ib = game.italy_borrow
    if (faction_of_nation(ib.nation) !== side) return null   // ← 新增
    ...
})()
```

**② 客户端让位守卫**（同阵营内并发时的兜底）

```js
if (view.pending_trigger || view.response_choice) return
```

**③ 渲染末尾强制重绘**（永久兜底）

`update_map()` 最后一句追加：

```js
update_pending_trigger_box()
```

它是幂等函数（`pending_trigger` 为空时只清理自己的 `ask_state`），
所以哪怕将来又新增某个抢占框，响应卡决策框也一定在最上层。

---

## 四、`view` 字段的阵营裁剪检查表

| 字段 | 是否按 side 裁剪 | 说明 |
|---|---|---|
| `pending_trigger` | ✅ | 栈顶非本方 → null，用 `waiting_for` 表达"等待" |
| `response_choice` | ✅ + 仅在有 candidates 时 | 见事故一 |
| `pending_battle` | 部分（服务端用 `pending_wait_nation` 区分文案） | |
| `italy_borrow` | ✅（本次修） | 借用方阵营独占 |
| `armed_offer` | ✅（按 `w.nation` 阵营） | |
| `us_japan_delegate` / `us_china_delegate` … | 用 `waiting_for` 区分"谁操作" | 对手侧显示"等待【X】" |

> **原则**：给客户端的"操作权类"字段必须按阵营裁剪；
> 需要让对手知道的，用 `waiting_for` / `prompt` 单独表达，不要让对手拿到可操作的字段。

---

## 五、回修入口

| 症状 | 先看 |
|---|---|
| 顶部横幅说"请决定…"但没按钮 | 该帧之后还有哪个 `update_*_box` 在 `render_ask_box`；用 `view.pending_trigger` 是否非空确认本方确实是决策方 |
| 对手界面出现本方专有面板 | 检查对应 `view.*` 字段是否漏判 `side` |
| 响应卡发动按钮"闪一下就没了" | `update_map` 末尾的兜底调用是否还在 |

## 六、测试

`tools/_smoke_17732_borrow_visibility.js`（16 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | 已借用（pending=false）：轴心可见、同盟 `italy_borrow === null` |
| B | 待选（pending=true）：同样只给借用方阵营，候选数正确 |
| C | 客户端源码断言：让位守卫 + `update_map` 末尾兜底重绘都在 |
| D | 响应卡决策框正向用例：同盟拿到 `pending_trigger` 与候选、轴心只看到"等待"文案、`response_choice` 不被误下发 |
