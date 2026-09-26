"use strict"

const fs = require("fs")
const sqlite3 = require("better-sqlite3")
const data = require("./data.js")

/* CONSTANTS */

const GAME_STATE_VERSION = 22

const TRUE  = 1 // JSON size optimization preserving a bit of readability
const FALSE = 0

// TURNS
const PEACE_TURN_1 = 0
const WAR_TURN_WSS = 1
const PEACE_TURN_2 = 2
const PEACE_TURN_3 = 3
const WAR_TURN_WAS = 4
const PEACE_TURN_4 = 5
const WAR_TURN_7YW = 6
const PEACE_TURN_5 = 7
const WAR_TURN_AWI = 8
const PEACE_TURN_6 = 9
const GAME_OVER    = 10

// FLAGS
const FRANCE  = 0
const BRITAIN = 1
const SPAIN   = 2
const USA     = 3
const NONE    = 4   // HO HO HO! WHAT COULD POSSIBLY GO WRONG!

// Types of Action Point
const ECON  = 0
const DIPLO = 1
const MIL   = 2
const WILD  = 3

// Magnitudes of Action
const MAJOR = 0
const MINOR = 1

// Amounts of things!
const NUM_REGIONS           = 4
const NUM_INVESTMENT_TILES  = 24
const NUM_BASE_WAR_TILES    = 16 // per side
const NUM_BONUS_WAR_TILES   = 12 // per side, per war
const NUM_WARS              = 4
const NUM_EVENT_CARDS       = 41
const NUM_MINISTRY_KEYWORDS = 5
const NUM_MINISTRY_CARDS    = 26
const OLD_NUM_MINISTRY_CARDS= 21
const NUM_MINISTRY_SLOTS    = 2
const NUM_DEMANDS           = 6
const NUM_AWARD_TILES       = 8
const NUM_ADVANTAGES        = 22
const NUM_SPACES            = 112
const NUM_ACTION_POINTS_TYPES= 3
const NUM_SQUADRONS         = 8 // per side, counter mix limit

// Types of War Tile
const WAR_DUDE = 0 // Just a soldier
const WAR_DEBT = 1 // Debt attack
const WAR_FORT = 2 // Fort/Fleet attack
const WAR_FLAG = 3 // Diplomatic attack

// Eras
const SUCCESSION_ERA = 0
const EMPIRE_ERA     = 1
const REVOLUTION_ERA = 2

// Wars
const WAR_WSS = 1
const WAR_WAS = 2
const WAR_7YW = 3
const WAR_AWI = 4

// Ministry keywords
const KEYWORD_NONE = -1
const FINANCE      =  0
const MERCANTILISM =  1
const GOVERNANCE   =  2
const STYLE        =  3
const SCHOLARSHIP  =  4

// Global Demand
const FURS    = 0
const SPICE   = 1
const FISH    = 2
const TOBACCO = 3
const SUGAR   = 4
const COTTON  = 5

// Advantages
const BALTIC_TRADE            = 0   // EUROPE
const CENTRAL_EUROPE_CONFLICT = 1
const GERMAN_DIPLOMACY        = 2
const ITALY_INFLUENCE         = 3
const MEDITERRANEAN_INTRIGUE  = 4
const NAVAL_BASTION           = 5
const SILESIA_NEGOTIATIONS    = 6
const ALGONQUIN_RAIDS         = 7   // NORTH AMERICA
const FUR_TRADE               = 8
const IROQUOIS_RAIDS          = 9
const PATRIOT_AGITATION       = 10
const WHEAT                   = 11
const FRUIT                   = 12  // CARIBBEAN
const LETTERS_OF_MARQUE       = 13
const PIRATE_HAVENS           = 14
const RUM                     = 15
const SLAVING_CONTRACTS       = 16
const POWER_STRUGGLE          = 17  // INDIA
const RAIDS_AND_INCURSIONS    = 18
const SEPARATIST_WARS         = 19
const SILK                    = 20
const TEXTILES                = 21

// Event Deck Eras
const SUCCESSION_ERA_CARDS = 15
const EMPIRE_ERA_CARDS     = 30
const REVOLUTION_ERA_CARDS = 41

// Event Cards
const CARNATIC_WAR                  = 1  // SUCCESSION ERA
const ACTS_OF_UNION                 = 2
const TROPICAL_DISEASES             = 3
const SOUTH_SEA_SPECULATION         = 4
const WAR_OF_JENKINS_EAR            = 5
const NATIVE_AMERICAN_ALLIANCES     = 6
const AUSTRO_SPANISH_RIVALRY        = 7
const TAX_REFORM                    = 8
const GREAT_NORTHERN_WAR            = 9
const VATICAN_POLITICS              = 10
const CALICO_ACTS                   = 11
const MILITARY_SPENDING_OVERRUNS    = 12
const ALBERONIS_AMBITION            = 13
const FAMINE_IN_IRELAND             = 14
const INTEREST_PAYMENTS             = 15
const CARIBBEAN_SLAVE_UNREST        = 16 // EMPIRE ERA
const PACTE_DE_FAMILLE              = 17
const BYNGS_TRIAL                   = 18
const LE_BEAU_MONDE                 = 19
const HYDER_ALI                     = 20
const CO_HONG_SYSTEM                = 21
const CORSICAN_CRISIS               = 22
const EUROPEAN_PANIC                = 23
const WEST_AFRICAN_GOLD_MINING      = 24
const WAR_OF_THE_QUADRUPLE_ALLIANCE = 25
const SALON_D_HERCULE               = 26
const BENGAL_FAMINE                 = 27
const FATHER_LE_LOUTRE              = 28
const WAR_OF_THE_POLISH_SUCCESSION  = 29
const JONATHANS_COFFEE_HOUSE        = 30
const NOOTKA_INCIDENT               = 31 // REVOLUTION ERA
const HAITIAN_REVOLUTION            = 32
const LOGE_DES_NEUF_SOEURS          = 33
const LA_GABELLE                    = 34
const JESUIT_ABOLITION              = 35
const WEALTH_OF_NATIONS             = 36
const DEBT_CRISIS                   = 37
const EAST_ASIA_PIRACY              = 38
const STAMP_ACT                     = 39
const FALKLANDS_CRISIS              = 40
const COOK_AND_BOUGAINVILLE         = 41

// MINISTRY CARDS
const THE_CARDINAL_MINISTERS      = 1   // F
const JOHN_LAW                    = 2   // F
const COURT_OF_THE_SUN_KING       = 3   // F
const JACOBITE_UPRISINGS          = 4   // F
const ROBERT_WALPOLE              = 5   //  B
const JONATHAN_SWIFT              = 6   //  B
const EAST_INDIA_COMPANY          = 7   //  B
const BANK_OF_ENGLAND             = 8   //  B
const NEW_WORLD_HUGUENOTS         = 9   // F
const EDMOND_HALLEY               = 10  //  B
const CHOISEUL                    = 11  // F
const DUPLEIX                     = 12  // F
const POMPADOUR_AND_DU_BARRY      = 13  // F
const VOLTAIRE                    = 14  // F
const PITT_THE_ELDER              = 15  //  B
const CHARLES_HANBURY_WILLIAMS    = 16  //  B
const MERCHANT_BANKS              = 17  //  B
const SAMUEL_JOHNSON              = 18  //  B
const JAMES_WATT                  = 19  //  B
const PAPACY_HANOVER_NEGOTIATIONS = 20  //  B
const TOWNSHEND_ACTS              = 21  //  B
const EDMUND_BURKE                = 22  //  B
const TURGOT                      = 23  // F
const NORTH_AMERICAN_TRADE        = 24  // F
const MARQUIS_DE_CONDORCET        = 25  // F
const LAVOISIER                   = 26  // F

