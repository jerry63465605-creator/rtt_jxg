/*
 * 军需官 · 次要战场（自研变体） —— 地图数据
 *
 * 由 tools/gen_module_data.js 从 out/adjacency.json 自动生成，请勿手改。
 * 人工标定源: out/spaces_calibrated.json
 * 生成时间: 2026-09-21T14:15:43.084Z
 *
 * 邻接建模沿用 PoG 约定:
 *   space.connections            普通连通（双方都通），完整邻居列表
 *   space.limited_connections    阵营私有连通，值为【完整邻居列表】
 *   get_connections(s, side) => limited_connections[side] ?? connections
 *
 * 海峡产生的动态连通已按『默认控制方』预置；运行期由 rules.js 按
 * 实际控制者重新生成（见 rebuild_strait_connections）。
 */

const data = {}

data.map = {
 "name": "quartermaster-sub-wars",
 "width": 4835,
 "height": 1612,
 "source": "out/spaces_calibrated.json",
 "counts": {
  "points": 53,
  "land": 38,
  "sea": 15,
  "links": 139,
  "normal": 134,
  "limited": 1,
  "strait": 4,
  "straitSpaces": 4,
  "straitCovered": 4
 }
}

/* ---------- 格位 id 常量 ---------- */
const SPACE = {
	"冰岛": 1,
	"不列颠": 2,
	"亚速尔": 3,
	"北欧": 4,
	"东欧": 5,
	"西欧": 6,
	"罗斯": 7,
	"波罗的海": 8,
	"莫斯科": 9,
	"中亚": 10,
	"里海": 11,
	"巴尔干": 12,
	"意大利": 13,
	"黑海": 14,
	"非洲北部": 15,
	"中东": 16,
	"北海": 17,
	"西伯利亚": 18,
	"中国西部": 19,
	"蒙古": 20,
	"中国东北": 21,
	"中国东部": 22,
	"菲律宾": 23,
	"海参崴": 24,
	"阿拉斯加": 25,
	"加拿大": 26,
	"美国": 27,
	"中太平洋": 28,
	"南大西洋": 29,
	"拉丁美洲": 30,
	"非洲南部": 31,
	"非洲东部": 32,
	"马达加斯加": 33,
	"阿拉伯海": 34,
	"印度": 35,
	"印度洋": 36,
	"东南亚": 37,
	"南海": 38,
	"印度尼西亚": 39,
	"东海": 40,
	"新几内亚": 41,
	"澳大利亚": 42,
	"南太平洋": 43,
	"德国": 44,
	"乌克兰": 45,
	"地中海": 46,
	"日本": 47,
	"硫磺岛": 48,
	"北太平洋": 49,
	"夏威夷": 50,
	"新西兰": 51,
	"东太平洋": 52,
	"北大西洋": 53,
}

/* ---------- 阵营 ---------- */
const AXIS = 'axis'
const ALLIES = 'allies'

/* ---------- 海峡（陆地格位 -> 打通的两片海域） ---------- */
data.straits = [
	{ name: "北欧", id: 4, def: "axis", a: 17, b: 8 },
	{ name: "非洲北部", id: 15, def: "allies", a: 46, b: 17 },
	{ name: "中东", id: 16, def: "allies", a: 34, b: 46 },
	{ name: "拉丁美洲", id: 30, def: "allies", a: 53, b: 52 },
]

