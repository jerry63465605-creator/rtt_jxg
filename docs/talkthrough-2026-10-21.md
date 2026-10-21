# 项目讲解稿：军需官·次要战场（quartermaster-sub-wars）近期改动复盘

> 用途：给新同学 / 合作方的 15–30 分钟讲解稿（也可自读）。
> 覆盖：项目是什么 → 架构与三条边界 → **重构篇**（响应卡栈化，2026-10-19，三期全流程）
> → **修复篇**（2026-10-21 三件事，各带"现象 → 根因 → 修法 → 验证"）→ 方法论 → 遗留。
> 代码基线：`server-official/public/quartermaster-sub-wars/`（`rules.js` / `play.js` / `play.css`）。
> 行号均为 2026-10-21 实测，**会漂移**，以函数名为准。

---

## 0. 一分钟版本（先给结论）

本轮修了 **3 类 bug**，它们其实是**同一条链路上的同一种病**：

| # | 现象 | 一句话根因 |
|---|---|---|
| 1 | **6 张美国 EVENT 卡打出去就"消失"**（既不在手牌、也不在弃牌堆，不计分、不参与任何弃牌堆效果） | `play_card` 特例分支**先把手牌 splice 掉**再挂起流程，而流程收尾没有人把它写回弃牌堆；且 `discard_card` 开头要求牌**仍在手牌**，事后补调也无效 |
| 2 | 《广阔的资源》**重打不等同真实出牌** → 需要"先选目标"的卡（发起陆战/海战、多步事件）**点了没反应** | 服务端在 resolve 里**无参**自动调 `play_card`，选目标类卡直接失败；随后"兜底"逻辑把卡挪去弃牌堆并**清掉额外打出权**，牌不在手牌、权也没了，玩家再点地图自然毫无反应 |
| 3 | 两个连带爆出的小 bug：**额外打出角标挂到了所有牌**；**战区移动两步卡只做一步**、选项框只剩"选项 1/2" | 前者是 `filter:'hand'` 对任意手牌放行；后者是 `(false && eff.choiceLabels)` 把标签整个禁用 + `need:'piece'` 少下发一个 `total` 字段 |

外加一件 UI 对齐：**分步执行面板补上战斗预算同款边框**（此前是裸 div）。

在此之前（2026-10-19）还完成了一次更大的**子系统重构：响应卡栈化**（§3）——
把"三个全局变量拼出来的响应引擎"换成"一个栈 + 一个延期缓冲"，三期、9 个 commit。
它解释了后面很多事情，包括为什么有一批旧测试会红。

**共同点**：这些改动都不是"规则算错"，而是**状态在模块之间交接时丢了**——
手牌→弃牌堆丢一次、服务端→客户端丢一次、多步之间丢一次、续打上下文被嵌套响应覆盖一次。
这正是本项目最需要小心的类别。

---

## 1. 项目是什么（30 秒）

- **RTT（rally-the-troops）** 平台上的二战桌游模块「军需官·次要战场」，一个**网页对战实现**。
- 规模：**6 国 × 8 类 = 431 张卡**（EVENT / STATUS / RESPONSE / BASIC / ECON / EFFECT / PRELUDE / ARMAMENT）。
- 代码位置：

```
server-official/                      ← RTT 引擎本体，【不要改】
  └─ public/quartermaster-sub-wars/   ← 本模块（目录名必须 = title_id）
       ├─ rules.js   服务端：规则 / 阶段 / action / query / view
       ├─ play.js    客户端：渲染与交互
       ├─ play.css   样式
       ├─ cards.js   卡牌数据（431 张，生成物，不手改）
       ├─ data.js    地图 spaces / 棋子 / 连线
       └─ play.html  DOM 骨架
```

- 服务器：官方 `server-official`，端口 **8091**，**只监听 IPv6** → 必须用 `http://localhost:8091/`（`127.0.0.1` 会拒连）。
- 现状：英国 / 德国大部分已实现，美国 EVENT 组 C 七张刚做完，其他国家主要还只有卡面。
  更细的现状见 `docs/project-structure.md`、`docs/known-issues.md`。

---

## 2. 架构：讲代码前必须先讲清的三条边界

模块对引擎**只暴露一个入口** `rules.js`，实现四个导出：

| 导出 | 方向 | 语义 |
|---|---|---|
| `setup()` | — | 返回初始状态对象（引擎持久化） |
| `action(state, role, name, arg)` | 上行 | 执行动作，**原地改 state** 并 return state |
| `query(state, role, name, arg)` | 上行 | **只读 RPC**，严禁改状态 |
| `view(state, role)` | 下行 | 返回该席位可见的状态**投影**，推给客户端 |

```
浏览器 play.js ──send_action/send_query──► server.js ──► rules.js(action/query)
        ▲                                            │
        └──────────── view JSON ◄────────────────────┘
                 （引擎在每个 action 后把整层 game JSON 落 DB）
```

**`role` 只有两个**：`'Axis'` / `'Allies'`。但规则里有 6 个**国家（nation）**——
英 / 苏 / 美 / 中 / 法属 Allies，德 / 意 / 日属 Axis。所以"让权给 X 国操作"这类卡面语义，
在单人双角色下仍由你（对应阵营玩家）交互完成，引擎翻转 `active` 给被让权方阵营。
**这是本项目所有"委托 / delegate"机制的前提**，讲卡时必须先交代。

