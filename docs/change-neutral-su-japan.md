# 苏联中立：可攻击日本，仅禁德/意；17900 让权切国家

> 2026-11-11 玩家口径 → 实施记录
> 相关：`docs/change-16703-skill-defer.md`、`docs/pitfalls.md`

## 1. 玩家口径（原话）

> 「构建英国回合对中国东北发起陆战，且需要检查，苏联中立时，应该仍然可以攻击日本，
> 仅仅不能攻击意大利和德国」
> 「修，但仍有 17900 未让权的问题」

| # | 口径 | 落地 |
|---|---|---|
| 1 | 立苏联时仍可攻击日本 | 空打分支不再一刀切；`seize_air` 按目标空军国籍逐支判 |
| 2 | 仅不能攻击德/意 | `NEUTRAL_RULES['苏联'].enemies` 已是 `['德国','意大利']`，判定链统一走 `neutral_attack_check` |
| 3 | **17900 未让权** | `set_pending_armed_delegate` 切 `current_nation` 到被让权国，成对归还 |

## 2. 现状与只读探针证据

`tools/_probe_neutral_su_japan.js`（`new_board` + 全程 `R.action`）：

| 检查项 | 修复前 | 修复后 |
|---|---|---|
| `neutral_attack_check(苏联, 日本/德/意)` | 日本 `ok:true`、德/意 `ok:false` | 不变（本来就对） |
| 苏联中立 + 对中国东部（有日军）发起陆战 | 放行 | 放行 |
| 苏联中立 + 有德军/意军 | 拒绝 | 拒绝 |
| **苏联中立 + 空打** | **一刀切拒绝** | **放行** |
| **苏联中立 + 夺取日本空军** | **一刀切拒绝**（候选高亮却是按目标国判 → 高亮但点不动） | **放行**；对德/意仍拒绝 |
| 英国回合打中国东北 → 17900 | `current_nation` **恒为英国**，苏联《喀秋莎》(after_land) 灰显「只能在苏联的回合发动（当前是英国）」 | `current_nation=苏联`，喀秋莎 `ready=true` |

**三个根因**

1. `rules.js` `do_battle` 空打分支：`is_neutral(nation) && NEUTRAL_RULES[nation].enemies.length`
   —— 只要本国中立且敌对方非空就拒绝，不看目标国（空打也确实无法判）。
2. `rules.js` `seize_air` 开头：同一式一刀切；它**下面本就有**按目标空军国籍的
   `neutral_attack_check`，但被提前 return，永远走不到。
   而候选高亮（`basic_targets` 的 `空军力量:seize` 分支）用的是按目标国判定 →
   形成「高亮但点不动」（通用教训 3 的反面）。
3. `set_pending_armed_delegate` 只 `handoff_to` 翻 `active`：英/苏同属 Allies，
   `active` 本来就一样，**且不切 `current_nation`** → 被让权国的状态卡触发守卫
   （`nation === game.current_nation`）不认、6 人模式收不到。
   这正是 `offer_uk_build_delegate` / `offer_su_build_delegate` 注释里
   早已记录并修过的同款坑（2026-10-17），17900 这条路径当时漏了。

## 3. 修法

| # | 位置 | 改法 |
|---|---|---|
| 1 | `do_battle` 空打分支 | 判据改为「`enemies` 是否【覆盖整个敌对阵营】」：覆盖才拒（美国），未覆盖则放行（苏联缺日本）。从 `ORDER_OF_NATIONS` + `faction_of_nation` 推导，不写死国名 |
| 2 | `seize_air` | 删开头一刀切；从敌方空军里挑出 `neutral_attack_check` 放行的**可攻击目标**（`targetAir`），一支都没有才拒绝；后续移除/参战/计分全部用 `targetAir`，避免"候选是日本、实际移除德国" |
| 3 | `set_pending_armed_delegate` | 记录 `return_nation = current_nation` → 切 `current_nation = pd.nation` → `handoff_to` 仍走栈 |
| 4 | 新增 `clear_pending_armed_delegate` | 清挂起 + 还 `current_nation` + `reconcile_handoff('armed_delegate')`；**所有**清空点（`removeArmedWindow` / `clear_armed_offer` / `clear_armed_offer_for_side`）统一走它，禁止裸置 null |

