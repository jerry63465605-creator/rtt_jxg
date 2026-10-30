/*
 * debug_replay.js — RTT 真实对局离线复现 / 验证工具（常驻）
 * ------------------------------------------------------------------
 * 用途：把"线上真实游戏状态"喂给"当前 rules.js"跑一遍，用来离线复现崩溃、
 *       验证补丁、排查挂起窗口，避免每次都在浏览器手动操作。
 *
 * 与一次性 _dbg_*.js 脚本的区别：参数化、可重复、可写回。
 *
 * 依赖：better-sqlite3 用 server-official/node_modules 的绝对路径（tools/ 下
 *       裸 require 会找不到模块，见 setup_manual_test.js 同款写法）。
 *
 * 用法：
 *   # 只看某局的诊断 + 视图（不改动）
 *   node tools/debug_replay.js --game 19 --role Allies --view
 *
 *   # 跑一个动作（如英国替美国打租借法案的牌）
 *   # 注意：PowerShell 会吃掉双引号，推荐用 --params-file 传参（最稳）：
 *   node tools/debug_replay.js --game 19 --role Allies \
 *       --action resolve_us_lend_lease_play --params-file tools/_p.json
 *   # 或直接内联（在 bash / 用单引号包裹时可用）：
 *   node tools/debug_replay.js --game 19 --role Allies \
 *       --action resolve_us_lend_lease_play --params "{'nation':'英国','card':'15322#15'}"
 *
 *   # 跑动作并写回数据库（危险，默认关闭，需显式 --save）
 *   node tools/debug_replay.js --game 19 --role Allies \
 *       --action play_card --params "{'card':'15322#15'}" --save
 *
 *   # 发一个 query（只读）
 *   node tools/debug_replay.js --game 19 --role Allies \
 *       --query counter_airs --params "{'space':8}"
 *
 * 参数：
 *   --game <N>          对局 id（必填）
 *   --role <R>          ROLE 名大写 'Axis' / 'Allies'（跑 action/view/query 时需要）
 *   --title <T>         模块 title_id（默认 quartermaster-sub-wars）
 *   --action <A>        动作名（如 play_card / resolve_us_lend_lease_play）
 *   --params <JSON>     动作/query 参数对象（支持单引号 JSON 兜底）
 *   --params-file <P>   从文件读取参数 JSON（推荐，避免 shell 吞引号）
 *   --query <Q>         只读 query 名（与 --action 互斥）
 *   --view              动作后打印 rules.view() 摘要
 *   --save              把修改后的 state 写回 game_state 表（默认只打印不写）
 *   --db <path>         sqlite 文件路径（默认 server-official/db）
 */

const path = require("path");
const fs = require("fs");

const SERVER = path.join(__dirname, "..", "server-official");
const TITLE_DEFAULT = "quartermaster-sub-wars";

/* ---------- 极简 CLI 解析（无第三方依赖） ---------- */
function parseArgs(argv) {
	const o = { game: null, role: null, title: TITLE_DEFAULT, action: null, query: null,
	            params: null, paramsFile: null, view: false, save: false, db: path.join(SERVER, "db") };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--game") o.game = parseInt(argv[++i], 10);
		else if (a === "--role") o.role = argv[++i];
		else if (a === "--title") o.title = argv[++i];
		else if (a === "--action") o.action = argv[++i];
		else if (a === "--query") o.query = argv[++i];
		else if (a === "--params") o.params = argv[++i];
		else if (a === "--params-file") o.paramsFile = argv[++i];
		else if (a === "--view") o.view = true;
		else if (a === "--save") o.save = true;
		else if (a === "--db") o.db = argv[++i];
	}
	return o;
}

/* 宽松解析参数 JSON：
 *   - 优先标准 JSON.parse；
 *   - 失败则尝试"单引号 JSON"：把 ' 换成 "（CLI 里用单引号包裹键值可避免 shell 吞双引号）。
 *   注意：仅当字符串确实含单引号时才做此替换，避免误伤正常 JSON 里的字符。 */