### 2.1 三个"静默失败"来源（本模块最贵的坑）

讲解时建议重点强调，因为本轮 3 类 bug 里有 2 类和它们相关：

1. **action 白名单**：`send_action(verb)` 先查 `view.actions[verb]`（来自服务端 `build_actions()`），
   **不在册就静默 `return false`**——不发请求、控制台无日志。表现就是"点了没反应"。
   > 每新增一个 action，必须在服务端 `build_actions()` 登记同名 key。
2. **query 是只读 RPC**：在 query 里写状态**不会广播**，客户端也看不到。
3. **判定必须同源**：可点性、候选、文案一律**服务端算好下发**，客户端不自己猜——
   两端各算一套必然不一致（本轮"选项标签"bug 正是这个原因）。

---

## 3. 重构篇：响应卡栈化的全修改流程（2026-10-19，三期）

> 这是比本轮三个修复更早、也更大的一次重构，但它解释了后面很多事情
> （包括 §9 里为什么有一批旧测试会红）。
> 计划文档：`docs/REFACTOR_RESPONSE_STACK.md`；完成报告：`docs/RESPONSE_STACK_REFACTOR_REPORT.md`。
> 本节按"**重构前长什么样 → 目标模型 → 三期分别改了什么 → 落地后修了什么 → 留下了什么**"讲。

### 3.1 重构前：三个全局变量拼出来的响应系统

| 变量 | 作用 | 问题 |
|---|---|---|
| `game.response_queue` | 同一触发点的多张卡聚成一个 `item`；结算中触发的新响应 `splice(1,0,…)` 插队头之后（深度优先） | 聚合壳，顺序隐式 |
| `game.pending_response_choice` | 单卡 effect 返回 `{pending}` 时挂起的"待选" | **单一全局 → 被嵌套响应直接覆盖** |
| `game.deferred_response_choice` | effect 返回 `{defer}` 时存"续打步骤" | 同上 |

**经典事故**：15430《奇袭》发起战斗 → 战斗触发敌方新响应 G → G 结算时**也写** `pending_response_choice`
→ **直接覆盖** 15430 的续打上下文 → 窗口卡死。
所以 15430 / 15426 必须**手写 `{defer:true}`** 把上下文挪到 `deferred_response_choice` 才能幸免。
**一旦某张卡忘记写 `defer`，上下文就丢**——这是结构性脆弱，不是某张卡写错了。

另一个清除点：`status_instant` 窗口在 action 入口被清，靠**动作名白名单**豁免
（`trigger` / `pass` / `resolve` / `reorder` / `confirm` / `use` / `skip_armed_offer`）
——打补丁式修复，**每新增一个动作都要回头补白名单**，易遗漏。

### 3.2 目标模型：一个栈 + 一个延期缓冲

```js
game.response_stack          // 活动响应帧栈，【栈顶 = 唯一活动决策】
game.deferred_response_stack // 递延缓打帧暂存区，栈清空后 FIFO 压回
game.response_queue          // 仅 sync_response_queue_view 派生的【只读】视图（客户端兼容）
// pending_response_choice / deferred_response_choice  → 已彻底删除
```

帧结构（`push_response_frame` 压入）：

```js
frame = {
  card_id, face, owner_side,
  ctx,                        // 触发上下文
  step, extra,                // 该卡多步状态机状态（原 pending/defer 的私有数据）
  pending,                    // 是否正在等玩家选择
  kind, candidates, prompt,   // 当前询问
  origin_on, origin_ctx,      // 触发来源（结算后回放）
  group_id, group_idx,        // 【2026-10-20 新增】同组多张卡的组标识（见 §3.6）
}
```

三条核心规则：

1. **深度优先**：结算帧 F 期间新触发的响应**压栈顶**、先生效；F 只有等上方帧全部 pop 后才继续
   （泛化原来的 `splice(1,0)`）；
2. **续打不丢**：`{defer}` 时续打作为**新帧**进延期缓冲，原帧数据不动；栈退回到 F 时
   `frame.step/extra` **原封未动** → 自动续步（如 15430 的陆战步）；
3. **清除只在显式边界**：只清"瞬态 UI/决策窗口"，**绝不触碰栈帧数据本身**。

### 3.3 三期全修改流程（9 个 commit）

#### 第一期：消除数据清除 bug（最低风险）

`b2d6261`（脚手架）→ `23057b3`（第 1 步）→ `80d06b3`（第 7 步）

| 步 | 改动 |
|---|---|
| 1 | 引入 `game.response_stack` + 帧辅助（`push_response_frame` / `pop_response_frame` / `top_response_frame`） |
| 2 | `trigger_response` 的 pending/defer 分支改为**写帧**，并双写 `pending_response_choice` 派生（兼容壳） |
| 3 | `resolve_response_choice` 从栈顶帧读写（`top_response_frame \|\| game.pending_response_choice` 回退） |
| 4 | `promote_deferred_response` 把 deferred 帧重新压栈顶（双写兼容） |
| 5 | `view` 增加 `response_stack` 字段；`view.response_choice` 真相源改为 `top_response_frame(game)` |
| 6 | 保留 `response_queue` 兼容壳（双写并存） |
| 7 | **卡逻辑清理**：15430 由"内嵌 15426 + 手写 defer/newResp/清队列 hack"简化为"**海战 → 陆战**"两步；中间的"是否发动驱逐舰运输"选项删除，15426 改由触发层在响应时点自动调度 |

