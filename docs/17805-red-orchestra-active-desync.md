# 17805《红色管弦乐队》结算后操作权错乱导致卡死（已修复，未提交）

> 状态：**已修复（工作区）+ 回归通过，未提交、未部署**（2026-10-25）
> 卡面：**任一出牌阶段开始时，选择场上 1 张德国[状态卡]：德国选择 其本回合内无效 或 损耗 2 张牌。**
> 卡 id：`17805`｜国家：苏联｜类型：EFFECT（增强卡 / armed 触发）
>
> ## 修复摘要
>
> - 改动 1：`set_pending_red()` 重写 —— 改走统一让权栈 `handoff_to(game, pr.waiting_for, 'red')` /
>   `reconcile_handoff(game, 'red')`，删除 `game.red_return_active`（3 处引用）
> - 改动 2：`rectify_active()` 加固 —— 栈空且 `_handoff_base` 为 null 时回落
>   `faction_role_of_nation(game.current_nation)`，避免 `active` 被置成 null
> - 回归：新增 `tools/_smoke_17805_red_handoff.js`（25 项 **ALL PASS**）；
>   既有 `_smoke_17805.js` 29 项仍全过
> - 全量：69 个 smoke，按退出码统计仅 2 个失败（`_smoke_15329_intercept_capture` /
>   `_smoke_17537`），均与本改动无关（拦截日志、中国后备征召）
> - **不做线上救局**（玩家口径 2026-10-25：**game 5721 / 5728 及所有测试局一律不补分、不回滚、不热修**）：
>   已卡死或已算错分的那几局不处理，等正式部署后由玩家重开即可

## 一、现场

线上对局（testserver，非本地库）：

```
https://test.genie-rttcn.top/pre/quartermaster-sub-wars/play.html?game=5721&role=Axis
```

玩家反馈：**苏联使用《红色管弦乐队》，德国选择"损耗 2 张牌"后，界面显示轮到德国行动，但顶部提示"等待对方行动"，此后任何操作都无效 → 卡死。**

截图可读到的关键信息：

| 观察 | 说明 |
|---|---|
| 顶部红条「等待对方行动」 | `is_my_turn === false` |
| 手牌 6 张全部"不可发动"（灰） | 同上，白名单为空 |
| 右侧「德国 出牌阶段」、桌面 6 张德国状态卡可见 | `game.current_nation === '德国'` |
| 没有 17805 的二选框（无效 / 损耗 2 张） | `game.pending_red` 已清 —— 结算**已完成** |
| 第 5 回合 | `phase_resource` 刚刚派发过 `nation_turn_start` |

## 二、症状 → 状态机

`view` 里的回合判定就一句：`is_my_turn = (current === game.active)`（`current` 是角色 `'Axis'`/`'Allies'`，`game.active` 是 `'axis'`/`'allies'`）。

三条现象并立，只能推出同一个结论：

> **`game.current_nation === '德国'`（axis），但 `game.active === 'allies'`。**

而代码里没有任何路径会在"非回合切换"时自动矫正 `active`，于是永久卡死。

## 三、根因链（三处叠加）

### ① 苏联的卡在**德国回合**触发 → armed 让权把 active 翻给苏联

17805 配置了 `watch: true`，这是它能"在德/英回合开始时"弹窗的唯一机制：

```js
'17805': {
    name: '红色管弦乐队', actor: '苏联',
    armed: {
        when: 'nation_turn_start', actor: '苏联', watch: true,
        ...
```

德国回合开始 → `phase_resource(game, '德国')` → `offer_armed_effects(game,'nation_turn_start',{nation:'德国'})`
→ `sync_armed_handoff` 判定"窗口持有方阵营（同盟）≠ 当前行动方阵营（轴心）"：

```js
const baseSide = game._handoff_base || (game.active === ALLIES_ROLE ? ALLIES : AXIS)
if (!h) {
    const cross = offers.find(w => w.nation && faction_of_nation(w.nation) !== baseSide)
    if (cross) handoff_to(game, cross.nation, 'armed')     // ← 记 return_active='axis'，active='allies'
```

