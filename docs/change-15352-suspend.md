# B19：增强卡拦截窗口（15352《布莱切利园》）强挂起

> 日期：2026-11-06　范围：`rules.js`　相关卡：15352 布莱切利园 / 16700 一日之狮 / 15353 保持冷静·继续前进

## 1. 玩家口径

> 「增强拦截窗口未挂起，会导致没时间点击就跳过，应该强制挂起。」

即：德国打出增强卡后，英国手里的《布莱切利园》窗口必须**卡住对手的推进**，
直到英国明确「打出 / 不打出」。

## 2. 现状（探针实测）

```js
// do_action 里的「对方时点」门禁
const pn = w.ctx.piece_nation || w.ctx.target_nation
if (!pn) return false            // ← enemy_echo_played 的 ctx 没有这两个字段
```

派发处的 ctx（`rules.js` 的 `resume_echo_queue`）：

```js
offer_armed_effects(game, 'enemy_echo_played', {
    nation: '德国', card: <德国那张增强卡>, space: null, via: 'play', window: 'enemy_echo_played',
})
```

→ 门禁 `return false` → **不挂起**：

```
offers = [{when:'enemy_echo_played', n:1, cards:['15352@英国'], ctxNation:'德国'}]
德国 next_phase → 成功进入空军阶段        ★ 被强挂起 = false
```

同一判据也漏掉了 `enemy_status_effect`（15353），所以状态卡拦截窗口同样不卡人。

## 3. 修法（2 处）

### 3.1 判据改为「卡片归属国」

```js
const _oppMoment = (game.armed_offers || []).find(w => {
    if (!(w.cards || []).length) return false
    const c0 = w.cards[0] || {}
    const ctx = w.ctx || {}
    const pn = c0.nation || ctx.piece_nation || ctx.target_nation
    if (!pn) return false
    const f = faction_of_nation(pn)
    return !!f && f !== side
})
```

- `cards[0].nation` = **谁要表态**，对三类窗口都成立
  （`piece_removed` 的 15311/15351/17808/17811、`enemy_echo_played` 的 15352/16700、`enemy_status_effect` 的 15353）；
- 本方持有的窗口（`after_build_army` 等）仍然 `nation === side` → 不阻塞，保持“错过即失效”。

### 3.2 内部重放豁免（关键，否则死锁）

窗口挡住的应该是**玩家发起的推进动作**；引擎自己的续跑必须放行：
echo 队列放行、状态卡拦截后的重放、弃牌后的 resume 等。

```js
function internal_action(game, role, action, arg) {
    game.__internal_depth = (game.__internal_depth || 0) + 1
    try { return exports.action(game, role, action, arg) }
    finally { game.__internal_depth = Math.max(0, (game.__internal_depth || 1) - 1) }
}
```

- 全库 8 处 `exports.action(game, …)` 内部重放改为 `internal_action(game, …)`；
- 门禁条件增加 `!game.__internal_depth`。

> 没有这条豁免时：英国点「不打出」→ 引擎重放德国的 `play_card` 放行那张增强卡 →
> 重放被门禁再次拦住 → 卡永远不结算（`_smoke_echo_intercept_queue` 实测 4 项失败）。

## 4. 真实测试 `tools/_real_test_15352_suspend.js`（11 项）

```
A 窗口开出（15352 在候选）、只有英方视角可见
B ★★ 窗口存在时德国 next_phase 被拒（「等待【英国】决定是否发动《布莱切利园》」），仍停在出牌阶段
C ★★ 德国 play_card 同样被拒
D 英国「不发动」→ 德国立刻可推进（无死锁）
E ★ 15353 的 enemy_status_effect 窗口同样强挂起
F ★ 本方自有窗口（after_build_army）不阻塞（“错过即失效”不变）
G 静态守卫 3 条（判据读卡片归属国 / 不再要求 ctx / 派发点仍在）
```

## 5. 回归

```
_real_test_15311_suspend        15（静态断言同步为新判据）
_real_test_15353_status_intercept 23
_real_test_17732_borrow_all     88 断言 / 16 张卡
_real_test_17811_bureau_guard   21
_real_test_15410_bushido        18
_real_test_15226_barbarossa     14
_smoke_echo_intercept_queue     22（一度 4 项失败，正是缺 §3.2 豁免）
_smoke_17555_depression         39（断言同步 internal_action）
test_basic_cards                288 / 9（与基线一致）
全量冒烟                        112 全绿
```

## 6. 边界

- 玩家「一直不表态」时对局会停在该窗口（这是预期：对方时点必须有人应答）；
- 断线重连后窗口仍在（`armed_offers` 是持久状态，不依赖连接）；
- 超时/托管逻辑（若有）应调用 `skip_armed_offer`，不走 `resolve_battle`（`bureau_wait` 已按此收紧）。
