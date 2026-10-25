# 挂起 / 预算 的动作门禁总览（2026-10-25 核查）

> 用途：一张表看清"哪些挂起会让玩家什么都点不动"、"哪些还没冻结"。
> 本次修掉：`event_budget`（17851 等）与 `pending_status_play`（17852）。

## 一、双端门禁模型

一个挂起要真正拦住玩家，必须**两端都挡**：

| 端 | 位置 | 作用 | 缺了会怎样 |
|---|---|---|---|
| 前端 | `build_actions_inner()`（24386 起） | 决定 `view.actions` 里有哪些按钮 | 按钮消失 → 玩家点不动（**看得见现象**） |
| 后端 | `do_action()`（25024 起）的冻结段 | 拒绝非法 action | 绕过白名单就能发（**静默越权**） |

历史教训：多处"只做前端"导致过两类事故 ——
① 前端漏登记 → 按钮点了静默无反应；
② 前端排他、后端不冻 → 换个入口就能绕。

## 二、全量对照表

| 挂起字段 | 前端 build_actions | 后端 do_action | 语义 | 状态 |
|---|---|---|---|---|
| `game.game_over` | 排他 `{log}` | 终局守卫 | 强制 | ✅ |
| `game.opening` | 排他（`opening_discard`） | 初始阶段守卫 | 强制 | ✅ |
| `response_stack/queue` | 排他（trigger/pass/choice/confirm/reorder） | 25382 | 强制 | ✅ |
| `pending_battle` | 参数分支排他（`resolve_battle`） | 25389 | 强制 | ✅ |
| `pending_econ` | 排他（`resolve_econ`） | 25446 | 强制 | ✅ |
| `pending_red`（17805） | 排他（`resolve_red`） | 25455 | 强制 | ✅（本次同时修了 handoff 归还点） |
| `pending_uranus`（17851 菜单） | 排他（`uranus_choice`） | 25462 | 强制 | ✅ |
| `pending_echo` | 排他（`resolve_effect`） | 25472 | 强制 | ✅ |
| `pending_autobahn` | 排他（`resolve_autobahn` + 状态卡 + 结束预算） | 25489 | 强制 | ✅ |
| `pending_script` | 排他（`resolve_script`） | 25503 | 强制 | ✅ |
| **`event_budget`** | **追加 → 本次改收窄**（24756） | **本次新增 BUDGET_ALLOWED（25467）** | 强制 | **✅ 本次修** |
| **`pending_status_play`（17852）** | 排他（`su_status_play`/`su_status_skip`） | **本次新增加（25490）** | 强制 | **✅ 本次修** |
| `pending_armed_delegate`（17900 八月风暴） | 排他（use/skip） | ❌ 无 | 强制（让权） | ⚠ **未修** |
| `delegate.mode = german_draw / chain / order` | 排他 | ❌ 无 | 强制（让权） | ⚠ **未修** |
| `delegate.mode = 'single'` | 追加 | ❌ 无 | 强制（让权） | ⚠ **未修** |
| `uk_build_delegate`（17526） | 追加 | ❌ 无 | 强制（让权） | ⚠ **未修** |
| `su_build_delegate`（17529） | 追加 | ❌ 无 | 强制（让权） | ⚠ **未修** |
| `us_theater_delegate`（17532） | 追加 | ❌ 无 | 强制（多步） | ⚠ **未修** |
| `us_china_delegate`（16304） | 追加 | ❌ 无 | 强制（多步） | ⚠ **未修** |
| `us_merchant` / `us_china_build` / `us_replay` / `us_wartime` / `us_political` / `us_japan_delegate` / `us_depression_*` / `su_17817_pending` | 追加 | ❌ 无 | 多为可选窗口 | ⚠ 逐个确认 |
| `pending_event_step` | 追加 + `base.play_card = 0` | 中断即作废（25145） | **可选** | ✅ 设计如此 |
| `pending_balloon` | 排他（`balloon_*`） | 错过即失效 | **可选** | ✅ |
| `national_skill_offer` | 排他 + 故意放行 `play_card` | 清理语义（25093） | **可选** | ✅ |
| `armed_offers` | 排他 + 故意放行 `play_card` | 清理语义 | **可选** | ✅ |
| `peek`（排序弹框） | 包装层补 `play_card` | 不可取消 | 强制 | ✅ |
| `pending_ask` / `pending_hand_limit` | `next_phase` 置 0 | 25480 / 25489 | 强制 | ✅ |

## 三、为什么"追加型"是缺口

`build_actions_inner` 末尾是：

```js
const base = { next_phase: ..., play_card: ..., discard_one: 1, next_nation: 1, ... }
return Object.assign(base, acts)
```

