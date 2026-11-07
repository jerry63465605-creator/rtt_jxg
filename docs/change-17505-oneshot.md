# 17505《P-51 野马》：从「永久装载」改为「一次性额外损耗」

> 日期：2026-11-08　范围：`rules.js`（新增 armed 配置 + 删除 us_p51 三处 + 高亮同源修正）
> 玩家口径：P-51 的时点应像 17705《波尔多潜艇基地》——**打出[轰炸行动]时一次性追加损耗**，
> 不是装载后永久生效。

## 1. 改造前后

| 维度 | 改造前 | 改造后 |
|---|---|---|
| 生效方式 | `play_card` 特例：移出手牌 + `game.us_p51 = true`（**永久**） | `armed.when: 'econ_used'`：**每次**打轰炸行动时弹一次 |
| 玩家能否主动打 | 能（本方回合任意阶段） | **不能**（待命卡，手牌置灰） |
| 加成 | 之后每次轰炸都 +2×美国空军 | **只在这一次**追加，卡进弃牌堆 |
| 高亮 | `CARD_TRIGGERS['17505'] = conditional` → 本方回合常亮 | 平时灰；armed 窗口内由客户端解除置灰并给「可打出」角标 |
| 基数判定 | `_p51Before` 对比前后牌数 | 直接用 `ctx.attrited`（本次真实损耗，0 就不弹） |

## 2. 代码改动

### ① 新增 armed 配置（在 `CARD_TRIGGERS['17505']` 原位置替换）

```js
function p51_air_in_required_area(game, t) {
    const hb = effective_home_base(game, t)
    if (hb == null) return 0
    return count_pieces(game, { space: hb, radius: bombing_radius(game, 2), nation: '美国', types: ['air'] })
}

ECHO_EFFECTS['17505'] = {
    name: 'P-51 野马', actor: '美国',
    armed: {
        when: 'econ_used', actor: '美国',
        desc: '美国打出[轰炸行动]时：其要求地区内每有1支美国空军，损耗数加2',
        ready(game, ctx) {                       // 美国自己 + tag 轰炸行动 + 有效果 + 有空军
            …
            const attritedOf = t => { … }        // ⚠ ctx.attrited 是 {国家: 张数} 对象
        },
        run(game, ctx) {                         // 一次性：attrition_passive(t, 2×空军数)
            …
        },
    },
}
```

### ② 删除三处旧实现

```diff
- CARD_TRIGGERS['17505'] = { kind: 'conditional', nation: '美国' }
- // play_card 特例：if (inst_card_id(card_id) === '17505') { … game.us_p51 = true … }
- // ECON 内联加成：const _p51Before = …; if (game.us_p51 && cfg.tag === '轰炸行动') { … }
- // CMD_IMPL['17505']（已由 armed 自动判"已接入"）
```

### ③ 高亮同源修正（关键副作用）

`check_phase_for_card()` 的 EFFECT 分支原来对「没有 CARD_TRIGGERS 的增强卡」**无条件放行**
（`return { ok:true, timing:true }`）。P-51 删掉 trigger 后就会变成**高亮可打、点了被拒**：

```diff
+ const _cfgA = ECHO_EFFECTS[String(inst_card_id(cid))] || null
+ if (_cfgA && _cfgA.armed)
+     return { ok:false, reason:'《X》是【待命】增强卡：只在被触发的事件发生时才询问（…），不能主动打出' }
  /* 未声明时点：保持旧行为 */
  return { ok: true, timing: true }
```

这条同时把**所有 armed 卡**的手牌高亮对齐了（17805《红色管弦乐队》等也一并从"常亮"变成"平时灰、窗口内亮"）。

## 3. 实测坑（写进代码注释）

```
econ_used 的 ctx.attrited 不是数字，而是【按国家分的对象】：{ '德国': 6 }
→ ready 里必须 attritedOf(t) 归一化，否则 `{} > 0` 为 false，窗口永远不弹（第一版就踩了）
```

## 4. 验证

### `tools/_real_test_17505_oneshot.js` → **9/9**

```
A ★★ 打《B-29》后出现 17505 询问窗口
B ★★ 点它 → 德国额外损耗 2（1 支空军）；17505 进弃牌堆；game.us_p51 不存在
C ★★ 同局再打一次轰炸行动 → 不再弹（一次性）
D ★  要求地区内没有美国空军 → 不弹
E ★  轰炸本身无效果（半径内无美国陆军 → attrited=0）→ 不弹
F ★  静态：CARD_TRIGGERS['17505'] 已删、armed 已登记、无 us_p51 代码残留
```

### 旧测试改写（口径变更，不是删测试）

```
_real_test_17505_17513.js   16 项 ALL PASS（17505 段改为"永久加成已废弃"守卫，17513 段原样）
_real_test_hand_ready_17505.js 13 项 ALL PASS
   · A/B 段：改为"灰 + 拒绝"（P-51 已是待命卡）
   · D 段：17805 平时灰、窗口内仍可发动
   · F 段：17505 已无 CARD_TRIGGERS
```

### 回归

```
_real_test_15411_armed 11 项、_real_test_paradigm_two_interceptors 24 项 全绿
test_basic_cards 288/9（基线一致）　全量冒烟 112 全绿
```

## 5. 玩家可见变化

1. 手牌里的《P-51 野马》**不再能主动点**（平时灰，悬停提示"待命增强卡：只在被触发的事件发生时才询问"）；
2. 打《B-29》等轰炸行动后，若要求地区内有美国空军 → **弹一次**「打出《P-51 野马》」；
3. 点打出 → 目标国额外损耗 `2×空军数` 张，**卡进弃牌堆，本局不再生效**；
4. 轰炸无效果时**不弹**（不会白罚对手）。

## 6. 边界

- 链式经济战（`resolve_econ`）派发 `econ_used` 时**没有带 `attrited`** → 该路径下 P-51 的
  "无效果不弹"判据会放行（`attrited == null` 视为未知）。若以后有链式轰炸卡需要严谨判基数，
  在 `resolve_econ` 的派发里补 `attrited` 即可（一处）；
- 客户端零改动；生效需硬重启 node。