> 第 7 步是**设计结论先于代码**的好例子：文档先论证"15430 内嵌调 15426 是多余的"
> （海战结束后本来就有时点向各方发起响应询问），再动手删，删掉一整套机制。

#### 第二期：统一栈替换 queue

`2524f03`（Step 4/5/7）+ `9c34227`（收尾记录 / 15430 测试适配）

| 步 | 改动 |
|---|---|
| 4 | `request_responses` 改压帧：同触发点多卡各自 `push_response_frame` **连续压栈**，深度优先语义保持 |
| 5 | `trigger_response` 纯栈化：删 `response_queue` head 遍历；`{pending}` 更新帧 / `{defer}` 弹**当前帧**（**非栈顶**，避免误弹 effect 内部刚压的新响应帧）存 `deferred_response_stack` / `{ok}` 弹帧 + `consume_response` |
| 7 | `response_reconcile_active` 栈化：基于栈头帧 `owner_side` 让权 / 归还；栈空队空时 `promote_deferred_response` 把延期帧 FIFO 压回 |
| — | **删除旧全局**：`pending_response_choice` / `deferred_response_choice` 全部写入点删除；`view.response_choice` 仅 `top_response_frame`（去掉回退）；`block` / `build_actions` 读栈 |
| — | **15430 归一**：删 `{defer}` 兼容壳手写，直接返回 `{defer:true}` 由框架 defer 分支统一收编 |

#### 第三期：`status_instant` 清除改为挂起态判定

`0e6c1a4`

```js
// 改动前：动作名白名单（7 个响应/增强结算动作 + activate_status + debug_*）
const isStatusCascade = action === 'trigger_response' || action === 'pass_response' || …
if (!isStatusCascade) { game.status_instant = []; game.pending_status = null }

// 改动后：挂起态集合判定
const hasSuspended = (game.response_stack || []).length > 0 ||
    (game.response_queue || []).length > 0 ||
    (game.armed_offers && game.armed_offers.length > 0) || game.armed_offer ||
    game.pending_battle || game.pending_econ || game.pending_status_play ||
    game.pending_uranus || game.pending_autobahn
const isStatusInternal = action === 'activate_status' || String(action).startsWith('debug_')
if (!hasSuspended && !isStatusInternal) { game.status_instant = []; game.pending_status = null }
```

语义等价原白名单（响应/增强结算动作发生时挂起态必非空；独立回合动作发生时挂起态为空 → 清空窗口），
但**新增动作只要正确维护挂起态即自动兼容**，结构性消除"白名单遗漏"风险。

### 3.4 落地后修的两个"契约不同步"bug（讲解价值最高）

栈化引入了"**待发动 / 选目标**"两个阶段，而 view 与 `build_actions` 没同步跟上：

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | 顶部横幅显示"响应卡结算中"，但**无客户端弹窗**可操作 | `request_responses` 在"等待发动决定"阶段就把帧压栈（`candidates:[]`），使 `view.response_choice`（= `top_response_frame`）**提前非空** → 客户端 `update_pending_trigger_box` 的 `if (view.response_choice) return` 把发动/不发动框掐掉；而 `update_response_choice_box` 遇到 `kind==='space'` 但 `candidates` 为空只 toast 后 return，不弹窗 | **服务端单点守卫**（view 生成处）：顶帧 `candidates` 为空（待发动帧）时 `response_choice` 返回 `null`，仅确有候选（选目标/选项阶段）才下发 |
| 2 | 补上 view 守卫后弹窗出现了，但点"发动/不发动"**仍无反应** | `build_actions` 的 `pendingTrigger` 分支只凭 `_tf.owner_side === side` 判定，**无条件只放行 `resolve_response_choice`**，把 `trigger_response` / `pass_response` 漏出白名单 → `send_action` 因 `view.actions` 无此 key **静默 return** | 同一处加候选空判定：`candidates` 空（待发动）→ 放行 `trigger/pass/reorder/confirm`；非空（选目标）→ 只放行 `resolve_response_choice`。**与 view 侧守卫口径完全一致** |

> 这两个 bug 是"**判定同源**"的活教材：view 认为"还在待发动阶段"、白名单却按"选目标阶段"放行，
> 两端各写一套判据，必然有一个先漂移。修完后两端共用同一个判据（`candidates` 空否）。

### 3.5 客户端为什么零改动

客户端只消费 `view` 快照，不直接读引擎内部状态：

- `view.response_choice` 返回字段形状（`card_id` / `name` / `kind` / `prompt` / `candidates`）
  与客户端期望**完全一致**，只是真相源从旧全局换成 `top_response_frame`；
- 客户端 `play.js` 对 `pending_response_choice` / `deferred_response_choice` / `status_instant` /
  `response_stack` 的引用数均为 **0**；
- `view` 额外下发只读 `response_stack` 快照，客户端暂未使用，未来要展示"响应栈深度/续打进度"
  可直接消费，**无需协议变更**。

> 这也是"**下行只读投影**"设计的红利：服务端换引擎，客户端无感。

### 3.6 2026-10-20 增量：同组多张卡的结算顺序

**现象**：15425《海军空降部队》+ 15424《海军特别陆战队》同时点时，实测顺序是
`陆战1 → 建设1 → 建设2 → 陆战2`——**建设被插进两场陆战中间**。

