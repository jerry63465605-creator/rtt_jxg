# D1 / P9 前奏手牌区 UI（2026-11-12）

> ⚠ **本条实现方式已被 `change-D1-P10-real-card-hand.md` 纠正并取代**：玩家原意是「正式 Hand 面板上方的独立区块 + 真实卡图」，不是右上角浮动面板里的文字卡片。以下保留作追溯，勿据此继续修改。
>
> 前置：`change-D1-P8-formal-play.md`。本轮**只改客户端静态资源**，服务端 `view.prelude` 结构与规则/引擎零改动。

## 1. 玩家需求

「客户端 UI 单出一部分作为**前奏手牌区**，牌堆顶的牌可见、**放入前奏手牌区一起展示**，但牌堆顶**永远显示在手牌右侧**」。

旧面板把手牌压成一行文字（`手牌：A、B、C`）、牌堆顶是另一个独立文字块，两者分离且无专门区域。

## 2. 改动清单

| # | 文件 / 位置 | 改法 |
|---|---|---|
| 1 | `play.js:update_prelude_box` html 段 | 移除旧的「手牌：」一行与独立牌堆顶文字块；新增带标题与边框的 `prelude_hand_zone` flex 容器（`display:flex;flex-wrap:wrap;gap:5px`）。条件 `myHand.length \|\| top` 才渲染 —— 敌方视角 `top=null` 且 `myHand=[]`，整区不显示，**隐私不变** |
| 2 | 同上，DOM 段 | `addCard(c, isTop)` 把每张手牌渲染成 88px 卡片（卡名 + 文本前 42 字）；牌堆顶用 `addCard(top, true)` **追加在手牌之后**，样式 `order:999;margin-left:auto` + 虚线金边 + 「牌堆顶」角标 —— 无论手牌几张、是否换行，永远固定在最右 |
| 3 | 交互 | 卡片可点性**只看 `view.actions[act]`**（手牌→`prelude_play_hand{card}`，牌堆顶→`prelude_play_top`），不二次拼 `phase`/`pending`/`op_window` 判定（服务端双门禁同源）。移除被卡片取代的逐张「打出：xxx」按钮，保留「打牌堆顶」「弃 1 手牌 + 弃 1 牌堆顶」 |
| 4 | `play.html` | 版本串 `20261112f → 20261112g`（7 处） |
| 5 | `tools/_test_prelude_hand_zone.js`（新） | 13 项静态守卫：独立区、卡片化、DOM 顺序、`order:999`、角标、只看 view.actions、敌方隐私、按钮保留、版本串 |
| 6 | `tools/_real_test_P3_prelude_ops.js` F 组 | 断言由 `myHand.forEach(c => addBtn` 改为 `myHand.forEach(c => addCard(c, false))` |

**零改动**：`rules.js`、`prelude_compiler.js`、`view.prelude` 字段、四套 `PRELUDE_*` 表、`cards.js`。

## 3. 部署要点

`play.js` / `play.html` 是 Express 静态资源，每次请求读文件 —— **无需重启 8091**，刷新对局页即可（版本串已 bump，浏览器会拉新的 `play.js?v=20261112g`）。本轮特意不重启，避免打断玩家正在进行的实机测试对局。

## 4. 验证与回归

- `_test_prelude_hand_zone.js` **13/0**；前奏十套 68/37/41/25/25/33/28/24/19/13 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过。
- `test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check`、lints 0。
- 8091 / 8090 均 `HTTP=200`（未重启）。

## 5. 后续修改指引

1. 改手牌卡片样式/宽度 → 只动 `addCard` 的 `cssText`（`flex:0 0 88px` 等）。
2. 改「牌堆顶永远在右」的实现 → `order:999;margin-left:auto` 是唯一约束，别改成绝对定位（换行会错位）。
3. 若要显示卡图 → `view.prelude.hands[].img` / `deck_top` 目前只下发 name/text，需先在 `view` 补 img 字段。
4. 新增可点交互 → 必须继续只读 `view.actions`，不要在客户端复算服务端判定（`rtt-client-server-contract`）。