// REGIONS
const REGION_EUROPE        = 0
const REGION_NORTH_AMERICA = 1
const REGION_CARIBBEAN     = 2
const REGION_INDIA         = 3
const REGION_ALL           = -1

// SUBREGIONS
const SUBREGION_CANADA         = 0
const SUBREGION_NORTHERN_COL   = 1
const SUBREGION_HOOGHLY_RIVER  = 2
const SUBREGION_CARNATIC_COAST = 3

// SPACE TYPES
const POLITICAL = 0
const MARKET    = 1
const NAVAL     = 2
const TERRITORY = 3
const FORT      = 4

// SPACES PER REGION
const NUM_SPACES_EUROPE         = 30
const NUM_SPACES_NORTH_AMERICA  = 30
const NUM_SPACES_CARIBBEAN      = 30
const NUM_SPACES_INDIA          = 22

// SPACES
const SPACE_NAVY_BOX = -1 // The negative numbers are for keeping track of squadron "token" locations for animation purposes
const SPACE_UNBUILT = -2
const SPACE_THE_BRIG = -3
const SPACE_REMOVED_FROM_GAME = -4
const IRELAND_1 = 0
const IRELAND_2 = 1
const SCOTLAND_1 = 2
const SCOTLAND_2 = 3
const DENMARK = 4
const PRUSSIA_1 = 5
const PRUSSIA_2 = 6
const PRUSSIA_3 = 7
const PRUSSIA_4 = 8
const SWEDEN = 9
const RUSSIA = 10
const DUTCH_1 = 11
const DUTCH_2 = 12
const GERMAN_STATES_1 = 13
const GERMAN_STATES_2 = 14
const BAVARIA = 15
const AUSTRIA_1 = 16
const AUSTRIA_2 = 17
const AUSTRIA_3 = 18
const AUSTRIA_4 = 19
const SARDINIA = 20
const SAVOY = 21
const SPAIN_1 = 22
const SPAIN_2 = 23
const SPAIN_3 = 24
const SPAIN_4 = 25
const GIBRALTAR = 26
const MINORCA = 27
const BISCAY = 28
const BALEARIC = 29
const ALGONQUIN = 30
const HUDSON_BAY = 31
const YORK_FACTORY = 32
const QUEBEC_AND_MONTREAL = 33
const GULF_OF_ST_LAWRENCE = 34
const CABOT_STRAIT = 35
const LOUISBOURG = 36
const ACADIA = 37
const NORTHEAST_CHANNEL = 38
const HALIFAX = 39
const GEORGES_BANK = 40
const ATLANTIC_PASSAGE = 41
const GULF_OF_MAINE = 42
const MASS_BAY = 43
const NORTHERN_COLONIES = 44
const CHESAPEAKE = 45
const HUDSON_VALLEY = 46
const ALBANY = 47
const CUMBERLAND = 48
const OHIO_FORKS = 49
const ALLEGHENY = 50
const NIAGARA = 51
const OSWEGO = 52
const CHAMPLAIN_VALLEY = 53
const ILE_AUX_NOIX = 54
const CATARAQUI = 55
const IROQUOIS = 56
const SONS_OF_LIBERTY = 57
const USA_1 = 58
const USA_2 = 59
const ASIENTO = 60
const PRIVATEERS = 61
const BUCCANEERS = 62
const CAROLINAS = 63
const GEORGIA = 64
const SAN_AGUSTIN = 65
const PANZACOLA = 66
const BAHAMAS_RUN_WEST = 67
const BAHAMAS_RUN_NORTH = 68
const CAICOS = 69
const BAHAMAS_RUN = 70
const ST_DOMINGUE = 71
const PORT_DE_PAIX = 72
const PUERTO_PRINCIPE = 73
const PUERTO_RICO = 74
const ANTIGUA = 75
const MARTINIQUE = 76
const ST_LUCIA = 77
const ANTILLES_CHANNEL = 78
const GUADELOUPE = 79
const BARBADOS = 80
const HAVANA = 81
const GULF_OF_CAZONES = 82
const SANTIAGO = 83
const JAMAICA = 84
const CAYMAN_PASSAGE = 85
const CUBA_PASSAGE_EAST = 86
const CUBA_PASSAGE = 87
const ST_JAMES = 88
const LOUISIANA = 89
const MARATHA = 90
const NIZAM = 91
const MYSORE = 92
const MALACCA_ROUTE = 93
const HOOGHLY_RIVER = 94
const CHANDERNAGORE = 95
const PLASSEY = 96
const WEST_BENGAL = 97
const MIDNAPORE = 98
const CALCUTTA = 99
const KURPA = 100
const ARCOT = 101
const VELLORE = 102
const KANCHIPURAM = 103
const MADRAS = 104
const PONDICHERRY = 105
const KARAIKAL = 106
const VANDAVASI = 107
const TIRUCHIRAPPALLI = 108
const CALICUT = 109
const MANGALORE = 110
const MALABAR_COAST = 111

// BIZARRO SPACES
const NAVY_BOX = 0
const AWARD_EUROPE = 1
const AWARD_NORTH_AMERICA = 2
const AWARD_CARIBBEAN = 3
const AWARD_INDIA = 4

const ATLANTIC_DOMINANCE = 96 // Index to end of bonus war tiles list
const BYNG = 98


// ACTION_SUBPHASES
const BEFORE_PICKING_TILE           = 0
const PICKED_TILE_OPTION_TO_PASS    = 1
const OPTION_TO_PLAY_EVENT          = 2
const DURING_EVENT                  = 3
const BEFORE_SPENDING_ACTION_POINTS = 4
const ACTION_POINTS_ALREADY_SPENT   = 5
const NOT_ACTION_PHASE              = 6

// Generic persistent bitflags
const NUM_BITFLAGS                = 32
const FLAG_MILITARY_UPGRADE       = 0
const BUYING_WAR_TILE             = 1
const JACOBITES_ALWAYS            = 2
const JACOBITES_NEVER             = 3
const JACOBITE_DEFEAT             = 4
const ACTION_MINOR                = 5
const ELIGIBLE_MINOR              = 6
const ACTION_COST_ADJUSTED        = 7
const MINISTRY_ALREADY_REVEALED   = 8
const MINISTRY_OPTIONAL           = 9
const MINISTRY_PROMPT_TO_EXHAUST  = 10
const PAID_ACTION_COST            = 11
const USED_REQUIRED_ADVANTAGE     = 12
const MINISTRY_MANUALLY_CLICKED   = 13
const CARD_HAS_BONUS              = 14
const QUALIFIES_FOR_BONUS         = 15
const ADVANTAGE_ALREADY_EXHAUSTED = 16
const NAVY_FROM_NAVY_BOX          = 17
const NAVY_DISPLACE               = 18
const DID_THE_BRIG                = 19
const JACOBITE_VICTORY_WSS        = 20
const JACOBITE_VICTORY_WAS        = 21
const ADVANTAGE_OPTIONAL          = 22
const LEAVE_LOG_BOX_OPEN          = 23
const STARTED_MINISTRY_BOX        = 24
const ELIGIBLE_FOR_HUGUENOTS      = 25
const MINISTRY_JUST_REVEALED      = 26
const LAST_EVENT_BY_BRITAIN       = 27
const DONT_EXHAUST_ADVANTAGE      = 28
const MUST_PLACE_IN_NORTH_AMERICA = 29
const SKIPPED_EVENT               = 30
const ACTION_ENTIRELY_MINOR       = 31


