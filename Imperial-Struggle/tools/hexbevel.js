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
		pts.push([x,y].join(","))
		a += da
	}
	return pts.join(" ")
}

function make_hex_with_bevel(output, img_file, img_w, img_h, color) {
	var hi = oklab.brightness(color, 1.2)
	var lo = oklab.brightness(color, 0.8)
	var sh = oklab.brightness(color, 0.2)

	var img_url = "data:image/png;base64," + fs.readFileSync(img_file).toString("base64")

	var r = img_w / 2
	var w = 48 + r * 2 + 64
	var h = 48 + Math.ceil((r/8) * 2 * Math.cos(d30)) * 8 + 64
	var xc = w / 2
	var yc = h / 2

	var svg = []
	svg.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}">`)
	svg.push(`<g stroke-width="16">`)
	svg.push(`<clipPath id="c"><path d="M${poly(xc,yc,r,6,6,d30)}z" /></clipPath>`)
	svg.push(`<clipPath id="a"><path d="M${poly(xc,yc,r+20,4,6,-d30)}z" /></clipPath>`)
	svg.push(`<clipPath id="b"><path d="M${poly(xc,yc,r+20,4,6,-d30+Math.PI)}z" /></clipPath>`)
	svg.push(`<path fill="${sh}" d="M${poly(xc,yc,r+24,6,6,d30)}" />`)
	svg.push(`<path fill="${color}" d="M${poly(xc,yc,r+8,6,6,d30)}" />`)
	svg.push(`<path clip-path="url(#a)" fill="none" stroke="${lo}" d="M${poly(xc,yc,r+8,6,6,d30)}z" />`)
	svg.push(`<path clip-path="url(#b)" fill="none" stroke="${hi}" d="M${poly(xc,yc,r+8,6,6,d30)}z" />`)
	svg.push(`<image clip-path="url(#c)" xlink:href="${img_url}" x="${xc-img_w/2}" y="${yc-img_h/2}" width="${img_w}" height="${img_h}" />`)
	svg.push(`</g>`)
	svg.push(`</svg>`)

	fs.writeFileSync(output, svg.join("\n") + "\n")
}

var fr_dark = "#264f65"
var fr_light = "#c9d6e3"
var fr_fleet = "#0069a5"

var br_dark = "#652a24"
var br_light = "#dac1b8"
var br_fleet = "#b7382c"

var black = "#444444"

function hex(color, file) {
	make_hex_with_bevel(file.replace(".png", ".svg"), file, 504, 440, color)
}

function hex_sm(color, file) {
	make_hex_with_bevel(file.replace(".png", ".svg"), file, 416, 360, color)
}

hex(fr_fleet, "tools/tiles/hex/fleet_fr.png")
hex(br_fleet, "tools/tiles/hex/fleet_br.png")

hex(br_dark, "tools/tiles/hex/war_7yw_br_reverse.png")
hex(br_dark, "tools/tiles/hex/war_awi_br_reverse.png")
hex(br_dark, "tools/tiles/hex/war_was_br_reverse.png")
hex(br_dark, "tools/tiles/hex/war_wss_br_reverse.png")
hex(br_dark, "tools/tiles/hex/warbasic_reverse_br.png")

hex(fr_dark, "tools/tiles/hex/war_7yw_fr_reverse.png")
hex(fr_dark, "tools/tiles/hex/war_awi_fr_reverse.png")
hex(fr_dark, "tools/tiles/hex/war_was_fr_reverse.png")
hex(fr_dark, "tools/tiles/hex/war_wss_fr_reverse.png")
hex(fr_dark, "tools/tiles/hex/warbasic_reverse_fr.png")