**根因**：defer 只把**当前帧**移出活动栈，兄弟帧还留在活动栈里 → 立刻顶到栈顶 →
`view.pending_trigger` 马上给出它们的"是否发动" → 玩家在本卡还没走完时就先把它们做掉。

**修法**（`defer_remaining_group_frames`，`rules.js:15027`）：defer 时把**同组、未轮到、非 pending**
的兄弟帧一并摘出活动栈，按 `group_idx` 排进 `deferred_response_stack`（排在本卡续打之后）：

```js
const rest = (game.response_stack || [])
    .filter(f => f !== curFrame && f.group_id === gid && !f.pending)
    .sort((a, b) => (a.group_idx || 0) - (b.group_idx || 0))
```

因为 `promote_deferred_response` 是 **FIFO**，且只在"响应栈与队列都空、无 `pending_battle`"时才提升，
于是形成"**一张卡完整结束才轮到下一张**"：`陆战1 → 陆战2 → 建设1 → 建设2`。

**口径（方案 A·保守）**：兄弟帧被提升后仍是"待发动"态，需要持有方**再点一次发动**——
只保证顺序正确，不改变"每张都要确认一次"的既有交互。

### 3.7 这一轮重构留下的"已知红"（讲的时候要主动交代）

| 测试 | 失败数 | 原因 |
|---|---|---|
| `tools/test_15430_queue_filter.js` | 5 | `seed()` **直接往 `response_queue` 塞手工构造的队列项**，而第二期之后 `response_queue` 已是**只读派生视图**（诊断时该场景 `response_stack` 甚至是 `undefined`）。帧上没有 `group_id`，所以 `defer_remaining_group_frames` 第一行就 `return 0`，**与后续改动无关**（已 A/B 证明） |
| `tools/_smoke_pending_union.js` | 6 | 为旧 `response_queue` 中心模型编写的断言，栈模型下已不合时宜（已 `git stash` 比对确认 HEAD 同款失败） |
| `tools/_smoke_jp_response.js` | 8 | 同上（含白名单、`15427/15428/15431` 节描述断言） |

> **讲解要点**：重构会**让一批旧测试变红**。分清"重构引入的回归"和"断言本身过时"，
> 靠的是 A/B 对照（`git stash` 回退 / eval 副本中和），不是靠猜。

### 3.8 当前代码锚点（2026-10-21 实测，行号会漂移）

| 函数 / 位置 | 行号 | 作用 |
|---|---|---|
| `consume_response` | `rules.js:14789` | 消耗该响应卡 |
| `sync_response_queue_view` | `rules.js:14816` | 把栈**派生**成 `response_queue` 只读视图 |
| `request_responses` | `rules.js:14855` | 触发点命中多卡 → 连续压栈 |
| `response_reconcile_active` | `rules.js:14916` | 栈头帧 `owner_side` 让权 / 归还；空时提升延期帧 |
| `push_response_frame` | `rules.js:14971` | 压帧入活动栈 |
| `pop_response_frame` | `rules.js:14976` | 弹帧 |
| `top_response_frame` | `rules.js:14980` | 取栈顶帧（唯一活动决策） |
| `defer_response_frame` | `rules.js:14997` | 续打帧收编进 `deferred_response_stack` |
| `defer_remaining_group_frames` | `rules.js:15027` | 【10-20】defer 时把同组未轮到的兄弟帧一并延期（§3.6） |
| `promote_deferred_response` | `rules.js:15044` | 栈清空后把延期帧 **FIFO** 压回栈顶 |
| `hasSuspended` 挂起态判定 | `rules.js:23452` | 【第三期】替代动作名白名单 |
| `build_actions` 待发动 / 选目标分流 | `rules.js:22790-22799` | `candidates` 空否 → 放行 `trigger/pass` 还是 `resolve`（§3.4） |

> ⚠ `trigger_response` / `pass_response` / `resolve_response_choice` / `response_reorder` /
> `response_confirm` **不是顶层函数**，而是 `exports.action` 里的**分支**
> （分发在 `rules.js:23953` / `24147` / `24204` / `24227` 附近）。找代码时别搜 `function xxx`。

---

## 4. 「修复篇·一」6 张卡"吞牌"

### 4.1 现象

打出《广阔的资源》17528 后：

```
hands = []          ← 不在手牌
discard = []        ← 也不在弃牌堆   ← 卡凭空消失
```

对照组《自由法国同盟》15326 正常：`hands=[]   discard=['15326#1']`。

**后果**：卡不计分、不进任何弃牌堆相关效果，等于从游戏里蒸发。

### 4.2 根因（三层叠加，第三层最反直觉）

```js
// play_card 的 EVENT 特例分支（rules.js 约 26781-26857）
if (inst_card_id(card_id) === '17528') {
    offer_us_replay(game)      // ← 内部 game.hands[nation].splice(...) 把手牌移除
    return game                 // ← 然后 return，没有任何地方写弃牌堆
}
```

1. 特例分支**先 splice 手牌**，再挂起一个独立流程（`us_replay` / `uk_build_delegate` / …）；
2. 各流程的收尾函数只清挂起态，**不补自弃**；
3. **最反直觉的第三层**：想事后补一句 `discard_card(game, nation, card_id)` 是**无效的**——
   `discard_card`（`rules.js:915`）开头就要求牌在手里：

