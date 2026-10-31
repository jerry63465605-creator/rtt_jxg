# UI 改造 & 移动端适配 — 接手须知

> 面向：接下来要改**界面**和**手机适配**的同学。
> 本文只讲客户端（`play.html` / `play.css` / `play.js` + `common/client.js`）。
> **不要改 `rules.js`**（规则引擎，改错会让联机不同步）；确有规则需求走服务端同学。

版本：`20261101a` ｜ 模块目录：`server-official/public/quartermaster-sub-wars/`

---

## 1. 一句话架构

```
rules.js（服务端规则，Node 里跑）
   │  每次动作后广播一份 view（纯 JSON，按阵营裁剪）
   ▼
common/client.js（通用外壳：登录、WebSocket、日志、地图缩放）
   │  on_update() 被调用
   ▼
play.js（本模块 UI：全量重绘 + 事件 → send_action）
   ▲
play.css（样式）    play.html（骨架 + 面板容器）
```

**心法：`play.js` 是"把 view 画出来，把点击变成 action"，不含任何规则判定。**
凡是"能不能打、能不能选、谁能看见"——都由服务端 view 决定，客户端不要自己算。

---

## 2. 文件与规模

| 文件 | 大小 | 职责 | 能改吗 |
|---|---|---|---|
| `play.html` | 28 KB | 骨架：工具栏、阶段面板、`#mapwrap/#map`、`#spaces/#pieces`、手牌区、各种 modal、询问框 | ✅ 可改（改完必须 bump 版本串） |
| `play.css` | 56 KB | 全部样式（含 2 条 `@media`） | ✅ 主战场 |
| `play.js` | 426 KB / 239 个顶层函数 | 渲染 + 交互 | ✅ 主战场（见 §4 入口） |
| `layout.js` | 2.2 KB | 格位坐标表，**由 `tools/gen_module_layout.js` 生成** | ❌ 勿手改 |
| `data.js` | 14 KB | 地区/邻接/卡面数据，**生成物** | ❌ 勿手改 |
| `common/client.js` | 47 KB | 通用：连接、聊天、日志、**地图 pan/zoom** | ⚠ 共用文件，改前先问（影响所有模块） |

---

## 3. 刷新模型（先理解这个，改 UI 才不会漏）

- 服务端每次动作后推一份完整 `view`；外壳调用 **`on_update()`**（`play.js:185`）。
- `on_update()` 里几乎全是"**全量重绘**"：清空容器 → 重新 build 元素。
  - 所以：**不要依赖 DOM 元素持久化**（自己缓存的节点下一次 `on_update` 就失效）。
  - 需要跨刷新保留的状态放模块级变量（`view` / `pending_*` / `ask_state` 等）。
- 各面板的渲染入口（改哪块找哪个函数）：

| 面板 | 函数 | 行 |
|---|---|---|
| 阶段条 / 按钮 | `update_phase_panel` / `update_phase_buttons` | 473 / 526 |
| 手牌 | `update_hand_panel` | 3842 |
| 桌面状态卡 | `update_table_status` | 7137 |
| 各类询问框 | `update_armed_offer_box` / `update_pending_trigger_box` / `update_pending_echo_box` | 2284 / 8523 / 5208 |
| 统一询问框 | **`render_ask_box` / `hide_ask_box`** | 5562 / — |
| 高亮 | `highlight_pieces` / `highlight_targets` / `highlight_event_targets` | 8709 / 6017 / 3190 |
| 日志 | `update_log_toggle` | 9074 |

---

## 4. 点击链路（改交互必看）

```
玩家点手牌  → on_click_hand_card(card, elt)     (play.js:3467)
玩家点格位  → on_click_space(evt)               (play.js:9373)   读 evt.currentTarget.space_id
玩家点算子  → on_click_piece(evt)                                读 evt.currentTarget.piece_id
玩家点按钮  → 直接 send_action(name, arg)
```

- `send_action` / `send_query` / `on_reply` 来自 `common/client.js`（**全局函数**）。
- ⚠ **`send_action` 会按 `view.actions` 白名单静默丢弃未授权动作** ——
  按钮做出来了但点了没反应，先看 `view.actions` 里有没有这个名字，不要先怀疑 CSS。
- ⚠ `play.js` 里的顶层 `let/const`（如 `pending_event_targets`）**不挂在 window 上**，
  写自动化测试时读不到，只能断言 DOM 或引擎状态。

---

## 5. 地图坐标系（移动端适配的核心约束）

```css
#mapwrap { width: 4835px; height: 1612px; }   /* 固定虚拟画布 */
#map     { width: 4835px; height: 1612px; background: url(map.webp); }
.space   { position: absolute; /* 坐标来自 layout.js 的 [x,y,w,h] */ }
.unit    { position: absolute; /* margin 负半个身位对齐格心 */ }
```

