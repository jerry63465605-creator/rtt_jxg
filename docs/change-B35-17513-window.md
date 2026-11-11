# B35 · 17513《战时生产委员会》改为「状态卡发动后强制窗口」

> 日期：2026-11-11　玩家拍板：① 强制挂起（涉及日本回合美国发动雷达）② 取消手牌主动打出 ③ 不要二级选卡弹窗
> 改动范围：`rules.js` / `play.js` / `play.html`；`cards.js` 未动。

## 1 玩家口径（原话）

> 「1.强制挂起，因为涉及到日本回合中，美国发动雷达的情况。2.取消 3.不要，给计划」
> （上一轮口径收敛：「仅对 17513，目标我希望发动美国状态后，立刻挂起给窗口可打出 17513」）

推导并确认的一点：**不要二级弹窗** ⇒ 重置目标固定为「刚发动的那张状态卡」，不再让玩家从桌面状态卡里选。

## 2 现状 / 探针证据

`tools/_probe_B35_17513.js`（真实 `arm_status_instant` → `R.action('activate_status')` 发动 17547）：

| 改造前 | 结果 |
|---|---|
| 发动状态卡前 | `hand_ready[17513].ok=false`（需桌面有已发动状态卡） |
| 发动成功后 | `status_used['17547#1']` 写入、`hand_ready[17513].ok=true` —— **变亮可主动打** |
| 是否「立刻挂起窗口」 | `armed_offers=[]` / `view.armed_offer=null` / `us_wartime` 未建立 → **没有** |
| 现状路径 | 玩家自己从手牌点 17513 → `game.us_wartime` 挂起 → 二级选卡弹窗 → `resolve_us_wartime` / `cancel_us_wartime` |

缺口定位：`activate_status` 里只有 `offer_armed_effects('enemy_status_effect')`（敌方拦截），**没有本方状态卡发动后的派发点**；17513 也没有 `armed.when`，`offer_armed_effects` 扫不到它。

**实施前风险探针**：`request_responses('play_card',{from_status:true})`（`rules.js` activate_status 收尾）在本场景 `response_queue=0 / response_stack=0`，不抢窗口；若将来响应链非空，`pending_status_ask` 按雷达同款机制暂停它，答完由 `close_immediate_status_ask` 续跑。

## 3 修法（全部复用现成骨架，不新造挂起机制）

复用 17543《雷达》2026-11-11 的 `askImmediately → pending_status_ask` 骨架：`open_immediate_status_ask` / `close_immediate_status_ask` / `handoff_to`+`reconcile_handoff` / `build_actions` 排他 / `view.pending_status_ask` / action 入口守卫。只加 `kind:'wartime'` 变体。

| # | 位置 | 改法 | 为什么 |
|---|---|---|---|
| 1 | `trigger_ready` | 新增 `kind:'window_only'` 分支（恒不可主动打） | 配置驱动，不写死卡面 id |
| 2 | `CARD_TRIGGERS['17513']` | `conditional + has_used_status` → `window_only + windowAction:'use_wartime_window'` + desc | 取消手牌主动打出 |
| 3 | `play_card` 里的 17513 命令式特例 | 删除（不再建 `game.us_wartime`）；由 `trigger_ready` 统一拒绝 | 取消二级选卡弹窗入口 |
| 4 | 新增 `open_wartime_status_window()` | `activate_status` 成功收尾调用：手牌有窗口专用卡 + `can_attrite(1)` + 该状态卡已写 `status_used` 时建 `pending_status_ask{kind:'wartime', target_card:刚发动卡}`，并 `handoff_to` | 目标固定、不弹空窗；国名/卡面 id 均来自配置，不硬编码 |
| 5 | 新增动作 `use_wartime_window` | 损耗 1 → 删 `status_used[target_card]`/`status_extra` → 17513 从手牌进弃牌堆 → `close_immediate_status_ask()` | 一次结算，无二级弹窗 |
| 6 | `skip_status_ask` | 按 `kind` 分流：wartime 只关窗 + 归还让权，卡留手牌、不付代价 | 放弃出口（错过即失效有收尾） |
| 7 | `build_actions` 的 `pending_status_ask` 排他分支 | wartime 只给 `use_wartime_window` + `skip_status_ask`；非归属方仍只给 `log`；`block_reason` 分流 | 强制挂起、两席位都锁 |
| 8 | action 入口守卫 ×3（状态卡询问 / 战斗挂起 / 响应挂起） | 放行 `use_wartime_window` | 双门禁，避免「点了没反应」与双窗口死锁 |
| 9 | `view.pending_status_ask` | 下发 `kind` / `target_card` / `target_name` | 客户端只照抄，不二次拼判定 |
| 10 | `play.js` | `check_phase_for_card` 加 `window_only` 镜像；`update_pending_status_ask_box` 按 kind 渲染「打出 / 放弃」 | 判定同源 |
| 11 | `play.html` | 版本串 `20261111c` → `20261111d`（7 处） | 客户端改动破缓存 |

