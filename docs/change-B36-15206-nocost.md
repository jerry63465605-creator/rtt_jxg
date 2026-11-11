# B36 · 15206《轰炸伦敦》删除卡面不存在的代价

> 日期：2026-11-12　玩家裁定：「只删 cost」
> 改动范围：`rules.js` 一行配置 + 注释；`docs/impact-p0-window-fallback.md` 表格；测试与探针。客户端、`cards.js` 未动。

## 1 问题描述

玩家原报「15206《轰炸伦敦》没给打出时点」。第一次调查误判为**误报**（牌库空不弹窗是 `can_attrite` 正确过滤），随后玩家指出「卡面根本没有需要德国支付代价的条件」，复查推翻该判定。

三处卡面原文一致（卡图 `out/cards_sliced/sheet152_r0_c6.png`、`out/de_cards.csv`、`cards.js` text）：

> 打出[经济战]时，若目标是英国：<不列颠>2地区内每有 1 支德国空军，该经济战损耗数加 2。

**德国没有任何代价**。而实现 `rules.js:13078` 写 `armed.cost: { attrition: 1 }`，注释 `13074` 写「损耗1」，文档 `docs/impact-p0-window-fallback.md:29` 表格也把代价记为「损耗」——疑为早期 OCR 误记。

## 2 根因

```
offer_armed_effects (15700-15702)
  need = ar.cost.attrition = 1
  → 德国牌库空时 can_attrite(德国,1) 失败 → 该卡静默不进候选、不开窗
use_armed_offer (34592-34600) 点击时按同一 cost 再拦一次
CARD_TRIGGERS['15206'] = { kind:'load' } (16531) → hand_ready 恒灰
```

三处叠加：牌库一空就「窗口不弹、手牌不亮、无日志」，玩家看到的就是「没给打出时点」。只读探针 `tools/_probe_B36_15206.js` 的 C 场景复现了「牌库空 → `armed_offers=[]`」。

## 3 修法（只删 cost，按玩家裁定不扩大）

| # | 位置 | 改动 |
|---|---|---|
| 1 | `rules.js` 15206 配置 | `armed.cost: { attrition: 1 }` **删除**；`when/actor/cond/desc/run` 全部保留 |
| 2 | `rules.js` 配置上方注释 | 改成卡面原文，去掉误记的「损耗1」，并说明这次修复原因 |
| 3 | `docs/impact-p0-window-fallback.md` | 15206 代价列「损耗」→「无（卡面无代价，B36 已删旧 cost）」 |
| 4 | `tools/_real_test_B36_15206_nocost.js`（新增） | 见下 |
| 5 | `tools/_probe_B36_15206.js` | 头部注明 C 场景在修复后「应仍能开窗」，避免误读旧结论 |

**未动**（按「一次只做一条」）：`cond` → `ready` 防呆（不列颠无德机仍弹空窗）、`CARD_TRIGGERS kind:'load'` 手牌文案、`run` 的 `attrition_cards` → `attrition_passive` 口径、17505 范式改造。这些列为后续可选。

## 4 真实测试

`tools/_real_test_B36_15206_nocost.js` **15 项 ALL PASS**：

| 组 | 断言 | 结果 |
|---|---|---|
| A ★★ | 德国牌库空 → `armed_offers` 有 15206、`view.armed_offer` 下发、`use_armed_offer` 在册、`cost.attrition=0`；点击后德国牌库不变、日志无「德国损耗」、英国仍额外损耗 2 张 | 8/8 |
| B | 德国牌库有牌时也不扣德国牌、英国额外损耗 2 张 | 3/3 |
| C | 目标非英国仍不弹窗（原有 `cond` 未动） | 1/1 |
| D | 静态守卫：配置无 `cost.attrition`、注释改卡面原文、`run` 仍按 `radius:2` 计数、p0 文档已更正 | 4/4 |

A 组前三项在旧 `cost` 下会立即变红（`can_attrite` 过滤窗口），因此能真正守住这条修复。

## 5 回归

```
node --check rules.js                         OK
_real_test_B36_15206_nocost.js                15/0
_real_test_15206_london.js（B4 原有）         12/0
_real_test_17505_oneshot.js                   9/0
test_basic_cards.js                           288 / 9（基线一致）
全量冒烟 114 脚本   未登记失败 4 个，与前几轮完全一致（零新增）
check_reuse.js      B/C 干净；21 WARN 全是既有 A 类索引漂移
```

## 6 边界 / 已知

- 删 `cost` 后 `view.armed_offer.cards[].cost` 变成 `{attrition:0, discard:0, filter:null}`，窗口不再显示「损耗 1 张牌」，与卡面一致。
- 「不列颠半径 2 内无德国空军」时仍会弹窗、点击 `run` 走 `skip`（空窗）——这是删 `cost` 之前就存在的遗留，玩家本轮明确「只删 cost」，不在本条处理；将来若报「弹空窗」再按 17505 `ready` 范式处理。
- `run` 对英国的追加损耗仍用 `attrition_cards`（牌库不足时不按差额扣分），与经济战卡的 `attrition_passive` 口径不同；同样留待后续。
- 未改客户端 → `play.html` 版本串不 bump；改了 `rules.js` → 需硬重启 8091 才生效。
