# 踩坑与决策记录（quartermaster-sub-wars）

> 目的：把「出过什么问题、为什么出、怎么改的、下次怎么避免」固化下来。
> **规矩：以后每解决一个问题，就往本文追加一条，不要只在聊天里说。**
>
> 维护方式：新条目加在对应章节末尾；跨周期的大坑加在「一、通用教训」里。

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

### 端口与环境（本机）

```powershell
# 启动（8091，避开 Steam 占用的 8080）
cd server-official
Start-Process cmd -ArgumentList "/c","set RTT_PORT=8091&& node server.js > srv8091.log 2> srv8091.err" -WindowStyle Hidden

# 注意：服务绑在 IPv6 ::1，用 localhost 访问，不要用 127.0.0.1
http://localhost:8091/
```

`server.js` 里端口优先级：`RTT_PORT` > `HTTP_PORT`(.env) > `8080`。

---

## 三、逐条问题档案（按时间倒序追加）

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
