# RTT 模块接入说明（quartermaster-sub-wars）

> 版本 v1.1 · 2026-09-21 · 状态：**连通性层 + 客户端已接入，浏览器实测通过**

---

## 1. 模块位置与文件

```
c:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\
├── title.sql       注册 SQL（title_id / title_name / bgg）
├── about.html      介绍页（服务器无条件读取，缺失会静默失败）
├── create.html     建局选项页（同上）
├── data.js         地图数据（由 tools/gen_module_data.js 生成，勿手改）
├── layout.js       格位布局 [x,y,w,h]（由 tools/gen_module_layout.js 生成，勿手改）
├── map.png         地图底图 4835×1612
├── rules.js        服务端规则（RTT 契约 + 连通性引擎）
├── play.html       对局页
├── play.css        对局页样式（仅覆盖颜色，布局由 client.css 提供）
└── play.js         对局页逻辑（on_update 驱动）
```

**必需文件**：`rules.js`、`about.html`、`create.html` 三者缺一不可。
`load_rules()` 会无条件 `readFileSync` 后两个，缺失时不会报错但建局会失败。

---

## 2. 与官方版（server-official）的契约差异

| 项 | 官方版 | 旧镜像 dukeh3 |
|---|---|---|
| 数据库文件 | `./db`（环境变量 `DATABASE` 可改） | `rtt.db` |
| `titles` 表 | ✓ 有（`title_id`/`title_name`/`bgg`/`is_symmetric`/`is_hidden`） | ✓ |
| `roles` 表 | **✗ 没有** —— role 由 `exports.roles` 运行时提供 | ✓ 有，必须手工插入 |
| `title.sql` | **不自动执行**，需手工建库 | 自动执行 |
| `exports.ready` | **不需要** | 必需（否则 `TypeError`） |
| 监听地址 | 默认 `::1`（用 `localhost` 而非 `127.0.0.1`） | `0.0.0.0` |

> **接入要点**：官方版只需执行一次 `title.sql` 注册 `titles`，**不需要**写 `roles` 表。

---

## 3. 邻接建模（沿用 PoG 约定）

移植自官方 PoG 的 `data.js` 写法：

```javascript
space.connections           // 普通连通（双方都通），完整邻居列表
space.limited_connections   // 阵营私有连通，值为【完整邻居列表】
                            // { allies: [id...], axis: [id...] }
```

读取（与 PoG 的 `get_connected_spaces` 同构）：

```javascript
data.get_connections = function (s, side) {
    const sp = data.spaces[s]
    if (side && sp.limited_connections && sp.limited_connections[side])
        return sp.limited_connections[side]     // 已含全部，直接用
    return sp.connections
}
```

**两个易错点**（我在生成器中踩过）：

1. `limited_connections[side]` 存的是**完整列表**（普通 + 该方额外），
   不是"仅额外部分"。PoG 的原始代码是 `con.concat(lim_con[nation])` 预合并。
2. 必须**以【边】为单位**判定归属，不能以点为单位算差集——
   否则 `A→B` 与 `B→A` 会得出不同结论，破坏对称性。

---

## 4. 关键设计：海峡动态连通

静态邻接表无法表达"海峡控制权随部队位置变化"。PoG 的做法是 `data.js` 里
一次性算完 `limited_connections` 就固定不变；本作必须**运行期重算**。

设计取舍：**控制权是派生值，不存入 game state 的可变字段**（否则与 RTT 的
撤销/重放机制冲突——重放时若状态被外部改写，确定性就破坏了）。

做法：

```javascript
// 1. data.js 里存一份"静态基线"（按默认控制方）
// 2. setup 时深拷贝进 game.base_limited（之后不变，作为参照）
// 3. refresh(game) 每次重建 game.limited_connections：
//      a. 重置为基线副本
//      b. 对每条海峡线：先从两岸营列表移除，再按当前控制者加回
```

```javascript
function strait_controller(game, strait_space) {
    const pieces = pieces_on(game, strait_space)
    for (const p of pieces) {
        const f = faction_of_nation(game.piece_nation[p])
        if (f) return f            // 有部队 -> 部队所属阵营
    }
    return data.straits.find(x => x.id === strait_space).def   // 无部队 -> 默认
}
```

**调用时机**：任何改变部队位置的 action 之后（`setup` / `action` / `view` 入口都调 `refresh`）。

> 注意 `base_limited` 与 `limited_connections` 都会进 JSON 存档。
> 这是有意的——重放时需要同样的基线；且快照后会随 state 一起恢复，保证确定性。

---

## 5. 部署步骤

```powershell
# 1. 编译数据（改了连线后重跑）
node tools/build_adjacency.js       # spaces_calibrated.json -> adjacency.json
node tools/gen_module_data.js       # adjacency.json -> 模块 data.js

# 2. 注册（只需一次）
cd server-official
node -e "require('better-sqlite3')('./db').exec(require('fs').readFileSync('public/quartermaster-sub-wars/title.sql','utf8'))"

# 3. 启动
node server.js
# 日志应出现: Loading rules for quartermaster-sub-wars
```

访问 `http://localhost:8080/quartermaster-sub-wars/`（**用 localhost**，官方版默认只监听 `::1`）。

---

## 6. 测试

```powershell
node tools/test_connectivity.js   # 44 项：连通性引擎单元测试
node tools/test_e2e.js            # 15 项：模块契约 + 端到端流程
```

覆盖：模块契约、默认海峡归属、海峡动态夺取/失去、有限连通、
邻接对称性、4 个海峡逐一验证、JSON 序列化往返、view/query 接口。

