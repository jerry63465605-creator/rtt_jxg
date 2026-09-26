/*
 * 标定工具本地服务器
 *
 * 作用：
 *   1. 提供 http://localhost:9000/editor.html （避免 file:// 的各种限制）
 *   2. 提供 GET  /api/load  -> 读取 out/spaces_calibrated.json（或 backup）
 *   3. 提供 POST /api/save  -> 把点位写回 out/spaces_calibrated.json
 *
 * 用法: node tools/editor_server.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TOOLS = path.join(ROOT, "tools");
const OUT = path.join(ROOT, "out");

const DATA_FILE = path.join(OUT, "spaces_calibrated.json");
const BACKUP_FILE = path.join(OUT, "spaces_calibrated_backup.json");

const PORT = 9000;

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
};

function send(res, code, body, type) {
	res.writeHead(code, { "Content-Type": type || "text/plain; charset=utf-8", "Cache-Control": "no-store" });
	res.end(body);
}

const server = http.createServer((req, res) => {
	const url = new URL(req.url, "http://localhost");

	/* ---- API: 读取点位 ---- */
	if (url.pathname === "/api/load") {
		const src = fs.existsSync(DATA_FILE) ? DATA_FILE : (fs.existsSync(BACKUP_FILE) ? BACKUP_FILE : null);
		if (!src) return send(res, 404, JSON.stringify({ error: "找不到点位文件" }), MIME[".json"]);
		const txt = fs.readFileSync(src, "utf8");
		res.writeHead(200, { "Content-Type": MIME[".json"], "X-Source": path.basename(src), "Cache-Control": "no-store" });
		return res.end(txt);
	}

	/* ---- API: 保存点位 ---- */
	if (url.pathname === "/api/save" && req.method === "POST") {
		let body = "";
		req.on("data", (c) => { body += c; if (body.length > 5e6) req.destroy(); });
		req.on("end", () => {
			try {
				const incoming = JSON.parse(body);

				/* 合并保护：points 页与 link 页各自只改自己的部分，不互相覆盖 */
				let existing = null;
				if (fs.existsSync(DATA_FILE)) {
					try { existing = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { }
				}
				let data = incoming;
				if (existing) {
					/* incoming 没有 links 就沿用旧的；没有 points 就沿用旧的 */
					if (!incoming.links && existing.links) data = { ...incoming, links: existing.links };
					if (!incoming.points && existing.points) data = { ...incoming, points: existing.points };
				}

				fs.mkdirSync(OUT, { recursive: true });
				fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 1), "utf8");
				/* 同时写一份带时间戳的历史 */
				const histDir = path.join(OUT, "history");
				fs.mkdirSync(histDir, { recursive: true });
				const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
				fs.writeFileSync(path.join(histDir, "spaces_" + ts + ".json"), JSON.stringify(data, null, 1), "utf8");
				console.log("[save] " + (data.points ? data.points.length : 0) + " 点 -> " + DATA_FILE);
				send(res, 200, JSON.stringify({ ok: true, count: data.points ? data.points.length : 0 }), MIME[".json"]);
			} catch (e) {
				console.error("[save] 失败:", e.message);
				send(res, 400, JSON.stringify({ ok: false, error: e.message }), MIME[".json"]);
			}
		});
		return;
	}

	/* ---- 静态文件 ---- */
	let p = url.pathname === "/" ? "/editor.html" : url.pathname;
	const file = path.join(TOOLS, path.normalize(p).replace(/^([/\\])+/, ""));
	if (!file.startsWith(TOOLS)) return send(res, 403, "forbidden");
	if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, "not found");
	send(res, 200, fs.readFileSync(file), MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
});

server.listen(PORT, "127.0.0.1", () => {
	console.log("");
	console.log("  标定工具已启动");
	console.log("  ----------------------------------------");
	console.log("  打开:  http://localhost:" + PORT + "/editor.html");
	console.log("  数据:  " + DATA_FILE);
	console.log("  历史备份: " + path.join(OUT, "history") + "\\");
	console.log("  ----------------------------------------");
	console.log("  按 Ctrl+C 停止");
	console.log("");
});
