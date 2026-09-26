"use strict"

const REGION_AWARD = 4 /* prestige award magic region for layout */

const space_type_class = [
	"political",
	"market",
	"naval",
	"territory",
	"fort",
]

function center_rect(xc, yc, w, h) {
	return [xc - w / 2, yc - h / 2, w, h]
}

// Returns true if we're playing this on a mobile platform e.g. phone
function is_mobile() {
	return ("ontouchstart" in window) || (window.innerWidth < 800)
}

function attract(e) {
	e.classList.add("attract")
	window.setTimeout(() => e.classList.remove("attract"), 1500)
}

function scroll_to_war() {
	scroll_into_view(document.getElementById("war"))
}

function scroll_to_map() {
	scroll_into_view(document.getElementById("top"))
}

function scroll_to_debt(who)
{
	var e = lookup_thing("debt", who).element
	scroll_into_view(e)
	attract(e)
}

function scroll_to_cards() {
	if (R !== BRITAIN) {
		scroll_into_view(document.getElementById("ministry_fr"))
	} else {
		scroll_into_view(document.getElementById("ministry_br"))
	}
}

function mention_verbosity()
{
	if (is_mobile()) return

	if (V.prompt.includes("(Verbosity")) {
		let index = V.prompt.indexOf("<b><i>      (Verbosity")
		V.prompt = V.prompt.slice(0, index)
	}

	V.prompt += "<b><i>      (Verbosity changed to: " + say_verbosity() + ")</i></b>"
}

function say_verbosity()
{
	let verbose = get_preference("actionverbosity", "medium")
	if (verbose === "short")
		return "Brief"
	if (verbose === "long")
		return "Verbose"
	return "Normal"
}

/* GAME STATE */

function is_observing()
{
	return (R !== FRANCE) && (R !== BRITAIN)
}

function is_digit(c) {
	return (c >= '0') && (c <= '9')
}

function is_bit(b) {
	return !!bit_get(V.bitflags ?? [ 0 ], b)
}

function bit_get(bits, index)
{
	var w = index >> 5
	var b = index & 31
	return ((bits[w] >> b) & 1) > 0
}

// Ministry is active if it's one of the player's ministry cards AND it has been revealed
function has_active_ministry(who, m)
{
	if (!G.ministry[who].includes(m)) return false
	let idx = G.ministry[who].indexOf(m)
	return G.ministry_revealed[who][idx]
}

function has_conflict_marker(s) {
	return get_conflict_marker(s) > 0
}

function get_conflict_marker(s) {
	return map_get(V.conflicts, s, 0)
}

function is_damaged_fort(s) {
	return set_has(V.damaged_forts, s)
}

// True if ministry is presently exhausted
// Some ministries have more than one separately exhaustible ability (in which case can pass a different "ability" number)
function is_ministry_exhausted(who, m, ability = 0) {
	if (!V.ministry[who].includes(m)) return false
	var idx = V.ministry[who].indexOf(m)
	return set_has(V.ministry_exhausted[who], idx + (ability * NUM_MINISTRY_CARDS))
}

function is_advantage_exhausted(a) {
	return !!(V.adv_exhaust & (1 << a))
}

function region_flag_winner(region) {
	if (V.flag_count[FRANCE][region] > V.flag_count[BRITAIN][region]) return FRANCE
	if (V.flag_count[BRITAIN][region] > V.flag_count[FRANCE][region]) return BRITAIN
	return NONE
}

function region_flag_delta(region) {
	return Math.abs(V.flag_count[FRANCE][region] - V.flag_count[BRITAIN][region])
}

function prestige_winner() {
	if (V.prestige_flags[FRANCE] > V.prestige_flags[BRITAIN]) return FRANCE
	if (V.prestige_flags[BRITAIN] > V.prestige_flags[FRANCE]) return BRITAIN
	return NONE
}

function prestige_flag_delta() {
	return Math.abs(V.prestige_flags[FRANCE] - V.prestige_flags[BRITAIN])
}

function demand_flag_winner(demand) {
	if (V.demand_flag_count[FRANCE][demand] > V.demand_flag_count[BRITAIN][demand]) return FRANCE
	if (V.demand_flag_count[BRITAIN][demand] > V.demand_flag_count[FRANCE][demand]) return BRITAIN
	return NONE
}

function demand_flag_delta(demand) {
	return Math.abs(V.demand_flag_count[FRANCE][demand] - V.demand_flag_count[BRITAIN][demand])
}

function debt_winner() {
	if (available_debt(FRANCE) > available_debt(BRITAIN) + 1) return FRANCE
	if (available_debt(BRITAIN) > available_debt(FRANCE) + 1) return BRITAIN
	return NONE
}

function debt_delta() {
	return Math.abs(available_debt(FRANCE) - available_debt(BRITAIN))
}

function debt_award() {
	return Math.min(4, Math.floor(debt_delta() / 2))
}

function available_debt(who) {
	return G.debt_limit[who] - G.debt[who]
}

function available_debt_plus_trps(who) {
	return available_debt(who) + G.treaty_points[who]
}

function get_advantage_region(a) {
	return data.spaces[data.advantages[a].req[0]].region
}

function has_advantage(who, a) {
	for (var s of data.advantages[a].req)
		if (V.flags[s] !== who)
			return false
	return true
}

function whose_advantage(a) {
	if (has_advantage(FRANCE, a)) return FRANCE
	if (has_advantage(BRITAIN, a)) return BRITAIN
	return NONE
}

function is_advantage_conflicted(a)
{
	for (var s of data.advantages[a].req) {
		if (has_conflict_marker(s)) return true
	}
	return false
}

function is_ministry_fully_exhausted(who, m) {
	for (let i = 0; i < data.ministries[m].abilities; i++) {
		if (!is_ministry_exhausted(who, m, i)) return false
	}
	return true
}

function is_ministry_partially_exhausted(who, m) {
	for (let i = 0; i < data.ministries[m].abilities; i++) {
		if (is_ministry_exhausted(who, m, i)) return true
	}
	return false
}

function next_peace_turn(turn)
{
	if (turn < PEACE_TURN_2) return PEACE_TURN_2
	if (turn < PEACE_TURN_3) return PEACE_TURN_3
	if (turn < PEACE_TURN_4) return PEACE_TURN_4
	if (turn < PEACE_TURN_5) return PEACE_TURN_5
	if (turn < PEACE_TURN_6) return PEACE_TURN_6
	return GAME_OVER
}

function current_era() {
	if (V.turn < PEACE_TURN_3) return SUCCESSION_ERA
	if (V.turn < PEACE_TURN_5) return EMPIRE_ERA
	return REVOLUTION_ERA
}

/* TOOLTIP ON FOCUS */

function position_tip_image() {
	// postpone actual positioning until browser has laid out everything else
	setTimeout(position_tip_image_imp, 0)
}

function position_tip_image_imp() {
	world.tip.style.left = "0px"
	world.tip.style.bottom = world.status.offsetHeight + "px"
	world.tip.style.display = "flex"
	world.tip.style.right = ""
	world.tip.style.top = ""
}

function advantage_tooltip_image(a, onoff) {
	if (onoff) {
		on_focus_advantage_tip(a)
	} else {
		on_blur_advantage_tip()
	}
}

function on_focus_advantage_tip(a) {
	world.tip.hidden = is_mobile()

	// Show BOTH sides of the marker
	world.tip.innerHTML = `
		<div class="marker square advantage a${a} reverse advantage-back"></div>
		<div class="marker square advantage a${a} advantage-front"></div>	`
}

function on_blur_advantage_tip() {
	world.tip.hidden = true
	world.tip.innerHTML = ""
}

function _tip_focus_demand(d) {
	var name = data.demands[d].name.toLowerCase()
	world.tip.setAttribute("class", "square-sm marker demand " + name)
	position_tip_image()
	world.tip.hidden = is_mobile()
	world.status.innerHTML = demand_tooltip(d)
	demand_tooltip_image(d, true)
}

function _tip_blur_demand(action, id) {
	world.tip.removeAttribute("class")
	world.tip.hidden = true
	world.status.innerHTML = ""
	demand_tooltip_image(0, false)
}

function _tip_focus_event(who, c, name) {
	world.tip.setAttribute("class", name)
	position_tip_image()
	world.tip.hidden = is_mobile()
	world.status.innerHTML = event_tooltip(c, who)
}

function _tip_blur_event(action, id) {
	world.tip.removeAttribute("class")
	world.tip.hidden = true
	world.status.innerHTML = ""
}

function _tip_focus_event_mobile(who, c, name) {
	world.mobile_tip.setAttribute("class", name)
	world.mobile_tip.hidden = !is_mobile()
}

function _tip_focus_ministry_mobile(who, m, name) {
	world.mobile_tip.setAttribute("class", name)
	world.mobile_tip.hidden = !is_mobile()
}

function _tip_blur_mobile_tip() {
	world.mobile_tip.removeAttribute("class")
	world.mobile_tip.hidden = true
}

function _tip_focus_spending(who) {
	world.status.innerHTML = available_debt_tooltip(who)
}

function _tip_blur_spending() {
	world.status.innerHTML = ""
}

function _tip_focus_award(a)
{
	world.tip.setAttribute("class", "square-sm marker black award a" + a)
	position_tip_image()
	world.tip.hidden = is_mobile()

	for (let region = 0; region < NUM_REGIONS; region++) {
		if (V.awards[region] === a) {
			world.status.innerHTML = award_tooltip(region)
		}
	}
}

function _tip_blur_award() {
	world.tip.removeAttribute("class")
	world.tip.hidden = true
	world.status.innerHTML = ""
}

function _tip_focus_investment(i)
{
	world.tip.setAttribute("class", "square marker investment i" + i)
	position_tip_image()
	world.tip.hidden = is_mobile()

	world.status.innerHTML = investment_tooltip(i)
}

function _tip_blur_investment() {
	world.tip.removeAttribute("class")
	world.status.innerHTML = ""
	world.tip.hidden = true
}

function _tip_focus_basic_war_tile(t)
{
	var who = data.basic_war_tiles[t].side
	world.tip.setAttribute("class", "hex marker " + (who ? "br" : "fr") + " war-basic" + t)
	position_tip_image()
	world.tip.hidden = is_mobile()

	world.status.innerHTML = basic_war_tooltip(t, who)
}

function _tip_blur_basic_war_tile() {
	world.tip.removeAttribute("class")
	world.status.innerHTML = ""
	world.tip.hidden = true
}

function _tip_focus_bonus_war_tile(t)
{
	var who = data.bonus_war_tiles[t].side
	world.tip.setAttribute("class", "hex marker " + (who ? "br" : "fr") + " war" + t)
	position_tip_image()
	world.tip.hidden = is_mobile()

	world.status.innerHTML = bonus_war_tooltip(t, who)
}

function _tip_blur_bonus_war_tile() {
	world.tip.removeAttribute("class")
	world.status.innerHTML = ""
	world.tip.hidden = true
}

function _tip_focus_ministry(who, m, name) {
	world.tip.setAttribute("class", name)
	position_tip_image()
	world.tip.hidden = is_mobile()
	world.status.innerHTML = ministry_tooltip(m, who)
}

function _tip_blur_ministry(action, id) {
	world.tip.removeAttribute("class")
	world.tip.hidden = true
	world.status.innerHTML = ""
}

function _tip_focus_advantage(who, a, name) {
	//world.tip.setAttribute("class", name)
	position_tip_image()
	world.tip.hidden = is_mobile()
	world.status.innerHTML = advantage_tooltip(a)

	// Show BOTH sides of the marker
	world.tip.innerHTML = `
		<div class="marker square advantage a${a} reverse advantage-back"></div>
		<div class="marker square advantage a${a} advantage-front"></div>		`
}

function _tip_blur_advantage(action, id) {
	world.tip.removeAttribute("class")
	world.tip.hidden = true
	world.tip.innerHTML = ""
	world.status.innerHTML = ""
}

function _tip_focus_space(who, s, name) {
	world.tip.hidden = is_mobile()
	space_tooltip_image(s, true)
	position_tip_image()
	world.status.innerHTML = space_tooltip(s)
}

function _tip_blur_space(action, id) {
	world.map_tip.hidden = true
	world.tip.removeAttribute("class")
	world.tip.hidden = true
	world.map_tip.hidden = true
	world.status.innerHTML = ""
}

/* TOOLTIPS */

function set_fallback_tips(fallbacks, tip) {
	var menter = function () { world.status.innerHTML = tip }
	var mleave = function () { world.status.innerHTML = "" }
	for (const f of fallbacks) {
		f.onmouseenter = menter
		f.onmouseleave = mleave
	}
}

function space_tooltip(s) {
	var type = data.spaces[s].type
	var typename
	if (type === MARKET) {
		var market = data.spaces[s].market
		if (market !== undefined) {
			typename = data.demands[market].name
		} else {
			typename = "Market"
		}
	} else if (type === POLITICAL) {
		var alliance = (data.spaces[s].alliance !== undefined) && (data.spaces[s].alliance.length > 0)
		var prestige = data.spaces[s].prestige
		if (prestige && !alliance) {
			typename = "Prestige"
		} else if (data.spaces[s].region === REGION_EUROPE) {
			if (prestige) {
				typename = "Prestige + Alliance"
			} else {
				typename = "Alliance"
			}
		} else {
			typename = "Local Alliance"
		}
	} else {
		typename = data.space_types[type].name
	}

	var value
	if ((type !== NAVAL) && (type !== TERRITORY)) {
		value = data.spaces[s].cost
	} else {
		value = 0
	}

	var other = ""

	if (type === NAVAL) {
		if (V.flags[s] !== NONE) {
			other = bold(data.flags[V.flags[s]].adj + " Squadron")
			if (set_has(V.dirty, s)) {
				other += italic(" (already moved this round)")
			}
		}
	} else if (V.flags[s] !== NONE) {
		other = bold(data.flags[V.flags[s]].adj + " Flag")
	}

	if (has_conflict_marker(s)) other += ((other !== "") ? ". " : "") + bold("Conflict.")
	if (is_damaged_fort(s)) other += ((other !== "") ? ". " : "") + bold("Damaged.")

	return bold(data.spaces[s].name) + " " + italic("(" + typename + ((value > 0) ? ": " + value : "") + ")") + ((other !== "") ? ": " + other : "")
}

function space_tooltip_image(s, onoff)
{
	if (onoff && !is_mobile()) {
		let rect = find_layout_node(data.spaces[s].layout ?? data.spaces[s].name)
		if (!rect) return

		if (data.spaces[s].type === POLITICAL) {
			rect = expand_rect(rect, 30, 30)
			rect[1] -= 10
			rect[3] += 10
		} else {
			rect = expand_rect(rect, 20, 20)
		}

		world.map_tip.hidden = false
		world.map_tip.style.backgroundPosition = "-" + rect[0] + "px -" + rect[1] + "px" //need negative offsets
		world.map_tip.style.width = rect[2] + "px"
		world.map_tip.style.height = rect[3] + "px"
	} else {
		world.map_tip.hidden = true
	}
}

function bizarro_space_tooltip(bs) {

	if ((bs >= AWARD_EUROPE) && (bs <= AWARD_INDIA)) {
		return award_tooltip(bs - AWARD_EUROPE)
	}

	if (bs === NAVY_BOX) {
		return bold(data.bizarro_spaces[bs].name) + ": " + italic("(France: " + V.navy_box[FRANCE] + ", Britain: " + V.navy_box[BRITAIN] + ")")
	}

	return bold(data.bizarro_spaces[bs].name)
}

function demand_tooltip(demand) {
	var awards = data.demands[demand].awards[current_era()]
	var awards_string = awards.vp + " VP"
	if (awards.trp > 0) awards_string += ", " + awards.trp + " TRP"
	if (awards.debt !== 0) awards_string += ", " + ((awards.debt > 0) ? "+" : "") + awards.debt + " Debt"
	awards_string += " for most flagged " + data.demands[demand].name + " markets. "
	return bold(data.demands[demand].name) + ": " + italic(awards_string) + bold(data.flags[demand_flag_winner(demand)].name2) + " +" + demand_flag_delta(demand)
}

const demand_columns = [ "1177px", "1264px", "1351px"]
const demand_rows = [ "178px", "198px", "219px", "239px", "260px", "280px"]

function demand_tooltip_image(d, onoff) {
	if (onoff && !is_mobile()) {
		world.demand_highlight.hidden = false
		world.demand_highlight.style.left = demand_columns[current_era()]
		world.demand_highlight.style.top  = demand_rows[d]

		let winner = demand_flag_winner(d)
		switch (winner) {
			case FRANCE:
				world.demand_highlight.className = "fr"
				break
			case BRITAIN:
				world.demand_highlight.className = "br"
				break
			default:
				world.demand_highlight.className = "none"
				break
		}

	} else {
		world.demand_highlight.hidden = true
	}
}

function event_tooltip(c, who) {
	let msg = bold(data.cards[c].name)

	if (data.cards[c].keylabel !== "") {
		msg += " " + parens(data.cards[c].keylabel)
	}

	msg += ": "

	if ((data.cards[c].label !== "") || (data.cards[c].effect !== "")) {
		msg += say_event_effect(data.cards[c].label, data.cards[c].effect, data.cards[c].bonus)
	} else {
		if ((who === undefined) && ((R === FRANCE) || (R === BRITAIN))) {
			if (V.hand[R].includes(c)) who = R
			if (V.played_event === c) {
				who = V.played_event_who ?? V.active
			}
		}

		if (who === FRANCE) {
			msg += say_event_effect(data.cards[c].frenchlabel, data.cards[c].frencheffect, data.cards[c].frenchbonus)
		} else if (who === BRITAIN){
			msg += say_event_effect(data.cards[c].britishlabel, data.cards[c].britisheffect, data.cards[c].britishbonus)
		} else {
			msg += say_event_effect(data.cards[c].frenchlabel, data.cards[c].frencheffect, data.cards[c].frenchbonus)
			msg += " / " + say_event_effect(data.cards[c].britishlabel, data.cards[c].britisheffect, data.cards[c].britishbonus)
		}
	}

	return msg.trim()
}

function say_event_effect(label, effect, bonus) {

	let text = ""
	if (label !== "") {
		text += bold(italic(escape_square_brackets(label)))
		text += ": "
	}
	if (effect !== "") {
		text += escape_square_brackets(effect)
	}

	if (bonus !== "") {
		text += italic(" (" + escape_square_brackets(bonus) + ")")
	}

	return text
}

function ministry_tooltip(m, who) {
	let msg = bold(data.ministries[m].name)

	if (data.ministries[m].keylabel !== "") {
		msg += " " + parens(data.ministries[m].keylabel)
	}

	msg += ": "
	msg += escape_square_brackets(data.ministries[m].effect)

	if (V && V.ministry && Array.isArray(V.ministry)) {
		who = data.ministries[m].side
		if (is_ministry_fully_exhausted(who, m)) {
			msg += " " + bold("EXHAUSTED.")
		} else if (is_ministry_partially_exhausted(who, m)) {
			let report = " Ability #1: "
			report = " Ability #1: " + (is_ministry_exhausted(who, m, 0) ? "EXHAUSTED. " : "Available. ")
			report += " Ability #2: " + (is_ministry_exhausted(who, m, 1) ? "EXHAUSTED. " : "Available. ")
			msg += bold(report)
		}
	}

	return msg
}

function advantage_tooltip(a) {
	let msg = bold(data.advantages[a].name) + ": " + italic(escape_square_brackets(data.advantages[a].desc) + ".")

	if (is_advantage_exhausted(a)) {
		msg += bold(" EXHAUSTED")
	} else if (is_advantage_conflicted(a)) {
		msg += bold(" CONFLICT MARKER - cannot use advantage.")
	} else if ((whose_advantage(a) === V.active) && (V.subphase !== NOT_ACTION_PHASE)) {
		if (V.subphase < PICKED_TILE_OPTION_TO_PASS) {
			msg += bold(" Must pick investment tile before using advantages.")
		} else if (V.adv_used >= 2) {
			msg += bold(" You have already used two advantages this round (see 8.2)")
		} else if (V.adv_regions & (1 << get_advantage_region(a))) {
			msg += bold(" You have already used an advantage in the same region this round (see 8.2)")
		} else if (V.adv_new & (1 << a)) {
			msg += bold(" Cannot use an advantage you just acquired (see 8.0)")
		}
	}

	return msg
}

function investment_tooltip(i)
{
	let msg = bold("Investment Tile: ") + data.investments[i].name
	if (V.inv_used.includes(i)) {
		msg += " (Used on previous turn)"
	} else {
		let avail = true
		for (let whom = FRANCE; whom <= BRITAIN; whom++) {
			if (V.played_tiles[whom].includes(i)) {
				msg += italic(" (Chosen by " + data.flags[whom].name + ", action round " + (V.played_tiles[whom].indexOf(i) + 1) + ")")
				avail = false
				break
			}
		}

		if (avail) msg += italic(" (Available)")
	}

	return msg
}

function award_tooltip(region) {
	var award = V.awards[region]
	return bold(data.bizarro_spaces[AWARD_EUROPE + region].name) + ": "
		+ italic(data.awards[award].name + ((region === REGION_EUROPE) ? " for most total flags and +2 VP for most flagged prestige spaces" : " for most total flags"))
		+ ". " + ((region === REGION_EUROPE) ? bold("Flags " ) : "") + bold(data.flags[region_flag_winner(region)].name2 + " +" + region_flag_delta(region)
			+ ((region === REGION_EUROPE) ? " / Prestige " + data.flags[prestige_winner()].name2 + " +" + prestige_flag_delta() : ""))
}

