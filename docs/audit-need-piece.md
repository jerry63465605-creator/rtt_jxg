# P3-1 审计：`need:'piece'` 点击链（只读）

生成脚本：`tools/_audit_need_piece.js`　生成日期：2026-11-05

## 0. 客户端三种挂起是否支持"选部队"

| 挂起 | 客户端分支 | 说明 |
|---|---|---|
| `pending_echo`（增强卡多步） | ❌ | 需要 `step === 'piece'` 才画选择框；**只有 choice / space 时 piece 会点不到** |
| `pending_armed`（机会卡多步） | ✅ | `on_click_piece` + 候选归一是必需（V26） |
| `pending_event_targets`（事件卡分步） | ✅ | `submit_event_piece` 通道 |

## 1. 服务端返回 `need:'piece'` 的卡（去重）

| 卡号 | 卡名 | 通道 | 出现处 | 客户端可用? | 结论 |
|---|---|---|---|---|---|
| ? | ? | ? | 3532,18829,18909,19067,19131,35310 | ✅ | 走现成分支 |
| 15355 | 特种空勤团突袭机场 | armed | 12176 | ✅ | 走现成分支 |
| 15406 | 南云忠一指挥航空队 | armed | 13002 | ✅ | 走现成分支 |
| 16801 | 哈尔西海军上将 | armed | 12679 | ✅ | 走现成分支 |
| 16802 | 麦克阿瑟陆军上将 | armed | 12725 | ✅ | 走现成分支 |
| 17511 | 美国陆军游骑兵 | armed | 12861 | ✅ | 走现成分支 |
| 17708 | 意大利皇家空军 | armed | 14027 | ✅ | 走现成分支 |
| 17808 | 莫斯科战役 | armed | 13506 | ✅ | 走现成分支 |
| 17809 | 骑兵师 | armed | 13537 | ✅ | 走现成分支 |

> 备注：15407《秋水火箭战斗机》原本走 `need:'piece'`，2026-11-05 已改为 `need:'choice'`（见 B3），
> 因此上面的清单里不会出现它；改造理由是 `pending_echo` 当时没有 piece 分支。
## 2. 真实测试证据（按 rtt-realboard-test 铁律：debug 布阵 + 真实 action + 三层断言 + 残留）

| 脚本 | 覆盖 | 结果 |
|---|---|---|
| `tools/_real_test_15355_sas_airfield.js` | armed `need:'piece'` 全链路：多英国空军 / 多国敌方空军候选、非法目标拒绝、**客户端点击链镜像**（归一 + gate） | **36 项全过** |
| `tools/_real_test_15407_qiushui.js` | 同类"选一支敌机"的对照实现（已改为 `need:'choice'`）：候选下发 / 精确消灭 / 非法拒绝 / 不发动 | **14 项全过** |
| `tools/_real_test_15315_alamein.js` | 事件卡分步（`pending_event_targets` 的 piece 通道）+ 选完点「下一步」 | **21 项全过** |

结论：三条通道（armed / echo-run / event-multistep）里，**armed 与 event-multistep 均有真实测试背书**；
`echo-run` 的 `piece` 分支**客户端缺失**，但目前**没有任何卡**使用它（15407 已迁到 choice），
因此不构成本轮缺陷；将来若要新增 echo+piece 的卡，需先给 `update_pending_echo_box` 补 `step === 'piece'` 分支。

## 3. 逐卡复核清单（8 张 armed piece，抽查用）

| 卡号 | 卡名 | 触发窗口 | 复核要点 |
|---|---|---|---|
| 15355 | 特种空勤团突袭机场 | after_build_air / after_deploy_air | 已由 36 项测试覆盖 |
| 15406 | 南云忠一指挥航空队 | after_deploy_air（多步 choice → piece） | 候选含"空白地块空打"的 `spaceCandidates`，客户端两套候选都要归一 |
| 16801 | 哈尔西海军上将 | after_deploy_air（海战） | 目标限定敌方海军 |
| 16802 | 麦克阿瑟陆军上将 | after_deploy_air（陆战） | 目标限定敌方陆军 |
| 17511 | 美国陆军游骑兵 | after_build_army | 与 17808 同款"选敌方陆军" |
| 17708 | 意大利皇家空军 | after_build_air | 目标为敌方空军 |
| 17808 | 莫斯科战役 | piece_removed | 条件=场上无苏联陆军 + 有可消灭目标（T1 已实测 ready 可满足） |
| 17809 | 骑兵师 | after_build_army | 与 17511 同构 |
## 4. 补充：15000 段的事件卡分步（17532 / 17550 等）

待办里提到的 17532《战区移动》/ 17550 等，**不走** armed 的 `need:'piece'`，
而是走 `event_card_needs()` → `pending_event_targets` 的 `need:'piece'`（框架行：rules.js 18829 / 18909 / 19067 / 19131）。
客户端该通道有 `submit_event_piece`（✅ 支持），并已有 `_real_test_15315_alamein.js`（21 项）作为真实背书的同族实现。

因此三条通道的最终结论：

| 通道 | 客户端支持 | 真实测试背书 | 使用该通道的卡 |
|---|---|---|---|
| armed（`armed_offers.pending`） | ✅ | `_real_test_15355_sas_airfield`（36） | 15355 / 15406 / 16801 / 16802 / 17511 / 17708 / 17808 / 17809 |
| event-multistep（`pending_event_targets`） | ✅ | `_real_test_15315_alamein`（21） | 15315 / 15316 / 17532 / 17550 等 |
| echo-run（`pending_echo`） | ❌ 缺 `step==='piece'` 分支 | —（无卡使用） | 目前 0 张（15407 已迁 choice） |
