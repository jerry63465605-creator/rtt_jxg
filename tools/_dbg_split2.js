/* 逐行模拟 allocate_space_score 的内部计算 */
const r = require("../server-official/public/quartermaster-sub-wars/rules.js")
const I = r._internal
const { SPACE } = require("../server-official/public/quartermaster-sub-wars/data.js")

const UK = SPACE["不列颠"]
const g = r.setup(7, "Standard", {})
g.markers = I.init_markers(g)
g.location = {}; g.piece_nation = {}; g.piece_type = {}
g.location["a"] = UK; g.piece_nation["a"] = "英国"; g.piece_type["a"] = "army"
g.location["b"] = UK; g.piece_nation["b"] = "苏联"; g.piece_type["b"] = "army"

/* 手工重演 allocate 的内部步骤 */
const list = I.markers_on(g, UK)
const occ = ["a", "b"]
const hereNations = []
for (const p of occ) {
	const n = g.piece_nation[p]
	if (n && hereNations.indexOf(n) < 0) hereNations.push(n)
}
const pool = hereNations.slice().sort((a, b) => I.scoring_rank(a) - I.scoring_rank(b))
console.log("pool =", JSON.stringify(pool))

for (const mk of list) {
	const eligible = pool.filter(n => I.marker_applies_to(mk, n))
	console.log("marker", JSON.stringify(mk), "-> eligible", JSON.stringify(eligible))
}

console.log("\n实际调用返回:", JSON.stringify(I.allocate_space_score(g, UK, occ)))
console.log("\n注意：传入的 occ 是否被函数内部重新计算？")
console.log("pieces_on(game, UK) =", JSON.stringify(
	r.view(g, "Axis").pieces.filter(p => p.loc === UK).map(p => p.id + ':' + p.nation)))