function available_debt_tooltip(who) {
	let msg = bold(data.flags[who].adj + " " + "Available Spending: " + available_debt_plus_trps(who) + ".")
	msg += italic(" (Debt: " + V.debt[who] + ", Debt Limit: " + V.debt_limit[who] + ", Treaty Points: " + V.treaty_points[who] + ")")
	return msg
}

function game_turn_tooltip(x) {
	let tip = bold ("Current Game Turn: ")
	if (data.turns[G.turn].war) {
		tip += data.turns[G.turn].name
	} else {
		tip += data.turns[G.turn].id + " - PEACE"
	}
	tip += " " + italic(parens(data.turns[G.turn].dates))
	return tip
}

function vp_tooltip(x) {
	return bold("Victory Points: ") + V.vp
}

function debt_tooltip(who) {
	let msg = bold(data.flags[who].adj + " Debt: ") + V.debt[who]
	msg += italic(" (Debt Limit: " + V.debt_limit[who] + ")")
	return msg
}

function debt_limit_tooltip(who) {
	let msg = bold(data.flags[who].adj + " Debt Limit: ") + V.debt_limit[who]
	msg += italic(" (Current Debt: " + V.debt[who] + ")")
	return msg
}

function treaty_points_tooltip(who) {
	return bold(data.flags[who].adj + " Treaty Points: ") + V.treaty_points[who]
}

function initiative_tooltip(who) {
	return bold("Initiative: ") + data.flags[who].name
}

function townshend_tooltip(who) {
	return bold("Townshend Acts") + " " + italic(parens(data.demands[V.townshend_acts].name)) + ": British minor action can be used to unflag this demand's markets."
}

function jacobite_victory_tooltip() {
	return bold("Jacobite Victory: ") + "+1 VP when using Jacobite Uprisings ministry."
}

function jacobite_defeat_tooltip() {
	return bold("Jacobite Defeat: ") + "No more Jacobite Uprisings for rest of game."
}

function basic_war_tooltip(t, who) {
	let msg = bold(data.flags[who].adj + " Basic War Tile: ")
	let msg2 = ""

	if (t < 0) {
		msg += "Hidden"
		return msg
	}

	let val = data.basic_war_tiles[t].val
	msg += ((val >= 0) ? "+" + val : val)
	switch (data.basic_war_tiles[t].type) {
		case WAR_DEBT:
			msg += " with Debt"
			msg2 = data.flags[1-who].name + " must spend one debt"
			break
		case WAR_FORT:
			msg += " with Fort/Fleet"
			msg2 = data.flags[1-who].name + " must damage one of its forts or retire a squadron"
			break
		case WAR_FLAG:
			msg += " with Flag"
			msg2 = data.flags[who].name + " unflags a " + data.flags[1-who].adj + " market or political space"
			break
	}
	if (msg2 !== "") {
		msg += " " + italic(parens(msg2))
	}
	return msg
}

function bonus_war_tooltip(t, who) {
	let msg = bold(data.flags[who].adj + " Bonus War Tile: ")
	let msg2 = ""

	if (t < 0) {
		msg += "Hidden"
		return msg
	}

	let name = data.bonus_war_tiles[t].name
	let val = data.bonus_war_tiles[t].val
	msg += name + " (+" + val
	switch (data.bonus_war_tiles[t].type) {
		case WAR_DEBT:
			msg += " with Debt"
			msg2 = data.flags[1-who].name + " must spend one debt"
			break
		case WAR_FORT:
			msg += " with Fort/Fleet"
			msg2 = data.flags[1-who].name + " must damage one of its forts or retire a squadron"
			break
	}
	if (msg2 !== "") {
		msg += ". " + italic(msg2)
	}
	msg += ")"
	return msg
}

/* ON INIT */

function on_init() {
	var i, a, s, x, y, w, h, lout

	update_favicon("favicon1.png")

	create_window("scoring_summary_dialog", "Scoring Summary", update_scoring_summary_dialog)
	create_window("final_scoring_summary_dialog", "Final Scoring Summary", update_final_scoring_summary_dialog)
	create_window("event_card_dialog", "Event Cards", update_event_card_dialog, true)
	create_window("french_ministry_dialog", "French Ministry", update_french_ministry_dialog, true)
	create_window("british_ministry_dialog", "British Ministry", update_british_ministry_dialog, true)

	new ResizeObserver(() => { update_window_content("event_card_dialog", update_event_card_dialog()) }).observe(lookup_window("event_card_dialog").element)

	/*
	let dialog = document.getElementById("event_card_dialog")
	dialog.addEventListener(
		"resize",
		() => {
			console.log("RESIZE!")
			update_window_content("event_card_dialog", update_event_card_dialog())
		}
	)

	// Event Card reformats itself based on size, so refresh it when it is resized
	lookup_window("event_card_dialog").element.addEventListener(
		"resize",
		function () {
			console.log ("RESIZE!!!")
			update_window_content("event_card_dialog", update_event_card_dialog())
		}
	)
	*/

	console.log(lookup_window("event_card_dialog"))

	init_preference_checkbox("noanims", false)
	init_preference_checkbox("noflipsies", false)
	init_preference_checkbox("downanddirty", false)
	init_preference_checkbox("tracksies", true)
	init_preference_checkbox("redsies", false)
	init_preference_checkbox("allwars", false)
	init_preference_checkbox("scoresies", false)
	init_preference_checkbox("eventsies", true)

	init_preference_radio("actionverbosity", "medium", function () {
		mention_verbosity()
	})

	roles[FRANCE].stat.addEventListener("click", function () { scroll_to_debt(FRANCE) })
	roles[FRANCE].stat.addEventListener("mouseenter", function () { world.status.innerHTML = available_debt_tooltip(FRANCE) })
	roles[FRANCE].stat.addEventListener("mouseleave", function () { world.status.innerHTML = "" })

	roles[BRITAIN].stat.addEventListener("click", function () { scroll_to_debt(BRITAIN) })
	roles[BRITAIN].stat.addEventListener("mouseenter", function () { world.status.innerHTML = available_debt_tooltip(BRITAIN) })
	roles[BRITAIN].stat.addEventListener("mouseleave", function () { world.status.innerHTML = "" })

	// Rollovers for top toolbar
	let toolbar = document.getElementById("toolbar")
	if (toolbar) {
		let cog = toolbar.firstElementChild
		if (cog) {
			cog.onmouseenter = () => { world.status.innerHTML = bold("Tools: ") + "Recent changes list, UI options, navigation, notepad, and resign." }
			cog.onmouseleave = () => { world.status.innerHTML = ""}
		}
		let log_button = document.getElementById("log_button")
		if (log_button) {
			log_button.onmouseenter = () => { world.status.innerHTML = bold("Toggle Log: ") + "Shows or hides the game log." + (!is_mobile() ? italic(" Hotkey: L.") : "") }
			log_button.onmouseleave = () => { world.status.innerHTML = ""}
		}
		let zoom_button = document.getElementById("zoom_button")
		if (zoom_button) {
			zoom_button.onmouseenter = () => { world.status.innerHTML = bold("Zoom: ") + "Switches map zoom mode between Fit-to-Width, Fit-to-Both, and free zoom. General zooming can be performed with Ctrl+Mousewheel on desktop or pinch on mobile." + (!is_mobile() ? italic(" Hotkey: Z.") : "") }
			zoom_button.onmouseleave = () => { world.status.innerHTML = ""}
		}
		let chat_button = document.getElementById("chat_button")
		if (chat_button) {
			chat_button.onmouseenter = () => { world.status.innerHTML = bold("Chat: ") + "Shows or hides the chat window." + (!is_mobile() ? italic(" Hotkey: ENTER.") : "")}
			chat_button.onmouseleave = () => { world.status.innerHTML = ""}
		}
		let info_button = document.getElementById("info_menu")
		if (info_button) {
			info_button.onmouseenter = () => { world.status.innerHTML = bold("Info: ") + "Card lists, summaries, scroll hotkeys, rulebook, player aids."}
			info_button.onmouseleave = () => { world.status.innerHTML = ""}
			let world_button = info_button.nextElementSibling
			if (world_button) {
				world_button.onmouseenter = () => { world.status.innerHTML = bold("World: ") + "Shows, or temporarily hides, all counters on the map." + (!is_mobile() ? italic(" Hotkey: SPACE (or hold SHIFT for quick peek).") : "")}
				world_button.onmouseleave = () => { world.status.innerHTML = ""}
			}
		}
		let prompt_button = document.getElementById("prompt")
		if (prompt_button) {
			prompt_button.onmouseenter = () => { world.status.innerHTML = bold("Prompt: ") + "When this bar is shown in your team colour, it is your turn to act and the message explains your current choices; buttons will appear to the right offering some choices, and actionable spaces/counters/cards will be highlighted on the map. When this bar is shown in brown, that generally means the game awaits your opponent's attention." }
			prompt_button.onmouseleave = () => { world.status.innerHTML = ""}
		}
	}

	//BR// get_preference("noanims", false) (second argument is the "default" value if it's not set or has been deleted)
	//BR// body[data-noanims="true"] .space.action { non-animated css }

	define_panel("#events_fr", "panel-events", FRANCE)
	define_panel("#ministry_fr", "panel-ministry", FRANCE)
	define_panel("#advantage_fr", "panel-advantage", FRANCE)

	define_panel("#events_br", "panel-events", BRITAIN)
	define_panel("#ministry_br", "panel-ministry", BRITAIN)
	define_panel("#advantage_br", "panel-advantage", BRITAIN)

	define_panel("#all_ministries", "panel-all-ministries")
	define_panel("#played", "panel-played", 0)
	define_panel("#available_investment_tiles", "panel-available-investments")
	define_panel("#used_investment_tiles", "panel-used-investments")
	define_panel("#upcoming_investment_tiles", "panel-upcoming-investments")

	define_board("#map", 2550, 1650, [0, 0, 0, 0])

	for (s of data.bizarro_spaces) {
		if (s.layout.includes("record track")) continue
		var rect = find_layout_node(s.layout ?? s.name)
		if (!rect) {
			// console.log("No layout for Bizarro Space: " + s.name)
			continue
		}
		define_thing("tip-bizarro", s.num).layout(rect).tooltip(bizarro_space_tooltip)
	}

	define_stack("lout-jacobite", undefined, [1750, 240, 40, 40], 5, -5, 0, -50)
	define_marker("jacobite-victory", 0, "square-sm jacobite-victory").tooltip(jacobite_victory_tooltip)
	define_marker("jacobite-victory", 1, "square-sm jacobite-victory").tooltip(jacobite_victory_tooltip)
	define_marker("jacobite-defeat", 0, "square-sm jacobite-defeat").tooltip(jacobite_defeat_tooltip)

	// Extra ones to put on the turn track
	define_marker("jacobite-victory", 2, "square-sm jacobite-victory").tooltip(jacobite_victory_tooltip)    // These ones go on turn track and should "center" in their turn track spaces
	define_marker("jacobite-victory", 3, "square-sm jacobite-victory").tooltip(jacobite_victory_tooltip)
	define_marker("jacobite-defeat", 1, "square-sm jacobite-defeat").tooltip(jacobite_defeat_tooltip)

	for (s of data.spaces) {
		let layout_rect, conflict_rect, damaged_rect, huguenot_rect
		let rect = find_layout_node(s.layout ?? s.name)
		if (!rect) {
			console.error("no layout for " + s.name)
			continue
		}

		if (s.type === POLITICAL) rect = resize_rect(rect, 124, 124)
		else if (s.type === MARKET) rect = resize_rect(rect, 110, 110)
		else if (s.type === TERRITORY) rect = resize_rect(rect, 142, 142)
		else if (s.type === NAVAL || s.type === FORT) rect = resize_rect(rect, 118, 118)

		define_space("space", s.num, rect)
			.keyword(space_type_class[s.type])
			.tooltip(space_tooltip)
			.tooltip_image(space_tooltip_image)

		if (s.type === TERRITORY) {
			layout_rect = translate_rect(rect, 0, -38) //BR// Territory markers displayed above the spaces
		} else if (s.type === MARKET) {
			layout_rect = translate_rect(rect, 0, -3) // Move every market flag position up a bit
		} else if (s.type === FORT) {
			layout_rect = translate_rect(rect, -1, -12) // Move every fort flag position up a bunchy (uncover the fort number)
		} else {
			layout_rect = rect
		}
		define_layout("lout-space", s.num, layout_rect)

		if ((s.type === POLITICAL) || (s.type === MARKET)) {
			conflict_rect = rect
			if (s.type === MARKET) {
				if ([NORTHEAST_CHANNEL, OSWEGO].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, -65, -40) // upper left
				} else if ([PUERTO_RICO, CUBA_PASSAGE_EAST, MARTINIQUE].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, -15, -65) // Upper middle
				} else if ([CAICOS, PUERTO_PRINCIPE, TIRUCHIRAPPALLI].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, 32, -40) // Upper right
				} else if ([NIAGARA, HAVANA, ANTIGUA, KURPA].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, -65, 20) // lower left
				} else {
					conflict_rect = translate_rect(conflict_rect, 32, 22) // Conflict markers positioning - default lower right
				}
			} else if (s.type === POLITICAL) {
				if ([PRIVATEERS, IRELAND_1, SCOTLAND_1, DUTCH_1, GERMAN_STATES_1, PRUSSIA_3, SPAIN_3, AUSTRIA_3].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, -63, 27) // Conflict markers positioning - lower right
				} else if ([PRUSSIA_1, SPAIN_1, BAVARIA].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, -63, -55) // Conflict markers positioning - upper left
				} else if ([USA_1].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, -63, 27) // Conflict markers positioning - lower left
				} else if ([DUTCH_2].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, -15, 50) // Conflict markers positioning - lower middle
				} else if ([AUSTRIA_1].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, -15, -68) // Conflict markers positioning - upper middle
				} else if ([SPAIN_2, AUSTRIA_2, PRUSSIA_2].includes(s.num)) {
					conflict_rect = translate_rect(conflict_rect, 30, -55) // Conflict markers positioning - upper right
				} else {
					conflict_rect = translate_rect(conflict_rect, 30, 27) // Conflict markers positioning - default lower right
				}
			}
			conflict_rect = resize_rect(conflict_rect, 35, 35)     // fit to the counters, at least approximately
			define_layout("lout-conflict", s.num, conflict_rect).keyword("grav-nw")
		}

		if (s.type === FORT) {
			damaged_rect = translate_rect(layout_rect, 40, 37) // Damaged markers
			damaged_rect = resize_rect(damaged_rect, 35, 35)     // fit to the counters, at least approximately
			define_layout("lout-damaged", s.num, damaged_rect)
		}

		if (s.type === TERRITORY) {
			if ((s.region === REGION_NORTH_AMERICA) || (s.region === REGION_CARIBBEAN)) {
				huguenot_rect = translate_rect(layout_rect, 35, 75) // Huguenot markers displayed at center of territory
				huguenot_rect = resize_rect(huguenot_rect, 35, 35) // fit to the counters
				define_layout("lout-huguenots", s.num, huguenot_rect)
			}
		}
	}

	for (i = -7; i <= 36; ++i) { //NB: Yup, it's -7 through 36, inclusive! Whee!
		define_stack("general-track", i,
			resize_rect(find_layout_node("record track " + i), 49, 49),
			5, -5,
			0, -50
		)
	}

	for (s of data.turns) {
		define_stack("turn-track", s.num, find_layout_node(s.layout), 8, -8, 0, -50)
	}

	define_thing("award-winner-left", REGION_EUROPE).layout(find_layout_node("Award_winner Europe Left"))
	define_thing("award-winner-left", REGION_NORTH_AMERICA).layout(find_layout_node("Award_winner North America Left"))
	define_thing("award-winner-left", REGION_CARIBBEAN).layout(find_layout_node("Award_winner Caribbean Left"))
	define_thing("award-winner-left", REGION_INDIA).layout(find_layout_node("Award_winner India Left"))
	define_thing("award-winner-left", REGION_AWARD).layout(find_layout_node("Award_winner Europe Prestige Left"))

	define_thing("award-winner-right", REGION_EUROPE).layout(find_layout_node("Award_winner Europe Right"))
	define_thing("award-winner-right", REGION_NORTH_AMERICA).layout(find_layout_node("Award_winner North America Right"))
	define_thing("award-winner-right", REGION_CARIBBEAN).layout(find_layout_node("Award_winner Caribbean Right"))
	define_thing("award-winner-right", REGION_INDIA).layout(find_layout_node("Award_winner India Right"))
	define_thing("award-winner-right", REGION_AWARD).layout(find_layout_node("Award_winner Europe Prestige Right"))

	define_layout("lout-demand", undefined, find_layout_node("Demand"))
	define_layout("lout-initiative", undefined, find_layout_node("Initiative"))

	define_layout("lout-award", REGION_EUROPE, find_layout_node("Award Europe"))
	define_layout("lout-award", REGION_NORTH_AMERICA, find_layout_node("Award North America"))
	define_layout("lout-award", REGION_CARIBBEAN, find_layout_node("Award Caribbean"))
	define_layout("lout-award", REGION_INDIA, find_layout_node("Award India"))

	//define_thing("tip-award", REGION_EUROPE).layout(find_layout_node("Award Europe")).tooltip(award_tooltip)
	//define_thing("tip-award", REGION_NORTH_AMERICA).layout(find_layout_node("Award North America")).tooltip(award_tooltip)
	//define_thing("tip-award", REGION_CARIBBEAN).layout(find_layout_node("Award Caribbean")).tooltip(award_tooltip)
	//define_thing("tip-award", REGION_INDIA).layout(find_layout_node("Award India")).tooltip(award_tooltip)

	define_marker("game-turn", 0, "square-sm").tooltip(game_turn_tooltip)
	define_marker("victory-points", undefined, "square-sm black").tooltip(vp_tooltip)
	define_marker("debt", FRANCE, "square-sm fr").tooltip(debt_tooltip)
	define_marker("debt", BRITAIN, "square-sm br").tooltip(debt_tooltip)
	define_marker("debt-limit", FRANCE, "square-sm fr").tooltip(debt_limit_tooltip)
	define_marker("debt-limit", BRITAIN, "square-sm br").tooltip(debt_limit_tooltip)
	define_marker("treaty-points", FRANCE, "square-sm treaty-points-fr").tooltip(treaty_points_tooltip)
	define_marker("treaty-points", BRITAIN, "square-sm treaty-points-br").tooltip(treaty_points_tooltip)
	define_marker("initiative", FRANCE, "square-sm initiative-fr").tooltip(initiative_tooltip)
	define_marker("initiative", BRITAIN, "square-sm initiative-br").tooltip(initiative_tooltip)

	define_marker("townshend-acts", undefined, "square-sm townshend_acts").tooltip(townshend_tooltip)

	define_stack("stack-deal", undefined, find_layout_node("Deal Tiles"))

	define_space("navy_box", 0, find_layout_node("Navy Box")).tooltip(() => bizarro_space_tooltip(NAVY_BOX))
	define_stack("lout-navy", FRANCE, find_layout_node("Navy Box Britain"), 8, -8, 0, -50)
	define_stack("lout-navy", BRITAIN, find_layout_node("Navy Box France"), 8, -8, 0, -50)

	for (i = 0; i < 4; ++i) {
		define_marker("action-br", i, `square-sm action_${i + 1} br`).tooltip(bold("Britain Action Round " + (i + 1)))
		define_marker("action-fr", i, `square-sm action_${i + 1} fr`).tooltip(bold("France Action Round " + (i + 1)))
	}

	for (i = 0; i < NUM_SPACES; ++i) {
		let t = data.spaces[i].type
		if ((t === POLITICAL) || (t === MARKET)) {
			define_marker("conflict", i, "hex-sm").tooltip(bold("Conflict Marker"))
		} else if (t === FORT) {
			define_marker("damaged", i, "hex-sm").tooltip(bold("Fort Damaged Marker"))
		}
	}

	for (a of data.demands) {
		define_marker("demand", a.num)
			.keyword("square-sm")
			.keyword(a.name.toLowerCase())
			.tooltip(demand_tooltip)
			.tooltip_image(demand_tooltip_image)
	}

	for (a of data.awards) {
		define_marker("award", a.num)
			.keyword("square-sm black a" + a.num)
			.tooltip(a.name)
	}

	for (a of data.advantages) {
		var rect = find_layout_node(a.name)
		define_layout("lout-advantage", a.num, resize_rect(rect, 88, 88))
		define_space("advantage", a.num, resize_rect(rect, 112, 112))
			.tooltip(advantage_tooltip)
			.tooltip_image(advantage_tooltip_image)
		define_marker("advantage", a.num)
			.keyword("square advantage a" + a.num)
			.tooltip(advantage_tooltip)
			.tooltip_image(advantage_tooltip_image)
	}

	for (a of data.investments) {
		define_marker("investment", a.num)
			.keyword("square investment i" + a.num)
			.tooltip(investment_tooltip)
	}

	for (i = 1; i <= NUM_EVENT_CARDS; ++i) {
		define_card("event_card", i)
			.animate()
			.keyword("c" + i)
			.tooltip(event_tooltip)
	}

	for (i = 1; i <= 26; ++i) {
		define_card("ministry_card", i)
			.animate()
			.keyword("c" + i)
			.tooltip(ministry_tooltip)
	}

	for (i = 0; i < NUM_BASE_WAR_TILES; ++i) {
		define_marker("basic_war", i + 0, "hex fr war-basic" + (i + 0)).tooltip(basic_war_tooltip(i, FRANCE))
		define_marker("basic_war", i + 16, "hex br war-basic" + (i + 16)).tooltip(basic_war_tooltip(i, BRITAIN))
	}

	for (i = 0; i < NUM_BONUS_WAR_TILES; ++i) {
		define_marker("bonus_war", (i + 0), "hex fr war" + (i + 0)).tooltip(bonus_war_tooltip(i, FRANCE))
		define_marker("bonus_war", (i + 12), "hex br war" + (i + 12)).tooltip(bonus_war_tooltip(i + 12, BRITAIN))
		define_marker("bonus_war", (i + 24), "hex fr war" + (i + 24)).tooltip(bonus_war_tooltip(i + 24, FRANCE))
		define_marker("bonus_war", (i + 36), "hex br war" + (i + 36)).tooltip(bonus_war_tooltip(i + 36, BRITAIN))
		define_marker("bonus_war", (i + 48), "hex fr war" + (i + 48)).tooltip(bonus_war_tooltip(i + 48, FRANCE))
		define_marker("bonus_war", (i + 60), "hex br war" + (i + 60)).tooltip(bonus_war_tooltip(i + 60, BRITAIN))
		define_marker("bonus_war", (i + 72), "hex fr war" + (i + 72)).tooltip(bonus_war_tooltip(i + 72, FRANCE))
		define_marker("bonus_war", (i + 84), "hex br war" + (i + 84)).tooltip(bonus_war_tooltip(i + 84, BRITAIN))
	}

	define_marker("bonus_war", ATLANTIC_DOMINANCE + FRANCE, "hex-sm atlantic-dominance fr").tooltip(bonus_war_tooltip(96, FRANCE))
	define_marker("bonus_war", ATLANTIC_DOMINANCE + BRITAIN, "hex-sm atlantic-dominance br").tooltip(bonus_war_tooltip(97, BRITAIN))
	define_marker("bonus_war", BYNG, "hex-sm byng").tooltip(bonus_war_tooltip(BYNG, BRITAIN))

	define_board("#war_wss", 1100, 850)
	{
		define_space("theater", 1, war_layout.war_wss_theater_1)
		define_space("theater", 2, war_layout.war_wss_theater_2)
		define_space("theater", 3, war_layout.war_wss_theater_3)
		define_space("theater", 4, war_layout.war_wss_theater_4)

		define_layout("lout-theater-drawn", 0, layout_theater_drawn)

		define_layout("lout-theater", 1, war_layout.war_wss_theater_1_france)
		define_layout("lout-theater", 2, war_layout.war_wss_theater_1_britain)
		define_layout("lout-theater", 3, war_layout.war_wss_theater_2_france)
		define_layout("lout-theater", 4, war_layout.war_wss_theater_2_britain)
		define_layout("lout-theater", 5, war_layout.war_wss_theater_3_france)
		define_layout("lout-theater", 6, war_layout.war_wss_theater_3_britain)
		define_layout("lout-theater", 7, war_layout.war_wss_theater_4_france)
		define_layout("lout-theater", 8, war_layout.war_wss_theater_4_britain)

		define_thing("war-strength-br", 11).layout(war_layout.war_wss_theater_1_strength_br)
		define_thing("war-strength-br", 12).layout(war_layout.war_wss_theater_2_strength_br)
		define_thing("war-strength-br", 13).layout(war_layout.war_wss_theater_3_strength_br)
		define_thing("war-strength-br", 14).layout(war_layout.war_wss_theater_4_strength_br)
		define_thing("war-strength-fr", 11).layout(war_layout.war_wss_theater_1_strength_fr)
		define_thing("war-strength-fr", 12).layout(war_layout.war_wss_theater_2_strength_fr)
		define_thing("war-strength-fr", 13).layout(war_layout.war_wss_theater_3_strength_fr)
		define_thing("war-strength-fr", 14).layout(war_layout.war_wss_theater_4_strength_fr)

		define_thing("war-winner", 11).layout(war_layout.war_wss_theater_1_winner)
		define_thing("war-winner", 12).layout(war_layout.war_wss_theater_2_winner)
		define_thing("war-winner", 13).layout(war_layout.war_wss_theater_3_winner)
		define_thing("war-winner", 14).layout(war_layout.war_wss_theater_4_winner)

		define_thing("war-alliance", 11).layout(war_layout.war_wss_theater_1_alliances)
		define_thing("war-alliance", 12).layout(war_layout.war_wss_theater_2_alliances)
		define_thing("war-alliance", 13).layout(war_layout.war_wss_theater_3_alliances)
		define_thing("war-alliance", 14).layout(war_layout.war_wss_theater_4_alliances)

		define_thing("war-margin", 111).layout([ 80,  304, 410, 17])
		define_thing("war-margin", 112).layout([ 80,  322, 410, 17])
		define_thing("war-margin", 113).layout([ 80,  340, 410, 17])
		define_thing("war-margin", 121).layout([600,  306, 412, 17])
		define_thing("war-margin", 122).layout([600,  324, 412, 17])
		define_thing("war-margin", 123).layout([600,  343, 412, 17])
		define_thing("war-margin", 131).layout([ 80,  680, 412, 17])
		define_thing("war-margin", 132).layout([ 80,  698, 412, 17])
		define_thing("war-margin", 133).layout([ 80,  717, 412, 30])
		define_thing("war-margin", 141).layout([600,  680, 412, 17])
		define_thing("war-margin", 142).layout([600,  698, 412, 17])
		define_thing("war-margin", 143).layout([600,  717, 412, 17])
	}

	define_board("#war_was", 1100, 850)
	{
		define_space("theater", 5, war_layout.war_was_theater_1)
		define_space("theater", 6, war_layout.war_was_theater_2)
		define_space("theater", 7, war_layout.war_was_theater_3)
		define_space("theater", 8, war_layout.war_was_theater_4)

		define_layout("lout-theater-drawn", 1, layout_theater_drawn)

		define_layout("lout-theater", 9, war_layout.war_was_theater_1_france)
		define_layout("lout-theater", 10, war_layout.war_was_theater_1_britain)
		define_layout("lout-theater", 11, war_layout.war_was_theater_2_france)
		define_layout("lout-theater", 12, war_layout.war_was_theater_2_britain)
		define_layout("lout-theater", 13, war_layout.war_was_theater_3_france)
		define_layout("lout-theater", 14, war_layout.war_was_theater_3_britain)
		define_layout("lout-theater", 15, war_layout.war_was_theater_4_france)
		define_layout("lout-theater", 16, war_layout.war_was_theater_4_britain)

		define_thing("war-strength-br", 21).layout(war_layout.war_was_theater_1_strength_br)
		define_thing("war-strength-br", 22).layout(war_layout.war_was_theater_2_strength_br)
		define_thing("war-strength-br", 23).layout(war_layout.war_was_theater_3_strength_br)
		define_thing("war-strength-br", 24).layout(war_layout.war_was_theater_4_strength_br)
		define_thing("war-strength-fr", 21).layout(war_layout.war_was_theater_1_strength_fr)
		define_thing("war-strength-fr", 22).layout(war_layout.war_was_theater_2_strength_fr)
		define_thing("war-strength-fr", 23).layout(war_layout.war_was_theater_3_strength_fr)
		define_thing("war-strength-fr", 24).layout(war_layout.war_was_theater_4_strength_fr)

		define_thing("war-winner", 21).layout(war_layout.war_was_theater_1_winner)
		define_thing("war-winner", 22).layout(war_layout.war_was_theater_2_winner)
		define_thing("war-winner", 23).layout(war_layout.war_was_theater_3_winner)
		define_thing("war-winner", 24).layout(war_layout.war_was_theater_4_winner)

		define_thing("war-alliance", 21).layout(war_layout.war_was_theater_1_alliances)
		define_thing("war-alliance", 22).layout(war_layout.war_was_theater_2_alliances)
		define_thing("war-alliance", 23).layout(war_layout.war_was_theater_3_alliances)
		define_thing("war-alliance", 24).layout(war_layout.war_was_theater_4_alliances)

		define_thing("war-margin", 211).layout([102,  283, 360, 17])
		define_thing("war-margin", 212).layout([102,  301, 360, 17])
		define_thing("war-margin", 213).layout([102,  301, 360, 17])
		define_thing("war-margin", 221).layout([600,  283, 412, 17])
		define_thing("war-margin", 222).layout([600,  301, 412, 17])
		define_thing("war-margin", 223).layout([600,  301, 412, 17])
		define_thing("war-margin", 231).layout([ 80,  615, 412, 17])
		define_thing("war-margin", 232).layout([ 80,  632, 412, 17])
		define_thing("war-margin", 233).layout([ 80,  650, 412, 17])
		define_thing("war-margin", 241).layout([578,  591, 459, 17])
		define_thing("war-margin", 242).layout([578,  609, 459, 17])
		define_thing("war-margin", 243).layout([578,  627, 459, 17])
		define_thing("war-margin", 244).layout([578,  669, 459, 17])
		define_thing("war-margin", 245).layout([578,  687, 459, 17])
		define_thing("war-margin", 246).layout([578,  705, 459, 17])
	}

	define_board("#war_7yw", 1100, 850)
	{
		define_space("theater", 9, war_layout.war_7yw_theater_1)
		define_space("theater", 10, war_layout.war_7yw_theater_2)
		define_space("theater", 11, war_layout.war_7yw_theater_3)
		define_space("theater", 12, war_layout.war_7yw_theater_4)

		define_layout("lout-theater-drawn", 2, layout_theater_drawn)

		define_layout("lout-theater", 17, war_layout.war_7yw_theater_1_france)
		define_layout("lout-theater", 18, war_layout.war_7yw_theater_1_britain)
		define_layout("lout-theater", 19, war_layout.war_7yw_theater_2_france)
		define_layout("lout-theater", 20, war_layout.war_7yw_theater_2_britain)
		define_layout("lout-theater", 21, war_layout.war_7yw_theater_3_france)
		define_layout("lout-theater", 22, war_layout.war_7yw_theater_3_britain)
		define_layout("lout-theater", 23, war_layout.war_7yw_theater_4_france)
		define_layout("lout-theater", 24, war_layout.war_7yw_theater_4_britain)

		define_thing("war-strength-br", 31).layout(war_layout.war_7yw_theater_1_strength_br)
		define_thing("war-strength-br", 32).layout(war_layout.war_7yw_theater_2_strength_br)
		define_thing("war-strength-br", 33).layout(war_layout.war_7yw_theater_3_strength_br)
		define_thing("war-strength-br", 34).layout(war_layout.war_7yw_theater_4_strength_br)
		define_thing("war-strength-fr", 31).layout(war_layout.war_7yw_theater_1_strength_fr)
		define_thing("war-strength-fr", 32).layout(war_layout.war_7yw_theater_2_strength_fr)
		define_thing("war-strength-fr", 33).layout(war_layout.war_7yw_theater_3_strength_fr)
		define_thing("war-strength-fr", 34).layout(war_layout.war_7yw_theater_4_strength_fr)

		define_thing("war-winner", 31).layout(war_layout.war_7yw_theater_1_winner)
		define_thing("war-winner", 32).layout(war_layout.war_7yw_theater_2_winner)
		define_thing("war-winner", 33).layout(war_layout.war_7yw_theater_3_winner)
		define_thing("war-winner", 34).layout(war_layout.war_7yw_theater_4_winner)

		define_thing("war-alliance", 31).layout(war_layout.war_7yw_theater_1_alliances)
		define_thing("war-alliance", 32).layout(war_layout.war_7yw_theater_2_alliances)
		define_thing("war-alliance", 33).layout(war_layout.war_7yw_theater_3_alliances).keyword("french-indian-war")
		define_thing("war-alliance", 34).layout(war_layout.war_7yw_theater_4_alliances)

		define_thing("war-margin", 311).layout([ 88,  306, 396, 32])
		define_thing("war-margin", 312).layout([ 88,  339, 396, 32])
		define_thing("war-margin", 313).layout([ 88,  372, 396, 32])
		define_thing("war-margin", 321).layout([600,  306, 412, 17])
		define_thing("war-margin", 322).layout([600,  324, 412, 17])
		define_thing("war-margin", 323).layout([600,  342, 412, 17])
		define_thing("war-margin", 331).layout([ 80,  671, 412, 17])
		define_thing("war-margin", 332).layout([ 80,  689, 412, 17])
		define_thing("war-margin", 333).layout([ 80,  707, 412, 17])
		define_thing("war-margin", 341).layout([600,  709, 416, 17])
		define_thing("war-margin", 342).layout([600,  727, 416, 17])
		define_thing("war-margin", 343).layout([600,  745, 416, 17])
	}

	define_board("#war_awi", 1100, 850)
	{
		define_space("theater", 13, war_layout.war_awi_theater_1)
		define_space("theater", 14, war_layout.war_awi_theater_2)
		define_space("theater", 15, war_layout.war_awi_theater_3)

		define_layout("lout-theater-drawn", 3, layout_theater_drawn)

		define_layout("lout-theater", 25, war_layout.war_awi_theater_1_france)
		define_layout("lout-theater", 26, war_layout.war_awi_theater_1_britain)
		define_layout("lout-theater", 27, war_layout.war_awi_theater_2_france)
		define_layout("lout-theater", 28, war_layout.war_awi_theater_2_britain)
		define_layout("lout-theater", 29, war_layout.war_awi_theater_3_france)
		define_layout("lout-theater", 30, war_layout.war_awi_theater_3_britain)

		define_thing("war-strength-br", 41).layout(war_layout.war_awi_theater_1_strength_br)
		define_thing("war-strength-br", 42).layout(war_layout.war_awi_theater_2_strength_br)
		define_thing("war-strength-br", 43).layout(war_layout.war_awi_theater_3_strength_br)
		define_thing("war-strength-fr", 41).layout(war_layout.war_awi_theater_1_strength_fr)
		define_thing("war-strength-fr", 42).layout(war_layout.war_awi_theater_2_strength_fr)
		define_thing("war-strength-fr", 43).layout(war_layout.war_awi_theater_3_strength_fr)

		define_thing("war-winner", 41).layout(war_layout.war_awi_theater_1_winner)
		define_thing("war-winner", 42).layout(war_layout.war_awi_theater_2_winner)
		define_thing("war-winner", 43).layout(war_layout.war_awi_theater_3_winner)

		define_thing("war-alliance", 41).layout(war_layout.war_awi_theater_1_alliances)
		define_thing("war-alliance", 42).layout(war_layout.war_awi_theater_2_alliances)
		define_thing("war-alliance", 43).layout(war_layout.war_awi_theater_3_alliances)

		define_thing("war-margin", 411).layout([ 80,  307, 412, 17])
		define_thing("war-margin", 412).layout([ 80,  325, 412, 17])
		define_thing("war-margin", 413).layout([ 80,  343, 412, 17])
		define_thing("war-margin", 414).layout([ 80,  400, 412, 17])
		define_thing("war-margin", 415).layout([ 80,  418, 412, 17])
		define_thing("war-margin", 416).layout([ 80,  436, 412, 17])
		define_thing("war-margin", 421).layout([600,  306, 412, 17])
		define_thing("war-margin", 422).layout([600,  324, 412, 17])
		define_thing("war-margin", 423).layout([600,  324, 412, 17])
		define_thing("war-margin", 431).layout([600,  620, 412, 17])
		define_thing("war-margin", 432).layout([600,  638, 412, 17])
		define_thing("war-margin", 433).layout([600,  656, 412, 17])
	}

	for (let sq = 0; sq < NUM_SQUADRONS; sq++) {
		define_marker("squadron-fr", sq, "marker hex fleet_fr").tooltip(space_tooltip).tooltip_image(space_tooltip_image)
		define_marker("squadron-br", sq, "marker hex fleet_br").tooltip(space_tooltip).tooltip_image(space_tooltip_image)
	}

	for (let s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== TERRITORY) continue
		if ((data.spaces[s].region !== REGION_NORTH_AMERICA) && (data.spaces[s].region !== REGION_CARIBBEAN)) continue
		define_marker("huguenots", s, "marker square-sm huguenots").tooltip(bold("Huguenots") + ": increases conquest cost of space by 1. Can be flipped once per game to reduce the economic action cost of a market in the same region by 1.")
		define_marker("huguenots_spent", s, "marker square-sm huguenots_spent").tooltip(bold("Huguenots (Spent)") + ": increases conquest cost of space by 1. Can be refreshed once per game by North American Trade ministry in Revolutionary Era.")
	}

	var vp = document.createElement("div")
	vp.id = "vp_mobile"
	document.querySelector("#toolbar").append(vp)
}

