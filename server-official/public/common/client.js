"use strict"

/* PUBLIC GLOBALS */

var roles = null
var player = "Observer"
var view = null
var static_view = null
var game_scenario = null
var game_options = null

/* PRIVATE GLOBALS */

var search_params = new URLSearchParams(window.location.search)
// IIS 反向代理前缀（/ga、/pre）：页面路径带前缀时先剥掉再解析 title_id，
// 否则 title_id 会取到 "ga"/"pre"，模块资源与地图偏好键全部错位。
var page_path = window.location.pathname
if (window.SITE_PREFIX && page_path.startsWith(window.SITE_PREFIX))
	page_path = page_path.slice(window.SITE_PREFIX.length)
var params = {
	title_id: page_path.split("/")[1],
	game_id: search_params.get("game") || 0,
	role: search_params.get("role") || "Observer",
	mode: search_params.get("mode") || "play",
}

let socket = null

let game_log = []
let game_cookie = 0

let snap_active = []
let snap_cache = []
let snap_count = 0
let snap_this = 0
let snap_skip_missing = null
let snap_view = null

var replay_panel = null

/* PUBLIC UTILITY FUNCTIONS */

function fnv1a_log(log) {
	var x = 2166136261
	for (var k = 0, m = log.length; k < m; ++k) {
		var data = "" + log[k]
		for (var i = 0, n = data.length; i < n; ++i)
			x = Math.imul(x ^ data.charCodeAt(i), 16777619)
		x = Math.imul(x ^ 10, 16777619)
	}
	return x
}

function scroll_into_view(e) {
	if (window.innerWidth <= 800)
		document.querySelector("aside").hidden = true
	setTimeout(function () {
		e.scrollIntoView({ block: "center", inline: "center", behavior: "smooth", container: "nearest" })
		// NOTE: ugly hack to reset window scroll in case the above scrolls the viewport...
		// This seems to happen if the target is inside a relative positioned panel and the window
		// is too short.
		window.scroll(0,0)
	}, 0)
}

function scroll_into_view_if_needed(e) {
	if (window.innerWidth <= 800) {
		setTimeout(function () {
			e.scrollIntoView({ block: "start", inline: "center", behavior: "smooth", container: "nearest" })
			window.scroll(0,0)
		}, 0)
	} else {
		setTimeout(function () {
			e.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth", container: "nearest" })
			window.scroll(0,0)
		}, 0)
	}
}

function scroll_with_middle_mouse(panel_sel, multiplier) {
	let panel = document.querySelector(panel_sel)
	let down_x, down_y, scroll_x, scroll_y
	if (!multiplier)
		multiplier = 1
	function md(e) {
		if (e.button === 1) {
			down_x = e.clientX
			down_y = e.clientY
			scroll_x = panel.scrollLeft
			scroll_y = panel.scrollTop
			window.addEventListener("mousemove", mm)
			window.addEventListener("mouseup", mu)
			e.preventDefault()
		}
	}
	function mm(e) {
		let dx = down_x - e.clientX
		let dy = down_y - e.clientY
		panel.scrollLeft = scroll_x + dx * multiplier
		panel.scrollTop = scroll_y + dy * multiplier
		e.preventDefault()
	}
	function mu(e) {
		if (e.button === 1) {
			window.removeEventListener("mousemove", mm)
			window.removeEventListener("mouseup", mu)
			e.preventDefault()
		}
	}
	panel.addEventListener("mousedown", md)
}

function drag_element_with_mouse(element_sel, grabber_sel) {
	let element = element_sel instanceof Element ? element_sel : document.querySelector(element_sel)
	let grabber = grabber_sel instanceof Element ? grabber_sel : document.querySelector(grabber_sel) ?? element
	let grab_x, grab_y, start_x, start_y, w, h, win_w, win_h
	function md(e) {
		if (e.button === 0) {
			start_x = element.offsetLeft
			start_y = element.offsetTop
			grab_x = e.clientX
			grab_y = e.clientY
			window.addEventListener("mousemove", mm)
			window.addEventListener("mouseup", mu)
			e.preventDefault()
		}
	}
	function mm(e) {
		let w = element.offsetWidth
		let h = element.offsetHeight
		let win_w = document.body.clientWidth
		let win_h = document.body.clientHeight
		element.style.left = Math.max(0, Math.min(win_w - w, start_x + e.clientX - grab_x)) + "px"
		element.style.top = Math.max(44, Math.min(win_h - h, start_y + e.clientY - grab_y)) + "px"
		e.preventDefault()
	}
	function mu(e) {
		if (e.button === 0) {
			window.removeEventListener("mousemove", mm)
			window.removeEventListener("mouseup", mu)
			e.preventDefault()
		}
	}
	grabber.addEventListener("mousedown", md)
}

function resize_element_with_mouse(element_sel, grabber_sel) {
	let element = element_sel instanceof Element ? element_sel : document.querySelector(element_sel)
	let grabber = grabber_sel instanceof Element ? grabber_sel : document.querySelector(grabber_sel) ?? element
	let grab_x, grab_y, start_w, start_h, w, h, win_w, win_h
	function md(e) {
		if (e.button === 0) {
			start_w = element.clientWidth
			start_h = element.clientHeight
			grab_x = e.clientX
			grab_y = e.clientY
			window.addEventListener("mousemove", mm)
			window.addEventListener("mouseup", mu)
			e.preventDefault()
		}
	}
	function mm(e) {
		let max_w = document.body.clientWidth - element.offsetLeft - 2
		let max_h = document.body.clientHeight - element.offsetTop - 2
		element.style.width = Math.max(200, Math.min(max_w, start_w + e.clientX - grab_x)) + "px"
		element.style.height = Math.max(100, Math.min(max_h, start_h + e.clientY - grab_y)) + "px"
		e.preventDefault()
	}
	function mu(e) {
		if (e.button === 0) {
			window.removeEventListener("mousemove", mm)
			window.removeEventListener("mouseup", mu)
			e.preventDefault()
		}
	}
	grabber.addEventListener("mousedown", md)
}

/* TITLE BLINKER */

var game_title = document.title

function update_title() {
	if (is_your_turn || (chat && chat.has_unread))
		document.title = "\u2bc8 " + game_title
	else
		document.title = game_title
}

/* CHAT */

let chat = null

function init_chat() {
	if (chat !== null) {
		return
	}

	let chat_window = document.createElement("div")
	chat_window.id = "chat_window"
	chat_window.hidden = true
	chat_window.innerHTML = `
		<div id="chat_header">Chat</div>
		<div id="chat_x" onclick="toggle_chat()">\u2716</div>
		<div id="chat_text"></div>
		<form id="chat_form" action=""><input id="chat_input" autocomplete="off"></form>
		<div id="chat_size"></div>
		`
	document.body.appendChild(chat_window)

	let chat_button = document.getElementById("chat_button")
	chat_button.hidden = false

	chat = {
		is_visible: false,
		text_element: document.getElementById("chat_text"),
		last_day: null,
		log: 0
	}

	drag_element_with_mouse("#chat_window", "#chat_header")
	resize_element_with_mouse("#chat_window", "#chat_size")
	apply_observer_chat_visibility()
	init_observer_chat_menu()
	window.addEventListener("resize", function () {
		if (window.innerWidth < 800) {
			chat_window.style.width = null
			chat_window.style.height = null
		}
	})

	// 观战者也可发言（登录后生效，未登录由服务端拦截）。
	// 官方版在此禁用观战输入框（player === "Observer" 时 disabled），与本站"观战发言"功能冲突，还原为无条件绑定。
	document.getElementById("chat_form").addEventListener("submit", e => {
		let input = document.getElementById("chat_input")
		e.preventDefault()
		if (input.value) {
			send_message("chat", input.value)
			input.value = ""
		} else {
			hide_chat()
		}
	})

	document.body.addEventListener("keydown", e => {
		if (e.key === "Escape") {
			if (chat.is_visible) {
				e.preventDefault()
				hide_chat()
			}
		}
		if (e.key === "Enter") {
			let chat_input = document.getElementById("chat_input")
			let notepad_input = document.getElementById("notepad_input")
			if (document.activeElement !== chat_input && document.activeElement !== notepad_input) {
				e.preventDefault()
				show_chat()
			}
		}
	})
}