**此刻状态：`current_nation = '德国'`，`active = 'allies'`，`handoff_stack = [{id:'armed', return_active:'axis'}]`。**

### ② 苏联选完卡 → 17805 裸写 active，并记下了被污染的"归还点"

```js
function set_pending_red(game, pr) {
    game.pending_red = pr
    if (pr) {
        const role = faction_role_of_nation(pr.waiting_for)   // 'axis'
        if (game.active !== role) {
            game.red_return_active = game.active              // ← 记到的是 'allies'
            game.active = role                                // ← active = 'axis'
        }
    }
```

关键在于：**`game.active` 此刻已经不是"本当行动方 axis"，而是被 ① 翻过的 `'allies'`**。
于是 `red_return_active = 'allies'` —— 把中间态当成了归还点。

### ③ 德国选择"损耗 2 张" → active 被还原成 'allies'

```js
        } else if (choice === 1) {
            ...
            attrition_cards(game, waitNation, need)
            ...
            set_pending_red(game, null)      // → game.active = red_return_active = 'allies'
            refresh(game)
            return game
```

**最终：`current_nation = '德国'`（axis）、`active = 'allies'`、`pending_red = null` → 卡死。**

## 四、为什么只在德/英回合崩

同一张卡在**苏联自己回合**发动完全正常：

| 场景 | 发动时 active | `red_return_active` | 结算后 active | current_nation | 结果 |
|---|---|---|---|---|---|
| 苏联回合发动 | `allies` | `allies` | `allies` | 苏联（allies） | ✅ 一致 |
| **德国回合发动** | **被 armed 翻成 `allies`** | **`allies`（污染）** | `allies` | **德国（axis）** | ❌ 卡死 |
| 英国回合发动 | 同上 | 同上 | `allies` | 英国（allies） | ✅ 巧合正确 |

也就是说：**`watch:true` 的全部价值（跨阵营触发）恰好是必崩路径**；苏联自己回合反而是安全的。

## 五、违反项目铁律

项目在 2026-10-16 统一了让权原语，并在代码里写死了规则：

```js
 * 铁律：翻转只能走 handoff_to，归还只能走 reconcile_handoff，
 *       禁止在卡逻辑里裸写 game.active = ... 做让权。
```

同期其他挂起都已改造完毕：

| 挂起 | 实现 |
|---|---|
| `set_pending_econ` | ✅ `handoff_to` / `reconcile_handoff` |
| `set_pending_armed_delegate` | ✅ 同上 |
| `set_pending_battle` | ✅ 同上 |
| **`set_pending_red`（17805）** | ❌ **裸写 `game.active`** |

后果：

- 它不进入 `handoff_stack`，`rectify_active` 看不到它；
- 它记录的归还点会被外层让权污染（本 bug 即此）；
- 多个让权叠加时层级无法裁决。

## 六、次生隐患（同症状，不同源）

```js
function rectify_active(game) {
    if (game.handoff_stack.length) { game.active = top.holder_role; return }
    game.active = game._handoff_base      // ← 若 _handoff_base 已成 null
    game._handoff_base = null
}
```

栈空且 `_handoff_base` 已被前一次 reconcile 清空时，`game.active` 会被置成 **null** —— 表现同样是"永远等待对方行动"。排查时容易与本次 bug 混淆，建议一并加兜底。

## 七、确诊方法（已由本地复现证实）

> **说明**：线上服在 `119.91.235.21`，本地 `server-mirror/db` 是 2026-09-21 的旧副本，**不含 game 5721**。
>
> **2026-10-25 已在本地用真实引擎复现证实**（`tools/_smoke_17805_red_handoff.js` 用例 A：
> 德国回合触发 → armed 跨阵营让权 → 旧实现结算后 `active` 停在 `Allies` 而 `current_nation='德国'`）。
> 下列字段仍可用于线上现场排查。

在任意一方浏览器控制台执行：

```js
JSON.stringify({
  current_nation: view.current_nation,
  active: view.active,                     // 期望 'axis'；若 'allies' 即确诊
  pending_red: view.pending_red,           // 期望 null
  red_return_active: view.red_return_active,  // 若 'allies' 即确诊
  handoff_stack: view.handoff_stack,
  _handoff_base: view._handoff_base,
})
```

