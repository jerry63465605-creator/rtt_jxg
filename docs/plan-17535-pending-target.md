# 正式方案：17535《租借法案》委托打出「需补目标」多步卡（17828/17829）委托残留

> 状态：**已确认并实施**（玩家 2026-11-10 回复「A」= 方案 A 的 A1 + A2）。
> 本文保留为【方案与修复前实测基线】；实施结果、测试矩阵与回归见
> `docs/change-17535-pending-target.md`。
> 日期：2026-11-10
> 关联提交：`08bec5b`（17535 自动归还 → 统一手动归还）已把「结束委托」链路统一到
> `lend_lease_nat(dg)`；本条处理「继续打牌」链路未统一造成的残留。
> 正式真实测试：`tools/_real_test_17535_pending_target.js`
> （修复前 **FAIL 8 / PASS 10**，红项全部由本 bug 引起；修复后 **ALL PASS 18 项**）。

## 1. 玩家口径（原话）

- 「我不是说去掉翻转，那17828/17829 委托打出「需补目标」多步卡时 delegate.nation=null 导致委托残留的问题来源是什么，解释一下」
- 「这条做成正式方案 + 真实测试」

即：**保留** `set_pending_delegate` 的控制翻转，不改成「仅额外打出」；要修的是委托残留。
（`extra_play` 是「当前行动国自己额外打一张」，不会换国家身份，不能替代翻转。）

## 2. 现状与复现证据（只读核查 + 真实 action）

### 2.1 数据流

1. `offer_us_lend_lease`（`rules.js:7281-7286`）建
   `{mode:'single', nation:null, played:false, return_nation:null, ...}` —— 此时 `nation:null`
   是「尚未选被委托国」的**正确**形态。
2. `resolve_us_lend_lease_select`（`7289-7303`）写 `dg.delegate=nat; dg.nation=nat`，
   调 `set_pending_delegate`（`15898-15914`）→ `current_nation` 翻给被委托国、
   `active` 翻到其阵营、自动捕获 `return_nation='美国'`。
3. 被委托国点 17828/17829 → `resolve_us_lend_lease_play`（`7305`）→
   `resolve_event_card`（`20472`）因 `event_card_needs` 非空返回
   `{ok:true, pending:true, need:'space', desc}`（`20533-20546`）。
   实测候选：`{"need":"space","actor":"中国","step":0,"candidates":[
   {"id":19,"name":"中国西部"},{"id":21,"name":"中国东北"}]}`。
4. 命中 `r0.pending && !r0.armedPause` 分支（`7364-7385`）：
   `put_back_to_hand`（卡回手牌，正确）+ **重建** `game.delegate`：
   `nation:null, ..., resume_after_battle:false, nat:nat`（`7378-7382`），
   且**没有 `played` 字段**。

### 2.2 实测输出（`node tools/_real_test_17535_pending_target.js`）

```
[A0 选国后]   current=苏联 active=Allies dg.nation=苏联  step=play  v.nation=苏联  acts[sel/play/fin]=/1/
[A1 打出后]   current=苏联 active=Allies dg.nation=null  dg.nat=苏联  dg.played=undefined
              step=nation  v.nation=undefined  acts[sel/play/fin]=1//
[A] log = 【苏联】《百团大战》：《百团大战》需先选择目标地区
[C1 重提]     log = 现在轮到【null】打牌，另一阵营暂不能提交
[D 对照]      即时结算卡 D0~D4 全绿（step=done / finish 在册 / 归还美国）
```

关键点：卡没被吞、控制权仍在苏联，但**打牌动作从白名单消失、选国动作反倒回来了**，
`view` 弹回「选择委托国」，补完目标重提被 action 门禁直接拒绝。

### 2.3 5 处同类重建（全部 `nation:null` + `nat:nat`）

| # | 行 | 触发条件 | 有无独立收尾钩子 |
|---|---|---|---|
| 1 | `7344-7359` | `r0.cardResolved`（事件落地为战斗） | 有：`28950` / `32606` 置 `played=true` |
| 2 | `7367-7382` | `r0.pending && !r0.armedPause`（**需补目标 ← 17828/17829**） | **无** |
| 3 | `7389-7404` | `r0.armedPause` | **无** |
| 4 | `7426-7441` | `game.pending_autobahn`（17827 建设预算） | 有：`3632` 置 `played=true` |
| 5 | `7498-7513` | BASIC 卡 `r.pending`（战斗） | 有：`28950` 置 `played=true` |

## 3. 根因