hex(br_light, "tools/tiles/hex/war12_wss_br_marlborough.png")
hex(br_light, "tools/tiles/hex/war13_wss_br_prince_eugene.png")
hex(br_light, "tools/tiles/hex/war14_wss_br_church.png")
hex(br_light, "tools/tiles/hex/war15_wss_br_galway.png")
hex(br_light, "tools/tiles/hex/war16_wss_br_rooke.png")
hex(br_light, "tools/tiles/hex/war17_wss_br_savoy_defects.png")
hex(br_light, "tools/tiles/hex/war18_wss_br_foot_guards.png")
hex(br_light, "tools/tiles/hex/war19_wss_br_united_parliament.png")
hex(br_light, "tools/tiles/hex/war20_wss_br_huguenot_rebels.png")
hex(br_light, "tools/tiles/hex/war21_wss_br_prize_hunting.png")
hex(br_light, "tools/tiles/hex/war22_wss_br_leopold.png")
hex(br_light, "tools/tiles/hex/war23_wss_br_louis_william.png")
hex(br_light, "tools/tiles/hex/war36_was_br_clive.png")
hex(br_light, "tools/tiles/hex/war37_was_br_stair.png")
hex(br_light, "tools/tiles/hex/war38_was_br_boscawen.png")
hex(br_light, "tools/tiles/hex/war39_was_br_francois_de_bussy.png")
hex(br_light, "tools/tiles/hex/war40_was_br_treaty_of_warsaw.png")
hex(br_light, "tools/tiles/hex/war41_was_br_warren.png")
hex(br_light, "tools/tiles/hex/war42_was_br_de_lorraine.png")
hex(br_light, "tools/tiles/hex/war43_was_br_king_george_ii.png")
hex(br_light, "tools/tiles/hex/war44_was_br_chaos_in_bavaria.png")
hex(br_light, "tools/tiles/hex/war45_was_br_hungarian_enthusiasm.png")
hex(br_light, "tools/tiles/hex/war46_was_br_lawrence.png")
hex(br_light, "tools/tiles/hex/war47_was_br_seckendorff.png")
hex(br_light, "tools/tiles/hex/war60_7yw_br_clive.png")
hex(br_light, "tools/tiles/hex/war61_7yw_br_old_fritz.png")
hex(br_light, "tools/tiles/hex/war62_7yw_br_amherst.png")
hex(br_light, "tools/tiles/hex/war63_7yw_br_coote.png")
hex(br_light, "tools/tiles/hex/war64_7yw_br_morta_la_bestia.png")
hex(br_light, "tools/tiles/hex/war65_7yw_br_wolfe.png")
hex(br_light, "tools/tiles/hex/war66_7yw_br_granby.png")
hex(br_light, "tools/tiles/hex/war67_7yw_br_sepoy_veterans.png")
hex(br_light, "tools/tiles/hex/war68_7yw_br_damned_audacity.png")
hex(br_light, "tools/tiles/hex/war69_7yw_br_johnson.png")
hex(br_light, "tools/tiles/hex/war70_7yw_br_bradstreet.png")
hex(br_light, "tools/tiles/hex/war71_7yw_br_monckton.png")
hex(br_light, "tools/tiles/hex/war84_awi_br_coote.png")
hex(br_light, "tools/tiles/hex/war85_awi_br_rodney.png")
hex(br_light, "tools/tiles/hex/war86_awi_br_anglo_dutch_conflict.png")
hex(br_light, "tools/tiles/hex/war87_awi_br_carleton.png")
hex(br_light, "tools/tiles/hex/war88_awi_br_hessians.png")
hex(br_light, "tools/tiles/hex/war89_awi_br_howe.png")
hex(br_light, "tools/tiles/hex/war90_awi_br_cornplanter.png")
hex(br_light, "tools/tiles/hex/war91_awi_br_cornwallis.png")
hex(br_light, "tools/tiles/hex/war92_awi_br_brants_volunteers.png")
hex(br_light, "tools/tiles/hex/war93_awi_br_stuart.png")
hex(br_light, "tools/tiles/hex/war94_awi_br_andre.png")
hex(br_light, "tools/tiles/hex/war95_awi_br_arnolds_treason.png")
hex(br_light, "tools/tiles/hex/warbasic16_br_2.png")
hex(br_light, "tools/tiles/hex/warbasic17_br_2.png")
hex(br_light, "tools/tiles/hex/warbasic18_br_2.png")
hex(br_light, "tools/tiles/hex/warbasic19_br_1.png")
hex(br_light, "tools/tiles/hex/warbasic20_br_1.png")
hex(br_light, "tools/tiles/hex/warbasic21_br_1.png")
hex(br_light, "tools/tiles/hex/warbasic22_br_1.png")
hex(br_light, "tools/tiles/hex/warbasic23_br_0debt.png")
hex(br_light, "tools/tiles/hex/warbasic24_br_0debt.png")
hex(br_light, "tools/tiles/hex/warbasic25_br_0debt.png")
hex(br_light, "tools/tiles/hex/warbasic26_br_0debt.png")
hex(br_light, "tools/tiles/hex/warbasic27_br_0fort.png")
hex(br_light, "tools/tiles/hex/warbasic28_br_0fort.png")
hex(br_light, "tools/tiles/hex/warbasic29_br_neg1flag.png")
hex(br_light, "tools/tiles/hex/warbasic30_br_neg1flag.png")
hex(br_light, "tools/tiles/hex/warbasic31_br_neg1flag.png")

