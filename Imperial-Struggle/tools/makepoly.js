const fs = require("node:fs")

function poly(file, r, n, a, color1, color2) {
	var pts = []
	var da = (2 * Math.PI) / n
	for (var i = 0; i < n; ++i) {
		var x = Math.sin(a) * r + r + 6
		var y = Math.cos(a) * r + r + 6
		pts.push([x.toFixed(1),y.toFixed(1)].join(","))
		a += da
	}
	if (!color2) {
		fs.writeFileSync(file,
`<svg xmlns="http://www.w3.org/2000/svg" width="${r*2+12}" height="${r*2+12}">
<polygon points="${pts.join(" ")}" fill="none" stroke="black" stroke-width="6"/>
<polygon points="${pts.join(" ")}" fill="none" stroke="${color1}" stroke-width="4"/>
</svg>`)
	} else {
		fs.writeFileSync(file,
`<svg xmlns="http://www.w3.org/2000/svg" width="${r*2+12}" height="${r*2+12}">
<polygon points="${pts.join(" ")}" fill="none" stroke="black" stroke-width="6"/>
<polygon points="${pts.join(" ")}" fill="none" stroke="${color1}" stroke-width="4">
<animate attributeName="stroke" values="${color1};${color2};${color1}" dur="3s" repeatCount="indefinite"/>
</polygon>
</svg>`)
	}
}

function make_poly(name, r, n, a) {
	poly("images/space_" + name + "_action.svg", r, n, a, "yellow")
	poly("images/space_" + name + "_dirty_br.svg", r, n, a, "crimson")
	poly("images/space_" + name + "_dirty_fr.svg", r, n, a, "royalblue")
	poly("images/space_" + name + "_action_pulse.svg", r, n, a, "yellow", "orange")
	poly("images/space_" + name + "_dirty_br_pulse.svg", r, n, a, "crimson", "salmon")
	poly("images/space_" + name + "_dirty_fr_pulse.svg", r, n, a, "royalblue", "skyblue")
}

make_poly("circle",	38 + 8+3, 36, 0)
make_poly("pentagon",	40 + 8+3, 5, (2*Math.PI) * 1/10)
make_poly("hexagon",	42 + 8+3, 6, (2*Math.PI) * 1/12)

// 77x77 square
make_poly("square",	54 + 8+3, 4, (2*Math.PI) * 1/8)

// 65x65 square rotated 45deg
make_poly("diamond",	45 + 8+3, 4, (2*Math.PI) * 0/8)


//poly(42, 6, (2*Math.PI) * 1/12)
