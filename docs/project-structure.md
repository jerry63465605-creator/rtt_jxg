# 项目结构总结（quartermaster-sub-wars）

> 创建：2026-09-28（germany 分支）
> 数据均由脚本实测（2026-09-28），非估算。
> 定位：**描述"现在是什么样"**。踩坑过程看 `docs/pitfalls.md`，遗留问题看 `docs/known-issues.md`。

---

## 0. 一句话

基于 **RTT（rally-the-troops）引擎**的二战桌游模块「军需官·次要战场」。
引擎在 `server-official/`（**不要改**），本模块在 `server-official/public/quartermaster-sub-wars/`。

- 分支：**germany**（开发分支；main 通过 PR 更新）
- 服务器：**官方 server-official**，端口 **8091**，**只监听 IPv6** → 必须开 `http://localhost:8091/`（`127.0.0.1` 会拒连）
- 账号：`yz1968` / `jerry63465605`（user_id=1，自动管理员）

---

## 1. 目录结构

```
c:/Users/24968/Desktop/rtt/
├─ server-official/                 # RTT 引擎本体（不要改）
│  ├─ server.js                     #   服务器入口
│  └─ public/
│     ├─ common/client.js           #   引擎客户端契约（提供 view/send_action/send_query）
│     └─ quartermaster-sub-wars/    # ★ 本模块（目录名必须 = title_id）
│        ├─ rules.js      10198 行  #   服务端：规则/阶段/action/query/view
│        ├─ play.js        4321 行  #   客户端：渲染与交互
│        ├─ cards.js       4387 行  #   卡牌数据（431 张）
│        ├─ data.js        1134 行  #   地图 spaces / 棋子 / 连线
│        ├─ play.css       1251 行  #   样式
│        ├─ play.html       289 行  #   DOM 骨架
│        ├─ layout.js        64 行  #   地图坐标
│        ├─ about.html / create.html / title.sql / cover.png / map.png
│        ├─ cards/                  #   卡图素材（各国卡面 png）
│        ├─ event-cards-preview.html #  卡牌预览页（国家+类型双筛选）
│        └─ preview-server.js        #   预览页本地服务
├─ tools/                           # 工具与测试脚本（100+）
├─ out/                             # 卡牌识别产物 CSV + 切图
├─ docs/                            # 文档（30 项）
└─ Imperial-Struggle/               # 另一模块（参考，非本模块）
```

**模块必需文件**（缺 `about.html`/`create.html` 会静默加载失败）：
`rules.js`、`play.js`、`play.html`、`play.css`、`data.js`、`layout.js`、`cards.js`、
`about.html`、`create.html`、`title.sql`、`cover.png`。

---

## 2. 引擎契约（改代码前必读）

引擎加载 `rules.js`，调用其导出的顶层函数：

| 导出 | 作用 |
|---|---|
| `setup(titleId, mapId, options)` | 返回初始状态对象（引擎持久化，每次 action/query 传回） |
| `action(state, role, name, arg)` | 执行动作，**原地改 state** 并 return state。`role` = `'Axis'`/`'Allies'` |
| `query(state, role, name, arg)` | **只读 RPC**，严禁改状态（改了也不广播） |
| `view(state, role)` | 返回该席位可见的状态投影 → 推给客户端存到全局 `view`，触发 `on_update()` |
| `roles` | 必须是 `'Axis'` / `'Allies'` |

客户端全局变量（client.js 提供，**不要重新声明**）：
`view`、`send_action(name, arg)`、`send_query(name, arg)`、`on_reply(name, params)`、`on_update()`。

### ⚠ 最高频坑：action 白名单

`send_action(verb)` 会先查 `view.actions[verb]`（来自服务端 `build_actions()`），
**不在册就静默 return false**（不发请求、控制台无 `SEND action`）。

> **每新增一个 action，必须在服务端 `build_actions()` 里登记同名 key。**
> 详见 `pitfalls.md` 通用教训 18（本坑已连踩两次）。

