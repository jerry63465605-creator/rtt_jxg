# 「限定 <太平洋>」类卡检查（2026-10-23）

> 卡面写 `<太平洋>`，但地图上**不存在**叫"太平洋"的地区。
> 实际是 `REGION_GROUPS['太平洋']` = **中太平洋(28) / 南太平洋(43) / 北太平洋(49) / 东太平洋(52)**。
> 凡是以 `<太平洋>` 为条件的卡，都必须走这个组展开，且**服务端可点判定与效果判定要同源**。

---

## 一、全部「太平洋」相关卡清单（18 张）

| 卡 | 类型 | 卡面要点 | 实现口径 | 判定 |
|---|---|---|---|---|
| **17544 美国海军陆战队** | 美国 STATUS | 在`<太平洋>`建设海军后：对**相邻地区**发起1次陆战 | 见 §二 | ❌ **两处不同源，已修** |
| 17506 沉睡的巨人 | 美国 EFFECT | 在`<太平洋>`建设海军后：相邻地区建设1支部队 | `armed.cond` + `run` 双判 `is_pacific_space` | ✅ |
| 17534 揍一顿再谈判 | 美国 EVENT | 在`<太平洋>`建设1支海军 → 以此海军发起海战 | `space_ids_expand(['太平洋'])` + `useNewPiece` | ✅ |
| 16301 太平洋舰队 | 美国 EVENT | 对`<太平洋>`之一海战 → 在`<太平洋>`之一建设海军 | `space_ids_expand(['太平洋'])` ×2 | ✅ |
| 16303 中途岛海战 | 美国 EVENT | 对`<中太平洋>`发起海战 | `space_ids_of(['中太平洋'])`（单一具体海域） | ✅ |
| 16806 大规模部署 | 美国 EVENT | 在`<东太平洋>`及相邻征召陆/海军 | `around: '东太平洋'` | ✅ |
| 17508 太平洋基地 | 美国 EFFECT | `<中太平洋>`相邻征召陆军 | 具体地区 | ✅ |
| 17509 王牌飞行员 | 美国 EFFECT | `<中太平洋>`或相邻部署空军 | 具体地区 | ✅ |
| 15409 太平洋帝国 | 日本 EFFECT | `<太平洋>`每有1支日本海军 +1 分 | `space_ids_expand(['太平洋'])` | ✅ |
| 15446 太平洋共荣圈 | 日本 STATUS | `<东太平洋>`相邻每有1支日本陆军 +1 分 | 几何邻接 `data.spaces[].connections` | ✅（见 §四） |
| 15443 前进基地 | 日本 STATUS | `<东太平洋>`相邻有日本陆军 +2 分 | 同上，写法一致 | ✅ |
| 15442 控制南洋诸岛 / 15427 机动舰队 / 15414 封锁海参崴 / 15416 潜艇支援 / 15413/18419/18420 | — | 均为**具体海域**（中/东/北/南太平洋之一） | 具体地区 | ✅ |

结论：**只有 17544 有问题**，其余 17 张口径正确。

---

## 二、17544 的两个缺陷

### ① 服务端：非太平洋海域建海军后也「可点」

`status_window_ready` 的 `after_build_navy` 分支原先只看"窗口是否存在"：

```js
const e = (game.status_instant || []).find(x => x.card_id === card_id && x.window === 'after_build_navy')
if (!e) return { ok: false, reason: '仅能在「建设海军后立刻」手动发动…' }
return { ok: true, space: e.space }
```

于在 `<北大西洋>` / `<北海>` / `<地中海>` 建海军后 **ready = true**（彩色可点），
点了才被 `run` 里的 `is_pacific_space` 拒掉 —— 典型的"能点的 ≠ 能成功的"。

### ② 客户端：不设候选，可点任意地区

```js
'17544': { battle: 'land', attacker_owner: true }   // 没有 spaces / spaces_from_window
```

`start_status_battle` 三个分支（`fixed` / `spaces_from_window` / `spaces`）都不命中 →
不贴高亮、玩家可点地图任意地区，点了才被服务端"只能对相邻地区"拒掉。

---

## 三、修法

### 1. 通用地区组判定（单一来源）

```js
/* sp 是否属于 REGION_GROUPS[group]（卡面泛称 <太平洋>/<中国>/<非洲>） */
function space_in_group(sp, group) {
	if (sp == null || !group) return false
	const list = space_ids_expand([group])
	return list.indexOf(Number(sp)) >= 0
}

function is_pacific_space(sp) { return space_in_group(sp, '太平洋') }
```

原先 `is_pacific_space` 用"名字含『太平洋』"，虽然暂时等价，但新增一个名字含太平洋却不在组里的海域时会静默错。改为组展开。

