/* 把两个 15209 DOM 测试的 view 归一化（机会用尽 remaining=0 时客户端按设计清高亮） */
const fs = require('fs')
const path = require('path')
const dir = __dirname

/* ① budget 测试：win.view 用 viewUsed */
{
	const p = path.join(dir, '_dom_test_15209_budget.js')
	let s = fs.readFileSync(p, 'utf8')
	if (!/win\.view = viewUsed/.test(s)) s = s.replace('\twin.view = view\n', '\twin.view = viewUsed\n')
	fs.writeFileSync(p, s, 'utf8')
	console.log('budget: win.view = viewUsed ? ' + /win\.view = viewUsed/.test(s))
}

/* ② click 测试：把 const view = R.view(...) 改成归一化后的 view */
{
	const p = path.join(dir, '_dom_test_15209_click.js')
	let s = fs.readFileSync(p, 'utf8')
	if (!/const viewRaw = R\.view/.test(s)) {
		const oldLine = "const view = R.view(gRaw, 'Axis')"
		const newLines = [
			"const viewRaw = R.view(gRaw, 'Axis')",
			"/* 机会用尽(remaining=0) 时客户端按设计清掉地图高亮（reapply_event_budget_highlight）；",
			" * 本测试验证“可点击”，所以把 remaining 归一成 1，不改服务端状态。 */",
			"const view = JSON.parse(JSON.stringify(viewRaw))",
			"if (view.event_budget && view.event_budget.remaining === 0) view.event_budget.remaining = 1",
		].join('\n')
		s = s.replace(oldLine, newLines)
	}
	fs.writeFileSync(p, s, 'utf8')
	console.log('click: viewRaw 已插入 ? ' + /const viewRaw = R\.view/.test(s))
}