/* ON UPDATE */

var skipped_event = true // Don't warn when first refreshing or coming back

var log_partially_hidden = false

function on_update() {
	var i, r, s, a

	begin_update()

	let verbose = get_preference("actionverbosity", "medium")
	let shortest = (verbose === "short")
	let tracksies = get_preference("tracksies", true)
	let redsies = get_preference("redsies", false)

	if (R === FRANCE) {
		update_favicon("favicon-fr.png")
	} else if (R === BRITAIN) {
		update_favicon("favicon-br.png")
	} else {
		update_favicon("favicon1.png")
	}

	let tell_vp = Math.min(36, Math.max(-7, V.vp))
	populate("general-track", tell_vp, "victory-points")
	if ((V.vp < 0) || (V.vp > 30)) {
		update_text_html("victory-points", undefined, `<div class="vp-overlay">${V.vp}</div>`)
	}

	populate("general-track", V.debt[FRANCE], "debt", FRANCE)
	populate("general-track", V.debt_limit[FRANCE], "debt-limit", FRANCE)
	populate("general-track", V.treaty_points[FRANCE], "treaty-points", FRANCE)
	populate("general-track", V.debt[BRITAIN], "debt", BRITAIN)
	populate("general-track", V.debt_limit[BRITAIN], "debt-limit", BRITAIN)
	populate("general-track", V.treaty_points[BRITAIN], "treaty-points", BRITAIN)

	if (V.the_brig > 0) {
		for (let i = 0; i < V.the_brig; i++) {
			let turn = (is_bit(DID_THE_BRIG) ? next_peace_turn(V.turn) : V.turn)
			if (turn < GAME_OVER) populate("turn-track", turn, "squadron-br", get_squadron_token(BRITAIN, SPACE_THE_BRIG, i))
		}
	}

	if (is_bit(JACOBITE_VICTORY_WSS)) populate("turn-track", WAR_TURN_WSS, "jacobite-victory", 2)
	if (is_bit(JACOBITE_VICTORY_WAS)) populate("turn-track", WAR_TURN_WAS, "jacobite-victory", 3)
	if (is_bit(JACOBITE_DEFEAT)) populate("turn-track", WAR_TURN_WAS, "jacobite-defeat", 1)

	populate("turn-track", V.turn, "game-turn", 0)
	populate("lout-initiative", "initiative", V.initiative)

	var global_demand_chits = []
	if (V.global_demand) {
		for (var i = 0; i < NUM_DEMANDS; i++) {
			if (V.global_demand.includes(i)) continue
			global_demand_chits.push(i)
		}
	}

	// These keep a hidden stack of all the not-presently-in-play demands, awards, and investment tiles, to provide the better visuals of tiles "being dealt out" and "cleared away"
	for (const d of global_demand_chits) {
		populate("stack-deal", undefined, "demand", d)
	}

	if (V.award_chits) {
		for (const a of V.award_chits) {
			populate("stack-deal", undefined, "award", a)
		}
	}

	if (V.inv_stack && (V.inv_stack.length > 16)) {
		for (const i of V.inv_stack) {
			populate("stack-deal", undefined, "investment", i)
		}
	}

	for (let r = 0; r < NUM_REGIONS; r++) {
		let winner = region_flag_winner(r)
		let delta = region_flag_delta(r)
		if (winner === FRANCE)
			update_text_html("award-winner-left", r, `<div class="score-flag fr"></div>`)
		if (winner === BRITAIN)
			update_text_html("award-winner-left", r, `<div class="score-flag br"></div>`)
		if (winner !== NONE)
			update_text_html("award-winner-right", r, `+${delta}`)

	}

	// Europe prestige winner indicator
	let pwin = prestige_winner()
	let pdelta = prestige_flag_delta()
	if (pwin === FRANCE)
		update_text_html("award-winner-left", REGION_AWARD, `<div class="score-flag fr"></div>`)
	if (pwin === BRITAIN)
		update_text_html("award-winner-left", REGION_AWARD, `<div class="score-flag br"></div>`)
	if (pwin !== NONE)
		update_text_html("award-winner-right", REGION_AWARD, `+${pdelta}\u2666`)

	populate_with_list("lout-demand", "demand", V.global_demand)

	for (let d = 0; d < NUM_DEMANDS; d++) {
		if (!V.global_demand.includes(d)) continue
		let dirty = (V.dirty_demand & (1 << d))
		update_keyword("demand", d, "dirty_br", dirty && tracksies && ((V.dirty_who === BRITAIN) || redsies))
		update_keyword("demand", d, "dirty_fr", dirty && tracksies && ((V.dirty_who !== BRITAIN) && !redsies))
	}

	if (V.townshend_acts >= 0) {
		let demand_tiles = document.querySelector(".layout.lout-demand").firstElementChild
		let index = V.global_demand.indexOf(V.townshend_acts)
		if (index >= 0) {
			for (let skip = 0; skip < index; skip++) {
				demand_tiles = demand_tiles.nextElementSibling
			}
			let marker = lookup_thing("townshend-acts", undefined)
			demand_tiles.appendChild(marker.element)
			switch (index) {
				case 0:
					marker.element.style.cssText = "margin-top: -40px; margin-left: -40px"
					break
				case 1:
					marker.element.style.cssText = "margin-top: -40px; margin-left: -2px"
					break
				case 2:
					if (V.global_demand.length === 3) {
						marker.element.style.cssText = "margin-top: -40px; margin-left: 36px"
					} else {
						marker.element.style.cssText = "margin-top: -40px; margin-left: -2px"
					}
					break
				default:
					marker.element.style.cssText = "margin-top: -40px; margin-left: 36px"
					break
			}
		}
	} else {
		populate("stack-deal", undefined, "townshend-acts")
	}

	if (V.global_demand) {
		for (let i = 0; i < V.global_demand.length; i++) {
			let demand = V.global_demand[i]
			let winner = demand_flag_winner(demand)
			let delta = demand_flag_delta(demand)
			if (winner !== NONE)
				update_text_html("demand", demand, format_winner_delta(winner, delta))
		}
	}

	let jacobite_count = V.jacobite_victory + (is_bit(JACOBITE_DEFEAT) ? 1 : 0)

	if (jacobite_count > 0) {
		let offset = (jacobite_count - 1) * 2.5
		update_position("lout-jacobite", undefined, 1750 + offset, 230 + offset)

		for (let i = 0; i < V.jacobite_victory; i++) {
			populate("lout-jacobite", "jacobite-victory", i)
		}
		if (is_bit(JACOBITE_DEFEAT)) {
			populate("lout-jacobite", "jacobite-defeat", 0)
		}
	}

	// Upconvert squadrons if we've "undone"
	if (V.squadrons === undefined) {
		upconvert_squadrons()
	}

	for (let who = FRANCE; who <= BRITAIN; who++) {
		let total = 0
		for (let sq = NUM_SQUADRONS - 1; sq >= 0; sq--) { // Count backwards so that when one leaves the navy box it will be the "top one in the stack"
			if (V.squadrons[who][sq] !== SPACE_NAVY_BOX) continue
			populate("lout-navy", who, (who === FRANCE) ? "squadron-fr" : "squadron-br", sq)
			total++
			if (total >= V.navy_box[who]) break
		}
	}

	for (s of data.spaces) {
		if (s.type === NAVAL) {
			if (V.flags[s.num] === FRANCE) {
				populate("lout-space", s.num, "squadron-fr", get_squadron_token(FRANCE, s.num))
			}
			if (V.flags[s.num] === BRITAIN) {
				populate("lout-space", s.num, "squadron-br", get_squadron_token(BRITAIN, s.num))
			}
		} else {
			if (V.flags[s.num] === FRANCE)
				populate_generic("lout-space", s.num, "marker square-sm flag_fr")
			if (V.flags[s.num] === BRITAIN)
				populate_generic("lout-space", s.num, "marker square-sm flag_br")
			if (V.flags[s.num] === SPAIN)
				populate_generic("lout-space", s.num, "marker square-sm flag_spain")
			if (V.flags[s.num] === USA)
				populate_generic("lout-space", s.num, "marker square-sm flag_usa")

			if ((s.type === TERRITORY) && V.huguenots.includes(s.num)) {
				populate("lout-huguenots", s.num, (V.huguenots_spent.includes(s.num) ? "huguenots_spent" : "huguenots"), s.num)
			}
		}
		let dirty = set_has(V.dirty, s.num)
		update_keyword("space", s.num, "dirty_br", dirty && tracksies && ((V.dirty_who === BRITAIN) || redsies))
		update_keyword("space", s.num, "dirty_fr", dirty && tracksies && ((V.dirty_who !== BRITAIN) && !redsies))
	}

	let noflipsies = get_preference("noflipsies", false)
	let downanddirty = get_preference("downanddirty", false)

	for (a = 0; a < NUM_ADVANTAGES; ++a) {
		var layout, index, reverse
		if (V.advantages[a] === NONE) {
			layout = "lout-advantage"
			index = a
			reverse = downanddirty || (is_advantage_exhausted(a) && !noflipsies)
		} else {
			layout = "panel-advantage"
			index = V.advantages[a]
			reverse = (is_advantage_exhausted(a) && !noflipsies)
		}
		populate(layout, index, "advantage", a)

		if (is_advantage_exhausted(a) && (V.advantages[a] !== NONE)) {
			populate_generic("lout-advantage", a, "marker square-sm exhausted")
		}

		update_keyword("advantage", a, "reverse", reverse)
		if (is_advantage_exhausted(a) && (noflipsies || (downanddirty && V.advantages[a] === NONE)))
			populate_generic("advantage", a, "marker square-sm exhausted")
	}

	if (V.all_ministries) {
		populate_with_list("panel-all-ministries", "ministry_card", V.all_ministries)
		let title = document.getElementById("ministries_title")
		if (title) {
			if (V.choosing_ministries) {
				title.textContent = "Choose from Available Ministries"
			} else {
				title.textContent = "Ministries Available This Turn"
			}
		}
	}

	V.inv_avail.sort((a, b) =>
	{
		let aa = data.investments[a].majortype * 100 + (5 - data.investments[a].majorval) * 10 + data.investments[a].minortype
		let bb = data.investments[b].majortype * 100 + (5 - data.investments[b].majorval) * 10 + data.investments[b].minortype
		return aa - bb
	})

	V.inv_used.sort((a, b) =>
	{
		let aa = data.investments[a].majortype * 100 + (5 - data.investments[a].majorval) * 10 + data.investments[a].minortype
		let bb = data.investments[b].majortype * 100 + (5 - data.investments[b].majorval) * 10 + data.investments[b].minortype
		return aa - bb
	})

	V.inv_stack.sort((a, b) =>
	{
		let aa = data.investments[a].majortype * 100 + (5 - data.investments[a].majorval) * 10 + data.investments[a].minortype
		let bb = data.investments[b].majortype * 100 + (5 - data.investments[b].majorval) * 10 + data.investments[b].minortype
		return aa - bb
	})

	populate_with_list("panel-available-investments", "investment", V.inv_avail)

	if (V.subphase !== NOT_ACTION_PHASE) {
		let p = document.createElement("div")
		p.className = "remind-player-order"
		if (V.first_player === FRANCE) {
			if (R === FRANCE) {
				p.innerHTML = "You move first; opponent moves last."
			} else if (R === BRITAIN) {
				p.innerHTML = "Opponent moves first; you move last."
			} else {
				p.innerHTML = "France moves first; Britain moves last."
			}
		} else if (V.first_player === BRITAIN) {
			if (R === BRITAIN) {
				p.innerHTML = "You move first; opponent moves last."
			} else if (R === FRANCE) {
				p.innerHTML = "Opponent moves first; you move last."
			} else {
				p.innerHTML = "Britain moves first; France moves last."
			}
		}
		document.querySelector("#available_investment_tiles").lastElementChild.appendChild(p)
	}

	populate_with_list("panel-used-investments", "investment", V.inv_used)

	if (V.inv_stack.length <= 16) {
		populate_with_list("panel-upcoming-investments", "investment", V.inv_stack)
	}

	for (let who = FRANCE; who <= BRITAIN; who++) {
		if (!V.ministry) continue
		for (i = 0; i < V.ministry[who].length; ++i) {
			let m = V.ministry[who][i]
			if (m >= 0) {
				populate("panel-ministry", who, "ministry_card", m)
				update_keyword("ministry_card", m, "exhausted", V.ministry_revealed[who][i] && is_ministry_fully_exhausted(who, m))
				update_keyword("ministry_card", m, "partial", V.ministry_revealed[who][i] && is_ministry_partially_exhausted(who, m) && !is_ministry_fully_exhausted(who, m))
				update_keyword("ministry_card", m, "revealed", V.ministry_revealed[who][i] && !is_ministry_partially_exhausted(who, m))
				update_keyword("ministry_card", m, "hidden", !V.ministry_revealed[who][i])

				//console.log ("Ministry: " + data.ministries[m].name + "  Ability 1 exhausted: " + is_ministry_exhausted(who, m, 0) + "  Ability 2 exhausted: " + is_ministry_exhausted(who, m, 1))

				if (is_ministry_exhausted(who, m, 0))
					populate_generic("ministry_card", m, "marker square-sm exhausted a1")
				if (is_ministry_exhausted(who, m, 1))
					populate_generic("ministry_card", m, "marker square-sm exhausted a2")
			} else {
				set_fallback_tips(populate_generic("panel-ministry", who, "card ministry_card deck_" + ((who === FRANCE) ? "fr" : "br")), (bold(((who === FRANCE) ? "French" : "British") + " Ministry: ")) + "Hidden.")
			}
		}
	}

	if (V.deck) {
		for (const c of V.deck) {
			populate("stack-deal", undefined, "event_card", c)
		}
	}

	if (V.discard_pile) {
		for (const c of V.discard_pile) {
			if (Array.isArray(c)) continue
			if (!c) continue
			populate("stack-deal", undefined, "event_card", c)
		}
	}

	if (V.played_events) {
		for (const c of V.played_events) {
			if (c === V.played_event) continue // Except for the one that goes on the played_event slot
			populate("stack-deal", undefined, "event_card", c)
		}
	}

	if (V.hand) {
		set_fallback_tips(populate_with_list("panel-events", FRANCE, "event_card", V.hand[FRANCE], "card event_card deck"), bold("French Event Card: ") + "Hidden.")
		set_fallback_tips(populate_with_list("panel-events", BRITAIN, "event_card", V.hand[BRITAIN], "card event_card deck"), bold("British Event Card: ") + "Hidden.")
	}

	//BR// Show any event played THIS action round in the played event slot
	if (V.played_event > 0) {
		populate("panel-played", 0, "event_card", V.played_event, "card event_card deck")
	}

	map_for_each(V.conflicts, (s, n) => {
		populate("lout-conflict", s, "conflict", s)
		update_keyword("conflict", s, "plus-one", n > 1)

		let dirty = Array.isArray(V.dirty_conflict) && set_has(V.dirty_conflict, s)
		update_keyword("conflict", s, "dirty_br", dirty && tracksies && ((V.dirty_who === BRITAIN) || redsies))
		update_keyword("conflict", s, "dirty_fr", dirty && tracksies && ((V.dirty_who !== BRITAIN) && !redsies))
	})

	for (s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== FORT) continue
		if (is_damaged_fort(s)) {
			populate("lout-damaged", s, "damaged", s)
		}
	}

	for (i = 0; i < G.played_tiles[FRANCE].length; ++i)
		populate("investment", G.played_tiles[FRANCE][i], "action-fr", i)
	for (i = 0; i < G.played_tiles[BRITAIN].length; ++i)
		populate("investment", G.played_tiles[BRITAIN][i], "action-br", i)

	for (r = 0; r < NUM_REGIONS; ++r) {
		if (V.awards[r] >= 0)
			populate("lout-award", r, "award", V.awards[r])
		else
			populate_generic("lout-award", r, "marker square-sm black award reverse")
	}

	update_war_display()

	// Hide hotkey shortcuts on mobile
	if (is_mobile()) {
		let elements = document.getElementsByClassName("hotkey")
		for (const e of elements) {
			e.hidden = true
		}
	}

	action_button ("fail", "Fuzzer Only Fail Button")

	action_button("france", "France")
	action_button("britain", "Britain")

	for (var i = 0; i <= 5; ++i)
		action_button_with_argument("bid", i, String(i))

	action_button("paydebt", (is_mobile() || shortest) ? "1 Debt" : "Add 1 Debt")
	action_button("paytrp", (is_mobile() || shortest) ? "1 TRP" : "Spend 1 Treaty Point")

	action_button("refuse", "Refuse")
	action_button("accept", "Accept")

	action_button("confirm", "Confirm")
	action_button("continue", "Continue")

	action_button("no", "No")
	action_button("yes", "Yes")

	confirm_action_button("confirm_pass_to_reduce_debt", (is_mobile() || shortest) ? "Pass" : "Pass for Debt Reduction", "Confirm passing your entire action round to reduce Debt?")
	confirm_action_button("confirm_pass_usa", "Pass", "You have not converted all eligible territories to USA flags. Confirm passing early?")
	confirm_action_button("confirm_pass_usa_forts", "Pass", "You have not removed flags from all eligible forts. Confirm passing early?")

	action_button_imp("military_upgrade", "Military Upgrade", evt => { send_action("military_upgrade"); scroll_to_war() } )

	action_button("buy_diplomatic", (is_mobile() || shortest) ? "Buy Diplo" : "Buy Diplomatic")
	action_button("buy_economic", (is_mobile() || shortest) ? "Buy Econ" : "Buy Economic")

	action_button("construct_squadron", (is_mobile() || shortest) ? "Squadron" : "Build Squadron")
	action_button("buy_bonus_war_tile", (is_mobile() || shortest) ? "War Tile" : "Buy War Tile")
	action_button("draw_event", "Buy Event")
	action_button("draw_an_event", "Draw Event")

	action_button("end_action_round", (is_mobile() || shortest) ? "End Round" : "End Action Round")
	confirm_action_button("confirm_end_action_round_2", (is_mobile() || shortest) ? "End Round" : "End Action Round", "You still have usable advantages. Confirm ending Action Round?")
	confirm_action_button("confirm_end_action_round_bank", (is_mobile() || shortest) ? "End Round" : "End Action Round", "You have not used Bank of England to increase your debt limit. Confirm ending your final action round this turn?")
	confirm_action_button("confirm_end_action_round_halley", (is_mobile() || shortest) ? "End Round" : "End Action Round", "You have not used Edmond Halley to discard an event card for a treaty point. Confirm ending your final Action Round this turn?")
	confirm_action_button("confirm_end_action_round_walpole", (is_mobile() || shortest) ? "End Round" : "End Action Round", "You have not used Robert Walpole to draw/discard event cards. Confirm ending your final action round this turn?")
	confirm_action_button("confirm_end_action_round_huguenots", (is_mobile() || shortest) ? "End Round" : "End Action Round", "You have not used New World Huguenots to place Huguenots. Confirm ending your final action round this turn?")

	confirm_action_button("confirm_end_action_round", (is_mobile() || shortest) ? "End Early" : "End Action Round Early", "You still have unspent action points! Confirm ending Action Round early?")
	confirm_action_button("confirm_no_military_upgrade", (is_mobile() || shortest) ? "End Early" : "End Action Round Early", "You are still eligible for a military upgrade! Confirm ending Action Round early?")

	action_button("reveal_ministry", "Reveal")
	action_button("dont_reveal_ministry", "Don't Reveal")
	action_button("exhaust_ministry", "Exhaust")
	action_button("dont_exhaust_ministry", "Don't Exhaust")

	action_button("diplomatic_point", (is_mobile() || shortest) ? "+1 Diplo" : "Gain Diplomatic Point")
	action_button("military_point", (is_mobile() || shortest) ? "+1 Mil" : "Gain Military Point")
	action_button("build_squadron", (is_mobile() || shortest) ? "Squadron Discount" : "Build Squadron w/ Discount")
	action_button("discard_event_for_trp", (is_mobile() || shortest) ? "Event => TRP": "Discard Event for TRP")
	action_button("increase_debt_limit", is_mobile() ? "Debt Limit" : "Increase Debt Limit")
	action_button("play_event", "Play Event")
	action_button("jacobite_vp", "Score VP")
	action_button("unflag_discount", (is_mobile() || shortest) ? "Use" : "Use Discount This Round")

	action_button("shift_market", (is_mobile() || shortest) ? "Market" : "Shift Market")
	action_button("place_conflict_marker", (is_mobile() || shortest) ? "Conflict" : "Place Conflict Marker")
	action_button("diplomatic2", (is_mobile() || shortest) ? "+2 Diplo" : "+2 Diplomatic")
	action_button("economic2", (is_mobile() || shortest) ? "+2 Econ" : "+2 Economic")
	action_button("scorecotton", "Score Cotton")
	action_button("construct_squadron_now", (is_mobile() || shortest) ?  "Squadron" : "Build Squadron Now")
	action_button("defer", "Defer")
	action_button("fur", "Fur")
	action_button("cotton", "Cotton")
	action_button("take_control", (is_mobile() || shortest) ? "Control" : "Take Control")
	action_button("place_conflicts", (is_mobile() || shortest) ? "Conflict" : "Place Conflict Markers")
	action_button("diplomatic", is_mobile() ? "Diplo" : "Diplomatic")
	action_button("military", is_mobile() ? "Mil" : "Military")

	action_button("use_advantage", "Use")
	action_button("dont_use_advantage", "Don't Use")

	action_button("major", "Major")
	action_button("minor", "Minor")

	action_button("return_to_pool", is_mobile() ? "Return" : "Return to Pool")
	action_button("remove_from_game", is_mobile() ? "Remove" : "Remove From Game")

	action_button("pass", "Pass")
	action_button("done", "Done")
	action_button("undo", "Undo")

	if (V.log_hide_after && (V.log_hide_after[R] >= 0)) {
		log_partially_hidden = true
		for (let ix = 0; ix < V.log_length; ix++) {
			let logline = world.log.children[ix]
			if (logline) logline.style.display = (ix > V.log_hide_after[R]) ? "none" : "block"
		}

		scroll_log_to_end()
	} else if (log_partially_hidden) { // We don't have to unhide everything every time -- only if we know some part of it was hidden before
		log_partially_hidden = false
		for (let ix = 0; ix < V.log_length; ix++) {
			let logline = world.log.children[ix]
			if (logline) logline.style.display = "block"
		}

		scroll_log_to_end()
	}

	update_debt_display()

	end_update()

	if (is_bit(SKIPPED_EVENT) && !V.UNDID && ((R === FRANCE) || (R === BRITAIN)) && (params.mode === "play") && (R === V.active)) {
		if (!skipped_event) { // Prevents this warning from coming up more than once before it has been cleared in between
			skipped_event = true
			if (get_preference("eventsies", true)) {
				if (!confirm("You have skipped playing an event although your investment tile makes you eligible for one.")) {
					send_action("undo")
				}
			}
		}
	} else {
		skipped_event = false
	}
}