确诊条件：`active === 'allies'` **且** `current_nation === '德国'` **且** `pending_red === null`。

（若 `view` 未下发 `red_return_active` / `handoff_stack` / `_handoff_base`，需临时加调试字段或读服务端 state。）

## 八、修复方案（**已采用 B + C 并落地**）

### 方案 A · 最小改动（兜底）—— 未采用

`resolve_red` 收尾时把 active 对齐到真正行动方，而不是用快照：

```js
set_pending_red(game, null)
game.active = faction_role_of_nation(game.current_nation)   // 兜底
refresh(game)
```

- 优点：2 行，立即解卡，风险极低
- 缺点：只治标；`red_return_active` 仍可能污染别处

### 方案 B · 正确改动（推荐，根治）

让 17805 走统一原语，删掉 `red_return_active`：

```js
function set_pending_red(game, pr) {
    game.pending_red = pr
    if (pr) handoff_to(game, pr.waiting_for, 'red')
    else reconcile_handoff(game, 'red')
    return pr
}
```

- `handoff_to` 是幂等的（同一 id 只记一次归还点），层叠由 `rectify_active` 统一裁决
- 与 econ / battle / armed_delegate 完全同款
- 需同步删除 `game.red_return_active` 的所有引用（共 3 处：6558、6563、6564）

### 方案 C · 加固（与 B 一起做）

1. `set_pending_red(pr)` 中若 `game.active === role`，显式把归还点置 null，杜绝快照残留
2. `rectify_active` 的栈空分支加兜底：

```js
game.active = game._handoff_base || faction_role_of_nation(game.current_nation)
```

**B + C 已一起实施（2026-10-25），A 未采用。**

实际落地与本文原方案的差异：C 的第 1 条（`set_pending_red` 里把归还点置 null）**不再需要** ——
改用 handoff 栈后 `red_return_active` 整个字段已删除，不存在快照残留问题。

## 九、待办清单

- [x] 写复现/回归脚本 `tools/_smoke_17805_red_handoff.js`（25 项 **ALL PASS**）
  - A 段：德国回合开始 → 苏联 armed 弹窗 → 选德国状态卡 → 德国选损耗 2 张
    - 断言 `pending_red === null`、`active === 'Axis'`、`current_nation === '德国'`、
      轴心 `view.actions` 非空且含 `next_phase`
  - B 段：同上但选「本回合内无效」，操作权同样回轴心
  - C 段：苏联回合发动（对照，不回归）
  - D 段：重复提交 `resolve_red` 不重复结算
  - E 段：`rectify_active` 兜底（`_handoff_base` 为 null 时 active 不为 null）
- [x] 实施方案 B + C
- [x] 全量 `_smoke_*.js` 回归：69 个，按退出码仅 2 个失败
      （`_smoke_15329_intercept_capture` / `_smoke_17537`，均与本次改动无关）
- [x] 既有 `_smoke_17805.js` 29 项仍全过
- [x] ~~线上 game 5721 热修~~ → **按玩家口径不做线上修复**，不热补丁、不改存档
- [ ] 提交 / 推送 / 部署 testserver（**未做**）
- [ ] 回填本文档：commit hash

## 十、相关文件位置

| 内容 | 位置（`server-official/public/quartermaster-sub-wars/rules.js`） |
|---|---|
| 17805 卡配置（`watch:true`、run、need:'status'） | 11605–11634 |
| `set_pending_red`（**已改为走 handoff 栈**） | 6566–6589 |
| `sync_armed_handoff`（跨阵营让权，触发污染） | 12951–12966 |
| `handoff_to` / `reconcile_handoff` / `rectify_active` | 12898–12945 |
| `resolve_red`（结算 + 清挂起） | 28088–28124 |
| 挂起期间动作冻结 | 25387–25393 |
| `build_actions` 挂起放行 | 24689–24696 |
| `view` 等待提示 | 23873–23881 |
| 触发点（`nation_turn_start` 派发） | 20188–20196 |
