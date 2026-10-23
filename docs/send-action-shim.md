# 线上「点了没反应」根因：定制平台 `send_action` 的 `.includes` bug（2026-10-24）

## 一、结论

线上测试服（`test.genie-rttcn.top/pre`）的 `/common/client.js` 不是官方版本，而是被改过的定制版：

```
官方生产 common/client.js = 1856 行
线上测试服 client.js      = 1979 行   （差异 2499 行）
本地 public/common/client.js = 1850 行（仅落后官方 2 处 UI 更新）
```

它把 `send_action` 换成了：

```js
function send_action(verb, noun) {
	if (noun !== undefined) {
		let realnoun = Array.isArray(noun) ? noun[0] : noun
		if (view.actions && view.actions[verb] && view.actions[verb].includes(realnoun)) {
			view.actions = null
			send_message("action", [ verb, noun, game_cookie ])
			return true
		}
	} else { ... }
	return false
}
```

而官方约定是：

```js
view.actions[verb] === 1 / true / 字符串  ->  可提交，参数任意
Array.isArray(view.actions[verb])        ->  才是"参数须在候选列表"
```

本模块 `build_actions` 绝大多数动作返回 `1`，于是：

```
view.actions['opening_discard'] = 1
(1).includes({cards:[...]})       -> TypeError: ...includes is not a function
```

异常发生在 `send_message` **之前** → 请求根本没发出 → `opening.index` 永远 0
→ 玩家看到"开局选中 3 张、点确认毫无变化、永远卡在初始阶段"。

**线上实测已确认**：Console 报 `1.includes is not a function`。

补充：**所有无参数动作不崩**（定制版走 `else` 分支，只做真值判断），
所以"能推进阶段、但所有带参数动作都点不动"——这个特征可以反推同一 bug。

## 二、本地为什么正常

本地跑的是官方 `common/client.js`（与线上官方站对比，仅落后 2 处 UI 更新：

- `scroll_log_to_end` 官方改成双重 `requestAnimationFrame`
- `init_pan_and_zoom` 官方改成加载即执行的 IIFE

两者都与动作发送无关），`va === 1` 分支会正常发送。

## 三、修法 A：平台侧（根治）

把定制版 `send_action` 换回官方实现：

```js
function send_action(verb, noun) {
	if (params.mode === "replay" || params.mode === "debug") return false
	const va = view.actions?.[verb]
	if (va === 1 || va === true || typeof va === "string") {
		if (noun === undefined || noun === null || typeof noun === "object") {
			view.actions = null
			send_message("action", [ verb, noun, game_cookie ])
			return true
		}
	}
	if (Array.isArray(va)) {
		const real = Array.isArray(noun) ? noun[0] : noun
		if (!va.includes(real)) return false
		view.actions = null
		send_message("action", [ verb, noun, game_cookie ])
		return true
	}
	return false
}
```

一处修好，所有模块受益。**建议与对方同步做**，否则以后每个模块都要替平台兜。

## 四、修法 B：模块侧兼容 shim（本次已实现）

`play.js` 顶部（`"use strict"` 之后）新增一段带标记的 shim：

```js
/* ===== BEGIN send_action shim ===== */
;(function () {
	if (typeof send_action !== 'function') return
	const _orig = send_action
	const _patched = function (verb, noun) {
		try { return _orig(verb, noun) }        /* 官方平台：直接成功，零副作用 */
		catch (e) { /* 定制平台抛 TypeError -> 落到下面的官方语义实现 */ }
		...
		/* va === 1/true/字符串 -> 直接发；Array -> 候选校验 */
	}
	try { window.send_action = _patched } catch (e) {}
})()
/* ===== END send_action shim ===== */
```

要点：

- **官方平台上 try 分支直接返回**，不会重复发送（测试 A2 锁死「只发 1 次」）
- 定制平台上捕获异常后按官方语义自行 `send_message('action', [...])`
- `window.send_action` 是全局函数属性，覆盖后 `play.js` 乃至 `client.js` 内
  按名查找 `send_action` 的按钮处理器都会走到 shim
- 缺少 `send_message` 时返回 false 而不抛（防御）

## 五、验证

`tools/_smoke_send_action_shim.js`（19 项，ALL PASS）
按 `BEGIN/END` 标记从 `play.js` 抽出 shim，在 `vm` 里分别装到两套平台实现上：

| 段 | 覆盖 |
|---|---|
| A | 官方平台：返回 true、**只发送 1 次**、参数与 cookie 正确、发送后 `view.actions=null` |
| B | 定制 bug 平台：先证明原生必抛 `includes is not a function`；再验证 shim 回退后只发 1 次、参数完整、无误报 toast |
| C | 无参数动作（`next_phase`）透传，第二参数为 `null` |
| D | 数组型 actions（`resolve_autobahn`）命中 / 不命中 |
| E | 未授权动作不发；连点第二次不发（`view.actions` 已清空） |
| F | 缺 `send_message` 不崩、返回 false |

全量 66 个 smoke：失败 19 个，名单与改动前一致。

## 六、上线注意（与此前那条一起记）

1. 新包：**`quartermaster-sub-wars-20261024b.zip`**，`?v=20261024b`
2. 线上 `play.html` 被注入 5137 字符的 `SITE_PREFIX`（`/pre` 子路径支持）。
   **换包会覆盖它**，记得重新注入（存档：`docs/site-prefix-inject.html`），
   或改到反代层（Caddy/nginx `sub_filter`）
3. 验证方式：换上后点确认弃牌，若 Console 不再报 `includes` 且 `opening.index` 变成 1，
   即修复生效

## 七、回修入口

| 症状 | 先看 |
|---|---|
| 所有带参数动作点了没反应 | Console 是否 `...includes is not a function`；平台 `send_action` 是否被改 |
| 只有某个动作没反应 | `view.actions` 是否含该 verb；`build_actions` 是否被前置 return 挡住 |
| 能推进阶段但不能出牌/弃牌 | 正是本 bug 的典型特征（无参动作走 else 分支不崩） |
| 官方客户端上也点了没反应 | 本 shim 不背锅：回到白名单 / role / `block_reason` |