function update_debt_display() {
	for (let who = FRANCE; who <= BRITAIN; who++) {
		if (V.bidding_for_sides) {
			roles[who].name.textContent = "Player " + (who+1)
			roles[who].stat.textContent = ""
		} else {
			roles[who].name.textContent = data.flags[who].name
			roles[who].stat.innerHTML = available_debt(who) + " Debt + " + V.treaty_points[who] + " TRP" + s(V.treaty_points[who])
		}
	}

	let msg = bold("VP: " + V.vp)
	document.getElementById("vp_mobile").innerHTML = msg
	document.getElementById("vp_desktop").innerHTML = msg
}

/* SQUADRON TOKEN MANAGEMENT */

// Returns which squadron token a player has at a particular space (or first one from navy box or unbuilt). Used only to animate squadrons between spaces.
function get_squadron_token(who, s, match = 0)
{
	let matches = 0

	for (let sq = 0; sq < NUM_SQUADRONS; sq++) {
		if (V.squadrons[who][sq] === s) {
			if (matches >= match) return sq
			matches++
		}
	}
	console.error ("No squadron found for space: " + s)

	upconvert_squadrons()
	for (let sq = 0; sq < NUM_SQUADRONS; sq++) {
		if (V.squadrons[who][sq] === s) return sq
	}

	return 0
}

function upconvert_squadrons()
{
	V.squadrons = [ [], [] ]
	for (let s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== NAVAL) continue
		let who = G.flags[s]
		if (who === NONE) continue
		V.squadrons[who].push(s)
	}
	for (let who = FRANCE; who <= BRITAIN; who++) {
		for (let ss = 0; ss < V.navy_box[who]; ss++) {
			V.squadrons[who].push(SPACE_NAVY_BOX)
		}
		for (let ss = 0; ss < V.unbuilt_squadrons[who]; ss++) {
			V.squadrons[who].push(SPACE_UNBUILT)
		}
		if (who === BRITAIN) {
			for (let ss = 0; ss < V.the_brig; ss++) {
				V.squadrons[who].push(SPACE_THE_BRIG)
			}
		}
	}
}

/* WAR DISPLAY UPDATE (TODO - CLEAN UP) */

const war_display = [
	$("#war_wss"),
	$("#war_was"),
	$("#war_7yw"),
	$("#war_awi"),
]

const war_reverse = [
	[
		"marker hex war-wss fr",
		"marker hex war-was fr",
		"marker hex war-7yw fr",
		"marker hex war-awi fr",
	],
	[
		"marker hex war-wss br",
		"marker hex war-was br",
		"marker hex war-7yw br",
		"marker hex war-awi br",
	]
]

