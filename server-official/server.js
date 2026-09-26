"use strict"

const fs = require("fs")
const crypto = require("crypto")
const http = require("http")
const { WebSocketServer } = require("ws")
const express = require("express")
const sqlite3 = require("better-sqlite3")
const marked = require("marked")

require("dotenv").config()

const DEBUG = process.env.DEBUG | 0
const TIMEOUT = process.env.TIMEOUT | 0
const ALTCHA = process.env.ALTCHA | 0

const HTTP_HOST = process.env.HTTP_HOST || "localhost"
/*
 * RTT_PORT 优先于 .env 里的 HTTP_PORT：本机 8080 被 Steam 的 CEF
 * 调试端口占用，用 RTT_PORT 就能起在别的端口而不必改 .env。
 */
const HTTP_PORT = process.env.RTT_PORT || process.env.HTTP_PORT || 8080

const SITE_NAME = process.env.SITE_NAME || "Localhost"
const SITE_URL = process.env.SITE_URL || "http://" + HTTP_HOST + ":" + HTTP_PORT

const LIMIT_WAITING_GAMES = (process.env.LIMIT_WAITING_GAMES | 0) || 3
const LIMIT_OPEN_GAMES = (process.env.LIMIT_OPEN_GAMES | 0) || 4
const LIMIT_ACTIVE_GAMES_MIN = (process.env.LIMIT_ACTIVE_GAMES_MIN | 0) || 4
const LIMIT_ACTIVE_GAMES_MAX = (process.env.LIMIT_ACTIVE_GAMES_MAX | 0) || 30
const LIMIT_TM_QUEUE = (process.env.LIMIT_TM_QUEUE | 0) || 5

const REGEX_MAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/
const REGEX_NAME = /^[\p{Alpha}\p{Number}'_-]+( [\p{Alpha}\p{Number}'_-]+)*$/u

const WEBHOOKS = process.env.WEBHOOKS | 0
if (WEBHOOKS)
	console.log("Webhook notifications enabled.")
else
	console.log("Webhook notifications disabled.")

const RANDOM_ROLES = [
	"Random 1",
	"Random 2",
	"Random 3",
	"Random 4",
	"Random 5",
	"Random 6",
	"Random 7",
]

const RANDOM_ROLES_LIST = [
	null,
	RANDOM_ROLES.slice(0, 1),
	RANDOM_ROLES.slice(0, 2),
	RANDOM_ROLES.slice(0, 3),
	RANDOM_ROLES.slice(0, 4),
	RANDOM_ROLES.slice(0, 5),
	RANDOM_ROLES.slice(0, 6),
	RANDOM_ROLES.slice(0, 7),
]

function LOG_STATS() {
	// Count clients connected to game websockets
	let num_games = 0
	let num_sockets = 0
	for (let id in game_clients) {
		num_games ++
		num_sockets += game_clients[id].length
	}

	if (num_games > 0 || num_sockets > 0)
		console.log(`>>> games=${num_games} sockets=${num_sockets}`)
}

setInterval(LOG_STATS, 60 * 1000)

/* CONNECTED CLIENT INFO */

var game_clients = {}
var game_cookies = {}

/*
 * Main database.
 */

let db = new sqlite3(process.env.DATABASE || "./db")
db.pragma("synchronous = NORMAL")

let ENABLE_ARCHIVE = process.env.ARCHIVE | 0
if (ENABLE_ARCHIVE) {
	console.log("Attached to archive database.")
	db.exec("attach database 'archive.db' as archive")
}

const SQL_BEGIN = db.prepare("begin immediate")
const SQL_COMMIT = db.prepare("commit")
const SQL_ROLLBACK = db.prepare("rollback")

db.exec("delete from logins where julianday() > julianday(expires)")
db.exec("delete from tokens where julianday() > julianday(time, '+1 days')")

function SQL(s) {
	return db.prepare(s)
}

function set_has(set, item) {
	if (!set)
		return false
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return true
	}
	return false
}

// see Object.groupBy
function object_group_by(items, callback) {
	let groups = {}
	if (typeof callback === "function") {
		for (let item of items) {
			let key = callback(item)
			if (key in groups)
				groups[key].push(item)
			else
				groups[key] = [ item ]
		}
	} else {
		for (let item of items) {
			let key = item[callback]
			if (key in groups)
				groups[key].push(item)
			else
				groups[key] = [ item ]
		}
	}
	return groups
}

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

/*
 * Notification mail setup.
 */

let mailer = null
if (process.env.MAIL_HOST && process.env.MAIL_PORT && process.env.MAIL_FROM) {
	mailer = require("nodemailer").createTransport({
		host: process.env.MAIL_HOST,
		port: process.env.MAIL_PORT,
		ignoreTLS: true
	})
	console.log("Mail notifications enabled: ", mailer.options)
} else {
	console.log("Mail notifications disabled.")
	if (DEBUG) {
		mailer = {
			sendMail(mail) {
				console.log("MAIL (DEBUG):", mail)
			}
		}
	}
}

/*
 * Login session management.
 */

const COOKIE = (process.env.COOKIE || "login") + "="

const login_sql_select = SQL("select user_id from logins where sid = ? and expires > julianday()").pluck()
const login_sql_insert = SQL("insert into logins(sid,user_id,ip,expires) values (abs(random()) % (1<<48), ?, ?, julianday() + 28) returning sid").pluck()
const login_sql_delete = SQL("delete from logins where sid = ?")
const login_sql_touch = SQL("update logins set expires = julianday() + 28, ip = ? where sid = ? and expires < julianday() + 27")

function make_cookie(sid, age) {
	return `${COOKIE}${sid}; Path=/; Max-Age=${age}; HttpOnly`
}

function login_cookie(req) {
	let c = req.headers.cookie
	if (c) {
		let i = c.indexOf(COOKIE)
		if (i >= 0)
			return parseInt(c.substring(i + COOKIE.length))
	}
	return 0
}

function login_insert(res, user_id, ip) {
	var sid = login_sql_insert.get(user_id, ip)
	res.setHeader("Set-Cookie", make_cookie(sid, 2419200))
}

function login_touch(res, sid, ip) {
	if (login_sql_touch.run(ip, sid).changes === 1)
		res.setHeader("Set-Cookie", make_cookie(sid, 2419200))
}

function login_delete(res, sid) {
	login_sql_delete.run(sid)
	res.setHeader("Set-Cookie", make_cookie("", 0))
}

/*
 * Web server setup.
 */

function set_static_headers(res, path) {
	if (path.match(/\.(jpg|png|svg|webp|ico|woff2)$/))
		res.setHeader("Cache-Control", "max-age=86400, must-revalidate")
	else
		res.setHeader("Cache-Control", "no-cache")
}

let app = express()

app.locals.DEBUG = DEBUG
app.locals.ALTCHA = ALTCHA

app.locals.SITE_NAME = SITE_NAME
app.locals.SITE_NAME_P = SITE_NAME.endsWith("!") ? SITE_NAME : SITE_NAME + "."
app.locals.SITE_URL = SITE_URL
app.locals.SITE_THEME = process.env.SITE_THEME
app.locals.SITE_ICON = process.env.SITE_ICON
app.locals.SITE_IMPRINT = process.env.SITE_IMPRINT
app.locals.ENABLE_MAIL = !!mailer
app.locals.ENABLE_WEBHOOKS = !!WEBHOOKS
app.locals.ENABLE_FORUM = process.env.FORUM | 0
app.locals.ENABLE_TOURNAMENTS = process.env.TOURNAMENTS | 0
app.locals.ENABLE_ARCHIVE = ENABLE_ARCHIVE

app.locals.ICON_PRIVATE = "\u{1f512}"
app.locals.ICON_MATCH = "\u{1f3c6}"
app.locals.ICON_UNREAD = "\u{1f4dd}"
app.locals.ICON_SEND = "\u{1f4dd}"
app.locals.ICON_NOTE = "\u270f"
app.locals.ICON_X = "\u2716"

app.locals.TM_ICON_QUEUE = "\u{1f465}"
app.locals.TM_ICON_TICKET = "\u{1f3ab}"
app.locals.TM_ICON_ACTIVE = "\u{1f3c3}"
app.locals.TM_ICON_FINISHED = "\u{1f3c6}"

app.locals.human_date = human_date
app.locals.format_options = format_options
app.locals.format_minutes = format_minutes

app.locals.may_join_seed_level = may_join_seed_level

app.set("x-powered-by", false)
app.set("etag", false)
app.set("view engine", "pug")

app.use(express.static("public", { redirect: false, etag: false, cacheControl: false, setHeaders: set_static_headers }))
app.use(express.urlencoded({ extended: false }))

let http_server = http.createServer(app)
let wss = new WebSocketServer({ server: http_server })
http_server.keepAliveTimeout = 0
http_server.listen(HTTP_PORT, HTTP_HOST, () => console.log(`Listening to HTTP on ${HTTP_HOST}:${HTTP_PORT}`))

/*
 * MISC FUNCTIONS
 */

function play_url(title_id, game_id, role, mode) {
	if (mode && role)
		return `/${title_id}/play.html?mode=${mode}&game=${game_id}&role=${encodeURIComponent(role)}`
	else if (mode)
		return `/${title_id}/play.html?mode=${mode}&game=${game_id}`
	else if (role)
		return `/${title_id}/play.html?game=${game_id}&role=${encodeURIComponent(role)}`
	else
		return `/${title_id}/play.html?mode=${mode}`
}

function random_seed() {
	return crypto.randomInt(1, 2**35-31)
}

function shuffle(list) {
	// Fisher-Yates shuffle
	for (let i = list.length - 1; i > 0; --i) {
		let j = crypto.randomInt(i + 1)
		let tmp = list[j]
		list[j] = list[i]
		list[i] = tmp
	}
}

function epoch_from_julianday(x) {
	return (x - 2440587.5) * 86400000
}

function julianday_from_epoch(x) {
	return x / 86400000 + 2440587.5
}

function epoch_from_time(x) {
	if (typeof x === "string")
		return Date.parse(x)
	return epoch_from_julianday(x)
}

function SLOG(socket, ...msg) {
	let time = new Date().toISOString().substring(11,19)
	let name = (socket.user ? socket.user.name : "guest").padEnd(20)
	let ip = String(socket.ip).padEnd(15)
	let ws = "----------"
	console.log(time, ip, ws, name, "WS",
		socket.title_id,
		socket.game_id,
		socket.role,
		...msg)
}

function future_date(date, days) {
	var seconds = days * 86400
	if (days < 1) {
		if (seconds < 60) return "now"
		if (seconds < 120) return "in 1 minute"
		if (seconds < 3600) return "in " + Math.floor(seconds / 60) + " minutes"
		if (seconds < 7200) return "in 1 hour"
		if (seconds < 86400) return "in " + Math.floor(seconds / 3600) + " hours"
	}
	if (days < 2) return "tomorrow"
	if (days < 7) return "in " + Math.round(days) + " days"
	return new Date(epoch_from_julianday(date)).toISOString().substring(0,10)
}

function human_date(date) {
	if (typeof date === "string")
		date = julianday_from_epoch(Date.parse(date + "Z"))
	if (typeof date !== "number")
		return "never"
	var days = julianday_from_epoch(Date.now()) - date
	if (days < 0)
		return future_date(date, -days)
	var seconds = days * 86400
	if (days < 1) {
		if (seconds < 60) return "now"
		if (seconds < 120) return "1 minute ago"
		if (seconds < 3600) return Math.floor(seconds / 60) + " minutes ago"
		if (seconds < 7200) return "1 hour ago"
		if (seconds < 86400) return Math.floor(seconds / 3600) + " hours ago"
	}
	if (days < 2) return "yesterday"
	if (days < 14) return Math.floor(days) + " days ago"
	if (days < 31) return Math.floor(days / 7) + " weeks ago"
	return new Date(epoch_from_julianday(date)).toISOString().substring(0,10)
}

function format_minutes(mins) {
	if (mins > 59) {
		var hh = mins / 60 | 0
		var mm = mins % 60
		return `${hh} hours ${mm} minutes`
	}
	return mins + " minutes"
}

function is_valid_password(password) {
	if (password.length < 4 || password.length > 100)
		return false
	return true
}

function is_valid_email(email) {
	return REGEX_MAIL.test(email)
}

function is_forbidden_mail(mail) {
	return SQL_BLACKLIST_MAIL.get(mail)
}

function clean_user_name(name) {
	name = name.replace(/^ */, "").replace(/ *$/, "").replace(/  */g, " ")
	if (name.length > 50)
		name = name.substring(0, 50)
	return name
}

function is_valid_user_name(name) {
	if (name.length < 2)
		return false
	if (name.length > 50)
		return false
	if (SQL_BLACKLIST_NAME.get(name))
		return false
	return REGEX_NAME.test(name)
}

function hash_password(password, salt) {
	let hash = crypto.createHash("sha256")
	hash.update(password)
	hash.update(salt)
	return hash.digest("hex")
}

function verify_password(user, password) {
	var user_login = SQL_SELECT_LOGIN.get(user.user_id)
	var hash  = hash_password(password, user_login.salt)
	if (hash !== user_login.password)
		return false
	return true
}

/*
 * ALTCHA ANTI-BOT SIGNUP
 */

const ALTCHA_HMAC_KEY = crypto.randomBytes(16).toString("hex")

function sha2_hex(salty_secret) {
	var hash = crypto.createHash("sha256")
	hash.update(salty_secret)
	return hash.digest("hex")
}

function hmac_sha2_hex(challenge, key) {
	var hmac = crypto.createHmac("sha256", key)
	hmac.update(challenge)
	return hmac.digest("hex")
}

function altcha_create_challenge() {
	var maxnumber = ALTCHA
	var secret = crypto.randomInt(maxnumber)
	var salt = crypto.randomBytes(16).toString("hex")
	var challenge = sha2_hex(salt + secret)
	var signature = hmac_sha2_hex(challenge, ALTCHA_HMAC_KEY)
	return {
		algorithm: "SHA-256",
		challenge,
		maxnumber,
		salt,
		signature
	}
}

function altcha_verify_solution(payload) {
	var data
	if (!payload)
		return "missing altcha payload"
	try {
		data = JSON.parse(atob(payload))
	} catch (_error) {
		return "invalid altcha payload"
	}
	if (data.algorithm !== "SHA-256")
		return "invalid altcha algorithm"
	if (data.challenge !== sha2_hex(data.salt + data.number))
		return "invalid altcha challenge"
	if (data.signature !== hmac_sha2_hex(data.challenge, ALTCHA_HMAC_KEY))
		return "invalid altcha signature"
	return null
}

function must_pass_altcha(req, res, next) {
	if (ALTCHA) {
		var altcha_error = altcha_verify_solution(req.body.altcha)
		if (altcha_error) {
			setTimeout(() => res.status(500).send(altcha_error), 3000)
			return
		}
	}
	return next()
}

app.get("/altcha-challenge", function (_req, res) {
	return res.json(altcha_create_challenge())
})

/*
 * USER AUTHENTICATION
 */

const SQL_BLACKLIST_MAIL = SQL("select exists ( select 1 from blacklist_mail where ? like mail )").pluck()
const SQL_BLACKLIST_NAME = SQL("select exists ( select 1 from blacklist_name where ? like name )").pluck()

const SQL_EXISTS_USER_NAME = SQL("SELECT EXISTS ( SELECT 1 FROM users WHERE name=? )").pluck()
const SQL_EXISTS_USER_MAIL = SQL("SELECT EXISTS ( SELECT 1 FROM users WHERE mail=? )").pluck()

const SQL_INSERT_USER = SQL("INSERT INTO users (name,mail) VALUES (?,?) RETURNING user_id,name,mail")
const SQL_DELETE_USER = SQL("DELETE FROM users WHERE user_id = ?")

const SQL_SELECT_LOGIN = SQL("SELECT * FROM user_login_view WHERE user_id=?")
const SQL_SELECT_LOGIN_BY_MAIL = SQL("SELECT * FROM user_login_view WHERE mail=?")
const SQL_SELECT_LOGIN_BY_NAME = SQL("SELECT * FROM user_login_view WHERE name=?")

const SQL_SELECT_USER_BY_NAME = SQL("SELECT * FROM user_view WHERE name=?")
const SQL_SELECT_USER_FOR_PLAY = SQL("select user_id, name, is_moderator from users where user_id=?")
const SQL_SELECT_USER_DYNAMIC = SQL("select * from user_dynamic_view where user_id=?")
const SQL_SELECT_USER_ID = SQL("SELECT user_id FROM users WHERE name=?").pluck()
const SQL_SELECT_USER_BY_SEARCH = SQL("select name, atime from users left join user_last_seen using(user_id) where name like ? order by name")

const SQL_SELECT_USER_PROFILE = SQL(`
	select *
	from users
	left join user_first_seen using(user_id)
	left join user_last_seen using(user_id)
	left join user_about using(user_id)
	where name = ?
`)

const SQL_SELECT_USER_MOVE_TIME = SQL(`
	with
		cte_hist as ( select minutes, frequency from user_move_hist where user_id = ? ),
		cte_total as ( select sum(frequency) as total from cte_hist ),
		cte_run_1 as ( select minutes, 4 * sum(frequency) over (order by minutes) / (total+1) as quartile from cte_hist, cte_total ),
		cte_run_2 as ( select quartile, last_value(minutes) over (order by quartile) as minutes from cte_run_1 group by quartile ),
		cte_iqr as (
			select
				sum(minutes) filter (where quartile = 0) as q1,
				sum(minutes) filter (where quartile = 1) as q2,
				sum(minutes) filter (where quartile = 2) as q3,
				sum(minutes) filter (where quartile = 3) as q4
			from cte_run_2
		)
	select
		( select sum(minutes * frequency) / sum(frequency) from cte_hist ) as mean,
		coalesce(q1, q2, q3, q4) as q1,
		coalesce(q2, q3, q4) as q2,
		coalesce(q3, q4) as q3
	from
		cte_iqr
`)

const SQL_SELECT_USER_TIMEOUTS = SQL(`
	with cte_timeout as (
		select
			user_id,
			count(1) as timeout_total,
			coalesce(max(time), 0) as timeout_last
		from
			user_timeout
		where user_id = ?
	)
	select
		user_id,
		timeout_total,
		timeout_last,
		sum(games.mtime > timeout_last) as games_since_timeout
	from
		cte_timeout
		left join players using(user_id)
		left join games using(game_id)
	where
		status > 1 and is_opposed and moves >= player_count * 2
`)

const SQL_SELECT_USER_ABOUT = SQL("SELECT about FROM user_about WHERE user_id=?").pluck()
const SQL_SELECT_USER_NOTIFY = SQL("SELECT notify FROM users WHERE user_id=?").pluck()
const SQL_SELECT_USER_VERIFIED = SQL("SELECT is_verified FROM users WHERE user_id=?").pluck()
const SQL_UPDATE_USER_NOTIFY = SQL("UPDATE users SET notify=? WHERE user_id=?")
const SQL_UPDATE_USER_NAME = SQL("UPDATE users SET name=? WHERE user_id=?")
const SQL_UPDATE_USER_MAIL = SQL("UPDATE users SET mail=? WHERE user_id=?")
const SQL_UPDATE_USER_VERIFIED = SQL("UPDATE users SET is_verified=? WHERE user_id=?")

const SQL_UPDATE_USER_ABOUT = SQL("insert or replace into user_about (user_id,about) values (?,?)")
const SQL_UPDATE_USER_PASSWORD = SQL("insert or replace into user_password (user_id,password,salt) values (?,?,?)")
const SQL_UPDATE_USER_FIRST_SEEN = SQL("insert or replace into user_first_seen (user_id,ctime,ip) values (?,datetime(),?)")
const SQL_UPDATE_USER_LAST_SEEN = SQL("insert or replace into user_last_seen (user_id,atime,ip) values (?,datetime(),?)")
const SQL_UPDATE_USER_IS_BANNED = SQL("update users set is_banned=? where user_id=?")

const SQL_SELECT_USER_MAY_DEBUG = SQL("select exists ( select 1 from user_may_debug where user_id=? and title_id=? )").pluck()

const SQL_SELECT_WEBHOOK = SQL("SELECT * FROM webhooks WHERE user_id=?")
const SQL_SELECT_WEBHOOK_SEND = SQL("SELECT url, format, prefix FROM webhooks WHERE user_id=? AND error is null")
const SQL_UPDATE_WEBHOOK = SQL("INSERT OR REPLACE INTO webhooks (user_id, url, format, prefix, error) VALUES (?,?,?,?,null)")
const SQL_UPDATE_WEBHOOK_ERROR = SQL("UPDATE webhooks SET error=? WHERE user_id=?")
const SQL_UPDATE_WEBHOOK_SUCCESS = SQL("UPDATE webhooks SET error=null WHERE user_id=? AND error IS NOT NULL")
const SQL_DELETE_WEBHOOK = SQL("DELETE FROM webhooks WHERE user_id=?")

const SQL_FIND_TOKEN = SQL("SELECT token FROM tokens WHERE user_id=? AND julianday('now') < julianday(time, '+5 minutes')").pluck()
const SQL_CREATE_TOKEN = SQL("INSERT OR REPLACE INTO tokens (user_id,token,time) VALUES (?, hex(randomblob(8)), datetime()) RETURNING token").pluck()
const SQL_VERIFY_TOKEN = SQL("SELECT EXISTS ( SELECT 1 FROM tokens WHERE user_id=? AND julianday('now') < julianday(time, '+20 minutes') AND token=? )").pluck()

