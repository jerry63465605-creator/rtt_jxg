# 17535《租借法案》：自动归还改为手动归还（2026-11-10）

## 报障与口径

玩家：委托苏联打出《建设陆军》后**执行完就直接归还了美国**，此时点苏联桌面
17846《坦克运输》，弃牌框**弃的是美国的牌**；建议「把自动归还改为手动归还会更好」。
玩家确认口径：**A + 统一手动 + 挂起期间禁止结束**（#5 暂时搁置）。

## 只读复现（真实 `R.action` 驱动）

| 观测 | 结果 |
|---|---|
| 委托苏联打出《建设陆军》后（归还前） | `current=苏联  my_nation=苏联` |
| 自动归还后 | `current=美国  my_nation=美国  delegate=null` |
| 此时弃牌框候选 | `view.hands[view.my_nation]` → **美国手牌** |
| 照此提交美国牌给 17846 | 「要弃置的手牌不在手里」，发动被废 |
| 对照提交苏联牌 | `【苏联】弃置 1 张手牌`，代价确实从苏联扣 |

**根因不是服务端 `costPayer` 错**（`32736`/`32879` 遍历 `game.table` 得苏联，正确），
而是 `play.js:8217` 弃牌框取 `view.hands[view.my_nation]`，而
`finish_us_lend_lease`（`7525`）牌一结算就把 `current_nation` 归还美国。
`view.my_nation` 跟随 `current_nation`（见 `rtt-handoff-authority`）。

另确认：17535 **已有** `finish_delegate` 归还机制（`return_nation`/`return_active`
自动捕获），不需要新增；缺的是 17529《摩尔曼斯克运输船队》那种
「留一个玩家可控的收尾点」。

## 方案（A + 统一手动 + 挂起期间禁止结束）

服务端 `rules.js`：

1. `offer_us_lend_lease`：delegate 增 `played:false`。
2. 新增 `lend_lease_nat(dg)`：`nat` / `nation` / `delegate` 三种形态统一取
   （`set_pending_delegate` 写 `delegate`/`nation`，挂起钩子重建对象写 `nat`；
   只认 `nat` 会让即时结算卡恒判 false —— 测试中真实踩到并修正）。
3. 新增 `lend_lease_can_finish(game)` **同源闸门**：`played` 且无任何硬挂起
   （响应栈/队列、`pending_battle`、`pending_econ`、autobahn、theater、echo、
   script、trigger、`event_budget`、`us_theater_delegate` 等）。
   清单与 `do_action` 入口 `hasSuspended` 同口径，但**不**把 `armed_offer` /
   `status_instant` 这类可选窗口算进来——它们正是玩家要在结束前先发动的东西。
   三处共用：白名单 / `exports.action` 兜底 / `view` 下发。
4. `resolve_us_lend_lease_play` 统一收尾（`7520`）：不再 `finish_us_lend_lease`，
   改置 `played=true` 并 `refresh`，操作权留在被委托国。
5. 三个「推迟收尾」钩子同步改为只置 `played`：
   `autobahn_resolve`（`3635`）、`event_finish`（`32606`）、
   `battle_reconcile_active`（`28952`）。统一手动，避免"有时自动有时手动"。
6. 新 action `finish_lend_lease`：三重门禁（委托在册 / 阵营匹配 / can_finish），
   通过才 `finish_us_lend_lease`（摸 1 张 + `finish_delegate` + 美国★技能窗口）。
7. `build_actions`：在 `single` 分支**追加** `finish_lend_lease`（不替换，
   避免排他式提前 return 吞白名单）。
8. `view.us_lend_lease`：`played` 时给 `step:'done'` + `can_finish:true`；
   挂起期间只回 `waiting_for`（客户端隐藏本框，不干扰其它挂起框）。
   该分支必须放在 `!dg.nation` 之前（钩子重建的对象 `nation:null`）。

客户端 `play.js` / `play.html`：

9. `update_us_lend_lease` 新增 `step==='done'` 分支：「结束委托（归还美国）」按钮
   → `send_action('finish_lend_lease')`；`can_finish` 由服务端下发，客户端不二次判断。
   `lend_lease_active` 仍只认 `step==='play'`，done 时自动清空。
10. `play.html` 版本串 `20261110a` → `20261110b`（7 处）。

## 验证

`tools/_real_test_17535_manual_return.js` **31/31**，全程真实 `R.action`：

- A（即时卡，11 项）：不自动归还、`my_nation=苏联`、弃牌框候选全部来自苏联手牌
  （**旧代码下会变红**）、提交美国牌被拒 / 苏联牌发动成功、点结束归还美国 +
  苏联摸 1 张 + delegate 清空。
- B（17827 建设预算）：挂起期间 `finish_lend_lease` 不在册、直接发被拒、
  预算清空后才在册、收尾归还。
- C（17827 + 17846 中途战斗）：战斗挂起期间禁止结束、德国答完 →
  `maybe_resume_autobahn` 恢复 → 续建 → 全挂起清空后放行收尾。
- D（委托英国）：同一套手动归还生效（无国家硬编码）。

回归（均 `git stash` 与 HEAD 对照）：

| 脚本 | 结果 | 备注 |
|---|---|---|
| `node --check` rules.js / play.js | OK | |
| `_real_test_16300_torch_choice` | 39/39 | #9 |
| `_real_test_debug_actions` | 28/28 | #2 |
| `_real_test_17901_choose` | 8/8 | #1 |
| `_real_test_supp_su` | 25/25 | #1 |
| `_smoke_status` | 20/2 | HEAD 同为 20/2，预存 |
| `test_basic_cards` | 288/9 | HEAD 同为 288/9，预存 |
| `_smoke_fr_respond` | 14/3 | HEAD 同为 14/3，预存 |
| `_smoke_delegate` | 8 FAIL | HEAD 逐条一致，预存（脚本自身摆盘已失效） |
| `_smoke_17721` | 1 FAIL | HEAD 一致，预存 |
| `check_reuse.js` | B/C 干净 | 21 WARN 为存量 skill 行号漂移 |

## 已知遗留（本次未动）

- 17828《百团大战》/ 17829《毛泽东》委托打出后需补目标时，
  `7359`/`7382` 分支把 `delegate.nation` 清成 `null`，
  `build_actions` 只放行 `resolve_us_lend_lease_select` 而不放行
  `resolve_us_lend_lease_play` → 委托残留、操作权停在苏联。
  **属另一条 bug，玩家未授权本次一并修**。
- 17810–17814 走 EFFECT 分支时 `pending_echo` 悬挂而委托已收尾，同属遗留。

## 部署

改了 `rules.js` / `play.js` / `play.html`：须**硬重启**对局服务器并探活
`http://localhost:8091/`；客户端强刷即可（版本串已 bump）。