```js
function discard_card(game, nation, card_id) {
    const hand = game.hands[nation] || []
    const idx = hand.indexOf(card_id)
    if (idx < 0) return false      // ← 已经被 splice 掉，直接返回 false
    // ...
}
```

所以**必须像 17513 那样直接 push 到 `game.discard`**。

### 4.3 受影响范围：不是 1 张，是 6 张

同模式扫描（都是"splice 后 return、各自流程收尾不补自弃"）：

| 卡 | 卡名 | 流程收尾函数 | 修复前 |
|---|---|---|---|
| 17526 | 民主兵工厂 | `finish_uk_build_delegate` | ❌ |
| 17528 | 广阔的资源 | `offer_us_replay` | ❌ |
| 17529 | 摩尔曼斯克运输船队 | `offer_su_build_delegate` | ❌ |
| 17531 | 现购自运政策 | `resolve_us_merchant_*` | ❌ |
| 17535 | 租借法案 | `resolve_us_lend_lease_*` | ❌ |
| 17537 | 美国人民同情中国 | `offer_us_china_build` | ❌ |
| 17513 | 战时生产委员会 | `resolve_us_wartime` | ✅ **本来就对（参照系）** |

> **方法论**：发现一个 bug 后，先问"还有谁是同模式的"。这里从 1 张扫到 6 张。
> 17513 是唯一写对了的——它把 `card_id` 存进挂起态，由 resolve 阶段显式 push 进弃牌堆。

### 4.4 修法

新增 helper（`rules.js:943`），把 17513 的写法通用化：

```js
function push_discard_direct(game, nation, card_id) {
    if (!game.discard[nation]) game.discard[nation] = []
    if ((game.discard[nation] || []).indexOf(card_id) < 0)   // 去重，防重复入堆
        game.discard[nation].push(card_id)
    try { su_attrition_score(game, nation, card_id) } catch (e) {}
    try { us_discard_score(game, nation, card_id) } catch (e) {}
    return true
}
```

然后 6 个 `play_card` 特例分支各加一行（放在 `offer_*` **之后**）：

```js
offer_us_replay(game)
push_discard_direct(game, nation, card_id)   // 卡已离手，直接入堆
return game
```

**两个细节值得讲**：
- 放在 `offer_*` 之后，是为了让重弹框的候选**不含刚打出的 17528 自身**
  （`us_replay_playable` 也会挡掉，双保险）；
- 弃牌堆为空的早退路径同样走到这一行，所以"空堆打 17528"也不会吞牌。

### 4.5 验证

6 张各打一次，断言最终出现在 `discard['美国']`；参照系 17513 走完全流程（选一张桌面状态卡后）同样入堆。
`_test17528` / `_test17513` / `_test17526` / `_test17529` 全过。

---

## 5. 「修复篇·二」重打 = 完全等同真实出牌

### 5.1 先回答"改造前是真实打牌路径吗"

**是"半真"**：`resolve_us_replay`（`rules.js:5700`）内部直接 `exports.action(play_card, {card})`，
并且置了 `__skip_play_intercept` 跳过响应拦截。
STATUS 置桌 / EVENT 分步 / ECON / 脚本 / 让权委托**确实都走 `play_card` 真身**
（这是 2026-10-17 从"仅结算效果"重构过来的），但**调用方式是无参的**，且可被拦截的窗口被跳过了。

### 5.2 旧实现的三个问题

```js
// 旧实现（已删）
game.__skip_play_intercept = true
exports.action(game, 'Allies', 'play_card', { card })   // ← 无参！
// ...下面还有一段"兜底"：卡仍留在手牌 → 挪进弃牌堆 + clear_extra_play
```

| # | 问题 | 后果 |
|---|---|---|
| 1 | **无参调用** `play_card` | BASIC 战斗卡直接报"未指定战斗地区"；多步 EVENT 返回 `pending` 早退 |
| 2 | 那段"兜底" | 把卡挪进弃牌堆 + `clear_extra_play` → **牌不在手牌、额外打出权也没了**，玩家再点地图毫无反应（用户实测反馈的正是这个） |
| 3 | `__skip_play_intercept = true` | 重打出的牌**不会被响应卡拦截**，与真实出牌口径不一致 |

### 5.3 新实现：服务端只做"交接"，客户端按真实流程接手

```js
// 新 resolve_us_replay 只做三件事：
const di = (game.discard['美国'] || []).indexOf(card)
if (di >= 0) game.discard['美国'].splice(di, 1)
game.hands['美国'].push(card)                                  // ① 捡回手牌（同一实例）

grant_extra_play(game, '美国', 'us_replay', '《广阔的资源》重打',
    { phase: game.turn_phase || 'play', filter: 'card', cards: [card] })   // ② 一次性免费额外打出

game.us_replay_armed = { card, token: ++game._us_replay_armed_token }      // ③ 交接信号
```

客户端 `update_us_replay_armed()`（`play.js:1527`）收到**新 token** 时：

```js
on_click_hand_card(c, null)     // ← 直接复用"点手牌"那条路
```

于是 BASIC → `start_basic_card`（选目标地区 / 选发起单位）；
EVENT → `query('event_targets')` 算候选 → 高亮 → 点地图提交；
ECON → 按 `econ_targets` 选目标国。
**拦截、时点、名额、国家技能钩子全部与真实出牌同源**——不需要为每种卡各写一份"自动补参"。

