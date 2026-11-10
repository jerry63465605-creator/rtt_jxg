# 变更：17535《租借法案》委托打出「需补目标」多步卡不再残留（方案 A）

> 日期：2026-11-10
> 方案：`docs/plan-17535-pending-target.md`（玩家回复「A」= 方案 A 的 A1 + A2）
> 正式真实测试：`tools/_real_test_17535_pending_target.js` **ALL PASS（18 项）**
> 改动范围：`rules.js` 单文件，37 增 / 21 删；`play.js` / `play.html` 未动。

## 1. 玩家口径（原话）

- 「我不是说去掉翻转，那17828/17829 委托打出「需补目标」多步卡时 delegate.nation=null 导致委托残留的问题来源是什么，解释一下」
- 「这条做成正式方案 + 真实测试」
- 「A」

即：**保留** `set_pending_delegate` 的控制翻转，不改成「仅额外打出」；要修的是委托残留。
`extra_play` 是「当前行动国自己额外打一张」，不换国家身份，不能替代翻转。

## 2. 现状 / 探针证据（含代码行）

修复前 `node tools/_real_test_17535_pending_target.js` 实测：

```
[A0 选国后] current=苏联 dg.nation=苏联  step=play  v.nation=苏联  acts[sel/play/fin]=/1/
[A1 打出后] current=苏联 dg.nation=null  dg.nat=苏联  dg.played=undefined
            step=nation  v.nation=undefined  acts[sel/play/fin]=1//
[A] log = 【苏联】《百团大战》：《百团大战》需先选择目标地区
[C1 重提] log = 现在轮到【null】打牌，另一阵营暂不能提交
[D 对照]  即时结算卡 D0~D4 全绿（step=done / finish 在册 / 归还美国）
```

卡没被吞、控制权仍在苏联，但打牌动作从白名单消失、选国动作反倒回来，
`view` 弹回「选择委托国」，补完目标重提被 action 门禁直接拒绝。

数据流：`resolve_event_card`（`rules.js:20472`）因 `event_card_needs` 非空返回
`{ok:true,pending:true,need:'space'}`（`20533-20546`）→
`resolve_us_lend_lease_play` 的 `r0.pending` 分支 `put_back_to_hand` 后**重建**
`game.delegate`：`nation:null, ... nat:nat`，且无 `played` 字段。共 **5 处**同类重建
（提交时约 `L7360 / L7383 / L7405 / L7442 / L7514`）。

## 3. 修法（表格：位置 / 改法 / 为什么）

复用点：直接复用上一提交 `08bec5b` 已有的 `lend_lease_nat(dg)`
（`nat || nation || delegate`），**未新增任何原子 / 动作 / 字段**。

### A1 —— 5 处判据统一到 `lend_lease_nat(dg)`（必须）

| 位置 | before → after | 为什么 |
|---|---|---|
| `resolve_us_lend_lease_select` | `dg.nation` → `lend_lease_nat(dg)` | 防重建后 `nation:null` 允许重复选国 |
| `resolve_us_lend_lease_play` 入口 | `if (!dg.nation) return` → `const nat = arg.nation \|\| lend_lease_nat(dg); if (!nat) return` | 旧代码把重提**静默吞掉** |
| `exports.action` 的 play 门禁 | `faction_of_nation(game.delegate.nation)` → `faction_of_nation(lend_lease_nat(...))` | 旧代码恒拒并写「现在轮到【null】打牌」 |
| `build_actions` | `dg.nation` → `llNat` | 旧代码使 `resolve_us_lend_lease_play` 不在白名单（点了没反应） |
| `view.us_lend_lease` | `!dg.nation` / `nation: dg.nation` / `hand: game.hands[dg.nation]` → 全用 `llNat` | 旧代码 `step` 退回 `'nation'`，客户端弹回选国框 |

初始态 `lend_lease_nat` 返回 `null`（三个字段全空），「未选国 → `step:'nation'` +
只登记 select」的既有行为**不变**；重建态返回 `nat`（苏联/英国），续跑链路全部恢复。

### A2 —— 5 处重建写回主字段 + 统一 `played:false`（建议，已一起做）

`nation: null, done: false,` → `nation: nat, done: false, played: false,`

- 消除「同一语义三个字段名（`nat` / `nation` / `delegate`）」的二义，
  防止以后再有裸读 `nation` 的代码踩坑；
- 方案原文只要求给「无收尾钩子」的 2 处补 `played:false`，实施时**统一补到 5 处**：
  重建时「这张牌尚未结算完」是 5 处共同语义；带钩子的 3 处会在挂起完成时
  置 `played=true` 覆盖它，行为不变（D 组与 `_real_test_17535_manual_return.js` 专守此点）。