/* Basic/Bonus war tiles placement */
/* Here to change the value depending on how many tiles are present */
const TILE_POSITIONS = {
	1: [[40, 45]],
	2: [[10, 9], [65, 64]],
	3: [[40, 0], [0, 68], [75, 68]],
	4: [[0, 0], [75, 0], [0, 68], [75, 68]],
	5: [[0, 0], [75, 0], [38, 34], [0, 68], [75, 68]]
}

function agencement_theater_tiles(element) {
	let children = element.children
	let count = children.length
	if (count === 0 || count > 5)
		return

	let positions = TILE_POSITIONS[count]
	for (let i = 0; i < count; i++) {
		children[i].style.position = "absolute"
		children[i].style.left = positions[i][0] + "px"
		children[i].style.top = positions[i][1] + "px"
	}
}

function theater_tier(war, winner, theater, delta)
{
	var margin
	if ((winner === FRANCE) && (data.wars[war].theater[theater].france_margin !== undefined)) {
		margin = data.wars[war].theater[theater].france_margin
	} else {
		margin = data.wars[war].theater[theater].margin
	}

	for (let i = margin.length - 1; i >= 0; i--) {
		if (delta >= margin[i]) return i
	}

	return -1
}

function update_theater_flags(war, theater) {
	function build_flag_row(c, name) {
		let row = `<div class="alliance-row">`

		for (let s of c.fr) {
			let space_name = data.spaces[s].name
			row += `<div class="alliance-flag fr" data-tooltip="${space_name}"
				onmouseenter="_tip_focus_light('space',${s})"
				onmouseleave="_tip_blur_light('space',${s})"
				onmousedown="_tip_click_light('space',${s})"></div>`
		}
		for (let s of c.br) {
			let space_name = data.spaces[s].name
			row += `<div class="alliance-flag br" data-tooltip="${space_name}"
				onmouseenter="_tip_focus_light('space',${s})"
				onmouseleave="_tip_blur_light('space',${s})"
				onmousedown="_tip_click_light('space',${s})"></div>`
		}

		row += `</div>`
		return row
	}

	// Alliance flags for all wars
	const war_number = war + 1

	let theater_data = data.wars[war_number].theater[theater]
	let ministry_keyword = theater_data.keyword

	let minister = { fr: false, br: false }
	let alliances = {}
	let conflicts = {}

	// Ministry keyword
	if (ministry_keyword > 0) {
		if (V.active_keywords && V.active_keywords[FRANCE].includes(ministry_keyword))
			minister.fr = true
		if (V.active_keywords && V.active_keywords[BRITAIN].includes(ministry_keyword))
			minister.br = true
	}

	// Scan all spaces for alliances and conflicts
	for (let s = 0; s < NUM_SPACES; s++) {
		let space = data.spaces[s]
		let flag = V.flags[s]

		// Alliances
		if (space.alliance) {
			for (const a of space.alliance) {
				if (a[0] !== war_number || a[1] !== theater)
					continue

				// 7YW Theater 3 includes both North America and Caribbean
				if (war_number === WAR_7YW && theater === 3) {
					if (space.region !== REGION_NORTH_AMERICA && space.region !== REGION_CARIBBEAN)
						continue
				}
				// Group forts and naval spaces together
				let name
				if (space.type === FORT) {
					name = "_Forts"
				} else if (space.type === NAVAL) {
					if (war_number === WAR_7YW && (theater === 1 || theater === 3)) {
						if (space.region === REGION_CARIBBEAN) {
							name = "_Squadrons (Caribbean)"
						} else if (space.region === REGION_NORTH_AMERICA) {
							name = "_Squadrons (N. Amer.)"
						} else {
							name = "_Squadrons"
						}
					} else {
						name = "_Squadrons"
					}
				} else {
					name = space.name
						.split(" - ")[0]
						.replace(/\s*\(\d+\)$/, "")
						.trim()
				}

				if (!alliances[name]) {
					alliances[name] = { fr: [], br: [], type: space.type }
				}

				// flag no count if conflict or damaged
				if (flag !== FRANCE && flag !== BRITAIN)
					continue
				if (has_conflict_marker(s) || is_damaged_fort(s))
					continue

				// Add space to array (avoid duplicates)
				if (flag === FRANCE && !alliances[name].fr.includes(s))
					alliances[name].fr.push(s)
				if (flag === BRITAIN && !alliances[name].br.includes(s))
					alliances[name].br.push(s)
			}
		}

		// Conflict markers
		let region_match = space.region === theater_data.region
		if (war_number === WAR_7YW && theater === 3 && space.region === REGION_CARIBBEAN) {
			region_match = true
		}
		if (theater_data.conflicts && region_match) {
			if (map_get(V.conflicts, s, 0) && (flag === FRANCE || flag === BRITAIN)) {
				let opponent = 1 - flag
				if (!conflicts["_Conflicts"]) {
					conflicts["_Conflicts"] = { fr: [], br: [] }
				}
				if (opponent === FRANCE && !conflicts["_Conflicts"].fr.includes(s))
					conflicts["_Conflicts"].fr.push(s)
				if (opponent === BRITAIN && !conflicts["_Conflicts"].br.includes(s))
					conflicts["_Conflicts"].br.push(s)
			}
		}
	}

	if (war_number === WAR_7YW && theater === 3) {
		if (!alliances["_Spain"]) {
			alliances["_Spain"] = { fr: [], br: [], type: TERRITORY }
		}
		for (let s of [ SPAIN_1, SPAIN_3 ]) {
			let flag = V.flags[s]
			if (flag !== FRANCE && flag !== BRITAIN)
				continue
			if (has_conflict_marker(s))
				continue

			if (flag === FRANCE && !alliances["_Spain"].fr.includes(s))
				alliances["_Spain"].fr.push(s)
			if (flag === BRITAIN && !alliances["_Spain"].br.includes(s))
				alliances["_Spain"].br.push(s)
		}
	}

	if (theater_data.conflicts && !conflicts["_Conflicts"]) {
		conflicts["_Conflicts"] = { fr: [], br: [] }
	}
	if (conflicts["_Conflicts"]) {
		alliances["_Conflicts"] = { fr: conflicts["_Conflicts"].fr, br: conflicts["_Conflicts"].br, type: -1 }
	}

	// Build HTML
	let flag_html = ""

	// 1. Ministry keyword bonus
	if (ministry_keyword > 0) {
		let keyword_name = data.keywords[ministry_keyword].name
		flag_html += `<div class="alliance-row">`
		if (minister.fr)
			flag_html += `<div class="alliance-flag fr" data-tooltip="${keyword_name}"></div>`
		if (minister.br)
			flag_html += `<div class="alliance-flag br" data-tooltip="${keyword_name}"></div>`
		flag_html += `</div>`
	}

	// 2. Alliances
	// Sort order: political (0), conflicts (1), forts (2), naval (3)
	const SORT_ORDER = { [TERRITORY]: 0, [POLITICAL]: 0, [-1]: 1, [FORT]: 2, [NAVAL]: 3 }

	let alliance_names = Object.keys(alliances).sort((a, b) => {
		let orderA = SORT_ORDER[alliances[a].type] ?? 4
		let orderB = SORT_ORDER[alliances[b].type] ?? 4
		if (orderA !== orderB)
			return orderA - orderB

		// Special sort for 7YW theater 1 & 3
		if (war_number === WAR_7YW && (theater === 1 || theater === 3)) {
			const regionOrder = { "_Squadrons (Caribbean)": 0, _Squadrons: 1, "_Squadrons (N. Amer.)": 2 }
			if (regionOrder[a] !== undefined && regionOrder[b] !== undefined) {
				return regionOrder[a] - regionOrder[b]
			}
		}

		return a.localeCompare(b)
	})

	for (let name of alliance_names) {
		flag_html += build_flag_row(alliances[name], name)
	}

	update_text_html("war-alliance", war_number * 10 + theater, flag_html)
}

function update_war_display() {
	var player, theater, offset
	var war = G.next_war - 1 // make it zero-based

	let allwars = get_preference("allwars", false)
	for (var w = 0; w < NUM_WARS; w++) {
		war_display[w].hidden = allwars ? false : (war !== w)
	}

	if (V.bidding_for_sides) return // Don't reveal any war stuff during bidding for sides

	/* FIXME: always do this? */
	if (allwars) {
		for (let w = 1; w < G.next_war; w++) {
			var num_theaters = data.wars[w].theaters
			for (theater = 1; theater <= num_theaters; theater++) {
				if (V.old_winners && (V.old_winners[w][theater] !== -1)) {
					let winner = V.old_winners[w][theater]
					let margin = V.old_margins[w][theater]
					let is_tie = margin === 0
					let flag_class = is_tie ? "tie" : (winner === FRANCE ? "fr" : "br")

					if (margin > 0) {
						let tier = theater_tier(w, winner, theater, margin) + 1
						if (tier > 0) {
							let box = w * 100 + theater * 10 + tier
							if (((w === 2) && (theater === 4)) || ((w === 4) && (theater === 1)))
								if (winner === BRITAIN)
									box += 3
							update_keyword("war-margin", box, flag_class)
						}
					}

					update_keyword("war-winner", w * 10 + theater, flag_class)
					update_text_html("war-winner", w * 10 + theater, is_tie ? `<div>TIE</div>` : `<div class="theater-flag ${flag_class}"></div><span>${margin}</span>`)
				}
			}
		}
	}

	if (war < NUM_WARS) {
		set_fallback_tips(populate_with_list("lout-theater-drawn", war, "basic_war", V.theater_basic[FRANCE][0], "marker hex war-basic fr"), basic_war_tooltip(-1, FRANCE))
		set_fallback_tips(populate_with_list("lout-theater-drawn", war, "basic_war", V.theater_basic[BRITAIN][0], "marker hex war-basic br"), basic_war_tooltip(-1, BRITAIN))
		set_fallback_tips(populate_with_list("lout-theater-drawn", war, "bonus_war", V.theater_bonus[FRANCE][0], war_reverse[FRANCE][war]), bonus_war_tooltip(-1, FRANCE))
		set_fallback_tips(populate_with_list("lout-theater-drawn", war, "bonus_war", V.theater_bonus[BRITAIN][0], war_reverse[BRITAIN][war]), bonus_war_tooltip(-1, BRITAIN))

		offset = war * 8 + 1
		for (theater = 1; theater <= data.wars[G.next_war].theaters; ++theater) {
			for (player = FRANCE; player <= BRITAIN; ++player) {
				set_fallback_tips(populate_with_list(
					"lout-theater", offset,
					"basic_war", V.theater_basic[player][theater],
					(player === FRANCE) ? "marker hex war-basic fr" : "marker hex war-basic br"
				), basic_war_tooltip(-1, player))

				set_fallback_tips(populate_with_list(
					"lout-theater", offset,
					"bonus_war", V.theater_bonus[player][theater],
					war_reverse[player][war]
				), bonus_war_tooltip(-1, player))

				agencement_theater_tiles(lookup_thing("lout-theater", offset).element)
				++offset
			}
		}

		let war_number = war+1
		const num_theaters = data.wars[G.next_war].theaters

		for (theater = 1; theater <= num_theaters; ++theater) {
			let fr_strength = V.theater_strength ? V.theater_strength[FRANCE][theater] : 0
			let br_strength = V.theater_strength ? V.theater_strength[BRITAIN][theater] : 0

			let unrevealed = 0

			let already_done = ((V.theater_winner && V.theater_winner[theater] !== -1) || (V.old_winners && (V.old_winners[G.next_war][theater] !== -1)))
			if (!already_done) {
				if ((R === FRANCE) || (R === BRITAIN)) {
					for (const t of G.theater_basic[R][theater]) {
						if (t < 0) continue
						if (!set_has(G.basic_revealed[R], t)) unrevealed += data.basic_war_tiles[t].val
					}

					for (const t of G.theater_bonus[R][theater]) {
						if (t < 0) continue
						if (!set_has(G.bonus_revealed[R], t) && (t < ATLANTIC_DOMINANCE)) unrevealed += data.bonus_war_tiles[t].val
					}
				}
			}

			if (unrevealed !== 0) {
				if (unrevealed > 0) {
					unrevealed = "+" + unrevealed
				}
				if (R === FRANCE) {
					fr_strength = String(fr_strength) + " " + parens(unrevealed)
				} else {
					br_strength = String(br_strength) + " " + parens(unrevealed)
				}
			}

			if (V.turn !== PEACE_TURN_6) {
				update_text_html("war-strength-fr", war_number * 10 + theater, `<div class="theater-flag fr"></div><span>${fr_strength}</span>`)
				update_text_html("war-strength-br", war_number * 10 + theater, `<div class="theater-flag br"></div><span>${br_strength}</span>`)
			}

			// Winner
			w = G.next_war
			if ((V.theater_winner && V.theater_winner[theater] !== -1) || (V.old_winners && (V.old_winners[G.next_war][theater] !== -1))) {
				let winner = (V.old_winners && (V.old_winners[G.next_war][theater] !== -1)) ? V.old_winners[G.next_war][theater] : V.theater_winner[theater]
				let margin = (V.old_winners && (V.old_winners[G.next_war][theater] !== -1)) ? V.old_margins[G.next_war][theater] : V.theater_margin[theater]
				let is_tie = margin === 0
				let flag_class = is_tie ? "tie" : (winner === FRANCE ? "fr" : "br")

				if (margin > 0) {
					let tier = theater_tier(G.next_war, winner, theater, margin) + 1
					if (tier > 0) {
						let box = w * 100 + theater * 10 + tier
						if (((w === 2) && (theater === 4)) || ((w === 4) && (theater === 1)))
							if (winner === BRITAIN) box += 3
						update_keyword("war-margin", box, flag_class)
					}
				}

				update_text_html("war-winner", war_number * 10 + theater, is_tie ? `<div>TIE</div>` : `<div class="theater-flag ${flag_class}"></div><span>${margin}</span>`)
			}
		}
	}

	for (let who = FRANCE; who <= BRITAIN; who++) {
		for (let theater = 0; theater <= data.wars[G.next_war].theaters; theater++) {
			for (let tile of V.theater_bonus[who][theater])
				if (tile >= 0)
					update_keyword("bonus_war", tile, "hidden", !(set_has(V.bonus_revealed[who], tile) || (tile === BYNG) || (tile === ATLANTIC_DOMINANCE)))
			for (let tile of V.theater_basic[who][theater])
				if (tile >= 0)
					update_keyword("basic_war", tile, "hidden", !set_has(V.basic_revealed[who], tile))
		}
	}

	if (V.turn >= PEACE_TURN_6) return

	for (let theater = 1; theater <= data.wars[war + 1].theaters; theater++)
		update_theater_flags(war, theater)
}

/* TEXT FORMATTING */

// Returns an "s" if the amount is anything but 1; returns "" if amount is one
function s(amount) {
	if (amount !== 1) return "s"
	return ""
}

// Returns "a " if the amount is exactly 1; returns "" if amount is any other value
function a(amount) {
	if (amount === 1) return "a "
	return ""
}

// Returns "an " if the amount is exactly 1; returns "" if amount is any other value
function an(amount) {
	if (amount === 1) return "an "
	return ""
}

function parens(s, condition = true) {
	if (!condition) return s
	return "(" + s + ")"
}

function bold(s, condition = true) {
	if (!condition) return s
	return "<b>" + s + "</b>"
}

function italic(s, condition = true) {
	if (!condition) return s
	return "<i>" + s + "</i>"
}

function strike(s, condition = true) {
	if (!condition) return s
	return "<s>" + s + "</s>"
}

/* LOG & PROMPT FORMATTING */

function on_prompt(text) {
	if (text === null) {
		console.error("V.prompt is NULL")
		return "V.prompt is NULL"
	}

	// Detect "Sherlock mode" and don't mangle the prefix
	if (params.mode !== "play" && text[0] === "[") {
		var ix = text.indexOf("]") + 1
		return text.slice(0, ix) + escape_text(text.slice(ix))
	}

	return escape_text(text)
}

const log_box_keywords = ["fr", "br", "both"]
const log_box_types = { "1": "ministry", "2": "event", "3": "advantage", "4": "misc" }

function on_log(text, ix) {
	// instead of having the whole client crash at the startsWith when I accidentally log(struct) or whatever
	if (typeof text !== "string")
		text = String(text)

	var p = document.createElement("div")

	update_log_boxes(ix)

	var is_box_header = false

	if (text.startsWith("=br")) {
		text = text.substring(3)
		p.className = "h2 br"
	}

	if (text.startsWith("=fr")) {
		text = text.substring(3)
		p.className = "h2 fr"
	}

	switch (text[0]) {
		case "{":
			is_box_header = true
			open_log_box(ix, log_box_keywords[text[1]])
			text = text.substring(3)
			break
		case "}":
			close_log_box(ix)
			text = text.substring(1)
			break
		case ">":
			p.className = "i"
			text = text.substring(1)
			break
		case "#":
			p.className = "h1"
			text = text.substring(1)
			break
		case "=":
			p.className = "h2"
			text = text.substring(1)
			break
		case "~":
			if (text[1] === "a") p.innerHTML = log_awards(text)
			if (text[1] === "d") p.innerHTML = log_demands(text)
			if (text[1] === "w") p.innerHTML = log_war_tiles(text)
			return p
	}

	if (text.match(/^\.h1/)) {
		text = text.substring(4)
		p.className = 'h1'
	}
	if (text.match(/^\.h2/)) {
		text = text.substring(4)
		p.className = 'h2'
	}

	var inner = apply_log_boxes(ix, p, "group")
	inner.innerHTML = escape_text(text)
	if (is_box_header)
		inner.classList.add("header")

	return p
}

function log_awards(codes)
{
	let awards = []
	awards[REGION_EUROPE] = codes[2] - '0' // Starts at 2  (0 and 1 are the ~a)
	awards[REGION_NORTH_AMERICA] = codes[3] - '0'
	awards[REGION_CARIBBEAN] = codes[4] - '0'
	awards[REGION_INDIA] = codes[5] - '0'

	let msg = []
	msg.push("<div class=award-table>")
	for (const region of [ REGION_NORTH_AMERICA, REGION_EUROPE, REGION_CARIBBEAN, REGION_INDIA ]) {
		var chit = awards[region]
		msg.push(`<div>`)
		msg.push(`<div class="award-title">${data.regions[region].name}</div>`)
		msg.push(`<div class="marker square-sm black award a${chit}"
			onmouseenter="_tip_focus_award(${chit})"
			onmouseleave="_tip_blur_award()"
			onmousedown="_tip_click_light('award',${chit})"
			></div>`
		)
		msg.push(`</div>`)
	}
	msg.push(`</div>`)
	return msg.join("")
}

function log_demands(codes)
{
	let global_demand = []
	global_demand.push(codes[2] - '0') // Starts at 2  (0 and 1 are the ~d)
	global_demand.push(codes[3] - '0')
	global_demand.push(codes[4] - '0')

	let msg = []
	msg.push(`<div class=demand-table>`)
	for (var i = 0; i < 3; i++) {
		var chit = global_demand[i]
		var name = data.demands[chit].name.toLowerCase()
		msg.push(`<div class="marker square-sm demand ${name}"
			onmouseenter="_tip_focus_demand('${chit}', 'marker square-sm demand ${name}')"
			onmouseleave="_tip_blur_demand()"
			onmousedown="_tip_click_light('demand',${chit})"
			></div>`
		)
	}
	msg.push("</div>")
	return msg.join("")
}

function log_war_tiles(codes)
{
	let basic = []
	let bonus = []
	let index = 1 // Starts at 2, but we need a +1 at the beginning to make the loop work
	codes += "X" // terminate with something

	// Example encoding: ~wb00,B10,B20
	do {
		index++
		let key = codes[index++]
		let value = codes[index++] - '0'
		value = value*10 + (codes[index++] - '0')
		if (key === 'b') {
			basic.push(value)
		} else {
			bonus.push(value)
		}
	} while (codes[index] === ',')

	let msg = []
	msg.push(`<div class="wartile-table">`)

	let who, whom
	for (const tile of basic) {
		who = data.basic_war_tiles[tile].side
		whom = (who === FRANCE) ? "fr" : "br"
		msg.push(`<div class="marker hex basic_war ${whom} war-basic${tile}"
			onmouseenter="_tip_focus_basic_war_tile(${tile})"
			onmouseleave="_tip_blur_basic_war_tile()"
			></div>`
		)
	}
	for (const tile of bonus) {
		who = data.bonus_war_tiles[tile].side
		whom = (who === FRANCE) ? "fr" : "br"
		if (tile === BYNG)
			msg.push(`<div class="marker hex-sm byng ${whom}"
				onmouseenter="_tip_focus_bonus_war_tile(${tile})"
				onmouseleave="_tip_blur_bonus_war_tile()"
				></div>`
			)
		else if (tile === ATLANTIC_DOMINANCE + FRANCE)
			msg.push(`<div class="marker hex-sm atlantic-dominance fr"
				onmouseenter="_tip_focus_bonus_war_tile(${tile})"
				onmouseleave="_tip_blur_bonus_war_tile()"
				></div>`
			)
		else if (tile === ATLANTIC_DOMINANCE + BRITAIN)
			msg.push(`<div class="marker hex-sm atlantic-dominance br"
				onmouseenter="_tip_focus_bonus_war_tile(${tile})"
				onmouseleave="_tip_blur_bonus_war_tile()"
				></div>`
			)
		else
			msg.push(`<div class="marker hex bonus_war war${tile}"
				onmouseenter="_tip_focus_bonus_war_tile(${tile})"
				onmouseleave="_tip_blur_bonus_war_tile()"
				></div>`
			)
	}
	msg.push("</div>")
	return msg.join("")
}

