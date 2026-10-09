# 踩坑与决策记录（quartermaster-sub-wars）

> 目的：把「出过什么问题、为什么出、怎么改的、下次怎么避免」固化下来。
> **规矩：以后每解决一个问题，就往本文追加一条，不要只在聊天里说。**
>
> 维护方式：新条目加在对应章节末尾；跨周期的大坑加在「一、通用教训」里。
>
> ⚠ **每次修 bug 前先读「通用教训 20」**：
> 用户报【一个】问题时，必须先判断是不是【一类问题】——扫描同类配置/调用点，
> 并主动报告"已修哪张、同类还有几张、优先级如何"。本项目是数据驱动的，
> 同类错误几乎总是批量存在（R28~R45 反复验证）。
>
> **配套文档**（2026-09-28 新增，避免职责混淆）：
> - `docs/project-structure.md` —— 项目结构现状（目录 / 431 张卡分布 / 已实现范围 / 工具链）
> - `docs/known-issues.md` —— **当前仍存在**的问题与未完成项
>
> 三者分工：**本文件 = 历史踩坑**，`known-issues.md` = **现状待办**，
> `project-structure.md` = **结构事实**。问题修完后，从 known-issues 移到本文件。

---

## 一、通用教训（反复踩过的思想性总结）

这 8 条几乎覆盖了本模块 80% 的返工，遇到新问题时**先对照这里**。

### 1. 渲染时机 ≠ 状态时机（"异步 query 与重绘赛跑"）

**典型事故**：资源再分配选不中手牌。

**成因**：点按钮时先 `send_query('deck_basics')` 走网络往返；在回复到达前，
socket 的 `on_update` 又重绘了一次手牌区。那一次重绘画出来的 `d.__act`
是基于**当时还是 null** 的 `pending_resource` 写的提示语（"请先点按钮"），
而面板打开后手牌区**不再重绘**，于是 `__act` 永远停在那句提示上。

**结论（重要）**：
> **不要把"点击后该做什么"在渲染时算好存进闭包。**
> 渲染只负责**外观**（高亮/置灰/徽标），点击时**再用当时的状态现算**。

**实现范式**（`on_click_hand_card`）：
```js
d.__card = c                                  // 只标记"是哪张牌"
d.addEventListener("click", () => on_click_hand_card(c, d))
// on_click_hand_card 内部按【点击那一刻】的 pending_resource / air_move /
// view.turn_phase 等现判，返回第一条命中的分支
```
同时 `__act` 之类的字段一旦引入，就必须保证"每次重绘都赋新值"，
否则就是这种"看着能点、点了没反应"的诡异 bug。**不如一开始就不存。**

---

### 2. 状态的"清理"必须排在"使用"之前

**典型事故**：按钮显示「确认弃牌（1 张）」但实际已选 0 张。

**成因**：`update_phase_buttons()` 里顺序写反了——
先读 `discard_pick` 更新按钮文案，**之后**才执行"阶段切换则清空 `discard_pick`"。
于是阶段切换那一帧，按钮用的是**上一阶段的旧数据**。

**结论**：
> 同一个函数里，"规范化/清理状态"永远放在"渲染/派生展示"**之前**。

顺手排查同类：
`update_resource_box()` / `update_air_box()` / `update_phase_buttons()` 之间
存在"谁先谁后"的隐式依赖，已在 `update_map()` 里固定顺序并加注释。

---

### 3. 判定逻辑必须**服务端与客户端同源**

**典型事故**（多个）：
- 空军阶段打不出《空军力量》；
- 资源再分配阶段手牌看得见点不中；
- 出牌阶段用掉配额后，空军阶段的卡也被置灰。

**成因**：客户端为了"提前置灰/提前拦截"，在 `play.js` 里**复制**了一份
校验逻辑，之后只改了 `rules.js`，两边口径漂移。

**结论**：
> **能点的=能成功的**。客户端的置灰判断必须和点击判断走同一个函数
> （`check_phase_for_card`），服务端再做一次权威校验。
> 出现"看得见不能点 / 点了才报错"的不一致时，优先怀疑口径漂移。

**当前做法**：
- `play.js` 的 `check_phase_for_card(c)` 与 `rules.js` 的 `check_phase_for_card(game,nation,c,arg)` 一一对应；
- `is_timing_card` / `is_airforce_only` / `has_phase_note` / `air_host_check` 等谓词两边**同名同义**；
- 改规则时**两边一起改**，并在测试里各覆盖一次。

---

### 4. "跨阶段误伤"：配额判断必须限定在当前阶段

**典型事故**：出牌阶段用掉了 `play_done`，进空军阶段打《空军力量》被挡死。

**成因**：`if (view.my_play_done) return` 这种**不加阶段判断**的写法，
而 `play_done[nation]` 一旦为 true 就**整回合**不再复位。

**结论**：
> 每种"每回合一次"的配额用**独立标记**、并在**进入该阶段时清零**：
> `play_done`（出牌阶段）、`air_done`（空军阶段）、
> `resource_swaps`（资源再分配）、`discard_phase_count`（弃牌阶段）。
> 判断时先看 `turn_phase`，再查对应标记。

---

### 5. Rust/JS 式"想当然"：规则里没写 ≠ 可以

**典型事故**：
- 海军建设只写了"邻接本国陆军"，漏掉"必须处于补给状态"；
- 空军部署被 `can_build_at` 当成陆军一起挡在陆地外，导致**不能与海军同格**；
- "空军不能作为攻击目标"没做，导致能打飞机。

**成因**：按"印象"实现，没有回到 `docs/easy-rule.md` 原文核对，
而规则书里这类限定词（补给状态 / 同格 / 不能 / 只能）恰恰是关键。

**结论**：
> **每条规则实现前先读一遍 `docs/easy-rule.md` 原文**，
> 把限定词逐条列出来当验收清单（"必须/不能/只能/只有…才"）。
> 用户口头补充的规则**立刻写进 easy-rule.md 或本文件**，别留在聊天里。

---

### 6. 空集合是 bug 高发区（尤其是"三选一"这类卡）

**典型事故**：《空军力量》在没有合法目标时会走进死路。

**成因**：这类卡是"先选模式 → 再选目标"，目标校验发生在**很后面**；
而"根本没有可选项"的情况（本国无空军 / 无可落地区 / 无敌方空军）
没有被前置检查，UI 停在"已进入选目标模式但一个地区都点不了"。

**结论**：
> 凡是"需要选目标"的动作，**提交前先做一次是否存在合法目标的预检**
> （`has_legal_target`），没有就明确拒绝并给出**具体原因**
> （"本国没有空军"比"操作失败"有用得多）。
> 客户端收到空目标列表时也要**自动退出选卡模式**，不能把玩家晾在那。

---

### 7. 一个席位 ≠ 一个玩家：决策归属要显式建模

**典型事故**：德国攻击英国时，用德国身份就能决定英国是否用空军替死。

**成因**：两重问题叠加——
1. `exports.action` **完全没有回合归属校验**（任何 role 能提交任何 action）；
2. "是否代受"的询问是**发起方客户端本地弹的**，服务端只是被动收参数，
   决策权天然落在发起方手里。

**结论**：
> 涉及**双方交互**的决策（代受、响应卡、抵消…），
> 必须在服务端建**待决事项**（`game.pending_battle`），
> 并只通过 `view` 发给**有权决策那一方**，
> 再由专用 action（`resolve_battle`）提交。
> **不要靠"客户端自觉不点"来保证权限。**

---

### 8. 别把"派发"当成"委托"（数据结构形态）

**典型事故**：`view.actions` 写成了数组，导致 RTT 客户端行为异常。

**成因**：RTT 约定 `view.actions` 是**对象**（`{action_name: 1}`），
表示"允许的动作白名单"，不是"可调用函数列表"。

**结论**：契约类字段先照抄现有可用模块的写法，再改内容。
详见 `docs/rtt-integration.md`。

---

### 9. 身份不能绑死在"当前行动方"上

**典型事故**：防守方接不到"是否用空军代受"的询问，也提交不了回复。

**成因**：`nation_of_player(role)` 原实现是"轮到本方阵营才返回 current_nation，
否则 `null`"。于是德国回合时，同盟的 `my_nation === null` —— 防守方在
**整个对方回合里没有身份**，`view.pending_battle` 和 `view.actions` 都拿不到。

**结论**：
> "我是谁"（身份）和"现在轮到谁"（行动权）是**两个独立概念**，不要互相绑定。
> - 身份：`nation_of_player` → 本方阵营的代表国（与回合无关，稳定不变）
> - 行动权：`is_my_turn` → `current === game.active`
>
> 凡是"双方交互"的功能（代受、响应卡…），都要先问：
> **非行动方此时有没有身份？能不能收到消息、发出动作？**

---

### 10. 服务端给了的数据，客户端别再筛一遍

**典型事故**：防守方的代受面板一个按钮都渲染不出来。

**成因**：客户端对服务端已经算好的 `pb.airs` 又做了一次过滤，
而过滤条件是错的（把**数组** `view.pieces` 当**字典**用，
且它是按本方代表国过滤的，防守方关心的可能不是本国）。

**结论**：
> 服务端返回的"候选集合"通常是**权威且已过滤**的，客户端直接渲染。
> 要附加信息（名称/位置）时，用**另一个按 id 索引的字典**
> （如 `view.pieces_by_id`）去查，而不是拿它当过滤器。
>
> 顺带：**数组与字典要在字段名上区分**，
> `pieces`（数组）vs `pieces_by_id`（字典）—— 混用是这类 bug 的温床。

---

### 11. 挂起状态要"全局生效"，别只挡某几个动作

**典型事故**：战斗等待防守方决定时，进攻方还能继续打牌、推进阶段。

**成因**：`next_phase` / `play_card` / `discard_one` 各自只做自己的校验，
没有统一的"当前有战斗待结算"判断，于是逐个漏掉。

**结论**：
> 一旦引入"双方交互的挂起状态"，就在 **action 入口**加统一守卫：
> ```js
> if (game.pending_x && action !== 'resolve_x' && 非调试动作) { 拒绝; return }
> ```
> 白名单式放行（只允许解决该挂起的动作 + 调试动作），
> 比"记得在每个动作里加判断"可靠得多。

---

### 12. 命名/大小写口径要一次说清

**典型事故**：`side`（小写 `'axis'`）与 `faction_role_of_nation()`（`'Axis'`）
直接比较，恒为 false，导致**任何人打牌都被拒**。

**成因**：同一模块里存在两套阵营标识——
RTT role 名（`'Axis'`/`'Allies'`）与内部阵营 key（`'axis'`/`'allies'`），
散落各处、没有统一转换函数，凭记忆写比较就出错。

**结论**：
> 出现两套标识时，**立刻写转换函数并在使用处注释口径**：
> ```js
> const AXIS_ROLE = 'Axis'      // RTT role 名（首字母大写）
> const AXIS      = 'axis'      // 内部阵营 key（小写）
> ```
> 比较前先归一到同一口径；报错文案里也要用对（别把行动国和提交者混在一句）。
> 这类错误**不会崩**，只会静默返回 false —— 所以必须靠测试覆盖。

### 13. 给 state 加新字段后，**老存档不会自动有它**

**典型事故**：明明占领了不列颠（★补给点、有 2 个计分标记），
计分阶段英国却是 **+0**。

**成因**：`game.markers` 是"计分系统"这次新加的 state 字段。
新对局走 `create_empty_game_state` 会带上它；
但**已经存在的老对局是从 SQLite 的 `game_state` 里反序列化出来的**，
那份 JSON 里根本没有 `markers` 键。于是：
```js
markers: game.markers || {}    // view 里这样兜底 -> 变成空对象
```
`score_breakdown` 遍历 `Object.keys(game.markers)` 得到 **0 个地块**，
直接返回总分 0 —— **不报错、不崩溃、只是静默算错**。

**结论**：
> 1. 给 state 加字段时，**必须同时写一个惰性迁移函数**，
>    并在 `view` / `action` / `query` 这三个 state 入口各调用一次
>    （老对局不会重新走 `setup`，只在 `create_empty_game_state` 里初始化是没用的）。
> 2. 迁移函数要**幂等**：已存在该字段（哪怕是空对象）时不要覆盖，
>    否则会抹掉卡牌造成的改动。
> ```js
> function ensure_markers(game) {
>     if (!game || typeof game !== 'object') return game
>     if (game.markers && typeof game.markers === 'object') return game
>     game.markers = init_markers()
>     return game
> }
> ```
> 3. 这类"字段缺失"问题**优先怀疑存档**，别急着怀疑规则逻辑 ——
>    先用 node 直接读 `server-official/db` 里的 `game_state` 看一眼 state 的键列表。
> 4. 用户口径："过老的存档干脆弃掉"是**可以接受的兜底**，但能修就修——
>    惰性迁移只多 10 行，比让人重开对局省事得多。

### 14. 地块有"本体名"和"别称"两套叫法，别称在代码里查不到

**背景**（2026-09-23 玩家确认）：

| 场景 | 用哪个名字 | 例 |
|---|---|---|
| 说**势力/国家** | 本体名 | "德国的计分阶段"、"法国并入英国" |
| 说**地块本身** | 别称 | "英国陆军在**日耳曼**"、"**西欧**被占领" |

- **日耳曼 = 德国**（id=44）——"德国"是势力名，指地块时易混淆
- **法国地块用西欧**（id=6）——法国大本营在西欧，地图上根本没有"法国"地区
- （同类：〈波兰〉=东欧 id=5、〈奥斯陆〉=北欧 id=4）

**坑在哪**：

```javascript
data.id_of('日耳曼')   // -> undefined，不报错！
data.id_of('德国')     // -> 44
```

完整对照表见 **`docs/place-names.md`**（唯一权威来源）。

**结论**：
> 1. 别称目前**只用于文档与沟通**；代码和测试里引用地块**必须写本体名**。
> 2. 这类"键名对不上"的错误**不会抛异常**，只会静默返回 `undefined`，
>    随后表现为"这个地区的判定莫名失效"，排查很费时间
>    （与通用教训 1 同源：`data.js` 字段名那段踩过一模一样的坑）。
> 3. 若将来卡面文本/规则里出现了别称（如"在日耳曼建设"），
>    **必须先加一张别名表**把 `日耳曼 -> 44` 映射进来，否则静默失效。
> 4. 意大利(13)、日本(47)、美国(27) 也存在同样的重名问题，
>    只是尚未约定别称 —— 讨论时留意上下文。

### 15. "每局可能不同"的信息，必须住在 game 里，不能住在模块常量里

**典型事故**：为了表达"波兰/中国西部/非洲南部/西伯利亚是补给点"，
写了一份模块级硬编码名单：

```js
const EXTRA_ALLIED_SUPPLY_NAMES = ['中国西部', '非洲南部', '西伯利亚']
```

看着能用，但它**无条件**把这些地区算作补给点 ——
而按玩家口径它们**初始不是**补给点，只有卡牌能让它们变成补给点。
结果：美国参战条件"轴心占领 3 个补给点"被凭空多算了，
且**漏了波兰（东欧）**，因为地图里根本没有"波兰"这个地区。

**成因**：把"对局内可变的状态"塞进了"编译期常量"。
`data.js` 里的东西是**所有对局共享**的，表达不了"这局改了、那局没改"。

**结论**：
> 判断某信息该放哪，只需问一句：**它会不会因对局而异？**
> - 会 → 必须进 `game`，随存档序列化（另加惰性迁移兜底老存档）
> - 不会（地形、邻接、地区名）→ 放 `data.js` 常量
>
> 补给点属于前者（卡牌可改），所以加了动态层 `game.supply_override`，
> 判定时 `override 优先、否则回落 data`。
> 详见 `docs/supply-points.md` §0 对两种方案的完整对比。
>
> **顺带的教训**：硬编码名单天然会**漏项**（这次漏了波兰）。
> 能用"遍历 + 判定函数"表达的，就不要列名单 ——
> 名单需要人肉维护，而判定函数会自动跟上数据变化。

### 16. 加了新维度，要把"按旧维度分类"的地方一起改


**典型事故**：给计分标记加了 `faction`（阵营）维度后，
`allocate_space_score` 仍在按**旧的单维度**分类：

```js
if (mk.owner == null)      sharedPot.push(v)      // 人人有份
else if (pool.indexOf(...)) earmarked[...]        // 专属
```

`faction` 根本没参与判断 —— 一个"仅同盟可拿"的标记会被当成
"人人有份"，德国也能分到。

**结论**：
> 加维度时，全局搜一遍**消费该结构的地方**，
> 尤其是那些"按旧字段做 if/else 分类"的代码。
> 这类代码**不会报错**，只是分类结果悄悄错了。
>
> 正确做法是先算出**资格集合**再按集合大小分类，
> 而不是直接看某个字段是否为 null：
> ```js
> const eligible = pool.filter(n => marker_applies_to(mk, n))
> ```
> 这样无论将来再加多少维度，分类逻辑都不会漏。

---

### 17. 修了"记账"，别忘了"报账"也要跟着改

**典型事故**：英国计分阶段，中立苏联在印度有 1 支部队应扣 1 分。
`game.score.allies` 正确地记成了 1、`last_scoring.total` 也正确写成 1，
**但函数返回给调用方的 `gained` 仍然是毛分 2**。

**成因**：加扣分时只改了"写进 state 的那条路径"：
```js
game.score[f] = (game.score[f] || 0) + net      // 改了
game.last_scoring = { total: net, ... }          // 改了
return { gained: total, ... }                    // 忘了改 —— 仍是毛分
```
于是**同一个函数有两条"分数出口"，一条对一条错**，
调用方（UI / 日志 / 测试 / 胜负判定）拿到的是未扣分的数。

**结论**：
> 引入"净值"概念（扣分、折扣、上限截断）时，
> **把函数里所有对外暴露该数值的地方列一遍再一起改**：
> state 写入、`last_scoring` 快照、`phase_note` 文案、返回值、view 字段。
> 加一个断言把"返回值 == state 实际变化量"锁住，是最省事的防回归手段：
> ```js
> eq(r.gained, g.score[f] - before, '返回值与 state 实际增量一致')
> ```
> 经验：**一个数只在一个地方算出来**（这里就是 `net`），
> 其余位置全部引用它，不要重新用 `total` 推导。

---

### 18. 新增 action 必须登记 `build_actions` 白名单——不在册 = 客户端**静默不发**（点了毫无反应）

**典型事故**（连着踩两次）：
- 高速公路（15228）点高亮地区没反应；
- 桌面状态卡（15345 塞内加尔步兵团等）点击没反应。

**现象特征**（很重要，能一眼认出）：
高亮/弹框/拦截全都正常，服务端 `exports.action` 里**也有对应分支**，
服务端自测脚本甚至全绿，但**浏览器点了毫无反应，控制台连 `SEND action …` 都没有**。

**成因**：RTT 客户端的 `send_action(verb, noun)`（`public/common/client.js`）会先查白名单：

```js
let va = view.actions?.[verb]
if (va) {
  if (va === 1 || va === true || typeof va === "string") {
    if (noun === undefined || noun === null || typeof noun === "object") {
      view.actions = null
      send_message("action", [ verb, noun, game_cookie ])   // 真的发
      return true
    }
  }
  ...
}
return false   // 白名单里没有这个 verb -> 静默 false，一条请求都不发
```

而 `view.actions` 来自服务端 `build_actions()` 的返回值（rules.js）。
**服务端 `action()` 里有分支 ≠ 白名单里有它——这两件事完全独立。**
ECON 的 `resolve_econ` 之所以能用，正是因为 `build_actions` 里显式写过
`return { resolve_econ: 1, log: 1 }`，不是因为它"自然就能发"。

**结论（重要）**：
> **每新增一个 action，必须同时在 `build_actions()` 里登记同名 key（值取 `1`）。**
> 服务端分支 + 白名单登记，是两处，缺一不可。
>
> 注意白名单的值语义（client.js）：`noun` 是对象时，只有 `va` 为
> `1 / true / 字符串` 才会放行；`va` 是数组时走 "thing action"
> （要求 `noun` 或其首元素在数组里），两种形态别混用。

**带 id 的 action 尤其容易踩**：`build_actions` 里若登记成
`acts['activate_status:' + cid] = 1`（**带后缀**），而客户端发的是
`send_action('activate_status', { card: cid })`（**不带后缀**），
两者对不上，照样静默失败。要么客户端也用带后缀的 verb，
要么白名单同时登记一个不带后缀的 `activate_status: 1`。

**排查口诀**：浏览器控制台搜 `SEND action`。
- 有 `SEND action <verb>` → 请求发了，问题在服务端（看返回日志）；
- **没有 `SEND action` → 白名单没登记，或 verb 拼错**（不要去查服务端逻辑）。

---

### 19. 挂起机制有四套（选型指南）——共享"模式"，不要合并代码

**为什么会有多套**：因为**答复方 / 答复次数 / 交互形态 / 可否放弃**四个维度不同，
硬合并成一个"万能挂起"会变成一堆分支判断，反而更难维护。
它们共享的是**设计套路**，不是代码。

| | `pending_battle` | `pending_econ` | `pending_autobahn` | `response_queue` |
|---|---|---|---|---|
| **代表场景** | 战斗代受/抵消 | 15314 马耳他潜艇群 | 15228 高速公路 | 15329 反潜战术拦截 |
| **谁触发** | 发起方发起战斗 | 美国打出 ECON 卡 | 德国打出 15228 | 任意"打出牌"事件 |
| **谁被问** | **对方**（防守方） | **对方**（德、意） | **自己**（德国） | **对方**（持有响应卡者） |
| **要让权吗** | ✅ 要 | ✅ 要 | ❌ 不要（本就是自己回合） | ✅ 要 |
| **答复次数** | 1 次（可分两阶段） | **多次**（chain 链式逐国） | **多次**（N 次选位置） | 1 次 |
| **可否放弃** | ❌ 必须答 | ❌ 强制（中立国也要答） | ❌ 必须答完 | ✅ 可放弃（`pass_response`） |
| **交互形态** | 弹框 | 弹框二选一 | **点地图**（需 query + 高亮） | 弹框，发动后可能再选目标 |

**关键分水岭：要不要"让权"**（= 翻转 `game.active`，见 R22）
- **问对方** → 必须让权，否则界面顶栏还显示自己回合，
  对方根本不知道轮到自己答（"挂着"和"没发生"看起来一样）。
- **问自己** → 不要让权（本来就是自己回合，让权反而多余）。

**通用套路**（新增挂起时照抄这个骨架）：
```
① 写 game.pending_xxx
② （若问对方）set_pending_xxx 把 game.active 让给答复方，记 return_active 以便交还
③ action 入口加全局守卫：期间只放行 resolve_xxx（见通用教训 11）
④ build_actions 白名单放行 resolve_xxx（见通用教训 18，漏了会静默不发）
⑤ view 暴露 pending_xxx + waiting_for 提示
⑥ 客户端弹框/高亮 → 发 resolve_xxx → 推进或收尾
⑦ 收尾后交还操作权
```

### 20. 【工作方法】用户报一个问题时，先判断"是不是一类问题"并主动报告

**用户明确要求（2026-09-29）**：
> "之后我指出问题时，你要思考有没有可能是一类问题，报告给我。"

**为什么必须这样**：本项目是**数据驱动**的（431 张卡、多套配置表），
同样的错误几乎总是**批量存在**。R28~R45 反复证明：
修好单张卡 = 治标；同类卡仍在坏着，用户会**一张张报回来**。

**标准流程（每次修 bug 都要走）**：

```
① 修好用户报的那一个（定位根因）
② 【关键】反查根因落在哪个"类"上：
     是一张卡？   -> 扫【所有卡】的同类配置
     是一个函数？ -> 找【所有调用点】
     是两端交互？ -> 检查【服务端 / 客户端是否同源】
     是返回值？   -> 检查【出口是否重新构造过】（新增字段要在出口也带）
③ 写一次性扫描脚本（放 tools/，命名 _scan_*），【全量】列出同类项
④ 报告：哪张已修、同类还有几张、哪些更严重、建议优先级
⑤ 把"类"的结论写进本文档（不是只记这一张卡）
```

**已沉淀的扫描工具**（`tools/`）：
| 脚本 | 扫什么 |
|---|---|
| `_scan_multistep.js` | 多步 / 多选项事件卡（steps 或 choice >1 步） |
| `_scan_runstyle.js` | **run() 函数式卡**（不询问玩家）+ 卡面疑似需选择的 |
| `_scan_phase_notes.js` | 卡面含阶段名的卡（区分"打出时机" vs "被动结算"） |
| `_check_all_space_refs.js` | 卡面 `<…>` 地区引用能否解析 |
| `_check_status_spaces.js` | STATUS 配置里的地区名 |

**判断"是不是一类问题"的四个信号**：
1. 根因在**配置表**里（某张卡配错 -> 同批录入的都可能错）
2. 根因在**通用框架**里（某函数漏传参 -> 所有调用点都漏）
3. 根因是**两端不一致**（查询能查到、执行执行不了 —— 一定要查对称位置）
4. 根因是**架构性取舍**（如 `run()` 绕过询问框架 -> 16 张卡全中招，见 R45）

**报告格式**（要给用户能决策的信息）：
> ① 你报的这张：已修 / 结论
> ② 同类还有 **N** 张：列出 id + 名称
> ③ 哪些**更严重**（规则错误 > 体验缺失）
> ④ 建议优先级 + 是否为架构性欠账

**实例**：用户报"15325 点了没建设" ->
扫描发现多步卡 7 张（R44）；再扫发现 `run()` 式 16 张全无交互（R45），
其中 7 张卡面明确要玩家选择 -> 一次报告出 14 张的待办清单。

**选型口诀**：
> **问对方** → 抄 `pending_econ`（让权 + 链式）；
> **问自己、多次选位** → 抄 `pending_autobahn`；
> **可放弃、放弃后要继续原动作** → 抄 `response_queue`（带 `resume` 重放）；
> **战斗相关** → 抄 `pending_battle`。

**实例（将来 17526 民主兵工厂）**：美国打出 → 让**英国**建设海军+陆军，
英国可用《澳大利亚劳管局》替换 —— 属于"**问对方 + 要让权 + 可放弃**"
（放弃则继续原建设），应 **以 `pending_econ` 的让权骨架为主 +
参考 `response_queue` 的"放弃后 resume 继续"逻辑**，不要只抄一套。

---

### 21. 【2026-10-02】"能不能打"的判定只能有一份实现；且配置的 steps 可能住在 `choice` 里

**典型事故**：15321《低地国家自由军》卡面写死了 `spaces:['西欧']`，
但玩家看到的是**北海**高亮、点了没反应，且**无法选择发起单位、也不高亮**。

**成因（两处叠加）**：
```js
const st = eff && (eff.steps || []).find(s => s.op === 'battle')   // ❶
if (!hasAgainst) continue                                          // ❷
if (st && typeof st.spacesFn === 'function') { ... }               // ❶ 的后果
```
- **❶ 配置结构**：15321 是 **`choice` 型卡**（二选一），steps 存在 `eff.choice[1]`，
  **根本没有 `eff.steps` 字段** -> `(undefined || []).find()` -> `st` 恒为 **undefined**
  -> `st.spaces` 限定**从未生效**，候选退化成"全图"。
- **❷ 双实现漂移**：`event_battle_targets` 自己实现了一套"目标合法性"判定，
  与 `step_space_candidates` **口径不一致**（漏 `spaces`、强制要求敌军、不给发起单位）。

**结论**：
> 1. **解析卡配置时，必须同时支持 `eff.steps` 与 `eff.choice[分支]` 两种形态**，
>    并且要能把"玩家选了哪个分支"一路传到解析处（本项目存进 `event_budget.choice`）。
> 2. **同一个语义（"能不能打"）只允许有一份实现**。找到权威那份
>    （`step_space_candidates` / `basic_targets`，它们与 `do_battle` 同源），
>    其它位置一律**复用**，不要重写遍历 —— 重写必漂移。
> 3. **"攻击地点固定"的卡，必须把【发起单位候选】也下发给客户端**
>    （`view.event_budget.initiators`），否则玩家无从选择，也无从高亮。

**反查同类**：扫描全部 `op:'battle'` 配置后确认只有这一处漏了 `st.spaces`
（其余靠 `spacesFn` 或玩家选点）。

---

### 22. 【2026-10-03】"获得了权限" ≠ "真的能用"；新增枚举分支务必默认拒绝

**典型事故**：英国国家技能"弃 3 张手牌 -> 额外打出 1 张事件/状态牌"，
测试显示 `game.extra_play` **已成功生成**，但玩家**永远打不出那张牌**。

**成因（3 个，第 3 个最隐蔽）**：
1. 我调用了**不存在**的 `card_type_of()` -> `ReferenceError` 崩溃
   （正确是 `is_card_type(实例id, 'STATUS')`）。
2. **`extra_play_allows` 没有 `event_status` 分支** -> 落到末尾 `return true`，
   于是**任何手牌**都能额外打出（比不能打更糟：规则被放宽了）。
3. **`grant_extra_play` 把生效阶段写死为 `phase:'play'`**，
   而英国是在**摸牌阶段(draw)** 授予的 —— draw 是回合**最后一个阶段**，
   本回合再无 play 可打，下回合 `turn` 校验又失效 -> **技能永远用不了**。

**结论**：
> 1. **测试断言要走到"端到端真实调用"**，不要只断言"状态已建立"。
>    我当时只验了 `!!g.extra_play` 就以为完成，实际是废的。
>    *判据*：凡"授予权限"类功能，必须补一条**真的调用该权限**的用例。
> 2. **枚举 filter 的新分支必须显式处理**，且**兜底应当是"拒绝"而非"放行"**。
>    `return true` 作为默认分支，会让漏配的枚举静默放大权限。
> 3. **"生效阶段"要作为参数**（`opt.phase`），别写死 `'play'` ——
>    凡是"非出牌阶段授予的能力"，都要能指定它在哪个阶段可用。

---

### 23. 【2026-10-03】"取消"是否有害，看**是否获取了信息**，而不是看**看的是谁的**

**玩家口径（两次）**：
1. "因为双十字系统会看到别人的牌，因此使用双十字系统弹出的弹窗，应该不能点取消。"
2. "15215 也不应该能取消。"

**我第一版只禁了"看对手手牌"**，把 15215（看**自己**牌堆顶）漏了 —— 被玩家一句话纠正。

**正确判据**：
> 摊牌 = 泄露。不管是**对手的秘密手牌**，还是**自己牌堆顶的顺序**
> （知道接下来会摸什么，同样能规划后续），**取消都等于免费偷看**。
> => **任何 peek 弹窗一律不可取消**，必须排完序点【确认】。

**⚠ 附带的关键技术事实（极易搞错）**：
> **15305 双十字走 `query` 路径，而 query 是只读 RPC —— 服务端【不建立 `game.peek`】**；
> 弹框完全由客户端本地渲染（`pending_peek_for_card` / `peek_cards` / `peek_target`）。
>
> => **真正拦截取消的是客户端**（判据：被看方 ≠ `view.my_nation`）；
> 服务端 `clear_peek` 的守卫只是**兜底**（防直接发 action / 旧客户端 / 脚本）。
> **只改服务端 = 双十字依然能取消。**

**实现**：关闭「×」与「取消」**直接从 HTML 移除**（不是隐藏），
`cancel_peek()` 只弹提示（防旧缓存页面调用）；
曾短暂引入的 `game.peek.opponent` 字段在口径统一后**删除**，
避免后来者又去写"对手 vs 自己"的分支。

---

## 二、RTT 契约类踩坑

| # | 现象 | 成因 | 解法 |
|---|---|---|---|
| R1 | action 提交后无效 | `exports.action` 必须 `return state` | 所有分支都要 return |
| R2 | `view.actions` 异常 | 必须是**对象** `{debug_place:1}`，不能是数组 | 用对象字面量 |
| R3 | 查询参数丢失 | `send_query(q, param)` 的**第二参是 params**，不是回调；结果走全局 `on_reply` | 别在第二参传函数 |
| R4 | 回调被静默覆盖 | `on_reply` 只能有**一个**定义，后定义者覆盖前者 | 合并成一个分发函数 |
| R5 | `query` 拿不到参数 | 签名是 `exports.query(state, current, q, params)`，有**第 4 个参数** | 参数从第 4 位取 |
| R6 | 改 view 报错 | `view` 是**只读**的，不能就地改 | 另写纯函数（如 `compute_connections()`）再返回 |
| R7 | 模块加载静默失败 | `about.html` / `create.html` 在 `load_rules()` 里是**无条件 `readFileSync`** | 两个文件必需存在 |
| R8 | 对局进不去 | 官方版 URL 是 `play.html?game=<id>&role=<role>`（查询参数） | 不是路径形式 |
| R9 | 单人开不了局 | 需要 **Axis 与 Allies 都加入**才会出现 Start | 建局后两边都 join |
| R10 | 改 `rules.js` 不生效 | watch 不总生效 | **必须重启服务器** |
| R11 | 端口冲突 | 8080 被 Steam/CEF 占用 | 用 `RTT_PORT=8091` 环境变量启动 |
| **R11.1** | **凭记忆写死端口 → 连到 Steam 而非 RTT**（2026-10-09 复发） | 端口占用是**动态**的，"当前端口"是快照会过期 | **先查进程再定端口**，见下方四步判据；档案见「2026-10-09 · 凭记忆写死端口」 |

### 端口与环境（本机）

> ⚠️ **铁律：端口必须现场判定，不要凭记忆写死。**
> 8080 / 8090 / 8091 都曾"是当前端口"，而 Steam 未必开着、RTT 可能跑在任意一个。
> **记判据（怎么查），不要记结论（用哪个端口）。**

**① 找真服务器进程（唯一可靠判据；只查监听端口不够）**

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'server\.js' } | Select-Object ProcessId
```

**② 没有进程就自起**（端口优先级 `RTT_PORT` > `HTTP_PORT`(.env) > `8080`；8080 常被 Steam 占用，故缺省 8091）

```powershell
cd server-official
Start-Process cmd -ArgumentList "/c","set RTT_PORT=8091&& node server.js > srv8091.log 2> srv8091.err" -WindowStyle Hidden
```

**③ 反查进程名确认**（查到监听 ≠ RTT 在跑）

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 8091 }
Get-Process -Id <pid>    # 必须 node.exe；steamwebhelper.exe = 端口被 Steam 占
```

**④ 主机名用 `localhost`**（服务绑在 IPv6 `::1`，`127.0.0.1` 必连接被拒，`HTTP=000` 是正常现象）

```powershell
curl.exe -s -o NUL -w "HTTP=%{http_code}\n" http://localhost:8091/   # 期望 200
```

---

## 三、逐条问题档案（按时间倒序追加）

### 2026-10-08 · 【实现】意大利状态牌 11 张（17739-17749）全部完成

**分组与实现**
- **组 1（纯 auto 计分 6 张）**：17739/17740/17741/17743/17745/17748。只需在 `STATUS_EFFECTS` 写 `auto{phase:'scoring', trigger_nation:'意大利', affects:'意大利', kind:'run'|'score_per_unit'}`。**不需要** `CARD_TRIGGERS`（那是响应卡用的；状态卡的计分走 `phase_scoring` 派发）。
- **组 2（ongoing 3 张）**：17742 补给点（照搬 15347）/ 17744、17747 永久成对邻接（新增 `pair_adjacency` kind）。
- **组 3（trigger 1 张）**：17746 耀武 = `window:'play_start', cost:{skip_play:true, attrition:2}, effect:{kind:'battle', battle:'land'}`，全部字段现成。
- **组 4（新钩子 1 张）**：17749 轴心协定，仿 17847 消耗战（`status_used` + `freq_key` 记账），挂在 `do_battle` 战斗成立处。

**本次最重要的 5 个机制发现（务必记住）**
1. **`phase_scoring` 已于 2026-10-06 通用化**：遍历所有桌面，用 `cfg.auto.trigger_nation` 精确匹配当前计分国（不匹配则跳过；旧卡无该字段才回退"同阵营"过滤）。所以**意大利卡只要写 `trigger_nation:'意大利'` 就会被正确派发**，不存在"只服务德国"的问题。
2. **但 `auto_fire_status` 仍然硬编码 `c.nation !== '德国'` continue（3738 行附近）** —— 它只用于德国 `after_naval` 自动发动。**英国 15341/15342 的 `window:'build_army'` 也【不是】靠它触发**，而是配置登记 + 客户端交互（该交互至今仍是 TODO）。所以 17742 的 `build_army` 沿用同样状态：**服务端配置已就绪，客户端"放弃建设改点状态牌"的 UI 待补**（与英国卡同一待办）。
3. **邻接的唯一中枢是 `get_connections(game, s, side, snap)`**（183 行），已内置三套覆盖：`limited_connections` 私有列表 / `status_aura.sea_axis_only` / `temp_connections`（本回合）。**新增永久成对邻接只需在 `get_connections` 里加一段消费 `game.status_connections`**（与 temp 同构、去掉 turn 校验），**不要去改那 27 处直接读 `data.spaces[x].connections` 的地方**——它们本来也享受不到前三种覆盖，属既有设计。
4. **永久邻接按玩家口径"只写不撤"**：`apply_status_ongoing` 的 `pair_adjacency` 分支只 push，不实现 revert（卡不会离场）。
5. **【已修正，2026-10-08】补给点的"仅对某国"原本是【阵营维度】退化，现已改为真正的【国家】粒度**。
   - **旧行为（错）**：`add_supply_point(game, sp, faction_of_nation(only))` —— `only:'意大利'` 落到 `'axis'`，导致**德国/日本部队也白拿补给**；15345「仅对法国」实际等于「仅对同盟国」。
   - **新行为**：`supply_override[space]` 增加 `nations: { 国家名: true|false }` 子结构，`add_supply_point` 传**国家名**时写入它（传 `'axis'`/`'allies'` 仍走阵营维度，向后兼容）。
   - `is_supply_point(game, space, faction, nation)` 新增第 4 参 `nation`，优先级：**国家维度 > 阵营维度 > 地图默认**。关键分支：只设了 `nations` 而没设任何阵营维度时，阵营查询**返回 false 且不回落 base**（否则"仅对意大利"会被同阵营他国通过 base 拿到）。
   - `compute_supply` 的补给种子（458 行）必须传**国家名**：`is_supply_point(game, loc, f, game.piece_nation[pid])`。
   - **计分标记本来就是国家维度，无需改动**：`add_marker(game, sp, n, owner, faction)` 的 `owner` = 国家、`faction` = 阵营，是两个独立维度；`marker_applies_to(mk, nation)` 已按 `mk.owner` 精确过滤国家。所以"计分标记对应国家"这条本来就成立。
   - 受影响卡：15345（法国）、15347（英国）、15443（日本）、17742（意大利）、17845（苏联，在 `home_override` 分支内）—— 后两处 ongoing 分支都要改传国家名。

**本次踩的 3 个坑**
1. **往 `STATUS_EFFECTS` 对象里插新条目时，锚点选在对象闭合 `}` 之后** → 新条目被写到对象外面（语法仍通过、require 成功，但 `S['17739']` 全为 undefined）。**必须确认锚点里最后一个 `}` 是对象闭合括号还是别的块**，插完立刻用 `node -e` 打表验证每张卡是否存在。
2. **同一个文件并行发多处 `replace_in_file` 会互相覆盖**（批 B 已犯过一次，这次又因并行导致 `const borrowed` 被冲掉）。**同文件编辑一律串行**。
3. **写区域泛称必须用 `space_ids_expand`**：`space_id_of('非洲')` 返回 MISSING（`非洲` 是 `REGION_GROUPS` 泛称，展开为非洲北部/南部/东部 = 15/31/32），直接查会**恒为 0 且不报错**（R30 同类）。同理 `中东` 是真实地区可直接查。

**验证**：`tools/_smoke_italy_status.js` **68 项 ALL PASS**；回归 `_smoke_italy_response.js`、`_smoke_italy_event.js` 均 ALL PASS。

**⚠️ 本轮曾误判，已纠正（重要）："替换建设"类卡的客户端【早已实现】，不是 TODO。**
- 我第一次总结时写"17742 的客户端交互是遗留 TODO（与英国 15341/15342 同一待办）"——**这是错的**。用户当场指出"15341 我记得实现过"。核实后确认：**15341/15342 早在 2026-09-28 就已完整实现**。
- 完整链路（**全部泛型**，新增一张"替换建设"卡只需在 `play.js` 的 `STATUS_UI` 加一行 `{ build:true, recruit:'<地区>' }`）：
  1. `STATUS_UI`（play.js 4529 起）：key 用**基础 id**（`'15341'`），运行时实例 id（`'15341#3'`）经 `status_ui_of()` 转换（**R40**：不转换则 ui.build/ui.ready 全丢、卡灰显点不动）。
  2. 渲染（4408）：`ui.build` 时不看 `c.ready`，只看"是否正在打《建设陆军》"（`pending_card.name==='建设陆军'`）——因为 `build_army` 是**事件驱动窗口**，服务端 `status_window_ready` 恒 false（刻意如此，保证其余时间不可点）。若这里还要求 ready，玩家永远走不到替换分支。
  3. 点击（4613）：`ui.build` 分支弹确认框，点"放弃建设并征召"时——**必须先取 `buildCardId = pending_card.id` 再 `cancel_basic_card()`**（顺序反了 pending_card 已清空，建设卡退回手牌＝白嫖），然后 `send_action('activate_status', {card, from_status:true, build_card})`。
  4. 无合法位置兜底（6201）：《建设陆军》无可建位置时**不要**取消选卡（否则 pending_card 空了状态卡再也点不动），保留并提示可点状态卡替换；靠服务端下发的 `c.forgo_build` 识别。
- 服务端也泛型：`view.table_status[].forgo_build` 由 `trig.cost.forgo_build_army` 自动推导（15054），`activate_status` 的 `isForgoBuild = arg.from_status && tr.cost.forgo_build_army`（16950）。
- **教训**：判断"某功能是否已实现"必须**实际搜索客户端代码**，不能凭"服务端有个硬编码德国的 `auto_fire_status` 没覆盖"就推断客户端也没做——两者是不同层。**用户说"我记得实现过"时应立即核查，不要坚持自己的推断。**

---

### 2026-10-08 · 【实现】意大利响应牌 Group B：17736 王牌飞行员（拦截类）+ 17732 德国军事顾问（借用德国状态卡）

**17736 王牌飞行员（"成为[轰炸行动]目标时：本回合轰炸对意大利无效"）**
- 定性为**拦截类**响应（事件生效【前】询问），走 `RESPONSE_PRE_CANCEL` 通道，**镜像 15329 反潜战术**，而不是德国 15246/15251 那种"状态卡 `react:{when:'econ_target'}` 事后减免"——后者只是减损耗/反噬，做不到"整张无效"。
- 新增事件名 `econ_bombing`（**不要**用 `on:'play_card'`）：`play_card` 的通用拦截点在 ~17400 行，那时 15313 的 `target` 还没校验、ctx 里也拿不到 target；若把 17736 注册成 `on:'play_card'`，会被通用拦截先捕获一遍，且无法按"目标=意大利"过滤。
- 拦截点必须放在 15313 ECON 分支**目标校验之后、`cfg.run` 之前**（`cfg.tag==='轰炸行动' && t==='意大利'`），并写下 `resume:{action:'play_card', arg:{...target}}` 供放弃时重放。
- ⚠️ **放弃路径必须跳过二次拦截**：`pass_response` **不消耗**响应卡（卡留桌面，日志写明"留于桌面"），重放 `play_card` 时 17736 仍在 `table_responses`，若不加 `!game.__skip_play_intercept` 守卫就会**再次拦截 → 永远结算不了**（本次实测 2 项 FAIL 的根因）。这与通用 `play_card` 拦截的 `if (c && !game.__skip_play_intercept)` 同口径。
- 效果实现只需 `return { ok:true, cancel:true }`；取消分支（~16008）自动把 15313 从手牌移入弃牌堆并 `mark_play_done`，**无需**自己写。

**17732 德国军事顾问（"出牌阶段开始时：选 1 张德国[状态卡]，本回合可使用"）**
- 走 `on:'play_start'`（该触发点已接线），effect 置 `game.italy_borrow={pending:true, options:[桌上德国 STATUS 实例], nation, turn}`，新动作 `resolve_italy_borrow{face}` 锁定。
- `activate_status` 两处改动必须**成对**：① 用 `borrowed` 标记绕过"owner 必须等于 current_nation"（但保留 `current_nation===italy_borrow.nation`，防止德国在自己回合误激活）；② `const cost = borrowed ? {} : (tr.cost||{})` —— 玩家口径是**借卡完全免费，含卡面代价**（闪电战的"损耗自己牌库"也免除），只执行有益效果。
- `build_actions` 里借用生效时把桌面卡收敛为"本国卡 + 借来的那一张"（`borrowActive` 过滤），避免顺带放开跨国产激活其它轴心卡。
- 跨回合失效放 `advance_phase` 的 `game.current_nation = nextNation` 之后：`if (game.italy_borrow && game.italy_borrow.turn !== game.turn) game.italy_borrow = null`（防御性；本回合内由 `current_nation` 守卫）。

**本次踩的 4 个坑（通用，务必记住）**
1. **同一文件并行发多个 `replace_in_file` 会互相覆盖**！本次把"定义 `borrowed`"和"改 `cost`"两条编辑放在同一批并行发出，第二条基于旧快照写入，把第一条**整个冲掉**，运行时直接 `ReferenceError: borrowed is not defined`（而工具返回"成功"，极具迷惑性）。**结论：同一文件的多处编辑必须逐条串行，不要并行。**
2. **测试里 `rules.action(state, current, action, arg)` 的 `current` 是 role（`'Axis'`/`'Allies'`），不是国名**。写 `rules.action(g,'英国',...)` 会被 `const side = current===ALLIES_ROLE?ALLIES:AXIS` 判成轴心 → 回合归属校验直接拒绝（静默返回 game，表现为"没触发"）。同理 `trigger_response`/`pass_response` 有 `head.owner_side !== side` 校验，必须用持有方阵营的 role。
3. **卡牌实例不需要 `g.inst` 注册表**：`inst_card(id)` = `CARD_BY_ID[inst_card_id(id)]`，实例 id 只是 `卡面#n` 字符串，去掉 `#n` 后查静态表即可。测试里手写 `g.inst[x]={...}` 会报 `Cannot set properties of undefined`，直接删掉。
4. **"损耗 N 张牌"作用于【受击方】牌堆**：15313 选意大利为目标是让**意大利**的牌堆顶进意大利弃牌堆，不是英国弃牌堆。断言损耗时别看错国家的弃牌堆。

**验证**：`tools/_smoke_italy_response.js` 追加 Group B 共 15 项，全量 40 项 **ALL PASS**；回归 `tools/_smoke_italy_event.js` 仍 ALL PASS。

---

### 2026-10-07 · R49：17900 友方攻击中国东北 → 让权苏联（真正挂起的范式 B）

**起因**：用户要求「中国东北被友方国家攻击结算后，若苏联手牌有[建设陆军]，挂起让权给苏联，可打《八月风暴》增强卡；其效果参考 15325（征召后立刻用新单位发起陆战）」。方向明确为**真正挂起 + 翻转 active 给苏联**（非简化版）。

**关键决策（范式 B：让权翻转让权）**：
- 新增 `maybe_arm_su_augstorm(game, space, kind, attackerNation)`：在 `arm_after_battle_status()`（do_battle 出口）**末尾并列**接入，与既有的 `arm_status_instant` / `offer_armed_effects` 互不冲突。
- 前置自检四条件，任一条不满足即 `return` 不挂起：① `kind==='land'`；② `data.name_of(space)==='中国东北'`；③ 发起方是**同盟且非苏联本国**（`attacker !== '苏联' && faction_of_nation(attacker)===faction_of_nation('苏联')`）；④ 苏联手牌**同时**持有 17900 与至少 1 张 `[建设陆军]`（代价）。
- 翻转 active：新增 `set_pending_armed_delegate(game, pd)` —— 把 `game.active` 翻到被让权方阵营角色（同盟→`ALLIES_ROLE`），并**先把原 active 存进 `armed_delegate_return_active`** 再翻；清除时还原。
- 清除点统一：改写 `clear_armed_offer`，在清 `armed_offer` 时**一并清 `pending_armed_delegate` 并还原 active**（翻转/还原成对，避免顶栏卡在错误阵营）。

**两步结算的 armed run（参考 15325 的 useNewPiece）**：
- 第 1 步：`recruit_piece('苏联','army',中国东北)` 征召 1 支苏陆军；新棋子 id 暂存进 `armed_offer.arg.newPiece`（**落 state，跨 action 不可用局部变量**）；返回 `need:'space'` + 候选=与中国东北相邻、且有敌方占领的陆地（用 `get_connections` + `pieces_on` 过滤）。
- 第 2 步（玩家点选目标后）：`do_battle('苏联', target, null, 'land', {from: newPiece})` 用新苏军发起陆战。弃 1 张 `[建设陆军]` 由 `use_armed_offer` 既有 `cost.discard+filter:'build'` 自动扣。

**`build_actions` 守卫**（放通用 `armed_offer` 守卫**之前**）：`pending_armed_delegate` 存在时只放行 `use_armed_offer` / `skip_armed_offer`，其余全拦（真正挂起语义）；`block_reason` 写明。视图暴露 `pending_armed_delegate`。

**客户端**：`can_act_in_turn` 与 `on_click_hand_card` 的挂起判断加入 `!view.pending_armed_delegate`（避免"点了没反应"）。多步选点 UI 复用既有 `armed_offer.pending` 渲染，无需新增。

**与 15346 自由法国的区别（用户问过）**：
| | 15346 自由法国 | 17900 八月风暴 |
|---|---|---|
| 卡类型/位置 | STATUS 留场 | ECHO 增强卡（苏联手牌） |
| 触发（行动方） | 英/美/苏 发起**任意**战斗 | 中国东北 被**同盟(非苏)** 攻击 |
| 区域限制 | 无 | 仅中国东北 |
| 真正发起方 | 法国（卡主，同盟代打，`status_instant` 非阻断窗口） | 苏联（让权 delegated，真挂起翻转 active） |
| 代价 | 无（卡已在场） | 弃 1 张 `[建设陆军]` |

**验证**：临时诊断脚本（直接调内部 `maybe_arm_su_augstorm`，跑完删除）12/0 覆盖触发/反例/两步结算——确认美国打中国东北→让权苏联→征召→选蒙古→肃清敌占全链路通过；新征召苏军若不处补给则 `do_battle` 优雅跳过（正确行为）。回归：苏联 STATUS 34/0、德国 STATUS 21/0 无回归。

**配套 skill**：本次沉淀为 `rtt-pending-suspend`（用户级 skill），含范式 A/B/C、现有挂起机制清单、跨 action 铁律、10 条检查清单与 `references/patterns.md` 真实代码模板；与 `rtt-pending-whitelist-deadlock` 互补。

---

### 2026-10-07 · 【实现】苏联增强卡 EFFECT（第一批：17807 / 17814 / 17900）

**苏联代价体系** = 「弃置 1 张[建设陆军]」= `cost: { discard: 1, filter: 'build' }`。
该 filter 早已存在（苏联国家技能在用），**不要**套用德国「损耗」或日本「弃 1 张[响应卡]」。

**增强卡(ECHO)与状态卡(STATUS)共用同一个 after_battle 派发点**：
`arm_after_battle_status()`（rules.js:3597）已武装 `after_land`/`after_naval`/`after_ally_battle`，
且**已泛化到苏联**（17842 喀秋莎 / 17848 正面攻击 在用）。
德国 **15253 闪电战** = `after_land` + 战斗地区 `build_piece` —— 正是 17814 的效果，直接复用其 run 体。
本次只在该函数末尾补一行 `offer_armed_effects(game,'after_battle',{space,kind,attacker})`；
`piece_removed` 同理补在战斗移除处（与响应卡 `request_responses('piece_removed')` 同一处）。**不另造机制**。

**ECHO 的 pending 不落状态**（重要）：`resolve_event_card` 返回 `pending` 时 ECHO 分支只
`game.log.push` 后 return，**不写 pending_effect / pending_script**。客户端必须把玩家的选择
放进 **play_card 的 arg** 重发（arg 是 `resolve_event_card` 第 4 参），不是调 `resolve_effect`。
（我一开始用 `resolve_effect` / `resolve_echo` 都报「未知行動」。）

**第一批成果**：
| 卡 | 形态 | 复用来源 |
|---|---|---|
| 17807 里海舰队 | `self`+`phase:'scoring'`+`steps:[{op:'recruit'}]` | 日本 15413 诸岛要塞同款；候选=里海陆地相邻（已核实：中亚、中东） |
| 17814 进击的朱可夫 | `armed`+`when:'after_battle'` | 德国 15253 闪电战的 `build_piece` 原子 + `ready` 预检 |
| 17900 八月风暴 | `armed`+`when:'after_battle'` | `recruit_piece` + `do_battle`（以新征召部队发起陆战） |

**验证**：`out/_verify_su_effects.js` 5/0（17807）。17814/17900 仅确认配置加载，尚未写交互级用例。
回归：响应 31/0、事件 40/0、日本响应 79/0、基本卡 297/0、状态卡 21/0。

---

### 2026-10-07 · 【实现】苏联增强卡 EFFECT（第二批：17806/17808/17809/17811）

**⚠️ 关键坑：ECHO 多步卡的第一步必须幂等**
ECHO 的 pending【不落状态】，客户端每次把**累积后的整个 arg** 随 `play_card` 重发，
所以 `run()` 会被调用多次。17809 骑兵师第一步"移除场上 1 支苏陆军"若只写
`if (su_army_pieces(game).indexOf(pick) < 0) return 失败`，
第二次进来时该部队已被自己移除 → 误报「所选部队不是场上的苏联陆军」，卡永远打不出去。
**修法**：在 `game` 上记临时槽（如 `game.su_cavalry_step = { piece, fromSpace }`），
比对 `slot.piece !== pick` 才真正执行移除；收尾时清掉。
同类两步卡（17809）必须照此处理。

**⚠️ 候选必须自己补 unit_slot_free**
`can_build_at` **不排除"已有本国部队"的格子** —— 17806 空降部队的候选漏掉这层后，
候选含已驻军的莫斯科，`build_piece` 返回 `ok:true` 却**不真正新增棋子**（静默无效果）。
修法：候选函数里再叠一层 `unit_slot_free(game, nation, type, sp).ok`。

**四张卡**：
| 卡 | 时点 | 复用 |
|---|---|---|
| 17806 空降部队 | `after_deploy_air`（德国 15205 / 日本 15406 已在用的现有时点） | `build_piece`；候选=空军相邻的空闲可建陆地 |
| 17808 莫斯科战役 | `piece_removed`（本次新建，挂在战斗移除处） | `eliminate_piece`；`ready` 要求"场上已无苏陆军" |
| 17809 骑兵师 | `turn_start` | 两步：选己方苏陆军移除 → 选地建设（幂等槽） |
| 17811 雅科夫列夫设计局 | `piece_removed` | `build_piece(air)`；候选用 `air_host_check` 保证空军有载体 |

**验证**：`out/_verify_su_effects2.js` 31/0（含 ready 正/反例、两步幂等、候选正确性）。
回归：第一批 5/0、响应 31/0、事件 40/0、日本响应 79/0、基本卡 297/0、状态卡 21/0。

---

### 2026-10-07 · 【实现】17815 Z计划（中国二选一：部署空军 / 夺取制空权）

- `actor: '中国'`（卡属苏联卡组持有、效果作用于中国；与 15307《自由法国海军》actor='法国' 同款先例）。
- **二选一用框架现成的顶层 `choice` 字段**：`choice: [[], []]` 只是为了让 `event_card_needs`
  先回 `need:'choice'`；真实效果走 `run`，靠 `arg.choice`（0/1）区分分支，再各自 `need:'space'` 要目标。
- 夺取制空权直接复用原子 `seize_air(game, nation, space, air_piece)`（rules.js:10344）。
- **地区名必须核实**：`重庆` **不存在**（我凭印象写的，候选恒空导致"安全跳过"假绿）。
  中国实际只有三个地区：中国西部(19)、中国东北(21)、**中国东部(22，唯一的补给点)**。
  写测试前先跑探针脚本列出真实地区名与 supply 标记，别凭印象写。

**验证**：`out/_verify_su_effects3.js` 13/0（含两分支各 4 项：need=space / 候选 / 完成 / 结果断言）。

---

### 2026-10-07 · 【实现】苏联 RESPONSE 9 张（17830–17837 + 17902）复用英/日响应框架

**框架要点（复用前必读）**：
- 配置在 `RESPONSE_EFFECTS`（卡 id → `{ actor, trigger:{on,filter} }`），效果实现在 `RESPONSE_EFFECT_IMPL[cardId]`（签名 `(game, side, ctx, choice)`，可返回 `{pending:true,kind,candidates,prompt}` 挂起等玩家选目标）。
- 触发时点 `on` 只有 6 种：`play_card` / `build` / `piece_removed` / `battle` / `play_start` / `after_card_resolved`。
  `fire_trigger` 完全通用（按 `eff.trigger.on` 匹配），**新增卡不需要改 fire_trigger**。
- `CARD_TRIGGERS[id] = {kind, on}` 只是**阅读对齐用的装饰**，逻辑一律以 `RESPONSE_EFFECTS` 为准（曾误以为它是开关）。
- 响应卡**暗置**在 `game.table_responses`；触发后经 `request_responses → trigger_response → (resolve_response_choice) → consume` 进弃牌堆。

**九张映射**：
| 卡 | trigger.on | 效果 |
|---|---|---|
| 17830 保卫祖国 | `play_start`(苏联) | 莫斯科或相邻征召 1 陆军 + 自动消灭莫斯科 1 支敌方陆军（一次 pending 选征召地） |
| 17831 撤退与整编 | `piece_removed`(苏陆军 @乌克兰/莫斯科) | 西伯利亚/中亚 二选一征召 |
| 17832/17833/17835 列宁格勒/莫斯科/斯大林格勒保卫战 | `piece_removed`(苏陆军 @罗斯/莫斯科/乌克兰) | 还原 + 本回合 protect（共用 `su_defense_protect`） |
| 17834 湿季泥沼 | `build`(敌方陆军 @莫斯科或相邻) | 消灭该陆军（逐字复用 15331 写法） |
| 17836 无休止的扩张 | `piece_removed`(苏陆军 @西伯利亚/中亚) | 还原 + protect 覆盖两区（用户选 A：与 15420 同款还原式，非前瞻式） |
| 17837 KV-2 | 新增 `piece_attacked` 钩子 | 见下 |
| 17902 敌后游击队 | `battle`(land，中国发起或被发起) | 中国在战斗地区征召陆军 |

**两处基建改动**：
1. 陆战 ctx 增加 `victimNation`，否则 17902 无法识别「中国**被**发起」（原来只有攻击方 `nation`）。
2. **17837 KV-2 走独立 battle-guard 而非响应队列**：新增 `kv2_response_for()` 判定 + `do_battle` 挂起 +
   `resolve_battle` 的两个阶段分支。
   **【2026-10-07 玩家口径·两阶段】**：
   - 阶段一 `stage='kv2_ask'`：先由【持有方苏联】决定是否发动。等待方由 `pending_wait_nation` 的
     `'kv2_ask'` 分支返回 `pb.kv2_owner_nation` 决定。arg 用 `kv2_trigger: true` 表示发动；
     不发动则卡**留于桌面**（不消耗，与 `pass_response` 语义一致），重放战斗 `kv2_done:true` 照常结算。
   - 阶段二 `stage='kv2'`：发动后就地 `pb.stage='kv2'` 并重新 `set_pending_battle(game, pb)`，
     由 `set_pending_battle` 自动把 `game.active` 让给【攻击方】；攻击方再提交 `arg.kv2 = 'discard'|'protect'`。
     等待方由 `'kv2'` 分支返回 `pb.attacker` 决定（与 guard 的防守方相反）。
   - **切换阶段的正确写法**：直接改 `pb.stage` 后重新 `set_pending_battle(game, pb)` —— 让权是
     `set_pending_battle` 内部按 `pending_wait_nation` 算的，只改 stage 不重新挂起则 `game.active` 不会换人。
   为什么不放进响应框架：响应框架的 choice 只认 `owner_side`（持有方），而卡面写的是「攻击国家选择」，
   硬塞进响应队列会导致"苏联持有、德国却要提交选择"的越权。

**踩坑**：`can_recruit_at` 拒绝**已有任何部队**（含敌方）的地区 —— 所以"征召"类效果的目标地区必须是空的。
写测试时若在目标格预置了部队（哪怕是己方），recruit 会静默失败表现为"陆军没变多"。

**验证**：`out/_verify_su_responses.js` 23 断言全过（含 KV-2 的 protect / discard 两分支）。
回归：`_smoke_jp_response` 79/0、`test_basic_cards` 297/0、`_verify_su_events` 40/0、`_smoke_status` 21/0。

---

### 2026-10-07 · 【排错】armed_offer 劫持动作白名单 → 有未处理 offer 时【任何牌都打不出】（空军力量打不出）

**现象**：出牌阶段打完仗后，进入空军阶段《空军力量》点了毫无反应。

**根因**：`build_actions` 里 armed_offer 分支是**提前 return 一个排他白名单**：
```js
if (game.armed_offer && faction_of_nation(game.armed_offer.nation) === side)
    return { use_armed_offer: 1, skip_armed_offer: 1, log: 1 }   // ← 没有 play_card
```
只要本方有未处理的 `armed_offer`，`play_card` 就不在白名单 → 客户端静默不发。
且玩家无法执行"其它动作"去触发 `clear_armed_offer`（白名单里只有 use/skip），
形成"想清掉它必须先清掉它"的死锁 —— **与 resolve_response_choice 那次同构**。

**为什么现在才暴露**：本轮新增了 `after_battle`（战斗结算后，出牌阶段）与 `piece_removed`
两个 armed 派发点。战斗发生在出牌阶段，offer 挂上后残留到空军阶段即拦截《空军力量》。
旧的 `after_deploy_air` 不会触发，因为它本身就在空军阶段末尾。

**本次修复（B 方案·止血）**：该 return 补上 `play_card: 1`。
（`armed_offer` 本身"错过即失效"，玩家去打别的牌时会自然清掉，故放行是安全的。）

**根本方案（未做，待议）**：
- A：把 use/skip **追加**进正常白名单而非替换，任何新 armed 卡都不会再劫持白名单；
- C：阶段切换时无条件 `clear_armed_offer`，offer 不跨阶段残留。

**教训（重复犯第 3 次了）**：**任何"待玩家表态"的挂起状态，都要回头核对全局动作白名单/守卫**，
否则表现为"界面能点、服务端静默吞掉"。已发生：resolve_response_choice、本次 armed_offer。
新增挂起类机制时请把这一步列为必检项。

---

### 2026-10-07 · 【排错】resolve_response_choice 被全局守卫误挡 → 响应卡选择"点了没反应"死锁

**现象**：响应卡 effect 返回 `pending`（需玩家选目标）后，玩家提交 `resolve_response_choice`，
队列永远清不掉，日志出现「响应结算中：等待【同盟国】是否发动《》」，pending 一直是 true。

**根因**：`exports.action` 顶部的全局守卫（约 13959 行）在 `game.response_queue.length` 非空时，
只放行 `trigger_response` / `pass_response`：
```js
if (game.response_queue && game.response_queue.length &&
    action !== 'trigger_response' && action !== 'pass_response' && ...) { /* 拦截 */ }
```
但 `trigger_response` 结算出 pending 时会**保留队列头**（不消耗卡，等玩家选完再消耗），
于是紧接着的 `resolve_response_choice` 撞上这道守卫被拦截 —— 死锁：想清队列必须先清队列。

**修复**：守卫条件追加 `action !== 'resolve_response_choice'`。
安全性由 `resolve_response_choice` 自身保证（校验 `pending_response_choice` 存在且 `owner_side === side`）。

**受影响面**：所有"需选目标"的响应卡——日本 15433/15434/7903/7905/8600，苏联 17830/17831。
（这些卡此前若走 pending 路径，在真实对局里就是选不动；`_smoke_jp_response` 未覆盖到该时序才一直没暴露。）

**教训**：新增"待玩家表态"类挂起时，务必回头核对**全局动作守卫**的白名单——
挂起期间要提交的动作必须显式放行，否则表现为"界面能点、服务端静默吞掉"。

---

### 2026-10-06 · 【复用】17827 西伯利亚大铁路 复用德国高速公路（15228）管线

**背景**：苏联事件 17827「西伯利亚大铁路」= 收回所有苏联陆军 → 逐一选位重建，与德国 15228「高速公路」机制同构。
最初我平行实现了一套 `su_railroad_resolve` / `pending_su_railroad` / `su_railroad_targets`，与德国那套几乎一模一样——纯冗余。

**复用方案（用户裁定"能复用的先复用"）**：
1. 抽出通用 `railroad_recall(game, who)`（删除 `su_railroad_resolve`）：统计并移除 `who` 全部陆军，写
   `game.pending_autobahn = { remaining, total, actor: who }`。
2. `autobahn_handle`（15228）改为调用 `railroad_recall(game, '德国', timing)`（保留 `play_card` 拦截路径）。
3. `autobahn_resolve` 的建设校验/建设动作由硬编码 `'德国'` 改为 `pa.actor`；
   `autobahn_targets` 查询由 `'德国'` 改为 `game.pending_autobahn.actor`。
4. **关键**：`pending_autobahn` 槽位、`resolve_autobahn` action、`autobahn_targets` 查询、以及所有阶段守卫/客户端渲染
   原本就**以 `pa.actor` 为驱动**——所以 17827 只需在 EVENT 的 `run` 步骤调 `railroad_recall(game, '苏联')`，
   后续选位完全复用德国链路，**零新增基础设施**，并删掉全部 `su_railroad*` 平行代码。
5. 客户端 `update_pending_autobahn_box` 与 `on_reply autobahn_targets` 的标题/兵种文案改为按 `pa.actor` 区分
   （苏联 →《西伯利亚大铁路》，德国 →《高速公路》）。

**取舍点（已与用户确认）**：沿用德国严格 `can_build_at`（需补给）语义，而非原 `su_railroad_resolve` 的"任意陆地无敌方即可"
宽松版。莫斯科等大本营/★补给点本身供补给，邻接即可重建，符合"铁路投送"直觉。

**验证**：`out/_verify_su_events.js`（40 断言全过）覆盖 13 张苏联 EVENT；`tools/_verify_15228.js` / `_verify_autobahn2.js` 确认德国无回归。

---

### 2026-10-06 · 【排错】区域泛称必须用 space_ids_expand，不是 space_ids_of

**坑**：`space_ids_of(['中国'])` 内部走 `space_id_of('中国')` → `PLACE_ALIAS['中国']`(无) → `data.id_of('中国')`(null，因为"中国"是
REGION_GROUPS 区域组，不是单个地区) → 返回 `[]`。导致：
- 17829 毛泽东 的 `marker`/`eliminate` 步骤 `spaces: space_ids_of(['中国'])` 拿空数组 → 标记落到 `undefined`、消灭找不到目标；
- 17828 百团大战 的 `recruit` 与 `battle` 目标函数同样失效。

**正确做法**：区域泛称（中国/太平洋/非洲）必须用 `space_ids_expand(['中国'])`（展开成该区域全部格位 id）。
`space_ids_of` 只用于【一对一】别名或本体名（如 `space_ids_of(['巴尔干'])`）。

**触发信号**：`event_card_needs` 对空候选的步骤返回 `null`（看似"无需选择"却实际漏打），且 `g.markers` 出现 key `"undefined"`。
**排查同类**：全局搜 `space_ids_of\(\['(中国|太平洋|非洲)'\]\)`，全部改为 `space_ids_expand`。

---

### 2026-10-06 · 【重构】日本增强卡 4 张二次改造（15411 / 15412 / 7900 / 15410）

在「10 张 EFFECT 基础实现」之后，按玩家口径对 4 张做二次改造（**把"自动结算"改成"玩家分步交互 + 挂起"**）。
`tools/_smoke_jp_effect.js` 由此扩到 **113/113**。

| 卡 | 改造前 | 改造后 |
|---|---|---|
| **15411 夜间运输** | 时机=anytime，服务端自动挑第一支日本陆/海军 | 时机=**补给阶段开始时**（`CARD_TRIGGERS.phase:'supply'`），目标=**选 1 支无补给单位**（`pickUnit.supplied:false`） |
| **15412 御前会议** | 两步（先选弃牌、再选打出） | 复用日本国家技能**一步式**（`event_card_needs` 未指定 play 时返回 `need:'one_step_pick'`） |
| **7900 竭泽而渔** | 自行 `run` 结算 | 复用德国**多步脚本机** `SCRIPT_CARD_KIND['7900']='discard_pay_pick'`，候选源从牌堆改为**弃牌堆** |
| **15410 武士道** | `offer_armed_effects` 弹可选窗口，但 `do_battle` 同步结算 → 保护永远来不及 | `armed.suspend:true` + `do_battle` 内 `pending_battle(stage:'guard')` 挂起战斗，新增 `guard_card_candidates` 筛保护卡 |

#### 本轮踩的 6 个真坑（测试才暴露）

| # | 坑 | 说明 |
|---|---|---|
| 1 | **日本本土只邻接<东海>(sea)** | 想用"日本本土"当陆战发起/受击地，结果陆战发起不了（陆战只能打 land）。→ 测试造局改放**中国东北(受击)/中国东部(攻击)** |
| 2 | **美/苏开局中立** | 测试里想让日本打美国/苏联地区，`do_battle` 直接拒战（"该国处于中立"）。→ 造局必须 `g.neutral['美国']=false`（要打谁就清谁的中立） |
| 3 | **脚本取牌参数名是 `pick` 不是 `picks`** | `script_resolve` 的取牌参数误用 `picks` 一直无效；与德国卡（`script_raw_candidates`/`script_resolve`）同款用 `pick` |
| 4 | **弃牌堆"空"≠跳过取牌阶段** | 误判"刚把 4 张弃掉、弃牌堆这回合没别的牌就算空"。实际**刚弃的 4 张立刻成为候选**（先弃后进）；断言要查 `candidates 含刚弃掉的 h1#1` |
| 5 | **`resolve_battle` 的 role 决定阵营** | 日本属 **Axis**，防守表态必须传 `rules.action(g, 'Axis', 'resolve_battle', arg)`，传 `'Allies'` 会权限/阵营错乱 |
| 6 | **`resolve_battle` 不要导出 `_internal`** | 曾想把 `resolve_battle` 加进 `_internal` 导出，后又撤回；测试一律用 `rules.action(g, role, 'resolve_battle', arg)` 包装，保持与客户端同一条派发路径 |

#### 抽出的复用原子（已进 `_internal`）
- `event_card_needs(g, c)` —— 返回 `need:'one_step_pick'|'piece'|'script'`，驱动客户端走哪套交互
- `discard_and_facedown` / `jp_facedown_play` —— 15412 与日本国家技能共用
- `guard_card_candidates(g, victim, attacker, space, kind)` —— 15410 挂起时筛可打保护卡（带 `cost`/`cost_filter`）；付不起代价则候选为空（不弹框）
- `pick_unit_candidates` —— 15411 的无补给单位筛选
- `SCRIPT_CARD_KIND` / `script_start` / `script_resolve` / `script_step_kind` / `script_raw_candidates` —— 7900 走 15229/15239 同款脚本机

#### 多步脚本机的三不变量（7900 复用，别破）
1. 卡打出即入弃牌堆（不留在手里）；
2. 服务端不替玩家选（只出候选、等 `resolve_script`）；
3. 仅**应答国**可 `resolve_script`。

---

### 2026-10-06 · 【新功能】日本增强卡（EFFECT）10 张 + 代价类型过滤（cost.filter）

**范围**：15405 / 15406 / 15407 / 15408 / 15409 / 15410 / 15411 / 15412 / 15413 / 7900

**与德国增强卡的差异（本轮新增支持，别套用德国口径）**：
- 德国代价多为「**损耗** N 张牌」= `cost: { attrition: N }`
- 日本代价多为「**弃置 1 张【响应卡】**」= `cost: { discard: 1, filter: 'response' }`

为此本轮新增两处支持：
1. **EFFECT 卡的 `cost.discard` 支持 `filter`**（服务端校验 + 客户端过滤候选）。
   原先只按数量 `hand.slice(0, cost)` 自动取前 N 张，**不看牌类型**，
   日本的"弃 1 张响应卡"会被任意牌蒙混过关。
2. **装载卡 `use_armed_offer` 支持 `discard` 代价**（含 filter）。
   原先【只处理 attrition】—— 日本装载卡的弃牌代价会被**整个跳过**
   （表现为"卡能打但没付代价"）。

**抽出的复用原子**：`facedown_response(game, nation, card_id, from)`
—— 此前 `play_card` 响应分支、7904 亡命之计、日本技能三处各写一遍
push `table_responses`，已统一。

#### 本轮踩的 3 个真 bug（都是参数/语义误用）

| # | 问题 | 说明 |
|---|---|---|
| 1 | **`can_build_at` 与 `build_piece` 参数顺序不同** | `can_build_at(game, nation, space, type)` 但 `build_piece(game, nation, type, space)`。我写成 `can_build_at(game,'日本','navy',sp)` —— space/type 反了 |
| 2 | **`eliminate_piece` 排除空军** | 它的 enemies 过滤含 `game.piece_type[p] !== 'air'`，**无法消灭敌机**。15407 秋水要消灭敌方空军 -> 必须改用 `seize_air` 原子 |
| 3 | **`seize_air` 要求发起空军与目标【相邻】且【补给中】** | 同格不算（格位不是自己的邻居）。15407 的敌机必须放在日本空军的**相邻地区**，不是同一格 |

👉 通用教训：**调用任何原子前先确认签名与过滤条件**，
   尤其"消灭/移除"类原子常对兵种有隐含过滤（见 `rtt-atomic-operations`）。

**回归**：新增 `tools/_smoke_jp_effect.js` 61/61 ——
覆盖 10 张登记、cost.filter 声明、15409 计分、15407 消灭敌机、
15412 暗置、7900 弃牌堆取回、15411 补给授予、armed 配置、
steps 候选（含"15408 候选必须全是海域"）。

---

### 2026-10-05 · 【卡面纠错】7903 菊水特攻：我照 CSV 录错成"征召陆军"，玩家核对卡面确认是"征召海军"

**玩家核对后给出的正确卡面**：
> 出牌阶段开始时：在<东海>征召【海军】。以【此海军】发起 1 次海战。

**我原来的实现（错）**：`recruit_piece(..., 'army', 东海)` + 对<南海>海战。
当时我还在注释里怀疑"地区名录错（<东海>是海域，无法征召陆军）"。

**真相**：地区名【没错】—— <东海>本就是海域，征召**海军**正合适。
是我把**兵种**搞错了（`army` 应为 `navy`），却误判成地区名问题。

👉 教训：**"征召/建设 X 失败"时，先怀疑【兵种与地形不匹配】，别急着改地区名。**
   地形-兵种对应：陆军→land，海军/空军→各自规则；海域只能征召/建设海军。

**第二处修正**：卡面是"**以此海军**发起 1 次海战" —— 即发起单位必须是
【刚征召的那支】海军，海战目标由玩家从相邻海域中选（不是写死<南海>）。

**由此扩展了响应卡的 pending 机制**：挂起期间需要记住自定义数据
（新征召的海军 id），故：
- `pending_response_choice` 增加 `extra` 字段（effect 返回 `r.extra` 时保存）；
- `resolve_response_choice` 调 effect 时**多传第 5 个参数** `extra`，
  供第二次调用拿到挂起前的状态。
> 通用模式：**"先做事 -> 挂起 -> 用刚才的结果继续"** 这类两段式效果，
> effect 签名统一为 `(game, side, ctx, choice, extra)`。

**⚠ 附带发现的真坑（测试才暴露）**：
`recruit_piece` 成功 **≠** 新单位处于补给状态。
7903 第一次跑时海战被拒："发起单位不处于补给状态"。
- 征召的条件与"发起战斗所需的补给"**不是同一套**；
- 海军补给要求：①邻接处于补给状态的本国部队 ②邻接本国或友军陆地部队。
=> 写这类"征召后立即用它开战"的测试，**必须显式摆出补给环境**
   （补给点 + 相邻本国陆地部队 + `compute_supply`），否则测不到主逻辑。

**回归**：`tools/_smoke_jp_response.js` 79/79。
7903 用例锁死：征召的是 `navy`（不是 army）、落在<东海>、归属日本、
返回 pending 且 `extra.navy` 有值、带 choice 结算时描述含"新征召海军"。

---

### 2026-10-03 · 【玩家口径】peek 弹窗（摊牌给人看）**一律不可取消**

**玩家口径演进（两次，别只记最终态）**：
1. "因为双十字系统会看到别人的牌，因此使用双十字系统弹出的弹窗，应该不能点取消。"
2. "15215 也不应该能取消。" ← 关键补充

**最终口径**：**任何 peek 弹窗都不可取消**。因为"摊牌"本身就是信息：
- 双十字系统 15305 -> 看到**对手**秘密手牌；
- 卓越规划 15215 -> 看到**自己**牌堆顶 5 张（知道接下来会摸什么，同样能规划后续）。

👉 教训：判断"取消是否有害"要看**是否获取了信息**，而不是**看的是谁的牌**。
我第一版只禁了"看对手"，把 15215 漏了 —— 玩家补一句就纠正了。

**⚠ 最关键的技术事实（测试验证，极易搞错）**：
> **15305 双十字走的是 `query` 路径**（`event_card_needs` 返回 `need:'peek_reorder'`），
> **query 是只读 RPC，服务端【根本不建立 `game.peek`】**；
> 弹框完全由客户端用 `pending_peek_for_card` / `peek_cards` / `peek_target` 本地渲染。

所以：
- **真正拦截取消的是【客户端】**（判据是被看方 ≠ `view.my_nation`）；
- 服务端 `clear_peek` 的守卫只是**兜底**（防直接发 action / 旧客户端 / 脚本绕过）。
- **若只改服务端，双十字依然能取消** —— 我最初就是这么想的，被测试打脸。

**实现**：
- 服务端 `clear_peek` 一律拒绝 + 提示；`submit_peek` 等正常路径不变。
- 客户端：关闭「×」与「取消」**直接从 play.html 移除**（不是隐藏）；
  `cancel_peek()` 只弹提示（防旧缓存页面调用）。
- 曾短暂引入 `game.peek.opponent` / `view.peek.opponent` 字段，**口径统一后已删除**——
  留着只会诱导后来者又去写"对手 vs 自己"的分支。

**回归**：`tools/_smoke_peek_nocancel.js` 24/24。
含：query 返回 target=对手且未写 `game.peek`、两种 peek 的 `clear_peek` 均被拒、
完整流程走真实 `play_card`（牌堆顶顺序正确 + 卡离手进弃牌堆）、无 peek 时安全返回。

---

### 2026-10-03 · 【新功能】英国国家技能：抽牌后弃 3 手牌，额外打出 1 张事件/状态卡

**玩家口径**："英国抽牌后，可以自选弃 3 手牌，打出手牌中的 1 事件牌或状态牌。"

**配置**（`NATIONAL_SKILL`）：
```js
'英国': { trigger: 'draw', cost: { discard: 3 }, grant: { filter: 'event_status' } }
```
与德国（`star_resolved` / `attrition:1` / `status`）并列，各国按 `trigger` 各走各的触发点。

**⚠ 两个代价语义千万别混**：
- `attrition: N` = **损耗**：抽牌堆顶 N 张直接进弃牌堆，**无选择**；
- `discard: N`  = **弃置**：玩家从**自己的手牌**里**挑** N 张丢掉（需要 UI 选牌）。

**实现要点**：
- 抽象出统一开窗入口 `maybe_offer_national_skill(game, nation, trigger)`，
  挂在各国自己的触发时机上（德国 `after_card_resolved`；英国 `phase_draw` 摸牌补到 7 张后）。
- `use_national_skill(game, nation, drop)` 支持 `drop` 参数，并**服务端再校验一遍**
  drop 的数量与归属（防伪造）。
- 弃牌 UI 复用**资源再分配**同款弹框（card-grid + 序号 badge + 选满才亮确认），
  且**手牌区也能点选**（共用 `.sel` 高亮）。
- 可用性加约束：弃 3 张后若手上已无可打的牌（手牌 ≤ 3），**不给窗口**，
  避免玩家付了代价却没牌可打。

**本次踩的 3 个真 bug（按顺序，第 3 个最隐蔽）**：
1. **我误用了不存在的 `card_type_of()`** -> 直接 `ReferenceError` 崩溃。
   正确写法是 `is_card_type(实例id, 'STATUS')`。
2. **`extra_play_allows` 没有 `event_status` 分支** -> 落到末尾 `return true`，
   结果**任何手牌**都能额外打出（与卡面口径不符）。
   *教训*：新增 filter 枚举时，务必确认所有分支都被显式处理，
   别指望"默认放行"兜底 —— 安全方向应当是**默认拒绝**。
3. **`grant_extra_play` 把生效阶段硬编码成 `phase:'play'`，而 draw 是回合【最后】阶段**
   -> 技能在摸牌阶段授予，但本回合已无 play 阶段可打，下回合 `turn` 校验又失效，
   等于**永远用不了**。
   修法：`grant_extra_play` 支持 `opt.phase`（英国传当前阶段 `draw`），
   并让 `check_phase_for_card` 在非出牌阶段也放行 extra 通道（靠 `extra_play_allows` 把关）。

👉 **第 3 个教训最值钱**："获得了额外打出权"不等于"真的能打出"。
测通过 ≠ 功能可用，必须**端到端走一遍真实 `play_card`**，
我当时就是只测到 `extra_play` 存在就以为完成了。

**回归**：新增 `tools/_smoke_uk_skill.js` 38/38。

---

### 2026-10-02 · 【一类问题 · 归因纠错】15321 低地国家自由军：发起单位无法选择、也不高亮

**玩家的真实问题**："实际问题是发起单位（initiator）无法选择，也不高亮。"
（我此前一直在讲海战地形/空打/总体战，**偏离了问题**，被明确指出后才聚焦。）

**根因：`event_battle_targets` 与 `step_space_candidates` 是两套独立实现，漂移了**
```js
const st = eff && (eff.steps || []).find(s => s.op === 'battle')   // ← ❶ 恒为 undefined
...
if (!hasAgainst) continue                                          // ← ❷ 强制要求敌军
...
if (st && typeof st.spacesFn === 'function') { ... }               // ← ❶ 导致永不执行
```
- **❶** 15321 是 `choice` 型卡，steps 存在 `eff.choice[1]` 里，**没有 `eff.steps` 字段** ->
  `(undefined || []).find()` -> `st` = **undefined** -> `st.spaces`（=[西欧]）**从未生效**，
  候选退化成"全图所有有敌军的陆地"（所以玩家看到北海高亮却点不动）。
- **❷** 强制要求目标格有敌军，**把"空地空打"也排除了**（与 2026-09-22 已确立的空打规则冲突）。
- 且不提供发起单位候选 -> 玩家无法选由谁发起。

**修复（统一到单一原子）**：
1. `event_battle_targets` 改为**直接复用 `step_space_candidates`**（支持 `st.spaces` +
   `spacesFn` + 空打），彻底消除双实现；
2. budget 记录 `choice`，供 choice 型卡定位正确分支；
3. `event_battle` 动作支持 `arg.from`，并用 `battle_initiators` **校验**（防任意指定）；
4. `view.event_budget` 新增 `initiators`（每个候选目标对应的可发起单位）；
5. 客户端：1 个候选直接用；多个候选**高亮算子**让玩家点选，含"取消"。

**我之前归因为什么有误（值得记住）**：
1. **抓错了卡和模型** —— 我把问题归到德国**增强卡**（15205/15210/15212）的"手写遍历"，
   但 15321 是法国**事件卡**，走**战斗预算模型**，压根不调用我改的那几个函数，
   所以我那通"最小原子重构"**对它完全无效**，玩家重启后问题依旧。
2. **把"两套实现漂移"当成根因，却没定位到具体缺失点**
   （真正缺的是 `st.spaces` 静态分支 + choice 型卡的 steps 解析）。
3. **一直没正面回答玩家的问题** —— 玩家问的是"发起单位"，我答的是"海战地形"。
   *教训*：玩家重复纠正时，先**停下来重读他的原话**，别在自己已有的思路上继续推进。

**回归**：`tools/_smoke_german_effect.js` 94/0 等全绿。
另附带确认：扫描全部 `op:'battle'` 配置后，只有这一处漏了 `st.spaces`
（其余卡靠 `spacesFn` 或玩家选点，不受影响）。

---

### 2026-10-01 · 【重构】发起战斗必须复用最小原子 `battle_initiators`，不要自己重写遍历

**玩家指出**："发起海战和其余增强，都应该尽量用的是最小原子操作实现。这里应该用能否发起海战的最小原子实现，复用。现在的判断逻辑不对。"

**此前的问题**：15205 / 15210 / 15212 各自手写
`get_connections + compute_supply + do_battle` 的遍历，三处重复且**都有 bug**：
1. `de_adj_navy_in_supply` 把阵营**硬编码成 `'axis'`**（`get_connections(game, space, 'axis')`），
   一旦给别国用就错；
2. `de_sea_battle_target` 从**发起单位（海军）所在格**出发找邻居，
   而 `do_battle` 是从**目标格**出发校验发起单位是否相邻 —— **方向相反**。
   `connections` 不对称时就会出现"找到了目标、do_battle 却说发起单位不相邻"
   —— 这正是此前 G7e 海战一直打不出来的真正根因；
3. 漏掉 `basic_targets` 的两条口径：**目标格不能有我方单位**、**空军不算攻击目标**。

**正确做法**：`battle_initiators(game, nation, space)` 本身就是那个最小原子
（= 目标格邻居 ∩ 补给中 ∩ 陆军/海军）。它与 `basic_targets` 战斗分支、
`do_battle` 的发起校验**同源**，所以"原子说能打"必然"`do_battle` 也接受"。

新增两个薄封装（都建立在 `battle_initiators` 之上，**不重写遍历**）：
```js
can_initiate_battle_at(game, nation, space, kind)   // 单格判定 -> {ok, initiator}
find_battle_target(game, nation, kind, opts)        // 找第一个目标
                                                    //   opts.near      限定在某格相邻（15210 亚速尔）
                                                    //   opts.enemyOnly 只考虑有可攻击敌军的格位
```
`ready`(要不要弹 ask 框) 与 `run`(真正执行) **必须共用 `find_battle_target`**，
保证"弹得出框" == "点了真能打"。

**已删除**：`de_sea_battle_target`、`de_adj_navy_in_supply`（后者已无调用点，
且把阵营硬编码 axis）。`de_adj_army_in_supply` 改为复用 `battle_initiators` 后保留
（状态卡 2072/2095 仍在用）。

**踩坑教训（通用）**：
- 判断"能不能打"时，**遍历方向必须与最终执行方的校验一致**。
  本例 `do_battle` 以【目标格】为中心，任何以【发起单位格】为中心的预检
  在不对称邻接数据下都会漂移。
- 阵营一律用 `faction_of_nation(nation)`，绝不写死 `'axis'`。
- 新增"能不能"判定前，先搜有没有现成原子（本例 `battle_initiators` 早已有之，
  且 `basic_targets` 就是权威口径）。

**回归**：`tools/_smoke_german_effect.js` 第 17 项【锁死】原子与 `basic_targets` 一致：
① 两者对同一格判定相同；② `battle_initiators` 给出相邻补给陆军；
③ 原子选出的目标+发起单位，`do_battle` 必须接受；④ 本国单位所在格不能作为目标。
94 项全过。

### 2026-10-01 · 【一类问题】客户端"增强卡永远可打"兜底 -> 云雾不置灰 + G7e 弹窗点了没反应

**玩家报告**："打出牌后，应该暗置的云雾没有暗" + "弹出 G7e 可打的弹窗，点击打出没有实际打出"，并判断"看起来是一类问题"——判断正确，两者同根。

**根因**：客户端 `check_phase_for_card` 末尾有一句兜底
```js
/* 兜底：没有时点声明的增强卡仍随时可打（旧行为） */
if (is_enhance_card(c)) return { ok: true }
```
服务端早已改成**按时点**判定（`trigger_ready`），于是所有 EFFECT 卡在客户端**永远不置灰**：
- 15213《云雾》（A 组 play_start）：出牌阶段开始后可打；一旦打过牌（`play_done`）
  服务端就拒绝，客户端却仍判 ok -> **该灰不灰**（玩家看到的"云雾没有暗"）；
- 15212《G7e 鱼雷》（B 组 load）：客户端判可打 -> 点了被服务端拒绝。

**根治做法（不再让客户端自己猜）**：服务端新增 `view.hand_ready`，
对**本方手牌每一张**直接下发 `{ ok, reason }`，客户端置灰与点击判定都照抄它：
```js
r = check_phase_for_card(game, n, face, {})   // ← 只调这一个！
```
客户端：
```js
const hr = view.hand_ready && view.hand_ready[c.id]
if (view.turn_phase !== "discard" && (hr ? !hr.ok : !check_phase_for_card(c).ok))
    d.classList.add("disabled")
```
点击判定 `on_click_hand_card` 同样改用 `hand_ready`（否则仍会"彩色可点、点了被拒"）。

**⚠ 踩坑（差点把正常出牌全废掉）**：最初在 `hand_ready` 里**又单独调了一次**
`trigger_ready()`，结果 BASIC / ECON / STATUS 卡因为没有 `CARD_TRIGGERS` 条目
被判"未声明时点" -> 全部置灰、整局没法出牌。
**`check_phase_for_card` 内部对 `c.type === 'EFFECT'` 已经会走 `trigger_ready`**（约 7759 行），
与 `play_card`（约 11900 行）完全同源，**不要再补一次**。
`trigger_ready` 只适用于 EFFECT 卡，对其它类型是未定义行为。

**附带修的（G7e"点了没实际打出"的第二成因）**：
- 给 armed 配置加**纯函数** `ready(game, ctx)` 预检（15212 用新的
  `de_sea_battle_target(game,'德国')`，ready 与 run 共用，保证"弹得出框"=="点了真能打"）。
  没把握就**不弹框**（同国家技能"没得选就不给按钮"）。
  否则玩家点了会走 run 的 `skip` 分支 -> 卡留手牌、什么都没发生。
- 客户端 `check_phase_for_card` 补 `tr.kind === 'load'` 分支（不能主动打出），
  与服务端 `trigger_ready` 的 load 分支同源。

**顺带确认**：`send_action` 会检查 `view.actions[verb]`（common/client.js:1009），
不在册则**静默 return false**（点了毫无反应）——所以任何新 action
都必须在 `build_actions` 登记（pitfalls #18）。本例 `use_armed_offer`
已登记，服务端侧验证 `view.actions = {use_armed_offer:1, skip_armed_offer:1, log:1}` 正常。

**回归**：89/0、status 21/0、basic 297/0。
验证要点：`hand_ready` 对 BASIC/ECON/STATUS 在出牌阶段开始为 ok、
`play_done` 后为 false；云雾 `play_done` 后为 false；G7e 恒 false。

### 2026-10-01 · 【玩家最终口径】德国增强 B 组"打出XX后…"卡 = **留在手牌** + 事件后弹【可选 ask 框】

**玩家原话**：
> "应该是打出潜艇行动经济战后，g7 在手牌，弹出可打出的 ask 框。
>  如果英国响应拦截了经济战，那此时 g7 应该在英国拦截后弹出 ask，照常此时可以选择打出。"

**演进（两次改错，值得记住）**：
1. v1（错）"装载 → 事件到了**自动**结算"：玩家不能选、不能放弃。
2. v2（错）"装载 + 事件瞬间进 `status_instant` 手动点"：载体仍错（卡离手了），
   且**拦截路径永远不触发**（拦截发生在 ECON 生效前，ECON 分支根本不跑）。
3. **v3（最终）**：卡**留在手牌**，事件后扫手牌写 `game.armed_offer`，客户端弹 ask 框。

👉 教训：**"XX 后…"型卡的载体必须是手牌**，不要发明"装载区"；且必须先问清
"XX 被拦截/无效时还算不算打出过"（本次玩家裁定：算，照常给机会）。

**状态与动作**：
- `game.armed_offer = { nation, when, cards:[{card_id,name,desc,cost}], ctx }`
- 动作 `use_armed_offer{card}` / `skip_armed_offer`
- **清除**：`exports.action` 顶部，除这两个外一律 `clear_armed_offer`（错过即失效）
- ⚠ **白名单**：`build_actions` 必须登记，否则客户端**静默不发**（pitfalls #18）

**开窗时机（3 条路径全覆盖，这是 v2 漏掉的）**：
1. **无拦截**：ECON 单目标分支末尾（`econ_used`，约 11514 行）
2. **放弃拦截**：`pass_response` → 重放 `play_card` → 回到路径 1
3. **拦截成功**：`trigger_response` 的 cancel 分支（约 10913 行）——ECON 未执行、
   也不重放，**只有这里能覆盖**。tag 从 `econ_config_of(head.intercept_card).tag` 取，
   target 从 `head.resume.arg.target` 取。

**关键实现点**：
- **先 run 再付代价**：run 返回 `skip`（无相邻敌舰等）时不扣牌、不消耗卡，玩家不白亏。
- **付不起代价的卡不进候选**（`can_attrite` 预检），避免"按钮能点但点了被拒"。
- **cond vs run**：`cond` 决定【是否开窗】，`run` 只执行。15206 的"目标必须英国"要写进 `cond`。
- **客户端**：`update_armed_offer_box()` 挂在 `update_national_skill_box()` 之后，
  复用 `render_ask_box`；**优先级最低**——只在 `!ask_state || ask_state.kind==='armed_offer'`
  时才渲染，避免与响应/战斗/经济战/国家技能框争抢 `#ask_box`（pitfalls 既有条目）。
- **主动打出被拦**：`trigger_ready` 的 `load` 分支返回明确原因
  "该卡不能主动打出，仅在对应事件后被询问是否打出"，不要静默失败。

**踩坑**：
- `owner_side` 是**小写**（`'allies'`/`'axis'`），`ALLIES_ROLE` 才是 `'Allies'`。
  手写 `response_queue` 假数据做测试时写错会导致"只有响应卡的持有方才能决定"直接被拦。
- 改测试时删 `{` 容易漏，花括号失衡会 `SyntaxError: Unexpected end of input`；
  可用临时脚本统计花括号深度定位。

**回归**：`tools/_smoke_german_effect.js` helper
`offerThenUse(g, cardId, when, ctx)` / `armedOfferHas(g, cardId)`；
新增断言：① 不能主动打出（留在手牌）；② 事件后进入窗口；③ 未选择前不结算；
④ 打出后才离手+生效；⑤ cond 不满足**不开窗**；⑥ **拦截成功后照常开窗**（15b）。89 项全过。

### 2026-09-30 · `econ_used` 只在【链式】经济战收尾触发 —— 非链式潜艇行动打出后 G7e 鱼雷永远等不到时点

**症状**：15212《G7e 鱼雷》（装载型，声明 `when:'econ_used', tag:'潜艇行动'`）打出后，德国再打 15217《电动潜艇》（[潜艇行动]）却完全不触发：卡一直留在 `armed_effects`、不付代价、不发动海战。只有打 15314《马耳他潜艇群》（链式、需德意依次答复）才会触发。

**根因**：`play_card` 的 ECON 分支有两条路径：
- ① 单目标卡（`cfg.targets`，如 15217~15222）：`cfg.run(...)` → 弃牌 → `mark_play_done` → `request_responses` → `after_card_resolved` → **直接 return**；
- ② 链式卡（`cfg.chain`，如 15314）：建立 `pending_econ`，等答复全部完成后由 `resolve_econ` 收尾，**那里才有** `fire_armed_effects(game,'econ_used',…)`。

即 `econ_used` 钩子**只挂在 ② 的收尾处**，① 完全没有。绝大多数德国潜艇行动卡是 ①，所以 G7e 形同虚设。

**修复**：在 ① 分支 `after_card_resolved` 之后、`return game` 之前补一次
`fire_armed_effects(game, 'econ_used', { tag: cfg.tag, targets: [t], nation: nation })`，
参数与 ② 的收尾处保持一致（tag / targets / nation）。

**教训**：给"事件型"钩子布线时，必须枚举**所有**会产生该事件的调用点，不能只在最显眼/最先写的那条路径上挂。本例中事件名相同（`econ_used`）但触发时机分散在两个互斥分支里。

**回归**：`tools/_smoke_german_effect.js` 新增第 15 项——真实链路：装载 15212 后打 15217，断言 ① 15212 离场（不再装载）② 相邻敌方海军被海战移除。注意该用例必须用**真实 play_card 打出** 15217，不能用 `I.fire_armed_effects(...)` 直接触发（那样绕过了缺失的钩子，测不出此 bug）。

### 2026-10-01 · 【玩家最终裁定·曾改错后又回退】总体战(15216)：**只有敌方陆军**被移除才损耗，空军不掉牌

**过程（值得记住的沟通教训）**：玩家先报"敌我双方空军的移除也都损耗"；我先按字面改成【陆军+空军都触发】并接入 5 处移除路径；随后玩家澄清"我理解错了，回退一下修改，总体战：空军移除不掉牌"。**最终口径回到"仅陆军"**。

👉 教训：当玩家的描述可能有两种断句时（"敌我双方 / 空军的移除 也都损耗" vs "敌我双方空军的 / 移除也都损耗"），**先确认再动手**，别按最字面的一种直接改一堆调用点。本次白改了 5 处接入点 + 6 条断言。

**最终口径**：
- 类型限 **army**（陆军）；空军 / 海军都不触发；
- 仅 **敌方(非轴心)** 生效（`faction_of_nation(nat) !== 'axis'`），不反噬己方/盟友（此项是上一轮修的真 bug，保留）；
- 损耗对象走 `delegate_of_nation`（法国→英国、中国→美国）。

**统一入口**（保留，仍是单一判据源，只是收窄为 army）：`total_war_attrition(game, removed)`，`removed = [{nation, type}, ...]`，内部 `typ !== 'army'` 直接跳过。

**接入点（仅 1 类）**：`do_battle` 里【原目标 victim 被实际移除】的两处——
1. 代受 + 抵消成立分支（`rmvNationC/rmvTypeC`）；
2. 普通路径（`rmvNation/rmvType`）。
代受且**不抵消**分支（只掉空军、原目标保住）**不**接入。

**明确不触发**（回退时已移除钩子，勿再加回）：
- `seize_air` 夺取制空权移除敌机；
- 代受且不抵消（只掉空军）；
- `econ_remove_piece` / `eliminate_piece`（本轮曾误加，已回退；是否在"消灭陆军"时也触发尚未与玩家确认，如要加只加这两处 + 保持 army 限定）；
- 因"不代受"而**撤离**的空军（`retreated_airs`）——撤离不是被移除。

**回归**：`tools/_smoke_german_effect.js` 第 16 项四组——① 夺取制空权移敌机 → 英国不变；② 代受只掉空军 → 英国不变；③ 敌方陆军被移除 → 英国 −1（正例，防回退过头）；④ 己方轴心陆军被移除 → 德国不变。合计 80 项全过。

### 2026-09-30 · 总体战(15216) 的损耗对【己方/盟友】陆军也生效

**症状**：打出《总体战》后，不只是"敌方陆军被移除 → 其代表团国损耗 1"，**德国自己的/轴心盟友的**陆军被移除时德国也跟着损耗 1 张牌（惩罚了自己）。

**根因**：`do_battle` 两处 attrition 钩子只判 `rmvType === 'army'`，没有判阵营，于是"任何一方的陆军被移除"都触发。卡面语义是德国用总体战折磨**敌国**，不该反噬己方。

**修复**：两处条件都加上 `faction_of_nation(rmvNation) !== 'axis'`，只对非轴心（敌方）陆军触发。两处钩子代码同构，改要改全（一处是 `rmvTypeC/rmvNationC`，另一处是 `rmvType/rmvNation`）。

**已核实（不是 bug）**：总体战**不会**因"空军被移除"而触发损耗。三条空军移除路径都无 attrition 钩子：
① `seize_air` 只删敌机；② `do_battle` 里 `defend_air` 代受且不抵消时只删代受空军、原目标部队保住（6593 行注释"原目标部队保住"），不走 attrition 分支；③ `econ_remove_piece`/`eliminate_piece` 的连带 `killedAirs` 只 `delete game.location[air]`，无钩子。实测 `seize_air` 移除敌机后受击方牌数不变。

### 2026-09-30 · `do_battle` 的 kind 参数是 `'land'`/`'sea'`，不是 `'navy'`（海战静默 no-op）

**症状**：德国增强卡 15210（对亚速尔相邻海域法军海军发起海战）、15212（潜艇行动经济战后对敌舰发起海战）的 `run()` 里写 `do_battle(game, '德国', space, 0, 'navy', { from })`，调试时 `do_battle` 返回 `{ok:false, reason:'陆战的目标必须是陆地，而 X 是海域'}`——明明传了海军，却按陆战校验。

**根因**：`do_battle(game, nation, space, target_piece, kind, opt)` 的 `kind` 只认 `'land'` 或 `'sea'`：
```js
kind = kind || 'land'
const wantTerrain = (kind === 'sea') ? 'sea' : 'land'   // 'navy' != 'sea' → 走 land 分支
```
传 `'navy'` 不会报错，只是落回默认的 `land`，导致"海战打陆地"校验失败、海战根本没发动。卡牌留在桌面、敌方海军没被移除，测试表现为"静默 no-op"。

**修复**：所有增强卡内的海战调用改用 `'sea'`：`do_battle(game, ..., space, 0, 'sea', { from })`。陆战保持 `'land'` 不变。

**回归**：`tools/_smoke_german_effect.js` 第 11/14 项（15210 / 15212 海战移除敌舰）由失败转通过。注意 `connections` 数据可能**不对称**——`do_battle` 的发起单位相邻校验用的是**敌舰格位**的邻居（`get_connections(space,'axis').indexOf(fromSpace)`），所以测试里 S/E 必须选**双向相邻**的海域对（S 在 E 的邻居里、E 也在 S 的邻居里），否则即便 `from` 找到也会因发起单位"不相邻"被拒。

### 2026-09-30 · 15329 反潜战术拦截：占出牌名额的时机 + 重放用错 role

**症状**：想实现「敌方经济战被 15329 拦截 → 进弃牌堆 / 占出牌名额 / 拦截即效果无效」。初版把 `mark_play_done` 放在 `play_card` 拦截分支（卡生效前挂起时），结果"放弃发动（pass）"后经济战重放被"每回合 1 张"拦下、效果无法结算。

**根因（两层）**：
1. **占名额时机错**：拦截分支一挂起就 `mark_play_done`，但此时经济战还没真正结算；之后 `pass_response` 重放 `play_card` 会撞上"本回合已打出 1 张"校验被拒（日志："德国 本回合出牌阶段已打出 1 张牌"）。
2. **重放用错 role**：`pass_response` 用调用者的 `current`（= 同盟）去重放「敌方（轴心）打出的经济战」，回合归属校验 `mySide===turnSide` 失败，重放被拒。

**修复**：
- 拦截分支**不再**提前 `mark_play_done`；把占用名额拆成两条：① pass → 重放时由正常 ECON 流程自然 `mark_play_done`；② cancel → 在 `trigger_response` 取消分支显式 `mark_play_done(game, dn)`。
- 拦截队列 entry 记录 `play_role: current`（原打出方 role），`pass_response` 重放改用 `head.play_role || current`，保证重放通过归属校验。
- 取消分支同时把被拦截卡从手牌移到弃牌堆（`intercept_card`/`intercept_nation`），ECON 效果从未执行 → 效果无效。
- 拦截分支的 `resume.arg` 由 `{card}` 改为 `Object.assign({}, arg, {card})`，保留 `target` 等参数，确保 15313 等需参数的经济战重放能正常结算。
- 顺手删掉 `rules.js` 里"此分支暂不会触发"的过时注释——实测 `preC` 能命中 15329。

**回归**：`tools/_smoke_econ.js` 新增两组（敌方 ECON=德国 15217）：① 同盟发动拦截 → 进弃牌堆 + 占名额 + 效果无效；② 同盟放弃 → 15329 留桌面、15217 重放正常结算（英国牌库损耗 3 张）。`tools/_tmp_test_15329.js` 为临时验证脚本（用户要求保留，未删）。

### 2026-09-30 · "X 后立刻"窗口不能跨卡互相触发（activate_status 清空打断嵌套武装）

**症状**：15245/15247/15248/15253/15346 这些原子级"X 后立刻"状态卡，玩家期望能**互相触发**（15247 的嵌套战斗武装 15245、15253 的建设武装 15247…）。但之前各自嵌套动作发出的战斗/建设，都不会再武装新的窗口。

**根因（两层）**：
1. `do_battle` 在 `defend_air` 分支（含空军互相抵消）提前 `return`，没走到 `arm_after_battle_status`；且 15245/15247 的嵌套 `do_battle` 传了 `silent_status:true`，直接跳过窗口武装。（已修：抽出 `arm_after_battle_status` 在全部成功出口调用，并去掉 `silent_status`。）
2. **更关键的**：`activate_status` 动作在跑完效果后执行 `game.status_instant = []`（line 10572），把"本动作内嵌套战斗刚武装的新窗口"也一起清空了。于是即使第 1 层修好，嵌套战斗武装的 15245 也会被这一行抹掉。

**修复**：`activate_status` 跑效果前快照 `beforeKeys = 已武装窗口集合`；跑完后 `status_instant = 仅保留不在 beforeKeys 中的 entry`（即嵌套动作新武装的窗口），本卡自己的窗口被消耗、新窗口留给"下一个动作"。下一次任何其它动作仍会在 `exports.action` 顶部清空，所以新窗口只对本回合下一动作有效（与"X 后立刻"口径一致）。`once_per_turn` 保证每张卡每国家回合只发动一次 → 跨卡链不会无限递归。

**不对称细节（重要）**：`after_land` 在 `do_battle` 内**同步**武装；`after_build_army` 由 `build_actions` 读 `game.last_built` 在 **`view()` 调用时**武装（不是 action 内同步）。因此客户端每次动作后必须 `view()` 才会看到 15247/15248 窗口——测试里发完建设类卡后务必补 `rules.view(g, nation)` 再断言。回归测试见 `tools/_smoke_german_status.js`（含 15247→15245、15253→15247、跨国家回合代理）。

### 2026-09-30 · 空军互相抵消时闪电战(after_land)窗口不出现

**症状**：巴巴罗萨 15226 第二战，防守方用空军代受、发起方用空军抵消（双方各损失 1 支飞机、原目标照常移除）后，客户端不显示允许发动 15253《闪电战》的按钮。

**根因**：`do_battle` 里武装"X 后立刻"状态卡的逻辑（原 `arm_status_instant(game,'after_land',...)` 等）只写在**主成功路径**的 `return` 之前。而 `defend_air != null` 的两个分支（① 抵消成立 ② 代受成立不抵消）都**提前 `return`**，没走到武装那一段，闪电战窗口自然没挂上。抵消分支里原目标其实已经被移除（`delete game.location[victim]`），本应算"发起陆战成功"。

**修复**：把武装逻辑抽成模块级 `arm_after_battle_status(game,nation,kind,space,opt)`，在 `do_battle` 的**三处成功 return 前**都调用（主路径 / 抵消分支 / 代受不抵消分支）。回归测试见 `tools/_smoke_seq.js`「抵消后武装闪电战窗口」。

### 2026-09-30 · 德国状态卡「立刻」窗口（after_land / after_build_army）：手动发动 + 仅事件瞬间

**背景**：德国状态卡已实现（STATUS_EFFECTS 15242–15255 + 6601）。玩家实测：
15253《闪电战》(after_land)、15247/15248(after_build_army) 的"发起陆战后/建设陆军后"
语义是 **【立刻】**，且应为**玩家手动发动**。第一版实现错误地整回合可点；
第二版改成了"自动触发"，但玩家明确要的是 **手动发动、仅事件那一瞬**。

**最终口径（玩家裁定）**：15253/15247/15248 这类"X 后立刻"卡 = **仅能在事件发生的
那一瞬手动点击发动**，不自动触发；玩家一旦去做别的事（出牌/弃牌/推进阶段/再发起战斗…）
窗口即关闭，点不出来了。这正是"巴巴罗萨中可发动、结算后不能发动"的含义。

**实现（rules.js）**：
- 新增 `arm_status_instant(game, window, nation, space)`：在事件瞬间把本国对应的
  after_land / after_build_army 状态卡推入 `game.status_instant`（记录 card_id/nation/
  window/space）。调用点：
  · `do_battle` 末尾（陆战发起且 nation==='德国'）`arm_status_instant(game,'after_land',nation,space)`；
  · `build_actions` 检测到 `game.last_built`（nation==='德国'）时 `arm_status_instant(...,'after_build_army',...)`（随后 `last_built=null`）。
- `status_window_ready` 的 `after_land` / `after_build_army` 分支：**不再**依赖持久到整回合
  的 `game.last_battle` / `game.last_built`，改为仅当 `game.status_instant` 中存在该卡时
  返回 `ok:true`（并带回武装时记录的地区 space）；否则 `ok:false` 写明"仅能在「…立刻」手动发动"。
- 窗口关闭：`exports.action` 顶部加守卫——除 `activate_status` 与 `debug_*` 外的任何动作都
  `game.status_instant = []`，即"做过别的事"窗口即失。
- 手动发动：`activate_status` 分支找到 armed entry 后，把其记录的地区作为 `ctxSpace` 传给
  `run_status_effect`（让 15253/15247 的 `run` 用"事件当时的地区"而非已清空的
  `game.last_built`）；发动成功后 `game.status_instant = []`（消耗窗口）。
- `run_status_effect` 增加 `ctxSpace` 形参，转发进 `tr.run` 的 `ctx.space`。
- 复用到英国卡：**15346《自由法国》(window=after_ally_battle)** 同日改为瞬间窗口——
  `do_battle` 末尾按**同阵营**（`faction_of_nation(nation)==='allies'`）武装 `after_ally_battle`，
  遍历同阵营所有持有国桌面（含法国，由同盟玩家代打），把 15346 推入 `status_instant`；
  `status_window_ready` 的 `after_ally_battle` 改为基于 `status_instant` 判定；战斗地区改由
  武装瞬间的 `ctxSpace` 传入（不再依赖持久的 `game.last_battle`）。英国 after_naval 仍走自动
  `auto_fire_status`（未动，因玩家未要求其改为手动）。

**验证**：新增 `tools/_smoke_german_status.js`（14 项全过）：15253 发起陆战后武装→手动发动
在战斗地区建陆军+记账；15253 未武装/窗口关闭后手动发动被拒；15247 建设后武装→手动发动
消灭相邻敌军+记账；窗口关闭后不可再发动。15346 端到端：美国（已参战）发起陆战→武装
15346(space=44)→同盟玩家点击发动"发起陆战：德国"→窗口焚毁→再点被拒。`tools/_smoke_status.js`
（英国卡）21 项无回归。改 rules.js 需重启服务器。

> 6 人版本待办：15346 应"只在美国/英国由英国发起时"武装、且挂起到英国让英国玩家发动
> （当前 2 人视角由同盟玩家直接代打，不区分美/英、不挂起）。详见 `docs/todo-deferred.md`。
> 频率口径（【2026-09-30 修订】）："一回合一次" 的"回合"= 一个【国家的回合(nation-turn)】，
> 不是完整 6 国回合。`status_used[cid]` 现用 `freq_key(game)=game.turn+':'+game.current_nation` 记账，
> 因此德国在自己回合发动过、意大利回合代理德国再发动，是【不同的国家回合】，都应被允许
> （此前误用 `game.turn` 完整回合记账，会错误拦截代理再发动）。详见 rules.js `freq_key`。

**教训**：
1. "X 后立刻"窗口不能靠"本回合是否发生过 X"判断（last_battle/last_built 持久到整回合，
   会把时机放宽到整回合）。正确做法：事件瞬间把卡"武装"进一个独立暂存（status_instant），
   并在"下一个非本动作"时清空——用"事件上下文"精确区分"刚发生"与"发生过"。
2. **手动发动** vs 自动触发 是两种不同的"立刻"实现：自动=事件瞬间直接 run；手动=武装后
   等玩家点。玩家要手动时，必须保证"窗口不能跨动作残留"，否则等于整回合可点。
3. 手动发动时 `run` 需要的"事件地区"要在武装瞬间存下来（status_instant.space），
   不能事后从已被清空的 last_built 取——否则 15247 这类会拿不到地区而失败。
4. **测试德国状态卡要构造真实事件 + 真实地块邻接**：用 `I.do_battle` 直接驱动（它会走武装）；
   德军陆军必须放在与目标**相邻且在补给**的格（如 西欧=6 是德国补给点，其陆地邻居
   44=德国/13=意大利/15=非洲北部 可作目标），`'波兰'/'罗马尼亚'` 在 data 里不存在会直接失败，
   而 西欧与 东欧(5) **不相邻**（曾误以为相邻，导致 do_battle 报"无相邻发起单位"）。

---

### 2026-09-30 · 多目标战斗卡（巴巴罗萨 15226 等）代受挂起后进度丢失、卡未打出

**背景**：《巴巴罗萨》(15226) 是 EVENT 卡，单 step `op:'battle', pick:3`（对 1~3 个苏联地区
各发起一次陆战）。玩家实测：选完 3 地、开始战斗，若**任一目标触发空军代受（defend_air）挂起**，
代受解答后**后续目标不再执行、且巴巴罗萨卡始终未打出**。

**根因**：`resolve_event_card` 的 battle 分支用 `for (const sp of where)` 逐个 `do_battle`，
遇到 `r.pending`（代受）时直接 `return {ok:true, pending:true, desc}`（rules.js ~L5407）——
**只带走了 pending 标志和描述，把 step 进度与剩余目标全部丢弃**；随后 `play_card` EVENT 分支
看到 `r.pending` 就 `return`（不 `discard_card`），卡始终留手牌。而代受由**完全独立的**
`resolve_battle` 动作解答，它只重算"这单一目标"、交还操作权，**没有任何逻辑回到巴巴罗萨
续打第 2/3 地或把卡打出**。于是代受解答完：进度丢失、卡未弃、无恢复入口。

**同类影响**：所有含 `op:'battle'` 且战斗可能触发代受的 EVENT 卡都中招（含单目标如 15325
《莱茵河与多瑙河》"用它发起陆战"，触发代受同样卡死且未打出），非仅巴巴罗萨。

**解法（最终落地：战斗预算 event_budget 模型，2026-09-30）**：
> 把"对苏联发起 3 次陆战"做成**战斗预算**而非挂起序列状态机：
> 打出卡时建 `game.event_budget {card_id, nation, as, kind, against, remaining, from, descs, battleOk}`，
> 之后每次 `event_battle` 就是**一次完全原子的 `do_battle`**——代受/抵消、免死响应、闪电战(after_land)
> 窗口、15245 二连打……全部照常自动生效，无需为它们写专门的挂起分支。预算由 `event_battle`（逐次发兵）
> 与 `event_finish`（结算/放弃剩余并触发德国国家技能）两个动作驱动。详见 `docs/battle-sequence-design.md`。

1. 打出 `op:'battle'` 的 EVENT 卡时，`resolve_event_card` 不再内联 for 循环、也不建 pending_seq；
   而是建 `game.event_budget`，`remaining = step_pick_count(st)`（如巴巴罗萨=3），
   `return {ok:true, pending:true, cardResolved:true}` —— 卡照常弃、占出牌名额，`after_card_resolved` **不在此处调用**（延后到 event_finish）。
2. `event_battle {target}`：校验目标 ∈ 动态计算的合法集合（含 `against` 国部队且本方有可发起单位，
   复用 `event_battle_targets`，按卡的 `spacesFn`/`onlyNation` 限定），直接 `do_battle(...)`，`remaining--`；
   `do_battle` 返回 `pending`（空军代受）时 `pending_battle` 自然挂起，预算保留，等 `resolve_battle` 解出。
3. 单场战斗结算只由 `resolve_battle` 完成（defend/counter 落地），**不再调用任何"续打"函数**；
   预算状态始终保留，`remaining` 已在 `event_battle` 扣减，解出后即回到"可再点 event_battle 或 event_finish"。
4. `event_finish`：清 `event_budget` 并 `after_card_resolved(game, nation, card_id)` ——
   德国国家技能(`star_resolved`)**必然晚于最后一场战斗的闪电战时点**（玩家先点完闪电战再点结束）。
5. `event_card_needs` 对 `op:'battle'` 步骤**不再要求出牌时预选目标**（预算逐次在地图上点）；
   `build_actions` 在预算进行且轮到持有方时放行 `event_battle`/`event_finish`；
   `pending_advance_phase` 守卫补 `game.event_budget`，避免预算未完就推进阶段。

**关键收益（回应用户"两场之间插不了闪电战/状态"）**：每战都是独立原子 `do_battle`，
所以两场之间（及每战之后）所有原子拦截**自然生效**——可插闪电战/15245、免死响应、
飞机代受/抵消、15245 二连打，不用再为"序列 vs 代受"两套挂起打架。
`remaining` 始终足额（如 3），目标数少于机会时靠 `event_finish` 放弃剩余。

**验证**：`tools/_smoke_seq.js` 50/50 全过（建预算→逐次发兵→两场间插闪电战→代受/抵消期间 event_battle 被拦截→event_finish 结算触发国家技能）；
`tools/_smoke_status.js` 21/21、`tools/_smoke_german_status.js` 20/20 无回归。
**改 rules.js / play.js 需重启服务器 / 浏览器刷新**生效。

**教训**：
1. "多步卡内嵌战斗"与"战斗代受挂起"是**两套挂起系统**，二者相遇时必须有一方把进度**持久化到 game 状态**，
   否则 `return pending` 即丢进度。→ 预算模型把"已完成的进度"落进 `event_budget.remaining/descs`，彻底绕开了该问题。
2. "卡是否打出"不应依赖"挂起是否解除"——代受期间卡应照常弃牌（`cardResolved` 语义），
   续跑只负责补完战斗结果，避免"卡一直留手牌、玩家可重复点"的二次 bug。
3. 测试多目标战斗卡时，**必须构造"首个目标代受"的场景**，否则只在无代受时测会漏掉此路径。
4. 多个"可挂起"机制共用 `#ask_box` 时，**同一时刻只能有一个在渲染**——靠服务端按"当前真正在等谁"过滤 view、客户端用 `ask_state.kind` 防覆盖。
   本模型进一步把**战斗预算面板放进独立的 `#event_budget_box`**（不再走 `#ask_box`），从源头消除与代受/抵消框的争抢（见下条）。

### 2026-09-30（补）· 战斗预算面板与代受/抵消框不再争抢 `#ask_box`

**背景**：早期用 `pending_seq` + "继续战斗"按钮（走 `#ask_box`）与单场战斗的代受/抵消框（也走 `#ask_box`）争抢同一面板，
导致 counter 阶段"继续战斗"盖掉抵消框、卡死（详见上段历史）。

**最终解法（event_budget 模型）**：战斗预算面板**独立出 `#ask_box`**，渲染进新的 `#event_budget_box`
（固定右上角 HUD）。代受/抵消对话框仍走 `#ask_box`，二者物理隔离，不再有覆盖冲突；
且 `view.event_budget.can_finish` 在 `pending_battle` 期间为 `false`、地图目标点击在代受期被客户端拦截，
双保险防止"代受未解就发下一战"。

**通用教训**：任何"可挂起"机制（event_budget / pending_battle / pending_econ / pending_trigger / 响应队列）
只要共用同一面板，就必须保证**同一时刻只有一个在渲染**——要么靠服务端按"当前真正在等谁"过滤 view，
要么干脆让不同机制用不同面板（本模型采用后者）。新挂起机制接入时要先想清楚它与既面板的关系。

---

### 2026-09-30 · ECON 选国框（#ask_box）被推到可视区外：固定浮层修复

**背景**：ECON 经济战卡通用化后（见上条），多目标卡会弹 `render_ask_box` 选国框。
玩家实测《电动潜艇》(15217，三选一 英/美/苏) 时，选国 UI 过于靠下，**最末项【苏联】
看不到、点不到**。

**根因**：`#ask_box`（play.html:88，位于 `#aside` 内）在 play.css 里是**普通流布局**
（无 position、无 max-height），随右侧栏内容被推到视口下方；选项越多越靠下。
本质是 2026-09 修《空军力量》#mode_chooser 时已发现的同一类问题
（"放在 #aside 普通流里，常落在可视区外"），只是当时只修了 #mode_chooser 没顺带修 #ask_box。

**解法**：把 `#ask_box` 改为**固定浮层**，对齐 #mode_chooser 的已验证写法：
`position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 600;`
并加 `max-height: 80vh; overflow-y: auto;` 防极端溢出。只改 play.css，不动 JS 与 HTML。

**教训**：
1. 任何"弹出让用户选"的面板（选国框、模式框、资源面板），只要挂在 #aside 普通流里，
   面板一多就不可见——一律用 `position: fixed` 浮层，且**配套 max-height + overflow**，
   别等"选项多时才爆"。#ask_box / #mode_chooser / #resource_box 三兄弟都该审视一遍。
2. CSS 静态文件改动**无需重启 node 服务器**，浏览器禁用缓存刷新即可生效（与 rules.js 不同）。

---

### 2026-09-30 · 经济战卡（ECON）通用化：用 view 下发 `econ_targets` 取代按卡号硬编码特判

**背景**：ECON 经济战卡组（德国 15217-15224、14501，英国 15313/15314）之前只有 15313
《轰炸机军团》在客户端 `on_click_hand_card` 被 `if (faceId === "15313")` 单独硬编码特判
（弹选国框带 target 打出）；其余所有带 `targets:` 的 ECON 卡（15219~15224、14501、15217
三目标、15218 双目标）都落到"直接打出（不带 target）"分支，被服务端 `play_card` 的
`if (cfg.targets)` 校验拒绝——表现为"打出没反应 / 未实现"。玩家实测 15224《攻陷阿尔汉格尔斯克》
打不出，正是此因。

**根因（同源规律）**：客户端按"单张卡 id 写死 if"的做法，对任何新加的同类卡都**不会自动生效**，
必须每张手动加一行特判——这是数据驱动项目里典型的"漏网"模式（通用教训 + R28~R45 反复验证：
同类错误几乎总是批量存在，先报一张必有一批）。

**解法（方案 A 通用化）**：
1. 服务端 `inst_pub()`（rules.js ~L2699）给 `type==='ECON'` 且 `ECON_CARDS[id].targets`
   存在的卡，在 view 手牌对象上附加 `econ_targets` 字段（无 targets 的 15314 不用附加，
   它走 `chain` 链式挂起、由受击方在自己界面答复）。
2. 客户端 ECON 分支删除 15313 硬编码 `if`，改为读 `c.econ_targets` 通用判断：
   - `length > 1` → 弹选国框让玩家选 1 个；
   - `length === 1` → 自动带该 target 打出，无需弹窗；
   - 无 targets → 直接打出（15314 链式卡）。

**验证**：Lint 两文件无 ERROR；逻辑闭环确认——`view.hands[n].cards` 由 `hand_view`→`inst_pub`
生成，客户端手牌渲染遍历该数组，`on_click_hand_card(c)` 的 `c` 即带 `econ_targets` 的对象。
改 rules.js 后需**重启服务器**（node server.js，RTT watch 不热更）。

**教训**：
1. 凡是"客户端需要按卡的某种属性决定交互"的场景，**该属性应由服务端随 view 下发**
   （如 `econ_targets`），而不是在客户端写死卡号 `if`——新卡自动获得正确行为，无需逐张改客户端。
2. 识别此类 bug 的方法：先看服务端某类卡是否**有配置但客户端没接**（15313 能打、同类打不出
   → 八成是客户端只对个别卡特判）；再看客户端是否有 `faceId === "xxxx"` 这种按 id 的硬编码 if。
3. 单目标 / 多目标 / 无目标 三态要分清：无目标的卡（链式挂起）**不该**弹选国框，否则会误把
   "对方要答复"的卡变成"自己选国"。

---

### 2026-09-28 · R38：`build_army` 窗口过松 → 15341 在整个出牌阶段都能点

**现象**（玩家反馈）：澳大利亚劳管局(15341) 的触发窗口应该是**建设陆军时**，
但"其余时间也可以点击触发"。

**第一次修错了**（记录在此避免重蹈）：
我以为语义是"用状态卡**替代**出牌行动"，于是收紧成
"出牌阶段 + 未建设 + 未出牌"，还加了 `mark_play_done` 占名额。
**玩家纠正**：

> 应该是**打出《建设陆军》卡之后、选地块时**用它替换。
> **不影响出牌**，也**不受阶段影响**。
> 如果在**别人阶段**触发了英国建设陆军，英国也能使用这个状态。

**正确语义**：15341/15342 = 替换**已经打出的《建设陆军》卡**的结果，
是**事件驱动**（"正在建设陆军"），不是阶段驱动。

**最终实现**（关键：把"窗口"和"替换通道"分开）：

1. `status_window_ready` 的 `build_army` **默认返回 false**。
   理由：服务端**无法感知**客户端"正在选地块"这个 UI 状态，
   所以默认关闭 —— 这正好保证**其余时间 UI 不显示可点**（修复玩家的 bug），
   白名单里也不会有 `activate_status`（点了发不出去）。

2. 真正的放行走 `activate_status` 的 **`from_status` 专用通道**：
   ```js
   const isForgoBuild = !!(arg && arg.from_status) && !!(tr.cost && tr.cost.forgo_build_army)
   const ready = status_window_ready(game, owner, cardId, tr)
   if (!ready.ok && !isForgoBuild) { 拒绝 }
   ```
   放行时**不检查阶段**（满足"别人回合也能用"）、**不占出牌名额**
   （满足"不影响出牌"，名额由被替换的建设卡自己占）。

3. 客户端两处配套（缺一不可）：
   - `on_click_table_status` 的 `!c.ready` 检查**之前**，
     若 `ui.build && pending_card.name === '建设陆军'` 就先放行
     —— 否则永远走不到下面的 `ui.build` 分支（因为 ready 恒 false）。
   - 提交时 `send_action('activate_status', { card: cid, from_status: true })`
     —— **原先没带 `from_status`**，服务端根本不认。

### 2026-09-30 · R46：德国事件卡按【实现方式】重写 —— 额外打出 / 前提 / 多选的实现口径

**起因**：用户要求"彻底实现德国事件卡"，并给出分类维度：
可额外打出手牌 / 需要挂起交互 / 需要多步 / 需要选择 UI / 需要前提条件。
19 张德国 EVENT 全部按此重分类重写（旧实现大多是 `run()` 自动结算，见 R45）。

**实现口径（玩家 2026-09-30 确认）**：

1. **额外打出只记【权利】，绝不替玩家挑牌**。
   - 旧写法 `de_try_play_one()` 直接挑第一张能打的打出去 —— 已删除，
     **任何时候都不要再回来**（15239"打多了"就是它的锅）。
   - 新机制 `game.extra_play = { nation, source, source_name, filter, cards, count, turn, phase }`：
     - `'hand'` 任意手牌 / `'north'` 卡面带 `[北方行动]` / `'drawn'` `ep.cards` 指定的几张。
     - 只在【出牌阶段】有效：`phase_play` 进入时清、`next_phase` 推进时清（= 可放弃）。
     - **乐观消耗**：`check_phase_for_card` 放行时立即减 1 并写日志
       「因《XX》的【额外打出】：《YY》」，失败不退还（正常使用几乎走不到失败分支）。
     - 不占名额：名额早已被来源卡占掉。
2. **服务端与客户端口径必须同源**（通用教训 3）：
   `check_phase_for_card` 放行的同时，`play.js` 的 `check_phase_for_card`
   要在 `decl` 判定【之后】加一句 extra 放行，否则仍是"服务端放行、客户端置灰"。
3. **cost 有两种，别混**：`cost.discard` = 弃置手牌；`cost.attrition` = 损耗
   （抽牌堆顶 N 张直接进弃牌堆）。主动代价付不起 -> **整张卡不能打出**
   （`can_attrite` 返回的是【布尔】，不是 `{ok}`）。
4. **cond（前提条件）不满足 = 卡照常打出占名额、只是没效果**，且【不】给额外打出。
5. **pickMin**：卡面"1 或 2 次""选择…的 3 支"是【区间】，不是必须选满。
   `step_pick_min()` + `need.pickMin`，候选上限取 `min(候选数, pick)`；
   客户端 Done 按钮改为"选够 pickMin 即可点"。
6. **多步卡里的多选（本轮新坑）**：客户端的 Done 按钮传的是 `arg.spaces[step] = [多选地区]`
   而【不是】二维的 `arg.picks[step]`，导致 `pick_spaces_for` 读不到 ->
   退化成"服务端自动取前 N 个"，玩家白选一场（15231 中招）。
   已在 `pick_spaces_for` 补读 `arg.spaces[i]` 分支。
7. **`spacesFn`**：目标随局面动态算的卡（15226 巴巴罗萨"与德国陆军相邻的苏联陆军"）
   必须写 `spacesFn`，写成静态 `spaces` 等于把目标写死、失去交互。

**测试**：`tools/_smoke_de_event.js`（58 项全通过，含脚本卡部分）。
写这类用例时【必须】用 `I.grant_supply()` 给放下的棋子补给，
否则 build/battle 会因"不在补给中"被拒 —— 死因与被测逻辑无关（薄局面是 bug 高发区）。

**遗留**：`tools/_verify_15228.js` / `_verify_autobahn.js` 用了**不存在的地区名**「波兰」
（本图按区域命名，叫「东欧」），有 6/3 项假失败 —— 现行版本是 `_verify_autobahn2.js`（13/0）。

### 2026-09-30 · R48：国家技能做成【可选窗口】而不是挂起

**起因**：德国国家技能「一回合一次，当带星牌效果结算后，可损耗 1 张牌，
从手牌打出 1 张状态卡」。

**关键判断 —— 为什么不用挂起**：这是「可以」用也可以不用的能力。
硬挂起（像 `pending_autobahn` / `pending_script` 那样带全局守卫）会把它变成
**强制流程**，玩家不回答就卡死。所以做成：

- `game.national_skill_offer`（窗口）+ 两个 action `use_national_skill` /
  `skip_national_skill`；
- **不跨动作残留**：`exports.action` 入口统一 `clear_national_skill_offer`，
  玩家去做别的动作即视为放弃（这一条最容易漏，漏了就会"上一个回合的窗口
  突然冒出来"）；
- 使用时走【已有】的 `extra_play(filter='status')` 通道（不占名额、有日志留痕），
  没有为它新造一套"额外打出"机制。

**"能不能用"的四条判定（`national_skill_usable`）**：本回合没用过 / 有这个技能 /
付得起损耗 / **手里确实有状态卡**。最后一条是"服务端不替玩家做选择"的另一面：
明知道没得选就别给按钮（与 ECON、脚本卡的"候选为空就跳过"同口径）。

**钩子位置**：`after_card_resolved()` 挂在【每张卡打出并效果结算完毕后】
（BASIC / EFFECT / STATUS / ECON 直结 / ECHO / EVENT）。
⚠ 链式 ECON（15314）**必须**挂在 `resolve_econ` 的收尾处 —— 打出时效果还没结算；
脚本卡（15229/15239/14503）同理，要挂到脚本走完那一步。

**带★清单（玩家 2026-09-30 确认，共 8 张，全是 EVENT）**：
15225 阿登闪击战 / 15226 巴巴罗萨 / 15230 海狮计划 / 15232 巴尔干军政府 /
15235 强制征兵 / 15237 土耳其加入轴心国 / 6600 伊朗加入轴心国 / 14503 提尔比茨号。

**教训（OCR 推测 vs 玩家确认）**：OCR 任务文档写的是"部分 EVENT/STATUS 上
（阿登闪击战、海狮计划、土耳其加入轴心国、伊朗加入轴心国、提尔比茨号、大德意志帝国**等**）"——
这份推测**两处都错**：漏了 15226/15232/15235 三张，又把不带★的 6601 算了进去。
凡是文档里带「等」字、且没有逐张目验的清单，一律**先问玩家再用**，
不要拿它当权威口径直接写进代码（与"映射表没验证过卡面的都可能错"是同一类错误）。

### 2026-09-30 · R47：多步脚本卡（15229/15239/14503）—— steps 表达不了的流程

**起因**：事件卡里有三张卡的每一步都【依赖上一步的结果】，
用 `steps` 模型（"参数一次性填完再执行"）根本没有办法表达：

| 卡 | 卡面 | 为什么 steps 不够 |
|---|---|---|
| 15229 生产构思 | 检视牌堆 -> 选 1 张[状态卡]打出 -> 洗混 | 要先让玩家看牌堆，选完才知道打哪张 |
| 15239 战略规划 | 选 2 张抽取 -> 弃 1 张 -> 洗混 -> 可打出据此抽到的牌 | 抽到什么才知道能弃什么、能额外打出什么 |
| 14503 提尔比茨号 | 英国选择并暗牌弃置 1 张暗置的英国响应 | 要【让权】给对手，且结束后要把操作权收回来 |

**做法**：新增 `game.pending_script` 阶段机 + 独立 action `resolve_script`
（与 `pending_autobahn` / `pending_econ` 同款，避免和 play_card 的弃牌/名额逻辑纠缠）。

四条铁律：

1. **卡在打出瞬间就进弃牌堆并占名额** —— 后续步骤是这张卡的结果，
   不是另一次出牌（与 `autobahn_handle` 同口径）。
2. **服务端永远不替玩家挑牌** —— 候选为空就**跳过**该阶段，绝不随机、绝不取第一张。
   15239 的"随机抽 2 张 + 自动替玩家打一张"就是违反这条留下的旧债，已清。
3. **只有被指定回答国能提交**，且期间用全局守卫锁住其它动作。
   授权判定按【阵营】（与 `resolve_econ` 同），不是 `game.current_nation` ——
   让权只翻 `game.active`，国家轮转没变。
4. **机密只对一方可见**：牌堆/暗牌候选只发给回答方
   （`view.pending_script` 与 `query('script_state')` 都做阵营过滤），
   14503 的公共日志连**卡名**都不写（[暗牌] 语义）。

**中途踩的坑**：

- `extra_play.cards` 存的是【实例 id】（带 `#n`），而 `extra_play_allows` 收到的
  `card_id` 早已被 `inst_card_id` 去过后缀 —— 直接 `indexOf` 恒不相等，
  《战略规划》抽到的牌反而**打不出来**。两边归一到卡面 id 再比。
- `build_actions` 必须登记 `resolve_script`，否则客户端 `send_action`
  因白名单缺 key 而静默 return false（R28/R29 的老坑又来一次）。
- 客户端 `script_state` 缓存要带 `source` 字段比较，否则会陷入
  "update_ui -> query -> update_ui" 的死循环。

**测试**：`tools/_smoke_de_event.js`（58 项，含三张脚本卡的每一步 + 让权 + 暗牌语义）。
写断言时注意：**不能**用"卡是否结算成功"当判据 —— 抽到的牌是随机的，
目标写死的卡在空局面下会因"不在补给中"被拒，那是另一回事。
判"是否被口径接受"看**日志里有没有"额外打出"、有没有名额报错**。

### 2026-09-29 · R45：`run()` 函数式卡【完全不询问玩家】——卡面要选、实现却是自动执行

**起因**：用户点名 4 张"多步卡"要我检查同类问题：
史末资(15317)、阿登闪击战(15225)、海狮计划(15230)、进攻美国(15231)。

**排查结论（两类问题，要分开看）**：

| 卡 | 实现形态 | 结论 |
|---|---|---|
| 15317 史末资 | 声明式 `steps` + `useNewPiece` | ✅ **已被 R44 修复**（total=2 带出、逐步选齐后能征召+陆战） |
| 15225 阿登闪击战 | `run()` | ❌ **无交互**，自动执行 |
| 15230 海狮计划 | `run()` | ❌ **无交互**，自动执行 |
| 15231 进攻美国 | `run()` | ❌ **无交互**，且卡面"1或2次"但实现了**遍历全部相邻**（规则不符） |

**根因（架构层面）**：事件卡有**两套实现**：
- **声明式** `steps` / `choice` -> 走 `event_card_needs` 框架，**会逐步询问玩家**
- **函数式** `run(game, ctx)` -> 自己调 `build_piece`/`do_battle`，
  **完全绕过询问框架**，`event_targets` 直接返回 `need:null`

`run()` 当时是为了快速实现德国卡组（16 张）引入的，代价是**这些卡拿不到任何交互能力**。

**全量扫描结果**（`tools/_scan_runstyle.js`）：
- 声明式 17 张（有交互）/ `run()` 式 16 张（无交互）
- 其中 **`run()` 式但卡面疑似需要玩家选择的 7 张**（重点待办）：

| 卡 | 卡面 | 缺什么交互 |
|---|---|---|
| 14503 提尔比茨号 | 英国**选择**并暗牌弃置 1 张暗置的英国响应 | 需英国玩家选响应卡 |
| 15226 巴巴罗萨 | **选择**…3 支苏联陆军，按**任意顺序**发起陆战 | 需选 3 支目标 + 定顺序 |
| 15229 生产构思 | 检视牌堆，**选择**并打出 1 张[状态卡] | 需从牌堆选卡 |
| 15231 进攻美国 | 对相邻地区发起 **1 或 2 次**陆战 | 需选目标（且限 1~2 次） |
| 15236 瑞典支援芬兰 | 可打出 1 张[北方行动] | 可选是否追加出牌 |
| 15238 伊卡鲁斯行动 | 在<冰岛>**或**<亚速尔>征召陆军 | 需选地区 |
| 15239 战略规划 | **选择** 2 张牌抽取，弃置 1 张手牌 | 需选牌（两处） |

**优先修 15231**：它不仅无交互，还**打多了**（遍历全部相邻），是实打实的规则错误。

> **注**：这是**架构性欠账**，不是单个 bug。彻底解法是把这些卡改写成声明式
> （或给 `run()` 补一层"声明需要哪些选择"的描述），否则每加一张都要重新踩。

---

### 2026-09-29 · R44：多步卡"选完第 1 步就提交" -> 服务端 pending -> 整张卡不执行

**现象**（承接 R43）：15325 候选能出现了，但玩家点完地区后**没有建设、也没进入下一步**。

**根因**：多步卡（15325 = `[建设陆军, 用它发起陆战]`）需要**逐步**选择，
但客户端单选时**选完一个就直接 `send_action`**：

```
玩家点 step0（建设位置）
  -> send_action { spaces:[西欧] }        <- step1 还没选
  -> 服务端 event_card_needs 发现 step1 未选
  -> 返回 { pending:true }（不执行、不弃牌、不占名额）
  -> 客户端此时已 cancel_event_card() 清空了选择状态
  -> 玩家看到"点了没反应"，卡还在手里
```

**修复（三处，缺一不可）**：

1. **服务端**：`event_card_needs` 返回的 need 带上 **`total`（总步数）**，
   并且 **`query('event_targets')` 的出口也要带** ——
   出口会**重新构造**返回对象，只改 `event_card_needs` 不够
   （我第一次就漏了出口，客户端仍拿到 `total=undefined`）。

2. **客户端**：新增 `pending_event_spaces` 累积数组。`total > 1` 时：
   ```
   玩家点地区 -> spaces[step] = s -> 带完整 spaces 重新 query
             -> need 为 null（都选齐）才 send_action（必须带完整 spaces）
   ```
   `need === null` 分支原本是 `send_action({card})` **不带 spaces**，
   多步卡会丢掉各步地区，必须补上。

3. **执行器**：`resolve_event_card` 循环里维护 `prevSpaces`
   （build/recruit 执行后记录）并传给 `step_space_candidates`
   —— 之前执行阶段**完全没传**（只传了 arg），所以 useNewPiece 的
   battle 在**执行阶段**候选仍为 0。查询阶段传了、执行阶段没传，
   表现为"高亮能显示、点了却执行不了"。

**教训**：
> ① **多步交互 = "逐步累积 + 选齐才提交"**，不能"每选一步就提交"。
> ② **返回值在出口被重新构造时，新增字段必须在出口也带上**（本例 need.total）。
>    改了内部函数 ≠ 改了对外接口。
> ③ **查询阶段与执行阶段必须用同一套参数**（prevSpaces 两边都要传），
>    否则出现"查得到、执行不了"这种最难查的不一致。

**验证**：`tools/_verify_multistep.js` **10/10**
（模拟客户端逐步选择：局面A/B 都能选齐 -> need=null -> 建设+陆战都执行、卡已打出；
对照组"只提交 step1"确认卡未打出，即旧 bug 复现）。

---

### 2026-09-29 · R43：二选一卡选完选项后反复弹框（choice 被忽略）+ useNewPiece 无候选

**现象**（玩家反馈两张法国事件卡，由英国玩家打出）：
1. 15323 法国陆军：点"建设陆军"后**无高亮、也无法建设**
2. 15325 莱茵河与多瑙河：**没有实现选择攻击目标地块**

#### ① 二选一（choice）死循环

`query('event_targets')` 出口调用 `event_card_needs(game, my, card, {})`
—— **硬编码空 arg**。而客户端流程是（play.js `show_event_choice`）：

```
选完 choice -> send_query('event_targets', {card, choice}) -> 期望返回 need:'space'/null
```

服务端看不见 choice -> 又返回 `need:'choice'` -> 客户端再弹一次同样的二选一框
-> **玩家点了选项却反复弹框，永远进不到执行**（看起来像"点了没反应/无法建设"）。

**修复**：把 params（去掉 `card`）透传给 `event_card_needs`，
让 `choice` / `space` / `spaces` / `order` / `picks` 都能被识别为"已指定"。

> **教训**：query 出口喂给判定函数的 arg，必须是"玩家**已经作出的选择**"，
> 不能图省事传 `{}`——否则判定永远停在第一步，形成死循环。

#### ② useNewPiece 的 battle 候选为空

15325 = `steps:[{op:'build',type:'army'}, {op:'battle',kind:'land',useNewPiece:true}]`
—— 先建 1 支法国陆军，**再用这支新陆军**发起陆战。

但算候选时那个新单位**还不存在**，`battle_initiators()` 返回空
-> 候选 0 个 -> `event_card_needs` 判定"不用选"
-> 服务端自动空打 -> **玩家没机会选攻击目标**。

**修复**：`step_space_candidates` 增加 `prevSpaces` 参数；
`event_card_needs` 记录上一个 build/recruit step 的候选（或玩家已选）地区，
battle 分支在 `st.useNewPiece` 时额外接受"与这些位置相邻"的目标。

> **教训**：**依赖前一步结果的 step，算候选时必须把前一步的结果考虑进去**，
> 否则"候选 0 个"会被误判成"不需要选"，进而被自动执行掉。
> 这条与通用教训"空集合是高发区"同源。

**顺带确认（不是 bug）**：`query('event_targets')` 返回的 `candidates`
是**对象数组** `[{id, name}]`，不是裸 id —— 写测试/客户端时别当成 id 用
（我第一版测试就因此误判成"无效候选"）。

**验证**：`tools/_verify_fr_events.js` **13/13**
（15323：带 choice 查询不再返回 choice、能建成法国陆军；
15325：need 由 null 变 'space'、step=1、候选=意大利/德国且均与西欧相邻、执行日志含目标）。

---

### 2026-09-29 · R42：损耗（attrition）牌库耗尽规则——不洗牌 / 被动差额扣分 / 主动不足不可用

**玩家口径（2026-09-29，所有国家通用）**：
1. 牌库为空时**不抽牌、不洗牌**（损耗时牌堆空就停止）
2. **主动损耗**（自己付代价）：牌库不足 N -> **无法使用/无法发动**
3. **被动损耗**（被别国经济战等）：能损耗几张就几张，**差额每张扣 1 分**
   > 例：牌库 1 张，被损耗 3 -> 实际损耗 1，扣 2 分

**旧实现的错误**：`attrition_cards` 在牌堆耗尽时会**洗回弃牌堆继续损耗**
（照抄 `draw_cards` 的口径）。这与新规则直接冲突——
磨掉的牌应该"没了"，而不是把弃牌堆洗回来接着磨。

**实现（三个函数，职责分离）**：

| 函数 | 用途 | 行为 |
|---|---|---|
| `attrition_cards` | **纯损耗** | 不洗牌，牌堆空即停，返回实际损耗数组 |
| `attrition_passive` | **被动**（被别国） | 调用上者 + **差额扣 1 分/张**（扣该阵营），返回数组附 `.attrition_short` |
| `can_attrite` | **主动**可行性 | 牌库张数 >= N 才 true |

**调用点分类（改的时候最容易错的地方）**：
- **被动** = ECON 卡打给别国（`attrition_cards(game, target, …)`）、
  15314 受击方选择"损耗" -> 全部改用 `attrition_passive`
- **主动** = 自己支付代价（`cost.attrition`、15242、15255）-> 先 `can_attrite` 检查

**关键区分（别混用）**：
> "差额扣分"**只适用于被动**。主动损耗牌库不够就是**不能发动**，
> 不能"少损耗几张凑合"——否则等于玩家用空牌库白嫖发动。
>
> 主动检查与 `cost.discard`（手牌不足即拒绝）是同款口径。

**注意**：`attrition_passive` 返回仍是**数组**（可直接用 `.length`），
差额挂在 `.attrition_short` 上——这样既有用 `.length` 的调用点不用改。

**验证**：`tools/_verify_attrition_rules.js` **26/26**
（不洗牌：弃牌堆不被洗走、shuffle_count 不增加；
玩家举例：牌库1被损耗3 -> 损耗1、扣2分；被动充足不扣分；
主动不足不可用；主动不扣分；六国通用）。

---

### 2026-09-28 · R41：替换建设后，被放弃的《建设陆军》没有打出（退回手牌=白嫖）

**现象**（玩家反馈）：选择《澳大利亚劳管局》替换后，
本应被打出（进弃牌堆）的《建设陆军》**没有打出**。

**根因**：客户端流程是
`点状态卡 → cancel_basic_card()（取消建设选择）→ send_action('activate_status')`
—— 全程**没有**发过 `play_card`，那张《建设陆军》从未离开手牌。

**语义**：状态卡只把本次出牌的**结果**从"建设"换成"征召"。
**那张建设卡作为本次出牌，是已经打出去了的。**
若退回手牌，等于白嫖：既征召了陆军，建设卡还能再用一次。

**修复（两端）**：
1. 客户端：`cancel_basic_card()` **之前**先存下 `pending_card.id`
   （之后 pending_card 就被清空了），提交时带 `build_card`。
2. 服务端：`activate_status` 的 `forgo_build_army` 分支里
   `discard_card(game, owner, bc)` + `mark_play_done(game, owner)`。

**关于"不影响出牌"**（玩家口径）的准确理解**：
> 指的是**状态卡本身不额外消耗一次出牌机会**，
> 而不是"建设卡免费"。名额由**那张建设卡**占掉（它才是本次打出的牌）。
> `mark_play_done` 内部只在 `turn_phase === 'play'` 时置位，
> 所以别人回合/非出牌阶段触发时不会误伤（本卡"不受阶段影响"）。

**兜底**：客户端没给 `build_card` 时，服务端从手牌里找一张《建设陆军》打出；
找不到就只记日志、**不阻断**（效果照常执行）——
避免因为少一个参数而让整张状态卡失效。

#### 【2026-09-29 修正】兜底已删除——改为 `build_card` 唯一权威，禁止猜测

起因是拿 **美国 17526《民主兵工厂》** 做逻辑推演：

> 卡面：「**英国**按任意顺序执行：建设 1 支海军 及 建设 1 支陆军。」
> 将来实现：`{ actor:'英国', steps:[{op:'build',type:'navy'},{op:'build',type:'army'}] }`
> → `resolve_event_card` → `build_piece(game,'英国',…)`
> —— **英国根本没打出《建设陆军》卡**。

于是原来的"从手牌找一张《建设陆军》打出"兜底会踩两种截然不同的场景：

| 来源 | 有没有 build_card | 兜底行为 | 结果 |
|---|---|---|---|
| ① 玩家打出建设卡后替换（客户端漏传） | 漏传 | 找到并打出 | ✅ 正确 |
| ② **卡牌效果让他国建设**（17526） | 本来就没有 | 找到并打出 | ❌ **凭空扣掉英国一张牌** |

**无法区分 ① 和 ②**，所以权衡后选择**禁止猜测**：

```
有 build_card  -> 打出那一张（唯一权威来源）
无 build_card  -> 【一张都不打】、不占名额，只把建设结果换成征召
```

**权衡依据**：
- 漏掉 ① → 建设卡退回手牌（**白嫖**：玩家得利、易发现、改客户端即可修）
- 命中 ② → **误扣玩家一张牌**（规则错误、玩家受损、且极难发现）
> **"误扣"远比"白嫖"严重，宁可漏，不可错扣。**

**结论（通用原则）**：
> **服务端不要凭"名字/类型"去猜玩家的牌。**
> 涉及"哪张牌被消耗"这种影响玩家资源的操作，
> 必须由客户端明确指定实例 id；猜中了只是侥幸，猜错了就是规则事故。
> 想同时兼顾容错，应把"正在打出哪张卡"做成**服务端可见的状态**
> （如 `game.pending_build_card`），而不是让服务端靠特征反推。

**验证**：`tools/_verify_forgo_build.js` **22/22**（新增 D4：模拟 17526 场景，
英国替换时手牌建设卡未被扣、未占名额）；
`tools/_verify_forgo_fallback.js` **12/12**（无 build_card 时本国卡与别国卡**都不打**）。

**将来的两个注意点**：
1. 若实现"**卡牌效果触发的建设也允许他国替换**"（17526 民主兵工厂）：
   挂起询问机制【已存在】，**不需要重新设计** ——
   直接复用 `pending_econ` 的**让权骨架**（问对方 → 翻转 `game.active`），
   并参考 `response_queue` 的"放弃后 `resume` 继续原建设"逻辑。
   选型依据见**通用教训 19**（四套挂起机制对比）。
   且替换时**不得**走"扣建设卡"逻辑（走本分支即可，已安全）。
2. 若新增国家（法国183/中国180）的建设卡**不叫「建设陆军」**——
   本分支不依赖名字了，**已不受影响**（这是删除兜底的额外收益）。

---

### 2026-09-28 · R40：`STATUS_UI` 按基础 id 建表，运行时是实例 id -> 配置全丢失（点不动）

**现象**（玩家三次反馈后才定位到）：
打出《建设陆军》→ 地图高亮了可建位置 → 但**点不了《澳大利亚劳管局》**。

**根因**：客户端 `STATUS_UI` 表的 key 是**基础 id**（`'15341'`），
而运行时拿到的是**实例 id**（`'15341#3'`）：

```js
const ui = STATUS_UI[cardId] || {}     // cardId = '15341#3' -> undefined -> {}
```

于是 `ui.build` / `ui.auto` / `ui.discard` **全部丢失**，连锁两个后果：

- **渲染**：`ui.build` 为假 -> 走 `else if (c.ready)` 分支 ->
  而 `build_army` 窗口 `ready` 恒 false -> 该卡**灰显**（`ts-disabled`）。
- **点击**：`buildingNow = ui.build && …` 为 false ->
  被 `if (!c.ready && !buildingNow)` 拦掉 -> toast「此时机尚不能触发」。

**这与服务端 R28（`card_id === '15228'` 匹配不上 `'15228#3'`）是同一类坑**：
> **实例 id 永远不等于基础 id。凡是"按 id 查表"的地方，都要先去 `#` 后缀。**
> 客户端没有 `inst_card_id()`，需自己加（本例新增 `status_ui_of()`）。

**修复（三处）**：
1. 新增 `status_ui_of(id)`：先按原 id 查，再按 `split('#')[0]` 查。
2. `update_table_status` 与 `on_click_table_status` 两处查表都改用它。
3. **渲染分支去掉 `c.ready` 要求**：`if (building && c.ready)` -> `if (building)`。
   因为 `build_army` 是事件驱动窗口、`ready` 恒 false，
   若还要求 ready，正在建设时该卡仍灰显、点了也被拦。

**为什么前两轮没发现**：前两轮只改了服务端窗口与白名单，
没注意到客户端这张**本地 UI 镜像表**也按 id 查表 ——
**客户端的本地配置表也要检查 id 形态**（与服务端对称）。

**验证**：`tools/_verify_status_ui_key.js` **12/12**
（`15341#3` 能查到 build/recruit；两处调用点已改；无裸查表；build 分支只看 building）。

---

### 2026-09-28 · R39：补漏两处——白名单没给发送权、无合法建设位置时被取消

上一版只改了窗口判定，玩家实测仍点不动（**英国大本营为空、场上无英国陆军，
下一回合打出《建设陆军》后点不了澳大利亚劳管局**）。两处补漏：

**① 白名单没登记发送权 → `send_action` 静默失败（通用教训 18 再现）**

`build_actions` 里只有 `status_window_ready().ok` 才登记 `activate_status`，
而 `build_army` 窗口恒 false → **白名单里根本没有 `activate_status`**
→ 客户端点了发不出去（控制台无 `SEND action`）。

修法：对 `cost.forgo_build_army` 的卡**无条件登记发送权**：

```js
const isForgoBuild = !!(cfg.trigger.cost && cfg.trigger.cost.forgo_build_army)
if (r.ok || isForgoBuild) { acts['activate_status:'+cid] = 1; acts['activate_status'] = 1 }
```

**安全性靠"发送权 / 执行权分离"**：放的是**发送权**，不是**执行权**。
执行仍要 `arg.from_status === true`，否则 `status_window_ready`（false）照拒。

**② 无合法建设位置时客户端取消了选卡 → pending_card 变空**

`basic_targets` 返回空（无英国陆军 → 无可建位置）时，
客户端直接 `cancel_basic_card()` —— 但 15341 的语义是"**放弃**建设、改为在
澳大利亚征召"，**征召地点是澳大利亚，本就不依赖建设位置合法性**。
一旦 pending_card 清空，客户端就认为"没在建设"，状态卡再也点不动。

修法：空候选时若打的是《建设陆军》**且**桌上有 `forgo_build` 状态卡，
**保留 pending_card**、置 `ui.build = true`，并提示可点状态卡替换。
配套：服务端 `table_status` 新增 `forgo_build` 字段供客户端判断。

**教训**（两条）：
> ① **窗口默认关闭时，务必确认白名单有没有给"发送权"**——
>    "UI 显示可点"和"点得出去"是两件事（一个是 `ready`，一个是 `view.actions`）。
> ② **"没有合法目标就取消选卡"这条通用兜底，会误伤"替换类"卡**——
>    替换的目标未必来自原动作的候选集。改这类兜底前先问：
>    "有没有卡是用别的结果替换本次动作的？"

**教训**：
> ① **窗口名描述的是"语义时刻"，不是"阶段"**。
>    `build_army` 是【事件驱动】，别按阶段去收紧。
> ② **服务端感知不到的客户端 UI 状态，不要硬塞进窗口判定**——
>    应让窗口默认关闭（保证 UI 不可点），另开**带凭证的专用通道**放行，
>    由客户端提供"此刻确实在建设中"这个事实。
> ③ 改交互前先确认**它替代的是什么**（这里替代"建设卡的结果"，不是"出牌行动"），
>    否则会错误地占名额、错误地限制阶段。

**验证**：`tools/_verify_build_army_window.js` **13/13**
（四个阶段 ready 均 false 且理由正确；白名单无 activate_status；
from_status 可征召；德国回合/scoring 阶段仍可替换；不占名额；
不带 from_status 仍被拒；15342 同窗口同样成立）。

---

### 2026-09-28 · R37：单候选卡的【自选弃牌】被跳过，服务端自动弃前 N 张（华沙起义）

**现象**：玩家反馈「自选弃牌未实现，例如华沙起义」(15312，EFFECT，代价=弃 2 张手牌)。

**根因链**（三处叠加，缺一不可）：

```
15312 只有一个候选地区<东欧>
  -> event_card_needs: `if (cands.length > need)` 不成立（1 > 1 = false）
  -> 返回 null（"无需玩家选择"）
  -> event_targets: return { need: null, actor }  ←【不带 cost】
  -> 客户端 `if (tg.need === null) send_action({card})` ←【不带 cards】
  -> 服务端 resolve_event_card:
       const pay = (arg.cards && arg.cards.length)
         ? arg.cards
         : hand.filter(id => id !== card_id).slice(0, cost)   ← 自动弃前 N 张
```

**核心教训**：
> ① **"是否需要选地区" 与 "是否需要选弃牌" 是两件独立的事。**
>    单候选 = 不用选地区，但**照样可能要选弃牌**。
>    原实现把弃牌代价挂在 `need==='space'` 分支里，单候选一返回 null 就整个跳过。
>
> ② **服务端的"自动兜底"会掩盖 UI 缺失**。
>    `slice(0,cost)` 让功能看起来"能跑"（卡确实打出、效果也执行了），
>    只是玩家没得选 —— 这种"静默降级"最难发现。
>    **代价类操作不要让服务端猜，缺参数应回报"需选择"**。

**修复（三处）**：
1. 服务端 `event_targets`：`need=null` 时也附带 `cost: eff.cost || null`。
2. 客户端 `need===null` 分支：`tg.cost.discard > 0` 时先弹弃牌框
   （`need_targets: null` 表示"无需再选地区"）。
3. `confirm_echo_discard` 分支：`need_targets` 为 null 时**直接提交**，
   不能去 `highlight_event_targets(null)` —— 否则地图不高亮、
   玩家点到死也没有提交入口，**流程卡死**。

**验证**：`tools/_verify_echo_discard.js` **8/8**
（含关键反证：玩家选后两张时弃牌堆是后两张、手牌保留第一张，
证明不是取前 N 张；15306 同类卡同样返回 cost）。

---

### 2026-09-28 · R36：打出卡后悬停大图不消失 + 状态卡弃牌改为弹框选牌

#### ① 打出卡后，手牌悬停大图（#tooltip）不消失

**现象**：鼠标悬停手牌显示大图，把这张牌打出后，**大图仍留在屏幕上**。

**根因**：tooltip 的隐藏依赖卡元素的 `mouseleave` 事件
（`on_focus_card` / `on_blur_card`）。但手牌重绘是**直接替换 DOM**，
旧元素被移除时 **不会触发 `mouseleave`** —— 于是 tooltip 永远显示。

**结论**：
> **凡是"重建 DOM"的渲染函数，都要在开头先清掉依赖事件隐藏的浮层**
> （tooltip / 弹出气泡 / 跟随式提示）。
> 元素被替换时不会触发它的 mouseleave/mouseout。

**修复**：`update_hand_panel()` 开头清除（该函数是手牌 DOM 重建的唯一集中入口，
两条 return 路径都在清除点之后，全覆盖）。

#### ② 状态卡弃牌代价改为弹框选择（参照资源再分配）

原实现是 `render_ask_box` 文字框 + 让玩家去点**下方手牌区**选牌，
没有缩略图、也没有"选了第几张"的反馈。改为复用 `echo_discard_modal`
（与资源再分配同款 `modal + card-grid`），在弹框内直接点卡图切换选中。

**共用弹框必须处理的两个坑**：

1. **确认/取消按钮要分流**。`echo_discard_modal` 原本只服务
   `pending_echo_discard`（ECHO/EVENT 卡）。状态卡复用后，
   `confirm_echo_discard()` / `cancel_echo_discard()` 必须先判断
   `status_discard_sel`，否则状态卡点"确认弃牌"会因 `pending_echo_discard`
   为 null 而**直接 return（点了没反应）**。

2. **刷新时别误关别人的框**。`update_echo_discard_box()` 由 `update_view`
   **每次刷新**都调用，它原本只看 `pending_echo_discard`，
   一旦为空就 `add("hide")` —— 会把状态卡正在用的弹框关掉
   （表现为"弹框一闪就没"）。必须先判断 `status_discard_sel` 并转发给它自己渲染。

---

### 2026-09-28 · R35：发动"跳过出牌阶段"的状态卡后，应【立刻自动进入下一阶段】

**玩家口径（2026-09-28）**：发动塞内加尔步兵团、确认后，出牌阶段即告结束，
**立刻进入下一个阶段**（空军阶段），不必再手动点"下一阶段"。

**实现**：`activate_status` 结算成功后，若 `cost.skip_play` 且当前在出牌阶段，
直接调 `advance_phase()`。

**三个必须注意的点**：

1. **只对 `cost.skip_play` 生效**。15348 殖民帝国的代价是"失去 1 分"，
   不结束出牌阶段（玩家还能继续出牌）——写死"状态卡发动一律推进"会误伤它。

2. **效果失败【不】推进**。
   判定放在 `run_status_effect` 返回 `ok`【之后】：代价已付但效果没成立时
   （如 15338 指定的战斗无法发起），不能白跳掉一个出牌阶段。

3. **有响应卡待答复时【延迟】推进**。
   `request_responses` 可能挂起询问，若立刻推进会跳过响应窗口。
   做法：置 `game.pending_advance_phase = true`，
   由 `maybe_advance_after_skip_play()` 在响应队列清空后补推进
   （挂在 `trigger_response` / `pass_response` 的收尾）。
   该函数有三道守卫：有待推进标记、仍在出牌阶段、无任何挂起未决事项。
   `pass_response` 有 `resume`（重放出牌动作）时不补推进——重放可能已改变阶段，
   否则会二次推进。

**验证**：`tools/_verify_skip_advance.js` **9/9**
（15345 发动后 phase=airforce + 日志含"自动进入"；
15348 对照仍停在 play；15338 效果未成立时不推进）。

---

### 2026-09-28 · R34：【阶段限制总纲】——卡面声明了时机的卡，只能在那个阶段打出（出牌阶段也不行）

**玩家口径（2026-09-28 最终，唯一权威）**：

> - 事件卡 / 状态卡 / 暗置响应卡 / 基本卡 / 经济战卡，
>   **没有特殊说明的，一律只能在【出牌阶段】打出**。
> - **只有卡面有特殊说明的卡**（例如「在**计分阶段开始时**…」），
>   **才不能**在出牌阶段打出，**只能**在说明的那个阶段打出。

**旧实现的两个漏洞**：
1. 出牌阶段分支【无条件放行】——声明了"计分阶段开始时"的卡（如 14923 隆美尔）
   在出牌阶段也能打出。
2. 服务端 `if (c.type === 'EFFECT') return ok`（增强卡无条件放行），
   而客户端是查 `view.card_triggers` 判定的 —— **两边不同源**（通用教训 3）。

**最关键的一点：卡面提到阶段名有【两种语义】，必须区分**

| 类别 | 卡面表述 | 语义 | 打出阶段 |
|---|---|---|---|
| **A 类** | 「计分阶段**开始时**：在〈北非〉征召陆军…」(14923) | 打出/执行时机 | **只能**计分阶段 |
| **B 类** | 「计分阶段：〈加拿大〉…获得 1 分」(15340) | 被动结算说明 | **仍是出牌阶段** |

含"计分阶段"的卡有 **64 张**，两类都大量存在。
**若不区分，B 类状态卡会被错误限制成"只能在计分阶段打出"→ 永远打不出来**
（计分阶段它又不能打，形成死局）。

**判据**：用正则匹配「阶段名 + **开始时/结束时**」= A 类；
只写「阶段名：」= B 类。

```js
const PHASE_DECL_RE =
  /(资源再分配|出牌阶段|空军阶段|补给阶段|计分阶段|弃牌阶段|摸牌阶段)\s*(?:开始时|结束时)/
```

**实现位置**：`check_phase_for_card` 的【最前面】做总纲拦截
（这样出牌阶段也会拦掉"声明了别的阶段"的卡）；
第 ④ 分支（其余阶段）判据由 `has_phase_note` 收紧为 `declared_phase_of`；
EFFECT 改为走 `trigger_ready()` 与客户端同源。
**rules.js 与 play.js 两侧必须都有且一致**（有断言锁住）。

**验证**：`tools/_verify_phase_rules.js` **22/22**
（A 类只能计分阶段、出牌阶段被拒；B 类仍可出牌阶段打出、计分阶段被拒；
无声明卡只能出牌阶段；两侧 PHASE_DECL_RE / 映射一致）。

---

### 2026-09-28 · R33：手牌状态卡在任何阶段都显示为彩色可点击——`has_phase_note` 不指定阶段

**现象**（玩家反馈）：15345 塞内加尔步兵团 / 15338 反法西斯抵抗运动 在【手牌】里时，
不止出牌阶段，**其他阶段（资源再分配等）也显示为彩色可点击**。

**根因**：`check_phase_for_card` 的第 ④ 分支（非出牌/非空军阶段）写的是：

```js
if (has_phase_note(c))        // ← 不传第二个参数
    return { ok: true }
```

而 `has_phase_note(c, phaseZh)` 不传阶段时，只要卡面文本出现
**任意一个**阶段名（正则 `资源再分配|出牌阶段|空军阶段|…`）就返回 true。

15345 卡面：「…**跳过出牌阶段**行动：法国在〈非洲南部〉征召陆军」
15338 卡面：「**跳过出牌阶段**行动，弃置 2 张手牌：…」

这里的「出牌阶段」描述的是【触发代价】，**不是"可在该阶段打出"**——
结果它们在资源/计分/弃牌/摸牌等**任何**阶段都被判为可打出 → 不置灰、彩色。

**修复**：必须卡面确实提到【当前阶段】才放行。

```js
if (has_phase_note(c, PHASE_KEYWORD[ph]))   // 指定当前阶段的关键词
    return { ok: true }
```

**踩坑点**：`PHASE_ZH` 是给玩家看的中文名（「资源再分配**阶段**」），
而**卡面实际写法**是「资源再分配」（不带"阶段"）。
所以不能拿 `PHASE_ZH` 去 `indexOf`，必须单独维护 `PHASE_KEYWORD`
（写卡面实际用词）。两侧（rules.js / play.js）都要有且**内容一致**。

**验证**：`tools/_verify_phase_dim.js` **16/16**
（15345 在 7 个阶段中只有 play 可打出；15338 在 resource/scoring/discard 被拒；
不误伤——14923 隆美尔「计分阶段开始时…」在计分阶段仍可打出；两侧 PHASE_KEYWORD 一致）。

**顺带修正两处过时断言**（不是本次改动引入的，是既有失败）：
- `test_basic_cards.js` 的「基本卡 5 张」：六国卡组录入后 BASIC 是 30 张
  （每国各 5 张），写死 `=== 5` 恒失败 → 改为按国家分组、每组各 5 张。
- 同文件「理由说明只收卡面带说明的牌」：正则匹配旧文案
  `/只有卡面有特殊说明的卡牌/`，新文案是「只有卡面有**补给阶段**特殊说明…」
  → 放宽为 `/只有卡面有.*特殊说明的卡牌/`（行为未变，仅文案更精确）。

**仍未修的既有失败**（与本问题无关，需另开任务）：
`mode=seize：敌方空军被移除` / `本国空军进驻该地区`（夺取制空权功能，
走 airforce 阶段分支，本次未动）。当前 `test_basic_cards.js` **295 通过 / 2 失败**。

---

### 2026-09-28 · R32：状态卡触发时机——"跳过出牌阶段"必须在打出牌之前选择；状态区显示卡图

**玩家口径（2026-09-28 确认，15345 塞内加尔步兵团）**：

> 卡面分前后两段：
> - **前段**（打出即生效，一次性、永久）：
>   〈非洲南部〉成为【仅对法国】的补给点 + 增加 2 个计分标记
> - **后段**（可重复触发，每回合一次）：代价 = 跳过出牌阶段，
>   效果 = 法国在〈非洲南部〉征召陆军
> - **约束**：跳过出牌阶段必须在【出牌阶段打出牌之前】选择；
>   **打出牌后不能再触发跳过**。

**实现要点**：

1. **前段已由 `apply_status_ongoing` 覆盖**（`supply_point_and_markers`，
   打出即 `add_supply_point` + `add_marker`，A4① 永久、离场不回滚）。
   `only:'法国'` 通过 `faction_of_nation` 转成阵营写入 override，
   实测 `is_supply_point(非洲南部, 'allies')=true`、
   `is_supply_point(非洲南部, 'axis')=false` —— **仅对法国**生效。

2. **新约束加在 `status_window_ready` 的 `play_start` 分支**：

```js
if (tr.cost && tr.cost.skip_play && (game.play_done || {})[nation])
    return { ok: false, reason: '本回合已打出过牌，不能再跳过出牌阶段' }
```

**只对代价含 `skip_play` 的卡生效**——这点很关键：
15348 殖民帝国的代价是「失去 1 分」而不是跳过出牌，
所以它**打出牌后仍可继续触发**（摸牌），不受此限。
判定写死"play_start 一律要求未打出牌"会误伤 15348。

**连带影响（要知道）**：打出状态卡本身占出牌名额（A1①），
所以**打出 15345 的那个回合就不能再触发跳过**——出牌行动已用掉，
最早要等下一回合。这与玩家口径一致。

3. **状态区显示卡图**：
   客户端拿不到 `CARDS`（它在 `rules.js` 里 require，浏览器没有该模块），
   所以**必须由服务端在 `view.table_status` 里下发 `img`**，
   客户端再按手牌同款规则 `card_image_url()` = `"cards/<img>"` 拼 URL。
   同时下发 `text` 供 `title` 悬停显示卡面原文。

**验证**：`tools/_verify_15345.js` **14/14**
（打出即生效+仅对法国 / 打出当回合不可触发 / 新回合可触发且法国征召 /
已跳过不可重复 / 下一回合又可触发 / img 已下发）。

---

### 2026-09-28 · R31：状态卡点击报 `ReferenceError: escape_attr is not defined`，且资源阶段不灰显

**现象**（玩家反馈）：
1. 点击《塞内加尔步兵团》(15345) 弹出 `ReferenceError: escape_attr is not defined`；
2. 资源再分配阶段，其他牌都能正确暗置，**这张卡仍彩色显示为可点击**；
   《反法西斯抵抗运动》(15338) 同样问题。

**两个现象是同一个根因**（这点很关键）：

`play.js` 的 `update_table_status` 里写了 `escape_attr(c.card)`，
但本文件**根本没有** `escape_attr`——属性转义的正确函数名是 **`esc_attr`**
（另有 `esc` 用于文本）。于是：

```
渲染 update_table_status -> 拼 HTML 字符串时调用 escape_attr -> 抛 ReferenceError
-> host.innerHTML = '...' + list.map(...) 的【赋值中断】
-> DOM 停留在【上一次成功渲染时的旧状态】（出牌阶段的 ready 高亮/彩色）
-> 之后任何阶段都不会更新 -> 永远彩色可点击
```

**结论（重要）**：
> **"渲染时抛错" 会伪装成 "状态不更新 / 置灰失效"。**
> 看到"某元素始终是旧外观、其它元素都正常刷新"，
> 先怀疑**该元素自己的渲染函数抛了异常**（看浏览器控制台），
> 而不是去查服务端状态判定——服务端判定往往一直是对的。
>
> 预防：拼 HTML 字符串用的转义函数要确认**真的存在**；
> 本文件有两套：`esc()`（文本）/ `esc_attr()`（属性值，额外转义引号换行）。

**顺带修掉一处服务端/客户端不同源**（通用教训 3）：
`view.table_status.ready` 原先**没有**查 `status_active`（15343 压制），
而 `build_actions` 查了 —— 于是被敌方《霍巴特滑稽坦克》压制时，
view 显示 ready=true（彩色可点），点击却被服务端拒绝。
现在两侧都先查 `status_active` 再查窗口。

**验证**：`tools/_verify_status_dim.js` **6/6**
（出牌阶段 ready=true 作对照；资源阶段两张卡 ready=false、
原因"只能在出牌阶段发动"；资源阶段无 `activate_status`；被压制时 ready=false）。

---

### 2026-09-28 · R30：卡面 `<…>` 地区引用（"暗指"）与地图数据不符——效果定位不到地区

**现象**：玩家反馈"部分状态卡暗指错误"（暗指 = 卡面用 `<地区名>` 指代地图格位）。

**成因**：`data.id_of()` 只认**本体名**。OCR/录入时若用了简称或泛称
（如卡面写「南非」但地图只有「非洲南部」），
地区就解析不出来 → 持续效果不生效 / 触发条件永不满足 / 点了没反应。

**工具**（新建，以后每批卡录入后都应跑一遍）：

```powershell
cd server-official
node ..\tools\_check_all_space_refs.js        # 扫全部卡（375 处引用）
node ..\tools\_check_all_space_refs.js 英国   # 只扫某国
node ..\tools\_check_status_spaces.js         # 只扫 STATUS_EFFECTS 配置里的地区
```

**本轮发现 17 处无法解析，归并 6 类**：

| 卡面写法 | 地图实际 | 涉及卡 | 处理 |
|---|---|---|---|
| 「南非」 | **非洲南部**(31) | 15348 殖民帝国 | ✅ 直接改（唯一对应） |
| 「北非」 | **非洲北部**(15) | 14923 隆美尔 | ✅ 直接改（唯一对应） |
| 「美洲」 | **拉丁美洲**(30) | 15422 太平洋海岸线攻势 | ✅ 直接改（唯一对应） |
| 「太平洋」 | **区域组**：中/南/北/东 太平洋 | 15409、17506、17534、17544、16301 | ✅ 按全部格位 |
| 「中国」 | **区域组**：中国西部/东北/东部 | 15431、18406、17828、17829、17849 | ✅ 按全部格位 |
| 「非洲」 | **区域组**：非洲北部/南部/东部 | 17748 意大利殖民地帝国 | ✅ 按全部格位 |

**玩家口径（2026-09-28 确认）**：
> 泛称（「中国」「太平洋」「非洲」）= **该区域全部格位**，
> 既不是某一个具体地区，也不允许随便挑一个顶替。

**实现**：新增 `REGION_GROUPS`（**一对多**，区别于 `PLACE_ALIAS` 的**一对一**）
+ `space_ids_expand()`，展开成该区域全部格位：

```js
const REGION_GROUPS = {
  '中国':   ['中国西部', '中国东北', '中国东部'],
  '太平洋': ['中太平洋', '南太平洋', '北太平洋', '东太平洋'],
  '非洲':   ['非洲北部', '非洲南部', '非洲东部'],
}
```

需要"按区域统计/生效"的效果**统一用 `space_ids_expand()`**，
不要用 `space_ids_of()`（后者不展开区域组）。

**另一处口径陷阱（务必记住）**：模块里有**两套**地区解析函数：
| 函数 | 是否走 `PLACE_ALIAS` | 用途 |
|---|---|---|
| `space_id(name)` | ❌ 只查地图本体 | 配置表（如 `auto.spaces`） |
| `space_id_of(name)` | ✅ 先查别名再查本体 | 卡面地名 |

写配置时若用卡面别名（如「南非」），用 `space_id` 会解析失败。
校验脚本必须走 `space_id_of`，否则会**误报**（我第一版就误报了「南非」）。

当前校验结果：**无法解析 0 处，泛称 13 处（已按区域组处理，非错误）**。

**本轮已改前三处**（南非 / 北非 / 美洲）：
改**源头 CSV**（`out/uk_cards.csv`、`out/de_cards.csv`、`out/ja_cards.csv`），
再 `node tools/gen_module_cards.js` 重新生成 `cards.js`（431 张，数量不变）。
校验由 17 处降到 **13 处**，剩下的全是泛称。

**处理原则**：
> 能确定**唯一**对应本体名的（南非/北非/美洲）直接改；
> **泛称类（中国/太平洋/非洲）改一个会丢语义**——
> 必须问玩家是"泛指该区域全部格位"还是 OCR 漏了限定词，
> 未确认前**不要**擅自改成某一个具体地区。

**顺带确认**：15345 塞内加尔步兵团引用的「非洲南部」是**对的**（id=31），
它"点不动"是 R29 的白名单问题，不是地区名问题。

---

### 2026-09-28 · R29：状态卡点了没反应（15345 塞内加尔步兵团等）——白名单 key 带 id 后缀，对不上

**现象**：桌面状态卡（如 15345 塞内加尔步兵团）点击毫无反应，
连 `SEND action` 都没有。

**根因**（与 R28 同源，见通用教训 18）：

- 服务端 `build_actions` 登记的是**带 card_id 后缀**的 key：
  `acts['activate_status:' + cid] = 1`
- 客户端 `on_click_table_status` 发的是**不带后缀**的 verb：
  `send_action('activate_status', { card: cid })`

客户端查 `view.actions['activate_status']` → `undefined` → 静默 `return false`。
即：**所有**依赖点击触发的状态卡都发不出去（服务端自测全绿所以一直没暴露，
因为自测直接调 `rules.action`，不走客户端白名单）。

**修复**：`build_actions` 循环内，卡满足条件时**同时**登记不带后缀的 key：

```js
const r = status_window_ready(game, n, cid, cfg.trigger)
if (r.ok) {
	acts['activate_status:' + cid] = 1   // 保留：给按钮/按 id 分发的消费方
	acts['activate_status'] = 1          // 新增：客户端 send_action 实际查的是这个
}
```

服务端 `activate_status` 分支本身已有完整权威校验（卡在桌面 / 有 trigger /
`status_active` / 窗口就绪），白名单只负责"放行 verb"，不影响安全性。

---

### 2026-09-28 · R28：高速公路（15228）点高亮地区没反应——新 action 漏登记白名单

**现象**：出牌阶段打出《高速公路》，德军陆军被收回、地图高亮出可建地区，
但点高亮地区毫无反应（控制台无 `SEND action`）。

**根因**：`resolve_autobahn` 在 `exports.action` 里有分支，
服务端脚本 `tools/_verify_autobahn2.js` 也 12/12 通过，
但 `build_actions()` 里**只写了"禁止其它操作"的守卫**，
却没有**放行它自己**——`view.actions` 里没有 `resolve_autobahn`，
客户端 `send_action` 静默 `return false`。

**修复**：`build_actions` 里、`pending_econ` 分支之后补一条对称分支：

```js
if (game.pending_autobahn) {
	if (faction_of_nation(game.pending_autobahn.actor) === side)
		return { resolve_autobahn: 1, log: 1 }
	return { log: 1 }
}
```

**同批还修了两点**（玩家提的）：
1. **出牌名额改为"打出时"即占**——重建 N 次是这张卡的效果，不是另一次出牌；
   原先放在"最后一次建设完成"才 `mark_play_done`，一旦选位没走完就永远不占名额。
2. **高亮复用建设陆军逻辑**——`autobahn_targets` 改为直接
   `return step_space_candidates(game, '德国', { op:'build', type:'army' }, {})`，
   与建设阶段同款 `can_build_at` 判定，避免两套口径分叉。

**验证**：`tools/_verify_autobahn2.js` **13/13**
（新增断言 `view.actions.resolve_autobahn === 1`）。

---

### 2026-09-26 · R27：预览页说"尚未实现"，但代码其实实现了——配置表新增时必须同步三处

**现象**：ECON 两张卡（15313/15314）已在 rules.js 实现，
但 `event-cards-preview.html` 上仍显示红色「尚未实现」。

**两个独立成因**：

1. **`econ_config_of` / `ECON_CARDS` 没导出到 `_internal`**。
   预览页所有数据都取自 `rules.js` 的 `_internal`
   （`loadAll()` 里 `I: MODULES['rules.js']._internal`），
   没导出 = 页面上根本不存在这个配置。
2. **预览页判定"是否已实现"走的是 `card_effect_of()`**，
   而那个函数只认 `EVENT` / `ECHO`：
   ```js
   function card_effect_of(card_id) {
       if (c.type === 'EVENT')  return EVENT_EFFECTS[...]
       if (c.type === 'EFFECT') return ECHO_EFFECTS[...]
       return null          // ECON / STATUS / BASIC 全落这里
   }
   ```
   ECON 用独立的 `ECON_CARDS` 配置表，取不到 -> `implHtml(null)` -> 红色。

**修法**：
- `_internal` 补导出 `ECON_CARDS` / `econ_config_of` / `MEDITERRANEAN_SPACE`；
- 预览页新增 `econHtml(c, ctx)`，在 `render()` 里加一个
  `else if (c.type === 'ECON')` 分支（与已有的 `responseHtml` 同款并列）。

**预览页的数据来源（回答"这页引用的是哪里"）**：
```
fetch('data.js') / fetch('cards.js') / fetch('rules.js')   // cache:'no-store'
```
相对路径 = `preview-server.js` 所在目录，也就是
**模块目录 `server-official/public/quartermaster-sub-wars/` 下的真实源码**，
不是副本；卡图 `cards/<img>`（`cards.js` 的 img 是裸文件名，要拼 `cards/` 前缀）。
所以改完源码**刷新浏览器即可，不用重启预览服务器**（但图片有缓存，要 Ctrl+F5）。

**教训**：
> **新增一类卡牌配置，必须同步三处**：
> ① 配置表本身 ② `_internal` 导出 ③ 预览页的渲染分支。
> 漏掉 ③ 就会出现"代码实现了、页面说没实现"的假阴性 ——
> 而这页是唯一用来核对"文本 vs 实现"的工具，它说没实现会误导后续判断。
>
> 同理：将来做 STATUS 卡（也是独立配置表）时，
> 要把 `STATUS_EFFECTS` / 对应 of 函数一起导出并加预览分支，
> 别等页面又飘红才想起来。

### 2026-09-26 · R25：ECON 经济战卡实现——四种"代价/数量"口径必须先向玩家问清

**背景**：实现 15313 轰炸机军团、15314 马耳他潜艇群。卡面文本已由 glm 读图核验，
但卡面不写的东西（数量、计算公式、谁先谁后）必须问玩家，否则返工：

| 卡 | OCR/卡面不写的 | 玩家口径 |
|---|---|---|
| 15314 | "移除其位于地中海的海军"移几支 | **1 支**，由该国自己指定；**连带同地区同国空军一起死**；明确是"移除"动作 -> 发 `piece_removed` 钩子 |
| 15313 | 损耗张数怎么算 | **N = 2 + 2×k**（k = 英国在版图上的空军棋子数），有基础值 |
| 15313 | "英国空军"按什么数 | **版图上的空军棋子**（`type='air' && piece_nation='英国'`），不含手牌/桌面卡 |
| 15314 | 德/意依次选择怎么呈现 | **分成两次**，每答完一个【立即结算】，中间状态可见 |
| 15314 | 中立国要不要答 | **照样要答**，不跳过 |

**关键术语（此前全项目都没出现过）**：
> **"损耗 N 张牌"（attrition）= 该国【抽牌堆顶】N 张【直接】进弃牌堆，不进手牌。**

与"弃置"完全不同：弃置是玩家从【自己的手牌】挑牌丢掉（有选择），
损耗是牌堆自动磨掉（无选择、纯随机）。实现见 `attrition_cards()`。
牌堆不足时按 `draw_cards` 同一套 seed 口径洗回弃牌堆。

**实现要点**：
- 新增顶层 `attrition_cards` / `air_piece_count` / `navies_in_space`；
- `ECON_CARDS` 配置表 + `econ_config_of(card_id)`（用 `inst_card_id` 取 face）；
- 15314 用 `pending_econ { chain, step, resolved }` 链式挂起，配套
  `set_pending_econ`（让权）/ `econ_waiting_nation`，与 R22 的 pending_battle、
  R13 的 response_queue **第三种同款复制**；
- 全局守卫、`build_actions`、`view.pending_econ`、`view.waiting_for`、`view.prompt`
  都要跟着加分支 —— 少一个就会出现"能提交但面板不显示"或反之；
- `resolve_econ` 挂在 `game.pending_econ` 上被子步骤推进时，
  **`timing` 必须存进 pe**（见 R25.1）；
- 客户端 `on_click_hand_card` 必须有 ECON 分支 —— 否则会落进末尾的
  `query_event_targets`（EVENT/ECHO 流程），表现为"点了去选地区"；
- 测试脚本：`tools/_smoke_econ.js`（22 项），放棋子用
  `g.location[id] = d.id_of(地区名)` 手写三字段，不要用 `g.piece_type` 反查
  （初始局面里没有该国空军/海军，查出来是空数组）。

### 2026-09-26 · R25.1：`timing` 的作用域陷阱——结算动作活在另一个分支里

**现象**：`ReferenceError: timing is not defined`（rules.js:7239）。

**原因**：15314 的打出处在 `play_card` 分支里，`const timing = !!chk.timing`
只在那个代码块内可见；而收尾结算发生在【另一次请求】的 `resolve_econ` 分支，
那里根本没有 `timing`。

**修法**：建立挂起时把 `timing` 存进 `pe.timing`，收尾时读 `pe.timing`。

**教训**：
> **跨 action 传递的上下文，一律塞进 state 的挂起对象里，不要指望外层局部变量。**
> `play_card -> pending -> resolve_xxx` 是跨网络请求的两个独立调用，
> 第二次进来时第一次的局部变量早没了。凡结算要用的东西
> （cost / timing / target / chain…）都得在挂起时落盘。

### 2026-09-26 · R26：客户端又踩 `view.pieces` —— 服务端给的直接用，别二次筛选

写 `econ_on_pick_piece` 时想从 `view.pieces[piece_id].space` 取地区名，
被文档里 2026-09-23 的注释拦下：

> `view.pieces` 的键是部队行/算子对象，**不是 id 索引**，
> 而且它是【按本方代表国过滤过的】列表（法国部队由英国代表时取不到）。

**修法**：用服务端已经放好的 `pe.space_name`（`pending_econ` 里带的），
客户端一行都不用算。

**教训**：
> **同一个坑踩第二次说明文档起作用了，但也说明"服务端算出的数据"和
> "客户端本地数据"混用是高发区**。凡是服务端在 view 里显式给了的字段
> （`space_name` / `options[].navies` / `pb.airs`），客户端直接渲染即可；
> 只有在服务端【没给】时才去找本地 `view.*`，且要先确认它的键结构。

### 2026-09-26 · R24：ECON 两张卡 OCR 全错——"能读图"后逐类核验是唯一正道，且 OCR 错的往往是语义而不是个别字

**背景**：按用户"先把各类型卡效果正确识别"的节奏，用 glm 5.3 直接读 15313/15314
卡图（此前只能靠 OCR 文本），结果**两张的 OCR 全错，且都是整体语义错误**：

| 卡 | OCR 说 | 卡面真实 |
|---|---|---|
| 15313 轰炸机军团 | "移除 1 支相邻德国陆军；每 1 支本国空军可移除 2 支" | 经济战：让德国/意大利**弃牌**（基础 2 张 + 每 1 英国空军 2 张），全程没有"移除陆军" |
| 15314 马耳他潜艇群 | 打出方选 3 支地中海海军移除 | **受击方二选一**：德国和意大利各自选择 弃 3 张牌 或 移除自己的地中海海军 |

**教训**：
1. **OCR 错的常常不是字，是语义**。15313 的 OCR 每个词都"像那么回事"
   （德国/空军/移除），拼出来却是另一种卡。所以"OCR 看着通顺"不能作为
   可信标准，必须读图。这也是用户推进"按类型逐一读图核验"的原因。
2. **决策权方向是 OCR 最容易搞反的东西**（15314"谁选择"），实现时若照
   错文本写，交互方向整个反掉。读图时专门盯"主语是谁"。
3. **新术语确认**："损耗 N 张牌" = 该国玩家弃 N 张手牌（attrition），
   与主动"弃置"不同；实现 ECON 要新增损耗动作 + 响应钩子（15329 反潜战术
   拦截 [经济战]）。
4. **修正流程**：改源头 `out/uk_cards.csv`（effect_CN 列）→
   `node tools/gen_module_cards.js` 重新生成 `cards.js`（img 引用不变）。
   `cards_review.csv` 是存档扫描档案（只有网格/URL 无文本），不用同步。
5. **读图能力是分模型的**：hy4 preview 读图不可靠（会误读），glm 5.3
   可以正确读卡面小字。识别类任务前先确认模型。本次 glm 一次读对两张，
   无需再走"任务文档 + 用户手动切换"的迂回（任务文档仍保留，用于记录状态）。
6. **15349 奇袭塔兰托挂起**：卡图位置未知（R23 的三套坐标矛盾），
   模块 `sheet153_r5_c4.png` 当前是错误图（r4c8 切出的是 15343 的卡面），
   OCR 文本未核验。恢复入口见 `docs/econ-cards-ocr-task.md` §3。

### 2026-09-26 · R23：卡图定位的三套坐标互相矛盾——文本/图/存档必须各有一位"锚点"

**背景**：实现 ECON 卡前重新核对卡图，发现 15349 奇袭塔兰托的卡图
`sheet153_r5_c4.png` 一直是 2KB 空白图。按 CSV 的另一行坐标（10x7 网格 r4c8）
重切后得到 401KB 的"坦克"图，被认为切错。深挖后发现**三套坐标体系在打架**：

| 体系 | 规则 | 15349 落点 |
|---|---|---|
| `cards_review.csv` 的 row/col | 纯顺序编号：`card_id - 15301` 一格一张 | r4c8（= 状态卡 15343 霍巴特滑稽坦克的图！卡面画的就是坦克，被误认为"部队"） |
| TTS `CardID % 100`（id-map） | TTS 渲染规则（社区共识） | r4c9（但该格已被用户验证 = 15344 法国流亡政府） |
| TTS `DeckIDs` 位置（pos-map） | 另一种流传的说法 | pos 68 → r6c8（实测空白 ✗，且 72 张 > 70 格，该体系装不下，可排除） |

**已确认的硬事实（锚点）**：
- 用户逐一验证过：11 张状态卡（15338-15348）在模块 img 映射 `r4c3…r5c3` 连续 11 格**全部正确**；
- 0021BFB 雪碧图（3840x4032, 10x7）逐格文件大小与现有切片完全一致 → 它就是 sheet153 主图的完整版（第 7 行是补的空白行）；
- **有效卡面只有 54 格（r0c0-r5c3），15349 不在其中** —— TTS deck 里却有 72 张实体卡（含模块没有的 15350-15352），说明"模块 54 张卡"与"TTS deck 内容"本来就不同源。

**教训**：
1. **CSV 的 row/col 是生成脚本的顺序编号，不是卡面真实位置**。它与 TTS id-map 差 5 格、与模块 img 也不同 —— 三者谁对要靠"人眼验证过的锚点"裁决，不能互相推导。
2. **验证卡图必须看图本身**。"11 张状态卡都对"是唯一可靠锚点；由此推出 15349 不在此图上，而不是"再试一个坐标"。
3. **"切出来的图是部队"先别急着否定切片** —— 霍巴特滑稽坦克的卡面画的正是一辆坦克；先核对格子的"应有身份"再说。
4. **定位未知卡图的最快路径 = 视觉模型看"整图缩略 + 网格坐标标注"**，一次指认，比逐格猜坐标快得多。工具已留档：
   - `tools/_probe_taranto_sheet.ps1`：全格切片 + 文件大小统计（2005 字节 = 纯空白格，文件大小就是最好的空白检测器）；
   - `tools/_annotate_15349.ps1`：整图缩放 + 网格线 + r{r}c{c} 角标（`out/probe_15349/annotated_small.png`）；
   - `tools/_find_taranto_deck.js` / `_dump_15349.js` / `_dump_deck153_all.js`：从 TTS Workshop JSON 挖 CustomDeck / DeckIDs / CardID。
5. **TTS Workshop JSON 是卡序的权威来源**（DeckIDs、CustomDeck 网格、FaceURL），但要与图内容互证；本地缓存图可能与 Steam URL 当前版本不同步。

### 2026-09-26 · R22：战斗挂起了但"时点没变"——挂起必须让权，且客户端 is_my_turn 不能自己跟自己比

**现象**：德国对英国发动海战、实际已挂起到英国决定是否用空军代受，但
**德国顶部的 UI 和整体时点完全没变** —— 顶栏仍是"【德国】出牌阶段（2/7）"、
"下一阶段"按钮照常可点；英国那边虽然有询问面板，但界面没有切到"轮到它"。

**两个独立成因**：

1. **服务端挂起时不让权**：`do_battle` 只写 `game.pending_battle`，
   `game.active` 仍留在发起方。而 `view.prompt` 的分支是
   `is_my_turn ? '【X】阶段…' : '等待对方行动'` —— 德国的 `is_my_turn`
   还是 true，所以顶部永远显示自己的阶段。
   对比：**响应卡（R13）早就有"让权"**，战斗链路上漏了同一套机制。

2. **客户端 `is_my_turn()` 恒为真（致命且隐蔽）**：
   ```js
   const my = (player === "Axis") ? "axis" : "allies"
   return my !== null && my === view.side     // view.side 就是本方阵营！
   ```
   `view.side` 是"这个 view 是发给哪个阵营的"，它**恒等于**自己的阵营，
   于是两边都认为自己在行动 —— 比的错误对象。

**修法**：

- **服务端**（rules.js）：新增 `battle_wait_role(pb)` / `set_pending_battle(game,pb)` /
  `battle_reconcile_active(game)`，与响应卡的
  `request_responses`/`response_reconcile_active` 同款：
  - `set_pending_battle`：写入挂起并把 `game.active` 让给**该表态那一方**，
    原操作权存 `game.battle_return_active`；
  - `do_battle` 里三处写 `game.pending_battle = ...` 全改成 `set_pending_battle`；
  - 挂起清除后 / `resolve_battle` 结算成功后调 `battle_reconcile_active`
    交还操作权；`defend → counter` 换人时也走它重新让权；
  - `resolve_battle` 校验失败放回挂起时改用 `set_pending_battle`（重新让权）。
- **view 新增 `waiting_for`**（只发给**非决策方**）：`{kind,nation,text}`，
  让"被晾着的一方"知道在等谁、等什么。
- **`view.prompt` 优先级重排**：待决事项 > 等待对方 > 正常阶段 > 等待对方行动。
  关键是 **① 必须排在 `is_my_turn` 之前** —— 让权后等待方的 `is_my_turn`
  也变成 true 了，先判 `is_my_turn` 会显示"【德国】出牌阶段"而不是"请决定是否代受"。
- **客户端**（play.js）：
  - `is_my_turn()` 改为比 **`view.active`**（服务端操作权），不再比 `view.side`；
    兼容 `"Both"` / 数组；
  - 新增 `can_act_in_turn() = is_my_turn() && !pending_battle && !pending_trigger`，
    "下一阶段"按钮与 `update_phase_buttons()` 的 `mine` 全改用它
    （否则等对方代受的本方界面会冒出德国的"出牌三选一"按钮）；
  - `update_side_info()` 的"行动方"改读 `view.active`（原来读 `view.side`，两边都显示自己）；
  - `update_phase_panel()` 把 `view.waiting_for.text` 写进 `#phase_note`；
  - `on_click_hand_card` 开头加拦截：有待决事项时手牌不可点。

**教训**：
- **凡是"双方交互"的挂起，都要同时做三件事**：写待决事项、**翻转操作权**、**结算后交还**。
  只做第一件就会出现"状态变了、界面没变"。
  战斗（R22）与响应卡（R13）是同一个模式的两个实例 —— 修好一边要立刻问
  "另一个 userId 呢"。
- **`view.side` 是"发给谁"，`view.active` 才是"现在轮到谁"**。
  拿 `side` 判自己的回合等于"自己跟自己比"，恒为真。
  两个字段名字像但语义不同，是本次最隐蔽的点。
- **让权之后要重新检查所有 `? :` 的优先级**：`is_my_turn` 的取值语义变了，
  原来写在它后面的分支可能永远进不去了（本次 `pendingBattle` 分支就被它吃掉）。
- 客户端"能不能点 $=$
  服务端会不会接受"：既然服务端有全局挂起守卫（attrs 11），
  客户端就要把 `pending_*` 也算进 `can_act_in_turn`，别让玩家点了才被拒。

### 2026-09-25 · R21：海战 + 空军代受 + 驱逐舰(15334)响应的交互时序两处遗漏

**场景**：英国船 + 英国飞机同格，德国陆军+飞机对该船发起海战，英国桌面有响应卡《驱逐舰》(15334，"补给状态的英/美海军被移除时：本回合不可移除")。

**期望顺序**：① 先问英国飞机是否代受；② 若英国不代受 → 问响应（驱逐舰），若发动则飞机不用撤离；③ 若英国代受 → 问德国是否抵消，若德国抵消 → 船被移除 → 问英国响应。

**实际两处 bug**：
1. **普通分支(不代受)触发了 15334，但"还原"没把飞机一起还原**：船移除 → `piece_removed` 钩子入队 15334 → 英国飞机按"不代受"撤离。但发动驱逐舰只 `restore_piece` 还原船，飞机仍停在撤离位。用户预期"船没死 → 飞机不应撤离"。
   - 修法：`do_battle` 普通分支在发 `request_responses('piece_removed', ...)` 时，把同场将撤离的英国空军集合写进 `ctx.retreated_airs`；15334 的 `RESPONSE_EFFECT_IMPL['15334']` 触发时，若 `ctx.retreated_airs` 中某机仍在 location 且不在原 space，则归位到 `ctx.space`（已被移除的机不在 location，自然跳过）。
2. **抵消分支从不触发 `piece_removed` 钩子**：英国代受 + 德国抵消 → 船被移除，但 `do_battle` 抵消分支只 `delete` victim，没有发 `request_responses('piece_removed', ...)`，驱逐舰从未被询问。
   - 修法：抵消分支删除 victim 前算好快照（`rmvNationC/rmvTypeC/rmvSuppliedC`），删除后补 `request_responses('piece_removed', {...}, false)`。

**与 R17/R18 的关系**：R17/R18 已让 15334 在"普通分支"能触发，本坑是在此基础上的两处遗漏——① 普通分支虽触发了、但响应"还原"没把撤离飞机一起还原；② 抵消分支压根没触发。

**教训**：
- 响应卡"还原"不仅要还原被钩子选中的那枚棋子（船），还要还原"同一战斗事件链上被连带影响"的棋子（因不代受而撤离的飞机）。把受影响棋子的回收集成到 `ctx` 一并下传。
- `do_battle` 的所有"棋子被移除"出口（普通分支 / 代受成立 / 抵消分支）都要触发 `piece_removed` 钩子，否则该出口触发的卡整类失效。改战斗移除逻辑时，**逐出口核对**是否都发了钩子。
- （顺带）普通分支 ctx 的 `reason` 由 `'battle'` 改为 `'piece_removed'`，与事件语义一致（当前 15334/15330/15332/15337 的 filter 都不读 `reason`，故属纯清理，不影响匹配）。

### 2026-09-25 · R17：防御姿态(15330)/驱逐舰(15334)等"被移除时"响应卡从不触发——双 bug

**现象**：德国陆战移除补给状态的英国陆军时，英国桌面上的《防御姿态》既不入队、也不切到英国挂起（用户称"暗扣了防御姿态"）；其实在所有移除路径（战斗/补给断连/收回/消灭）里 15330/15334 都不触发。

**根因（两个独立 bug，叠加）**：
1. `do_battle` 移除受害者后只触发 `request_responses('battle', ...)`，**从不触发 `piece_removed` 钩子**。所以 combat 移除场景下 15330/15332/15334/15337 全都不入队（15336 是 on='battle'，只有它正常）。
2. 即使触发了，`15330/15334` 的 filter 写 `const supply = compute_supply(game); return !!supply.in_supply[ctx.piece]`——而所有 `request_responses('piece_removed', ...)` 调用点都是**先 `delete game.location[piece]` 再触发**，删除后该棋子已不在棋盘，compute_supply 查不到 → filter 永远返回 false。15332/15337 不查 supply（只用 ctx.space / ctx.piece_nation），所以它们是好的。

**修法**：
- do_battle 在删除受害者前抓取 `was_supplied = !!compute_supply(game).in_supply[victim]`，删除后补 `request_responses('piece_removed', {... was_supplied}, false)`。
- 所有 piece_removed 触发点（do_battle / resolve_supply / eliminate_piece / remove_piece）统一在**删除前**算好 `was_supplied` 写进 ctx。
- 15330/15334 的 filter 改为 `return ctx.was_supplied === true`。

**闭环补全（见 R18）**：R17 初稿曾误判"15330/15334 的 `effect` 仍是 `null`、第 3 步未做"——这是误读：`RESPONSE_EFFECTS[id].effect` 是**已废弃的遗留空字段**，dispatch 实际走 `RESPONSE_EFFECT_IMPL[id]`（~6440 行），而 15330/15332/15334/15337 的 effect **早已实现**（`restore_piece` 还原 + `register_modifier(protect)` 本回合保护）。真正还缺的是 `do_battle` 删除 victim 前**不检查 `is_protected`**（"本回合无法被移除"在战斗路径不生效），以及上次补 `piece_removed` 时误用了不存在的 `has_response_hook()` 会让 `do_battle` 崩溃——都已由 R18 修完。

**教训**：新增 on='piece_removed' 响应卡时，filter 不要依赖触发瞬间重新算棋盘状态（棋子往往已被删）；把需要的快照（was_supplied 等）在删除前算好随 ctx 下传。改 do_battle 的移除逻辑时，记得同步触发 piece_removed 钩子，否则这类卡整类失效。

### 2026-09-25 · R18：response 卡 effect 已在 RESPONSE_EFFECT_IMPL 实现；do_battle 需补 is_protected + 修 has_response_hook 致命 bug

**纠正（接 R17）**：第 3 步"还原+protect"的 effect 其实**早已写完**，写在 `RESPONSE_EFFECT_IMPL['15330'/'15332'/'15334'/'15337']`（~2108–2151）：`restore_piece(game, ctx)` 把棋子放回被移除前的 space（恢复 location/nation/type）、`register_modifier(game, { key:'protect', nation, type, spaces:[ctx.space], untilTurn: game.turn })` 本回合保护。dispatch（~6440）读 `RESPONSE_EFFECT_IMPL[c.card_face]`，与 `RESPONSE_EFFECTS[id].effect` 无关——`RESPONSE_EFFECTS[id].effect` 现已全部清理为"已废弃"注释，避免再误导。

**两个待补全的缺口（本次已修，见 rules.js）**：
1. `do_battle` 删除 victim 前**不检查 `is_protected`**：`protect` 修饰器只在 `resolve_supply`（~525）被检查，战斗移除路径（普通分支 ~3235、抵消分支 ~3188）直接 `delete`，导致"本回合无法被移除"在战斗里形同虚设。
   - 修法：普通分支先算 `victimProtected = is_protected(game, victim)`，受保护则只记日志、跳过删除与 `piece_removed` 触发，且 `battleCtx.result.removed` / 返回值 `removed` 改为 `null`；抵消分支同理（受保护时只删代受/抵消空军，不删 victim）。
2. 上次补 `piece_removed` 时误写了 `if (has_response_hook('piece_removed'))`，而 `has_response_hook` **根本不存在**——`do_battle` 一删 victim 就抛 `ReferenceError` 崩溃。
   - 修法：去掉该外壳，`request_responses` 内部无匹配会自动 `return null` 且不切 `active`，直接调用即可。

**教训**：
- 判断一张响应卡"效果有没有实现"，看 `RESPONSE_EFFECT_IMPL[id]`，**不要**看 `RESPONSE_EFFECTS[id].effect`（那是历史遗留空字段）。
- 改 `do_battle` 的移除逻辑时，记得同时尊重 `is_protected`（与 `resolve_supply` 一致），否则 protect 类卡（防御姿态/马奇诺/驱逐舰/生命的飞跃）在战斗里失效。
- 调用任何疑似辅助函数前，先 `search_content` 确认它真的存在，别凭记忆写 `has_response_hook` 这种不存在的名字。

### 2026-09-25 · R16：响应卡触发时点的"双表"陷阱——CARD_TRIGGERS.on 是死配置，RESPONSE_EFFECTS.trigger.on 才是权威

**现象/风险**：rules.js 里 12503/12504 的触发时点出现两处不一致，容易让后续修改者"改了没用"甚至改错：
- `CARD_TRIGGERS['12503'] = { kind:'any', on:'battle' }`（~2278 行）写的是 battle；
- 但真正驱动触发的是 `RESPONSE_EFFECTS['12503'].trigger.on = 'build'`（~1847 行），且 `fire_trigger()`（~1486 行）只读 `RESPONSE_EFFECTS`，完全不读 `CARD_TRIGGERS` 的 `on`；
- 此外 ~2265 行旧注释还写着"fire_trigger 用 on 字段过滤"，与重写后的逻辑相悖（误导性注释）。

**结论**：12503/12504 是"敌方建设后消灭"（build 触发），功能本身没错；问题在【配置/注释漂移】——`CARD_TRIGGERS.on` 是历史遗留的只读声明，改它不会改变任何触发行为。

**已修正**：
- 把 `CARD_TRIGGERS['12503'/'12504'].on` 从 `'battle'` 对齐为 `'build'`（仅消除阅读歧义，逻辑仍由 RESPONSE_EFFECTS 决定）；
- 重写 ~2265 行注释，明确"触发权威 = RESPONSE_EFFECTS，CARD_TRIGGERS.on 不参与逻辑"；
- 同步更正本文件把 12503/12504 描述为"bonus_battle 给额外行动（未接）"的过时条目（原 1621/1736/1756 行）。

**教训**：要改响应卡触发时点，只改 `RESPONSE_EFFECTS[faceId].trigger.on`（及对应 filter）。`CARD_TRIGGERS` 只对"能否主动打出"起作用（kind:'self'/'anytime'/'any'），它的 `on` 字段是展示用、可忽略。

### 2026-09-25 · R19：夺取制空权"未生效"——basic_targets 高亮漏了 air_host_check 与 my_air_pieces 过滤

**现象**：《空军力量》在空军阶段打出后，"部署空军"正常生效，但"夺取制空权"点了没反应（敌方空军没被移除）。

**根因**：`basic_targets` 的 `空军力量:seize` 分支（~3846 行，旧）只高亮"有敌方空军的地区"，**漏了两道与 `seize_air` 一致的过滤**：
1. `my_air_pieces(game, nation).length === 0` —— 玩家根本没有可调去夺取的空军；
2. `air_host_check(game, nation, i)` —— 夺取后本国空军要进驻目标地，目标地必须有本国补给中的陆/海军载体（"空军不能独立存在"，玩家 2026-09-22 明确）。

结果：客户端把"有敌方空军但本国无陆/海军载体"的地区也高亮出来了；玩家点下去后 `play_card('空军力量', {mode:'seize'})` → `seize_air` 的 `air_host_check` 拒绝，表现为"部署生效、夺取未生效"。对比 deploy 分支（~3741）本来就先 `air_host_check`，只高亮合法地区，所以部署点哪哪成。

**修法（已撤销，正确修复见 R20）**：初稿在此给 seize 高亮加了 `air_host_check(game, nation, i)`（目标地需本国载体），但 `seize_air` 对目标地要求载体本身是设计错误（见 R20）。加上该过滤后，"有敌方空军但无本国载体"的合法目标被全部滤掉，反而变成"显示无合法目标"（用户 2026-09-25 二次反馈）。R20 已撤销该过滤并修正 `seize_air`。

**已知限制（非本次修复范围）**：`play_card` 的 seize 分支用 `arg.piece || my_air_pieces(...)[0]`，即默认取第一支本国空军去夺取，客户端目前不在 seize 时让玩家选择用哪支空军。多支空军时对玩家而言是"自动选第一支"；如需指定需在客户端增加选空军流程（参考 move 分支的 pieces 列表）。

**教训**：把"执行方某条校验"复刻进高亮前，先确认该条校验本身符合玩法语义——`seize_air` 对目标地要求载体是设计错误，盲目复刻只会把合法目标藏起来。高亮与执行口径一致是对的，但前提是执行方的约束本身正确。

### 2026-09-25 · R20：夺取制空权重写——空战语义（移除敌机、本国飞机不进驻、发起机按相邻+补给自动选）

**现象（用户二次反馈）**：① 选"夺取制空权"时提示"无合法目标"，尽管场上明明有合法目标；② 即使生效，原实现把本国空军移动进驻了敌方地区——但用户明确：**夺取制空权不应让本国空军进驻**，且**整体思路与发起陆战/发起海战近似，发起与目标都是飞机而已**。

**两次错误根因**：
- 第一次（R19 初稿）：给 seize 高亮加了 `air_host_check(game, nation, i)`（目标地需本国陆/海军载体）。但夺取是空战，敌方地区通常无本国地面部队 → 合法目标全被滤掉 = "显示无合法目标"。
- 第二次（R19 修法/R20 初稿）：把载体检查从目标地改到本国飞机起飞地，并让本国飞机 `game.location[air_piece] = space` 进驻敌方地区。这仍错——用户要的是"空战 = 移除敌机、发起飞机不移动"，类比陆战发起单位不移动。

**最终修法（2026-09-25 三修，rules.js + play.js）**：用户明确"仿照陆战，应**先选发起单位、再选目标单位**"，且不要本国飞机进驻。于是把夺取制空权**整体接入陆战的 `battle_flow` 两步询问**，只是发起单位换成飞机：
1. 服务端新增 `air_initiators(game, nation, space)`：返回与目标相邻+补给的本国飞机（即 `battle_initiators` 的空军版），并在 `query` 分发与 `QUERY` 导出表注册。
2. 客户端 `on_space_click_for_card`：当 `pending_mode === 'seize'` 时，与战斗卡一样进入 `play_battle_card`（走 `battle_flow`）。
3. 点目标地区后，`ask_initiator_on_map` 对 seize 改调 `air_initiators`（而非 `battle_initiators`），高亮可发起的本国补给飞机；`show_initiator_choices` / `on_pick_initiator` 文案区分飞机/陆海军。
4. 玩家点发起飞机 → `battle_flow.from` → 再点敌机/目标 → `finish_battle_card` 发 `play_card({card:'空军力量', mode:'seize', space, from: 发起飞机})`。
5. 服务端 `play_card` seize 分支调 `seize_air(game, nation, space, arg.from)`：仅 `delete` 敌方飞机，**本国发起飞机留在原地不进驻**（与陆战发起单位不移动一致）；`arg.from` 不符相邻+补给时 `seize_air` 自动重选/拒绝。
6. `basic_targets` 的 `空军力量:seize` 同时返回 `spaces`（有敌机且存在相邻补给本国飞机的目标）与 `pieces`（该地的敌方飞机，供第二步点选）。

**完整闭环**：空军阶段打《空军力量》→ 选"夺取制空权" → 点敌方飞机所在地区（高亮）→ 点一支相邻补给的本国飞机（高亮）→ 再点该地敌机 → 敌方飞机消失、本国飞机不动 → 夺得制空权。

**已知限制**：① 同格（本国飞机与敌机同地区）不算"相邻"，按陆战口径不高亮，边缘情况；② 客户端 `send_action` 后不校验返回值，服务端失败仍会 toast"已打出"（见 R15 同类"点击无反应"）；③ 多支相邻补给飞机时由玩家手动选（不再自动取第一支）。

**教训**：
- 卡牌若需要"选发起单位 + 选目标"的两步交互，**直接复用陆战成熟的 `battle_flow`/`play_battle_card`/`finish_battle_card` 状态机**，按模式分流用 `air_initiators`/`battle_initiators`，别自己另写一套自动选取（初版自动选第一支飞机正是"无响应/行为不符"的根源）。
- "夺取制空权"本质就是**空战**，与"发起陆战/海战"同构，只是发起/目标都是飞机。
- 卡牌效果要"发起单位不移动"时，删 victim 即可，**不要**顺手把发起单位 set 过去——那是"进驻/调度"才有的动作。
- "空军不能独立存在"只在空军**停留在某地**时约束它所处之地；空战只移除敌机、本国飞机不挪窝，就不触发该约束。

**补：2026-09-25 三修后仍"只高亮敌方不亮我方、选中敌方无效"的真正根因（致命但隐藏）**：
接上版（接入 battle_flow 两步流程）后实测仍异常，`air_initiators` 查到本机 dbg_4，但 `play_card` 发出即无效。抓日志定位两个**客户端漏接**的点（服务端逻辑是对的）：
1. **`on_reply` 漏了 `air_initiators` 分支**：只有 `if (q === "battle_initiators") show_initiator_choices(...)`，没有 `air_initiators` 的处理。于是 `air_initiators` 回包后没人调 `show_initiator_choices`，**本机飞机永不高亮、也不出选择框**——这就是"只高亮敌方不亮我方"。
2. **选卡阶段 `on_piece_click` 对 seize 直接 `send_action(play_card, {piece: 敌机})`**：原 `if (is_battle_card(pending_card)) play_battle_card(...)` 不含 seize 模式，导致点敌机时绕过两步流程、把敌机当 `arg.piece` 直接发，而服务端 seize 要的是 `arg.from`（发起机），收到的是 `piece=敌机` + 无 `from` → 直接 `return {ok:false,'未指定发起空战的本国飞机'}`（客户端不回显，看起来"无效"）。
**修法（play.js）**：① `on_reply` 加 `if (q === "air_initiators") { if (!battle_flow) return; show_initiator_choices(params||[]); return }`；② `on_piece_click` 的选卡分支把 `is_battle_card(pending_card)` 改为 `is_battle_card(pending_card) || pending_mode === 'seize'`，让 seize 点敌机也进 `play_battle_card`。

**终极教训**：把卡牌接入 `battle_flow` 时，**客户端三处都要同步改**——`on_space_click_for_card` 路由、`on_piece_click` 选卡分支、`on_reply` 的 initiator 查询回包处理。只改前两处、漏掉 `on_reply`，就会出现"服务端查回候选但客户端不消费"的幽灵 bug，且因 `send_action` 不回显失败而极难察觉。

**补2：选完我方飞机后，再点本国飞机被陆战"空军不可攻击"逻辑误伤**：
用户反馈"选中我方飞机有，黄色框显示空军不能作为被选中的单位"。定位：选完发起单位后 `battle_flow.step` 变 `"target"`，此时再点本国飞机会落到 `on_click_piece` 的 `battle_flow.step === "target"` 分支，其 toast 是**陆战文案**"该算子不能作为攻击目标（空军不可攻击，也须先选发起单位）"——但空战里发起单位与目标都是飞机，点本国飞机应是"重选发起单位"，不该报错。另外 `on_pick_initiator` 成功后提示框写的"空军不能作为攻击目标"在空战里同样误导（空战目标就是敌机）。
**修法（play.js）**：① `on_click_piece` 的 target 分支增加 seize 特判——若点的是本国飞机（`battle_flow.initiators` 包含），调 `on_pick_initiator` 重选发起单位；否则 toast"请选择要夺取的敌方空军"。② `on_pick_initiator` 成功后提示框对 seize 改为"请点击敌方空军来夺取制空权"。③ 在 `on_pick_initiator` 内补 `const isSeize = (pending_mode === 'seize')`（之前 `seizeBox2` 引用了未定义的 `isSeize` 会报 ReferenceError）。

**终极教训（叠加）**：把"空战"接入陆战 `battle_flow` 时，**所有带"空军不能发起/不能作为目标"的文案与拦截都要按模式翻转**——陆战里空军既不能发起也不能当目标，但空战里发起单位=本国飞机、目标=敌机（都是飞机）。凡看到"空军不可"字样的分支，问一句"空战模式下这句还成立吗"，不成立就按 `pending_mode === 'seize'` 改文案/改路由。

**补3：真正拦截点是 action 入口的 `has_legal_target` 预检，而非 play_card 分支（致命、隐藏最深）**：
前面几轮改了 `basic_targets` 高亮和 `play_card` 的 seize 分支，但实测仍"选择敌方空军后未能移除"。用临时 node 脚本走完整 `action('play_card', {card:'空军力量实例id', mode:'seize', space, from})` 链路，日志报 `【英国】《空军力量》无法执行：没有可夺取制空权的地区（敌方空军不在本国陆/海军可进驻的地区）`。追到 action 入口（~6812 行）：**先** `has_legal_target(game, nation, c, arg)` 预检，**预检失败直接 return，根本轮不到 `play_card` 的 seize 分支**。`has_legal_target` 的 seize 分支（3476-3489）还在用旧约束——`enemyAir && air_host_check(game, nation, i).ok`（要求目标地有本国陆/海军载体），即最初被否定的"空军进驻"逻辑。所以前面改 `play_card` 形同虚设，真正的 bug 在入口预检。
**修法（rules.js）**：把 `has_legal_target` 的 seize 分支改成与 `seize_air` 一致——"有敌方飞机 + 相邻有本国补给飞机即可"，去掉目标地 `air_host_check` 载体约束，reason 改为"需存在相邻且处于补给状态的本国飞机，且该地区有敌方空军"。
**实证**：临时脚本构造（英国手牌含 `15304#2`、dbg_4 强制补给、dbg_5 在西欧、dbg_4 在相邻北海）→ action 后 `enemy dbg_5 removed? true`、`dbg_4 still at 17? true`、日志"夺取 西欧 制空权（移除敌方空军）"。完整链路打通：预检 → play_card → seize_air 移除敌机、本国飞机不动。

**终极教训（叠加）**：改一张卡的执行逻辑时，**不仅要看目标函数（play_card 各 case），还要查它在 action 入口是否被 `has_legal_target` 之类的预检提前拦截**——预检失败直接 return，后续所有改动都不会被触发；且客户端 `send_action` 不回显失败，表现为"点了没反应/无效"。凡卡牌有 mode 分流，预检里对 mode 的分支也要同步刷新。

### 2026-09-25 · R15：多步事件卡（如 15324 荷属东印度）点击无反应——客户端/服务端空间参数契约不匹配

**现象**：玩家打 15324，地图正确高亮"征召地点"，但点击高亮地点后毫无反应（服务端反复回 need:'space'）。

**根因（契约错配，非一次性手滑）**：
- 服务端 `event_card_needs` 对多步卡（total>1）返回 `step:i`，`pick_space_for(arg,i,total)` 在 total>1 时只读 `arg.spaces[i]`；
- 旧客户端 `on_click_space` 只发单值 `arg.space`（没带 `spaces` 数组）；
- 结果：服务端永远读不到选中的地区 → 高亮照常、点击无效。这是【多步事件卡从一开始就没在客户端接好】的系统性缺口，不是某次提交改坏——单步事件卡因 `total===1` 走 `arg.space` 分支所以一直正常，多步卡从未工作过。

**解法（在客户端，不在服务端）**：`on_click_space` / `confirm_event_done` 按 `pending_event_targets.step` 发送 `arg.spaces[step]`（其余下标留 null）。服务端 `pick_space_for` 与 `event_card_needs` 不动。
- ⚠ 不要给 `pick_space_for` 加 "arg.space 回落"：会让 step0（如南海海军位）被回落成玩家选的陆军位，报"只能建在海域"。

**教训（给后续修改者）**：改事件卡交互时，先分清单步/多步：
  - 单步 → 客户端发 `arg.space`；
  - 多步 → 客户端必须按 `pending_event_targets.step` 发 `arg.spaces[step]`。
  契约见 `pick_space_for`（rules.js ~2411）与 `event_card_needs`（~2339）的注释；客户端实现见 play.js ~2869-2881 / ~2900-2917。

### 2026-09-25 · R12：响应卡拦截/事后分类错配，导致事后类卡被过滤掉

**现象**：第 3 步把"移除前保护"卡（15330/15332/15334/15337）改为**事后还原**后，
响应卡死活不进 `response_queue`。测试 T3（15337）一直 `入队?false`。

**成因**：`request_responses(on, ctx, pre)` 按 `RESPONSE_PRE_CANCEL` 集合区分两类——
`pre=true` 只保留集合内、`pre=false` 只保留集合外。
而 `RESPONSE_PRE_CANCEL` 仍含 `15330/15332/15334/15337`，于是这些卡在调用
`request_responses(..., false)`（事后类分支）时被 `!RESPONSE_PRE_CANCEL.has(...)` 过滤掉，
永远入不了队。

**解法**：既然 15330/15332/15334/15337 已改为"先移除、触发后还原"，它们就是**事后类**，
从 `RESPONSE_PRE_CANCEL` 移出，**仅保留 `15329`**（真正的 play_card 生效前拦截）。
`request_responses(..., false)` 即可正常收集它们。

**教训**：当一张卡的"结算时机"从"动作前"改成"动作后"时，必须同步改 `RESPONSE_PRE_CANCEL`
分类，否则它会被自己的过滤条件排除。分类维度（pre/cancel）与实现时机必须一致。

### 2026-09-25 · R13：跨阵营响应卡——锁住当前方 + 让权给持有方 + 结算后交还

**现象**：玩家桌面有《国士警卫队》15331（同盟国持有），敌方（轴心国）在自己回合于不列颠建设陆军触发该卡后，游戏卡死——敌方无法结束回合，也看不到任何发动响应的时机。

**成因**：第 3 步照搬战斗挂起逻辑，在 `exports.action` 顶部写
`if (game.response_queue.length && action!=='trigger_response' && action!=='pass_response') return 原样挡下`。
这会**无条件**阻塞当前操作者。但响应卡的持有方可能是**对方阵营**（15331 由"敌方建不列颠陆军"触发），此时：
- 当前操作者 = 触发方（敌方）被挡，连 `next_phase` 都做不了；
- 触发框 `view.pending_trigger` 只暴露给 `head.owner_side`，敌方看不到；
- 单会话热座下两者指向同一屏 → 永远解不开，死锁。

**设计（用户拍板）**：跨阵营响应**应当锁住**触发方，但要把操作权**让给持有方**去决定，决定完再**交还**触发方继续其回合。网络游戏里持有方会在自己的会话即时看到框；热座里则靠"切换操作者"流转。

**实现**：
- `request_responses()`：入队后，若 `owner_side !== 当前操作者阵营`，则
  - 记 `game.response_return_active = game.active`（原操作者角色）；
  - 把 `game.active` 翻到持有方角色（`ALLIES_ROLE`/`AXIS_ROLE`）。
  - 若 `owner_side === 当前操作者`（同阵营/自己触发，如 15336 友方陆战触发），则不翻、就地决定。
- 全局拦截恢复为：**队列非空即一律阻塞**非响应动作（拦截/触发/`__debug` 除外）——因为让权已把界面切到持有方，触发方在界面上本就非活跃，不会再死锁。
- 新增 `response_reconcile_active(game)`：在 `trigger_response`/`pass_response` 的 `shift()` 之后调用——
  - 队列还有后续（链式）→ 让权给队首持有方（链式响应会再次让权，response_return_active 只在首次设置）；
  - 队列空了 → 若 `response_return_active` 有值，把 `game.active` 交还并清空。
- 客户端：同盟国（持有方）视角 `view.pending_trigger` 非空、actions 带 `trigger_response/pass_response`；轴心国（被锁方）`is_my_turn=false`、看不到框。

**验证**：临时测试 `_test_resp_yield.js`（已删）全过——15331 由同盟国持有、轴心国建不列颠陆军 → `active` 翻到 Allies、`response_return_active='Axis'`；轴心国 `next_phase` 被拦截、看不到框；同盟国看得到框且能 `trigger_response`；结算后 `active` 交还 Axis、队列清空、`response_return_active` 清空；轴心国随即可继续（`next_phase` 不再被拦）。原 7/7 测试无回归。

**教训**：响应卡与战斗的本质区别是——**持有方可以是对方**。正确做法是"锁触发方 + 让权给持有方 + 结算后交还"，而非"无脑阻塞"或"放行触发方"。`game.active` 翻转即驱动客户端切换到持有方回合；链式响应靠 `response_reconcile_active` 反复让权，原触发方只在整条队列清空后才收回操作权。

### 2026-09-25 · R14：响应卡框始终不弹出（render_ask_box 签名错配）

**现象**：跨阵营响应正确锁住了轴心（active 翻到同盟），但切到同盟国视角也不见任何"发动/不发动"框。服务端 `view.pending_trigger` 经查是正确的（持有方视角非 null），客户端 `update_pending_trigger_box` 也被正常调用，框却不出来。

**成因**：`render_ask_box(title, text, options)` 是**三参**签名（`title`=标题、`text`=正文串、`options`=按钮数组）。但 `update_pending_trigger_box` 当初写成
`render_ask_box(html, { buttons: [...] })`——把整段 HTML 当 `text`、把 `{buttons:[...]}` 当 `options`。
进到 `render_ask_box` 里 `if (!options || !options.length)`：`options` 是 `undefined` → 条件成立 → 直接 `box.classList.add("hide")` 并 `return`。于是框永远被隐藏。
（战斗挂起框 `update_pending_battle_box` 一直用正确三参签名，所以只有响应框中招；其它框也都没问题。）

**解法**：把响应框改成 `render_ask_box(title, text, optionsArray)`：`title='响应卡等待决定'`、`text='是否发动《…》？（于 …）'`、`options=[{label:'发动响应',cls:'primary',onClick},{label:'不发动',onClick}]`；清理分支用 `render_ask_box(null, null, null)` 隐藏。

**教训**：调用共享的 `render_ask_box` 时务必对照其 `(title, text, options)` 三参签名，不要自创 `{buttons}` 这种两参对象写法——`options` 一旦是 falsy 会被函数当作"无内容"直接收起框，且静默无报错，极难从现象反推。需要多行富文本时应在 `text` 里拼好，而非把结构塞进第二参。

### 2026-09-23 · 恢复"发起方抵消"：删代码前先确认它不是另一条规则

**现象**：核对规则书时发现 `easy_rule` 七是**两句连着**的：

```
- 当与空军位于同一地区的本国部队被发起战斗时，
  可以移除此空军来代替移除受到攻击的部队
  - 然后，战斗的发起方可以移除 1 支相邻的空军来抵消此效果
```

但代码里只有第一句（代受），第二句（抵消）连同 `counter_air`、
`counter_airs` 查询在 2026-09-22 被整个删掉了。

**为什么会误删**：当时的语境是玩家说明
"**是否用空军代受由防守方决定**"（纠正旧实现里发起方替防守方决定的 bug）。
这个纠正本身是对的，但顺手把"发起方抵消"也一并删了 ——
把"决策归属"和"有没有第二步"当成了同一件事。

**结论**：
> 1. **删代码前先回原文确认它对应的是哪一条规则。**
>    两条规则写在相邻两行、主语又正好是攻守双方，
>    极易被当成"同一件事的两种说法"。
> 2. 认清区别：
>    - "代受由**防守方**决定" → 说的是**决策归属**
>    - "发起方可以移除空军**抵消**" → 说的是**还有第二步**
>    二者正交，改前者不需要动后者。
> 3. 恢复后的形态是**两阶段挂起**（`stage='defend'` → `stage='counter'`），
>    详见 `docs/air-combat.md`。

### 2026-09-23 · 挂起对象在校验失败后丢失（战斗悬空）

**现象**：发起方选了一支**非法**的空军去抵消，
`do_battle` 返回 `{ok:false}`，但**挂起已被清掉** ——
这一战谁也结不掉。

**成因**：清理语句排在校验**之前**：

```javascript
game.pending_battle = null        // ← 先清了
if (defend_air != null) {
    if (!counterOpts.some(...))
        return { ok: false, ... }  // ← 这里失败时，已经没有挂起可回退
}
```

**修法**：把构造挂起对象抽成 `make_counter_pending()`，
在校验失败的分支里 `game.pending_battle = make_counter_pending()`
**放回去**，让发起方重选。

**结论**：
> 1. 与通用教训 2「清理须排在校验之后」完全同源 ——
>    **凡是"先清状态、再校验"的写法，校验一失败就把自己逼进死路。**
>    正确顺序永远是：**校验 → 通过后才改状态**。
> 2. 多阶段流程里，"回退到上一阶段"是**必须**实现的一条路径，
>    不能只想顺利路径。
> 3. 把"构造挂起对象"抽成函数，能让"新建"和"放回"共用同一份代码，
>    避免两处字段越写越不一致。

### 2026-09-23 · 用 `my_nation` 比国家名，会漏掉非"首国"的等待方

**现象**：战斗挂起时，等待方若不是本方阵营**排最前**的那个国家，
它的界面上**根本不显示**询问面板。

**成因**：

```javascript
const pendingBattle = (pb.defender_nation === my_nation) ? pb : null
```

`my_nation` 是"本方阵营在行动顺序里排最前的国家"
（轴心 = 德国、同盟 = 英国）。于是：

- 等意大利（轴心）→ `my_nation` 是德国 → 不匹配 → 意大利方看不到
- 等日本（轴心）→ 同上
- 等法国（同盟）→ `my_nation` 是英国 → 不匹配

**修法：按阵营比较**

```javascript
const wait = pending_wait_nation(pb)      // 两阶段等待方不同，别写死
return (faction_of_nation(wait) === side) ? pb : null
```

**结论**：
> 1. **同一阵营只有一个玩家位**，所以"该不该显示"永远该按**阵营**判定，
>    不该按国家名。
> 2. `my_nation` 只在"代谁出手"这类场景里有意义（它是代表国），
>    不要拿它当身份过滤器用。
> 3. 这类 bug 只在**非首国**当等待方时才暴露 ——
>    测试要专门造一个"意大利防守"的用例（见 `test_counter_air.js` §14），
>    否则永远发现不了。

### 2026-09-25 · 配置表里的 `const` 有 TDZ：调用 `space_ids_of()` 的表要放在 `PLACE_ALIAS` 之后

**事故**：把 `ECHO_EFFECTS` 定义在 `PLACE_ALIAS` **之前**，启动即崩：

```
ReferenceError: Cannot access 'PLACE_ALIAS' before initialization
```

**成因**：配置表里直接调用 `space_ids_of([...])`，
它读 `const PLACE_ALIAS`。而 `const`/`let` 有**暂时性死区(TDZ)** ——
`function` 声明会提升，但 `const` 的值不会。
所以函数**调用**发生在 `const` 初始化之前就炸了。

**结论**：
> 1. **凡在配置里调用 `space_ids_of()` / `space_id_of()` 的表，
>    一律放在 `PLACE_ALIAS` 定义【之后】**（`EVENT_EFFECTS` 同理）。
> 2. 记住区分：`function` 声明整体提升，可提前调用；
>    `const`/`let` **只提升声明、不初始化**，提前访问必抛 TDZ 错误。
> 3. 这类错误**只在模块加载时**暴露，跑测试前 `node --check` + 一次
>    `require` 就能立刻发现，不用等跑完整套。

### 2026-09-25 · 测试里改了共享状态（turn_phase 等）必须还原

**事故**：我在用例里把 `g.turn_phase` 设成 `'scoring'` 验证增强卡，
**没有还原** —— 后面"状态卡配额校验"的用例就在 scoring 阶段跑了，
行为与期望不符，报了个**看起来毫不相关**的失败。

**结论**：
> 1. 测试里改 `turn_phase` / `current_nation` / `active` 这类**共享状态**，
>    块结束前必须还原，或每个用例用全新的 `fresh()`。
> 2. 这类 bug 的特征是：**失败项与改动的代码毫无关系**，
>    排查时容易往错误方向使劲。
>    遇到"莫名其妙失败"先想：前面的用例是不是污染了状态？

### 2026-09-24 · 校验函数成功时也要带齐字段，否则调用方拼出 `undefined`

**事故**：部署空军的日志显示
`在不列颠部署 1 支空军（undefined）`。

**成因**：`air_host_check()` 成功时只返回 `{ ok: true }`，**没有 `reason`**。
而 `build_piece()` 在 air 分支里 `why = host.reason`，
再往外传；`resolve_basic_card` 又把 `r.reason` 拼进 desc：

```javascript
return { ok: true, desc: '...部署 1 支空军（' + r.reason + '）' }   // -> （undefined）
```

**结论**：
> 1. **校验函数成功时也要把调用方会用到的字段补齐**
>    （这里是 `reason`，用于生成说明文案）。
>    失败路径的字段大家都会写，成功路径最容易漏。
> 2. 同类问题已在 `can_build_at` / `can_recruit_at` 上处理过
>    （它们成功时返回 `reason: '本国大本营'` / `'征召'`），
>    `air_host_check` 是漏网之鱼 ——
>    **同族的校验函数要统一返回结构**。
> 3. 这类"文案里出现 `undefined`"是肉眼最容易发现的，
>    但**只在特定分支才触发**（空军部署），
>    所以测卡效果时要**每个 mode 都跑一遍**，不能只测主路径。

### 2026-09-24 · 重新生成会覆盖手改：改生成物的源头，不要改生成物

**事故**：`cards.js` 头部写着"由 gen_module_cards.js 自动生成，请勿手改"。
但我之前为了修正卡牌类型（15305–15312 → EFFECT、12503/12504 → RESPONSE）
和 `CARD_TYPE_INFO.EFFECT` 的描述，**直接手改了 cards.js**。

这次为了改两张卡的卡面文本，我重新跑了生成脚本——
**类型修正和描述修正全部被覆盖回旧值**，幸好发现及时。

**结论**：
> 1. **凡是标注"自动生成"的文件，一律改它的源头**，然后重新生成。
>    本次正确的链条是：`out/uk_cards.csv`（类型列 + 文本列）
>    + `tools/gen_module_cards.js`（TYPE_INFO 定义）
>    → 重新生成 `cards.js`。
> 2. **重新生成前先想清楚：我手改过生成物吗？**
>    把手改内容迁移到源头后再生成，否则静默丢失。
> 3. 判断"这文件是不是生成的"：看文件头注释。
>    没注释的，看 git 历史里有没有"regenerate"类提交。

### 2026-09-24 · 生成字段是"裸文件名"还是"带目录路径"，消费方必须对齐

**事故**：预览页直接用 `src="c.img"`，控制台 15 个 404。

**成因**：`gen_module_cards.js` 第 73 行
`img: img.replace(/^.*\//, "")` 把 CSV 里的 `cards_sliced/xxx.png`
剥成了**裸文件名** `xxx.png`（注释写明"对应模块 cards/ 目录"）。
而图片实际复制到了模块的 `cards/` 子目录。

消费方必须自己补前缀 —— 游戏里 `play.js` 的
`card_image_url(c)` 就是 `"cards/" + c.img`。

**结论**：
> 1. **消费生成字段前，先看生成脚本怎么处理的**（剥没剥前缀、转没转义），
>    不要假设"字段值就是最终可用的路径"。
> 2. 同一字段的消费方要**统一走一个取值函数**
>    （游戏里是 `card_image_url`），不要各写各的字符串拼接。
>    预览页当初就该复用同样的规则。
> 3. 404 是这类问题最好的报警器 ——
>    页面做完用浏览器打开看一眼 console，
>    比肉眼检查 HTML 靠谱得多（本次就是 playwright 的 console 抓到的）。

### 2026-09-24 · 规则定义会变：已实现的规则被重新定义时，要连带改测试与文档

**背景**：消灭（`eliminate_piece`）在 2026-09-23 定义时，我按"`do_battle` 的简化版"
来写，于是让它**也触发参战**（`maybe_end_neutral_by_attack`）。
2026-09-24 玩家重新定义：

> "触发消灭时，如果有和被消灭单位同国空军在一起，则一起消灭。
>  若被消灭方中立，**不会触发参战**"

**为什么容易错**：消灭与发起战斗的**前半段几乎一样**
（找敌方部队、校验、移除），差别只在后半段的连带规则与参战语义。
我当初照着 `do_battle` 抄，就把不属于消灭的参战语义也抄了过来。

**结论**：
> 1. **新规则不要照抄相似规则的语义**，逐条确认"这条适不适用"。
>    消灭 vs 发起战斗的差别表：
>
>    | | 发起战斗 | 消灭 |
>    |---|---|---|
>    | 需要相邻发起单位 | 是 | **否** |
>    | 检查发起单位补给 | 是 | **否** |
>    | 受中立限制 | 是 | **否** |
>    | 连带消灭同国空军 | 否（走代受） | **是** |
>    | 被攻击方中立时参战 | **是** | **否** |
>
> 2. 规则被重新定义时，**三处必须同步改**：
>    实现、测试（含反向对照用例）、文档。
> 3. 补一条**对照用例**把"这里和别处不一样"锁住
>    （这次加了 `7.6–7.8`：消灭不参战 vs do_battle 会参战），
>    否则将来有人"顺手统一"就会破坏正确行为。

### 2026-09-24 · 连带效果要区分【同国】与【同阵营】

**场景**：消灭的连带规则写"和被消灭单位同国空军一起消灭"。

**坑**：容易写成"同阵营"。但**法国空军只跟着法国部队走**，
不会因为同属同盟就替英国部队陪葬。

**结论**：
> 凡是"跟着某部队一起受影响"的效果，一律用**国籍**匹配
> （`piece_nation[p] === vNation`），不要用阵营
> （`faction_of_nation(...) === ...`）。
>
> 这与 `do_battle` 的代受判定（`air_nation`）是同一个口径 ——
> 空军与部队的绑定关系始终按**国家**算，不按阵营。
>
> 测试要覆盖"同阵营不同国不受牵连"这一条，
> 否则用错 `faction_of_nation` 也能通过大部分用例。

### 2026-09-24 · 卡的类型决定【时机语义】，效果像≠能合并实现

**事故**：v1.0 把 23 张卡当"事件卡"一起实现，其中混进了
**15305–15312 这 8 张，它们其实是【↑ 增强卡(ECHO)】**。
原因是它们的效果文本（"在 X 征召 1 支陆军"）与事件卡**长得一样**，
我就默认按同一套逻辑实现了。

**为什么错**：卡的类型决定的是**时机语义**，不是效果形式：

| 类型 | 时机 |
|---|---|
| 事件卡 `!` | 出牌阶段打出，**占**出牌名额 |
| 增强卡 `↑` | **对应时机**打出，**不占**名额 |

效果文本相同，但"什么时候能打、打完算不算用过出牌机会"完全不同。
按事件卡实现增强卡，会让它在错误的时候可用、且错误地占用名额。

**结论**：
> 1. **先看图标定类型，再决定怎么实现**。
>    效果相似不能作为合并的依据。
> 2. 不同类型的卡，即使底层操作相同，也应有**各自的配置与执行入口**
>    （如 EVENT 用 `EVENT_EFFECTS`，将来 ECHO 用 `ECHO_EFFECTS`），
>    只在**原子操作层**复用。
> 3. 这正好引出下面这条通用做法 —— 分层复用。

### 2026-09-24 · 分层复用：共享逻辑放原子操作层，用组合而非继承

**需求**（玩家）："每类卡如果有相同的底层逻辑的话，应该继承或者复用函数"。

**做法**：拆成三层，底层用**函数组合**而不是类继承：

```
卡类型层      BASIC / EVENT / ECHO / RESPONSE / STATUS / ECON
                ↓ 各自的时机语义
配置+执行器    EVENT_EFFECTS + resolve_event_card
                ↓ 调用
原子操作层    can_build_at / build_piece
              can_recruit_at / recruit_piece
              eliminate_piece
              do_battle / seize_air
              grant_supply
```

**为什么不用类继承**：
> 1. 原子操作都是**无状态纯函数**（`game` 作为参数传入），
>    直接调用比 `class + extends` 简单得多。
> 2. 继承会引入 `this` 绑定、原型链、构造顺序等一堆与本问题无关的心智负担。
> 3. 配置驱动（声明式）比继承更灵活：
>    新增一张卡只需**加一条配置**，不用新建一个类。

**关键约束**：
> - 新增任何卡类型**不要**重新实现"征召/建设/消灭/战斗"，一律调原子层。
> - 原子层的规则细节（征召不要求邻接补给、消灭不受中立限制…）
>   **只维护一份**，改一处全局生效。
> - 各类型只在**时机判定**上分叉（是否占名额、何时可打）。

### 2026-09-25 更正 · 图片能读：识别卡图要换 **glm 5.3**（平时用 hy4 preview）

**【用户约定】**
> 要求识别图片时，**提醒用户把模型换成 glm 5.3**；
> 日常编码/规则实现等普通任务用 **hy4 preview**。

**更正前一条记录**：我在 2026-09-23 写过一条
"本模型读不了图片：别把推断当成观测"，**那条结论是错的**。
事实是：切换到 glm 5.3 后，`read_file` **能正常显示卡图**，
卡面文字可读 —— 我用它核对了 8 张增强卡，
发现 `cards.js` 里的 OCR 文本**全部有错**（15305 更是完全无关）。
这些读出的结果是真实观测，不是编造。

当初真正犯的错其实只有**一个**，与"读不读得了图"无关：

> 我凭印象**重猜了图标→类型的映射**，把 `↑` 说成事件卡，
> 而 `docs/card-icons.md`（你 2026-09-21 已确认）白纸黑字写着
> `↑`=增强卡、`!`=事件卡 —— 正好相反。
> 那份文档就在仓库里，我没先查。

**结论（修正版）**：
> 1. **需要读卡图文字时：先提醒换 glm 5.3，再用 `read_file` 读。**
>    不要因为一次失败就断定"永远读不了"，
>    更不要把编造的内容当成观测汇报。
> 2. **判定图标类型可以双保险**：
>    像素分析（`tools/analyze_icons.ps1`，可靠、可批量）+ 读图确认。
>    本次两者结论一致（8 张均为 `↑` 增强卡）。
> 3. **遇到不确定的既有约定，先查 `docs/`** —— 这条仍然成立，
>    也是那次事故的唯一根因。
> 4. 之前基于"读不了图"而作废的某些"文本修正"应重新用 glm 复核，
>    不要默认它们都是错的（已用 glm 重新核对 8 张增强卡并更新）。

### 2026-09-23 · 看到"异常数据"先找解释它的既有机制，别急着判为错误

**现象**：我看到 54 张卡里有 19 张提到法国、10 张卡名含"法国"，
却**全都标 `nation: "英国"`**，当场判定"这是数据错误"，还写进了汇报。

**真相**：不是错误。查 `delegate_of_nation('法国')` 返回 **`'英国'`** ——
**法国是委托给英国的**（`NATION_DELEGATE = {'法国':'英国', '中国':'美国'}`）。
法国部队由英国玩家操作，所以**英国牌组里包含自由法国的卡完全正确**。

更讽刺的是：这个代表团机制是**我自己之前实现的**，就摆在 `rules.js` 里。
等于我忘了自己写过的东西，然后把正确数据误判成 bug。

**结论**：
> 1. 看到"看起来不对"的数据，**先问一句：有没有既有机制能解释它？**
>    确认没有，再判定为错误。
> 2. 这个项目有大量会让表面数据"看起来不对"的设计：
>    **代表团（法国→英国、中国→美国）、中立（苏联/美国）、
>    动态补给点、代表团映射的 defender_nation vs victim_nation**。
>    遇到"异常"优先怀疑这些。
> 3. 判错之后的**代价**是双向的：既浪费时间去"修"正确的东西，
>    又会误导后续决策（我当时还顺带建议"做英国卡时顺手修这个"）。
> 4. 正确的问题不是"nation 是不是标错了"，而是
>    **"只提取了英国一国的卡图，其余 5 国尚未提取"** —— 这才是真缺口。

### 2026-09-23 · 规则书里"带前缀的条件"只约束它提到的那个东西

**场景**：规则书五章列了一组条件，其中两行带"**对于建设部队：**"前缀：

```
- 建设或征召陆军时只能选择陆地地区，...     <- 无前缀，共同条件
- 该地区不能有敌方部队、不能有本国部队       <- 无前缀，共同条件
- 对于建设部队：该地区必须位于本国大本营或邻接处于补给状态的本国部队
- 对于建设部队：置于该地区的新部队将会处于补给状态
```

我据此推断"征召没有位置要求、且新部队不保证补给"，玩家确认**正确**。

**结论**：
> 1. **前缀/限定语本身就是信息**。作者特意只在两行加前缀，
>    说明其余条件是共同的那两行的差别。不要当成行文啰嗦略过。
> 2. 这类推断要**找规则书之外的佐证**再下结论。
>    这次的佐证是卡牌本身：《史末资加强对英关系》
>    "在\<非洲南部\>征召陆军，**其在本回合内始终处于补给状态**"——
>    若征召默认就有补给，这句完全是废话。卡面文本常常是规则书的注解。
> 3. 拿不准就问（这次问了，省掉了 10+ 张卡的返工）。

### 2026-09-23 · 地区 id 凭印象填会填错

**现象**：`docs/straits.md` 里我把海峡记成"非洲北部 20、中东 33"，
实测 `data.id_of()` 是 **15 和 16**，全错。

**成因**：那时还没有 `docs/place-names.md`，id 是凭印象/二手引用填的。

**结论**：
> 1. **文档里的地区 id 一律以 `data.id_of()` 实测为准**，
>    不要凭印象，也不要从别的文档抄（抄的是别人的印象）。
> 2. 写涉及具体地名的代码/测试前，先跑一条命令把 id 打出来核对。
> 3. 已经有 `docs/place-names.md` 作为唯一权威来源，新增地名往那里加。

### 2026-09-23 · 测试里别写死自增的算子 id

**现象**：`place()` 用全局自增 id（`'p1'`、`'p2'`…），
跨用例累加。测试里写死 `g.location['p1']` 去断言，
第 17 组还在用 `'p1'`，实际早就递增到 `'p30'` 了 → 断言全部落空。

**结论**：
> 1. **用 `place()` 的返回值**，不要猜 id：
>    ```javascript
>    const german = place(g, '德国', 'army', SP('东欧'))
>    // ...
>    eq(g.location[german], undefined, '目标已被移除')
>    ```
> 2. 这类 bug 表现为"断言莫名其妙失败"，
>    而**被测逻辑其实是对的** —— 排查时先确认测试脚手架本身没问题。
>    这次 13 个失败里有 **5 个**是这个原因。
> 3. 配套教训：卡面地名（南非、缅甸）**不能用 `SP('南非')`**
>    （地图上没有，返回 null），要改用 `I.space_id_of('南非')` 走别名表。

### 2026-09-22 · 参战规则：德国"不邻接"莫斯科 / 美国周边全是非补给点

**现象**：写参战规则测试时，连续 3 个用例失败在"发起单位不处于补给状态"
或"与目标不相邻"，一度像是中立检查写错了。

**成因**：**是测试用例对地图的假设错了，不是规则错了。** 实际邻接表：

| 地区 | 真实邻接 |
|---|---|
| 德国(44,★) | 东欧、西欧、波罗的海、巴尔干、意大利 |
| 莫斯科(9,★) | 罗斯、中亚、西伯利亚、乌克兰 |
| 美国(27,★) | 加拿大、拉丁美洲、东太平洋、北大西洋 |
| 乌克兰(45,★) | 东欧、罗斯、莫斯科、中亚、巴尔干、黑海、中东 |

因此：
- **德国不邻接莫斯科**（要经乌克兰/罗斯中转）——以为"德苏接壤"就错了；
- **美国周边 4 个邻接地区全都不是补给点**，轴心无法从那里组织一次合法进攻，
  "美国被轴心攻击"这条**在真实地图上很难自然构造**。

**结论**：
> 1. 写涉及**具体地区**的测试前，先把邻接表打出来核对，
>    别凭"历史地理印象"推断（这个地图是把欧洲/亚洲压缩过的抽象版）。
>    一条命令即可：遍历 `data.spaces[i].connections` 打印 `name_of`。
> 2. 战斗类用例的**发起单位必须落在★补给点上**（或已连成补给链），
>    否则会先被"发起单位不处于补给状态"挡下，根本走不到被测逻辑。
>    测试里加个 `placeInSupply()` 辅助函数强制这个前提。
> 3. 当某个条件"在真实地图上难以构造"时，**降级为单元测试**
>    （直接测 `maybe_end_neutral_by_attack` 这类纯函数），
>    不要为了凑一个端到端场景而扭曲规则或硬塞数据。

---

### 2026-09-22 · 占领补给点却计分 +0（老存档缺 markers 字段）

**现象**：英国陆军占领不列颠（id=2，★补给点、大本营），
计分阶段英国得分显示 **+0**。

**排查过程**（值得记下来，是一条高效的定位路径）：
1. 先用 node 单独跑规则逻辑，排除"规则算错"的可能：
   ```js
   const R = require('.../rules.js')
   const g = R.setup(1)
   g.location['p1'] = 2; g.piece_nation['p1'] = '英国'; g.piece_type['p1'] = 'army'
   R._internal.phase_scoring(g, '英国')   // -> gained: 2，正确
   ```
   说明**规则本身没问题**。
2. 于是转向"数据"：直接读 SQLite 存档
   ```js
   const db = new Database('.../server-official/db', { readonly: true })
   db.prepare('SELECT state FROM game_state WHERE game_id = 8').get()
   ```
   一看 `Object.keys(state)` —— **没有 `markers`**。
   真相：这是计分功能上线**之前**建的旧对局。

**注**：命令行里带中文的 `node -e` 会被 PowerShell 编码破坏
（`'英国'` 变成 `鑻卞浗`，导致 `piece_nation` 匹配不上，误判为逻辑错误）。
**改用 `tools/*.js` 脚本文件**跑，避开编码问题。

**解法**：`rules.js` 新增 `ensure_markers(game)` 惰性迁移，
在 `exports.view` / `exports.action` / `exports.query` 的入口各调一次
（详见「通用教训 13」）。

**验证**：对 game 8 的真实存档跑一遍 `R.view(st, 'Allies')`，
`state.markers` 补齐 12 个地块，同盟明细为
`不列颠 英国+2`，与预期一致。

---

### 2026-10-09 · R12：凭记忆写死端口 → 卡牌预览打开的是 Steam 而非 RTT（同一问题反复复发）

**现象**：用户说"打开卡牌预览"，我直接用了
`http://127.0.0.1:8080/quartermaster-sub-wars/event-cards-preview.html`。
实际 **8080 是 Steam 的 `steamwebhelper.exe`**（不是 RTT），且当时 RTT 根本没在跑。

**用户质问（关键）**：
> "为什么会误入呢？我应该已经将该问题写入了 skill 和文档，但总是反复出现？"

**答案：知识没错，错在「放错了层」。四条结构性根因——**

**① 劣币驱逐良币（主因）**：同一事实散在三处，且给出**三个不同答案**：

| 位置 | 加载方式 | 写的端口 |
|---|---|---|
| memory `96600201` | **system prompt 自动注入，每轮必读** | `8080` ❌ |
| skill `rtt-atomic-operations` | 需主动加载 | `8090` ⚠️ |
| skill `rtt-pending-whitelist-deadlock` | 需主动加载 | `8091` ✅ |

错的那份在自动加载层（100% 读到），对的两份在按需层（这次没加载）。
**每轮读到哪份近乎随机** —— 这就是"反复"的机制。

**② 记的是结论（死端口），不是判据（如何查）**：
端口占用是**动态**的 —— Steam 未必开着、RTT 可能跑在 8080/8090/8091 任意一个。
本次真值是"RTT 没跑、Steam 占 8080"，跟三个快照**没有一个对得上**。
**快照必然过期，判据不会。**

**③ skill 触发条件是"症状驱动"不是"动作驱动"**：
`rtt-pending-whitelist-deadlock` 的 description 写的是「当出现…探活返回 HTTP=000 时」——
那是**事后**排查手册。而"打开预览页"是**事前**动作，语义上永远命中不了，于是没加载。

**④ 命令片段内嵌错误假设，复制即用即错**：
记忆给的 `Get-NetTCPConnection -LocalPort 8080` 把 8080 写死，
且**只有"查端口"、没有"验进程"**。我照抄执行，拿到结果就把
**"有监听" 等价于 "RTT 在跑"** —— 这是本次的直接动作失误。

**解法（已执行）**：

1. 修正 memory `96600201`：删除死端口，改为【服务器访问判据】四步
   （查 node 进程 → 无则自起 → 反查进程名 → `localhost` 探活）。
2. `rtt-atomic-operations` 的"当前端口 8090" → 改为判据指针。
3. `rtt-pending-whitelist-deadlock` 的 description **扩展为动作驱动**：
   明确「任何要访问 RTT URL 之前都要加载」；前置章节升级为
   「前置一：端口必须现场判定，勿凭记忆」。
4. 本文档 R11 增补 **R11.1** + 四步判据。

**【新通用教训】环境事实一律记「判据」，不记「结论」**

> 端口 / 路径 / 进程 / 账号 这类**会随环境变化**的事实，
> 记成结论（"当前端口 8090"）必然过期；散落多份时还会互相矛盾。
> **矛盾 + 自动加载层优先级 = 必然反复出错。**
> 判据的形式是「一条能现场跑出真值的命令 + 对结果的判定方法」。
>
> 推论：**只查端口不算查过** —— 必须反查进程名确认是 `node.exe`。

**自查**：任何一次"打开网页 / 探活"之前，是否跑过
`Get-CimInstance ... 'server\.js'`？**没跑就直接写 URL = 违反本条。**

**验证**：修完后重查 8080 → `steamwebhelper.exe`（确认不是 RTT）；
无 `node server.js` 进程 → 用 `RTT_PORT=8091` 自起（监听 8091）；
`http://localhost:8091/quartermaster-sub-wars/event-cards-preview.html` 成功打开。

---

### 2026-10-09 · R13：增强卡（EFFECT）配置写错表 → 静默"效果尚未实现"

**现象**：意大利增强卡 17707/17709/17710 配好后，单元测试（直接调 `ECHO_EFFECTS[id].steps[0].run`）全过，
但一走端到端 `play_card` 就失败：
```
[ECHO server] resolve r= {"ok":false,"reason":"《意大利皇家海军司令部》的效果尚未实现"}
```

**根因**：`card_effect_of()`（rules.js ~9898）**按卡类型分派**：

```js
function card_effect_of(card_id) {
  const c = inst_card(card_id)
  if (c.type === 'EVENT')  return EVENT_EFFECTS[String(c.id)] || null
  if (c.type === 'EFFECT') return ECHO_EFFECTS[String(c.id)]   || null   // ←
  return null
}
```

我误把三条 EFFECT 配置写进了 **`EVENT_EFFECTS`**（插入点行号 6552 落在
`EVENT_EFFECTS` 区间 5606–6612 **之内**，看行号容易误判成"在后面那张表里"）。
EFFECT 类型查 `ECHO_EFFECTS` → 取不到 → 报"效果尚未实现"。

**为什么难发现**：自测脚本里我写的是 `I.EVENT_EFFECTS['17707']`，
**正好拿到自己刚写进去的那份** → 12 项前置断言全绿，掩盖了"引擎其实取不到"。
端到端那一条才是照妖镜。

**解法**：
1. 三条配置迁到 **`ECHO_EFFECTS`**（放在苏联 17807《里海舰队》上方，并加注释说明原因）。
2. 测试改为查 `I.ECHO_EFFECTS`，并加【反向断言】
   `ok('17707 不在 EVENT_EFFECTS（防写错表）', !EV['17707'])`，
   再直接断言 `card_effect_of('17707#1')` 能取到 —— 用引擎的真实入口验证，而不是用自己写的表。

**【新通用教训】自测要用「引擎入口」，不要用「自己写的那份表」**

> 断言"配置存在"时若查的是**自己刚写入的同一个对象**，等于没验证 ——
> 引擎可能走完全不同的分派路径（本项目：`card_effect_of` 按卡类型分派到
> `EVENT_EFFECTS` / `ECHO_EFFECTS` / `RESPONSE_EFFECTS` / `STATUS_EFFECTS` / `ECON_CARDS`）。
> 正确做法：
>   ① 断言**引擎入口**（`card_effect_of` / `econ_config_of` / `status_config_of`）能取到；
>   ② 加**反向断言**确认没写进相邻的那张表；
>   ③ 必须有**一条端到端**用例（真实 `play_card`），只测配置对象不够。
>
> 推论：**看行号判断"在哪张表"不可靠** —— 用表名的 `const` 声明行确认区间边界
> （本项目：`EVENT_EFFECTS` 5606 / `ECHO_EFFECTS` 6612 / `RESPONSE_EFFECTS` ~8841）。

**验证**：`tools/_smoke_italy_effect1.js` **30/0 全过**
（含端到端：经 `play_card` 打出 → `axis +1`、卡离手）。

---

### 2026-10-09 · R14：`set_supply_point` 阵营名大小写不归一 → 补给点静默失效（国家维度改动引入的回归）

**现象**：日本增强卡回归 `tools/_smoke_jp_effect.js` 出现
`✗ 找到第二个补给海域作为调度目标 [S2=null]`（PASS=124 / FAIL=1）。

**排查**：测试里 `carrierAt()` 的构造只用到
`mkGame` + `get_connections` + **`I.set_supply_point(g, nb, 'Axis', true)`** + `air_host_check`，
与本次新写的意大利卡无关 —— 说明是**更早的改动**引入的。

**根因**（两层叠加）：

1. `AXIS` / `ALLIES` 常量是**小写** `'axis'` / `'allies'`；
   但历史调用写的是 `'Axis'`（首字母大写）。
   加国家维度分支后，`'Axis' === AXIS` 为 **false**、也不等于 `ALLIES`，
   于是**误落进国家维度分支** → 写成 `ov.nations['Axis']`，
   而**阵营维度一个都没写**（`ov.axis` / `ov.allies` 均 undefined）。
2. `is_supply_point` 有这条（设计如此，防"仅对意大利"被同阵营他国拿到）：
   ```js
   if (hasNations && ov.axis === undefined && ov.allies === undefined) return false
   ```
   → 该地被判成**不是补给点**，对全阵营失效。

**为什么难发现**：意大利状态卡测试全过（那批用例都传**小写** faction），
只有日本这个测试传大写 —— 所以"我改完跑过的测试全绿"并不代表没回归。

**解法**：`set_supply_point` 比较前先 `toLowerCase()`，写回也用归一化后的键：

```js
const fl = (faction == null) ? null : String(faction).toLowerCase()
if (faction == null) { ... }
else if (fl === AXIS || fl === ALLIES) { ov[fl] = v }   // 阵营维度
else { /* 国家维度 */ }
```

**【新通用教训】新增"维度"分支时，先做输入归一化；且回归测试要覆盖【调用方的写法】**

> 给已有函数新增分支（国家维度 / 新枚举）时，
> 那些**没被新分支匹配到的旧值**会掉进兜底分支并改变语义 ——
> 本例是大小写不匹配导致"阵营值"被当成"国家名"。
> 改这类函数必须：
>   ① 先枚举**现有调用方实际传的值**（含大小写变体），写进归一化；
>   ② 回归要跑**所有**用过该函数的测试，不能只跑"本次改动涉及的那国"
>      （意大利用例传小写全绿，掩盖了日本用例传大写会挂）。
>
> 推论：**"我改完跑过的测试全过"≠ 没有回归** ——
> 要跑的是"被改函数的所有调用方"，不是"本次功能的相关用例"。

**验证**：修复后 `tools/_smoke_jp_effect.js` **PASS=132 / FAIL=0**
（S2 恢复，其下 8 项【调度】断言一并恢复）；
`_smoke_italy_effect1.js` 45/0、`_smoke_italy_status.js` / `_smoke_italy_response.js` /
`_smoke_italy_event.js` / `_smoke_econ.js` / `_smoke_status.js` 全绿、
`test_basic_cards.js` 297/0 无回退。

---

### 2026-10-09 · R15：`offer_armed_effects` 的"发起国==持有国"过滤 → 他人触发的卡永不触发（方案 A：watch）

**现象**：意大利三张卡按常规写法配好后**永远不弹窗口**：
- 17705「**德国**打出[潜艇行动]时」
- 17708「**成为**经济战目标时」
- 17711「**敌方**国家建设/征召/消灭时」

**根因**：`offer_armed_effects` 有这条硬过滤（rules.js ~7857）：

```js
const actorNation = ctx.nation
for (const nation of Object.keys(game.hands || {})) {
    if (actorNation && nation !== actorNation) continue   // ← 外层按 nation 过滤
    ...
}
```

要求**事件发起国 == 卡持有国**。三张卡的 `ctx.nation` 都是**对方**，
于是意大利手牌根本不在遍历范围内。

**为什么此前从未暴露**：德国那批"他人触发"的效果（15249/15251 等）
都写在 **STATUS 卡的 `react`** 里，不走 armed。而 `react` 的消费函数
`status_on_econ` / `status_on_attacked` **硬编码 `c.nation !== '德国'`**，
是德国状态卡**专用**机制 —— 意大利的 EFFECT 卡没法复用（这也是否决方案 B 的依据）。

**解法（玩家选定方案 A）**：给 `armed` 加 `watch: true`，并把过滤**下移到内层**：

```js
for (const nation of Object.keys(game.hands || {})) {
    for (const cid of (game.hands[nation] || [])) {
        const ar = eff && eff.armed
        if (!ar) continue
        if (!ar.watch && actorNation && nation !== actorNation) continue   // ← 内层判
        ...
```

改动约 3 行，**默认行为完全不变**（未声明 watch 的卡照旧）。
一次解决三张，且未来所有"他人触发"卡都能复用。

**配套扩展：`armed.when` 支持数组**（17711 要同时听四个窗口）：

```js
const whens = Array.isArray(ar.when) ? ar.when : [ar.when]
if (whens.indexOf(when) < 0) continue
```

**同时补了两个缺失的 armed 派发点**：
- `build_piece` 的 **army 分支** → `after_build_army`（此前只有 navy/air）
- `recruit_piece` → `after_recruit`（此前完全没有）

**【新通用教训】"卡配好了但不触发"先查【派发点】与【过滤条件】，两处都要查**

> armed 卡要触发必须同时满足三件事，缺一即静默永不触发
> （对应 pitfalls 通用教训 11「规则没写≠可以」+ 18「不在册=静默」）：
>   ① **`offer_armed_effects(game, window, ctx)` 在对应游戏事件处被调用**（派发点存在）
>   ② **窗口名匹配**（`ar.when === when`，现在也支持数组）
>   ③ **通过过滤**：默认要求"发起国==持有国"，他人触发必须 `watch:true`
>
> 排查顺序：`grep offer_armed_effects\(game,` 看有没有你的窗口 →
> 看 `ar.when` 拼写 → 看 `ctx.nation` 是不是自己。
>
> **推论**：`react`（STATUS 专用、硬编码德国）与 `armed`（ECHO/EFFECT、通用）
> 是**两套并存**的机制，命名相似但互不通用 —— 选载体前先确认消费函数是否硬编码了国家。

**验证**：`tools/_smoke_italy_effect1.js` **93/0**
（含 17705 五条边界：德国/非德国/非潜艇标签/无受击国/回归 15408；
17711 四个窗口逐个触发 + 五地范围正反 + 轴心不触发 + 损耗 2 张）；
全量回归 `_smoke_jp_effect` 132/0、`_smoke_italy_status/response/event` ALL PASS、
`_smoke_econ` / `_smoke_status` 21/0、`test_basic_cards` 297/0。

---

### 2026-10-09 · R16：`offer_armed_effects` 是【异步】的 —— 不能用来"执行前拦截"

**现象**：意大利 17708《皇家空军》卡面是「成为[经济战]目标时，移除 1 支空军：**不执行损耗**」。
我第一版把 `offer_armed_effects(game, 'econ_target', ...)` 插在 `cfg.run` **之前**，
以为"玩家应答后设个标记，run 就会跳过损耗"。

**根因**：`offer_armed_effects` **不是**同步询问 —— 它只是把候选写进
`game.armed_offer` 就返回，玩家随后用 `use_armed_offer` action 异步应答。
所以"在 run 之前 offer"并不意味着"run 之前会拿到应答"：
`cfg.run` **照常立即执行**，损耗已经发生，标记永远来不及生效。

**解法**：改为**事后回滚**，走【已存在的 `econ_used` 窗口】：

```js
// 结算前
const __econDiscBefore = econ_discard_snapshot(game)
// 结算后派发时带上真实损耗数
offer_armed_effects(game, 'econ_used', {
  tag, targets:[t], nation, attrited: econ_attrited_count(game, t, __econDiscBefore),
})
// 17708 的 run：移除空军 + rollback_attrition（把牌从弃牌堆顶拿回牌库顶）
```

与德国状态卡 15246 的 `reduce_attrition` **完全同款** ——
"损耗已发生也无妨，把牌从弃牌堆顶拿回牌库顶即等价没损耗"。
**不需要新增 econ_target 派发点，也不需要在 play_card 里加挂起。**

**【新通用教训】想在"效果生效前"拦住，先确认那个询问机制是不是同步的**

> 本项目的询问机制有三种，**时序完全不同**，选错就白写：
>   | 机制 | 时序 | 能否"执行前拦截" |
>   |---|---|---|
>   | `request_responses`（响应卡/RESPONSE_PRE_CANCEL）| **同步挂起+重放** | ✅ 能（15329、17736 都这么用）|
>   | `offer_armed_effects`（ECHO 增强卡窗口）| **异步**，只写 `armed_offer` | ❌ 不能，只能事后补偿 |
>   | `react`（STATUS 德国专用）| 结算内同步 | ✅ 能（15246/15249）|
>
> 要"拦在效果前"，只有 **RESPONSE_PRE_CANCEL**（同步挂起重放）做得到；
> armed 窗口只能做**事后回滚**。
>
> 补救技巧：**事后回滚往往等价于事前拦截**（损耗回滚 = 没损耗），
> 且改动面小得多 —— 优先找现成窗口 + 回滚，别急着造挂起。

---

### 2026-10-09 · R17：armed 的事后窗口拿不到"本次真实损耗数"——必须自己快照

承接 R16：17708 要回滚"本次损耗了几张"，但 `econ_used` 的 ctx 里
**原本没有**这个数（只有 `tag` / `targets` / `nation`）。

**解法**：在 ECON 结算**前**存一个各国弃牌堆长度快照，结算**后**算差值：

```js
const __econDiscBefore = econ_discard_snapshot(game)   // 结算前
...cfg.run(...)
attrited: econ_attrited_count(game, t, __econDiscBefore)  // 结算后差值
```

**为什么不能直接用卡面写的数字**：卡面"损耗 3 张"是**名义值**，
实际可能因为牌库不足（洗回弃牌堆）而少于 3 张。
按名义值回滚会**多退牌**（把别人本来就有的牌也退回牌库）。

**【新通用教训】"回滚/撤销"类效果要用【实际发生量】，不要用【卡面名义值】**

---

### 2026-10-09 · R18：新增"只能打某种卡"的限制必须服务端+客户端同源

意大利 16701《意大利万岁》：本回合出牌阶段**行动 2 次，但只能打基本卡**。

两处必须同时改（通用教训 3「服务端与客户端判定同源」）：
- 服务端 `rules.js:check_play_phase`：`if (game.it_viva && nation==='意大利' && card)` → `it_viva_allows(card)`
- 客户端 `play.js:check_phase_for_card`：`if (view.it_viva && c.type !== 'BASIC')` → 拒绝

且 view 下发 `it_viva` 时按 **`game.current_nation`**（与 `my_play_done` 同口径），
**不是** `my_nation`（那是视角国）—— 客户端不二次判断国别，避免两边漂移（教训 R26）。

**权利类状态必须【两处】清**（只清一处会残留）：
- `phase_play` 进入出牌阶段时清（防跨回合）
- `advance_phase` 推进阶段时清（防跨阶段）

**验证**：`tools/_smoke_italy_effect1.js` **162/0**；
全量回归 `_smoke_italy_status/response/event` ALL PASS、`_smoke_jp_effect` 132/0、
`_smoke_econ` exitCode=0、`_smoke_status` 21/0、`test_basic_cards` 297/0。

**顺带修的**：`markers_on` 原来写 `(game.markers && game.markers[space]) || []`，
在 `game.markers` 为 undefined 时能兜底，但 `add_marker` / `remove_marker`
等写操作没有兜底。加了 `ensure_markers` 后，写路径也安全了。

---

### 2026-09-22 · 代受面板空无一物 + 进攻方没被挂起

**现象（两个问题）**：
1. 防守方收到"是否用空军代受"的询问，但**面板上一个按钮都没有**，选不了。
2. 进攻方在防守方决定前**还能继续打牌/推进阶段**，把战斗悬空。

**成因 1（空面板）**：客户端多过滤了一次：
```js
const airs = (pb.airs || []).filter(p => view.pieces && view.pieces[p] != null)
```
两个错：
- `view.pieces` 是**数组**（`[...]`），不是按 id 索引的字典 ——
  `view.pieces[p]` 恒为 `undefined`；
- 就算改成字典，`view.pieces` 也是**按本方代表国过滤**过的，
  而防守方此刻关心的可能不是本国（法国部队由英国代表）。

**成因 2（没挂起）**：`resolve_battle` 之外的动作**没有全局拦截** ——
`next_phase` / `play_card` / `discard_one` 等各自只做自己的校验，
没人管"现在有战斗待结算"。

**解法**：

1. **服务端新增 `view.pieces_by_id`**（`{id: {loc, space_name, nation, type, type_zh, in_supply}}`，
   含**双方**算子），专供按 id 查名称/位置；
   `view.pieces`（数组）保持原样，两者用途不同、别混用。
2. **客户端删掉二次过滤** —— `pb.airs` 是服务端算好的、直接可用：
   ```js
   const airs = pb.airs || []
   const airDesc = airs.map(a => byId[a] ? (byId[a].type_zh + "@" + byId[a].space_name) : a)
   ```
   面板上还会列出「可代受的空军 N 支：空军@北海」方便核对。
3. **`exports.action` 加全局挂起守卫**（放在调试动作之后）：
   ```js
   if (game.pending_battle && action !== 'resolve_battle' && ...) {
       game.log.push('战斗结算中：正在等待【X】决定是否用空军代受，在此期间不能进行其它操作')
       return game
   }
   ```
   只有 `resolve_battle` 与调试动作可穿过。

**顺带清理**：删掉已废弃的 `counter_airs` 查询（旧"发起方抵消"机制的残留），
连带修掉测试里对它的引用（会导致 `TypeError: Cannot read properties of null`）。

**教训**：
> - **服务端给了的数据，客户端别再筛一遍**；要筛就筛服务端没给的维度。
> - **区分"数组"与"字典"**：`view.pieces` 是数组这件事，代码里最好在字段名上体现
>   （`pieces` 数组 vs `pieces_by_id` 字典）。
> - **双方交互的挂起状态要"全局生效"**，不能只挡住某几个动作；
>   在 action 入口统一拦截最省事、最不容易漏。

### 2026-09-22 · 代受决策要用「代表团」身份（法国=英国、中国=美国）

**需求**：空军代受的身份以**被攻击方的飞机国籍**为准；
**法国飞机视为英国、中国飞机视为美国**。

**依据**：easy_rule 二章「在英国的计分阶段也计算法国的得分；
在美国的计分阶段也计算中国的得分」—— 法/中在 RTT 的两个 role 里
没有独立席位，与英/美共用操作者。

**解法**：新增代表团映射，只用于「由谁决策」的归一：

```js
const NATION_DELEGATE = { '法国': '英国', '中国': '美国' }
function delegate_of_nation(nation) { return NATION_DELEGATE[nation] || nation }
```

`pending_battle` 里**区分两个字段**（关键，别混用）：

| 字段 | 含义 | 用途 |
|---|---|---|
| `victim_nation` | 部队**真正所属国**（如法国） | 判定谁能代受、谁能撤离 |
| `defender_nation` | **谁来做决定**（法国的代表国 = 英国） | `view` 过滤 + `resolve_battle` 权限校验 |
| `air_nation` | 代受空军必须是哪国（= victim_nation） | 校验 `use_air` |

于是"被攻击的是法国部队" → 由**英国（同盟）**决定；
但只能用**法国空军**代受（英国空军不能替法国部队挡枪）。

**易错点**：`victim_nation` 与 `defender_nation` 在非法/中案例子里
取值相同，很容易图省事只留一个字段 —— 那样一旦出现法国/中国就会错判。

### 2026-09-22 · 代受时报「【德国】回合尚未结束，轴心无权代为操作」

**现象**：以同盟身份给英国选择"空军代受"时，弹出
「【德国】回合尚未结束，轴心无权代为操作」，操作无效。

**成因（三个 bug 叠加，报错文案还自相矛盾）**：

1. **大小写口径不一致（致命）**：
   ```js
   const side = current === ALLIES_ROLE ? ALLIES : AXIS   // -> 'axis' / 'allies'（小写）
   const myRole = faction_role_of_nation(nation)          // -> 'Axis' / 'Allies'（首字母大写）
   const isTurnSide = (side === myRole)                   // 恒为 false！
   ```
   于是**任何人打牌都被拒**。

2. **决策放行逻辑已过时**：`play_card` 里还留着"放行防守方 defend_air"的分支，
   但代受早已改走独立的 `resolve_battle`；该分支既没用（发起方提交不带 `defend_air`）
   又误伤（防守方错走 `play_card` 会被挡回）。

3. **`view.actions` 整体挂在 `is_my_turn` 上**：防守方不是当前行动方 →
   `actions === null` → 连 `resolve_battle` 都发不出去。

4. **报错文案把两个方向拼在一起**：`nation` 取的是 `game.current_nation`（德国），
   `side` 取的是提交者（同盟）→ 输出「【德国】…轴心无权」，
   主客颠倒，看起来完全无厘头。

**解法**：

- **统一大小写口径**：比较双方都用**小写阵营 key**
  （`side` 对小写 `faction_of_nation(nation)`），并在代码里写明
  「`side`/`AXIS`/`ALLIES` 是小写 key；`AXIS_ROLE`/`ALLIES_ROLE` 是 RTT role 名」。
- `play_card` 只放行**当前行动方**，代受一律走 `resolve_battle`。
- 抽出 `build_actions(game, side, is_my_turn, pendingBattle)`：
  - 战斗挂起且本方是防守方 → 只给 `{resolve_battle, log}`；
  - 战斗挂起且本方是发起方 → 只给 `{log}`（先结清战斗）；
  - 否则按 `is_my_turn` 给常规动作。
- **报错文案改为说明"现在轮到谁"**，而不是把行动国和提交者混在一句里。

**顺带发现并修复的更大问题**：`nation_of_player` 把"我的国家"绑死在
「当前行动国（若属于我方）」上，导致**防守方在对方回合里没有身份**
（`my_nation === null`）→ 拿不到 `view.pending_battle`、
也发不出 `resolve_battle`。改为返回
**本方阵营在回合顺序中排最前的国家**：

```js
function nation_of_player(game, role) {
    const myFaction = role === ALLIES_ROLE ? ALLIES : AXIS
    for (const n of ORDER_OF_NATIONS)
        if (faction_of_nation(n) === myFaction) return n
    return null
}
```

`is_my_turn` 另用 `current === game.active` 判定，两者解耦。
手牌可见性由 `hand_view(game, n, my_nation)` 的 `own` 参数单独把关，
所以放宽身份**不会**泄露对手手牌（已验证：轴心只看到德国手牌）。

**验证**（复现脚本 + 测试）：

| 检查项 | 结果 |
|---|---|
| 德国发起海战 | 挂起，`defender=英国` |
| 轴心视角 `pending_battle` | `null`（不该看到）|
| 同盟视角 `pending_battle` | **有值** |
| 同盟 `actions` | **`{resolve_battle:1, log:1}`** |
| 同盟 `prompt` | 「战斗结算中：请决定【英国】是否用空军代受」|
| 同盟提交代受 | 英国空军移除、英国海军保住 |

测试断言同步更新：原先「非本方回合 query 返回 null」
改为「返回本方代表国的数据，且看到的是本国手牌」。

### 2026-09-22 · 代受决策归属错误

**现象**：以德国身份攻击英国船+飞机，不切到英国就能决定飞机替死。

**成因**：
1. `exports.action` 无回合归属校验；
2. 代受询问在发起方本地弹出，服务端被动接受 `defend_air`。

**解法**：
- `do_battle` 在"有可代受空军且防守方未表态"时**挂起**，
  写 `game.pending_battle`（含 `defender_nation` / `victim` / `airs` / `retreats` / `kind` / `attacker_piece`）；
- `view.pending_battle` **只发给防守方**（`pb.defender_nation === my_nation` 才返回）；
- 新增 `resolve_battle` action，**非防守方提交直接拒**，参数非法则**保持挂起**让其重选；
- `play_card` 加 `isTurnSide` 校验（另加测试专用开关 `set_skip_turn_guard`）；
- 客户端删除发起方本地的代受询问，改由 `update_pending_battle_box()` 依 `view.pending_battle` 渲染。

**涉及**：`rules.js`(do_battle / view / action) / `play.js`(ask_defense / update_pending_battle_box)。

---

### 2026-09-22 · 空军不能作为攻击目标 / 只有无敌军才能打地块

**现象**：能直接选敌方飞机作为攻击目标。

**规则原文**：发起战斗"选择位于该地区的 1 支敌方部队（如果有），移除之"，
且"可以选择无人占领的地区"。空军另由"夺取制空权"处理。

**解法**：
- `do_battle` 与 `basic_targets` 的敌军筛选统一加 `game.piece_type[p] !== 'air'`；
- 由此自然得到"该地区只有敌方空军 ⇒ 没有可攻击敌军 ⇒ 只能空打地块"；
- 地区说明区分为「敌 N 支」/「仅敌方空军（不可打击），可空打地块」/「空地（无守军，可空打）」；
- 客户端点地区时若该地区有可攻击敌军却点在地块上 → 提示"必须点击要攻击的敌方部队"。

---

### 2026-09-22 · 发起单位改在地图上点选

**现象/需求**：不要在侧栏面板里选发起单位。

**解法**：
- 战斗流程改为地图两步：先点**发起单位**（`highlight_pieces(ids,"initiator")` 金色脉冲光晕），
  再点**目标地区/敌方部队**；
- 新增 `battle_initiators` 查询（**只含陆/海军**，须补给中且与目标相邻）；
- 若玩家先点了敌方算子再点发起单位，自动用作目标，省一次点击。

---

### 2026-09-22 · 空军可与海军同格（部署到海域）

**现象**：空军无法部署到有本国海军的海域。

**成因**：`air_host_check` 本身写的是 `army || navy`，没问题；
但**三处额外限制**把空军当陆军处理了：

1. `can_build_at`：`if ((type === 'army' || type === 'air') && isSea) 拒绝`；
2. `basic_targets`：`const wantTerrain = isNavy ? 'sea' : 'land'`（空军只扫陆地）；
3. `build_piece` 走 `can_build_at`，把"本土/邻接补给部队"那套陆军要求套到了空军头上。

**解法**：空军统一走**载体口径**，不受地形限制——
- `can_build_at` 只挡 `army` 于海域；
- `basic_targets` 的空军 `wantTerrain = null`（陆地+海域都扫，由载体决定）；
- `build_piece` 的 `air` 分支改调 `air_host_check`，不调 `can_build_at`。

**顺带修**：`build_piece` 末尾 `return { reason: chk.reason }` 在 air 路径下 `chk` 未定义 →
`ReferenceError`。改用统一的 `why` 变量。

---

### 2026-09-22 · 6 国轮转时操作权不跟着阵营走

**现象**：轮到英国时，同盟视角顶栏显示"等待对方行动"，无法执行资源再分配。

**成因**：`game.active` 只在**6 国全部跑完**才翻转，
但国家顺序德(轴)/英(同)/日(轴)/苏(同)/意(轴)/美(同)是**逐国交替**的。
于是轮到英国时 `active` 仍是 `Axis` → `is_my_turn=false` → `actions=null`。

**解法**：`active` 改为**跟着当前行动国所属阵营**走，
在 `advance_phase()` 轮转国家后、`next_nation` 调试动作、`setup()` 三处同步：

```js
game.active = faction_role_of_nation(game.current_nation)
```

---

### 2026-09-22 · 空军力量的阶段限制（三次收窄）

**需求演化**（用户逐步明确）：

1. 空军阶段只能打《空军力量》或调度，其余卡不许打；
2. 《空军力量》只能在空军阶段打，**出牌阶段也不行**；
3. 只有卡面写明对应阶段的卡（+ 增强卡）才能在非出牌阶段打。

**最终口径**（写进 `check_phase_for_card`）：

| 阶段 | 允许 |
|---|---|
| 出牌阶段 | 打 **1 张**（`play_done`），增强卡除外 |
| 空军阶段 | 《空军力量》(deploy/seize)、卡面写明"空军阶段"的、增强卡 |
| 其他阶段 | 只有**卡面有特殊说明**的卡；增强卡随时可打 |
| 弃牌阶段 | 不通过"打牌"，走专门的主动弃牌 action |

**思想**：规则演变时**只留一个判定函数**，把每次收窄都收敛进去，
而不是在各处打补丁。`has_phase_note(c, phaseZh)` 用卡面文本判定，
正则含 7 个阶段名。

---

### 2026-09-22 · 弃牌阶段：框住选择 + 确认按钮

**需求**：点手牌先"框住"，下一阶段按钮旁加"确认弃牌"。

**解法**：
- 客户端 `discard_pick = []`，点手牌切换选中（`.sel` + `弃 N` 序号徽标）；
- 侧栏新增 `#btn_confirm_discard`（`primary` 金色），0 张时禁用、文案随数量变化；
- 服务端 `discard_in_discard_phase` 支持 `{card}`（单张）与 `{cards:[...]}`（批量），
  批量提交前**整批预校验**（存在性 + 不重复），一张非法则全部拒绝；
- 阶段切换/Esc 自动清空选择。

**踩到的子坑**：清理顺序问题（见「通用教训 2」）。

---

### 2026-09-22 · 资源再分配（三次修正）

**需求演化**：
1. 初版：弃 3 张 → 挑 1 张基本卡；
2. 修正一：只能执行**一次**（我误做成可反复）；
3. 修正二：**3 张同名卡牌可以**，同一张牌不行；
4. 修正三：配额要**随回合重置**（"每个回合各一次"）。

**关键实现**：**卡牌实例化**。

**成因**：卡组数据里每张卡只有一个 id，同名卡同名 id。
用 `card_id` 当身份时，`[x,x,x]`（同一张填 3 次）与"3 张同名牌"
在数据上**完全无法区分**。

**解法**：`init_nation_deck()` 给每张实体牌编号 `<card_id>#<n>`：

| 函数 | 作用 |
|---|---|
| `inst_card_id(x)` | 去掉 `#n` 取回牌面 id |
| `inst_card(x)` | 取牌面数据（取代 `CARD_BY_ID[x]`） |
| `inst_pub(x)` | 整理成 UI 形状（`id` 是实例 id，另带 `card_id`） |

手牌/桌面/查询返回的 `id` 都是**实例 id**，客户端原样回传；
去重按**实例 id** → 3 张同名牌合法、同一张重复非法。

**回合重置**：`phase_resource()` 在进入资源阶段时 `resource_swaps[nation] = 0`。
（原先 `resource` 阶段**没有入口函数**，计数只增不减，实际成了"整局一次"。）

---

### 2026-09-22 · 资源再分配选不中手牌

**成因与解法**：见「通用教训 1」。核心是 `d.__act` 闭包存了过期状态。

---

### 2026-09-22 · 手牌"看得见点不中"

**成因**：`main` 是 `client.js` 的 `transform: scale()` 缩放层，
手牌区在地图下方，未占位时命中区域被 `#mapwrap` 吃掉。

**解法**：
- `.panel-list { position: relative; z-index: 50 }`；
- `#hand_cards .card { pointer-events: auto }` + `.card img { pointer-events: none }`；
- 点击统一走卡片上的监听（在 `build_card_elt` 里绑一次）。

---

### 2026-09-22 · 摸牌阶段应为"补到 7 张"

**成因**：写成固定 `draw_cards(game, nation, 2)`。

**解法**：`phase_draw()` 改为算差值补满 `HAND_LIMIT(7)`；
牌堆+弃牌堆都空时摸到多少算多少（规则原文"除非牌堆被摸空"）。

---

### 2026-09-25 · RTT 服务器只监听 IPv6（`::1`），IPv4 `127.0.0.1` 连不上

**成因**：本机 node `server.js`（PID 45572）启动时绑定到 `::`，
实际只在 IPv6 的 `::1` 上 Listen。IPv4 的 `127.0.0.1` 走另一条栈，
`curl http://127.0.0.1:8091/` 返回 `HTTP=000`（连接被拒），
但 `curl http://localhost:8091/` 返回 `HTTP=200`（因为 localhost 优先解析到 `::1`）。

**症状**：浏览器访问 `http://127.0.0.1:8091/` 白屏，
DevTools 报 `ERR_CONNECTION_REFUSED (-102)`。

**解法**：所有 URL（浏览器地址栏、IDE 内置 webview、`preview_url` 工具）
一律用 `http://localhost:8091/`，不要写 `127.0.0.1`。

**排查命令**：
```powershell
# 1. 确认哪个端口在监听
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in (8080, 8091) }
# 2. 用 curl 双栈对比
curl.exe -s -o NUL -w "HTTP=%{http_code}\n" http://127.0.0.1:8091/
curl.exe -s -o NUL -w "HTTP=%{http_code}\n" http://localhost:8091/
```
若 `127.0.0.1` 返回 000、`localhost` 返回 200，就是这个问题。

---

### 2026-09-25 · JS 缓存 vs 登录 Cookie 是两回事

**误区**：浏览器关掉再打开仍是登录状态 → 误以为"缓存没清掉"。

**澄清**：
- **JS 缓存**：浏览器把 `play.js` / `client.js` 等存到磁盘，
  下次刷新直接用本地副本（不发请求）。改了 JS 不刷新就用旧版，
  调试时加的 `console.log` 不出现就是这个原因。
- **登录 Cookie / Session**：只在 HTTP 请求头里带着，标识身份。
  关浏览器再开仍是登录状态**是正常现象**，与 JS 缓存**无关**。

**解法（彻底禁用 JS 缓存）**：
1. F12 打开 DevTools
2. 切到 **Network** 标签
3. 勾选 **Disable cache** 复选框（在工具栏左侧，"Filter"按钮同一行）
4. **保持 DevTools 开着**（关键！关了复选框就失效）
5. **Ctrl+F5** 强制刷新

只要 DevTools 开着 + 勾了 Disable cache，每次刷新都会忽略本地缓存、
重新下载所有 JS。

**判断"是否加载了新 JS"**：在新版代码里加一行独特的 `console.log`
（如 `console.log("[VIEW KEYS]", ...)`），刷新后看 Console
有没有这行——有就是新版已加载，没有就是还在跑旧版。

---

### 2026-09-25 · 实例 id vs 卡面 id —— ECHO 卡全被拒

**症状**：增强卡（EFFECT/ECHO）点击后服务端不响应，
Console 显示 `trig= undefined`，但 `[VIEW KEYS]` 显示 `card_triggers`
确实在 view 里、`card_triggers['15310'] = {kind:'self', phase:'scoring'}` 是对的。

**成因**：手牌里的 `c` 是 `inst_pub()` 返回的对象：
- `c.id`       = 实例 id（如 `"15310#5"`，区分同一牌的不同拷贝）
- `c.card_id`  = 卡面 id（如 `"15310"`，对应 CARDS 表/CARD_TRIGGERS 表的键）

两处把"实例 id"当"卡面 id"用了：

1. **客户端 `play.js` 的 `check_phase_for_card`**：
   `view.card_triggers[String(c.id)]` —— `c.id` 是实例 id，
   `card_triggers["15310#5"]` 永远 undefined，所有增强卡都被判"无时点声明"。
   **解法**：用 `c.card_id || c.id` 查表。

2. **服务端 `rules.js` 的 `trigger_ready(game, card_id, nation)`**：
   `play_card` 的 `arg.card` 是实例 id（来自客户端 `c.id`），
   `CARD_TRIGGERS[String(card_id)]` 用实例 id 查，同样永远 undefined。
   **解法**：用 `inst_card_id(card_id)` 去掉 `#n` 后查表。

**排查路径**：
- 加 `console.log` 打印 `c.id` 一眼看出是 `15310#5` → 实例 id
- 服务端在 `trigger_ready` 入口加 log，确认 `card_id` 与 `CARD_TRIGGERS` 的键对不上

**教训**：
- CARDS / CARD_TRIGGERS / EVENT_EFFECTS / ECHO_EFFECTS 这些表的键
  统一用**卡面 id**；客户端拿到的对象里**既有 `id`（实例 id）
  也有 `card_id`（卡面 id）**，查表必须用 `card_id`。
- 服务端 `arg.card` 是**实例 id**，服务端函数（trigger_ready、
  resolve_event_card 等）入口必须 `inst_card_id()` 解析后再查表。
  `inst_card` / `card_effect_of` 已内置解析，唯独 `trigger_ready`
  是直接 `String(card_id)` 查表，所以漏了。

---

### 2026-09-25 · ECHO 卡"点了没反应"系列（4 个连环坑）

整体症状：增强卡（EFFECT/ECHO）点击后客户端无反应，
Console 显示 `trig= undefined` 或 `MESSAGE error`。
排查中共发现 4 个独立 bug，按修复顺序记录：

#### 坑 1：客户端用实例 id 查 card_triggers（已在前面单独记录）

`play.js check_phase_for_card` 用 `c.id`（实例 id `15310#5`）查
`view.card_triggers`（键是卡面 id `15310`）→ 永远 undefined。
**解法**：用 `c.card_id || c.id`。

#### 坑 2：服务端 trigger_ready 用实例 id 查 CARD_TRIGGERS

`rules.js trigger_ready` 第 1375 行 `CARD_TRIGGERS[String(card_id)]`，
但 `play_card` 的 `arg.card` 是客户端传来的实例 id（`15310#5`）。
**解法**：`CARD_TRIGGERS[String(inst_card_id(card_id))]`。

#### 坑 3：客户端"直接 send_action 不查目标"导致服务端 pending 但 UI 无反应

旧简化逻辑：ECHO 卡点击后直接 `send_action("play_card", {card})`，
不预先 `send_query('event_targets')`。服务端 `resolve_event_card`
返回 `{ok:true, need:'space', pending:true, candidates:[...]}`，
但**这个 pending 状态没写到 view 里**——客户端拿不到 candidates，
既不显示选区高亮也不弹任何 UI，看起来就是"点了没反应"。
**解法**：ECHO 卡与 EVENT 卡走同一流程——
先 `query_event_targets(c.id)`，等 `on_reply('event_targets')`
回调拿到 candidates + need，再 `highlight_event_targets(tg)` 高亮地区，
玩家点地区后才 `send_action("play_card", {card, space})`。

#### 坑 4：服务端 query 返回里引用未定义变量

修坑 3 时给 `query('event_targets')` 的 space 分支返回对象加了
`card_name: c ? c.name : ''`，但该分支作用域里**没定义 `c`**
（`c` 只在 choice 分支内的 `const c = inst_card(card)` 有效）。
客户端 Console 显示 `MESSAGE error`，服务器日志：
`ReferenceError: c is not defined at rules.js:6159`。
**解法**：去掉 `card_name` 字段——客户端已通过 `pending_event_card`
知道是哪张卡，不需要服务端再回传一次卡名。
**教训**：在不同分支的对象字面量里引用变量前，
确认该变量在当前作用域有定义；尤其是 `const` 声明的变量
只在它所在的 `if` 块内有效。

---

### 2026-09-25 · ECHO 卡可选弃牌 UI 的实现要点

需求：ECHO 卡（如 15310 法国外籍军团）要求"弃 1 张手牌作为代价"，
旧实现是 `resolve_event_card` 内部 `hand.filter(...).slice(0, cost)`
**自动取前 N 张弃**，玩家没选择权。
期望：像资源再分配那样弹弃牌框让玩家选。

**实现路径**（先弹弃牌框 → 确认 → 高亮地区 → 点地区提交）：

1. **服务端 `query('event_targets')`** 返回时附带 `cost: eff.cost || null`，
   让客户端知道要弃几张。
2. **客户端 `on_reply('event_targets')`** 在 `tg.need === 'space'` 分支：
   若 `tg.cost.discard > 0`，先设 `pending_echo_discard` 状态并弹
   `#echo_discard_modal` 弹框（与 `#resource_modal` 同构）。
3. **`on_click_hand_card` ①'. 分支**：在 `pending_echo_discard` 状态下，
   点手牌 = 选/取消弃牌（本卡置灰不可选）。
4. **`confirm_echo_discard()`**：玩家选满 N 张后点确认，
   把 `drop.slice()` 暂存到 `pending_echo_cards`，清空本弹框状态，
   进入 `highlight_event_targets(tg)` 高亮地区流程。
5. **点地区提交**：`send_action("play_card", {card, space, cards: pending_echo_cards})`，
   服务端 `resolve_event_card` 的 ② 代价分支已支持 `arg.cards`
   （`pay = arg.cards && arg.cards.length ? arg.cards : 自动取前 N 张`）。

**关键状态**：
- `pending_echo_discard`：弹框激活时持有 {card, need_targets, drop, limit}
- `pending_echo_cards`：弹框关闭后保留所选弃牌 ids，供最终 send_action 用
- `cancel_event_card()` 统一清空所有 pending_*（包括这两个）

**复用要点**：
- `update_map()` 主循环里加 `update_echo_discard_box()`（与 update_resource_box 同位）
- `update_hand_panel` 的 `.sel` 高亮条件加 `pending_echo_discard.drop.indexOf(c.id) >= 0`
- `card_elt(c, onClick)` 复用资源再分配的卡牌渲染

**未实现的情况**（待办）：
- 多选地区（pick>1）：当前只支持单选，`pick_spaces_for` 已支持但 UI 未跟上
- choice + cost 共存：当前 choice 分支没接 cost 流程

---

### 2026-09-25 · phase_supply 漏算代表团（法国部队没被移除）

**症状**：英国补给阶段，地图上法国部队实际断补（UI 显示红色），
但补给阶段结束 phase_note 写"英国全部部队处于补给状态"，
法国断补部队没被移除。

**成因**：`phase_supply(game, nation)` 只调用一次
`resolve_supply(game, nation)`，而 resolve_supply 内部
`if (game.piece_nation[pid] !== nation) continue` 只处理
"当前回合国"的断补部队。法国部队不在英国自己名下，被跳过。

**规则**：规则书二.5「在英国的计分阶段也计算法国的得分；
在美国的计分阶段也计算中国的得分」对应规则书二.4
「补给阶段：将当前回合者不处于补给状态的部队移除」——
"当前回合者"包括代表团成员国（法国由英国代管、中国由美国代管）。
计分阶段（phase_scoring）已经用 `delegated_to(nation)` 处理了
代表团，但 phase_supply 漏了。

**解法**：phase_supply 取 `bloc = delegated_to(nation)`，
对 bloc 里每个国家都执行 resolve_supply，atRisk 也按代表团收集。
phase_note 显示"英国（含 法国）移除断补部队 N 个" 让玩家知道
代表团也被算进去了。

**教训**：代表团机制（NATION_DELEGATE / delegated_to）是
**跨阶段**的——计分、补给、回合轮转都要考虑。
新写阶段入口函数时先问自己：这一阶段要不要把代表团成员国
也一起处理？参考 phase_scoring 已有的 `delegated_to` 调用。

---

### 2026-09-25 · 多选目标的 query 返回漏带 pick 字段

**症状**：15326 自由法国同盟（pick:2，要在 3 个地区中选 2 个），
客户端 on_reply 收到的 params 没有 `pick` 字段，
`pending_event_targets.pick || 1` 默认 1，走单选分支，
玩家点第一个地区就立刻 send_action 单个 space，
服务端也只建 1 支法国陆军。

**成因**：`rules.js query('event_targets')` 的 space 分支返回
`{need, actor, step, candidates, cost}`，**漏带 `pick` 字段**。
而 `event_card_needs` 返回的 need 对象里其实有 `pick` 值
（1845 行 `return { need: 'space', step: i, candidates: cands, pick: need }`），
但 query 出口构造返回对象时只取了 step 和 candidates，没取 pick。

**解法**：query 返回加 `pick: need.pick || 1`。
客户端据此走单选/多选分支。

**教训**：服务端 query 是客户端 UI 的"数据契约"——
need 对象里每个字段都要原样透传给客户端，否则客户端
无法判断该走哪条 UI 分支。新增字段时检查 query 出口
有没有带上。

---

### 2026-09-25 · fire_trigger 钩子用错变量名（type vs kind）

**症状**：扣了响应卡后发起陆战，服务端崩溃：
`ReferenceError: type is not defined at do_battle (rules.js:3036)`

**成因**：`do_battle(game, nation, space, target_piece, kind, opt)`
的参数是 `kind`（'land' / 'sea'），不是 `type`。
我在 do_battle 末尾加 `[TRIGGER battle]` 钩子时
误用 `kind: type`，但 `type` 在该作用域未定义。

**解法**：改为 `kind: kind`。代受空军分支同样误用，一并改。

**教训**：在已有函数末尾加代码时，先看函数签名
（参数列表），不要凭印象写变量名。
fire_trigger 的 ctx 字段约定是 `kind`（land/sea），
但具体变量名取决于 do_battle 的参数命名。

---

### 2026-09-25 · 15305 双十字系统连环 3 坑（peek_reorder 流程）

15305 是 ECHO 增强卡，时点 `self + draw`（自己摸牌阶段），
效果：观看德国 2 张手牌，按指定顺序置于德国牌堆顶。
实现走 query('event_targets') → on_reply → peek_modal → submit_peek
→ send_action({card, order}) 流程，连环踩 3 个坑：

#### 坑 1：query 是只读 RPC，不能写 state

最初在 `event_card_needs`（query 内部调用）里写
`game.peek = {...}` 期望 view 反映状态自动弹框。
但 RTT 框架不广播 query 期间的状态变更——
`view.peek` 永远不更新，`update_peek_box` 不弹框。

**解法**：query 不写 state，只返回 `cards` 给客户端；
客户端用本地变量 `peek_cards` + `peek_target` 渲染，
不依赖 `view.peek`。on_reply 设状态后**主动调用**
`update_peek_box()`（on_reply 是回调，state 没变，
on_update 主循环不会被触发，必须主动调一次）。

#### 坑 2：对手手牌的卡对象不在客户端 view 里

`view.hand_cards` 只有**自己**的手牌卡对象；
对手手牌不可见，客户端 `inst_card_client(id)` 找不到
返回 `{name:"?"}` —— peek_modal 显示"??"。

**解法**：query('event_targets') 出口把 `cards` 从
裸 id 数组转成完整卡对象数组（含 `name/type/img` 等）再返回。
**关键**：必须带 `img` 字段，否则 `card_image_url(c)` 返回 null、
卡图白屏（仅显示文字回落层）。

#### 坑 3：服务端重新挑牌导致 order 与 picked 不一致

`resolve_event_card` 的 peek_reorder 分支每次都重新
随机挑 picked，校验 `arg.order` 与这个新 picked 一致。
但客户端拿到的 cards 是 **query 阶段**挑的（已固定），
服务端 resolve_event_card 阶段重新挑可能挑出不同的牌——
`order` 与新 picked 不一致被拒，返回
`{ok:false, reason:"排序的牌与观看的牌不一致"}`。

**解法**：客户端 submit_peek 把 query 阶段挑的 cards
一起提交（`arg.peek_cards`），服务端优先用 `arg.peek_cards`
作 picked 校验。客户端无法伪造对手手牌（只有服务端
query 阶段才能挑），所以信任客户端传的 peek_cards 是安全的。

---

## 四、检查清单（改代码前过一遍）

- [ ] 规则原文（`docs/easy-rule.md`）读了吗？限定词都列出来了吗？
- [ ] 服务端与客户端的判定谓词**同名同义**、一起改了吗？
- [ ] 这段逻辑是"渲染时算"还是"点击时算"？**会不会存到过期状态**？
- [ ] 清理/规范化状态的语句，是否排在**使用**它之前？
- [ ] 这个配额是"每回合一次"吗？**进入该阶段时会清零**吗？
- [ ] 有没有可能"没有合法目标"？预检 + 明确理由做了吗？
- [ ] 这个决策属于**哪一方**？服务端有没有归属校验？需要 `pending_*` 挂起吗？
- [ ] **非行动方**此时有身份吗？能收到 `view` 里的待决事项、能发出对应 action 吗？
- [ ] 比较阵营/标识时，两边的**大小写口径一致**吗？（先归一再比）
- [ ] 客户端有没有对服务端**已算好的候选集合**再做一次过滤？（别筛）
- [ ] 用 `view.pieces_by_id`（字典）还是 `view.pieces`（数组）？用对了吗？
- [ ] 有"待决事项"时，**所有**无关动作都被统一拦住了吗？（action 入口守卫）
- [ ] `exports.action` 每个分支都 `return state` 了吗？
- [ ] 改完 `rules.js` **重启服务器**了吗？
- [ ] 改完把结论**追加到本文**了吗？

---

## 待完成任务（响应卡第 3 步）

**已完成（截至 2026-09-25）**：
- ✅ 第 1 步：响应卡在出牌阶段打出 + 背面放桌面（占名额，不进弃牌堆）
- ✅ 第 2 步：fire_trigger 钩子接线（build/eliminate/battle/play_card 后调用，仅 console.log 输出，不挂起询问）
- ✅ **第 3 步：交互式响应卡（UI）全部完成**
  - 不再自动结算，改为挂起询问。所有事件点（`build`/`battle`/`piece_removed`/`play_card`）调用 `request_responses(...)`，
    匹配到的响应卡推入 `game.response_queue`（队列，支持一次动作触发多种/多次响应）。
  - 服务端 `trigger_response` / `pass_response` 两个动作：持有方选择触发（执行 effect + 卡进弃牌堆）或不触发（卡留桌面）。
  - 全局拦截：结算中不响应期间，除 trigger/pass 外所有动作被挡（与 pending_battle 同理）。
  - `view.pending_trigger` 仅向**持有方阵营**暴露；`build_actions` 仅向持有方返回 `trigger_response`/`pass_response`。
  - 客户端 `update_pending_trigger_box()` 复用 `#ask_box`（与 pending_battle 同框），弹"发动响应 / 不发动"按钮。
  - 测试 `_test_resp.js` 7/7 通过（入队/触发/还原/洗回/放弃/拦截/权限）。
- ✅ **桌面响应卡区可视化（2026-09-25）**
  - 在 `.panel-list` 新增「桌面响应卡」面板（`play.html` 的 `#response_wrap` / `#response_cards` / `#response_note`）。
  - `rules.js` 的 `view` 对本方响应卡每条补充 `type/img/text`（直接画卡面），并新增 `table_responses_opponent_count`（仅数量，不泄露卡面）。
  - `play.js` 新增 `build_response_card_elt()`（只展示、不挂打出点击，悬停显示放大卡图）/ `update_response_panel()`，并在 `update_map()` 中调用；本方画正面、对方画牌背（`.card.back` 显示"响应"竖排字样）+ 顶部标注"（本方 N · 对方 M）"。
  - `play.css` 新增面板与牌背样式（`.card.back` 用 `writing-mode: vertical-rl` 显示"响应"）。

**关键设计决策（第 3 步）**：
- **统一改为"事后类 + 持有方选择"**：原"拦截类（移除前保护）"15330/15332/15334/15337 改成**先移除、触发后由持有方决定是否还原**（`restore_piece` 把算子加回版面 + `register_modifier` 本回合保护）。这样无需在 eliminate/resolve_supply/remove_piece 深处"挂起"动作，避免重构深层流程。
- **仅 15329 保留为真·拦截类**：`play_card` 顶部用 `fire_trigger` 查 pre 候选，命中则把动作挂起到 `response_queue`（`head.resume` 记重放动作）；`pass_response` 时清掉 `__skip_play_intercept` 标志后重放该出牌，触发器不生效。
- **链式触发支持**：effect（如 15331 消灭）内部再调 `eliminate_piece` 会再推新条目到队列尾部，依次处理。
- `RESPONSE_PRE_CANCEL` 现仅含 `{'15329'}`（详见下方踩坑档案 R12）。

**仍待办（非阻塞）**：
- 15328 破译恩尼格码：需 STATUS 卡真正登陆 `game.table[nation]` 才生效（当前 STATUS 卡流程未打通）。
- 12503/12504 通丁系统/抵抗万岁：已实现为 build 触发式消灭（敌方在北海建海军/西欧建陆军后消灭该部队），见 RESPONSE_EFFECTS（旧文档的 `game.bonus_battle` 占位逻辑已废弃，详见 R16）。
- 15329 需 ECON 类型卡真正可打（当前无经济战卡上桌面）。

---

### 2026-09-25 · fire_trigger 钩子用错变量名（type vs kind）

**症状**：扣了响应卡后发起陆战，服务端崩溃：
`ReferenceError: type is not defined at do_battle (rules.js:3036)`

**成因**：`do_battle(game, nation, space, target_piece, kind, opt)`
的参数是 `kind`（'land' / 'sea'），不是 `type`。
我在 do_battle 末尾加 `[TRIGGER battle]` 钩子时
误用 `kind: type`，但 `type` 在该作用域未定义。

**解法**：改为 `kind: kind`。代受空军分支同样误用，一并改。
console.log 输出里也漏改（`'kind=', type`），导致
即使 battleCtx 已修正，触发时仍 ReferenceError。

**教训**：
1. 在已有函数末尾加代码时，先看函数签名
   （参数列表），不要凭印象写变量名。
2. fire_trigger 的 ctx 字段约定是 `kind`（land/sea），
   但具体变量名取决于 do_battle 的参数命名。
3. **改 bug 时全搜一遍**——同一变量名误用可能
   出现在 battleCtx 字段、console.log 输出、其他分支
   多处，一次只改一处会漏。用 `search_content`
   扫一遍"`kind=., type`"这种模式确认全改完。

---

### 2026-09-25 · 空军阶段"建设空军不生效"——my_nation 误代 current_nation（配额误判）

**症状**：空军阶段打《空军力量》部署空军，点了没反应 / 卡被置灰"已部署"，
但服务端 `play_card` 本身是正常的（脚本实测能造出空军）。

**排查结论**：服务端整条 deploy 链（build_piece → view.pieces →
客户端 on_click_hand_card → start_basic_card → show_mode_chooser →
basic_targets → on_space_click_for_card → play_card）全部正常。
根因在 view 暴露的配额字段：

`view.my_air_done` / `view.my_play_done` 原写法
`!!(my_nation && game.air_done && game.air_done[my_nation])`
其中 `my_nation` 由 `nation_of_player()` 返回**本方排最前的国家**
（轴心=德国、同盟=英国），是固定值，不是当前行动国。
而服务端按 `game.current_nation` 标记配额
（`phase_airforce` 进入时 `game.air_done[nation]=false`；
`play_card` 部署后 `game.air_done[nation]=true`）。

**后果（2 人局才会暴露）**：用第一个国家（德/英）部署一次空军后，
同阵营第 2/3 个国家（日/意/苏/美）的空军阶段
`view.my_air_done` 仍 = `game.air_done['德国']` = true
→ check_phase_for_card 把《空军力量》判为"已部署"置灰，
表现为"建设空军不生效"。`my_play_done` 有完全相同隐患。

**解法**：两个字段改用 `game.current_nation`：
```
my_play_done: !!(game.play_done && game.play_done[game.current_nation]),
my_air_done:  !!(game.air_done  && game.air_done[game.current_nation]),
```
（rules.js ~L5527）

**教训**：
1. "每国每回合一次"的配额（play_done / air_done / discard_count /
   swap_count）服务端都按 `game.current_nation` 记，**客户端 view 也必须
   按 `game.current_nation` 判，绝不能用 `my_nation`（固定代表国）**。
2. 单人局（手动测试 setup_manual_test 只有德国）不触发此 bug，
   因为 my_nation===current_nation。多人局才会暴露——测试时要覆盖
   "同阵营第 2 个国家"的场景，不要只测首国。
3. 若修复后仍"不生效"：多半是**服务器没重启**（RTT watch 不热更
   rules.js/play.js），或浏览器缓存。重启 `node server.js` + 硬刷新。

---

### 2026-09-25 · 点《空军力量》卡牌不弹模式框——#mode_chooser 在 #hand_panel 内被布局埋掉

**症状**：空军阶段点《空军力量》卡牌，右侧没有弹出模式选择框
（部署/夺取/取消）；而点侧栏【调度空军…】却能看到黄色 #ask_box。
玩家明确说没点过调度空军。

**根因（已用 node + 最小 DOM 桩复验）**：点击流程完全正确——
`on_click_hand_card → check_phase_for_card(空军阶段+空军力量=ok)
→ start_basic_card → show_mode_chooser`，`show_mode_chooser` 确实把
`#mode_chooser` 的 `hide` 类移除并写入 3 个按钮（_test_click.js 输出
`mode_chooser.hidden = false, children = 3`）。问题在于**可见性**：
`#mode_chooser` 写在 `play.html` 的 `#hand_panel`（`#hand_counts` 之后、
右侧 `<aside>` 内）普通流里，位置靠下；而 `#ask_box` 虽同在 aside，但
不在 `#hand_panel` 内、位置靠上，所以【调度空军】看得到、【空军力量】
看不到。表现为"点了没反应 / 不弹框"。

**解法**：把 `#mode_chooser` 改为 `position: fixed; z-index: 600`（与
#tooltip/#ask_box 同级），固定在屏幕底部居中，并改成醒目橙黄底
（play.css #mode_chooser ~L620）。这样它脱离 `#hand_panel` 的裁剪/可见性
约束，无论手牌面板是否滚动/折叠都一定显示。

**教训**：
1. "能出框"和"点不出框"的差异，先怀疑**布局/可见性**（父容器裁剪、
   滚动、z-index、固定 vs 普通流），而不是急着改点击逻辑——尤其两个面板
   一个看得见、一个看不见时，几乎都是布局问题。
2. 用 node + 最小 DOM 桩直接加载 play.js、调用 `on_click_hand_card` 可
   100% 确认"流程是否走到 show_mode_chooser"，比猜更高效（注意要跳过
   加载时的 `build_map()`：用 `(?<!function )build_map\(\)` 只替换调用）。

---

### 2026-09-25 · 响应卡（RESPONSE）实现状态与架构

**已完成（服务端，rules.js）**：
- `RESPONSE_EFFECTS`（13 张卡的 `trigger.on`+`filter`）与 `CARD_TRIGGERS`
  声明齐全；新增 `RESPONSE_EFFECT_IMPL`（13 个 `effect` 回调）、
  `apply_responses(game,on,ctx,pre)`、`consume_response`、`first_nation_of_side`。
- 响应卡"暗置"已可用：`play_card` 的 `c.type==='RESPONSE'` 分支把卡推进
  `game.table_responses`（带 `nation` 字段，便于弃牌堆归属）。
- **两类语义、钩子时机不同**（关键设计）：
  - 事后类（`pre=false`，事件发生后结算）：15331/15335 消灭、15336 征召、
    15333 洗回牌堆、15328 弃状态卡、12503/12504 建设后消灭 → 在
    `build_piece`/`do_battle`/`play_card`（EVENT/EFFECT/STATUS 分支）钩子里
    事后调用 `apply_responses(..., false)` 自动结算。
  - 拦截类（`RESPONSE_PRE_CANCEL`，`pre=true`，中止正在发生的动作）：
    15329 经济战前无效（play_card 顶部前拦截）、15330/15332/15334/15337
    "被移除时本回合无法被移除" → 在 `eliminate_piece`/`remove_piece`/`resolve_supply`
    **删除前**调用 `apply_responses(..., true)`；返回 `cancel` 即中止移除。
    这同时修复了"保护类卡在补给阶段(15330/15334)失效"的问题（原 `resolve_supply`
    有 `is_protected` 挂载点但没接 `fire_trigger`）。

**验证**：用 node 直接 eval 暴露 `apply_responses`/`fire_trigger` 跑了 4 张代表卡
（15331 消灭 / 15336 征召 / 15337 拦截保护 / 15333 洗回），4/4 通过。
测试桩：`_test_resp.js`（用 eval 暴露内部函数，未改源文件）。

**待办（按优先级）**：
1. **可选响应 UI**：当前是"自动结算所有匹配响应卡"。规则"可以令之触发"意味着
   应让持有方**选择**是否响应（挂起 `pending_trigger`，play.js 弹候选、玩家选/跳过）。
   需要 play.js 处理 `pending_trigger` + view 暴露候选。
2. `15329` 需要 ECON 类型卡真正可打出；`15328` 需要 STATUS 卡真正可打出并留在
   `game.table[nation]`（effect 已写：从 `game.table[nation]` 移除该状态卡）。
3. `12503/12504` 已实现为 build 触发式消灭（敌方建设后消灭该部队），旧文档的 `game.bonus_battle` 占位逻辑已废弃（详见 R16）。
4. `15330/15332/15334/15337` 拦截目前靠 `register_modifier(protect)` + 返回
   `cancel` 双重保险；若同一部队被多次尝试移除，确认 modifier 不重复堆叠即可。

**教训**：响应卡"事后/拦截"必须用**两个不同的钩子时机**——"被移除时保护"若不放在
删除前，部队早已没了，保护毫无意义（这是规则 `resolve_supply` 注释里早就点出的坑）。

---

### 2026-09-26 · 15341/15342（STATUS）S4「放弃建设陆军」深度接入

**背景**：基础版 `STATUS_UI['15341'/'15342'] = { build: true }` 的 `on_click_table_status`
分支只做了"出牌阶段随时点状态卡直接 `send_action('activate_status')`"，违反设计 §3.3 S4
"打建设卡时，可不选地块，改为点击状态牌放弃建设"——状态卡应在**正在打《建设陆军》卡进入选地块**
时才可触发，且要真正放弃那张建设卡，而非随时白嫖征召。

**客户端深度接入（play.js）**：
- `on_click_table_status` 的 `ui.build` 分支：先判 `pending_card && pending_card.name === '建设陆军'`，
  非建设阶段 `toast('请先打出《建设陆军》卡并进入选地块，再点击此状态卡放弃建设')`；
  建设中则 `render_ask_box` 确认框（"正在建设《X》，放弃该建设，改为在{澳大利亚/印度}征召 1 支陆军？"），
  确认后 `cancel_basic_card()`（放弃原建设选择、**不真正建设**）+ `send_action('activate_status',{card})`。
- `STATUS_UI` 补 `recruit: '澳大利亚' / '印度'` 供确认框文案。
- `update_table_status`：对 `ui.build` 卡按 `pending_card` 是否建设陆军渲染——建设中加
  `.build-ready`（绿）"可放弃建设 → 征召 X"，否则 `.ts-disabled`"打出《建设陆军》后可放弃建设"。
- `start_basic_card` / `cancel_basic_card` 末尾各加 `update_table_status()`，使打/取消建设卡时
  桌面状态区提示即时切换。
- `play.css` 补 `#table_status .ts-card`（`.ready`/`.build-ready`/`.ts-disabled`/`.ts-ready`/`.ts-note`）。

**服务端语义（已具备，未改）**：`status_window_ready` 的 `build_army` 分支在出牌阶段放行；
`activate_status` 的 `cost.forgo_build_army` 仅 `log('放弃建设陆军')`，`effect.recruit` 在固定地区
放 1 支陆军。真正的"放弃建设"由客户端 `cancel_basic_card` 完成——打建设卡只是进入选地块高亮、
尚未真正 `play_card`，故 cancel 即收回建设卡，改用状态卡效果。

**关键坑**：判断必须是 `pending_card.name === '建设陆军'`（cards.js 中建设卡 name 即"建设陆军"；
"建设海军"不匹配，因为 15341/15342 text 都是"放弃建设陆军"）。切忌"出牌阶段即放行"的宽松判定，
那会让状态卡在没打建设卡时也能随便征召。

---

### 2026-09-26 · 状态卡"错误时点显示可打出、未置灰"的真正根因与修复（客户端显示）

**现象**（玩家反馈）：15341/15342、15340 国家资源动员法等状态卡在错误时点仍显示可点（绿/发光），
实际点不动，且不可触发的卡没有置灰，分不清能不能发动。

**错误诊断（已推翻）**：曾误判为"服务端 `view.table_status.ready` 只用了 `status_window_ready`，
而 `activate_status` 还额外校验 `status_active`(15343) 与 `once_per_turn`，view 与 action 判定不一致"。
实际上 `activate_status` 本来就正确执行这些校验，服务端判定是自洽的，根因不在此。

**真正根因（客户端 `update_table_status` 显示逻辑）**：
1. `ui.build` 分支（15341/15342）**无条件 `cls.push('ready')`**——整个出牌阶段都带发光/可点样式，
   哪怕并未在打《建设陆军》；而 `on_click_table_status` 只有 `pending_card.name==='建设陆军'` 才放行
   → 这就是"错误时点显示可打出、实际打不出"。
2. 其余 `!c.ready` 的卡（15340 自动卡无 trigger → ready=false；被 15343 压制、本回合已用过、时机不对）
   **没有任何区分样式**（不加 `.ready`、也不置灰），就是一张普通卡混在里面 → "没有置灰"。

**修复（play.js / play.css，服务端不动）**：
- build 分支去掉无条件 `ready`：仅当 `building && c.ready` 才加 `.ready`+`.build-ready`（绿光
  "可放弃建设→征召X"），否则 `.ts-disabled` 灰显"打出《建设陆军》后可放弃建设"。
- 非 build 分支按 `ui.auto`(15340→`.ts-auto`"自动结算") / `c.ongoing&&!c.trigger`(持续效果→`.ts-ongoing`) /
  `c.ready`(`.ready`"可触发") / 否则 `.ts-disabled`+"ready_reason" 区分渲染。
- 点击监听改为绑定所有 `.ts-card`；自动卡/持续卡点击分别 toast 明确提示，不可触发卡点击 toast 原因。
- `STATUS_UI` 加 `'15340': { auto: true }` 供显示与点击判断（无需改服务端，view 本就下发 ongoing/trigger 字段）。

**教训**：状态卡"显示可触发"的可信源是 `view.table_status[].ready`（服务端 `status_window_ready`），
但客户端显示层**绝不能**为"将来可能触发"的卡预设发光样式；build 类卡只有在真正处于对应子流程时才高亮。
排查 UI 显示类 bug，先看显示层逻辑、再看服务端校验，不要一上来就怀疑服务端判定不一致。

### 2026-10-06 · 状态卡计分循环通用化（跨阵营）与虚拟陆军光环

**背景**：实现 15444 丘克群岛（日本 STATUS）与 8601 远东共和国（日本 STATUS）。
15444「视为有陆军」= 在 `<硫磺岛>` 注入**虚拟日本陆军**（不提供补给源，补给经邻海由日本本土传来）；
8601「苏联计分阶段苏方-1」是**日本卡**却要在**苏联阶段**扣苏联分——跨阵营。

**原 `phase_scoring` auto 循环坑**（rules.js ~10847）：
> 1. 旧代码 `if (nation==='英国'||nation==='德国')` 硬守卫 + 内层只看同阵营桌面，
>    导致 8601（日本桌）在苏联阶段**根本扫不到**。
> 2. `if (bonus > 0)` 把负分（如 -1）直接丢弃。
> 3. 旧 4 张 auto 卡（15340 英 / 15241·15244·6601 德）没写 `trigger_nation`，
>    去掉守卫后它们会乱跑到别国阶段触发。

**正确做法**：
> 1. 去掉 `英国/德国` 守卫，改为**遍历所有阵营桌面**；
>    用 `cfg.auto.trigger_nation` 精确匹配当前计分国，无该字段才回退同阵营过滤。
> 2. `bonus > 0` → `bonus !== 0`，让负分 `-1` 能结算；`results.nation` 用 `cfg.auto.affects || n2`。
> 3. 4 张旧卡补 `trigger_nation`（15340→'英国'，德卡→'德国'）。
> 4. **新增 `trigger_nation` 跨阵营卡时，务必同时设 `affects`（被扣分方）**。

**虚拟陆军注入坑（compute_supply）**：
> 在 `compute_supply` 里把虚拟陆军写进 `game.location / piece_nation / piece_type` 参与补给传播，
> **函数 return 前必须 `delete` 掉临时 pid（`__varmy_<sp>`）**。
> 第一版漏了清理 → 临时 pid 残留在 `game.location`，下一轮 `resolve_supply` 会把"虚拟陆军"当真部队误删。
> 自检断言：`!Object.keys(g.location).some(k => k.indexOf('__varmy_') >= 0)`。

**两种新光环**：
> - `virtual_army`（space+给定国）：注入虚拟陆军，非补给源，依赖邻海补给传导。
> - `space_immune`（space+给定国）：指定空间内指定国部队恒为 `in_supply`（免移除），
>   在 compute_supply 的 2d 段处理（区别于 2c 的整国 `supply_immune`）。
> `status_aura` 初始化需含 `virtual_army:{}` 与 `space_immune:{}` 两键；
> `apply_status_ongoing` / `revert_status_ongoing` 都要加这两类分支。

**冒烟测试**：`tools/_smoke_ja_status.js`（15 项，覆盖 15444 光环/计分时相邻海域都有日本海军+1/补给链建海军、8601 免移除/苏联阶段-1）。

### 2026-10-06（续）· 15444 占领抑制 + 零分计分 item 缺失的测试坑

**15444 占领抑制**：用户要求"硫磺岛被其他国家占领时，持续光环不生效"。
> 错误做法：只在 `apply_status_ongoing` 里按当前是否被占决定是否写 `aura.virtual_army`。
> 这只能覆盖"打出时已被占"，覆盖不了"打出后被夺回"——光环写在 `status_aura` 里会一直留着。
> 正确做法：在 `compute_supply` 注入虚拟陆军前用 `space_enemy_occupied(game, sp, nat)` 动态判定，
> 被占则 `continue` 跳过注入。这样两种时序都正确。

**零分计分的 item 缺失（测试坑）**：
> `phase_scoring` 的 auto 循环是 `if (bonus !== 0)` 才 `results.push(...)`，
> 所以 **bonus 为 0 时不产生 item**（`bonusOf` 类辅助函数会返回 `null`，不是 `0`）。
> 写"应为 0 分"的断言时要用 `== null` 或在 `=== 0` 之外额外接受 `null`，
> 否则测试会误报 FAIL（卡牌逻辑其实是对的）。本次 15441/15442/15445 的"应为 0"用例都踩了这个坑。

**新增 8 张日本状态卡**（15439/15440/15441/15442/15443/15445/15446/15447，与 15444/8601 合计 10 张）：
- `score_per_unit` 类（15440）直接给 `spaces/nation/types/per`，引擎自动逐格计数。
- 含"相邻地区"的（15439/15446/15443）用 `kind:'run'`，在 run 内 `[id, ...data.spaces[id].connections]` 展开邻接；
  `data.spaces[id].connections` 是**数字 id 数组**，可直接喂 `pieces_on`。
- "存在即+1"类（15441/15442/15445/15447）一律 `kind:'run'` 自行判定返回 0/1；
  敌方判定用 `space_enemy_occupied(game, sp, '日本')`。
- 15443 的"仅对日本的补给点+标记"复用现成 `ongoing:{kind:'supply_point_and_markers', space:'马达加斯加', only:'日本', markers:1}`（与 15345/15347 同款）。
- 所有日本卡 `trigger_nation:'日本'`、`affects:'日本'`；冒烟测试扩到 **32 项全过**。

### 2026-10-06（续）· 日本经济战（ECON）6 张实现

在 `ECON_CARDS`（rules.js ~906）追加 **15414/15415/15416/15417/15418/7901**，复用德国/英国已建框架（`targets` 单目标→`run(game, actor, target)`；`tag` 标签；`attrition_passive` 损耗；`add_axis_score` 加分；`game.last_econ` 记录）。新增通用 helper `count_units(game, nation, spaceName, types, adj=true含相邻)`（在 `ECON_CARDS` 前）。

**关键坑（务必记住）：分数键是小写 `game.score.axis` / `game.score.allies`，不是 `AXIS`/`ALLIES` 常量名！**
> `add_axis_score(game, n)` 内部写 `game.score[AXIS]`，而 `AXIS` 常量值就是字符串 `'axis'`（对照 `check_final_win` 里直接写 `game.score.axis`）。
> 所以**测试里读分必须写 `g.score.axis`，写 `g.score['AXIS']` 永远读到 undefined → delta 恒为 0 误报 FAIL**。本次 6 张卡的逻辑全对、只有断言读错键，改 `g.score.axis` 后 19/0 全过。

**15415 气球炸弹口径（用户 2026-10-06 裁定，已三次修正）**：原文「获得1分。打出后，可弃置3张手牌：置入手牌」。
> **终态语义（用户 2026-10-06 末次裁定）**：「弃置3张手牌」是**条件/代价**、「置入手牌」是**效果**，两者**绑定成一个可选动作**——付完代价（弃恰好3张）才触发回手（把刚打出的《气球炸弹》本身从弃牌堆收回手牌）；可整体跳过。不是两个独立可选动作。
> 实现：ECON 配置加 `post(game, card_id, actor)` 钩子（15415 用之 `game.pending_balloon = {card, actor}`）；view 暴露 `balloon`（仅归属方可见，含 `can_pay = 手牌≥3`）；action 白名单登记 `balloon_discard/balloon_done`；`balloon_discard` 服务端校验 `drops.length===3` 且都在手牌 → 弃3张 → 把本卡从 discard 移回 hand → 关窗口；入口统一清里"错过即失效"（做别的动作窗口自动关，与 national_skill 同款）；客户端 `update_balloon_box` 弹 ask_box（「弃3张手牌→回手本卡」按钮，手牌不足时置灰 + 「完成」），弃牌复用 `start_one_step_picker({submit_action:'balloon_discard', need:3, min:3})`（恰好3张）。
> **踩坑史（同一张卡连错三次，都是卡面断句）**：① 先误读成"弃3张不补抽"；② 又误拆成"回手/弃牌两个独立可选按钮"；③ 终态才对：弃牌是代价、回手是效果、绑定。教训：**卡面「可A：B」结构里冒号常表"条件：效果/结果"，不是并列两项**；遇到歧义直接问用户，别自己猜三次。
> 该卡 `targets:['日本']` 仅为满足框架"必有 target"的强制要求，`run` 内忽略 `target`、只用 `actor` 操作自身手牌。

**7901 强占马六甲海峡**：条件「<东南亚>有日本陆军 且 相邻地区有日本海军」双满足才触发（`armySE>0 && navyAdj>0`），否则 `ok:true` 但无效果（卡仍正常消耗/占出牌名额）。

**其余 5 张计分口径**：
- 15414 封锁海参崴：`东海`+`北太平洋` 两指定格每1支日部队→轴+1（苏联损耗1，固定）。
- 15416 潜艇支援太平洋诸岛：`东太平洋`及相邻每1支日海军→轴+2，`tag:'潜艇行动'`（美国损耗2）。
- 15417 印度洋警备队：`印度洋`及相邻每1支日海军→轴+2（英国损耗2）。
- 15418 轰炸重庆：`中国西部`**半径2**（本格+相邻+相邻之相邻）每1支日空军→轴+1（美国损耗2）；"2地区内"=距离≤2，例：中国西部→中国东部（相邻）→东海（相邻之相邻）都在范围内。改用新增 `count_units_radius(game, nation, space, types, 2)` BFS 实现（旧 `count_units(...,true)` 只算相邻一格是错的）。

**测试与回归**：`tools/_smoke_ja_econ.js` **19/0 全过**（含 7901 三条条件分支）；回归 status 21/0、econ 通过、basic 297/0 无回退；服务器 8090 已重启（pid 12596）。
> 意大利(5)/美国(9) ECON 尚未做；15349 奇袭塔兰托仍挂起（卡图未定位）。

### 2026-10-06（再续）· 17817「进攻是最好的防守」顺序（苏联参战触发③ + 17850 大清洗）

需求：打出 17817 应先结束中立→触发 17850 大清洗的一次性出牌机会→玩家处理完大清洗（或主动继续）后，才建立对德战斗预算。
之前实现在 `play_card` EVENT 分支直接 `resolve_event_card(17817)`，**预算立即建立且早于中立解除**，导致玩家被引导先打陆战、大清洗机会被跳过/错乱。

**正确顺序（服务端）**：
- `play_card` 对 17817 走特例 early-return：先 `end_neutral`（若是中立，会经 `table_has(苏联,17850)` 一并置 `game.su_purge_offer`）；把手牌里的 17817 移除 + `mark_play_done` 占出牌名额；存 `game.su_17817_pending = card_id`；**不调用 resolve_event_card，不建预算**。
- 新增动作 `su_17817_proceed`：清掉未用的大清洗机会（`game.su_purge_offer=false`），再 `resolve_event_card(game,'苏联','17817',{})` 建立对德战斗预算并清 `su_17817_pending`。
- `su_purge_play`（消费大清洗打状态卡）成功后，若 `game.su_17817_pending` 存在，自动 `resolve_event_card` 建预算 → 即「先大清洗、后战斗」自然串联。

**view/acts**：view 暴露 `su_17817_pending`；acts 在 `su_17817_pending` 时给苏联阵营暴露 `su_17817_proceed`；`su_purge_offer` 仍按既有逻辑暴露（桌上需有 17850）。

**客户端**：`play.html` 加 `#su_17817_box`；`play.js` 新增 `update_su_17817_box()`（主渲染调用），展示：「大清洗机会」时列出手牌中 STATUS 卡按钮（`send_action('su_purge_play',{card})`）+「继续进攻（建立对德战斗预算）」按钮（`su_17817_proceed`）；`play.css` 配米黄面板样式（复用 `.eb-title/.eb-hint`）。

**测试**：`tools/test_neutral.js` 第 18 节（18.0–18.15 共 16 项）覆盖：打出后中立解除、**预算尚未建立**、`su_17817_pending` 置位；`su_17817_proceed` 后预算建立、罗斯在候选；桌上有 17850 时 `su_purge_offer=true`，`su_purge_play` 消费后**自动**建预算且 17850 入弃牌堆。全过 105/0。

**坑**：`resolve_event_card` 必须用 base id `'17817'`（不是实例 `'17817#1'`）；17817 的 battle step 的 `spacesFn` 用 `battle_initiators(game, '苏联', i)` 校验"相邻有可发起的苏联单位"，候选仅德国陆军。

### 2026-10-06（续）· 苏联增援识别修正 + 17901 工业心脏实现

**识别修正**：17900 八月风暴原误标 STATUS，用户裁定为 **EFFECT**（文案：`<中国东北>被友方国家攻击后，弃置1张[建设陆军]：在战斗地区征召苏联陆军，以此陆军发起1次陆战`）。仅改 `cards.js` 的 `type: "STATUS" → "type": "EFFECT"`，**暂不实现**（之后再做）。`out/su_cards.csv` 中的旧标注未动（CSV 非运行时数据）。

**17901 工业心脏（STATUS，已实现）**：
- 卡面：`<罗斯>增加1个计分标记。一回合一次，在<罗斯>建设陆军后：在相邻地区建设1支陆军。`
- `ongoing`：`<罗斯>增加1个计分标记`（永久，随卡；A4① 不撤销）。
  - `apply_status_ongoing` 原本没有"只加标记不加补给点"的 kind，`supply_point_and_markers` 会连带加补给点，与卡面不符。故在 `apply_status_ongoing` 顶层新增 `if (og.kind === 'marker_only')` 分支（与 `home_override` / `supply_point_and_markers` 同级），调用 `add_marker(game, sp, og.markers, og.only, onlyF)`，不加补给点。
- `trigger`：`window: 'after_build_army'`、`once_per_turn: true`、无 cost。
  - run 内 `const sp = (ctx && ctx.ctx && ctx.ctx.space != null) ? ctx.ctx.space : (game.last_built && game.last_built.space)`，再用 `data.name_of(sp) !== '罗斯'` 二次过滤（因 `arm_status_instant` 只按同阵营武装，盟国在罗斯建设也会武装 17901，须限定"在罗斯"）。
  - 效果：`get_neighbors(sp)` 找第一个 `terrain!=='sea' && can_build_at(game,'苏联',nb,'army').ok` 的相邻陆地，`build_piece('苏联','army',tgt)` 建 1 支。
- **坑**：`arm_status_instant(game,'after_build_army',nation,space)` 在 `build_actions` 里当 `game.last_built` 存在时调用，仅武装**同阵营持有国桌面**的卡；`run` 收到的 `space` 来自武装时传入的 `instEntry.space`（=建设地区，数字 id），所以 run 里用 `ctx.ctx.space`（与 17843/17846 范式一致）。`game.last_built` 此时已被 `build_actions` 清空，不能回退到它。

**验证**：临时脚本 `out/_verify_17901.js`（6/0）覆盖：17900 现 EFFECT；17901 打出后 `game.markers[罗斯]` 长度 +1；武装 space=罗斯 激活后罗斯相邻 +1 苏联陆军；武装 space=莫斯科（非罗斯）激活不建陆军。验证后已删除该脚本。

### 2026-10-07 · 《空军力量》打不出：hand_ready 预检 vs「先选模式才有 mode」的卡

**现象**：德国回合空军阶段，点手牌《空军力量》没反应（卡牌**置灰**、点了只弹 toast「《空军力量》在空军阶段只能选择部署或夺取制空权（调度空军请用【调度空军…】按钮）」），**"部署 / 夺取制空权"的模式选择框 `#mode_chooser` 从来没弹出来过**。此前已确认 `view.block_reason=null`、`play_card` 在动作白名单内 —— 即**不是挂起拦截**，也不是白名单问题。

**根因链（判定同源化改造的回归）**：
1. `view.hand_ready`（2026-10-01 引入，为消除"客户端置灰/服务端拒绝"漂移）用 `check_phase_for_card(game, n, face, {})` 对每张手牌**预检**，arg 是**空对象**；
2. `check_phase_for_card` 的空军阶段分支：`is_airforce_only(c)` 且 `mode` 是 `deploy`/`seize` 才放行，**mode 未指定一律拒绝**（该函数 11422 行）；
3. 《空军力量》恰恰是"**先弹框选 mode，才有 mode**"的卡 —— 预检时玩家还没选，于是**恒定 ok:false**；
4. 客户端两处都照抄 hand_ready：`update_hand_panel` 据此**置灰**，`on_click_hand_card` 第 ⑥ 步据此 **toast 后 return** —— 在 `start_basic_card()` → `show_mode_chooser()` **之前**就被拦掉，模式框永远弹不出来。
5. 为什么改之前能弹：旧的客户端版 `check_phase_for_card(c)` 在空军阶段**不查 mode**（`if (my_air_done) reject; return ok`），所以旧路径能进弹框；服务端版查 mode —— **"同源化"把客户端的宽松口径换成了服务端的严格口径，暴露出这类卡的语义差异**。

**修法（只放宽预检，不放宽执行）**：
- `rules.js` 的 `hand_ready`：对 `face.name === '空军力量'` 特判 —— 对 `['deploy','seize']` 逐个跑 `check_phase_for_card(...,{mode:m})` **+ `has_legal_target(...,{mode:m})`**，取【或】；`ok:true` 时把可行 mode 列表一并下发（`hand_ready[cid].modes`）。`play_card` 真正执行时仍带 mode 走严格判定（`resolve_basic_card` 也有"需指定 mode"兜底），**执行口径一点没放宽**。
- `play.js` 的 `show_mode_chooser`：优先用服务端的 `modes` 过滤按钮（避免列出"本国没空军 -> 夺取制空权"这种选了才被拒的死选项）；`modes` 为空时 **toast 明说原因**而不是弹空框。
- 另加兜底：`#mode_chooser` 是 `position:fixed`，但 `client.js` 会给 main 加 `transform:scale` —— 祖先有 transform 时 fixed 退化成相对定位会被挤出视口（这正是历史上"框不见了"的成因，play.css 有注释）。显示后自检 `getBoundingClientRect()`，落在视口外就 `document.body.appendChild(box)` 恢复视口定位。

**验证**：`out/_verify_air_ready.js` **10/0**（① 无 mode 预检仍拒绝＝执行口径未放宽 ② 有载体→ok 且 modes 含 deploy、无空军时不含 seize ③ 有空军+相邻敌机→modes 含 seize ④ 无载体→ok:false 且给出原因不静默 ⑤ 出牌阶段仍拒绝）。回归 `tools/test_basic_cards.js` 297/0、苏联响应 31/0、17807 5/0。服务器 8091 已重启（HTTP=200）。

**⚠ 遗留隐患（记录，未修，2026-10-07）**：`play.js` 里那套【不查 mode】的客户端版 `check_phase_for_card` 仍在（现在只在 `view.hand_ready` 缺失时兜底）。两套口径并存是本次"同源化不完全"的温床 —— 下次可能出现另一半漂移（"看起来能点 / 点了被拒"）。以后统一时：要么删掉客户端版，要么让它对《空军力量》也枚举 mode。

### 2026-10-07 · 预算给出后地图没高亮：高亮是全局共享资源，被别的面板"顺手全清"

**现象**：15205 建预算后，`view.event_budget.targets` 非空、面板也显示了，但地图【没有任何高亮】，点了目标地区也没反应（因为点击判定走的是同一份 targets）。

**根因**：`.target` 高亮是【全局共享】的 DOM class，`clear_target_highlight()` 会抹掉**所有人**贴的高亮。而 `update_pending_autobahn_box()`（高速公路面板）在 `view.pending_autobahn` 为 null 时【无条件】调用 `clear_target_highlight()` —— 该函数每帧 render 都会跑到（pending_autobahn 常态为 null）。

执行顺序（关键）：`update_map` → `update_phase_panel` → `update_phase_buttons`（里面 362 行 `update_event_budget_box` 贴高亮 → 366 行 `update_pending_autobahn_box` **清掉**）→ 回到 `update_map` 只重贴 `pending_card` 的高亮，**预算高亮没有重贴** → 丢失。

**修法（两处，互为双保险）**：
1. `update_pending_autobahn_box` 的清理改为【只清自己贴的】：`if (ask_state && ask_state.kind === 'autobahn') { ...; clear_target_highlight() }`，不再无条件清。
2. `update_map` 末尾新增 `reapply_event_budget_highlight()`：按 `view.event_budget.targets` 每帧重贴（与已有的 `pending_card` 重贴同款），这样即便将来又冒出别的"顺手全清"，预算高亮也不会丢。

> **通用规律（接教训 19 之后）**：任何"窗口消失即清理"的清理函数，只能清【自己贴的资源】（判据是 `ask_state.kind === 自己`），
> 不能无条件清全局；同时共享资源（如高亮）应由持有者在 render 末尾重新贴一次。
> 排查"数据有但界面没有"时，先查【同一帧里谁在后面清了它】。

### 2026-10-07 · 15205《JU-87 俯冲轰炸机》改分步原子（战斗预算）

**旧实现是错的**：`armed.run` 里用 `find_battle_target(...,{near:ctx.space, enemyOnly:true})` 自动挑【第一个】目标并立刻 `do_battle` —— 玩家既选不了打谁、也选不了由谁发起，且"损耗1"可能在没得选时白付。

**卡面正确语义（用户裁定）**：它【规定发起位置】（空军所在地区的相邻陆地）+ 给【1 次发起陆战的机会】—— 打谁、谁去打，由玩家在机会内决定。

**改法（复用 15226《巴巴罗萨》同款分步原子）**：
- `ECHO_EFFECTS['15205']` 新增 `steps:[{ op:'battle', kind:'land', pick:1, pickMin:0, spacesFn }]`；
- `armed.run` 不再直接开打，只【建立战斗预算】`game.event_budget = { remaining:1, anchor: 空军所在格, source:'armed', cost:{attrition:1} }` 并返回 `{ok:true, budget:true}`；
- 之后由 `event_battle` / `event_finish` 驱动 —— 与事件卡的战斗预算是【同一套】代码，候选同源走 `step_space_candidates`（因此也自动获得"发起单位由玩家选"的 UI）。
- **框架改动**：`step_space_candidates` 增第 6 参 `budget`，`spacesFn(game, actor, budget)` 多收一个预算对象（旧的只收两参，不受影响）；`event_battle_targets` 把 `b` 传进去 —— 这样"发起位置由事件上下文决定"的卡才拿得到锚点。
- **代价延后**：`use_armed_offer` 见到 `r.budget` 时【不】付代价、【不】弃卡（战斗还没打）；`event_finish` 里 `b.source==='armed' && battleOk===0` 时卡留手牌、不付代价（等同 skip），否则才 `attrition_cards` + `discard_card`。
- 候选 `ju87_land_targets(game, anchor)`：anchor 的相邻陆地 + 无本方部队 + `battle_initiators` 非空；允许空打（与 15231 同口径）。`ready` / `run` / `spacesFn` **三处共用**，不会漂移。

**验证**：`out/_verify_15205.js` **26/0**（窗口弹出 / 无目标时不给窗口 / 建预算且卡留手 / 候选都在 anchor 相邻、不含非相邻 / 发起后敌军被移除 / 结算后牌堆-1 弃牌堆+2 / 未发动不付代价 / 空打候选）。回归 basic 297/0、苏联响应 31/0、空军预检 10/0。客户端【无需改】—— 预算面板与"点地图选目标→选发起单位"流程是通用的。

**⚠ 后续方向（用户要求，待办）**：【发起战斗】和【建设部队】类效果，今后一律按 15226 的【分步原子】复用（`steps` + `spacesFn` + 战斗预算 / 建设选位），不要再写"服务端自动挑第一个目标/位置"的实现。同类待改清单（已知）：
- 15210《施佩伯爵海军上将号》、15231 已分步、15408《山本五十六》（部署/调度空军的选位）、苏联 EFFECT 批（17806/17808/17809/17811 目前是 armed+need 的假绿，同样要改造）。

**通用教训（新增，编号接通用教训 18 之后）**：
> **19. 预检函数不能拿"空参数"去判定"需要玩家先补参数"的卡。**
> 凡是 UI 上"先弹框选 X，再带着 X 执行"的卡（本例《空军力量》的 mode；同类还有"选目标国""选要打出的牌"），
> 服务端的预检/置灰判定必须**枚举候选参数取【或】**，并把**可行候选**下发给客户端过滤选项；
> 直接用最终执行函数的严格口径 + 空参数去预检，必然恒定拒绝，表现为"卡牌置灰 / 点了没反应 / 弹框不出现"。
> 判据：某卡在 UI 上有"二选一/三选一"弹框 -> 它的预检就必须枚举，不能单次判定。
