# 【已修复】战斗挂起 × 响应挂起 互相挡死

> 状态：**已修复**（2026-10-25）—— 采纳"先甲后乙"
> 实证脚本：`tools/_repro_battle_x_response_deadlock.js`（10/10，断言已从"期望被挡"翻转为"必须都有出路"）
> 起因：`_smoke_pending_union.js` 长期 6 项失败，其中 3 项是这个问题；修完后该脚本 **ALL PASS**
>
> 下方 §一 ~ §四 保留原始定位过程，§七 是实际改动。

---

## 一、结论先行

**不是某几张卡的组合 bug，而是两个守卫都想独占控制权；卡只是"把局面推到这一步"的搬运工。**

```25839:25847:server-official/public/quartermaster-sub-wars/rules.js
	if (game.pending_battle && action !== 'resolve_battle' &&
		action !== 'use_armed_offer' && action !== 'skip_armed_offer' &&
		!(arg && arg.__debug) && !String(action).startsWith('debug_')) {
		game.log.push('战斗结算中：正在等待【' +
			pending_wait_nation(game.pending_battle) + '】' + ... )
		return game
	}
```

```25874:25893:server-official/public/quartermaster-sub-wars/rules.js
	if ((game.response_queue && game.response_queue.length ||
		game.response_stack && game.response_stack.length) &&
		action !== 'trigger_response' && action !== 'pass_response' &&
		action !== 'resolve_response_choice' &&
		action !== 'response_reorder' && action !== 'response_confirm' &&
		action !== 'use_armed_offer' && action !== 'skip_armed_offer' &&
		action !== 'activate_status' && ...) {
		game.log.push('响应结算中：等待【…】决定是否发动这 N 张暗置响应牌，…')
		return game
	}
```

三个致命点：

1. **两个守卫都不按 `side` 过滤** —— 一旦成立，锁的是**全桌**，不是某一方；
2. **白名单互不包含**：前者放行 `resolve_battle` 但不含 `trigger_response`；后者放行响应动作但不含 `resolve_battle`；
3. 于是 `trigger_response` 被前者挡、`resolve_battle` 被后者挡 —— **没有任何动作能把两个挂起中的任意一个清掉**。

实证输出（`node tools/_repro_battle_x_response_deadlock.js`）：

```
trigger_response -> 战斗结算中：正在等待【苏联】…        ← 被守卫 A 挡
resolve_battle   -> 响应结算中：等待【同盟国】…          ← 被守卫 B 挡
pass_response    -> 战斗结算中：正在等待【苏联】…        ← 被守卫 A 挡
actions = {"trigger_response":1,"pass_response":1,…}    ← UI 却给了按钮
```

最后一行是关键：**UI 给按钮、服务端全拒** —— 玩家点了毫无反应，且没有出口（pitfalls「能点的 ≠ 能成功的」通用教训 3）。

---

## 二、唯二可达入口（为什么平时不容易撞到）

响应帧一旦入栈，`play_card` / `next_phase` / 各类推进动作**全被守卫 B 挡下**（实证已验证），
所以"响应未表态期间再发起一次战斗"这件事，**只能**从守卫 B 白名单里那两个能带出战斗效果的入口发生：

| 白名单动作 | 为什么危险 | 实证 |
|---|---|---|
| **`activate_status`** | 状态卡效果里可以直接 `do_battle` | 脚本 `[入口 4]` 通过：不被守卫 B 挡 |
| **`use_armed_offer`** | 增强卡（armed）效果里也可以 `do_battle` | 同上 |

其它动作（含 `play_card`）被挡 → 反而安全（实测 `play_card` 会被"响应结算中"拦下）。

---

## 三、具体卡清单

### 3.1 「能穿过守卫发起战斗」的卡（点火器）

| 卡 | 名 | 国家 / 类型 | 触发窗口 | 出处 |
|---|---|---|---|---|
| **15247** | 贵在行动 | 德国 STATUS | `after_build_army` —— **建设陆军后**，损耗1张发起1次陆战 | rules.js 4861，`do_battle` @ 4895 |
| **15245** | 俯冲式轰炸机 | 德国 STATUS | `after_land` —— **发起陆战后**，损耗1张再发起1次陆战 | rules.js 4820，`do_battle` @ 4847 |
| **17746** | 耀武 | 意大利 STATUS | `play_start` —— 跳过出牌、损耗2张发起1次陆战 | rules.js 5332，effect kind `'battle'` |

