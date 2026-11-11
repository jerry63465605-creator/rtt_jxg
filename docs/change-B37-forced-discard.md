# B37 · 底层规则「被动强制弃牌：无手牌折算为损耗牌库」+ 接入 17553

> 日期：2026-11-12　玩家口径：① 无手牌时被动强制弃牌改为损耗牌库 ② 17553 无手牌时**共损耗 2 张**（弃牌折算 1 + 卡面原有 1）③ 牌库有牌可损耗时不扣分，牌库不足/为空时差额每张扣该国阵营 1 分
> 改动范围：`rules.js` 单文件；客户端、`cards.js` 未动。

## 1 问题描述

17553《抗日义勇军》卡面「中国建设或征召、中国部队被发起战斗后：日本弃置 1 张手牌，损耗 1 张牌」。旧实现把「无手牌」的处理硬编码在单卡里（`offer_us_japan_delegate`，2026-10-23 口径「跳过弃牌，但仍要损耗 1 张」），且 `resolve_us_japan_delegate` 直接 `hand.splice` + `discard.push` 绕过 `discard_card` 原子。玩家报「日本无手牌也扣分」，并要求把折算规则下沉成可复用的底层规则。

只读探针（`tools/_probe_B37_17553.js`）定性：扣分来自 `attrition_passive` 的通用铁律「牌库不足差额每张扣该国阵营 1 分」，只要日本牌库空就扣（有手牌但牌库空同样扣 1 分）；「无手牌」分支只损耗 1 张，等于把卡面前半句吞掉。

## 2 修法（复用现成原子，不造第二份轮子）

| # | 位置 | 改法 |
|---|---|---|
| 1 | 原子区（`attrition_passive` 之后） | 新增 `forced_discard_or_attrition(game, nation, n, opt)`：手牌 ≥ n → `{mode:'discard', need:n}`（上层走让权/选择，弃牌必须调 `discard_card`）；手牌 < n（当前 n=1，即无手牌）→ 弃牌要求折算为损耗牌库 n 张，与 `opt.extraAttrition`（本卡原有损耗）**合并成一次** `attrition_passive`，保证「共损耗 2 张」且差额只算一次、日志一条。只服务「被动强制」弃牌，主动代价 `cost.discard` 仍由框架收窄 |
| 2 | `_internal` 导出 | 登记新原子，供编号测试直接调（按 `rtt-atomic-operations` 规范） |
| 3 | `offer_us_japan_delegate` | 删掉 `jpHand===0` 的硬编码分支，改调新原子并传 `extraAttrition:1`；`mode='attrition'` 时不建让权挂起 |
| 4 | `resolve_us_japan_delegate` | `hand.splice` + `discard.push` → `discard_card(game,'日本',card)`，补齐 17847/17545 等弃牌钩子；让权归还（`current_nation` / `active` 成对）保持原样 |

**未改动**：`attrition_cards` / `attrition_passive` / `discard_card` 三个既有原子本身；17855《间谍机构》、15352/15353、16703 等其它弃牌点（按「一次只做一条」列清单待后续接入）；客户端与版本串。

## 3 结算对照（玩家口径落地）

| 日本手牌 / 牌库 | 让权挂起 | 结算 | axis 分数 |
|---|---|---|---|
| 有 / 有 | 建立 | 弃 1（`discard_card`）+ 损耗 1 | 不变 |
| 有 / 空 | 建立 | 弃 1 + 原有损耗 1 张未能损耗 → 差额 1 | −1 |
| 无 / 有 | **不建立** | 折算 1 + 原有 1 = **共损耗 2 张** | 不变 |
| 无 / 1 张 | 不建立 | 共需 2、实际损耗 1、差额 1 | −1 |
| 无 / 空 | 不建立 | 共需 2、实际 0、差额 2 | **−2** |

「牌库有牌可损耗时不扣分」由 `attrition_passive` 原语义保证（`short=0` 不改分数）；「牌库不足/为空差额每张扣 1 分」也是它原语义，底层规则不再自己改 `game.score`。

## 4 真实测试矩阵

`tools/_real_test_B37_forced_discard.js` **21 项 ALL PASS**：

| 组 | 断言 | 结果 |
|---|---|---|
| A | 原子层：手牌够 → discard；无手牌+牌库有 → 共损耗 2 不扣分；牌库 1 → 差额 1；牌库空 → 差额 2；无 `extraAttrition` 时只折算 1 | 6/6 |
| B | 17553 真实链路：有手牌让权（`current_nation=日本` / `active=Axis`）、弃牌进弃牌堆、让权归还成对；无手牌+牌库有 → 不建挂起、共损耗 2、不扣分；无手牌+牌库空 → 扣 2 分；有手牌+牌库空 → 扣 1 分 | 8/8 |
| C/D | 静态守卫：原子导出、17553 接入、旧硬编码与旧 splice 已删、扣分由 `attrition_passive` 承载 | 7/7 |

测试会因规则缺失而变红：A2/A4、B5/B7 都直接断言「共损耗 2 张 / 差额 2 分」；改回旧实现（只损耗 1 张）立即红。

## 5 回归清单

```
node --check rules.js                                  OK
_real_test_B37_forced_discard.js                      21/0
_real_test_16703_delegate_skill.js                    37/0
_real_test_precheck_attrition.js                      11/0
_smoke_discard_privacy.js                             20/0
_verify_attrition_rules.js                            26/0
_audit_attrition.js / _audit_discard.js               exit=0
test_basic_cards.js                                   288 / 9（基线一致）
全量冒烟 114 脚本   未登记失败 4 个，与前几轮完全一致（零新增）
check_reuse.js      B/C 干净；21 WARN 全是既有 A 类索引漂移
```

**回归归因**：`_smoke_delegate.js`(8 FAIL)、`_verify_echo_discard.js`(6/2)、`_real_test_15328_discard_suppressed.js`(脚本第 78 行崩溃)、`_real_test_17828_yiyongjun.js`(12 FAIL) 四个预存失败中，前三者全文**不含** `17553`/`us_japan_delegate`（0 处），与本次改动无交集；第四个虽含该卡，但第一个断言就因建盘没有把 17553 打上桌面而红（初始手牌无该卡、`play_card(undefined)`），未走到改动路径。按「一次只做一条」不在本条处理。

## 6 边界 / 已知

- 底层规则当前只服务「被动强制弃牌」且 `need=1` 的实际场景；`need>1` 且手牌不足时按「差额折算」返回 `mode:'attrition'`（未全量验证，接入新卡前需补测）。
- 主动代价弃牌（`cost.discard`）、玩家自选弃牌（`discard_one` / 弃牌阶段）、让权「可选弃牌」（16703）**不走**这条规则。
- 17855《间谍机构》仍按「目标国无手牌则不弹窗」处理（armed `ready` 防呆），与本规则不同源；将来若玩家要求统一，再单独接入。
- 日志顺序：`attrition_passive` 的内部扣分日志会先于折算说明日志输出（一次结算、两条日志），属既有行为，未改。
- 未改客户端 → `play.html` 版本串不 bump；改了 `rules.js` → 需硬重启 8091 才在浏览器生效。
