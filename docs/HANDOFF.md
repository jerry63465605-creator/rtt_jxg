# 军需官·次要战场（quartermaster-sub-wars）交接文档

> 本文档供「切换模型后」的新 AI 快速接手本项目使用。它描述**当前真实架构**，不做重复踩坑叙事——踩坑细节请直接看 `docs/pitfalls.md` 与 `docs/triggers.md`，本文只做索引与必读摘要。
> 最后更新：2026-09-25

> ⚠ **【2026-09-28 标注】本文部分内容已过时，接手时请先读下面两份新文档**：
> - `docs/project-structure.md` —— **项目结构的最新事实**（文件规模、431 张卡分布、已实现范围、工具链、测试状态）。本文 §2/§5/§6/§8/§10 的行数与规模已被它取代。
> - `docs/known-issues.md` —— **当前遗留问题清单**。
>
> 已知过时点（勿照抄）：
> - 本文说「响应卡 Step 3 未实现」→ **现已实现**（`trigger_response` / `pass_response` 已在 action 列表）。
> - 本文说 rules.js ~6500 行 → **现为 10198 行**；play.js ~3000 → **4321 行**。
> - 本文未包含 2026-09-27 起的六国卡组（431 张）与 R28–R36 的修复。

---

## 0. 一句话背景

这是基于 **RTT（rally-the-troops）引擎**的一个二战桌游模块「军需官·次要战场」。引擎本体在 `server-official/`，本模块在 `server-official/public/quartermaster-sub-wars/`。模块 = 一组约定文件（rules.js 服务端 + play.js/play.html/play.css/data.js/layout.js/cards.js 客户端 + about.html/create.html/title.sql/cover.png）。

**关键事实（已核实）**
- 当前跑的是 **官方服务器 `server-official`**（端口 **8091**，不是 8080，也不是 mirror 第三方镜像）。
- 服务器**只监听 IPv6**，所以页面必须开 `http://localhost:8091/`，用 `127.0.0.1` 会 `ERR_CONNECTION_REFUSED`。
- 本地账号：`yz1968` / `2496897271@qq.com` / `jerry63465605`（user_id=1，自动管理员）。
- 对局页 URL：`/<title_id>/play/<game_id>/<role>`，role 含空格会被 URL 编码成 `%20`（正常）。

---

## 1. 如何运行 / 重启 / 排错

改了 `rules.js` / `play.js` / `data.js` **必须重启服务器**（`watch` 不总生效）：

```powershell
# 先杀旧进程
$pid = (Get-NetTCPConnection -LocalPort 8091 -State Listen).OwningProcess
Stop-Process -Id $pid -Force

# 重启（IPv6 only，日志重定向便于看 [TRIGGER]/[RESPONSE] 等调试输出）
cd c:/Users/24968/Desktop/rtt/server-official
$env:RTT_PORT=8091
node server.js > ../rtt_stdout.log 2> ../rtt_stderr.log
```

排错命令：
```powershell
Get-NetTCPConnection -LocalPort 8091 -State Listen   # 看是否在听
Get-Content -LiteralPath ../rtt_stdout.log -Encoding UTF8 -Tail 50   # 看服务端日志
```

**注意（踩坑）**：本机 PowerShell 读含中文文件要用 `Get-Content -LiteralPath -Encoding UTF8`；命令里避免中文引号；正则含中文会报 `SyntaxError`，改用脚本文件或纯 ASCII 判断。

---

## 2. 整体架构与文件职责

```
server-official/
├─ server.js                      # 引擎本体（RTT 服务器，不要改）
├─ public/common/client.js       # 引擎客户端契约：提供全局 view / send_action / send_query / on_update 回调
└─ public/quartermaster-sub-wars/ # 本模块
   ├─ rules.js     (~6500 行)  ★ 服务端：所有规则、阶段、action/query 分发、view 组装、触发器
   ├─ play.js      (~3000 行)  ★ 客户端：地图渲染、手牌、各类弹窗、玩家交互、on_reply 处理
   ├─ play.html                 # 客户端 DOM 骨架（地图/手牌/相位面板/各 modal 容器）
   ├─ play.css                  # 样式
   ├─ data.js                   # 地图（spaces）、初始棋子（pieces）、连线（limited_connections）——可用编辑器热改
   ├─ layout.js                 # 地图坐标
   ├─ cards.js                  # 卡牌原始数据（几千张，按 id 索引）
   ├─ about.html / create.html  # 模块说明 / 开局页（load_rules 里无条件 readFileSync，缺则静默失败）
   ├─ title.sql                 # 建表/写 titles、roles 注册（role 名取自 rules.js 的 exports.roles = 'Axis'/'Allies'）
   └─ cards/                    # 卡图等素材
```

