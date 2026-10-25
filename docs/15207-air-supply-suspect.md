# 15207《JU-52 空投补给》回合边界让权基准过期导致卡死（已复现并修复）

> 状态：**已复现、已修复（工作区）+ 回归通过，未提交、未部署**（2026-10-25）
> 卡面：**回合开始时，若场上有德国空军，损耗 1 张牌：本回合内所有德国部队处于补给状态。**
> 卡 id：`15207`｜国家：德国｜类型：EFFECT（增强卡 / armed 触发）
>
> ## 修复摘要
>
> 玩家判断正确：**与 17805 同源**（handoff 归还基准不可信），但触发点不同 ——
> 17805 是"被 armed 让权污染的中间态"，15207 是"**回合边界记录的旧阵营**"。
>
> - 根因：`next_turn` 里 `on_turn_start()` 早于 `active = faction_role_of_nation(current_nation)`
>   整整 36 行（21824 vs 21860）。弹窗那一刻 `active` 还是**上一回合**（美国=Allies）的阵营，
>   `handoff_to` 把 `_handoff_base` 记成 `'Allies'`；回合推进随后把 `active` 重置为 `'Axis'`（正确），
>   可玩家点「不打出」时 `rectify_active` 又按过期的 `_handoff_base` 还原成 `'Allies'`
>   → `current_nation='德国'` 而 `active='Allies'` → 轴心"等待对方行动"卡死。
> - 修法：`rectify_active()` 栈空分支改为**以 `current_nation` 为准**，
>   `_handoff_base` 仅作兜底；并补 `game_over` 保护（终局不改 active）。
> - 回归：新增 `tools/_smoke_15207_turn_start.js`（24 项 **ALL PASS**）
> - 全量：71 个 smoke，失败 2 个（`_smoke_15329_intercept_capture` / `_smoke_17537`，均无关）
>
> ⚠ **重要教训（本条曾误判为"未能复现"）**：`game.active` 的规范值是**角色常量**
> `'Axis'` / `'Allies'`，**不是**小写阵营名 `'axis'` / `'allies'`。早期复现脚本手工写了
> `g.active = 'allies'`，导致 `sync_armed_handoff` 里
> `baseSide = (game.active === ALLIES_ROLE ? ALLIES : AXIS)` 算成 AXIS，
> 跨阵营判定失效 → 没有让权 → 假阴性。测试里凡手工设 `active`，必须用大写。

## 一、现场

线上对局（testserver，game 5731），玩家报告：

```
疑似和红色管弦乐队相似的 bug，空投补给
```

即怀疑与 `docs/17805-red-orchestra-active-desync.md`（操作权错乱 → 顶部"等待对方行动"、界面卡死）同源。

**本轮排查未能复现**，下节把已排除的路径和仍存疑的点全部列出，并说明需要哪几个现场字段才能定案。

## 二、实现（很短，全部逻辑就这些）

```js
'15207': {
    name: 'JU-52 空投补给', actor: '德国',
    armed: {
        when: 'turn_start', actor: '德国', cost: { attrition: 1 },
        cond: (game) => has_pieces(game, { types: ['air'], nation: '德国' }),
        desc: '回合开始时若场上有德国空军：本回合内所有德国部队处于补给状态',
        run(game, ctx) {
            game.modifiers = game.modifiers || []
            game.modifiers.push({ key: 'all_german_supplied', untilTurn: game.turn, nation: '德国' })
            return { ok: true, desc: '本回合内所有德国部队处于补给状态' }
        },
    },
},
```

生效点（`compute_supply`）：

```js
if (echo_mod_active(game, 'all_german_supplied')) {
    for (const pid of Object.keys(game.location)) {
        if (game.piece_nation[pid] === '德国') { in_supply[pid] = true; ... }
    }
}
```

`echo_mod_active` 的判定：

```js
function echo_mod_active(game, key) {
    const cur = game.current_nation
    return game.modifiers.some(m =>
        m.key === key &&
        (m.untilTurn == null || (m.untilTurn || 0) >= (game.turn || 1)) &&
        (!cur || m.nation == null || m.nation === cur))
}
```

