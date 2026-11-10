# 17900《八月风暴》：涉及战斗的让权改为手动归还

> 2026-11-11 玩家口径 → 实施记录
> 相关：`docs/change-neutral-su-japan.md`、`docs/change-17900-discard-modal.md`

## 1. 玩家口径（原话）

> 「继续排查构建英国回合对中国东北发起陆战，苏联持有 17900+建设陆军，
> 以及桌面有噶秋沙+日本中国东部陆军+飞机的情况。
> **所有可能涉及到战斗的让权，都应该手动归还而不是自动归还，避免未能正确成功触发状态**」
> 「17721 不会出现战斗状态卡。重新给计划，**要求无硬挂起**」

| # | 口径 | 落地 |
|---|---|---|
| 1 | 涉及战斗的让权 → 手动归还 | 17900 打出后进入"委托进行中"，玩家点「结束委托」才归还 |
| 2 | 结束要求**无硬挂起** | `armed_delegate_can_finish` 列全硬挂起清单，任一存在即不可结束 |
| 3 | 17721 不改 | 德国只打状态卡，不涉战斗，自动归还正确 |
| 4 | 17729 不改 | 已有 `waiting_battle` 等战斗结算 + `pending_event_step` 停步给状态卡 |
| 5 | 17535 不改 | 2026-11-10 已手动归还（`finish_lend_lease`） |

## 2. 现状与探针证据

`tools/_probe_17900_katyusha_air.js`（真实 `play_card` + `use_armed_offer`）：

| 时点 | `pending_armed_delegate` | `current_nation` | `pending_battle` | 喀秋莎 `ready` |
|---|---|---|---|---|
| S2 待选目标 | 在 | 苏联 | null | true |
| **S3 第二步发起陆战（修复前）** | **null（自动归还）** | **英国** | `defend` | **false** |
| S3 第二步发起陆战（修复后） | **在（played=true）** | **苏联** | `defend` | false |
| S4 日本不代受、战斗结算完（修复后） | **在（can_finish=true）** | **苏联** | null | **true** |

**根因**：`use_armed_offer` 成功后走 `refresh_armed_window` → 扫手牌（17900 已离手）→
`removeArmedWindow` → `clear_pending_armed_delegate` **自动归还**。
而第二步 `do_battle` 因日军空军挂起 `pending_battle`，战斗未结算、`after_land`
状态窗口（喀秋莎）尚未武装 —— 于是委托提前结束、`current_nation` 提前回英国，
状态窗口就落在"别人回合"，6 人模式收不到、玩家也无从判断委托是否还在。

## 3. 修法

| # | 位置 | 改动 |
|---|---|---|
| 1 | 新增 `armed_delegate_can_finish(game)` | ① `pd.played === true`；② 无硬挂起：`response_stack`/`response_queue`、`pending_battle`、`pending_trigger`、`pending_response_choice`、`pending_econ`、`pending_status_play`、`pending_uranus`、`pending_autobahn(_suspended)`、`pending_theater`、`pending_echo`、`pending_script`、`pending_status_ask`、`pending_event_step`、`event_budget`、`us_theater_delegate`、`us_japan_delegate`、`game.delegate`。可选窗口（`armed_offers`/`status_instant`）**不算**硬挂起 —— 它们正是玩家要先发动的 |
| 2 | 新增 `finish_armed_delegate(game)` | 清挂起 + 还 `current_nation` + 移 special 窗口 + 日志 |
| 3 | `refresh_armed_window` | `kind === 'special' && pending_armed_delegate` 时**只置 `played`、保留窗口**，不扫手牌、不 remove |
| 4 | `exports.action` | 新增 `finish_armed_delegate`：三重门禁（有挂起 / 阵营匹配 / `armed_delegate_can_finish`），失败给明确日志 |
| 5 | `build_actions` 外层 | **单一收口（先于 inner 所有挂起分支）**：`played` 时只给被让权方 `finish_armed_delegate`，同时给防守方 `resolve_battle` 与响应表态 + `debug_*`。否则 inner 的 `pending_battle` 分支先返回 `use/skip armed`，形成"委托结束不了、战斗也打不完"的双向死锁 |
| 6 | `do_action` | 战斗守卫 / 响应守卫 / `_oppMoment`（对方时点）守卫放行 `finish_armed_delegate`；`isSameMomentWindow` 豁免它（否则会被 `clear_armed_offer_for_side` 先清掉，只得到"当前没有待结束的让权委托"） |
| 7 | `view.pending_armed_delegate` | 下发 `played` / `can_finish` / `name`（判定由服务端算，客户端照抄） |
| 8 | `play.js` | `update_armed_offer_box` 在 `played` 时渲染「结束委托」；`can_finish=false` 时点按只 toast。`play.html` 版本串 `20261111a`→`20261111b` |

## 4. 真实测试矩阵

`tools/_real_test_17900_manual_finish.js` — **28 项全过**：

