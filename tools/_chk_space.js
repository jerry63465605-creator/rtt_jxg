const { data } = require("../server-official/public/quartermaster-sub-wars/data.js")
const s = data.spaces[2]
console.log("字段:", Object.keys(s).join(", "))
console.log("x=" + s.x + " y=" + s.y + " w=" + s.w + " h=" + s.h)
