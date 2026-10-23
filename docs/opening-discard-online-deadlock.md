# 开局弃牌"线上卡死"排查（2026-10-24）

> 症状：本地对局开局弃牌正常；把打包好的模块给别人线上部署后，
> **开局选中 3 张、点确认毫无反应，一直卡在初始阶段**。

## 一、为什么本地好、线上坏

开局弃牌这条链路有三处「静默」：

### 1. 客户端 `send_action` 会静默丢弃未授权的动作

`common/client.js`（平台提供，不在本模块内）：

```js
function send_action(verb, noun) {
	const va = view.actions?.[verb]
	if (!va) return false          // ← 不发请求、不报错、不提示
	...
}
```

### 2. 但旧版 `confirm_discard` 在这之后照样"报成功"

```js
send_action("opening_discard", { cards: discard_pick.slice() })
toast("已提交弃 3 张")            // ← 无论发没发出去
discard_pick = []                // ← 选择被清空
```

→ 玩家看到"已提交"，界面却毫无变化，再选再点还是一样 = **卡死**。

### 3. `view.actions` 是否含 `opening_discard` 取决于 role 的【精确字符串比较】

```js
const side = current === ALLIES_ROLE ? ALLIES : AXIS   // 'Allies' 之外一律当轴心
const is_my_turn = (current === game.active)
if (faction_of_nation(nation) === side) acts.opening_discard = 1
```

只要外部传进来的 role 不是**恰好** `'Axis'` / `'Allies'`（大小写不同、首尾空格、
URL 编码残留、按国家模式传了 `'德国'`……），盟军玩家就会被当成轴心：

- 拿到不属于自己的 `actions`（该有的没有、不该有的有）；
- 即使发了请求，`do_opening_discard` 里 `faction_role_of_nation(nation) !== current`
  也会直接拒绝，只留一行日志。

以上三种情况在本地都恰好不触发（本地 role 精确、actions 有登记），
所以本地怎么测都是好的。

## 二、顺带发现：`view.block_reason` 永远滞后一帧

`view` 是对象字面量，字段按**书写顺序**求值：

```js
block_reason: game.block_reason || null,      // 第 23438 行，先求值
...
actions: build_actions(...)                   // 第 24064 行，才在这里写 game.block_reason
```

→ 首次进入某挂起态时 `block_reason` 恒为 `null`，**恰好在最需要它的时候没有**。

## 三、修改（4 处）

| # | 位置 | 改法 |
|---|---|---|
| 1 | `rules.js` 新增 `norm_role()` | 把 `'allies'` / `'AXIS'` / `' Allies '` / 中文国名 统一归一化成 `'Axis'`/`'Allies'`；认不出的原样返回 |
| 2 | `exports.action` / `exports.view` / `exports.query` 入口 | 一律 `current = norm_role(current)`，下游所有比较保持不变（三端同源，避免"看得见但点了无效"） |
| 3 | `do_opening_discard` | ① `opening.index` 缺失→按 0、越界→结束初始阶段（防御老存档）；② 拒绝日志带出「提交方 / 应为」两个 role |
| 4 | `play.js` `confirm_discard` | 提交前先查 `view.actions[verb]`；没有就 **toast 出 actions 键名 + block_reason**，**不清空选择**、不再假报"已提交"。`opening_discard` 与 `discard_in_discard_phase` 都加 |
| 5 | `view` 的 `block_reason` 字段 | 移到 `actions:` **之后**，读到的就是本帧的值 |

`play.html` 资源版本串 `20261023f` → `20261024a`（防止线上浏览器命中旧 `play.js` 缓存）。

## 四、复现与验证

`tools/_smoke_opening_discard.js`（31 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | 正常流程：德国（Axis）弃 3 张 → 留 7、推进到英国 |
| B | role 容错：`Axis`/`axis`/`AXIS`/` Axis `/`德国` 全部等价 |
| C | 盟军提交德国回合 → 拒绝，日志含「提交方：Allies，应为：Axis」 |
| D | 0/2/4 张 → 全部拒绝 |
| E | 重复同一张 / 手牌里没有 → 拒绝 |
| F | 六国依次弃完 → `opening=null`、`turn=1`、六国均 7 张 |
| G | `view.actions`：轴心有 `opening_discard`、盟军没有；`block_reason` 指明等待德国 |
| H | `opening.index` 缺失 / 越界 → 不再永久拒绝 |

全量 65 个 smoke：失败 19 个，名单与改动前一致。

## 五、线上部署要点（给别人上线时）

1. 用 **`quartermaster-sub-wars-20261024.zip`**（含本次修复与版本串 `20261024a`）。
2. 上传后确认模块目录里的 `play.html` 里写着 `?v=20261024a`；
   若平台有 CDN/静态缓存，务必让它失效（版本串变了才会拉新 `play.js`）。
3. 开新局验证。若仍卡，页面现在会直接告诉你原因，例如：

   ```
   服务端未授权 opening_discard（actions=log）；原因：opening: 初始阶段等待【德国】弃 3 张
   ```

   - `actions=log` 且当前是你该弃 → role 传值不对（看第 3 处归一化是否生效）；
   - `actions` 里**有** `opening_discard` 但仍不动 → 服务端拒绝，去看对局日志最后一行
     （现在会写明「提交方 / 应为」）。

## 六、回修入口

| 症状 | 先看 |
|---|---|
| 点了按钮毫无反应 | 该动作是否在 `view.actions`；客户端是否还在"假报成功" |
| 本地正常、线上不动 | **先看 Console 是否 `includes is not a function`**（见 `docs/send-action-shim.md`）；再看 role / 缓存 |
| 日志说"不是当前操作国" | `do_opening_discard` 的 current 与期望 role；`norm_role` 是否被绕过 |
| `block_reason` 为空但确实被拦 | 字段是否又被挪到 `actions:` 之前 |

---

## 七、事后复盘：本轮改动的真实效力（2026-10-24 补）

根因最终定在**平台 `send_action` 的 `.includes` bug**（见 `docs/send-action-shim.md`），
本文描述的 role 方向改动并不是本次故障的原因。逐条结论：

| 改动 | 对本次 bug 必需 | 独立价值 | 最终处置 |
|---|---|---|---|
| `play.js` 的 `send_action` shim | ✅ 唯一修复 | — | 保留（另一提交） |
| `view.block_reason` 移到 `actions:` 之后 | ❌ | ✅ 真 bug（原先滞后一帧） | **保留** |
| `do_opening_discard` 拒绝日志带「提交方 / 应为」 | ❌ | ✅ 零成本诊断 | **保留** |
| `confirm_discard` 提交前查 `view.actions` | ❌ | ✅ 把静默失败变可见 | **保留** |
| `do_opening_discard` 的 `opening.index` 缺失/越界防御 | ❌ | ⚠️ 场景几乎不存在 | **已删除** |
| `norm_role()` 中文国名 → 阵营 映射 | ❌ 基于错误假设 | ⚠️ 会把 `'德国'` 压成 `'Axis'`，危及将来的 6 人按国家模式 | **已收窄**：只做去空格 + 大小写归一，认不出的原样返回 |

收窄后的行为：`'Axis'` / `'axis'` / `'AXIS'` / `' Axis '` 等价；
`'德国'` **不再**被猜成阵营（原样传入 → 与 `'Axis'` 不匹配 → 拒绝，与收窄前一致）。
测试 `_smoke_opening_discard.js` 的 B 段已同步改为「B5 中文国名不被猜成阵营」。
