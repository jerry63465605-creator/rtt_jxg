# B34 · KV-2 +《一步也不许后退!》全部拒绝后反复询问

> 日期：2026-11-11　方案：玩家回复「执行」（采纳建议口径「一场战斗每张卡只问一次」）
> 改动范围：`rules.js` 单文件；`play.js` / `play.html` / `cards.js` 未动（无新动作、无新字段）。

## 1 玩家口径（原话）

> 「1.kv+不许后退，全拒绝会反复询问」

相关卡：17837《KV-2 重型坦克》（暗置响应卡）、17853《一步也不许后退!》（暗置响应卡）。

## 2 现状 / 探针证据

只读探针 `tools/_probe_B34_kv2_step_back_loop.js`（`R.setup → debug_place → I.do_battle → R.action('resolve_battle')`）连续 8 次全部拒绝，修复前：

```
stage 序列: kv2_ask -> su_step_back -> kv2_ask -> su_step_back -> kv2_ask -> ... （8 次不停）
最终：pending_battle=kv2_ask  两张暗置响应卡仍在桌面
```

根因：`rules.js` 的 `resolve_battle` 各分支重放 `do_battle(..., resume:true)` 时**只透传自己那一个 done 标记**——

| 位置（修复前） | 传出的标记 |
|---|---|
| `kv2_ask` 拒绝 | 仅 `kv2_done` |
| `su_step_back` 拒绝 | 仅 `su_step_back_done` |
| `kv2` / `su_step_back` 发动 | `guard_done` + 自己的 done |
| `guard` | 仅 `guard_done` |
| `counter` | 无任何 done |
| `defend` | 仅 `guard_done`（2026-11-05 修 guard↔defend 时补的） |

而 `do_battle_inner` 的三条挂起守卫互相独立：`!opt.guard_done && !opt.kv2_done`（KV-2）、`!opt.guard_done && !opt.su_step_back_done`（17853）、`!opt.guard_done`（guard）。拒绝时暗置响应卡**不消耗、不记账**，`pending_battle` 被整体丢弃 → 重放漏带另一个 done 就重新挂起，形成 `kv2_ask ↔ su_step_back` 交替闭环。`resume:true` 只跳过 battleOnly 清理与 `status_on_attacked`，不跳过挂起判定。

同类已修先例：`rules.js` 2026-11-05 注释（guard↔defend 漏带 `guard_done`）；正确写法现成于 `tools/_smoke_15425_defer.js` 的 `skip = {kv2_done, su_step_back_done, guard_done:true}`。

## 3 修法

| # | 位置 | 改法 | 为什么 |
|---|---|---|---|
| 1 | `set_pending_battle` 前 | 新增 `mark_battle_asked(game, pb, key)` + `battle_replay_opt(game, pb, extra)` | 唯一记账入口 + 唯一重放参数构造，杜绝再次漏传 |
| 2 | `do_battle` 入口 | 新战斗（`!isResume && battle_in_progress===0`）清 `game.battle_asked` | 与既有 battleOnly 清理同款判据；resume 重放属同一场，保留 |
| 3 | 7 个重放分支 | 拒绝/发动前 `mark_battle_asked`，重放改走 `battle_replay_opt` | 全量带出 `guard_done / kv2_done / su_step_back_done` |

**载体说明（与原计划的一处实现微调）**：原计划说「在 `pending_battle` 上累积」。实测重放时 `do_battle` 会用**全新对象**调用 `set_pending_battle`（kv2_ask / su_step_back / guard / defend / counter 各建各的 pb），pb 级字段会被整体替换而丢失，无法跨窗口累积。因此权威记账放在 `game.battle_asked`（随存档 JSON 落盘、跨 action 保留），同时在 pb 上写一份镜像供审计；判据仍只读 game 级。核心方案（累积 + 全量透传）不变。

**保持原语义**：三条守卫判定未改；发动分支保留 `guard_done:true`（保护成立即不再问其余保护窗口）；拒绝不消耗卡、卡留桌面；`counter` / `defend` 的 `defend_air`、`_air_used`、`_bureau_depth` 等参数原样透传。

## 4 真实测试矩阵（`tools/_real_test_B34_kv2_step_back_refuse.js`，28 项 ALL PASS）

| 组 | 断言 | 结果 |
|---|---|---|
| A | 两张都拒绝 → 两次询问后战斗结算、陆军移除、卡不消耗、操作权归还 | 6/6 |
| B ★★ | 连续拒绝 8 次：最多两次询问、无窗口重复、pb 清空、卡仍留桌面、记账落盘 | 5/5 |
| C | 只装 17837 / 只装 17853 / 无暗置卡：各问 0~1 次，不空窗 | 5/5 |
| D | KV-2 发动 protect 仍生效且卡被消耗；**另一场独立战斗重新询问**（按场清空） | 7/7 |
| E | 静态守卫：7 处重放统一走 helper、无裸写 done 字面量、三条守卫仍在 | 5/5 |

测试会因 bug 存在而变红：受控 A/B 对照（临时把 helper 切回「只带自己那一个 done」的旧行为，跑完还原 `rules.js`）下本测试 **FAIL 7 项**，新代码 28/28 全过。

## 5 回归清单

```
node --check rules.js / play.js                      OK
tools/_real_test_B34_kv2_step_back_refuse.js        28/0
tools/_smoke_a1a2.js                                全过
tools/_smoke_batch_b.js                             全过
tools/_real_test_battle_air_return.js               26/0
tools/_repro_battle_x_response_deadlock.js          10/0
tools/test_basic_cards.js                           288 / 9（与基线一致）
tools/_run_smoke_report.js                          114 脚本；未登记失败 4 个（见下）
tools/check_reuse.js                                B/C 干净；21 WARN 全是既有 A 类索引漂移
```

**未登记失败的归因（全部预存，与 B34 无关）**：`_smoke_15225.js`(2)、`_smoke_axis_pact.js`(4)、`_smoke_17535_delegate_return.js`(8)、`_smoke_us_event_a.js`(1)。逐个做新旧行为 A/B，失败项完全一致；另 `test_counter_air` 78/2（10.1/10.3，见 `docs/pitfalls.md` 基线）、`_smoke_15425_defer` 10/2（`battle_in_progress` 陈旧断言，见 `docs/talkthrough-2026-10-21.md`）、`_real_test_15410_bushido` 2、`_smoke_17837_kv2_discard` 1（17837 protect「战斗结束即撤销」后的过期断言）也均一致。这些属于本轮之前工作树里的既有失败，按「一次只推进一条」不在 B34 内处理。

## 6 边界 / 已知

- 记账按**一场战斗**有效：同一场内每窗口最多问一次；新一场战斗重新允许询问（D 组已断言）。
- 「拒绝」不消耗暗置响应卡，下一场战斗里仍在桌面、仍可发动（原口径）。
- 探针日志里出现「移除敌方undefined（ undefined ）」是 `battle_desc` 对**挂起态**战斗结果的文案显示（2026-11-05 fix-log 有同名记录），不是本次改动引入，未动。
- 未改客户端 → `play.html` 版本串不 bump；改了 `rules.js` → 需硬重启 8091 才在浏览器生效。
