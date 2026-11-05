# 改动文档：B10 空军被移除的时点 + 抵消后可「重新代受」（2026-11-05）

## 1. 玩家口径

1. 苏联陆军【带空军】被【带空军】的敌军攻击时，17811《雅科夫列夫设计局》必须在**消灭陆军之前**给时点；
2. 该增强在**原地**部署新空军后，这支新机可以**再次代替受创**；
3. 部署在**相邻地区**的新机**不参与**本次代受；
4. 「空军被移除」的窗口**对称**：谁掉飞机就给谁开窗（德国掉机同样开）；
5. 挂起期间只允许表态类动作。

## 2. 探针结论（`tools/_probe_b10_design_bureau.js`）

```
代受成立（德国不抵消）：
  log「【德国】不抵消（代受成立）…苏联 用空军代替受创（原目标部队保住）」
      「【苏联】空军 从 东欧 移除」
  东欧 = [su_army]（陆军仍在）        ← 正是"消灭陆军之前"
  armed_offers = []                   ← 17811 窗口【没开】

抵消成立：
  「双方各损失 1 支空军」「陆军 从 东欧 移除」  ← 陆军立刻死，没有补机机会
```

**两条根因**：

| # | 根因 | 证据 |
|---|---|---|
| ① | 代受成立 / 抵消成立 / “无处撤离” 三条路径**只 delete 空军**，从不派发 `piece_removed` | rules.js 21456/21538 等处（原实现） |
| ② | 17811 / 17808 缺少 `watch: true` → 敌方回合掉机时 `offer_armed_effects` 因 `actorNation !== 苏联` 直接跳过 | 与 15311/15351（都带 watch）不对称 |

## 3. 改法

### 3.1 统一派发（对称）

```js
function remove_air_with_piece_removed(game, airId, space, byNation) { … }
function dispatch_air_removed_window(game, ctx) { … }   // 三路：request_responses / offer_armed_effects / arm_status_instant
```

调用点：抵消成立（代受机 + 抵消机）、代受成立（代受机）、“空军无处撤离”连带死亡。

> ⚠ `offer_armed_effects` 以 `when` 为唯一键**合并窗口**：两国各掉 1 架时，第二次调用会把前一国的候选整窗替换。
> 因此新增排队 `game.pending_air_dispatch`：已有同 `when` 且候选非空的窗口时先排队，处理完再派发下一张。

### 3.2 抵消后不立刻打死 victim

`resolve_battle` 的 counter 分支在「发起方选择抵消」时：

1. 立刻移除两架空军（各自派发窗口）；
2. `set_pending_battle({ stage: 'after_air_loss', …, air_used: [代受机, 抵消机] })`；
3. 由 `resume_after_air_loss()` 在**所有窗口清空后**决定：
   - 原地出现**新机**（不在 `air_used` 里）→ 重新进入 defend 阶梯（再次询问是否代受）；
   - 没有 → 按原结果移除 victim（含 `battle` 钩子、`after_land` 窗口、轴心协定/总体战）。

`air_used` 保证每支空军只能用一次 → 空军有限、自然收敛，不会死循环。

### 3.3 挂起与门禁

- `pending_battle.stage === 'after_air_loss'` 期间，`build_actions` 只给表态类动作（沿用既有 pending_battle 分支）；
- 续跑统一挂在 `exports.action` 的 finally：先 flush `pending_air_dispatch`，再判 `after_air_loss` 是否可结算。

## 4. 真实测试（`tools/_real_test_b10_design_bureau.js`，25 项全过）

布阵：苏联 莫斯科/罗斯/乌克兰/东欧 各 1 陆军（补给链）+ 东欧 1 空军；德国 德国 1 陆军 + 1 空军。

| 段 | 内容 |
|---|---|
| A | 代受成立 → 苏联空军死 → ★ 17811 开窗、★ 陆军仍在（消灭之前） |
| B | 用 17811 在**原地东欧**部署 → 新机出现、陆军仍在 |
| C | 抵消成立 → ★ victim 挂起（`after_air_loss`、陆军未死）、★ 苏联侧开窗、两架空军都已移除 |
| D | 在**原地**补机 → ★ 自动重新代受 → 新机代死、陆军保住 |
| E | 在**相邻地区（罗斯）**补机 → ★ 不参与代受 → 陆军被移除、新机在罗斯、无残留 |
| F | 「不发动」→ 陆军按原结果被移除、无残留 |
| G | 手里没有 17811 → 不开窗、陆军被移除（回归） |
| H | 静态守卫 4 条 |

回归：`test_basic_cards` 288/9、`_real_test_b11_window_activate` 18、`_real_test_15353_status_intercept` 23、
`_real_test_15228_air` 12、`_real_test_17747_strait` 16、`_real_test_15206_london` 12、`_real_test_15210_window` 11、
`_smoke_air_retreat_restore` 72、`_smoke_17734_15336_order` 14（断言改为 5 处派发点）、`_smoke_piece_id_unified` 16、
全量冒烟 112 全绿。

## 5. 已知边界

- 17811 部署在相邻地区：不参与代受（玩家确认口径）。
- 第二次代受时，若发起方仍有相邻空军，可以**再次抵消**（同样受 `air_used` 限制）。
- 同一次战斗中两国各掉多架时，窗口逐张派发（排队），不会互相覆盖。