---

## 3. 当前已实现的 action / query（实测提取）

**action（22 个）**
```
log, debug_place, debug_remove, debug_clear, debug_draw,
resolve_supply, next_nation, next_phase,
resource_swap, discard_one, minus_score, discard_in_discard_phase,
remove_piece, toggle_ask_remove, clear_ask, clear_peek,
resolve_battle, air_support,
activate_status,        # 状态卡触发
resolve_econ,           # 经济战二选一
resolve_autobahn,       # 高速公路(15228) 逐次选建设位
play_card, pass_response
```

**query（18 个）**
```
straits, adjacency, supply, supply_points, turn_state, hand,
battle_initiators, air_initiators, event_targets, autobahn_targets,
score_detail, markers, deck_basics, card_list, card_list_by_type,
basic_targets, buildable, air_options
```

---

## 4. 卡牌体系（431 张，6 国 × 8 类型）

### 按国家

| 国家 | 张数 | 效果实现（实测） |
|---|---|---|
| 德国 | 87 | ⚠️ **49/87**：BASIC/STATUS/ECON 全实现、EVENT 19 张实现但 17 张无交互；**EFFECT/PRELUDE/ARMAMENT 共 38 张全未实现** |
| 美国 | 86 | ❌ 仅卡面 |
| 日本 | 78 | ❌ 仅卡面 |
| 意大利 | 72 | ❌ 仅卡面 |
| 英国 | 54 | ✅ 大部分已实现 |
| 苏联 | 54 | ❌ 仅卡面 |

> 用 `node tools/_scan_de_impl.js` 可重新统计德国各类实现度（其他国家可照此扩展）。
> 明细见 `known-issues.md` C 节。

### 按类型

| 类型 | 张数 | 说明 |
|---|---|---|
| EVENT | 82 | 事件卡 |
| STATUS | 82 | 状态卡（打出占名额、留桌面，可触发） |
| PRELUDE | 44 | 前奏卡（紧张度体系；**仅轴心三国 + 美国 172 例外**） |
| EFFECT | 66 | 增强卡（按 `CARD_TRIGGERS` 时点打出，不占名额） |
| RESPONSE | 55 | 响应卡（暗置到桌面，触发后询问） |
| ARMAMENT | 39 | 军备卡（前奏子体系，打出后持续生效） |
| ECON | 33 | 经济战卡（占出牌名额，让对方损耗/移除） |
| BASIC | 30 | 基本卡（每国各 5 张） |

### 按牌堆

CORE 311 / PRELUDE 76 / SUPP 37 / ARMAMENT 7

### 各国 × 类型矩阵

| 国家 | BASIC | EFFECT | ECON | EVENT | RESPONSE | STATUS | PRELUDE | ARMAMENT |
|---|---|---|---|---|---|---|---|---|
| 德国 | 5 | 13 | 9 | 19 | 0 | 16 | 9 | 16 |
| 意大利 | 5 | 9 | 5 | 15 | 9 | 11 | 11 | 7 |
| 日本 | 5 | 10 | 6 | 0 | 25 | 10 | 13 | 9 |
| 美国 | 5 | 15 | 10 | 19 | 0 | 19 | 11 | 7 |
| 苏联 | 5 | 11 | 0 | 14 | 9 | 15 | 0 | 0 |
| 英国 | 5 | 8 | 3 | 15 | 12 | 11 | 0 | 0 |

**读法要点**：日本 RESPONSE 25 张（最多）、美国/苏联 RESPONSE 为 0；
PRELUDE/ARMAMENT 只出现在德/意/日/美（英、苏没有，设计使然）。

---

## 5. 卡牌数据流（改卡面必须走这条链）

```
卡图 sheet（out/cards_sliced）
   ↓ OCR 识别
out/<国>_cards.csv          ← 【源头，改这里】
   ↓ node tools/gen_module_cards.js
模块 cards.js（431 张）      ← 【生成物，不要手改】
   ↓
rules.js 效果配置表         ← 【效果实现，手改这里】
```