function parseParams(raw) {
	try { return JSON.parse(raw); }
	catch (e1) {
		if (raw.indexOf("'") === -1) throw e1;
		const fixed = raw.replace(/'/g, '"');
		try { return JSON.parse(fixed); }
		catch (e2) { throw e1; }
	}
}

/* ---------- 加载模块 ---------- */
function loadRules(title) {
	const DIR = path.join(SERVER, "public", title);
	if (!fs.existsSync(path.join(DIR, "rules.js")))
		throw new Error("找不到模块 rules.js: " + DIR);
	return require(path.join(DIR, "rules.js"));
}

/* ---------- 数据库 ---------- */
function openDB(dbPath) {
	if (!fs.existsSync(dbPath)) throw new Error("找不到数据库文件: " + dbPath);
	const sqlite3 = require(path.join(SERVER, "node_modules", "better-sqlite3"));
	return new sqlite3(dbPath);
}

/* ---------- 诊断打印 ---------- */
function handsSummary(g) {
	if (!g.hands) return "hands=undefined";
	const parts = [];
	for (const n of Object.keys(g.hands))
		parts.push(n + ":" + (g.hands[n] ? g.hands[n].length : 0));
	return parts.join(" ");
}
function diag(g, label) {
	const nat = g.national_skill_offer ? g.national_skill_offer.nation : "-";
	const armed = (g.armed_offers || []).flatMap(w => (w.cards || []).map(c => c.card_id));
	const econ = g.pending_econ ? g.pending_econ.waiting_for : "-";
	console.log(
		`[${label}] cur=${g.current_nation} active=${g.active} phase=${g.turn_phase} turn=${g.turn}\n` +
		`        respQ=${(g.response_queue || []).length} natSkill=${nat}\n` +
		`        armed=[${armed.join(",")}] pendingEcon=${econ}\n` +
		`        usLendLease=${g.us_lend_lease ? JSON.stringify(g.us_lend_lease) : "-"} ` +
		`statusInstant=${(g.status_instant || []).length}\n` +
		`        hands={ ${handsSummary(g)} } logLen=${g.log.length}`
	);
}

/* ---------- 主流程 ---------- */
function main() {
	const o = parseArgs(process.argv.slice(2));
	if (o.game == null) { console.error("用法: node tools/debug_replay.js --game <N> [--role R] [--action A | --query Q] [--params JSON] [--view] [--save]"); process.exit(2); }

	const rules = loadRules(o.title);
	const db = openDB(o.db);
	const stateJson = db.prepare("select state from game_state where game_id=?").pluck().get(o.game);
	if (stateJson == null) { console.error("对局 " + o.game + " 不存在"); process.exit(3); }

	let game = JSON.parse(stateJson);
	console.log(`=== 对局 ${o.game}（title=${o.title}）载入，开始 state ===`);
	diag(game, "before");

	/* 解析参数对象（优先 --params-file，其次 --params） */
	let params = {};
	if (o.paramsFile) {
		try { params = JSON.parse(fs.readFileSync(o.paramsFile, "utf8")); }
		catch (e) { console.error("读取/解析 params-file 失败: " + e.message); process.exit(4); }
	} else if (o.params) {
		try { params = parseParams(o.params); }
		catch (e) { console.error("params 不是合法 JSON: " + e.message); process.exit(4); }
	}

	/* query 模式（只读） */
	if (o.query) {
		if (!o.role) { console.error("query 需要 --role"); process.exit(5); }
		const reply = rules.query(game, o.role, o.query, params);
		console.log("=== query " + o.query + " 返回 ===");
		console.log(JSON.stringify(reply, null, 2));
		db.close();
		return;
	}

	/* action 模式 */
	if (o.action) {
		if (!o.role) { console.error("action 需要 --role"); process.exit(5); }
		console.log(`\n>>> action ${o.action} (role=${o.role}) params=${JSON.stringify(params)}`);
		let r;
		try {
			r = rules.action(game, o.role, o.action, params);
		} catch (e) {
			console.error("!!! action 抛出异常: " + e.stack);
			console.log("=== 异常前 state（未写回）===");
			diag(game, "pre-crash");
			db.close();
			process.exit(6);
		}
		if (r === undefined) {
			console.error("!!! action 返回 undefined（服务器会报 'reading $pie'）");
		} else {
			game = r;
		}
		console.log("=== 动作后 state ===");
		diag(game, "after");
		if (o.view) {
			try {
				const v = rules.view(game, o.role);
				console.log("=== view(" + o.role + ") 摘要 ===");
				console.log("  prompt:", v.prompt || "-");
				console.log("  actions:", v.actions ? Object.keys(v.actions) : "-");
				if (v.national_skill_offer) console.log("  national_skill_offer:", JSON.stringify(v.national_skill_offer));
				if (v.us_lend_lease) console.log("  us_lend_lease:", JSON.stringify(v.us_lend_lease));
			} catch (e) {
				console.error("view 抛错: " + e.message);
			}
		}
	}

	/* 写回 */
	if (o.save) {
		if (!o.action) { console.error("--save 仅对 action 模式有效（不会改变 state，无内容可写）"); }
		else {
			const ok = db.prepare("insert or replace into game_state (game_id,state) values (?,?)")
				.run(o.game, JSON.stringify(game));
			console.log(`>>> 已写回 game_state(game=${o.game})，影响行数=${ok.changes}`);
		}
	} else if (o.action) {
		console.log("（未写回；加 --save 才会持久化改动）");
	}

	db.close();
}

try {
	main();
} catch (e) {
	console.error("致命错误: " + e.stack);
	process.exit(1);
}