app.use(function (req, res, next) {
	let ip = req.headers["x-forwarded-for"] || req.ip || req.connection.remoteAddress || "0.0.0.0"

	res.setHeader("Cache-Control", "no-store")
	let sid = login_cookie(req)
	if (sid) {
		let user_id = login_sql_select.get(sid)
		if (user_id) {
			login_touch(res, sid, ip)
			req.user = res.locals.user = SQL_SELECT_USER_DYNAMIC.get(user_id)
			SQL_UPDATE_USER_LAST_SEEN.run(user_id, ip)
			if (req.user.is_banned)
				return res.status(403).send("You have been banished!")
			if (req.user.is_admin)
				req.user.is_moderator = 1
		}
	}

	// Log non-static accesses.
	let time = new Date().toISOString().substring(11, 19)
	let name = (req.user ? req.user.name : "guest").padEnd(20)
	ip = String(ip).padEnd(15)
	console.log(time, ip, name, req.method, req.url)

	return next()
})

function must_be_logged_in(req, res, next) {
	if (!req.user)
		return res.redirect("/login")
	return next()
}

function must_be_verified(req, res, next) {
	if (!req.user)
		return res.redirect("/login")
	if (!SQL_SELECT_USER_VERIFIED.get(req.user.user_id))
		return res.redirect("/account/mail/verify")
	return next()
}

function must_be_administrator(req, res, next) {
	if (!req.user || !req.user.is_admin)
		return res.status(401).send("Not authorized")
	return next()
}

function must_be_moderator(req, res, next) {
	if (!req.user || !req.user.is_moderator)
		return res.status(401).send("Not authorized")
	return next()
}

function render_markdown(res, path, default_text, footer) {
	var text
	if (fs.existsSync(path))
		text = fs.readFileSync(path, "utf-8")
	else
		text = default_text
	var body = marked.parse(text)
	var title = body.match(/<h1>([^>]*)<\/h1>/)?.[1] ?? path
	res.render("markdown.pug", { title, body, footer })
}

app.get("/", function (req, res) {
	var footer = []
	if (!app.locals.ENABLE_MAIL)
		footer.push("Mail notifications disabled.")
	if (!app.locals.ENABLE_WEBHOOKS)
		footer.push("Webhook notifications disabled.")
	render_markdown(res, "public/index.md", "# Index\nInsert contents of `public/index.md` here.\n", footer)
})

app.get("/about", function (req, res) {
	render_markdown(res, "public/about.md", "# About\nInsert contents of `public/about.md` here.\n")
})

app.get("/games/library", function (req, res) {
	res.render("games_library.pug", { library: TITLE_LIST })
})

app.post("/logout", function (req, res) {
	let sid = login_cookie(req)
	if (sid)
		login_delete(res, sid)
	res.redirect("/login")
})

app.get("/login", function (req, res) {
	if (req.user)
		return res.redirect("/account")
	res.render("login.pug")
})

app.post("/login", must_pass_altcha, function (req, res) {
	let name_or_mail = req.body.username
	let password = req.body.password
	if (!is_valid_email(name_or_mail))
		name_or_mail = clean_user_name(name_or_mail)
	let user = SQL_SELECT_LOGIN_BY_NAME.get(name_or_mail)
	if (!user)
		user = SQL_SELECT_LOGIN_BY_MAIL.get(name_or_mail)
	if (!user || is_forbidden_mail(user.mail) || hash_password(password, user.salt) != user.password)
		return setTimeout(() => res.render("login.pug", { flash: "Invalid login." }), 1000)
	login_insert(res, user.user_id)
	res.redirect("/account")
})

app.get("/signup", function (req, res) {
	if (req.user)
		return res.redirect("/")
	res.render("signup.pug")
})

app.post("/signup", must_pass_altcha, function (req, res) {
	function err(msg) {
		res.render("signup.pug", { flash: msg })
	}
	let ip = req.headers["x-forwarded-for"] || req.ip || req.connection.remoteAddress || "0.0.0.0"
	let name = req.body.username
	let mail = req.body.mail
	let password = req.body.password
	name = clean_user_name(name)
	if (!is_valid_user_name(name))
		return err("Invalid user name!")
	if (SQL_EXISTS_USER_NAME.get(name))
		return err("That name is already taken.")
	if (!is_valid_email(mail) || is_forbidden_mail(mail))
		return err("Invalid mail address!")
	if (SQL_EXISTS_USER_MAIL.get(mail))
		return err("That mail is already taken.")
	if (password.length < 4)
		return err("Password is too short!")
	if (password.length > 100)
		return err("Password is too long!")
	let salt = crypto.randomBytes(32).toString("hex")
	let hash = hash_password(password, salt)
	let user = SQL_INSERT_USER.get(name, mail)
	SQL_UPDATE_USER_FIRST_SEEN.run(user.user_id, ip)
	SQL_UPDATE_USER_PASSWORD.run(user.user_id, hash, salt)
	login_insert(res, user.user_id)
	res.redirect("/account")
})

/* ACCOUNT */

app.get("/account/mail/verify", must_be_logged_in, function (req, res) {
	if (SQL_SELECT_USER_VERIFIED.get(req.user.user_id))
		return res.redirect("/account")
	var sent_token = SQL_FIND_TOKEN.get(req.user.user_id)
	var input_token = req.query.token
	res.render("account_mail_verify.pug", { input_token, sent_token })
})

app.post("/account/mail/verify-send", must_be_logged_in, function (req, res) {
	if (!SQL_FIND_TOKEN.get(req.user.user_id))
		mail_verification_token(req.user, SQL_CREATE_TOKEN.get(req.user.user_id))
	res.redirect("/account/mail/verify")
})

app.post("/account/mail/verify", must_be_logged_in, function (req, res) {
	if (SQL_VERIFY_TOKEN.get(req.user.user_id, req.body.token)) {
		SQL_UPDATE_USER_VERIFIED.run(1, req.user.user_id)
		res.redirect("/account")
	} else {
		var sent_token = SQL_FIND_TOKEN.get(req.user.user_id)
		res.render("account_mail_verify.pug", { sent_token, flash: "Invalid or expired token!" })
	}
})

app.get("/account/password/forgot", function (req, res) {
	if (req.user)
		return res.redirect("/")
	res.render("account_password_forgot.pug")
})

app.post("/account/password/forgot", must_pass_altcha, function (req, res) {
	let mail = req.body.mail
	let user = SQL_SELECT_LOGIN_BY_MAIL.get(mail)
	if (user) {
		var token = SQL_CREATE_TOKEN.get(user.user_id)
		mail_password_reset_token(user, token)
		return res.redirect("/account/password/reset?mail=" + mail)
	}
	res.render("account_password_forgot.pug", { flash: "User not found." })
})

app.get("/account/password/reset", function (req, res) {
	if (req.user)
		return res.redirect("/")
	var mail = req.query.mail
	var token = req.query.token
	res.render("account_password_reset.pug", { mail, token })
})

app.post("/account/password/reset", function (req, res) {
	let mail = req.body.mail
	let token = req.body.token
	let password = req.body.password
	function err(msg) {
		res.render("account_password_reset.pug", { mail: mail, token: token, flash: msg })
	}
	let user = SQL_SELECT_LOGIN_BY_MAIL.get(mail)
	if (!user)
		return err("User not found.")
	if (!is_valid_password(password))
		return err("New password is invalid!")
	if (!SQL_VERIFY_TOKEN.get(user.user_id, token))
		return err("Invalid or expired token!")
	let salt = crypto.randomBytes(32).toString("hex")
	let hash = hash_password(password, salt)
	SQL_UPDATE_USER_PASSWORD.run(user.user_id, hash, salt)
	SQL_UPDATE_USER_VERIFIED.run(1, user.user_id)
	var ip = req.headers["x-forwarded-for"] || req.ip || req.connection.remoteAddress || "0.0.0.0"
	login_insert(res, user.user_id, ip)
	return res.redirect("/account")
})

app.get("/account/password/change", must_be_logged_in, function (req, res) {
	res.render("account_password_change.pug")
})

app.post("/account/password/change", must_be_logged_in, function (req, res) {
	let oldpass = req.body.password
	let newpass = req.body.newpass
	// Get full user record including password and salt
	let user = SQL_SELECT_LOGIN.get(req.user.user_id)
	if (!is_valid_password(newpass))
		return res.render("account_password_change.pug", { flash: "New password is invalid!" })
	if (!verify_password(req.user, oldpass))
		return res.render("account_password_change.pug", { flash: "Wrong password!" })
	let salt = crypto.randomBytes(32).toString("hex")
	let hash = hash_password(newpass, salt)
	SQL_UPDATE_USER_PASSWORD.run(user.user_id, hash, salt)
	return res.redirect("/account")
})

const SQL_SELECT_MAY_DELETE_ACCOUNT = SQL(`
	select exists (
		select 1 from games join players using(game_id) where status <= 1 and user_id=?
	)
`).pluck()

function may_delete_account(user_id) {
	if (SQL_SELECT_MAY_DELETE_ACCOUNT.get(user_id))
		return false
	return true
}

app.get("/account/delete", must_be_logged_in, function (req, res) {
	if (!may_delete_account(req.user.user_id))
		return res.status(401).send("You may not delete your account while you have unfinished games.")
	res.render("account_delete.pug")
})

const SQL_SELECT_GAME_ROLE_FOR_DELETED_USER = SQL(`
	select game_id, role from players where user_id = ? and game_id in (select game_id from games where status <= 1)
`)

app.post("/account/delete", must_be_logged_in, function (req, res) {
	if (!may_delete_account(req.user.user_id))
		res.status(401).send("You may not delete your account while you have unfinished games.")

	let password = req.body.password
	// Get full user record including password and salt
	let user = SQL_SELECT_LOGIN.get(req.user.user_id)
	let hash = hash_password(password, user.salt)
	if (hash !== user.password)
		return res.render("account_delete.pug", { flash: "Wrong password!" })

	let list = SQL_SELECT_GAME_ROLE_FOR_DELETED_USER.all(req.user.user_id)
	for (let item of list)
		send_chat_message(item.game_id, null, `${user.name} (${item.role}) left the game.`)

	SQL_DELETE_USER.run(req.user.user_id)
	return res.send("Goodbye!")
})

app.get("/admin/ban-user/:who", must_be_administrator, function (req, res) {
	let who = SQL_SELECT_USER_ID.get(req.params.who)
	SQL_UPDATE_USER_IS_BANNED.run(1, who)
	SQL_UPDATE_USER_NOTIFY.run(0, who)
	SQL_DELETE_WEBHOOK.run(who)
	TM_DELETE_QUEUE_USER.run(who)
	return res.redirect("/user/" + req.params.who)
})

app.get("/admin/unban-user/:who", must_be_administrator, function (req, res) {
	let who = SQL_SELECT_USER_ID.get(req.params.who)
	SQL_UPDATE_USER_IS_BANNED.run(0, who)
	return res.redirect("/user/" + req.params.who)
})

const SQL_SELECT_ADMIN_TIMEOUTS = SQL(`
	select
		game_id, notice, moves, name, time
	from user_timeout
	join users using(user_id)
	join games using(game_id)
	where is_opposed and time > datetime('now', '-28 days')
	order by time desc
`)

const TM_SELECT_ADMIN_TIMEOUTS = SQL(`
	select
		game_id, notice, moves,
		mtime,
		xtime,
		group_concat(players.time_used) as time_used,
		group_concat(user_timeout.time) as hard_timeout
	from games
	left join players using(game_id)
	left join user_timeout using(game_id, user_id)
	where status>1 and did_timeout and is_match and xtime > datetime('now', '-28 days')
	group by game_id
	order by mtime desc
`)

app.get("/admin/timeouts", must_be_moderator, function (req, res) {
	let timeouts = SQL_SELECT_ADMIN_TIMEOUTS.all()
	return res.render("admin_timeouts.pug", { timeouts })
})

app.get("/tm/timeouts", must_be_moderator, function (req, res) {
	let timeouts = TM_SELECT_ADMIN_TIMEOUTS.all()
	return res.render("tm_timeouts.pug", { timeouts })
})

/*
 * USER PROFILE
 */

app.get("/account", must_be_logged_in, function (req, res) {
	var who = SQL_SELECT_USER_PROFILE.get(req.user.name)
	var move_time = SQL_SELECT_USER_MOVE_TIME.get(who.user_id)
	var timeouts = SQL_SELECT_USER_TIMEOUTS.get(who.user_id)
	var tm_banned = TM_SELECT_BANNED.get(req.user.user_id)
	var mail = {
		notify: SQL_SELECT_USER_NOTIFY.get(req.user.user_id),
		is_verified: SQL_SELECT_USER_VERIFIED.get(req.user.user_id)
	}
	var webhook = SQL_SELECT_WEBHOOK.get(req.user.user_id)
	var ratings = SQL_USER_RATINGS.all(req.user.user_id)
	res.render("account_index.pug", { who, move_time, timeouts, tm_banned, mail, webhook, ratings })
})

app.get("/account/mail/subscribe", must_be_verified, function (req, res) {
	SQL_UPDATE_USER_NOTIFY.run(1, req.user.user_id)
	res.redirect("/account")
})

app.get("/account/mail/unsubscribe", must_be_logged_in, function (req, res) {
	SQL_UPDATE_USER_NOTIFY.run(0, req.user.user_id)
	res.redirect("/account")
})

app.get("/account/webhook", must_be_logged_in, function (req, res) {
	let webhook = SQL_SELECT_WEBHOOK.get(req.user.user_id)
	res.render("account_webhook.pug", { webhook: webhook })
})

app.post("/account/webhook/delete", must_be_logged_in, function (req, res) {
	SQL_DELETE_WEBHOOK.run(req.user.user_id)
	res.redirect("/account/webhook")
})

app.post("/account/webhook/update", must_be_logged_in, function (req, res) {
	let url = req.body.url
	let prefix = req.body.prefix
	let format = req.body.format
	SQL_UPDATE_WEBHOOK.run(req.user.user_id, url, format, prefix)
	const webhook = SQL_SELECT_WEBHOOK_SEND.get(req.user.user_id)
	if (webhook)
		send_webhook(req.user.user_id, webhook, "Test message!", 0)
	res.setHeader("refresh", "3; url=/account/webhook")
	res.send("Testing Webhook. Please wait...")
})

app.get("/account/change-name", must_be_logged_in, function (req, res) {
	res.render("account_change_name.pug")
})

app.post("/account/change-name", must_be_logged_in, function (req, res) {
	let newname = clean_user_name(req.body.newname)
	if (!is_valid_user_name(newname))
		return res.render("account_change_name.pug", { flash: "Invalid user name!" })
	if (SQL_EXISTS_USER_NAME.get(newname))
		return res.render("account_change_name.pug", { flash: "That name is already taken!" })
	if (!verify_password(req.user, req.body.password))
		return res.render("account_change_name.pug", { flash: "Wrong password!" })
	SQL_UPDATE_USER_NAME.run(newname, req.user.user_id)
	return res.redirect("/account")
})

app.get("/account/mail/change", must_be_logged_in, function (req, res) {
	res.render("account_mail_change.pug")
})

app.post("/account/mail/change", must_be_logged_in, function (req, res) {
	let newmail = req.body.newmail
	if (!is_valid_email(newmail) || is_forbidden_mail(newmail))
		return res.render("account_mail_change.pug", { flash: "Invalid mail address!" })
	if (SQL_EXISTS_USER_MAIL.get(newmail))
		return res.render("account_mail_change.pug", { flash: "That mail address is already taken!" })
	if (!verify_password(req.user, req.body.password))
		return res.render("account_mail_change.pug", { flash: "Wrong password!" })
	SQL_UPDATE_USER_MAIL.run(newmail, req.user.user_id)
	SQL_UPDATE_USER_VERIFIED.run(0, req.user.user_id)
	SQL_UPDATE_USER_NOTIFY.run(0, req.user.user_id)
	return res.redirect("/account")
})

app.get("/account/change-about", must_be_logged_in, function (req, res) {
	let about = SQL_SELECT_USER_ABOUT.get(req.user.user_id)
	res.render("account_change_about.pug", { about })
})

app.post("/account/change-about", must_be_logged_in, function (req, res) {
	SQL_UPDATE_USER_ABOUT.run(req.user.user_id, req.body.about)
	return res.redirect("/account")
})

app.get("/user/:who_name", must_be_logged_in, function (req, res) {
	let who = SQL_SELECT_USER_PROFILE.get(req.params.who_name)
	if (who) {
		let move_time = SQL_SELECT_USER_MOVE_TIME.get(who.user_id)
		let timeouts = SQL_SELECT_USER_TIMEOUTS.get(who.user_id)
		var tm_banned = TM_SELECT_BANNED.get(who.user_id)
		let games = QUERY_LIST_PUBLIC_GAMES_OF_USER.all({ user_id: who.user_id })
		let ratings = SQL_USER_RATINGS.all(who.user_id)
		annotate_games(games, 0, null, null)
		let active_pools = TM_POOL_LIST_USER_ACTIVE.all(who.user_id)
		let finished_pools = TM_POOL_LIST_USER_RECENT_FINISHED.all(who.user_id)
		let contact = 0
		if (req.user)
			contact = SQL_SELECT_CONTACT.get(req.user.user_id, who.user_id)
		res.render("user.pug", {
			who,
			move_time,
			timeouts,
			tm_banned,
			contact,
			games,
			active_pools,
			finished_pools,
			ratings,
		})
	} else {
		return res.status(404).send("User not found.")
	}
})

/*
 * CONTACTS
 */

const SQL_SELECT_CONTACT_BLACKLIST = SQL("select you from contacts where me=? and relation<0").pluck()
const SQL_SELECT_CONTACT_WHITELIST = SQL("select you from contacts where me=? and relation>0").pluck()
const SQL_SELECT_CONTACT_FRIEND_NAMES = SQL("select name from contact_view where me=? and relation>0").pluck()
const SQL_SELECT_CONTACT_LIST = SQL("select * from contact_view where me=?")
const SQL_INSERT_CONTACT = SQL("insert into contacts (me,you,relation) values (?,?,?)")
const SQL_DELETE_CONTACT = SQL("delete from contacts where me=? and you=?")
const SQL_SELECT_RELATION = SQL("select relation from contacts where me=? and you=?").pluck()
const SQL_SELECT_CONTACT = SQL("select relation, note from contacts where me=? and you=?")
const SQL_UPDATE_CONTACT_NOTE = SQL("update contacts set note=? where me=? and you=?")

app.get("/contacts", must_be_logged_in, function (req, res) {
	let contacts = SQL_SELECT_CONTACT_LIST.all(req.user.user_id)
	res.render("contacts_index.pug", {
		friends: contacts.filter(user => user.relation > 0),
		enemies: contacts.filter(user => user.relation < 0),
	})
})

app.get("/contacts/note/:who_name", must_be_logged_in, function (req, res) {
	let who = SQL_SELECT_USER_PROFILE.get(req.params.who_name)
	if (who) {
		let contact = SQL_SELECT_CONTACT.get(req.user.user_id, who.user_id)
		if (contact) {
			res.render("contacts_note.pug", { who, contact })
		} else {
			return res.status(404).send("User not in your contact list.")
		}
	} else {
		return res.status(404).send("User not found.")
	}
})

app.post("/contacts/note/:who_name", must_be_logged_in, function (req, res) {
	let who = SQL_SELECT_USER_PROFILE.get(req.params.who_name)
	if (who) {
		let contact = SQL_SELECT_CONTACT.get(req.user.user_id, who.user_id)
		if (contact) {
			let note = req.body.note.trim()
			if (note.length > 80)
				note.length = 80
			if (note.length === 0)
				note = null
			SQL_UPDATE_CONTACT_NOTE.run(note, req.user.user_id, who.user_id)
			res.redirect("/user/" + who.name)
		} else {
			return res.status(404).send("User not in your contact list.")
		}
	} else {
		return res.status(404).send("User not found.")
	}
})

app.get("/contacts/remove/:who_name", must_be_logged_in, function (req, res) {
	let who = SQL_SELECT_USER_BY_NAME.get(req.params.who_name)
	if (!who)
		return res.status(404).send("User not found.")
	SQL_DELETE_CONTACT.run(req.user.user_id, who.user_id)
	if (req.headers.referer)
		return res.redirect(req.headers.referer)
	else
		return res.redirect("/user/" + who.name)
})

app.get("/contacts/add-friend/:who_name", must_be_logged_in, function (req, res) {
	let who = SQL_SELECT_USER_BY_NAME.get(req.params.who_name)
	if (!who)
		return res.status(404).send("User not found.")
	SQL_INSERT_CONTACT.run(req.user.user_id, who.user_id, 1)
	if (req.headers.referer)
		return res.redirect(req.headers.referer)
	else
		return res.redirect("/user/" + who.name)
})

app.get("/contacts/search", must_be_logged_in, function (req, res) {
	let q = req.query.q
	if (q && q.length > 0) {
		if (!q.includes("%"))
			q = "%" + q + "%"
		let results = SQL_SELECT_USER_BY_SEARCH.all(q)
		res.render("contacts_search.pug", { search: req.query.q, results })
	} else {
		res.render("contacts_search.pug", { search: null, results: null })
	}
})

app.get("/contacts/add-enemy/:who_name", must_be_logged_in, function (req, res) {
	let who = SQL_SELECT_USER_BY_NAME.get(req.params.who_name)
	if (!who)
		return res.status(404).send("User not found.")
	SQL_INSERT_CONTACT.run(req.user.user_id, who.user_id, -1)
	if (req.headers.referer)
		return res.redirect(req.headers.referer)
	else
		return res.redirect("/user/" + who.name)
})

/*
 * MESSAGES
 */

const MESSAGE_LIST_INBOX = SQL(`
	SELECT message_id, from_name, subject, time, is_read
	FROM message_view
	WHERE to_id=? AND is_deleted_from_inbox=0
	ORDER BY message_id DESC`)

const MESSAGE_LIST_OUTBOX = SQL(`
	SELECT message_id, to_name, subject, time, 1 as is_read
	FROM message_view
	WHERE from_id=? AND is_deleted_from_outbox=0
	ORDER BY message_id DESC`)