- 所有格位/算子都是**绝对像素**摆在 4835×1612 上，`layout.js` 生成，勿手改。
- 屏幕适配**不是**靠 CSS 媒体查询缩放，而是 `common/client.js` 的 **pan/zoom 外壳**：
  它把 `main` 里的内容包进 `#pan_zoom_wrap`，用 `transform: scale()` 缩放，
  支持拖动、双指缩放、惯性滚动；缩放上下限来自 `<main data-max-zoom="2">`（还有 `data-min-zoom`）。
- 因此：**别在 CSS 里给 `#map` 加 `transform: scale()`**（会和外壳打架）。

---

## 6. 移动端适配：现状与建议

**现状**
- ✅ 已有 `<meta name="viewport" ... viewport-fit=cover user-scalable=no>`（刘海屏安全区已备）
- ✅ 已有 pan/zoom（触摸拖动 + 双指缩放 + 惯性）
- ⚠ 只有 **2 条 `@media`**：`max-width:700px`（调试面板宽度 / `.space` 字号 / `.unit` 38px）、`max-width:800px`（历史面板 / 回滚条）
- ⚠ 地图上的 `.space` 在 4835px 画布上是 106~118px，缩放到手机宽度后**点击目标可能 <44px**
- ⚠ 询问框（`render_ask_box`）是桌面式浮层，内容多时在小屏会超出一屏

**建议路线（低风险，不动坐标系）**

| # | 目标 | 做法 | 影响面 |
|---|---|---|---|
| M1 | 触控目标够大 | 给 `.space`/`.unit`/按钮加 `min-width/height: 44px`（在缩放后的**有效像素**上评估，必要时把 `data-min-zoom` 提到 0.6） | `play.css` + `play.html` 的 `main` 属性 |
| M2 | 询问框变底部抽屉 | `render_ask_box` 在 `max-width:700px` 下改成 `position: fixed; bottom: 0; max-height: 55vh; overflow:auto`，按钮整行铺满 | 纯 CSS（若结构不够再调 `render_ask_box` 的 DOM 层级） |
| M3 | 手牌区横滑 | `#hand_cards` 用 `display:flex; overflow-x:auto; scroll-snap-type: x mandatory`，卡宽用 `clamp()` | `play.css` |
| M4 | 竖屏提示 | 横屏体验明显更好：加一个"建议横屏"提示条（纯前端，不改地图） | `play.html` + CSS |
| M5 | 双击缩放/双击归位 | 外壳已支持双指缩放；如需双击，在 `play.js` 里给 `#map` 绑 `dblclick`（注意别抢 `on_click_space`） | `play.js` |
| M6 | 字体/行高 | 统一 `font-size: clamp(12px, 3.2vw, 18px)`；`.ask_text` 已设 `white-space: pre-line`（保留换行，别覆盖） | `play.css` |

**不建议**：重做地图坐标系 / 把 `layout.js` 换成百分比。那会牵动 `#pieces` 的算子定位、高亮、拖拽和自动化测试（多组 jsdom 测试断言 `space_id`）。

---

## 7. 类名与视觉约定（改样式前先认这些）

| 类名 | 含义 |
|---|---|
| `.space` / `.space.land` / `.space.sea` | 格位；地形底色 |
| `.space.supply` / `.space.home_base` | 补给点（金边）/ 大本营（暗红边） |
| `.space.target` / `.space.pickable` | **可点高亮**（选目标/选地区） |
| `.unit` / `.unit.army` / `.unit.navy` / `.unit.air` | 算子：三角 / 方块 / 圆（伪元素画形状） |
| `.unit.pickable` / `.unit.out_of_supply` | 可点算子 / 断补红框 |
| `.card` / `.card.t-EVENT` / `.card.t-STATUS` … | 卡牌；`t-*` 是卡类型 |
| `.card.ready` / `.card.ts-disabled` | 状态卡"可发动"高亮 / 置灰 |
| `#ask_box` / `.ask_text` | 统一询问框（**所有"待表态"都走这里**） |
| `.hide` | 通用隐藏类（注意：很多逻辑靠它，别用 `display:none` 覆盖） |

颜色走 CSS 变量（`play.css` 顶部）：`--axis/--allies`、`--land/--sea`、`--piece-edge*`。
**国家色必须拉开色相**（英法、美中同屏操作）。

---

## 8. 性能红线（踩过两次）

- 部队/格位的"可点/断补"高亮**必须是静态样式**。
  以前用 `animation` 改 `box-shadow` + `.unit::before{filter: drop-shadow()}`，
  40 个高亮单位直接把帧率从 600 帧/10s 打到 213 帧（约 −65%）。现在全部改为静态 `box-shadow`。
  **不要加回 `animation`/`filter` 脉冲**；`play.css` 里现存的 `@keyframes` 已标注"已停用"。
