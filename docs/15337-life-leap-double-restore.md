# 15337《生命的飞跃》一次断补把 2 支部队全部复活（已修复，未提交）

> 状态：**已复现、已修复（工作区）+ 回归通过，未提交、未部署**（2026-10-25）
> 卡面：**法国陆军被移除时：其在本回合内无法被移除。**
> 卡 id：`15337`｜归属：英国（卡面 nation=英国，`actor='法国'`）｜类型：RESPONSE（桌面响应卡）
>
> ## 修复摘要（A + A+ 双保险）
>
> **A+ 压帧去重**（`request_responses`，15754 附近）
> 压帧前先算 `_queuedIds = new Set(response_stack.map(f => f.card_id))`，
> 已在栈上的同 `card_id` 候选不再压第二帧 —— 从源头消除"一张卡多帧"。
>
> **A 结算兜底**（`trigger_response` 循环内，`impl(...)` 之前）
> 校验 `game.table_responses` 里是否还有该 `card_id`；不在则记日志
> 「《X》已不在桌面，该次响应作废」并 `continue`（不执行 effect、不消耗卡）。
> 覆盖存档残留的双帧与其它路径产生的重复帧。
>
> - 回归：新增 `tools/_smoke_15337_multi_remove.js`（17 项 **ALL PASS**）
> - 全量：72 个 smoke，失败 2 个（`_smoke_15329_intercept_capture` / `_smoke_17537`，均无关）
> - 效果：断补 2 支 + 1 张 15337 → 只压 1 帧、只救 1 支、弃牌堆 1 张、第二支留在弃牌区

## 一、现场

线上对局（testserver，game 5721）：

```
补给阶段，法国一次断补 2 支部队，
《生命的飞跃》触发时，两只部队全复活了
```

期望：卡面写"**其**"（单数）—— 一张响应卡只能救**被移除的那一支**，另一支应留在弃牌区外（即被移除）。

## 二、复现（真实引擎路径）

脚本：`tools/_repro_15337_supply.js`

做法（只摆初始局面，其余全走引擎）：

1. `rules.setup()` → 清空法国部队
2. 在**两个断补陆地**各放 1 支法国陆军（实测选中「冰岛」「亚速尔」）
3. `game.table_responses` 放入 `15337#1`（桌面响应卡）
4. 调 `I.resolve_supply(g, '法国')` → 引擎删除 2 支并逐支派发 `piece_removed`
5. 调 `rules.action(g, 'Allies', 'trigger_response', {})` → 打出《生命的飞跃》

### 关键输出

**步骤 4 之后，响应栈压了 2 帧（每支一帧）：**

```
响应栈深度 = 2
  帧: {card:'15337', owner:'allies', on:'piece_removed', piece:'pF1', space:1, group:'rg_1'}
  帧: {card:'15337', owner:'allies', on:'piece_removed', piece:'pF2', space:3, group:'rg_2'}
```

**第一次 `trigger_response`：**

```
复活的部队 = ['pF2']         ← 只救回 1 支（正确）
剩余响应栈深度 = 1
  残留帧: { card:'15337#1', piece:'pF1' }
桌面响应卡里还有 15337 吗： false     ← 卡已被消耗
英国弃牌堆里有 15337 吗：   true      ← 已进弃牌堆
```

**第二次 `trigger_response`（仍是那张已被消耗的卡）：**

```
【响应】《生命的飞跃》触发：该法国陆军本回合不会被移除
【响应】《生命的飞跃》触发：该法国陆军本回合不会被移除

复活的部队 = ['pF2','pF1']   ← 两支全部复活
剩余响应栈深度 = 0
15337 在弃牌堆出现次数 = 1    ← 只用掉 1 张卡，救了 2 支
```

**判定：【BUG 复现】**

## 三、根因

两处叠加。

### ① 逐支派发 → 同一次事件压出多个帧，且每帧绑同一张卡

```js
/* resolve_supply：先全部删除，再逐支派发 */
for (const d of deletedInfo) {
    const ctx = { nation: d.nation, piece: d.pid, piece_nation: d.nation,
                  piece_type: d.type, space: d.space, reason: 'supply' }
    request_responses(game, 'piece_removed', ctx, false)
    ...
}
```

`request_responses` 内部对每张命中的桌面响应卡 `push_response_frame`：

```js
matched.forEach((t, idx) => {
    push_response_frame(game, { card_id: t.card_id, ... ctx: ctx || {}, ... })
})
```

而 `fire_trigger` 每次都能扫到**同一张** `15337#1`（此时它还在桌面）→ 于是 **2 帧持有同一个 `card_id`**，只是 `ctx.piece` 不同。

### ② 结算时不校验"这张卡还能不能用"

`trigger_response` 结算当前帧时，没有检查 `frame.card_id` 是否仍在 `game.table_responses`。

所以：

- 第一次点 → 结算栈顶帧（`pF2`）→ 卡进弃牌堆、桌面移除
- 栈里还留着 `pF1` 那一帧（仍指向 `15337#1`）
- 第二次点 → **照常执行效果**（`restore_piece(ctx)` + `register_modifier(protect)`）→ `pF1` 也回来

结果：**一张卡抵两次用**，弃牌堆里只有 1 张，版面回来 2 支。

## 四、影响范围（同类型卡都会中招）

所有 `on='piece_removed'` 且"事后还原 + 保护"的响应卡，只要同一事件里被移除的部队≥2 支：