// TRANSIENT BITFLAGS FROM EVENTS, MINISTERS, ADVANTAGES
const NUM_TRANSIENT_BITFLAGS = 32
const TRANSIENT_SOUTH_SEA_SQUADRON_DISCOUNT = 0
const TRANSIENT_JACOBITES_SCORE_VP          = 1 // Score VP
const TRANSIENT_JACOBITES_SHIFT_SPACES      = 2 // Shift spaces with military action points
const TRANSIENT_CHARLES_HANBURY_WILLIAMS    = 3
const TRANSIENT_PACTE_DE_FAMILLE            = 4
const TRANSIENT_MUST_BE_ENTIRELY_IN_EUROPE  = 5
const TRANSIENT_NORTH_AMERICAN_TRADE        = 6
const TRANSIENT_FIRST_DEBT_TAKEN            = 7
const TRANSIENT_COOK                        = 8
const TRANSIENT_BANK_OF_ENGLAND             = 9
const TRANSIENT_BURKE_FOR_DISCOUNT          = 10
const TRANSIENT_EVENT_MADE_DIPLO            = 11
const TRANSIENT_TILE_MADE_DIPLO             = 12
const TRANSIENT_EVENT_MADE_ECON             = 13
const TRANSIENT_BOUGHT_EVENT                = 14
const TRANSIENT_TILE_MADE_ECON              = 15


// Data mining

const TIE = 2

var D = { }
var player_list = []

function elo_k(n)
{
	return 30
}

function elo_ev(a, players)
{
	// Generalized formula for multiple players.
	// https://arxiv.org/pdf/2104.05422.pdf
	let sum = 0
	for (let p of players)
		sum += Math.pow(10, p.rating / 400)
	return Math.pow(10, a.rating / 400) / sum
}

function elo_change(a, players, s)
{
	return Math.round(elo_k(a.count) * (s - elo_ev(a, players)))
}


function elo_compute(players, G)
{
	let winner = (G.result === "France") ? FRANCE : (G.result === "Britain") ? BRITAIN: -1
	if (winner < 0) return

	let game_players = []
	for (let p of players) {
		let index = get_player_index(p.user_id)

		let player = player_list[index]
		player.role = p.role
		game_players.push(player)
	}

	for (let p of game_players) {
		let who = (p.role === "France") ? FRANCE : (p.role === "Britain") ? BRITAIN : -1
		if (who < 0) continue
		let record = get_player_index(p.user_id)

		let change = elo_change(p, game_players, (who === winner) ? 1 : 0)
		player_list[record].rating += change
	}
}


function get_player_index(id)
{
	for (let p = 0; p < player_list.length; p++) {
		if (player_list[p].user_id !== id) continue
		return p
	}

	let player = { }
	player.user_id = id
	player.rating = 1500
	player_list.push(player)
	return player_list.length - 1
}


function is_digit(c) {
	return (c >= '0') && (c <= '9')
}



function data_mining_run(select_games_of_title, select_players_of_game, description = "ALL GAMES", min_elo = -1, max_elo = 9999, only_handicap = false)
{
	D.report_lines = []
	report_top()

	D.games             = 0 // Total games scanned (if they lasted until at least the end of turn 1)
	D.games_turn_1      = 0 // Total games discarded because they ended before the end of turn 1
	D.final_scoring     = 0 // Games that reached final scoring
	D.tie_breaker       = 0 // Games decided by tie-breaker
	D.final_tie_breaker = 0 // Games decided by final-tie breaker

	D.turn_reached    = [ 0, 0, 0, 0, 0, 0, 0 ] // Times a turn was reached

	D.first_player     = [ [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0] ]  // First player by turn
	D.initiative       = [ [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0] ]  // Initiative holder by turn
	D.init_goes_first  = [ [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0] ]  // Initiative holder chose to go first
	D.init_goes_second = [ [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0] ]  // Initiative holder chose to go second

	D.turn_wins        = [ [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],  [0, 0], [0, 0], [0, 0], [0, 0]]

	D.investment_picked = [ ] // How many times investment tile picked by each player  D.investment_picked[i][who]

	D.ministry_picked = [ [], [], [] ] // ministry_picked[era][m] - number of times picked in

	D.advantage_used = []	// How many times advantage used by each player  D.advantage_used[a][who]

	D.final_scoring = 0
	D.final_scoring_wins = [ 0, 0 ]
	D.tie_breaker_wins = [ 0, 0 ]
	D.tie_breaker_final_wins = 0

	D.vp_scored = [ 0, 0 ]
	D.vp_scored_era = [ [0,0], [0,0], [0,0] ]
	D.vp_prestige = [ 0, 0 ]
	D.vp_prestige_era = [ [0,0], [0,0], [0,0] ]
	D.prestige_ties = 0
	D.prestige_wins = [ 0, 0 ]
	D.prestige_wins_era = [ [0,0], [0,0], [0,0] ]
	D.prestige_ties_era = [ 0, 0, 0 ]
	D.trp_gained = [ 0, 0 ]

	D.conquest_point_spent = [] // By space
	D.vp_region = []
	D.region_wins = []
	D.region_wins_era = []
	D.region_ties = [ 0, 0, 0, 0 ]
	D.region_ties_era = [ [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ] ]
	D.demand_ties = [ 0, 0, 0, 0, 0, 0 ]
	D.demand_ties_era = [ [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ], [ 0, 0, 0 ] ]
	D.vp_demand = []
	D.demand_wins = []
	D.demand_wins_era = []

	D.autovictories = 0
	D.autovictory = [ 0, 0 ]
	D.vp_autovictories = 0
	D.vp_autovictory = [0, 0]
	D.war_autovictories = 0
	D.war_autovictory = [0, 0]
	D.peace_autovictories = 0
	D.peace_autovictory = [0, 0]

	D.final_prestige_wins = [0, 0, 0]
	D.final_debt_wins = [0, 0, 0]
	D.final_debt_vp = [ 0, 0, 0 ]
	D.final_demand_wins = [ [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0] ]
	D.final_territory_wins = [ 0, 0, 0 ]
	D.final_territory_spaces = []

	for (let s = 0; s < NUM_SPACES; s++) {
		D.final_territory_spaces[s] = 0
	}

	for (let m = 0; m < NUM_MINISTRY_CARDS + 1; m++) {
		for (let era = 0; era < 3; era++) {
			D.ministry_picked[era][m] = 0
		}
	}

	for (let i = 0; i < NUM_INVESTMENT_TILES; i++) {
		D.investment_picked[i] = [0, 0]
	}

	D.event_played = []
	for (let e = 0; e < NUM_EVENT_CARDS + 1; e++) {
		D.event_played[e] = { }
		D.event_played[e].anyone = 0
		D.event_played[e].by = [ 0, 0 ]
		D.event_played[e].with_bonus = 0
		D.event_played[e].by_with_bonus = [ 0, 0 ]
	}

	for (let a = 0; a < NUM_ADVANTAGES; a++) {
		D.advantage_used[a] = [ 0, 0 ]
	}


	D.region_wins_era = []
	for (let r = 0; r < NUM_REGIONS; r++) {
		D.region_wins[r] = [0, 0]
		D.region_wins_era[r] = [ [0,0], [0,0], [0,0] ]
		D.vp_region[r] = [0, 0]
	}

	for (let d = 0; d < NUM_DEMANDS; d++) {
		D.demand_wins[d] = [0, 0]
		D.demand_wins_era[d] = [ [0,0], [0,0], [0,0] ]
		D.vp_demand[d] = [0, 0]
	}

	D.resigned = 0
	D.resigned_wins = [0, 0]

	D.wars = [ 0, 0, 0, 0, 0 ]
	D.theaters = [ ]
	D.theaters_won = [ ]
	D.theater_level = [ ]

	for (let w = 0; w <= 4; w++) {
		D.theaters[w] = []
		D.theaters_won[w] = []
		D.theater_level[w] = []
		for (let t = 0; t <= 4; t++) {
			D.theaters[w][t] = 0
			D.theaters_won[w][t] = [0, 0, 0]
			D.theater_level[w][t] = []
			for (let v = 0; v <= 4; v++) {
				D.theater_level[w][t][v] = [ 0, 0 ]
			}
		}
	}


	report_break()
	report_break()
	report("<h1>IMPERIAL STRUGGLE - STATS</h1>")
	report_break()
	report_header("PARAMETERS")
	report("Description: " + description)
	if (min_elo >= 0) report ("Minimum Elo: " + min_elo)
	if (max_elo < 9999) report ("Maximum Elo: " + max_elo)
	if (only_handicap) report ("Only games w/ British handicap >= 2")
	report ("Base Dataset: " + total_dataset + " Ranked Games (filtered by above)")

	let player_checkoff = []
	for (let p = 0; p < player_list.length; p++) {
		player_checkoff[p] = false
	}
	let uniques = 0

	for (var game of select_games_of_title.iterate("imperial-struggle")) {
		var G = JSON.parse(game.state)
		let players = select_players_of_game.all(game.game_id)

		let valid = true
		for (let p of players) {
			let index = get_player_index(p.user_id)
			let rating = player_list[index].rating

			if ((min_elo >= 0) && (rating < min_elo)) valid = false
			if ((max_elo < 9999) && (rating > max_elo)) valid = false

			if (only_handicap) {
				if (G.handicap_side !== BRITAIN) valid = false
				if (G.bid < 2) valid = false
			}

			if (!valid) break
		}

		if (valid) {
			for (let p of players) {
				let index = get_player_index(p.user_id)
				if (!player_checkoff[index]) {
					player_checkoff[index]++
					uniques++
				}
			}

			data_mine(G, G.log)
		}
	}

	report ("Total unique players: " + uniques)

	report_break()

	data_mine_victory()
	data_mine_length()
	data_mine_ministries(FRANCE)
	data_mine_ministries(BRITAIN)
	data_mine_events()
	data_mine_turns()
	data_mine_investments()
	data_mine_advantages()
	data_mine_scoring()
	data_mine_wars()

	report_bottom()
}


