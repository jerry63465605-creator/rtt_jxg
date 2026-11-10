# 17543《雷达》：立刻挂起询问美国，暂停响应链，答完再继续

> 2026-11-11 玩家口径 → 实施记录
> 相关：`docs/change-17535-pending-target.md`、`docs/pitfalls.md`

## 1. 玩家口径（原话）

> 「当前雷达没有立刻挂起给美国，应该暂停响应链，挂起询问美国雷达后再继续响应」
> 复现场景：`15428 + 15430 + 15438 + 雷达 的情况`

逐项确认（2026-11-11）：

| # | 口径 | 落地 |
|---|---|---|
| 1 | 美国海军**每次**被移除都立刻弹框询问 | 覆盖 `piece_removed` 的全部派发点（战斗 / 断补 / 经济战 / 消灭 / 空军代死），统一收在 `arm_status_instant` 末尾 |
| 2 | **必须回答** | 排他挂起：只放行 `activate_status`（发动）与 `skip_status_ask`（不发动） |
| 3 | 效果**等价响应/增强的一次免死**（17730 的时点与对飞机的处理） | `run` 改走 `protect_restored(game, ctx, {battleOnly:true})`，`restore_piece` 内含 `restore_retreated_airs` |
| 4 | 只给雷达开、不引入通用字段 | `STATUS_EFFECTS['17543'].trigger.askImmediately` 配置开关驱动，逻辑里不写死卡面 id |
| 5 | **仅对雷达例外** | 不推翻 2026-10-17「配给优先」裁定：其它状态卡在挂起期间仍全部置灰 |
| B | **每次被移除都弹，只有发动过一次后才不再弹** | `status_used` 只在 `activate_status` 成功时写；`skip_status_ask` 不写、不消耗次数 |

## 2. 现状与只读探针证据

`tools/_probe_17543_chain_15428_15430_15438.js`：真实建盘 + 暗置 15428/15430/15438 + `R.action` 驱动。

- S0 日本出牌阶段：`play_start` 压 `舰队决战`、`偷袭珍珠港` 两帧（同组，轴心）。
- S3 发动 15428 打掉中太平洋美国海军 → `piece_removed` 派发 → **雷达窗口当场武装**（`status_instant=[17543@piece_removed]`），但响应栈仍有 `偷袭珍珠港[axis]`。
- S3～S10 共 8 步：`active=Axis` 不变、`view(Allies).pending_trigger=null`、
  `view(Allies).table_status[雷达].ready=false`（「有挂起未决事项（响应窗口）」）、
  `view(Allies).actions` **不含** `activate_status`（客户端静默不发），
  `waiting_for` 只是「等待轴心国决定是否发动响应卡」，**没有任何跨阵营挂起字段**。
- S11 响应链清空后雷达才转绿，但此时「本次战斗」已过、免死失去意义。

`tools/_probe_17543_response_pause.js` 另坐实两点：
- 真实栈帧下服务端**直发** `activate_status` 能成功结算（损耗 2 张 + 还原海军），
  但 `view.actions` 缺该 key → 典型白名单死锁。
- **#7 的 4 项真测是假绿**：它手工塞的是派生 `response_queue`（栈为空），
  绕过了 `build_actions_inner` 的 `if (pendingTrigger || top_response_frame(game))`
  提前 return，才走得到 `register_status_actions`。

根因：`arm_status_instant` 只写 `game.status_instant`（**可选软窗口**），
不产生排他挂起、不让权、不下发询问框；而 `piece_removed` 派发点先
`request_responses`（压帧并让权轴心）再 `arm_status_instant`，中间没有任何
「暂停链、先问受害方」的环节。

## 3. 修法

| # | 位置 | 改法 | 为什么 |
|---|---|---|---|
| 1 | `STATUS_EFFECTS['17543'].trigger` | 加声明式 `askImmediately: true` | 配置驱动，避免逻辑里写死 `17543` |
| 2 | `17543.trigger.run` | 改 `protect_restored(game, ctx, {battleOnly:true})`，ctx 从挂起取并对旧形状归一 | 与 17730/15311 同源：救回海军 + 复原撤退空军 + 本次战斗保护；旧 `last_piece_removed` 是 `nation/type`，直接交给原子会注册假保护 |
| 3 | `arm_status_instant` 末尾 | 调 `open_immediate_status_ask(game, window)` | 单一入口覆盖所有 `piece_removed` 派发点；读已武装窗口，不重写 `ready`/`once_per_turn`/`status_active` 判定 |
| 4 | 新增 `open_immediate_status_ask` / `close_immediate_status_ask` | 建 `game.pending_status_ask`（card/nation/side/window/ctx/desc/cost）+ `handoff_to` 让权；收尾 `reconcile_handoff` + `response_reconcile_active` | 让权成对归还；栈帧**原地不动**，不 defer、不搬帧，避开响应栈铁律 8 的「之上/之下」边界坑 |
| 5 | `build_actions` **外层** | 排他分支：应答方 `activate_status` / `skip_status_ask` / `log` / `debug_*`，非应答方只 `log`；`block_reason` 写明 | 放外层是因为内层提前 return 走不到 `register_status_actions`，而外层 `peek/echo/rollback/finish_acts` 会往白名单追加动作造成「看得见点不动」 |
| 6 | `do_action` | 排他守卫（其它动作一律拒）+ `pending_battle` / 响应挂起守卫放行两个答复动作 | 双门禁同源；避免两个挂起互相挡死 |
| 7 | `view` | 挂起期间双方 `pending_trigger` / `response_choice` = null；下发 `pending_status_ask`（仅应答方）、`waiting_for`、`prompt`；`table_status` **只**对雷达放开 ready | 客户端不弹响应框＝链暂停；不推翻配给优先 |
| 8 | `handoff_to` / `response_reconcile_active` | 挂起期间其它让权只登记、不改 `active`；响应 let 权早退 | `deferToTail` / `trigger_response` 收尾会把 `active` 让回轴心，覆盖雷达让权 |
| 9 | 新增 `skip_status_ask` | 清本次窗口条目 + `close_immediate_status_ask`；不写 `status_used`、不清全局 `last_piece_removed` | 口径 B；不清全局是为了不误伤同事件其它 `piece_removed` 状态卡 |
| 10 | `activate_status` 分支末尾 | 成功后 `close_immediate_status_ask`（只认同一 card_id） | 放在末尾，避免新压的 `play_card` 响应帧插到链首改变既有顺序 |
| 11 | `play.js` / `play.html` | `update_pending_status_ask_box()`（发动/不发动两按钮，挂在响应框之后）；`on_click_table_status` 直接答复；`can_act_in_turn` 与手牌点击拦截；版本串 `20261110b`→`20261111a` | 询问框占住 `#ask_box`；桌面卡与弹框同源，避免二次弹框覆盖 |