/* ESCAPE CODES: BASIC TEXT */

const event_card_names = data.cards.map(x => x?.name)
const ministry_card_names = data.ministries.map(x => x?.name)
const advantage_names = data.advantages.map(x => x?.name)
const demand_names = data.demands.map(x => x?.name)

function escape_text(text) {
	let verbose = get_preference("actionverbosity", "medium")
	let shortest = (verbose === "short")

	if (shortest) {
		text = text.replace("Britain", "BR")
		text = text.replace("British", "BR")
		text = text.replace("France", "FR")
		text = text.replace("French", "FR")

		text = text.replace("Spend Action Points", "Spend AP")
	}

	text = escape_event(text, /\bEE(\d+)\b/g, "tip-event-uc", "card event_card c$1", event_card_names, NONE)
	text = escape_event(text, /\bEEF(\d+)\b/g, "tip-event-uc-fr", "card event_card c$1", event_card_names, FRANCE)
	text = escape_event(text, /\bEEB(\d+)\b/g, "tip-event-uc-br", "card event_card c$1", event_card_names, BRITAIN)

	text = escape_ministry(text, /\bMM(\d+)\b/g, "tip-ministry-uc", "card ministry_card c$1", ministry_card_names, NONE)
	text = escape_ministry(text, /\bMMF(\d+)\b/g, "tip-ministry-uc-fr", "card ministry_card c$1", ministry_card_names, FRANCE)
	text = escape_ministry(text, /\bMMB(\d+)\b/g, "tip-ministry-uc-br", "card ministry_card c$1", ministry_card_names, BRITAIN)

	text = escape_advantage(text, /\bAA(\d+)\b/g, "tip-advantage-uc", "square marker advantage a$1", advantage_names, NONE)
	text = escape_advantage(text, /\bAAF(\d+)\b/g, "tip-advantage-uc-fr", "square marker advantage a$1", advantage_names, FRANCE)
	text = escape_advantage(text, /\bAAB(\d+)\b/g, "tip-advantage-uc-br", "square marker advantage a$1", advantage_names, BRITAIN)

	text = escape_demand(text, /\bDD(\d+)\b/g, "tip-demand-uc", "marker square-sm demand $1", demand_names)
	text = escape_demand(text, /\bDDF(\d+)\b/g, "tip-demand-uc-fr", "marker square-sm demand $1", demand_names)
	text = escape_demand(text, /\bDDB(\d+)\b/g, "tip-demand-uc-br", "marker square-sm demand $1", demand_names)

	text = escape_event(text, /\bE(\d+)\b/g, "tip-event", "card event_card c$1", event_card_names, NONE)
	text = escape_event(text, /\bEF(\d+)\b/g, "tip-event-fr", "card event_card c$1", event_card_names, FRANCE)
	text = escape_event(text, /\bEB(\d+)\b/g, "tip-event-br", "card event_card c$1", event_card_names, BRITAIN)

	text = escape_ministry(text, /\bM(\d+)\b/g, "tip-ministry", "card ministry_card c$1", ministry_card_names, NONE)
	text = escape_ministry(text, /\bMF(\d+)\b/g, "tip-ministry-fr", "card ministry_card c$1", ministry_card_names, FRANCE)
	text = escape_ministry(text, /\bMB(\d+)\b/g, "tip-ministry-br", "card ministry_card c$1", ministry_card_names, BRITAIN)

	text = escape_advantage(text, /\bA(\d+)\b/g, "tip-advantage", "square marker advantage a$1", advantage_names, NONE)
	text = escape_advantage(text, /\bAF(\d+)\b/g, "tip-advantage-fr", "square marker advantage a$1", advantage_names, FRANCE)
	text = escape_advantage(text, /\bAB(\d+)\b/g, "tip-advantage-br", "square marker advantage a$1", advantage_names, BRITAIN)

	text = escape_demand(text, /\bD(\d+)\b/g, "tip-demand", "marker square-sm demand $1", demand_names)
	text = escape_demand(text, /\bDF(\d+)\b/g, "tip-demand-fr", "marker square-sm demand $1", demand_names)
	text = escape_demand(text, /\bDB(\d+)\b/g, "tip-demand-br", "marker square-sm demand $1", demand_names)

	text = escape_square_brackets(text)

	return escape_typography(text)
}

/* ESCAPE CODES: SQUARE BRACKETS */

function escape_square_brackets(text) {
	let runaway = 0
	let match = ""

	do {
		match = text.match(/\[.*?]/) // Get the whole expression including the brackets
		if (match) {
			let inside = match[0].match(/\[(.*?)]/) // Get the inside-the-brackets bit.
			let type = inside[1][0]                 // First character tells us what type of thing (S = Spending, A = Award, I = Investment, P = action points)

			if (type === "P") {
				let action_text = say_action_points()
				text = text.replace(/\[.*?]/, action_text)
				break // Gonna cheat and break here, because I only use this at the end of strings. Sorry, future-self-using-it-somewhere-else...
			}

			if (inside[1] === "Click") {
				text = text.replace(/\[.*?]/, is_mobile() ? "Tap" : "Click")
				continue
			}

			if (inside[1] === "click") {
				text = text.replace(/\[.*?]/, is_mobile() ? "tap" : "click")
				continue
			}

			let has_who_key = ((type !== "@") && (type !== "a") && (type !== "v"))
			let who_key = inside[1][1]                         // Second character tells us what nation color to use, if any
			let msg     = inside[1].slice(has_who_key ? 2 : 1) // Rest of string is the message
			let value = 0

			if (["i", "I", "W", "S", "B", "b"].includes(type)) {	// Some items encode a three-digit number
				if (is_digit(msg[0])) {
					value = msg[0] - '0'
					msg = msg.substring(1)
					if (is_digit(msg[0])) {
						value = value * 10 + (msg[0] - '0')
						msg = msg.substring(1)
						if (is_digit(msg[0])) {
							value = value * 10 + (msg[0] - '0')
							msg = msg.substring(1)
						}
					}
				}
			} else if ((type === "@") || (type === "a")) { // Others have a one-digit number
				value = msg[0] - '0'
				msg = msg.substring(1)
			}

			let who = (who_key === "F") ? FRANCE : (who_key === "B") ? BRITAIN : NONE

			// Second character is usually F/B/X for French/British/None
			// a - [#0] - text description of action point type, variable by verbosity preference
			// @ - [#0] - Action points symbol (0=Econ, 1=Diplo, 2=Mil)
			// b - [bF001] - basic war tile
			// B - [BF001] - bonus war tile
			// F - [FFstring] - "Flag" string - colored by nationality of second letter (i.e. F/B/X)
			// i - [iF001] - Investment tile (make own message)
			// I - [IF001] - Investment tile (with provided string)
			// W - [WF001] - Award tile
			// S - [SF001] - Space name
			// V - [V] - scroll down to war mat
			// Y - [YF] - Player name colored by team color (team color indexes which player name is used)
			// $ - [$Fstring] - Display string, link to spending

			let tooltip_text = ""
			let className = ""
			let whom = ""
			switch (type) {
				case "a":
					{
						let verbose = get_preference("actionverbosity", "medium")
						if (verbose === "long") {
							tooltip_text = " " + data.action_points[value].name + " action point" + escape_typography(msg)
						} else {
							tooltip_text = ""
						}
					}
					break
				case "@":
					switch (value) {
						case ECON: tooltip_text = '<img class="symbol" draggable="false" src="images/icon-economic.svg">'; break
						case DIPLO: tooltip_text = '<img class="symbol" draggable="false" src="images/icon-diplomatic.svg">'; break
						case MIL: tooltip_text = '<img class="symbol" draggable="false" src="images/icon-military.svg">'; break
					}
					switch (value) {
						case ECON: tooltip_text = '<span class="symbol econ"></span>'; break
						case DIPLO: tooltip_text = '<span class="symbol diplo"></span>'; break
						case MIL: tooltip_text = '<span class="symbol mil"></span>'; break
					}
					break
				case "b":
					className = "tip-basic-war"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					tooltip_text = `<span
						class="${className}"
						onmouseenter="_tip_focus_basic_war_tile(${value})"
						onmouseleave="_tip_blur_basic_war_tile()"
						>${escape_typography(msg)}</span>`
					break
				case "B":
					className = "tip-bonus-war"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					tooltip_text = `<span
						class="${className}"
						onmouseenter="_tip_focus_bonus_war_tile(${value})"
						onmouseleave="_tip_blur_bonus_war_tile()"
						>${escape_typography(msg)}</span>`
					break
				case "F":
					className = "flag-string"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					tooltip_text = `<span
						class="${className}"
						>${escape_typography(msg)}</span>`
					break
				case "i":
					className = "tip-investment"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					tooltip_text = `<span
						class="${className}"
						onmouseenter="_tip_focus_investment(${value})"
						onmouseleave="_tip_blur_investment()"
						onmousedown="_tip_click_light('investment',${value})"
						>${say_investment_tile(value)}</span>`
					break
				case "I":
					className = "tip-investment"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					tooltip_text = `<span
						class="${className}"
						onmouseenter="_tip_focus_investment(${value})"
						onmouseleave="_tip_blur_investment()"
						onmousedown="_tip_click_light('investment',${value})"
						>${escape_typography(msg)}</span>`
					break
				case "W":
					className = "tip-award"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					tooltip_text = `<span
						class="${className}"
						onmouseenter="_tip_focus_award(${value})"
						onmouseleave="_tip_blur_award()"
						onmousedown="_tip_click_light('award',${value})"
						>${escape_typography(msg)}</span>`
					break
				case "S":
					className = "tip-space"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					msg = data.spaces[value].name
					tooltip_text = `<span
						class="${className}"
						onmouseenter="_tip_focus_space(${who}, ${value})"
						onmouseleave="_tip_blur_space()"
						onmousedown="_tip_click_light('space',${value})"
						>${escape_typography(msg)}</span>`
					break
				case "V":
					tooltip_text = `${escape_typography(msg)}`
					scroll_to_war()
					break
				case "Y":
					className = "flag-string"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					whom = ((who === FRANCE) || (who === BRITAIN)) ? roles[who].user_name : "Observer"
					tooltip_text = `<span
						class="${className}"
						>${escape_typography(whom)}</span>`
					break
				case "$":
				default:
					className = "tip-spending"
					className += ((who === FRANCE) ? "-fr" : (who === BRITAIN) ? "-br" : "")
					tooltip_text = `<span
						class="${className}"
						onmouseenter="_tip_focus_spending(${who})"
						onmouseleave="_tip_blur_spending()"
						onmousedown="_tip_click_light('general-track', '15')"
						>${escape_typography(msg)}</span>`
					break
			}
			text = text.replace(/\[.*?]/, tooltip_text)
		}

		if (++runaway > 500) {
			throw new Error("Runaway Square Brackets escape sequence: " + text.slice(0, 40))
		}
	} while (match)

	return text
}

/* ESCAPE CODES: INVESTMENT TILE */

function say_investment_tile(tile)
{
	let msg = `<span style="text-decoration: none; display: inline-block">` // No underline among the baked-in symbols - looks terrible
	msg += escape_square_brackets(say_action_points_brief(data.investments[tile].majorval, data.investments[tile].majortype) + " / " + say_action_points_brief(data.investments[tile].minorval, data.investments[tile].minortype))

	let verbose = get_preference("actionverbosity", "medium")
	if (verbose === "long") {
		msg += " " + data.action_points[data.investments[tile].majortype].name + " / " + data.action_points[data.investments[tile].minortype].name
	}
	msg += `</span>`

	var major = data.investments[tile].majorval

	//BR// Maybe we'll copy the "dagger" and "snake" icons the actual tiles use? But for now at least...
	if (major === 3) {
		msg += "<br/>"
		msg += (verbose === "short") ? "Event" : "Event allowed"
	} else if (major === 2) {
		msg += "<br/>"
		msg += (verbose === "short") ? "Event + Military" : "Event allowed + Military Upgrade"
	}

	return msg
}

/* ESCAPE CODES: CARDS & TILES */

function escape_event(text, re, log_className, tip_className, names, who) {
	return text.replace(re, (m, x) => `<span
		class="${log_className}"
		onmouseenter="_tip_focus_event('${who}', '${x}', '${tip_className.replace("$1", x)}')"
		onmouseleave="_tip_blur_event()"
		onmousedown="_tip_click_light('event_card',${x})"
		>${escape_typography(names[x])}</span>`
	)
}

function escape_ministry(text, re, log_className, tip_className, names, who) {
	return text.replace(re, (m, x) => `<span
		class="${log_className}"
		onmouseenter="_tip_focus_ministry('${who}', '${x}', '${tip_className.replace("$1", x)}')"
		onmouseleave="_tip_blur_ministry()"
		onmousedown="_tip_click_light('ministry_card',${x})"
		>${escape_typography(names[x])}</span>`
	)
}

function escape_demand(text, re, log_className, tip_className, names) {
	return text.replace(re, (m, x) => `<span
		class="${log_className}"
		onmouseenter="_tip_focus_demand(${x})"
		onmouseleave="_tip_blur_demand()"
		onmousedown="_tip_click_light('demand',${x})"
		>${escape_typography(names[x])}</span>`
	)
}

function escape_advantage(text, re, log_className, tip_className, names, who) {
	return text.replace(re, (m, x) => `<span
		class="${log_className}"
		onmouseenter="_tip_focus_advantage('${who}', '${x}', '${tip_className.replace("$1", x)}')"
		onmouseleave="_tip_blur_advantage()"
		onmousedown="_tip_click_light('advantage',${x})"
		>${escape_typography(names[x])}</span>`
	)
}

/* ESCAPE CODES: ACTION POINTS */

function say_action_points_brief(num, type, plus = false, force_num = true)
{
	let msg = plus ? "+" : ""
	let doing_num = ((num > 0) || force_num || plus)
	msg += "[@" + type + "]"
	if (doing_num)	msg += num
	return msg
}

// True if ANY contingent action points of the specified type (ECON, DIPLO, MIL) theoretically available based on array of rules we're eligible for (or a single rule). Even if we've spent it all we can still use debt/TRPs in that category.
function any_contingent(type, rules) {
	if ((rules !== undefined) && (rules !== null)) {
		if (rules.constructor === Array) {
			for (let rule of rules) {
				for (let i = 0; i < G.contingent.length; i++) {
					if (G.contingent[i].type !== type) continue
					if (G.contingent[i].rule !== rule) continue
					return true
				}
			}
		} else {
			for (let i = 0; i < G.contingent.length; i++) {
				if (G.contingent[i].type !== type) continue
				if (G.contingent[i].rule !== rules) continue
				return true
			}
		}
	}
	return false
}

// Amount of contingent action points of the specified type (ECON, DIPLO, MIL) available based on array of rules we're eligible for (or a single rule)
function get_contingent(type, rules)
{
	let amount = 0
	if ((rules !== undefined) && (rules !== null)) {
		if (rules.constructor === Array) {
			for (let rule of rules) {
				for (let i = 0; i < G.contingent.length; i++) {
					if (G.contingent[i].type !== type) continue
					if (G.contingent[i].rule !== rule) continue
					amount += G.contingent[i].amount
				}
			}
		} else {
			for (let i = 0; i < G.contingent.length; i++) {
				if (G.contingent[i].type !== type) continue
				if (G.contingent[i].rule !== rules) continue
				amount += G.contingent[i].amount
			}
		}
	}
	return amount
}

function action_points_eligible(type, rules = []) {
	return G.eligible[type] || any_contingent(type, rules)
}

// Returns a list of all presently-active contingent action point rules
function active_rules() {
	let rules = []
	for (const contingency of G.contingent) {
		rules.push(contingency.rule)
	}
	return rules
}

function active_rules_list() {
	let rules = []
	for (const contingency of G.contingent) {
		rules.push( { "rule": contingency.rule, "short": contingency.short, "amount": contingency.amount } )
	}
	return rules
}

function is_action_phase()
{
	if (V === undefined) return false
	return V.subphase !== NOT_ACTION_PHASE
}

function say_action_points() {

	if (!is_action_phase()) return ""
	if (G.subphase < PICKED_TILE_OPTION_TO_PASS) return ""

	let verbose = get_preference("actionverbosity", "medium")
	let names = []
	let shortest = (verbose === "short")
	let longest = (verbose === "long")
	for (i = 0; i < NUM_ACTION_POINTS_TYPES; i++) {
		names[i] = escape_square_brackets("[@" + i + "]")
		if (verbose === "short") {
			//names[i] = "" // data.action_points[i].letter
		} else if (verbose === "long") {
			names[i] += " " + data.action_points[i].name
		} else {
			//names[i] = data.action_points[i].short
		}
	}

	var need_comma = false
	var early = [ false, false, false ]
	var tell = ""
	var told_name = [ false, false, false ]
	for (var level = MAJOR; level <= MINOR; level++) {
		for (var i = 0; i < NUM_ACTION_POINTS_TYPES; i++) {
			if (G.eligible === undefined) continue
			if (!action_points_eligible(i, active_rules())) continue
			if ((level === MAJOR) && G.eligible_major[i]) {

				if (need_comma) {
					tell += ", "
				}
				tell += names[i] + (!longest ? "" : ": ")
				told_name[i] = true
				need_comma = true

				tell += G.major[i] //+ " major"
				if (G.minor[i]) {
					tell += shortest ? "M" : " Major" // only explicitly say Major if we also have Minor
				}

				early[i] = true // If we had legit major points of this, then ALL other types should display immediately (to stay consecutive with it in the list)
			}

			if ((level === MAJOR) === early[i]) {
				if (data.investments[V.played_tile].minortype === i) {
					if (level === MINOR) {
						if (need_comma) {
							tell += ", "
						}
						tell += names[i] + (!longest ? "" : ": ")
						told_name[i] = true
					} else if (need_comma) {
						tell += ", "
					}

					tell += G.minor[i] + (shortest ? "m" : " Minor")
					need_comma = true
				}

				if (G.committed[i] > 0) {
					if (need_comma) {
						tell += ", "
					}

					if (!told_name[i]) {
						tell += names[i] + (!longest ? "" : ": ")
						told_name[i] = true
					}

					tell += G.committed[i] + " Bonus"
					need_comma = true
				}

				for (let rule of active_rules_list()) {
					let amount = rule.amount //get_contingent(i, rule.rule)
					if (any_contingent(i, rule.rule)) {
						if (need_comma) {
							tell += ", "
						}
						if (!told_name[i]) {
							tell += names[i] + (!longest ? "" : ": ")
							told_name[i] = true
						}
						tell += amount + " " + (shortest ? rule.short : rule.rule)
						need_comma = true
					}
				}
			}
		}
	}

	if (tell === "") return tell
	tell = " " + tell
	tell = italic(tell)

	if (is_mobile()) {
		tell = "<div>" + tell + "</div>" // On mobile we don't let the amount of action points fold up
	}

	return tell

	//console.log (get_preference("actionverbosity", "medium"))
}

/* WINDOW: FORMATTING HELPERS */

function say_flag_color(who, string)
{
	return escape_square_brackets("[F" + (((who === FRANCE) || (who === USA)) ? "F" : (who === BRITAIN) ? "B" : "X") + string + "]")
}

/* WINDOW: PLAIN TEXT SUMMARIES */

function format_delta(winner, delta)
{
	return say_flag_color(winner, "+" + delta) + " "
}

function format_prestige_info()
{
	return format_delta(prestige_winner(), prestige_flag_delta()) + "Prestige: 2 VP"
}

function format_final_prestige_info()
{
	let winner = prestige_winner()
	return format_delta(winner, prestige_flag_delta()) + "Prestige: +2 VP"
}

function format_debt_info() {
	let award = debt_award()
	return format_delta(debt_winner(), debt_delta()) + "Available Debt: +" + award + " VP"
}

function format_space_info(s)
{
	return say_flag_color(G.flags[s], data.spaces[s].name + ": +2 VP")
}

function format_award_info(r, a)
{
	let winner = region_flag_winner(r)
	let delta = region_flag_delta(r)
	let msg = format_delta(winner, delta) + data.regions[r].name + ": " + data.awards[a].name
	return `<span
		onmouseenter="_tip_focus_award(${a})"
		onmouseleave="_tip_blur_award()"
		onmousedown="_tip_click_light('award',${a})">${msg}</span>`
}

function format_demand_info(d)
{
	let winner = demand_flag_winner(d)
	let delta = demand_flag_delta(d)
	let msg = format_delta(winner, delta) + data.demands[d].name + ": +" + format_demand_rewards(d)
	return `<span
		onmouseenter="_tip_focus_demand(${d})"
		onmouseleave="_tip_blur_demand()"
		onmousedown="_tip_click_light('demand',${d})">${msg}</span>`
}

function format_final_demand_info(d)
{
	let winner = demand_flag_winner(d)
	let delta = demand_flag_delta(d)
	let msg = format_delta(winner, delta) + data.demands[d].name + (winner !== NONE ? ": +1 VP" : ": +0 VP")
	return `<span
		onmouseenter="_tip_focus_demand(${d})"
		onmouseleave="_tip_blur_demand()"
		onmousedown="_tip_click_light('demand',${d})">${msg}</span>`
}