function data_mine_length()
{
	report_break()
	report_header ("LENGTH OF GAME")

	for (let tindex = 0; tindex < data.turns.length; tindex++) {
		let turn = data.turns[tindex]
		let t = turn.id
		if (!turn.war) {
			report (indent(1) + percent(D.turn_reached[t] / D.games) + " reached Turn " + t + " (" + D.turn_reached[t] + ")")
		} else {
			let war = 0
			if (turn.id === "WSS") war = 1
			if (turn.id === "WAS") war = 2
			if (turn.id === "7YW") war = 3
			if (turn.id === "AWI") war = 4
			if (war > 0) {
				report(indent(1) + percent(D.wars[war]/D.games) + " reached " + data.wars[war].name + " (" + D.wars[war] + ")")
			}
		}

		let total = D.turn_wins[tindex][FRANCE] + D.turn_wins[tindex][BRITAIN]
		if (total === 0) total = 1
		for (let who = FRANCE; who <= BRITAIN; who++) {
			report(indent(2) + percent(D.turn_wins[tindex][who] / total) + " " + data.flags[who].adj + " victories")
		}
	}

	let total = 0
	for (let who = FRANCE; who <= BRITAIN; who++) {
		total += D.final_scoring_wins[who] + D.resigned_wins[who] + D.autovictory[who]
	}
	report(indent(1) + percent(D.final_scoring / total) + " reached Final Scoring (" + D.final_scoring + ")")

	total = D.final_scoring_wins[FRANCE] + D.final_scoring_wins[BRITAIN]
	if (total === 0) total = 1
	for (let who = FRANCE; who <= BRITAIN; who++) {
		report (indent(2) + percent(D.final_scoring_wins[who] /total) + " " + data.flags[who].adj + " victories")
	}
}


function data_mine_wars()
{
	let wins = [ 0, 0, 0 ]
	let total = 0
	for (let w = 1; w < 4; w++) {
		for (let t = 1; t <= data.wars[w].theaters; t++) {
			for (let who = FRANCE; who <= TIE; who++) {
				wins[who] += D.theaters_won[w][t][who]
				total += D.theaters_won[w][t][who]
			}
		}
	}

	report_break()
	report_header("WARS")
	for (let who = FRANCE; who <= BRITAIN; who++) {
		report(indent(1) + percent(wins[who]/total) + " " + data.flags[who].adj + " Theater victories (" + wins[who] + ")")
	}
	report(indent(1) + percent(wins[TIE]/total) + " Theater ties (" + wins[TIE] + ")")

	for (let war = 1; war <= 4; war++) {
		report_break()
		report_header(data.wars[war].name.toUpperCase() + ": " + D.wars[war] + " (" + percent(D.wars[war]/D.games) + " of games)")

		let wins = [ 0, 0, 0 ]
		let total = 0
		for (let t = 1; t <= data.wars[war].theaters; t++) {
			for (let who = FRANCE; who <= TIE; who++) {
				wins[who] += D.theaters_won[war][t][who]
				total += D.theaters_won[war][t][who]
			}
		}

		for (let who = FRANCE; who <= BRITAIN; who++) {
			report(indent(1) + percent(wins[who]/total) + " " + data.flags[who].adj + " Theater victories (" + wins[who] + ")")
		}
		report(indent(2) + percent(wins[TIE]/total) + " Theater ties (" + wins[TIE] + ")")

		for (let t = 1; t <= data.wars[war].theaters; t++) {
			report_break()
			report_header (indent(2) + "THEATER " + t + ": " + data.wars[war].theater_names[t].toUpperCase())

			let wins = [ 0, 0, 0 ]
			let total = 0
			for (let who = FRANCE; who <= TIE; who++) {
				wins[who] += D.theaters_won[war][t][who]
				total += D.theaters_won[war][t][who]
			}
			for (let who = FRANCE; who <= BRITAIN; who++) {
				report(indent(3) + percent(wins[who]/total) + " " + data.flags[who].adj + " victories (" + wins[who] + ")")
				for (let tier = 0; tier < 3; tier++) {
					report(indent(4) + percent(D.theater_level[war][t][tier][who] / wins[who]) + " Level " + (tier + 1) + " victories (" + D.theater_level[war][t][tier][who] + ")")
				}
			}
			report(indent(3) + percent(wins[TIE]/total) + " ties (" + wins[TIE] + ")")
		}
	}
}


