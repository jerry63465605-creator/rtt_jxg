# D1 / P14 检视类对齐 `15229`：整堆候选 + 单一选牌窗口 + 卡图 modal

> 前置：`docs/checklist-D1-germany.md`。玩家逐卡核对第 1 条（14903）：「检视应该参考 15229 的客户端 UI 行为和实现」；随后裁定「**整堆**，候选为空则**跳过该段、留一个日志**，执行」。

## 1. 只读核对到的差异（14903 vs 15229）

| 维度 | `15229 生产构思`（参考） | `14903 进军莱茵兰`（改前） |
|---|---|---|
| UI | `script_modal`：`card-grid` + `card_elt` 真实卡图、点选高亮 `.sel`、`0/N`、确认按钮、**无取消** | 浮动面板里一排文字按钮，点一下直接提交，带「放弃」 |
| 候选数据 | `script_state` query → `candsRaw.map(card_info)`，含 `img/name/type/text` | `view.prelude.op_window.candidates` 只有 `{id,name}` |
| 候选范围 | **整堆**筛 `type==='STATUS'` | `slice(0, peek_scope=3)`（`peek.n=null → \|\|3`），只看前 3 张 |
| 窗口数 | 1 个选牌窗口 | **2 个**：`peek_reorder` choice（顶/底/custom）→ `peek_and_play` card；卡面无「置于顶/底」语义 |
| 选中后 | 状态卡放桌面+生效+洗混牌堆 | `prelude_resolve_card` → 军备卡按 P5 **暗置留场** ✓ 语义正确 |

**这是一类问题**：`peek_reorder` + `peek_and_play`/`join_hand`/`play_response` 组合的卡共用同一条链（德国 `14903`/`14907`/`14900`，全量还有 `18412`/`18004`/`17204`/`17207`/`14918`）。本轮一类一起改。

## 2. 改动清单

| # | 文件 / 符号 | 改法 |
|---|---|---|
| 1 | `prelude_compiler.js` 段后处理 | 段内同时有检视 op **和**选牌 op 时，给 `peek_reorder` 标 `silent:true`（只提供来源/范围，不开排序窗口）；`peek_scope = peek.n \|\| null`（**null = 整堆**，不再默认 3）。`18300` 等无后续选牌 op 的仍保留顶/底/自定义排序窗口 |
| 2 | `rules.js` `prelude_op_window_kind` | `peek_reorder.silent` → 返回 null；`prelude_run_steps` 遇 `silent` 直接跳过（不执行、不开窗），避免走 default 记「暂不执行」 |
| 3 | `rules.js` 新增 3 个 helper | `prelude_peek_count()`（整堆 / 明写「前 N 张」唯一判定，明确区分 `peek_scope` 与 `op.n`=打出张数）、`prelude_cand_info()`（候选带 `img/type/text`，对照 `card_info`）、`prelude_inspect_op()`（哪些 op 是检视选牌） |
| 4 | `rules.js` `prelude_op_candidates` | 三个 `card` 候选分支统一按整堆/前 N 张取，候选对象带卡图信息；`op.n` 不再被误当范围 |
| 5 | `rules.js` `prelude_run_steps` | 检视窗口建时加 `inspect:true` / `cancellable:false` / `need`；**空候选 → 跳过该段 + 日志「整堆无符合条件的牌，跳过该段（不建窗口）」**（其他 op 无候选仍是只跳过自己） |
| 6 | 双门禁 | `build_actions` 按 `cancellable` 不下发 `prelude_op_skip`；`prelude_do_action` 服务端也拒绝放弃检视窗口 |
| 7 | `view.prelude.op_window` | 下发 `inspect` / `cancellable` / `need` |
| 8 | `play.html` | 新增独立 `prelude_peek_modal`（不复用正式 `script_modal`）：`card-grid` 真实卡图 + `.sel` 高亮 + `0/N` + **确认选择**，无取消；grid 加 `max-height:52vh;overflow:auto` 支持整堆滚动 |
| 9 | `play.js` | 新增 `update_prelude_peek_modal()` / `confirm_prelude_peek()`，`update_map` 每帧调用；检视窗口在浮动面板只留提示、不出候选按钮；**顺手修 P4/P12 遗留 bug**（见 §3） |
| 10 | `play.html` | 版本串 `20261112j → 20261112k`（7 处） |
| 11 | 测试 | 新增 `tools/_real_test_P14_inspect_ui.js`（26 项）；P2 D / P6 D / P7 B·C / P8 B 组断言按「单一窗口 + 整堆」口径更新 |