### 5.4 为什么这样修（而不是继续在服务端自动出牌）

- **需要先选目标的卡无法无参调用**：硬要支持，就得为每种卡各写一份补参逻辑，
  这正是 10-17 那版越写越丑、最后靠"兜底"打补丁的原因；
- **token 自增**：客户端只在新 token 出现时触发一次；首次进房间只记基线，不会误触发；
- **递归风险**：由 `us_replay_playable` 挡掉（不能重打 17528 自身）；
- **持久化在 state 里**：刷新页面后仍会按该 token 触发一次，属可接受行为（牌确实在手牌里，让玩家继续走正常流程）。

### 5.5 行为变化（讲的时候要主动交代口径）

1. 重打后**不再自动结算**：选完牌 → toast"已回到手牌" → **立即弹出该牌的正常选目标流程**，
   BASIC 战斗卡现在能正常走 `battle_flow`；
2. 重打**可被响应卡拦截**——这是"完全等同真实出牌"的必然结果（按确认的口径）；
3. 选完牌却不打 → 牌留在手牌、额外打出权留存到阶段结束，**放弃不扣任何东西**
   （与德国 / 英国国家技能的额外打出行为一致）。

---

## 6. 「修复篇·三」连带修掉的三个小 bug

### 6.1 额外打出角标挂到了所有牌

**现象**：重打授完权，客户端给**每一张**手牌都挂了"额外打出"角标（用户反馈"给了所有牌额外打出标记，实际只给取回的那一张"）。

**根因**：`grant_extra_play` 的默认 `filter:'hand'` 会让 `extra_play_allows_card`
对**任意手牌** `return true`（`play.js:993` 末尾的兜底分支）。

**修法**：新增 `'card'` 过滤器，与既有的 `'drawn'` 同款——`ep.cards` 存**实例 id**，
两边归一到卡面 id 再比：

```js
if (ep.filter === 'card') {
    const ids = (ep.cards || []).map(x => String(inst_card_id(x)))
    return ids.indexOf(String(card_id)) >= 0
}
```

授予侧改成 `filter: 'card', cards: [card]`（只此一张）。
**客户端 `extra_play_allows_card` / `extra_play_hint` 各补一个同源镜像分支**——
这正是"判定同源"的日常：服务端加一种 filter，客户端必须同步加，否则一端放行一端不放行。

### 6.2 战区移动（17532）：两步卡只做一步 + 选项标签丢失

这张卡刚迁到"分步执行机"新管线（设计见 `docs/event-step-machine.md`），一次踩了三个坑：

| # | 坑 | 根因 | 修法 |
|---|---|---|---|
| 1 | 选项框只剩"选项 1 / 选项 2"，看不出哪个是"先建海军" | `const labels = (false && eff.choiceLabels) \|\| []` —— **`false &&` 把配置整个禁用** | 改成 `eff.choiceLabels \|\| []` |
| 2 | 选完要移除的部队后**直接提交**，后续两步建设全丢 | `need:'piece'` 分支**漏下发 `total`**（`'space'` 分支有）→ 客户端按单步处理，选完部队立刻 `send_action`，那次提交里没有后续步骤的 `spaces`，服务端把建设步判成"没有可建设的地区"整卡失败 | 补 `total: steps.length` |
| 3 | 选建设地区时的重查询**不回传已选棋子** | 多步累积参数丢失 → 服务端重新问"选要移除的部队"、客户端再问选地区，**两张皮球踢来踢去永远提交不了** | 重查询时一并回传 `pieces: pending_event_pieces.slice()` |

> 第 3 个坑是"**多步累积参数必须按下标完整往返**"的又一例：
> `arg.spaces[step]` / `arg.pieces[step]`，只发 `arg.space` 服务端读不到
> （15325"点了没反应"根因，见 `pick_space_for` 注释）。共享驱动器 `tools/event_click_seq.js` 已固化这套口径。

### 6.3 分步面板 UI 对齐战斗预算

用户要求"把分步的客户端 UI 模仿现有的其他 UI，例如战斗预算的样式，提供边框"。

**根因**：`#event_step_box` 是后加的面板，**漏进了右上角 HUD 的共用样式组**
（原来只有 `#event_budget_box` / `#autobahn_box`）——所以它是个**裸 div**，无边框、无底色、无投影。

**修法**（`play.css:981-1048`）：把它加进同一组选择器，一次拿到全部视觉：

```css
#event_budget_box,
#autobahn_box,
#event_step_box,      /* ← 新增 */
#uranus_box {         /* ← 同一处遗漏，一并补 */
    max-height: 60vh; overflow-y: auto;
    display: flex; flex-direction: column; gap: 4px;
    padding: 8px 10px;
    background: #fff7e6;
    border: 1px solid #d8b25a;      /* ← 用户要的边框 */
    border-radius: 6px;
    box-shadow: 0 4px 18px rgba(0,0,0,.35);
    font-size: 11px;
}
```

外加两处对齐 / 补强：

- **子元素顺序**改成与战斗预算面板**完全一致**：`title → hint → button → log(desc)`
  （原先是 `title → log → hint → button`——核对时才发现战斗预算是把按钮放在 descs 之前的）；