| 组 | 覆盖 | 结果 |
|---|---|---|
| A | 第二步发起陆战后：委托仍在、`played=true`、`current_nation=苏联`、`pending_battle=defend`、`view.can_finish=false`；战斗未结算时点「结束委托」被拒且委托保留；双方白名单正确（Allies 有 finish / Axis 有 resolve_battle） | 10/10 |
| B | 日本不代受 → 战斗结算、日军+日机同场移除、`current_nation` 仍苏联、`can_finish=true`、**喀秋莎窗口武装且能真实发动** | 6/6 |
| C | 点「结束委托」才归还英国、委托清空、special 窗口移除、日志正确 | 6/6 |
| D | 对照：刚建窗口（未 played）仍是「打出/不打出」，不含 finish | 2/2 |
| E | 静态守卫：`can_finish` 判 `pending_battle`、special 分支保留、新增动作与白名单、两处守卫放行 | 4/4 |

## 5. 回归清单

| 项 | 结果 |
|---|---|
| `node --check rules.js` / `play.js` | 通过 |
| `_real_test_17900_manual_finish.js` | 28/0 |
| `_real_test_supp_su.js`（旧断言按新口径更新：⑨ 窗口保留 / ⑩ 不自动归还 / ⑩b 点结束才归还） | 26/0 |
| `_real_test_neutral_17900.js`（F9 改为「委托仍在、控制权仍归苏联」） | 33/0 |
| `_dom_test_17900_discard.js`（弃牌框） | 19/0 |
| `_smoke_us_status3.js`（16304 共用 armed_delegate） | 41/0 |
| `test_basic_cards.js` | 288/9（与基线一致） |
| `tools/check_reuse.js` | B/C 干净 |
| 全量冒烟 114 脚本 | 只剩 2 个未登记失败（`_smoke_17535_delegate_return.js`、`_smoke_us_event_a.js`），均为多次 HEAD 对照确认的预存 |

## 6. 边界

- 只有 `kind === 'special'` 且存在 `pending_armed_delegate` 的窗口走手动归还；普通 armed 窗口（17809 等）仍是「打出即收尾」，行为不变。
- `can_finish=false` 时客户端按钮仍显示（置灰语义 + toast 原因），服务端 `do_action` 兜底拒绝 —— 三处同源。
- 委托进行中会屏蔽 `play_card` / 推进阶段等常规动作（只留战斗表态、响应、结束委托、debug），避免"打着打着委托被搁置"。
- 17729 未改：它已有 `waiting_battle`（等 `battle_reconcile_active` 续跑）与 `pending_event_step`（状态卡先行窗口），机制上已等价于手动。
- 若将来新增「涉及战斗的让权」，应复用 `armed_delegate_can_finish` + `finish_armed_delegate` 这套，而不是让它自动归还。

## 7. 实测回归：委托期间漏登记 `activate_status`（玩家 game 19 报障）

**玩家报障**：「我实际测试噶秋沙未能生效啊？你怎么测试生效的？」
`http://localhost:8091/quartermaster-sub-wars/play.html?game=19&role=Allies`

**真实存档（`game_state` game=19）**：

```
current_nation = 苏联, phase = play
status_instant = [{ card_id:'17842#82', window:'after_land', space:22, by:'苏联',
                    ctx:{ space:21, piece:'dbg_11', ... } }]
pending_armed_delegate = { card_id:'17900#86', played:true, return_nation:'英国' }
last_piece_removed = { nation:'日本', space:21, piece:'dbg_11' }
space22 = [ dbg_10:日本/army ]      <-- 喀秋莎要打的目标
苏联陆军东北邻域 = [ dbg_7@24, p12@21 ]
```

**根因**：`view.actions` 里只有 `finish_armed_delegate`，**没有 `activate_status`**：

```
Allies: activate_status = false | activate_status:17842#82 = false | finish_armed_delegate = true
```

客户端 `send_action` 先查 `view.actions[verb]`，查不到就**静默不发** →
玩家点喀秋莎完全没反应。而服务端 `R.action` 直发其实**能成功**
（真实 state 回放：弃 1 张、发起陆战、移除 `dbg_10`、写 `status_used`）——
这正是我此前"测试生效"的原因：**测试全用 `R.action` 直发，绕过了白名单**。

**漏洞来源**：§3 第 5 项在 `build_actions` 外层加的 `pending_armed_delegate.played` 收口
**早退**，只给了 `finish_armed_delegate` + 战斗/响应表态，**没调用 `register_status_actions`**。
而委托进行中恰恰是玩家要发动 `after_land` 状态卡（喀秋莎）的时机。

**修法**：
1. 外层收口补 `register_status_actions(game, side, acts)`（与 inner 同源；它内部仍按
   `status_actions_frozen` 保守：战斗/响应未决时只放行"正处在立刻窗口"的那张卡）；
2. 顺带按 side 收窄：`resolve_battle` 只给 `pending_wait_nation(pb)` 所属方；
   `trigger_response/pass_response/resolve_response_choice/...` 只给 `top_response_frame(game).owner_side`。

**新增测试**（`_real_test_17900_manual_finish.js` B' 组，5 项）：
- Allies 白名单**含** `activate_status` 与 `activate_status:<cid>`；
- Allies 含 `finish_armed_delegate`；
- Axis **不得**有 `activate_status` / `finish_armed_delegate`；
- 战斗已结算 → 双方都**不该**有 `resolve_battle`。

**排查工具**（只读，可复验）：
- `tools/_dump_game19.js [gameId]`：打印真实对局的关键状态；
- `tools/_repro_game19_katyusha.js [gameId]`：加载真实 state，打印 `view.table_status`、
  模拟点击看服务端日志 —— **实测发现该类问题的唯一可靠方式**。