`acts` 里的分支如果只是 `acts.xxx = 1`（追加），`base.play_card` 依然是 `1` → **该阵营能正常打牌**。

本次修的两处正是这种：

- `event_budget` 原代码：`acts.event_battle = 1; acts.event_finish = 1`（追加）
- `pending_status_play` 原本没问题（排他 return），**缺的是后端**

修正后 `event_budget` 改为返回独立收窄对象：

```js
if (game.event_budget) {
    if (faction_of_nation(game.event_budget.nation) !== side) return { log: 1 }
    const bacts = { event_battle:1, event_finish:1, log:1,
                    resolve_battle:1, clear_ask:1, toggle_ask_remove:1, air_support:1 }
    register_status_actions(game, side, bacts)   // 闪电战 / 15245 after_land 窗口
    if (hasArmedOfferForSide(game, side)) { bacts.use_armed_offer = 1; bacts.skip_armed_offer = 1 }
    return bacts
}
```

## 四、"未修"的 4 类的真实风险

这些字段前端是**排他 return**（`pending_armed_delegate` / `delegate.mode`）或**追加**（委托类），
后端都没有对应冻结。分两种情况：

### 情况 A · 排他 return 的（`pending_armed_delegate` / `delegate.mode`）

前端已经点不到别的动作；后端靠 `play_card` 分支里的**回合归属校验**兜底：

```js
if (!isTurnSide(game, side)) { game.log.push('现在轮到【X】行动，…暂不能打牌'); return game }
```

因为这类挂起都会 `handoff_to` 把 `active` 翻给接受方，原方会被这条拒绝。
但**接受方**（= 当前行动方）若提交别的动作，`isTurnSide` 会通过 → 只能靠前端白名单挡。

→ 结论：**中等风险**（仅"换入口"可绕），不是线上已验证的 bug。

### 情况 B · 追加型的（`uk_build_delegate` / `su_build_delegate` / `us_theater_delegate` / `us_china_delegate`）

前端**也没有排他**，`base.play_card` 仍在 → **当前行动方在委托期间可以直接打牌**。

→ 结论：**高风险，语义上应冻结**，与本次修的 `event_budget` 同源。

**本次未改的原因**：这几个字段的结构各不相同（`uk_build_delegate.remaining` 是数组、
`us_theater_delegate` 带多步 sub 状态），手工构造用例时 `view` 会直接抛错
（实测：`dg.remaining is not iterable`）。要安全地加门禁，必须先用真实卡（17526 / 17529 /
17532 / 16304）打出并走到挂起态，逐卡确认"放行集合"后再动手，否则容易把正常路径冻死。

## 五、下一步建议

> 4 类缺口的详细清单、风险分级、逐卡验证清单与待补代码模板，见
> **`docs/delegate-gate-gaps.md`**。

1. 用真实卡构造 4 个委托挂起（17526 民主兵工厂 / 17529 摩尔曼斯克 / 17532 战区移动 / 16304 中国远征军）
2. 先只加**后端**门禁（`do_action` 白名单），前端保持现状 —— 后端挡住就能防越权，且不会让按钮消失
3. 每加一个跑一次全量回归
4. ⚠ 注意 `delegate.mode='chain'`（17721）**必须**保留 `play_card`（德国打状态卡是委托内容），
   `uk_build_delegate` **必须**保留 `activate_status` / armed 窗口（建设会武装 `after_build_army`）

## 六、本次改动摘要

| 文件 | 改动 |
|---|---|
| `rules.js` `build_actions_inner` | `event_budget` 从"追加"改为"收窄 return"（24756–24775） |
| `rules.js` `do_action` | 新增 `BUDGET_ALLOWED` 冻结（25467–25481）、`pending_status_play` 冻结（25490–25496） |
| `tools/_smoke_17851_budget_gate.js` | 新增，28 项 **ALL PASS** |
| 全量回归 | 70 个 smoke，失败 2 个（`_smoke_15329_intercept_capture` / `_smoke_17537`，均与本次无关） |

## 七、判别口径（以后新增挂起照此办理）

1. 先问：这个挂起是**强制**（必须结算完才能继续）还是**可选**（错过即失效）？
   - 可选 → 前端排他 + 故意放行 `play_card`，后端"中断即作废"，**不要冻结后端**
   - 强制 → 两端都要挡
2. 强制挂起的前端必须**排他 return**，不能只 `acts.xxx = 1`
3. 强制挂起的后端必须在 `do_action` 冻结段登记，白名单**只列该挂起自己的动作 + 必须能插队的窗口**
   （`activate_status` / `use_armed_offer` / `skip_armed_offer` / 响应类 / 战斗子窗口）
4. 挂起会跨回合或跨阵营时，让权必须走 `handoff_to` / `reconcile_handoff`，**禁止裸写 `game.active`**
