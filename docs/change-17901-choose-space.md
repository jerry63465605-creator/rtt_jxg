# 17901《工业心脏》：改为玩家选相邻地区建设（不再服务端自动挑）

> 日期：2026-11-10　玩家报障 #1：「工业心脏没给可选，自动建设了」
> 范式来源：**17552《战时生产》/ 17547《人工港》/ 15248《合成燃料》** —— 状态卡"建设预算"两步选地

## 1. 根因

```js
// 旧实现（rules.js trigger.run）
const nbrs = get_neighbors(sp)
const tgt = nbrs.find(nb => … can_build_at(game, '苏联', Number(nb), 'army').ok)
build_piece(game, '苏联', 'army', Number(tgt))      // ← 服务端替玩家挑第一个合法地
```

卡面是「在<罗斯>**相邻地区**建设 1 支陆军」——相邻常有 4 个合法地，
玩家既看不到候选、也没有选择权，表现为"自动建设了"。

## 2. 既有范式（本次直接复用，未新造机制）

| 环节 | 既有实现 |
|---|---|
| 客户端发起点选 | `STATUS_UI[cid] = { sbuild:'army' }` → `start_status_build()` |
| 候选现算 | 服务端 `query 'status_build_spaces'`：`base = status_instant[card].space`、`scope = 'near'`（无 `build_scope:'all'` 时） |
| 提交 | 地图点击 → `send_action('activate_status', { card, space })` |
| 服务端校验 | `status_build_ok(game, nation, type, base, space, scope)`（各卡同源） |

17901 的 `trigger` 已有 `window:'after_build_army'` + `build_space:'罗斯'`，
所以 `status_instant[card].space` 天然等于 **罗斯** → `scope='near'` 自动给出相邻合法地。

## 3. 改动（2 处）

### ① `rules.js` · `STATUS_EFFECTS['17901'].trigger.run`

```js
run(game, ctx) {
    const base = ctx?.ctx?.space ?? game.last_built?.space
    if (data.name_of(base) !== '罗斯') return { ok:false, reason:'仅当在<罗斯>建设陆军后发动' }
    const space = ctx.arg?.space != null ? Number(ctx.arg.space) : null
    if (space == null) return { ok:false, reason:'请选择建设地区' }          // 不再自动挑
    if (!status_build_ok(game, '苏联', 'army', base, space, 'near'))
        return { ok:false, reason:'该地区不可建设（需与<罗斯>相邻的空地）' }
    const r = build_piece(game, '苏联', 'army', space)
    …
}
```

### ② `play.js` · `STATUS_UI`

```js
'17901': { sbuild: 'army' },     // 与 17552 / 17547 / 15248 同款
```

## 4. 验证 `tools/_real_test_17901_choose.js` → 8/8

```
A ★★ 在<罗斯>建设陆军（真实 17800 卡）→ status_instant 武装 17901（base=罗斯），ready=true
B ★★ status_build_spaces → ["北欧","东欧","西伯利亚","乌克兰"]（base=罗斯）
C ★★ 不带 space → 拒绝「请选择建设地区」，且【不建设】
D ★★ 带 space=<最后一个候选 乌克兰> → 在乌克兰建设 1 支陆军（证明确实按玩家选择，不是 find 的第一个）
E ★  非相邻（巴西）→ 拒绝「需与<罗斯>相邻的空地」
F ★  在<乌克兰>（非罗斯）建设陆军 → 17901 不武装
```

> 测试注意：`after_build_army` 的武装是 **在 `view()` 里惰性完成**的（rules.js L26676），
> 所以断言 `status_instant` 前必须先取一次 `view`。

## 5. 回归

```
_real_test_supp_su.js   25/25（该文件里 17901 段已按"两步选地"改写，原断言基于旧的自动建设）
test_basic_cards        288 / 9
全量冒烟 112            未登记失败：无
_smoke_status.js        20 / 2（两条为预存失败，与本次无关）
```

## 6. 玩家可见变化

```
以前：点《工业心脏》→ 立刻在某个相邻地区冒出一支陆军（玩家不知道建在哪、也改不了）
现在：点《工业心脏》→ 地图高亮相邻可建设地 → 玩家点哪建哪
      若不选直接提交 → 「请选择建设地区」（不扣任何东西）
```

> 客户端有改动（`play.js` 的 STATUS_UI）→ 版本串 bump 到 `20261110a`，需 **Ctrl+Shift+R**。