`nation` 是「继续打牌」链路的唯一判据，重建时被清空、被委托国只写进 `nat`；
`lend_lease_nat(dg)`（`7548-7550`，认 `nat || nation || delegate`）只被「结束委托」链路
4 处使用（`7555` / `29705` / `35807` / `27441`），**未覆盖下列 6 处**：

| # | 位置 | 读法 | `nation=null` 后的后果 |
|---|---|---|---|
| 1 | `7291` `resolve_us_lend_lease_select` | `if (dg.nation) return`（已选国判据） | 可被重复选国 |
| 2 | `7307` `resolve_us_lend_lease_play` | `if (!dg.nation) return game` | **重提被静默吞掉** |
| 3 | `35792` `exports.action` 门禁 | `faction_of_nation(dg.nation) !== side` | **action 层直接拒绝**，日志「现在轮到【null】打牌」 |
| 4 | `29700-29704` `build_actions` | `dg.nation` 决定登记哪个动作 | `resolve_us_lend_lease_play` **不在白名单**（点了没反应） |
| 5 | `27446-27465` `view.us_lend_lease` | `!dg.nation → step:'nation'` | 客户端弹回「选择委托国」，而不是继续补目标 |
| 6 | `play.js:1998` `lend_lease_active` | `dg.step==='play' && dg.nation` | 变 `null` → 后续提交退回 `play_card`（名额/归属全错） |

叠加：`finish_lend_lease` 因 `lend_lease_can_finish`（`7554` `!dg.played`）也不在册
（第 2/3 号重建对象没有 `played`）→ **既不能补目标、也不能结束归还 = 委托残留**。

一句话：`08bec5b` 统一了「结束委托」的判据，但「继续打牌」的判据仍是裸读 `nation`，
而重建对象把 `nation` 清空改存 `nat` —— 两个字段名不统一，造成静默卡死。

## 4. 修法候选（待玩家拍板）

### 方案 A（推荐）：判据统一到 `lend_lease_nat` + 重建写回 `nation`

**A1（必须）· 6 处判据改用 `lend_lease_nat(dg)`，`rules.js` 一个文件**

| 位置 | before → after |
|---|---|
| `7291` | `dg.nation` → `lend_lease_nat(dg)`（防重复选国；初始态仍为 `null`，允许选国） |
| `7307` | `if (!dg.nation) return` → `const nat = (arg&&arg.nation) || lend_lease_nat(dg); if (!nat) return` |
| `35792` | `faction_of_nation(game.delegate.nation)` → `faction_of_nation(lend_lease_nat(game.delegate))` |
| `29700-29704` | 先 `const llNat = lend_lease_nat(dg)`，全部用 `llNat` 判 `!llNat` / `faction_of_nation(llNat)` |
| `27446-27465` | `!dg.nation` → `!lend_lease_nat(dg)`；`step:'play'` 里 `nation: llNat` |
| `play.js:1998` | **不改**（view 下发 `nation` 后自动恢复，见下） |

初始态 `lend_lease_nat` 返回 `null`（`nation`/`nat`/`delegate` 全空），
所以「未选国 → `step:'nation'` + 只登记 select」的既有行为**不变**；
重建态返回 `nat`（苏联/英国），于是「继续打牌」链路全部恢复。

**A2（建议）· 5 处重建写回 `nation` + 补 `played:false`**

- `nation: null` → `nation: nat`（5 处：`7356` / `7379` / `7401` / `7438` / `7510`）；
- 第 2/3 号（无收尾钩子）补 `played: false`，使 `played` 语义明确为「尚未结算完」
  而不是 `undefined`；
- 目的：消除「同一语义三个字段名」的二义，防止以后再有裸读 `nation` 的代码踩坑。

**客户端无需改动**：`lend_lease_active`（`play.js:1998`）由
`view.us_lend_lease.step/nation` 驱动；`lend_play_action`（`6349-6355`）与
`submit_basic_card`（`6329-6343`）的重提路由早已实现（改前已确认，非 TODO）。
A1 后 view 重新下发 `step:'play', nation:'苏联'`，路由自动恢复。
因只改 `rules.js`，**不需要 bump `play.html` 的 `?v=`**；但改 `rules.js` 必须硬重启。

### 方案 B（备选，更彻底）：不重建对象，改为在原 `dg` 上打标记

5 处重建改为对原 `dg` 就地更新（`dg.resume_after_battle=...`、`dg.played=false`、
`dg.step=null`），天然保留 `nation` / `delegate` / `played` / `return_*`，从根上消除
「重建丢字段」这一类 bug；6 处判据可不动。
代价：要改写 5 处结构、显式维护 `resume_after_battle` 等标记，回归面更大。