function data_mine_victory() {
	report_header("DATA SET")
	report(indent(1) + (D.games + D.games_turn_1) + " Total Games Played")
	report(indent(1) + D.games_turn_1 + " Ended before end of turn 1 (data not used)")
	report(indent(1) + D.games + " Lasted until at least end of turn 1 (data used)")
	report_break()
	report_header("VICTORY")

	let total = 0
	for (let who = FRANCE; who <= BRITAIN; who++) {
		total += D.final_scoring_wins[who] + D.resigned_wins[who] + D.autovictory[who]
	}

	for (let who = FRANCE; who <= BRITAIN; who++) {
		report(indent(1) + percent((D.final_scoring_wins[who] + D.resigned_wins[who] + D.autovictory[who]) / total) + " " + data.flags[who].adj + " victories (" + (D.final_scoring_wins[who] + D.resigned_wins[who] + D.autovictory[who]) + ")")
	}

	report_break()
	report(indent(1) + percent(D.autovictories / total) + " Autovictories (" + D.autovictories + ")")
	report(indent(2) + percent(D.vp_autovictories / total) + " Autovictories VP (" + D.vp_autovictories + ", " + percent(D.vp_autovictories / D.autovictories) + " of autovictories)")
	report(indent(2) + percent(D.peace_autovictories / total) + " Autovictories Awards (" + D.peace_autovictories + ", " + percent(D.peace_autovictories / D.autovictories) + " of autovictories)")
	report(indent(2) + percent(D.war_autovictories / total) + " Autovictories Wars (" + D.war_autovictories + ", " + percent(D.war_autovictories / D.autovictories) + " of autovictories)")
	report(indent(1) + percent(D.final_scoring / total) + " Reached Final Scoring (" + D.final_scoring + ")")
	report(indent(1) + percent(D.tie_breaker / total) + " Decided By Tie Breaker (" + D.tie_breaker + ")")
	report(indent(1) + percent(D.final_tie_breaker / total) + " Decided By FINAL Tie Breaker (" + D.final_tie_breaker + ")")
	report(indent(1) + percent(D.resigned / total) + " Opponent Resigned (" + D.resigned + ")")

	for (let who = FRANCE; who <= BRITAIN; who++) {
		report_break()
		total = D.final_scoring_wins[who] + D.resigned_wins[who] + D.autovictory[who]
		report_subheader(data.flags[who].adj.toUpperCase() + " VICTORIES")
		report(indent(1) + percent(D.autovictory[who] / total) + " Autovictories (" + D.autovictory[who] + ")")
		report(indent(2) + percent(D.vp_autovictory[who] / total) + " Autovictories VP (" + D.vp_autovictory[who] + ", " + percent(D.vp_autovictory[who] / D.autovictory[who]) + " of autovictories)")
		report(indent(2) + percent(D.peace_autovictory[who] / total) + " Autovictories Awards (" + D.peace_autovictory[who] + ", " + percent(D.peace_autovictory[who] / D.autovictory[who]) + " of autovictories)")
		report(indent(2) + percent(D.war_autovictory[who] / total) + " Autovictories Wars (" + D.war_autovictory[who] + ", " + percent(D.war_autovictory[who] / D.autovictory[who]) + " of autovictories)")
		report(indent(1) + percent(D.final_scoring_wins[who] / total) + " Reached Final Scoring (" + D.final_scoring_wins[who] + ")")
		report(indent(1) + percent(D.tie_breaker_wins[who] / total) + " Decided By Tie Breaker (" + D.tie_breaker_wins[who] + ")")
		if (who === BRITAIN) {
			report(indent(1) + percent((who === BRITAIN) ? (D.final_tie_breaker / total) : 0) + " Decided By FINAL Tie Breaker (" + ((who === BRITAIN) ? D.final_tie_breaker : 0) + ")")
		}
		report(indent(1) + percent(D.resigned_wins[who] / total) + " Opponent Resigned (" + D.resigned_wins[who] + ")")
	}
}

function say_eras(array, front = "")
{
	return (" (" + front + "Era 1: " + array[0] + ", Era 2: " + array[1] + ", Era 3: " + array[2] + ")")
}


function say_eras_percent(array, era_total, front = "")
{
	return (" (" + front + "Era 1: " + percent(array[0]/era_total[0]) + ", Era 2: " + percent(array[1]/era_total[1]) + ", Era 3: " + percent(array[2]/era_total[2]) + ")")
}

function say_eras_who(array, who, front = "")
{
	return (" (" + front + "Era 1: " + array[0][who] + ", Era 2: " + array[1][who] + ", Era 3: " + array[2][who] + ")")
}

function say_eras_who_percent(array, era_total, who, front = "")
{
	return (" (" + front + "Era 1: " + percent(array[0][who] / era_total[0]) + ", Era 2: " + percent(array[1][who] / era_total[1]) + ", Era 3: " + percent(array[2][who]/era_total[2]) + ")")
}


function data_mine_scoring()
{
	report_break()
	report_header("SCORING")
	report(indent(1) + D.vp_scored[FRANCE] + " VP total scored by France (Era 1: " + D.vp_scored_era[0][FRANCE] + ", Era 2: " + D.vp_scored_era[1][FRANCE] + ", Era 3: " + D.vp_scored_era[2][FRANCE] + ")")
	report(indent(1) + D.vp_scored[BRITAIN] + " VP total scored by Britain (Era 1: " + D.vp_scored_era[0][BRITAIN] + ", Era 2: " + D.vp_scored_era[1][BRITAIN] + ", Era 3: " + D.vp_scored_era[2][BRITAIN] + ")")
	report_break()

	let total = D.prestige_wins[FRANCE] + D.prestige_wins[BRITAIN] + D.prestige_ties
	let era_total     = [ ]
	for (let era = 0; era <= 2; era++) {
		era_total[era] = D.prestige_wins_era[era][FRANCE] + D.prestige_wins_era[era][BRITAIN] + D.prestige_ties_era[era]
	}
	report_header(indent(1) + "PRESTIGE Scoring")
	for (let who = FRANCE; who <= BRITAIN; who++) {
		report(indent(2) + percent(D.prestige_wins[who] / total) + " Prestige wins for " + data.flags[who].name + say_eras_who_percent(D.prestige_wins_era, era_total, who))
	}
	report(indent(2) + percent(D.prestige_ties/total) + " Ties " + say_eras_percent(D.prestige_ties_era, era_total))

	for (let r = 0; r < NUM_REGIONS; r++) {
		report_break()
		report_header (indent(1) + data.regions[r].name.toUpperCase() + " Scoring")
		let total = D.region_wins[r][FRANCE] + D.region_wins[r][BRITAIN] + D.region_ties[r]
		let era_total     = [ ]
		for (let era = 0; era <= 2; era++) {
			era_total[era] = D.region_wins_era[r][era][FRANCE] + D.region_wins_era[r][era][BRITAIN] + D.region_ties_era[r][era]
		}
		for (let who = FRANCE; who <= BRITAIN; who++) {
			report (indent(2) + percent(D.region_wins[r][who] / total) + " wins for " + data.flags[who].name + say_eras_who_percent(D.region_wins_era[r], era_total, who))
		}
		report (indent(2) + percent(D.region_ties[r]/total) + " ties " + say_eras_percent(D.region_ties_era[r], era_total))
	}

	for (let d = 0; d < NUM_DEMANDS; d++) {
		report_break()
		report_header (indent(1) + data.demands[d].name.toUpperCase() + " Scoring")
		let total = D.demand_wins[d][FRANCE] + D.demand_wins[d][BRITAIN] + D.demand_ties[d]
		let era_total     = [ ]
		for (let era = 0; era <= 2; era++) {
			era_total[era] = D.demand_wins_era[d][era][FRANCE] + D.demand_wins_era[d][era][BRITAIN] + D.demand_ties_era[d][era]
		}
		for (let who = FRANCE; who <= BRITAIN; who++) {
			report(indent(2) + percent(D.demand_wins[d][who]/total) + " wins for " + data.flags[who].name + say_eras_who_percent(D.demand_wins_era[d], era_total, who, "Wins "))
		}
		report (indent(2) + percent(D.demand_ties[d]/total) + " ties " + say_eras_percent(D.demand_ties_era[d], era_total))
	}
}


