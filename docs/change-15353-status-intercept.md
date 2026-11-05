# 改动文档：15353《保持冷静》对「非主动发动」德国状态卡的拦截（2026-11-05）

## 1. 背景与问题

德国状态卡有四类执行方式，此前**只有第一类**能被 15353 拦：

| 类型 | 字段 | 卡片 | 执行点 |
|---|---|---|---|
| 主动发动 | `trigger` | 15245 / 15247 / 15248 / 15253 / 15255 / 15242 | `activate_status`（已有拦截） |
| 被攻击反应 | `react.when='attacked'` | 15243 / 15250 / 15252 | `do_battle` → `status_on_attacked()` |
| 经济战反应 | `react.when='econ_target' / 'econ_used'` | 15246 / 15249 / 15251 | `resolve_econ` → `status_on_econ()` |
| 计分阶段自动 | `auto.phase='scoring'` | 15241 / 15244 / 6601 | `phase_scoring()` 循环 |

后三类都是「**先结算、后上报**」（上报只给 15328 密码机做「弃卡」，无法撤销已发生的数值），
所以 15353 的「使其在本回合中无效」对它们根本没有着力点。

## 2. 设计原则：从「事后弃卡」改为「事前询问 + cancel」

**参照对象**：15329《反潜战术》——它在效果结算**之前**触发并 `return { cancel: true }`，
调用方据此中止（`rules.js:29724 / 30212` 的 `intercepted = true`）；而不是 15328 的「事后弃卡」。

**新流程**（三类共用）：

```
① 收集（不结算）：把"本帧将要生效的德国状态卡"整理成 items[]
② 逐张询问：对 items[0] 派发 offer_armed_effects('enemy_status_effect', {nation:'德国', card: cid})
   · 有窗口  -> 存 game.pending_status_react，本帧到此为止（不扣损耗、不加分）
   · 无窗口  -> 立即结算该张，取下一张
③ 玩家表态后（use_armed_offer / skip_armed_offer 收尾）-> flush：
   · 15353 发动 -> 已写 status_suppressed_this_turn[cid] = freq_key -> 该张跳过
   · 15353 不发动/无人拦 -> 结算该张
④ 全部处理完：已结算的卡统一上报 status_attacked（供 15328 弃卡，保持原行为）
```

**为什么不需要"复原"**：询问发生在结算之前，被拦的卡**从未结算过**（损耗没扣、分数没加），
因此不存在回滚问题；比"先扣再退"更安全（不会与 `su_attrition_score` 等计分钩子打架）。

## 3. 数据与函数（新增）

| 名称 | 位置 | 作用 |
|---|---|---|
| `game.pending_status_react` | state | `{ mode:'attacked'\|'econ_target'\|'econ_used'\|'scoring', ctx, items:[...], fired:[...] }` |
| `status_suppressed_now(game, cid)` | 判定 | `status_suppressed_this_turn[cid] === freq_key(game)`（与 15353 写入同源） |
| `try_raise_status_intercept(game, item)` | 派发 | 对单张卡派发 `enemy_status_effect`，返回是否有窗口 |
| `status_on_attacked()` | 改写 | 收集 → `queue_status_react()`（原「先扣后上报」删除） |
| `status_on_econ()` | 改写 | 同上 |
| `phase_scoring()` 前的闸口 | 改写 | 计分阶段开始先询问，被拦的卡在循环里 `continue`，然后才真正计分 |
| `queue_status_react / step_status_react / apply_one_status_react` | 新增 | 挂起、逐张推进、按 mode 结算 |
| flush 钩子 | 改写 | `use_armed_offer` / `skip_armed_offer` 收尾调用 `step_status_react(game)` |
| 动作门禁 | 改写 | 存在 `pending_status_react` 时，只放行 `use_armed_offer / skip_armed_offer / log / debug_*` |

## 4. 15353 的一处小改

原 `15353.run` 会同时写 `status_suppressed_this_turn[cid]` 和 `status_used[cid]`。
「被拦也算用掉」只对**主动发动类**成立；对 `react` / `auto` 类写 `status_used` 会让客户端
显示「本回合已发动」（实际它们不占发动次数）。因此：

```js
if (cfg && cfg.trigger) { game.status_used[cid] = freq_key(game) }   // 仅主动发动类
```
压制（`status_suppressed_this_turn`）**所有类型都写** —— 这是玩家口径。

## 5. 影响面

| 项 | 说明 |
|---|---|
| 覆盖卡 | 15243 / 15246 / 15249 / 15250 / 15251 / 15252（react）；15241 / 15244 / 6601（auto） |
| 不改 | 主动发动类全部逻辑、15352/15328 的既有链路 |
| 不改 | `ongoing` 光环类（15254 / 6601 的光环部分）—— 无"发动时刻"，仍不可拦，见 §7 |
| 风险 | 挂起期间若玩家绕开窗口做别的动作 → 由动作门禁拦回；仍需回归"多张同时触发"与"同一回合二次触发" |

## 6. 测试计划（真实链路，非 mock）

`tools/_real_test_15353_react_intercept.js`（12 项）
- A 无 15353：15250 触发 → 攻击方损耗 2（基线）
- B 有 15353 且发动 → 攻击方**损耗 0**、`status_suppressed_this_turn[15250#x]` 已写
- C 有 15353 但「不发动」→ 损耗 2 照常
- D 15243（限西欧）/ 15252（限德国）：地区不匹配时**不开窗**
- E 15246 被拦 → 德国弃牌堆张数、牌库顶 3 张**不变**
- F 15249 被拦 → `game.score.axis` 不变
- G 同回合第二次触发 → 不再询问、不再生效
- H 下一国家回合 → 恢复

`tools/_real_test_15353_auto_intercept.js`（5 项）
- I 15244 计分 +N 正常；J 被拦 → 分数不变且循环里跳过；K 两张同时命中 → 逐张询问；L 拦过的卡本回合不再问；M 下一回合恢复

回归：`test_basic_cards` 288/9、`_real_test_17848_once_per_turn`、`_real_test_precheck_*`（三组）、全量冒烟 112。

## 7. 明确不做 / 计入待办

- **光环类（`ongoing`）不可拦**：无"发动时刻"，保持现状并在卡片文档注明。
- **15328 密码机对 auto 类仍不上报**（本次不动）→ 已计入待办：是否让 auto 也能被 15328 弃卡（属规则口径变更）。
