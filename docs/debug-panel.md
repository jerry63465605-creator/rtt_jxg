# 调试面板（调试单位 / 调试卡牌 / 调试阶段）

> 建立：2026-10-29
> 相关代码：`play.html`（面板 DOM）、`play.js`（面板逻辑）、`play.css`（样式）、`rules.js`（`debug_*` action + `debug_card_catalog` query）
> 验证脚本：`tools/_verify_debug_panel.js`（31 项）、`tools/_verify_debug_ui_wiring.js`（49 项）

---

## 0. 入口与共同约定

齿轮菜单（`play.html` cog 菜单）拆成三项：

```html
<li onclick="toggle_debug()">调试单位</li>       <!-- 原「调试面板」，功能不变 -->
<li onclick="toggle_debug_cards()">调试卡牌</li>  <!-- 新增 -->
<li onclick="toggle_debug_phase()">调试阶段</li>  <!-- 新增 -->
```

- 三个面板**互斥**：打开一个自动收起另外两个（`close_other_debug_panels(keep)`）；
- 都是左下角半透明浮层，样式共用分组选择器 `#debug_panel, #debug_card_panel, #debug_phase_panel`（卡牌面板单列覆盖为 460px 宽）；
- 所有动作以 `debug_` 开头，因此在 `rules.js` 中**天然豁免**：
  - 行动历史 / 回退检查点（`exports.action` 里 `String(action).startsWith('debug_')` 直通 `do_action`，不记 history、不压 rollback 点）；
  - `status_instant` 窗口清理（`isStatusInternal` 含 `debug_*`）；
  - 各类 `!(arg.__debug) && !String(action).startsWith('debug_')` 的守卫。
- **没有门禁**：正式对局也能点（沿用旧面板行为，未加 `?debug=1` 之类开关）。

---

## 1. 调试单位（原「调试面板」，仅改名）

面板：`#debug_panel`，标题「调试：放置部队」。

| 控件 / 按钮 | 行为 | 服务端 action |
|---|---|---|
| 国家下拉（8 国）+ 军种下拉（陆/海/空） | 设定后续放置用 | — |
| 点地图放置 | 点地图格位放一个临时算子 `dbg_N` | `debug_place {piece, nation, type, space}` |
| 点部队移除 | 点地图上的算子移除 | `debug_remove {piece}` |
| 清空所有部队 | `location/piece_nation/piece_type` 全清 | `debug_clear {}` |
| 结算当前国补给 | 结算**当前行动国**的断补部队 | `resolve_supply {nation}` |
| 下一个行动国 | 按 `view.order_of_nations` 轮转 | `next_nation {}` |

`debug_place` 有同格敌方部队时直接 return（与建设/征召口径一致）。

---

## 2. 调试卡牌（当前国家 → 手牌 / 牌库顶 / 牌库底 / 弃牌堆）

面板：`#debug_card_panel`，标题「调试：卡牌（当前国家）」。

### 2.1 目录来源（query）

打开面板时按 `view.current_nation` 拉一次目录：

```js
send_query("debug_card_catalog", { nation })   // 结果在 on_reply('debug_card_catalog') 里渲染
```

服务端 `exports.query` 分支 **`debug_card_catalog`**：

- 从 `CARD_BY_ID` 全部 446 张里筛出 `c.nation === nation` 的牌面（**只给当前国家**，实测意大利 74 张）；
- 每项：`{ face, name, type, nation, text, img }`，按名称排序；
- **不进常态 `view`**（只在调试面板打开时按需拉，避免每帧多传 60–80 KB）。

### 2.2 面板控件

| 控件 | 作用 |
|---|---|
| 国家标题 | 显示 `当前国家：X`（不可改，随 `view.current_nation`） |
| 类型下拉 `#dbg_card_type` | 全部 / 基本 / 事件 / 增强 / 响应 / 经济战 / 状态 / 前奏事件 / 前奏军备 |
| 搜索框 `#dbg_card_kw` | 名称或文本包含关键字（`oninput` 即时过滤） |
| 去向下拉 `#dbg_card_dest` | 手牌（默认）/ 牌库顶 / 牌库底 / 弃牌堆 |
| 卡图网格 `#dbg_card_grid` | 复用 `card_elt()` 真实卡图，**点一张即加入所选去向** |

### 2.3 服务端 action

```js
send_action("debug_add_card", { face, nation, dest })
```

实现要点（`rules.js`）：

1. `face` 必须能在 `CARD_BY_ID` 找到，否则只写日志、不改状态；
2. `nation` 缺省 = `game.current_nation`；
3. 先 `init_nation_deck(game, nation)`（**幂等**：`if (game.hands[nation]) return`），保证 `game.card_inst[nation]` 序号已就绪；
4. 实例 id = `face + '#' + (++game.card_inst[nation])` —— 与既有实体牌（`face#1..#N`）**不撞号**，同名卡可多次加入得到不同实例；
5. 按 `dest` 落位：

| dest | 落点 | 说明 |
|---|---|---|
| `hand`（默认/未知值） | `hands[nation].push(inst)` | 立即出现在手牌区 |
| `deck_top` | `decks[nation].unshift(inst)` | 下一次摸牌首先摸到 |
| `deck_bottom` | `decks[nation].push(inst)` | 本轮摸不到 |
| `discard` | `discard[nation].push(inst)` | 可配合"从弃牌堆取回"类卡 |

6. 日志统一写「【调试】<国> 的<去向>加入《卡名》」。

> 例：`【调试】意大利 的手牌加入《耀武》`

---

## 3. 调试阶段（清空挂起 → 落位 → 执行阶段入口）