| armed（增强）通道 | 名 | 国家 | 备注 |
|---|---|---|---|
| **15205** | JU-87 俯冲轰炸机 | 德国 EFFECT | steps `op:'battle'` |
| **15210** | 施佩伯爵海军上将号 | 德国 EFFECT | `do_battle` @ 10984 |
| **15212** | G7e 鱼雷 | 德国 EFFECT | `do_battle` @ 11052 |
| **15406** | 南云忠一指挥航空队 | 日本 EFFECT | `do_battle` @ 11471 |
| **17900** | 八月风暴 | 苏联 EFFECT | `do_battle` @ 11765 |

### 3.2 「会被挂在响应栈里」的卡（引信·未表态）

任何一张 RESPONSE 都算，其中最容易被上述入口撞上的：

| 卡 | 名 | 国家 | 触发时机 | 为什么容易和上面的卡撞在一起 |
|---|---|---|---|---|
| **17737** | 以逸待劳 | 意大利 | `build` / `recruit`（敌方在<意大利>相邻建设/征召陆军后） | **德国建设陆军同时点亮 15247 的窗口** —— 同一个动作两类窗口并存 |
| **17835** | 斯大林格勒保卫战 | 苏联 | `<乌克兰>` 苏联陆军被移除时 | 陆战刚结束就进 `after_land`（15245） |
| **17830** | 保卫祖国 | 苏联 | 回合开始时 | 回合开始触发，随后意大利 `play_start` 用 17746 打过来 |
| **15337** | 生命的飞跃 | 英国 | 法国陆军被移除时 | 同上，`after_land` 场景 |

### 3.3 「打了之后会挂起战斗」的卡（锁扣）

只要被攻击方有下面任意一项，`do_battle` 就会 `set_pending_battle`：

| 卡 / 机制 | stage | 等待谁表态 | 出处 |
|---|---|---|---|
| **17837** KV-2 重型坦克 | `kv2_ask` → `kv2` | 先苏联、后攻击国 | rules.js 18525 |
| **17853** 一步也不许后退! | `su_step_back` | 苏联 | rules.js 18561 |
| **15410** 武士道 | `guard` | 防守方（日本） | rules.js 18590 |
| 空军代受 / 反代受 | `counter` | 攻方或守方 | rules.js 18799 / 18811 |

---

## 四、三个最容易真实触发的组合

### 组合 ①（最近的一条路径）—— 同一次「建设陆军」

```
德国在与<意大利>相邻的地区建设陆军
   ├─ 触发意大利 17737《以逸待劳》 -> 响应帧入栈（意大利未表态）
   └─ 同时点亮德国 15247《贵在行动》的 after_build_army 窗口
德国点 activate_status 打出《贵在行动》-> 对相邻发起陆战
对手是苏联且苏联暗置着 17837 KV-2 / 17853 一步也不许后退
   -> set_pending_battle(kv2_ask / su_step_back)
===> 全桌死锁
```

### 组合 ② —— 同一次「陆战」的尾部

```
德国发起陆战并移除对方单位
   ├─ piece_removed 触发 17835/15337/15330… -> 响应帧入栈（未表态）
   └─ 战斗结束点亮 15245《俯冲式轰炸机》的 after_land 窗口
德国点 activate_status 打出《俯冲式轰炸机》-> 再发起一次陆战
再打中苏联（KV-2/17853）或日本（15410 武士道）
===> 全桌死锁
```

### 组合 ③ —— 回合开始

```
苏联 17830《保卫祖国》回合开始触发 -> 响应帧入栈（未表态）
意大利 play_start 用 17746《耀武》（activate_status）跳过出牌发起陆战
打中苏联 -> KV-2 / 17853 -> set_pending_battle
===> 全桌死锁
```

> 组合 ① 的概率最高：**同一个动作**（建设陆军）就把两类窗口同时点亮了，不需要任何巧合。

---

## 五、修复方案（三选一，待你拍板）

| 方案 | 做法 | 优点 | 代价 / 风险 |
|---|---|---|---|
| **甲 · 守卫并集（最小改动）** | 守卫 A 的白名单补 `trigger_response` / `pass_response` / `resolve_response_choice`；或守卫 B 补 `resolve_battle`。两边至少各留一个出口 | 改动 2 行，专门解决死锁 | 只治"解不开"，不治"UI 给按钮却点不动"；需确认放行后两个结算交叉不会错乱（例如响应改变了 victim 是否还在版图） |
| **乙 · 挂起排队（推荐）** | 两个守卫改成**串行**：pending_battle 存在时，响应帧入栈但**不对外开放**（`build_actions` 不给响应动作），等战斗挂起结束再交给玩家表态 | 语义清晰、UI 与服务端一致；不会再出现"点了没反应" | 需改 `build_actions` 的 pendingTrigger 分支 + 两个守卫，改动约 20 行，必须跑全量回归 |
| **丙 · 禁止并存（防患）** | 在 `set_pending_battle` 前先拒绝：若响应栈非空且新战斗会挂起，则本次战斗走"自动放弃/直接结算"分支 | 从源头不产生死锁局面 | 会削弱规则（保护卡可能来不及生效），**不建议单独用**；可作为乙的兜底 |