function update_scoring_summary_dialog_text() {
	var text = []
	text.push("<dl>")

	text.push("<dt>Prestige")
	text.push("<dd>" + format_prestige_info())

	text.push("<dt>Regions")
	for (var r = 0; r < NUM_REGIONS; r++) {
		var a = V.awards[r]
		text.push("<dd>" + format_award_info(r, a))
	}

	text.push("<dt>Global Demand")
	for (var d = 0; d < NUM_DEMANDS; d++) {
		if (!V.global_demand.includes(d))
			continue
		text.push("<dd>" + format_demand_info(d))
	}

	text.push("<dt>Projected Results")
	text.push("<dd>" + format_results_info(d))

	text.push("</dl>")
	return text.join("")
}

function format_scoring_conquests() {
	var text = []
	var any = false
	for (const s of [ NORTHERN_COLONIES, CAROLINAS, JAMAICA, BARBADOS, MADRAS, CALCUTTA ]) {
		if (G.flags[s] === FRANCE || G.flags[s] === USA) {
			if (!any)
				any = true
			text.push("<dd>" + format_space_info(s))
		}
	}
	for (const s of [ ACADIA, QUEBEC_AND_MONTREAL, LOUISIANA, ST_DOMINGUE, GUADELOUPE, PONDICHERRY, CHANDERNAGORE ]) {
		if (G.flags[s] === BRITAIN) {
			if (!any)
				any = true
			text.push("<dd>" + format_space_info(s))
		}
	}
	if (!any)
		text.push("<dd>None")
	return text.join("")
}

function update_final_scoring_summary_dialog_text()
{
	var text = []
	text.push("<dl>")

	text.push("<dt>Prestige")
	text.push("<dd>" + format_final_prestige_info())

	text.push("<dt>Debt")
	text.push("<dd>" + format_debt_info())

	text.push("<dt>Global Demand")
	for (var d = 0; d < NUM_DEMANDS; d++)
		text.push("<dd>" + format_final_demand_info(d))

	text.push("<dt>Conquests")
	text.push(format_scoring_conquests())

	text.push("<dt>Projected Results")
	text.push("<dd>" + format_final_scoring_results_info())

	text.push("</dl>")
	return text.join("")
}


/* WINDOW: SUMMARY - PRELIMINARY RESULTS */

function format_results_info()
{
	preview_scoring_results()

	let msg = ""
	if (V.preview_vp === 0) {
		msg += escape_square_brackets("[FX+0 VP]")
	} else if (V.preview_vp > 0) {
		msg += escape_square_brackets("[FF+" + V.preview_vp + " VP France]")
	} else {
		msg += escape_square_brackets("[FB+" + Math.abs(V.preview_vp) + " VP Britain]")
	}
	if (V.preview_trp[FRANCE] || V.preview_trp[BRITAIN]) {
		msg += "<br/>"
		if (V.preview_trp[FRANCE]) {
			msg += escape_square_brackets("[FF+" + V.preview_trp[FRANCE] + " TRP France]")
		}
		if (V.preview_trp[BRITAIN]) {
			if (V.preview_trp[FRANCE]) msg += ", "
			msg += escape_square_brackets("[FB+" + V.preview_trp[BRITAIN] + " TRP Britain]")
		}
	}
	if (V.preview_debt[FRANCE] || V.preview_debt[BRITAIN]) {
		msg += "<br/>"
		if (V.preview_debt[FRANCE]) {
			msg += escape_square_brackets("[FF" + ((V.preview_debt[FRANCE] > 0) ? "+" : "") + V.preview_debt[FRANCE] + " Debt France]")
		}
		if (V.preview_debt[BRITAIN]) {
			if (V.preview_debt[FRANCE]) msg += ", "
			msg += escape_square_brackets("[FB" + ((V.preview_debt[BRITAIN] > 0) ? "+" : "") + V.preview_debt[BRITAIN] + " Debt Britain]")
		}
	}
	if (V.preview_ministries.length > 0) {
		msg += "<br/>"
		msg += "Ministries: "
		let any = false
		for (const m of V.preview_ministries) {
			if (any) msg += ", "
			msg += escape_text("M" + ((data.ministries[m].side === FRANCE) ? "F" : "B") + m)
			any = true
		}
	}

	return msg
}

function preview_scoring_results() {
	let vp = 0
	let trp = [0, 0]
	let debt = [0, 0]
	let ministries = []

	let winner = prestige_winner()
	if (winner !== NONE) {
		vp += ((winner === FRANCE) ? 2 : -2)
	}

	//TODO it would be *more sound* if this stuff were pre-computed in rules using the same code that runs "scoring_phase". It would require refactoring that code.

	for (let r = 0; r < NUM_REGIONS; r++) {
		let award = G.awards[r]
		let winner = region_flag_winner(r)
		let delta = region_flag_delta(r)
		if (data.awards[award].by2 && delta < 2) continue
		if (winner === NONE) continue

		let award_vp = data.awards[award].vp
		let award_trp = data.awards[award].trp
		if (r === REGION_EUROPE) {
			if (has_active_ministry(winner, COURT_OF_THE_SUN_KING)) {
				award_vp++
				ministries.push(COURT_OF_THE_SUN_KING)
			}
			if (has_active_ministry(winner, SAMUEL_JOHNSON)) {
				ministries.push(SAMUEL_JOHNSON)
				award_vp++
			} else if (has_active_ministry(1 - winner, SAMUEL_JOHNSON)) {
				if (award_vp > 0) {
					award_vp--
					ministries.push(SAMUEL_JOHNSON)
				}
			}
		} else if (r === REGION_INDIA) {
			if (has_active_ministry(winner, DUPLEIX)) {
				award_trp++
				ministries.push(DUPLEIX)
			}
		}

		if (award_vp > 0) {
			vp += ((winner === FRANCE) ? award_vp : -award_vp)
		}
		trp[winner] += award_trp

		if (r === REGION_EUROPE) {
			if (has_active_ministry(FRANCE, VOLTAIRE)) {
				let multispace = 0
				if ((G.flags[IRELAND_2] === FRANCE) && !has_conflict_marker(IRELAND_2)) multispace++
				if (G.flags[SCOTLAND_2] === FRANCE && !has_conflict_marker(SCOTLAND_2)) multispace++
				if (((G.flags[PRUSSIA_2] === FRANCE) && !has_conflict_marker(PRUSSIA_2)) || ((G.flags[PRUSSIA_4] === FRANCE) && !has_conflict_marker(PRUSSIA_4))) multispace++
				if ((G.flags[DUTCH_2] === FRANCE) && !has_conflict_marker(DUTCH_2)) multispace++
				if (((G.flags[AUSTRIA_2] === FRANCE) && !has_conflict_marker(AUSTRIA_2)) || ((G.flags[AUSTRIA_4] === FRANCE) && !has_conflict_marker(AUSTRIA_4))) multispace++
				if (((G.flags[SPAIN_2] === FRANCE) && !has_conflict_marker(SPAIN_2)) || ((G.flags[SPAIN_4] === FRANCE) && !has_conflict_marker(SPAIN_4))) multispace++

				let countries = Math.min(3, multispace)
				if (countries) {
					trp[FRANCE] += countries
					ministries.push(VOLTAIRE)
				}
			}
		}
	}

	for (const d of G.global_demand) {
		let winner = demand_flag_winner(d)
		if (winner === NONE) continue

		let award_vp = data.demands[d].awards[current_era()].vp
		let award_trp = data.demands[d].awards[current_era()].trp
		let award_debt = data.demands[d].awards[current_era()].debt

		if ((d === COTTON) || (d === SPICE)) {
			if (has_active_ministry(winner, DUPLEIX)) {
				award_trp++
				if (!ministries.includes(DUPLEIX)) ministries.push(DUPLEIX)
			}
		}

		if (award_vp > 0) {
			vp += ((winner === FRANCE) ? award_vp : -award_vp)
		}
		trp[winner] += award_trp
		debt[winner] += award_debt
	}

	if (has_active_ministry(BRITAIN, EAST_INDIA_COMPANY)) {
		let award_vp = 0
		for (const a of [ TEXTILES, SILK, FRUIT, FUR_TRADE, RUM]) {
			if (has_advantage(BRITAIN, a) && !is_advantage_conflicted(a) && !is_advantage_exhausted(a)) {
				award_vp++
			}
		}
		award_vp = Math.min(award_vp, 3)
		if (award_vp > 0) {
			vp -= award_vp
			ministries.push(EAST_INDIA_COMPANY)
		}
	}

	V.preview_vp = vp
	V.preview_trp = trp
	V.preview_debt = debt
	V.preview_ministries = ministries
}

function format_final_scoring_results_info()
{
	let vp = 0

	let winner = prestige_winner()
	if (winner !== NONE) {
		vp += ((winner === FRANCE) ? 2 : -2)
	}

	winner = debt_winner()
	if ((winner !== NONE) && (debt_award() > 0)) {
		vp += ((winner === FRANCE) ? debt_award() : -debt_award())
	}

	for (let d = 0; d < NUM_DEMANDS; d++) {
		winner = demand_flag_winner(d)
		if (winner !== NONE) {
			vp += ((winner === FRANCE) ? 1 : -1)
		}
	}

	for (const s of [ NORTHERN_COLONIES, CAROLINAS, JAMAICA, BARBADOS, MADRAS, CALCUTTA ]) {
		if ((G.flags[s] === FRANCE) || (G.flags[s] === USA)) {
			vp += 2
		}
	}

	for (const s of [ ACADIA, QUEBEC_AND_MONTREAL, LOUISIANA, ST_DOMINGUE, GUADELOUPE, PONDICHERRY, CHANDERNAGORE ]) {
		if (G.flags[s] === BRITAIN) {
			vp -= 2
		}
	}

	if (vp > 0) {
		return escape_square_brackets("[FF+" + vp + " VP France]")
	} else if (vp < 0) {
		return escape_square_brackets("[FB+" + (0 - vp) + " VP Britain]")
	} else {
		return escape_square_brackets("[FX+" + (0 - vp) + " VP]")
	}
}

/* WINDOW: EVENT CARDS */

function format_card_info(c) {
	return escape_text("E" + c)
}


function update_event_card_display_fancy(width)
{
	var c, text = []

	//lookup_window("event_card_dialog").body.style.transform = "scale(.75)"

	text.push("<div class='event-card-display'>")
	for (let category of [ "inhand", "indeck", "played", "discarded", "empire", "revolution"]) {
		for (let e = 1; e <= NUM_EVENT_CARDS; e++) {
			let status, status_string;
			if (V.played_events.includes(e)) {
				status = "played"
				status_string = "PLAYED"
			} else if (V.discard_pile.includes(e)) {
				status = "discarded"
				status_string = "DISCARDED"
			} else if (V.deck.includes(e)) {
				status = "indeck"
				if (is_observing()) {
					status_string = "DECK OR HANDS"
				} else {
					status_string = "DECK OR OPPONENT"
				}
			} else if (!is_observing() && V.hand[R].includes(e)) {
				status = "inhand"
				status_string = "YOUR HAND"
			} else if (e > EMPIRE_ERA_CARDS && (current_era() < REVOLUTION_ERA)) {
				status = "revolution"
				status_string = "NOT YET IN PLAY"
			} else if (e > SUCCESSION_ERA_CARDS && (current_era() < EMPIRE_ERA)) {
				status = "empire"
				status_string = "NOT YET IN PLAY"
			}
			if (status !== category) continue

			let who = NONE
			text.push(`<div class="card-display card event_card c${e}" onmouseenter="_tip_focus_event('${who}', '${e}', 'card event_card c${e}')" onmouseleave="_tip_blur_event()"><div class="card-badge ${status}">${status_string}</div></div>`)
		}
	}
	text.push("</div>")

	return text.join("")
}

function update_event_card_dialog() {
	let width = lookup_window("event_card_dialog").body.offsetWidth
	if (width >= 1000) {
		return update_event_card_display_fancy(width)
	}

	var c, text = []

	text.push("<dl>")

	text.push(`<dt>Played Event Cards (${V.played_events.length})`)
	for (c of V.played_events)
		text.push("<dd>" + format_card_info(c))

	text.push(`<dt>Discarded Event Cards (${V.discard_pile.length})`)
	for (c of V.discard_pile)
		text.push("<dd>" + format_card_info(c))

	if (is_observing())
		text.push(`<dt>Player Hands or Deck (${V.deck.length})`)
	else
		text.push(`<dt>Opponent's Hand or Deck (${V.deck.length})`)
	for (c of V.deck)
		text.push("<dd>" + format_card_info(c))

	if (!is_observing()) {
		text.push(`<dt>Your Hand (${V.hand[R].length})`)
		for (c of V.hand[R])
			text.push("<dd>" + format_card_info(c))
	}

	if (current_era() < EMPIRE_ERA) {
		text.push(`<dt>Empire Era (not yet in play) (15)`)
		for (c = SUCCESSION_ERA_CARDS + 1; c <= EMPIRE_ERA_CARDS; c++)
			text.push("<dd>" + format_card_info(c))
	}

	if (current_era() < REVOLUTION_ERA) {
		text.push(`<dt>Revolution Era (not yet in play) (11)`)
		for (c = EMPIRE_ERA_CARDS + 1; c <= REVOLUTION_ERA_CARDS; c++)
			text.push("<dd>" + format_card_info(c))
	}

	text.push("</dl>")

	return text.join("")
}

/* WINDOW: MINISTRY CARDS */

function format_ministry_info(c) {
	return escape_text("M" + c)
}

function update_ministry_dialog(who) {
	var m, text = []

	text.push("<dl>")

	text.push("<dt>Current Available Ministries")
	for (m = 1; m <= NUM_MINISTRY_CARDS; m++) {
		if (data.ministries[m].side !== who) continue
		if (!data.ministries[m].era.includes(current_era())) continue
		if ((m === JACOBITE_UPRISINGS) && is_bit(JACOBITES_NEVER)) continue
		text.push("<dd>" + format_ministry_info(m))
	}

	if (current_era() === SUCCESSION_ERA) {
		text.push("<dt>Empire Era Ministries (not yet in play)")
		for (m = 1; m <= NUM_MINISTRY_CARDS; m++) {
			if (data.ministries[m].side !== who) continue
			if (data.ministries[m].era.includes(current_era())) continue
			if (!data.ministries[m].era.includes(EMPIRE_ERA)) continue
			text.push("<dd>" + format_ministry_info(m))
		}
	}

	if (current_era() < REVOLUTION_ERA) {
		text.push("<dt>Revolution Era Ministries (not yet in play)")
		for (m = 1; m <= NUM_MINISTRY_CARDS; m++) {
			if (data.ministries[m].side !== who) continue
			if (data.ministries[m].era.includes(current_era())) continue
			if (data.ministries[m].era.includes(EMPIRE_ERA)) continue
			if (!data.ministries[m].era.includes(REVOLUTION_ERA)) continue
			text.push("<dd>" + format_ministry_info(m))
		}
	}

	if (is_bit(JACOBITES_NEVER) && (who === FRANCE)) {
		text.push("<dt>Removed From Game")
		text.push("<dd>" + format_ministry_info(m))
	}

	if (current_era() === REVOLUTION_ERA) {
		text.push("<dt>Empire Era Ministries (out of play)")
		for (m = 1; m <= NUM_MINISTRY_CARDS; m++) {
			if (data.ministries[m].side !== who) continue
			if (data.ministries[m].era.includes(current_era())) continue
			if (!data.ministries[m].era.includes(EMPIRE_ERA)) continue
			text.push("<dd>" + format_ministry_info(m))
		}
	}

	if (current_era() !== SUCCESSION_ERA) {
		text.push("<dt>Succession Era Ministries (out of play)")
		for (m = 1; m <= NUM_MINISTRY_CARDS; m++) {
			if (data.ministries[m].side !== who) continue
			if (data.ministries[m].era.includes(current_era())) continue
			if (data.ministries[m].era.includes(EMPIRE_ERA)) continue
			if (!data.ministries[m].era.includes(SUCCESSION_ERA)) continue
			if ((m === JACOBITE_UPRISINGS) && is_bit(JACOBITES_NEVER)) continue
			text.push("<dd>" + format_ministry_info(m))
		}
	}

	text.push("</dl>")

	return text.join("")
}

function update_british_ministry_dialog() {
	return update_ministry_dialog(BRITAIN)
}

function update_french_ministry_dialog() {
	return update_ministry_dialog(FRANCE)
}

/* WINDOW: SCORING SUMMARY */

function format_winner_delta(winner, delta) {
	if (winner === FRANCE)
		return `<div class="score-delta">${say_flag_color(winner, "+" + delta)}<div class="score-flag fr"></div></div>`
	if (winner === BRITAIN)
		return `<div class="score-delta">${say_flag_color(winner, "+" + delta)}<div class="score-flag br"></div></div>`
	return `<div class="score-delta">${say_flag_color(NONE, "+0")}<div class="score-flag none"></div></div>`
}

function format_award_chit(a) {
	return `<div class="marker square-sm black award a${a}"
		onmouseenter="_tip_focus_award(${a})"
		onmouseleave="_tip_blur_award()"
		onmousedown="_tip_click_light('award',${a})"
		></div>`
}

function format_demand_chit(d) {
	var name = data.demands[d].name.toLowerCase()
	return `<div class="square-sm marker demand ${name}"
		onmouseenter="_tip_focus_demand(${d})"
		onmouseleave="_tip_blur_demand()"
		onmousedown="_tip_click_light('demand',${d})"
		></div>`
}

function format_region_score_summary(r) {
	var a = V.awards[r]
	return (`
		<div class="score-row">
			${format_award_chit(a)}
			<div>${data.regions[r].name}</div>
			${format_winner_delta(region_flag_winner(r), region_flag_delta(r))}
		</div>
	`)
}

function format_prestige_score_summary() {
	return (`
		<div class="score-row">
			<img style="display:block" src="images/award_2vp.webp" width=47 height=47>
			<div>2 VP</div>
			${format_winner_delta(prestige_winner(), prestige_flag_delta())}
		</div>
	`)
}

function format_demand_rewards(d)
{
	let era = current_era()
	let awards = data.demands[d].awards[era]
	let msg = awards.vp + " VP"
	if (awards.trp > 0) msg += ", +" + awards.trp + " TRP"
	if (awards.debt < 0) msg += ", " + awards.debt + " Debt"
	if (awards.debt > 0) msg += ", +" + awards.debt + " Debt"
	return msg
}

function format_demand_score_summary(d) {
	return (`
		<div class="score-row">
			${format_demand_chit(d)}
			<div>${format_demand_rewards(d)}</div>
			${format_winner_delta(demand_flag_winner(d), demand_flag_delta(d))}
		</div>
	`)
}

function format_final_demand_score_summary(d) {
	return (`
		<div class="score-row">
			${format_demand_chit(d)}
			<div>1 VP</div>
			${format_winner_delta(demand_flag_winner(d), demand_flag_delta(d))}
		</div>
	`)
}

function update_scoring_summary_dialog() {
	if (V.bidding_for_sides) return "..."
	if (get_preference("scoresies"))
		return update_scoring_summary_dialog_text()
	return update_scoring_summary_dialog_fancy()
}

function update_scoring_summary_dialog_fancy() {
	var text = []
	text.push(`
		<div class="score-summary">
			<div class="score-summary-1">
				<div>Regions</div>
				<div class="score-table-awards">
					${format_region_score_summary(REGION_NORTH_AMERICA)}
					${format_region_score_summary(REGION_EUROPE)}
					${format_region_score_summary(REGION_CARIBBEAN)}
					${format_region_score_summary(REGION_INDIA)}
				</div>
			</div>
			<div class="score-summary-2">
				<div>Prestige &amp; Global Demand</div>
				<div class="score-table-demands">
					${format_prestige_score_summary()}
	`)

	for (var d = 0; d < NUM_DEMANDS; d++)
		if (V.global_demand.includes(d))
			text.push(format_demand_score_summary(d))

	text.push(`
				</div>
			</div>
			<div class="score-summary-3">
				<dl>
					<dt>Projected Results
					<dd>${format_results_info()}
				</dl>
			</div>
		</div>
	`)

	return text.join("")
}

/* WINDOW: FINAL SCORING SUMMARY */

function update_final_scoring_summary_dialog()
{
	if (V.bidding_for_sides) return "..."
	if (get_preference("scoresies"))
		return update_final_scoring_summary_dialog_text()
	return update_final_scoring_summary_dialog_fancy()
}

function update_final_scoring_summary_dialog_fancy()
{
	var text = []

	text.push(`
		<div class="score-summary">
			<div class="score-summary-2">
				<div>Prestige &amp; Global Demand</div>
				<div class="score-table-demands">
					${format_prestige_score_summary()}
					${format_final_demand_score_summary(0)}
					${format_final_demand_score_summary(1)}
					${format_final_demand_score_summary(2)}
					${format_final_demand_score_summary(3)}
					${format_final_demand_score_summary(4)}
					${format_final_demand_score_summary(5)}
				</div>
			</div>
			<div class="score-summary-1">
				<dl>
					<dt>Debt
					<dd>${format_debt_info()}
					<br>
					<br>
					<dt>Conquests
					${format_scoring_conquests()}
				</dl>
			</div>
			<div class="score-summary-3">
				<dl>
					<dt>Projected Results
					<dd>${format_final_scoring_results_info()}
				</dl>
			</div>
		</div>
	`)

	return text.join("")
}

