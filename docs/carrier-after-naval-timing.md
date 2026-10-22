# 「发起海战后」窗口修复（17540 航空母舰 / 15339 英国皇家海军）

> 修复日期：2026-10-23　玩家口径：**1A（本国发起）+ 2A（立刻）**
> 文件：`server-official/public/quartermaster-sub-wars/rules.js`

---

## 一、问题

| 卡 | 卡面 |
|---|---|
| **17540 航空母舰**（美国 STATUS） | 一回合一次，**发起海战后**，可损耗1张牌：在战斗地区建设海军 |
| **15339 英国皇家海军**（英国 STATUS） | 一回合一次，**发起海战后**，弃置2张手牌：发起1次海战 |

实测三个错误行为：

| # | 症状 | 原因 |
|---|---|---|
| ① | **整回合任意时刻可点**（做完 5 个无关动作后仍可发动） | `after_naval` 用 `game.last_battle` 判定，而 `last_battle` 持久到整回合 |
| ② | **同阵营任一国发起都放行**（英国发起 → 美国 17540 可发动） | 用的是 `faction_of_nation(lb.attacker) === faction_of_nation(nation)` |
| ③ | **之后又打一场陆战 → 窗口反而消失** | `last_battle` 被覆盖 |

根因：`after_land`（15253 闪电战，2026-09-30 玩家口径"发起陆战后**立刻**"）当时已改成
`game.status_instant` 瞬间窗口，**`after_naval` 没跟着改**。

---

## 二、改了什么（4 处）

### 1. 武装侧：海战也走瞬间窗口

```js
// arm_after_battle_status
- else if (kind === 'sea' && nation === '德国') { auto_fire_status(...) }
+ else if (kind === 'sea') {
+     arm_status_instant(game, 'after_naval', nation, space)   // 所有国
+     if (nation === '德国') { auto_fire_status(...) }         // 德国原逻辑保留
+ }
```

### 2. `status_instant` entry 增加 `by`（发起国）

```js
game.status_instant.push({ card_id, nation: own, window, space, by: nation })
```

### 3. 判定侧：`after_naval` 改为查瞬间窗口 + 校验本国发起

```js
case 'after_naval': {
    if (game.turn_phase !== PH.PLAY) return { ok: false, reason: '只能在出牌阶段发动' }
    const e = (game.status_instant || []).find(x => x.card_id === card_id && x.window === 'after_naval')
    if (!e) return { ok: false, reason: '仅能在「发起海战后立刻」手动发动，此刻已不可发动' }
    if (e.by && e.by !== nation)
        return { ok: false, reason: '只有发起海战的国家才能发动本卡（本场海战由【X】发起）' }
    return { ok: true, space: e.space }
}
```

### 4. 地区取值：`ctxSpace` 优先于 `last_battle`

```js
// run_status_effect（战斗类效果取地区）
- const sp = arg.space ?? (tr.window === 'after_ally_battle' ? ctxSpace : last_battle.space)
+ const sp = arg.space ?? ctxSpace ?? last_battle.space
```

顺带修掉 15339 的同类隐患：它 `effect.kind === 'battle'`，原先不显式选地区时会用
`last_battle.space`，被后续战斗覆盖后可能打到**错误地区**（与 2026-10-16 记录的 15338 踩坑同形态）。

---

## 三、修复后行为（`_smoke_17540_carrier.js` 19 项 ALL PASS）

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 美国刚发起海战 | ready=true | ready=true（带 `space`） |
| 再做 5 个无关动作 | **ready=true** | **ready=false**（窗口已关） |
| 英国发起海战 → 美国 17540 | **ready=true** | **ready=false**（提示"本场海战由【英国】发起"） |
| 打完陆战 | ready=false | ready=false |
| 海战后 last_battle 被陆战覆盖 | **ready=false（窗口丢失）** | **ready=true（用 status_instant 的 space）** |
| 15339 英国：美国发起 | ready=true | ready=false |

---

## 四、影响面（出问题回这里）

| 改动 | 影响卡 | 说明 |
|---|---|---|
| ① 海战武装窗口 | **17540 航空母舰**、**15339 英国皇家海军** | 唯一两张 `window:'after_naval'` 的卡 |
| ① 德国 auto_fire 保留 | 德国（当前无 after_naval 卡，空转） | 行为不变 |
| ② `entry.by` | 所有 `status_instant` 窗口 | 新增字段，只有 `after_naval` 读它；`after_land`/`after_ally_battle` 等不受影响 |
| ③ `after_naval` 判定 | 17540 / 15339 | 从"整回合"变"立刻" |
| ④ `ctxSpace` 优先 | **所有 `effect.kind==='battle'` 的状态卡**：15338（陆战）、15339（海战）、15346（自由法国，after_ally_battle） | 有武装窗口时用武装时记录的地区（本来就该如此），无窗口时行为不变 |

> ⚠ ④ 是唯一"超出航母范围"的改动。它把 `after_ally_battle` 已有的正确做法推广到所有窗口，
> 逻辑等价于"有 ctxSpace 就用它"；`_smoke_*` 全量对比中对 19 个既有失败测试的
> PASS/FAIL 行数**0 变化**。

---

## 五、配套测试

`tools/_smoke_17540_carrier.js`（19 项），分区：

| 段 | 锁什么 |
|---|---|
| A | 海战武装出 `status_instant` entry，含 `window/space/by` |
| B | 刚打完海战 `ready=true` 且带回 `space` |
| C | 独立动作后 `ready=false`，提示含"立刻" |
| D | 英国发起 → 美国 `ready=false`，提示指明英国 |
| E | 陆战不武装海战窗口 |
| F | `last_battle` 被覆盖后窗口仍在（不再依赖它） |
| G | 15339 同口径（含"只能在持有国回合发动"的通用约束） |
| H | 战斗地区按 `ctxSpace` 取，而非 `last_battle` |
| I | 德国 `auto_fire` 保留且不报错 |

---

## 六、仍未做的相关项

| 项 | 说明 |
|---|---|
| **ARMAMENT 卡组（39 张）整批未实现** | 含 **17213 企业号航空母舰**（发起或被发起海战后：建设1支海军）、**18414 赤城号航空母舰**（计分阶段开始：建设1支海军）。`rules.js` 对这批卡号 0 处引用 |
| 16801 哈尔西（美国 EFFECT） | 同样「发起海战后」，但走 `armed: {when:'after_battle', cond: kind==='sea'}` 通道，**时点本来就正确**，未改 |