function update_chat(chat_id, raw_date, user, message) {
	let role = find_user_role(user)
	function find_user_role(user) {
		var match = null
		if (user) {
			for (var role of roles) {
				if (role.user_name === user) {
					if (match !== null)
						return null
					match = role
				}
			}
		}
		if (match)
			return match.class_name + " player_" + (roles.indexOf(match) + 1)
		return null
	}
	function escape_html(text) {
		return text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
	}
	function format_time(date) {
		let mm = date.getMinutes()
		let hh = date.getHours()
		if (mm < 10) mm = "0" + mm
		if (hh < 10) hh = "0" + hh
		return hh + ":" + mm
	}
	function add_date_line(date) {
		let line = document.createElement("div")
		line.className = "date"
		line.textContent = "~ " + date + " ~"
		chat.text_element.appendChild(line)
	}
	function add_chat_line(time, user, message) {
		let line = document.createElement("div")
		let html = `<span class="time">${time}</span> `
		if (user) {
			if (role)
				html += `<span class="user ${role}">${escape_html(user)}</span> `
			else {
				// 发言者不在本局角色名单里 => 观战者
				html += `<span class="user">${escape_html(user)}</span> `
				line.className = "observer"
			}
		} else {
			line.className = "system"
		}
		html += `<span class="message">${escape_html(message)}</message>`
		line.innerHTML = html
		chat.text_element.appendChild(line)
		chat.text_element.scrollTop = chat.text_element.scrollHeight
	}
	if (chat_id > chat.log) {
		chat.log = chat_id
		let date = new Date(raw_date * 1000)
		let day = date.toDateString()
		if (day !== chat.last_day) {
			add_date_line(day)
			chat.last_day = day
		}
		add_chat_line(format_time(date), user, message)
	}
}

function fetch_chat() {
	send_message("getchat", chat.log)
}

function update_chat_new() {
	let button = document.getElementById("chat_button")
	if (chat && chat.is_visible) {
		if (!document.hasFocus())
			chat.has_unread = true
		fetch_chat()
	} else {
		chat.has_unread = true
		button.classList.add("new")
	}
	update_title()
}

function update_chat_old() {
	let button = document.getElementById("chat_button")
	document.getElementById("chat_button").classList.remove("new")
	chat.has_unread = false
	update_title()
}

function show_chat() {
	if (reconnect_play())
		return
	if (!chat.is_visible) {
		document.getElementById("chat_button").classList.remove("new")
		document.getElementById("chat_window").hidden = false
		document.getElementById("chat_input").focus()
		chat.is_visible = true
		fetch_chat()
		if (chat.has_unread) {
			chat.has_unread = false
			update_title()
		}
	}
}

function hide_chat() {
	if (chat.is_visible) {
		document.getElementById("chat_window").hidden = true
		document.getElementById("chat_input").blur()
		chat.is_visible = false
	}
}

function toggle_chat() {
	if (chat.is_visible)
		hide_chat()
	else
		show_chat()
}

window.addEventListener("focus", function () {
	if (chat && chat.is_visible && chat.has_unread) {
		chat.has_unread = false
		update_title()
	}
})

/* 观战发言显示开关：个人偏好，只影响自己窗口里是否显示观战者发言（消息仍会收到并保留在记录里） */

let show_observer_chat = localStorage.getItem("rtt_show_observer_chat") !== "0"
let observer_chat_menu_item = null

function init_observer_chat_menu() {
	if (!observer_chat_menu_item)
		observer_chat_menu_item = add_main_menu_item("", toggle_observer_chat)
	update_observer_chat_menu_item()
}

function update_observer_chat_menu_item() {
	observer_chat_menu_item.textContent = show_observer_chat ? "观战发言：显示" : "观战发言：隐藏"
}

function apply_observer_chat_visibility() {
	let chat_text = document.getElementById("chat_text")
	if (chat_text)
		chat_text.classList.toggle("hide_observers", !show_observer_chat)
}

function toggle_observer_chat() {
	show_observer_chat = !show_observer_chat
	localStorage.setItem("rtt_show_observer_chat", show_observer_chat ? "1" : "0")
	apply_observer_chat_visibility()
	update_observer_chat_menu_item()
}

/* NOTEPAD */

let notepad = null

function init_notepad() {
	if (notepad !== null)
		return

	add_main_menu_item("笔记", toggle_notepad)

	let notepad_window = document.createElement("div")
	notepad_window.id = "notepad_window"
	notepad_window.hidden = true
	notepad_window.innerHTML = `
		<div id="notepad_header">记事本: ${player}</div>
		<div id="notepad_x" onclick="toggle_notepad()">\u274c</div>
		<textarea id="notepad_input" maxlength="16000" oninput="dirty_notepad()"></textarea>
		<div id="notepad_footer"><button id="notepad_save" onclick="save_notepad()" disabled>Save</button></div>
		`
	document.body.appendChild(notepad_window)

	notepad = {
		is_visible: false,
		is_dirty: false,
	}

	drag_element_with_mouse("#notepad_window", "#notepad_header")

	document.body.addEventListener("keydown", e => {
		if (e.key === "Escape") {
			if (notepad.is_visible) {
				e.preventDefault()
				hide_notepad()
			}
		}
	})
}

function dirty_notepad() {
	if (!notepad.is_dirty) {
		notepad.is_dirty = true
		document.getElementById("notepad_save").disabled = false
	}
}

function update_notepad(text) {
	notepad.is_dirty = false
	document.getElementById("notepad_input").value = text
	document.getElementById("notepad_save").disabled = true
	show_notepad()
}

function save_notepad() {
	if (notepad.is_dirty) {
		let text = document.getElementById("notepad_input").value
		send_message("putnote", text)
		notepad.is_dirty = false
		document.getElementById("notepad_save").disabled = true
	}
}

function show_notepad() {
	if (reconnect_play())
		return
	if (!notepad.is_visible) {
		document.getElementById("notepad_window").hidden = false
		document.getElementById("notepad_input").focus()
		notepad.is_visible = true
	}
}

function hide_notepad() {
	if (notepad.is_visible) {
		save_notepad() // auto-save when closing notepad
		document.getElementById("notepad_window").hidden = true
		document.getElementById("notepad_input").blur()
		notepad.is_visible = false
	}
}

function toggle_notepad() {
	if (notepad.is_visible)
		hide_notepad()
	else
		show_notepad()
}

/* REMATCH & REPLAY BUTTONS WHEN GAME IS FINISHED */

function on_finished() {
	remove_resign_menu()

	add_icon_button(1, "replay_button", "sherlock-holmes-mirror",
		function goto_replay() {
			search_params.delete("role")
			search_params.set("mode", "replay")
			window.location.search = search_params
		}
	)

	if (player !== "Observer") {
		add_icon_button(1, "rematch_button", "cycle",
			function goto_rematch() {
				window.location = (window.SITE_PREFIX || "") + "/rematch/" + params.game_id
			}
		)
	}
}

