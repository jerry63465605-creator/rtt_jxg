/* 用真实 view 渲染一次；toast 覆盖成可读日志 */
try {
	view = window.HARNESS_DATA.view
	on_update()
	window.__bootOK = true
} catch (e) {
	window.__bootErr = String(e && e.stack || e)
}