---

## 6.2 客户端契约（踩坑最多，务必遵守）

### 全局变量与生命周期

| 项 | 说明 |
|---|---|
| `view` | **由 `/common/client.js` 提供**（`var view = null`），收到 `state` 消息时赋值。**play.js 绝不能重复声明它**（会与 client.js 冲突） |
| `on_update()` | 客户端需定义的全局函数，client.js 每次收到新 state 后调用。它在 `try/catch` 里，抛异常会 alert |
| `on_reply(q, params)` | 响应 `send_query()` 的返回值 |
| `player` | 当前玩家位（即 role 名） |
| `send_action(action, arg)` / `send_query(q)` | 提交动作 / 查询 |
| `data` / `layout` | **顶层 `const` 声明即可跨 `<script>` 可见**（同一全局词法作用域），PoG 就是这么做的 |

### 三处必须遵守的约定（否则静默失败）

**1. `view.actions` 必须是【对象】，不是数组。**

服务器用 `is_valid_action(view_actions, verb, noun)` 校验，实现是
`view_actions[verb]`：

- 值 = `1` / `true` / 字符串 → 该动作可提交（参数可为对象）
- 值 = 数组 → 参数必须在数组中（"thing action"）
- 未列出的动作 → 回 `"Invalid action!"`，且**不会写日志**

```javascript
actions: is_my_turn ? { debug_place: 1, debug_remove: 1, log: 1 } : null
```

**2. `exports.action` 必须 return state。**

服务器写法是 `state = RULES[id].action(state, role, action, args)`，
返回 `undefined` 会导致：

```
TypeError: Cannot read properties of undefined (reading '$pie')
    at on_action (server.js:4387)
```

**3. `exports.view` 必须【只读】。**

RTT 每次广播前会对**所有玩家各调一次 view**。若 view 内部调 `refresh(game)`
改写 state，状态会被反复重写，破坏快照与重放的一致性。
本模块的做法：`compute_connections(game)` 是纯函数，view 里局部算一份，
只有 `setup` / `action` 才调 `refresh()` 写回。

### 建局流程（手工测试用）

正常流程是浏览器点建局 + 双方就位。若需手工制造可测对局，
必须补齐 4 处，否则对局页报 "No game with that ID"：

| 表 | 内容 |
|---|---|
| `players` | 两个 role 各一行 |
| `game_replay` | 一行 `.setup`，`arguments = [seed, scenario, options]` |
| `game_state` | 真实 `rules.setup()` 结果的 JSON |
| `game_snap` | 同上但 `log` 换成条数（`log_length`） |
| `games` | `status = 1`（进行中）、`active = roles[0]` |

### 对局页 URL

```
/quartermaster-sub-wars/play.html?game=<id>&role=<role>
```

**注意是查询参数，不是路径段**（旧镜像才是 `/<title>/play/<game>/<role>`）。
role 名含空格会被 URL 编码为 `%20`。

### 地图渲染要点

- `#map` 需在 CSS 里设**固定像素宽高**（4835×1612）+ `background-image`。
  client.js 靠 `clientWidth/clientHeight` 算缩放，并用 `transform` 自动缩放/拖拽。
- 格位方块尺寸要与底图的白色地名文字**尺度匹配**（约 118px），
  且背景透明度要低（`#ffffff10`），否则会挡住底图地名造成"错位"错觉。
- 标定点是地名**文字中心**，不是吸附点位置。

---

## 7. 当前进度与后续

| 层 | 状态 |
|---|---|
| RTT 模块契约（roles/scenarios/setup/view/action/query/dont_snap） | ✓ 完成，浏览器实测通过 |
| 地图数据（53 格位 / 139 连线） | ✓ 完成 |
| 连通性引擎（普通 / 有限 / 海峡动态） | ✓ 完成并测试 |
| 客户端（play.html / play.css / play.js / layout.js） | ✓ 完成 |
| 地图渲染（底图 + 格位方块 + 属性标记 + 算子） | ✓ 完成 |
| 调试接口（`debug_place` / `debug_remove` + 调试面板） | ✓ 可用 |
| **补给传播 + 断补结算** | **✓ 完成并测试（36 项），详见 `docs/supply.md`** |
| **7 阶段回合状态机 + 手牌模型** | **✓ 完成并测试（80 项），详见 `docs/turn-flow.md`** |
| 卡牌数据（54 张英国卡入库） | ✓ 完成（效果待逐条实现） |
| 建设/征召、战斗 | ✗ 待做 |
| 计分标记轨 | ✗ 待做（现用"在补给的部队数"近似） |
| 其余 5 国卡组 | ✗ 待做（现借用英国卡组，`USE_TEST_DECKS` 开关） |
| 前奏期、参战规则 | ✗ 明确不做 |

### 已实测验证（浏览器 + 服务器）

- 模块在 `/games/library` 列出，`/titles` 页显示 role 选择
- 对局页渲染 53 个格位、回合信息、海峡控制权行
- 调试面板放置部队 → `send_action` 通过白名单校验 → 状态广播
- **海峡动态实测**：英国陆军进驻北欧后
  - 轴心视角：北海 **不邻** 波罗的海（丢失丹麦海峡）
  - 同盟视角：北海 **邻** 波罗的海（获得丹麦海峡）

**下次接入的起点**：补给传播可以直接用现成的
`get_connections(game, space, side)` 做 BFS——它是阵营私有的，
天然满足"海军只能走本方可用航道"的需求。