function data_mine_advantages()
{
	report_break()
	report_header("ADVANTAGES (total times activated)")
	for (let a = 0; a < NUM_ADVANTAGES; a++) {
		let f = D.advantage_used[a][FRANCE]
		let b = D.advantage_used[a][BRITAIN]
		report(indent(1) + (f + b) + " (" + f + " France, " + b + " Britain): " + data.advantages[a].name)
	}
}


function data_mine_investments()
{
	report_break()
	report_header("INVESTMENT TILES (number of times picked)")
	for (let i = 0; i < NUM_INVESTMENT_TILES; i++) {
		let f = D.investment_picked[i][FRANCE]
		let b = D.investment_picked[i][BRITAIN]
		if (data.investments[i].majorval === 4) {
			i++ // whee!!!!
			f += D.investment_picked[i][FRANCE]
			b += D.investment_picked[i][BRITAIN]
		}
		report (indent(1) + (f + b) + " " + ((data.investments[i].majorval === 4) ? "(2 tiles)" : "(1 tile)" ) + ": " + data.investments[i].name + "  (" + f + " France, " + b + " Britain)" )
	}
}

function data_mine_turns()
{
	D.initiative[1][FRANCE] = D.games
	D.initiative[1][BRITAIN] = 0


	report_break()
	report_header("TURNS & INITIATIVE")
	for (let t = 1; t <= 6; t++) {
		report (indent(1) + "Turn " + t + ": ")
		report (indent(2) + "Reached in " + percent(D.turn_reached[t] / D.games) + " of games (" + D.turn_reached[t] + ")")
		let itotal = D.initiative[t][FRANCE] + D.initiative[t][BRITAIN]
		let ftotal = D.first_player[t][FRANCE] + D.first_player[t][BRITAIN]
		report (indent(2) + "Initiative: " + percent(D.initiative[t][FRANCE] / itotal) + " France, " + percent(D.initiative[t][BRITAIN] / itotal) + " Britain")
		report (indent(2) + "First Player: " + percent(D.first_player[t][FRANCE] / ftotal) + " France, " + percent(D.first_player[t][BRITAIN] / ftotal) + " Britain")
		report (indent(2) + "France w/ Initiative: " + percent(D.init_goes_first[t][FRANCE] / (D.init_goes_first[t][FRANCE] + D.init_goes_second[t][FRANCE])) + " Goes First, " + percent(D.init_goes_second[t][FRANCE] / (D.init_goes_first[t][FRANCE] + D.init_goes_second[t][FRANCE])) + " Goes Last" )
		if (t !== 1) {
			report(indent(2) + "Britain w/ Initiative: " + percent(D.init_goes_first[t][BRITAIN] / (D.init_goes_first[t][BRITAIN] + D.init_goes_second[t][BRITAIN])) + " Goes First, " + percent(D.init_goes_second[t][BRITAIN] / (D.init_goes_first[t][BRITAIN] + D.init_goes_second[t][BRITAIN])) + " Goes Last")
		}
	}

	let init = 0
	let first = 0
	let go_first = 0
	let go_second = 0
	for (let who = FRANCE; who <= BRITAIN; who++) {
		D.initiative[7][who] = 0
		D.first_player[7][who] = 0
		D.init_goes_first[7][who] = 0
		D.init_goes_second[7][who] = 0
		for (let t = 1; t <= 6; t++) {
			D.initiative[7][who] += D.initiative[t][who]
			D.first_player[7][who] += D.first_player[t][who]
			D.init_goes_first[7][who] += D.init_goes_first[t][who]
			D.init_goes_second[7][who] += D.init_goes_second[t][who]
			init += D.initiative[t][who]
			first += D.first_player[t][who]
			go_first += D.init_goes_first[t][who]
			go_second += D.init_goes_second[t][who]
		}
	}

	report (indent(1) + "Overall")
	report (indent(2) + "Initiative: " + percent(D.initiative[7][FRANCE] / (D.initiative[7][FRANCE] + D.initiative[7][BRITAIN])) + " France, " + percent(D.initiative[7][BRITAIN] / (D.initiative[7][FRANCE] + D.initiative[7][BRITAIN])) + " Britain")
	report (indent(2) + "Go First: " + percent(D.first_player[7][FRANCE] / (D.first_player[7][FRANCE] + D.first_player[7][BRITAIN])) + " France, " + percent(D.first_player[7][BRITAIN] / (D.first_player[7][FRANCE] + D.first_player[7][BRITAIN])) + " Britain")
	report (indent(2) + "Initiative player chose to go first " + percent(go_first / (go_first + go_second)) + " of the time overall.")
}



function data_mine_ministries(who)
{
	report_break()
	report_header (data.flags[who].adj.toUpperCase() + " MINISTRIES" + ((who === FRANCE) ? " (NOT including Jacobites from winning WAS/4)" : ""))
	for (let era = 0; era <= 2; era++) {
		report (indent(1) + "Era " + (era + 1))
		let total = D.turn_reached[era*2 + 1]

		for (let m = 1; m <= NUM_MINISTRY_CARDS; m++) {
			if (data.ministries[m].side !== who) continue
			if (!D.ministry_picked[era][m]) continue
			let percent = Math.round(((D.ministry_picked[era][m] * 100)) / total)
			let msg = indent(2) + percent + "% " + data.ministries[m].name + " (" + D.ministry_picked[era][m] + ") "
			report (msg)
		}
	}
}


function percent(v)
{
	return Math.round(v * 100) + "%"
}

