var hex_sm_conflict_markers = `
.marker.conflict,hex-sm/conflict.png
.marker.conflict.plus-one,hex-sm/conflict_plus_one.png
`.split("\n").filter(x=>!!x).map(x=>x.split(","))

var hex_sm_markers = `
.marker.atlantic-dominance.br,hex-sm/atlantic_dominance_br.png
.marker.atlantic-dominance.fr,hex-sm/atlantic_dominance_fr.png
.marker.byng,hex-sm/byng.png
.marker.byng.reverse,hex-sm/byng_reverse.png
.marker.damaged,hex-sm/fort_damaged.png
`.split("\n").filter(x=>!!x).map(x=>x.split(","))

var hex_war_markers = `
.marker.fleet_fr,hex/fleet_fr.png
.marker.fleet_br,hex/fleet_br.png
.marker.war-7yw.br,hex/war_7yw_br_reverse.png
.marker.war-7yw.fr,hex/war_7yw_fr_reverse.png
.marker.war-awi.br,hex/war_awi_br_reverse.png
.marker.war-awi.fr,hex/war_awi_fr_reverse.png
.marker.war-was.br,hex/war_was_br_reverse.png
.marker.war-was.fr,hex/war_was_fr_reverse.png
.marker.war-wss.br,hex/war_wss_br_reverse.png
.marker.war-wss.fr,hex/war_wss_fr_reverse.png
.marker.war-basic.br,hex/warbasic_reverse_br.png
.marker.war-basic.fr,hex/warbasic_reverse_fr.png
.marker.war0,hex/war00_wss_fr_vendome.png
.marker.war1,hex/war01_wss_fr_de_villars.png
.marker.war2,hex/war02_wss_fr_berwick.png
.marker.war3,hex/war03_wss_fr_cadiz_refused.png
.marker.war4,hex/war04_wss_fr_d_estrees.png
.marker.war5,hex/war05_wss_fr_musketeers.png
.marker.war6,hex/war06_wss_fr_d_artagnan.png
.marker.war7,hex/war07_wss_fr_maison_du_roi.png
.marker.war8,hex/war08_wss_fr_boufflers.png
.marker.war9,hex/war09_wss_fr_de_tesse.png
.marker.war10,hex/war10_wss_fr_crack_troops.png
.marker.war11,hex/war11_wss_fr_ultima_ratio_regum.png
.marker.war12,hex/war12_wss_br_marlborough.png
.marker.war13,hex/war13_wss_br_prince_eugene.png
.marker.war14,hex/war14_wss_br_church.png
.marker.war15,hex/war15_wss_br_galway.png
.marker.war16,hex/war16_wss_br_rooke.png
.marker.war17,hex/war17_wss_br_savoy_defects.png
.marker.war18,hex/war18_wss_br_foot_guards.png
.marker.war19,hex/war19_wss_br_united_parliament.png
.marker.war20,hex/war20_wss_br_huguenot_rebels.png
.marker.war21,hex/war21_wss_br_prize_hunting.png
.marker.war22,hex/war22_wss_br_leopold.png
.marker.war23,hex/war23_wss_br_louis_william.png
.marker.war24,hex/war24_was_fr_frederick.png
.marker.war25,hex/war25_was_fr_saxe.png
.marker.war26,hex/war26_was_fr_bonnie_prince_charlie.png
.marker.war27,hex/war27_was_fr_castries.png
.marker.war28,hex/war28_was_fr_bourdonnais.png
.marker.war29,hex/war29_was_fr_murray.png
.marker.war30,hex/war30_was_fr_contades.png
.marker.war31,hex/war31_was_fr_o_sullivan.png
.marker.war32,hex/war32_was_fr_de_coigny.png
.marker.war33,hex/war33_was_fr_nizams_favor.png
.marker.war34,hex/war34_was_fr_lowendal.png
.marker.war35,hex/war35_was_fr_von_schwerin.png
.marker.war36,hex/war36_was_br_clive.png
.marker.war37,hex/war37_was_br_stair.png
.marker.war38,hex/war38_was_br_boscawen.png
.marker.war39,hex/war39_was_br_francois_de_bussy.png
.marker.war40,hex/war40_was_br_treaty_of_warsaw.png
.marker.war41,hex/war41_was_br_warren.png
.marker.war42,hex/war42_was_br_de_lorraine.png
.marker.war43,hex/war43_was_br_king_george_ii.png
.marker.war44,hex/war44_was_br_chaos_in_bavaria.png
.marker.war45,hex/war45_was_br_hungarian_enthusiasm.png
.marker.war46,hex/war46_was_br_lawrence.png
.marker.war47,hex/war47_was_br_seckendorff.png
.marker.war48,hex/war48_7yw_fr_castries.png
.marker.war49,hex/war49_7yw_fr_montcalm.png
.marker.war50,hex/war50_7yw_fr_bougainville.png
.marker.war51,hex/war51_7yw_fr_coureurs_des_bois.png
.marker.war52,hex/war52_7yw_fr_nawabs_rally.png
.marker.war53,hex/war53_7yw_fr_villiers.png
.marker.war54,hex/war54_7yw_fr_broglie.png
.marker.war55,hex/war55_7yw_fr_lally.png
.marker.war56,hex/war56_7yw_fr_beaujeu.png
.marker.war57,hex/war57_7yw_fr_hadiks_raid.png
.marker.war58,hex/war58_7yw_fr_chevert.png
.marker.war59,hex/war59_7yw_fr_monongahela_ambush.png
.marker.war60,hex/war60_7yw_br_clive.png
.marker.war61,hex/war61_7yw_br_old_fritz.png
.marker.war62,hex/war62_7yw_br_amherst.png
.marker.war63,hex/war63_7yw_br_coote.png
.marker.war64,hex/war64_7yw_br_morta_la_bestia.png
.marker.war65,hex/war65_7yw_br_wolfe.png
.marker.war66,hex/war66_7yw_br_granby.png
.marker.war67,hex/war67_7yw_br_sepoy_veterans.png
.marker.war68,hex/war68_7yw_br_damned_audacity.png
.marker.war69,hex/war69_7yw_br_johnson.png
.marker.war70,hex/war70_7yw_br_bradstreet.png
.marker.war71,hex/war71_7yw_br_monckton.png
.marker.war72,hex/war72_awi_fr_lafayette.png
.marker.war73,hex/war73_awi_fr_washington.png
.marker.war74,hex/war74_awi_fr_arnold.png
.marker.war75,hex/war75_awi_fr_east_river_wind.png
.marker.war76,hex/war76_awi_fr_greene.png
.marker.war77,hex/war77_awi_fr_von_steuben.png
.marker.war78,hex/war78_awi_fr_de_grasse.png
.marker.war79,hex/war79_awi_fr_rochambeau.png
.marker.war80,hex/war80_awi_fr_bunker_hill.png
.marker.war81,hex/war81_awi_fr_castelnau.png
.marker.war82,hex/war82_awi_fr_morgans_rifles.png
.marker.war83,hex/war83_awi_fr_de_suffren.png
.marker.war84,hex/war84_awi_br_coote.png
.marker.war85,hex/war85_awi_br_rodney.png
.marker.war86,hex/war86_awi_br_anglo_dutch_conflict.png
.marker.war87,hex/war87_awi_br_carleton.png
.marker.war88,hex/war88_awi_br_hessians.png
.marker.war89,hex/war89_awi_br_howe.png
.marker.war90,hex/war90_awi_br_cornplanter.png
.marker.war91,hex/war91_awi_br_cornwallis.png
.marker.war92,hex/war92_awi_br_brants_volunteers.png
.marker.war93,hex/war93_awi_br_stuart.png
.marker.war94,hex/war94_awi_br_andre.png
.marker.war95,hex/war95_awi_br_arnolds_treason.png
.marker.war-basic0,hex/warbasic00_fr_2.png
.marker.war-basic1,hex/warbasic01_fr_2.png
.marker.war-basic2,hex/warbasic02_fr_2.png
.marker.war-basic3,hex/warbasic03_fr_1.png
.marker.war-basic4,hex/warbasic04_fr_1.png
.marker.war-basic5,hex/warbasic05_fr_1.png
.marker.war-basic6,hex/warbasic06_fr_1.png
.marker.war-basic7,hex/warbasic07_fr_0debt.png
.marker.war-basic8,hex/warbasic08_fr_0debt.png
.marker.war-basic9,hex/warbasic09_fr_0debt.png
.marker.war-basic10,hex/warbasic10_fr_0debt.png
.marker.war-basic11,hex/warbasic11_fr_0fort.png
.marker.war-basic12,hex/warbasic12_fr_0fort.png
.marker.war-basic13,hex/warbasic13_fr_neg1flag.png
.marker.war-basic14,hex/warbasic14_fr_neg1flag.png
.marker.war-basic15,hex/warbasic15_fr_neg1flag.png
.marker.war-basic16,hex/warbasic16_br_2.png
.marker.war-basic17,hex/warbasic17_br_2.png
.marker.war-basic18,hex/warbasic18_br_2.png
.marker.war-basic19,hex/warbasic19_br_1.png
.marker.war-basic20,hex/warbasic20_br_1.png
.marker.war-basic21,hex/warbasic21_br_1.png
.marker.war-basic22,hex/warbasic22_br_1.png
.marker.war-basic23,hex/warbasic23_br_0debt.png
.marker.war-basic24,hex/warbasic24_br_0debt.png
.marker.war-basic25,hex/warbasic25_br_0debt.png
.marker.war-basic26,hex/warbasic26_br_0debt.png
.marker.war-basic27,hex/warbasic27_br_0fort.png
.marker.war-basic28,hex/warbasic28_br_0fort.png
.marker.war-basic29,hex/warbasic29_br_neg1flag.png
.marker.war-basic30,hex/warbasic30_br_neg1flag.png
.marker.war-basic31,hex/warbasic31_br_neg1flag.png
.marker.war-7yw.br,hex/war_7yw_br_reverse.png
.marker.war-7yw.fr,hex/war_7yw_fr_reverse.png
.marker.war-awi.br,hex/war_awi_br_reverse.png
.marker.war-awi.fr,hex/war_awi_fr_reverse.png
.marker.war-was.br,hex/war_was_br_reverse.png
.marker.war-was.fr,hex/war_was_fr_reverse.png
.marker.war-wss.br,hex/war_wss_br_reverse.png
.marker.war-wss.fr,hex/war_wss_fr_reverse.png
.marker.war-basic.br,hex/warbasic_reverse_br.png
.marker.war-basic.fr,hex/warbasic_reverse_fr.png
`.split("\n").filter(x=>!!x).map(x=>x.split(","))

