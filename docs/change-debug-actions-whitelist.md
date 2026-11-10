# 调试面板「扣分 / 损耗 / 复原」点击不生效：白名单统一登记

> 日期：2026-11-10　玩家报障 #2（口径纠正）
> 玩家原话：「服务端三种动作已实测正常，问题是**客户端点击扣分损耗等当前不生效**」；
> 并确认「法国/中国损耗落到宗主国牌库」是**设计如此**，不是 bug，本次不动。

## 1. 现象与根因

`play.html` 三个按钮 → `play.js` 三个函数 → `send_action`：

| UI | `play.js` | verb | 服务端 `exports.action` 分支 |
|---|---|---|---|
| 执行损耗 | `12327` | `debug_attrition` | `rules.js:30308` |
| 复原到牌库顶 | `12333` | `debug_restore` | `rules.js:30332` |
| + 加 / − 减 | `12348` | `debug_score` | `rules.js:30360` |

三条链路的 verb 拼写、onclick 绑定、服务端处理分支**全部正确**，B28（2026-11-07）
还给 `do_action` 加了 `isDebugAction` 统一豁免各挂起守卫。只读探针验证服务端直调也生效：

```
常态 view.actions: … attrition=0 restore=0 score=0     ← 3 个全不在册
服务端 debug_score 直调：axis 0 -> -2，日志正确
挂起态(17555) 服务端 debug_score：allies +1 → 1
```

**唯一缺口**：`build_actions_inner` 的 `base`（`rules.js:29694-29701`）只登记了 7 个
`debug_*`，B28 新增这三条服务端分支时**漏同步白名单**。

```1063:1064:server-official/public/common/client.js
	let va = view.actions ? view.actions[verb] : undefined
	if (va) {
```
→ 不在册就**一条请求都不发**（`rtt-client-server-contract` 一号坑）。
而客户端 hint（`play.js:12328/12334/12349`）是**无条件**写的，所以表现为
「点了有提示、状态却没变」——排查时别被 hint 骗，它不代表请求已发出。

## 2. 复用点：外层 `finish_acts()` 统一出口

`build_actions_inner` 有 13 个排他式提前 `return {log:1, xxx:1}`，其中
`event_budget` 分支（`rules.js:29564` `return bacts`）的对象里**一个 `debug_*` 都没有** ——
挂起期间连已登记的 7 个也会一起失效。而调试面板恰恰是卡死时用来清理局面的带外工具。

框架已有统一出口，注释明确写了「放在外层而不是 13 个排他分支里，正是为了避免
新增挂起又忘了登记」：

```29783:29787:server-official/public/quartermaster-sub-wars/rules.js
	 * 放在【外层】而不是 13 个排他分支里，正是为了避免"新增挂起又忘了登记"。
	 */
	return finish_acts(game, side, acts)
```
回退动作（`29769-29775`）、`use/skip_armed_offer`（`29809-29812`）、
国家技能（`29813-29825`）都是这么补的。本次照抄「**追加，不要替换**」范式，
没有改 13 个分支、没有新增机制。

## 3. 改动（`rules.js` 一处，客户端零改动）

① 模块级常量 `DEBUG_ACTION_KEYS`（10 个 verb）——调试动作白名单的**单一来源**。
以后新增 `debug_*` 分支只改这里 + `exports.action` 处理分支，**不要再往 `base` 里加**。

② `finish_acts(game, side, acts)` 里统一追加：

```js
if (!game.game_over && !game.rollback_proposal) {
	for (const k of DEBUG_ACTION_KEYS) acts[k] = 1
}
```

**为什么带条件（判定同源）**：`do_action` 的两处硬冻结 —— 终局 `game.game_over`
（`29990`）、回退提议待确认（`29999`）—— 一律不接 `debug_*`。
若客户端照常给按钮，就成了「按钮能点、服务端拒绝」。其余挂起
（响应队列 / 分步 / armed / theater…）服务端都已用 `!isDebugAction` 豁免，
所以这里照常放行。

## 4. 验证 `tools/_real_test_debug_actions.js` → 28/28

```
A ★★ 常态 10 个 debug_* 全在册；常规动作未被替换（play_card/log 仍在）
B ★★ debug_score：服务端分数 -2 / view.score 同源 / 日志
C ★★ debug_attrition：牌库 -2、弃牌堆 +2、view.deck_counts 同源、日志
D ★★ debug_restore：牌库·弃牌堆复原到原张数、日志
E ★★ 挂起态(17555 前置弃牌) 10 个仍全在册；服务端接受且【不清窗口】
E2★★ 真正的排他 return（16300「先陆战」建立 event_budget，rules.js:29564）：
      10 个仍全在册、预算专属动作未被替换、调试动作生效且预算未清
F ★★ 终局冻结 / 回退提议待确认：debug_* 不在册 + 服务端拒绝 + 分数不变
H ★  残留检查：view 正常、无意外挂起、常规动作未被挤掉
```

> E 与 E2 的区别：17555 挂起本身**不**走排他 return（修复前是 7/10），
> 只有 `event_budget` 的 `return bacts` 才会丢掉整个 `base`（修复前 0/10）。
> E2 用真实 `play_card` 建立预算，证明外层兜底确实生效。

## 5. 回归（与 HEAD `c83cb08` 对照，无新增失败）

```
node --check rules.js                    SYNTAX=0
git diff --check                         0
_real_test_debug_actions.js              28 / 28
_real_test_16300_torch_choice.js         39 / 39
_real_test_17543_radar.js                4 / 4
_real_test_16703_delegate_skill.js       5 / 5
_real_test_15243_atlantic.js             3 / 3
_real_test_17901_choose.js               8 / 8
_real_test_supp_su.js                    25 / 25
test_event_cards.js                      190 / 11  （HEAD 同）
test_basic_cards.js                      288 / 9   （HEAD 同）
_verify_multistep.js                     通过 5 / 失败 5（HEAD 同）
_smoke_german_effect.js                  PASS=88 FAIL=6（HEAD 同）
_smoke_status.js                        PASS=20 FAIL=2（HEAD 同）
_smoke_econ.js                           与 HEAD 一致
check_reuse.js                           B/C 干净；21 个 WARN 全是
                                        存量 skill 原子索引行号漂移（非本次引入）
```

对照方法：`git stash push -- rules.js` → 同一批脚本在 HEAD 下重跑 → `git stash pop`。
HEAD 下只读探针复现报障（`debug_attrition/restore/score=0`、挂起期 7/10），
修复后 10/10，可作为因果的直接证据。

## 6. 玩家可见变化

```
以前：点「执行损耗 / 复原 / 分数±」只有 hint 文字，分数与牌库不变
      （挂起期间连其它调试按钮也一起失效）
现在：三个动作正常生效；任何挂起（战斗预算 / 响应窗口 / 分步停机）期间
      调试面板仍可用，且不会清掉正在等待的窗口
      终局后 / 回退提议待确认时不给按钮（与服务端拒绝口径一致）
```

> 客户端 `play.js` / `play.html` **未改动**，无需 bump 版本串、无需强刷；
> `rules.js` 已改，必须**重启服务器**才生效。
> 客户端无条件 hint 是否改成「仅当 `send_action` 返回 true 才显示」属 UX 改进，
> 本次按最小改动**未做**（留作可选）。
