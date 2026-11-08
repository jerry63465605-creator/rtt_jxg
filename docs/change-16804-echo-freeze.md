# 16804《花园口决堤》弹窗点不动（卡死）—— echo_need 排他门禁漏放行武装窗口

> 日期：2026-11-08　范围：`rules.js`（`build_actions` + `do_action` 两处）
> 玩家实测：`game 5986`，弹窗出现了，但点「发动」/「不发动」都毫无反应，界面卡死。

## 1. 根因（双层门禁，缺一个都点不动）

16804 是**机会卡（armed）**，触发时点 = 「敌方在<中国东部>征召/建设陆军之后」。
这种触发**天然发生在对手的多步事件中途**（事件 steps 里建陆军后，事件还留着"选地区"没做完）——
于是 `game.pending_echo`（kind='echo_need'）与美国的 armed 窗口**同时存在**。

这正好撞上两道**只放行 play_card / resolve_effect 的排他门禁**：

### ① 客户端侧：`build_actions` 的 pending_echo 分支

```js
if (game.pending_echo && !is_empty_echo_frame(game.pending_echo)) {
    const card = inst_card(game.pending_echo.card)
    if (card && faction_of_nation(card.nation) === side) return { resolve_effect: 1, log: 1 }
    return { log: 1 }                       // ← 美国拿到 {log:1}，没有 use/skip_armed_offer
}
```

客户端 `send_action` 按 `view.actions` 白名单放行，**没这个 key 就静默不发** → 点了没反应。

### ② 服务端侧：`do_action` 的 echo_need 门禁

```js
game.pending_echo.kind === 'echo_need'
  ? (action !== 'play_card' && action !== 'log' && …)      // ← 只放行 play_card
```

即使绕过客户端，`use_armed_offer` 也会被拒回「《X》等待你选择目标（请点地图高亮地区）」。

> 对照：`pending_theater`（L29132）与 `pending_autobahn`（L29165）**早就放行了**
> `hasArmedOfferForSide` 的 use/skip —— 唯独 pending_echo 这两处漏了。

## 2. 修法（两处，都只是"追加白名单"，不改排他语义）

```diff
  // build_actions
  if (game.pending_echo && !is_empty_echo_frame(game.pending_echo)) {
      const acts = …（原有 resolve_effect / log）
+     if (hasArmedOfferForSide(game, side)) {
+         acts.use_armed_offer = 1
+         acts.skip_armed_offer = 1
+     }
      return acts
  }
```

```diff
  // do_action（重写为"允许列表"形式，逻辑等价 + 新增例外）
- if (game.pending_echo && !_emptyEcho && (三元嵌套 …)) { 报错 }
+ const _echoArmedOk = hasArmedOfferForSide(game, side)
+ if (game.pending_echo && !_emptyEcho) {
+     let allowed
+     if (pe.kind === 'echo_need')      allowed = play_card || log || (_echoArmedOk && (use|skip_armed_offer)) || debug
+     else if (!pe.wait_intercept)      allowed = resolve_effect || debug
+     else                              allowed = 拦截表态那一套 || debug   // 战术革新原口径
+     if (!allowed) { 原三条文案; return game }
+ }
```

## 3. 验证 `tools/_real_test_16804_echo_window.js` → **10/10**

```
A ★★ pending_echo（日本）期间，美国 actions 含 use_armed_offer / skip_armed_offer
B ★★ 点「发动」：损耗 2 → 消灭中国东部日军 → 窗口清空；**日本的 pending_echo 保留**（不吞他的事件）
C ★★ 点「不发动」：清窗口 + 「【美国】放弃打出增强卡」；日本侧仍可继续推进自己的挂起
D ★★ pending_echo 属于自己时：仍以 resolve_effect 为排他（没有被放宽）
E ★★ 老口径回归：pending_theater（actor 同阵营）/ pending_autobahn 仍放行武装窗口
```

实测日志（修复后）：

```
【美国】损耗 2 张牌
【美国】打出《花园口决堤》—— 花园口决堤：消灭刚在中国东部建设/征召的敌方陆军
【日本】陆军 从 中国东部 移除
```

## 4. 回归

```
test_basic_cards        288 / 9（基线一致）
全量冒烟 112             未登记失败：无 ✅
_real_test_17505_oneshot 9　_real_test_16805_token 8
_real_test_17506_intercept_once 16　_real_test_15411_armed 11
_real_test_paradigm_two_interceptors 24
```

## 5. 影响面

| 场景 | 修前 | 修后 |
|---|---|---|
| 对手多步事件（echo_need）期间弹出**本方** armed 窗口（16804 / 15351 / 15311 / 17805 …） | 弹窗点不动、卡死 | 可正常发动/放弃 |
| 对手 echo_need 期间，本方尝试打牌/推阶段 | 仍被拦（排他不变） | 不变 |
| `wait_intercept`（战术革新等）口径 | 放行拦截表态 | 不变 |
| 自己的 echo_need（选地区没做完） | 只有 resolve_effect/play_card | 不变 |
