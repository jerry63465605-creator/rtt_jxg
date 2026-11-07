# B32：窄屏（≤800px）询问面板整块消失——`#ask_box` 被困在隐藏的 `<aside>` 里

> 日期：2026-11-08　范围：`play.js`（DOM 迁移）、`play.css`（`.floating-ask`）、`play.html`（版本串）
> 玩家报障：**平板/手机上，该弹"是否打出《马奇诺防线》"的时候，屏幕上完全没东西**；桌面正常。

## 1. 根因（证据链）

### ① 询问面板是 `<aside>` 的子元素

```
play.html  L67  <aside>
           L116   #resource_box
           L118   #ask_box            ← 所有询问（代受/抵消/状态确认/增强卡…）都用它
                  #national_skill_box
```

### ② 窄屏下 `<aside>` 是浮层，且会被 `hidden`

```css
/* play.css L2790 @media (max-width:800px) */
body > aside { position: fixed; top: 44px; right: 0; bottom: 0; width: min(86vw,300px); z-index: 930; … }
```

```js
// play.js apply_aside()
const a = document.querySelector("aside")
a.hidden = !aside_open        // 关侧栏 → aside[hidden] → display:none
```

`aside[hidden]` 生效后，**祖先 `display:none` 会连 `position:fixed` 的后代一起不渲染** →
`#ask_box` 整块消失，玩家看到的就是"完全没东西"。

### ③ 同类问题项目里修过一次，但只修了阶段面板

```js
/* play.js 2026-11-01 注释 */
把元素从 aside 移到 body 并加 .floating，
于是不打开整条侧栏也能出牌，也不受 aside 隐藏影响。
```

→ 本次把同样口径套用到 **`#ask_box` / `#resource_box` / `#national_skill_box`**。

## 2. 改法（`play.js` + `play.css`）

```js
const QM_ASK_IDS = ["ask_box", "resource_box", "national_skill_box"]

function sync_ask_boxes() {
	const narrow = is_narrow_screen()          // innerWidth <= 800（与 @media 同阈值）
	for (const id of QM_ASK_IDS) {
		const el = document.getElementById(id); if (!el) continue
		if (narrow) {
			if (!el.__qmHome) el.__qmHome = { parent: el.parentNode, next: el.nextSibling }  // 记住原位
			if (el.parentNode !== document.body) document.body.appendChild(el)
			el.classList.add("floating-ask")
		} else {
			el.classList.remove("floating-ask")
			/* 变宽：插回原父元素的原位置（幂等，不重复插入） */
			…
		}
	}
}
```

调用点：
- 初始化（`document.readyState` 判定后立刻跑一次）；
- `resize`（去抖 150ms，覆盖平板旋转、拖窗）；
- `apply_aside()` 里**先**迁移再 `a.hidden = …`（防止关侧栏瞬间被一起隐藏）。

```css
/* play.css @media (max-width:800px) */
#ask_box.floating-ask,
#resource_box.floating-ask,
#national_skill_box.floating-ask {
	position: fixed; left: 50%; right: auto; bottom: 18px; top: auto;
	transform: translateX(-50%); z-index: 600;
	width: auto; max-width: 92vw; max-height: 70dvh; overflow-y: auto; margin: 0;
}
```

## 3. 桌面为什么不受影响

1. `#ask_box` / `#national_skill_box` **桌面本来就是 `position:fixed` 居中浮层**（`play.css:1028`），
   搬到 body 视觉无差别；
2. 迁移只在 `innerWidth <= 800` 发生 —— 桌面完全不进这条分支（DOM 一模一样）；
3. `.floating-ask` 规则**只写在 `@media (max-width:800px)` 里**，即使被迁移也不会污染桌面样式；
4. 双向迁移：变宽会**插回原父元素的原位置**（记录 `parentNode` + `nextSibling`）。

## 4. 验证 `tools/_dom_test_narrow_ask_box.js` → **11/11**

```
A ★★ 768px：三个面板 parentNode === body，且带 .floating-ask
B ★★ 768px + aside.hidden=true：三者 computed display 仍不是 none
C ★★ 1440px：三者仍在原始父元素里、且不带 .floating-ask（桌面零变化）
D ★★ 768→1440→768 往返：插回原父元素 / 再回 body / 无重复元素
E ★★ aside 关闭 + 真实盘面 view：渲染出「打出《马奇诺防线》（弃 4 张）」，点击后打开弃牌选牌框（无 JS 报错）
```

回归：`test_basic_cards 288/9`、全量冒烟 112 全绿。

## 5. 影响面

| 场景 | 修复前（窄屏） | 修复后 |
|---|---|---|
| 增强卡询问（15311 马奇诺、17805、16800 系列…） | 整块不显示 | 底部浮层正常 |
| 代受 / 抵消 / 状态卡确认 | 整块不显示 | 正常 |
| 资源再分配（`#resource_box`） | 不显示 | 正常（同款浮层样式） |
| 国家技能（`#national_skill_box`） | 不显示 | 正常 |
| 桌面 >800px | 正常 | **完全不变** |

## 6. 已知边界

- 迁移用 `document.body.appendChild`，因此**层级由 z-index 决定**（`.floating-ask` = 600，与 `.modal` 500 的关系见 B32-b 待办）；
- `#phase_panel` 走的是另一套（`.floating`，点击才浮起），本次未动；
- 若玩家在**窄屏开着**的情况下用调试面板移动元素，`__qmHome` 仍指向原父元素，变宽能正确插回。