**引擎契约（最重要，先读）**
引擎加载 `rules.js` 后，按固定方式调用其导出的顶层函数。模块只需实现这些约定函数：
- `setup(titleId, mapId, options)` → 返回**初始游戏状态对象**（engine 会持久化、每次 `action`/`query` 时传回）。
- `action(state, role, name, arg)` → 执行一个动作，原地修改 `state`，返回 `{ msgs?, ... }`。`role` 是 RTT 当前席位（'Axis'/'Allies'）。
- `query(state, role, name, arg)` → **只读 RPC**，返回数据给客户端。**严禁在 query 里改状态**（改了也不会广播，坑过的点）。
- `view(state, role)` → 返回「该席位能看到的状态投影」，引擎每次状态变化后推给客户端，客户端存到全局 `view`，触发 `on_update()`。
- `roles` / `layout` / `title` 等导出（role 名必须是 `'Axis'`/`'Allies'`）。

客户端（play.js）拿到的全局变量（由 client.js 提供，本文件**不要重新声明**）：
- `view` —— 当前席位的状态投影，所有渲染都读它。
- `send_action(name, arg)` —— 调用服务端 `action`。
- `send_query(name, arg)` —— 调用服务端 `query`，结果异步在 `on_reply(name, params)` 回调。
- `on_update()` —— 每次 `view` 变化时引擎调用，是客户端唯一刷新入口。

---

## 3. 状态对象（game state）关键字段

`setup()` 在 `rules.js` 里创建（约 L5170 起 `create_empty_game_state`）。常用字段：

| 字段 | 含义 |
|---|---|
| `hands[nation]` | 各国家手牌数组，元素是**实例 id**（如 `"15310#5"`，带 `#n` 序号） |
| `location[pieceId]` / `piece_nation` / `piece_type` | 棋子位置 / 所属国 / 类型 |
| `current_nation` | 当前行动国（字符串，如 `'德国'`） |
| `active` | 当前操作权阵营 role（`'Axis'`/`'Allies'`），**必须跟着 current_nation 走** |
| `turn` / `turn_phase` | 回合数 / 当前阶段 key |
| `nations_done` | 本回合已轮完的国家计数 |
| `play_done[nation]` | 出牌阶段是否已"三选一"做过 |
| `my_air_done` / `ask_remove` | 空军阶段标记 / 收回本国部队询问开关 |
| `delegated_to` / `table_responses` | 代表团映射 / 已暗置的响应卡列表（每项是 `{card_id, owner_side}`） |
| `log` | 日志 |

**实例 id vs 卡面 id（高频坑）**：手牌/桌面用的是**实例 id**（`15310#5`），而 `CARD_TRIGGERS` 的键是**卡面 id**（`15310`）。转换用 `inst_card_id(instance_id)`（rules.js ~L621，剥掉 `#n`）。客户端用 `inst_card_client()`（play.js 内）。任何"找不到触发器/卡面"的问题先怀疑 id 混用。

---

## 4. 阶段模型与「玩家切换时点」（重点）

### PHASES（每国 7 阶段，顺序固定，rules.js ~L756）
```js
[{key:'resource', zh:'资源再分配'}, {key:'play', zh:'出牌阶段'},
 {key:'airforce', zh:'空军阶段'},    {key:'supply', zh:'补给阶段'},
 {key:'scoring', zh:'计分阶段'},     {key:'discard', zh:'弃牌阶段'},
 {key:'draw', zh:'抓牌阶段'}]
```

### 国家轮转顺序（ORDER_OF_NATIONS，rules.js ~L98）
```js
['德国', '英国', '日本', '苏联', '意大利', '美国']
```
阵营交替：**德(轴) 英(同) 日(轴) 苏(同) 意(轴) 美(同)**——每换一个国家，阵营就翻一次，不是 6 国跑完才换。

### 切换时机（advance_phase，rules.js ~L5086）
- 一个国家的 7 阶段按顺序跑完 → `nations_done++`，按 `ORDER_OF_NATIONS` 切到下一个国家。
- `game.active = faction_role_of_nation(game.current_nation)` —— **每次切国家都重算 active**。
- `nations_done >= 6` → 回合 +1，清回合修正器、跑 `on_turn_start`、做终局判定（第 20 回合结束）。
- 切国家时还跑参战判定 `check_neutral_end_on_turn`（苏联第 N 回合相邻≥3 德意、美国第 10 回合）。
- 切阶段时跑 `run_phase_entry(phase, nation)`（~L5041），按 phase 调 `phase_resource/play/airforce/supply/scoring/discard/draw`。`phase_play` 会清零 `play_done[nation]`。

