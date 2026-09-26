// make beveled border hexagon tile image

// diameter = 504
// inner radius = 252
// outer radius = 252+(2*8)
// central radius = 260
// final = 504 + 2 * 3 * 8 = 504 + 48

const oklab = require("rally-the-troops/tools/oklab")
const fs = require("fs")

const d30 = Math.PI / 180 * 30

function poly(xc, yc, r, n, sides, a) {
	var pts = []
	var da = (2 * Math.PI) / sides
	for (var i = 0; i < n; ++i) {
		var x = Math.sin(a) * r + xc
		var y = Math.cos(a) * r + yc
		pts.push([x.toFixed(1),y.toFixed(1)].join(","))
		a += da
	}
	return pts.join(" ")
}

function make_hex_outline(output, img_w, img_h, color1, color2) {
	var r = img_w / 2
	var w = 48 + r * 2 + 64
	var h = 48 + Math.ceil((r/8) * 2 * Math.cos(d30)) * 8 + 64
	var xc = w / 2
	var yc = h / 2

	var svg = []
	svg.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}">`)
	if (color2) {
		svg.push(`<path fill="${color1}" d="M${poly(xc,yc,r+24+32,6,6,d30)}z">`)
		svg.push(`<animate attributeName="fill" values="${color1};${color2};${color1}" dur="3s" repeatCount="indefinite"/>`)
		svg.push(`</path>`)
	} else {
		svg.push(`<path fill="${color1}" d="M${poly(xc,yc,r+24+32,6,6,d30)}z" />`)
	}
	svg.push(`</svg>`)

	fs.writeFileSync(output, svg.join("\n") + "\n")
}

function hex(file, color1, color2) {
	make_hex_outline(file, 504, 440, color1, color2)
}

function hex_sm(file, color1, color2) {
	make_hex_outline(file, 416, 360, color1, color2)
}

hex("images/marker_hex_action.svg", "yellow")
hex("images/marker_hex_sm_action.svg", "yellow")
hex("images/marker_hex_sm_dirty_br.svg", "crimson")
hex("images/marker_hex_sm_dirty_fr.svg", "royalblue")

hex_sm("images/marker_hex_action_pulse.svg", "yellow", "orange")
hex_sm("images/marker_hex_sm_action_pulse.svg", "yellow", "orange")
hex_sm("images/marker_hex_sm_dirty_br_pulse.svg", "crimson", "salmon")
hex_sm("images/marker_hex_sm_dirty_fr_pulse.svg", "royalblue", "skyblue")