/* HOTKEYS */

window.addEventListener("keydown", function (evt) {
	if (document.activeElement instanceof HTMLInputElement)
		return
	if (document.activeElement instanceof HTMLTextAreaElement)
		return
	if (evt.altKey || evt.ctrlKey)
		return
	switch (evt.key) {
		case "s":
		case "S":
			toggle_window("scoring_summary_dialog")
			evt.preventDefault()
			break

		case "T":
		case "t":
			set_preference_checkbox("scoresies", false)
			evt.preventDefault()
			break

		case "y":
		case "Y":
			toggle_window("final_scoring_summary_dialog")
			evt.preventDefault()
			break

		case "f":
		case "F":
			toggle_window("french_ministry_dialog")
			evt.preventDefault()
			break
		case "b":
		case "B":
			toggle_window("british_ministry_dialog")
			evt.preventDefault()
			break
		case "e":
		case "E":
			toggle_window("event_card_dialog")
			evt.preventDefault()
			break
		case "l":
		case "L":
			toggle_log()
			evt.preventDefault()
			break
		case "z":
		case "Z":
			toggle_zoom()
			scroll_to_map()
			evt.preventDefault()
			break

		case "m":
		case "M":
			scroll_to_map()
			evt.preventDefault()
			break

		case "w":
		case "W":
			scroll_to_war()
			evt.preventDefault()
			break

		case "c":
		case "C":
			scroll_to_cards()
			evt.preventDefault()
			break

		case "d":
		case "D":
			scroll_to_debt(FRANCE)
			scroll_to_debt(BRITAIN)
			evt.preventDefault()
			break

		case "a":
		case "A":
			toggle_preference_checkbox("allwars")
			scroll_to_war()
			evt.preventDefault()
			break

		case "p":
		case "P":
			toggle_notepad()
			evt.preventDefault()
			break

		case "v":
		case "V":
			{
				let verbose = get_preference("actionverbosity", "medium")
				if (verbose === "short") {
					verbose = "medium"
				} else if (verbose === "medium") {
					verbose = "long"
				} else {
					verbose = "short"
				}
				set_preference_radio("actionverbosity", verbose)
				evt.preventDefault()
			}
			break

		case " ":  //"Tab": // TAB
			toggle_markers()
			evt.preventDefault()
			break

		case "Escape": // ESC - hide any dialogs, restore approximate "default state"
			document.querySelector("aside").hidden = is_mobile() // Show the log (unless mobile, in which case hide it)
			document.body.classList.remove("hide-markers")
			set_preference_checkbox("allwars", false)
			update_zoom()
			evt.preventDefault()
			break

		case "x": //NB - if you try this in a non-solo game it just throws you out
		case "X":
			if (window.location.search.includes("France")) {
				window.location.search = window.location.search.replace("France", "Britain")
			} else {
				window.location.search = window.location.search.replace("Britain", "France")
			}
			evt.preventDefault()
			break
	}
})

/* LAYOUT DATA */

function find_layout_node(name) {
	if (name in layout_nodes)
		return layout_nodes[name]
	return null
}

// Usually one of these at a time. One fairly rare case of 3. So I put them to the right of the name of the map for a bit less scrolling down.
const layout_theater_drawn = [700, 0, 400, 70]

const layout_nodes = {
	"Demand": [1111,323,324,61],
	"Demand_winner":[1120, 375, 324, 25],
	"Deal Tiles": [1250,0,324,61],
	"record track 0": [2083,1302,58,58],
	"record track 1": [2143,1302,58,58],
	"record track 2": [2201,1302,58,58],
	"record track 3": [2261,1302,58,58],
	"record track 4": [2321,1302,58,58],
	"record track 5": [2380,1302,58,58],
	"record track 6": [2439,1302,58,58],
	"record track -7": [2084,1242,58,58],
	"record track -6": [2143,1242,58,58],
	"record track -5": [2202,1242,58,58],
	"record track -4": [2262,1242,58,58],
	"record track -3": [2321,1242,58,58],
	"record track -2": [2380,1242,58,58],
	"record track -1": [2439,1242,58,58],
	"record track 7": [2143,1363,58,58],
	"record track 8": [2202,1363,58,58],
	"record track 9": [2261,1363,58,58],
	"record track 10": [2321,1363,58,58],
	"record track 11": [2380,1363,58,58],
	"record track 12": [2439,1363,58,58],
	"record track 13": [2142,1422,58,58],
	"record track 14": [2200,1422,58,58],
	"record track 15": [2260,1422,58,58],
	"record track 16": [2320,1422,58,58],
	"record track 17": [2379,1422,58,58],
	"record track 18": [2438,1422,58,58],
	"record track 19": [2142,1483,58,58],
	"record track 20": [2201,1483,58,58],
	"record track 21": [2261,1483,58,58],
	"record track 22": [2320,1483,58,58],
	"record track 23": [2379,1483,58,58],
	"record track 24": [2438,1483,58,58],
	"record track 25": [2143,1542,58,58],
	"record track 26": [2201,1542,58,58],
	"record track 27": [2261,1542,58,58],
	"record track 28": [2320,1542,58,58],
	"record track 29": [2379,1542,58,58],
	"record track 30": [2438,1542,58,58],
	"record track 31": [2142,1601,58,58],
	"record track 32": [2200,1601,58,58],
	"record track 33": [2260,1601,58,58],
	"record track 34": [2320,1601,58,58],
	"record track 35": [2378,1601,58,58],
	"record track 36": [2437,1601,58,58],
	"Navy Box France": [925,875,60,60],
	"Navy Box Britain": [1050,875,60,60],
	"Turn 5": [126,1180,58,101],
	"Turn 4": [125,1281,58,101],
	"Turn 3": [126,1383,58,101],
	"Turn 2": [126,1485,58,56],
	"Turn 1": [126,1546,58,56],
	"War 4": [47,1129,78,104],
	"War 3": [47,1233,78,102],
	"War 2": [48,1334,78,102],
	"War 1": [48,1493,78,104],
	"Turn 6": [125,1079,58,101],
	"Initiative": [251,1502,75,75],
	"Award North America": [669,48,118,119],
	"Award_winner North America": [669, 132, 118, 25],
	"Award_winner North America Left": [684, 95, 40, 25],
	"Award_winner North America Right": [757, 95, 40, 25],
	"Award India": [1437,888,118,119],
	"Award_winner India": [1437, 972, 118, 25],
	"Award_winner India Left": [1451, 935, 40, 25],
	"Award_winner India Right": [1526, 935, 40, 25],
	"Award Europe": [1307,530,118,119],
	"Award_winner Europe": [1321, 562, 40, 25],
	"Award_winner Europe Left": [1321, 562, 40, 25],
	"Award_winner Europe Right": [1395, 562, 40, 25],
	"Award_winner Europe Prestige": [1321, 592, 40, 25],
	"Award_winner Europe Prestige Left": [1321, 592, 40, 25],
	"Award_winner Europe Prestige Right": [1393, 592, 40, 25],
	"Award Caribbean": [1100,1238,118,119],
	"Award_winner Caribbean": [1100, 1317, 118, 25],
	"Award_winner Caribbean Left": [1114, 1284, 40, 25],
	"Award_winner Caribbean Right": [1188, 1284, 40, 25],

	"Ireland_1": [1492,242,65,65],
	"Ireland_2": [1583,243,65,65],
	"Scotland_1": [1695,126,65,65],
	"Scotland_2": [1787,127,65,65],
	"Denmark": [2024,55,65,65],
	"Prussia_1": [2068,193,65,65],
	"Prussia_2": [2161,193,65,65],
	"Prussia_3": [2068,301,65,65],
	"Prussia_4": [2161,301,65,65],
	"Sweden": [2317,150,65,65],
	"Russia": [2409,264,65,65],
	"Dutch_1": [1846,294,65,65],
	"Dutch_2": [1937,294,65,65],
	"German_States_1": [2008,466,65,65],
	"German_States_2": [2101,467,65,65],
	"Bavaria": [2218,466,65,65],
	"Austria_1": [2334,495,65,65],
	"Austria_2": [2426,495,65,65],
	"Austria_3": [2333,587,65,65],
	"Austria_4": [2426,587,65,65],
	"Sardinia": [2189,803,65,65],
	"Savoy": [1989,611,65,65],
	"Spain_1": [1523,578,65,65],
	"Spain_2": [1615,578,65,65],
	"Spain_3": [1523,669,65,65],
	"Spain_4": [1615,669,65,65],
	"Gibraltar": [1306,670,77,77],
	"Minorca": [1306,780,77,77],
	"Biscay": [1300,396,88,77],
	"Balearic": [1394,396,88,77],
	"Algonquin": [132,150,65,65],
	"Hudson Bay": [331,70,77,77],
	"York Factory": [257,156,76,76],
	"Quebec & Montreal": [429,107,77,77],
	"Gulf of St. Lawrence": [952,158,76,76],
	"Cabot Strait": [927,256,88,77],
	"Louisbourg": [1038,362,88,77],
	"Acadia": [922,384,77,77],
	"Northeast Channel": [820,439,76,76],
	"Halifax": [796,324,88,77],
	"Georges Bank": [732,508,76,76],
	"Atlantic Passage": [619,589,88,77],
	"Gulf of Maine": [609,429,88,77],
	"Mass. Bay": [472,396,76,76],
	"Northern Colonies": [261,660,77,77],
	"Chesapeake": [223,772,76,76],
	"Hudson Valley": [266,496,76,76],
	"Albany": [315,396,76,76],
	"Cumberland": [93,710,76,76],
	"Ohio Forks": [27,609,88,77],
	"Allegheny": [124,532,76,76],
	"Niagara": [81,452,76,76],
	"Oswego": [221,382,76,76],
	"Champlain Valley": [337,272,88,77],
	"Ile aux Noix": [440,212,76,76],
	"Cataraqui": [213,259,76,76],
	"Iroquois": [80,910,65,65],
	"Sons of Liberty": [507,634,65,65],
	"USA_Prestige_2": [1003,602,65,65],
	"USA_Prestige_3": [1096,602,65,65],
	"Asiento": [782,781,77,77],
	"Privateers": [937,1139,65,65],
	"Buccaneers": [528,1545,65,65],
	"Carolinas": [698,691,77,77],
	"Georgia": [591,723,76,76],
	"San Agustin": [565,825,77,77],
	"Panzacola": [450,905,76,76],
	"Bahamas Run West": [528,1068,76,76],
	"Bahamas Run North": [712,918,76,76],
	"Caicos": [679,1147,76,76],
	"Bahamas Run": [635,1044,88,77],
	"St. Domingue": [754,1252,77,77],
	"Port de Paix": [664,1250,76,76],
	"Puerto Principe": [550,1185,76,76],
	"Puerto Rico": [855,1283,76,76],
	"Antigua": [898,1379,76,76],
	"Martinique": [986,1445,76,76],
	"St. Lucia": [962,1548,76,76],
	"Antilles Channel": [855,1489,88,77],
	"Guadeloupe": [1089,1381,77,77],
	"Barbados": [1084,1536,77,77],
	"Havana": [400,1215,76,76],
	"Gulf of Cazones": [481,1257,88,77],
	"Santiago": [559,1314,76,76],
	"Jamaica": [452,1422,77,77],
	"Cayman Passage": [313,1362,76,76],
	"Cuba Passage East": [437,1109,76,76],
	"Cuba Passage": [332,1124,88,77],
	"St. James": [270,941,76,76],
	"Louisiana": [325,848,77,77],
	"Maratha": [1799,731,65,65],
	"Nizam": [1409,1198,65,65],
	"Mysore": [1408,1491,65,65],
	"Malacca Route": [2254,1110,76,76],
	"Hooghly River": [2026,986,88,77],
	"Chandernagore": [2044,881,77,77],
	"Plassey": [1936,791,76,76],
	"West Bengal": [1812,859,76,76],
	"Midnapore": [1870,1038,76,76],
	"Calcutta": [2074,1106,77,77],
	"Kurpa": [1558,1084,76,76],
	"Arcot": [1644,1160,88,77],
	"Vellore": [1544,1207,76,76],
	"Kanchipuram": [1774,1278,76,76],
	"Madras": [1957,1222,77,77],
	"Pondicherry": [1957,1392,77,77],
	"Karaikal": [1933,1513,76,76],
	"Vandavasi": [1749,1419,88,77],
	"Tiruchirappalli": [1614,1470,76,76],
	"Calicut": [1333,1329,76,76],
	"Mangalore": [1279,1073,76,76],
	"Malabar Coast": [1243,1206,88,77],
	"Baltic Trade": [1908,119,80,80],
	"Central Europe Conflict": [2281,364,80,80],
	"German Diplomacy": [2288,263,80,80],
	"Italy Influence": [2177,646,80,80],
	"Mediterranean Intrigue": [1788,592,80,80],
	"Naval Bastion": [1406,661,80,80],
	"Silesia Negotiations": [2418,382,80,80],
	"Algonquin Raids": [45,249,80,80],
	"Fur Trade": [224,46,80,80],
	"Iroquois Raids": [47,1009,80,80],
	"Patriot Agitation": [370,692,80,80],
	"Wheat": [135,800,80,80],
	"Fruit": [444,786,80,80],
	"Letters of Marque": [1083,1100,80,80],
	"Pirate Havens": [664,1555,80,80],
	"Rum": [985,1242,80,80],
	"Slaving Contracts": [866,721,80,80],
	"Power Struggle": [1533,1545,80,80],
	"Raids & Incursions": [1702,826,80,80],
	"Separatist Wars": [1486,1318,80,80],
	"Silk": [1767,952,80,80],
	"Textiles": [1703,1539,80,80],
	"Navy Box": [883,833,290,144],
}

const war_layout = {
	war_7yw_theater_drawn: [353, 0, 667, 93],
	war_7yw_theater_1_france: [57, 132, 152, 152],
	war_7yw_theater_1_britain: [225, 132, 152, 152],
	war_7yw_theater_2_france: [579, 132, 152, 152],
	war_7yw_theater_2_britain: [747, 132, 152, 152],
	war_7yw_theater_3_france: [57, 503, 152, 152],
	war_7yw_theater_3_britain: [225, 503, 152, 152],
	war_7yw_theater_4_france: [579, 503, 152, 152],
	war_7yw_theater_4_britain: [747, 503, 152, 152],
	war_wss_theater_1_france: [57, 132, 152, 152],
	war_wss_theater_1_britain: [225, 132, 152, 152],
	war_wss_theater_2_france: [579, 132, 152, 152],
	war_wss_theater_2_britain: [747, 132, 152, 152],
	war_wss_theater_3_france: [57, 504, 152, 152],
	war_wss_theater_3_britain: [225, 504, 152, 152],
	war_wss_theater_4_france: [579, 503, 152, 152],
	war_wss_theater_4_britain: [747, 503, 152, 152],
	war_was_theater_1_france: [57, 116, 152, 152],
	war_was_theater_1_britain: [225, 116, 152, 152],
	war_was_theater_2_france: [578, 116, 152, 152],
	war_was_theater_2_britain: [746, 116, 152, 152],
	war_was_theater_3_france: [57, 445, 152, 152],
	war_was_theater_3_britain: [225, 445, 152, 152],
	war_was_theater_4_france: [578, 439, 152, 152],
	war_was_theater_4_britain: [746, 439, 152, 152],
	war_awi_theater_1_france: [57, 132, 152, 152],
	war_awi_theater_1_britain: [225, 132, 152, 152],
	war_awi_theater_2_france: [579, 132, 152, 152],
	war_awi_theater_2_britain: [747, 132, 152, 152],
	war_awi_theater_3_france: [579, 443, 152, 152],
	war_awi_theater_3_britain: [747, 443, 152, 152],
	war_awi_theater_4_france: [577, 132, 152, 152],
	war_awi_theater_4_britain: [747, 132, 152, 152],

	war_wss_theater_1: [35, 75, 508, 361],
	war_wss_theater_2: [556, 75, 508, 361],
	war_wss_theater_3: [35, 446, 508, 361],
	war_wss_theater_4: [556, 446, 508, 361],

	war_was_theater_1: [35, 65, 508, 324],
	war_was_theater_2: [556, 65, 508, 324],
	war_was_theater_3: [35, 398, 508, 302],
	war_was_theater_4: [556, 398, 508, 420],

	war_7yw_theater_1: [35, 75, 508, 361],
	war_7yw_theater_2: [556, 75, 508, 361],
	war_7yw_theater_3: [35, 446, 508, 361],
	war_7yw_theater_4: [556, 446, 508, 361],

	war_awi_theater_1: [35, 75, 508, 467],
	war_awi_theater_2: [556, 75, 508, 299],
	war_awi_theater_3: [556, 386, 508, 426],

	// WSS - Strength
	war_wss_theater_1_strength_fr: [50, 400, 100, 25],
	war_wss_theater_1_strength_br: [430, 400, 100, 25],
	war_wss_theater_2_strength_fr: [570, 400, 100, 25],
	war_wss_theater_2_strength_br: [950, 400, 100, 25],
	war_wss_theater_3_strength_fr: [50, 770, 100, 25],
	war_wss_theater_3_strength_br: [430, 770, 100, 25],
	war_wss_theater_4_strength_fr: [570, 770, 100, 25],
	war_wss_theater_4_strength_br: [950, 770, 100, 25],

	// WSS - Winner
	war_wss_theater_1_winner: [290, 94, 60, 25],
	war_wss_theater_2_winner: [690, 94, 60, 25],
	war_wss_theater_3_winner: [340, 464, 60, 25],
	war_wss_theater_4_winner: [850, 464, 60, 25],

	// WSS - Alliances
	war_wss_theater_1_alliances: [500, 142, 50, 152],
	war_wss_theater_2_alliances: [1022, 160, 50, 152],
	war_wss_theater_3_alliances: [500, 527, 50, 152],
	war_wss_theater_4_alliances: [1022, 519, 50, 152],

	// WAS - Strength
	war_was_theater_1_strength_fr: [50, 355, 100, 25],
	war_was_theater_1_strength_br: [430, 355, 100, 25],
	war_was_theater_2_strength_fr: [570, 355, 100, 25],
	war_was_theater_2_strength_br: [950, 355, 100, 25],
	war_was_theater_3_strength_fr: [50, 665, 100, 25],
	war_was_theater_3_strength_br: [430, 665, 100, 25],
	war_was_theater_4_strength_fr: [570, 820, 100, 25],
	war_was_theater_4_strength_br: [950, 820, 100, 25],

	// WAS - Winner
	war_was_theater_1_winner: [295, 82, 60, 25],
	war_was_theater_2_winner: [865, 82, 60, 25],
	war_was_theater_3_winner: [335, 413, 60, 25],
	war_was_theater_4_winner: [865, 413, 60, 25],

	// WAS - Alliances
	war_was_theater_1_alliances: [500, 122, 50, 152],
	war_was_theater_2_alliances: [1022, 142, 50, 152],
	war_was_theater_3_alliances: [500, 471, 50, 152],
	war_was_theater_4_alliances: [1022, 454, 50, 152],

	// 7YW - Strength
	war_7yw_theater_1_strength_fr: [50, 400, 100, 25],
	war_7yw_theater_1_strength_br: [430, 400, 100, 25],
	war_7yw_theater_2_strength_fr: [570, 400, 100, 25],
	war_7yw_theater_2_strength_br: [950, 400, 100, 25],
	war_7yw_theater_3_strength_fr: [50, 770, 100, 25],
	war_7yw_theater_3_strength_br: [430, 770, 100, 25],
	war_7yw_theater_4_strength_fr: [570, 770, 100, 25],
	war_7yw_theater_4_strength_br: [950, 770, 100, 25],

	// 7YW - Winner
	war_7yw_theater_1_winner: [355, 94, 60, 25],
	war_7yw_theater_2_winner: [875, 94, 60, 25],
	war_7yw_theater_3_winner: [370, 465, 60, 25],
	war_7yw_theater_4_winner: [810, 465, 60, 25],

	// 7YW - Alliances
	war_7yw_theater_1_alliances: [520, 147, 50, 152],
	war_7yw_theater_2_alliances: [1030, 150, 50, 152],
	war_7yw_theater_3_alliances: [505, 514, 50, 152],
	war_7yw_theater_4_alliances: [1030, 522, 50, 152],

	// AWI - Strength
	war_awi_theater_1_strength_fr: [50,  506, 100, 25],
	war_awi_theater_1_strength_br: [430, 506, 100, 25],
	war_awi_theater_2_strength_fr: [570,  340, 100, 25],
	war_awi_theater_2_strength_br: [950, 340, 100, 25],
	war_awi_theater_3_strength_fr: [570, 778, 100, 25],
	war_awi_theater_3_strength_br: [950, 778, 100, 25],

	// AWI - Winner
	war_awi_theater_1_winner: [355, 93, 60, 25],
	war_awi_theater_2_winner: [780, 93, 60, 25],
	war_awi_theater_3_winner: [780, 404, 60, 25],

	// AWI - Alliances
	war_awi_theater_1_alliances: [502,  144, 50, 152],
	war_awi_theater_2_alliances: [1037, 164, 50, 152],
	war_awi_theater_3_alliances: [1032, 442, 50, 152],
	war_awi_theater_4_alliances: [1022, 510, 50, 152],
}