### ⚠ 最关键的已修 bug（务必记住）
早期只在 `nations_done` 归零时翻转 `active`，导致轮到**英国（同盟）**时 `active` 还是 `Axis`——同盟视角被判定"不是我的回合"，顶栏显示"等待对方行动"、actions 为 null，什么都点不了。现在 `active` 在每次 `advance_phase` 切国家时都重算（见 ~L5135）。**若再出现"轮到某国却操作不了"，第一反应查 active 是否跟 current_nation 同步。**

客户端 `view.side` 就是当前席位阵营；`is_my_turn()` = `my !== null && my === view.side`。`view` 里 `current_faction`/`current_nation` 反映当前行动国。

---

## 5. 服务端 `action` 分发（rules.js `action()`）

action 名称字符串（已实现的顶层 action）：

| action | 作用 |
|---|---|
| `log` | 记一条日志 |
| `debug_place` / `debug_remove` / `debug_clear` / `debug_draw` | 调试：放/删/清棋子、抽牌 |
| `resolve_supply` | 手动结算某国补给（移除断补单位） |
| `next_nation` / `next_phase` | 手动推进国家 / 阶段（调试或特殊流程） |
| `resource_swap` | 资源再分配：`{discard:[3张], take:基本卡id}` |
| `discard_one` | 出牌阶段"弃 1 张"（三选一之一） |
| `minus_score` | 出牌阶段"减 1 分"（三选一之一，本方阵营 -1） |
| `discard_in_discard_phase` | 弃牌阶段弃牌 |
| `remove_piece` | 收回本国部队（自己回合任意时刻） |
| `toggle_ask_remove` / `clear_ask` | 开关/清空"友方出牌回合收回询问" |
| `clear_peek` | 清掉 peek 暂存 |
| `resolve_battle` | 发起/结算战斗（`{target, initiator, piece, opt}`） |
| `air_support` | 空军力量阶段相关 |
| `play_card` | **打出一张手牌**（事件卡/增强卡/响应卡，最复杂，见下） |

> **未实现（待办 Step 3）**：响应卡的 `trigger_response`（执行效果并移入弃牌堆）与 `pass_response`（放弃响应）**还没有**。当前响应卡只做到"暗置 + fire_trigger 返回可触发列表"，尚无服务端 pending_trigger 状态、无 view 暴露、无客户端询问弹窗（见 §8）。

`play_card` 内部按卡类型分叉（约 L6264）：EVENT（事件卡）→ 走 `event_card_needs`/`resolve_event_card`；EFFECT（增强卡）→ 即时效果 + 可选弃牌代价（ECHO 流程，见 §7）；RESPONSE（响应卡）→ 推入 `game.table_responses`，从手牌移除（**不进弃牌堆**），标 `play_done`。

---

## 6. 服务端 `query` 分发（rules.js `query()`）

query 是只读。已实现名称：

| query | 作用 / 返回 |
|---|---|
| `straits` / `adjacency` | 海峡控制权 / 本方相邻关系 |
| `supply` / `supply_points` | 补给状态 / 补给点 |
| `turn_state` / `hand` | 回合状态 / 手牌 |
| `battle_initiators` | 可发起战斗的本方单位 |
| `event_targets` | **事件卡目标**（最关键）：根据卡 `need` 返回 `{pick, cards, target, ...}`；支持 `cost.discard>0`（弹弃牌框）、`pick>1`（多选 + Done）、`peek_reorder`（看牌+排序，见 §7） |
| `score_detail` / `markers` | 计分明细 / 标记 |
| `deck_basics` | 资源再分配时从牌堆挑基本卡 |
| `card_list` / `card_list_by_type` | 卡牌列表 |
| `basic_targets` | 基本卡可打目标（含 `airs` 字段：可代受的空军，用于 easy_rule 七章） |
| `buildable` / `air_options` | 可建设处 / 空军选项 |

> **query 不能改状态**：早期 `event_targets` 想在里面写 `game.peek` 失败（query 结果不广播）。现改为 query 返回牌数据给客户端，最终由客户端在 `send_action('play_card')` 时把 `peek_cards`/`order` 一起传回服务端。

---