const MESSAGE_FETCH = SQL("SELECT * FROM message_view WHERE message_id=? AND ( from_id=? OR to_id=? )")
const MESSAGE_SEND = SQL("INSERT INTO messages (from_id,to_id,subject,body) VALUES (?,?,?,?)")
const MESSAGE_MARK_READ = SQL("UPDATE messages SET is_read=1 WHERE message_id=? AND is_read = 0")
const MESSAGE_DELETE_INBOX = SQL("UPDATE messages SET is_deleted_from_inbox=1 WHERE message_id=? AND to_id=?")
const MESSAGE_DELETE_OUTBOX = SQL("UPDATE messages SET is_deleted_from_outbox=1 WHERE message_id=? AND from_id=?")
const MESSAGE_DELETE_ALL_OUTBOX = SQL("UPDATE messages SET is_deleted_from_outbox=1 WHERE from_id=?")

app.get("/message/inbox", must_be_logged_in, function (req, res) {
	let messages = MESSAGE_LIST_INBOX.all(req.user.user_id)
	res.render("message_inbox.pug", { messages })
})

app.get("/message/outbox", must_be_logged_in, function (req, res) {
	let messages = MESSAGE_LIST_OUTBOX.all(req.user.user_id)
	res.render("message_outbox.pug", { messages })
})

app.get("/message/read/:message_id", must_be_logged_in, function (req, res) {
	let message_id = req.params.message_id | 0
	let message = MESSAGE_FETCH.get(message_id, req.user.user_id, req.user.user_id)
	if (!message)
		return res.status(404).send("Invalid message ID.")
	if (message.to_id === req.user.user_id && message.is_read === 0) {
		MESSAGE_MARK_READ.run(message_id)
		req.user.unread --
	}
	message.body = linkify_post(message.body)
	res.render("message_read.pug", { message })
})

app.get("/message/send", must_be_verified, function (req, res) {
	let friends = SQL_SELECT_CONTACT_FRIEND_NAMES.all(req.user.user_id)
	res.render("message_send.pug", { to_name: "", subject: "", body: "", friends })
})

app.get("/message/send/:to_name", must_be_verified, function (req, res) {
	let friends = SQL_SELECT_CONTACT_FRIEND_NAMES.all(req.user.user_id)
	let to_name = req.params.to_name
	res.render("message_send.pug", { to_name: to_name, subject: "", body: "", friends })
})

app.post("/message/send", must_be_verified, function (req, res) {
	let to_name = req.body.to.trim()
	let subject = req.body.subject.trim()
	let body = req.body.body.trim()
	let to_user = SQL_SELECT_USER_BY_NAME.get(to_name)
	if (!to_user) {
		let friends = SQL_SELECT_CONTACT_FRIEND_NAMES.all(req.user.user_id)
		return res.render("message_send.pug", {
			to_id: 0,
			to_name: to_name,
			subject: subject,
			body: body,
			friends,
			flash: "Cannot find that user.",
		})
	}
	let info = MESSAGE_SEND.run(req.user.user_id, to_user.user_id, subject, body)
	send_notification(to_user, message_link(info.lastInsertRowid), "New message from " + req.user.name)
	res.redirect("/message/inbox")
})

function quote_body(message) {
	let when = new Date(epoch_from_time(message.time)).toDateString()
	let who = message.from_name
	let what = message.body.split("\n").join("\n> ")
	return "\n\n" + "On " + when + " " + who + " wrote:\n> " + what + "\n"
}

app.get("/message/reply/:message_id", must_be_verified, function (req, res) {
	let message_id = req.params.message_id | 0
	let message = MESSAGE_FETCH.get(message_id, req.user.user_id, req.user.user_id)
	if (!message)
		return res.status(404).send("Invalid message ID.")
	let friends = SQL_SELECT_CONTACT_FRIEND_NAMES.all(req.user.user_id)
	return res.render("message_send.pug", {
		to_id: message.from_id,
		to_name: message.from_name,
		subject: message.subject.startsWith("Re: ") ? message.subject : "Re: " + message.subject,
		body: quote_body(message),
		friends,
	})
})

app.get("/message/delete/outbox", must_be_logged_in, function (req, res) {
	MESSAGE_DELETE_ALL_OUTBOX.run(req.user.user_id)
	res.redirect("/message/outbox")
})

app.get("/message/delete/:message_id", must_be_logged_in, function (req, res) {
	let message_id = req.params.message_id | 0
	MESSAGE_DELETE_INBOX.run(message_id, req.user.user_id)
	MESSAGE_DELETE_OUTBOX.run(message_id, req.user.user_id)
	res.redirect("/message/inbox")
})

/*
 * FORUM
 */

const FORUM_PAGE_SIZE = 15

const FORUM_COUNT_THREADS = SQL("SELECT COUNT(*) FROM threads").pluck()
const FORUM_LIST_THREADS_USER = SQL("SELECT *, (exists (select 1 from read_threads where user_id=? and read_threads.thread_id=thread_view.thread_id)) as is_read FROM thread_view ORDER BY mtime DESC LIMIT ? OFFSET ?")
const FORUM_LIST_THREADS = SQL("SELECT *, 1 as is_read FROM thread_view ORDER BY mtime DESC LIMIT ? OFFSET ?")
const FORUM_GET_THREAD = SQL("SELECT * FROM thread_view WHERE thread_id=?")
const FORUM_LIST_POSTS = SQL("SELECT * FROM post_view WHERE thread_id=?")
const FORUM_GET_FIRST_POST = SQL("SELECT * FROM post_view WHERE thread_id=? LIMIT 1")
const FORUM_GET_POST = SQL("SELECT * FROM post_view WHERE post_id=?")
const FORUM_NEW_THREAD = SQL("INSERT INTO threads (author_id,subject) VALUES (?,?)")
const FORUM_NEW_POST = SQL("INSERT INTO posts (thread_id,author_id,body,in_reply_to) VALUES (?,?,?,?)")
const FORUM_EDIT_POST = SQL("UPDATE posts SET body=?, mtime=datetime() WHERE post_id=? AND author_id=? RETURNING thread_id").pluck()
const FORUM_MARK_READ = SQL("insert or ignore into read_threads (user_id,thread_id) values (?,?)")

const FORUM_DELETE_THREAD = SQL("delete from threads where thread_id=?")
const FORUM_DELETE_POST = SQL("delete from posts where post_id=? returning thread_id").pluck()

const FORUM_LOCK_THREAD = SQL("update threads set is_locked=true where thread_id=?")
const FORUM_HIDE_THREAD = SQL("update threads set is_locked=true, is_hidden=true where thread_id=?")
const FORUM_HIDE_POST = SQL("update posts set is_hidden=true where post_id=? returning thread_id").pluck()

const FORUM_SEARCH = SQL(`
	select
		forum_search.thread_id,
		forum_search.post_id,
		threads.subject,
		coalesce(pusers.name, tusers.name) as author,
		snippet(forum_search, -1, '', '', '...', 18) as snippet
	from
		forum_search
		join threads on threads.thread_id = forum_search.thread_id
		left join posts on posts.post_id = forum_search.post_id
		left join users as pusers on pusers.user_id = posts.author_id
		left join users as tusers on tusers.user_id = threads.author_id
	where
		forum_search match ?
	order by
		forum_search.thread_id desc,
		forum_search.post_id desc
`)

function show_forum_page(req, res, page) {
	let thread_count = FORUM_COUNT_THREADS.get()
	let page_count = Math.ceil(thread_count / FORUM_PAGE_SIZE)
	let threads
	if (req.user)
		threads = FORUM_LIST_THREADS_USER.all(req.user.user_id, FORUM_PAGE_SIZE, FORUM_PAGE_SIZE * (page - 1))
	else
		threads = FORUM_LIST_THREADS.all(FORUM_PAGE_SIZE, FORUM_PAGE_SIZE * (page - 1))
	res.render("forum_view.pug", {
		threads: threads,
		current_page: page,
		page_count: page_count,
	})
}

function linkify_post(text) {
	text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
	text = text.replace(/https?:\/\/\S+/g, (match) => {
		if (match.endsWith(".jpg") || match.endsWith(".png") || match.endsWith(".svg"))
			return `<a href="${match}"><img src="${match}"></a>`
		return `<a href="${match}">${match}</a>`
	})
	return text
}

app.get("/forum", function (req, res) {
	show_forum_page(req, res, 1)
})

app.get("/forum/page/:page", function (req, res) {
	show_forum_page(req, res, req.params.page | 0)
})

app.get("/forum/thread/:thread_id", function (req, res) {
	let thread_id = req.params.thread_id | 0
	let thread = FORUM_GET_THREAD.get(thread_id)
	let posts = FORUM_LIST_POSTS.all(thread_id)
	if (!thread)
		return res.status(404).send("Invalid thread ID.")
	for (let i = 0; i < posts.length; ++i) {
		posts[i].body = linkify_post(posts[i].body)
		posts[i].edited = posts[i].mtime !== posts[i].ctime
	}
	if (req.user)
		FORUM_MARK_READ.run(req.user.user_id, thread_id)
	res.render("forum_thread.pug", {
		thread: thread,
		posts: posts,
	})
})

app.get("/forum/lock-thread/:thread_id", must_be_moderator, function (req, res) {
	let thread_id = req.params.thread_id
	FORUM_LOCK_THREAD.run(thread_id)
	res.redirect("/forum/thread/" + thread_id)
})

app.get("/forum/hide-thread/:thread_id", must_be_moderator, function (req, res) {
	let thread_id = req.params.thread_id
	FORUM_HIDE_THREAD.run(thread_id)
	res.redirect("/forum/thread/" + thread_id)
})

app.get("/forum/hide-post/:post_id", must_be_moderator, function (req, res) {
	let post_id = req.params.post_id
	let thread_id = FORUM_HIDE_POST.get(post_id)
	res.redirect("/forum/thread/" + thread_id)
})

app.get("/forum/delete-thread/:thread_id", must_be_administrator, function (req, res) {
	let thread_id = req.params.thread_id
	FORUM_DELETE_THREAD.run(thread_id)
	res.redirect("/forum")
})

app.get("/forum/delete-post/:post_id", must_be_administrator, function (req, res) {
	let post_id = req.params.post_id
	let thread_id = FORUM_DELETE_POST.get(post_id)
	res.redirect("/forum/thread/" + thread_id)
})

app.get("/forum/post", must_be_verified, function (req, res) {
	res.render("forum_post.pug")
})

app.post("/forum/post", must_be_verified, function (req, res) {
	let user_id = req.user.user_id
	let subject = req.body.subject.trim()
	let body = req.body.body
	if (subject.length === 0)
		subject = "Untitled"
	let thread_id = FORUM_NEW_THREAD.run(user_id, subject).lastInsertRowid
	FORUM_NEW_POST.run(thread_id, user_id, body, 0)
	res.redirect("/forum/thread/" + thread_id)
})

app.get("/forum/edit/:post_id", must_be_verified, function (req, res) {
	// TODO: edit subject if editing first post
	let post_id = req.params.post_id | 0
	let post = FORUM_GET_POST.get(post_id)
	if (!post || post.author_id !== req.user.user_id)
		return res.status(404).send("Invalid post ID.")
	res.render("forum_edit.pug", { post })
})

app.post("/forum/edit/:post_id", must_be_verified, function (req, res) {
	let user_id = req.user.user_id
	let post_id = req.params.post_id | 0
	let body = req.body.body
	let thread_id = FORUM_EDIT_POST.get(body, post_id, user_id)
	res.redirect("/forum/thread/" + thread_id)
})

app.get("/forum/reply/:post_id", must_be_verified, function (req, res) {
	let post_id = req.params.post_id | 0
	let post = FORUM_GET_POST.get(post_id)
	if (!post)
		return res.status(404).send("Invalid post ID.")
	let thread = FORUM_GET_THREAD.get(post.thread_id)
	let first = FORUM_GET_FIRST_POST.get(post.thread_id)
	post.body = linkify_post(post.body)
	post.edited = post.mtime !== post.ctime
	res.render("forum_reply.pug", { thread, first, post })
})

app.post("/forum/reply/:thread_id", must_be_verified, function (req, res) {
	let thread_id = req.params.thread_id | 0
	let in_reply_to = req.body.in_reply_to | 0
	let user_id = req.user.user_id
	let body = req.body.body
	FORUM_NEW_POST.run(thread_id, user_id, body, in_reply_to)
	res.redirect("/forum/thread/" + thread_id)
})

app.get("/forum/search", must_be_logged_in, function (req, res) {
	let search = req.query.q
	let results = []
	if (search) {
		try {
			results = FORUM_SEARCH.all(search)
		} catch (_error) {
			results = FORUM_SEARCH.all('"' + search.replaceAll('"', '""') + '"')
		}
	}
	res.render("forum_search.pug", { search, results })
})

/*
 * GAME LOBBY
 */

let RULES = app.locals.RULES = {}
let TITLE_TABLE = app.locals.TITLE_TABLE = {}
let TITLE_LIST = app.locals.TITLE_LIST = []
let TITLE_NAME = app.locals.TITLE_NAME = {}

const STATUS_OPEN = 0
const STATUS_ACTIVE = 1
const STATUS_FINISHED = 2
const STATUS_ARCHIVED = 3

const PARSE_OPTIONS_CACHE = {}

const HUMAN_OPTIONS_CACHE = {
	"{}": "None"
}

function parse_game_options(options_json) {
	if (options_json in PARSE_OPTIONS_CACHE)
		return PARSE_OPTIONS_CACHE[options_json]
	return PARSE_OPTIONS_CACHE[options_json] = Object.freeze(JSON.parse(options_json))
}

function option_to_english(k) {
	if (k === true || k === 1)
		return "yes"
	if (k === false)
		return "no"
	if (typeof k === "string")
		return k.replace(/_/g, " ")
	return k
}

function format_options(options_json) {
	if (options_json in HUMAN_OPTIONS_CACHE)
		return HUMAN_OPTIONS_CACHE[options_json]
	let options = parse_game_options(options_json)
	let text = Object.entries(options)
		.map(([ k, v ]) => {
			if (k === "players")
				return v + " Player"
			if (v === true || v === 1)
				return option_to_english(k)
			return option_to_english(k) + "=" + option_to_english(v)
		})
		.join(", ")
	return (HUMAN_OPTIONS_CACHE[options_json] = text)
}

function get_game_roles(title_id, scenario, options) {
	let roles = RULES[title_id].roles
	if (typeof roles === "function") {
		if (typeof options === "string")
			options = parse_game_options(options)
		return roles(scenario, options)
	}
	return roles
}

function get_game_static_view(title_id, state) {
	let static_view = RULES[title_id].static_view
	if (typeof static_view === "function")
		return static_view(state)
	return null
}

function unload_module(filename) {
	// Remove a module and its dependencies from require.cache so they can be reloaded.
	filename = require.resolve(filename)
	let mod = require.cache[filename]
	if (mod) {
		delete require.cache[filename]
		for (let child of mod.children)
			unload_module(child.filename)
	}
}

function load_rules(rules_dir, rules_file, title) {
	title.about_html = fs.readFileSync(rules_dir + "/about.html")
	title.create_html = fs.readFileSync(rules_dir + "/create.html")
	try {
		RULES[title.title_id] = require(rules_file)
	} catch (error) {
		console.error(error)
		RULES[title.title_id] = {
			roles: RULES[title.title_id]?.roles ?? [ "ERROR" ],
			scenarios: RULES[title.title_id]?.scenarios ?? [ "ERROR" ],
			view() {
				throw error
			}
		}
	}
}

function watch_rules(rules_dir, rules_file, title) {
	let watch_list = [ rules_file ]

	let mod = require.cache[rules_file]
	if (mod) {
		for (let child of mod.children)
			watch_list.push(child.filename)
	}

	function reload_rules() {
		try {
			console.log("*** RELOAD", title.title_id, "***")
			unload_module(rules_file)
			load_rules(rules_dir, rules_file, title)
			sync_client_state_for_title(title.title_id)
		} catch (error) {
			console.log(error)
		}
	}

	// TODO: figure out why chokidar is unreliable on production server
	// chokidar.watch(watch_list, { ignoreInitial: true, awaitWriteFinish: true }).on("all", reload_rules)
	for (let file of watch_list)
		fs.watchFile(file, reload_rules)
}

function load_titles() {
	const SQL_SELECT_TITLES = SQL("select * from titles")
	for (let title of SQL_SELECT_TITLES.all()) {
		let title_id = title.title_id
		let rules_dir = __dirname + "/public/" + title_id
		let rules_file = rules_dir + "/rules.js"

		TITLE_LIST.push(title)
		TITLE_TABLE[title_id] = title
		TITLE_NAME[title_id] = title.title_name

		try {
			if (fs.existsSync(rules_file)) {
				console.log("Loading rules for " + title_id)
				load_rules(rules_dir, rules_file, title)
			} else {
				console.log("Cannot find rules for " + title_id)
			}
		} catch (error) {
			console.log(error)
		}

		watch_rules(rules_dir, rules_file, title)
	}
}

load_titles()

const SQL_INSERT_GAME = SQL(`
	insert into games (owner_id,title_id,scenario,options,player_count,is_private,is_random,notice)
	values (?,?,?,?,?,?,?,?)
	returning game_id
`).pluck()

const SQL_INSERT_GAME_MATCH = SQL(`
	insert into games (owner_id,title_id,scenario,options,player_count,is_private,is_random,notice,is_match,ctime,xtime)
	values (?,?,?,?,?,?,?,?, 1, datetime(?), datetime(?))
	returning game_id
`).pluck()

const SQL_DELETE_GAME_BY_OWNER = SQL("delete from games where game_id=? and owner_id=?")
const SQL_DELETE_GAME = SQL("delete from games where game_id=?")

const SQL_START_GAME = SQL(`
	update games set
		status = 1,
		is_private = (is_private or user_count = 1 or user_count < player_count),
		ctime = datetime(),
		mtime = datetime(),
		active = ?
	where
		game_id = ?
`)

const SQL_FINISH_GAME = SQL(`
	update games set
		status = 2,
		mtime = datetime(),
		active = null,
		moves = moves + ?,
		result = ?,
		did_resign = ?,
		did_timeout = ?
	where
		game_id = ?
`)

const SQL_REWIND_GAME_TIMEOUT = SQL("delete from user_timeout where game_id=?")
const SQL_REWIND_GAME_CLOCK = SQL("update players set active_time=julianday() where game_id=?")
const SQL_REWIND_GAME = SQL("update games set status=1,did_timeout=0,did_resign=0,result=null,moves=?,active=?,mtime=datetime() where game_id=?")
const SQL_SELECT_REWIND = SQL("select snap_id, state->>'$.active' as active, coalesce(state->>'$.state', state->>'$.L.P', '-') as state from game_snap where game_id=? order by snap_id desc")

const SQL_UPDATE_GAME_ACTIVE = SQL("update games set active=?, mtime=datetime(), moves=moves+1 where game_id=?")
const SQL_UPDATE_GAME_SCENARIO = SQL("update games set scenario=? where game_id=?")

const ARCHIVE_SELECT_GAME_STATE = ENABLE_ARCHIVE ? SQL("select state from archive.game_state where game_id=?").pluck() : null

const SQL_SELECT_GAME_STATE = SQL("select state from game_state where game_id=?").pluck()
const SQL_INSERT_GAME_STATE = SQL("insert or replace into game_state (game_id,state) values (?,?)")

const SQL_SELECT_UNREAD_CHAT_GAMES = SQL("select game_id from unread_chats where user_id = ?").pluck()
const SQL_SELECT_UNREAD_CHAT = SQL("select exists (select 1 from unread_chats where user_id = ? and game_id = ?)").pluck()
const SQL_INSERT_UNREAD_CHAT = SQL("insert or ignore into unread_chats (user_id,game_id) values (?,?)")
const SQL_DELETE_UNREAD_CHAT = SQL("delete from unread_chats where user_id = ? and game_id = ?")

const SQL_SELECT_MODERATOR_CHAT = SQL("select exists (select 1 from game_chat where game_id = ?)").pluck()

const SQL_SELECT_UNSEEN_GAME_LIST = SQL("select game_id from unseen_games where user_id = ?").pluck()
const SQL_INSERT_UNSEEN_GAME = SQL("insert or ignore into unseen_games (user_id,game_id) values (?,?)")
const SQL_DELETE_UNSEEN_GAME = SQL("delete from unseen_games where user_id = ? and game_id = ?")

const SQL_SELECT_GAME_CHAT = SQL("SELECT chat_id,unixepoch(time),name,message FROM game_chat_view WHERE game_id=? AND chat_id>?").raw()
const SQL_INSERT_GAME_CHAT = SQL("INSERT INTO game_chat (game_id,chat_id,user_id,message) VALUES (?, (select coalesce(max(chat_id), 0) + 1 from game_chat where game_id=?), ?,?)")

const SQL_SELECT_GAME_NOTE = SQL("SELECT note FROM game_notes WHERE game_id=? AND role=?").pluck()
const SQL_UPDATE_GAME_NOTE = SQL("INSERT OR REPLACE INTO game_notes (game_id,role,note) VALUES (?,?,?)")
const SQL_DELETE_GAME_NOTE = SQL("DELETE FROM game_notes WHERE game_id=? AND role=?")

const SQL_INSERT_REPLAY = SQL("insert into game_replay (game_id,replay_id,role,action,arguments) values (?, (select coalesce(max(replay_id), 0) + 1 from game_replay where game_id=?) ,?,?,?) returning replay_id").pluck()