注意最后一行：**要求 `m.nation === game.current_nation`** —— 只有当前行动国是德国时才生效。

## 三、复现（并修正此前的误判）

### 3.1 先纠正一个假阴性

本节原先写的是"**已排除：15207 不会引发 active 错乱**"——**该结论作废**。

原因是当时的复现脚本把 `active` 写成了小写：

```js
g.active = 'allies'          // ❌ 规范值是 'Allies'
```

`sync_armed_handoff` 里：

```js
const baseSide = game._handoff_base || (game.active === ALLIES_ROLE ? ALLIES : AXIS)
```

`'allies' === 'Allies'` 为 false → `baseSide` 算成 `AXIS` → 15207（德国=axis）不构成跨阵营 → **不产生让权** → 假阴性。

### 3.2 用大写重测（真实路径）

模拟"上一轮美国刚结束 → 新一轮德国"（`current_nation='德国'`、`active='Allies'`、场上有德国空军、德国手牌有 15207）：

```
① on_turn_start 后:
   active        = Axis
   _handoff_base = Allies                      ← 记录了【上一回合】的阵营
   handoff_stack = [{id:'armed', return_active:'Allies', holder_role:'Axis'}]

② 模拟 next_turn 的 21860 行: active = Axis    （回合推进重置，正确）

③ skip_armed_offer（德国点「不打出」）:
   active = Allies        ← ❌ 被过期的 _handoff_base 拉回旧阵营
   current_nation = 德国
   handoff_stack = []，_handoff_base = null

④ 判定：【BUG】active=Allies 而 current_nation=德国 → 轴心"等待对方行动"
```

### 3.3 与 17805 的关系

| | 17805 红色管弦乐队 | 15207 空投补给 |
|---|---|---|
| 载体 | `set_pending_red` 裸写 `game.active` | 只走 `handoff_to` / `reconcile_handoff` |
| 污染方式 | 归还点被 **armed 让权的中间态** 覆盖 | 归还点被 **回合边界的旧阵营** 覆盖 |
| 失效点 | `set_pending_red` 记录的快照 | `rectify_active` 信任 `_handoff_base` |
| 共性 | **handoff 归还基准不可信** | 同左 |

修 17805 时只把 `set_pending_red` 改走栈，**并没有解决 15207** —— 因为这条路径的 `_handoff_base` 本身就是过期的。
所以本次把 `rectify_active` 的栈空分支也一并改为以 `current_nation` 为准。

## 四、仍存疑的三点

### ① `turn_start` 派发时不传 nation → 所有国家的 turn_start 卡在同一时点弹

```js
/* on_turn_start 末尾 */
offer_armed_effects(game, 'turn_start', {})
```

而 `scan_armed_cards` 的过滤是：

```js
if (!ar.watch && actorNation && nation !== actorNation) continue
```

`ctx.nation` 是 `undefined` → **不过滤** → 所有 `when:'turn_start'` 的卡都进候选（当前只有 15207 一张，所以暂时只有一个）。

一旦将来再加别的国家的 `turn_start` 卡，就会变成**跨阵营同时弹窗**，`sync_armed_handoff` 会判 cross 并 `handoff_to` —— 那才是 17805 同款风险的入口。

### ② `echo_mod_active` 要求 `nation === current_nation` → 在非德国回合打出会静默失效

如果 15207 的窗口一直挂着、玩家在**非德国回合**点"打出"（或将来改成跨阵营可见），`run` 会照常消耗 1 张牌，但 `echo_mod_active` 因为 `current_nation !== '德国'` 直接返回 false —— **效果完全不生效**，玩家只会看到"损耗了牌但补给没变"。

这条更像"效果没生效"类反馈，不像卡死。

### ③ `prune_modifiers` 与 `untilTurn: game.turn` 的边界

`on_turn_start` 里先 `prune_modifiers(game)`（清掉 `untilTurn < 当前 turn` 的），再弹 15207。若某次 `game.turn` 自增发生在 `prune` 之后，可能出现"刚打出就被清"或"多留一轮"。需要按现场 `modifiers` 数组核对。

