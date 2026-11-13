# D1 / P10 前奏手牌区改为「Hand 上方独立 panel + 真实卡图」（2026-11-12）

> 前置：`change-D1-P9-hand-zone.md`。**P9 的实现方式被玩家纠正，本条取代它。**

## 1. 玩家纠正

P9 把「前奏手牌区」做成了**右上角浮动面板里的一块文字卡片**。玩家原意是：

> 「直接在 hand 上方加一个区块作为前奏 hand 区，用真实卡图而不是现在的样式。」

即：
- 位置 = 正式 `Hand` 面板（`#hand_wrap`）**上方**的独立 `.panel`，不是浮动面板内；
- 卡片 = **真实卡图**（复用正式 Hand 同款 `build_card_elt`），不是文字块；
- 牌堆顶仍与手牌一起展示、永远固定在最右（P9 这条口径保留）。

只读核对：`cards/` 下 **125 张前奏/军备卡全部有 webp 卡图**，`card_image_url(c)` 把 `c.img` 的 `.png` 换 `.webp`；`build_card_elt(c)`（`play.js:1004`）铺 `backgroundImage`、缺图时回落文字卡。`.card` CSS 为 120×180px。

## 2. 改动清单

| # | 文件 / 位置 | 改法 |
|---|---|---|
| 1 | `rules.js` `view.prelude` | `hands[n]` 补 `type`；`deck_top[n]` 补 **`img` + `type`**（原来只有 id/name/text，客户端无法铺卡图）。牌堆顶仍只对己方下发卡面，敌方 `null` |
| 2 | `play.html` | 在 `.panel-list` 内、`#hand_wrap` **之前**插入 `#prelude_hand_wrap`（`class="panel"` + `panel-head` + `panel-body#prelude_hand_cards`），默认 `style="display:none"` |
| 3 | `play.js`（新函数） | `update_prelude_hand_zone()`：用 `build_card_elt({id,name,text,img,type})` 渲染真实卡图；手牌逐张 + 牌堆顶一起放进 `#prelude_hand_cards`；牌堆顶 `order:999` + `marginLeft:auto` 永远最右，加金色虚线 outline 与「牌堆顶」角标；可点性只看 `view.actions`（手牌→`prelude_play_hand{card}`、牌堆顶→`prelude_play_top`）；非前奏局/前奏结束/无手牌无牌堆顶整块隐藏 |
| 4 | `play.js` `update_prelude_box` | **删除** P9 加的浮动面板文字手牌区（html 容器 + `addCard` DOM 段）与无用 `top` 变量；浮动面板只保留紧张度/段窗口/持续段/后备/诊断/按钮 |
| 5 | `play.js` `update_map` | 每帧调用 `update_prelude_hand_zone()` |
| 6 | `play.html` | 版本串 `20261112g → 20261112h`（7 处） |
| 7 | `tools/_test_prelude_hand_zone.js`（重写） | 19 项：服务端 `img/type` 真实下发、敌方 `deck_top=null`、panel 位置在 `hand_wrap` 之前、`build_card_elt`/`card_image_url` 真卡图、牌堆顶固定最右、隐藏条件、交互只看 `view.actions`、版本串 |

**零改动**：规则/引擎逻辑、四套 `PRELUDE_*` 表、`cards.js`、正式 `Hand` 面板本身。

## 3. 部署要点（与 P9 不同）

本轮改了 `rules.js`（服务端 `view` 字段），Node 已加载旧模块 —— **必须硬重启 8091** 才能下发 `img/type`；只刷新页面不够。对局状态持久化在 db，重启后刷新可继续。P9 当时只改静态资源，特意没重启。

## 4. 接线点索引

| 符号 | 作用 |
|---|---|
| `view.prelude.hands[n]` / `deck_top[n]` | 真实卡图所需 `img`/`type` 的唯一来源；新增字段在这里补 |
| `build_card_elt(c)` / `card_image_url(c)` | 正式 Hand 同款卡图元素；**不要**另写 `<img>` 或文字卡片 |
| `#prelude_hand_wrap` / `#prelude_hand_cards` | Hand 上方独立区块；位置由 `play.html` 的 DOM 顺序决定 |
| `update_prelude_hand_zone()` | 手牌区唯一渲染入口，由 `update_map` 每帧调用 |
| `el.style.order = "999"` + `marginLeft = "auto"` | 牌堆顶「永远在最右」的唯一约束；别改绝对定位（换行会错位） |
| `tools/_test_prelude_hand_zone.js` | A–E 五组 19 项验收 |

## 5. 验证与回归

- `_test_prelude_hand_zone.js` **19/0**；前奏十套 68/37/41/25/25/33/28/24/19/19 全过；B34 28 / B35 51 / B36 15 / B37 21 / B38 33 / 8600 18 全过。
- `test_basic_cards` 288/9（基线）、全量冒烟 4 个未登记失败与前几轮一致（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净（21 WARN 为既有索引漂移）、`node --check` 三文件、lints 0。
- 重启 8091 + 探活；8090 预览服不受影响。

## 6. 后续修改指引

1. 改卡图尺寸 → 动 `play.css` 的 `.card`（120×180）或给 `#prelude_hand_cards .card` 单独加缩放，别改 `build_card_elt`。
2. 牌堆顶角标样式 → `update_prelude_hand_zone` 里的 `tag` 与 `outline`。
3. 需要显示更多卡面信息 → `view.prelude` 补字段，客户端只读下发，不二次拼判定。
4. 包：`20261112a` 两个 zip 仍是旧产物，代码经 P10 已 `20261112h`。