const SQL_INSERT_SNAP = SQL("insert into game_snap (game_id,snap_id,replay_id,state,log_length,log_hash) values (?, (select coalesce(max(snap_id), 0) + 1 from game_snap where game_id=?), ?, ?, ?, ?) returning snap_id").pluck()
const SQL_SELECT_SNAP = SQL("select * from game_snap where game_id = ? and snap_id = ?")
const SQL_SELECT_SNAP_STATE = SQL("select state from game_snap where game_id = ? and snap_id = ?").pluck()
const SQL_SELECT_SNAP_COUNT = SQL("select max(snap_id) as snap_id from game_snap where game_id=?").pluck()
const SQL_SELECT_SNAP_LOG_HASH = SQL("select exists ( select 1 from game_snap where game_id=? and snap_id=? and log_length=? and log_hash=? )").pluck()

const SQL_DELETE_GAME_SNAP_ROLLBACK = SQL("delete from game_snap where game_id=? and log_length > ? returning snap_id").pluck()
const SQL_DELETE_GAME_SNAP = SQL("delete from game_snap where game_id=? and snap_id > ?")
const SQL_DELETE_GAME_REPLAY = SQL("delete from game_replay where game_id=? and replay_id > ?")

const ARCHIVE_SELECT_EXPORT = ENABLE_ARCHIVE ? SQL("select export from archive.game_export_view where game_id = ?").pluck() : null
const SQL_SELECT_EXPORT = SQL("select export from game_export_view where game_id=?").pluck()
const SQL_SELECT_REPLAY = SQL("select export from game_replay_view where game_id = ?").pluck()

const SQL_SELECT_GAME = SQL("SELECT * FROM games WHERE game_id=?")
const SQL_SELECT_GAME_VIEW = SQL("SELECT * FROM game_view WHERE game_id=?")
const SQL_SELECT_GAME_TITLE = SQL("SELECT title_id FROM games WHERE game_id=?").pluck()

const SQL_SELECT_PLAYERS = SQL("select * from players join user_view using(user_id) where game_id=?")
const SQL_SELECT_PLAYERS_WITH_NAME = SQL("select role, user_id, name from players join users using(user_id) where game_id=?")
const SQL_UPDATE_PLAYER_ACCEPT = SQL("UPDATE players SET is_invite=0 WHERE game_id=? AND role=? AND user_id=?")
const SQL_UPDATE_PLAYER_ROLE = SQL("UPDATE players SET role=? WHERE game_id=? AND role=?")
const SQL_SELECT_PLAYER_NAME = SQL("SELECT name FROM players JOIN users using(user_id) WHERE game_id=? AND role=?").pluck()
const SQL_INSERT_PLAYER_ROLE = SQL("INSERT OR IGNORE INTO players (game_id,role,user_id,is_invite) VALUES (?,?,?,?)")
const SQL_DELETE_PLAYER_ROLE = SQL("DELETE FROM players WHERE game_id=? AND role=?")

const SQL_SELECT_ROLES = SQL("select role from players where game_id=?").pluck()
const SQL_UPDATE_SCORE = SQL("update players set score=? where game_id=? and role=?")

const SQL_SELECT_PLAYER_VIEW = SQL("select * from player_view where game_id = ?")

// owned and unstarted games count towards the limit
const SQL_COUNT_OPEN_GAMES = SQL(`
	select count(*) from games where owner_id=? and status=0
`).pluck()

// active public games count towards limit
const SQL_COUNT_ACTIVE_GAMES = SQL(`
	select count(*) from games
	where not is_private and status < 2 and exists (
		select 1 from players where players.user_id=? and players.game_id=games.game_id
	)
`).pluck()

// finished opposed games increase your limit
const SQL_COUNT_FINISHED_GAMES = SQL(`
	select count(*) from games
	where is_opposed and status > 1 and exists (
		select 1 from players where players.user_id=? and players.game_id=games.game_id
	)
`).pluck()

const SQL_SELECT_REMATCH = SQL(`SELECT game_id FROM games WHERE status < ${STATUS_FINISHED} AND notice=?`).pluck()
const SQL_INSERT_REMATCH = SQL(`
	insert or ignore into games
		(owner_id, title_id, scenario, options, player_count, is_private, is_random, notice)
	select
		$owner_id, title_id, scenario, options, player_count, 1, $random, $magic
	from
		games
	where
		game_id = $old_game_id
		and not exists (
			select 1 from games where notice = $magic
		)
	returning
		game_id
`).pluck()

const QUERY_LIST_PUBLIC_GAMES_OPEN = SQL(`
	select * from game_view_public where status = 0 and join_count < player_count
	and not exists (
		select 1 from players
		join contacts on contacts.me=players.user_id
		where players.game_id=game_view_public.game_id and you=? and relation < 0
	)
	order by game_id desc
	`)

const QUERY_LIST_PUBLIC_GAMES_REPLACEMENT = SQL(`
	select * from game_view_public where status = 1 and join_count < player_count
	and not exists (
		select 1 from players
		join contacts on contacts.me=players.user_id
		where players.game_id=game_view_public.game_id and you=? and relation < 0
	)
	order by game_id desc
	`)

const QUERY_LIST_GAMES_OF_TITLE_OPEN = SQL(`
	select * from game_view_public where title_id=? and status = 0 and join_count < player_count
	and not exists ( select 1 from contacts where me = owner_id and you = ? and relation < 0 )
	order by game_id desc
	`)

const QUERY_LIST_GAMES_OF_TITLE_REPLACEMENT = SQL(`
	select * from game_view_public where title_id=? and status = 1 and join_count < player_count
	and not exists ( select 1 from contacts where me = owner_id and you = ? and relation < 0 )
	order by game_id desc
	`)

const QUERY_LIST_GAMES_OF_TITLE_ACTIVE = SQL(`
	select * from game_view_public where title_id=? and status = 1 and join_count = player_count
	order by mtime desc
	limit 12
	`)

const QUERY_LIST_GAMES_OF_TITLE_FINISHED = SQL(`
	select * from game_view_public where title_id=? and status = 2
	order by mtime desc
	limit 12
	`)

const QUERY_NEXT_GAME_OF_USER_1 = SQL(`
	select title_id, game_id, role
	from games
	join players using(game_id)
	where
		status = ${STATUS_ACTIVE}
		-- and active in (role, 'Both')
		and ( active = 'Both' or instr(active, role) > 0 )
		and user_id = ?
		and is_opposed
	order by mtime
	limit 1
	`)

const QUERY_NEXT_GAME_OF_USER_2 = SQL(`
	select title_id, game_id, role
	from unseen_games
	join players using(user_id, game_id)
	join games using(game_id)
	where user_id = ?
	limit 1
	`)

const QUERY_NEXT_GAME_OF_USER_3 = SQL(`
	select title_id, game_id, role
	from unread_chats
	join players using(user_id, game_id)
	join games using(game_id)
	where user_id = ?
	limit 1
	`)

const QUERY_LIST_PUBLIC_GAMES_OF_USER = SQL(`
	select * from game_view
	where
		( owner_id=$user_id or game_id in ( select game_id from players where players.user_id=$user_id ) )
		and
		( status <= ${STATUS_FINISHED} )
		and
		( not is_private or status >= ${STATUS_ACTIVE} )
	order by status asc, mtime desc
	`)

const QUERY_LIST_ACTIVE_GAMES_OF_USER = SQL(`
	select * from game_view
	where
		( owner_id=$user_id or game_id in ( select game_id from players where players.user_id=$user_id ) )
		and
		( status <= ${STATUS_FINISHED} )
	order by game_id desc
	`)

const QUERY_LIST_FINISHED_GAMES_OF_USER = SQL(`
	select * from game_view
	where
		( owner_id=$user_id or game_id in ( select game_id from players where players.user_id=$user_id ) )
		and
		( status = ${STATUS_FINISHED} or status = ${STATUS_ARCHIVED} )
	order by status asc, mtime desc
	`)

function get_user_join_limit(user) {
	var finished = SQL_COUNT_FINISHED_GAMES.get(user.user_id)
	return Math.max(LIMIT_ACTIVE_GAMES_MIN, Math.min(LIMIT_ACTIVE_GAMES_MAX, finished))
}

function get_user_join_count(user) {
	var active = SQL_COUNT_ACTIVE_GAMES.get(user.user_id)
	// only count queued tournament games as 1/2 of actual number
	var queued = TM_COUNT_QUEUE_GAMES.get(user.user_id) >> 1
	return active + queued
}

function check_create_game_limit(user, n) {
	if (user.is_tournament)
		return null
	if (user.waiting_games >= LIMIT_WAITING_GAMES)
		return "You must attend to the games waiting for you before you can create another!"
	if (SQL_COUNT_OPEN_GAMES.get(user.user_id) + n > LIMIT_OPEN_GAMES)
		return "You have too many open games to create another one!"
	return null
}

function check_join_game_limit(user, n) {
	if (user.waiting_games >= LIMIT_WAITING_GAMES)
		return "You must attend to the games waiting for you before you can join another!"
	var count = get_user_join_count(user)
	var limit = get_user_join_limit(user)
	console.log("check_join_game_limit", user.name, count, n, limit)
	if (count + n > limit)
		return "You are at the limit of how many public games you may play!"
	return null
}

function annotate_game_info(game, user_id, unread, unseen) {
	game.human_options = format_options(game.options)

	game.is_unread = set_has(unread, game.game_id)
	game.is_unseen = set_has(unseen, game.game_id)

	let your_count = 0
	let your_role = null

	let roles = get_game_roles(game.title_id, game.scenario, game.options)

	game.players = SQL_SELECT_PLAYER_VIEW.all(game.game_id)
	for (let p of game.players)
		p.index = roles.indexOf(p.role)
	game.players.sort((a, b) => a.index - b.index)

	game.player_names = ""
	for (let p of game.players) {
		if (p.user_id === user_id) {
			your_role = p.role
			your_count++
			if (p.is_active && game.is_ready && game.status < 2)
				game.your_turn = true
			if (p.is_invite)
				game.your_turn = true
		}

		let link
		if (!p.name)
			link = "null"
		else if (p.is_invite)
			link = `<a class="is_invite" href="/user/${p.name}">${p.name}?</a>`
		else if (p.is_active)
			link = `<a class="is_active" href="/user/${p.name}">${p.name}</a>`
		else
			link = `<a href="/user/${p.name}">${p.name}</a>`

		if (game.player_names)
			game.player_names += ", " + link
		else
			game.player_names = link

		if (game.result === p.role)
			game.result = `<a href="/user/${p.name}">${p.name}</a> (${game.result})`
	}

	if (game.result && game.result.includes(",")) {
		game.result = game.result.split(", ").map(role => {
			for (let p of game.players)
				if (p.role === role)
					return `<a href="/user/${p.name}">${p.name}</a>`
			return role
		}).join(", ")
	}

	if (game.is_match)
		game.seed = TM_SELECT_SEED_BY_GAME.get(game.game_id)

	if (your_count > 0) {
		game.is_yours = true
		if (your_count === 1)
			game.your_role = your_role
	}
}

function annotate_games(list, user_id, unread, unseen) {
	for (let game of list)
		annotate_game_info(game, user_id, unread, unseen)
	return list
}

app.get("/create", must_be_logged_in, function (req, res) {
	res.render("create_index.pug")
})

app.get("/games", must_be_logged_in, function (_req, res) {
	res.redirect("/games/public")
})

app.get("/games/next", must_be_logged_in, function (req, res) {
	var next = QUERY_NEXT_GAME_OF_USER_1.get(req.user.user_id)
	if (!next) next = QUERY_NEXT_GAME_OF_USER_2.get(req.user.user_id)
	if (!next) next = QUERY_NEXT_GAME_OF_USER_3.get(req.user.user_id)
	if (next)
		res.redirect(play_url(next.title_id, next.game_id, next.role))
	else
		res.redirect(`/games/active`)
})

app.get("/games/active", must_be_logged_in, function (req, res) {
	let user_id = req.user.user_id
	let games = QUERY_LIST_ACTIVE_GAMES_OF_USER.all({ user_id })
	let unread = SQL_SELECT_UNREAD_CHAT_GAMES.all(user_id)
	let unseen = SQL_SELECT_UNSEEN_GAME_LIST.all(user_id)
	annotate_games(games, user_id, unread, unseen)

	let queues = TM_SELECT_QUEUES.all(user_id)
	let active_pools = TM_POOL_LIST_USER_ACTIVE.all(user_id)
	let finished_pools = TM_POOL_LIST_USER_RECENT_FINISHED.all(user_id)

	res.render("games_active.pug", { who: req.user, games, queues, active_pools, finished_pools })
})

app.get("/games/finished", must_be_logged_in, function (req, res) {
	let games = QUERY_LIST_FINISHED_GAMES_OF_USER.all({ user_id: req.user.user_id })
	let unread = SQL_SELECT_UNREAD_CHAT_GAMES.all(req.user.user_id)
	let unseen = SQL_SELECT_UNSEEN_GAME_LIST.all(req.user.user_id)
	annotate_games(games, req.user.user_id, unread, unseen)
	res.render("games_finished.pug", { who: req.user, games })
})

app.get("/tm/finished", must_be_logged_in, function (req, res) {
	let pools = TM_POOL_LIST_USER_ALL_FINISHED.all(req.user.user_id)
	res.render("tm_finished.pug", { who: req.user, pools })
})

app.get("/games/finished/:who_name", must_be_logged_in, function (req, res) {
	let who = SQL_SELECT_USER_BY_NAME.get(req.params.who_name)
	if (who) {
		let games = QUERY_LIST_FINISHED_GAMES_OF_USER.all({ user_id: who.user_id })
		annotate_games(games, 0, null, null)
		res.render("games_finished.pug", { who, games })
	} else {
		return res.status(404).send("Invalid user name.")
	}
})

app.get("/tm/finished/:who_name", must_be_logged_in, function (req, res) {
	let who = SQL_SELECT_USER_BY_NAME.get(req.params.who_name)
	if (who) {
		let pools = TM_POOL_LIST_USER_ALL_FINISHED.all(who.user_id)
		res.render("tm_finished.pug", { who, pools })
	} else {
		return res.status(404).send("Invalid user name.")
	}
})

app.get("/games/public", must_be_logged_in, function (req, res) {
	let user_id = 0
	let unread = null
	if (req.user) {
		user_id = req.user.user_id
		unread = SQL_SELECT_UNREAD_CHAT_GAMES.all(req.user.user_id)
	}

	let open_games = QUERY_LIST_PUBLIC_GAMES_OPEN.all(user_id)
	let replacement_games = QUERY_LIST_PUBLIC_GAMES_REPLACEMENT.all(user_id)

	annotate_games(open_games, user_id, unread, null)
	annotate_games(replacement_games, user_id, unread, null)

	var seeds = TM_SELECT_SEEDS_BY_USER.all({user_id: req.user.user_id})

	res.render("games_public.pug", {
		open_games,
		replacement_games,
		seeds
	})
})

function get_title_page(req, res, title_id) {
	let title = TITLE_TABLE[title_id]
	if (!title)
		return res.status(404).send("Invalid title.")
	let user_id = 0
	let unread = null
	let unseen = null
	if (req.user) {
		user_id = req.user.user_id
		unread = SQL_SELECT_UNREAD_CHAT_GAMES.all(req.user.user_id)
		unseen = SQL_SELECT_UNSEEN_GAME_LIST.all(req.user.user_id)
	}

	let open_games = QUERY_LIST_GAMES_OF_TITLE_OPEN.all(title_id, user_id)
	let replacement_games = QUERY_LIST_GAMES_OF_TITLE_REPLACEMENT.all(title_id, user_id)
	let active_games = QUERY_LIST_GAMES_OF_TITLE_ACTIVE.all(title_id)
	let finished_games = QUERY_LIST_GAMES_OF_TITLE_FINISHED.all(title_id)

	annotate_games(open_games, user_id, unread, null)
	annotate_games(replacement_games, user_id, unread, null)
	annotate_games(active_games, user_id, unread, null)
	annotate_games(finished_games, user_id, unread, unseen)

	let seeds = TM_SELECT_SEEDS_BY_TITLE.all({user_id, title_id})
	let pools = TM_POOL_LIST_TITLE_ACTIVE.all(title_id)

	res.render("title.pug", {
		title,
		open_games,
		replacement_games,
		active_games,
		finished_games,
		seeds,
		pools,
	})
}

for (let title of TITLE_LIST)
	app.get("/" + title.title_id, (req, res) => get_title_page(req, res, title.title_id))

app.get("/create/:title_id", must_be_logged_in, function (req, res) {
	let title_id = req.params.title_id
	let title = TITLE_TABLE[title_id]
	if (!title)
		return res.status(404).send("Invalid title.")
	res.render("create_title.pug", {
		title,
		join_limit: check_join_game_limit(req.user, 1),
		create_limit: check_create_game_limit(req.user, 1),
		rules: RULES[title_id],
	})
})

function options_json_replacer(key, value) {
	if (key === "scenario") return undefined
	if (key === "notice") return undefined
	if (key === "is_random") return undefined
	if (key === "is_private") return undefined
	if (value === "on") return true
	if (value === "true") return true
	if (value === "false") return false
	if (value === "")
		return undefined
	if (typeof value === "string" && String(parseInt(value)) === value)
		return parseInt(value)
	return value
}

function is_random_scenario(title_id, scenario) {
	if (RULES[title_id].is_random_scenario)
		return RULES[title_id].is_random_scenario(scenario)
	return false
}

function select_random_scenario(title_id, scenario, seed) {
	if (RULES[title_id].select_random_scenario)
		return RULES[title_id].select_random_scenario(scenario, seed)
	return scenario
}

app.post("/create/:title_id", must_be_logged_in, function (req, res) {
	let title_id = req.params.title_id
	let priv = req.body.is_private === "true" ? 1 : 0
	let rand = req.body.is_random === "true" ? 1 : 0
	let user_id = req.user.user_id
	let scenario = req.body.scenario
	let options = JSON.stringify(req.body, options_json_replacer)
	let notice = req.body.notice

	let limit = check_create_game_limit(req.user, priv ? 0 : 1)
	if (limit)
		return res.send(limit)

	if (!(title_id in RULES))
		return res.send("Invalid title.")

	if (is_random_scenario(title_id, scenario))
		rand = 1

	let player_count = get_game_roles(title_id, scenario, options).length

	let game_id = SQL_INSERT_GAME.get(user_id, title_id, scenario, options, player_count, priv, rand, notice)
	res.redirect("/join/" + game_id)
})

app.post("/api/delete/:game_id", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id
	let info = SQL_DELETE_GAME_BY_OWNER.run(game_id, req.user.user_id)
	if (info.changes === 0)
		return res.send("Not authorized to delete that game ID.")
	res.send("SUCCESS")
})

function insert_rematch_players(old_game_id, new_game_id, req_user_id, order) {
	let game = SQL_SELECT_GAME.get(old_game_id)
	let players = SQL_SELECT_PLAYERS.all(old_game_id)
	let roles = get_game_roles(game.title_id, game.scenario, game.options)
	let n = roles.length

	if (players.length !== n)
		throw new Error("missing players")

	switch (order) {
	default:
	case "swap":
		players.sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role))
		for (let i = 0; i < n; ++i)
			players[i].role = roles[(i + 1) % n]
		break
	case "keep":
		// do nothing
		break
	case "shuffle":
		// unused for now - random but known
		shuffle(players)
		for (let i = 0; i < n; ++i)
			players[i].role = roles[i]
		break
	case "random":
		for (let i = 0; i < n; ++i)
			players[i].role = RANDOM_ROLES[i]
		break
	}

	for (let p of players) {
		if (SQL_SELECT_RELATION.get(p.user_id, req_user_id) < 0)
			throw new Error("could not create rematch")
		if (SQL_SELECT_RELATION.get(req_user_id, p.user_id) < 0)
			throw new Error("could not create rematch")
	}

	for (let p of players) {
		SQL_INSERT_PLAYER_ROLE.run(new_game_id, p.role, p.user_id, p.user_id !== req_user_id ? 1 : 0)
	}
}

app.get("/rematch/:old_game_id", must_be_logged_in, function (req, res) {
	let old_game_id = req.params.old_game_id | 0

	let pool_name = TM_FIND_POOL_NAME.get(old_game_id)
	if (pool_name)
		return res.redirect("/tm/pool/" + pool_name)

	let magic = "\u{1F503}\ufe0e " + old_game_id
	let new_game_id = SQL_SELECT_REMATCH.get(magic)
	if (new_game_id)
		return res.redirect("/join/" + new_game_id)

	let game = SQL_SELECT_GAME.get(old_game_id)
	let players = SQL_SELECT_PLAYERS_WITH_NAME.all(old_game_id)
	res.render("rematch.pug", {
		title: TITLE_TABLE[game.title_id],
		game,
		players,
	})
})

app.post("/rematch/:old_game_id", must_be_logged_in, function (req, res) {
	let old_game_id = req.params.old_game_id | 0
	let magic = "\u{1F503}\ufe0e " + old_game_id
	let new_game_id = 0
	let order = req.body.order

	SQL_BEGIN.run()
	try {
		new_game_id = SQL_INSERT_REMATCH.get({
			owner_id: req.user.user_id,
			random: order === "random" ? 1 : 0,
			old_game_id,
			magic,
		})
		if (new_game_id)
			insert_rematch_players(old_game_id, new_game_id, req.user.user_id, order)
		else
			new_game_id = SQL_SELECT_REMATCH.get(magic)
		SQL_COMMIT.run()
	} catch (error) {
		return res.send(error.toString())
	} finally {
		if (db.inTransaction)
			SQL_ROLLBACK.run()
	}

	return res.redirect("/join/" + new_game_id)
})

function user_may_join(user, game, players) {
	if (game.is_match || game.status > 1)
		return false
	if (game.join_count == game.player_count)
		return false
	var has_already_joined = false
	var has_other_players = false
	for (let p of players) {
		if (p.user_id === user.user_id)
			has_already_joined = true
		else
			has_other_players = true
	}
	if (has_already_joined) {
		if (user.user_id !== game.owner_id)
			return false
		if (has_other_players)
			return false
	}
	return true
}

