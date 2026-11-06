# B28：调试面板新增「损耗 x / 复原 x」与「阵营分数 ±」

> 日期：2026-11-07　范围：`rules.js`（3 个 debug 动作 + 带外豁免）、`play.html` / `play.js`（面板控件）

## 1. 需求（玩家口径）

> 「给调试卡牌面板里面加一个损耗 x、复原 x；调试阶段里面增加分数增加/减少的功能。
>   复原 x 是将最近进去弃牌堆的 x 张牌按顺序放回到牌堆顶，并且都跟调试卡牌面板，
>   只对当前国家执行即可。」

## 2. 服务端：3 个动作（都在 `do_action` 的 debug 段）

### `debug_attrition { n }`

- 目标 = **当前国家**（经 `delegate_of_nation`，法国/中国落到控制国牌库）；
- 复用 `attrition_cards()`：**牌库顶 → 弃牌堆**，保留全部真实副作用
  （17847《消耗战》计分、15251 记录等）；
- 日志：`【调试】美国 损耗 3 张牌（牌库 76→73，弃牌堆 3）`。

### `debug_restore { n }`

- 取**最近进入弃牌堆**的 n 张（`splice(-n)`），**按原顺序**放回牌库顶（`unshift`）：

```
损耗：deck [A,B,C,D…] → discard […A,B,C]
复原：discard […A,B,C] → deck [A,B,C,D…]      （再抽牌会先抽到 A，与损耗前一致）
```

- 弃牌堆不足时取全部，并在日志注明「不足 N 张」。

### `debug_score { faction, delta }`

- `faction` 只接受 `axis` / `allies`（引擎只有阵营总分 `game.score`）；
- `delta` 为非零整数，可负；日志：`【调试】同盟 分数 +2 → 2`；
- 客户端 `score_panel` 由 `view.score` 驱动，刷新即生效。

> 非法参数（n≤0 / 非数字 / 未知阵营 / delta=0）一律**拒绝并写日志**，不做任何改动。

## 3. 带外豁免：调试动作不再打断进行中的窗口

改之前，**任何**动作（含 `debug_*`）都会走到 `do_action` 入口的
`clear_armed_offer_for_side(game, side)`，把本方阵营的 armed 窗口清掉。
于是"边看边调"时按一下损耗按钮，刚弹出的窗口就没了（`status_instant` 那边早就豁免了 `debug_*`，这里不一致）。

现在统一为：

```js
const isDebugAction = String(action).startsWith('debug_')   // do_action 函数作用域
...
if (!isResponseAction && !isSameMomentWindow && !isDebugAction) clear_armed_offer_for_side(...)
if (!isResponseAction && !isSameMomentWindow && !isDebugAction && …) flush_echo_queue(...)
if (game.pending_event_step && !isStepOwnAction && !isDebugAction && …) { … 作废 … }
if (action !== 'balloon_discard' && action !== 'balloon_done' && !isDebugAction) game.pending_balloon = null
```

即：debug 动作**不清窗口、不放行拦截队列、不作废分步/气球炸弹**。

> 代价：若调试动作改动了窗口候选（例如把某张手牌挪走），窗口里可能残留旧候选；
> 点它时服务端仍会二次校验并拒绝，不会造成脏结算。

## 4. 客户端

### 调试卡牌面板（`#debug_card_panel`）

```
损耗 [ 1 ] 张  [执行损耗]      复原 [ 1 ] 张  [复原到牌库顶]
```

- 只作用于**当前国家**（面板标题已是"调试卡牌（当前国家）"）；
- 非法输入不派发，仅在 `#dbg_pile_hint` 提示「需要填写正整数」。

### 调试阶段面板（`#debug_phase_panel`）

```
分数 [轴心▼/同盟▼] [ 1 ]  [+ 加] [− 减]
```

- `+` 发 `delta = +n`，`−` 发 `delta = -n`。

## 5. 真实测试

### `tools/_real_test_debug_tools.js` → **14/14**

```
A ★★ 损耗 3：牌库 -3 / 弃牌堆 +3，且顺序 = 原牌库顶 3 张依次进弃牌堆末尾
B ★★ 复原 3：牌库顶恢复为损耗前那 3 张（顺序一致）、总数回到原值
C ★  复原超量：弃牌堆只有 2 张时请求 5 → 只复原 2 并提示"不足"
D ★  非法张数（0 / 负数 / NaN / null）→ 拒绝且牌库弃牌堆不变
E ★★ 分数 +2 / -5（可为负），view.score 正确下发
F ★  非法阵营（''/'neutral'/'AXIS!'/delta=0）→ 拒绝且分数不变
G ★★ 不破坏进行中的 armed 窗口 / status_used（带外豁免生效）
H ★  委托国：current=法国 时损耗落到英国牌库（英国 69→67）
```

### `tools/_dom_test_debug_tools.js` → **8/8**

```
A 控件存在（两个张数输入 + 两个执行按钮；阶段面板两个 ± 	按钮）
B ★★ 「执行损耗」→ send_action('debug_attrition', {n:3})
C ★★ 「复原到牌库顶」→ send_action('debug_restore', {n:2})
D ★★ 「+ / −」→ send_action('debug_score', {faction, delta:±2})
E ★  0 张不派发、给出「正整数」提示
```

## 6. 回归

```
test_basic_cards 288 / 9（与基线一致）
全量冒烟 112 全绿（未登记失败：无）
8091 已重启；客户端版本串 bump → ?v=20261107b
```

## 7. 使用提示

- 三个动作都是 `debug_*`，线上需要调试权限（本地已在 `user_may_debug` 放行）；
- 「损耗」会走真实副作用（消耗战计分等），若要"纯掉牌不触发任何卡"，需要另加一个 `silent` 参数（暂未做）；
- 分数只改**阵营总分**，不是地图上的计分标记（marker）。
