# D1 / P20 前奏「建设 1 支海军」与常规建设海军一致（含客户端 UI）

> 前置：`docs/change-D1-P19-deploy-air.md`。玩家逐卡核对反馈：「建设1支海军，执行建设海军，方式和常规建设海军一致，包括客户端ui、」

## 1. 只读核对到的现状（比 UI 更靠前的问题）

`14904 撕毁海军协定`「`[紧张度+1]` 建设1支海军」编译产物：`{op:'build', space:null, type:'海军', n:1}`。同类还有 `18313 光辉号航空母舰`、`18414 赤城号航空母舰`（海军）、`14911 合成橡胶`（陆军）等。

| 层 | 修复前 | 常规建设海军 |
|---|---|---|
| 窗口 | `PRELUDE_OP_WINDOW` **未登记** `build`/`recruit`；`prelude_run_op` 因 `space==null` 直接记「缺少有效地区，跳过」→ **一张都没建** | `can_build_at(...,'navy')` 算候选，玩家选地 |
| 执行 | 即使走到 `prelude_apply_op_choice`，`space` 分支写死 `type='army'`、`build_piece`，**海军会建成陆军**；`recruit` 也误用 `build_piece` | `build_piece(...,'navy',sp)` / `recruit_piece` |
| 客户端 | `op_window` 只有一串文字按钮 | **地图高亮 + 点地区**（`highlight_targets` + `on_click_space`），提示「点地图上高亮的地区，建设 1 支海军」 |

常规建设海军的客户端范式见 `play.js` 的 `reapply_all_highlights()` / `on_click_space()`（`pending_theater.stage='build_navy'` 分支），高亮与点击判定**同一优先级、同源**。

## 2. 改动清单

### 服务端 `rules.js`

| # | 位置 | 改法 |
|---|---|---|
| 1 | `prelude_op_window_kind` | `build`/`recruit` 且卡面**无地区信息**（`space`/`context`/`spaces` 皆空）→ 开 `space` 窗口由玩家选地；已有明确地区的卡仍直接执行（不回归） |
| 2 | 新增 `prelude_space_type` / `prelude_space_check` / `prelude_space_fn` | 前奏 `space` 窗口的**唯一**兵种/判据/执行原子入口：`deploy_air`→`can_deploy_air`、`recruit`→`can_recruit_at`、其它→`can_build_at`；执行 `recruit_piece`/`build_piece`。候选与执行共用，杜绝不同源 |
| 3 | `prelude_op_candidates` 的 `space` 分支 | 改调 `prelude_space_check`，去掉 P19 遗留的 `isAir` 分支 |
| 4 | `prelude_apply_op_choice` 的 `space` 分支 | 同源预检（防绕过候选）+ 正确原子/兵种 + `refresh(game)` + 中文日志「建设/征召/部署 1 支海军/陆军/空军」；空军失败原因保留「部署空军」字样 |
| 5 | `prelude_run_steps` 的窗口 `desc` | `kind==='space'` 时由服务端拼「点地图上高亮的地区，建设 1 支海军」等文案（按 `rtt-client-server-contract`：文案服务端拼、客户端照抄） |

### 客户端 `play.js` / `play.html`

| # | 位置 | 改法 |
|---|---|---|
| 6 | `reapply_all_highlights()` 最前 | 前奏 `space` 窗口 → `highlight_targets({spaces: view.prelude.op_window.candidates})` 每帧重贴 |
| 7 | `on_click_space()` 最前 | 同一优先级：点高亮格 → 校验在候选内 → `send_action('prelude_op_pick',{pick})`；不在候选内 toast 提示 |
| 8 | `update_prelude_box()` | `kind==='space'` 窗口**不再渲染文字候选按钮**，只显示服务端 `desc` + 保留「放弃」出口（与常规一致、同时防死局） |
| 9 | `play.html` | 版本串 `20261112l → 20261112m` |

**零改动**：`can_build_at`/`can_recruit_at`/`can_deploy_air`/`build_piece`/`recruit_piece`/`refresh` 原子、正式局与增强卡实现、编译层、四套 `PRELUDE_*` 表、`cards.js`。

## 3. 边界（本轮未动）

- 卡面带 `context`（如 `18312 Z舰队`「在该海军的相邻地区」、`14921`/`14924`「在战斗地区」）或 `spaces:'one_of'`（多选一）的卡仍走 `prelude_run_op`，**不会**开窗口；这些需要响应栈/上下文，属另一条缺口。
- `18313`/`18414`/`14911` 都是 `type=ARMAMENT`，按 P5 打出即暗置留场，效果到对应时点触发；P20 C 组用它们的编译产物 op 摆窗口验证执行侧按 `op.type` 分流，没有改变 P5 口径。
- `deploy_air` 的 `space` 窗口也一并由地图高亮承担（P19 的判定/执行逻辑不变，只是 UI 统一）。

## 4. 验证与回归

- `_real_test_P20_build_navy.js` **24/0**：A `14904` 不再跳过、开 `space` 窗口 + 中文提示 + 候选是合法海域；B 选海域真建出**海军**（陆军数不变）+ 日志 + 窗口清空；C 三张军备卡编译产物与执行侧按 `op.type` 分流；D 有明确地区的 `recruit` 仍直接执行；E 非法格被同源预检拦下并给原因；F 静态守卫（唯一入口、候选/执行同源、客户端地图高亮与点击同优先级、移除文字按钮、版本串）。
- P19 的静态守卫按「判据收口到 `prelude_space_check`」更新；P16/P17/P18/P19 的版本串断言改为统一性校验（后续期 bump 不再写死）。产品日志保留「部署空军」字样，P19 的失败原因断言不回归。
- 二十套 68/37/43/25/25/33/28/24/19/21/27/21/20/26/29/33/14/21/17/24 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；`test_basic_cards` 288/9、全量冒烟 4 个基线失败（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0；覆盖率 408/408=100%、方括号零遗漏。
- 改了 `rules.js` + `play.js` → 硬重启 8091 + 探活。

## 5. 接线点索引

| 符号 | 作用 |
|---|---|
| `prelude_op_window_kind` 的 build/recruit 条件 | 何时开选地窗口的唯一判据 |
| `prelude_space_type/check/fn` | 兵种 / 判据 / 执行原子的唯一入口（候选与执行共用） |
| `prelude_run_steps` 的 `kind==='space'` desc | 客户端提示文案的唯一来源 |
| `play.js:reapply_all_highlights` 前奏分支 | 地图高亮（与点击同优先级） |
| `play.js:on_click_space` 前奏分支 | 点地区提交 `prelude_op_pick` |
| `play.js:update_prelude_box` 的 `kind==='space'` 分支 | 不再出文字候选按钮 |
| `tools/_real_test_P20_build_navy.js` | A–F 六组 24 项验收 |

## 6. 状态

未打包、未提交；版本串 `20261112m`。逐卡核对候选：`14900` B 段漏产出选牌 op、`deploy_air` 卡面地区限定未落进 op、带 `context` 的建设/征召卡尚无选地窗口。