**建议**：先做**甲**止血（1 次发布内可完成），再把**乙**作为下一批的正式修法（顺修 `pending_union` 夹具）。

---

## 五之结论 · 采纳方案

**先做甲（止血），再做乙（UI 与服务端一致）** —— 丙（禁止并存）不采用，它会削弱"先制响应须先表态"的规则语义。

## 七、已实施的修复

### 甲 · 两个守卫互放行（服务端层，各给对方留一条出口）

| 守卫 | 位置 | 改动 |
|---|---|---|
| 战斗守卫 | `rules.js` ~25839 | 白名单补 `trigger_response` / `pass_response` / `resolve_response_choice` / `response_reorder` / `response_confirm`（新增 `_isResponseVerb`） |
| 响应守卫 | `rules.js` ~25874 | 白名单补 `resolve_battle` |

两条出口都在 -> 玩家可以**任选顺序**：先表态响应，或先结算战斗，不再有无出路的死锁。
（与 17506/17547 的修法同款：同一时点的多个窗口互不误伤。）

### 乙 · UI 与服务端一致（白名单层）

新增 `merge_pending_battle_resolve(game, side, acts)`（在 `pending_stage_zh` 之后）：
**当战斗挂起的等待方就是本方时，把 `resolve_battle` 并进动作表**，只给轮到表态的那一方。
接入三处（`build_actions` 的响应分支）：

| 分支 | 改前 | 改后 |
|---|---|---|
| 待发动（candidates 空） | `{trigger,pass,reorder,confirm,log}` | 同上 **+ `resolve_battle`** |
| 选目标（candidates 非空） | `{resolve_response_choice,log}` | 同上 **+ `resolve_battle`** |
| 非持有方冻结 | `{log:1}` | 同上 **+ `resolve_battle`**（对称的一半：响应帧是对手的、但战斗等待本方时也要给本方表态权） |

`block_reason` 同步补充"同时有战斗待【X】表态，两者可任选顺序"。

### 验收结果

| 项 | 结果 |
|---|---|
| `tools/_repro_battle_x_response_deadlock.js` | **10/10**（先 resolve_battle / 先 trigger_response / 先 pass_response 均不再被挡；动作表同时含两者） |
| `tools/_smoke_pending_union.js` | 从 **6 FAILED → ALL PASS** |
| 全量回归 `tools/_run_smoke_report.js` | 失败断言 **16 项 → 15 项**（只少了 pending_union），零新增 |

### 顺带修的夹具（`_smoke_pending_union.js`）

| 处 | 问题 | 处理 |
|---|---|---|
| 场景 1 | 只写派生视图 `response_queue`，真相源已迁到 `response_stack` | 改为按 `request_responses` 的帧结构压栈 |
| 场景 2 | 修复后场景 1 的 action 真会执行、响应栈被消耗，导致场景 2 测的不是并存 | 场景 2 开头重新压帧 |
| 场景 2 断言 | 旧断言"轴心能继续选建设位置"与 B2 的"非持有方冻结"语义冲突 | 按现行语义改为断言冻结 |
| 场景 3 | 依赖已从 rules.js 删除的 `su_red_ask / su_red_use`（17805 改走 propose_rollback） | 换成现行 `pending_battle` 机制，意图不变 |
| 场景 3 断言 | "德国被冻结"在白名单层并不成立（冻结由服务端守卫负责） | 改为测服务端真实行为：点 play_card 应被"战斗结算中"挡下 |

## 六、验收标准（修完逐条实测）

1. 组合 ① 的真实路径走完：能既表态响应、又结算战斗，**顺序任意**
2. `tools/_repro_battle_x_response_deadlock.js` 的 `[死锁 3]` 三条断言转为"不再被挡"
3. UI 与服务端一致：动作在册 = 点了必然生效（无"点了没反应"）
4. `_smoke_pending_union.js` 的 3 项死锁断言转 PASS（另 2 项 `su_red_ask` 断言需按新机制重写）
5. 全量回归：`tools/_run_smoke_report.js` 失败断言不得多于当前 16 项