hex(fr_light, "tools/tiles/hex/war00_wss_fr_vendome.png")
hex(fr_light, "tools/tiles/hex/war01_wss_fr_de_villars.png")
hex(fr_light, "tools/tiles/hex/war02_wss_fr_berwick.png")
hex(fr_light, "tools/tiles/hex/war03_wss_fr_cadiz_refused.png")
hex(fr_light, "tools/tiles/hex/war04_wss_fr_d_estrees.png")
hex(fr_light, "tools/tiles/hex/war05_wss_fr_musketeers.png")
hex(fr_light, "tools/tiles/hex/war06_wss_fr_d_artagnan.png")
hex(fr_light, "tools/tiles/hex/war07_wss_fr_maison_du_roi.png")
hex(fr_light, "tools/tiles/hex/war08_wss_fr_boufflers.png")
hex(fr_light, "tools/tiles/hex/war09_wss_fr_de_tesse.png")
hex(fr_light, "tools/tiles/hex/war10_wss_fr_crack_troops.png")
hex(fr_light, "tools/tiles/hex/war11_wss_fr_ultima_ratio_regum.png")
hex(fr_light, "tools/tiles/hex/war24_was_fr_frederick.png")
hex(fr_light, "tools/tiles/hex/war25_was_fr_saxe.png")
hex(fr_light, "tools/tiles/hex/war26_was_fr_bonnie_prince_charlie.png")
hex(fr_light, "tools/tiles/hex/war27_was_fr_castries.png")
hex(fr_light, "tools/tiles/hex/war28_was_fr_bourdonnais.png")
hex(fr_light, "tools/tiles/hex/war29_was_fr_murray.png")
hex(fr_light, "tools/tiles/hex/war30_was_fr_contades.png")
hex(fr_light, "tools/tiles/hex/war31_was_fr_o_sullivan.png")
hex(fr_light, "tools/tiles/hex/war32_was_fr_de_coigny.png")
hex(fr_light, "tools/tiles/hex/war33_was_fr_nizams_favor.png")
hex(fr_light, "tools/tiles/hex/war34_was_fr_lowendal.png")
hex(fr_light, "tools/tiles/hex/war35_was_fr_von_schwerin.png")
hex(fr_light, "tools/tiles/hex/war48_7yw_fr_castries.png")
hex(fr_light, "tools/tiles/hex/war49_7yw_fr_montcalm.png")
hex(fr_light, "tools/tiles/hex/war50_7yw_fr_bougainville.png")
hex(fr_light, "tools/tiles/hex/war51_7yw_fr_coureurs_des_bois.png")
hex(fr_light, "tools/tiles/hex/war52_7yw_fr_nawabs_rally.png")
hex(fr_light, "tools/tiles/hex/war53_7yw_fr_villiers.png")
hex(fr_light, "tools/tiles/hex/war54_7yw_fr_broglie.png")
hex(fr_light, "tools/tiles/hex/war55_7yw_fr_lally.png")
hex(fr_light, "tools/tiles/hex/war56_7yw_fr_beaujeu.png")
hex(fr_light, "tools/tiles/hex/war57_7yw_fr_hadiks_raid.png")
hex(fr_light, "tools/tiles/hex/war58_7yw_fr_chevert.png")
hex(fr_light, "tools/tiles/hex/war59_7yw_fr_monongahela_ambush.png")
hex(fr_light, "tools/tiles/hex/war72_awi_fr_lafayette.png")
hex(fr_light, "tools/tiles/hex/war73_awi_fr_washington.png")
hex(fr_light, "tools/tiles/hex/war74_awi_fr_arnold.png")
hex(fr_light, "tools/tiles/hex/war75_awi_fr_east_river_wind.png")
hex(fr_light, "tools/tiles/hex/war76_awi_fr_greene.png")
hex(fr_light, "tools/tiles/hex/war77_awi_fr_von_steuben.png")
hex(fr_light, "tools/tiles/hex/war78_awi_fr_de_grasse.png")
hex(fr_light, "tools/tiles/hex/war79_awi_fr_rochambeau.png")
hex(fr_light, "tools/tiles/hex/war80_awi_fr_bunker_hill.png")
hex(fr_light, "tools/tiles/hex/war81_awi_fr_castelnau.png")
hex(fr_light, "tools/tiles/hex/war82_awi_fr_morgans_rifles.png")
hex(fr_light, "tools/tiles/hex/war83_awi_fr_de_suffren.png")
hex(fr_light, "tools/tiles/hex/warbasic00_fr_2.png")
hex(fr_light, "tools/tiles/hex/warbasic01_fr_2.png")
hex(fr_light, "tools/tiles/hex/warbasic02_fr_2.png")
hex(fr_light, "tools/tiles/hex/warbasic03_fr_1.png")
hex(fr_light, "tools/tiles/hex/warbasic04_fr_1.png")
hex(fr_light, "tools/tiles/hex/warbasic05_fr_1.png")
hex(fr_light, "tools/tiles/hex/warbasic06_fr_1.png")
hex(fr_light, "tools/tiles/hex/warbasic07_fr_0debt.png")
hex(fr_light, "tools/tiles/hex/warbasic08_fr_0debt.png")
hex(fr_light, "tools/tiles/hex/warbasic09_fr_0debt.png")
hex(fr_light, "tools/tiles/hex/warbasic10_fr_0debt.png")
hex(fr_light, "tools/tiles/hex/warbasic11_fr_0fort.png")
hex(fr_light, "tools/tiles/hex/warbasic12_fr_0fort.png")
hex(fr_light, "tools/tiles/hex/warbasic13_fr_neg1flag.png")
hex(fr_light, "tools/tiles/hex/warbasic14_fr_neg1flag.png")
hex(fr_light, "tools/tiles/hex/warbasic15_fr_neg1flag.png")


hex_sm(br_fleet, "tools/tiles/hex-sm/atlantic_dominance_br.png")
hex_sm(fr_fleet, "tools/tiles/hex-sm/atlantic_dominance_fr.png")
hex_sm(br_fleet, "tools/tiles/hex-sm/byng.png")
hex_sm(br_fleet, "tools/tiles/hex-sm/byng_reverse.png")
hex_sm(black, "tools/tiles/hex-sm/conflict.png")
hex_sm(black, "tools/tiles/hex-sm/conflict_plus_one.png")
hex_sm(black, "tools/tiles/hex-sm/fort_damaged.png")
