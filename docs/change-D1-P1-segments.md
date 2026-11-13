# D1 / P1+ 前奏卡「分段代价」编译层（2026-11-12）

> 行号为 2026-11-12 快照；定位请用符号名 grep。前置：`change-D1-P0-prelude-compiler.md`、`change-D1-P1-diy-upload.md`。

## 1. 问题描述

真实卡面按「。」分段，且三段语义互斥：旧 `compile` 把两段代价合并进一个 `cost`、两段效果合并成一个 `ops[]`，`parse_text` 还把所有 bracket 提前、动作按标点切碎，顺序与段边界全丢。实测 14900 产出 `cost:{tension:1,discard:[{n:1}]}` + `steps:[play_prelude,peek_reorder]`，无法表达「第二段不支付就不执行」。

## 2. 玩家裁定与三类段

| 类 | 段首词条 | 语义 |
|---|---|---|
| **A `mandatory`** | `[紧张度±N]` 或段首无代价 | **必执行**；第一段永远是 A |
| **B `optional`** | `[弃置N张手牌]` / `[失去N分]` | 我方**支付才执行**该段；不支付跳过该段，但第一段照常执行、卡照常消耗（18300 确认） |
| **C `opponentOptOut`** | `[除非X弃置N张手牌]` / `[否则弃置N张手牌]` | 对手**支付可阻止**；对手**不支付才发生**后续（14903，与 B 方向相反） |

- `[持续]` / `[大萧条]` 是**标签不是代价**：只进 `tags`，不进 `cost`，不参与选付判定；它决定该段用一次性 `steps` 还是 `ongoing`/`auto`。
- 6601《大德意志帝国》（`rules.js:5730-5736`）范式：同卡内 `ongoing`（打出时一次性）+ `auto`（每计分阶段）**两字段并存**；carrier 由**首段**决定（18308 首段无标签 → event，不整卡推 status）。
- 分段依据：按 `group_segments` 的「段首连续方括号 + 段体已有内容」开新段，**不依赖句号是否被 OCR 遗漏**；`14905` 第二段才出现 `[紧张度+1]` 仍归 A。

## 3. 接线点索引

| 文件 | 符号 | 快照行 | 作用 |
|---|---|---:|---|
| `prelude_compiler.js` | `SEGMENT_HEAD_IDS` | 347 | 哪些 `rule.id` 能作段首（紧张度/弃置/失去/标签/除非/否则/若…弃置） |
| 同上 | `OPTIONAL_COST_IDS` / `OPPONENT_OPT_OUT_IDS` | 352/353 | B / C 判据；**加新段首词条必须同步这两张表** |
| 同上 | `group_segments(tokens)` | 361 | 按段首 + 段体分组 → `groups[{heads,body,seg}]` |
| 同上 | `opponent_of(sc)` | 385 | 从 guards 提取 C 段对手国与代价 |
| 同上 | `parse_text(text)` | 407 | 掩码扫描 + 按「。」赋 `seg`、按 `pos` 排序保留原文顺序 |
| 同上 | `infer_carrier(spec,c,firstSeg)` | 448 | **首段**标签优先于 `carrierHint`；标签规则不再产生 `carrier:'status'` |
| 同上 | `compile(spec,options)` | 457 | 逐段 ctx；输出 `segments/mandatory/optional/opponentOptOut` + 段级 `ongoing.segments` / `auto` |
| 同上 | **兼容别名** | 约 500 | `cost`/`steps` **只取第一段**（语义正确，不再混第二段代价）；权威 IR 是 `segments` |
| 同上 | `validate` 段级 4 条 | 584 | A 段非空 / B 段有代价且有 op / C 段指定对手 / 标签不进 cost |
| 同上 | `renderSpecs` | 699 | 产物四套表均带 `segments` |
| `prelude_compiler.js` | `always_supplied` / `supply_point` / `shuffle_tail` | 约 300 | 从 `NOISE_PATTERNS` 升级为真实 op（6601 持续段必须有 op） |
| `tools/_test_prelude_compiler.js` | T19–T25 | 全文件 | 68 项；T22 专门守 6601 范式与首段 carrier |
| `out/prelude_diy_segments.json` | 90011/90012/90013 | — | A+B / A+C / A(ongoing)+B 三张样例 |
| `out/prelude_tokens.txt` | 按段统计 | — | 1 段 69 卡 / 2 段 48 / 3 段 8；A 135 / B 26 / C 12；once 162 / ongoing 11 |

## 4. 验证

- 七张真实卡逐张核对：14900(A+B)、18301(A+B)、14903(A+C 对手英国)、18305(A 带 ongoing + B → status)、18308(首段无标签 → event + 第二段 ongoing)、14905(两个 A)、18300(首段无代价仍 A)。
- `_test_prelude_compiler.js` **68/0**、`_test_prelude_diy.js` **37/0**；覆盖率 412/412 = 100%、待补 0；原 45+26 项零回归。
- 回归零新增，`rules.js` 新增行 0，未接引擎。

## 5. 与规则书/文档的关系

`docs/easy-rule.md:121-123` 的卡牌阶段口径（弃置所有前奏手牌 → 摸 2 张）**未被本层改动**；玩家一度提出「弃 1+1 不摸牌」补充口径后已撤回，撤回记录在 `docs/todo-2026-11-10.md` D1 条目。

## 6. 后续修改指引

1. **改段分类**：只动 `SEGMENT_HEAD_IDS` / `OPTIONAL_COST_IDS` / `OPPONENT_OPT_OUT_IDS` + `group_segments`；不要在各处硬编码词条文本。
2. **加新段类型**（例如「若…则」条件段）：新增 kind → `compile` 的 `kind` 分支 → `validate` → `renderSpecs` → P2 的 `prelude_resolve_card` / `prelude_answer_segment` 必须同步，否则服务端不认识。
3. **逐卡补 op**：先看 `out/prelude_tokens.txt` 的「已登记模式」，再改 `PRELUDE_TOKENS`；改完跑探针确认「待补模式」归零。
4. **改段级 IR 字段**：会同时影响 P2 的 `prelude_run_segment`（`rules.js:1694`）与 `_test_prelude_diy.js` T10，必须一起改。
