# 敌方状态卡栏（卡面可见 · 永远不可操作）— 2026-10-24

## 一、需求（玩家口径）

在**桌面响应卡栏下面**加一栏「敌方状态卡」：

- **卡面可见**（桌面状态卡本来就是明置信息，不需要藏）；
- **永远不可操作**，表现为类似"非本方回合的手牌"那种**灰置**。

> 早期版本做成"永远背面朝上"，玩家否掉了：他要的是"看得到、点不了"，
> 不是"看不到是什么卡"。已改为正面卡面 + `.ts-disabled` 灰置 + 不绑点击。

## 二、数据层

`rules.js` 的 `exports.view` 新增：

```js
table_status_opponent: [{
	card, name, img, text,          // ← 卡面可见所必需
	nation, owner_side,
	ongoing, trigger, desc,
}]
```

| 设计 | 原因 |
|---|---|
| **下发卡面**（name / img / text） | 桌面状态卡是明置信息；玩家要"看得到" |
| **不下发** `ready` / `ready_reason` / `ready_space` / `cost_discard` / `used_this_turn` / `forgo_build` | 这几个是"能不能发动"的判据。一个都不给 → 客户端无法也无需渲染可点状态，**双端同源地保证"永不可操作"** |
| 口径同 `table_status` | 只统计 `status_config_of()` 有配置的真状态卡；桌上的非状态挂载位不计 |
| 按 `faction_of_nation(nat) !== side` 过滤 | 与 `table_status`（只给本方）互为补集 |

## 三、视图层

| 文件 | 改动 |
|---|---|
| `play.html` | `#response_wrap` 之后新增 `#enemy_status_wrap`（同 `.panel` / `.panel-head` / `.panel-body` 结构），标题「敌方状态卡」 |
| `play.js` | `update_enemy_status()`：复用 **`build_response_card_elt(..., true)`** 画正面卡（自带卡图、文字回落、悬停放大到 `#tooltip`）；加 `es-card ts-disabled` 类与「敌方」角标；**刻意不绑 `onclick`**；在状态刷新流程里紧跟 `update_response_panel()` 调用 |
| `play.css` | `#enemy_status_cards .es-card { filter: grayscale(.7) brightness(.75); cursor: default; }`；`:hover` 轻微提亮到 `grayscale(.35) brightness(.9)`，只为看清卡面，不暗示可点 |

视觉上与「桌面状态卡」里不可发动的那几张完全一致，玩家不会误以为能点。

## 四、验证

`tools/_smoke_enemy_status_view.js`（21 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | 口径：`status_config_of` 认出的才算；BASIC 卡（15401）不计入 |
| B | 双方视角互为补集：本方 3 + 敌方 2 = 5 = 敌方 2 + 3 |
| C | **卡面可见**（有 `name` / `img` / `text\|desc`）且**不含任何可操作字段**（`ready` / `ready_reason` / `ready_space` / `cost_discard` / `used_this_turn` / `forgo_build` 逐个断言 `in` 为 false） |
| D | 空桌面返回 `[]` 而不是 `undefined` |

真机数据（game 25，Allies 视角）：

```
[{ name: '丰富的资源', nation: '德国', hasImg: true, hasReady: false }]
```

## 五、回修入口

| 症状 | 先看 |
|---|---|
| 敌方栏空白但对方有状态卡 | `view.table_status_opponent` 是否有值；`status_config_of` 是否认该卡 |
| 敌方卡看起来能点 / 点了有反应 | ① `update_enemy_status` 是否被误加了 `onclick`；② `view` 是否又下发了 `ready`（有 ready 就可能被别的渲染逻辑当可点） |
| 和本方状态卡分不清 | 灰置滤镜（`grayscale(.7) brightness(.75)`）是否被别处 CSS 覆盖；「敌方」角标是否渲染 |
| 布局太高压到地图 | `#enemy_status_cards { min-height }`（当前 190px，与响应卡一致） |
| 悬停看不到大图 | `build_response_card_elt` 的 `on_focus_card` 绑定是否被替换 |