/* PLAYER ROLE LIST */

function init_role_element(role_id, role_name) {
	let e_role = document.createElement("div")
	e_role.id = role_id
	e_role.className = "role"
	e_role.innerHTML =
		`<div class="role_name"><span>${role_name}</span></div>` +
		`<div class="role_stat"></div>` +
		`<div class="role_user"></div>` +
		`<div class="role_info"></div>`
	document.getElementById("roles").appendChild(e_role)
	return e_role
}

function init_player_names(players) {
	roles = []
	roles.length = players.length
	for (let i = 0; i < players.length; ++i) {
		let pp = players[i]
		// 角色名可能是中文（汉化模块），\W 会连汉字一起替换掉，改用 Unicode 感知字符类
		let class_name = pp.role.replace(/[^\p{L}\p{N}_]/gu, "_")
		let id = "role_" + class_name
		let e = document.getElementById(id)
		if (!e)
			e = init_role_element(id, pp.role)
		let obj = roles[pp.role] = roles[i] = {
			index: i,
			role: pp.role,
			user_name: pp.name,
			class_name: class_name,
			id: id,
			element: e,
			name: e.querySelector(".role_name"),
			stat: e.querySelector(".role_stat"),
			user: e.querySelector(".role_user"),
		}
		if (pp.name)
			obj.user.innerHTML = `<a href="${(window.SITE_PREFIX || "")}/user/${pp.name}" target="_blank">${pp.name}</a>`
		else
			obj.user.textContent = 'NONE'
	}
}

/* IDLE TIMER */

var idle_timer = 0

function reset_idle_timer() {
	clearTimeout(idle_timer)
	idle_timer = setTimeout(idle_disconnect, 1000 * 60 * 15)
}

function idle_disconnect() {
	if (socket && socket.readyState === 1) {
		socket.close(1000, "idle")
	}
	idle_timer = 0
}

function reconnect_play() {
	if (socket && socket.readyState === 3 && !document.hidden) {
		console.log("RECONNECT")
		// remove reconnect button
		document.getElementById("actions").replaceChildren()
		connect_play(true)
		return true
	}
	return false
}

document.addEventListener("mousemove", reset_idle_timer, true)
document.addEventListener("mousedown", reset_idle_timer, true)
document.addEventListener("keypress", reset_idle_timer, true)
document.addEventListener("scroll", reset_idle_timer, true)
document.addEventListener("touchstart", reset_idle_timer, true)

// TODO: auto-reconnect on page navigation (back/forward)?
// window.addEventListener("pageshow", reconnect_play)
// TODO: auto-reconnect when becoming visible again?
// window.addEventListener("visibilitychange", reconnect_play)
// TODO: auto-reconnect when windows gains focus again?
// window.addEventListener("focus", reconnect_play)

/* GAME LOG CACHE */

let stored_game_log_length = 0

function load_game_log() {
	// ignore cached logs if page was reloaded
	if (performance.getEntriesByType("navigation")[0].type === "reload")
		return
	try {
		var key = "#" + params.game_id + "/" + params.role
		var data = window.localStorage.getItem(key)
		if (data) {
			game_log = JSON.parse(data)
			console.log("LOAD LOCAL LOG", data.length, "bytes", game_log.length, "lines")
			stored_game_log_length = game_log.length
		}
		touch_game_log(key)
	} catch (err) {
		console.error(err)
		game_log = []
	}
}

function save_game_log() {
	try {
		var key = "#" + params.game_id + "/" + params.role
		stored_game_log_length = 0
		var data = JSON.stringify(game_log)
		console.log("SAVE LOCAL LOG", data.length, "bytes", game_log.length, "lines")
		window.localStorage.setItem(key, data)
		stored_game_log_length = game_log.length
	} catch (err) {
		console.error(err)
		if (err.name === "QuotaExceededError" && window.localStorage.length > 0)
			purge_game_logs()
	}
}

function touch_game_log(key) {
	var lru = window.localStorage.getItem("!LRU")
	lru = lru ? JSON.parse(lru) : []
	lru = lru.filter(x => x !== key)
	if (lru.length > 20)
		lru.length = 20
	lru.unshift(key)
	purge_game_logs(lru)
	window.localStorage.setItem("!LRU", JSON.stringify(lru))
}

function purge_game_logs(keep=[]) {
	for (var key of Object.keys(window.localStorage)) {
		if (key[0] == "#" && !keep.includes(key)) {
			console.log("PURGE LOCAL LOG", key)
			window.localStorage.removeItem(key)
		}
	}
}

/* CONNECT TO GAME SERVER */

function send_message(cmd, arg) {
	let data = JSON.stringify([ cmd, arg ])
	console.log("SEND %s %s", cmd, arg)
	socket.send(data)
}

function connect_play(is_reconnect) {
	let protocol = (window.location.protocol === "http:") ? "ws" : "wss"

	load_game_log()

	let seen = game_log.length
	let hash = fnv1a_log(game_log)
	let url = `${protocol}://${window.location.host}${window.SITE_PREFIX || ""}/play-socket?title=${params.title_id}&game=${params.game_id}&role=${encodeURIComponent(params.role)}&seen=${seen}&hash=${hash}`

	if (is_reconnect)
		url += "&reconnect=1"

	if (socket && socket.readyState < 3) {
		console.log("ALREADY CONNECTED")
		return
	}

	console.log("CONNECTING", url)
	document.getElementById("prompt").textContent = "正在连接.. "

	socket = new WebSocket(url)

	window.addEventListener("beforeunload", function () {
		socket.close(1000, "unload")
	})

	socket.onopen = function (evt) {
		console.log("OPEN")
		document.querySelector("header").classList.remove("disconnected")
		reset_idle_timer()
	}

	socket.onclose = function (evt) {
		console.log("CLOSE %d", evt.code, evt.reason)
		if (evt.code === 1000 && evt.reason === "unload")
			return
		game_cookie = 0
		document.title = "\xd7 " + game_title
		document.querySelector("header").classList.add("disconnected")
		if (evt.reason && evt.reason !== "idle")
			document.getElementById("prompt").textContent = "已断开连接： " + evt.reason
		else
			document.getElementById("prompt").textContent = "已断开连接：."
		document.getElementById("actions").replaceChildren()
		if (roles)
			for (let role of roles)
				role.element.classList.remove("present")
		if (view) {
			view.actions = null
			on_update()
		}
		show_toolbar_button("Reconnect", function (evt) {
			reconnect_play()
		})
	}

	socket.onmessage = function (evt) {
		let msg_data = JSON.parse(evt.data)
		let cmd = msg_data[0]
		let arg = msg_data[1]
		console.log("MESSAGE", cmd)
		switch (cmd) {
		case "warning":
			document.querySelector("header").classList.add("warning")
			document.getElementById("prompt").textContent = arg
			setTimeout(() => {
				document.querySelector("header").classList.remove("warning")
				update_header()
			}, 1000)
			break

		case "error":
			document.getElementById("prompt").textContent = arg
			if (view) {
				view.actions = null
				on_update()
			}
			break

		case "newchat":
			init_chat()
			if (arg > 0)
				update_chat_new()
			else
				update_chat_old()
			break

		case "chat":
			update_chat(arg[0], arg[1], arg[2], arg[3])
			break

		case "note":
			update_notepad(arg)
			break

		case "players":
			// role, players, scenario, options, and static view
			player = arg[0]
			init_player_names(arg[1])
			game_scenario = arg[2]
			game_options = arg[3]
			static_view = arg[4]

			document.body.classList.add(player.replace(/\W/g, "_"))

			// 先置门闩再调用：on_init 必须拿到上面刚赋的 game_scenario / game_options。
			// 否则（例如被 DOMContentLoaded 兜底提前调用）模块会把 options 设成 undefined，
			// 之后 card_class_name 里的 options.valiant 就会抛
			// "Cannot read properties of null/undefined (reading 'valiant')"。
			players_received = true
			ensure_on_init()

			if (player !== "Observer") {
				init_notepad()
				add_resign_menu()
			} else {
				remove_resign_menu()
			}
			break

		case "pie":
			// new player role assignment!
			params.role = player = arg[0]
			search_params.set("role", params.role)
			window.history.replaceState(null, "", window.location.pathname + "?" + search_params.toString())
			init_player_names(arg[1])
			for (let item of roles)
				document.body.classList.toggle(item.class_name, item.role === player)
			update_view(0, game_log.length)
			if (typeof on_pie === "function")
				on_pie()
			break

		case "presence":
			for (let role of roles)
				role.element.classList.toggle("present", arg.includes(role.role))
			break

		case "state":
			game_cookie = msg_data[2]

			view = arg

			game_log.length = view.log_start
			for (let line of view.log)
				game_log.push(line)

			// save log first time we connect
			if (!stored_game_log_length)
				save_game_log()

			// keep showing current snapshot
			if (snap_view) {
				snap_view = null
				show_snap(snap_this)
			} else {
				update_view(view.log_start, game_log.length)
			}

			break

		case "finished":
			on_finished()
			break

		case "snapsize":
			snap_count = arg
			if (snap_count === 0)
				replay_panel.remove()
			else
				document.body.appendChild(replay_panel)
			if (game_log.length !== stored_game_log_length)
				save_game_log()
			break

		case "nosnap":
			snap_cache[arg] = -1
			snap_skip_missing()
			break

		case "snap":
			snap_active[arg[0]] = arg[1]
			snap_cache[arg[0]] = arg[2]
			show_snap(arg[0])
			break

		case "reply":
			if (typeof on_reply === "function")
				on_reply(arg[0], arg[1])
			break
		}
	}
}