function data_mine_events()
{
	report_break()
	report_header ("EVENT CARDS (popularity of events by era)")
	for (let era = 0; era <= 2; era++) {
		if (era) report_break()
		report(indent(1) + "Era " + (era + 1))
		let events = []
		for (let e = 1; e <= NUM_EVENT_CARDS; e++) {
			if (data.cards[e].era !== era) continue
			let event = {}
			event.id = e
			event.played = D.event_played[e].anyone
			events.push(event)
		}

		events.sort((a, b) =>
		{
			return b.played - a.played
		})



		for (const event of events) {
			let e = event.id
		    //for (let e = 1; e <= NUM_EVENT_CARDS; e++) {
			if (data.cards[e].era !== era) continue
			let subset = D.games
			let limit = 1
			let msg = ")"
			let percent_string = percent(D.event_played[e].anyone / D.games)

			if (era === 1) {
				limit = 3
				subset = D.turn_reached[3]
				msg = ", " + percent(D.event_played[e].anyone / subset) + " of games reaching turn " + limit + ")"
				percent_string = percent(D.event_played[e].anyone / subset)
			} else if (era === 2) {
				limit = 5
				subset = D.turn_reached[5]
				msg = ", " + percent(D.event_played[e].anyone / subset) + " of games reaching turn " + limit + ")"
				percent_string = percent(D.event_played[e].anyone / subset)
			}

			report (indent(2) + percent_string + " " + data.cards[e].name + "   " + D.event_played[e].anyone + " plays (" + percent(D.event_played[e].anyone / D.games) + " of all games" + msg)
			report (indent(3) + D.event_played[e].by[FRANCE] + " France, " + percent(D.event_played[e].by_with_bonus[FRANCE] / D.event_played[e].by[FRANCE]) + " with bonus.")
			report (indent(3) + D.event_played[e].by[BRITAIN] + " Britain, " + percent(D.event_played[e].by_with_bonus[BRITAIN] / D.event_played[e].by[BRITAIN]) + " with bonus.")
		}
	}

}


