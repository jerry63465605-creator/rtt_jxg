# 15343《霍巴特滑稽坦克》缺少"仅英国回合"限制，变成全域永久压制（已修复，未提交）

> 状态：**已修复（工作区）+ 回归通过，未提交、未部署**（2026-10-25）
> 卡面：**回合内，敌方国家的[状态卡]无效**
> 卡 id：`15343`｜国家：英国｜类型：STATUS（持续光环）
>
> ## 修复摘要
>
> - 改动位置：`rules.js` 的 `status_active()`（15343 判定分支）
> - 改动内容：`if (game.current_nation !== '英国') continue` —— 光环只在英国回合生效
> - diff 规模：+12 行（11 行注释 + 1 行判断），0 删除
> - 回归：新增 `tools/_smoke_15343_hobart.js`（8 项 **ALL PASS**）；
>   全量 68 个 smoke 失败 19 个，名单与基线完全一致；lint 0
> - 未做：未提交、未推送、未部署到 testserver
> - 线上局处理：**不补分**（玩家口径 2026-10-25：game 5728 及所有测试局均不考虑补救）

## 一、卡面语义 vs 实现

卡面写的是"**回合内**"，即：只有**英国的回合**里，敌方状态卡才无效；轮到德/意/日回合时，15343 应当是废的。

实现（`status_active`）：

```js
function status_active(game, card_id, owner_nation) {
	const _sid = String(inst_card_id(card_id))
	if (game.su_red_suppressed && game.su_red_suppressed[_sid] === game.turn) return false
	const ownerF = faction_of_nation(owner_nation)
	if (!ownerF) return true
	for (const n in (game.table || {})) {
		if (faction_of_nation(n) === ownerF) continue
		for (const cid of (game.table[n] || [])) {
			if (String(inst_card_id(cid)) !== '15343') continue
			/* 敌方 15343 自身也要生效才压制（嵌套保护，避免互相压制死循环） */
			return false
		}
	}
	return true
}
```

**没有任何"当前是否英国回合"的判断** —— 只要英国桌面摆着 15343，敌方**所有**状态卡在**任何回合**都失效。

## 二、实测（已复现）

构造：英国桌面 `15343#1`，意大利桌面 `17741#1`（海王），场上 1 支意大利海军。

```
--- 意大利回合（current_nation = 意大利）---
status_active(海王) = false        ← 被压制
计分 gained = 0                    ← 海王不加分
海王生效吗：被压制（不加分）

--- 英国回合（current_nation = 英国）---
status_active(海王) = false        ← 应当被压制（正确）
```

意大利回合本应 `status_active = true`、海王 +1，实际被压成 0。

**这正好解释了线上 game 5728 的现象**：意大利计分阶段 `last_scoring` 只有地块 +2，海王（场上有 1 支海军）没有贡献 —— 因为同盟桌面有《霍巴特滑稽坦克》。

## 三、影响面

`status_active` 共有 12 个调用点，覆盖状态卡的**全部**生效路径：

| 用途 | 调用点 |
|---|---|
| 计分阶段 auto 卡（含海王 17741、意大利 17739/17740/17743/17745 等） | 21311 |
| 状态卡发送权 / UI 置灰 | 23720、24337 |
| `activate_status`（点击发动） | 27070 |
| 光环查询（补给/大本营/港口/免疫等） | 5241、5280、5313、5446、5463、7002、7785 |

也就是说：**只要英国桌面有 15343，轴心的所有状态卡在所有非英国回合里全部失效**。这远大于卡面语义。

## 四、修复方案（**已采用方案 A 并落地**）

### 方案 A（已实施，与卡面对齐）

在 `status_active` 的 15343 判定里加回合条件：

```js
for (const n in (game.table || {})) {
    if (faction_of_nation(n) === ownerF) continue
    for (const cid of (game.table[n] || [])) {
        if (String(inst_card_id(cid)) !== '15343') continue
        /*
         * 卡面「回合内」= 只在【英国回合】生效。
         * 原实现漏了这一条，导致只要卡在桌面就永久压制敌方所有状态卡。
         */
        if (game.current_nation !== '英国') continue
        return false
    }
}
```

- 英国回合：敌方状态卡全部无效（符合卡面）
- 其他回合：15343 自身无效，敌方状态卡照常
- 改动 1 行，覆盖 12 个调用点

### 方案 B（若语义是"仅在打出的那一个英国回合"）

用 `freq_key` 记录打出时的英国回合，只在那一回合压制：

```js
if (game.table_15343_turn !== freq_key(game)) continue
```

这需要在打出 15343 时写入标记、回合切换时清理。成本更高。

**需要您确认是 A 还是 B**：卡面只写"回合内"，A 的读法是"每次英国回合都压制"，B 的读法是"只压制打出的那一回合"。从帝国砥柱同类持续性状态卡的习惯看，**A 更贴合**。

## 五、待办

- [x] 确认 A / B 语义 → **采用 A**（每次英国回合都压制）
- [x] 实施（用 `game.current_nation === '英国'`，不看"卡所在国"）
- [x] 补 smoke：`tools/_smoke_15343_hobart.js` —— 8 项 **ALL PASS**
  - 英国回合 → 敌方状态卡 `status_active === false` ✅
  - 意大利回合 → 敌方状态卡 `status_active === true` ✅
  - 意大利回合 + 海王 + 1 海军 → 计分 +1 ✅
  - 德国回合 → 轴心状态卡生效 ✅
  - 同阵营卡不受影响 ✅ / 无 15343 时不压制 ✅
- [x] 全量回归：68 个 smoke 失败 19 个，名单与基线一致
- [x] lint：0 条
- [ ] 提交 / 推送 / 部署 testserver（**未做**，等指示）
- [x] ~~线上 game 5728 补 1 分~~ → **不做**（玩家口径 2026-10-25：所有测试局一律不补、不回滚）
- [ ] 回填本文档：commit hash

## 六、相关代码位置

| 内容 | 位置（`server-official/public/quartermaster-sub-wars/rules.js`） |
|---|---|
| 15343 卡配置（`ongoing: suppress_enemy_status`） | 3807–3811 |
| **`status_active`（缺陷所在）** | 6569–6584 |
| 15343 派生式设计说明 | 5406–5410 |
| 计分 auto 卡循环 | 21309–21349 |
| UI 置灰 | 23720 |
| 状态卡发送权 | 24337 |
| `activate_status` 拦截 | 27070 |
| 17741 海王实现 | 5058–5070 |

## 七、与其它待修项的关系

| 文档 | 与本篇的关系 |
|---|---|
| `17805-red-orchestra-active-desync.md` | 17805 也用 `su_red_suppressed` 压制单张状态卡，但那条按 `game.turn` 精确到轮次，**没有**这个问题 |
| `15207-air-supply-suspect.md` | 若 15207 被 15343 压制，也会表现为"打出后补给没变" —— 排查时需要区分是压制还是实现问题 |

本篇是目前"状态卡集体失效"类现象的**首要嫌疑**，优先级建议高于 17852。