function update_view(log_start, log_end) {
	update_roles()
	update_log(log_start, log_end)
	// 模块脚本（defer 列表里排在 client.js 之后）可能还没执行到，此时 on_update 尚不存在。
	// 之前无条件调用会抛 ReferenceError，并且被下面的 catch 弹成 alert 骚扰用户；
	// 现在直接跳过 —— 模块就绪后 ensure_on_init() 会补跑 on_init，
	// 之后任一次 state 消息都会正常进入 on_update 完成渲染。
	if (typeof on_update === "function") {
		try {
			on_update()
		} catch (err) {
			console.error(err)
			window.alert(err)
		}
	}
	update_header()
}

/* HEADER */

let is_your_turn = false

function update_header() {
	if (typeof on_prompt === "function") {
		try {
			document.getElementById("prompt").innerHTML = on_prompt(String(view.prompt))
		} catch (err) {
			document.getElementById("prompt").textContent = err.toString()
		}
	} else {
		document.getElementById("prompt").textContent = String(view.prompt)
	}
	if (params.mode === "replay")
		return
	if (snap_view)
		document.querySelector("header").classList.add("replay")
	else
		document.querySelector("header").classList.remove("replay")
	document.querySelector("header").classList.toggle("watching", params.mode === "play" && player === "Observer" && !snap_view)
	if (view.actions) {
		document.querySelector("header").classList.add("your_turn")
		is_your_turn = true
	} else {
		document.querySelector("header").classList.remove("your_turn")
		is_your_turn = false
	}
	update_title()
}

function update_roles() {
	if (view.active !== undefined) {
		for (let role of roles) {
			if (typeof view.active === "string") {
				role.element.classList.toggle("active",
					view.active === role.role || view.active === "Both" || view.active.includes(role.role)
				)
			}
		}
	}
}

/* LOG */

function update_log(change_start, end) {
	var entry
	var div = document.getElementById("log")

	var to_delete = div.children.length - change_start
	while (to_delete-- > 0)
		div.removeChild(div.lastChild)

	for (var i = div.children.length; i < end; ++i) {
		var text = i < game_log.length ? game_log[i] : "???"
		if (params.mode === "debug" && typeof text === "object") {
			entry = document.createElement("a")
			entry.href = "#" + text[0]
			if (text[3] !== null && text[3] !== undefined)
				entry.textContent = "\u25b6 " + text[1] + " " + text[2] + " " + text[3]
			else
				entry.textContent = "\u25b6 " + text[1] + " " + text[2]
			entry.style.display = "block"
			entry.style.textDecoration = "none"
			div.appendChild(entry)
		} else if (typeof on_log === "function") {
			try {
				div.appendChild(on_log(text, i))
			} catch (err) {
				entry = document.createElement("div")
				entry.textContent = err.toString()
				div.appendChild(entry)
			}
		} else {
			entry = document.createElement("div")
			entry.textContent = text
			div.appendChild(entry)
		}
	}
	scroll_log_to_end()
}

function scroll_log_to_end() {
	let div = document.getElementById("log")
	div.scrollTop = div.scrollHeight
}

try {
	new ResizeObserver(scroll_log_to_end).observe(document.getElementById("log"))
} catch (err) {
	window.addEventListener("resize", scroll_log_to_end)
}

/* ACTIONS */

function show_toolbar_button(label, callback) {
	let button = document.createElement("button")
	button.innerHTML = label
	button.addEventListener("click", callback)
	document.getElementById("actions").prepend(button)
	return button
}

function action_button_with_argument_imp(verb, noun, label, callback) {
	if (params.mode === "replay")
		return
	let id = verb + "_" + noun + "_button"
	let button = document.getElementById(id)
	if (!button) {
		button = document.createElement("button")
		button.id = id
		button.innerHTML = label
		button.addEventListener("click", callback)
		document.getElementById("actions").prepend(button)
	}
	if (view.actions && view.actions[verb] && view.actions[verb].includes(noun)) {
		button.hidden = false
	} else {
		button.hidden = true
	}
}

function action_button_imp(action, label, callback) {
	if (params.mode === "replay")
		return
	let id = action + "_button"
	let button = document.getElementById(id)
	if (!button) {
		button = document.createElement("button")
		button.id = id
		button.innerHTML = label
		button.addEventListener("click", callback)
		document.getElementById("actions").prepend(button)
	}
	if (view.actions && action in view.actions) {
		button.hidden = false
		if (view.actions[action]) {
			if (label === undefined)
				button.textContent = view.actions[action]
			button.disabled = false
		} else {
			button.disabled = true
		}
	} else {
		button.hidden = true
	}
}

function action_button_with_argument(verb, noun, label) {
	action_button_with_argument_imp(verb, noun, label, evt => send_action(verb, noun))
}

function confirm_action_button_with_argument(verb, noun, label, message) {
	action_button_with_argument_imp(verb, noun, label, evt => confirm_send_action(verb, noun, message))
}

function action_button(action, label) {
	action_button_imp(action, label, evt => send_action(action))
}

function confirm_action_button(action, label, message) {
	action_button_imp(action, label, evt => confirm_send_action(action, undefined, message))
}