## 五、要定案需要的现场数据

线上服在远端（`119.91.235.21`），本地 `server-mirror/db` 是 2026-09-21 的旧副本，**读不到 game 5731**。

请在任意一方浏览器控制台执行并回贴结果：

```js
JSON.stringify({
  turn: view.turn,
  current_nation: view.current_nation,
  active: view.active,
  my_nation: view.my_nation,
  actions: view.actions,
  block_reason: view.block_reason,
  waiting: view.waiting,
  armed_offers: view.armed_offers,          // 若有下发
  modifiers: view.modifiers,                // 重点看有没有 all_german_supplied
  handoff_stack: view.handoff_stack,
  handoff_base: view._handoff_base,
}, null, 1)
```

判读规则：

| 组合 | 结论 |
|---|---|
| `current_nation=德国` 且 `active='allies'` | 与 17805 同源的让权错乱 |
| `active` 正确但 `actions` 为空 | 别处挂起（pending_*）在拦 |
| `modifiers` 里没有 `all_german_supplied` | 是"效果没生效"，不是卡死 |
| `armed_offers` 非空 | 窗口残留，玩家没点 |

## 六、与已记录 bug 的关系

| 文档 | 载体 | 状态 |
|---|---|---|
| `17805-red-orchestra-active-desync.md` | `pending_red` 裸写 active | 已复现 |
| `17851-uranus-event-budget-no-gate.md` | `event_budget` 无门禁 | 已复现 |
| `17852-status-play-no-action-gate.md` | `pending_status_play` 后端无门禁 | 已复现 |
| `15337-life-leap-double-restore.md` | 响应卡一卡多结算 | 已复现 |
| **本篇 15207** | **armed turn_start（`_handoff_base` 跨回合过期）** | **已复现、已修复** |

本篇与 17805 **共享同一条 handoff 基础设施缺陷**，已一并按"统一 `rectify_active` 兜底 + 禁止裸写 active"处理。

## 七、待办

- [x] 确认是"让权错乱"而非"效果失效"（本地复现，`_handoff_base` 过期）
- [x] 与 17805 合并为同一族修复：`set_pending_red` 走栈 + `rectify_active` 以 current_nation 为准
- [x] 补 smoke：`tools/_smoke_15207_turn_start.js` —— 24 项 **ALL PASS**
  - 跨回合弹窗 + 不打出 → `active` 回到 Axis
  - 跨回合弹窗 + 打出 → `active` 正确、`all_german_supplied` 挂载、德国空军 `in_supply=true`
  - 同回合弹窗 → 不产生让权、`active` 不变
  - `rectify_active` 单测（过期基准 / null 基准 / 终局保护 / 栈非空优先）
- [x] 全量回归：71 个 smoke，失败 2 个（与本改动无关）
- [ ] 提交 / 推送 / 部署 testserver（**未做**）
- [ ] 顺手把 `offer_armed_effects(game,'turn_start',{})` 改为传 `{ nation: game.current_nation }`，
      避免将来加入别国 `turn_start` 卡时跨阵营误弹（**未做，属预防性改动**）

## 八、相关代码位置

| 内容 | 位置（`server-official/public/quartermaster-sub-wars/rules.js`） |
|---|---|
| 15207 卡配置 | 10707–10720 |
| `compute_supply` 里的生效点 | 855–870 |
| `echo_mod_active` | 8897–8905 |
| `on_turn_start`（派发 `turn_start`） | 21593–21626（派发在 21625） |
| 首回合派发 | 21700 |
| `next_turn` 里 `on_turn_start` 与 `active` 重置的顺序 | 21818–21860 |
| `scan_armed_cards`（watch / actorNation 过滤） | 12766–12800 |
| `sync_armed_handoff` | 12926–12941 |
| `rectify_active` | 12913–12921 |

复现脚本：`tools/_repro_15207_turn_start_handoff.js`（当前跑出"正常"，留作后续回归基线）