- 大列表（手牌、日志）避免每次 `on_update` 重建上千节点；必要时做增量。

---

## 9. 本地跑起来

```bash
# 对局服务器（规则 + 页面）
cd server-official && RTT_PORT=8091 node server.js
# 打开一局
http://localhost:8091/quartermaster-sub-wars/play.html?game=8&role=Allies

# 卡牌预览（静态）
node preview-server.js        # 8090
```

- 改了 `play.js/play.css/play.html` → **只需浏览器刷新**（但见 §10 的版本串）；
- 改了 `rules.js` → **必须重启 server.js**（启动时一次性读入）。
- 造局面用**调试面板**（齿轮菜单 → 调试阶段）：`debug_set_phase` / `debug_place` / `debug_add_card`。
  详见 `docs/debug-panel.md`。

---

## 10. 版本串（不做会吃到浏览器旧缓存）

`play.html` 里 4 个 `?v=`（`play.css` / `data.js` / `layout.js` / `play.js`）要**同步 bump**：

```
?v=20261101a   →   ?v=20261101b   （改完前端就 +1）
```

打包脚本会按 tag 打 zip，版本串是玩家判断"有没有更新"的唯一依据。

---

## 11. 改完必须自测（按顺序）

```bash
# ① 语法
node --check server-official/public/quartermaster-sub-wars/play.js

# ② 真 DOM 闭环（jsdom 加载真实 play.html + play.js，需先 npm i jsdom --no-save）
node tools/_dom_test_15315.js            # 事件卡选地区：点手牌→高亮→点地区→提交→下一步
node tools/_dom_test_17543_highlight.js  # 状态卡高亮：该亮的亮、不该亮的不亮
node tools/_dom_test_17850_modal.js      # 某国专属弹窗只在本国屏幕出现

# ③ 全量冒烟（112 脚本，含服务端与客户端逻辑）
node tools/_run_smoke_report.js          # 期望：未登记失败：无
```

改动只涉及样式时，②③ 也建议跑一遍（`hide` 类、`ready` 类、`space_id` 都可能被 CSS 改动间接触发断言）。

---

## 12. 常见坑（都真实踩过）

1. **按钮显示但点了没反应** → `view.actions` 白名单里没有该动作，`send_action` 静默丢弃。
2. **服务端下发对象、客户端按 id 比较** → `{[object Object]}`，点不中（15355 事故，候选是 `{id,name}`）。
3. **顶层 `let` 不挂 window** → 自动化测试读 `win.pending_xxx` 恒 `undefined`，要断言 DOM 或引擎状态。
4. **给 `.unit::before` 加 `filter`** → 每帧重绘，卡顿。
5. **用 `display:none` 覆盖 `.hide`** → 服务端还会推内容，但你的显隐判断失效；统一用 `classList.toggle('hide')`。
6. **`z-index` 打架**：`#pieces` 在 `#spaces` 之上（`pointer-events:none` + 子元素 `auto`），别把高亮层塞到地图下面。
7. **`.ask_text` 的 `white-space: pre-line`** 是多行文案依赖，覆盖成 `nowrap` 会把两行挤成一行。
8. **改 `layout.js` / `data.js`** → 下次生成脚本会覆盖；且坐标错会连带算子/高亮/测试全错。
9. **在 CSS 里给 `#map` 加 transform** → 与 `client.js` 的 pan/zoom 外壳冲突（缩放会双倍）。
10. **忘记 bump `?v=`** → 玩家看到旧界面，以为你没交。

---

## 13. 交付检查清单

- [ ] 只在客户端文件里改（未触碰 `rules.js`）
- [ ] 没有新增 `animation` / `filter` 动画
- [ ] 所有"待表态"仍走 `render_ask_box`（没有自造第二套弹窗）
- [ ] 手机竖屏/横屏各看一遍：询问框不超出屏幕、按钮可点、手牌可滑
- [ ] `?v=` 已 bump（4 处一致）
- [ ] 三个 `_dom_test_*.js` + `_run_smoke_report.js` 全绿
- [ ] 截图附在 PR/说明里（桌面 + 手机各一张）

---

## 14. 想找参考实现时

| 想做什么 | 看哪个 |
|---|---|
| 事件卡"选地区"两步交互（点卡→高亮→点地区→下一步） | `_dom_test_15315.js` + `on_click_space` 的 event 分支（约 9373 起） |
| 状态卡高亮 / 置灰 | `update_table_status`（7137）+ `.card.ready` / `.ts-disabled` |
| 多目标选算子（敌方空军） | `update_armed_offer_box`（2284）+ `highlight_pieces`（8709） |
| 专属国家弹窗（大清洗） | `update_su_17817_box`（约 8320） |
| 地图 pan/zoom | `common/client.js` 约 1360-1500 |
| 卡面数据字段 | `cards.js`（`CARD_BY_ID`）+ `docs/pitfalls.md` |