function send_action(verb, noun, extra) {
	if (params.mode === "replay" || params.mode === "debug")
		return false

	// Reset action list here so we don't send more than one action per server prompt!
	//
	// extra：模块侧打包的额外参数（EOTS 的 send_action_with_oos 传
	// [type, burma_road, ...oos, ...路径]）。存在时必须并进 argument：
	// 服务端 framework.js 读 argument[1] 当 type、argument[0] 当真实参数。
	// 旧版这里只有 (verb, noun) 两个参数，payload 被静默丢弃，
	// 导致服务端收到错的 argument，每个动作都报 Invalid action。
	let va = view.actions ? view.actions[verb] : undefined
	if (va) {
		const fire = () => {
			view.actions = null
			if (extra !== undefined)
				send_message("action", [ verb, [ noun, ...extra ], game_cookie ])
			else
				send_message("action", [ verb, noun, game_cookie ])
			return true
		}

		// ---- 新版语义 ----
		// simple action（服务端下发 1 / true / 字符串）
		if (va === 1 || va === true || typeof va === "string") {
			if (noun === undefined || noun === null || typeof noun === "object")
				return fire()
		}
		// thing action（服务端下发 id 数组）
		if (Array.isArray(va)) {
			if (va.includes(noun))
				return fire()
			// noun 是数组时按首元素匹配（沿用旧版 realnoun 语义）
			if (Array.isArray(noun) && va.includes(noun[0]))
				return fire()
		}
		// 数字型动作集
		if (typeof va === "number" && va !== 0 && noun !== undefined)
			return fire()

		// ---- 向后兼容兜底（60+ 个既有模块）----
		// 到这里说明新版判定为「不发」。旧版规则是：
		//   noun 有值 -> view.actions[verb].includes(noun 或 noun[0])
		//   noun 为空 -> 只要 view.actions[verb] 为真就发
		if (noun !== undefined) {
			const realnoun = Array.isArray(noun) ? noun[0] : noun
			let hit = false
			try {
				hit = (typeof va.includes === "function") ? va.includes(realnoun) : false
			} catch (e) {
				hit = false
			}
			if (hit)
				return fire()
			// va 为真但 contains 不成立：旧版同样发不出去，保持 false
		} else {
			return fire()
		}
	}
	return false
}

function confirm_send_action(verb, noun, message) {
	if (window.confirm(message))
		send_action(verb, noun)
}

function send_query(q, param) {
	if (typeof replay_query === "function")
		replay_query(q, param)
	else if (snap_view)
		send_message("querysnap", [ snap_this, q, param ])
	else
		send_message("query", [ q, param ])
}

/* REPLAY */

function init_replay() {
	let script = document.createElement("script")
	// 动态注入的脚本必须带 SITE_PREFIX（/ga、/pre 等反向代理前缀），
	// 否则复盘模式加载 /common/replay.js 会 404、界面空白
	script.src = (window.SITE_PREFIX || "") + "/common/replay.js"
	document.body.appendChild(script)
}

/* MAIN MENU */

function confirm_resign() {
	if (window.confirm("确定要认输吗？"))
		send_message("resign")
}

function add_resign_menu() {
	if (roles.length === 2) {
		let popup = document.querySelector("#toolbar details menu")
		popup.insertAdjacentHTML("beforeend", '<li class="resign separator">')
		popup.insertAdjacentHTML("beforeend", '<li class="resign" onclick="confirm_resign()">投降')
	}
}

function remove_resign_menu() {
	for (let e of document.querySelectorAll(".resign"))
		e.remove()
}

function add_icon_button(where, id, img, fn) {
	let button = document.getElementById(id)
	if (!button) {
		button = document.createElement("button")
		button.id = id
		// 动态生成的图标也要带 SITE_PREFIX（/ga 等反向代理前缀），否则跨代理部署时图标 404
		button.innerHTML = '<img src="' + (window.SITE_PREFIX || "") + '/images/' + img + '.svg">'
		button.addEventListener("click", fn)
		if (where)
			document.querySelector("#toolbar").appendChild(button)
		else
			document.querySelector("#toolbar details").after(button)
	}
	return button
}

/* avoid margin collapse at bottom of main */
document.querySelector("main").insertAdjacentHTML("beforeend", "<div style='height:1px'></div>")

document.querySelector("header").insertAdjacentHTML("beforeend", "<div id='actions'>")
document.querySelector("header").insertAdjacentHTML("beforeend", "<div id='prompt'>")

add_icon_button(0, "chat_button", "chat-bubble", toggle_chat).hidden = true
add_icon_button(0, "zoom_button", "magnifying-glass", () => toggle_zoom())
add_icon_button(0, "log_button", "scroll-quill", toggle_log)

function add_main_menu_separator() {
	let popup = document.querySelector("#toolbar details menu")
	let sep = document.createElement("li")
	sep.className = "separator"
	popup.insertBefore(sep, popup.firstChild)
}

function add_main_menu_item(text, onclick) {
	let popup = document.querySelector("#toolbar details menu")
	let sep = popup.querySelector(".separator")
	let item = document.createElement("li")
	item.onclick = onclick
	item.textContent = text
	popup.insertBefore(item, sep)
	return item
}

function add_main_menu_item_link(text, url) {
	let popup = document.querySelector("#toolbar details menu")
	let sep = popup.querySelector(".separator")
	let item = document.createElement("li")
	let a = document.createElement("a")
	// 动态生成的菜单链接也要带 SITE_PREFIX（/ga、/pre 等反向代理前缀），否则跳转 404
	if (url.startsWith("/") && !url.startsWith(window.SITE_PREFIX || ""))
		url = (window.SITE_PREFIX || "") + url
	a.href = url
	a.textContent = text
	item.appendChild(a)
	popup.insertBefore(item, sep)
}

add_main_menu_separator()
if (params.mode === "play" && params.role !== "Observer") {
	add_main_menu_item_link("回到首页", "/games/active")
	add_main_menu_item_link("去别的对局", "/games/next")
} else {
	add_main_menu_item_link("回到首页", "/")
}

function close_toolbar_menus(self) {
	for (let node of document.querySelectorAll("#toolbar > details"))
		if (node !== self)
			node.removeAttribute("open")
}

/* close menu if opening another */
for (let node of document.querySelectorAll("#toolbar > details")) {
	node.onclick = function () { close_toolbar_menus(node) }
}

/* close menu after selecting something */
for (let node of document.querySelectorAll("#toolbar > details > menu")) {
	node.onclick = function () { close_toolbar_menus(null) }
}

/* click anywhere else than menu to close it */
window.addEventListener("mousedown", function (evt) {
	let e = evt.target
	while (e) {
		if (e.tagName === "DETAILS")
			return
		e = e.parentElement
	}
	close_toolbar_menus(null)
})

/* close menus if window loses focus */
window.addEventListener("blur", function (evt) {
	close_toolbar_menus(null)
})

/* FULLSCREEN TOGGLE */

function toggle_fullscreen() {
	// Safari on iPhone doesn't support Fullscreen
	if (typeof document.documentElement.requestFullscreen !== "function")
		return

	if (document.fullscreenElement)
		document.exitFullscreen()
	else
		document.documentElement.requestFullscreen()

	event.preventDefault()
}

if ("ontouchstart" in window) {
	document.querySelector("header").ondblclick = toggle_fullscreen
}

/* SNAPSHOT VIEW */

replay_panel = document.createElement("div")
replay_panel.id = "replay_panel"

function add_replay_button(id, callback) {
	let button = document.createElement("div")
	button.className = "replay_button"
	button.id = id
	button.onclick = callback
	replay_panel.appendChild(button)
	return button
}