function user_may_part(user, game, players) {
	if (game.is_match || game.status > 1)
		return false
	if (game.status > 0) {
		if (!game.is_private)
			return false
	}
	return true
}

function user_may_kick(user, game, players) {
	if (game.owner_id !== user.user_id)
		return false
	return user_may_part(user, game, players)
}

function user_may_start(user, game, players) {
	if (game.owner_id !== user.user_id || game.is_match || game.status !== 0)
		return false
	if (!game.is_ready)
		return false
	return true
}

function user_may_delete(user, game, players) {
	if (game.owner_id !== user.user_id || game.is_match)
		return false
	if (game.status > 0 && game.user_count > 1)
		return false
	return true
}

function user_may_rewind(user, game, players) {
	if (game.status === 0 || game.status === 3)
		return false
	if (user.is_moderator)
		return true
	if (game.owner_id !== user.user_id || game.is_match)
		return false
	if (!game.is_private)
		return false
	return true
}

app.get("/join/:game_id", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id | 0
	let game = SQL_SELECT_GAME_VIEW.get(game_id)
	if (!game)
		return res.status(404).send("Invalid game ID.")

	if (ENABLE_ARCHIVE) {
		if (game.status === STATUS_ARCHIVED && game.moves >= game.player_count * 2)
			game.status = STATUS_FINISHED
	}

	let roles = get_game_roles(game.title_id, game.scenario, game.options)
	let players = SQL_SELECT_PLAYER_VIEW.all(game_id)

	let whitelist = null
	let blacklist = null
	let friends = null
	let rewind = 0

	if (req.user) {
		whitelist = SQL_SELECT_CONTACT_WHITELIST.all(req.user.user_id)
		blacklist = SQL_SELECT_CONTACT_BLACKLIST.all(req.user.user_id)
		if (game.owner_id === req.user.user_id)
			friends = SQL_SELECT_CONTACT_FRIEND_NAMES.all(req.user.user_id)
		if (req.user.user_id === 1)
			rewind = SQL_SELECT_REWIND.all(game_id)
	}

	game.human_options = format_options(game.options)

	if (game.status === 0 && game.is_random)
		roles = RANDOM_ROLES_LIST[roles.length]

	let icon = ""
	if (game.is_private)
		icon += app.locals.ICON_PRIVATE
	if (game.is_match)
		icon += app.locals.ICON_MATCH

	let may_join = user_may_join(req.user, game, players)
	let limit = null
	if (may_join && !game.is_private && game.owner_id !== req.user.user_id)
		limit = check_join_game_limit(req.user, 1)

	res.render("join.pug", {
		icon,
		game,
		roles,
		players,
		whitelist,
		blacklist,
		friends,
		limit,
		may_join: !limit && may_join,
		may_part: user_may_part(req.user, game, players),
		may_kick: user_may_kick(req.user, game, players),
		may_start: user_may_start(req.user, game, players),
		may_delete: user_may_delete(req.user, game, players),
		may_rewind: user_may_rewind(req.user, game, players),
		rewind
	})
})

function do_join(res, game_id, role, user_id, user_name, is_invite) {
	let game = SQL_SELECT_GAME.get(game_id)
	let roles = get_game_roles(game.title_id, game.scenario, game.options)
	if (game.is_random && game.status === STATUS_OPEN) {
		let m = role.match(/^Random (\d+)$/)
		if (!m || Number(m[1]) < 1 || Number(m[1]) > roles.length)
			return res.status(404).send("Invalid role.")
	} else {
		if (!roles.includes(role))
			return res.status(404).send("Invalid role.")
	}
	if (is_invite) {
		if (SQL_SELECT_RELATION.get(user_id, game.owner_id) < 0)
			return res.send("Could not invite that user.")
		if (SQL_SELECT_RELATION.get(game.owner_id, user_id) < 0)
			return res.send("Could not invite that user.")
	}
	let info = SQL_INSERT_PLAYER_ROLE.run(game_id, role, user_id, is_invite ? 2 : 0)
	if (info.changes === 1) {
		res.send("SUCCESS")

		// send chat message about player joining a game in progress
		if (game.status > 0 && user_name && !is_invite) {
			send_chat_message(game_id, null, `${user_name} joined as ${role}.`)
		}
	} else {
		if (is_invite)
			res.send("Could not invite.")
		else
			res.send("Could not join game.")
	}
}

app.post("/api/join/:game_id/:role", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id | 0
	let role = req.params.role
	let game = SQL_SELECT_GAME.get(game_id)
	let players = SQL_SELECT_PLAYERS.all(game_id)
	let may_join = user_may_join(req.user, game, players)
	if (!may_join)
		return res.send("You cannot join this game!")
	if (!game.is_private && game.owner_id !== req.user.user_id) {
		let limit = check_join_game_limit(req.user, req.user.user_id === game.owner_id ? 0 : 1)
		if (limit)
			return res.send(limit)
	}
	do_join(res, game_id, role, req.user.user_id, req.user.name, 0)
})

app.post("/api/invite/:game_id/:role/:user", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id | 0
	let role = req.params.role
	let user_id = SQL_SELECT_USER_ID.get(req.params.user)
	if (!user_id)
		res.send("User not found.")
	else if (user_id === req.user.user_id)
		res.send("You cannot invite yourself!")
	else
		do_join(res, game_id, role, user_id, null, 1)
})

app.post("/api/accept/:game_id/:role", must_be_logged_in, function (req, res) {
	// TODO: check join game limit if inviting self...
	let game_id = req.params.game_id | 0
	let game = SQL_SELECT_GAME.get(game_id)
	let role = req.params.role
	let info = SQL_UPDATE_PLAYER_ACCEPT.run(game_id, role, req.user.user_id)
	if (info.changes === 1) {
		res.send("SUCCESS")

		// send chat message about player joining a game in progress
		if (game.status > 0)
			send_chat_message(game_id, null, `${req.user.name} joined as ${role}.`)
	} else {
		res.send("Could not accept invite.")
	}
})

app.post("/api/part/:game_id/:role", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id | 0
	let role = req.params.role

	let game = SQL_SELECT_GAME.get(game_id)
	if (game.is_match)
		return res.send("Cannot kick players from tournament games.")
	if (game.status > 1)
		return res.send("Cannot kick players from finished games.")
	if (game.status > 0 && !game.is_private)
		return res.send("Cannot kick players from public games.")

	let user_name = SQL_SELECT_PLAYER_NAME.get(game_id, role)
	if (!user_name)
		res.send("Cannot find role assignment.")
	if (user_name !== req.user.name && game.owner_id !== req.user.user_id)
		res.send("Only the owner may kick other players.")

	SQL_DELETE_PLAYER_ROLE.run(game_id, role)
	res.send("SUCCESS")

	// send chat message about player leaving a game in progress
	if (game.status > 0) {
		if (user_name !== req.user.name)
			send_chat_message(game_id, null, `${user_name} (${role}) left the game (kicked by ${req.user.name}).`)
		else
			send_chat_message(game_id, null, `${user_name} (${role}) left the game.`)
	}
})

function assign_random_roles(game, options, players) {
	function pick_random_item(list) {
		let k = crypto.randomInt(list.length)
		let r = list[k]
		list.splice(k, 1)
		return r
	}
	let roles = get_game_roles(game.title_id, game.scenario, options).slice()
	for (let p of players) {
		let old_role = p.role
		p.role = pick_random_item(roles)
		console.log("ASSIGN ROLE", "(" + p.name + ")", old_role, "->", p.role)
		SQL_UPDATE_PLAYER_ROLE.run(p.role, game.game_id, old_role)
	}
}

app.post("/api/start/:game_id", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id | 0
	let game = SQL_SELECT_GAME.get(game_id)
	if (req.user.user_id !== game.owner_id && req.user.user_id !== 1)
		return res.send("Not authorized to start that game ID.")
	if (game.status !== STATUS_OPEN)
		return res.send("The game is already started.")
	if (game.join_count !== game.player_count)
		return res.send("The game does not have enough players.")

	try {
		start_game(game)
	} catch (error) {
		console.log(error)
		return res.send(error.toString())
	}

	res.send("SUCCESS")
})

function start_game(game) {
	let options = parse_game_options(game.options)
	let seed = random_seed()
	let state = null

	console.log("STARTING GAME", game.game_id, game.title_id, game.scenario)

	SQL_BEGIN.run()
	try {
		if (is_random_scenario(game.title_id, game.scenario)) {
			game.scenario = select_random_scenario(game.title_id, game.scenario, seed)
			SQL_UPDATE_GAME_SCENARIO.run(game.scenario, game.game_id)
		}

		if (game.is_random)
			assign_random_roles(game, options, SQL_SELECT_PLAYERS.all(game.game_id))

		state = RULES[game.title_id].setup(seed, game.scenario, options)

		SQL_START_GAME.run(String(state.active), game.game_id)
		let replay_id = put_replay(game.game_id, null, ".setup", [ seed, game.scenario, options ])
		put_snap(game.game_id, replay_id, state)
		SQL_INSERT_GAME_STATE.run(game.game_id, JSON.stringify(state))

		SQL_COMMIT.run()
	} finally {
		if (db.inTransaction)
			SQL_ROLLBACK.run()
	}

	send_game_started_notification(game.game_id, state.active)
}

function may_debug_game(user, game) {
	if (game.status < 1)
		return false
	if (game.status > 1)
		return true
	return user && (user.is_admin || SQL_SELECT_USER_MAY_DEBUG.get(user.user_id, game.title_id))
}

app.get("/api/replay/:game_id", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id | 0
	let game = SQL_SELECT_GAME.get(game_id)
	if (!game)
		return res.status(404).send("Invalid game ID.")
	if (!may_debug_game(req.user, game))
		return res.status(401).send("Not authorized to debug.")
	res.setHeader("Content-Disposition", `attachment; filename="replay-${game_id}.json"`)
	if (ENABLE_ARCHIVE) {
		if (game.status === STATUS_ARCHIVED)
			return res.type("application/json").send(ARCHIVE_SELECT_EXPORT.get(game_id))
	}
	return res.type("application/json").send(SQL_SELECT_REPLAY.get(game_id))
})

app.get("/api/export/:game_id", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id | 0
	let game = SQL_SELECT_GAME.get(game_id)
	if (!game)
		return res.status(404).send("Invalid game ID.")
	if (!may_debug_game(req.user, game))
		return res.status(401).send("Not authorized to debug.")
	res.setHeader("Content-Disposition", `attachment; filename="export-${game_id}.json"`)
	if (ENABLE_ARCHIVE) {
		if (game.status === STATUS_ARCHIVED)
			return res.type("application/json").send(ARCHIVE_SELECT_EXPORT.get(game_id))
	}
	return res.type("application/json").send(SQL_SELECT_EXPORT.get(game_id))
})

function rewind_game_to_snap(game_id, snap_id) {
	let snap = SQL_SELECT_SNAP.get(game_id, snap_id)
	let game_state = JSON.parse(SQL_SELECT_GAME_STATE.get(game_id))
	let snap_state = JSON.parse(snap.state)
	snap_state.undo = []
	snap_state.log = game_state.log.slice(0, snap_state.log)

	SQL_BEGIN.run()
	try {
		SQL_DELETE_GAME_SNAP.run(game_id, snap_id)
		SQL_DELETE_GAME_REPLAY.run(game_id, snap.replay_id)
		SQL_INSERT_GAME_STATE.run(game_id, JSON.stringify(snap_state))

		SQL_REWIND_GAME.run(snap_id - 1, String(snap_state.active), game_id)
		SQL_REWIND_GAME_CLOCK.run(game_id)
		SQL_REWIND_GAME_TIMEOUT.run(game_id)

		if (game_clients[game_id])
			for (let other of game_clients[game_id])
				send_state(other, snap_state)

		SQL_COMMIT.run()
	} finally {
		if (db.inTransaction)
			SQL_ROLLBACK.run()
	}
}

const SQL_SELECT_REWIND_AUTH = SQL("select 1 from games where game_id=? and owner_id=? and is_private").pluck()
const SQL_SELECT_REWIND_ONCE_1 = SQL("select max(replay_id) from game_replay where game_id=?").pluck()
const SQL_SELECT_REWIND_ONCE_2 = SQL("select max(snap_id) from game_snap where game_id=? and replay_id<?").pluck()

app.post("/api/rewind/:game_id", must_be_logged_in, function (req, res) {
	let game_id = req.params.game_id | 0
	if (!req.user.is_moderator && !SQL_SELECT_REWIND_AUTH.get(game_id, req.user.user_id))
		return res.send("Not authorized to rewind that game ID.")
	let replay_id = SQL_SELECT_REWIND_ONCE_1.get(game_id)
	if (replay_id) {
		let snap_id = SQL_SELECT_REWIND_ONCE_2.get(game_id, replay_id)
		if (snap_id) {
			try {
				rewind_game_to_snap(game_id, snap_id)
				send_chat_message(game_id, null, `${req.user.name} rewound the game to move ${snap_id}.`)
				return res.send("SUCCESS")
			} catch (error) {
				return res.send(error.toString())
			}
		}
	}
	res.send("Nothing to rewind!")
})

app.get("/api/rewind/:game_id/:snap_id", must_be_administrator, function (req, res) {
	rewind_game_to_snap(req.params.game_id | 0, req.params.snap_id | 0)
	res.redirect("/join/" + req.params.game_id)
})

const SQL_CLONE_1 = SQL(`
	insert into games(status,owner_id,title_id,scenario,options,player_count,active,moves,notice)
	select 1,$owner_id,title_id,scenario,options,player_count,active,moves,'CLONE ' || cast($old_game_id as integer)
	from games where game_id=$old_game_id
	returning game_id
`).pluck()

const SQL_CLONE_2 = [
	SQL(`insert into players(game_id,role,user_id,is_active) select $new_game_id,role,$user_id,is_active from players where game_id=$old_game_id`),
	SQL(`insert into game_state(game_id,state) select $new_game_id,state from game_state where game_id=$old_game_id`),
	SQL(`insert into game_replay(game_id,replay_id,role,action,arguments) select $new_game_id,replay_id,role,action,arguments from game_replay where game_id=$old_game_id`),
	SQL(`insert into game_snap(game_id,snap_id,replay_id,state) select $new_game_id,snap_id,replay_id,state from game_snap where game_id=$old_game_id`),
]

app.get("/api/clone/:game_id", must_be_administrator, function (req, res) {
	let old_game_id = req.params.game_id | 0
	let new_game_id = 0

	SQL_BEGIN.run()
	try {
		new_game_id = SQL_CLONE_1.get({ owner_id: req.user.user_id, old_game_id })
		if (new_game_id) {
			for (let stmt of SQL_CLONE_2)
				stmt.run({ old_game_id, new_game_id, user_id: req.user.user_id })
		}
		SQL_COMMIT.run()
	} catch (error) {
		return res.send(error.toString())
	} finally {
		if (db.inTransaction)
			SQL_ROLLBACK.run()
	}
	res.redirect("/join/" + new_game_id)
})

/*
 * ELO RATINGS
 *
 * TODO:
 * use role ratings in asymmetric games based on title_id, scenario, player_count
 * add role_rating to Ev and update role_rating with low K-value
 */

const SQL_SELECT_RATING_GAME = SQL("select * from rated_games_view where game_id=?")
const SQL_SELECT_RATING_PLAYERS = SQL("select * from player_rating_view where game_id=?")
const SQL_INSERT_RATING = SQL("insert or replace into ratings (title_id,user_id,rating,count,last) values (?,?,?,?,?)")

function is_winner(role, result) {
	// NOTE: uses substring matching for multiple winners instead of splitting result on comma.
	return (result === "Draw" || result === role || result.includes(role))
}

function elo_k(_) {
	return 30
}

function elo_ev(a, players) {
	// https://arxiv.org/pdf/2104.05422.pdf
	// original: 1 / ( 1 + 10**((Rb-Ra)/400) )
	// unoptimized: 10**(Ra/400) / ( 10**(Ra/400) + 10**(Rb/400) )
	// generalized: 10**(Ra/400) / ( 10**(Ra/400) + 10**(Rb/400) + 10**(Rc/400) + ... )
	let sum = 0
	for (let p of players)
		sum += 10**(p.rating/400)
	return 10**(a.rating/400) / sum
}

function elo_change(a, players, score) {
	return Math.round( elo_k(a) * ( score - elo_ev(a, players) ) )
}

function update_elo_ratings(game_id) {
	let game = SQL_SELECT_RATING_GAME.get(game_id)
	if (!game)
		return

	if (!game.result || game.result === "None")
		return

	let players = SQL_SELECT_RATING_PLAYERS.all(game_id)

	let winners = 0
	for (let p of players)
		if (is_winner(p.role, game.result))
			winners ++

	for (let p of players)
		if (is_winner(p.role, game.result))
			p.change = elo_change(p, players, 1 / winners)
		else
			p.change = elo_change(p, players, 0)

	for (let p of players)
		SQL_INSERT_RATING.run(game.title_id, p.user_id, p.rating + p.change, p.count + 1, game.mtime)
}

/*
 * MAIL NOTIFICATIONS
 */

const MAIL_FROM = process.env.MAIL_FROM || "user@localhost"
const MAIL_FOOTER = "\n--\nYou can unsubscribe from notifications in your account settings:\n" + SITE_URL + "/account\n"

function mail_callback(error) {
	if (error)
		console.log("MAIL ERROR", error)
}

function mail_addr(user) {
	return user.name + " <" + user.mail + ">"
}

function mail_password_reset_token(user, token) {
	if (mailer) {
		let subject = "Password reset request"
		let body =
			"Your password reset token is: " + token + "\n\n" +
			SITE_URL + "/account/password/reset?mail=" + user.mail + "&token=" + token + "\n"
		console.log("SENT MAIL:", mail_addr(user), subject)
		mailer.sendMail({ from: MAIL_FROM, to: mail_addr(user), subject: subject, text: body }, mail_callback)
	}
}

function mail_verification_token(user, token) {
	if (mailer) {
		let subject = "Verify mail address"
		let body =
			"Your mail verification token is: " + token + "\n\n" +
			SITE_URL + "/account/mail/verify?token=" + token + "\n"
		console.log("SENT MAIL:", mail_addr(user), subject)
		mailer.sendMail({ from: MAIL_FROM, to: mail_addr(user), subject: subject, text: body }, mail_callback)
	}
}

/*
 * WEBHOOK NOTIFICATIONS
 */

const webhook_json_options = {
	"Content-Type": "application/json"
}

const webhook_text_options = {
	"Content-Type": "text/plain"
}

function on_webhook_success(user_id) {
	SQL_UPDATE_WEBHOOK_SUCCESS.run(user_id)
}

function on_webhook_error(user_id, error) {
	console.log("WEBHOOK FAIL", user_id, error)
	SQL_UPDATE_WEBHOOK_ERROR.run(error, user_id)
}

async function send_webhook(user_id, webhook, message, retry=2) {
	if (!WEBHOOKS)
		return
	try {
		const text = webhook.prefix + " " + message
		const data = webhook.format ? JSON.stringify({ [webhook.format]: text }) : text
		const headers = webhook.format ? webhook_json_options : webhook_text_options
		const res = await fetch(webhook.url, {
			method: "POST",
			signal: AbortSignal.timeout(6000),
			headers: headers,
			body: data
		})
		if (res.ok)
			on_webhook_success(user_id)
		else {
			if (retry > 0)
				retry_webhook(user_id, webhook, message, retry - 1)
			else
				on_webhook_error(user_id, res.status + ": " + res.statusText)
		}
	} catch (error) {
		if (retry > 0)
			retry_webhook(user_id, webhook, message, retry - 1)
		else
			on_webhook_error(user_id, error.message)
	}
}

function retry_webhook(user_id, webhook, message, retry) {
	console.log("WEBHOOK RETRY", user_id)
	setTimeout(() => send_webhook(user_id, webhook, message, retry), 3000 + Math.random() * 7000)
}

/*
 * NOTIFICATIONS
 */

function game_play_link(game_id, title_id, user) {
	return SITE_URL + play_url(title_id, game_id, user.role)
}

function game_join_link(game_id) {
	return SITE_URL + "/join/" + game_id
}

function message_link(msg_id) {
	return SITE_URL + "/message/read/" + msg_id
}

function tour_pool_link(pool_id) {
	return SITE_URL + "/tm/pool/" + pool_id
}

function send_notification(user, link, message) {
	if (WEBHOOKS) {
		let webhook = SQL_SELECT_WEBHOOK_SEND.get(user.user_id)
		if (webhook) {
			console.log("WEBHOOK", user.name, link, message)
			send_webhook(user.user_id, webhook, link + " - " + message)
		}
	}
	if (mailer && user.notify) {
		console.log("MAIL", mail_addr(user), link, message)
		mailer.sendMail(
			{
				from: MAIL_FROM,
				to: mail_addr(user),
				subject: message,
				text: link + "\n" + MAIL_FOOTER,
			},
			mail_callback
		)
	}
}

function send_join_notification(user, game_id, message) {
	let title_id = SQL_SELECT_GAME_TITLE.get(game_id)
	let title_name = TITLE_NAME[title_id]
	send_notification(user, game_join_link(game_id), `${title_name} #${game_id} - ${message}`)
}

function send_play_notification(user, game_id, message) {
	let title_id = SQL_SELECT_GAME_TITLE.get(game_id)
	let title_name = TITLE_NAME[title_id]
	send_notification(user, game_play_link(game_id, title_id, user), `${title_name} #${game_id} (${user.role}) - ${message}`)
}

function send_tour_notification(user, pool_name, message) {
	send_notification(user, tour_pool_link(pool_name), `${pool_name} - ${message}`)
}

function send_chat_activity_notification(game_id, p) {
	send_play_notification(p, game_id, "Chat activity")
}