| 卡 | 触发条件 | 效果 |
|---|---|---|
| 15330 防御姿态 | 补给状态的英国陆军被移除 | 还原 + 本回合保护 |
| 15332 皇家空军 | 不列颠/北海的英国部队被移除 | 还原 + 保护 |
| 15334 驱逐舰 | 补给状态的英/美海军被移除 | 还原 + 保护 |
| **15337 生命的飞跃** | 法国陆军被移除 | 还原 + 保护 |
| 15420 / 15421 | 日本部队被移除 | 还原 + 保护 |
| 17831 / 17832 / 17833 / 17835 / 17836 | 苏联部队被移除 | 各自还原类 |

**共性**：`piece_removed` 一次派发多支（断补、经济战、战斗连带等）时，这些卡都可能被"一卡多结算"。

反过来也成立：若玩家**只想救 1 支**却点了两次，第二支也会被救 —— 玩家无法表达"只救这一支"。

## 五、修复方案（**已采用 A + A+ 并落地**）

### 方案 A · 结算前校验卡仍可用（已实施，兜底）

`trigger_response` 的结算循环内、调用效果实现之前：

```js
const stillOnTable = (game.table_responses || []).some(r => r.card_id === f.card_id)
if (!stillOnTable) {
    game.log.push('【响应】《' + (f.name || f.card_face) + '》已不在桌面，该次响应作废')
    continue          // 不执行 effect、不消耗卡；整组帧由循环末尾统一清理
}
```

- 覆盖**所有**同类卡（不只是 15337）
- 作为兜底：处理存档残留的双帧、或其它路径产生的重复帧

### 方案 A+ · 压帧时就去重（已实施，主修）

`request_responses` 在 `matched.forEach` 之前：

```js
const _queuedIds = new Set((game.response_stack || []).map(f => f.card_id))
const _toPush = matched.filter(t => !_queuedIds.has(t.card_id))
if (!_toPush.length) return null
const owner_side = _toPush[0].owner_side
```

- 从源头消除"同一张卡被压多帧"，玩家再也看不到第二次空点
- 实测：断补 2 支 → 栈里**只有 1 帧**

**A + A+ 组合的效果**：正常路径由 A+ 拦住（不弹第二次），异常路径由 A 兜底（弹了也作废）。

### 方案 B · 同一次事件只压一帧，由玩家选目标

`request_responses` 增加"事件级合并"：同一 `on` + 同一批次（`deletedInfo` 循环内）只压一帧，`ctx.pieces` 改为**数组**，效果实现里让玩家选救哪支。

- 优点：语义最正确（卡面"其"= 单支，且玩家有选择权）
- 缺点：改动大，涉及所有 `piece_removed` 卡的 `ctx` 契约

### 方案 C · 效果结算后作废同 `card_id` 的残留帧

在 `RESPONSE_EFFECT_IMPL` 执行后，扫描 `response_stack` / `deferred_response_stack`，把 `card_id` 相同的帧全部移除。

- 优点：改动集中，不留"空点"
- 缺点：对其他"一卡多帧"的合法场景可能误伤（需确认是否存在合法复用）

**建议：A 先上（止损，覆盖全部同类卡），再评估 B。**

## 六、附带发现

1. 第二次 `trigger_response` 的日志里出现了**两条**"《生命的飞跃》触发"，但栈只降了 1（1→0）、只复活 1 支。日志重复输出，属于同一次结算里被打印两次（不影响结果，但排查时容易误判"结算了两次"）。
2. `15337` 的 `RESPONSE_EFFECTS.actor = '法国'`，而卡面 `nation = '英国'`。持卡方按 `table_responses` 的 `owner_side` 判定，所以本次没有出错；但 `actor` 与实际持卡国不一致，读代码时容易误以为卡在法国手里。

## 七、待办

- [x] 方案 A：`trigger_response` 结算前校验 `card_id` 仍在 `table_responses`
- [x] 方案 A+：`request_responses` 压帧前按 `card_id` 去重
- [x] 补 smoke：`tools/_smoke_15337_multi_remove.js` —— 17 项 **ALL PASS**
  - A 段：断补 2 支 → 只压 1 帧（A+ 生效）
  - B 段：一次 trigger → 只救 1 支、栈空、弃牌堆 1 张
  - C 段：再 trigger → 「没有等待响应的卡牌」，仍 1 支
  - D 段：手工造双帧（模拟存档残留）→ 第二帧「已不在桌面」作废
  - E 段：单支移除正常复活（不回归）
  - F 段：反向确认 —— 15330 要求"补给状态的英国陆军"，断补移除不该触发
- [x] 全量回归：72 个 smoke，失败 2 个（与本改动无关）
- [ ] 提交 / 推送 / 部署 testserver（**未做**）
- [x] ~~线上 game 5721 回滚~~ → **不做**（玩家口径 2026-10-25：所有测试局一律不补、不回滚）
- [ ] 回填本文档：commit hash

## 八、相关代码位置

| 内容 | 位置（`server-official/public/quartermaster-sub-wars/rules.js`） |
|---|---|
| `resolve_supply`（删除 + 逐支派发） | 964–1030（派发在 1012–1027） |
| `request_responses`（逐卡压帧） | 15696–15750 |
| `fire_trigger`（扫 `table_responses`） | 8755–8820 |
| `trigger_response` 分支 | 25093 起 |
| `15337` 卡配置 | 13963–13974 |
| `15337` 效果实现 | 14487–14491 |
| `restore_piece` | 15905–15914 |
| `is_protected` / `register_modifier` | 18645 附近 |

复现脚本：`tools/_repro_15337_supply.js`