add_replay_button("replay_first", on_snap_first)
add_replay_button("replay_prev", on_snap_prev)
add_replay_button("replay_step_prev", null).hidden = true
add_replay_button("replay_step_next", null).hidden = true
add_replay_button("replay_next", on_snap_next)
add_replay_button("replay_last", null).hidden = true
add_replay_button("replay_play", on_snap_penultimate_or_stop)
add_replay_button("replay_stop", null).hidden = true

function request_snap(snap_id, skip) {
	snap_skip_missing = skip
	if (snap_id >= 1 && snap_id <= snap_count) {
		snap_this = snap_id
		if (snap_cache[snap_id] === -1)
			snap_skip_missing()
		else if (snap_cache[snap_id])
			show_snap(snap_id)
		else
			send_message("getsnap", snap_id)
	}
}

function show_snap(snap_id) {
	if (snap_view === null)
		snap_view = view
	view = snap_cache[snap_id]
	view.prompt = "Replay " + snap_id + " / " + snap_count + " \u2013 " + snap_active[snap_id]
	update_view(view.log, view.log)
}

function on_snap_penultimate_or_stop() {
	if (snap_view)
		on_snap_stop()
	else
		on_snap_penultimate()
}

function on_snap_penultimate() {
	request_snap(snap_count - 1, on_snap_prev)
}

function on_snap_first() {
	request_snap(1, on_snap_next)
}

function on_snap_prev() {
	if (!snap_view)
		request_snap(snap_count, on_snap_prev)
	else if (snap_this > 1)
		request_snap(snap_this - 1, on_snap_prev)
}

function on_snap_next() {
	if (!snap_view)
		on_snap_stop()
	else if (snap_this < snap_count)
		request_snap(snap_this + 1, on_snap_next)
	else
		on_snap_stop()
}

function on_snap_stop() {
	if (snap_view) {
		view = snap_view
		snap_view = null
		update_view(game_log.length, game_log.length)
	}
}

function on_snap_ninth(target) {
	request_snap(Math.floor(target * snap_count / 9), on_snap_next)
}

/* KEY BINDINGS */

window.addEventListener("keydown", function (evt) {
	if (document.activeElement instanceof HTMLInputElement)
		return
	if (document.activeElement instanceof HTMLTextAreaElement)
		return
	if (evt.altKey || evt.ctrlKey)
		return
	switch (evt.key) {
	case "Shift":
		if (!evt.repeat)
			document.body.classList.add("shift")
		evt.preventDefault()
		break
	case " ":
		if (!evt.repeat)
			on_snap_penultimate()
		evt.preventDefault()
		break
	case "<":
		if (!evt.repeat)
			on_snap_first()
		evt.preventDefault()
		break
	case ">":
		if (!evt.repeat)
			on_snap_stop()
		evt.preventDefault()
		break
	case ",":
		on_snap_prev()
		evt.preventDefault()
		break
	case ".":
		on_snap_next()
		evt.preventDefault()
		break
	case "0":
		on_snap_stop()
		evt.preventDefault()
		break
	case "1":
		on_snap_first()
		evt.preventDefault()
		break
	case "2": case "3": case "4": case "5": case "6": case "7": case "8": case "9":
		on_snap_ninth(parseInt(evt.key) - 1)
		evt.preventDefault()
		break
	}
})

window.addEventListener("keyup", function (evt) {
	if (document.activeElement instanceof HTMLInputElement)
		return
	if (document.activeElement instanceof HTMLTextAreaElement)
		return
	switch (evt.key) {
	case "Shift":
		document.body.classList.remove("shift")
		evt.preventDefault()
		break
	case " ":
		on_snap_stop()
		evt.preventDefault()
		break
	}
})

window.addEventListener("blur", function (evt) {
	document.body.classList.remove("shift")
})

/* TOGGLE ZOOM MAP TO FIT */

function toggle_log() {
	document.querySelector("aside").hidden = !document.querySelector("aside").hidden
	update_zoom()
}

var toggle_zoom = function () {}
var update_zoom = function () {}
var update_map_size = function (w, h) {}

/* PAN & ZOOM GAME BOARD */