**保留但未再触发**：`resolve_us_wartime` / `cancel_us_wartime` / `view.us_wartime` / `update_us_wartime_box()`（旧路径，避免波及其它调用点）。`CMD_IMPL['17513']` 文案同步到新口径。

## 4 真实测试矩阵

`tools/_real_test_B35_17513_window.js` **39 项 ALL PASS**：

| 组 | 断言 | 结果 |
|---|---|---|
| A | 发动后建窗口、kind/target 正确、两席位动作表、block_reason、无 us_wartime | 9/9 |
| B ★★ | 日本回合跨阵营：side 仍 allies、让权给美国、轴心动作被拦、答完 active 归还 Axis | 5/5 |
| C ★★ | 打出：损耗 1、删 `status_used[刚发动卡]`、卡进弃牌堆、无二级弹窗、挂起清空 | 6/6 |
| D | 放弃：卡留手牌、不付代价、未进弃牌堆、`status_used` 保留 | 5/5 |
| E | `hand_ready` 恒灰 + 主动打被拒、卡仍在手牌 | 2/2 |
| F | 不弹空窗：手牌无 17513 / 牌库不足 | 2/2 |
| G | 静态守卫（配置驱动、双门禁、客户端同源、版本串） | 10/10 |

`tools/_dom_test_us_wartime_cancel.js` 按新口径重写 **5 项 ALL PASS**（按钮「打出 / 放弃」→ `use_wartime_window` / `skip_status_ask`；旧二级弹窗不显示）。

`tools/_real_test_17505_17513.js` F/G/H 段按新口径重写 **16 项 ALL PASS**（守卫「旧入口确已关闭」，完整实测交给 B35 主测试）。

`tools/_real_test_17543_radar_pause.js` 增加 E5b「雷达发动后接 B35 窗口」并先答完再断言响应链恢复，**58 项 ALL PASS**；G6 版本串断言由硬编码日期改为「所有 `?v=` 统一且非空」。

## 5 回归清单

```
node --check rules.js / play.js                       OK
_real_test_B35_17513_window.js                       39/0
_dom_test_us_wartime_cancel.js                       5/0
_real_test_17505_17513.js                            16/0
_real_test_17543_radar_pause.js                      58/0
_real_test_17543_radar.js                            8/0
_smoke_armed_multiwindow.js                          20/0
_smoke_us_status_build.js                            20/0
test_basic_cards.js                                  288 / 9（基线一致）
全量冒烟 114 脚本        未登记失败 4 个，与 B34 前完全一致（零新增）
check_reuse.js           B/C 干净；21 WARN 全是既有 A 类索引漂移
```

**回归归因**：`_smoke_armed_whitelist.js`(2 失败) 全文无 `activate_status`/`17513`/`pending_status_ask`，与本次无交集；`_smoke_status.js`(2 失败) 是英国 15338 老失败；两者均已在 `_smoke_skip.json` 白名单。4 个未登记失败（`_smoke_15225` / `_smoke_17535_delegate_return` / `_smoke_axis_pact` / `_smoke_us_event_a`）在 B34 时已存在且逐项 A/B 证明与本轮无关，按「一次只推进一条」不在本条处理。

## 6 边界 / 已知

- 窗口只在「状态卡发动成功且写了 `status_used`」时出现；没有 `once_per_turn` 记账的状态卡不弹（重置无意义）。
- 17513 不在手牌、牌库不足付「损耗 1 张」、或已有别的 `pending_status_ask` 时不弹窗口。
- 放弃不消耗 `once_per_turn`、不付代价；卡一直留在手牌，同一回合下一次状态卡发动仍会再问。
- 目标固定为刚发动的那张状态卡；桌面其它已发动状态卡不在可选范围（玩家口径③）。
- 强制挂起期间两个席位都只放行窗口答复动作与 debug；答完 `close_immediate_status_ask` 成对归还让权并让响应链按原栈顶继续。
- 旧 `us_wartime` 系列代码保留但不再由 17513 触发，待后续统一清理（本条不动，避免外溢）。

