# B31：客户端「选目标地区」弹框跑到左上角 / 框内空荡（真因是 flex 被覆盖）

> 日期：2026-11-07　范围：`play.js`（5 处显隐 + 候选按钮）、`play.html`（版本串 `20261107c`）
> 玩家报障（截图）：打出《王牌飞行员帕皮·博因顿》后，**左上角出现一块大黄边黑框**，
> 框内只有标题「…需先选择目标地区」+ 一行「请点击地图上的高亮地区（共 6 个候选）」+「不发动」。

## 1. 根因（CSS 布局被内联样式打断）

```css
/* play.css:1527 */
.modal {
    position: fixed; inset: 0;
    display: flex;                    /* ← 居中完全靠这个 */
    align-items: center; justify-content: center;
}
.modal.hide { display: none; }
```

```js
// play.js update_pending_echo_box()（旧）
modal.style.display = "block"        // ← 把 display:flex 覆盖成 block
```

`display` 一变 `block`：`justify-content/align-items` 全部失效，`.modal-box` 失去水平垂直居中，
贴着 `inset:0` 的左上角排 → 玩家看到"左上角一块多余 UI"。
（同一个函数里还有 4 处 `display="block"`、1 处 `display="none"`，都用内联样式压 `.hide` 类，属隐患叠加。）

## 2. 改法（两处）

### ① 显隐统一走 `.hide` 类（5 处）

```js
if (!pe) { modal.classList.add("hide"); clear_echo_need_pick(); return }   // 隐藏
...
modal.classList.remove("hide")                                            // 显示（4 处分支）
```

不再写 `style.display`，flex 布局保持完整 → 弹框回到屏幕正中。

### ② 框内把候选地区直接列成按钮

原来 `step === 'space'` 只渲染一句提示，玩家必须去地图上找高亮；现在同时列出 6 个候选：

```js
pe.cands.forEach(sp => {
  const b = document.createElement("button")
  b.className = "btn echo-cand"
  b.textContent = (view.spaces && view.spaces[sp] && view.spaces[sp].name) || ("地区 " + sp)
  b.onclick = () => { clear_echo_need_pick(); send_action("play_card", { card, choice, space: sp }) }
  row.appendChild(b)
})
```

点地区名 = 点地图（提交同一个 `space`），框里也不再空荡荡。

## 3. 验证

### `tools/_dom_test_pending_echo_modal.js` → **6/6**

```
A ★★ 显示时不含 hide，且 inline display 为空（说明 flex 没被覆盖 → 居中恢复）
B ★★ 框内 6 个候选地区按钮（地区25/地区30/…）
C ★★ 点候选 → play_card{card:'17509#12', choice:null, space:25}
D ★  「不发动」→ play_card{card, __cancel_need:true}
E ★  收起后 class 变回 "modal hide"
```

### 回归

```
node tools/test_basic_cards.js   288 / 9（与基线一致）
node tools/_run_smoke_report.js  112 全绿
```

## 4. 生效方式

- 本改动是**纯客户端**：需覆盖 `play.js` 并让浏览器吃到新缓存 → 版本串已 bump 到 **`?v=20261107c`**，**Ctrl+Shift+R 强刷**；
- 服务端 `rules.js` 未改，无需重启（但本地 8091 已按惯例重启一次）。

## 5. 与之前 15209 的关系（澄清）

| 问题 | 现象 | 根因 | 本次 |
|---|---|---|---|
| 15209《伞兵》 | **空框**（只有「不发动」，遮罩挡地图） | 服务端写了空 `pending_echo` | 已于 2026-11-04 修（`is_empty_echo_frame` 守卫） |
| **本次 B31** | 框**有内容但跑到左上角**、且框里只有一行字 | 客户端用 `style.display="block"` 覆盖了 `.modal` 的 flex | **本次修** |

两者都表现为"左上角多出来一块 UI"，但一个是**服务端空框**、一个是**客户端位置错 + 内容少**。
