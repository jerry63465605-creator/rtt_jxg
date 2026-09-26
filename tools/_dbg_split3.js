/* 直接检查真实函数的行为（打印 pool 与 eligible） */
const nodePath = require("path")
const fs = require("fs")
const DIR = nodePath.join(__dirname, "..", "server-official", "public",
	"quartermaster-sub-wars")
const path = nodePath.join(DIR, "rules.js")
const src = fs.readFileSync(path, "utf8")

/* 在 allocate_space_score 里插一段日志，看看 eligible 到底几个 */
const patched = src.replace(
	"const eligible = pool.filter(n => marker_applies_to(mk, n))",
	"const eligible = pool.filter(n => marker_applies_to(mk, n));" +
	"console.error('[DEBUG] marker=' + JSON.stringify(mk) + ' pool=' + JSON.stringify(pool) + ' eligible=' + JSON.stringify(eligible))"
)
const tmp = nodePath.join(DIR, "_rules_patched.js")
fs.writeFileSync(tmp, patched, "utf8")

const r = require(tmp)
const I = r._internal
const { SPACE } = require(nodePath.join(DIR, "data.js"))

const UK = SPACE["不列颠"]
const g = r.setup(7, "Standard", {})
g.markers = I.init_markers(g)
g.location = {}; g.piece_nation = {}; g.piece_type = {}
g.location["a"] = UK; g.piece_nation["a"] = "英国"; g.piece_type["a"] = "army"
g.location["b"] = UK; g.piece_nation["b"] = "苏联"; g.piece_type["b"] = "army"

console.log("结果:", JSON.stringify(I.allocate_space_score(g, UK, ["a", "b"])))
fs.unlinkSync(tmp)