**零改动**：`15229` 与正式 `pending_script`/`script_modal` 实现、P5 暗置口径、四套 `PRELUDE_*` 产物表结构、`cards.js`、正式出牌链。

## 3. 顺手修掉的一处遗留 bug

`view.prelude.op_window.op` 下发的是**字符串**（P4 形态 `op: p.op_window.op.op`），但 P12 的 `update_prelude_hand_zone` 写的是 `p.op_window.op.op === "discard_prelude_hand"` —— 恒为 `undefined`，**弃 1+1 的「点选要弃」客户端交互实际一直没生效**。改为兼容字符串/对象两种形态，P14 F 组静态守卫覆盖。

## 4. 边界与口径说明

- **整堆口径只作用于「检视 → 选牌」窗口**。`peek_reorder` 的顶/底/自定义**排序**窗口仍按卡面「前 N 张」/默认 3（P6 重排测试依赖此行为）；否则整堆移到底等于没变。
- 「检视弃牌堆」`14918`（`n:null`）也整堆，走同一个卡图 modal。
- 卡面明写「检视牌堆前 10 张」的 `14907`/`18412` 仍按 10 取（P7/P8 断言不回归）。
- **不可放弃**照 `15229`：牌已摊开，取消等于免费偷看。候选为空时由服务端「跳过该段」兜底，不会卡死（P14 D 组实测：无军备卡 → 不建窗口、留日志、C 段反制窗口仍在、答完能进卡牌阶段）。

## 5. 验证与回归

- `_real_test_P14_inspect_ui.js` **26/0**：A 编译收口、B 单一窗口+整堆候选带卡图、C 双门禁+暗置留场、D 空候选跳过段不卡死、E 排序窗口/前 10 张/弃牌堆整堆不回归、F 静态守卫。
- 十四套 68/37/43/25/25/33/28/24/19/21/27/21/20/26 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；`test_basic_cards` 288/9、全量冒烟 4 个基线失败（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0；覆盖率 408/408=100%、方括号零遗漏。
- 改了 `rules.js` → 硬重启 8091 + 探活。

## 6. 接线点索引

| 符号 | 作用 |
|---|---|
| `prelude_compiler.js` 段后处理 `peek.silent` / `peek_scope = peek.n \|\| null` | 单一选牌语义与整堆标记的唯一来源 |
| `prelude_op_window_kind(op)` | `silent` 不开窗的唯一判定点 |
| `prelude_peek_count(game, nation, op, src, useN)` | 整堆 / 前 N 张唯一判定；`useN=true` 只给 `peek_reorder` 自身 |
| `prelude_cand_info(game, id)` | 候选卡图信息唯一来源 |
| `prelude_inspect_op(op)` | 检视类 op 唯一判定（决定 modal / 不可放弃 / 空候选跳过段） |
| `prelude_run_steps` 的 `inspect: insp, cancellable: !insp` | 窗口标记唯一落点 |
| `build_actions` / `prelude_do_action` 的 `cancellable` 判断 | 双门禁 |
| `play.js:update_prelude_peek_modal` / `confirm_prelude_peek` | 客户端检视 UI 唯一实现 |
| `tools/_real_test_P14_inspect_ui.js` | A–F 六组 26 项验收 |

## 7. 后续核对候选（第 2 条起）

1. **`14900 德奥合并` B 段**：卡面「`[弃置1张手牌]` 检视牌堆，选择并将 1 张`[战略卡]`置入手牌」，编译层当前只产出 `peek_reorder{source:'formal',n:null}`、**没有选牌 op**，所以仍会弹一个无卡面依据的顶/底 choice 窗口。这是编译层漏识别「选择并将…置入手牌」，与 P14 不是同一处，建议单独一条修。
2. `14907`/`18412`/`18004`/`17204` 的「检视正式牌堆」候选整堆/前 10 张在实机上确认牌堆张数与卡图显示（整堆可能很多牌，modal 已支持滚动）。
3. 其余按 `docs/checklist-D1-germany.md` 的「一类问题」表继续逐类验收。

## 8. 状态

本轮未打包、未提交；版本串 `20261112k`。包 `20261112a` 两个 zip 仍是旧产物，按玩家「打包等前奏基本完成后再说」。
