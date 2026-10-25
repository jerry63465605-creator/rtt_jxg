# 17851《天王星行动》进入战斗预算后可继续打牌（已修复，未提交）

> 状态：**已修复（工作区）+ 回归通过，未提交、未部署**（2026-10-25）
> 卡面：**`<乌克兰>`相邻地区每有 1 支苏联陆军，执行 1 次：对`<乌克兰>`发起 1 次陆战 或 在`<乌克兰>`建设陆军。**
> 卡 id：`17851`｜国家：苏联｜类型：EVENT
>
> ## 修复摘要
>
> - 改动 1（前端）：`build_actions_inner` 里 `event_budget` 从"只追加"改为**收窄 return**，
>   只给 `event_battle` / `event_finish` / `resolve_battle` / `clear_ask` / `toggle_ask_remove` /
>   `air_support` / `log`，再叠 `register_status_actions`（闪电战、15245）与 armed 窗口
> - 改动 2（后端）：`do_action` 新增 `BUDGET_ALLOWED` 冻结，非预算动作一律拒绝
> - 非持有方阵营：前端直接 `{ log: 1 }`，后端同样被冻结
> - 回归：新增 `tools/_smoke_17851_budget_gate.js`（28 项 **ALL PASS**）
> - 全量：70 个 smoke，失败 2 个（`_smoke_15329_intercept_capture` / `_smoke_17537`，均无关）
> - 汇总见 `docs/pending-gate-matrix.md`

## 一、现象

线上对局（testserver，game 5721）实际操作顺序：

1. 苏联打出 17851 → 弹出「对乌克兰陆战 / 建设陆军 / 结束」菜单（`pending_uranus`）
2. 选「发起陆战」→ 进入战斗预算（`event_budget`），等玩家在地图上点目标发兵
3. **此时仍能打出其它牌 / 推进阶段**

玩家口径："发起战斗期间可以打其他牌"。

## 二、复现（真实引擎路径）

脚本：`tools/_repro_17851_budget_gate.js`

```
乌克兰 id = 45 | 相邻陆地 = 东欧,罗斯,莫斯科,中亚,巴尔干,中东
苏联陆军 2 支摆在乌克兰相邻地区
手牌 = ["17851#1", "17816#1"]
```

### ① 打出 17851

```
pending_uranus = { remaining:2, total:2, actor:'苏联', card_id:'17851#1', space:45 }
```

### ② 选「发起陆战」

```
pending_uranus = null                                    ← 挂起被清掉
event_budget   = { card:'17851#1', source:'uranus', remaining:1, uranus_remaining:2 }
turn_phase     = play                                    ← 仍是出牌阶段
```

**关键：`pending_uranus` 被置为 null，改由 `event_budget` 承载流程。**

### ③ view.actions（苏联视角）—— 常规出牌权还在

```
actions = {
  next_phase:1, resource_swap:1, play_card:1, discard_one:1, minus_score:1,
  discard_in_discard_phase:1, air_support:1, remove_piece:1, clear_ask:1,
  resolve_battle:1, toggle_ask_remove:1, resolve_supply:1, next_nation:1,
  log:1,
  event_battle:1, event_finish:1        ← 预算是【追加】的
}
block_reason = null
play_card 在白名单：true
```

不只是 `play_card` —— `next_phase`、`resource_swap`、`discard_in_discard_phase`、`next_nation` 全都在。

### ④ 直接提交第二张事件

```
【苏联】《RDS-1》无法执行：需要弃置 3 张手牌（当前可用 1 张）
第二张还在手牌吗：true
→ 服务端【放行】了第二张 —— BUG
```

这条日志是卡自身代价校验打出来的，说明 `play_card` **已完整进入结算流程**。换一张代价可付的牌就会真的打出去。

### ⑤ 收尾状态

```
event_budget 仍在：true
pending_uranus：null
```

## 三、根因

### ① 选「陆战」时主动清掉挂起

```js
if (action === 'uranus_choice') {
    ...
    if (choice === 'battle') {
        game.event_budget = { card_id: pu.card_id, nation: pu.actor, as: pu.actor,
                              kind:'land', space: pu.space, remaining:1,
                              source:'uranus', uranus_remaining: pu.remaining, ... }
        game.pending_uranus = null        // ← 冻结的载体被清掉了
        return game
    }
```

`pending_uranus` 是**唯一**有"独立白名单 + action 门禁"的载体：

```js
/* build_actions */
if (game.pending_uranus) {
    game.block_reason = 'pending_uranus: 天王星行动等待…'
    if (faction_of_nation(game.pending_uranus.actor) === side) return { uranus_choice:1, log:1 }
    return { log: 1 }
}
```

```js
/* action 入口 */
if (game.pending_uranus && action !== 'uranus_choice' && ...) { ...; return game }
```

一选「陆战」，这套冻结全部失效。

### ② `event_budget` 只做"追加"，没有收窄

```js
/* build_actions：预算进行中且轮到持有方阵营时 */
if (game.event_budget && faction_of_nation(game.event_budget.nation) === side) {
    acts.event_battle = 1
    acts.event_finish = 1
}
```

`acts` 是**常规白名单对象**，这里只是往里加了两个 key，前面已经填进去的 `play_card` / `next_phase` 等**一个都没撤销**。

### ③ action 入口没有 `event_budget` 门禁

统一冻结段里列了 `pending_econ` / `pending_red` / `pending_uranus` / `pending_echo` / `pending_status_play`（后者也缺，见 17852 文档）等，**没有 `event_budget`**。