- **禁用态**：分步面板的"下一步"在硬阻塞（响应卡 / 战斗 / 经济战未清）时会 `disabled`，
  但 `.action.primary` 自带底色会盖掉浏览器默认禁用样式，故显式加
  `#event_step_box button.action:disabled { opacity:.45; cursor:default }`
  （沿用 `#phase_actions button:disabled` 的口径），让"点不动"有视觉反馈。

> **顺带说明**：`#uranus_box`（天王星行动）和分步面板是**同一处遗漏**——
> JS 里同样复用 `.eb-*` 类，但没进 CSS 组，所以也是个裸 div。本次一并补上；
> 如果不想动它，把那几处 `#uranus_box` 从选择器里删掉即可。

---

## 7. 方法论（可迁移的六条）

本轮能比较快地定位和收口，靠的是这五条，建议作为讲解的收尾：

1. **复用优先，不写第二份**。CSS 加进既有选择器组而不是重写一套样式；helper 抽 `push_discard_direct`
   而不是在 6 个分支各写一遍；客户端直接复用 `on_click_hand_card` 而不是新开一条点击链。
   > 反例就是 10-17 那版 `resolve_us_replay`——为每种卡各写一份"自动补参"，最后只能用"兜底"打补丁。
2. **参照系思维**。不知道正确写法时，先找"同模式里本来就对的那个"：17513 就是弃牌的参照系，
   照它写，比从零推理可靠得多。
3. **先 A/B 证明再动手**。`test_15430_queue_filter.js` 有 5 项失败，先用 eval 副本把新 helper
   完全中和（等效"改动前"）做对照，证明失败集合完全一致、helper 在该场景排队 0 次——
   **确认是预存的陈旧问题后才去动别的**，没有浪费时间在无关失败上。
4. **判定同源**。服务端算好下发（`next_label` / `desc` / `total` / `choiceLabels` / `filter`），
   客户端不二次判断。本轮 3 个 bug 里有 2 个是两端不同步造成的。
5. **每张卡一个冒烟测试 + 回归矩阵**。改完跑全量回归，且**能区分"我引入的"和"本来就红的"**
   （`_smoke_15425_defer` 那 2 项、`test_15430_queue_filter` 那 5 项都是后者）。
6. **大重构先写设计文档、再分期落地，每期可独立 revert**。响应栈重构（§3）先产出
   `docs/REFACTOR_RESPONSE_STACK.md`（含根因、目标模型、三期计划、风险与回滚），
   再按"第一期最低风险 → 第二期替换 → 第三期收尾"推进，每期独立 commit。
   > 反例就是边改边想：旧版 `resolve_us_replay` 没有先行设计"重打的语义到底是什么"，
   > 于是长出无参调用 + 兜底补丁 + 跳过拦截三层妥协。

---

## 8. 验证与回归矩阵

| 测试 | 结果 | 说明 |
|---|---|---|
| `_test17528` | 全过 | 美国国家技能全卡 |
| `_test17513` / `_test17526` / `_test17529` | 全过 | 委托 / 自弃参照系 |
| `_test17532` / `_test17532_step` | ALL PASS | 战区移动 + 分步执行机 |
| `_test_resp` | 7 / 7 | 交互式响应卡 |
| `tools/_smoke_15426.js` | 10 / 0 | 响应卡冒烟 |
| `tools/_smoke_15431_queue.js` | 16 / 0 | 响应队列 |
| `tools/_smoke_fr_respond.js` | 17 / 0 | 法国响应（15346 配给优先窗口在响应结算期间保留、结算后转绿） |
| `tools/_smoke_15430.js` | 17 / 0 | **栈化重构回归**：奇袭发起海战 → 敌方响应 → 归还陆战步 |
| `tools/_smoke_armed_whitelist.js` | 12 / 0 | **栈化重构回归**：增强卡白名单 |
| `tools/_smoke_15328_attacked.js` | 23 / 0 | **栈化重构回归**：被攻击响应 |
| `tools/_smoke_15425_defer.js` | 10 / **2** | 2 项为 `battle_in_progress` **陈旧断言**，与本次无关 |
| `tools/test_15430_queue_filter.js` | 5 失败 | **已 A/B 证明为预存陈旧问题**（见 §7 方法论第 3 条 + §3.7） |
| `tools/check_reuse.js` | 19 WARN | 全是 skill 索引**行号漂移**（都在改动点之前），非本次引入 |

**针对本轮回改的专项验证**（都写成了临时脚本、跑完即删）：

- ① 6 张卡打出后全部进入 `discard['美国']`；17513 参照系走完全流程同样入堆；
- ② 重打：牌回手牌 ✓ 不在弃牌堆 ✓ 授予一次性额外打出 ✓ `us_replay_armed` + token ✓
  view 下发 ✓ **对方只见 `waiting_for`** ✓；
- ③ 真实打出：走【额外打出】通道 ✓ 不占名额 ✓ 权已消耗 ✓ 最终入弃牌堆 ✓ 效果正常结算 ✓；
- ④ `view.hand_ready['15326#1'] = {ok:true}` → 客户端 `on_click_hand_card` 的 `hand_ready`
  **同源门槛**放行（重打后确实点得动，这正是旧版"卡不在手牌所以点不动"的反面）；
- ⑤ 分步面板：class 集合与战斗预算**完全一致**、子元素顺序一致、CSS 覆盖度 parity、禁用态样式存在。

