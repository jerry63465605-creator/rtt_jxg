# 【待做】事件卡选地区高亮残留 → "该地区不是《X》的合法目标"

> 状态：**根因已定位，待修**（2026-10-25，线上 game 5732 战区移动）
> 相关：`docs/17532-theater-remove-target.md`、`docs/17532-build-candidate-mismatch.md`

## 一、结论

**不是影子盘面 / 真实盘面不一致**（影子只会更严格，不可能造成"高亮却拒绝"）。
真正原因：`update_map` 的重贴分支**漏了事件卡"选地区"这一条**，导致地图上残留的是**上一步的候选高亮**，
玩家点到的是"已经过期的合法目标"。

## 二、证据

`update_map` 每帧会清空 `.target` 再按当前 pending 状态重贴，四条分支里独缺事件卡选地区：

```240:248:server-official/public/quartermaster-sub-wars/play.js
	if (pending_card)
		highlight_targets(pending_targets)                     /* 基本卡 ✅ */
	if (pending_event_targets && pending_event_targets.need === 'piece')
		highlight_event_pieces(pending_event_targets)          /* 事件卡·选部队 ✅ */
```

```256:268:server-official/public/quartermaster-sub-wars/play.js
	if (pending_armed && pending_armed.need === 'piece') { … } /* armed·选部队 ✅ */
	if (pending_armed && pending_armed.need === 'space')
		highlight_targets({ spaces: (pending_armed.candidates || []).map(id => ({ id: id })) })
		                                                      /* armed·选地区 ✅ */
```

而点击校验用的是**当前**候选：

```8813:8818:server-official/public/quartermaster-sub-wars/play.js
	if (pending_event_card && pending_event_targets) {
		const cands = (pending_event_targets.candidates || []).map(c => c.id)
		if (cands.indexOf(s) < 0) {
			toast("该地区不是《" + pending_event_card.name + "》的合法目标")
			return
		}
```

### 战区移动的触发时序

```
① remove 步：点部队 → 重新 query
② 返回 step1（建设海军）候选 → highlight_event_targets 贴上 东太平洋 / 北大西洋
③ 点海域 → 累积 spaces[1] → 重新 query
④ 返回 step2（建设陆军）候选 → pending_event_targets 已换成陆军地区
   但 ③ 贴上的海域 .target 类没有清理/重贴路径 → 地图上海域仍发光
⑤ 再点那个"还亮着"的海域
   → cands = 陆军候选 → indexOf 失败
   → toast「该地区不是《战区移动》的合法目标」
```

这也解释了为什么**移除部队那步正常**（piece 分支存在重贴），只有**选地区那步**出错。

## 三、修正

### P0 · 补重贴分支（拆一层，避免每帧弹 toast）

`highlight_event_targets` 在候选为空时会 `toast` + `cancel_event_card`（3026-3029），
每帧调用会重复触发，所以先拆出"只贴类"的部分：

```js
/* 只贴高亮，不做 toast / 取消（供 update_map 每帧重贴） */
function apply_event_space_highlight(tg) {
	const cands = ((tg && tg.candidates) || []).map(c => ({ id: c.id, reason: c.name || '' }))
	if (cands.length) highlight_targets({ spaces: cands, pieces: [] })
}
```

`highlight_event_targets` 内部改为调用它（保留原有的空候选 toast/cancel 逻辑）。
`update_map` 在 247 的 piece 分支旁补：

```js
if (pending_event_targets && pending_event_targets.need === 'space')
	apply_event_space_highlight(pending_event_targets)
```

### P1 · 点击校验用"高亮时快照"

在 `apply_event_space_highlight` 里把候选存一份 `pending_event_hl_cands`，
8814 改为读这份快照 —— 高亮与校验永远同源，杜绝将来的时序问题。

### P2 · 同类审计

所有"每帧重贴"的分支应覆盖全部 `need: 'space' | 'piece'` × 全部挂起来源
（基本卡 / 事件卡 / armed / 状态卡建设 / 委托）。当前缺的只有"事件卡·选地区"这一格。

## 四、验证

1. 战区移动选「先建海军」→ 选完海域后，**海域高亮应立即消失**、陆军地区亮起
2. 点已选过的海域 → 不再出现"不是合法目标"（改为正常累积或明确提示）
3. 17723《进攻共产国际》两步（乌克兰 / 罗斯）→ 第一步选完，第二步高亮正确切换
4. 其它多步事件卡（17825 铁托游击队、16302 诺曼底登陆）选地区高亮不乱
5. `node tools/_repro_17532_remove.js` 三组断言仍 PASS

## 五、风险

| 项 | 评估 |
|---|---|
| 改动 | `play.js` 约 8 行（拆函数 + update_map 一条分支）+ 可选快照 3 行 |
| 影响面 | 所有"事件卡选地区"的多步卡 —— 只影响高亮的正确性，不改服务端逻辑 |
| 回归重点 | 单选卡（如 15312 华沙起义）高亮不应消失；空候选时仍应走"没有合法目标 → 取消" |
