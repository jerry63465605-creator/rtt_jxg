# 15411《夜间运输》：改为「日本回合开始时」询问（方案 B）

> 日期：2026-11-08　范围：`rules.js`（armed 配置 + 派发点 + 代价 filter 校验 + 提示文案）、`cards.js`（卡面）
> 玩家口径：**按 B** —— 不再是"补给阶段主动打出"，改为**日本回合开始时弹窗询问**；
> 目标也**不再限定"无补给"**（可选任意 1 支日本陆军/海军）。

## 1. 改造前后

| 维度 | 改造前（A 口径） | 改造后（B） |
|---|---|---|
| 时点 | `CARD_TRIGGERS['15411'] = { kind:'self', phase:'supply' }`（补给阶段主动打出） | `ECHO_EFFECTS['15411'].armed.when = 'nation_turn_start'`（**日本回合开始**，resource 阶段派发） |
| 触发方式 | 玩家自己点手牌 | 自动弹窗询问「打出／不打出」 |
| 目标 | 只能选**无补给**的日本陆/海军 | **任意** 1 支日本陆军或海军 |
| 代价 | `cost:{discard:1, filter:'response'}` | 同（挂在 `armed.cost`），并**在服务端补了 filter 校验** |
| 交互 | 一次性 `event_card_needs` + `run` | 两步：先弃 1 张[响应卡] → `run` 返回 `need:'piece'` → 点高亮部队结算 |

## 2. 代码改动（4 处）

### ① `ECHO_EFFECTS['15411']` 改成 armed

```js
armed: {
    when: 'nation_turn_start',
    actor: '日本',
    cost: { discard: 1, filter: 'response' },
    desc: '日本回合开始时：弃1张响应卡，选择1支日本陆军或海军，其在本回合内总是处于补给状态',
    ready(game) {                       // 两件事都成立才弹
        // ① 手里有可弃的[响应卡]（本卡除外） ② 场上有日本陆/海军
    },
    run(game, ctx, arg) {
        const cands = pick_unit_candidates(game, { nation:'日本', types:['army','navy'] })  // 不限无补给
        if (!cands.length) return { ok:true, skip:true, … }
        if (a.piece == null) return { need:'piece', candidates:cands, pick:1, pickMin:1, … }
        /* 校验 + ensure_supply_override + grant_supply */
    },
}
```

### ② `phase_resource()` 派发点：加日本

```diff
- if (nation === '苏联' || nation === '德国' || nation === '英国')
+ if (nation === '苏联' || nation === '德国' || nation === '英国' || nation === '日本')
      offer_armed_effects(game, 'nation_turn_start', { nation })
```

> 17805 的 `ready/actor` 仍只认苏/德/英，回归已验证日本回合不弹它。

### ③ 删掉旧的主动打出声明

```diff
- CARD_TRIGGERS['15411'] = { kind: 'self', phase: 'supply', nation: '日本' }
```
（改为注释说明，指向 `armed` 配置）

### ④ 两处"提示文案/校验"加固

```js
// trigger_ready：没有 CARD_TRIGGERS 但带 armed 的卡
if (!tr && ECHO_EFFECTS[id].armed)
    return { ok:false, reason:'《X》是【待命】增强卡：只在被触发的事件发生时才询问（desc），不能主动打出' }
// 取代原来的"《X》未声明时点"（内部术语，玩家看不懂）

// use_armed_offer 的代价预检：服务端校验类型，不只校验张数
if (ar.cost.filter === 'response') _picked = _picked.filter(是 RESPONSE 卡)
→ 不足时报「需先选择弃置 1 张[响应卡]作为代价…」
```

### ⑤ `cards.js` 卡面

```diff
- 任意时机，弃置1张[响应卡]，选择1支日本陆军或海军：其在本回合内总是处于补给状态。
+ 日本回合开始时，弃置1张[响应卡]，选择1支日本陆军或海军：其在本回合内总是处于补给状态。
```

## 3. 玩家实际流程

```
进入日本回合（resource 阶段）
 ├─ offer_armed_effects('nation_turn_start', {nation:'日本'})
 ├─ 底部弹「打出《夜间运输》（弃 1 张）／不打出」
 │    点"打出" → 选牌框（只列[响应卡]）→ use_armed_offer{card, drop}
 │       → 服务端付代价 → run 返回 need:'piece'（候选 = 日本陆/海军，全部）
 │       → 地图高亮部队 → 点选 → use_armed_offer{card, piece}
 │       →「X 的陆军在本回合内总是处于补给状态」
 └─ 若直接做资源再分配/出牌 → 窗口"错过即失效"（armed 既有语义）
```

## 4. 验证

### `tools/_real_test_15411_armed.js` → **11/11**

```
A ★★ 日本回合开始 → 窗口出现且含 15411
B ★★ 弃 1 张响应 → need:'piece'，候选=日本陆/海军
C ★★ 选部队 → 「日本 的陆军在本回合内总是处于补给状态」，卡进弃牌、代价进弃牌、窗口清空
D ★★ 弃非[响应卡] → 拒绝「需先选择弃置 1 张[响应卡]」，手牌不减
E ★  手里没有响应卡 → 不弹
F ★  场上没有日本陆/海军 → 不弹
G ★  德国回合开始 → 不弹（actor 限定）
H ★  日本·补给阶段主动打出 → 拒绝，提示【待命】增强卡 + 时点
I ★★ 候选包含"有补给"的部队（口径已放开）
J ★  17805 在日本回合开始不弹（仍只苏/德/英）
```

### 回归

```
_smoke_jp_effect.js   PASS=129 FAIL=0（块 6 已按新语义改写）
test_basic_cards      288 / 9（基线一致）
全量冒烟 112          未登记失败：无 ✅
```

## 5. 注意 / 边界

- **"先做资源再分配就错过窗口"** 是 armed 的既有语义（错过即失效）。玩家若想保留机会，应在弹窗出现时先处理它；
- 客户端**零改动**（复用 `#ask_box` + `echo_discard_modal` + `highlight_pieces`）；B32 之后窄屏也能看到；
- 旧的 `pickUnit` / 顶层 `cost` 已移除（改为 `armed` 内声明），`_smoke_jp_effect.js` 的代价断言已同步兼容；
- 卡面文案变更后，**老对局**里的卡面显示会立即更新（卡面来自 cards.js，不存进存档）。