function score(who, p, e = -1)
{
	D.vp_scored[who] += p
	if (e >= 0) D.vp_scored_era[e][who] += p
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


function data_mine(G, log)
{
	let turn = 0
	let turn_index = 0
	let awards = [ 0, 0, 0, 0 ]
	let demands
	let initiative = FRANCE
	let first
	let era = 0
	let final_scoring = false
	let war = 0

	let lasted_through_turn_1 = false
	for (let idx = 0; idx < log.length; idx++) {
		let l = log[idx]

		if (l.startsWith("=Scoring Phase")) {
			lasted_through_turn_1 = true
			break
		}
	}

	// Throw away (mostly) games that ended before the end of turn 1
	if (!lasted_through_turn_1) {
		D.games_turn_1++
		return
	}

	D.games++

	for (let idx = 0; idx < log.length; idx++) {
		let l = log[idx]
		let ll

		if (l.startsWith("#TURN ")) {
			turn = l[6] - '0'
			D.turn_reached[turn]++

			switch (turn) {
				case 1: turn_index = PEACE_TURN_1; break
				case 2: turn_index = PEACE_TURN_2; break
				case 3: turn_index = PEACE_TURN_3; break
				case 4: turn_index = PEACE_TURN_4; break
				case 5: turn_index = PEACE_TURN_5; break
				case 6: turn_index = PEACE_TURN_6; break
			}

			if (turn <= 2) {
				era = 0
			} else if (turn <= 4) {
				era = 1
			} else {
				era = 2
			}
		}

		if (l.startsWith("=Award Phase")) {
			ll = log[idx + 1]
			for (let region = 0; region < NUM_REGIONS; region++) {
				let a = ll[2 + region] - '0'
				awards[region] = a
			}
		}

		if (l.startsWith("=Global Demand Phase")) {
			ll = log[idx + 1]
			demands = []
			for (let i2 = 0; i2 < 3; i2++) {
				let d = ll[2 + i2] - '0'
				demands.push(d)
			}
		}

		if (l.startsWith("First player")) {
			first = (l.includes("France")) ? FRANCE : BRITAIN

			D.first_player[turn][first]++
			if (first === initiative) {
				D.init_goes_first[turn][initiative]++
			} else {
				D.init_goes_second[turn][initiative]++
			}
		}

		if (l.startsWith("=Initiative Phase")) {
			ll = log[idx + 1]
			initiative = ll.includes("France") ? FRANCE : BRITAIN
			D.initiative[turn][initiative]++
		}

		// Ministry
		if (l.includes("Ministry Revealed")) {
			ll = log[idx - 1]
			let matches = ll.match(/\d+$/)
			if (matches) {
				let m = parseInt(matches[0])
				D.ministry_picked[era][m]++
			}
		}

		// Investment tile
		//if (l.slice(1,3) === "i")
		if (l.startsWith("[iX0")) {
			ll = log[idx - 1]
			let who = ll.includes("France") ? FRANCE : BRITAIN
			let inv = ((l[4] - '0') * 10) + (l[5] - '0')
			D.investment_picked[inv][who]++
		}

		// Event played
		if (l.startsWith("{02EVENT") || l.startsWith("{12EVENT")) {
			let bonus = l.includes("with Bonus")
			let e = l[12] - '0'
			if (is_digit(l[13])) {
				e = e * 10 + (l[13] - '0')
			}

			let who = (l[1] === '0') ? FRANCE : BRITAIN

			D.event_played[e].anyone++
			if (bonus) D.event_played[e].with_bonus++
			D.event_played[e].by[who]++
			if (bonus) D.event_played[e].by_with_bonus[who]++
		}

		if (l.includes("ADVANTAGE Used")) {
			let who = (l[1] === '0') ? FRANCE : BRITAIN
			let matches = l.match(/\d+$/)
			if (matches) {
				let a = parseInt(matches[0])
				D.advantage_used[a][who]++
			}
		}

		if (l.includes("Britain gained 1 VP")) score(BRITAIN, 1, era)
		if (l.includes("Britain gained 2 VP")) score(BRITAIN, 2, era)
		if (l.includes("Britain gained 3 VP")) score(BRITAIN, 3, era)
		if (l.includes("Britain gained 4 VP")) score(BRITAIN, 4, era)
		if (l.includes("Britain gained 5 VP")) score(BRITAIN, 5, era)
		if (l.includes("France lost 1 VP")) score(BRITAIN, 1, era)
		if (l.includes("France lost 2 VP")) score(BRITAIN, 2, era)
		if (l.includes("France lost 3 VP")) score(BRITAIN, 3, era)
		if (l.includes("France lost 4 VP")) score(BRITAIN, 4, era)

		if (l.includes("France gained 1 VP")) score(FRANCE, 1, era)
		if (l.includes("France gained 2 VP")) score(FRANCE, 2, era)
		if (l.includes("France gained 3 VP")) score(FRANCE, 3, era)
		if (l.includes("France gained 4 VP")) score(FRANCE, 4, era)
		if (l.includes("France gained 5 VP")) score(FRANCE, 5, era)
		if (l.includes("Britain lost 1 VP")) score(FRANCE, 1, era)
		if (l.includes("Britain lost 2 VP")) score(FRANCE, 2, era)
		if (l.includes("Britain lost 3 VP")) score(FRANCE, 3, era)
		if (l.includes("Britain lost 4 VP")) score(FRANCE, 4, era)

		if (l.includes("Final Scoring")) {
			if (!final_scoring) {
				final_scoring = true
				D.final_scoring++
			}
		}

		if (!final_scoring) {
			if (l.includes("Scoring: PRESTIGE")) {
				ll = log[idx + 1]
				if (ll.includes("gained")) {
					let who = ll.includes("France") ? FRANCE : BRITAIN
					D.prestige_wins[who]++
					D.prestige_wins_era[era][who]++
				} else {
					D.prestige_ties++
					D.prestige_ties_era[era]++
				}
			}

			for (let region = 0; region < NUM_REGIONS; region++) {
				let caps = data.regions[region].name.toUpperCase()
				if (l.includes("Scoring: " + caps)) {
					ll = log[idx + 1]
					if (ll.includes("gained") && ll.includes("VP")) {
						let who = ll.includes("France") ? FRANCE : BRITAIN
						D.region_wins[region][who]++
						D.region_wins_era[region][era][who]++

						let matches = ll.match(/\d+/);
						if (matches) {
							let vp = parseInt(matches[0])
							D.vp_region[region][who] += vp
						}
					} else {
						D.region_ties[region]++
						D.region_ties_era[region][era]++
					}
				}
			}

			for (let d = 0; d < NUM_DEMANDS; d++) {
				let caps = data.demands[d].name.toUpperCase()
				if (l.includes("Scoring: " + caps)) {
					ll = log[idx + 1]
					if (ll.includes("gained") && ll.includes("VP")) {
						let who = ll.includes("France") ? FRANCE : BRITAIN
						D.demand_wins[d][who]++
						D.demand_wins_era[d][era][who]++

						let matches = ll.match(/\d+/);
						if (matches) {
							let vp = parseInt(matches[0])
							D.vp_demand[d][who] += vp
						}
					} else {
						D.demand_ties[d]++
						D.demand_ties_era[d][era]++
					}
				}
			}
		} else {
			if (l.includes("Final Scoring: PRESTIGE")) {
				let who = l.includes("France") ? FRANCE : l.includes("Britain") ? BRITAIN : TIE
				D.final_prestige_wins[who]++
			}

			if (l.includes("Final Scoring: DEBT")) {
				let who = l.includes("France") ? FRANCE : l.includes("Britain") ? BRITAIN : TIE
				D.final_debt_wins[who]++
				if (who !== TIE) {
					let matches = l.match(/\d+/)
					if (matches) {
						let vp = parseInt(matches[0])
						D.final_debt_vp[who] += vp
					}
				}
			}

			for (let d = 0; d < NUM_DEMANDS; d++) {
				let caps = data.demands[d].name.toUpperCase()
				if (l.includes("Final Scoring: " + caps)) {
					let who = l.includes("France") ? FRANCE : l.includes("Britain") ? BRITAIN : TIE
					D.final_demand_wins[d][who]++
				}
			}

			if (l.includes("2 VP (Control of")) {
				let who = l.includes("France") ? FRANCE : l.includes("Britain") ? BRITAIN : TIE
				D.turn_wins[GAME_OVER][who]++
				D.final_territory_wins[who]++
				let matches = l.match(/\d+/g)
				if (matches) {
					let s = parseInt(matches[0])
					D.final_territory_spaces[s]++
				}
			}

			if (l.includes("France wins!") || l.includes("Britain wins!")) {
				let who = l.includes("France") ? FRANCE : BRITAIN
				D.final_scoring_wins[who]++
				if (l.includes("Tie-breaker")) {
					D.tie_breaker++
					D.tie_breaker_wins[who]++
					if (l.includes("Final tie-breaker")) {
						D.tie_breaker_final_wins++
					}
				}
			}
		}

		if (l.includes("France resigned") || l.includes("Britain resigned")) {
			let who = l.includes("France") ? FRANCE : BRITAIN

			D.turn_wins[turn_index][1 - who]++

			D.resigned++
			D.resigned_wins[1 - who]++
		}

		if (l.includes("wins the game")) {
			let who = l.includes("France") ? FRANCE : BRITAIN
			D.autovictories++
			D.autovictory[who]++

			D.turn_wins[turn_index][who]++

			if (l.includes("VP")) {
				D.vp_autovictories++
				D.vp_autovictory[who]++
			} else if (l.includes("theaters")) {
				D.war_autovictories++
				D.war_autovictory[who]++
			} else if (l.includes("all regional and demand scorings")) {
				D.peace_autovictories++
				D.peace_autovictory[who]++
			}
		}

		for (let w = 1; w <= 4; w++) {
			if (l.includes("#" + data.wars[w].name)) {
				war = w
				D.wars[war]++
				switch (war) {
					case 1: turn_index = WAR_TURN_WSS; break;
					case 2: turn_index = WAR_TURN_WAS; break;
					case 3: turn_index = WAR_TURN_7YW; break;
					case 4: turn_index = WAR_TURN_AWI; break;
				}
			}
		}

		if (l.includes("War Layout Phase")) war = 0

		if (war > 0) {
			for (let t = 1; t <= data.wars[war].theaters; t++) {
				if (l.includes(data.wars[war].theater_names[t])) {
					let who = -1
					if (l.includes("France")) {
						who = FRANCE
					} else if (l.includes("Britain")) {
						who = BRITAIN
					} else if (l.includes("TIE")) {
						who = TIE
					}
					if (who >= 0) {
						D.theaters_won[war][t][who]++
						if (who !== TIE) {
							let matches = l.match(/\d+$/)
							if (matches) {
								let margin = parseInt(matches[0])
								let tier = theater_tier(war, who, t, margin)
								if (tier >= 0) {
									D.theater_level[war][t][tier][who]++
								}
							}
						}
					}
				}
			}
		}
	}
}


var total_dataset = 0

function data_miner(db_path) {
	var db = new sqlite3(db_path)
	var select_games_of_title = db.prepare("select * from games natural join game_state where title_id=?")
	var select_players_of_game = db.prepare("select * from players where game_id=?")

	total_dataset = 0
	for (let game of select_games_of_title.iterate("imperial-struggle")) {
		total_dataset++
		let players = select_players_of_game.all(game.game_id)
		let G = JSON.parse(game.state)
		elo_compute(players, G)
	}

	do_data_mining(select_games_of_title, select_players_of_game)
}


function indent(times)
{
	let indent_string = ""
	for (let i = 0; i < times; i++) {
		indent_string += "\t"
	}
	return indent_string
}

function report_top()
{
	D.report_lines.push("<!doctype html>")
	D.report_lines.push('<meta name="viewport" content="width=device-width, initial-scale=1">')
	D.report_lines.push("<style>")
	D.report_lines.push("p,h1,h2,h3{margin:0;padding:0;white-space:pre;font-size:1em;line-height:1.5em}")
	D.report_lines.push("</style>")
	D.report_lines.push("<body>")
}

function report_bottom()
{
	D.report_lines.push ("</body>")
}

function report_break()
{
	D.report_lines.push ("<br/>")
}

function report_header(string)
{
	D.report_lines.push("<h2>"+ string + "</h2>")
}

function report_subheader(string)
{
	D.report_lines.push("<h3>"+ string + "</h3>")
}

// THIS IS HOW RUNS WILL BE OUTPUT
function report(string)
{
	D.report_lines.push("<p>"+ string + "</p>")
}

// THESE ARE THE RUNS THAT WILL GET DONE
function do_data_mining(select_games_of_title, select_players_of_game)
{
	data_mining_run(select_games_of_title, select_players_of_game)  // All Games
	fs.writeFileSync("public/imperial-struggle/info/stats.html", D.report_lines.join("\n"))

	data_mining_run(select_games_of_title, select_players_of_game, "High Elo", 1550, 9999, true)
	fs.writeFileSync("public/imperial-struggle/info/stats_high_elo.html", D.report_lines.join("\n"))

	data_mining_run(select_games_of_title, select_players_of_game, "Low Elo", -1, 1500)
	fs.writeFileSync("public/imperial-struggle/info/stats_low_elo.html", D.report_lines.join("\n"))
}

if (process.argv.length !== 3) {
	console.error("usage: node public/imperial-struggle/mining.js db")
	process.exit(1)
}

data_miner(process.argv[2])
