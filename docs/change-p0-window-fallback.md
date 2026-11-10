# P0：应答窗口 × 排他挂起的统一兜底（finish_acts / p0_armed_escape）

> 日期：2026-11-10　范围：`rules.js`（1 处出口 + 5 处冻结门禁）
> 起因：16804《花园口决堤》在对手多步事件中途弹窗点不动；审计后确认这是**一类**问题，
> 根因是 13 个排他分支 / 17 段冻结门禁各自手写白名单，"本方持有 armed 窗口"的兜底只补过 3 处。

## 1. 改法（两处，均为"统一出口"）

### ① `build_actions` 出口统一

```js
function finish_acts(game, side, acts) {
    if (!acts || game.__internal_depth) return acts
    if (hasArmedOfferForSide(game, side)) { acts.use_armed_offer = 1; acts.skip_armed_offer = 1 }
    return acts
}

function build_actions(game, side, …) {
    const acts = build_actions_inner(…)
    …（原有 peek / pending_echo / rollback 追加）…
    return finish_acts(game, side, acts)      // ← 唯一出口，覆盖全部 13 个排他分支
}
```

### ② `do_action` 统一豁免

```js
function p0_armed_escape(game, side, action) {
    if (game.__internal_depth) return false
    if (action !== 'use_armed_offer' && action !== 'skip_armed_offer') return false
    return hasArmedOfferForSide(game, side)
}
```

追加到原先**漏掉豁免**的 5 段冻结：`pending_econ` / `pending_red` / `pending_uranus` /
`pending_status_play` / `pending_script`。

> `pending_battle` / `pending_theater` / `pending_autobahn` / `echo_need` / `response_queue` /
> `bureau_wait` / `pending_status_react` 本来已放行 armed，未改动。

## 2. 语义边界（三条不变）

1. **窗口属于对手时**，本方仍不能替它表态（`hasArmedOfferForSide` 按阵营判定）；
2. **行动方的强挂起**（B19：对手有窗口时必须等）完全不变；
3. 动作合法性仍由 `use_armed_offer` / `skip_armed_offer` 自身校验（窗口存在、阵营、代价），
   放行 ≠ 免校验。

## 3. 验证

### `tools/_real_test_window_in_pending.js` → **24/24**

```
A 8 种挂起（echo / script / event_budget / battle / theater / autobahn / status_play / econ）
  × 本方持窗口：actions 含 use/skip，真发能结算（损耗 2 + 消灭日军 + 窗口清空）
  × 行动方：仍无 play_card / next_phase（强挂起不回退）
B 8 种挂起 × 窗口属对手：本方 actions 不含 use/skip（不能替对手表态）
```

### 回归

```
test_basic_cards            288 / 9（基线一致）
全量冒烟 112                 未登记失败：无 ✅
16804 echo 修复 10　17505 一次性 9　16805 衍生卡 8　17506 拦截一次 16
15411 armed 11　两拦截卡链 24　15352 挂起 11　17505 高亮 13　15311 马奇诺 11
```

## 4. 受影响的卡（详见 docs/impact-p0-window-fallback.md）

```
直接：37 张 armed 窗口卡
  · 13 张 watch（窗口不属行动方）→ 唯一"行为真的会变"的子集
  · 20 张多步（need）→ 收益最大（一次发动多次提交，最易被挂起切断）
间接：制造排他挂起的宿主（17532 / 15228 / 17529 / 17805 / 17851 / 15314 链 / 7900 / 15239…）
      —— 代价与效果不变，只是"宿主半途时对手能表态"（B19 既有语义）
零影响：其余 370+ 张（无 armed 窗口 → 兜底条件恒假）
```

## 5. 遗留（P1，未做）

`use_national_skill` / `activate_status` / `trigger_response` 三类窗口在部分挂起里仍可能漏放行；
本次只统一了 armed。矩阵脚本 `_audit_window_in_pending.js` 可直接改 `action` 复用到它们。
