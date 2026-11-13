# D1 / P12 撤销打牌补牌 + 前奏手牌区全程/友军可见（2026-11-12）

> 前置：`change-D1-P11-play-flow-b.md`。本条**推翻 P11 的补牌口径**（玩家明确「之前口径有误」），并新增可见性要求。

## 1. 玩家口径

> 「之前口径有误，打出牌后不应该摸牌。并且我希望整个前奏阶段，前奏手牌区可见，并且友军前奏手牌区也可见」

只读核对依据：
- `view.prelude` 的 `isOwn = faction_role_of_nation(n) === current` 按**阵营**判定，同阵营 3 国本来就下发完整 `hands[]`（卡面 + `img`/`type`）与 `deck_top`（卡面），敌方只见 `hands[n]` 数字、`deck_top[n]=null` —— **服务端字段无需改动，缺口在客户端只渲染了 `view.current_nation` 一国**。
- 规则书 `:121-123` 卡牌阶段「弃置所有前奏手牌 → 摸 2 张」仍在，且玩家此前撤回过一次该改动（「我说错了，你原来的没有问题」）→ **保留**。
- 「打出牌堆顶」后 `shift` 露出新顶属消耗牌堆顶，**不是摸牌** → 保留。

## 2. 改动清单

| # | 文件 / 符号 | 改法 |
|---|---|---|
| 1 | `rules.js` `prelude_do_action` 的 `prelude_play_hand` | 删除 `prelude_draw(game,n,1)` 与补牌日志，恢复「打出即移除、牌堆长度/牌堆顶都不变」 |
| 2 | `play.js` `update_prelude_hand_zone` | ① `p.enabled` 期间**常驻可见**（去掉 `if (!myHand.length && !top) hide()`；空手牌显示「（无前奏手牌）」占位），只有 `!p.enabled \|\| p.ended` 才隐藏；② 遍历 `p.hands` 中所有**数组型**国家（= 同阵营我方 + 友军），每国一个子区块（标题带国名 / 「当前行动」或「友军」/ 张数 + flex 卡片行）；③ 各国牌堆顶仍 `order:999` + `marginLeft:auto` 固定在该国手牌最右；④ **只有当前行动国**的卡片可点，友军卡片置灰只读 |
| 3 | `play.html` | 版本串 `20261112i → 20261112j`（7 处） |
| 4 | `tools/_real_test_P12_visibility.js`（新） | 21 项：同阵营 3 国完整下发 / 敌方只见数量 / 换阵营镜像、打出不摸牌、卡牌阶段仍摸 2、卡牌阶段+空手牌+窗口未决时常驻、静态守卫 |
| 5 | 断言更新 | P11 A/F 组改验收「不摸牌」；P7 D 组排序断言回到完整牌堆（`p1` 未被取走）；P3 F 组按多国分组渲染；`_test_prelude_hand_zone.js` D 组改常驻 + 友军多国 + 只读 |

**零改动**：`view.prelude` 下发结构（同阵营已有完整数据）、`cards.js`、四套 `PRELUDE_*` 表、响应栈、乙口径的「点继续才执行卡牌阶段」、弃 1+1 选牌与皆空跳过。

## 3. 隐私边界（重要）

「友军可见」= **同一阵营**的 3 国。服务端仍只给同阵营下发卡面与牌堆顶，敌方国家 `hands[n]` 是数字、`deck_top[n]` 是 `null`，客户端 `own` 过滤 `Array.isArray(...)` 直接排除，不渲染任何敌方卡面。P12 A 组用真实 `R.view` 双向验证（换阵营后镜像）。

## 4. 部署

改了 `rules.js` → **必须硬重启 8091**；`play.js`/`play.html` 为静态资源，刷新即生效。对局状态在 db，重启后可继续。

## 5. 验证与回归

- `_real_test_P12_visibility.js` **21/0**；`_test_prelude_hand_zone.js` 19→**21/0**；P11 **27/0**、P7 24/0、P3 25/0。
- 前奏十二套 68/37/43/25/25/33/28/24/19/21/27/21 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过。
- `test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。

## 6. 接线点索引

| 符号 | 作用 |
|---|---|
| `prelude_do_action` 的 `prelude_play_hand` | 打出手牌唯一执行点；**不要**再加补牌 |
| `prelude_do_action` 的 `prelude_play_top` | 打牌堆顶唯一执行点；shift 露新顶保留 |
| `prelude_run_phase(CARDS)` 经 `prelude_next` | 卡牌阶段「弃光 → 摸 2」唯一合法摸牌点 |
| `view.prelude.hands[n]` / `deck_top[n]` | 数组/对象 = 同阵营完整卡面；数字/null = 敌方。改隐私判定改 `isOwn` |
| `update_prelude_hand_zone` 的 `own` 过滤 | 友军可见唯一实现点；`Array.isArray` 是阵营隐私边界 |
| `const isCur = (nat === cur)` | 友军只读、当前国可点的唯一判据 |
| `tools/_real_test_P12_visibility.js` | A–D 四组 21 项验收 |

## 7. 后续修改指引

1. 若玩家要求「打出牌堆顶后也补手牌」，改 `prelude_play_top` 分支，并同步 P12 B 组断言与 P7 排序测试。
2. 若要把友军手牌区做成横向并排，只改 `update_prelude_hand_zone` 的 `group`/`row` CSS，服务端数据与 `own` 过滤不变。
3. 前奏结束（正式局）后手牌区隐藏；若希望保留为空面板，改 `p.ended` 判定。
4. 包：`20261112a` 两个 zip 仍是旧产物，代码经 P12 已 `20261112j`；按玩家要求「打包等前奏基本完成后再说」。
5. **仍挂起**：`14900` A 段 `play_prelude` 连锁打牌覆盖 `p.pending` 段窗口（见 P11 文档 §4）。
