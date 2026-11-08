# 审计：应答窗口落在「对手多步/排他挂起」中途 —— 一类系统性问题

> 日期：2026-11-08　性质：**只读审计**（未改代码）
> 脚本：`tools/_audit_window_in_pending.js`、`tools/_probe_window_stuck_states.js`、`tools/_audit_window_gates.js`

## 1. 这一类问题的定义

引擎里有一批"**排他挂起**"：某个动作做到一半等一个交互（多为**对手回合的多步事件**），
期间 `build_actions` 只返回极少数动作、`do_action` 也只放行极少数动作。
如果此时**另一方**手里刚好有一个应答窗口（armed 增强卡 / 桌面响应卡 / 国家技能 / 状态卡瞬间），
那个窗口虽然在 `view` 里下发、客户端也画出来了，但：

- **客户端白名单**没有 `use_armed_offer` / `skip_armed_offer` → `send_action` **静默丢弃**（"点了没反应"）；
- **服务端门禁**也只认某几个动作 → 即使绕过客户端也会被拒（"《X》结算中…"）。

两种都会表现为玩家说的「弹窗点不动 / 卡死」。

## 2. 实测矩阵（我方=Allies 持 armed 窗口；行动方=Axis 正处在某挂起）

| 挂起状态 | 客户端 actions 含 use/skip | 强行发 `use_armed_offer` | 结论 |
|---|---|---|---|
| `pending_echo`（事件多步选地区） | ✅ Y / Y | ✅ 成功结算 | **今天已修**（04f32da） |
| `pending_autobahn`（高速公路） | ✅ Y / Y | ✅ 成功 | 正常（早前已放行） |
| `event_budget`（战斗/建设预算） | ✅ Y / Y | ✅ 成功 | 正常 |
| `pending_battle`（战斗待应答） | ✅ Y / Y | ✅ 成功 | 正常 |
| **`pending_script`（多步脚本卡）** | ❌ 只有 log / propose_rollback | ❌ 被拒「《…》结算中（当前这一步：第 undefined/undefined 步）」 | **卡死（双层漏）** |
| **`pending_status_play`（选状态卡）** | ❌ 只有 log / propose_rollback | ❌ 被拒「《罗科索夫斯基 朱可夫 科涅夫》等待选择状态卡中…」 | **卡死（双层漏）** |
| **`pending_theater`（战区移动，actor=对手）** | ❌ 只有 log / propose_rollback | ✅ **服务端能过** | **假死（只漏客户端）** |
| `pending_econ` / `pending_armed_delegate` / `it_delegate` | 待构造真实场景 | — | 需补测 |

> `pending_theater` 的差异很典型：服务端有 `hasArmedOfferForSide` 兜底（但只对 `actor` 所在阵营放行），
> 客户端分支也是同理 → **当窗口属于"非 actor 阵营"时就被漏掉**。

## 3. 根因（结构性）

这些分支/门禁是**逐个卡牌需求长出来的**，每加一个挂起状态就顺手加一份白名单：

```
build_actions：opening / pending_trigger / response_stack / pending_battle / pending_econ /
               pending_uranus / pending_status_play / pending_theater / pending_autobahn /
               pending_script / national_skill_offer / pending_armed_delegate / delegate(...)
do_action    ：同一批状态各有一段 freeze 判断
```

`hasArmedOfferForSide(game, side)` 这个"万能兜底"只被加进了其中 3 处
（`pending_theater`、`pending_autobahn`、今天补的 `pending_echo`），
**其余分支没有**；`do_action` 侧同样只补过 `wait_intercept` 与 `echo_need`。

→ 所以这不是某一张卡的 bug，而是**"窗口 × 排他挂起"的组合没被统一兜底**：
新增任何一种排他挂起，就会重新引入一次这类问题。

## 4. 修法建议（统一兜底，而不是继续逐个打补丁）

### ① `build_actions`：统一出口助手

```js
/* 任何排他分支 return 前都过一遍：本方持有武装窗口 → 补两个键 */
function with_own_armed(game, side, acts) {
    if (hasArmedOfferForSide(game, side)) {
        acts.use_armed_offer = 1
        acts.skip_armed_offer = 1
    }
    return acts
}
```

把 `build_actions` 里**所有** `return {…}` / `return acts` 改装成 `return with_own_armed(game, side, …)`。
（约 13 处；纯追加，不改原语义。）

### ② `do_action`：把 freeze 收成一个函数

```js
function freeze_reason(game, side, action, arg) {
    /* 本方持有武装窗口时的表态动作，一律不冻结（合法性由 use/skip 自身校验） */
    if ((action === 'use_armed_offer' || action === 'skip_armed_offer') &&
        hasArmedOfferForSide(game, side)) return null
    …原各门禁依次判断，命中则返回文案…
}
```

调用点改为 `const why = freeze_reason(...); if (why) { log(why); return game }`。
以后新增挂起只在 `freeze_reason` 里加一条，**不会再有"忘了豁免"**。

### ③ 同批要不要一起兜住"其它窗口"

同类窗口还有：`use_national_skill`（国家技能）、`activate_status`（状态卡瞬间）、
`trigger_response` / `pass_response`（桌面响应）。它们在不同分支里也各有漏点，
但影响面比 armed 小（响应窗口在 `pending_trigger` 分支里已被显式处理）。

建议：**本次先做 armed 这一类**（已实测 4 处漏点：script / status_play / theater-非actor / econ 待验），
把助手与 freeze 统一后，下一批再按同一套机制接 `national_skill` / `activate_status`。

## 5. 测试计划（统一后跑一次矩阵即可长期守护）

`tools/_real_test_window_in_pending.js`：

```
对 8 种排他挂起 × {armed 窗口属于本方} × {armed 窗口属于对手}：
A ★★ 本方窗口：actions 含 use/skip，且真发能结算（窗口清空、效果生效）
B ★★ 对手窗口：本方不能替对手表态（actions 不含），且本方推进动作被拒（强挂起仍生效）
C ★★ 行动方：在其挂起期间不能借机 next_phase / play_card（原有 B19 语义不回退）
D ★★ 8×2 全绿 → 以后新增挂起只要没加进 with_own_armed 就会失败
```

回归：`test_basic_cards 288/9`、全量冒烟 112、`_real_test_16804_echo_window.js` 10 项。

## 6. 现状（已完成的部分）

```
2026-11-08  04f32da   pending_echo × armed：build_actions + do_action 两处补齐（16804 卡死现场）
本次审计      新增 3 个漏点：pending_script / pending_status_play / pending_theater(非 actor 阵营)
```