> **环境提醒**：`play.js` / `play.css` 是静态文件，客户端必须 **Ctrl+F5 硬刷新**才生效；
> `rules.js` 改动需**重启对局服务器**（端口 8091，只监听 IPv6，用 `localhost` 探活）。

---

## 9. 遗留与下一步

| 项 | 状态 | 建议 |
|---|---|---|
| `test_15430_queue_filter.js` 5 项失败 | 预存陈旧 | `seed()` 直接往 `response_queue` 塞手工帧，而"栈重构·第二期"后 `response_queue` 已是 `response_stack` 派生的**只读视图**（诊断时该场景 `response_stack` 甚至是 `undefined`）。需改为走规范栈路径（`request_responses` + 显式给两帧同组 `group_id` / `group_idx`），才能覆盖"同组 defer + 兄弟帧排队"这条新逻辑 |
| `check_reuse.js` 19 WARN | 索引漂移 | 工作区早前未提交改动导致 skill 索引行号漂移，重新生成索引即可 |
| EVENT 分支不开 `play_card` 响应窗 | 已知缺口 | `event-step-machine.md` §10 **期三**：事件卡打完后从来不开响应窗，响应卡拦不到事件卡 |
| `hasSuspended` 漏 `event_budget` | 已知缺口 | `event-step-machine.md` §10 **期四**：预算期间 `status_instant` 可能被动作入口清掉 |
| 17537『陆军后备 +1』 | 延后 | 『陆军后备』机制未定义（日 / 苏 / 美卡面多次出现但 `rules.js` 无实现），需先定义该资源 |

---

## 10. 讲解动线建议（15 分钟版）

| 分钟 | 讲什么 | 关键句 |
|---|---|---|
| 0–2 | §1 项目是什么 + §2 三条边界 | "引擎不可改；role 只有两个、国家有六个，所以才有 delegate" |
| 2–4 | §2.1 三个静默失败来源 | "本项目大多数'点了没反应'都落在这三条里" |
| 4–8 | §3 响应卡栈化（重构篇） | "三个全局变量 → 一个栈 + 一个延期缓冲；续打上下文进帧，结构性消除被覆盖" |
| 8–10 | §4 吞牌 | "不是规则算错，是状态在交接时丢了；`discard_card` 要求牌在手里，所以事后补调无效" |
| 10–13 | §5 重打 | "服务端只做交接、客户端按真实流程接手；需要先选目标的卡，无参调用必然失败" |
| 13–14 | §6 三个连带小 bug | "`false &&` 把配置整个禁用；`need:'piece'` 少一个 `total`；多步参数必须完整往返" |
| 14–15 | §7 方法论 + §9 遗留 | "复用优先、参照系、先 A/B 再动手、判定同源、每卡一测、大重构先文档后分期" |

> 若只有 10 分钟：讲 §0 → §2.1 → §3.1/§3.2（重构前后对比）→ §4 → §7。
> 若听众多为业务方：§0 → §1 → §3.1 经典事故 → §5.5 行为变化 → §9 遗留。

### 可能被问到的问题

**Q：为什么重打要被响应卡拦截？**
A：因为口径定为"完全等同真实出牌"。这是用户明确选择的：保留 `__skip_play_intercept`
就意味着重打不可被拦，与真实出牌不一致。递归风险由 `us_replay_playable` 挡掉（不能重打 17528 自身）。

**Q：为什么不在服务端把目标自动补上？**
A：BASIC 战斗卡的目标是"战斗地区 + 发起单位"，多步 EVENT 的目标是多轮累积的，
服务端无参调用无法推断；硬要支持就得为每种卡各写一份补参逻辑——这正是旧版失控的原因。

**Q：为什么不直接调 `discard_card` 完事？**
A：时序不对。卡已经被 `splice` 出手牌，`discard_card` 开头 `indexOf < 0 → return false`，
事后补调是空操作。必须在**牌还所有权清晰的那一刻**直接 push。

**Q：6 张卡是怎么找全的？**
A：同模式扫描——所有"splice 手牌后 return、挂起独立流程"的 `play_card` 特例分支，
再逐个读它们的流程收尾函数确认是否补自弃。17513 是唯一本来就对的，作为参照系。

**Q：怎么确认某些测试失败不是自己引入的？**
A：A/B 对照。用 eval 副本把新加的 helper 完全中和（等效"改动前"），跑同一测试，
比较失败集合。一致 → 预存问题；不一致 → 本次引入，必须修。

---

## 11. 相关文档

| 文档 | 内容 |
|---|---|
| `docs/project-structure.md` | 项目结构现状（目录 / 契约 / 卡牌体系 / 子系统） |
| `docs/known-issues.md` | 当前遗留问题与未完成项 |
| `docs/pitfalls.md` | 踩坑记录：通用教训 + 契约坑 + 逐条档案 |
| `docs/event-step-machine.md` | 事件卡分步执行机（方案 B）设计文档 |
| `docs/us-event-cards.md` | 美国 EVENT 卡（组 A/B/C）实现跟踪 |
| `docs/REFACTOR_RESPONSE_STACK.md` | 响应栈重构：入栈模型设计 + 三期推进计划（§3 的依据） |
| `docs/RESPONSE_STACK_REFACTOR_REPORT.md` | 响应栈重构完成报告：commit 清单 / 核心改动 / 验证 / 遗留 |




