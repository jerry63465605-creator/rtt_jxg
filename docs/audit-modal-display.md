# 审计：全部 `.modal` 弹框的显隐方式（B31 全量扫描）

> 日期：2026-11-07　脚本：`tools/_audit_modal_display.js`　结论：**15 个 modal 已全部走 `classList`，无 inline `style.display` 残留**

## 1. 为什么会去扫

B31 修的是 `.modal` 被 `style.display = "block"` 覆盖 `display:flex` → 弹框跑到左上角。
担心同一写法在别的弹框里也存在，于是全量扫一遍。

## 2. 扫描结果

### 15 个 `.modal` 元素，逐个核对

```
resource_modal       skill_discard_modal   peek_modal          echo_discard_modal
attr_log_modal       pending_echo_modal    us_political_modal  us_replay_modal
us_wartime_modal     su_purge_modal        status_play_modal   uk_enigma_modal
lend_lease_modal     script_modal          （peek_order_desc 为 modal-desc，非弹框）

→ 每个的 inline style.display 用法 = 0
```

### `play.js` 里剩余的 11 处 `style.display`（都是非 modal，**不动**）

| 行 | 变量 | 用途 | 是否 modal |
|---|---|---|---|
| 969 / 971 / 1060 / 1062 / 4326 / 4328 | `fb` | 图片加载失败的兜底块 | ❌ |
| 2776 / 2830 | `playSec` | 出牌区章节的显隐 | ❌ |
| 7555 / 7559 | `host` | 宿主容器（iframe 场景） | ❌ |
| 12334 | `b` | 单个按钮隐藏 | ❌ |

### classList 用量

```
classList.remove("hide") = 19 处（显示）
classList.add("hide")    = 21 处（隐藏）
CSS 规则 .modal.hide { display:none } 存在 = true
```

## 3. 结论

- **无需再改**：除 B31 修的 `pending_echo_modal` 外，其余 14 个弹框此前已经是 classList 写法
  （`play.js:2108`、`2319` 处有历史注释「显隐统一用 .hide 类…保留 .modal 的 flex 居中」）。
- B31 是**最后一个 inline-display 违例**，已清除。
- 剩余的 `style.display` 全部作用于非模态元素，改成 classList 反而会引入新选择器，**保持原样**。

## 4. 约定（以后新增弹框照此写）

```html
<div id="xxx_modal" class="modal hide"><div class="modal-box"></div></div>
```
```js
document.getElementById("xxx_modal").classList.remove("hide")   // 显示
document.getElementById("xxx_modal").classList.add("hide")      // 隐藏
```

**禁止** `el.style.display = "block"` —— 会把 `.modal` 的 `display:flex` 覆盖掉，
直接导致"弹框贴左上角"（B31 的现场）。

## 5. 复跑

```powershell
node tools/_audit_modal_display.js     # 15 个 modal 全绿即通过（退出码 0）
```
