# D1 / P0 前奏 DIY 编译层（2026-11-12）

> 行号为 2026-11-12 快照，会随后续改动漂移；**定位请用「符号名」grep**，行号仅作初筛。

## 1. 问题描述

PRELUDE/ARMAMENT 共 125 张卡全部 `ops:null`、0 张已实现；`init_nation_deck` 明确排除；`rules.js` 无前奏牌堆/紧张度/持续标记。玩家诉求：「规范化、结构化地做前奏，建立统一的实现层，和卡牌效果调用分开」，并支持管理员按词条 DIY 组卡。

## 2. 设计口径（玩家裁定）

- 四套**同构独立表** + 派发器加一处分支；编译产物不写进既有 `EVENT_EFFECTS` / `RESPONSE_EFFECT_IMPL` / `ECON_CARDS` / `STATUS_EFFECTS`。
- 四类 carrier：`response`（军备卡≈响应卡）/ `event`（普通前奏≈事件或经济战）/ `econ`（让权链）/ `status`（带 `[持续]` 或标签卡≈状态牌，沿用 `once_per_turn`+`status_used`）。
- 只新增自定义卡（`id ≥ 90000`）、不覆盖官方 125 张；P0 **不接引擎**。

## 3. 接线点索引（后续修改先查此表）

| 文件 | 符号 | 快照行 | 作用 |
|---|---|---:|---|
| `server-official/public/quartermaster-sub-wars/prelude_compiler.js` | `ACTOR_NAMES` / `NATION_RE` | 20/21 | 8 国配置（`cards.js` 只有 6 国，卡面另有中国/法国）；所有国家正则由此生成 |
| 同上 | `PHASE_KEYS` | 24 | 阶段短语 → key；P2 派发时按 key 映射 `PH.*` 或窗口 |
| 同上 | `TAG_REGISTRY` / `CARD_REF` / `CARD_TYPE_FILTERS` | 35/42/48 | 标签、跨卡组引用、牌类型筛选三张配置表 |
| 同上 | `DIY_ID_MIN` | 50 | 90000 号段；改号段只改这里 + `validate` |
| 同上 | `NOISE_PATTERNS` / `is_noise` | 70/89 | 切分噪声登记；**补新动作模式时先确认它不是噪声** |
| 同上 | `PRELUDE_TOKENS` | 110 | 词条/动作模式表；每项 `{id, re, kind, carrier?, emit(m,ctx)}` |
| 同上 | `parse_text` | 407 | 按「。」分段、保留原文顺序、返回 `{raw,bracket,seg,pos}` |
| 同上 | `compile(spec, options)` | 457 | 逐段编译 → `config{segments,mandatory,optional,opponentOptOut,ongoing?,auto?}` |
| 同上 | `validate(spec, ir)` | 584 | 原 14 条 + 段级 4 条 |
| 同上 | `coverage(texts)` | 669 | 官方 125 张覆盖率；噪声排除出分母 |
| 同上 | `renderSpecs(compiled)` | 699 | 产物 `prelude_specs.js`（5 个导出） |
| `tools/_probe_prelude_full.js` | `run` 主体 | 全文件 | 与编译层**同源**解析（`P.parse_text/normalize/is_noise`），产出 `out/prelude_tokens.txt` |
| `tools/_test_prelude_compiler.js` | T1–T25 | 全文件 | 68 项编号测试 |
| `out/prelude_diy.json` | 主上传文件 | — | `out/` 被 `.gitignore` 忽略，未入库 |
| `out/prelude_diy.example.json` / `out/prelude_diy_segments.json` | 格式说明 / 分段样例 | — | 不被上传链默认读取 |

## 4. 验证

- T1–T14 原 30 项 ALL PASS；官方 125 张方括号词条零遗漏、真实动作片段 100% 登记。
- `node --check`、全量冒烟零新增、`check_reuse` B/C 干净（`rules.js` 新增行 0）。

## 5. 回归基线

`_test_prelude_compiler.js`（68/0）、`_test_prelude_diy.js`（37/0）、`test_basic_cards` 288/9、全量冒烟未登记失败 4 个（`_smoke_15225` / `_smoke_17535_delegate_return` / `_smoke_axis_pact` / `_smoke_us_event_a`）。

## 6. 后续修改指引

1. **加新词条**：在 `PRELUDE_TOKENS` 追加 `{id,re,kind,emit}`；若出现在段首，同步登记 `SEGMENT_HEAD_IDS` 及 `OPTIONAL_COST_IDS` / `OPPONENT_OPT_OUT_IDS`。改完必须跑 `_probe_prelude_full.js` 看「待补模式」是否归零。
2. **改分段规则**：主入口是 `group_segments`（361）与 `SEGMENT_HEAD_IDS`（347）；`compile` 里第一段永远 `mandatory`，后续段才按段首类型分 B/C。
3. **改校验**：`validate`（584）；新增断言必须同步追加 T 编号，不得删旧断言。
4. **改产物结构**：`renderSpecs`（699）→ 重跑 `node tools/prelude_diy.js` → 同步 `_test_prelude_diy.js` T1/T9/T10。
5. **绝不**让 `prelude_compiler.js` `require('./rules.js')`：它是纯函数（只依赖 `data.js`/`cards.js`），P2 靠这点现场编译官方卡且不循环依赖。
6. **改 op 参数结构时成对改**：`PRELUDE_TOKENS[].emit` 产出的 op 由 `rules.js:prelude_run_op` 消费。P3 曾把 `always_supplied` / `supply_point` 从 `space:null` 改成捕获 `<地区>` 并带 `nation`，两处必须同步；验收跑 `_real_test_P3_prelude_ops.js` A 组 + `_probe_prelude_full.js`（覆盖率不得降）。
