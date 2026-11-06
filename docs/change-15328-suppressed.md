# B20：被 15353 压制的状态卡 / 计分类状态卡，15328《破译恩尼格码》应能弃掉

> 日期：2026-11-06　范围：`rules.js`（2 处）　相关卡：15328 破译恩尼格码 / 15353 保持冷静·继续前进

## 1. 玩家口径

> 「被继续前进无效掉的状态，也应该可以被密码机弃掉。」

即：15353 把某张德国状态卡压制成“本回合无效”之后，这张卡**仍然算“发动过”**，
15328 的候选里要能看到它；计分类（auto）状态卡同理。

## 2. 现状（探针实测）

```js
// ① 压制分支（rules.js:8751）
if (status_suppressed_now(game, it.cid)) {
    game.log.push('…已被《保持冷静·继续前进》压制，不生效')
    p.items.shift()
    continue                       // ← 没记 p.fired
}
// ② 收尾（rules.js:8773）
if (fired.length && mode !== 'scoring') notify_german_status_used(game, fired)
                                                  // ← 计分类整类不上报
```

→ `status_attacked` 请求要么不发、要么不带那张卡，`uk_enigma_targets` 永远缺目标。

## 3. 修法（2 处）

### 3.1 压制分支也记账

```js
if (status_suppressed_now(game, it.cid)) {
    game.log.push(…)
    p.fired.push(it.cid)          /* 被压制 ≠ 没发动：15328 要能看到 */
    p.items.shift()
    continue
}
```

### 3.2 去掉 scoring 例外

```js
if (fired.length) notify_german_status_used(game, fired)
```

15241/15244/6601 这类 auto 计分卡结算完也会进 `status_attacked` 请求，
15328 因此在计分阶段之后同样可发动（与 B14 同源）。

15328 自身效果只做「把该状态卡从桌面弃掉」，对已被压制的卡是**幂等**的
（`discard_status_instance` 只处理桌面实例），不会重复记压制。

## 4. 真实测试 `tools/_real_test_15328_discard_suppressed.js`（11 项）

链路全真实：`phase_scoring` → 15353 拦截窗口（`enemy_status_effect`）→ 用 15353（`drop` 付代价）
→ 压制 → 收尾上报 `status_attacked` → `view.pending_trigger` 出现 15328
→ `trigger_response` → `resolve_response_choice {choice: 15241}` → 弃置。

```
A ★★ 计分阶段开出 15353 拦截窗口
B ★★ 15241 被标记压制（status_suppressed_this_turn）
C ★★ 压制后仍上报 → pending_trigger 里有 15328
D ★★ 触发后 response_choice.candidates 含 15241 → 选它 → 从桌面进弃牌堆
E ★  被压制的卡不加分（无「额外得 X 分」）
F ★  无残留（response_queue / response_stack / pending_status_react）
G ★★ 未压制（跳过 15353）时计分结束也上报 → 15328 可触发
H 静态守卫 2 条
```

## 5. 回归

```
_real_test_15353_status_intercept 23、_real_test_17732_auto_scoring 11、
_real_test_17732_borrow_all 88（16 张卡）、_real_test_15352_suspend 11
test_basic_cards 288/9（与基线一致）、全量冒烟 112 全绿
```

## 6. 边界

- 上报用的是**实例 id**（`15241#75`），15328 弃置时按实例定位，卡被别的效果先弃掉则候选自然消失；
- 同一张卡一轮内被压制只记一次（`fired` 去重由 `queue_status_react` 的 items 保证）；
- 计分阶段上报会多开一次响应窗口（英国可跳过），属预期。
