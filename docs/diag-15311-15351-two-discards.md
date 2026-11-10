# 诊断（不改代码）：15311 / 15351 同刻双窗口 + 第二张的弃牌框不弹

> 日期：2026-11-10　性质：**纯诊断**
> 复现脚本：`tools/_probe_15351_lifeleap.js`、`tools/_probe_15311_then_15351.js`
> 涉及：`rules.js` 的 `ECHO_EFFECTS['15311'/'15351']`、`offer_armed_effects`、
> `play.js` 的 `update_armed_offer_box()` / `update_echo_discard_box()` / `confirm_echo_discard()`

## 0. 玩家现象

「德国《阿登闪击战》打<西欧>移除法国陆军 → 英国窗口里先打《马奇诺防线》(弃4)，
再点《敦刻尔克大撤退》时**弃牌选择框不弹**，界面卡住。」

## 1. 事实 A：两张卡在同一个 offer 里

```
armed_offers = [ piece_removed@英国 :
   15311#81 《马奇诺防线》 cost{ discard:4, filter:null }
   15351#82 《敦刻尔克大撤退》 cost{ discard:2, filter:null } ]
```

同刻另有 `pending_trigger = [15337《生命的飞跃》]`（桌面暗置响应）。
客户端 `update_armed_offer_box()` 开头有 `if (view.pending_trigger) return` → **先问 15337**，
处理完再回到 15351/15311 —— 这条顺序是既有设计，没问题。

## 2. 事实 B（本次核心）：第一张打完后，剩余卡的 `cost` 变成 0

打完 15311（弃 4）后，服务端保留该 offer，但剩余条目变成：

```json
{ "card": "15351#82", "name": "敦刻尔克大撤退", "cost": 0 }
```

对照刚创建时的 `cost: { attrition:0, discard:2, filter:null }` —— **`cost` 退化成数字 0**。

客户端代价判定：

```js
// play.js L2521-2536
const dis = (c.cost && c.cost.discard) || 0
if (dis) { pending_echo_discard = {…limit: dis…}; update_echo_discard_box() }   // 弹弃牌框
else { send_action('use_armed_offer', { card: c.card }) }                       // 直接打
```

`c.cost === 0` → `0.discard === undefined` → `dis = 0` → **走 else 分支**：

```
① 弃牌框不弹（玩家看到的就是这个）
② 直接 use_armed_offer{card}（不带 drop）
③ 服务端也按"无代价"处理 —— 实测日志里【没有】「【英国】弃置 2 张手牌」
   ⇒ 代价白免（比"卡死"更严重：这是规则性漏洞）
```

随后进入 15351 的 `need:'choice'`，两个分支又都 `disabled:true`（见第 3 节）→ 视觉上"卡死"。

## 3. 事实 C：15351 两个分支恒灰（独立缺陷）

```js
// rules.js L12570（当前 0c92156 版本）
const okNavy = can_recruit_at(game, '英国', 'navy', Number(space_id('北海'))).ok
// 正确签名：can_recruit_at(game, nation, space, type)
```

第三/四参赛写反 → `data.spaces['navy']` 不存在 → 恒「地区不存在」→
`choiceOptions = [navy:disabled, army:disabled]`。

> 全库扫描：只有这 2 行有此问题（`can_recruit_at` / `can_build_at` 参数顺序）。

## 4. 事实 D：共享 modal 的 4 个"使用者"（第二类风险）

`echo_discard_modal` 被四套流程共用一个 DOM，`update_echo_discard_box()` 里按**固定优先级**分流：

```js
if (status_discard_sel)        { render_status_discard_box(); return }     // 状态卡代价
if (pending_guard_sel)         { render_guard_discard_box();  return }     // 15410 武士道
if (effect_cost_discard_sel)   { render_effect_cost_discard_box(); return } // 7900 脚本卡
if (!pending_echo_discard)     { modal.add('hide'); return }               // armed / ECHO 代价
```

⇒ 只要上述任一变量**残留非空**（上一次流程没清干净），armed 的弃牌框就会被顶掉、或直接被 `hide`。
本次现象已由事实 B 解释，但这条"共享 modal + 优先级 return"是同类 bug 的温床，建议一并记入已知风险。

## 5. 复现步骤（本地，30 秒）

```powershell
node tools/_probe_15311_then_15351.js
```

关键读数：

```
[c réation]      cards = [15311#81 cost{discard:4}, 15351#82 cost{discard:2}]
[after 15311]    cards = [15351#82 cost 0]         ← cost 丢失
再打 15351        log = 「请做出选择」（无「弃置 2 张」）← 代价白免
view.armed_offer.pending.choiceOptions = [navy:disabled, army:disabled]  ← 死窗口
```

## 6. 修复方案（**本次不实施**，供决策）

### P1（必须）：让剩余卡片的 `cost` 保持原样

| 方案 | 做法 | 风险 |
|---|---|---|
| **A（推荐）** | `armed_offer` 的卡片条目**不要存 cost 快照**；客户端/`view` 渲染时从 `ECHO_EFFECTS[face].armed.cost` **现算**（与 17532「每步现算」同源） | 低；需同步 `view.armed_offer.cards[].cost` 的生成点 |
| B | 付款后重建 offer 时，剩余卡片重新取 `ar.cost`（找出那条 `cost: 0` 的赋值点并修正） | 低；改动局部 |
| C | 卡面代价改为「一次性付一次、所有卡共用」 | 规则口径变化，不建议 |

### P2（必须，安全网）：服务端不得接受"未付代价"的 use_armed_offer

```js
// use_armed_offer 里（与 15411 的 cost.filter 校验同款）
if (ar.cost && ar.cost.discard) {
    const need = ar.cost.discard
    const picked = (gathered.drop || []).filter(id => hands.includes(id))
    if (picked.length < need) { log('需先弃 N 张作为代价'); return game }
}
```

即便客户端 `dis=0`，服务端也会拒绝 → 从"白免"退化为"点了没反应"，再由日志说明原因。

### P3（建议）：修 15351 的分支恒灰

`can_recruit_at(game, '英国', Number(space_id('北海')), 'navy')` + `ready()` 预检"至少一个分支可行"。

### P4（可选，健壮性）：共享 modal 加"属主令牌"

给 `pending_echo_discard` 之外的三套流程各加 `owner` 字段，渲染时只认当前属主，避免残留互相顶掉。

## 7. 结论

```
玩家说的「第二个弃牌框弹不出来 + 卡死」，是两个缺陷叠加：
  ① 同一 offer 内第二张卡的 cost 变为 0 → 客户端跳过弃牌框，且代价白免（主因）
  ② 15351 两分支恒 disabled（can_recruit_at 参数顺序）→ 打完也选不了，视觉上"卡死"
与 15337 的先后顺序无关；15337 只是"同刻先被问到"的那一个。
```