/* ---------- 格位（1-based，索引 0 为空占位） ---------- */
data.spaces = [
 {},
 {
  "id": 1,
  "name": "冰岛",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 94,
  "y": 115,
  "connections": [
   17,
   53
  ]
 },
 {
  "id": 2,
  "name": "不列颠",
  "terrain": "land",
  "supply": true,
  "home_base": true,
  "strait": false,
  "x": 548,
  "y": 223,
  "connections": [
   17
  ]
 },
 {
  "id": 3,
  "name": "亚速尔",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 133,
  "y": 529,
  "connections": [
   17,
   29,
   53
  ]
 },
 {
  "id": 4,
  "name": "北欧",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": true,
  "x": 955,
  "y": 105,
  "connections": [
   7,
   8,
   17
  ]
 },
 {
  "id": 5,
  "name": "东欧",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1046,
  "y": 360,
  "connections": [
   7,
   8,
   12,
   44,
   45
  ]
 },
 {
  "id": 6,
  "name": "西欧",
  "terrain": "land",
  "supply": true,
  "home_base": true,
  "strait": false,
  "x": 543,
  "y": 504,
  "connections": [
   8,
   13,
   17,
   44,
   46
  ],
  "limited_connections": {
   "axis": [
    8,
    13,
    15,
    17,
    44,
    46
   ]
  }
 },
 {
  "id": 7,
  "name": "罗斯",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1247,
  "y": 181,
  "connections": [
   4,
   5,
   8,
   9,
   18,
   45
  ]
 },
 {
  "id": 8,
  "name": "波罗的海",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1032,
  "y": 180,
  "connections": [
   4,
   5,
   6,
   7,
   44
  ],
  "limited_connections": {
   "axis": [
    4,
    5,
    6,
    7,
    17,
    44
   ]
  }
 },
 {
  "id": 9,
  "name": "莫斯科",
  "terrain": "land",
  "supply": true,
  "home_base": true,
  "strait": false,
  "x": 1278,
  "y": 290,
  "connections": [
   7,
   10,
   18,
   45
  ]
 },
 {
  "id": 10,
  "name": "中亚",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1628,
  "y": 511,
  "connections": [
   9,
   11,
   16,
   18,
   19,
   20,
   45
  ]
 },
 {
  "id": 11,
  "name": "里海",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1387,
  "y": 582,
  "connections": [
   10,
   16
  ]
 },
 {
  "id": 12,
  "name": "巴尔干",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 970,
  "y": 507,
  "connections": [
   5,
   13,
   14,
   44,
   45,
   46
  ]
 },
 {
  "id": 13,
  "name": "意大利",
  "terrain": "land",
  "supply": true,
  "home_base": true,
  "strait": false,
  "x": 829,
  "y": 586,
  "connections": [
   6,
   12,
   44,
   46
  ]
 },
 {
  "id": 14,
  "name": "黑海",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1150,
  "y": 550,
  "connections": [
   12,
   16,
   45
  ]
 },
 {
  "id": 15,
  "name": "非洲北部",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": true,
  "x": 760,
  "y": 735,
  "connections": [
   16,
   17,
   29,
   31,
   32,
   46
  ],
  "limited_connections": {
   "axis": [
    6,
    16,
    17,
    29,
    31,
    32,
    46
   ]
  }
 },
 {
  "id": 16,
  "name": "中东",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": true,
  "x": 1280,
  "y": 705,
  "connections": [
   10,
   11,
   14,
   15,
   19,
   34,
   35,
   45,
   46
  ]
 },
 {
  "id": 17,
  "name": "北海",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 354,
  "y": 338,
  "connections": [
   1,
   2,
   3,
   4,
   6,
   15,
   29,
   53
  ],
  "limited_connections": {
   "axis": [
    1,
    2,
    3,
    4,
    6,
    8,
    15,
    29,
    53
   ],
   "allies": [
    1,
    2,
    3,
    4,
    6,
    15,
    29,
    46,
    53
   ]
  }
 },
 {
  "id": 18,
  "name": "西伯利亚",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1986,
  "y": 184,
  "connections": [
   7,
   9,
   10,
   20,
   24
  ]
 },
 {
  "id": 19,
  "name": "中国西部",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2109,
  "y": 692,
  "connections": [
   10,
   16,
   20,
   21,
   22,
   35,
   37
  ]
 },
 {
  "id": 20,
  "name": "蒙古",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2219,
  "y": 496,
  "connections": [
   10,
   18,
   19,
   21,
   24
  ]
 },
 {
  "id": 21,
  "name": "中国东北",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2511,
  "y": 532,
  "connections": [
   19,
   20,
   22,
   24,
   40
  ]
 },
 {
  "id": 22,
  "name": "中国东部",
  "terrain": "land",
  "supply": true,
  "home_base": true,
  "strait": false,
  "x": 2349,
  "y": 787,
  "connections": [
   19,
   21,
   37,
   40
  ]
 },
 {
  "id": 23,
  "name": "菲律宾",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2588,
  "y": 1073,
  "connections": [
   28,
   38,
   40
  ]
 },
 {
  "id": 24,
  "name": "海参崴",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2758,
  "y": 134,
  "connections": [
   18,
   20,
   21,
   40,
   49
  ]
 },
 {
  "id": 25,
  "name": "阿拉斯加",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 3482,
  "y": 58,
  "connections": [
   26,
   49,
   52
  ]
 },
 {
  "id": 26,
  "name": "加拿大",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 4090,
  "y": 169,
  "connections": [
   25,
   27,
   52,
   53
  ]
 },
 {
  "id": 27,
  "name": "美国",
  "terrain": "land",
  "supply": true,
  "home_base": true,
  "strait": false,
  "x": 4015,
  "y": 442,
  "connections": [
   26,
   30,
   52,
   53
  ]
 },
 {
  "id": 28,
  "name": "中太平洋",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 3058,
  "y": 946,
  "connections": [
   23,
   38,
   40,
   41,
   43,
   48,
   49,
   50,
   52
  ]
 },
 {
  "id": 29,
  "name": "南大西洋",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 353,
  "y": 1248,
  "connections": [
   3,
   15,
   17,
   30,
   31,
   33,
   34,
   36,
   46,
   52,
   53
  ]
 },
 {
  "id": 30,
  "name": "拉丁美洲",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": true,
  "x": 4199,
  "y": 1054,
  "connections": [
   27,
   29,
   52,
   53
  ]
 },
 {
  "id": 31,
  "name": "非洲南部",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 683,
  "y": 1081,
  "connections": [
   15,
   29,
   32
  ]
 },
 {
  "id": 32,
  "name": "非洲东部",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1058,
  "y": 1060,
  "connections": [
   15,
   31,
   34
  ]
 },
 {
  "id": 33,
  "name": "马达加斯加",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1167,
  "y": 1390,
  "connections": [
   29,
   34,
   36
  ]
 },
 {
  "id": 34,
  "name": "阿拉伯海",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1397,
  "y": 1073,
  "connections": [
   16,
   29,
   32,
   33,
   35,
   36
  ],
  "limited_connections": {
   "allies": [
    16,
    29,
    32,
    33,
    35,
    36,
    46
   ]
  }
 },
 {
  "id": 35,
  "name": "印度",
  "terrain": "land",
  "supply": true,
  "home_base": false,
  "strait": false,
  "x": 1807,
  "y": 817,
  "connections": [
   16,
   19,
   34,
   36,
   37
  ]
 },
 {
  "id": 36,
  "name": "印度洋",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1877,
  "y": 1365,
  "connections": [
   29,
   33,
   34,
   35,
   37,
   38,
   39,
   42,
   43
  ]
 },
 {
  "id": 37,
  "name": "东南亚",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2174,
  "y": 927,
  "connections": [
   19,
   22,
   35,
   36,
   38
  ]
 },
 {
  "id": 38,
  "name": "南海",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2494,
  "y": 1163,
  "connections": [
   23,
   28,
   36,
   37,
   39,
   40,
   41,
   42,
   43
  ]
 },
 {
  "id": 39,
  "name": "印度尼西亚",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2436,
  "y": 1244,
  "connections": [
   36,
   38
  ]
 },
 {
  "id": 40,
  "name": "东海",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2561,
  "y": 830,
  "connections": [
   21,
   22,
   23,
   24,
   28,
   38,
   43,
   47,
   48,
   49
  ]
 },
 {
  "id": 41,
  "name": "新几内亚",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2839,
  "y": 1156,
  "connections": [
   28,
   38,
   43
  ]
 },
 {
  "id": 42,
  "name": "澳大利亚",
  "terrain": "land",
  "supply": true,
  "home_base": false,
  "strait": false,
  "x": 2756,
  "y": 1394,
  "connections": [
   36,
   38,
   43
  ]
 },
 {
  "id": 43,
  "name": "南太平洋",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 3038,
  "y": 1384,
  "connections": [
   28,
   36,
   38,
   40,
   41,
   42,
   51,
   52
  ]
 },
 {
  "id": 44,
  "name": "德国",
  "terrain": "land",
  "supply": true,
  "home_base": true,
  "strait": false,
  "x": 860,
  "y": 374,
  "connections": [
   5,
   6,
   8,
   12,
   13
  ]
 },
 {
  "id": 45,
  "name": "乌克兰",
  "terrain": "land",
  "supply": true,
  "home_base": false,
  "strait": false,
  "x": 1214,
  "y": 444,
  "connections": [
   5,
   7,
   9,
   10,
   12,
   14,
   16
  ]
 },
 {
  "id": 46,
  "name": "地中海",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 1004,
  "y": 662,
  "connections": [
   6,
   12,
   13,
   15,
   16,
   29
  ],
  "limited_connections": {
   "allies": [
    6,
    12,
    13,
    15,
    16,
    17,
    29,
    34
   ]
  }
 },
 {
  "id": 47,
  "name": "日本",
  "terrain": "land",
  "supply": true,
  "home_base": true,
  "strait": false,
  "x": 2732,
  "y": 694,
  "connections": [
   40
  ]
 },
 {
  "id": 48,
  "name": "硫磺岛",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 2929,
  "y": 766,
  "connections": [
   28,
   40,
   49
  ]
 },
 {
  "id": 49,
  "name": "北太平洋",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 3233,
  "y": 438,
  "connections": [
   24,
   25,
   28,
   40,
   48,
   50,
   52
  ]
 },
 {
  "id": 50,
  "name": "夏威夷",
  "terrain": "land",
  "supply": true,
  "home_base": false,
  "strait": false,
  "x": 3462,
  "y": 770,
  "connections": [
   28,
   49,
   52
  ]
 },
 {
  "id": 51,
  "name": "新西兰",
  "terrain": "land",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 3232,
  "y": 1486,
  "connections": [
   43,
   52
  ]
 },
 {
  "id": 52,
  "name": "东太平洋",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 3728,
  "y": 1034,
  "connections": [
   25,
   26,
   27,
   28,
   29,
   30,
   43,
   49,
   50,
   51
  ],
  "limited_connections": {
   "allies": [
    25,
    26,
    27,
    28,
    29,
    30,
    43,
    49,
    50,
    51,
    53
   ]
  }
 },
 {
  "id": 53,
  "name": "北大西洋",
  "terrain": "sea",
  "supply": false,
  "home_base": false,
  "strait": false,
  "x": 4401,
  "y": 676,
  "connections": [
   1,
   3,
   17,
   26,
   27,
   29,
   30
  ],
  "limited_connections": {
   "allies": [
    1,
    3,
    17,
    26,
    27,
    29,
    30,
    52
   ]
  }
 }
]

/* ---------- 邻接查询（与 PoG 同构） ---------- */
data.get_connections = function (s, side) {
	const sp = data.spaces[s]
	if (!sp) return []
	if (side && sp.limited_connections && sp.limited_connections[side])
		return sp.limited_connections[side]
	return sp.connections
}

/* 便利：按名字取 id */
data.id_of = function (name) { return SPACE[name] }
data.name_of = function (id) { const s = data.spaces[id]; return s ? s.name : null }

if (typeof module !== 'undefined') module.exports = { data, SPACE, AXIS, ALLIES }