面板：`#debug_phase_panel`，标题「调试：阶段」。

- 国家下拉 `#dbg_phase_nation`（8 国，含法国 / 中国）；
- 阶段下拉 `#dbg_phase_key`（**1–7**，与 `PHASES` 一一对应）：

| # | key | 名称 |
|---|---|---|
| 1 | `resource` | 资源再分配 |
| 2 | `play` | 出牌阶段 |
| 3 | `airforce` | 空军阶段 |
| 4 | `supply` | 补给阶段 |
| 5 | `scoring` | 计分阶段 |
| 6 | `discard` | 弃牌阶段 |
| 7 | `draw` | 抓牌阶段 |

- 按钮「清空状态并跳过去」→ 二次 `confirm`（提示语明确"补给会移除断补部队、计分会结算、抓牌会摸牌"）→

```js
send_action("debug_set_phase", { nation, phase })
```

### 3.1 执行顺序（`rules.js` → `debug_set_phase`）

1. 校验 `phase` 在 `PHASES` 内、`nation` 非空（否则只写日志、不改状态）；
2. `clear_all_pending_for_debug(game, nation)`：
   - **① 挂起窗口 / 队列**：`armed_offers / armed_offer / pending_armed_use / pending_armed_delegate / echo_intercept_queue / echo_intercept_skipped / status_intercept_skipped / response_stack / response_queue / deferred_response_stack / status_instant / pending_status / pending_status_play / pending_battle / pending_econ / pending_event_step / pending_event_armed / event_budget / pending_theater / pending_balloon / pending_trigger / delegate / handoff_stack / _handoff_base / pending_national_skill`
   - **② 本回合临时标记**：`play_done / card_actions_this_nation / it_viva / it_viva_used / status_used / status_suppressed_this_turn`
   - **③ 一次性防抖标记**：`__skip_echo_intercept / __armed_use_resuming / __resuming_echo / __status_firing`（delete）、`__echo_chain_depth = 0`
   - **④ 目标国的国家技能"本回合已用"**：`delete national_skill_used[nation]`
     —— 只清目标国，其它国保留（跳过去后该国 ★ 窗口重新可用）
3. 落位：`current_nation = nation`、`active = Axis/Allies`（按 `faction_of_nation`）、`turn_phase = phase`；
4. **执行阶段入口**（玩家口径：跳过去要真的生效）：

```js
const ENTRY = { resource: phase_resource, play: phase_play, airforce: phase_airforce,
  supply: phase_supply, scoring: phase_scoring, discard: phase_discard, draw: phase_draw }
```

   入口异常被 `try/catch` 兜住并写日志「【调试】阶段入口出错：…」，不中断动作；
5. `refresh(game)` + 日志「【调试】清空挂起态，跳到【X】·<阶段名>」。

### 3.2 注意（会真的改对局）

| 阶段 | 入口会做的事 |
|---|---|
| `supply` | **移除断补部队** |
| `scoring` | **计分结算**（含各状态卡 auto） |
| `draw` | 补手牌到上限（会真的摸牌） |
| `discard` | 进入弃牌阶段流程 |
| `play` / `airforce` / `resource` | 开对应时点窗口（不主动结算） |

不清：部队、手牌、桌面卡、分数、牌库内容（只清**流程状态**）。

---

## 4. 白名单与豁免

- `REGISTERED_ACTIONS`（`rules.js` 内 `base.debug_*`）：`debug_place / debug_remove / debug_clear / debug_draw / debug_add_card / debug_set_phase`；
- `debug_draw` 仍保留（直接摸 N 张，给脚本用）；
- `exports.action` 对 `debug_*` **不记 history / 不压 rollback 点**（调试动作不该污染回退链）。

---

## 5. 验证

| 脚本 | 覆盖 |
|---|---|
| `tools/_verify_debug_panel.js`（31 项） | 目录按国过滤（全部属于当前国、字段齐全、可按参数指定国家）；加牌 4 种去向落位正确 + 实例唯一/可解析/重复不撞号 + 未知面拒绝 + 日志含去向；`debug_set_phase` 清挂起（窗口/队列/响应/战斗/分步/play_done/防抖）+ 国家/阵营/阶段落位 + **入口真的执行**（`phase_note` 写入）+ 未知阶段被拒 + `national_skill_used` 只清目标国；两个新 action 出现在 `actions` 白名单 |
| `tools/_verify_debug_ui_wiring.js`（49 项） | 菜单三项文案、面板 DOM 默认隐藏 + 有 CSS、9 个控件 id、JS 函数与 `send_query/send_action/on_reply` 全链、阶段下拉**恰好 7 项**（在 `#dbg_phase_key` 内统计）、国家下拉 8 国、去向 4 项 |

跑法：

```bash
cd c:/Users/24968/Desktop/rtt
node tools/_verify_debug_panel.js
node tools/_verify_debug_ui_wiring.js
node tools/_run_smoke_report.js      # 全量 108 脚本
```

---

## 6. 已知边界（未做）

- **加牌不受手牌上限约束**（`HAND_LIMIT` 不检查），一次加多张会超上限，需在弃牌阶段自行处理；
- 调试面板**无权限门禁**，正式对局同样可用（沿用旧面板口径）；
- 前奏事件卡 / 军备卡可以加入手牌，但前奏机制整体**未实装**（见 `docs/todo-2026-10-29.md`）；
- 未提供"从手牌删除一张""修改分数""修改牌库顺序"等其余调试能力（需要时按本文件 §2.3 的模式扩展 `debug_*` action 即可）。