;(function () {
	var PAN_SPEED = Number(document.querySelector("main").dataset.panSpeed) || 1
	var MIN_ZOOM = Number(document.querySelector("main").dataset.minZoom) || 0.5
	var MAX_ZOOM = Number(document.querySelector("main").dataset.maxZoom) || 1.5

	scroll_with_middle_mouse("main", PAN_SPEED)

	const THRESHOLD = 0.0625
	const DECELERATION = 125

	const map_fit_key = params.title_id + "/map-fit"

	const e_scroll = document.querySelector("main")
	e_scroll.style.touchAction = "none"
	e_scroll.tabIndex = 1 // enable keyboard scrolling

	const e_inner = document.createElement("div")
	e_inner.id = "pan_zoom_main"
	e_inner.style.transformOrigin = "0 0"
	e_inner.style.height = "120px"
	while (e_scroll.firstChild)
		e_inner.appendChild(e_scroll.firstChild)

	const e_outer = document.createElement("div")
	e_outer.id = "pan_zoom_wrap"
	e_outer.style.height = "120px"
	e_outer.appendChild(e_inner)

	e_scroll.appendChild(e_outer)

	const mapwrap = document.getElementById("mapwrap")
	if (mapwrap) {
		mapwrap.dataset.fit = "none"
		mapwrap.dataset.scale = 1
	}

	const map = document.getElementById("map") || e_inner.querySelector("div")
	// 地图逻辑尺寸：优先取 #map 的固有尺寸。#map 为 absolute 定位，不受 flex 压缩影响；
	// 而 #mapwrap 会被 flex-shrink 压到容器宽、高可能为 0——用它的 clientWidth/Height 会让
	// 下方"地图大于视口"判定恒假，初始适配（窄屏按宽度缩放）永不触发，地图溢出只显示一角。
	var map_w = mapwrap ? (map.clientWidth || mapwrap.clientWidth) : map.clientWidth
	var map_h = mapwrap ? (map.clientHeight || mapwrap.clientHeight) : map.clientHeight

	if (e_scroll.dataset.mapHeight)
		map_h = Number(e_scroll.dataset.mapHeight)
	if (e_scroll.dataset.mapWidth)
		map_w = Number(e_scroll.dataset.mapWidth)

	console.log("INIT MAP SIZE", map_w, map_h)

	var transform0 = { x: 0, y: 0, scale: 1 }
	var transform1 = { x: 0, y: 0, scale: 1 }
	var old_scale = 1

	// touch finger tracking
	var last_touch_x = {}
	var last_touch_y = {}
	var last_touch_length = 0

	// momentum velocity tracking
	var mom_last_t = null
	var mom_last_x = null
	var mom_last_y = null

	// momentum auto-scroll
	var timer = 0
	var mom_time = 0
	var mom_vx = 0
	var mom_vy = 0

	update_map_size = function (w, h) {
		e_scroll.dataset.mapWidth = map_w = w
		e_scroll.dataset.mapHeight = map_h = h
		console.log("UPDATE MAP SIZE", map_w, map_h)
		update_map_fit()
	}

	function clamp_scale(scale) {
		let win_w = e_scroll.clientWidth
		let win_h = e_scroll.clientHeight
		let real_min_zoom = Math.min(MIN_ZOOM, win_w / map_w, win_h / map_h)
		if (scale * transform0.scale > MAX_ZOOM)
			scale = MAX_ZOOM / transform0.scale
		if (scale * transform0.scale < real_min_zoom)
			scale = real_min_zoom / transform0.scale
		return scale
	}

	function anchor_transform(touches) {
		// in case it changed from outside
		transform1.x = -e_scroll.scrollLeft
		transform1.y = -e_scroll.scrollTop

		transform0.scale = transform1.scale
		transform0.x = transform1.x
		transform0.y = transform1.y
		if (touches) {
			for (let touch of touches) {
				last_touch_x[touch.identifier] = touch.clientX
				last_touch_y[touch.identifier] = touch.clientY
			}
			last_touch_length = touches.length
		} else {
			last_touch_length = 0
		}
	}

	function should_fit_width(old) {
		return (e_scroll.clientWidth / map_w < old)
	}

	function should_fit_both(old) {
		return (e_scroll.clientWidth / map_w < old) || (e_scroll.offsetHeight / map_h < old)
	}

	// export function
	toggle_zoom = function () {
		if (transform1.scale === 1) {
			if (mapwrap && window.innerWidth > 800) {
				cycle_map_fit()
				return
			}
		}

		if (transform1.scale > 1)
			zoom_to(1)
		else if (should_fit_width(transform1.scale))
			zoom_to(e_scroll.clientWidth / map_w)
		else if (should_fit_both(transform1.scale))
			zoom_to(Math.min(e_scroll.clientWidth / map_w, e_scroll.offsetHeight / map_h))
		else
			zoom_to(1)
	}

	// export function
	update_zoom = function () {
		update_map_fit()
		update_transform_on_resize()
		scroll_log_to_end()
	}

	function disable_map_fit() {
		if (mapwrap) {
			let scale = Number(mapwrap.dataset.scale)
			if (scale !== 1) {
				transform1.x = -e_scroll.scrollLeft
				transform1.y = -e_scroll.scrollTop
				transform1.scale = scale
			}

			localStorage.removeItem(map_fit_key)
			mapwrap.dataset.fit = "none"
			mapwrap.dataset.scale = 1
			mapwrap.style.width = null
			mapwrap.style.height = null
			if (map)
				map.style.transform = null

			if (scale !== 1)
				update_transform()
		}
	}

	function cycle_map_fit() {
		switch (mapwrap.dataset.fit) {
			default:
			case "none":
				if (should_fit_width(1)) {
					mapwrap.dataset.fit = "width"
					break
				}
				// fall through
			case "width":
				if (should_fit_both(1)) {
					mapwrap.dataset.fit = "both"
					break
				}
				// fall through
			case "both":
				mapwrap.dataset.fit = "none"
		}
		localStorage.setItem(map_fit_key, mapwrap.dataset.fit)
		update_map_fit()
	}

	function update_map_fit() {
		if (mapwrap) {
			let map = document.getElementById("map")
			if (!map)
				return // 模块只提供 mapwrap 而无 #map 时跳过 fit（无画布可缩放）
			map.style.transform = null
			mapwrap.style.width = null
			mapwrap.style.height = null

			let sx = e_scroll.clientWidth / map_w
			let sy = e_scroll.offsetHeight / map_h

			let scale = 1
			switch (mapwrap.dataset.fit) {
				case "width":
					scale = sx
					break
				case "both":
					scale = Math.min(sx, sy)
					break
			}

			if (scale < 1) {
				map.style.transform = "scale(" + scale + ")"
				mapwrap.style.width = (map.clientWidth * scale) + "px"
				mapwrap.style.height = (map.clientHeight * scale) + "px"
				mapwrap.dataset.scale = scale
			} else {
				mapwrap.dataset.scale = 1
			}

			update_transform_on_resize()
		}
	}

	function zoom_to(new_scale) {
		let cx = e_scroll.clientWidth / 2
		let cy = 0

		// in case changed from outside
		transform1.x = -e_scroll.scrollLeft
		transform1.y = -e_scroll.scrollTop

		transform1.x -= cx
		transform1.y -= cy
		transform1.x *= new_scale / transform1.scale
		transform1.y *= new_scale / transform1.scale
		transform1.scale = new_scale
		transform1.x += cx
		transform1.y += cy

		update_transform()
	}

	function update_transform() {
		let win_w = e_scroll.clientWidth
		let win_h = e_scroll.clientHeight

		// clamp zoom
		let real_min_zoom = Math.min(MIN_ZOOM, win_w / map_w, win_h / map_h)
		transform1.scale = Math.max(real_min_zoom, Math.min(MAX_ZOOM, transform1.scale))

		e_scroll.scrollLeft = -transform1.x
		e_scroll.scrollTop = -transform1.y

		if (transform1.scale !== old_scale) {
			if (transform1.scale === 1) {
				e_inner.style.transform = null
				e_inner.dataset.scale = 1
			} else {
				e_inner.style.transform = `scale(${transform1.scale})`
				e_inner.dataset.scale = transform1.scale
			}
			e_inner.style.width = (win_w / transform1.scale) + "px"
			e_outer.style.width = (e_inner.clientWidth * transform1.scale) + "px"
			old_scale = transform1.scale
		}
	}

	function update_transform_on_resize() {
		old_scale = 0
		anchor_transform()
		update_transform()
	}

	function start_measure(time) {
		mom_last_t = [ time, time, time ]
		mom_last_x = [ transform1.x, transform1.x, transform1.x ]
		mom_last_y = [ transform1.y, transform1.y, transform1.y ]
	}

	function abort_measure() {
		mom_last_t = mom_last_x = mom_last_y = null
	}

	function move_measure(time) {
		if (mom_last_t) {
			mom_last_t[0] = time
			mom_last_x[0] = transform1.x
			mom_last_y[0] = transform1.y
			if (mom_last_t[0] - mom_last_t[1] > 15) {
				mom_last_t[2] = mom_last_t[1]
				mom_last_x[2] = mom_last_x[1]
				mom_last_y[2] = mom_last_y[1]
				mom_last_t[1] = mom_last_t[0]
				mom_last_x[1] = mom_last_x[0]
				mom_last_y[1] = mom_last_y[0]
			}
		}
	}

	function start_momentum() {
		if (mom_last_t) {
			let dt = mom_last_t[0] - mom_last_t[2]
			if (dt > 5) {
				mom_time = Date.now()
				mom_vx = (mom_last_x[0] - mom_last_x[2]) / dt
				mom_vy = (mom_last_y[0] - mom_last_y[2]) / dt
				if (Math.hypot(mom_vx, mom_vy) < THRESHOLD)
					mom_vx = mom_vy = 0
				if (mom_vx || mom_vy)
					timer = requestAnimationFrame(update_momentum)
			}
		}
	}

	function stop_momentum() {
		cancelAnimationFrame(timer)
		timer = 0
	}

	function update_momentum() {
		var now = Date.now()
		var dt = now - mom_time
		mom_time = now

		transform1.x = transform1.x + mom_vx * dt
		transform1.y = transform1.y + mom_vy * dt
		update_transform()

		var decay = Math.pow(0.5, dt / DECELERATION)
		mom_vx *= decay
		mom_vy *= decay

		if (Math.hypot(mom_vx, mom_vy) < THRESHOLD)
			mom_vx = mom_vy = 0

		if (mom_vx || mom_vy)
			timer = requestAnimationFrame(update_momentum)
	}

	e_scroll.ontouchstart = function (evt) {
		if (evt.touches.length === 2)
			disable_map_fit()
		anchor_transform(evt.touches)
		stop_momentum()
		start_measure(evt.timeStamp)
	}

	e_scroll.ontouchend = function (evt) {
		anchor_transform(evt.touches)
		if (evt.touches.length === 0)
			start_momentum()
	}

	e_scroll.ontouchmove = function (evt) {
		if (evt.touches.length !== last_touch_length)
			anchor_transform(evt.touches)

		if (evt.touches.length === 1 || evt.touches.length === 2) {
			let a = evt.touches[0]

			let dx = a.clientX - last_touch_x[a.identifier]
			let dy = a.clientY - last_touch_y[a.identifier]

			transform1.scale = transform0.scale
			transform1.x = transform0.x + dx
			transform1.y = transform0.y + dy

			if (evt.touches.length === 1)
				move_measure(evt.timeStamp)
			else
				abort_measure()

			// zoom
			if (evt.touches.length === 2) {
				let b = evt.touches[1]

				let old_x = last_touch_x[a.identifier] - last_touch_x[b.identifier]
				let old_y = last_touch_y[a.identifier] - last_touch_y[b.identifier]
				let old = Math.sqrt(old_x * old_x + old_y * old_y)

				let cur_x = a.clientX - b.clientX
				let cur_y = a.clientY - b.clientY
				let cur = Math.sqrt(cur_x * cur_x + cur_y * cur_y)

				let scale = clamp_scale(cur / old)

				let cx = a.clientX
				let cy = a.clientY

				transform1.x -= cx
				transform1.y -= cy

				transform1.scale *= scale
				transform1.x *= scale
				transform1.y *= scale

				transform1.x += cx
				transform1.y += cy
			}

			update_transform()
		}
	}

	e_scroll.addEventListener(
		"wheel",
		function (evt) {
			if (evt.ctrlKey) {
				disable_map_fit()
				anchor_transform(evt.touches)

				let win_w = e_scroll.clientWidth
				let win_h = e_scroll.clientHeight
				let real_min_zoom = Math.min(MIN_ZOOM, win_w / map_w, win_h / map_h)

				// one "click" of 120 units -> 10% change
				let new_scale = Math.max(real_min_zoom, Math.min(MAX_ZOOM, transform1.scale + event.wheelDeltaY / 1200))

				// snap to 1 if close
				if (Math.abs(1 - new_scale) < Math.abs(event.wheelDeltaY / 2400))
					new_scale = 1

				transform1.x -= event.clientX
				transform1.y -= event.clientY

				transform1.x *= new_scale / transform1.scale
				transform1.y *= new_scale / transform1.scale
				transform1.scale = new_scale

				transform1.x += event.clientX
				transform1.y += event.clientY

				update_transform()
				evt.preventDefault()
			}
		},
		{ passive: false }
	)

	window.addEventListener("keydown", function (event) {
		if (event.ctrlKey || event.metaKey) {
			switch (event.keyCode) {
			// '=' / '+' on various keyboards
			case 61:
			case 107:
			case 187:
			case 171:
				disable_map_fit()
				zoom_to(Math.min(MAX_ZOOM, transform1.scale + 0.1))
				event.preventDefault()
				break
			// '-'
			case 173:
			case 109:
			case 189:
				disable_map_fit()
				{
					let win_w = e_scroll.clientWidth
					let win_h = e_scroll.clientHeight
					let real_min_zoom = Math.min(MIN_ZOOM, win_w / map_w, win_h / map_h)
					zoom_to(Math.max(real_min_zoom, transform1.scale - 0.1))
					event.preventDefault()
				}
				break
			// '0'
			case 48:
			case 96:
				disable_map_fit()
				zoom_to(1)
				event.preventDefault()
				break
			}
		}
	})

	window.addEventListener("resize", update_zoom)

	// initialize map-fit: 沿用上次的适配选择；没有记录时，若地图大于可视区则
	// 默认自动适配（桌面端整图可见，窄屏按宽度），否则地图保持原始尺寸。
	// 画布型模块（如 empire-of-the-sun 用 <canvas> 绘底图）不套用 #map 缩放，
	// 只尊重用户手动保存的适配偏好，避免底图与算子层错位。
	if (mapwrap) {
		var fit = null
		try { fit = localStorage.getItem(map_fit_key) } catch (e) {}
		if (!fit && !mapwrap.querySelector("canvas") &&
		    (map_w > e_scroll.clientWidth || map_h > e_scroll.clientHeight))
			fit = (window.innerWidth <= 800) ? "width" : "both"
		if (fit) {
			mapwrap.dataset.fit = fit
			update_map_fit()
		}
	}
})()

