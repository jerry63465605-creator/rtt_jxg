# 15444《丘克群岛》港口光环重做（2026-10-23）

> 卡面：**`<硫磺岛>` 视为日本港口。计分阶段：若 `<硫磺岛>` 相邻地区都有日本海军，获得 1 分。**
> 核心问题：原实现是「视为有日本陆军」，而且**在建海军路径上完全不生效**。

---

## 一、卡面 vs 旧实现

| 卡面 | 旧实现 |
|---|---|
| `<硫磺岛>` 视为日本**港口** | `kind: 'virtual_army'` —— 视为有**日本陆军**（临时注入 `game.location`） |

「港口」在规则里只有一个作用：**海军 B 条件**（"相邻有本国陆军 = 港口"），
用于①建海军 ②海军补给。它**不该**让该格真的变成"有陆军"，也不是补给源。

---

## 二、实测：三条路径三种表现（修复前）

| 路径 | 结果 | 原因 |
|---|---|---|
| 光环写入 | ✅ `status_aura.virtual_army = {48:'日本'}` | |
| **建海军**（硫磺岛有日本海军 + 补给点、无陆军） | ❌ **3 个相邻海域全部拒绝**「海域须邻接本国陆地部队（陆军）」，**有没有 15444 完全一样** | 虚拟陆军只在 `compute_supply` **内部**注入、返回前清理；而建海军是在其后才调 `navy_ab_check` |
| 海军补给（`compute_supply` 内部调用 `navy_ab_check`） | ✅ 生效 | 此时虚拟陆军还在 `location` 里 |
| 敌方占领硫磺岛 | ✅ 光环失效 | `has_pieces({space, enemyOf})` |

**额外副作用**：
- 虚拟陆军被当成普通陆军参与**补给续链**（超出"港口"语义）
- 若该格有补给点，它还会被评为**补给源**：实测 `sources.__varmy_48 = 'base'`

---

## 三、改法

### 3.1 新增「港口」光环

```js
game.status_aura.port_as = { 48: '日本' }   // <spaceId>: <nation>
```

语义：该陆地格等同"有本国陆军"，**只满足海军 B 条件**。
不提供补给、不作为补给源、也不让该格算作"有陆军"。

### 3.2 `navy_ab_check` 显式识别（一处改、两条路径同时生效）

```js
const portAs = (game.status_aura && game.status_aura.port_as) || {}
for (const nb of list) {
	if (portAs[nb] != null && String(portAs[nb]) === String(nation) &&
		!has_pieces(game, { space: Number(nb), enemyOf: nation })) {
		hasLand = true          // 港口 = 等同相邻有陆军（仅 B）
	}
	for (const other of pieces_on(game, nb)) { ... }
}
```

`navy_ab_check` 是**建海军**（`_build_piece_impl`）与**海军补给**（`compute_supply`）的
唯一 A/B 判定点 —— 改这里两路都覆盖。

### 3.3 删除虚拟陆军注入

`compute_supply` 的 1b 段（注入）与末尾清理段一起移除：
- 不再有 `sources.__varmy_*` 脏键
- 不再让硫磺岛给相邻陆军续链补给

---

## 四、改动清单

| # | 位置 | 改动 |
|---|---|---|
| 1 | `status_aura()` | 新增 `port_as` 初始化；**惰性迁移**旧 `virtual_army` → `port_as` |
| 2 | `apply_status_ongoing` | `kind:'port'` → 写 `aura.port_as[sp] = nation` |
| 3 | `revert_status_ongoing` | 同步清 `port_as` |
| 4 | `navy_ab_check` | 港口判定（含敌占失效） |
| 5 | `compute_supply` 1b + 清理段 | 删除虚拟陆军注入 |
| 6 | 15444 配置 | `kind:'port'`，desc 改「视为日本港口」 |

**老对局兼容**：`status_aura()` 里做惰性迁移，已有 `virtual_army` 的对局无需重开。

---

## 五、影响面

| 项 | 变化 |
|---|---|
| 建海军 | ✅ 硫磺岛相邻 3 海域（中太平洋 / 东海 / 北太平洋）B 条件成立（**新能力**） |
| 海军补给 | ✅ 与修复前等价（仍走 `hasLand`） |
| 相邻陆军续链补给 | ⚠ 不再发生（符合"港口不提供补给"） |
| `sources` 脏键 | ✅ 消失 |
| "某地有日本陆军"类条件 | ✅ 不再被硫磺岛误满足 |
| 计分（相邻都有日本海军 +1） | ✅ 不变（独立逻辑） |
| 敌占失效 | ✅ 保持原行为 |

全库只有 15444 使用过 `virtual_army`（1 处配置），无其它卡依赖。

---

## 六、测试

`tools/_smoke_15444_port.js`（18 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | `port_as[48]='日本'`；`virtual_army` 已不存在；无卡时为空 |
| B | **有卡**：3 个相邻海域都可建海军；**无卡**（对照组）：全部拒绝 |
| C | 相邻海域日本海军在补给；`sources` 无 `__varmy_*`；`location` 无残留；硫磺岛不算"有陆军" |
| D | 硫磺岛被美军占领 → 3 海域都不可建（敌占失效保持） |
| E | 无补给点时港口不等于补给源（该格海军不在补给） |
| F | 计分：3 海域都有日本海军；缺一个则不满条件 |
| G | 老存档 `virtual_army` → `port_as` 迁移后可正常建海军 |

全量 60 个 smoke：失败 19 个，名单与改动前一致。

---

## 七、回修入口

| 症状 | 先看 |
|---|---|
| 硫磺岛有日本海军却建不了海军 | `status_aura.port_as` 是否写入；`navy_ab_check` 的 `portAs` 判定 |
| 硫磺岛被敌方占领后港口仍生效 | `navy_ab_check` 里的 `has_pieces({space, enemyOf})` 守卫 |
| 硫磺岛莫名能建陆军 / 被当补给源 | 是否有残留的 `virtual_army` 注入（应当为 0） |
| 老对局里 15444 无效果 | `status_aura()` 的惰性迁移是否执行到（任何会调它的入口都行） |