## 7. 客户端交互流程（play.js + play.html）

### 全局 pending_* 变量（play.js ~L625 起，已注释清楚）
- `pending_event_card` / `pending_event_targets` / `pending_event_choice` / `pending_event_picks` —— 事件卡选目标流程
- `pending_echo_discard` / `pending_echo_cards` —— 增强卡可选弃牌代价
- `pending_resource` —— 资源再分配
- `pending_peek` / `peek_cards` / `peek_target` —— 看牌+排序（双十字系统 15305）

### 打出一张卡的主流程（以事件卡为例，~L660）
1. `on_click_hand_card` → 判断 `check_phase_for_card(c)`（读 `view.card_triggers[卡面id]` + `view.current_faction`）。
2. 增强卡 → `send_query('event_targets', {card})`；事件卡 → 同。
3. `on_reply('event_targets')` 根据返回的 `need`/`cost`/`pick` 分流：
   - `cost.discard>0` → `update_echo_discard_box()` 弹 `echo_discard_modal` 让玩家选 N 张弃牌代价；确认后进入目标选择。
   - `pick>1` → 多选地区，`update_event_done_button()` 显示 `#btn_event_done`，选满后 `confirm_event_done()` 提交 `picks`。
   - `peek_reorder` → 设 `peek_cards` 并 `update_peek_box()` 主动刷新（**必须主动调用，query 不广播**）。

### 关键 update_*_box 函数
`update_map` / `update_side_info` / `update_phase_panel` / `update_phase_buttons` / `update_hand_panel` / `update_resource_box` / `update_echo_discard_box` / `update_peek_box` / `update_ask_box_from_view` / `update_event_done_button` / `update_pending_battle_box`。

### play.html 中的容器/弹窗 ID（改 UI 时对照）
- modal：`#resource_modal`、`#peek_modal`（含 `#peek_cards`/`#peek_confirm`）、`#echo_discard_modal`（含 `#echo_discard_grid`/`#echo_discard_confirm`）
- box：`#resource_box`、`#ask_box`、`#hand_cards`、`#map`/`#mapwrap`、`#debug_panel`、`#debug_button`
- 相位面板：`#phase_nation`/`#phase_name`/`#phase_step`/`#phase_track`/`#phase_note`

### 调试手段
- 点 `#debug_button` 展开 `#debug_panel`，里面有 `[VIEW KEYS]` / `[QUERY]` / `[REPLY]` / `[ECHO]` 等日志开关。
- 服务端 `rules.js` 里大量 `console.log('[RESPONSE]...' / '[TRIGGER xxx]...' / '[ECHO]...')`，看 `rtt_stdout.log` 确认流程是否触发。

---

## 8. 触发器与响应卡（当前进度）

### 数据结构（rules.js）
- `CARD_TRIGGERS`（~L1402，对象）：键 = **卡面 id**（如 `"15310"`），值 = `{kind:'self'|'anytime'|'any', phase?|on?}`。
  - `kind:'self'` + `phase`：在指定阶段自己打出（如 15305 draw、15310 scoring）
  - `kind:'anytime'`：任意时刻（15311）
  - `kind:'any'` + `on`：响应卡，on ∈ `play_card`/`build`/`piece_removed`/`battle`
- `RESPONSE_EFFECTS`（~L1860，12 张：15328–15337、12503、12504）：每项 `{ trigger:{on, filter}, effect:null }`。**当前 effect 全为 `null`（未实现效果函数）**。
- `fire_trigger(game, on, ctx)`（~L1470）：遍历 `game.table_responses`，用 `RESPONSE_EFFECTS` 的 `trigger.on===on` 过滤，返回可触发的响应卡列表（卡面、owner_side、name）。**已接好钩子**（`play_card` 成功、`build_piece`、`eliminate_piece`、`do_battle` 真实击杀与空军吸收分支都调了 `fire_trigger` 并 `console.log('[TRIGGER xxx]')`）。

### 响应卡三步计划（用户已确认方案）
- ✅ **Step 1**：出牌阶段把响应卡暗置到桌面（`play_card` RESPONSE 分支推 `table_responses`，移出手牌，标 `play_done`）。
- ✅ **Step 2**：`fire_trigger` 钩子接通（目前只打日志，未真正拦截/执行）。
- ⏳ **Step 3（待实现）**：服务端 `pending_trigger` 状态 + `view` 暴露；新增 `trigger_response`/`pass_response` action（执行 effect、移入弃牌堆 / 放弃）；客户端询问弹窗（仿 pog 的 CC 战斗卡：拥有者看正面、对手看 N 张卡背 + 计数 `opponent_response_count`）。

