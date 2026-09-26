/* 调试：英+苏同格为何只给英国 */
const r = require("../server-official/public/quartermaster-sub-wars/rules.js")
const I = r._internal
const { SPACE } = require("../server-official/public/quartermaster-sub-wars/data.js")

const UK = SPACE["不列颠"]
const g = r.setup(7, "Standard", {})
g.markers = I.init_markers(g)
g.location = {}; g.piece_nation = {}; g.piece_type = {}

g.location["a"] = UK; g.piece_nation["a"] = "英国"; g.piece_type["a"] = "army"
g.location["b"] = UK; g.piece_nation["b"] = "苏联"; g.piece_type["b"] = "army"

const occ = Object.keys(g.location).filter(p => g.location[p] === UK)
console.log("UK =", UK, "(type " + typeof UK + ")")
console.log("location =", JSON.stringify(g.location))
console.log("occupants =", JSON.stringify(occ))

const hereNations = []
for (const p of occ) {
	const n = g.piece_nation[p]
	if (n && hereNations.indexOf(n) < 0) hereNations.push(n)
}
console.log("hereNations =", JSON.stringify(hereNations))
console.log("markers =", JSON.stringify(I.markers_on(g, UK)))
console.log("allocate =", JSON.stringify(I.allocate_space_score(g, UK, occ)))
