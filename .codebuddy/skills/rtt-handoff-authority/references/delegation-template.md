# 让权实现模板(同阵营 it_delegate 范式)

以 17529 `su_build_delegate` 为样板；跨阵营差异在步骤 1 / 3 用 `// 跨阵营才` 标注。
所有函数放在 `rules.js` 被委托卡效果附近，并把 `X_autoskip`/`finish_X_delegate` 加入 `_internal` 导出(供测试)。

## 1. offer(建立委托 + 切 current_nation)
```js
function offer_X_delegate(game, fromNation) {
	if (game.X_delegate) return false
	game.X_delegate = {
		nation: 'B国',
		steps: [ /* {op:'recruit'|'build', type:'army'|'navy', spaces?:[spaceId,...]} */ ],
		done: 0,
		return_nation: fromNation || game.current_nation,   // 记住原行动国，finish 归还
	}
	game.current_nation = 'B国'          // ★挂起给真正的 B(同阵营不翻 active)
	// 跨阵营才需要：handoff_to(game,'B国','xxx') 翻 active(同阵营翻了也无变化)
	game.log.push('...挂起让权【B国】...')
	X_autoskip(game)                      // 建立即兜底(首步就不可执行也不卡)
	return true
}
```

## 2. autoskip(自动跳过无合法目标的步；全完成则收尾)
```js
function X_autoskip(game) {
	const dg = game.X_delegate
	if (!dg) return
	while (dg.done < dg.steps.length) {
		const st = dg.steps[dg.done]
		const pool = (st.spaces && st.spaces.length) ? st.spaces : (function () {
			const a = []; for (let i = 1; i < data.spaces.length; i++) a.push(i); return a
		})()
		const satisfiable = pool.some(sp => st.op === 'build'
			? can_build_at(game, dg.nation, sp, st.type).ok
			: can_recruit_at(game, dg.nation, sp, st.type).ok)
		if (satisfiable) return                 // 当前步有合法目标，等玩家
		game.log.push('...B国当前无法…，自动跳过该步')
		dg.done++
	}
	finish_X_delegate(game)                    // 全部处理完 -> 收尾
}
```
无序多兵种变体(如 17526 `remaining=[{build,navy},{build,army}]`)：倒序遍历 `remaining`，`can_build_at` 在全图都无合法地的兵种 `splice` 移除；`remaining` 空则 `finish`。

## 3. finish(清委托 + 归还 current_nation)
```js
function finish_X_delegate(game) {
	const dg = game.X_delegate
	game.X_delegate = null
	if (dg && dg.return_nation) game.current_nation = dg.return_nation   // ★归还原行动国
	// 跨阵营才还 active：set_pending_xxx(null) / reconcile_handoff(game,'xxx')
	game.log.push('...委托结束（已完成或自动跳过）')
	after_card_resolved(game, '美国', '<卡id>')   // ★卡才需要；普通卡可省
}
```

## 4. resolve(每步成功后 autoskip + refresh)
```js
function resolve_X_delegate(game, arg) {
	const dg = game.X_delegate
	if (!dg) return
	const st = dg.steps[dg.done]
	if (!st) return
	const sp = arg && arg.space
	if (sp == null) { game.log.push('...请选择地区'); return }
	const tgt = Number(sp)
	if (st.spaces && st.spaces.indexOf(tgt) < 0) { game.log.push('...只能选择指定地区'); return }
	const chk = st.op === 'build' ? can_build_at(game, dg.nation, tgt, st.type)
	                              : can_recruit_at(game, dg.nation, tgt, st.type)
	if (!chk.ok) { game.log.push('...无法执行：' + chk.reason); return }
	const r = st.op === 'build' ? build_piece(game, dg.nation, st.type, tgt)
	                            : recruit_piece(game, dg.nation, st.type, tgt)
	if (!r.ok) { game.log.push('...执行失败：' + r.reason); return }
	game.log.push('...B国在' + data.name_of(tgt) + '…')
	dg.done++
	X_autoskip(game)     // ★自动跳过后续 + 收尾(替代"仅 done>=len 才收尾"的旧写法)
	refresh(game)
}
```

## 5. view(只给被委托方阵营算候选；元素是对象)
```js
X_delegate: (function () {
	const dg = game.X_delegate
	if (!dg) return null
	const isNation = faction_of_nation(dg.nation) === side
	const st = dg.steps[dg.done]
	let cands = []
	if (st && isNation) {
		const pool = (st.spaces && st.spaces.length) ? st.spaces : (function () {
			const a = []; for (let i = 1; i < data.spaces.length; i++) a.push(i); return a
		})()
		for (const nb of pool) {
			const ok = st.op === 'build' ? can_build_at(game, dg.nation, nb, st.type).ok
			                             : can_recruit_at(game, dg.nation, nb, st.type).ok
			if (ok) cands.push({ id: nb, name: data.name_of(nb) })   // ★对象，非裸数字
		}
	}
	return { nation: dg.nation, step: dg.done, total: dg.steps.length,
		current_op: st && st.op, current_type: st && st.type,
		candidates: cands, waiting_for: isNation ? null : dg.nation }
})(),
```

## 6. build_actions 白名单(不在册=静默不发)
```js
if (game.X_delegate && faction_of_nation(game.X_delegate.nation) === side)
	acts.resolve_X_delegate = 1
```

## 7. 客户端(play.js)
```js
function update_X_box() {
	const dg = view && view.X_delegate
	if (!dg) return
	if (dg.waiting_for) { render_ask_box('…等待【' + dg.waiting_for + '】…', '…', []); return }
	const cands = dg.candidates || []
	if (!cands.length) return   // 服务端已 autoskip 保证非空；否则改成"无法执行/委托进行中"提示
	highlight_targets({ spaces: cands.map(c => ({ id: c.id, reason: 'B国候选' })) })
	render_ask_box('…B国执行…', '点击高亮地区…', [])
}
// on_click_space 分支：
if (view && view.X_delegate && (view.X_delegate.candidates || []).some(c => c.id === s)) {
	clear_target_highlight()
	send_action('resolve_X_delegate', { space: s })   // s 为 space id(数字)
	return
}
```
记得在 `update_map()` 末尾把 `update_X_box()` 加入每帧调用，与其它挂起框同款。

## 8. 测试骨架(_test_X.js)
```js
const rules = require('./rules.js'); const I = rules._internal
const g = rules.setup('t', 'Standard', {})
g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
g.hands['美国'] = ['<卡id>#1']
rules.action(g, 'Allies', 'play_card', { card: '<卡id>#1' })
console.log('挂起国=', g.current_nation)                 // 期望 'B国'
const v = rules.view(g, 'Allies')                         // 苏联/英国=allies -> 传 'Allies'
const cands = (v.X_delegate && v.X_delegate.candidates) || []
rules.action(g, 'Allies', 'resolve_X_delegate', { space: cands[0].id })  // ★取 .id
console.log('归还=', g.current_nation)                    // 期望 '美国'
```
断言清单：offer 后 `current_nation==='B国'`；每步推进 / 无候选自动跳过；finish 后 `current_nation==='美国'`；跨阵营再加 `game.active` 归还。