### 待决设计点（需新模型推进时确认/实现）
1. **拦截型响应卡的时机**：15328/15329/15333（on:play_card）必须在该 play_card **执行前**拦截，而非执行后——现有 `fire_trigger` 是事后通知，需改造成"事前询问 + 可中止"。
2. **链式触发**：响应卡执行是否又能触发别的响应卡（chain）。
3. **12 张效果函数**：`RESPONSE_EFFECTS` 的 `effect:null` 全部要落地实现。

> UI 设计稿见 `docs/triggers.md` §8（pog CC 卡风格：owner 看正面，opponent 看 N 张卡背 + 计数）。

---

## 9. 可复用函数（直接调用，勿重复实现）

| 函数 | 位置 | 作用 / 签名要点 |
|---|---|---|
| `delegated_to(nation)` | rules.js ~L75 | 代表团映射（法国→英国、中国→美国）。**补给/战斗结算时务必用它对 bloc 内各国都跑一遍**（修过的坑：phase_supply 只结算当前国漏了法国） |
| `get_connections(game, s, side, snap)` | ~L189 | 取连通性表（含 limited_connections） |
| `compute_supply(game, conn_snap)` | ~L375 | 计算补给状态 |
| `resolve_supply(game, nation)` | ~L506 | 结算某国补给，返回被移除单位 |
| `inst_card_id(instance_id)` | ~L621 | 实例 id → 卡面 id（剥 `#n`） |
| `can_build_at(game, nation, space, type)` | ~L864 | 能否在该地建设（陆军/海军，含补给约束） |
| `faction_of_nation(n)` / `faction_role_of_nation(n)` | ~L5152 | 国→小写阵营 / 国→RTT role 名 |
| `phase_play/phase_supply/run_phase_entry/advance_phase` | — | 阶段与轮转核心 |
| `trigger_ready` / `check_phase_for_card` | ~L1412 / ~L3827 | 触发器就绪判断 / 客户端打牌相位校验 |

### 9.1 基础卡效果（响应卡/增强卡"有条件复用"的入口）

`resolve_basic_card(game, nation, card_id, arg)`（~L3243）是 5 种基础卡的统一入口，内部 `switch(c.name)` 覆盖：建设陆军/海军→`build_piece`、发起陆战/海战→`do_battle`、空军力量→`build_piece(air)`/`seize_air`/移动。**可直接整体调用并传条件 `arg`，也可直接调底层原语**（均已独立实现，勿重写）：

| 原语 | 位置 | 签名 | 用途 |
|---|---|---|---|
| `build_piece` | ~L990 | `(game, nation, type, space)` | 建设陆军/海军/空军 |
| `recruit_piece` | ~L1141 | `(game, nation, type, space)` | 征召部队（如 15336 法兰西爱国者 on=battle 即用此） |
| `eliminate_piece` | ~L1202 | `(game, nation, space, target)` | 移除指定单位（15331/15335 消灭陆军即用此） |
| `do_battle` | ~L2590 | `(game, nation, space, target, kind, opt)` | 发起战斗 |
| `seize_air` | ~L3096 | `(game, nation, air_piece, space)` | 空军夺取/进驻 |
| `refresh` | ~L5317 | `(game)` | 刷新派生状态 |

> 响应卡 Step3 落地时：等效"对某基础卡有条件使用"→ 直接调上述原语即可，不必重新实现逻辑。

### 9.2 地块补给点变化（已实现，可后续直接用）

| 函数 | 位置 | 作用 |
|---|---|---|
| `set_supply_point(game, space, faction, value)` | ~L298 | 写 `game.supply_override[space]`（自定义补给值） |
| `add_supply_point(game, space, faction)` | ~L315 | 把该地变为补给点 |
| `remove_supply_point(game, space, faction)` | ~L323 | 撤销补给点 |
| `reset_supply_point(game, space)` | ~L330 | 回退到地图标定值（撤销卡牌效果用） |
| `list_supply_points(game)` / `is_supply_point(...)` | ~L344 / ~L267 | 列举 / 判定 |

### 9.3 计分标记变化（已实现，可后续直接用）