### 推荐 A 的理由

- 最小：`rules.js` 内 6 行判据 + 5 行重建，不动控制层原语、不动客户端、不 bump 版本串；
- 与上一提交 `08bec5b` 的 `lend_lease_nat` **同源**，不引入第三套判据；
- 方案 B 更适合作为以后的独立重构，按「一次只推进一条、最小改动」原则本轮不做。

## 5. 真实测试矩阵（`tools/_real_test_17535_pending_target.js`，18 项）

| 组 | 项 | 断言 | 当前 | 修复后 |
|---|---|---|---|---|
| A | A0 | 打出 17535 并选苏联后 `step='play'` | ✓ | ✓ |
| A | A1 | 需补目标时卡回苏联手牌（未吞牌） | ✓ | ✓ |
| A | ★A2 | `delegate.nation==='苏联'` | ✗ | ✓ |
| A | ★A3 | `view.us_lend_lease.step==='play'` | ✗ | ✓ |
| A | ★A4 | `resolve_us_lend_lease_play` 在白名单 | ✗ | ✓ |
| A | A5 | 控制权仍在苏联（未误归还） | ✓ | ✓ |
| B | B1 | 17829 需补目标时卡回手牌 | ✓ | ✓ |
| B | ★B2 | `delegate.nation==='苏联'` | ✗ | ✓ |
| B | ★B3 | `view.step==='play'` | ✗ | ✓ |
| B | ★B4 | 打牌动作在白名单 | ✗ | ✓ |
| C | C0 | `event_targets` 候选已下发 | ✓ | ✓ |
| C | ★C1 | 补完目标重提不被阵营门禁拒绝 | ✗（日志「现在轮到【null】打牌」） | ✓ |
| C | ★C2 | 重提后 `delegate.nation==='苏联'` | ✗ | ✓ |
| D | D0~D4 | 即时结算卡（17800）仍 `step='done'` / `finish` 在册 / 归还美国 | ✓ ×5 | ✓ ×5 |

合计 **FAIL 8 / PASS 10** → 修复后目标 **ALL PASS（18 项）**。
所有 ★ 断言都已在【未修代码】上实测变红（不是靠推测），D 组对照全绿证明测试框架正常。

## 6. 回归清单（方案确认后实施时执行）

```
node --check server-official/public/quartermaster-sub-wars/rules.js
node --check server-official/public/quartermaster-sub-wars/play.js
node tools/_real_test_17535_pending_target.js                 # 目标 18/0
node tools/_real_test_17535_manual_return.js                 # 31 项，手动归还不得误伤
node tools/_real_test_17828_yiyongjun.js                     # 17828 让权日本链路
node tools/_smoke_delegate.js / node tools/_smoke_17721.js   # 委托翻转四卡
node tools/check_reuse.js                                    # B/C 段须干净
node tools/test_basic_cards.js                               # 基线 288 通过 / 9 预存失败
```

- 冒烟若出现失败，按 `rtt-fix-workflow` 用 `git stash` 与 HEAD 对照区分预存失败。
- 改 `rules.js` 后**硬重启 8091** + `curl.exe http://localhost:8091/` 探活 HTTP=200。
- 实施顺序：先 A1（跑测试转绿）→ 再 A2（复跑确认无回归）→ 分层回归 → 文档 → 单条提交。

## 7. 边界与已知遗留

- 本条只修「委托残留」，**不改** 17535 的统一手动归还口径（`08bec5b` 已定）。
- 第 1/4/5 号重建（战斗 / 建设预算 / BASIC 战斗）有独立钩子置 `played=true`；
  A1/A2 后这些路径同样受益于 `nation` 保留，且**不改变其既有结算时序**
  （D 组与 `_real_test_17535_manual_return.js` 的 B/C 组专门守这一点）。
- **另条遗留（未纳入本条）**：17810–17814 EFFECT 分支 `pending_echo` 悬挂而委托已收尾。
- **#5**（让权中打状态卡）玩家已判定暂时无问题，搁置。

## 8. 需玩家确认的点

1. 选 **方案 A** 还是 **方案 B**（推荐 A）。
2. A2（5 处重建写回 `nation:nat` + 补 `played:false`）是否一起做，还是只做 A1。
3. 确认后再动产品代码；**本轮仅新增本方案文档 + 正式真实测试，未改任何产品代码**。
