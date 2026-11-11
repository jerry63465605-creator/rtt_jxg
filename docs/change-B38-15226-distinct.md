# B38 · 15226《巴巴罗萨》至多三支不同目标部队依次结算战斗

> 日期：2026-11-12　玩家口径：① 预算次数收缩到实际目标数但**仍保留手动「结束」** ② 同一支部队**禁止第二次再打**（即使被保护/代受未移除） ③ 快照外新部队**禁止**
> 改动范围：`rules.js` 单文件 + 一个冒烟断言更新；客户端、`cards.js` 未动。

## 1 问题描述

卡面：「选择在本回合开始时与德国陆军相邻的 3 支苏联陆军，按任意顺序对其发起陆战。」

只读探针（`tools/_probe_B38_15226.js`，真实 `play_card → event_battle ×N → event_finish`）定性：

| 场景 | 旧 `remaining` | 旧结果 |
|---|---|---|
| A 3 支在 3 个不同地区 | 3 | 三次独立 `do_battle`，依次结算 —— **这部分本来就对** |
| B 只有 2 支 | **3** | 打完 2 场后 `remaining=1`、候选空，日志「剩余 1 次机会放弃」→ 违反「至多三支」 |
| C 3 支挤在 2 个地区 | 3 | 靠 `arg.victim` 能打满，但候选/校验都按【地区】而非【部队实例】 |
| D 重复指定同一支 | 3 | 第一战移除后第二战被拒 —— 只靠「已被移除」**间接**保证；若被保护/代受未移除即可重复打 |

**根因**：① `resolve_event_card` 建 `event_budget` 时 `remaining = step_pick_count(st) = 3` 恒为 3，不按快照里仍存活的**部队实例数**收缩；② `barbarossa_target_spaces` 把快照 `units` 转成地区并去重，`event_cands_filter` 只判「该地区有苏联陆军」，没有 `usedVictims` 记账，也没校验 `arg.victim` 必须属于回合开始快照；③ 「依次结算」已满足（每战独立 `do_battle`），无需改。

## 2 修法（配置驱动，框架不写死卡 id）

| # | 位置 | 改法 |
|---|---|---|
| 1 | 新增 `barbarossa_unit_targets(game)` | 返回快照 `units` 中仍在场、仍是苏联陆军的**实例 id**（与 `barbarossa_target_spaces` 同源，无快照时按当前局面兜底） |
| 2 | `EVENT_CARDS['15226'].steps[0]` | 声明式新增 `pickCappedByUnits: true` + `unitTargets: (game)=>...` |
| 3 | `resolve_event_card` 建预算 | `remaining = min(pick, unitTargets.length)`；预算落 `unitTargets` 快照 + `usedVictims: []`。未声明该字段的卡**完全不受影响**；`event_finish` 不动，手动「结束」保留 |
| 4 | 新增 `budget_unit_unused(b, id, game, sp)` | 「必须在快照里 + 未被打过 + 仍在指定地区」的统一判定，三处复用（候选地区 / `view.enemies` / `event_battle` 校验），避免判定漂移 |
| 5 | `event_battle_targets` | 只保留「仍有未打过的快照部队」的地区 |
| 6 | `event_battle` | `wantVictim` 改 `let`：客户端没传 victim 时自动取第一支未打过的快照部队并写回（避免 `do_battle` 的 `enemies[0]` 打到别的实例）；校验快照归属与重复，否则拒绝；`do_battle` 成功后（含 pending 代受）把 victim 记入 `usedVictims`，与 `remaining` 扣减同步 |
| 7 | `view.event_budget.enemies[sp]` | 只下发「快照里且未打过」的部队，客户端自然只显示可打目标 —— **客户端无需改动** |

## 3 结算对照（玩家口径落地）

| 场景 | 新预算 | 结果 |
|---|---|---|
| 3 支在 3 地区 | 3 | 三次独立 `do_battle`、`usedVictims` 记 3 个不同实例 |
| **只有 2 支** | **2** | 日志「可进行 2 次」；打完 `remaining=0` 但**预算仍在**，需手动点「结束」才清空 |
| 3 支挤 2 地区 | **3**（按部队数，不是地区数 2） | `view.enemies[罗斯]` 下发 2 支；打完第一支后该地区仍在候选、只剩未打过的那支；三战全成功 |
| 同一支第二次（仍在场） | — | 被「该目标部队已打过，不能重复发起战斗」拒绝，`remaining` 不扣 |
| 快照外新部队落在快照地区内 | — | 不在 `unitTargets`、不下发 `enemies`、指定为 victim 被拒；快照内部队仍可打 |
| 不传 victim | — | 服务端自动取未打过的快照部队，不会误打快照外新部队 |

## 4 真实测试矩阵

`tools/_real_test_B38_15226_distinct.js` **33 项 ALL PASS**（A 3 次独立 / B 收缩+手动结束 / C 同格多部队 / D 保护未移除仍禁止 / E 快照外禁止 / F 无 victim 自动取 / G 静态守卫）。B1/B3/B4、C1/C7、D2/D3、E2/E3 在旧实现下会立即变红。

配套：`tools/_smoke_seq.js` 第 5/6 组按新口径更新断言（旧断言写「remaining=3，机会足额，与可攻击目标数无关」，与玩家新裁定直接冲突，属**断言过期**而非功能回归），现 **52/0**；`tools/_real_test_15226_barbarossa.js`（B4 快照测试）**14/0** 未改。

## 5 回归清单

```
node --check rules.js                             OK
_real_test_B38_15226_distinct.js                  33/0
_real_test_15226_barbarossa.js（B4 原有）         14/0
_smoke_seq.js（断言更新后）                       52/0
_real_test_17505_oneshot.js                       9/0
_real_test_B37_forced_discard.js                  21/0
_real_test_B36_15206_nocost.js                   15/0
test_basic_cards.js                               288 / 9（基线一致）
全量冒烟 114 脚本   未登记失败 4 个，与前几轮完全一致（零新增）
check_reuse.js      B/C 干净；21 WARN 全是既有 A 类索引漂移
```

`_smoke_15225.js`(2)、`_smoke_17535_delegate_return.js`(exit1)、`_smoke_axis_pact.js`(4)、`_smoke_us_event_a.js`(1) 为既有未登记失败，逐项与前一轮比对一致。

## 6 边界 / 已知

- 预算次数按**打出那一刻**的快照仍存活部队数冻结；中途有部队被别的卡消灭不会补次数（卡面「本回合开始时」，且避免动态增减预算）。
- 「不同部队」按实例 id 记账，放在 `event_budget.usedVictims`（随存档 JSON 落盘），跨 action 不丢。
- 未声明 `pickCappedByUnits` 的所有其它 `op:'battle'` 卡走原路径（`budget_unit_unused` 首行短路返回 true），15231《进攻美国》、15225 等不受影响。
- 0 支合法目标时 `remaining=0`，预算仍在、玩家点「结束」收尾（不建空预算死锁）。
- 未改客户端 → `play.html` 版本串不 bump；改了 `rules.js` → 需硬重启 8091 才生效。