## 7 返工 B35-b：打出 17513 后，被重置的状态卡要「立刻显示可再次发动」

**玩家实测（game=19，刷新后）**：先进造船厂 17550 发动 → 打出 17513 → `status_used` 已清、`used_this_turn=false`，但 `view.table_status[17550].ready=false`、`activate_status:17550` 不在册，点不了。

**根因**：删 `status_used` 只清了「本回合已发动」记账，但 `after_build_navy` 这类「X 后立刻」窗口由 `game.status_instant` 条目承载（`status_window_ready` 的 `after_build_navy` 分支第一步就找该条目，找不到直接返回不可发动）。而 `activate_status` 收尾有一条既有规则：发动成功后把**正在发动的这张卡自己**的 `status_instant` 条目无条件滤掉（防止发动完立刻又亮 = 白嫖）；嵌套建设重新武装的**其它卡**（如人工港 17547）保留 → 所以真实盘面里人工港 ready=true、先进造船厂 ready=false。17513 的语义正是「花 1 张牌买回这次发动机会」，必须在结算时把这张卡自己的窗口补回来。

**只读验证**（`tools/_probe_B35_rearm.js`，真实盘面副本）：`I.arm_status_instant(g,'after_build_navy','美国',53)` 后 `status_instant` 多出 `17550#100` 条目、`ready=true`、动作在册，且真的能再发动一次（在北太平洋建设海军）。

**修法（3 处，全部复用现成原子）**：

| # | 位置 | 改法 |
|---|---|---|
| 1 | `open_wartime_status_window()`（新增第 5 参 `instEntry`） | 建挂起时把 `rearm:{window, space, nation}` 落进挂起：window 取 `status_config_of(target_card).trigger.window`；space 优先取同 window 其它卡刚被嵌套建设重新武装的条目，回退发动前本卡条目，再回退 `last_built`（发动这一刻信息最全，`view` 之后 `last_built` 已清） |
| 2 | `activate_status` 收尾 | 把发动前的 `instEntry` 传给 helper 作 space 回退 |
| 3 | `use_wartime_window` 结算 | 顺序固定：**先删 `status_used`/`status_extra`**（否则 `arm_status_instant` 的 `once_per_turn` 预检会跳过本卡）→ **先 `close_immediate_status_ask`**（避免重武装末尾派生 `askImmediately` 挂起被连带清掉）→ 调 `arm_status_instant(game, rearm.window, rearm.nation, rearm.space)` 补窗口 → 卡进弃牌堆。`skip_status_ask`（放弃）**不**重武装 |

按玩家确认的口径，重武装对 `target_card` 配置的 window **统一调一次**（`arm_status_instant` 内部已有 `once_per_turn` / `status_active` / `ready` 全部预检，不会造假窗口；已有条目只更新不重复 push）。

**测试**：`_real_test_B35_17513_window.js` 追加 H 组 9 项 —— 发动 17550 → 挂起带 `rearm` → 复现「本卡窗口被滤掉」→ 打出 17513 → `status_instant` 有 17550 / `ready=true` / 动作在册 → 真的再发动一次成功；放弃对照（不补窗口）；单卡场景（无同 window 同伴时 space 回退仍有效）。合计 **51 项 ALL PASS**。

**回归**：雷达 58、雷达 8、DOM 5、17505/17513 16、`_sim_17550_client` 14、`_smoke_us_status_build` 20、`_smoke_armed_multiwindow` 20、`test_basic_cards` 288/9、全量冒烟 114（未登记失败 4 个与前一轮完全一致，零新增）、`check_reuse` B/C 干净、`node --check` 双文件。

> **注意（不作存档迁移）**：game=19 当前存档已经走过了「打出 17513」那一步，`status_instant` 缺条目是既成事实；代码修复只作用于之后重新走一遍的链路。玩家需用回退/调试面板重走该时点验证，本项目测试阶段不做旧存档兼容迁移。