### 客户端 / 部署

- `play.js` **无需改动**：`lend_lease_active`（`play.js:1998`）由
  `view.us_lend_lease.step/nation` 驱动，`lend_play_action`（`6349`）与
  `submit_basic_card`（`6329`）的重提路由早已实现（改前已确认，非 TODO）。
  A1 后 view 重新下发 `step:'play', nation:'苏联'`，路由自动恢复。
- 只改 `rules.js` → **不 bump `play.html` 的 `?v=`**；改 `rules.js` 必须硬重启服务器。

## 4. 真实测试矩阵（`tools/_real_test_17535_pending_target.js`）

全程真实 `R.action` 驱动，照抄 `tools/_board_lib.js` 与 `_real_test_17828_yiyongjun.js` 的摆盘。

| 组 | 项 | 断言 | 修复前 | 修复后 |
|---|---|---|---|---|
| A | A0/A1/A5 | 选国后 `step='play'`；需补目标时卡回苏联手牌；控制权仍在苏联 | ✓ ×3 | ✓ ×3 |
| A | ★A2/A3/A4 | `delegate.nation='苏联'`；`view.step='play'`；play 动作在白名单 | ✗ ×3 | ✓ ×3 |
| B | B1 | 17829《毛泽东》需补目标时卡回手牌 | ✓ | ✓ |
| B | ★B2/B3/B4 | 同上三项（17829） | ✗ ×3 | ✓ ×3 |
| C | C0 | `event_targets` 候选已下发 | ✓ | ✓ |
| C | ★C1/C2 | 补完目标**真的重提**不被门禁拒；重提后 `delegate.nation='苏联'` | ✗ ×2 | ✓ ×2 |
| D | D0~D4 | 即时结算卡（17800）仍 `step='done'` / `finish` 在册 / 归还美国 | ✓ ×5 | ✓ ×5 |

结果：**FAIL 8 / PASS 10 → ALL PASS（18 项）**。
C 组修复后真的闭环：`【苏联】《百团大战》结算完成（进入战斗），委托待战斗结束后完成
| 【中国】在 中国西部 建设 1 支陆军`，`event_budget` 正常建立。

## 5. 回归清单

| 项 | 结果 |
|---|---|
| `node --check rules.js` / `node --check play.js` | 通过 |
| `_real_test_17535_pending_target.js` | **18/18** |
| `_real_test_17535_manual_return.js` | **31/31**（统一手动归还未被误伤） |
| `_real_test_17828_yiyongjun.js` | 12 FAIL / 14 —— `git stash` 对照 HEAD **完全相同**，预存失败 |
| `_smoke_delegate.js` / `_smoke_17721.js` / `_smoke_status.js` / `_smoke_fr_respond.js` | 8 / 1 / 2 / 3 FAIL，与上一提交记录的预存基线一致 |
| `test_basic_cards.js` | 288 / 9（基线一致） |
| `check_reuse.js` | B/C 段干净；21 WARN 为存量 skill 原子索引行号漂移 |
| `_run_smoke_report.js` | 114 脚本；2 个未登记失败经 HEAD 对照**完全相同**（见下） |

**HEAD 对照**：`_smoke_17535_delegate_return.js`（23 ok / 4 fail）与
`_smoke_us_event_a.js`（56 / 1）在未改动的 HEAD 上结果完全相同 —— 前者是
`08bec5b` 把「自动归还」改成手动归还后遗留的过期断言（仍断言 `event_finish` 自动归还、
点「结束预算」就回美国），与本条无关；已登记为独立待办，本条不扩大改动面。

## 6. 边界（何时仍会卡 / 何时不生效）

- 只修「委托残留」，**不改** 17535 的统一手动归还口径（`08bec5b` 已定）：
  牌结算完仍需玩家点「结束委托」才归还；硬挂起期间仍禁止结束。
- 第 1/4/5 号重建（战斗 / 建设预算 / BASIC 战斗）有独立钩子置 `played=true`，
  本次 A2 的 `played:false` 不改变其结算时序（D 组 + 31 项真测覆盖）。
- **另条遗留（未纳入本条）**：17810–17814 EFFECT 分支 `pending_echo` 悬挂而委托已收尾。
- **#5**（让权中打状态卡）玩家已判定暂时无问题，搁置。
- 两个过期冒烟断言（见 §5）待独立处理，否则全量冒烟汇总仍会列「未登记失败」。