var plain = []
var animate = []

for (var [s,i] of hex_sm_conflict_markers) {
	plain.push(`${s}{background-image:url(tiles75/${i})}`)
	plain.push(`${s}.dirty_br{background-image:url(tiles75/${i}),url(images/marker_hex_sm_dirty_br.svg)}`)
	plain.push(`${s}.dirty_fr{background-image:url(tiles75/${i}),url(images/marker_hex_sm_dirty_fr.svg)}`)
	plain.push(`${s}.action{background-image:url(tiles75/${i}),url(images/marker_hex_sm_action.svg)}`)
	animate.push(`& ${s}.dirty_br{background-image:url(tiles75/${i}),url(images/marker_hex_sm_dirty_br_pulse.svg)}`)
	animate.push(`& ${s}.dirty_fr{background-image:url(tiles75/${i}),url(images/marker_hex_sm_dirty_fr_pulse.svg)}`)
	animate.push(`& ${s}.action{background-image:url(tiles75/${i}),url(images/marker_hex_sm_action_pulse.svg)}`)
}

for (var [s,i] of hex_sm_markers) {
	plain.push(`${s}{background-image:url(tiles75/${i})}`)
	plain.push(`${s}.action{background-image:url(tiles75/${i}),url(images/marker_hex_sm_action.svg)}`)
	animate.push(`& ${s}.action{background-image:url(tiles75/${i}),url(images/marker_hex_sm_action_pulse.svg)}`)
}

for (var [s,i] of hex_war_markers) {
	plain.push(`${s}{background-image:url(tiles75/${i})}`)
	plain.push(`${s}.action{background-image:url(tiles75/${i}),url(images/marker_hex_action.svg)}`)
	animate.push(`& ${s}.action{background-image:url(tiles75/${i}),url(images/marker_hex_action_pulse.svg)}`)
}

console.log("/* HEX MARKER IMAGES */")
console.log("")
console.log(plain.join("\n"))
console.log("")
console.log(`body[data-noanims="false"] {`)
console.log(animate.join("\n"))
console.log("}")
console.log("")