function send_game_started_notification(game_id, active) {
	let players = SQL_SELECT_PLAYERS.all(game_id)
	for (let p of players) {
		let p_is_active = is_role_active(active, p.role)
		if (p_is_active)
			send_play_notification(p, game_id, "Started - Your turn")
		else
			send_play_notification(p, game_id, "Started")
	}
}

function send_your_turn_notification_to_offline_users(game_id, old_active, new_active) {
	// Only send notifications when the active player changes.
	if (!is_changed_active(old_active, new_active))
		return

	let players = SQL_SELECT_PLAYERS.all(game_id)
	for (let p of players) {
		let p_was_active = is_role_active(old_active, p.role)
		let p_is_active = is_role_active(new_active, p.role)
		if (!p_was_active && p_is_active) {
			if (!is_player_online(game_id, p.user_id))
				send_play_notification(p, game_id, "Your turn")
		}
	}
}

function send_game_finished_notification_to_offline_users(game_id, result) {
	let players = SQL_SELECT_PLAYERS.all(game_id)
	for (let p of players) {
		if (!is_player_online(game_id, p.user_id)) {
			SQL_INSERT_UNSEEN_GAME.run(p.user_id, game_id)
			send_play_notification(p, game_id, "Finished (" + result + ")")
		}
	}
}

const SQL_SELECT_INVITE_NOTIFY = SQL(`
	select
		game_id, role, user_id, name, mail, notify
	from
		games
		join players using(game_id)
		join users using(user_id)
	where
		status = 0
		and is_invite = 2
		and julianday(mtime) < julianday('now', '-30 seconds')
`)

const SQL_UPDATE_INVITE_NOTIFY = SQL("update players set is_invite=1 where game_id=? and role=?")

function invite_notify_ticker() {
	for (let item of SQL_SELECT_INVITE_NOTIFY.all()) {
		try {
			SQL_UPDATE_INVITE_NOTIFY.run(item.game_id, item.role)
			send_join_notification(item, item.game_id, "You have an invitation")
		} catch (error) {
			console.log(error)
		}
	}
}

setInterval(invite_notify_ticker, 53 * 1000)

const QUERY_READY_TO_START = SQL(`
	select
		*
	from
		games
	where
		status = 0
		and not is_match
		and is_ready
		and julianday(mtime) < julianday('now', '-30 seconds')
`)

function ready_game_ticker() {
	for (let game of QUERY_READY_TO_START.all()) {
		try {
			start_game(game)
		} catch (error) {
			console.log(error)
		}
	}
}

setInterval(ready_game_ticker, 47 * 1000)

const QUERY_PURGE_OPEN_GAMES = SQL(`
	delete from
		games
	where
		status = 0
		and not is_match
		and not is_ready
		and julianday(ctime) < julianday('now', '-10 days')
`)

const QUERY_PURGE_ACTIVE_GAMES = SQL(`
	delete from
		games
	where
		status = 1
		and not is_match
		and not is_ready
		and julianday(mtime) < julianday('now', '-10 days')
`)

// don't keep solo games in archive
// don't keep games abandoned in the first turns
const QUERY_PURGE_FINISHED_GAMES = SQL(`
	delete from
		games
	where
		status > 1
		and not is_match
		and ( not is_opposed or moves < player_count * 2 )
		and julianday(mtime) < julianday('now', '-10 days')
`)

const QUERY_PURGE_MESSAGES = SQL(`
	delete from
		messages
	where
		is_deleted_from_inbox and is_deleted_from_outbox
`)

function purge_game_ticker() {
	QUERY_PURGE_OPEN_GAMES.run()
	QUERY_PURGE_ACTIVE_GAMES.run()
	QUERY_PURGE_FINISHED_GAMES.run()
	QUERY_PURGE_MESSAGES.run()
	TM_DELETE_QUEUE_INACTIVE.run()
}

// Purge abandoned games every 31 minutes.
setInterval(purge_game_ticker, 31 * 60 * 1000)
setTimeout(purge_game_ticker, 89 * 1000)

/*
 * TIME CONTROL
 */

const SQL_SELECT_TIME_CONTROL = SQL("select * from time_control_view")
const SQL_SELECT_TIME_CONTROL_DEADLINE = SQL("select * from time_control_deadline_view")

const SQL_INSERT_TIMEOUT = SQL("insert or ignore into user_timeout (user_id, game_id) values (?, ?)")

function terminate_game(game, role, user_id) {
	var result = get_resign_result(game, role)
	update_game_scores(game.title_id, game.game_id, null, result, true)
	SQL_FINISH_GAME.run(0, result, 0, 1, game.game_id)
	SQL_INSERT_TIMEOUT.run(user_id, game.game_id)
}

function terminate_future_matches(game_id, user_id) {
	var pool_id = TM_SELECT_POOL_BY_GAME.get(game_id)
	var games_to_terminate = TM_SELECT_FUTURE_GAMES_IN_POOL.all(pool_id, user_id)
	for (var game of games_to_terminate) {
		console.log("TERMINATE " + game.game_id)
		terminate_game(game, game.role, user_id)
	}
}

function time_control_ticker() {
	var games_to_timeout
	var games_to_deadline

	SQL_BEGIN.run()
	try {
		console.log("TIME CONTROL TICKER")

		games_to_timeout = SQL_SELECT_TIME_CONTROL.all()
		for (let item of games_to_timeout) {
			if (item.is_opposed) {
				console.log("TIMED OUT GAME:", item.game_id, item.role)
				SQL_INSERT_TIMEOUT.run(item.user_id, item.game_id)
				if (item.is_match) {
					console.log("BANNED FROM TOURNAMENTS:", item.user_id)
					TM_INSERT_BANNED.run(item.user_id)
					TM_DELETE_QUEUE_USER.run(item.user_id)
					TM_DELETE_TICKETS_USER.run(item.user_id)
					terminate_future_matches(item.game_id, item.user_id)
				}
			} else {
				console.log("TIMED OUT GAME:", item.game_id, item.role, "(solo)")
				SQL_DELETE_GAME.run(item.game_id)
			}
		}

		games_to_deadline = SQL_SELECT_TIME_CONTROL_DEADLINE.all()
		for (let item of games_to_deadline) {
			if (item.is_opposed) {
				console.log("DEADLINED GAME:", item.game_id, item.role)
			} else {
				console.log("DEADLINED GAME:", item.game_id, item.role, "(solo)")
				SQL_DELETE_GAME.run(item.game_id)
			}
		}

		SQL_COMMIT.run()
	} catch (error) {
		console.log(error)
		return
	} finally {
		if (db.inTransaction)
			SQL_ROLLBACK.run()
	}

	for (let item of games_to_timeout)
		if (item.is_opposed)
			do_resign(item.game_id, item.role, ".timeout", item.role.split(",").join(" and ") + " timed out.")

	for (let item of games_to_deadline)
		if (item.is_opposed)
			do_resign(item.game_id, item.role, ".timeout", item.role.split(",").join(" and ") + " timed out.")
}

// Run time control checks every 13 minutes.
if (TIMEOUT) {
	setInterval(time_control_ticker, 13 * 60 * 1000)
	setTimeout(time_control_ticker, 13 * 1000)
}

/*
 * TOURNAMENTS
 */

const designs = require("./designs.js")

const TM_SELECT_IS_BANNED = SQL("select exists ( select 1 from tm_banned where user_id=? )").pluck()
const TM_SELECT_BANNED = SQL("select * from tm_banned where user_id=?")
const TM_INSERT_BANNED = SQL("insert or ignore into tm_banned (user_id, time) values (?, datetime())")

const TM_DELETE_QUEUE_USER = SQL("delete from tm_queue where user_id=?")
const TM_DELETE_TICKETS_USER = SQL("delete from tm_tickets where user_id=?")

const TM_DELETE_QUEUE_INACTIVE = SQL(`
	delete from tm_queue where exists (
		select 1
		from user_last_seen
		where user_last_seen.user_id = tm_queue.user_id
		and julianday() - julianday(atime) > 14
	)
`)

const TM_SELECT_SEEDS_BY_USER = SQL(`
	with tt as (
		select
			user_id, title_id, is_open, seed_id, seed_name, level, count as ticket_count
		from
			tm_tickets
			join tm_seeds using(seed_id)
		where
			is_open and
			user_id=:user_id and level > 1 and level <= level_count
		union all
		select
			user_id, title_id, is_open, seed_id, seed_name, 1 as level, -1 as ticket_count
		from
			tm_seeds
			join ratings using(title_id)
		where
			is_open and
			user_id=:user_id and count >= 2
	)
	select
		title_id, is_open, seed_id, seed_name, level, ticket_count
		, exists ( select 1 from tm_queue qq where tt.user_id=qq.user_id and tt.seed_id=qq.seed_id and tt.level=qq.level ) as is_queued
		, ( select count(1) from tm_queue qq where tt.seed_id=qq.seed_id and tt.level=qq.level ) as queue_count
	from
		tt
	order by seed_name, level
`)

const TM_SELECT_SEEDS_BY_TITLE = SQL(`
	with tt as (
		select
			user_id, title_id, is_open, seed_id, seed_name, level, count as ticket_count
		from
			tm_tickets
			join tm_seeds using(seed_id)
		where
			title_id=:title_id and user_id=:user_id and level > 1 and level <= level_count
		union all
		select
			:user_id as user_id, title_id, is_open, seed_id, seed_name
			, 1 as level
			, exists (select 1 from ratings where ratings.title_id=tm_seeds.title_id and user_id=:user_id and count >= 2) as ticket_count
		from
			tm_seeds
		where
			title_id=:title_id
	)
	select
		title_id, is_open, seed_id, seed_name, level, ticket_count
		, exists ( select 1 from tm_queue qq where tt.user_id=qq.user_id and tt.seed_id=qq.seed_id and tt.level=qq.level ) as is_queued
		, (select count(1) from tm_queue qq join users using(user_id) where tt.seed_id=qq.seed_id and tt.level=qq.level ) as queue_count
	from
		tt
	order by seed_name, level
`)

const TM_SELECT_QUEUES = SQL(`
	select
		seed_id, seed_name, level
		, ( select count from tm_tickets tt where tm_queue.seed_id=tt.seed_id and tm_queue.level=tt.level and tm_queue.user_id=tt.user_id ) as ticket_count
		, ( select count(1) from tm_queue qq where tm_queue.seed_id=qq.seed_id and tm_queue.level=qq.level ) as queue_count
		, 1 as is_queued
	from
		tm_queue
		join tm_seeds using(seed_id)
	where
		user_id=?
`)

const TM_HAS_TICKET = SQL(`
	select coalesce( (select count from tm_tickets where user_id=? and seed_id=? and level=?), 0 )
`).pluck()

const TM_GAIN_TICKET = SQL(`
	insert into tm_tickets (user_id, seed_id, level, count) values (?, ?, ?, 5)
	on conflict do update set count = min(count + 5, 10)
`)

const TM_SPEND_TICKET = SQL("update tm_tickets set count=count-1 where user_id=? and seed_id=? and level=?")

const TM_SELECT_USER_HAS_PLAYED_TITLE = SQL(`
	select exists ( select 1 from ratings where user_id=? and title_id=? and count >= 2 )
`).pluck()

const TM_SELECT_SEED_IS_OPEN = SQL(`
	select is_open or exists ( select 1 from tm_queue_view where tm_queue_view.seed_id = tm_seeds.seed_id )
	from tm_seeds
	where seed_id=?
`).pluck()

const TM_COUNT_QUEUE = SQL(`
	select count(1) from tm_queue where user_id = ?
`).pluck()

const TM_COUNT_QUEUE_GAMES = SQL(`
	select sum(match_count) from tm_queue join tm_seeds using(seed_id) where user_id = ?
`).pluck()

function check_join_seed_limit(user, seed) {
	let limit = check_join_game_limit(user, seed.match_count / 2)
	if (limit)
		return limit

	if (TM_SELECT_IS_BANNED.get(user.user_id))
		return "You may not join any tournaments."

	if (!DEBUG) {
		if (!SQL_SELECT_USER_VERIFIED.get(user.user_id))
			return "Verify your mail address to join this tournament."
		if (!TM_SELECT_USER_HAS_PLAYED_TITLE.get(user.user_id, seed.title_id))
			return "You need to play more before you can join this tournament."
	}

	if (!TM_SELECT_SEED_IS_OPEN.get(seed.seed_id))
		return "This tournament is closed."

	if (TM_COUNT_QUEUE.get(user.user_id) >= LIMIT_TM_QUEUE)
		return "You cannot queue for more tournaments now."

	return null
}

function may_join_seed_level(user_id, seed_id, level) {
	if (level < 2)
		return 1
	return TM_HAS_TICKET.get(user_id, seed_id, level)
}

const TM_SEED_STATS = SQL(`
	with uu as (
		select seed_id, count(distinct user_id) as players
		from tm_seeds
		join tm_pools using(seed_id)
		join tm_rounds using(pool_id)
		join players using(game_id)
		group by seed_id
	)
	select
		seed_name
		, players
		, sum(not is_finished) as active
		, sum(is_finished) as finished
		, round(min(julianday(finish_date) - julianday(start_date))) as min_duration
		, round(avg(julianday(finish_date) - julianday(start_date))) as avg_duration
		, round(max(julianday(finish_date) - julianday(start_date))) as max_duration
	from tm_seeds
	join tm_pools using(seed_id)
	join uu using(seed_id)
	group by seed_name
`)

const TM_POOL_LIST_USER_ACTIVE = SQL(`
	select * from tm_pool_active_view
	where not is_finished and pool_id in (
		select pool_id
		from tm_rounds
		join players using(game_id)
		where user_id = ?
	)
`)

const TM_POOL_LIST_USER_RECENT_FINISHED = SQL(`
	select * from tm_pool_finished_view
	where
		finish_date > date('now', '-14 days')
		and pool_id in (
			select pool_id
			from tm_rounds
			join players using(game_id)
			where user_id = ?
		)
`)

const TM_POOL_LIST_USER_ALL_FINISHED = SQL(`
	select * from tm_pool_finished_view
	where
		pool_id in (
			select pool_id
			from tm_rounds
			join players using(game_id)
			where user_id = ?
		)
`)

const TM_POOL_LIST_TITLE_ACTIVE = SQL("select * from tm_pool_active_view where title_id = ?")
const TM_POOL_LIST_SEED_ACTIVE = SQL("select * from tm_pool_active_view where seed_id = ?")
const TM_POOL_LIST_SEED_FINISHED = SQL("select * from tm_pool_finished_view where seed_id = ?")

const TM_SELECT_QUEUE_BLACKLIST = SQL(`
	with qq as (
		select user_id from tm_queue_view where seed_id=? and level=?
	)
	select me, you, u_me.name as me_name, u_you.name as you_name
	from contacts
	join qq on qq.user_id = me
	join users u_me on u_me.user_id=me
	join users u_you on u_you.user_id=you
	where relation < 0 and exists (select 1 from qq where user_id = you)
`)

const TM_SELECT_QUEUE_NAMES = SQL("select user_id, name, level from tm_queue_view join users using(user_id) where seed_id=? and level=? order by time")
const TM_SELECT_QUEUE = SQL("select user_id from tm_queue_view where seed_id=? and level=? order by time desc").pluck()
const TM_DELETE_QUEUE = SQL("delete from tm_queue where user_id=? and seed_id=? and level=?")
const TM_INSERT_QUEUE = SQL("insert or ignore into tm_queue (user_id, seed_id, level) values (?,?,?)")

const TM_DELETE_QUEUE_SEED = SQL("delete from tm_queue where seed_id=? and level=?")
const TM_SELECT_SEED_ALL = SQL("select * from tm_seeds order by title_id, seed_name")
const TM_SELECT_SEED = SQL("select * from tm_seeds where seed_id = ?")
const TM_SELECT_SEED_BY_NAME = SQL("select * from tm_seeds where seed_name = ?")
const TM_SELECT_POOL_BY_NAME = SQL("select * from tm_pools where pool_name=?")

const TM_INSERT_POOL = SQL("insert into tm_pools (seed_id, level, is_finished, start_date, pool_name) values (?,?,0,datetime(),?) returning pool_id").pluck()
const TM_INSERT_ROUND = SQL("insert into tm_rounds (game_id, pool_id, round) values (?,?,?)")

const TM_UPDATE_POOL_FINISHED = SQL("update tm_pools set is_finished=1, finish_date=datetime() where pool_id=?")

const TM_FIND_POOL_NAME = SQL("select pool_name from tm_rounds join tm_pools using(pool_id) where game_id=?").pluck()
const TM_FIND_NEXT_POOL_NUMBER = SQL("select 1 + count(1) from tm_pools where seed_id = ? and level = ?").pluck()

const TM_SELECT_SEED_BY_GAME = SQL(`
	select pool_name, seed_notice
	from tm_rounds
	join tm_pools using(pool_id)
	join tm_seeds using(seed_id)
	where game_id = ?
`)

const TM_SELECT_POOL_BY_GAME = SQL("select pool_id from tm_rounds where game_id = ?").pluck()
const TM_SELECT_FUTURE_GAMES_IN_POOL = SQL(`
	select
		game_id, title_id, scenario, options, role
	from
		tm_rounds
		join games using(game_id)
		join players using(game_id)
	where pool_id = ? and user_id = ? and status = 0
`)

const TM_SELECT_GAMES = SQL(`
	select
		tm_rounds.*,
		games.status,
		games.moves,
		games.did_timeout,
		json_group_object(role, coalesce(name, 'null')) as role_names,
		json_group_object(role, score) as role_scores
	from
		tm_rounds
		left join games using(game_id)
		left join players using(game_id)
		left join users using(user_id)
	where
		pool_id=?
	group by
		game_id
`)

const TM_SELECT_PLAYERS_IN_POOL = SQL(`
	select
		distinct user_view.*
	from
		tm_rounds
		join players using(game_id)
		join user_view using(user_id)
	where
		pool_id = ?
`)

const TM_SELECT_WINNERS_IN_POOL = SQL(`
	select
		user_view.*
	from
		tm_winners
		join user_view using(user_id)
	where
		pool_id = ?
`)

const TM_SELECT_PLAYERS_2P = SQL(`
	with
		score_cte as (
			select
				pool_id,
				u1.user_id as user_id,
				coalesce(u1.name, 'null') as name,
				coalesce(u2.name, 'null') as opponent,
				json_group_array(json_array(game_id, p1.score)) as result
			from
				tm_rounds
				left join players as p1 using(game_id)
				left join players as p2 using(game_id)
				left join users as u1 on u1.user_id=p1.user_id
				left join users as u2 on u2.user_id=p2.user_id
			where
				pool_id = ?
				and p1.user_id != p2.user_id
			group by u1.name, u2.name
		)
	select
		name,
		json_group_object(opponent, json(result)) as result,
		coalesce(points, 0) as points,
		coalesce(son, 0) as son
	from
		score_cte
		left join tm_results using(pool_id, user_id)
	group by
		user_id
	order by
		points desc, son desc, name
`)

const TM_SELECT_PLAYERS_MP = SQL(`
	select
		name,
		json_group_array(json_array(game_id, score)) as result,
		coalesce(points, 0) as points,
		coalesce(son, 0) as son
	from
		tm_rounds
		left join games using(game_id)
		left join players using(game_id)
		left join users using(user_id)
		left join tm_results using(pool_id, user_id)
	where
		pool_id = ?
	group by
		user_id
	order by
		points desc, son desc, name
`)

const TM_SELECT_READY_GAMES = SQL(`
	select
		game_id,
		title_id,
		scenario,
		options
	from
		games
	where
		status = 0
		and is_match
		and is_ready
		and julianday() > julianday(ctime)
`)

const TM_SELECT_ENDED_POOLS = SQL(`
	select
		pool_id, pool_name, seed_id, level
	from
		tm_pools
		join tm_rounds using(pool_id)
		join games using(game_id)
	where
		not is_finished
	group by
		pool_id
	having
		sum(status < 2) = 0
`)

const TM_SELECT_SEED_READY_MINI_CUP = SQL(`
	select
		seed_id, level
	from
		tm_seeds
		join tm_queue_view using(seed_id)
	where
		seed_name like 'mc.%'
		and julianday(time) < julianday('now', '-30 seconds')
	group by
		seed_id, level
	having
		count(1) >= pool_size
`)

app.get("/tm/stats", must_be_logged_in, function (req, res) {
	let seeds = TM_SEED_STATS.all()
	res.render("tm_stats.pug", { seeds })
})

app.get("/tm/seed/:seed_name", must_be_logged_in, function (req, res) {
	let seed_name = req.params.seed_name
	let seed = TM_SELECT_SEED_BY_NAME.get(seed_name)
	if (!seed)
		return res.status(404).send("Tournament seed not found.")
	let seed_id = seed.seed_id
	let queues = []
	for (let level = 1; level <= seed.level_count; ++level)
		queues[level-1] = TM_SELECT_QUEUE_NAMES.all(seed_id, level)

	let active_pools = TM_POOL_LIST_SEED_ACTIVE.all(seed_id)
	let finished_pools = TM_POOL_LIST_SEED_FINISHED.all(seed_id)

	let error = null
	let may_register = false
	if (req.user) {
		error = check_join_seed_limit(req.user, seed)
		if (!error)
			may_register = true
	}

	res.render("tm_seed.pug", { error, may_register, seed, queues, active_pools, finished_pools })
})