/* INITIALIZE */

if (window.innerWidth <= 800)
	document.querySelector("aside").hidden = true

function init_connect() {
	if (params.mode === "debug")
		init_replay()
	else if (params.mode === "replay")
		init_replay()
	else if (params.mode === "play")
		connect_play(false)
	else
		document.getElementById("prompt").textContent = "Invalid mode: " + params.mode
}

/*
 * 保证模块的 on_init 被调用【恰好一次】。
 *
 * client.js 是 defer 列表里排在模块脚本（world.js / play.js / …）之前的一个，
 * 而 players 消息在 WebSocket 一连上就到达，因此存在两种坏时序：
 *   - 消息早于 play.js 执行 → 那时 on_init 还不存在
 *   - 连接早于模块脚本就绪 → update_view() 调 on_update() 直接抛错
 * 一旦 on_init 没被调到，world.things 就是空的：
 *   地图空白，且 populate_generic 报 "cannot find thing: s-loc <id>"。
 * （实测：手动调用一次 on_init 后 things=19、s-loc=1145、地图正常。）
 *
 * 所以不再依赖单一时机，三处兜底（players 消息 / DOMContentLoaded / window load），
 * 由本标志保证只执行一次。
 *
 * 但必须等 players 消息到达后才能调用 —— 那之前 game_scenario / game_options 还没赋值，
 * 提前调用会把模块的 options 设成 undefined，导致 card_class_name 里的 options.valiant
 * 抛 "Cannot read properties of null (reading 'valiant')"。故用 players_received 门闩。
 */
let on_init_done = false
let players_received = false
function ensure_on_init() {
	if (on_init_done) return
	if (!players_received) return
	if (typeof on_init !== "function") return
	// 只有真正调用成功才置位：on_init 内部若因模块尚未就绪而抛错
	// （例如 play.js 里的 ui 还在 TDZ），后续的 DOMContentLoaded / load 兜底
	// 必须还能重试，否则地图永远建不起来。
	try {
		on_init(game_scenario, game_options, static_view)
		on_init_done = true
	} catch (err) {
		console.error("[client] on_init 失败，稍后重试:", err)
	}
}
document.addEventListener("DOMContentLoaded", ensure_on_init)
window.addEventListener("load", ensure_on_init)

/*
 * 模块脚本是否已就绪。
 * client.js 是 defer 列表里排在模块脚本（world.js / play.js / …）之前的一个，
 * 若在模块尚未执行完时就连上，服务端一连上就发 players/state，会导致：
 *   - update_view() 调 on_update() → ReferenceError
 *   - 模块里 let 声明的变量（如 paths-of-glory 的 ui）还在 TDZ → 崩在渲染中途
 * 因此连接前先确认 on_init 与 on_update 都已存在。用轮询而非 window load：
 * 不必等图片/字体，也不会被挂起的资源拖住。
 */
function module_ready() {
	return typeof on_init === "function" && typeof on_update === "function"
}
function init_connect_when_ready(tries) {
	tries = tries || 0
	if (module_ready() || tries >= 150) {       // 最多等 3 秒
		init_connect()
		return
	}
	setTimeout(() => init_connect_when_ready(tries + 1), 20)
}

/*
 * defer 脚本按【文档顺序】执行，client.js 排在模块脚本之前。
 * 等 DOMContentLoaded（此时所有 defer 脚本都已执行）再启动连接流程。
 */
if (document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", init_connect_when_ready)
else
	init_connect_when_ready()
