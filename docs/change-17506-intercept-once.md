# 17506《沉睡的巨人》一次发动问了 3 次拦截（16700《一日之狮》）

> 日期：2026-11-08　范围：`rules.js`（`suspend_armed_use_for_intercept` 一处）
> 玩家实测：打一次 17506，意大利的「是否打出《一日之狮》」被问了 **3 次**。

## 1. 根因

17506 是**多步**增强卡，一次发动要提交 **3 次** `use_armed_offer`：

```
① use_armed_offer{card}                    → need:'choice'（建设陆军 / 建设海军）
② use_armed_offer{card, choice:'army'}     → need:'space'（相邻可建设地区）
③ use_armed_offer{card, choice, space}     → 结算
```

而拦截窗口的派发在 `suspend_armed_use_for_intercept()` 里——**每次**提交都会走一遍：

```js
const key = cardId + '|' + off.when
if (via === 'trigger') {
    game.__trigger_intercept_done = game.__trigger_intercept_done || {}
    if (game.__trigger_intercept_done[key] === freq_key(game)) return false
    // ← 旧实现只"读"不"写"，这个表永远是空的
}
```

`__trigger_intercept_done` **只判不记** → 防抖形同不存在 → 每一步都派发 `enemy_echo_played`
→ 意大利被问 3 次（`via='play'` 的那条走 `echo_intercept_skipped`，本来就有记录，所以只有
"触发式"增强卡会中招，例如 17506 / 15208 / 17511 这类 `when` 不是 `enemy_echo_played` 的）。

## 2. 修法（1 行语义，3 行代码）

```diff
  if (via === 'trigger') {
      game.__trigger_intercept_done = game.__trigger_intercept_done || {}
      if (game.__trigger_intercept_done[key] === freq_key(game)) return false
+     /* 派发即登记"本回合已问过这张实例的这次触发" */
+     game.__trigger_intercept_done[key] = freq_key(game)
  }
```

粒度：`<实例 id>|<来源 when>` + **本国家回合**（`freq_key`），因此：

- 同一张卡的**后续步骤**不再问；
- 同一张卡的**下一次触发**（不同实例、或下一回合）仍会问；
- 不同卡互不影响。

## 3. 验证 `tools/_real_test_17506_intercept_once.js` → **16/16**

```
A ★★ 三次提交全程只问 1 次（日志「等待【意大利】的拦截应答」计数 = 1）
B ★★ 意大利放弃后，第 2、3 步不再问；17506 正常结算（美国部队 +1）
C ★★ 意大利拦截：只问 1 次；17506 无效；意大利 -1 损耗；窗口清空
D ★★ 同一回合**另一份** 17506 实例触发 → 仍会询问（不是全局抑制）
```

对照修复前的实测（探针 `_probe_17506_16700_repeat.js`）：

```
修前：A2 问 1 次 → A5（选地区）又问 1 次 → 加上 choice 步 = 3 次
修后：只 A2 一次；A5 窗口数 = 0
```

## 4. 回归

```
_real_test_paradigm_two_interceptors  24 项 ALL PASS（15352 ↔ 16700 二级链）
_real_test_15352_suspend              11 项 ALL PASS
_smoke_echo_intercept_queue           22 项 ALL PASS
_smoke_armed_trigger_intercept        29 项 ALL PASS
_real_test_15411_armed                11 项 ALL PASS
test_basic_cards                      288 / 9（基线一致）
全量冒烟 112                          未登记失败：无 ✅
```

## 5. 影响面

| 场景 | 修前 | 修后 |
|---|---|---|
| 17606 / 15208 / 17511 等**多步**触发式增强卡 | 每步都问拦截方 1 次 | 只问 1 次 |
| **单步**触发式增强卡 | 1 次 | 1 次（不变） |
| 主动打出的增强卡（`via='play'`） | 由 `echo_intercept_skipped` 管 | 不变 |
| 二级拦截（15352 反制 16700） | 正常 | 正常（回归全绿） |

> 无需客户端改动；`rules.js` 生效需**硬重启 node**。
