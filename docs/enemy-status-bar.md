# 敌方状态卡栏（永远暗置）— 2026-10-24

## 一、需求

在**桌面响应卡栏下面**加一栏「敌方状态卡」，并且**永远为暗置**（看不到卡面）。

## 二、实现

### 数据层（暗置的真正保证）

`rules.js` 的 `exports.view` 新增字段：

```js
table_status_opponent: [{ nation, owner_side }, ...]
```

| 设计决定 | 原因 |
|---|---|
| **只下发 `nation` / `owner_side`**，不含 `card_id` / `name` / `img` / `text` | 需求是"永远暗置"。若把卡面数据发下去，改前端就能看穿，等于没暗置。**暗置必须由数据层保证** |
| 逐张一条（而非 `{nation, count}`） | 与 `view.table_responses_opponent` 同款，客户端可直接按条画牌背、按国着色 |
| 口径与 `table_status` 一致：只统计 `status_config_of()` 有配置的 | 桌上可能挂着非状态类卡（如 17901 工业心脏的 ongoing 位），那些不该进"状态卡"计数 |
| 过滤 `faction_of_nation(nat) !== side` | 与 `table_status`（只给本方）互为补集 |

### 视图层

| 文件 | 改动 |
|---|---|
| `play.html` | 在 `#response_wrap` 之后加 `#enemy_status_wrap`（同 `.panel` / `.panel-head` / `.panel-body` 结构） |
| `play.js` | 新增 `update_enemy_status()`：读 `view.table_status_opponent`，逐张画 `<div class="card back status-back back-xx">`；在状态刷新流程里紧跟 `update_response_panel()` 调用 |
| `play.css` | `#enemy_status_cards` 与响应卡面板同尺寸（`min-height:190px`）；牌背复用 `.card.back` 的八国配色；`.status-back::after { content:"状态" }` 与响应卡的「响应」区分；**`pointer-events:none`**（纯展示，避免被误当成可发动状态卡） |

### 视觉约定

- 牌背按国家着色（`back-de` 铁灰 / `back-jp` 赭金 / …），玩家能看出"谁的、几张"，但看不到是什么卡
- 竖排文字为「状态」（响应卡是「响应」），两栏一眼可分
- 悬停 `title` 提示：`敌方状态卡（暗置 · 德国）`
- 标题旁计数：`（对方 3 张 · 暗置）`；空时显示 `（对方桌面暂无状态卡）`

## 三、验证

`tools/_smoke_enemy_status_view.js`（19 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | 口径：`status_config_of` 认出的才算；BASIC 卡（15401）不计入 |
| B | 双方视角互为补集：本方 3 + 敌方 2 = 5 = 敌方 2 + 3 |
| C | **字段恰好只有 `nation` / `owner_side`**；不含 `card_id` / `name` / `img` / `text` / `card`；不含 `#`（实例 id 形态） |
| D | 空桌面返回 `[]` 而不是 `undefined` |

全量 67 个 smoke：失败 19 个，名单与改动前一致。

## 四、回修入口

| 症状 | 先看 |
|---|---|
| 敌方栏空白但对方明明有状态卡 | `view.table_status_opponent` 是否有值；`status_config_of` 是否认该卡 |
| 敌方栏显示成正面卡 / 能看到名字 | **数据层泄露**：检查 view 是否不小心下发了 `card_id`/`name`/`img`（这是唯一真正的"暗置"入口） |
| 两栏长得一样分不清 | `.status-back::after` 的 `content:"状态"` 是否被覆盖 |
| 点敌方牌背弹出状态卡面板 | `#enemy_status_cards .card` 的 `pointer-events:none` 是否被别处覆盖 |
| 布局太高压到地图 | `#enemy_status_cards { min-height }` 调小（当前与响应卡同为 190px） |