### 2. 窗口级地区限定（声明式）

`trigger` 新增可选字段 `space_group`，`status_window_ready` 的 `after_build_navy` 分支：

```js
if (tr.space_group && !space_in_group(e.space, tr.space_group))
	return { ok: false, reason: '仅当在<' + tr.space_group + '>建设海军后发动（本次建在 ' + 地区名 + '）' }
```

17544 配置加 `space_group: '太平洋'`，与 `run` 内的判定**同源**（都由 `REGION_GROUPS['太平洋']` 展开）。

### 3. 客户端候选

```js
'17544': { battle: 'land', attacker_owner: true, spaces_from_window: true }
```

候选由服务端 `status_battle_spaces` query 按窗口地区动态算，内建地形过滤
（`kind='land'` 只保留陆地）—— 正好等于卡面的"相邻地区"。

点了非候选地区会被客户端 `status_battle_cands` 直接拦掉（不再发请求）。

---

## 四、关于"相邻"用几何邻接还是连通性

`15443` / `15446` 用的是 `data.spaces[id].connections`（**几何邻接**），
不走 `get_connections`（后者受海峡限制 / 阵营影响）。

判断：**这是计分卡的既有统一口径**（"相邻地区"指地图上相邻，与能否通行无关），
两张卡写法一致，不改。战斗 / 补给 / 建设才必须走 `get_connections`。

---

## 五、测试

`tools/_smoke_pacific_scope.js`（25 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | 地区组口径：4 海域 ∈ 太平洋；北大西洋/陆地/null 均否；`space_in_group` 与组同源 |
| B | 4 个太平洋海域建海军 → ready=true；北大西洋/北海/地中海 → ready=false 且原因含"<太平洋>"与本次地区名 |
| C | 无窗口（未建过海军）→ ready=false，原因提"建设海军后立刻" |
| D | 客户端 `spaces_from_window` 与 `status_battle_cands` 拦截都在 |
| E | 16301/17534 候选 = 4 海域；16303 = 中太平洋 1 个 |
| F | 端到端：东太平洋建海军 → 对相邻陆地（阿拉斯加）陆战，德军被移除、损耗 1 张、状态卡留桌面 |

---

## 六、追加修复：无可用发起单位时的状态不清理（2026-10-23 玩家反馈）

玩家反馈 **17544「没有触发登陆作战，并可以反复触发自身」**。

### 根因

`show_initiator_choices()` 在「服务端返回的可用发起单位为空」时无条件调用
`cancel_basic_card()`（**基础卡**的取消函数）：

```js
if (!list.length) {
    toast('没有可发起战斗的本国陆军或海军（空军不能发起战斗）')
    cancel_basic_card()      // ← 对状态卡无效
    return
}
```

对状态卡战斗（17544 / 15338 / 15339 / 15346）来说：

| 残留状态 | 后果 |
|---|---|
| `status_act_phase` 仍为 `'battle'` | 点地图无任何反应 |
| `battle_flow` 未清 | 一直停在 `step:'from'` |
| `ask_state` 仍是 `'battle_from'` | 面板文案卡住 |
| 服务端 `r.ok=false` 时**保留**瞬间窗口 | 桌面上又能**反复点击同一张卡** |

**两个症状（没打起来 + 反复触发）同源**。

### 修法

按来源分流：

```js
const isStatus = !!(battle_flow && battle_flow.origin === 'status')
toast(isStatus
    ? '该地区周边没有可发起战斗的本国陆军/海军（须相邻且处于补给状态），请重新点击状态卡并选择其它地区'
    : '没有可发起战斗的本国陆军或海军（空军不能发起战斗）')
if (isStatus) cancel_status_act()
else cancel_basic_card()
```

### 规则前提（不是 bug）

陆战发起单位必须是**与目标地区相邻、且处于补给状态**的本国陆军**或海军**（空军不能发起）。
若目标周边确实没有这样的部队，这张卡当下就无法生效 —— 现在会明确提示并清理状态，而不是静默卡住。

---

## 七、回修入口

| 症状 | 先看 |
|---|---|
| 在非太平洋建海军后 17544 仍亮着 | `trigger.space_group` 是否还在；`status_window_ready` 的 `after_build_navy` 分支 |
| 点 17544 高亮不对 / 能点任意地区 | 客户端 `STATUS_UI['17544']` 是否有 `spaces_from_window` |
| 卡面 `<太平洋>` 类卡候选数量不对 | 用 `space_ids_expand(['太平洋'])`，不要写死某个具体海域 |
| 新增"在<X>后"的状态卡 | 直接用 `trigger.space_group: 'X'`，别再在 `run` 里单独判一遍 |
