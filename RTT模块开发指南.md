# RTT 平台模块开发指南（从零实现一个完整模块）

> 本文面向在本平台（`server/`）上从零开发一个新规则模块的开发者（含 AI）。
> 目标：只按本文即可写出**功能完整**（注册 → 创建 → 双人对战 → undo/回滚 → 观战/回放 → 部署）的模块。
> 服务端参考实现：`server/public/paths-of-glory/`（上游经典）、`server/public/Hannibal-Rome-vs-Carthage/`（HRC，最新范式：engine 分层 + states 表驱动）。
>
> **铁律：`server/server.js`、`server/public/common/*` 是上层公用代码，模块一律不改、不 patch。**
> 上层已提供持久化、对局协议、聊天/便签、回放、断线重连、ELO 等全部通用能力（见 §8/§9），模块只需实现本指南列出的接口。

---

## 目录

1. [总体架构](#1-总体架构)
2. [模块目录与文件清单](#2-模块目录与文件清单)
3. [注册新游戏（titles 表）](#3-注册新游戏titles-表)
4. [rules.js 服务端接口（核心契约）](#4-rulesjs-服务端接口)
5. [game 状态对象约定](#5-game-状态对象约定)
6. [状态机模式（states 表驱动）](#6-状态机模式)
7. [view 协议（服务端 → 前端）](#7-view-协议)
8. [上层已提供的能力（WS 协议/持久化/快照策略）](#8-上层已提供的能力)
9. [前端：骨架、钩子、交互模式与性能](#9-前端)
10. [数据文件 data.js（双端共用）](#10-数据文件-datajs)
11. [随机数、undo、回滚（可复现与防作弊）](#11-随机数undo回滚)
12. [测试与验收清单](#12-测试与验收清单)
13. [部署](#13-部署)
14. [最小完整骨架（可直接复制的起步代码）](#14-最小完整骨架)
15. [常见坑清单（来自真实修复史）](#15-常见坑清单)

---

## 1. 总体架构

```
浏览器                          server.js（上层，不可改）                 模块（你写的）
play.html                    ┌────────────────────────────┐   ┌──────────────────────────┐
 └─ common/client.js ──ws──▶ │ /play-socket 消息分发        │──▶│ rules.js（唯一入口）       │
    (on_init/on_update…)     │  action/query/resign/chat…  │   │  ├─ data.js      静态数据 │
                             │ DB 存档/快照/回放/ELO/通知    │   │  └─ modules/…    引擎实现 │
                             └────────────────────────────┘   └──────────────────────────┘
```

- **上层负责**：titles 注册表、静态文件服务、创建/加入对局、WebSocket 收发（`/play-socket`）、
  状态持久化（每步 action 后整局 JSON 存 DB）、行动回放（game_snap）、聊天/便签/笔记、
  断线重连、投降、超时、ELO、离线通知、首页/大厅页面。
- **模块负责**：规则本体。对外只暴露 `rules.js` 一个 require 入口；前端只有一个静态页 `play.html`。
- 边界数据流：
  - 上行（前端→服务器→模块）：`action(state, player, action, arg)`；
  - 下行（模块→服务器→前端）：`view(state, player)` 返回的 JSON；
  - 服务器在**每个 action 之后把整局 game JSON 序列化存进 DB**，下一步再把 JSON.parse 出来的对象传回 `action`/`view`。

---

## 2. 模块目录与文件清单

目录：`server/public/<title_id>/`（title_id 即目录名，见 §3）。

| 文件 | 必需 | 作用 |
|---|---|---|
| `rules.js` | ✅ | **唯一被 server require 的入口**。导出接口见 §4 |
| `about.html` | ✅ | 游戏介绍页 HTML 片段（加载时 `fs.readFileSync` 读入，**缺失会导致模块加载失败**） |
| `create.html` | ✅ | 创建对局页的**表单片段**（不是完整 HTML）。`<input name="xxx">` 的名字即选项 key |
| `play.html` | ✅ | 对局页骨架（必需 DOM 见 §9.1） |
| `play.js` | ✅ | 对局页逻辑（钩子见 §9.3） |
| `play.css` | 建议 | 模块自有样式 |
| `data.js` | 建议 | 双端共用的静态数据（地图/牌表/单位），见 §10 |
| `title.sql` | 建议 | 注册 SQL（一条 insert，见 §3），部署时人工执行 |
| `thumbnail.jpg` | 建议 | 大厅缩略图 |
| `cover.1x.jpg / cover.2x.jpg / cover.*.png` | 可选 | 封面图（多倍率） |
| `favicon.svg` | 可选 | 页面图标 |
| `modules/**` | 可选 | 引擎分包（HRC 范式：engine.js 聚合 + core/systems/states 三层） |
| `tests/` | 建议 | `verify_*.js` 断言测试 + `fuzz.js` 随机压测（见 §12） |
| `lz4.js` | 可选 | 若用压缩快照（可从 HRC 目录复制，同款实现） |

**引用路径约定**：模块内相对 require（`require("./modules/…")`）；页面内静态资源用绝对路径
（`/common/client.css`、`/fonts/fonts.css`、`/images/cog.svg`），带反向代理前缀也无需自己拼接
（client.js 已处理 `window.SITE_PREFIX`）。

---

## 3. 注册新游戏（titles 表）

游戏列表来自 SQLite 主库（默认文件 `server/db`，可用环境变量 `DATABASE` 覆盖）的 `titles` 表。
server 启动时对每行 title 做：`rules_dir = server/public/<title_id>`、加载 `rules.js`。

表结构：`title_id TEXT | title_name TEXT | bgg INTEGER | is_symmetric boolean | is_hidden boolean`

注册方式（二选一）：

```sql
-- title.sql（推荐，如 paths-of-glory/title.sql）
insert or ignore into titles ( title_id, title_name, bgg, is_symmetric )
values ( 'my-game', 'My Game Name', 0, 0 );
```

或直接用 node（better-sqlite3）对 `server/db` 执行。执行后**重启 server**（titles 只在启动时加载）。

> title_id 会出现在 URL `/ga/<title_id>/play.html?game=N` 与 `?title=` 参数中，
> 用小写连字符命名；`title_name` 是大厅显示名。

---

## 4. rules.js 服务端接口

```js
"use strict"
// rules.js 顶层结构（HRC 范式）：require 数据/引擎 → 定义 states → 导出接口

/* ---- 必选 ---- */
exports.roles            // string[] 或 (scenario, options) => string[]。
                         // 角色名 = 玩家身份字符串（如 ["Carthage","Rome"]），
                         // 全代码（日志/权限/DB result）都用这个字符串
exports.scenarios        // string[]，创建页剧本下拉（可用分组对象，见 PoG）
exports.default_scenario // string，默认剧本
exports.setup            // (seed:number, scenario:string, options:object) => game
exports.action           // (state:game, player:string, action:string, arg:any) => game
exports.view             // (state:game, player:string[, fullFlag=false]) => view对象

/* ---- 建议 ---- */
exports.finish           // (state, result:string, message:string) => game
                         // 投降/终局时被上层调用；至少设置：
                         // state.state="game_over"; state.active="None";
                         // state.result=result; state.victory=message; log.push(message)
exports.query            // (state, player, q:string, params:any) => any
                         // 只读查询协议（公开静态数据/牌堆构成等），回复经 on_reply 回前端
                         // 注意：回放模式下会拿**历史快照 state** 调 query，必须只读、无全局副作用

/* ---- 可选钩子 ---- */
exports.dont_snap = (state) => boolean
    // 返回 true 则本步 action 不写 game_snap（回放跳点）。上层已有默认策略（见 §8.3）
exports.static_view      // 值或 (state)=>值：随"players"消息发给前端的一次性静态数据（如地图几何）
exports.is_random_scenario = (scenario) => boolean   // 声明该剧本为随机剧本
exports.select_random_scenario = (scenario, seed) => string  // 用 seed 决定实际剧本
```

### 4.1 `setup(seed, scenario, options)`

- `seed`：服务器生成的整数随机种子。**全模块随机必须从 seed 派生**（见 §11.1），保证同一存档可复现。
- `options`：创建表单（create.html）解析后的冻结对象（checkbox→`true`，数字串→int，空→剔除，
  `pace/is_random/is_private` 已被剔除）。**不要改它**；需要保存就浅拷贝进 game：
  `options: { ...options }`。
- 返回的 game 必须含至少：`seed`、`scenario`、`options`、`log: []`、`state: "<初始状态名>"`、
  `active: <角色|"None"|null>`。HRC 范式在此时初始化 `undo: []`、`rollback: []`、`rollback_state: []`。

### 4.2 `action(state, player, action, arg)`

```js
let game = null                       // 模块级全局引用（可选，方便 states 闭包使用）
exports.action = function (state, player, action, arg) {
	game = state                          // 每次入口重新绑定（DB 往返后引用已换）
	if (game.state === "game_over") return game
	// 1) 权限闸门：非当前玩家一律忽略（log 记录），白名单除外（undo、响应牌持牌方、中断响应方…）
	if (game.active && game.active !== "None" && player !== game.active
	    && action !== "undo" && !isResponder(player, action)) {
		game.log.push(`[忽略] ${player} 在非本方回合执行 ${action}`)
		return game
	}
	// 2) 参数归一化：客户端传来的可能是字符串数字
	if (typeof arg === "string" && /^\d+$/.test(arg)) arg = Number(arg)
	// 3) 顶层专用动作（不经状态机）
	if (action === "undo") { doUndo(game, player); return game }
	if (action === "propose_rollback") { doProposeRollback(game, player, arg); return game }
	// 4) 状态机分发：动作名必须与当前 state 的处理函数名一致
	const S = states[game.state]
	if (S && action in S) S[action](arg, player)
	else game.log.push(`[无效动作] ${action} 在 ${game.state}`)
	return game
}
```

硬性约束：

- **同步、纯函数式**：禁止 setTimeout/Promise/IO；所有变化都落在 `state` 对象上。
- **不得 throw**（上层会 catch 并给前端发 error，但该步操作即丢失）；非法输入一律 log + 优雅返回。
- **永不信任客户端**：`player` 以外的一切（action 名、arg）都可能被伪造，逐个校验归属与合法性。
- **log 只追加**。任何"截断 log"的动作都会被上层识别为回滚（§8.4）——只有 undo 类动作可以这样做。

### 4.3 `view(state, player[, false])`

见 §7。player 是角色名或 `"Observer"`。**必须幂等、绝不修改 game**（会被反复调用）。

---

## 5. game 状态对象约定

game 是**整局唯一事实**，规则如下：

1. **可 JSON 序列化**：纯对象/数组/字符串/数字/boolean/null。禁止函数、DOM、Map/Set、类实例、
   `undefined`（序列化会丢键）。服务器每步 `JSON.stringify` 入库、下一步 parse 回来。
2. **必需字段**：

| 字段 | 类型 | 语义 |
|---|---|---|
| `state` | string | 状态机当前状态名（states 表的键）；终局固定 `"game_over"` |
| `active` | string\|null | 当前该谁行动：**角色名**；`"None"`=终局；`"Both"` 或 `"A,B"`（或数组）=同时行动（见下） |
| `log` | string[] | **完整对局日志**（每步全量返回给 view，见 §7.1） |
| `seed` | number | 随机种子（每步推进，必须用 §11.1 的方式消耗） |
| `result` | string\|null | 终局结果 = **获胜角色名**（ELO 用），无胜者/平局按上层惯例处理 |
| `victory` | string\|null | 终局文案（前端大字显示） |
| `undo` | array | undo 栈（结构自由，见 §11.2；上层存档时会自动剥掉） |

3. **`active` 的多角色语义**（上层判定）：
   - `is_nobody_active`：`null`/`"None"` → 对局标记结束、发 finished 消息；
   - `is_multi_active`：数组、`"Both"`、含逗号 → 同时行动阶段，**game_cookie 不递增**（防在飞冲突）。
4. **体积预算**：整局 JSON 每步全量落库。控制状态体积（HRC：undo/rollback 快照用 lz4 压缩 +
   上限截断，日志瘦身见 §11.2）。目标量级：普通对局几十 KB，勿到 MB。

---

## 6. 状态机模式

推荐 HRC/PoG 同款**表驱动状态机**：`states` 对象，键 = `game.state`，值 = `{ 动作名: 处理函数, prompt(res), inactive }`。

```js
const states = {}

states.card_play = {
	inactive: "等待对方行动…",              // 非当前玩家看到的提示（string 或 ()=>string）
	prompt(res) {                          // 当前玩家的提示与可用动作
		res.prompt("打出一张牌或弃牌")
		for (const id of game.hand[game.active])
			res.action("play", id)         // 注册带参动作 → view.actions.play = [id,…]
		res.action("discard_pass")        // 无参动作 → view.actions.discard_pass = 1
	},
	play(cardId, player) {                 // 处理函数签名：(arg, player)
		// 校验 → 变更状态 → log → 转移 game.state
	},
	discard_pass() { /* … */ },
}
```

`res` 是 result 收集器（HRC `Engine.create_result`；单文件模块可自己实现同款，~30 行）：

| 方法 | 作用 |
|---|---|
| `res.prompt(msg)` | 设置本状态提示文案 |
| `res.action(name)` | 注册无参动作（`view.actions[name] = 1`） |
| `res.action(name, arg)` | 注册带参动作（`view.actions[name]` 变成去重参数数组） |
| `res.space(id)` / `res.piece(id)` | 等价 `res.action("space", id)` / `res.action("piece", id)`（通用选格/选子协议） |
| `res.log(msg)` | 同时写 game.log（一般直接 `game.log.push`） |
| `res.apply(view)` | 把 prompt/actions 合入 view（view 末尾调用一次） |

要点：

- **动作名与状态函数一一对应**：前端只能通过 view.actions 里出现过的 (action, arg) 发指令；
  `action()` 分发时 `action in S` 校验，其余一律"无效动作"。
- 状态转移后**必须保证新 state 在 states 表中有定义**；任何分支都别把 game 挂在无名状态。
- 多阶段交互（选格→选子→确认）推荐用 `game.interrupt/ctx` 上下文对象 + 阶段字段
  （参考 HRC `states_movement` 的 intercept/evade 多阶段：`stage` 字段控制 prompt 分支与下一步动作集）。
- 中断（响应窗口）模式：打断方设置 `game.interrupt = { by, type, ctx }`，
  `active` 保持原值或切到响应方，view/actions 只给响应方（见 §7.3）。

---

## 7. view 协议

`view(state, player)` 返回**本次连接需要的全部渲染数据**。服务器只追加/裁剪 log 与 actions，
其余字段完全由模块自定义（前端怎么消费是模块自己的事）。

### 7.1 必需字段

```js
{
	state:  game.state,        // 前端据此分支渲染
	active: game.active,       // 角色高亮（update_roles 用，必须与 roles 名一致）
	prompt: "当前玩家提示",      // header 大字提示（无则空串）
	log:    game.log,          // ⚠️ 必须返回【完整】日志数组。服务器按每连接 seen 偏移量
	                           //    自己做增量切片（log_start + slice），模块只管给全量
	actions: {...} | null,     // 当前玩家可用动作（res.apply 的结果）；无动作 = null
}
```

- **log 增量机制**：服务器记录每个连接已见行数 `socket.seen`，只发新增行。因此 view 每次给全量即可，
  **不要自己裁剪**；`view.log` 传 `game.log` 引用即可（服务器发送前才 slice）。
- **发送节流**：服务器仅当 `view.actions` 非空或 view 内容变化时才推给该连接；观察者无 actions 时
  靠"内容变化"触发。因此 view 里所有会变的字段都要进 view（否则对局在旁观者页面不刷新）。
- `state === "game_over"` 时**也要返回完整棋面/日志**（终局页面要正常展示终局局面，只置空 actions）。

### 7.2 隐藏信息（防作弊，逐角色裁剪）

view 是**按 player 裁剪后的视角**，不是全量 dump：

```js
if (player !== "Observer") view.hand = game.hand[player] || []   // 手牌只给本人
// 对方手牌：最多给数量；牌堆剩余构成、暗置信息绝不下发
// 战斗牌/间谍揭示等一次性私密信息：只发归属方（HRC: c.spy_reveal.by === player 才给）
```

`Observer` 视角必须等于"公开信息"，逐项自查每个新增字段的归属可见性。

### 7.3 prompt/actions 的分角色逻辑

同一 state 下，当前玩家看 `S.prompt(res)`，非当前玩家看 `S.inactive`；
中断类状态（HRC：`interrupt_choice`/`intercept_configure`）只有 `interrupt.by === player` 的一方
渲染选项，另一方渲染等待文案。非 active 一方偶尔也要给动作（如战斗守方打响应牌）：
在 view 里**手动补** `view.actions.xxx`（HRC 的 ally_desert_mid 案例）。

### 7.4 常用 view 字段（HRC 实例，按需仿制）

`spaces`（每格棋子/PC/围攻）、`generals`、`hand`、`deck_count`、`discard`、`card_plays`、
`movement`（移动摘要：携带/剩余 MP/路径）、`combat`（战斗上下文）、`interrupt`（类型+阶段）、
`flags`、`active_cards`（生效中的持续事件牌）、`result`/`victory`、`rollback`（检查点列表）。
原则：**前端不推断规则**，能算的权威值（数量、修正、路径）都在 view 里给。

---

## 8. 上层已提供的能力

### 8.1 WS 消息协议（client.js ↔ server.js，模块只感知其中两行）

| 前端 → 服务器 | 服务器 → 前端 | 说明 |
|---|---|---|
| `["action",[name,arg,cookie]]` | `["state",view,cookie]` | 每步后服务器整局重取 → `rules.action` → 广播新 view |
| `["query",[q,params]]` | `["reply",[q,reply]]` | 走 `rules.query` |
| `["resign"]` | `["finished"]` | 投降 → `rules.finish` → DB 终局 |
| `["chat",text]` / `["getchat",n]` | `["newchat"]`/`["chat",…]` | 聊天（上层全包） |
| `["putnote",text]`/`["getnote"]` | `["note",text]` | 个人便签（上层全包） |
| `["getsnap",i]`/`["querysnap",…]` | `["snap",…]`/`["snapsize",n]` | 回放模式（上层全包，见下） |

- **cookie 同步**：每步 action 服务器递增 game_cookie，客户端回传；不一致 → 强制重发 state + "Synchronization error!"。模块无感。
- **身份**：`socket.role` 由服务器按登录用户在对局中的座位确定后传给模块（`player` 参数）；URL `?role=` 只是前端显示提示，**不可作为权限依据**。
- **presence**：服务器广播在场角色（前端角色点亮）。
- **断线**：idle 15 分钟自动断开；前端给 Reconnect 按钮，重连后从 DB 重取全量 state。模块无感。

### 8.2 持久化与存档往返

- 每步 action 后：`put_game_state`（整局 JSON 存 `game_state` 表）。
  连接/重连/刷新都从 DB 读 JSON → 传给 `action`/`view`。**这就是 §5 "纯数据对象"约束的来源。**
- 日志追加到 `games.moves` 与通知、ELO（`result` = 获胜角色）由上层处理。

### 8.3 快照（game_snap）与 dont_snap

回放 = 每当 `active` 发生变化时自动存一份快照（`put_snap`）。上层默认策略（`dont_snap`）：
`active` 为空 / 前后都同时行动 / active 未变 / `rules.dont_snap(state)` 为真 → 跳过快照。
模块一般无需自定义；若你的移动类动作会产生大量中间 active 不变的步骤，默认策略已覆盖。

### 8.4 回滚识别（replay 侧）

`put_new_state(..., is_rollback = action !== "undo" && state.log.length < old_log_length)`：
**凡"非 undo 动作但 log 变短"都会被当作回滚并删除其后的回放快照**。因此：

- undo 动作就叫 `"undo"`（顶层拦截，不走状态机）；
- 其他任何动作不要截断 log。

### 8.5 其他上层能力（开箱即用，无需模块代码）

聊天窗口、观察者聊天开关、个人便签、投降菜单、重连、回放面板（前进/后退/跳转）、
全屏、日志折叠、离线"轮到你了"通知、终局重赛入口（`/rematch/:game_id`）、ELO。

---

## 9. 前端：骨架、钩子、交互模式与性能

### 9.1 play.html 必需骨架

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>游戏名</title>
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/common/client.css?v=20260829v01">
<link rel="stylesheet" href="play.css?v=20260829v01">
<script defer src="/common/client.js?v=20260829v01"></script>
<script defer src="data.js?v=20260829v01"></script>
<script defer src="play.js?v=20260829v01"></script>
</head>
<body>
<header>
	<div id="toolbar">
		<details><summary><img src="/images/cog.svg"></summary><menu></menu></details>
		<!-- ☰ 菜单（上面 details>menu）是 client.js 主菜单注入点；可放模块按钮 -->
	</div>
	<!-- ⚠️ #actions 与 #prompt 由 client.js 加载时自动 append 到 <header> 末尾，不要自己写 -->
</header>

<aside>
	<div id="roles"></div>        <!-- 角色卡（client.js 按 roles 自动生成） -->
	<div id="log"></div>          <!-- 日志（client.js 渲染，逐行回调 on_log） -->
</aside>

<main>
	<!-- 自由区：地图/手牌/面板。client.js 只对 <main> 做缩放挂载等通用处理 -->
</main>
</body>
</html>
```

- **必需 DOM**：`header`、`#toolbar>details>menu`（主菜单）、`aside`、`#roles`、`#log`。
  `#prompt`/`#actions` 由 client.js 自动创建进 header。
- **`?v=` 版本参数**：play.html 引用的每个 css/js 都带版本串；**任何前端文件改动都必须 bump**，
  否则浏览器/反代缓存导致"改了没生效"（高频坑）。
- 视口 ≤ 800px 时 client.js 自动折叠 aside（手机模式）。
- **`<main>` 可选缩放配置**（dataset，缺省值括号内）：`data-min-zoom`（0.5）、`data-max-zoom`（1.5）、
  `data-pan-speed`（1）——client.js 的平移缩放引擎读取，见 §9.6。
- 可选 `<footer id="status">`：悬停状态栏（PoG/PUG 惯例），配合 §9.5-D 的悬停提示。

### 9.2 client.js 提供的全局（play.js 可直接用）

| 全局 | 语义 |
|---|---|
| `view` | 最新 view 对象（服务器推来） |
| `player` | 本机角色（`"Observer"` 或角色名；来自服务器 players 消息，**以此为准**） |
| `roles` | 角色元素数组（`roles[i].role/.element/.user`…，presence/active 高亮用） |
| `params` | `{ title_id, game_id, role, mode }`（从 URL 解析，已剥 SITE_PREFIX） |
| `game_log` | 累积日志行数组（与 `view.log` 同源） |
| `game_scenario / game_options / static_view` | 创建时选的剧本/选项 + 模块 static_view |
| `game_cookie` | 协议 cookie（自动维护） |

### 9.3 client.js 约定的模块钩子（play.js 定义这些全局函数即可）

| 钩子 | 时机 | 返回 |
|---|---|---|
| `on_init(scenario, options, static_view)` | 收到 players 消息后一次 | 建地图/绑定事件/dialog 等 |
| `on_update()` | **每次 view 更新**（含断线/回放快照） | 全量重渲染（读全局 `view`） |
| `on_log(text, i)` | 日志新增一行 | DOM 节点（返回 undefined 用默认 div；可借 i 取 game_log[i]） |
| `on_prompt(text)` | header 提示渲染前 | HTML 字符串（美化提示） |
| `on_reply(q, params)` | query 回复到达 | 处理 `send_query` 的结果（如刷新牌堆面板） |

`on_update` 是唯一渲染入口：**每次都根据当前 `view` 从零重画**（或增量更新），不要依赖上一次 DOM 状态。
渲染异常会打断流程，用 try/catch 包住并把错误写到 title/prompt 便于排查（HRC 做法）。

### 9.4 client.js UI 帮助函数（渲染动作按钮/菜单）

```js
send_action(action, arg)            // 发指令（含 cookie；确认类见 confirm_send_action）
send_query(q, params)               // 发查询
action_button(action, label)        // 在 #actions 区生成按钮（点即 send_action）
action_button_with_argument(action, arg, label)
confirm_action_button(action, label) // 带确认框
add_main_menu_item(label, fn)       // 往 ☰ 菜单加项（on_init 时调用）
add_icon_button / show_toolbar_button / toggle_fullscreen / toggle_log
```

两种动作渲染风格任选：
- **按钮流**（PoG/alamein）：`on_update` 里清空 `#actions`，对 `view.actions` 逐个 `action_button`；
- **就地流**（HRC）：地图/卡牌/格子上直接绑 click → `send_action('space', id)` 等，
  `view.actions` 仅作可用性判定。两者可混用；`#actions` 断线时会被 client 清空。

### 9.5 交互模式（PoG/PUG 验证过的成功经验）

#### A. 持久 DOM + 增量更新（最重要的前端架构决策）

PoG/PUG 的共同骨架：**on_init 一次性建 DOM，on_update 只做增量修改**。

```js
// on_init：每格/算子/卡建一次元素并缓存引用
spaces[id].element = build_space(id)      // build_space / build_unit / build_card / build_*_marker
pieces[p].element  = build_unit(p)

// on_update：不重建，只改 class/坐标/显隐/层叠
function update_space(s) { /* 重排该格算子栈、更新标记 */ }
function update_piece(p) { /* 按位置挪元素、切 reduced/offmap class */ }
```

- 禁止每步 `innerHTML` 全量重建棋面：几百节点重建 = 卡顿 + 悬停/滚动/选择状态丢失 + GC 压力。
- on_update 拆成一组小 `update_*`（PUG：update_map/update_card_zones/update_actions/update_side_panel/…），
  一个 view 字段一个更新函数，前端可读性和性能兼得。
- marker（围城/激活/战壕等状态标记）用 `build_xxx/destroy_xxx` 成对管理，只增删变化的（PoG 同款）。

#### B. 一切可用性由 view.actions 驱动，前端零规则

```js
// 唯一判定入口（PoG is_action）：
const is_action = (a, id) => !!(view.actions && view.actions[a] && view.actions[a].includes(id))
```

- 点什么、能做什么、菜单哪项该禁用——**全部查 view.actions**；前端永不复制规则判断。
- 服务端新增动作时前端自动生效（菜单项只需在 HTML 里写好 `data-action`）。

#### C. 两级点击交互：单义直发，多义弹菜单

```js
function on_click_space(evt) {
	const s = evt.target.space
	if (is_action("space", s)) { send_action("space", s); return }   // 单义：直接发
	// 多义：弹出该目标的操作菜单（菜单项按 is_action 逐项启用）
	show_popup_menu(evt, "activation_popup", s, spaces[s].name)
}
```

弹出菜单模板（PoG/PUG 同款，HRC `#card_popup` 亦然）：

```html
<menu id="card_popup" hidden>
	<li class="title">卡牌操作</li>
	<li class="separator"></li>
	<li data-action="event">♟ 事件</li>
	<li data-action="move">⛨ 移动</li>
	<li data-action="discard">✕ 弃牌</li>
</menu>
```

```js
function show_popup_menu(evt, menu_id, target_id, title) {
	let show = false
	for (const item of menu.querySelectorAll("li")) {
		const action = item.dataset.action
		if (!action) continue
		if (is_action(action, target_id)) {
			show = true
			item.classList.add("action")               // enabled 样式
			item.onclick = () => { send_action(action, target_id); hide_popup_menu() }
		} else {
			item.classList.add("disabled")             // 禁用但可见（提示"有什么可做"）
			item.onclick = null
		}
	}
	menu.hidden = !show
	if (!show) return
	// 定位 clamp 到视口（PoG 同款）
	menu.style.left = Math.max(5, Math.min(evt.clientX - menu.clientWidth/2, innerWidth - menu.clientWidth - 5)) + "px"
	menu.style.top  = Math.max(5, Math.min(evt.clientY - 12, innerHeight - menu.clientHeight - 40)) + "px"
	menu.onmouseleave = hide_popup_menu            // 桌面：移出即关
}
// 触屏（无 mouseleave）：document touchstart 点在菜单外则关闭（HRC 同款，passive: true）
```

- PUG 演进版：动作多了以后用**点击意图分发**收敛入口——`get_space_click_intent(s)` 返回
  `none / send_space / send_action / show_popup` 四类，`apply_space_click_intent` 统一执行。
  新交互先问"这格的 intent 是什么"，避免 click handler 长成 if 沼泽。
- 菜单项 `disabled` 也渲染：玩家能看到"这目标上有什么可做"，只是当前不可用（可用性教学）。

#### D. 悬停提示：无操作也有信息

- `on_focus_*/on_blur_*` 把名称/地形/数值写进 `<footer id="status">`（PoG/PUG 标配）；
  DEBUG 开关下顺便高亮相邻/连接格（排查地图数据利器）。
- 卡牌/算子悬停弹预览浮窗（HRC `showCardPreview`，position clamp 同 C）。
- **触屏没有 hover** → HRC `bindTapPreview`：首次点按弹预览，再点关闭；页面空白处
  `touchstart` 收起所有浮层。凡依赖 hover 的信息必须有 tap 替代路径。

#### E. 注意力引导（让玩家知道"该看哪、能做什么"）

- 合法目标高亮：`view.actions.space` 里的格加高亮 class（描边/光圈），动作做完自动消失
  （on_update 全量刷新 class）。
- `attract(elt)` 吸引动画（PoG）：重要提示（补给警告等）让目标元素轻微脉动。
- 日志中的卡名/地名渲染成可点链接（HRC：`<span class="log-card" data-card="6">`，
  委托监听，悬停出预览），从战报直达牌面。
- 侦察/搜索类牌面提示"涉及哪些地区"：view 带上牌面提及格列表，前端高亮（HRC `highlight` 动作）。

#### F. 菜单、对话框与杂项

- ☰ 主菜单（`#toolbar>details>menu`）用 `add_main_menu_item(label, fn)` 注入（on_init 时）；
  复选项用 `check_menu(id, checked)` 切 `menu_item checked/unchecked` 样式（PoG）。
- 对话框可拖拽：HRC `makeDialogsDraggable()` / client `drag_element_with_mouse(sel, grabber_sel)`；
  尺寸可调 `resize_element_with_mouse`。
- 大型查表（战斗表/伤亡表/牌堆构成）放 dialog 按需弹出，不占常驻版面。
- 中键滚动面板：`scroll_with_middle_mouse(panel_sel, multiplier)`（client 工具，长日志面板必备）。

### 9.6 内置地图平移缩放（client.js 自动包办，模块零代码）

client.js 加载时把 `<main>` 的子节点包进 `#pan_zoom_main/#pan_zoom_wrap` 并接管全部手势：

- 滚轮缩放、双指捏合、拖拽平移、**惯性动量滚动**（松手滑行衰减）；
- 键盘 `Ctrl + / Ctrl - / Ctrl 0`：缩放/复位；`header` 双击 = 全屏切换；
- 缩放范围读 `<main>` 的 `data-min-zoom/data-max-zoom`（§9.1）；
- `#mapwrap` 的适配模式（`dataset.fit`）自动按 title 存 localStorage。
- 模块只需：`<main>` 里放 `<div id="mapwrap"><div id="map" style="width:Wpx;height:Hpx">…</div></div>`，
  地图内容（SVG/canvas/绝对定位算子）按数据坐标铺进 `#map`。**不要自己再实现 pan/zoom。**

### 9.7 移动端与触屏

- ≤800px client 自动折叠 aside；模块再提供"移动模式"开关（HRC：localStorage 手动 override 优先，
  否则按 `pointer: coarse` 自动判定；**宽屏 >1024px 强制桌面模式**——触屏笔记本（Surface）会被
  coarse 误判成手机导致布局压坏，实测坑）。
- 弹窗 compact 布局：`window.matchMedia("(max-width: 800px)").matches` 分支（PUG show_dialog 同款）。
- 布局迁移用 CSS class 切换 + `appendChild` 挪容器（HRC movePanelListToBody），不要维护两套 DOM。

### 9.8 前端性能优化（PoG/PUG/HRC 实测有效的手段）

1. **持久 DOM + 增量更新**（§9.5-A）——九成性能问题靠这一条解决。
2. **日志渐进渲染**（HRC 实测：数千行历史日志首屏秒开、不卡操作）：
   - `on_log` 同步只挂占位空行（`log-pending` class），**rAF 分帧从最新往回**填充完整美工；
   - 每帧批量 ~250 行；单行渲染 try/catch 退化纯文本（不拖垮整批）；
   - 行的归属方（阵营色）在**同步阶段快照**进队列项——异步填充时全局光标已漂移（真实 bug）；
   - 机器可读标记行（如 `@@ROUND:…@@`）渲染成色带元素，不输出文本。
3. **重资源缓存**：底图大图用 Cache API 存 blob URL，缓存名带版本号（HRC
   `MAP_CACHE_NAME = "hrc-map-cache-v27"`——**换图必 bump**，否则用户永远看旧图）；
   格式优先 AVIF/WebP（hrcmap 4MB PNG → 400KB AVIF）。
4. **事件委托**：地图/手牌/日志的目标很多时，监听器挂容器 +
   `e.target.closest("[data-card]")` 分发（HRC `bindLogDelegation`：log 容器 3 个监听器覆盖全部行内链接）。
5. **rAF 合帧**：高频 UI 更新用 `requestAnimationFrame` 包装（PUG `schedule_frame`）；
   同一 handler 内避免"读布局→写样式→再读布局"交替（强制同步重排）。
6. **class/位置变更代替增删节点**：状态标记用 build/destroy 对（§9.5-A）；悬停焦点框等
   临时 UI 用 dirty 标记延迟到下一帧重建（PUG `mark_focus_dirty_*`）。
7. **弹层内容一次性写入**：模板字符串 + `innerHTML` 一次成型再绑定（或委托）；
   超长列表用 DocumentFragment 分批，避免逐节点 append 引发逐次重排。
8. **交互打点**：点击→发动作→渲染的路径用 `performance.now()` 打点（PUG
   `mark_interaction_perf(perf_id, name, attrs)` 留好接口），上线前量出慢点再优化，不猜。
9. **view 体积协同瘦身**（服务端侧）：actions 参数数组去重（result 收集器已做）；
   静态几何（地图坐标/邻接表）放 data.js 或 `static_view`（§4，随 players 消息只发一次），
   **不进每步 view**；view 只发会变的量。
10. **图片懒加载与多倍率**：非首屏图 `loading="lazy"`；封面/卡面 `cover.1x/2x` 双倍率
    （项目惯例），页面用 `srcset`。
11. **用户偏好记忆带版本迁移**：显示模式/卡牌风格等存 localStorage，键值改动要做**一次性迁移**
    （HRC 两例：`hrc_card_style` 重置、`hrc_hide_pieces` 清除），否则历史脏值悄悄改变默认行为。
12. **移动端预算**：触屏设备上减少大面积 box-shadow/blur（合成层爆炸）；地图算子用
    `transform` 定位（不走 layout），动画只动 `transform/opacity`。

---

## 10. 数据文件 data.js

地图、牌表、单位、将军等**静态数据**放 `data.js`，一份数据双端用：

```js
"use strict"
var data = { spaces: [...], deck: [...], generals: [...] }
// 文件尾：
if (typeof module !== "undefined" && module.exports) module.exports = data
```

- 服务端 `require("./data.js")`；前端 `<script defer src="data.js?v=…">` 挂全局 `data`。
- 由表格/脚本生成（HRC：`data/build_data.js` 自动生成，文件头注明"勿手改"）。
- 字段建议带中文显示名（`zh`），日志与界面直接拼 `zh（en）`。
- **view/query 不下发私密派生数据**：牌堆剩余、暗牌等永远不给。

---

## 11. 随机数、undo、回滚

### 11.1 可复现随机（必须）

用 game.seed 派生（MLCG，PUG/HRC 同款），**绝不用 Math.random**（存档往返后不可复现）：

```js
function random(range, game) {
	game.seed = (game.seed * 200105) % 34359738337
	return game.seed % range
}
function roll_die(sides, game) {
	const r = random(sides, game) + 1
	// 掷骰封存 undo：禁止撤销到本次掷骰之前（防悔骰）
	game.flags.seal_undo_at = game.log.length + 1
	return r
}
function shuffle(array, game) { /* Fisher-Yates，用 random(i+1, game) */ }
```

undo 校验时：目标快照 `log_len < flags.seal_undo_at` → 拒绝撤销。

### 11.2 undo（模块自实现，模板）

数据结构：`game.undo = [{ state: <压缩快照>, log_len, side }]`。

```js
// 快照工具（HRC utils.js，lz4 压缩 base64；不带 lz4 可退化为 JSON.stringify）
function snapshotGame(game) {
	return JSON.stringify(game, (k, v) =>
		(k === "undo" || k === "rollback" || k === "rollback_state" || k === "rollback_proposal" || k === "log") ? undefined : v)
}
const UNDO_MAX = 60
function pushUndoState(game, snap, logLen, side) {
	const arr = game.undo || (game.undo = [])
	arr.push({ state: snap, log_len: logLen, side })
	if (arr.length > UNDO_MAX) arr.splice(0, arr.length - UNDO_MAX)
}
```

**关键坑（真实事故）**：恢复快照用 `删键 + Object.assign` 时，**被 snapshot 剔除的字段必须先存后还**，
否则一次 undo 就把 log/rollback 全清掉：

```js
function doUndo(game, player) {
	const entry = game.undo[game.undo.length - 1]
	if (!entry) { game.log.push("无可撤销的步骤"); return }
	if (entry.side && entry.side !== player) { game.log.push("只能撤销本方最近的动作"); return }
	const seal = game.flags && game.flags.seal_undo_at || -1
	if (seal >= 0 && entry.log_len < seal) { game.log.push("已掷骰，不可撤销"); return }
	game.undo.pop()
	const save = JSON.parse(entry.state)             // 或解压
	const logLen = entry.log_len
	const undoStack = game.undo
	const prevLog = game.log
	const prevRollback = game.rollback || []          // ⚠️ 快照里没有的字段在这里保住
	const prevRollbackState = game.rollback_state || []
	Object.keys(game).forEach((k) => delete game[k])
	Object.assign(game, save)
	game.undo = undoStack
	game.log = prevLog
	game.rollback = prevRollback
	game.rollback_state = prevRollbackState
	game.log.length = Math.min(logLen, game.log.length)   // 日志截断到撤销点
	game.log.push("** 已撤销 **")
}
```

推 undo 快照的时机 = "每个可撤销的用户动作执行前"（在动作处理函数开头 save，结尾 push）。

### 11.3 双方同意回滚到行动轮开始（HRC 特性，可选）

检查点在"每个行动轮开始"记录（`Engine.roundMark` 打日志标记 `@@ROUND:side|n|turn@@` 后调
`Engine.onRoundMark(game, side)` 钩子 → `pushRollbackPoint`）。流程：

1. 主动玩家 `propose_rollback(index)`：存 `rollback_proposal = { side, save_state, index }`，
   `active` 切到对方、`state = "review_rollback_proposal"`；
2. 对方在审阅状态 `accept`（→ `restoreRollback`：恢复快照、log 截断到 `meta.log_len`、
   **保留当前 rollback 数组并截断到 index+1**、清 `seal_undo_at`）或 `reject`（回到原状态）；
3. view 暴露 `view.rollback = rollback.map((m,i)=>({index:i,label:m.label}))` 与
   `actions.propose_rollback`（仅 active 方、无待处理提议时）；
4. 快照剔除 `undo/rollback*/log` + lz4 + `ROLLBACK_MAX` 上限（HRC 200）。

注意 §4.2/§8.4：回滚会截断 log，属预期（`propose_rollback` 走顶层拦截，不进状态机分发）。

---

## 12. 测试与验收清单

### 12.1 静态与单测

```bash
node --check rules.js && node --check modules/**/*.js   # 语法
node tests/verify_xxx.js                                # 断言式测试：setup → 脚本化 action → assert
```

verify 测试模板（HRC 全部 82 个测试均此模式）：

```js
const r = require("../rules.js")
let pass = 0, fail = 0
const check = (name, cond, detail) => cond ? pass++ : (fail++, console.log("  ❌", name, detail ?? ""))
const g = r.setup(42, r.default_scenario, {})
r.action(g, g.roles[0], "some_action", arg)   // 直接驱动状态机
check("某规则", g.state === "expected_state")
process.exit(fail ? 1 : 0)
```

### 12.2 fuzz 压测（防卡死/崩溃）

随机驱动到 game_over，两层保障：**每步合法动作集合直接问状态机**（从 view.actions 取），

```js
// tests/fuzz.js 骨架（HRC 同款）
const r = require("../rules.js")
for (let n = 0; n < GAMES; n++) {
	const g = r.setup(seed + n, r.default_scenario, options)
	let steps = 0
	while (g.state !== "game_over" && steps++ < 3000) {
		const v = r.view(g, g.active)                 // 用 view.actions 保证合法性
		const names = Object.keys(v.actions || {})
		if (!names.length) break                      // 卡死探测
		const a = names[Math.floor(Math.random() * names.length)]
		const val = v.actions[a]
		const arg = Array.isArray(val) ? val[Math.floor(Math.random() * val.length)] : null
		r.action(g, g.active, a, arg)
	}
	// 统计 finished / stuck / crashed
}
```

验收线：25 局 `完成 25 / 卡死 0 / 崩溃 0`。

### 12.3 人工冒烟（上线前）

- [ ] 创建页选项生效；双开浏览器两角色对打若干步
- [ ] undo（含"对方行动后不能撤"）、掷骰后不可撤
- [ ] 回滚提议 → 对方同意/拒绝
- [ ] F5 刷新后状态/检查点不丢（存档往返）
- [ ] 观战视角：看不到手牌/暗信息；对局推进时旁观页面会更新
- [ ] `?mode=replay` 回放可前进后退；终局页面棋面完整
- [ ] 手机宽度（≤800px）可玩

---

## 13. 部署

1. **打包**：仿 HRC `make_full_deploy.py`（明确列出运行时文件 + 目录，排除开发残留，
   zip + CRC 校验）。最小集合：`rules.js data.js play.html play.js play.css create.html about.html title.sql thumbnail cover.* modules/ lz4.js(若用)`。
2. **版本号**：改动任何前端文件 → bump play.html 中全部 `?v=`（§9.1）。
3. **服务器侧**：
   - 新模块：执行 `title.sql` 注册 + 重启 server；
   - 已注册模块更新代码：`rules.js` 依赖树改动会被 `fs.watchFile` **自动热重载**（控制台打
     `*** RELOAD <title_id> ***` 并向在线客户端重推 state）——**但前端文件不会热注入，必须刷新页面**；
   - 反向代理前缀（如 IIS `/ga`）：由环境变量 `SITE_PREFIX` 控制上层拼接，模块代码不感知。
4. **本地运行**：`cd server && node server.js`（可带 `SITE_PREFIX=/ga`），访问
   `http://localhost:8080[<SITE_PREFIX>]/<title_id>/play.html?game=<id>`。

> Git Bash 环境注意：路径含 `/xxx` 的环境变量会被 MSYS 转换，需 `MSYS_NO_PATHCONV=1`；
> heredoc/字符串里匹配中文易静默失败——改文件用编辑工具而非 bash 文本替换。

---

## 14. 最小完整骨架

可直接复制的"双人对战起步模块"（注册 → 创建 → 打牌 → 过 → 终局 → undo → 回放）。

**title.sql**

```sql
insert or ignore into titles ( title_id, title_name, bgg, is_symmetric )
values ( 'skeleton-game', 'Skeleton Game', 0, 1 );
```

**about.html**

```html
<p>Skeleton Game：RTT 模块起步模板。</p>
```

**create.html**

```html
<label><input type="checkbox" name="fast_mode"> 快速模式（3 张牌获胜）</label>
```

**rules.js**

```js
"use strict"

const ROLES = ["Alpha", "Beta"]
const WIN_CARDS = 3

exports.roles = ROLES
exports.scenarios = ["Standard"]
exports.default_scenario = "Standard"

exports.setup = function (seed, scenario, options) {
	const game = {
		seed, scenario, options: { ...options },
		log: [], undo: [], rollback: [], rollback_state: [],
		state: "card_play", active: "Alpha",
		turn: 1, result: null, victory: null,
		hand: { Alpha: [1, 2, 3, 4, 5], Beta: [1, 2, 3, 4, 5] },
		played: { Alpha: 0, Beta: 0 },
		flags: {},
	}
	game.log.push("** 对局开始，Alpha 先手 **")
	return game
}

let game = null // 模块级引用：states 处理函数经闭包使用；action 入口重新绑定（§4.2）

exports.action = function (state, player, action, arg) {
	game = state
	if (game.state === "game_over") return game
	if (typeof arg === "string" && /^\d+$/.test(arg)) arg = Number(arg)
	// undo 先于权限闸门：出牌后 active 已切给对方，但本方仍可撤销自己刚做的动作
	if (action === "undo") { doUndo(game, player); return game }
	if (game.active !== player) { game.log.push(`[忽略] 非 ${player} 回合`); return game }

	const S = states[game.state]
	if (S && action in S) S[action](arg, player)
	else game.log.push(`[无效动作] ${action} @ ${game.state}`)
	return game
}

exports.view = function (state, player) {
	const game = state
	const view = {
		state: game.state, active: game.active, prompt: "",
		log: game.log, actions: null,
		hand: player === "Observer" ? null : (game.hand[player] || []),
		opp_count: player === "Alpha" ? game.hand.Beta.length : game.hand.Alpha.length,
		played: game.played, turn: game.turn, result: game.result,
	}
	if (game.state === "game_over") {
		view.prompt = game.victory || "游戏结束"
		return view
	}
	if (game.active === player) {
		view.prompt = `打出一张牌（已出 ${game.played[player]}/${WIN_CARDS}）`
		view.actions = {}
		for (const id of game.hand[player]) (view.actions.play_card = view.actions.play_card || []).push(id)
		view.actions.pass = 1
	} else {
		view.prompt = "等待对方行动…"
	}
	return view
}

exports.finish = function (state, result, message) {
	state.state = "game_over"; state.active = "None"
	state.result = result; state.victory = message
	state.log.push("", message)
	return state
}

// ---------- 状态机 ----------
const states = {
	card_play: {
		inactive: "等待对方行动…",
		prompt(res) {
			res.prompt(`打出一张牌（已出 ${game.played[game.active]}/${WIN_CARDS}）`)
			for (const id of game.hand[game.active]) res.action("play_card", id)
			res.action("pass")
		},
		play_card(cardId, player) {
			pushUndo(game, player)
			const hand = game.hand[player]
			const i = hand.indexOf(cardId)
			if (i < 0) { game.log.push("[无效] 没有这张牌"); return }
			hand.splice(i, 1)
			game.played[player]++
			game.log.push(`${player} 打出卡牌 #${cardId}（${game.played[player]}/${WIN_CARDS}）`)
			if (game.played[player] >= WIN_CARDS) {
				game.state = "game_over"; game.active = "None"
				game.result = player; game.victory = `${player} 获胜！`
				game.log.push("", game.victory)
				return
			}
			game.active = player === "Alpha" ? "Beta" : "Alpha"
		},
		pass(player) {
			pushUndo(game, player)
			game.log.push(`${player} 过。`)
			game.active = player === "Alpha" ? "Beta" : "Alpha"
		},
	},
}

// ---------- undo（简版：JSON 快照，无压缩；生产建议 HRC utils.snapshotGame + lz4） ----------
function snapOf(game) {
	return JSON.stringify(game, (k, v) =>
		(k === "undo" || k === "rollback" || k === "rollback_state" || k === "log") ? undefined : v)
}
function doUndo(game, player) {
	const entry = game.undo[game.undo.length - 1]
	if (!entry) { game.log.push("无可撤销的步骤"); return }
	if (entry.side !== player) { game.log.push("只能撤销本方最近的动作"); return }
	game.undo.pop()
	const save = JSON.parse(entry.state)
	const logLen = entry.log_len
	const undoStack = game.undo, prevLog = game.log
	const prevRB = game.rollback || [], prevRBS = game.rollback_state || []
	Object.keys(game).forEach((k) => delete game[k])
	Object.assign(game, save)
	game.undo = undoStack; game.log = prevLog
	game.rollback = prevRB; game.rollback_state = prevRBS
	game.log.length = Math.min(logLen, game.log.length)
	game.log.push("** 已撤销 **")
}
// 在每个可撤销动作前调用：pushUndo(game, player)
function pushUndo(game, player) {
	(game.undo = game.undo || []).push({ state: snapOf(game), log_len: game.log.length, side: player })
	if (game.undo.length > 60) game.undo.splice(0, game.undo.length - 60)
}
```

**play.html** — 直接复制 §9.1 骨架，`<main>` 内加：

```html
<main>
	<div id="hand_panel" class="panel"></div>
</main>
```

**play.js**

```js
"use strict"

function on_init(scenario, options, static_view) {}

function on_update() {
	if (!view) return
	const box = document.getElementById("hand_panel")
	box.replaceChildren()
	const h = document.createElement("div")
	h.textContent = `手牌（对方 ${view.opp_count} 张，已出 ${view.played[player] ?? 0}/3）`
	box.appendChild(h)
	if (view.actions && view.actions.play_card)
		for (const id of view.actions.play_card) {
			const b = document.createElement("button")
			b.textContent = "卡牌 #" + id
			b.onclick = () => send_action("play_card", id)
			box.appendChild(b)
		}
	if (view.actions && view.actions.pass) {
		const b = document.createElement("button")
		b.textContent = "过"
		b.onclick = () => send_action("pass", null)
		box.appendChild(b)
	}
}

function on_log(text, i) {
	const div = document.createElement("div")
	div.textContent = text
	return div
}
```

**验收**：注册 → 重启 → 创建对局 → 双端出牌/过/undo → 刷新不丢 → 投降/终局 → 回放。

---

## 15. 常见坑清单

**服务端规则**

1. `view` 必须幂等、不修改 game；每次都返回**完整 log**（增量是服务器的事）。
2. view 会变化的数据漏下发 → 观战/对方页面不刷新（服务器靠"内容变化"节流推送）。
3. `game_over` 的 view 也要带完整棋面/日志，只清空 actions（否则终局黑屏）。
4. 非 active 玩家的 action 一律拒绝（log 记录），响应窗口白名单要显式列动作名。
5. 客户端 arg 全部按不可信输入处理（数字串归一化、越权 id 校验）。
6. `action` 里不要 throw；分支终点必须落在已定义状态。
7. **快照恢复（undo/rollback）用删键+Object.assign 时，被剔除字段（log/undo/rollback）必须先存后还**——
   否则一次撤销清光检查点。
8. 随机只用 seed 派生；`roll_die` 后设置 `seal_undo_at`（防悔骰）。
9. 只有 undo 可以截断 log；其余动作截断 log 会触发上层回放快照清理。
10. 手牌/暗牌/牌堆构成按角色裁剪；Observer = 纯公开信息。

**前端**

11. 改 css/js 必须 bump `?v=`，否则缓存吃掉改动；Cache API 的底图缓存名同理带版本（§9.8-3）。
12. `on_update` 是唯一渲染入口：小模块可以全量重渲染，**棋盘类一律持久 DOM + 增量更新**（§9.5-A）；
    用 try/catch 包住并把错误暴露到标题/提示。
13. 必需 DOM：`header(#toolbar>details>menu)`、`aside(#roles,#log)`；`#prompt/#actions` 由 client.js 自动注入，不要手写；pan/zoom 交给 client，别自己实现（§9.6）。
14. 角色判定用服务器 players 消息的 `player` 全局，别信 URL `?role=`。
15. 静态资源用绝对路径 `/common/...`、`/images/...`，SITE_PREFIX 由 client.js 处理。
16. 交互可用性只查 `view.actions`（§9.5-B）：前端自己复制规则判断，服务端一改两边必漂移。
17. 触屏没有 hover：悬停信息必须有 tap 替代（§9.5-D）；触屏笔记本要强制桌面模式（§9.7）。
18. 异步填充日志/延迟重建 UI 时，依赖的"全局游标"要在同步阶段快照（§9.8-2 的真实 bug）。

**数据与工程**

19. game 只放可 JSON 序列化数据；DB 每步全量落库，注意体积（快照压缩 + 上限）。
20. `about.html`/`create.html` 缺失会导致模块加载失败（启动时同步读取）。
21. data.js 双端共用：`var data = {...}` + 文件尾 `module.exports` 守卫。
22. hot reload 只覆盖 rules.js 依赖树（服务端逻辑）；改前端必须手动刷新页面。
23. 上层（server.js / common/*）不改——需要的钩子本文都有；改上层 = 部署升级时全部重做。
