# B21：状态卡拦截窗口重复询问 + 窗口提示泄露

> 日期：2026-11-06　范围：`rules.js`（2 处）　相关：15353 拦截窗口 / 计分阶段 / 弃牌阶段

## 1. 玩家口径

> 「状态拦截窗口和部分其他窗口在计分、弃牌阶段会两次重复询问，并且日志疑似可见，需要改。」

## 2. 探针实测（`tools/_probe_react_once.js`）

德国桌面 15241《瑞典铁矿》（auto 计分），英国持 15353：

```
手动 phase_scoring            → 开窗 1  [15241]
真实回合 supply → scoring     → 开窗 1  [15241]
真实回合 scoring → discard    → 开窗 1  [15241]   ← 同一张卡【第二次】被问
合计 3 次（其中 2 次属于同一次计分）
日志里「可打出 1 张增强卡」出现 3 次（双方共享 game.log）
```

## 3. 根因（2 处）

| # | 位置 | 问题 |
|---|---|---|
| 1 | `advance_phase()`（离开计分阶段） | 为“落账前重算”调用 `phase_scoring(game, nation, { silent: true })`，而 `phase_scoring` 的**拦截前置块没有区分 `silent`** → 又派发一遍 `enemy_status_effect` 窗口（同一张卡问两次） |
| 2 | `offer_armed_effects()` 末尾 | 无条件 `game.log.push('【X】可打出 N 张增强卡…')`，写进**双方共享**的日志 → 对手能读到“对方手里有拦截卡”；一回合多次触发时还会连刷数行，看起来像“重复询问” |

## 4. 修法（2 处）

```js
// ① 静默重算不打扰玩家（只把分数算准；压制判定在 auto 循环里单独做了）
if (!opts.__afterIntercept && !opts.silent && !game.pending_status_react && …) { … }

// ② 窗口提示只对【本方】可见
if (_out[0].nation === game.current_nation)
    game.log.push('【' + _out[0].nation + '】可打出 ' + _out.length + ' 张增强卡…')
```

对方的时点仍由门禁日志「等待【英国】决定是否发动《布莱切利园》」说明（B19），
窗口本身由 `view.armed_offer` 只发给持有方。

## 5. 真实测试 `tools/_real_test_status_react_once.js`（8 项）

```
A ★★ 同一计分阶段只问 1 次（真实回合 supply→scoring→discard 全程计数）
B ★  没有"同一阶段两个窗口"
C ★★ 对手窗口不写进 game.log（泄漏日志 0 条），窗口本身仍存在
D ★★ 本方窗口（英国回合 + 英国卡）仍会落日志（[[英国] 可打出 1 张增强卡…]）
E ★★ 跳过窗口后计分只结算一次
F 静态守卫 2 条
```

## 6. 回归

```
15353 拦截 23、15328 弃压制卡 11、15352 suspend 11、17732 auto 计分 11、17732 借用 88
test_basic_cards 288/9（与基线一致）
全量冒烟 112 全绿
```

## 7. 边界

- `silent` 重算仍然会跑 `cfg.auto.run`，但循环里已有 `status_suppressed_now` 判定，
  所以被压制的卡不会因重算而加分（B20 已覆盖该断言）；
- 弃牌阶段（`econ` 入口）的拦截窗口走同一套 `queue_status_react`，本次未改其触发时机，
  只保证不再重复（每个阶段各一次）。