app.get("/tm/pool/:pool_name", must_be_logged_in, function (req, res) {
	let pool_name = req.params.pool_name
	let pool = TM_SELECT_POOL_BY_NAME.get(pool_name)
	if (!pool)
		return res.status(404).send("Tournament pool not found.")
	let pool_id = pool.pool_id
	let seed = TM_SELECT_SEED.get(pool.seed_id)
	let roles = get_game_roles(seed.title_id, seed.scenario, seed.options)
	let players
	if (seed.player_count === 2)
		players = TM_SELECT_PLAYERS_2P.all(pool_id)
	else
		players = TM_SELECT_PLAYERS_MP.all(pool_id)
	let games = TM_SELECT_GAMES.all(pool_id)
	let games_by_round = object_group_by(games, "round")
	res.render("tm_pool.pug", { seed, pool, roles, players, games, games_by_round })
})

app.all("/tm/register/:seed_id/:level", must_be_logged_in, function (req, res) {
	let seed_id = req.params.seed_id | 0
	let level = req.params.level | 0
	let seed = TM_SELECT_SEED.get(seed_id)
	if (!seed)
		return res.status(404).send("Tournament seed not found.")
	if (level < 1 || level > seed.level_count)
		return res.status(401).send("Tournament does not have that many levels.")
	let user_id = req.user.user_id
	let limit = check_join_seed_limit(req.user, seed)
	if (limit)
		return res.status(401).send(limit)
	if (!may_join_seed_level(req.user.user_id, seed_id, level))
		return res.status(401).send("You may not join this tournament.")
	TM_INSERT_QUEUE.run(user_id, seed_id, level)
	return res.redirect(req.headers.referer)
})

app.all("/tm/withdraw/:seed_id/:level", must_be_logged_in, function (req, res) {
	let seed_id = req.params.seed_id | 0
	let level = req.params.level | 0
	let user_id = req.user.user_id
	TM_DELETE_QUEUE.run(user_id, seed_id, level)
	return res.redirect(req.headers.referer)
})

app.post("/tm/start/:seed_id/:level", must_be_administrator, function (req, res) {
	let seed_id = req.params.seed_id | 0
	let level = req.params.level | 0
	start_tournament_seed(seed_id, level)
	tm_start_ready_games()
	return res.redirect(req.headers.referer)
})

function make_pools(seed, players) {
	let v = players.length
	let k = seed.player_count
	let n = seed.match_count

	if (k === 2) {
		if (n === 4) {
			if (v % 5 === 0)
				return designs.pool_players(players, 5)
			if (v % 3 === 0)
				return designs.pool_players(players, 3)
			if (v > 7)
				return designs.pool_players_using_knapsack(players, "5/3")
		}

		if (n === 6) {
			if (v % 7 === 0)
				return designs.pool_players(players, 7)
			if (v % 4 === 0)
				return designs.pool_players(players, 4)
			if (v > 17)
				return designs.pool_players_using_knapsack(players, "7/4")
		}

		if (n === 8) {
			if (v % 9 === 0)
				return designs.pool_players(players, 9)
			if (v % 5 === 0)
				return designs.pool_players(players, 5)
			if (v > 31)
				return designs.pool_players_using_knapsack(players, "9/5")
		}

		if (v % (n+1) === 0)
			return designs.pool_players(players, n+1)

		throw new Error("cannot create pools for this player/rounds configuration")
		/*
		if (v > n+1)
			return designs.pool_players(players, n+1)

		return [ players ]
		*/
	}

	if (k === 3) {
		// youden squares
		if (v % 7 === 0) return designs.pool_players(players, 7)
		// kirkman triple systems
		if (v % 9 === 0) return designs.pool_players(players, 9)
		if (v % 15 === 0) return designs.pool_players(players, 15)
		if (v % 21 === 0) return designs.pool_players(players, 21)
		if (v % 27 === 0) return designs.pool_players(players, 27)
		if (v % 33 === 0) return designs.pool_players(players, 33)
		if (v % 39 === 0) return designs.pool_players(players, 39)
		if (v % 45 === 0) return designs.pool_players(players, 45)
		if (v % 51 === 0) return designs.pool_players(players, 51)
		// social golfer semi-solutions
		if (v % 6 === 0) return designs.pool_players(players, 6)
		if (v % 12 === 0) return designs.pool_players(players, 12)
		// misc bibd
		if (v % 13 === 0 && n === 6) return designs.pool_players(players, 13)
		// small youden squares
		if (v % 4 === 0) return designs.pool_players(players, 4)
		if (v % 3 === 0) return designs.pool_players(players, 3)
	}

	if (k === 4) {
		// youden squares
		if (v % 7 === 0) return designs.pool_players(players, 7)
		if (v % 13 === 0) return designs.pool_players(players, 13)
		// steiner quadrilateral systems
		if (v % 16 === 0) return designs.pool_players(players, 16)
		if (v % 28 === 0) return designs.pool_players(players, 28)
		if (v % 40 === 0) return designs.pool_players(players, 40)
		if (v % 52 === 0) return designs.pool_players(players, 52)
		// social golfer semi-solutions
		if (v % 8 === 0) return designs.pool_players(players, 8)
		// misc bibd
		if (v % 9 === 0 && n === 8) return designs.pool_players(players, 9)
		// small youden squares
		if (v % 5 === 0) return designs.pool_players(players, 5)
		if (v % 4 === 0) return designs.pool_players(players, 4)
	}

	if (k === 5) {
		// youden squares
		if (v % 11 === 0) return designs.pool_players(players, 11)
		if (v % 21 === 0) return designs.pool_players(players, 21)
		// resolvable bibd
		if (v % 25 === 0) return designs.pool_players(players, 25)
		// small youden squares
		if (v % 6 === 0) return designs.pool_players(players, 6)
		if (v % 5 === 0) return designs.pool_players(players, 5)
	}

	if (k === 6) {
		// youden squares / bibd
		if (v % 11 === 0) return designs.pool_players(players, 11)
		if (v % 16 === 0) return designs.pool_players(players, 16)
		if (v % 31 === 0) return designs.pool_players(players, 31)
		// small youden squares
		if (v % 7 === 0) return designs.pool_players(players, 7)
		if (v % 6 === 0) return designs.pool_players(players, 6)
	}

	if (k === 7) {
		// youden squares
		if (v % 15 === 0) return designs.pool_players(players, 15)
		// small youden squares
		if (v % 8 === 0) return designs.pool_players(players, 8)
		if (v % 7 === 0) return designs.pool_players(players, 7)
	}

	throw new Error("cannot create pools for this player count")
}

function make_rounds(seed, players) {
	let v = players.length
	let k = seed.player_count
	let n = seed.match_count
	let rounds
	if (seed.is_concurrent)
		rounds = make_concurrent_rounds(v, k, n)
	else
		rounds = make_sequential_rounds(v, k, n)
	return rounds.map(r => r.map(m => m.map(p => players[p])))
}

function make_concurrent_rounds(v, k, n) {
	if (k === 2) {
		if (v - 1 <= n / 2) {
			if (v & 1)
				return designs.concurrent_double_round_robin(v)
			else
				return designs.double_berger_table_flat(v)
		} else {
			if (v & 1)
				return designs.concurrent_round_robin(v)
			else
				return designs.berger_table_flat(v)
		}
	}

	let youden = designs.youden_square(v, k)
	if (youden)
		return [ youden.flat() ]

	let rbibd = designs.concurrent_resolvable_bibd(v, k, n)
	if (rbibd)
		return rbibd

	throw new Error("cannot create rounds for this configuration")
}

function make_sequential_rounds(v, k, n) {
	if (k === 2) {
		if (v - 1 <= n / 2)
			return designs.double_berger_table(v)
		else
			return designs.berger_table(v)
	}

	let youden = designs.youden_square(v, k)
	if (youden)
		return youden

	let rbibd = designs.resolvable_bibd(v, k)
	if (rbibd)
		return rbibd.slice(0, n)

	throw new Error("cannot create rounds for this configuration")
}

function create_tournament(seed, level, players) {
	let pools = make_pools(seed, players)
	for (let i = 0; i < pools.length; ++i)
		create_tournament_pool(seed, level, pools[i])
}

function create_tournament_pool(seed, level, players) {
	let rounds = make_rounds(seed, players)

	let pool_name = seed.seed_name + "." + level + "." + TM_FIND_NEXT_POOL_NUMBER.get(seed.seed_id, level)

	let pool_id = TM_INSERT_POOL.get(seed.seed_id, level, pool_name)

	console.log("TM POOL", pool_name, players.length, "players", rounds.length, "rounds")

	for (let p of players) {
		TM_DELETE_QUEUE.run(p, seed.seed_id, level)
		TM_SPEND_TICKET.run(p, seed.seed_id, level)
	}

	for (let i = 0; i < rounds.length; ++i) {
		for (let match of rounds[i]) {
			create_tournament_game(seed, pool_id, i+1, pool_name, match)
		}
	}
}

function create_tournament_game(seed, pool_id, round, pool_name, players) {
	if (players.length !== seed.player_count)
		throw new Error("player count mismatch in tournament setup")

	let roles = get_game_roles(seed.title_id, seed.scenario, parse_game_options(seed.options))
	if (players.length !== roles.length)
		throw new Error("player count mismatch in tournament setup")

	let now = julianday_from_epoch(Date.now())
	let ctime = now + seed.stagger * (round-1)
	let xtime = ctime + seed.deadline

	let game_id = SQL_INSERT_GAME_MATCH.get(
		0, // owner
		seed.title_id,
		seed.scenario,
		seed.options,
		seed.player_count,
		0, // is_private
		0, // is_random
		pool_name, // notice
		ctime,
		xtime
	)

	for (let i = 0; i < players.length; ++i)
		SQL_INSERT_PLAYER_ROLE.run(game_id, roles[i], players[i], 0)

	TM_INSERT_ROUND.run(game_id, pool_id, round)

	return game_id
}

function filter_queue_through_blacklist(queue, count, blacklist) {
	function can_add_player(pool, b) {
		for (let a of pool) {
			for (let {me, you} of blacklist) {
				if (me === a && you === b)
					return false
				if (me === b && you === a)
					return false
			}
		}
		return true
	}

	function rec(output, input) {
		for (;;) {
			if (output.length === count)
				return output
			if (input.length === 0)
				return false
			let a = input.pop()
			if (can_add_player(output, a)) {
				output.push(a)
				if (rec(output, input.slice()))
					return output
				output.pop()
			}
		}
	}

	return rec([], queue)
}

function start_tournament_seed_mc(seed_id, level) {
	let seed = TM_SELECT_SEED.get(seed_id)
	let queue = TM_SELECT_QUEUE.all(seed_id, level)
	let blacklist = TM_SELECT_QUEUE_BLACKLIST.all(seed_id, level)

	console.log("TM SPAWN SEED (MC)", seed.seed_name, level, queue.length)
	console.log("TM BLACKLIST", blacklist)

	let players = filter_queue_through_blacklist(queue, seed.pool_size, blacklist)
	if (!players) {
		console.log("Too many blacklisted players to form pool!")
		return
	}

	SQL_BEGIN.run()
	try {
		shuffle(players)
		create_tournament(seed, level, players)
		if (!seed.is_open)
			TM_DELETE_QUEUE_SEED.run(seed_id, level)
		SQL_COMMIT.run()
	} catch (error) {
		console.log(error)
	} finally {
		if (db.inTransaction)
			SQL_ROLLBACK.run()
	}
}

function start_tournament_seed(seed_id, level) {
	let seed = TM_SELECT_SEED.get(seed_id)

	if (seed.seed_name.startsWith("mc."))
		return start_tournament_seed_mc(seed_id, level)

	let queue = TM_SELECT_QUEUE.all(seed_id, level)
	console.log("TM SPAWN SEED", seed.seed_name, level, queue.length)

	shuffle(queue)

	SQL_BEGIN.run()
	try {
		create_tournament(seed, level, queue)
		SQL_COMMIT.run()
	} finally {
		if (db.inTransaction)
			SQL_ROLLBACK.run()
	}
}

function tm_reap_pools() {
	// reap pools that are finished (notify players and gain tickets)
	let ended = TM_SELECT_ENDED_POOLS.all()
	for (let item of ended) {
		let seed = TM_SELECT_SEED.get(item.seed_id)
		let players = TM_SELECT_PLAYERS_IN_POOL.all(item.pool_id)

		console.log("TM POOL FINISHED", item.pool_name)

		SQL_BEGIN.run()
		try {
			TM_UPDATE_POOL_FINISHED.run(item.pool_id)

			if (seed.seed_name.startsWith("mc.")) {
				let winners = TM_SELECT_WINNERS_IN_POOL.all(item.pool_id)
				for (let winner of winners) {
					if (item.level > 1)
						TM_GAIN_TICKET.run(winner.user_id, item.seed_id, item.level)
					TM_GAIN_TICKET.run(winner.user_id, item.seed_id, item.level+1)
				}
			}

			SQL_COMMIT.run()
		} finally {
			if (db.inTransaction)
				SQL_ROLLBACK.run()
		}

		for (let user of players)
			send_tour_notification(user, item.pool_name, "Finished")
	}
}

function tm_start_ready_seeds() {
	// start seeds that are ready
	for (let item of TM_SELECT_SEED_READY_MINI_CUP.all())
		start_tournament_seed_mc(item.seed_id, item.level)
}

function tm_start_ready_games() {
	// start scheduled tournament games
	for (var game of TM_SELECT_READY_GAMES.all())
		start_game(game)
}

function tournament_ticker() {
	try {
		tm_reap_pools()
		tm_start_ready_seeds()
		tm_start_ready_games()
	} catch (error) {
		console.log(error)
	}
}

if (app.locals.ENABLE_TOURNAMENTS) {
	setTimeout(tournament_ticker, 19 * 1000)
	setInterval(tournament_ticker, 97 * 1000)
}

const TM_INSERT_SEED = SQL(`
	insert into tm_seeds
		(
			seed_name,
			title_id, scenario, options, player_count,
			pool_size, match_count, is_concurrent,
			is_open
		) values (
			:seed_name,
			:title_id, :scenario, :options, :player_count,
			:pool_size, :match_count, :is_concurrent,
			false
		)
		returning seed_id
`).pluck()

const TM_UPDATE_SEED = SQL(`
	update tm_seeds set
		seed_name=:seed_name,
		title_id=:title_id,
		scenario=:scenario,
		options=:options,
		player_count=:player_count,
		pool_size=:pool_size,
		match_count=:match_count,
		is_concurrent=:is_concurrent,
		stagger=:stagger,
		deadline=:deadline,
		level_count=:level_count,
		is_open=:is_open
	where seed_id=:seed_id
`)

app.get("/tm/edit", must_be_administrator, function (req, res) {
	let seeds = TM_SELECT_SEED_ALL.all()
	res.render("tm_edit_list.pug", { user: req.user, seeds })
})

app.post("/tm/edit/new", must_be_administrator, function (req, res) {
	var seed_name = req.body.seed_name
	var title_id = req.body.title_id
	var scenario = RULES[title_id].tournament_scenario ?? RULES[title_id].scenarios[0] ?? "Standard"
	var options = RULES[title_id].tournament_options ?? {}
	var player_count = get_game_roles(title_id, scenario, options).length

	var pool_size = 5, match_count = 4, is_concurrent = 1

	if (player_count === 3 && TITLE_TABLE[title_id].is_symmetric)
		pool_size = 9, match_count = 4, is_concurrent = 0
	else if (player_count === 3)
		pool_size = 9, match_count = 3, is_concurrent = 0

	else if (player_count === 4 && TITLE_TABLE[title_id].is_symmetric)
		pool_size = 16, match_count = 5, is_concurrent = 0
	else if (player_count === 4)
		pool_size = 16, match_count = 4, is_concurrent = 0

	else if (player_count === 5)
		pool_size = 25, match_count = 5, is_concurrent = 0
	else if (player_count === 6)
		pool_size = 16, match_count = 6, is_concurrent = 0
	else if (player_count === 7)
		pool_size = 15, match_count = 7, is_concurrent = 0

	TM_INSERT_SEED.run({
		seed_name,
		title_id, scenario, options: JSON.stringify(options), player_count,
		pool_size, match_count, is_concurrent
	})
	res.redirect("/tm/edit/" + seed_name)
})

function preview_match_incidence(v, rounds) {
	var i, k, m
	var incidence = []
	for (i = 0; i < v; ++i)
		incidence[i] = new Array(v).fill(0)
	for (m of rounds.flat()) {
		for (i = 0; i < m.length; ++i) {
			for (k = i+1; k < m.length; ++k) {
				incidence[m[i]][m[k]]++
				incidence[m[k]][m[i]]++
			}
		}
	}
	return incidence
}

function preview_match_concurrency(v, rounds) {
	var concurrency = []
	for (var r of rounds) {
		var row = new Array(v).fill(0)
		for (var m of r)
			for (var p of m)
				row[p]++
		concurrency.push(row)
	}
	return concurrency
}

function preview_match_repeats(v, k, rounds) {
	var i, m
	var repeats = []
	for (i = 0; i < k; ++i)
		repeats[i] = new Array(v).fill(0)
	for (m of rounds.flat())
		for (i = 0; i < m.length; ++i)
			repeats[i][m[i]]++
	return repeats
}

app.get("/tm/edit/:seed_name", must_be_administrator, function (req, res) {
	var seed_name = req.params.seed_name
	var seed = TM_SELECT_SEED_BY_NAME.get(seed_name)
	if (!seed)
		return res.status(404).send("Tournament seed not found.")
	var preview, number_preview, incidence, concurrency, repeats
	try {
		number_preview = make_rounds(seed, new Array(seed.pool_size).fill(0).map((_,i)=>i))
		preview = make_rounds(seed, new Array(seed.pool_size).fill(0).map((_,i)=>String.fromCharCode(65+i)))
		var n = preview.flat().flat().join("").match(/A/g).length
		if (n !== seed.match_count)
			throw new Error("match count mismatch (should be " + n + ")")
		incidence = preview_match_incidence(seed.pool_size, number_preview)
		concurrency = preview_match_concurrency(seed.pool_size, number_preview)
		repeats = preview_match_repeats(seed.pool_size, seed.player_count, number_preview)
	} catch (error) {
		console.log(error)
		preview = error.toString()
	}
	res.render("tm_edit.pug", { user: req.user, seed, preview, incidence, concurrency, repeats })
})

app.post("/tm/edit", must_be_administrator, function (req, res) {
	let seed = req.body
	seed.options = JSON.stringify(JSON.parse(seed.options))
	seed.player_count = get_game_roles(seed.title_id, seed.scenario, seed.options).length
	seed.seed_id |= 0
	seed.pool_size |= 0
	seed.match_count |= 0
	seed.is_concurrent |= 0
	seed.is_open |= 0
	seed.level_count |= 0
	seed.stagger = Number(seed.stagger)
	seed.deadline = Number(seed.deadline)
	TM_UPDATE_SEED.run(seed)
	res.redirect("/tm/edit/" + seed.seed_name)
})

/*
 * GAME SERVER
 */

function is_role_active(active, role) {
	return active === role || active === "Both" || active.includes(role)
}

function is_nobody_active(active) {
	return active === "None" || active === null
}

function is_multi_active(active) {
	if (!active)
		return false
	if (Array.isArray(active))
		return true
	return active === "Both" || active.includes(",")
}

function is_changed_active(old_active, new_active) {
	return String(old_active) !== String(new_active)
}

function is_player_online(game_id, user_id) {
	if (game_clients[game_id])
		for (let other of game_clients[game_id])
			if (other.user && other.user.user_id === user_id)
				return true
	return false
}

function send_message(socket, cmd, arg) {
	socket.send(JSON.stringify([ cmd, arg ]))
}

function send_error(socket, error) {
	console.log(error.stack)
	send_message(socket, "error", error.toString())
}

function swap_player_roles(socket) {
	let game = SQL_SELECT_GAME.get(socket.game_id)
	let roles = get_game_roles(game.title_id, game.scenario, game.options)
	console.log("PIE RULE SWAP", socket.game_id, roles[0], "<->", roles[1])
	SQL_UPDATE_PLAYER_ROLE.run("PIE0", socket.game_id, roles[0])
	SQL_UPDATE_PLAYER_ROLE.run("PIE1", socket.game_id, roles[1])
	SQL_UPDATE_PLAYER_ROLE.run(roles[1], socket.game_id, "PIE0")
	SQL_UPDATE_PLAYER_ROLE.run(roles[0], socket.game_id, "PIE1")
	let players = SQL_SELECT_PLAYERS_WITH_NAME.all(socket.game_id)
	let player_roles = roles.map(r => ({ role: r, name: players.find(p => p.role === r)?.name }))
	if (game_clients[socket.game_id]) {
		for (let other of game_clients[socket.game_id]) {
			if (other.role === roles[0])
				other.role = roles[1]
			else if (other.role === roles[1])
				other.role = roles[0]
			send_message(other, "pie", [ other.role, player_roles ])
		}
	}
}

function send_state(socket, state) {
	try {
		let is_finished = is_nobody_active(state.active)
		let view = RULES[socket.title_id].view(state, socket.role, is_finished)
		socket.actions = view.actions // remember actions for validation
		if (socket.seen < view.log.length)
			view.log_start = socket.seen
		else
			view.log_start = view.log.length
		socket.seen = view.log.length
		view.log = view.log.slice(view.log_start)
		let this_view = JSON.stringify(view)
		if (view.actions || socket.last_view !== this_view) {
			socket.send('["state",' + this_view + "," + game_cookies[socket.game_id][socket.role] + "]")
			socket.last_view = this_view
		}
		if (is_finished) {
			socket.send('["finished"]')
		}
	} catch (error) {
		return send_error(socket, error)
	}
}

function get_game_state(game_id) {
	let game_state = SQL_SELECT_GAME_STATE.get(game_id)
	if (ENABLE_ARCHIVE) {
		if (!game_state)
			game_state = ARCHIVE_SELECT_GAME_STATE.get(game_id)
	}
	if (!game_state)
		throw new Error("No game with that ID")
	return JSON.parse(game_state)
}

