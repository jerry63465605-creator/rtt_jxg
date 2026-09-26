const oklab = require("rally-the-troops/tools/oklab")

function b(s,c) {
	console.log(oklab.css_bevel(s,c))
}

b(".marker.advantage", "#6c6257")
b(".marker.investment", "#906d90")
b(".marker.investment.reverse", "#5b255e")

b(".marker", "#eddbbc")
b(".marker.black", "#444444")
b(".marker.br", "#b7392c")
b(".marker.fr", "#0069a5")

b(".marker.flag_fr", "#306e8e")
b(".marker.flag_br", "#964c40")
b(".marker.flag_usa", "#b383a7")
b(".marker.flag_spain", "#e09b26")

b(".readybutton", "#00ff7f")
b(".almostbutton", "#f0e68c")