| 函数 | 位置 | 作用 |
|---|---|---|
| `add_marker(game, space, n, owner, faction)` | ~L4496 | 新增计分标记 |
| `remove_marker(game, space, n, owner, faction)` | ~L4516 | 移除标记 |
| `set_marker_owner(game, space, owner, n)` | ~L4537 | 标记只对该**国**计分 |
| `set_marker_faction(game, space, faction, n)` | ~L4558 | 标记只对该**阵营**计分 |
| `move_marker(game, from, to, n, owner, faction)` | ~L4574 | 移动标记 |
| `marker_applies_to(mk, nation)` | ~L4603 | 计分适用性判定 |

> `set_marker_owner`/`set_marker_faction` 正好支撑"计分标记变为只针对某国/某阵营生效"的用法。

客户端辅助：`build_card_elt(c)`（生成卡牌 DOM，`d.__act` 存动作、统一 click 监听）、`card_image_url(c)`、`toast(msg)`、`is_enhance_card/is_timing_card/is_airforce_only`。

---

## 10. 工具类辅助网页 / 脚本（tools/）

| 工具 | 用途 |
|---|---|
| `tools/editor.html` + `tools/editor_server.js` | **地图/棋子热编辑器**。editor_server.js 起一个 HTTP 服务（端口 **8799**），`/api/load` 读、`/api/save` 写 `data.js`，**改地图/初始棋子无需重启服务器**（避开 RTT 重启痛点）。浏览器开 `http://localhost:8799/editor.html`。 |
| `tools/setup_manual_test.js` | 一键建测试对局：德国回合、5 种基本卡各 2 张、阶段=出牌阶段。手动验证 UI/流程用。注意它用**绝对路径** `require(path.join(__dirname,'..','server-official','node_modules','better-sqlite3'))`，否则 tools 下裸 require 找不到模块（踩坑已记）。 |
| `tools/_scan_mod*.js` / `tools/gdb/` | 早期扫描/调试脚本，按需参考，非核心。 |

> 注意：`tools/` 下脚本 `require('better-sqlite3')` 会从脚本所在目录向上找 `node_modules`，所以必须写绝对路径（见 memory ID 90848775）。

---

## 11. 踩坑总索引（详细见对应文件）

- **`docs/pitfalls.md`**（~1600 行，必读）：通用教训 8 条、RTT 契约坑 R1–R11、逐条问题档案（按时间倒序，含"空军不可为目标、地图选发起单位、6 国轮转 active、手牌点不中、摸牌补到 7 张"等）、改动前检查清单 10 条。
- **`docs/triggers.md`**：触发器/响应卡设计，§8 响应卡 UI 设计稿。

**最高频坑速记**：
1. 服务器 IPv6 only → 用 `http://localhost:8091/`，别用 `127.0.0.1`。
2. 改 rules.js/play.js/data.js 必须重启；data.js 可用 editor 热改免重启。
3. 实例 id（`15310#5`）vs 卡面 id（`15310`）——触发器/卡面查找用 `inst_card_id()`。
4. query 是只读，状态变更要走 action；query 改了也不会广播。
5. `active` 必须每次切国家重算（否则同盟国操作不了）。
6. 客户端 `on_reply` 后要**主动** `update_*_box()`，引擎不会自动刷。
7. 卡牌区"看得见点不中"：client.js 的 `transform:scale` + `#hand_cards` 命中被 `#mapwrap` 吃 → `.panel-list{z-index:50}`、`.card{pointer-events:auto}`、`.card img{pointer-events:none}`。

---

## 12. 交接时的待办清单（建议新模型按序推进）

1. **响应卡 Step 3**（§8）：`pending_trigger` + view + `trigger_response`/`pass_response` action + 客户端询问弹窗（含拦截型 15328/15329/15333 的事前时机改造、链式触发、12 张 effect 实现）。
2. **已实现的卡**核对清单（详见 pitfalls.md 末尾"已实现的卡"）：事件卡（含 15305 双十字 peek_reorder、15326 自由法国同盟 pick:2）、增强卡（ECHO 可选弃牌 + 目标高亮）、响应卡 Step1/2。
3. 多国共用英国牌的临时方案是否已替换（测试期"其他国家暂时用英国的牌，无法打出属正常"）。
4. 验证手段：开 `http://localhost:8091/` 登录 `yz1968`，用 `tools/setup_manual_test.js` 建测试局，看 debug 面板 `[VIEW KEYS]/[REPLY]/[ECHO]` 与服务端 `rtt_stdout.log` 的 `[TRIGGER]/[RESPONSE]` 日志确认流程。

---

> 文档结束。新模型接手时，建议先读 §0–§4 建立骨架认知，再按 §12 推进待办；遇到具体 bug 先查 §11 索引的两个 docs 文件。
