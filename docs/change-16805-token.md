# 16805《B-25 米切尔》：转手改为「生成英国版衍生卡 16899」

> 日期：2026-11-08　范围：`cards.js`（新增 token 卡 + `cards_of_nation` 排除 TOKEN）、`rules.js`（16805.post 改写 + 新增 16899 配置 + `mint_card_instance`）
> 玩家口径：不要"把 16805 塞给英国"（引擎没有实例改国籍机制，塞过去英国打出仍按"美国海军"判定）；
> 而是**生成一张英国新经济战牌**，不加入卡组，效果为：
> 「[轰炸行动]选择1个大本营2地区内有{英国}海军的敌方国家：其损耗4张牌。」

## 1. 改造前后

| 维度 | 改造前 | 改造后 |
|---|---|---|
| 转手方式 | `post` 把 **16805 本身**从美国弃牌堆取出 → 塞进英国手牌 | `post` **铸一张 16899**（英国版）塞进英国手牌；16805 正常进美国弃牌堆 |
| 英国打出时的判据 | 仍按 **美国海军**（与卡面「改为{英国}」矛盾） | 按 **英国海军** ✓ |
| 卡组 | 16805 变成"英国手里的美国卡"，混在卡组统计里 | 16899 `deck:'TOKEN'`，**不进任何牌堆** |
| 幂等 | 无（16805 回手可再塞一次） | 英国已持有 16899（手牌或弃牌堆）→ 不重复生成 |

## 2. 代码改动

### ① `cards.js`：新增 token 卡（id 用 **16899**，因为 16806 已被美国《大规模部署》占用）

```json
{
  "id": 16899,
  "deck": "TOKEN",
  "name": "B-25 米切尔（英国）",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]选择1个大本营2地区内有{英国}海军的敌方国家：其损耗4张牌。",
  "img": "sheet168_r0_c5.png",
  "nation": "英国"
}
```

```diff
  function cards_of_nation(nation) {
-   return CARDS.filter(c => c.nation === nation)
+   /* deck:'TOKEN' = 衍生卡（只在效果里生成，不进牌堆） */
+   return CARDS.filter(c => c.nation === nation && c.deck !== 'TOKEN')
  }
```

> 不做这条过滤的话，16899 会被塞进英国牌堆（实测第 15 张就出现了）。

### ② `rules.js`：16805.post 改写 + 16899 配置

```js
post(game, card_id, nation) {
    const ukHas = 英国手牌/弃牌堆已有 16899
    if (ukHas) { log('…英国已持有英国版，不再重复生成'); return }
    game.hands['英国'].push(mint_card_instance(game, '16899', '英国'))
    game.log.push('《B-25 米切尔》置入英国手牌：换为英国版（{英国}海军判据，损耗 4）')
}

'16899': {                       /* ECON_CARDS */
    tag: '轰炸行动',
    targets_fn: 敌方国家中，大本营 radius bombing_radius(2) 内有 ≥1 支【英国海军】
    run: 复检 + attrition_passive(target, 4)
}
```

新增通用助手（衍生卡铸号，沿用 `card_inst[nation]` 计数避免撞号）：

```js
function mint_card_instance(game, face, nation) {
    init_nation_deck(game, nation)
    game.card_inst = game.card_inst || {}
    game.card_inst[nation] = Number(game.card_inst[nation] || 0) + 1
    return String(face) + '#' + game.card_inst[nation]
}
```

顺带把 16805 的"大本营"口径从 `home_base_of` 改为 **`effective_home_base`**（尊重迁都，与 B-26 统一）。

## 3. 验证 `tools/_real_test_16805_token.js` → **8/8**

```
A ★★ 美国打 16805：德国损耗 4；英国手牌 +1 张 16899；16805 留在美国弃牌堆
B ★★ 16899 deck=TOKEN，六国牌堆/手牌出现次数 = 0
C ★★ 英国打 16899：只有美国海军 → 「当前无满足条件的目标」（打不出）；
     放英国海军 → 正常结算，德国损耗 4
D ★  16805 条件不满足（无美国海军）→ 打不出，且英国拿不到 16899
E ★★ post 幂等：英国已持有 → 「不再重复生成」
```

实测日志：

```
《B-25 米切尔》置入英国手牌：换为英国版（{英国}海军判据，损耗 4）
【美国】打出《B-25 米切尔》[轰炸行动]—— 德国 损耗 4 张牌

【英国】打出《B-25 米切尔（英国）》[轰炸行动]—— 德国 损耗 4 张牌
```

## 4. 回归

```
_smoke_us_econ.js     该段已按新口径改写（英国获得 16899 / 16805 留在弃牌堆）→ 全绿
test_basic_cards      288 / 9（基线一致）
全量冒烟 112           未登记失败：无 ✅
_real_test_supp_de    18 项 ALL PASS
_real_test_supp_jp    17 项 ALL PASS
```

## 5. 注意

- 卡表总数从 446 变 **447**（多一张 TOKEN）；`deck` 取值新增 `TOKEN`（不入池，牌库审计里会显示"不会入池"，属预期）；
- 预览页会自动出现这张卡（`ECON_CARDS` 有登记 → 显示已接入）；
- 客户端零改动；`rules.js`/`cards.js` 生效需硬重启 node。