- **改卡面文字必须改 CSV 再重新生成**，直接改 `cards.js` 会被覆盖。
- 生成脚本：`tools/gen_module_cards.js`（`SOURCES` 数组每行一国，加国家就加一行）。
- 自检：`tools/_check_cards_csv.js <csv> <期望行数>`。

### 地区名解析（两套函数，别用错）

| 函数 | 走 `PLACE_ALIAS` | 用途 |
|---|---|---|
| `space_id(name)` | ❌ 只查地图本体 | 配置表（`auto.spaces` 等） |
| `space_id_of(name)` | ✅ 先查别名再查本体 | 卡面地名 |

```
PLACE_ALIAS（一对一，10 条）   '南非'→'非洲南部'  '北非'→'非洲北部'  '美洲'→'拉丁美洲' …
REGION_GROUPS（一对多，3 条）  '中国'→[西部,东北,东部]  '太平洋'→[中,南,北,东]  '非洲'→[北,南,东]
```
泛称用 `space_ids_expand()` 展开；`space_ids_of()` **不展开**区域组。

校验脚本：
```powershell
node tools\_check_all_space_refs.js        # 全部卡（当前 0 处无法解析 / 13 处泛称）
node tools\_check_status_spaces.js         # 只查 STATUS_EFFECTS 配置
```

---

## 6. 阶段与国家轮转

**PHASES（每国 7 阶段，顺序固定）**
```
resource(资源再分配) → play(出牌) → airforce(空军) → supply(补给)
→ scoring(计分) → discard(弃牌) → draw(抓牌)
```

**国家轮转**：`德国(Axis) → 英国(Allies) → 日本(轴) → 苏联(同) → 意大利(轴) → 美国(同)`
—— 阵营**每换一国就翻一次**，不是 6 国跑完才换。
`game.active` 必须在每次切国家时重算（否则同盟国会操作不了，历史大坑）。

**阶段限制总纲**（玩家 2026-09-28 口径）：
- 无阶段声明的卡（EVENT/STATUS/RESPONSE/BASIC/ECON）→ **只能出牌阶段**打出
- 卡面声明「XX阶段**开始时**」的卡 → **只能**在那个阶段打出（出牌阶段也不行）
- 区分 A/B 类：A「计分阶段开始时：…」=打出时机；B「计分阶段：…获得1分」=被动结算（仍是出牌阶段打出）

---

## 7. 已实现的子系统

| 子系统 | 状态 | 关键文件/配置 |
|---|---|---|
| 基本卡 5 种 | ✅ | `resolve_basic_card`（含"空打"规则） |
| 事件卡 | ✅ 英+德 | `EVENT_EFFECTS`（34） |
| 增强卡 ECHO | ✅ 英 | `ECHO_EFFECTS`（8）+ `CARD_TRIGGERS`（20） |
| 状态卡 | ✅ 英+德 | `STATUS_EFFECTS`（27），ongoing/trigger/auto 三载体 |
| 经济战 ECON | ✅ 英 2 张 | `ECON_CARDS` + `pending_econ` 让权链 |
| 响应卡 | ✅ 三步已通 | `table_responses` + `fire_trigger` + `pending_trigger` |
| 高速公路 15228 | ✅ | `pending_autobahn` + `resolve_autobahn` |
| 前奏 PRELUDE/ARMAMENT | 部分 | 识别完成，效果主要未实现 |
| 地图/补给/连通 | ✅ | `data.js` + `compute_supply`，可用 editor 热改 |

### 挂起（双方交互）机制现状

已有 **4 套**，共享设计套路但**不要合并代码**
（答复方/次数/交互形态/可否放弃四个维度不同），选型见
`pitfalls.md` **通用教训 19**。