function sync_client_state_for_title(title_id) {
	for (let game_id in game_clients)
		for (let socket of game_clients[game_id])
			if (socket.title_id === title_id)
				send_state(socket, get_game_state(socket.game_id))
}

function snap_from_state(state) {
	// return JSON of game state without undo and with log replaced by log length
	let save_undo = state.undo
	let save_log = state.log
	state.undo = undefined
	state.log = save_log.length
	let snap = JSON.stringify(state)
	state.undo = save_undo
	state.log = save_log
	return snap
}

function put_replay(game_id, role, action, args) {
	if (args !== undefined && args !== null && typeof args !== "number")
		args = JSON.stringify(args)
	return SQL_INSERT_REPLAY.get(game_id, game_id, role, action, args)
}

function dont_snap(rules, state, old_active) {
	if (is_nobody_active(state.active))
		return true
	if (is_multi_active(old_active) && is_multi_active(state.active))
		return true
	if (!is_changed_active(old_active, state.active))
		return true
	if (rules.dont_snap && rules.dont_snap(state))
		return true
	return false
}

function delete_snaps_after_rollback(game_id, new_log_len) {
	let broken = SQL_DELETE_GAME_SNAP_ROLLBACK.all(game_id, new_log_len)
	for (let snap_id of broken)
		console.log("DELETE SNAPSHOT AFTER ROLLBACK", snap_id)
}

function put_snap(game_id, replay_id, state) {
	let snap_id = SQL_INSERT_SNAP.get(game_id, game_id, replay_id, snap_from_state(state), state.log.length, fnv1a_log(state.log))
	if (game_clients[game_id])
		for (let other of game_clients[game_id])
			send_message(other, "snapsize", snap_id)
}

function update_game_scores(title_id, game_id, state, result, did_timeout) {
	var roles = SQL_SELECT_ROLES.all(game_id)
	var role, points
	if (state && RULES[title_id].tournament_points) {
		points = RULES[title_id].tournament_points(state)
		for (role of roles)
			SQL_UPDATE_SCORE.run(points[role], game_id, role)
	} else {
		for (role of roles) {
			var s = 0
			if (result == role)
				s = 2
			else if (result == "Draw" || result.includes(role))
				s = 1
			else if (result == "None" || result == null || did_timeout)
				s = null
			SQL_UPDATE_SCORE.run(s, game_id, role)
		}
	}
}

function put_new_state(title_id, game_id, state, old_active, role, action, args, is_move, is_rollback) {
	SQL_BEGIN.run()
	try {
		let replay_id = put_replay(game_id, role, action, args)

		if (is_rollback)
			delete_snaps_after_rollback(game_id, state.log.length)

		if (game_clients[game_id])
			for (let other of game_clients[game_id])
				send_state(other, state)

		if (!dont_snap(RULES[title_id], state, old_active))
			put_snap(game_id, replay_id, state)

		SQL_INSERT_GAME_STATE.run(game_id, JSON.stringify(state))

		if (is_nobody_active(state.active)) {
			update_game_scores(title_id, game_id, state, state.result, action === ".timeout")
			SQL_FINISH_GAME.run(
				is_move,
				state.result,
				Number(action === ".resign"),
				Number(action === ".timeout"),
				game_id
			)
			if (state.result && state.result !== "None")
				update_elo_ratings(game_id)
		} else {
			if (is_changed_active(old_active, state.active))
				SQL_UPDATE_GAME_ACTIVE.run(String(state.active), game_id)
		}

		if (is_nobody_active(state.active))
			send_game_finished_notification_to_offline_users(game_id, state.result)
		else
			send_your_turn_notification_to_offline_users(game_id, old_active, state.active)

		SQL_COMMIT.run()
	} finally {
		if (db.inTransaction)
			SQL_ROLLBACK.run()
	}
}

function is_valid_action(view_actions, verb, noun) {
	if (!view_actions)
		return false

	var va = view_actions[verb]

	// simple action
	if (va === 1 || va === true || typeof va === "string")
		return (noun === undefined || noun === null || typeof noun === "object")

	// thing action
	if (Array.isArray(va))
		return (va.includes(noun) || (Array.isArray(noun) && va.includes(noun[0])))

	return false
}

function on_action(socket, action, args, cookie) {
	if (args !== null)
		SLOG(socket, "ACTION", action, JSON.stringify(args))
	else
		SLOG(socket, "ACTION", action)

	if (game_cookies[socket.game_id][socket.role] !== cookie) {
		send_state(socket, get_game_state(socket.game_id))
		send_message(socket, "warning", "Synchronization error!")
		return
	}

	if (!is_valid_action(socket.actions, action, args)) {
		send_state(socket, get_game_state(socket.game_id))
		send_message(socket, "warning", "Invalid action!")
		return
	}

	try {
		let state = get_game_state(socket.game_id)
		let old_log_length = state.log.length
		let old_active = String(state.active)
		let role = socket.role

		game_cookies[socket.game_id][socket.role] ++

		state = RULES[socket.title_id].action(state, role, action, args)

		if (state.$pie) {
			if (state.$pie.swap) {
				// NOTE: Force update of is_active on players table,
				// and trigger your turn notifications with the new
				// role assignments.
				old_active = ""
				swap_player_roles(socket)
			}
			if (state.$pie.scenario)
				SQL_UPDATE_GAME_SCENARIO.run(state.$pie.scenario, socket.game_id)
			delete state.$pie
		}

		put_new_state(socket.title_id, socket.game_id, state,
			old_active,
			role, action, args,
			1,
			(action !== "undo" && state.log.length < old_log_length)
		)
	} catch (error) {
		send_error(socket, error)
	}
}

function on_resign(socket) {
	SLOG(socket, "RESIGN")
	try {
		do_resign(socket.game_id, socket.role, ".resign", socket.role + " resigned.")
	} catch (error) {
		send_error(socket, error)
	}
}

function get_resign_result(game, losers) {
	if (game.player_count < 2)
		return "None"
	var roles = get_game_roles(game.title_id, game.scenario, game.options)
	var winners = roles.filter(x => losers !== x && !losers.includes(x))
	if (winners.length === 0)
		return "None"
	if (winners.length === 1)
		return winners[0]
	return winners.join(", ")
}

function do_resign(game_id, role, replay_action, message) {
	let game = SQL_SELECT_GAME.get(game_id)
	let state = get_game_state(game_id)
	let old_active = String(state.active)

	let result = get_resign_result(game, role)

	state = finish_game_state(game.title_id, state, result, message)

	put_new_state(game.title_id, game_id, state, old_active, role, replay_action, result, 0, false)
}

function finish_game_state(title_id, state, result, message) {
	if (typeof RULES[title_id].finish === "function") {
		state = RULES[title_id].finish(state, result, message)
	} else {
		state.state = "game_over"
		state.active = "None"
		state.result = result
		state.victory = message
		state.log.push("")
		state.log.push(message)
	}
	return state
}

function on_query(socket, q, params) {
	SLOG(socket, "QUERY", q, JSON.stringify(params))
	try {
		if (RULES[socket.title_id].query) {
			let state = get_game_state(socket.game_id)
			let reply = RULES[socket.title_id].query(state, socket.role, q, params)
			send_message(socket, "reply", [ q, reply ])
		}
	} catch (error) {
		send_error(socket, error)
	}
}

function on_query_snap(socket, snap_id, q, params) {
	SLOG(socket, "QUERYSNAP", snap_id, JSON.stringify(params))
	try {
		if (RULES[socket.title_id].query) {
			let state = JSON.parse(SQL_SELECT_SNAP_STATE.get(socket.game_id, snap_id))
			let reply = RULES[socket.title_id].query(state, socket.role, q, params)
			send_message(socket, "reply", [ q, reply ])
		}
	} catch (error) {
		send_error(socket, error)
	}
}

function on_getnote(socket) {
	try {
		let note = SQL_SELECT_GAME_NOTE.get(socket.game_id, socket.role)
		if (note) {
			SLOG(socket, "GETNOTE", note.length)
			send_message(socket, "note", note)
		} else {
			SLOG(socket, "GETNOTE null")
			send_message(socket, "note", "")
		}
	} catch (error) {
		send_error(socket, error)
	}
}

function on_putnote(socket, note) {
	try {
		SLOG(socket, "PUTNOTE", note.length)
		if (note.length > 0)
			SQL_UPDATE_GAME_NOTE.run(socket.game_id, socket.role, note)
		else
			SQL_DELETE_GAME_NOTE.run(socket.game_id, socket.role)

		// update other connected clients from same player
		if (game_clients[socket.game_id]) {
			for (let other of game_clients[socket.game_id]) {
				if (other !== socket && other.role === socket.role)
					send_message(other, "note", note)
			}
		}

	} catch (error) {
		send_error(socket, error)
	}
}

function on_getchat_observer(socket, seen) {
	try {
		let chat = SQL_SELECT_GAME_CHAT.all(socket.game_id, seen)
		if (chat.length > 0)
			SLOG(socket, "GETCHAT", seen, chat.length)
		for (let i = 0; i < chat.length; ++i)
			send_message(socket, "chat", chat[i])
	} catch (error) {
		send_error(socket, error)
	}
}

function on_getchat(socket, seen) {
	try {
		let chat = SQL_SELECT_GAME_CHAT.all(socket.game_id, seen)
		if (chat.length > 0)
			SLOG(socket, "GETCHAT", seen, chat.length)
		for (let i = 0; i < chat.length; ++i)
			send_message(socket, "chat", chat[i])
		SQL_DELETE_UNREAD_CHAT.run(socket.user.user_id, socket.game_id)
	} catch (error) {
		send_error(socket, error)
	}
}

function on_chat(socket, message) {
	message = message.substring(0, 4000)
	try {
		SLOG(socket, "CHAT")
		send_chat_message(socket.game_id, socket.user.user_id, message)
	} catch (error) {
		send_error(socket, error)
	}
}

function send_chat_message(game_id, from_id, message) {
	SQL_INSERT_GAME_CHAT.run(game_id, game_id, from_id, message)

	let players = SQL_SELECT_PLAYERS.all(game_id)
	for (let p of players) {
		let unread = SQL_SELECT_UNREAD_CHAT.get(p.user_id, game_id)
		if (!unread) {
			SQL_INSERT_UNREAD_CHAT.run(p.user_id, game_id)
			if (!is_player_online(game_id, p.user_id))
				send_chat_activity_notification(game_id, p)
		}
	}

	if (game_clients[game_id]) {
		for (let other of game_clients[game_id])
			if (other.role !== "Observer")
				send_message(other, "newchat", 1)
	}
}

function on_snap(socket, snap_id) {
	SLOG(socket, "SNAP", snap_id)
	try {
		let snap_state = SQL_SELECT_SNAP_STATE.get(socket.game_id, snap_id)
		if (snap_state) {
			let state = JSON.parse(snap_state)
			let view = RULES[socket.title_id].view(state, socket.role, false)
			view.prompt = undefined
			view.actions = undefined
			view.log = state.log
			send_message(socket, "snap", [ snap_id, state.active, view ])
		} else {
			send_message(socket, "nosnap", snap_id)
		}
	} catch (error) {
		send_error(socket, error)
	}
}

function broadcast_presence(game_id) {
	let presence = []
	for (let socket of game_clients[game_id])
		if (!presence.includes(socket.role))
			presence.push(socket.role)
	for (let socket of game_clients[game_id])
		send_message(socket, "presence", presence)
}

function handle_player_message(socket, cmd, arg) {
	switch (cmd) {
	case "action":
		on_action(socket, arg[0], arg[1], arg[2])
		break
	case "query":
		on_query(socket, arg[0], arg[1])
		break
	case "resign":
		on_resign(socket)
		break
	case "getnote":
		on_getnote(socket)
		break
	case "putnote":
		on_putnote(socket, arg)
		break
	case "getchat":
		on_getchat(socket, arg)
		break
	case "chat":
		on_chat(socket, arg)
		break
	case "getsnap":
		on_snap(socket, arg | 0)
		break
	case "querysnap":
		on_query_snap(socket, arg[0], arg[1], arg[2])
		break
	default:
		send_message(socket, "error", "Invalid server command: " + cmd)
		break
	}
}

function handle_observer_message(socket, cmd, arg) {
	switch (cmd) {
	case "getchat":
		if (socket.user.is_moderator)
			on_getchat_observer(socket, arg)
		break
	case "getsnap":
		on_snap(socket, arg)
		break
	case "querysnap":
		on_query_snap(socket, arg[0], arg[1], arg[2])
		break
	case "query":
		on_query(socket, arg[0], arg[1])
		break
	default:
		send_message(socket, "error", "Invalid server command: " + cmd)
		break
	}
}

wss.on("connection", (socket, req) => {
	let u = URL.parse(req.url, SITE_URL)
	if (!u || u.pathname !== "/play-socket")
		return setTimeout(() => socket.close(1000, "Invalid request."), 30000)
	req.searchParams = u.searchParams

	let ip = req.headers["x-forwarded-for"] || req.ip || req.connection.remoteAddress || "0.0.0.0"

	let user_id = 0
	let sid = login_cookie(req)
	if (sid)
		user_id = login_sql_select.get(sid)
	if (user_id) {
		socket.user = SQL_SELECT_USER_FOR_PLAY.get(user_id)
		SQL_UPDATE_USER_LAST_SEEN.run(user_id, ip)
	} else {
		return socket.close(1000, "You are not logged in!")
	}

	socket.ip = ip
	socket.title_id = req.searchParams.get("title") || "unknown"
	socket.game_id = req.searchParams.get("game") | 0
	socket.role = req.searchParams.get("role")
	socket.seen = req.searchParams.get("seen") | 0
	let log_hash = req.searchParams.get("hash") | 0
	let is_reconnect = req.searchParams.get("reconnect") | 0

	SLOG(socket, "OPEN " + socket.seen)

	try {
		let game = SQL_SELECT_GAME.get(socket.game_id)
		if (!game || game.title_id !== socket.title_id)
			return socket.close(1000, "Invalid game ID.")

		let players = SQL_SELECT_PLAYERS_WITH_NAME.all(socket.game_id)

		if (socket.role !== "Observer") {
			if (!players.find(p => p.user_id === socket.user.user_id && p.role === socket.role))
				return socket.close(1000, "You aren't assigned that role!")
		}

		let state = get_game_state(socket.game_id)

		if (!is_reconnect) {
			let roles = get_game_roles(game.title_id, game.scenario, game.options)
			send_message(socket, "players", [
				socket.role,
				roles.map(r => ({ role: r, name: players.find(p => p.role === r)?.name })),
				game.scenario,
				parse_game_options(game.options),
				get_game_static_view(game.title_id, state)
			])
			let note = SQL_SELECT_GAME_NOTE.get(socket.game_id, socket.role)
			if (note) {
				send_message(socket, "note", note)
			}
		}

		if (socket.role !== "Observer") {
			send_message(socket, "newchat",
				SQL_SELECT_UNREAD_CHAT.get(socket.user.user_id, socket.game_id)
			)

			if (game.status === 2)
				SQL_DELETE_UNSEEN_GAME.run(user_id, socket.game_id)
		}

		if (socket.role === "Observer" && socket.user.is_moderator) {
			send_message(socket, "newchat",
				SQL_SELECT_MODERATOR_CHAT.get(socket.game_id)
			)
		}

		if (game_clients[socket.game_id]) {
			game_clients[socket.game_id].push(socket)
		} else {
			game_clients[socket.game_id] = [ socket ]
			game_cookies[socket.game_id] = {}
		}

		game_cookies[socket.game_id][socket.role] ??= 1

		socket.on("close", (code) => {
			SLOG(socket, "CLOSE " + code)
			game_clients[socket.game_id].splice(game_clients[socket.game_id].indexOf(socket), 1)
			if (game_clients[socket.game_id].length > 0) {
				broadcast_presence(socket.game_id)
			} else {
				delete game_clients[socket.game_id]
				delete game_cookies[socket.game_id]
			}
		})

		socket.on("error", (error) => {
			SLOG(socket, "ERROR" + error)
			socket.close(1000, error.toString())
		})

		socket.on("message", (data) => {
			try {
				let [ cmd, arg ] = JSON.parse(data)
				if (socket.role !== "Observer")
					handle_player_message(socket, cmd, arg)
				else
					handle_observer_message(socket, cmd, arg)
			} catch (error) {
				send_error(socket, error)
			}
		})

		broadcast_presence(socket.game_id)

		let last_snap_id = SQL_SELECT_SNAP_COUNT.get(socket.game_id)
		if (last_snap_id) {
			send_message(socket, "snapsize", last_snap_id)
			if (socket.seen > 0 && !SQL_SELECT_SNAP_LOG_HASH.get(socket.game_id, last_snap_id, socket.seen, log_hash))
				socket.seen = 0
		} else {
			socket.seen = 0
		}

		send_state(socket, state)
	} catch (error) {
		console.log(error)
		socket.close(1000, error.message)
	}
})

/*
 * DOCUMENTATION - MARKDOWN
 */

function render_docs(res, path) {
	if (fs.existsSync(path)) {
		var body = marked.parse(fs.readFileSync(path, "utf-8"))
		var title = body.match(/<h1>([^>]*)<\/h1>/)?.[1] ?? path
		res.render("docs.pug", { title, body })
	} else {
		res.status(404).send("Not found")
	}
}

app.get("/docs", function (req, res) {
	res.redirect("/docs/index")
})

app.get("/docs/:file", function (req, res) {
	var file = req.params.file
	if (!file.endsWith(".md"))
		file += ".md"
	render_docs(res, "docs/" + file)
})

app.get("/docs/:dir/:file", function (req, res) {
	var file = req.params.file
	if (!file.endsWith(".md"))
		file += ".md"
	render_docs(res, "docs/" + req.params.dir + "/" + file)
})

/*
 * HIDDEN EXTRAS
 */

const SQL_GAME_STATS = SQL(`
	select
		title_id, player_count, scenario,
		group_concat(final_result, '%') as result_role,
		group_concat(n, '%') as result_count,
		sum(n) as total
	from
		(
			select
				title_id,
				player_count,
				scenario,
				case when instr(result, ',') > 0 then 'Tie' else result end as final_result,
				count(1) as n
			from
				rated_games_view
			where
				( title_id not in ( select title_id from titles where is_symmetric ) )
			group by
				title_id,
				player_count,
				scenario,
				final_result
			order by
				case final_result when 'Tie' then 1 when 'Draw' then 1 else 0 end,
				n desc
		)
	group by
		title_id, player_count, scenario
	having
		total > 12
	`)

const SQL_TOP_FINISHED = SQL(`
	select
		count(1) as n, title_id
	from
		rated_games_view
	group by
		title_id
	order by
		n desc
	limit 10
`)

const SQL_TOP_RECENT = SQL(`
	select
		count(1) as n, title_id
	from
		rated_games_view
		games
	where
		julianday(mtime) > julianday('now', '-28 days')
	group by
		title_id
	order by
		n desc
	limit 10
`)

const SQL_TOP_ACTIVE = SQL(`
	select
		count(1) as n, title_id
	from
		games
	where
		is_opposed and status=1 and moves>0
	group by
		title_id
	order by
		n desc
	limit 10
`)

app.get("/stats", must_be_logged_in, function (req, res) {
	let stats = SQL_GAME_STATS.all()
	let top_finished = SQL_TOP_FINISHED.all()
	let top_recent = SQL_TOP_RECENT.all()
	let top_active = SQL_TOP_ACTIVE.all()
	stats.forEach(row => {
		row.title_name = TITLE_NAME[row.title_id]
		row.result_role = row.result_role.split("%")
		row.result_count = row.result_count.split("%").map(Number)
	})
	res.render("stats_index.pug", { stats, top_finished, top_recent, top_active })
})

const SQL_USER_STATS = SQL(`
	select
		titles.title_name,
		scenario,
		role,
		sum(score) / 2 as won,
		count(*) as total
	from
		players
		join game_view using(game_id)
		join titles using(title_id)
	where
		not is_symmetric
		and user_id = ?
		and is_opposed
		and ( status = ${STATUS_FINISHED} or status = ${STATUS_ARCHIVED} )
		and result != 'None'
	group by
		titles.title_name,
		scenario,
		role
	union
	select
		titles.title_name,
		scenario,
		null as role,
		sum(score) / 2 as won,
		count(*) as total
	from
		players
		join game_view using(game_id)
		join titles using(title_id)
	where
		is_symmetric
		and user_id = ?
		and is_opposed
		and ( status = ${STATUS_FINISHED} or status = ${STATUS_ARCHIVED} )
		and result != 'None'
	group by
		titles.title_name,
		scenario
	`)

const SQL_USER_RATINGS = SQL(`
	select title_id, title_name, rating, count, date(last) as last
	from ratings
	join titles using(title_id)
	where user_id = ?
	and count >= 3
	order by count desc
	`)

const SQL_GAME_RATINGS = SQL(`
	select name, rating, count, date(last) as last
	from ratings
	join users using(user_id)
	where title_id = ? and rating >= 1600 and count >= 10
	order by rating desc
	limit 50
	`)

app.get("/stats/user/:who_name", must_be_administrator, function (req, res) {
	let who = SQL_SELECT_USER_BY_NAME.get(req.params.who_name)
	if (who) {
		let stats = SQL_USER_STATS.all(who.user_id, who.user_id)
		let ratings = SQL_USER_RATINGS.all(who.user_id)
		res.render("stats_user.pug", { who, stats, ratings })
	} else {
		return res.status(404).send("Invalid user name.")
	}
})

app.get("/stats/title/:title_id", must_be_administrator, function (req, res) {
	let title_id = req.params.title_id
	if (title_id in TITLE_TABLE) {
		let title_name = TITLE_NAME[title_id]
		let ratings = SQL_GAME_RATINGS.all(title_id)
		res.render("stats_title.pug", { title_name, ratings })
	} else {
		return res.status(404).send("Invalid title.")
	}
})
