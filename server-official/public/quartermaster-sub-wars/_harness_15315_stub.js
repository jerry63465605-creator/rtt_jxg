/*
 * 联调用 client.js 替身：只提供 play.js 需要的最小外部接口。
 *  - send_action：记录到 window.__sent，不发网络
 *  - send_query：event_targets 立刻回放预先算好的 need（模拟服务端应答）
 */
var view = null
var me = null
var game_id = 0
window.__sent = []
window.__toasts = []
function send_action(name, arg) {
	window.__sent.push({ name: name, arg: arg })
}
function send_query(q, params) {
	if (q === 'event_targets') {
		setTimeout(function () { on_reply('event_targets', window.HARNESS_DATA.need) }, 0)
		return
	}
	setTimeout(function () { on_reply(q, null) }, 0)
}