| 机制 | 谁被问 | 让权 | 次数 | 可放弃 | 代表卡 |
|---|---|---|---|---|---|
| `pending_battle` | 对方 | ✅ | 1（可两阶段） | ❌ | 战斗代受/抵消 |
| `pending_econ` | 对方 | ✅ | 多次（chain 逐国） | ❌ | 15314 马耳他潜艇群 |
| `pending_autobahn` | 自己 | ❌ | 多次（N 次选位） | ❌ | 15228 高速公路 |
| `response_queue` | 对方 | ✅ | 1 | ✅（`pass_response` + `resume` 重放） | 15329 反潜战术拦截 |

> 新增挂起时的通用骨架与选型口诀见 `pitfalls.md` 通用教训 19。

---

## 8. 工具与测试

### 有复用价值（保留）

| 工具 | 用途 |
|---|---|
| `tools/gen_module_cards.js` | CSV → cards.js 生成 |
| `tools/_check_cards_csv.js` | CSV 自检（编号连续/图存在/类型-操作） |
| `tools/_check_all_space_refs.js` | 卡面 `<…>` 地区引用校验 |
| `tools/_verify_attrition_rules.js` | 损耗规则（不洗牌 / 被动差额扣分 / 主动不足不可用） |
| `tools/_verify_deck_panel.js` | 各国牌库面板数据源（view.deck_counts 等） |
| `tools/_check_status_spaces.js` | STATUS 配置地区名校验 |
| `tools/_scan_phase_notes.js` | 扫描含阶段名的卡（判 A/B 类） |
| `tools/setup_manual_test.js` | 建手动测试局 |
| `tools/editor.html` + `editor_server.js` | 地图热编辑器（端口 **8799**，改地图免重启） |

### 测试脚本（主要）

| 脚本 | 结果 |
|---|---|
| `tools/test_basic_cards.js` | **295 / 2**（2 项 seize 失败，见 known-issues A1） |
| `tools/test_turns.js` | 通过 |
| `tools/_smoke_status.js` | 21/21 |
| `tools/_verify_15345.js` | 14/14 |
| `tools/_verify_phase_rules.js` | 22/22 |
| `tools/_verify_skip_advance.js` | 9/9 |
| `tools/_verify_status_dim.js` | 6/6 |
| `tools/_verify_phase_dim.js` | 16/16 |
| `tools/_verify_autobahn2.js` | 13/13 |
| `tools/_verify_status_click.js` | 8/8 |

> 跑测试：从**仓库根** `node tools/xxx.js`（部分脚本依赖相对路径）。
> PowerShell 里 `node -e "…中文…"` 会被 GBK 弄坏 —— 复杂脚本一律写成 `.js` 文件再跑。

---

## 9. 文档索引

| 文档 | 内容 |
|---|---|
| **`project-structure.md`**（本文） | 项目结构现状 |
| **`known-issues.md`** | 当前遗留问题与未完成项 |
| **`pitfalls.md`** | 踩坑记录：通用教训 18 条 + 契约坑 R1–R11 + 逐条档案 R28–R36 |
| `status-cards-design.md` | 状态卡口径真源（玩家逐条确认） |
| `todo-deferred.md` | 延后事项（法国 183 / 中国 180） |
| `HANDOFF.md` | ⚠ 已过时（2026-09-25），结构部分以本文为准 |
| `design.md` / `turn-flow.md` / `supply.md` / `connectivity.md` | 各机制设计 |
| `<国>-cards-ocr-task.md`（德/日/苏/意/美） | 各国 OCR 识别记录 |
| `easy-rule.md` | 规则书九章文字提取 |

---

## 10. 常用命令

```powershell
# 重启服务器（改 rules.js/play.js/data.js 后必须）
Get-NetTCPConnection -LocalPort 8091 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Sleep 1
$env:RTT_PORT='8091'
Start-Process node -ArgumentList "server.js" -WorkingDirectory "c:\Users\24968\Desktop\rtt\server-official"

# 重新生成卡牌
node tools\gen_module_cards.js

# 校验
node tools\_check_all_space_refs.js
node tools\_check_status_spaces.js
```
