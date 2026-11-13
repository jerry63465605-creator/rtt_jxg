# D1 / P19 前奏「部署空军」对齐增强卡同源实现

> 前置：`docs/change-D1-P18-card-fixes.md`。玩家逐卡核对反馈：「部署空军参考增强部署空军的实现。」

## 1. 只读核对到的既有范式（增强卡）

按 `rtt-effect-recipes` / `rtt-atomic-operations` 找到三张参考实现：

| 参考卡 | 位置 | 做法 |
|---|---|---|
| `15408 山本五十六` / `17514 飞虎队` / `17815 Z计划` | `event_card_needs` 的 deploy 分支、`run` | 候选遍历全图用 `can_deploy_air(game,nat,n).ok`；执行 `build_piece(game,nat,'air',space)` 后 `refresh(game)` |
| `15208 齐柏林伯爵号` | `armed.ready` + `armed.run` | 预检与执行**都**判 `can_deploy_air(game,'德国',sp,{terrain:'sea'})`，失败给 `skip + reason`，不白扣代价 |
| `can_deploy_air` 定义 | `rules.js` | `air_host_check`（同格有**处于补给状态**的本国陆/海军载体）+ `unit_slot_free`（每格 1 支本国空军）；`opts.terrain` 可限定海/陆 |

`can_deploy_air` 的注释明确写着：

> **不能用 `can_build_at` 校验空军** —— 空军的载体是「同格」陆/海军，而 `can_build_at` 只查「相邻」补给陆军，对靠海军搭载的**海域空军一律误判非法**。

## 2. 前奏侧的差异（修复前）

`prelude_op_candidates` 的 `space` 分支：

```js
const chk = can_build_at(game, nation, sp, 'air')
...
if (out.length >= 16) break      // 还把候选截断到 16 个
```

`prelude_apply_op_choice` 的 `space` 分支：`build_piece(game,owner,'air',pick)` 原子本身是对的，但**缺同源预检**、**缺 `refresh(game)`**；日志统一写「部署 N 支部队」。

实测复现（清空开局棋子后摆「海格 8 波罗的海 + 补给中本国海军」）：

| 判据 | 结果 |
|---|---|
| `can_deploy_air` | `{ok:true, reason:'依托同格陆/海军'}` |
| `can_build_at(..., 'air')` | `{ok:false, reason:'须位于本国大本营或邻接处于补给状态的同国部队'}` |

即旧实现下这张卡**根本不会把该海格列为候选**。涉及 7 张前奏/军备卡：`18303`、`18315`、`14908`、`14914`、`18403`、`18016`、`17214`。

## 3. 改动清单（只改 `rules.js`，客户端零改动）

| # | 位置 | 改法 |
|---|---|---|
| 1 | `prelude_op_candidates` 的 `space` 分支 | `deploy_air` 改用 `can_deploy_air(game,nation,sp)`；其它 op 保持 `can_build_at`；**去掉 16 上限**（与增强卡遍历全图一致，候选与执行同源） |
| 2 | `prelude_apply_op_choice` 的 `space` 分支 | 执行前加**同源预检** `can_deploy_air(game,owner,sp)`（防止绕过候选提交非法格），失败记「无法在 X 部署空军：<reason>」并 return；成功后 `refresh(game)`；日志区分「部署 N 支空军 / 支部队」 |
| 3 | `PRELUDE_OP_DEFERRED.deploy_air` | 过时文案「编译层尚未给 space」改为「候选/预检按 can_deploy_air，与增强卡同源；卡面地区限定待编译层补」 |
| 4 | `tools/_real_test_P19_deploy_air.js`（新） | 17 项编号真实测试 |

**零改动**：`can_deploy_air` / `build_piece` / `refresh` 原子、增强卡实现、编译层、四套 `PRELUDE_*` 表、`cards.js`、`play.js`/`play.html` → **版本串仍 `20261112l`（不 bump）**。

## 4. 边界：本轮未处理的一条相邻缺口

编译层目前把 7 张卡的 `deploy_air` 都编译成 `{op:'deploy_air', n:1}`，**没有把卡面地区限定落进 op**（例如 `18303`「在`<不列颠><北海>`部署1支空军」、`18403`「在陆地地区部署1支空军」）。因此候选是按 `can_deploy_air` 判定的**全图合法格**，尚未按卡面收窄。这是编译层缺字段，与本轮「对齐增强卡判定/执行范式」是两件事，按「一次只做一条」留待后续逐卡核对时处理。

## 5. 验证与回归

- `_real_test_P19_deploy_air.js` **17/0**：A 判据差异（海格+海军 `can_deploy_air=ok` / `can_build_at(air)=false`）、B 真实打出 `14908` 候选含该海格、C 选海格部署出 1 支空军 + 日志 + `refresh`、D 陆格+陆军载体同样可部署、E 绕过候选提交无载体格被预检拦下并给原因、F 静态守卫（非空军仍用 `can_build_at`、去 16 上限、客户端版本串）。
- 十九套 68/37/43/25/25/33/28/24/19/21/27/21/20/26/29/33/14/21/17 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过；`test_basic_cards` 288/9、全量冒烟 4 个基线失败（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0；覆盖率 408/408=100%、方括号零遗漏。
- 改了 `rules.js` → 硬重启 8091 + 探活。

## 6. 接线点索引

| 符号 | 作用 |
|---|---|
| `can_deploy_air(game,nation,space,opts)` | 空军部署判定的**唯一权威**（增强卡与前奏共用） |
| `air_host_check` / `unit_slot_free` | `can_deploy_air` 内部两个判据 |
| `build_piece(game,nation,'air',space)` | 部署执行原子（增强卡与前奏共用） |
| `prelude_op_candidates` 的 `isAir` 分支 | 前奏候选改用权威判据的落点 |
| `prelude_apply_op_choice` 的 `can_deploy_air` 预检 + `refresh` | 前奏执行与增强卡同源的落点 |
| `tools/_real_test_P19_deploy_air.js` | A–F 六组 17 项验收 |

## 7. 状态

未打包、未提交。逐卡核对下一条候选仍是 `14900` B 段编译层漏产出选牌 op；本轮新记一条 `deploy_air` 卡面地区限定未落进 op。