三层叠加 → 预算期间"什么都能干"。

## 四、与 17852 的区别（两份文档的关系）

| | 17851（本篇） | 17852 |
|---|---|---|
| 载体 | `event_budget` | `pending_status_play` |
| `build_actions` | 只**追加**，常规出牌权仍在 ❌ | **提前 return 独立白名单** ✅ |
| action 入口门禁 | 无 ❌ | 无 ❌ |
| 玩家能不能在 UI 上点到 | **能**（`play_card` 在白名单里） | 不能（点了静默无反应） |

**结论：线上"发起战斗期间能打其他牌"是 17851 这条路径，不是 17852。** 17852 的白名单是有效的，只是后端少一道门禁（属于加固项）。

## 五、影响范围

`event_budget` 由 3 处建立，凡是走战斗预算的卡都可能出现同样问题：

| 建立点 | 来源 |
|---|---|
| 26637 | 17851 天王星行动（本篇） |
| 10662 | 事件卡的战斗预算（声明式 steps 里含"发起战斗"） |
| 17667 | 另一处事件卡战斗预算 |

即：**所有"一次事件发起多场战斗"的卡，在预算期间都没有操作权收窄。**

同时 `next_phase` 也在白名单里 → 玩家可以直接推进阶段，把预算**晾在半空**（`event_budget` 残留，后续 `maybe_advance_after_skip_play` 会一直被它拦住，见 21722）。

## 六、修复方案（待实施，需保留必要的插队窗口）

**注意：不能一刀切冻结** —— 预算期间明确允许这些插队操作：

- `activate_status`（after_land 窗口：闪电战 / 15245 二连打）
- 响应类：`trigger_response` / `pass_response` / `resolve_response_choice` / `response_confirm` / `response_reorder`
- 空军代受 / 抵消：`resolve_battle` / `air_support` / `clear_ask` 等
- `event_battle` / `event_finish`（预算本身的动作）
- 弃牌类代价（响应卡需要）

### 方案 A（推荐）· `build_actions` 里把预算改为"收窄白名单"

```js
if (game.event_budget && faction_of_nation(game.event_budget.nation) === side) {
    const { play_card, next_phase, resource_swap, discard_in_discard_phase,
            next_nation, ...rest } = acts
    game.block_reason = 'event_budget: 战斗预算进行中（' + game.event_budget.remaining + ' 次待发起）'
    return { ...rest, event_battle: 1, event_finish: 1, log: 1 }
}
```

- 保留 `rest`（含状态卡、响应、结算类动作）
- 只摘掉"独立回合动作"

### 方案 B · action 入口补门禁（与方案 A 一起做）

```js
const BUDGET_ALLOWED = new Set(['event_battle','event_finish','activate_status','resolve_battle',
    'trigger_response','pass_response','resolve_response_choice','response_confirm','response_reorder',
    'air_support','clear_ask', ...])
if (game.event_budget && !BUDGET_ALLOWED.has(action) &&
    !String(action).startsWith('debug_') && !(arg && arg.__debug)) {
    game.log.push('战斗预算结算中：请先完成本次发兵，或点「结束」放弃剩余')
    return game
}
```

### 方案 C · 让 `uranus_choice` 不要在选 battle 时清挂起

保留 `pending_uranus`，只标记 `battle_mode = true`。改动最小，但会让"菜单"与"预算"两套状态并存，容易出新问题（不推荐）。

**建议：A + B。** A 让客户端按钮就该消失，B 作为后端兜底。

## 七、待办

- [ ] 实施 A（`build_actions` 预算收窄）+ B（action 入口门禁）
- [ ] 补 smoke：`tools/_smoke_17851_budget_gate.js`
  - 用例 1：选 battle 后 `view.actions.play_card` 应为空
  - 用例 2：直接提交 `play_card` → 被拒，手牌不变，`event_budget` 保留
  - 用例 3：`next_phase` → 被拒，阶段不变
  - 用例 4：`activate_status`（闪电战）仍可提交（不回归）
  - 用例 5：`event_battle` / `event_finish` 正常（不回归）
  - 用例 6：响应卡 `trigger_response` 仍可提交
- [ ] 同步检查 10662 / 17667 两处建立的预算是否同样受益（应自动覆盖）
- [ ] 线上 game 5721 是否已残留 `event_budget`（若残留需清理，否则该局后续阶段可能被 21722 拦住）
- [ ] 回填本文档：最终修法与 commit

## 八、相关代码位置

| 内容 | 位置（`server-official/public/quartermaster-sub-wars/rules.js`） |
|---|---|
| 17851 卡配置（建 `pending_uranus`） | 8988–9012 |
| `uranus_choice`（选 battle → 建预算 + 清挂起） | 26631–26673（关键在 26637–26651） |
| `build_actions`：`pending_uranus` 独立白名单 | 24468–24474 |
| `build_actions`：`event_budget` 只追加 | 24716–24724 |
| action 入口：`pending_uranus` 冻结 | 25395–25400 |
| action 入口：`event_budget` 无冻结 | —— |
| `event_battle` 实现 | 26720–26799 |
| `event_finish`（`source:'uranus'` 重建菜单） | 26803–26840 |
| `maybe_advance_after_skip_play`（预算未清会挡住推进） | 21719–21730 |
| 其他 `event_budget` 建立点 | 10662、17667 |

复现脚本：`tools/_repro_17851_budget_gate.js`
