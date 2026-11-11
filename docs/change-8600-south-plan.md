# 8600《南方作战计划》实现记录纠错

> 日期：2026-11-12　玩家报障：「日本响应，南方作战计划的记录也有错误」→ 确认指**实现/测试记录错配**，执行。
> 改动范围：`rules.js` 一个实现 + 冒烟断言 + 文档；`cards.js` / CSV / 客户端未动。

## 1 问题描述

`docs/test-supp-jp.md`（2026-11-07）记「日本 8 张 SUPP 全部工作正常」，但那个结论只验了「play_start 窗口是否开出」，没有验效果内容。玩家复查发现 8600 的实现记录是错的。

**已核对无误**（只读）：

| 来源 | 内容 |
|---|---|
| 卡图 `out/cards_sliced/sheet86_r0_c0.png` | 「出牌阶段开始时：对\<印度尼西亚\>\<新几内亚\>\<东南亚\>\<菲律宾\>之一发起 1 次陆战。在战斗地区建设陆军。」 |
| `out/ja_cards.csv` / `cards.js` | 与卡图一致，`type=RESPONSE`、`deck=SUPP` |
| `rules.js:17405` 触发声明 | `on:'play_start', filter: ctx.nation==='日本'` —— 与卡面一致 |

**错的**：`RESPONSE_EFFECT_IMPL['8600']`（原 `rules.js:18446-18491`）是一套**四选一占位**：

```
获得 1 分 / 消灭 1 支中国陆军 / 在<东南亚>征召 1 支陆军 / 对英属印度发起 1 次陆战
```

这四句不属于任何日本卡面（查过 `cards.js` 与 `ja_cards.csv`），实现里还留着「多个时待后续细化」TODO。而 `rules.js:32086`（`resolve_response_choice → RESPONSE_EFFECT_IMPL[pc.card_face]`）是真实响应结算调用点，所以玩家触发 8600 时**实际看到的就是这套错误效果**。

**错误被三处记录固化**：`tools/_smoke_jp_response.js` 按四选一写 5 条断言；`docs/test-supp-jp.md:17` 记「✅（窗口）」；`tools/_real_test_supp_jp.js` 只断言窗口候选里有 8600。

**全量对照**（`tools/_probe_jp_response_records.js`，用函数 `toString()` 逐张核对）：25 张日本 RESPONSE 卡全部有触发声明与实现，8600 是唯一明显错配；其余抽查一致（15438/7902/7905/15435/15437 等），15422 的历史错配已在 2026-10-26 修过。

## 2 修法（复用现成原子，不另写候选遍历）

| # | 位置 | 改法 |
|---|---|---|
| 1 | `RESPONSE_EFFECT_IMPL['8600']` | 删四选一占位，按卡面重实现：首调（`choice===undefined`）返回 `kind:'space'` 候选；续调先 `do_land_battle_at` 发起 1 次陆战，再 `build_piece` 在**战斗地区**建设陆军 |
| 2 | 候选判定 | 四个固定地区 ∩ `event_cands_filter(game,'日本',{op:'battle',kind:'land'}, ids)`（排除本方同格）∩ `battle_initiators(game,'日本',sp).length>0` —— 与 15231 `spacesFn` 判据同款，均由权威原子承担 |
| 3 | 执行口径 | 「。」分隔的两句各自独立：陆战未发动也照常尝试建设并把原因写进日志（15422 玩家口径）；返回 `ok:true` + 汇总文案 |
| 4 | `tools/_smoke_jp_response.js` | 8600 段 5 条四选一断言 → 「space 候选 = 卡面四地区、不是 option、陆战 + 建设、不再得分/消灭中国陆军/打印度」4 条 |
| 5 | `docs/test-supp-jp.md` | 总结论加更正、覆盖清单 8600 行改「旧记 ✅ 是假绿」、§3 说明旧断言局限、新增 §4 纠错记录 |
| 6 | 客户端 | **未改**（`view.response_choice` 的 `kind:'space'` 客户端原本就支持） |

## 3 真实测试矩阵

`tools/_real_test_8600_south_plan.js` **18 项 ALL PASS**：

| 组 | 断言 | 结果 |
|---|---|---|
| A | 真实 play_start 响应链：暗置 8600 → 窗口 → `trigger_response` → `response_choice.kind='space'` 且候选恰为四地区 → `resolve_response_choice` 后日志含「发起陆战 + 建设陆军」、战斗地区新增 1 支日本陆军、**不再得分**、不再消灭中国陆军/打印度、响应栈清空且卡消耗 | 9/9 |
| B | 两级协议：首调 pending 不执行动作、续调返回两句文案、伪造候选外地区被拒 | 4/4 |
| C | 静态守卫：四选一占位已删、实现按四地区、候选走 `event_cands_filter`+`battle_initiators`、执行走 `do_land_battle_at`+`build_piece`、CSV 卡面文本未改（数据层原本就对） | 5/5 |

A2/A3/A5/A6/A7 在旧四选一实现下会立即变红。`tools/_probe_8600_south.js`、`tools/_probe_jp_response_records.js` 为只读探针。

## 4 回归清单

```
node --check rules.js                        OK
_real_test_8600_south_plan.js                 18/0
_real_test_supp_jp.js（B4 原有）              17/0
_smoke_jp_response.js 8600 段（断言更新）     通过；全脚本 67/9 为白名单预存
test_basic_cards.js                          288 / 9（基线一致）
全量冒烟 114 脚本   未登记失败 4 个，与前几轮完全一致（零新增）
check_reuse.js      B/C 干净；21 WARN 全是既有 A 类索引漂移
```

`_smoke_jp_response.js` 的 9 项失败全在 15427/15428/15431/15419 等其它卡与白名单段，与 8600 无关（该脚本在 `_smoke_skip.json` 白名单 `[B]`）；`_smoke_status.js`(2) 亦为白名单预存。

## 5 边界 / 已知

- 「战斗地区建设陆军」按卡面在**玩家所选地区**建设；陆战为空打（无守军）时仍建设，符合「两句独立」口径。
- `do_land_battle_at` 内 `do_battle` 若产生 `pending_battle`（空军代受等），后续 `build_piece` 仍按既有 15435/15422 的顺序执行模式立即进行；若将来玩家报「代受时建设顺序」问题，再按 `rtt-response-stack` 的 defer 范式单独处理。
- 候选按「打出那一刻」的 `battle_initiators` 冻结；中途其它效果改变发起单位不会重算（与 15231 同款）。
- 未改客户端 → `play.html` 版本串不 bump；改了 `rules.js` → 需硬重启 8091 才生效。