客户端零改动：陆战/海战候选高亮本就不做中立静态过滤；`seize` 候选 `basic_targets`
原本就按目标国判，与服务端修好后同源。因此**不 bump `play.html` 版本串**。

## 4. 真实测试矩阵

`tools/_real_test_neutral_17900.js` — **33 项全过**：

| 组 | 覆盖 | 结果 |
|---|---|---|
| A | `neutral_attack_check` 矩阵：苏联 vs 日放行 / vs 德·意拒绝 / 美国 vs 日拒绝 / 英国 vs 日放行 / 配置断言 | 6/6 |
| B | 苏联中立有敌军：真实 `play_card` 打日本成功移除、德/意被拒 | 3/3 |
| C | 空打：苏联放行（旧实现一刀切）；美国仍拒 | 2/2 |
| D | `seize_air`：苏联对日本放行并移除、对德国拒绝、美国对日本拒绝 | 3/3 |
| E | 17900 让权：`current_nation` 切苏联、`pending_armed_delegate.return_nation='英国'`、喀秋莎 `ready=true`（修复前灰显） | 8/8 |
| F | **完整组合**：英国打`<中国东北>` → 17900（弃建设陆军、征召苏军）→ 打`<中国东部>`（日本陆军+同地区日本空军）→ 空军代受挂起 → 日本不代受 → 陆军+空军同场移除 → 喀秋莎 `ready` 且 `space=<中国东部>` → 喀秋莎真实发动（苏联中立空打放行）→ 次数消耗 | 11/11 |

另更新 `tools/test_neutral.js` 中编码旧口径的两组：
- 4 组修正 `seize_air` 参数顺序（旧测试把飞机 id 与地区传反，靠一刀切侥幸通过）；
- 13 组按新口径反转（苏联空打放行），并补「美国空打仍拒」对照。

## 5. 回归清单

| 项 | 结果 |
|---|---|
| `node --check rules.js` | 通过 |
| `_real_test_neutral_17900.js` | 33/0 |
| `_real_test_supp_su.js`（17900 基础链路） | 25/0 |
| `test_neutral.js` | 102/4（剩余 4 项与 HEAD 完全一致：9.2 / 9.7 / 18.4 / 18.14，预存） |
| `_real_test_supp_us.js` / `_verify_forgo_build.js` / `_verify_17526_order.js` / `_smoke_us_event_b.js` | 与 HEAD 完全一致（3/29、18/4、崩溃×2），预存 |
| 全量冒烟 114 脚本 | 只剩 2 个未登记失败：`_smoke_17535_delegate_return.js`、`_smoke_us_event_a.js`，均经 `git stash` 对照 HEAD 确认预存 |

## 6. 边界 / 仍会卡的情形

- **空打判据是「阵营覆盖率」推导**：目前 8 国中只有苏/美有中立规则；若将来新增
  只针对部分敌国的中立国，这套判据自动适用，无需改代码。
- **`seize_air` 多国籍敌机**：只挑"允许攻击"的目标；若目标格同时有日本与德国空军，
  会移除日本那一支（符合"只禁德/意"），移除哪一支由 `pieces_on` 顺序决定。
- **17900 让权期间 `current_nation=苏联`**，`:active` 仍由 `handoff_to` 走栈；
  归还统一走 `clear_pending_armed_delegate`。若将来新增清空点，必须复用该函数，
  否则 `current_nation` 会永久停在被让权国。
- **17900 第二步遇空军代受挂起时**，增强窗口已结算（卡进弃牌堆、代价已付），
  战斗挂起由日本用 `resolve_battle` 完成；答完后 `after_land`（喀秋莎）窗口才转绿。
  这是既有战斗挂起语义，本次未改。