## 4. 真实测试矩阵

`tools/_real_test_17543_radar_pause.js` — **57 项全过**
（`_board_lib.new_board` 建真实盘面、暗置真实响应卡、全程 `R.action` 驱动）：

| 组 | 覆盖 | 结果 |
|---|---|---|
| A | 15428+15430+15438 链中 S3 当场挂起、让权 Allies、栈帧原地不动、双端 `pending_trigger=null`、白名单排他、`table_status` 仅雷达放开、`waiting_for`、`block_reason` | 16/16 |
| B | 必须回答：轴心 `trigger_response` 与应答方 `play_card` 都被拒且栈帧不变 | 4/4 |
| C | 不发动：清挂起、不写 `status_used`、不损耗牌、窗口作废、响应链按原栈顶继续（deferred「奇袭」帧正常提升）、让权归还 | 8/8 |
| D | 不发动后第二次移除**仍再问**；无响应链时也立刻弹 | 5/5 |
| E | 发动：损耗 2 张、还原海军、**撤退空军拉回原地区**、`battleOnly` protect、写 `status_used`、链继续、本回合不再弹 | 13/13 |
| F | 其它状态卡仍全部置灰（配给优先不变）；英国海军被移除不弹 | 3/3 |
| G | 静态守卫：配置开关、复用 `protect_restored`、无手写 `register_modifier`、白名单登记、客户端框顺序、版本串、无卡面 id 硬编码 | 7/7 |

`tools/_real_test_17543_radar.js` — **重写旧 #7 测试，8 项全过**：
改为真实栈帧驱动，消除「手工塞派生队列」的假绿。

`tools/_dom_test_17543_radar_ask.js` — **10 项全过**（jsdom 加载真实 `play.html` + `play.js`）：
`#ask_box` 未隐藏、标题含《雷达》、恰好「发动 / 不发动」两按钮、
点击分别发 `activate_status{card}` 与 `skip_status_ask`、挂起清除后框自动收起、
非应答方不下发 `pending_status_ask`。

## 5. 回归清单

| 项 | 结果 |
|---|---|
| `node --check rules.js` / `play.js` | 通过 |
| `_real_test_17543_radar_pause.js` | 57/0 |
| `_real_test_17543_radar.js` | 8/0 |
| `_dom_test_17543_highlight.js` | 4/0 |
| `_real_test_window_in_pending.js` | 24/0 |
| `_smoke_air_retreat_restore.js` | 72/0 |
| `_smoke_15430.js` | 17/0 |
| `_smoke_facedown_privacy.js` | 20/0（本次曾因日志插值卡名回归，已改固定文案） |
| `test_basic_cards.js` | 288/9（与基线一致） |
| `tools/check_reuse.js` | B/C 复用检查干净；21 个 A 类 WARN 是 skill 索引行号漂移（预存，见 memory 87295394） |
| 全量冒烟 114 脚本 | 只剩 2 个未登记失败：`_smoke_17535_delegate_return.js`、`_smoke_us_event_a.js`；`git stash` 对照 HEAD 确认均预存 |
| `_smoke_jp_response` 9 / `_smoke_status` 2 / `_smoke_fr_respond` 3 | `git stash` 对照 HEAD 数值完全一致，预存 |

## 6. 边界 / 仍会卡的情形

- **同一次动作里连续移除多支美国海军**（如断补逐支移除）：`arm_status_instant`
  的 `exist` 分支会更新窗口 ctx，但 `pending_status_ask` 只保留**第一支**的 ctx；
  玩家答完只救第一支。与「一回合一次免死」语义一致，属可接受简化。
- **牌库不足 2 张**：`status_window_ready` 的 `can_attrite` 会让窗口 `ready=false`，
  但 `open_immediate_status_ask` 读的是已武装窗口；此时 `arm_status_instant` 不检查代价，
  仍会建挂起、玩家点「发动」会被 `activate_status` 拒绝且挂起不解。
  若日后要收紧，可在 `open_immediate_status_ask` 里加 `can_attrite` 预检（本次未做，避免扩大改动面）。
- **仅 `askImmediately` 声明过的卡**会走此通道；其余 `status_instant` 窗口仍是
  「可选软窗口，做别的事即视为放弃」的既有语义，配给优先裁定未变。
- `pending_status_ask` 是新增状态字段；模块处于测试阶段，未做旧存档兼容迁移。
