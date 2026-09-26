"use strict"

/* global console */

const data = require("./data.js")

const ROLES = [ "France", "Britain" ]
const SCENARIOS = [
	"Standard",
	"Bid for sides",
	"Britain +3 TRP",
	"Britain +2 TRP",
	"Britain +1 TRP",
	"France +3 TRP",
	"France +2 TRP",
	"France +1 TRP",
]

var G, L, R, V, P = {}    // G = Game state, V = View, R = role of active player, L = Local, P = Procedures

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


/* TILES & CARDS */

setup_procs()
unit_tests()

function setup_procs()
{
	data.ministries[ROBERT_WALPOLE].proc = "ministry_robert_walpole"
	data.ministries[BANK_OF_ENGLAND].proc = "ministry_bank_of_england"
	data.ministries[EDMOND_HALLEY].proc = "ministry_edmond_halley"
	data.ministries[THE_CARDINAL_MINISTERS].proc = "ministry_cardinal_ministers"
	data.ministries[NEW_WORLD_HUGUENOTS].proc = "ministry_new_world_huguenots"
	data.ministries[JACOBITE_UPRISINGS].proc = "ministry_jacobite_uprisings"
	data.ministries[PITT_THE_ELDER].proc = "ministry_pitt_the_elder"
	data.ministries[CHARLES_HANBURY_WILLIAMS].proc = "ministry_charles_hanbury_williams"
	data.ministries[CHOISEUL].proc = "ministry_choiseul"
	data.ministries[PAPACY_HANOVER_NEGOTIATIONS].proc = "ministry_papacy_hanover_negotiations"
	data.ministries[TOWNSHEND_ACTS].proc = "ministry_townshend_acts"

	data.cards[CARNATIC_WAR].proc = "event_carnatic_war"
	data.cards[ACTS_OF_UNION].proc = "event_acts_of_union"
	data.cards[TROPICAL_DISEASES].proc = "event_tropical_diseases"
	data.cards[SOUTH_SEA_SPECULATION].proc = "event_south_sea_speculation"
	data.cards[WAR_OF_JENKINS_EAR].proc = "event_war_of_jenkins_ear"
	data.cards[NATIVE_AMERICAN_ALLIANCES].proc = "event_native_american_alliances"
	data.cards[AUSTRO_SPANISH_RIVALRY].proc = "event_austro_spanish_rivalry"
	data.cards[TAX_REFORM].proc = "event_tax_reform"
	data.cards[GREAT_NORTHERN_WAR].proc = "event_great_northern_war"
	data.cards[VATICAN_POLITICS].proc = "event_vatican_politics"
	data.cards[CALICO_ACTS].proc = "event_calico_acts"
	data.cards[MILITARY_SPENDING_OVERRUNS].proc = "event_military_spending_overruns"
	data.cards[ALBERONIS_AMBITION].proc = "event_alberonis_ambition"
	data.cards[FAMINE_IN_IRELAND].proc = "event_famine_in_ireland"
	data.cards[INTEREST_PAYMENTS].proc = "event_interest_payments"
	data.cards[CARIBBEAN_SLAVE_UNREST].proc = "event_caribbean_slave_unrest"
	data.cards[PACTE_DE_FAMILLE].proc = "event_pacte_de_famille"
	data.cards[BYNGS_TRIAL].proc = "event_byngs_trial"
	data.cards[LE_BEAU_MONDE].proc = "event_le_beau_monde"
	data.cards[HYDER_ALI].proc = "event_hyder_ali"
	data.cards[CO_HONG_SYSTEM].proc = "event_co_hong_system"
	data.cards[CORSICAN_CRISIS].proc = "event_corsican_crisis"
	data.cards[EUROPEAN_PANIC].proc = "event_european_panic"
	data.cards[WEST_AFRICAN_GOLD_MINING].proc = "event_west_african_gold_mining"
	data.cards[WAR_OF_THE_QUADRUPLE_ALLIANCE].proc = "event_war_of_the_quadruple_alliance"
	data.cards[SALON_D_HERCULE].proc = "event_salon_d_hercule"
	data.cards[BENGAL_FAMINE].proc = "event_bengal_famine"
	data.cards[FATHER_LE_LOUTRE].proc = "event_father_le_loutre"
	data.cards[WAR_OF_THE_POLISH_SUCCESSION].proc = "event_war_of_the_polish_succession"
	data.cards[JONATHANS_COFFEE_HOUSE].proc = "event_jonathans_coffee_house"
	data.cards[NOOTKA_INCIDENT].proc = "event_nootka_incident"
	data.cards[HAITIAN_REVOLUTION].proc = "event_haitian_revolution"
	data.cards[LOGE_DES_NEUF_SOEURS].proc = "event_loge_des_neuf_soeurs"
	data.cards[LA_GABELLE].proc = "event_la_gabelle"
	data.cards[JESUIT_ABOLITION].proc = "event_jesuit_abolition"
	data.cards[WEALTH_OF_NATIONS].proc = "event_wealth_of_nations"
	data.cards[DEBT_CRISIS].proc = "event_debt_crisis"
	data.cards[EAST_ASIA_PIRACY].proc = "event_east_asia_piracy"
	data.cards[STAMP_ACT].proc = "event_stamp_act"
	data.cards[FALKLANDS_CRISIS].proc = "event_falklands_crisis"
	data.cards[COOK_AND_BOUGAINVILLE].proc = "event_cook_and_bougainville"

	data.advantages[BALTIC_TRADE].proc = "advantage_baltic_trade"
	data.advantages[ALGONQUIN_RAIDS].proc = "advantage_place_conflict"
	data.advantages[IROQUOIS_RAIDS].proc = "advantage_place_conflict"
	data.advantages[PATRIOT_AGITATION].proc = "advantage_place_conflict"
	data.advantages[WHEAT].proc = "advantage_unflag_discount"
	data.advantages[FUR_TRADE].proc = "advantage_unflag_discount"
	data.advantages[RAIDS_AND_INCURSIONS].proc = "advantage_place_conflict"
	data.advantages[SEPARATIST_WARS].proc = "advantage_place_conflict"
	data.advantages[POWER_STRUGGLE].proc = "advantage_place_conflict"
	data.advantages[LETTERS_OF_MARQUE].proc = "advantage_place_conflict"
	data.advantages[PIRATE_HAVENS].proc = "advantage_place_conflict"
	data.advantages[MEDITERRANEAN_INTRIGUE].proc = "advantage_place_conflict"
	data.advantages[CENTRAL_EUROPE_CONFLICT].proc = "advantage_place_conflict"
	data.advantages[RUM].proc = "advantage_unflag_discount"
	data.advantages[FRUIT].proc = "advantage_unflag_discount"
	data.advantages[TEXTILES].proc = "advantage_unflag_discount"
	data.advantages[SILK].proc = "advantage_unflag_discount"
	data.advantages[GERMAN_DIPLOMACY].proc = "advantage_unflag_discount"
	data.advantages[SILESIA_NEGOTIATIONS].proc = "advantage_unflag_discount"
	data.advantages[ITALY_INFLUENCE].proc = "advantage_unflag_discount"
	data.advantages[NAVAL_BASTION].proc = "advantage_naval_bastion"
	data.advantages[SLAVING_CONTRACTS].proc = "advantage_slaving_contracts"
}


function unit_tests()
{
	for (let i = 0; i < data.spaces.length; i++) {
		if (data.spaces[i].num !== i)
			throw new Error("Space numbering is wrong for " + data.spaces[i].name)
	}

	// Unit test to confirm two-way connections
	for (let i = 0; i < data.spaces.length; i++) {
		if (data.spaces[i].connects !== undefined) {
			for (const space of data.spaces[i].connects) {
				let connection = false
				if (data.spaces[space].connects !== undefined) {
					for (const space2 of data.spaces[space].connects) {
						if (space2 === i) {
							connection = true
							break
						}
					}
				}
				if (!connection) {
					console.error(
						"Space " +
						data.spaces[i].name +
						" specifies a connection to " +
						data.spaces[space].name +
						" but the reverse connection does not exist."
					)
				}
			}
		}

		if (data.spaces[i].conquest !== undefined) {
			for (const space of data.spaces[i].conquest) {
				let connection = false
				if (data.spaces[space].conquest !== undefined) {
					for (const space2 of data.spaces[space].conquest) {
						if (space2 === i) {
							connection = true
							break
						}
					}
				}
				if (!connection) {
					console.error(
						"Space " +
						data.spaces[i].name +
						" specifies a conquest line to " +
						data.spaces[space].name +
						" but the reverse conquest line does not exist."
					)
				}
			}
		}
	}
}

/* SETUP */
function on_setup(scenario, options) {

	// Most recently written game state version
	G.game_state_version      = GAME_STATE_VERSION

	// Version the game state was created under
	G.game_state_created_with = GAME_STATE_VERSION

	// Usually this is an integer containing the id of the active player (i.e. FRANCE or BRITAIN).
	// But *sometimes*, horrifyingly, it's actually an *array* that we fill with both player IDs for multiactive phases.
	// And then we delete player ids from the array as players individually complete the phase.
	G.active = FRANCE

	// Each player's current hand of event cards.
	// <br><b>
	// G.hand[BRITAIN][0] contains an index into data.cards[]
	G.hand = [[], []]

	// The current ministers chosen by each player.
	// <br><b>
	// G.ministry[FRANCE][0] contains an index into data.ministries[]
	G.ministry = [[], []]

	// Global VP count (tug-of-war). Notionally 0 to 30 but values above and below that range are explicitly legal.
	G.vp = 15

	// Current turn. CAUTION: index does *not* match turn "number" because of war turns. Use the constants provided.
	// <br><b>
	// PEACE_TURN_1, WAR_TURN_WSS, PEACE_TURN_2, PEACE_TURN_3, WAR_TURN_WAS, PEACE_TURN_4, WAR_TURN_7YW, PEACE_TURN_5, WAR_TURN_AWI, PEACE_TURN_6
	G.turn = 0

	// The next war coming up (WAR_WSS, etc)
	G.next_war = WAR_WSS

	// Which player holds the initiative and gets to decide who goes first
	G.initiative = FRANCE

	// Current debt for each player
	// <br><b>
	// G.debt[BRITAIN]
	G.debt = []

	// Current debt limit for each player
	// <br><b>
	// G.debt_limit[BRITAIN]
	G.debt_limit = []

	// Current treaty points for each player
	// <br><b>
	// G.treaty_points[FRANCE]
	G.treaty_points = []

	// The Investment tiles that each player has chosen this turn, pushed in action round order. Contains an index into data.investments[]
	// <br><b>
	// G.played_tiles[FRANCE][0] has the tile played on France's first action round
	G.played_tiles = [[], []]

	for (var i = FRANCE; i <= BRITAIN; i++) {
		G.debt_limit[i] = 6
		G.debt[i] = 0
		G.treaty_points[i] = 0
	}

	// General persistent bitflags
	G.bitflags = bit_init(NUM_BITFLAGS)

	// Transient flags for tracking events, advantages, etc that are always reset at end of action round
	// <br><b>
	// has_transient(who, TRANSIENT_WHATEVER)
	G.transient_bitflags = [[], []]
	for (i = FRANCE; i <= BRITAIN; i++) {
		G.transient_bitflags[i] = bit_init(NUM_TRANSIENT_BITFLAGS)
	}

	// The current shuffled event card deck. Contains event card indices into data.cards[]
	G.deck = []

	// The event discard. Contains event card indices into data.cards[]
	G.discard_pile = []

	// All the events ever played (distinct from discard pile, as played events are removed from the game)
	G.played_events = []

	// The Event (card index) played this action round
	G.played_event  = 0

	for (i = 1; i <= SUCCESSION_ERA_CARDS; ++i)
		G.deck.push(i)
	shuffle(G.deck)

	// Investments available this action round
	G.inv_avail = []

	// Investments that have already been claimed this action round
	G.inv_played = []

	// Used investments from previous turns
	G.inv_used = []

	// Shuffled face-down stack of investment tiles, from which G.inv_avail is dealt each turn
	G.inv_stack = []
	for (i = 0; i < NUM_INVESTMENT_TILES; i++)
		G.inv_stack.push(i)
	shuffle(G.inv_stack)

	// These are the face-down stocks of war tiles the players draw from
	// <br><b>
	// if (G.basic_war[who].length < 1) return
	G.basic_war = [ [], [] ]

	// These are the face-down stocks of war tiles the players draw from
	// <br><b>
	// if (G.bonus_war[who].length < 1) return
	G.bonus_war = [ [], [] ]

	// These are the war tiles sent to the current war. There are 4 theaters (1-4), and 0 means tile has been drawn but not yet assigned a theater (display on upper row of war mat)
	// <br><b>
	// G.theater_basic[player][theater][0-n]
	G.theater_basic = [[[], [], [], [], []], [[], [], [], [], []]]

	// These are the war tiles sent to the current war. There are 4 theaters (1-4), and 0 means tile has been drawn but not yet assigned a theater (display on upper row of war mat)
	// <br><b>
	// G.theater_bonus[player][theater][0-n]
	G.theater_bonus = [[[], [], [], [], []], [[], [], [], [], []]]

	// "Sets" -- keeps track of which individual basic war tiles have been revealed to the opponent, by tile id.
	// <br><b>
	// set_has(G.basic_revealed[who], tile)
	G.basic_revealed = [[], []]

	// "Sets" -- keeps track of which individual basic war tiles have been revealed to the opponent, by tile id.
	// <br><b>
	// set_has(G.bonus_revealed[who], tile)
	G.bonus_revealed = [[], []]

	// Limit of 2 bonus war tiles may be *purchased* per action round (can get more with events, etc)
	G.bonuswar_bought = 0

	war_layout_reshuffle_basic_war_tiles(true)
	add_next_war_bonus_tiles()

	war_layout_basic_war_tiles()

	// France starts the game with one bonus war tile
	draw_bonus_war_tile(FRANCE, 1)

	// Who won each theater in the next/current war? -1 = unresolved (don't display), 0 = France, 1 = Britain, 4/NONE = TIE
	G.war_winner = [ -1, -1, -1, -1, -1 ]

	/* */

	// Award chit index for each region
	// <br><b>
	// G.awards[REGION_EUROPE] </b> contains an index into data.awards[]
	G.awards = []

	// The stack of available (but not currently active) award chits
	G.award_chits = []
	for (let i = 0; i < NUM_AWARD_TILES; i++) {
		G.award_chits.push(i)
	}
	shuffle(G.award_chits)

	// Current global demand (one demand entry for each demand)
	G.global_demand = []

	// For each advantage, tells which player owns it
	// <br><b>
	// G.advantage[a] === who
	G.advantages = new Array(NUM_ADVANTAGES).fill(NONE)

	// Simple bitflag, set if advantage has changed hands this turn
	// <br><b>
	// G.adv_new & (1<<a)
	G.adv_new  = 0

	// Simple bitflag, set if advantage presently exhausted
	// <br><b>
	// is_advantage_exhausted(who,a)
	// <br>
	// G.adv_exhaust & (1<<a)
	// <br>
	// G.adv_exhaust |= (1<<a)
	G.adv_exhaust = 0

	// Integer: the number of advantages the G.active player has already used this turn
	G.adv_used = 0

	// Bitflags = which regions has the G.active player already used an advantage in this turn
	G.adv_regions = 0

	// All the flags on the map by space: G.flags[space]
	// <br><b>
	// if (G.flags[IRELAND_1] === FRANCE) { ... }
	G.flags = []

	// Any changes to indexed space since last investment tile? If so, highlight them!
	// ALSO! Use to check if a navy has already deployed this action round.
	// <br><b>
	// set_has(G.dirty, s)
	G.dirty = []
	G.dirty_conflict = []
	G.dirty_demand = 0

	// Which player made the most recent changes to spaces
	G.dirty_who = FRANCE

	// Has the navy in this space captured a space during this war
	// <br><b>
	// set_has(G.navy_this_war, s)
	G.navy_this_war = []

	// Set flags to their setup state (none, france, britain, or spain; no usa at start of course)
	for (i = 0; i < data.spaces.length; i++) {
		G.flags[i] = data.spaces[i].flag ?? NONE
		if ((G.flags[i] === SPAIN) && !rules_spanish_empire()) G.flags[i] = NONE
	}

	// Map of conflict markers by space
	// <br><b>
	// set_has(G.conflicts, s)
	G.conflicts = []

	// Map of damaged forts by space
	// <br><b>
	// set_has(G.damaged_forts, s)
	G.damaged_forts = []

	// List of territories with Huguenots
	// <br><b>
	// for (const h of G.huguenots) { assert (data.spaces[h].type === TERRITORY) }
	G.huguenots = []

	// List of territories with *spent* Huguenots (such territories will *also* be part of G.huguenots)
	// <br><b>
	// for (const h of G.huguenots_spent) { assert (G.huguenots.includes(h)) }
	G.huguenots_spent = []

	// How many squadrons left in each player's navy box. For *unbuilt* squadrons see G.unbuilt_squadrons[who] instead.
	// <br><b>
	// G.navy_box[who]
	G.navy_box = []
	G.navy_box[FRANCE] = 1
	G.navy_box[BRITAIN] = 2

	// Which space each individual squadron thinks it's in, of the 8 "physical squadron counters" provided to each side (this is tracked *only* for the purpose of having squadrons animate between their changing positions)
	// <br><b>
	// G.squadrons[who][0 - 7]
	G.squadrons = [ [ SPACE_NAVY_BOX, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT ], [ SPACE_NAVY_BOX, SPACE_NAVY_BOX, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT, SPACE_UNBUILT ] ]

	// British navies can get sent away to come back on the next peace turn
	G.the_brig = 0

	// How many squadrons a player has left unbuilt (total supply per player is 8). For squadrons *in the Navy Box* see G.navy_box[who] instead.
	// <br><br>
	// G.unbuilt_squadrons[who]
	G.unbuilt_squadrons = []
	for (let who = FRANCE; who <= BRITAIN; who++) {
		G.unbuilt_squadrons[who] = NUM_SQUADRONS - G.navy_box[who]
	}

	// Flag counts for each player, by region. Updated whenever flags or conflict changes. Used for scoring regions.
	// <br><b>
	// G.flag_count[who][region]
	G.flag_count = [ [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ]

	// Total prestige flag count for each player. Updated whenever flags or conflict changes. Used for prestige scoring.
	// <br><b>
	// G.prestige_flags[who]
	G.prestige_flags = [ 0, 0 ]

	// Total flag count for each player, by each of the 6 global demand commodities. Updated whenever flags or conflict changes. Used for scoring demands.
	// <br><b>
	// G.demand_flag_count[who][demand]
	// <br><b>
	// G.demand_flag_count[FRANCE][COTTON]
	G.demand_flag_count = [ [ 0, 0, 0, 0, 0, 0 ], [ 0, 0, 0, 0, 0, 0 ] ]

	// Number of USA flags placed in the game
	G.usa_flags = 0

	// Number of Jacobite Victories (0-2)
	G.jacobite_victory = 0

	clear_bit(JACOBITE_DEFEAT)  // Have Jacobites been defeated
	clear_bit(JACOBITES_ALWAYS) // Has France qualified for "perma-Jacobite" status?
	clear_bit(JACOBITES_NEVER)  // Has Jacobite Uprisings ministry been removed from the game
	clear_bit(JACOBITE_VICTORY_WSS)
	clear_bit(JACOBITE_VICTORY_WAS)

	update_advantages(true)
	advantages_acquired_last_round_now_available()

	update_flag_counts()

	// There are distinct periods within "an action round" during which certain actions are allowed or not. For example
	// you must select an investment tile before you can play an event or spend action points, but certain ministries can be
	// activated *before* even picking a tile. Some ministries can *only* be used *before* spending any action points, but
	// other ministries and advantages can be used throughout the round. This field tracks how long-in-the-tooth the current
	// action round has gotten.
	//
	// BEFORE_PICKING_TILE
	// PICKED_TILE_OPTION_TO_PASS
	// OPTION_TO_PLAY_EVENT
	// DURING_EVENT
	// BEFORE_SPENDING_ACTION_POINTS
	// ACTION_POINTS_ALREADY_SPENT
	// NOT_ACTION_PHASE
	G.subphase = NOT_ACTION_PHASE

	// When asking player about whether to flip ministers, expend advantages and abilities, etc, this header
	// can be populated with a reminder of what the main action the player is trying to do (e.g. "UNFLAG IRELAND: ")
	G.action_header = ""

	// Internal for tracking if a log box is going
	G.log_box = null

	// During scoring reviews (which otherwise would generate an overwhelming amount of logging all at once), we hide
	// parts of the log and let each player step through at their own pace. -1 means not hiding any part of the log; otherwise
	// an index means hide anything after that index
	G.log_hide_after = [-1, -1]

	// Pour encourager les autres
	G.byng = 0

	// Which demand do Townshend Acts currently apply to (if any)
	G.townshend_acts = -1

	// For completed wars, the player who won each theater, or NONE for ties. -1 means not yet happened
	// <br/>
	// G.old_winners[WAR_WSS][3] -> the winner of theater 3 in WAR_WSS
	G.old_winners = [ [], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [ -1, -1, -1, -1, -1] ]

	// For completed wars, the margin by which each theater was won
	// <br/>
	// G.old_margins[WAR_AWI][1] -> the margin of victory in first theater of WAR_AWI
	G.old_margins = [ [], [ 0,  0,  0,  0, 0 ], [ 0,  0,  0,  0,  0], [ 0,  0,  0,  0,  0], [ 0,  0,  0,  0,  0] ]

	call("preliminaries", { scenario, options })
}


function report_squadrons(string)
{
	//console.error(string)
	throw new Error(string)
}

function validate_squadrons(message)
{
	for (let who = FRANCE; who <= BRITAIN; who++) {
		let navies = 0
		let brig = 0
		let out_of_game = 0
		let on_map = 0
		let unbuilt = 0

		for (let sq = 0; sq < NUM_SQUADRONS; sq++) {
			let s = G.squadrons[who][sq]
			if (s >= 0) {
				on_map++
				if (G.flags[s] !== who) {
					report_squadrons (message + " Wrong owner of token " + sq + ", expected " + who + " found " + G.flags[s] + " -- " + "Wrong owner of space, squadron " + sq + " space: " + s + " " + data.spaces[s].name)
				}
			} else if (s === SPACE_NAVY_BOX) {
				navies++
			} else if (s === SPACE_THE_BRIG) {
				brig++
			} else if (s === SPACE_UNBUILT) {
				unbuilt++
			} else if (s === SPACE_REMOVED_FROM_GAME) {
				out_of_game++
			}
		}

		if (navies === G.navy_box[who]) {
			// ("Navy box matches")
		} else {
			report_squadrons (message + " " + "Who:" + who + " -- " + "Wrong navy box! " + navies + " should be " + G.navy_box[who])
		}

		if (unbuilt === G.unbuilt_squadrons[who]) {
			// ("Unbuilt matches")
		} else {
			report_squadrons (message + " " + "Who:" + who + " -- " + "Wrong unbuilt box! " + unbuilt + " should be " + G.unbuilt_squadrons[who])
		}

		if (((who === BRITAIN) && (brig === G.the_brig)) || ((who === FRANCE) && (brig === 0))) {
			//
		} else {
			if (who === BRITAIN) {
				report_squadrons (message + " " + "Who:" + who + " -- " + "Wrong brig box! " + brig + " should be " + G.the_brig)
			} else {
				report_squadrons (message + " " + "Who:" + who + " -- " + "French in brig! " + brig + " should be 0")
			}
		}

		let total = on_map + navies + brig + unbuilt + out_of_game
		if (total === NUM_SQUADRONS) {
			//("Total squadrons matches")
		} else {
			report_squadrons (message + " " + "Who:" + who + " -- " + "Total squadrons WRONG! " + total + " should be " + NUM_SQUADRONS)
		}
	}
}


function report_decks(string)
{
	if (globalThis.RTT_FUZZER) throw new Error(string)
	console.error(string)
}

function validate_decks(message)
{
	for (let who = FRANCE; who <= BRITAIN; who++) {
		for (const c of G.hand[who]) {
			if (G.deck.includes(c)) {
				report_decks (message + " Deck includes card " + c + pad(parens(data.cards[c].name)) + " which is also in hand " + who)
			}
			if (G.discard_pile.includes(c)) {
				report_decks (message + " Discard Pile includes card " + c + pad(parens(data.cards[c].name)) + " which is also in hand " + who)
			}
			if (G.played_events.includes(c)) {
				report_decks (message + " Played Events includes card " + c + pad(parens(data.cards[c].name)) + " which is also in hand " + who)
			}
		}
	}

	for (const c of G.deck) {
		if (G.discard_pile.includes(c)) {
			report_decks (message + " Deck includes card " + c + pad(parens(data.cards[c].name)) + " which is also in discard pile.")
		}
		if (G.played_events.includes(c)) {
			report_decks (message + " Deck includes card " + c + pad(parens(data.cards[c].name)) + " which is also in played events.")
		}
	}

	for (const c of G.discard_pile) {
		if (G.played_events.includes(c)) {
			if (G.played_events.includes(c)) {
				throw new Error (message + " Discard Pile includes card " + c + pad(parens(data.cards[c].name)) + " which is also played events.")
			}
		}
	}
}


// Graceful upgrades of obsolete game-states
function on_load()
{
	//dump_squadrons("ON_LOAD") //BR only uncomment this specific one when fuzzing -- normally we want on_load to clean up squadron issues not throw exceptions about them

	if (G.game_state_version === undefined) G.game_state_version = 0
	if (G.game_state_created_with === undefined) G.game_state_created_with = G.game_state_version

	if (G.game_state_version > GAME_STATE_VERSION) {
		console.error ("WARNING: Code is older than the version game state was made with. (Code version: " + GAME_STATE_VERSION + ", file made with: " + G.game_state_version + ")")
	}

	upconvert (1, upconvert_exhausted)

	if (G.game_state_version < 4) {
		upconvert (4, upconvert_squadrons)       // Upconvert squadrons (so they always have tokens)
		upconvert (4, upconvert_discards, true)  // Automatically fix corrupted discard piles
	} else if (G.game_state_version < 7) {
		upconvert (6, upconvert_squadrons, true) // Clean up after The Buggening
		validate_squadrons("DONE LOAD")
	}

	upconvert (10, upconvert_old_wars)
	upconvert (11, upconvert_did_the_brig)
	upconvert (12, upconvert_jacobite_turns)
	upconvert (14, upconvert_bitflags)

	if ((G.game_state_created_with <= 14) && (G.game_state_version < 15)) {
		upconvert (15, upconvert_patch_bitflags)
	}

	upconvert (16, upconvert_shorter_names)
	upconvert (17, upconvert_shorter_names_2)
	upconvert (19, upconvert_usa_flags)
	upconvert (20, upconvert_scoring_review)
	upconvert (22, upconvert_dirty_conflict)

	G.game_state_version = GAME_STATE_VERSION
}


// Applies a conversion method to the main game state and all of its undo states
function upconvert(version, converter, force = false) {
	if ((G.game_state_version >= version) && !force) return
	converter(G)
	G.game_state_version = version // In case someone "undoes" back to here, it will remember it has been upgraded
	if (G.undo) {
		for (let i = 0; i < G.undo.length; i++) {
			converter(G.undo[i])
			G.undo[i].game_state_version = version
		}
	}
}

//NB remember not to call functions that might refer to "G" while writing an upconvert -- only use "state".

function upconvert_dirty_conflict(state)
{
	state.dirty_conflict = []
	state.dirty_demand = 0
}

function upconvert_scoring_review(state)
{
	if (state.temp_vp !== undefined) { // Separate temp mini-view per-player, just like the Big Boy Review.
		state.temp_vp   = [ state.temp_vp, state.temp_vp ]
		state.temp_trp  = [ state.temp_trp, state.temp_trp ]
		state.temp_debt = [ state.temp_debt, state.temp_debt ]
	}
}


function upconvert_usa_flags(state)
{
	state.usa_flags = 0
	for (let s = 0; s < NUM_SPACES; s++) {
		if (state.flags[s] !== USA) continue
		state.usa_flags++
	}
}

function upconvert_patch_bitflags(state)
{
	if (state.turn === PEACE_TURN_1) {
		set_bit2(state, JACOBITE_VICTORY_WSS, false)
	} else {
		set_bit2(state, JACOBITE_VICTORY_WSS, (state.old_war_theater_winners[WAR_WSS][4] === FRANCE) && G.old_war_theater_margins[WAR_WSS][4] >= 3)
	}

	if (state.turn <= PEACE_TURN_3) {
		set_bit2(state, JACOBITE_VICTORY_WAS, false)
	} else {
		set_bit2(state, JACOBITE_VICTORY_WAS, (state.old_war_theater_winners[WAR_WAS][4] === FRANCE))
	}
}


function upconvert_shorter_names_2(state)
{
	state.controlled     = state.controlled_start_of_round
	state.major          = state.action_points_major
	state.minor          = state.action_points_minor
	state.committed      = state.action_points_committed_bonus
	state.contingent     = state.action_points_contingent
	state.eligible       = state.action_points_eligible
	state.eligible_major = state.action_points_eligible_major
	state.breakdown      = state.action_cost_breakdown
	state.adjustable     = state.action_cost_adjustable
	state.modifiers      = state.action_cost_modifiers
	state.mod_types      = state.action_cost_modifier_types
	state.basic_war      = state.basic_war_tiles
	state.bonus_war      = state.bonus_war_tiles

	delete state.controlled_start_of_round
	delete state.action_points_major
	delete state.action_points_minor
	delete state.action_points_committed_bonus
	delete state.action_points_contingent
	delete state.action_points_eligible
	delete state.action_points_eligible_major
	delete state.action_cost_breakdown
	delete state.action_cost_adjustable
	delete state.action_cost_modifiers
	delete state.action_cost_modifier_types
	delete state.basic_war_tiles
	delete state.bonus_war_tiles
}


function upconvert_shorter_names(state)
{
	if (state.bonuswar_bought === undefined) {
		state.bonuswar_bought = state.bonus_war_tiles_bought_this_round
	}

	state.adv_used       = state.advantages_used_this_round
	state.adv_new        = state.advantages_newly_acquired
	state.adv_regions    = state.advantage_regions
	state.adv_exhaust    = state.advantages_exhausted
	state.subphase       = state.action_round_subphase
	state.bonus_revealed = state.bonus_war_tile_revealed
	state.basic_revealed = state.basic_war_tile_revealed
	state.theater_basic  = state.theater_basic_war_tiles
	state.theater_bonus  = state.theater_bonus_war_tiles
	state.inv_stack      = state.investment_tile_stack
	state.inv_avail      = state.available_investments
	state.inv_played     = state.played_investments
	state.inv_used       = state.used_investments
	state.old_winners    = state.old_war_theater_winners
	state.old_margins    = state.old_war_theater_margins

	delete state.bonus_war_tiles_bought_this_round
	delete state.advantages_used_this_round
	delete state.advantages_newly_acquired
	delete state.advantage_regions
	delete state.advantages_exhausted
	delete state.action_round_subphase
	delete state.bonus_war_tile_revealed
	delete state.basic_war_tile_revealed
	delete state.theater_basic_war_tiles
	delete state.theater_bonus_war_tiles
	delete state.investment_tile_stack
	delete state.available_investments
	delete state.played_investments
	delete state.used_investments
	delete state.old_war_theater_winners
	delete state.old_war_theater_margins
}


function upconvert_bitflags(state)
{
	state.bitflags = bit_init (NUM_BITFLAGS)

	set_bit2(state, FLAG_MILITARY_UPGRADE, state.military_upgrade ?? false)
	set_bit2(state, BUYING_WAR_TILE, state.buying_war_tile ?? false)
	set_bit2(state, JACOBITES_ALWAYS, state.jacobites_always ?? false)
	set_bit2(state, JACOBITES_NEVER, state.jacobites_never ?? false)
	set_bit2(state, JACOBITE_DEFEAT, state.jacobite_defeat ?? false)
	set_bit2(state, ACTION_MINOR, state.action_minor ?? false)
	set_bit2(state, ELIGIBLE_MINOR, state.eligible_minor ?? false)
	set_bit2(state, ACTION_COST_ADJUSTED, state.action_cost_adjusted ?? false)
	set_bit2(state, MINISTRY_ALREADY_REVEALED, state.ministry_already_revealed ?? false)
	set_bit2(state, MINISTRY_PROMPT_TO_EXHAUST, state.ministry_prompt_to_exhaust ?? false)
	set_bit2(state, PAID_ACTION_COST, state.paid_action_cost ?? false)
	set_bit2(state, USED_REQUIRED_ADVANTAGE, state.used_required_advantage ?? false)
	set_bit2(state, MINISTRY_MANUALLY_CLICKED, state.ministry_manually_clicked ?? false)
	set_bit2(state, CARD_HAS_BONUS, state.card_has_bonus ?? false)
	set_bit2(state, QUALIFIES_FOR_BONUS, state.qualifies_for_bonus ?? false)
	set_bit2(state, ADVANTAGE_ALREADY_EXHAUSTED, state.advantage_already_exhausted ?? false)
	set_bit2(state, NAVY_FROM_NAVY_BOX, state.navy_from_navy_box ?? false)
	set_bit2(state, NAVY_DISPLACE, state.navy_displace ?? false)
	set_bit2(state, DID_THE_BRIG, state.did_the_brig ?? false)
	set_bit2(state, JACOBITE_VICTORY_WSS, state.jacobite_victory_wss ?? false)
	set_bit2(state, JACOBITE_VICTORY_WAS, state.jacobite_victory_was ?? false)
	set_bit2(state, ADVANTAGE_OPTIONAL, state.advantage_optional ?? false)
	set_bit2(state, LEAVE_LOG_BOX_OPEN, state.leave_log_box_open ?? false)
	set_bit2(state, STARTED_MINISTRY_BOX, state.started_ministry_box ?? false)
	set_bit2(state, ELIGIBLE_FOR_HUGUENOTS, state.eligible_for_huguenots ?? false)

	// These were converted to bitflags, so they can be deleted from the state now
	delete state.military_upgrade
	delete state.buying_war_tile
	delete state.jacobites_always
	delete state.jacobites_never
	delete state.jacobite_defeat
	delete state.action_minor
	delete state.eligible_minor
	delete state.action_cost_adjusted
	delete state.ministry_already_revealed
	delete state.ministry_prompt_to_exhaust
	delete state.paid_action_cost
	delete state.ministry_manually_clicked
	delete state.card_has_bonus
	delete state.qualifies_for_bonus
	delete state.advantage_already_exhausted
	delete state.navy_from_navy_box
	delete state.navy_displace
	delete state.did_the_brig
	delete state.jacobite_victory_wss
	delete state.jacobite_victory_was
	delete state.advantage_optional
	delete state.leave_log_box_open
	delete state.started_ministry_box
	delete state.eligible_for_huguenots

	// These weren't converted to a bitflag, they just weren't necessary to have at all
	delete state.action_minor_type
	delete state.just_revealed

	// Convert to 1/0. In this case "undefined" is also a meaningful state
	if (state.has_required_ministry === undefined) {
		delete state.has_required_ministry
	} else {
		state.has_required_ministry = state.has_required_ministry ? TRUE : FALSE
	}
}


function upconvert_jacobite_turns(state)
{
	state.jacobite_victory_wss = (state.jacobite_victory > 0)
	state.jacobite_victory_was = (state.jacobite_victory === 2)
}


function upconvert_did_the_brig(state)
{
	state.did_the_brig = true
}

function upconvert_old_wars(state) {
	state.old_war_theater_winners = [ [], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1] ]
	state.old_war_theater_margins = [ [], [ 0,  0,  0,  0,  0], [ 0,  0,  0,  0,  0], [ 0,  0,  0,  0,  0], [ 0,  0,  0,  0,  0] ]
}

function upconvert_exhausted(state)
{
	state.ministry_exhausted = [ [], [] ]
}

function upconvert_discards(state) {
	let discards = []
	for (const c of state.discard_pile) {
		if (Array.isArray(c)) {
			for (const cc of c) {
				if (cc) discards.push(cc)
			}
		} else if (c) {
			discards.push(c)
		}
		state.discard_pile = discards
	}
}

function upconvert_squadrons(state)
{
	let num_removed = [ 0, 0 ]
	if (Array.isArray(state.squadrons)) {
		for (let who = FRANCE; who <= BRITAIN; who++) {
			for (let sq = 0; sq < NUM_SQUADRONS; sq++) {
				if (state.squadrons[who][sq] !== SPACE_REMOVED_FROM_GAME) continue
				num_removed[who]++
			}
		}
	}

	state.squadrons = [ [], [] ]
	let num_squadrons = [ 0, 0 ]

	for (let s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== NAVAL) continue
		let who = state.flags[s]
		if (who === NONE) continue
		state.squadrons[who].push(s)
		num_squadrons[who]++
	}

	for (let who = FRANCE; who <= BRITAIN; who++) {
		while ((num_squadrons[who] + state.navy_box[who] + state.unbuilt_squadrons[who] + num_removed[who] + ((who === BRITAIN) ? state.the_brig : 0)) > NUM_SQUADRONS) {
			if (state.unbuilt_squadrons[who] > 0) {
				state.unbuilt_squadrons[who]--
			} else if (num_removed[who] > 0) {
				num_removed[who]--
			} else if (state.num_navy_box[who] > 0) {
				state.num_navy_box[who]--
			} else {
				break
			}
		}
		for (let ss = 0; ss < state.navy_box[who]; ss++) {
			state.squadrons[who].push(SPACE_NAVY_BOX)
		}
		for (let ss = 0; ss < state.unbuilt_squadrons[who]; ss++) {
			state.squadrons[who].push(SPACE_UNBUILT)
		}
		if (who === BRITAIN) {
			for (let ss = 0; ss < state.the_brig; ss++) {
				state.squadrons[who].push(SPACE_THE_BRIG)
			}
		}
		while (state.squadrons[who].length < NUM_SQUADRONS) {
			state.squadrons[who].push(SPACE_REMOVED_FROM_GAME)
		}
	}
}



function on_save()
{
	G.game_state_version = GAME_STATE_VERSION
}




/* VIEW & ACTIONS */

// Items that we keep current even when we're in "review mode" looking at an old view
function absolute_view() {
	if ((V === null) || (V === undefined)) {
		console.error ("Got a null view from the temp_view/review_view pipe! " + L.P)
		V = { log: G.log }
		return false
	}

	V.active              = G.active
	V.log                 = G.log
	V.log_hide_after      = G.log_hide_after
	V.log_length          = G.log.length       // Footgun alert: the only place in rules.js that "log_length" with underscore should ever appear!

	V.bidding_for_sides   = L.bidding_for_sides ?? false

	V.UNDID = G.UNDID

	return true
}

function on_view(RR = undefined) {
	if (!V) {
		V = { log: G.log }
	}

	if (G.active >= 0 && G.temp_view && (RR === undefined)) {
		if (typeof G.temp_view[R] === "number") {
			if (G.temp_view[R] >= 0) {
				// New temp views index into an array of deltas
				V = object_copy(G.current_view[R])
				for (let index = G.review_view.length - 1; index >= G.temp_view[R]; index--) {
					V = object_patch(V, G.review_view[index][R])
				}
				if (absolute_view()) return
			}
		} else if (G.temp_view[R] !== null) {
			V = G.temp_view[R]  // Old temp views up through GS 20 are full copies
			if (absolute_view()) return
		}
	}

	RR ??= R // Pirate's favorite letter

	absolute_view()

	V.game_state_version = G.game_state_version

	V.turn = G.turn
	V.initiative = G.initiative
	V.first_player = G.first_player

	if (Array.isArray(G.temp_vp)) {
		V.vp   = G.temp_vp[R] ?? G.vp
		V.debt = G.temp_debt[R] ?? G.debt
		V.treaty_points = G.temp_trp[R] ?? G.treaty_points
	} else {
		V.vp = G.vp
		V.debt = G.debt
		V.treaty_points = G.treaty_points
	}

	V.debt_limit = G.debt_limit

	// Discard pile and played event pile are both public. Shuffled event deck is not.
	V.discard_pile = G.discard_pile
	V.played_events = G.played_events
	V.played_event = G.played_event
	V.played_event_who = is_bit(LAST_EVENT_BY_BRITAIN) ? BRITAIN : FRANCE
	V.played_tile = G.played_tile

	// Current available investments, and used investment pile, are public.
	// Shuffled investment deck is public, but not the order of it
	V.inv_avail = G.inv_avail
	V.inv_played = G.inv_played
	V.inv_used = G.inv_used
	V.inv_stack = G.inv_stack.slice().sort((a, b) => a - b)

	// Flags on the board are always visible
	V.flags = G.flags
	V.dirty = G.dirty
	V.dirty_conflict = G.dirty_conflict
	V.dirty_demand = G.dirty_demand
	V.dirty_who = G.dirty_who
	V.conflicts = G.conflicts
	V.damaged_forts = G.damaged_forts

	// Bitflags. NB: There's presently no meaningful information leakage here, but if a meaningful flag develops be sure to filter it out
	V.bitflags = G.bitflags

	// Currently selected global demand chits are visible; shuffled chits are not
	V.global_demand = G.global_demand

	// Award tiles
	V.awards = G.awards
	V.award_chits = G.award_chits

	// Advantage tiles
	V.advantages = G.advantages
	V.adv_exhaust = G.adv_exhaust
	V.adv_used = G.adv_used
	V.adv_regions = G.adv_regions
	V.adv_new = G.adv_new

	V.navy_box = G.navy_box
	V.unbuilt_squadrons = G.unbuilt_squadrons
	V.squadrons = G.squadrons
	V.the_brig = G.the_brig

	V.played_tile  = G.played_tile
	V.played_tiles = G.played_tiles

	V.active_keywords = [[], []]

	for (let who = FRANCE; who <= BRITAIN; who++) {
		for (let keyword = 0; keyword < data.keywords.length; keyword++) {
			if (has_active_keyword(who, keyword)) {
				V.active_keywords[who].push(keyword)
			}
		}
	}

	if (RR === FRANCE) {
		V.hand = [
			G.hand[FRANCE],
			G.hand[BRITAIN].map(_ => -1),
		]
		V.ministry = [
			G.ministry[FRANCE],
			G.ministry[BRITAIN].map((x) => (G.ministry_revealed[BRITAIN][G.ministry[BRITAIN].indexOf(x)] ? x : -1)),
		]

		V.deck = G.deck.concat(G.hand[BRITAIN]) // Deck + opponent hand
	}
	if (RR === BRITAIN) {
		V.hand = [
			G.hand[FRANCE].map(_ => -1),
			G.hand[BRITAIN],
		]
		V.ministry = [
			G.ministry[FRANCE].map((x) => (G.ministry_revealed[FRANCE][G.ministry[FRANCE].indexOf(x)] ? x : -1)),
			G.ministry[BRITAIN],
		]

		V.deck = G.deck.concat(G.hand[FRANCE]) // Deck + opponent hand
	}
	if (RR < 0) {
		V.hand = [
			G.hand[FRANCE].map(_ => -1),
			G.hand[BRITAIN].map(_ => -1),
		]
		V.ministry = [
			G.ministry[FRANCE].map((x) => (G.ministry_revealed[FRANCE][G.ministry[FRANCE].indexOf(x)] ? x : -1)),
			G.ministry[BRITAIN].map((x) => (G.ministry_revealed[BRITAIN][G.ministry[BRITAIN].indexOf(x)] ? x : -1)),
		]

		V.deck = G.deck.concat(G.hand[BRITAIN]) // Deck + both hands
		V.deck = V.deck.concat(G.hand[FRANCE])
	}
	if (!V.deck) V.deck = []
	V.deck.sort((a, b) => a - b) // Sort to avoid info leak

	V.ministry_exhausted = G.ministry_exhausted
	if ((G.ministry_exhausted === undefined) || !Array.isArray(G.ministry_exhausted[0])) {
		V.ministry_exhausted = [ [], [] ]
	}

	V.ministry_revealed = G.ministry_revealed

	V.next_war = G.next_war
	V.theater_basic = [ [], [] ] // [player][theater][0-n]
	V.theater_bonus = [ [], [] ] // [player][theater][0-n]

	if (!V.bidding_for_sides) {
		for (var who = FRANCE; who <= BRITAIN; who++) {
			for (var theater = 0; theater <= data.wars[G.next_war].theaters; theater++) { //NB: intentionally start at 0 (no-theater-yet) and then also theaters 1-X
				// -1 means opponent hasn't seen the tile yet
				V.theater_basic[who][theater] = G.theater_basic[who][theater].map(tile =>
					((who === RR) || set_has(G.basic_revealed[who], tile)) ? tile : -1
				)
				V.theater_bonus[who][theater] = G.theater_bonus[who][theater].map(tile =>
					((who === RR) || set_has(G.bonus_revealed[who], tile) || (tile === BYNG) || (tile === ATLANTIC_DOMINANCE) || (tile === ATLANTIC_DOMINANCE + 1)) ? tile : -1
				)
			}
		}
	}

	V.basic_revealed = G.basic_revealed
	V.bonus_revealed = G.bonus_revealed

	V.byng = G.byng ?? 0

	if (V.byng > 0) V.theater_bonus[BRITAIN][V.byng].push(BYNG)

	// War viewing totals exist in their own right; they are mostly not analogs to G members
	V.theater_strength = [ [], [] ]
	for (let who = FRANCE; who <= BRITAIN; who++) {
		for (let theater = 1; theater <= data.wars[G.next_war].theaters; theater++) {
			V.theater_strength[who][theater] = theater_strength(who, theater)
		}
	}

	V.theater_margin = []
	for (let theater = 1; theater <= data.wars[G.next_war].theaters; theater++) {
		V.theater_margin[theater] = theater_delta(theater)
	}

	V.theater_winner = G.war_winner

	// Current flag counts are public
	V.demand_flag_count = G.demand_flag_count
	V.flag_count        = G.flag_count
	V.prestige_flags    = G.prestige_flags

	V.huguenots = G.huguenots
	V.huguenots_spent = G.huguenots_spent

	V.jacobite_victory = G.jacobite_victory

	V.major = G.major
	V.minor = G.minor
	V.eligible = G.eligible
	V.eligible_major = G.eligible_major
	V.committed = G.committed
	V.contingent = G.contingent
	V.subphase = G.subphase

	V.townshend_acts = G.townshend_acts

	V.old_winners = G.old_winners
	V.old_margins = G.old_margins
}


// Hooks for optional rules
function rules_spanish_empire()
{
	return false
}

function rules_military_planning()
{
	return false
}

function rules_tougher_forts()
{
	return false
}

function available_debt(who)
{
	return G.debt_limit[who] - G.debt[who]
}

function available_debt_plus_trps(who)
{
	return available_debt(who) + G.treaty_points[who]
}

// This is for paying debt for action points - debt has already been verified to be within bounds.
// For increasing debt that accounts for debt overrun penalties, use increase_debt() instead.
function pay_debt(who, amount) {
	G.debt[who] += amount
}
function reduce_debt(who, amount)
{
	amount = Math.min(amount, G.debt[who])
	if (amount > 0) {
		G.debt[who] -= amount
		log(say_spending(data.flags[who].adj + " Debt", who) + " reduced by " + amount + ".")
	}
}

function increase_debt(who, amount) {
	let penalty = 0
	if (amount > available_debt(who)) {
		penalty = amount - available_debt(who)
		amount -= penalty
	}
	if (amount > 0) {
		G.debt[who] += amount
		log (say_spending(data.flags[who].adj + " Debt", who) +  " increased by " + amount + ".")
	}
	if (penalty > 0) {
		log (data.flags[who].name + " incurred " + say_spending(penalty + ((amount > 0) ? " more" : "") + " Debt", who) + " while at its " + say_spending("Debt Limit", who) + "!")
		if (has_active_ministry(who, JAMES_WATT)) {
			log (say_ministry(JAMES_WATT, who) + " prevented VP penalty from Debt Limit overrun.")
		} else {
			award_vp(who, -penalty, false, "Debt Limit")
		}
	}
}


function pay_treaty_points(who, amount) {
	if (amount > G.treaty_points[who]) {
		let msg = "Paid more treaty points than had available. Who: " + who + "  Avail: " + G.treaty_points[who] + "  Paid " + amount
		console.error(msg)
		if (globalThis.RTT_FUZZER) throw new Error(msg)
		amount = G.treaty_points[who]
	}
	G.treaty_points[who] -= amount
}

function add_treaty_points(who, amount, silent = false)
{
	G.treaty_points[who] += amount
	if ((amount > 0) && !silent) {
		log (data.flags[who].name + " gained " + say_spending(amount + " Treaty Point" + s(amount), who) + ".")
	}
}


function award_vp(who, amount, silent = false, reason = null)
{
	let true_delta = (who === FRANCE) ? amount : 0 - amount

	G.vp += true_delta

	if (!silent) {
		let msg = data.flags[who].name + ((amount >= 0) ? " gained " : " lost ") + Math.abs(amount) + " VP"
		if (reason) msg += " " + parens(reason)
		msg += "."
		log (bold(msg))
		msg = "VP: " + G.vp
		log (bold(msg))
	}
}


function get_advantage_region(a) {
	return data.spaces[data.advantages[a].req[0]].region
}

function has_advantage(who, a) {
	for (var s of data.advantages[a].req)
		if (G.flags[s] !== who)
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


function is_advantage_exhausted(a)
{
	return !!(G.adv_exhaust & (1 << a))
}

function exhaust_advantage(a, close_box, reason = "", silent = false, watt = true)
{
	G.adv_exhaust |= (1 << a)

	if (get_advantage_region(a) === REGION_EUROPE) {
		if (watt && has_advantage(FRANCE, a) && has_active_ministry(FRANCE, POMPADOUR_AND_DU_BARRY) && !is_ministry_exhausted(FRANCE, POMPADOUR_AND_DU_BARRY)) {
			exhaust_ministry(FRANCE, POMPADOUR_AND_DU_BARRY, 0, true)
			G.treaty_points[FRANCE]++
			log_box_ministry(FRANCE, POMPADOUR_AND_DU_BARRY)
			log ("France gained " + say_spending("one treaty point", FRANCE) + ".")
			log_box_end(LOG_BOX_MINISTRY)
		}
	}

	if (watt && has_advantage(FRANCE, a) && has_active_ministry(BRITAIN, JAMES_WATT) && !is_ministry_exhausted(BRITAIN, JAMES_WATT)) {
		exhaust_ministry(BRITAIN, JAMES_WATT, 0, true)
		G.treaty_points[BRITAIN]++
		log_box_ministry(BRITAIN, JAMES_WATT)
		log ("Britain gained " + say_spending("one treaty point", BRITAIN) + ".")
		log_box_end(LOG_BOX_MINISTRY)
	}

	if (!silent) {
		let msg = watt ? "ADVANTAGE Used" : "ADVANTAGE Exhausted"
		msg += "\n" + say_advantage(a, G.advantages[a], true)

		log_box_begin(G.advantages[a], msg, LOG_BOX_ADVANTAGE)
		if (reason !== "") log(reason)
		if (close_box) log_box_end(LOG_BOX_ADVANTAGE)
	}
}

function refresh_advantage(a)
{
	G.adv_exhaust &= ~(1 << a)

	let msg = "ADVANTAGE Refreshed"
	msg += "\n" + say_advantage(a, G.advantages[a], true)

	log_box_begin(G.advantages[a], msg, LOG_BOX_ADVANTAGE)
	log_box_end(LOG_BOX_ADVANTAGE)
}


/* 8.0 - Advantages */
function has_advantage_eligible(who, a, ignore_exhaustion = false, ignore_new = false)
{
	if (!has_advantage(who, a)) return false                                // 8.1 - control all the connected spaces
	if ((G.adv_new & (1 << a)) && !ignore_new) return false                 // 8.0 - Can only be used the round *after* control is gained
	if ((G.adv_exhaust & (1 << a)) && !ignore_exhaustion) return false      // 8.1 - Exhausted when used
	if (is_advantage_conflicted(a)) return false                            // 8.1 - can't be used if any conflict markers, but remains "controlled"
	if (G.adv_used >= 2) return false                                       // 8.2 - Can only use 2 advantages per action round
	if (G.adv_regions & (1 << get_advantage_region(a))) return false        // 8.2 - Can only use 1 advantage in a region per action round
	return true
}


function has_any_eligible_advantages(who) {
	if (G.adv_used >= 2) return false
	for (let a = 0; a < NUM_ADVANTAGES; a++) {
		if (!has_advantage_eligible(who, a)) continue
		return true
	}
	return false
}


/* 8.0 - Advantages */
function update_advantages(silent = false) {
	for (var a = 0; a < NUM_ADVANTAGES; a++) {
		var old = G.advantages[a]
		G.advantages[a] = whose_advantage(a)

		if (old !== G.advantages[a]) {
			G.adv_new |= (1 << a)
			if (!silent) {
				if (G.advantages[a] !== NONE) {
					let msg = "ADVANTAGE Gained"
					msg += "\n" + say_advantage(a, G.advantages[a], true)
					log_box_begin(G.advantages[a], msg, LOG_BOX_ADVANTAGE, true)
					//log(data.flags[G.advantages[a]].name + " GAINS " + data.advantages[a].name + " Advantage")
					log_box_end(LOG_BOX_ADVANTAGE)
				} else {
					let msg = "ADVANTAGE Lost"
					msg += "\n" + say_advantage(a, G.advantages[a], true)
					log_box_begin(G.advantages[a], msg, LOG_BOX_ADVANTAGE, true)
					log(data.flags[old].name + " lost Advantage.")
					log_box_end(LOG_BOX_ADVANTAGE)
				}
			}
		}
	}
}

function advantages_acquired_last_round_now_available() // a sort of awkward name, but otherwise hard to distinguish from "exhausted"/refreshed advantage state
{
	G.adv_new = 0
}


function beginning_of_era() {
	return ([PEACE_TURN_1, PEACE_TURN_3, PEACE_TURN_5].includes(G.turn))
}

function current_era() {
	if (G.turn < PEACE_TURN_3) return SUCCESSION_ERA
	if (G.turn < PEACE_TURN_5) return EMPIRE_ERA
	return REVOLUTION_ERA
}

/* 7.6 and Setup - BONUS WAR TILE LAYOUT */
function add_next_war_bonus_tiles() {
	G.bonus_war = [ [], [] ]
	let base = (G.next_war - 1) * (NUM_BONUS_WAR_TILES * 2)
	for (var i = 0; i < NUM_BONUS_WAR_TILES; i++) {
		G.bonus_war[FRANCE].push(base + i)
		G.bonus_war[BRITAIN].push(base + i + NUM_BONUS_WAR_TILES)
	}
	shuffle(G.bonus_war[FRANCE])
	shuffle(G.bonus_war[BRITAIN])

	// None in any theaters
	G.theater_bonus = [[[], [], [], [], []], [[], [], [], [], []]]
}


function draw_basic_war_tile(who, theater) {
	if (G.basic_war[who].length < 1) return -1
	shuffle(G.basic_war[who])
	let tile = G.basic_war[who].pop()
	G.theater_basic[who][theater].push(tile)
	return tile
}

function draw_bonus_war_tile(who, theater) {
	if (G.bonus_war[who].length < 1) return -1
	shuffle(G.bonus_war[who])
	let tile = G.bonus_war[who].pop()
	G.theater_bonus[who][theater].push(tile)
	return tile
}

/* 3.8 - CONFLICT MARKERS */

const CONFLICT_NONE = 0
const CONFLICT_NORMAL = 1
const CONFLICT_PLUS_ONE = 2

function has_conflict_marker(s) {
	return get_conflict_marker(s) > 0
}

function get_conflict_marker(s) {
	return map_get(G.conflicts, s, CONFLICT_NONE)
}

function add_conflict_marker(s, n = CONFLICT_NORMAL) {
	if (n === CONFLICT_NONE) {
		remove_conflict_marker(s)
	} else {
		map_set(G.conflicts, s, n)
		mark_dirty_conflict(s)
		log ("Conflict added at " + say_space(s) + ((n > CONFLICT_NORMAL) ? " (+1 to remove)." : "."))
	}
	update_flag_counts()
}

function remove_conflict_marker(s, silent = false, bold_it = false) {
	if (!silent && has_conflict_marker(s)) log (bold("Conflict removed at " + say_space(s) + ".", bold_it))
	mark_dirty(s)
	mark_dirty_conflict(s)
	map_delete(G.conflicts, s)
	update_flag_counts()
}


// Only Markets and Political spaces can have Conflict markers
function can_have_conflict_marker(s) {
	return (data.spaces[s].type === MARKET) || (data.spaces[s].type === POLITICAL)
}


/* 3.2.5 DAMAGED FORTS */
function is_damaged_fort(s) {
	return set_has(G.damaged_forts, s)
}

function set_damaged_fort(s, damage = true, bold_it = false)
{
	if (!damage) {
		set_delete(G.damaged_forts, s)
	} else {
		set_add(G.damaged_forts, s)
		log (bold("Fort damaged at " + say_space(s) + ".", bold_it))
	}
}

/* New World Huguenots */

function has_huguenots(s)
{
	return G.huguenots.includes(s)
}

function has_spent_huguenots(s)
{
	return G.huguenots_spent.includes(s)
}

function has_fresh_huguenots(s)
{
	return has_huguenots(s) && !has_spent_huguenots(s)
}

function add_huguenots(s)
{
	if (data.spaces[s].type !== TERRITORY) {
		throw new Error("Tried to add Huguenots to a space that isn't a territory: " + data.spaces[s].name)
	}
	if ((data.spaces[s].region !== REGION_NORTH_AMERICA) && (data.spaces[s].region !== REGION_CARIBBEAN)) {
		throw new Error("Tried to add Huguenots outside of North America and Caribbean")
	}
	if (has_huguenots(s)) {
		let msg = "Tried to add Huguenots to a space that already has them: " + data.spaces[s].name
		console.error(msg)
		if (globalThis.RTT_FUZZER) throw new Error(msg)
		return
	}
	if (G.flags[s] !== FRANCE) {
		throw new Error("Tried to add Huguenots to a space that isn't FR-flagged: " + data.spaces[s].name)
	}

	G.huguenots.push(s)
}

function remove_huguenots(s)
{
	array_delete_item(G.huguenots, s)
	array_delete_item(G.huguenots_spent, s)
}

function expend_huguenots(s)
{
	if (!has_huguenots(s)) {
		throw new Error("Tried to spend Huguenots from a space that doesn't contain any: " + data.spaces[s].name)
	}
	if (has_spent_huguenots(s)) {
		throw new Error("Tried to spend Huguenots from a space where they're already spent: " + data.spaces[s].name)
	}

	G.huguenots_spent.push(s)
}

function any_huguenots_in_region(region) {
	for (let s = data.regions[region].first_space; s < data.regions[region].first_space + data.regions[region].spaces; s++) {
		if (has_fresh_huguenots(s)) return true
	}
	return false
}

function refresh_huguenots() {
	if (G.huguenots_spent.length > 0) {
		log(bold("New World Huguenots refreshed."))
	}
	G.huguenots_spent = []
}



/* 5.4.1 Isolated Market flags */
function is_isolated_market(s) {
	return set_has (G.isolated_markets, s)
}

function set_isolated_market(s, isolated = true)
{
	if (!isolated) {
		set_delete(G.isolated_markets, s)
	} else {
		set_add(G.isolated_markets, s)
	}
}



function say_navy_box() {
	return italic("Navy Box (France: " + G.navy_box[FRANCE] + ", Britain: " + G.navy_box[BRITAIN] + ")")
}


function say_stuff(key, id, who, all_caps)
{
	let msg = key
	if (all_caps) msg += key
	if (who >= 0) msg += (who === FRANCE) ? "F" : "B"
	msg += id
	return msg
}

function say_advantage(a, who = -1, all_caps = false)
{
	return say_stuff("A", a, who, all_caps)
}

function say_event(e, who = -1, all_caps = false)
{
	return say_stuff("E", e, who, all_caps)
}

function say_ministry(m, who = -1, all_caps = false)
{
	return say_stuff("M", m, who, all_caps)
}

function say_demand(d, who = -1, all_caps = false) {
	return say_stuff("D", d, who, all_caps)
}


function encode_value(v)
{
	let msg = ""
	if (v < 100) msg += 0        // Because some tile names start with a digit, need to make sure we pad out to the maximum digits that the escape_square_brackets function checks
	if (v < 10) msg += 0
	msg += v
	return msg
}

function encode_who(who) {
	return (((who >= 0) && (who !== NONE)) ? ((who === FRANCE) ? "F" : "B") : "X")
}

// Emits a string in team color
function say_nation(msg, who = -1)
{
	return "[F" + encode_who(who) + msg + "]"
}


// Emits a player's own name in team color
function say_player(who = -1) {
	return "[Y" + encode_who(who) + "]"
}


function say_spending(msg, who = -1) {
	return "[$" + encode_who(who) + msg + "]"
}


function say_inv(t, who = -1)
{
	return "[i" + encode_who(who) + encode_value(t) + "]"
}

function say_space(s, who = -1)
{
	return "[S" + encode_who(who) + encode_value(s) + "]"
}


function say_ministry_header()
{
	return say_action_header(say_ministry(G.ministry_id, -1, true) + ": ")
}



function who_from_basic(t) {
	if (t < 16) return FRANCE
	return BRITAIN
}

function say_basic_war_tile(t, color = true) {
	let val = data.basic_war_tiles[t].val
	let msg = "[b" + encode_who((color ? who_from_basic(t) : NONE)) + encode_value(t) + ((val >= 0) ? "+" + val : val)
	switch (data.basic_war_tiles[t].type) {
		case WAR_DEBT:
			msg += " with Debt"
			break
		case WAR_FORT:
			msg += " with Fort/Fleet"
			break
		case WAR_FLAG:
			msg += " with Flag"
			break
	}
	msg += "]"
	return msg
}


function who_from_bonus(t) {
	if ((t/12) & 1) return BRITAIN
	return FRANCE
}

function say_bonus_war_tile(t, color = true) {
	let name = data.bonus_war_tiles[t].name
	let val = data.bonus_war_tiles[t].val
	let msg = "[B" + encode_who((color ? who_from_bonus(t) : NONE)) + encode_value(t) + name + " (+" + val + ")"
	switch (data.bonus_war_tiles[t].type) {
		case WAR_DEBT:
			msg += " with Debt"
			break
		case WAR_FORT:
			msg += " with Fort/Fleet"
			break
	}
	msg += "]"
	return msg
}


function say_scroll_to_war() {
	return "[V]"
}


function say_action_header(msg = null)
{
	if (msg !== null) return bold(msg)
	return bold(G.action_header?.toUpperCase() ?? "")
}

function say_action(msg)
{
	return bold (msg)
}

function say_action_points_left() {
	return "[P]" // Action points are parsed on the client side to allow user preferences
}


function say_action_points(num, type, plus = false, force_num = true)
{
	let msg = plus ? "+" : ""
	let doing_num = ((num > 0) || force_num || plus)
	msg += "[@" + type + "]"
	if (doing_num) msg += num
	msg += "[a" + type + (doing_num ? s(num) : "") + "]"
	return msg
}


// Returns which squadron token a player has at a particular space (or first one from navy box or unbuilt). Used only to animate squadrons between spaces.
function get_squadron_token(who, s)
{
	for (let sq = 0; sq < NUM_SQUADRONS; sq++) {
		if (G.squadrons[who][sq] === s) return sq
	}
	validate_squadrons("FOUND SQUADRON MISSING")
	report_squadrons("No squadron found for space: " + s)
	return 0
}

// Changes the location of a squadron token (used only to animate squadrons between spaces)
// The negative "off board locations" are allowed as well as space numbers
function move_squadron_token(who, from, to)
{
	G.squadrons[who][get_squadron_token(who, from)] = to
}



/* 4.0 - GAME SEQUENCE */

P.main = script (`
	for G.turn in 0 to 9 {
		if (data.turns[G.turn].war) {
			call war_turn
		} else {
			call peace_turn
		}
	}
`)


P.preliminaries = script(`
	if (L.scenario === "Bid for sides") {
		call bid_for_sides { options: L.options }
	} else {
		eval { preset_handicap(L.scenario) }
	}
	goto main
`)

const HANDICAP_TABLE = {
	"Britain +1 TRP": { side: BRITAIN, bid: 1 },
	"Britain +2 TRP": { side: BRITAIN, bid: 2 },
	"Britain +3 TRP": { side: BRITAIN, bid: 3 },
	"Britain +4 TRP": { side: BRITAIN, bid: 4 },
	"Britain +5 TRP": { side: BRITAIN, bid: 5 },
	"France +1 TRP": { side: FRANCE, bid: 1 },
	"France +2 TRP": { side: FRANCE, bid: 2 },
	"France +3 TRP": { side: FRANCE, bid: 3 },
	"France +4 TRP": { side: FRANCE, bid: 4 },
	"France +5 TRP": { side: FRANCE, bid: 5 },
	"Britain +1 TRP (Bid)": { side: BRITAIN, bid: 1 },
	"Britain +2 TRP (Bid)": { side: BRITAIN, bid: 2 },
	"Britain +3 TRP (Bid)": { side: BRITAIN, bid: 3 },
	"Britain +4 TRP (Bid)": { side: BRITAIN, bid: 4 },
	"Britain +5 TRP (Bid)": { side: BRITAIN, bid: 5 },
	"France +1 TRP (Bid)": { side: FRANCE, bid: 1 },
	"France +2 TRP (Bid)": { side: FRANCE, bid: 2 },
	"France +3 TRP (Bid)": { side: FRANCE, bid: 3 },
	"France +4 TRP (Bid)": { side: FRANCE, bid: 4 },
	"France +5 TRP (Bid)": { side: FRANCE, bid: 5 },
}

function preset_handicap(scenario)
{
	if (scenario !== "Standard" && scenario !== "Standard (Bid)") {
		var { side, bid } = HANDICAP_TABLE[scenario]
		log("#Setup")
		log(say_nation(ROLES[side], side) + " received " + bid + " treaty point" + s(bid) + ".")
		G.treaty_points[side] += bid
	}
}

/* Naughty naughty code. Baaaaaaad.
function swap_sides(text) // Presently only bothers to support "one player name per log line", which is all I presently emit. For more robust a "do" loop like in escape_square_brackets() in play.js
{
	let match = text.match(/\[.*?]/)        // Get the whole expression including the brackets
	if (!match) return text
	let inside = match[0].match(/\[(.*?)]/) // Get the inside-the-brackets bit.
	let type = inside[1][0]                 // First character tells us what type of thing (S = Spending, A = Award, I = Investment, P = action points)
	if (type !== "Y") return text           // We only want to flip the bit on player names sequences
	let who_key = inside[1][1]              // Second character tells us what nation color to use, if any
	who_key = (who_key === "F") ? "B" : (who_key === "B") ? "F" : "X" // Flip the player color character
	let substitute = "[Y" + who_key + "]" // Construct the opposite version of the player name code
	text = text.replace(/\[.*?]/, substitute)   // Stick it back in the string
	return text
}
*/


P.bid_for_sides = {
	_begin() {
		if (L.options.tournament) {
			G.active = 0                // In tournaments whoever gets the top slot bids first (this ensures an even number of "first bids" for each player in the tournament)
		} else {
			G.active = random(2)  // In pickup games it's random who bids first
		}

		L.current_bid = -1
		L.current_bidder = NONE
		L.bid_for_side = NONE
		L.final_confirmation = false
		L.bidding_for_sides = true // for client voodoo

		log ("#Bid for Sides")
		//log ("First bidder: " + say_player(G.active) + ".")
		log ("First bidder: " + say_nation("Player " + (G.active + 1), G.active))
	},
	prompt() {
		var i
		if (L.final_confirmation) {
			V.prompt = bold("BIDDING FOR SIDES: Confirm accepting " + L.current_bid + " treaty point" + s(L.current_bid) + " and playing as " + data.flags[1 - L.bid_for_side].name + "?")
			button("confirm")
		} else if (L.bid_for_side === NONE) {
			V.prompt = bold("BIDDING FOR SIDES: Which side would you prefer to play?")
			button("france")
			button("britain")
		} else if (L.current_bidder === NONE) {
			V.prompt = bold("BIDDING FOR SIDES: How many treaty points will you bid (give to " + data.flags[1 - L.bid_for_side].name + ") in order to play " + data.flags[L.bid_for_side].name + "?")
			for (i = 0; i <= 5; ++i)
				action("bid", i)
		} else if (L.current_bidder !== R) {
			V.prompt = bold("BIDDING FOR SIDES: Your opponent bids " + L.current_bid + " treaty point" + s(L.current_bid) + " to play " + data.flags[L.bid_for_side].name + ". Accept or bid higher?")
			button ("accept")
			for (i = L.current_bid + 1; i < 5; ++i)
				action("bid", i)
		} else {
			V.prompt = bold("BIDDING FOR SIDES: Confirm bidding " + L.current_bid + " treaty point" + s(L.current_bid) + " to play " + data.flags[L.bid_for_side].name + "?")
			button("confirm")
		}
	},
	accept() {
		push_undo()
		L.final_confirmation = true
	},
	confirm() {
		if (!L.final_confirmation) {
			log(bold(say_nation("Player " + (G.active + 1), G.active) + " bid +" + L.current_bid + " TRP for " + say_nation(data.flags[L.bid_for_side].name, L.bid_for_side) + "."))
			G.active = 1 - G.active
		} else {
			log (bold(say_nation("Player " + (G.active + 1), G.active) + " has accepted the bid."))

			let msg = say_player(1 - L.bid_for_side) + " will play " + say_nation(data.flags[1 - L.bid_for_side].name, 1 - L.bid_for_side)
			if (L.current_bid > 0) {
				msg += " with +" + L.current_bid + " TRP at start."
			} else {
				msg += "."
			}
			log (bold(msg))
			msg = say_player(L.bid_for_side) + " will play " + say_nation(data.flags[L.bid_for_side].name, L.bid_for_side) + "."
			log (bold(msg))
			if (L.current_bid > 0) {
				G.bid = L.current_bid
				G.handicap_side = 1 - L.bid_for_side
				G.treaty_points[G.handicap_side] += L.current_bid
			} else {
				G.bid = 0
				G.handicap_side = NONE
			}

			var scenario
			if (0) {
				// new scenario name without (Bid) suffix
				if (G.handicap_side === BRITAIN)
					scenario = "Britain +" + G.bid + " TRP"
				else if (G.handicap_side === FRANCE)
					scenario = "France +" + G.bid + " TRP"
				else
					scenario = "Standard"
			} else {
				if (G.handicap_side === BRITAIN)
					scenario = "Britain +" + G.bid + " TRP (Bid)"
				else if (G.handicap_side === FRANCE)
					scenario = "France +" + G.bid + " TRP (Bid)"
				else
					scenario = "Standard (Bid)"
			}

			if (L.current_bidder !== L.bid_for_side) {
				log (italic("Player colours swapped."))
				G.$pie = { swap: true, scenario }
			} else {
				G.$pie = { swap: false, scenario }
			}

			end()
		}
	},
	bid(n) {
		push_undo()
		L.current_bid = n
		L.current_bidder = G.active
	},
	france() {
		push_undo()
		L.bid_for_side = FRANCE
	},
	britain() {
		push_undo()
		L.bid_for_side = BRITAIN
	},
}



// Start a beginning-of-turn log-review stack. Each push point saves a copy of the view & an index into the log, so that players can review changes in game state step-by-step (and in parallel with each other), but without having to stop and wait for each other
// at every single step along the way.
function review_begin()
{
	review_end()

	G.review_index = []
	G.review_phase = []
	G.review_view  = []
	G.review_step  = [ 0, 0 ]
}

// Push another phase name onto the beginning of turn log-review stack (but only if something happened in the log that phase)
function review_push(phase)
{
	if ((G.review_index.length === 0) || (G.review_index.at(-1) < G.log.length - 1)) {
		G.review_index.push(G.log.length - 1)
		G.review_phase.push(phase)
		if (G.temp_view) delete G.temp_view

		// Get latest view for each player, and store it
		let views = []
		on_view(FRANCE)
		views[FRANCE] = copy_view_without_log(V)
		on_view(BRITAIN)
		views[BRITAIN] = copy_view_without_log(V)
		G.review_view.push(views)
	}
}


function review_compile()
{
	// Compute latest view for each player - we need to store this pair to diff against, while the review progresses. Better than storing e.g. 5 pairs!
	G.current_view = []
	for (let who = FRANCE; who <= BRITAIN; who++) {
		on_view(who)
		G.current_view[who] = copy_view_without_log(V)
	}

	// Diff a delta against latest view for each of the review steps, and store only delta (successive deltas in reverse order back from current view)
	for (let index = 0; index < G.review_view.length; index++) {
		for (let who = FRANCE; who <= BRITAIN; who++) {
			if (index === G.review_view.length - 1) {
				G.review_view[index][who] = object_diff(G.current_view[who], G.review_view[index][who])
			} else {
				G.review_view[index][who] = object_diff(G.review_view[index + 1][who], G.review_view[index][who])
			}
		}
	}
}


function review_step(step, who)
{
	if (G.current_view === undefined) {
		review_compile()
	}

	if (step < G.review_index.length) {
		G.log_hide_after[who] = G.review_index[step]
		if (G.temp_view === undefined) G.temp_view = [ -1, -1 ]
		G.temp_view[who] = step
		if (who === R) on_view()
	} else {
		G.log_hide_after[who] = -1
		if (G.temp_view !== undefined) {
			G.temp_view[who] = -1
		}
		if (who === R) on_view()
	}
}

function review_end() {
	G.log_hide_after = [ -1, -1 ]        // Clear any log-hiding
	delete G.temp_view                   // Clear any temporary view
	G.review_view = []                   // Clear any stored views
	G.review_index = []                  // Clear the indices: since we often detect whether a review is in progress by the length of it.
	G.review_phase = []                  // Clear the strings from the game state
	delete G.current_view                // Clear stored current-views
}

function start_of_peace_turn() {
	log ("#TURN " + data.turns[G.turn].id + "\n" + data.turns[G.turn].dates)

	G.awards = []        // Clear any award markers left over from last turn
	G.global_demand = [] // Clear any demand markers left over from last turn
	G.played_event = -1  // Clear any "played event" still showing from last turn
	clear_bit(DID_THE_BRIG)

	review_begin()
	let msg = "START OF TURN " + data.turns[G.turn].id + ": PEACE. "
	if ((G.turn === PEACE_TURN_3) || (G.turn === PEACE_TURN_5)) {
		msg += " [Click] \"Done\" to add new event cards."
	} else {
		msg += " [Click] \"Done\" to draw awards chits."
	}
	review_push(msg)

	clear_dirty()
}

/* 4.1 - PEACE TURNS */

P.peace_turn = script (`
	eval { start_of_peace_turn()  }

	if (G.turn === PEACE_TURN_3 || G.turn === PEACE_TURN_5) {
		call deck_phase
		call debt_limit_increase_phase
	}
	call award_phase
	call global_demand_phase
	call reset_phase
	call deal_cards_phase
	call ministry_phase
	if (G.turn !== PEACE_TURN_1) {
		call initiative_phase
	}
	call action_phase
	call reduce_treaty_points_phase
	call resolve_remaining_powers
	call scoring_phase
	call victory_check_phase
	if (G.turn === PEACE_TURN_6) {
		call final_scoring_phase
		call game_over
	}
`)

/* 4.1.1 - DECK PHASE */

P.deck_phase = function () {

	if (beginning_of_era() && current_era() === EMPIRE_ERA) {
		for (var i = SUCCESSION_ERA_CARDS + 1; i <= EMPIRE_ERA_CARDS; i++)
			G.deck.push(i)
		log("=Deck Phase")
		log ("Empire Era events added to Event Deck.")
		log ("Shuffled Event Deck.")
		shuffle(G.deck)
		validate_decks("DECK PHASE")
	}

	if (beginning_of_era() && current_era() === REVOLUTION_ERA) {
		log("=Deck Phase")

		for (var who = FRANCE; who <= BRITAIN; who++) {
			for (var index = G.hand[who].length - 1; index >= 0; index--) {
				if (data.cards[G.hand[who][index]].era === SUCCESSION_ERA) {
					log ("Succession Era event discarded from " + data.flags[who].adj + " hand: " + say_event(G.hand[who][index], who) + " (see 4.1.1)")
					array_delete(G.hand[who], index)
				}
			}
		}

		//BR// NB - intentionally removed this as it technically is done a card at a time while drawing during Deal Cards Phase (4.1.6)
		/*
		log ("Succession Era events REMOVED from Event Deck")
		for (var index = G.deck.length - 1; index >= 0; index--) {
			if (data.cards[index].era === SUCCESSION_ERA) {
				G.deck.delete(index);
			}
		}
		*/

		for (let i = EMPIRE_ERA_CARDS + 1; i <= REVOLUTION_ERA_CARDS; i++)
			G.deck.push(i)
		log ("Revolution Era events added to Event Deck.")
		log ("Shuffled Event Deck.")
		shuffle(G.deck)
		validate_decks("DECK PHASE 2")
	}

	review_push("DECK PHASE: Review event deck changes.")
	end()
}

/* 4.1.2 - DEBT LIMIT INCREASE PHASE */

P.debt_limit_increase_phase = function () {
	if (beginning_of_era() && (current_era() !== SUCCESSION_ERA)) {
		log("=Debt Limit Increase Phase")
		log ("French " + say_spending("DEBT LIMIT", FRANCE) + " increased by 4.")
		log ("British " + say_spending("DEBT LIMIT", BRITAIN) + " increased by 4.")
		G.debt_limit[FRANCE]  += 4
		G.debt_limit[BRITAIN] += 4
	}
	review_push ("DEBT LIMIT INCREASE PHASE: Debt Limits increased by 4.")
	end()
}

/* 4.1.3 - AWARD PHASE */

P.award_phase = function () {
	log("=Award Phase")

	// Really it should either be 0 or it should be NUM_REGIONS or NUM_REGIONS * 2
	if (G.award_chits.length < NUM_REGIONS) {
		for (var i = 0; i < NUM_AWARD_TILES; i++) {
			G.award_chits.push(i)
		}
		shuffle(G.award_chits)
	}

	let msg = "AWARD PHASE: Review new award chits ("
	let any = false

	// Deal one per region
	let codes = "~a"
	for (let region = 0; region < NUM_REGIONS; region++) {
		let chit = G.award_chits.pop()
		G.awards[region] = chit
		codes += chit

		if (any) msg += "; "
		any = true
		msg += data.regions[region].name + ": " + data.awards[chit].name
	}
	log(codes) // Displays the awards in the log

	msg += ")."

	review_push (msg)
	end()
}

/* 4.1.4 - GLOBAL DEMAND PHASE */

P.global_demand_phase = function () {
	log("=Global Demand Phase")

	var global_demand_chits = []
	for (let i = 0; i < NUM_DEMANDS; i++)
		global_demand_chits.push(i)
	shuffle(global_demand_chits)

	let msg = "GLOBAL DEMAND PHASE: Review new global demands ("
	let any = false

	G.global_demand = []
	let codes = "~d"
	for (let i = 0; i < 3; i++) {
		let chit = global_demand_chits.pop()
		G.global_demand.push(chit)
		codes += chit

		if (any) msg += ", "
		any = true
		msg += say_demand(chit)
	}
	log(codes) // Displays the demands in the log

	msg += ")."

	review_push (msg)
	end()
}


/* 4.1.5 - RESET PHASE */

P.reset_phase = function () {
	if (G.turn !== PEACE_TURN_1) {
		log("=Reset Phase")
		log ("All exhausted advantages refreshed.")
		log ("All exhausted ministries refreshed.")
		log ("Remaining investments from previous turn moved to Used Investments.")
	}

	// remove exhausted from advantage and ministry cards
	G.adv_exhaust = 0 // Bitflags

	// Tracks exhaustion markers for ministries. Some ministries have more than one exhaustible sub-ability, indexed 0, 1
	// <br><b>
	// if (set_has(G.ministry_exhausted, idx + (ability * NUM_MINISTRY_CARDS))) ... do something if ministry is exhausted
	G.ministry_exhausted   = [ [], [] ]

	// move investments to used
	for (var i of G.inv_avail)
		G.inv_used.push(i)
	G.inv_avail = []
	G.inv_played = []

	G.played_tiles = [ [], [] ]

	// British navies return from jail
	if ((G.the_brig !== undefined) && (G.the_brig > 0)) {
		for (let sq = 0; sq < NUM_SQUADRONS; sq++) {
			if (G.squadrons[BRITAIN][sq] !== SPACE_THE_BRIG) continue
			G.squadrons[BRITAIN][sq] = SPACE_NAVY_BOX
		}
		G.navy_box[BRITAIN] += G.the_brig
		log (bold(G.the_brig + " British Squadron" + s(G.the_brig) + " returned to the Navy Box."))
		log (say_navy_box())
	}
	G.the_brig = 0
	G.townshend_acts = -1
	set_bit(DID_THE_BRIG)

	review_push("RESET PHASE: Advantages and Ministries refreshed.")
	end()
}


function log_dealt(dealt) {
	for (let whom = FRANCE; whom <= BRITAIN; whom++) {
		if (dealt[whom] > 0) log (dealt[whom] + " card" + s(dealt[whom]) + " dealt to " + data.flags[whom].name + ".")
	}
}



/* 4.1.6 - DEAL CARDS PHASE */

P.deal_cards_phase = function () {
	log("=Deal Cards Phase")

	// At beginning of new era don't leave ministry display confusingly full of last-era's ministry cards while choosing which event cards to keep.
	// This is a minor deviation (but inconsequential from an effects standpoint) from rules-as-written but otherwise people accidentally choose
	// events that match their old ministers, etc. If they want to remember their old ministers they can still look back in log, but there's no
	// game value anyway.
	if (beginning_of_era()) G.ministry = [ [ ], [ ] ]

	while (G.inv_avail.length < 9) {
		if (G.inv_stack.length === 0) {
			log("Reshuffled investment tiles.")
			G.inv_stack = G.inv_used
			G.inv_used = []
			shuffle(G.inv_stack)
		}
		G.inv_avail.push(G.inv_stack.pop())
	}

	// Deal 3 event cards to each player. If we run out of cards, reshuffle any discards. Show # cards dealt in a way that documents who got "reshuffles" if anyone
	var dealt = [0, 0]
	for (var i = 0; i < 3; ++i) {
		for (let who = FRANCE; who <= BRITAIN; who++) {
			let smelt_it_dealt_it = false
			do {
				if (G.deck.length === 0) {
					log_dealt(dealt)
					dealt = [0, 0]
					log (bold("Discard Pile shuffled to form new Event Deck."))
					validate_decks("BEFORE DEAL CARDS")
					G.deck = G.discard_pile.slice()
					G.discard_pile = []
					shuffle(G.deck)
					validate_decks("DEAL CARDS PHASE")
				}

				// I don't think this should actually ever happen, but this is how we'd move on from that situation if it did
				if (G.deck.length === 0) {
					log_dealt(dealt)
					log (bold("Event deck EMPTY."))
					G.active = [ FRANCE, BRITAIN ]
					goto ("deal_cards_discard")
					return
				}

				let c = G.deck.pop()
				if ((data.cards[c].era === SUCCESSION_ERA) && (current_era() === REVOLUTION_ERA)) {
					log ("Succession Era event card removed from game: " + say_event(c, NONE))
				} else {
					smelt_it_dealt_it = true
					G.hand[who].push(c)
					dealt[who]++
				}
			} while (!smelt_it_dealt_it)
		}
	}
	log_dealt(dealt)

	G.active = [ FRANCE, BRITAIN ]
	goto("deal_cards_discard")
}

P.deal_cards_discard = {
	_begin() {
		L.discarded = [ [], [] ]
		review_step(0, FRANCE)
		review_step(0, BRITAIN)
	},
	inactive() {
		if (R < 0) {
			return "review newly drawn Event cards"
		} if (G.review_step[1-R] < G.review_index.length) {
			return "review start-of-turn phases"
		} else if (G.hand[1-R] < 3) {
			return "review newly drawn Event cards"
		} else {
			return "discard down to three Event cards"
		}
	},
	prompt() {
		if (G.review_step[R] < G.review_index.length) {
			V.prompt = say_action_header(G.review_phase[G.review_step[R]])
			//V.prompt += bold(" [Click] \"Done\" to proceed to next phase.")
			button ("done")
		} else {
			if (beginning_of_era()) show_all_ministry_cards(false)
			if (G.hand[R].length > 3) {
				V.prompt = say_action_header("DEAL CARDS PHASE: ") + say_action("Discard down to three Event cards.")

				let any = false
				for (const c of G.hand[R]) {
					if (any) {
						V.prompt += ", "
					} else {
						V.prompt += " ("
					}
					V.prompt += say_event(c)
					any = true
				}
				if (any) V.prompt += ")"

				for (var c of G.hand[R])
					action_event_card(c)
			} else {
				V.prompt = say_action_header("DEAL CARDS PHASE: ") + say_action("Review newly drawn Event cards.")
				let any = false
				for (const c of G.hand[R]) {
					if (any) {
						V.prompt += ", "
					} else {
						V.prompt += " ("
					}
					V.prompt += say_event(c)
					any = true
				}
				if (any) V.prompt += ")"

				button("confirm")
			}
		}
		if (G.review_step[R] > 0) button ("undo")
	},
	event_card(c) {
		array_delete_item(G.hand[R], c)
		L.discarded[R].push(c)
	},
	done() {
		review_step(++G.review_step[R], R)
	},
	undo() {
		if (L.discarded[R].length > 0) {
			G.hand[R].push(L.discarded[R].pop())
		} else if (G.review_step[R] > 0) {
			review_step(--G.review_step[R], R)
		}
	},
	confirm() {
		set_delete(G.active, R)
		if (G.active.length === 0) {
			review_end()
			// Only when both players are finished do we "reveal" the cards discarded (which are now public information). We also need to maintain a discard pile because it occasionally reshuffles late in the game
			for (var who = FRANCE; who <= BRITAIN; who++) {
				for (let c of L.discarded[who]) {
					log(data.flags[who].name + " discards " + say_event(c, who) + ".")
					G.discard_pile.push(c)
				}
			}
			end()
		}
	},
}


function num_ministry_slots(who)
{
	if ((who === FRANCE) && !is_bit(JACOBITE_DEFEAT) && is_bit(JACOBITES_ALWAYS)) return 3
	return 2
}


/* 4.1.7 - MINISTRY PHASE */

P.ministry_phase = function () {
	if (!beginning_of_era()) {
		goto ("replace_ministry_cards")
	} else {
		G.ministry           = [ [ ], [ ] ]

		// For each player, a flag whether the ministry in the specific ministry slot has been revealed
		// <br><b>
		// G.ministry_revealed[FRANCE][0] </b> is true if the ministry in France's first slot has been revealed
		G.ministry_revealed  = [ [ FALSE, FALSE, FALSE ], [ FALSE, FALSE ] ]

		if (is_bit(JACOBITES_ALWAYS) && !is_bit(JACOBITE_DEFEAT)) {
			G.ministry[FRANCE].push(JACOBITE_UPRISINGS)
			G.ministry_revealed[FRANCE][0] = TRUE
		}

		// Tracks exhaustion markers for ministries. Some ministries have more than one exhaustible sub-ability, indexed 0, 1
		// <br><b>
		// set_has(G.ministry_exhausted[who], idx + (ability * NUM_MINISTRY_CARDS))
		G.ministry_exhausted = [ [], [] ]

		G.active = [ FRANCE, BRITAIN ]
		goto("choose_ministry_cards")
	}
}


// When player has an option to pick a new minister, this shows the ministry window and actions all the eligible cards
function show_all_ministry_cards(action = true)
{
	V.all_ministries = []
	V.choosing_ministries = action
	for (var m of data.ministries) {
		if (m.side === R && !G.ministry[R].includes(m.num)) {
			if ((m.num === JACOBITE_UPRISINGS) && is_bit(JACOBITES_NEVER)) continue
			if (m.era.includes(current_era())) {
				V.all_ministries.push(m.num)
				if (G.ministry[R].length < num_ministry_slots(R)) {
					if (action) action_ministry_card(m.num)
				}
			}
		}
	}
}


P.choose_ministry_cards = {
	inactive() {
		if ((R >= 0) && G.ministry[1-R].length < num_ministry_slots(R)) {
			return "choose two ministry cards"
		} else {
			return "confirm choice of ministries"
		}
	},
	prompt() {
		if (G.ministry[R].length < num_ministry_slots(R)) {
			V.prompt = say_action_header("MINISTRY PHASE: ") + say_action("Choose two ministry cards.")
		} else {
			V.prompt = say_action_header("MINISTRY PHASE: ") + say_action("Confirm choice of ministries: ")
			var any = false
			var list = ""
			for (const i of G.ministry[R]) {
				if (any) list += ", "
				list += say_ministry(i)
				any = true
			}
			if (any) list += "."
			V.prompt += say_action(list)
		}
		show_all_ministry_cards()
		if (G.ministry[R].length > 0) {
			if ((G.ministry[R].length > 1) || !G.ministry_revealed[R][0]) { // Don't let FR player "undo" perma-Jacobites at beginning of Turn 5
				button("undo")
			}
		}
		if (G.ministry[R].length === num_ministry_slots(R))
			button("confirm")
	},
	ministry_card(c) {
		G.ministry[R].push(c)
		G.ministry_revealed[R].push(FALSE)
	},
	undo() {
		G.ministry[R].pop()
		G.ministry_revealed[R].pop()
	},
	confirm() {
		set_delete(G.active, R)
		if (G.active.length === 0)
			end()
	},
}


function announce_ministry_changes()
{
	let any = false
	for (let who = FRANCE; who <= BRITAIN; who++)
	{
		let num_changed = 0
		for (const m of L.original_ministry[who]) {
			if (!G.ministry[who].includes(m)) num_changed++
		}

		if (num_changed) {
			if (!any) log ("=Ministry Phase")
			log (data.flags[who].name+ " replaced " + num_changed + " Ministr" + ((num_changed === 1) ? "y" : "ies") + ".")
			any = true
		}
	}
}


P.replace_ministry_cards = {
	_begin() {
		G.active = [ FRANCE, BRITAIN ]
		L.added_jacobites = false

		if (is_bit(JACOBITES_ALWAYS) && !is_bit(JACOBITE_DEFEAT)) {
			if (!G.ministry[FRANCE].includes(JACOBITE_UPRISINGS)) {
				G.ministry[FRANCE].unshift(JACOBITE_UPRISINGS)
				G.ministry_revealed[FRANCE].unshift(TRUE)
				L.added_jacobites = true
			}
		}

		L.replacing = [ 0, 0 ]
		L.original_ministry = G.ministry
		L.original_revealed = G.ministry_revealed
		L.any_changes = [ false, false ]
	},
	inactive: "confirm or replace ministries",
	prompt() {
		let any_hidden = 0
		for (let i = 0; i < G.ministry[R].length; i++) {
			if (!G.ministry_revealed[R][i]) any_hidden++
		}
		if (L.replacing[R]) {
			V.prompt = say_action_header("MINISTRY PHASE: ")
			show_all_ministry_cards()

			let any = false
			for (let i = 0; i < G.ministry[R].length; i++) {
				if (G.ministry_revealed[R][i]) continue
				action_ministry_card(G.ministry[R][i])
				any = true
			}

			if (any) {
				V.prompt += say_action("Select unrevealed ministry to replace OR a replacement ministry.")
			} else {
				V.prompt += say_action("Choose a replacement ministry.")
			}

			button ("undo")
		}
		else if (!any_hidden) {
			V.prompt = say_action_header("MINISTRY PHASE: ") + ((L.added_jacobites && (R === FRANCE)) ? say_action("Jacobite Uprisings added as 3rd ministry. ") : "") + say_action("No ministries eligible for mid-era replacement (see 4.1.7).")
			button("confirm")
		}
		else {
			V.prompt = say_action_header("MINISTRY PHASE: ") + ((L.added_jacobites && (R === FRANCE)) ? say_action("Jacobite Uprisings added as 3rd ministry. ") : "") + say_action("Select any unrevealed ministries you wish to replace, or ")
			if (!L.any_changes[R]) {
				V.prompt += say_action("pass to keep current ones.")
				button("pass")
			} else {
				V.prompt += say_action(" confirm your choices.")
				button("confirm")
			}

			for (let i = 0; i < G.ministry_revealed[R].length; i++) {
				if (G.ministry_revealed[R][i]) continue
				action_ministry_card(G.ministry[R][i])
			}
			if (L.any_changes[R]) button ("undo")
		}
	},
	ministry_card(m) {
		if (G.ministry[R].includes(m)) {
			L.any_changes[R] = true
			let index = G.ministry[R].indexOf(m)
			array_delete(G.ministry[R], index)
			array_delete(G.ministry_revealed[R], index)
			L.replacing[R]++
		} else {
			L.replacing[R]--
			G.ministry[R].push(m)
			G.ministry_revealed[R].push(FALSE)
		}
	},
	undo() {
		G.ministry[R] = L.original_ministry[R]
		G.ministry_revealed[R] = L.original_revealed[R]
		L.any_changes[R] = false
		L.replacing[R] = 0
	},
	confirm() {
		set_delete(G.active, R)
		if (G.active.length === 0) {
			announce_ministry_changes()
			end()
		}
	},
	pass() {
		set_delete(G.active, R)
		if (G.active.length === 0) {
			announce_ministry_changes()
			end()
		}
	}
}

// Ministry is active if it's one of the player's ministry cards AND it has been revealed
function has_active_ministry(who, m)
{
	if (!G.ministry[who].includes(m)) return false
	let idx = G.ministry[who].indexOf(m)
	return G.ministry_revealed[who][idx]
}

// True if this is one of the specified player's ministries (possibly still face down)
function has_ministry(who, m, require_face_up = false)
{
	return require_face_up ? has_active_ministry(who, m) : G.ministry[who].includes(m)
}

// True if the player has a ministry keyword somewhere in his ministry. Possibly face down.
function has_keyword(who, k)
{
	if (k === KEYWORD_NONE) return true
	for (const m of G.ministry[who]) {
		for (const keyword of data.ministries[m].keywords) {
			if (keyword === k) return true
		}
	}
	return false
}


// True if the player has the ministry keyword on an *active* (face up) ministry
function has_active_keyword(who, k)
{
	if (k === KEYWORD_NONE) return true
	for (const m of G.ministry[who]) {
		let index = G.ministry[who].indexOf(m)
		if (!G.ministry_revealed[who][index]) continue
		for (const keyword of data.ministries[m].keywords) {
			if (keyword === k) return true
		}
	}
	return false
}


// True if the player has the ministry keyword on an *active* (face up) ministry
function has_inactive_keyword(who, k)
{
	if (k === KEYWORD_NONE) return true
	for (const m of G.ministry[who]) {
		let index = G.ministry[who].indexOf(m)
		if (G.ministry_revealed[who][index]) continue
		for (const keyword of data.ministries[m].keywords) {
			if (keyword === k) return true
		}
	}
	return false
}



// Used to figure out which (if any) of a player's ministers he could flip to gain the specified keyword
function get_minister_for_keyword(who, k)
{
	if (k === KEYWORD_NONE) return -1
	for (const m of G.ministry[who]) {
		for (const keyword of data.ministries[m].keywords) {
			if (keyword === k) return m
		}
	}
	return -1
}


// True if specified player has the specified ministry AND it is currently still hidden
function has_inactive_ministry (who, m)
{
	if (!G.ministry[who].includes(m)) return false
	let idx = G.ministry[who].indexOf(m)
	return !G.ministry_revealed[who][idx]
}


// Player can expend an advantage to enable (or improve) the action he is trying to do. Give him the choice.
function require_advantage(who, a, why, optional = false)
{
	clear_bit(USED_REQUIRED_ADVANTAGE) // Will set true later if the player chooses to activate the advantage requested
	if (!has_advantage_eligible(who, a)) return // If we got here w/o eligibility for the advantage, then fail out

	// The specific advantage tile we're currently dealing with
	G.advantage = a

	// String reason why the player might want to expend the advantage
	G.advantage_required_because = why

	// True if player can still accomplish his desired action w/o expending the advantage
	set_bit(ADVANTAGE_OPTIONAL, optional)
	call ("advantage_is_required")
}

P.advantage_is_required = script (`
	call confirm_use_advantage
	eval {
		set_bit(USED_REQUIRED_ADVANTAGE, !has_advantage_eligible(R, G.advantage))
	}
`)



P.confirm_use_advantage = {
	_begin() {
		if (!has_advantage_eligible(R, G.advantage)) end()
	},
	inactive: "use an advantage",
	prompt() {
		V.prompt = say_action_header() + say_action("Use " + data.advantages[G.advantage].name + " Advantage?")
		if ((G.advantage_required_because !== undefined) && (G.advantage_required_because !== "")) V.prompt += " (" + G.advantage_required_because + ")"
		V.prompt += say_action_points_left()
		button("use_advantage")
		if (is_bit(ADVANTAGE_OPTIONAL)) button("dont_use_advantage")
	},
	use_advantage() {
		push_undo()
		G.adv_used++
		G.adv_regions |= (1 << get_advantage_region(G.advantage))
		exhaust_advantage(G.advantage, true, G.advantage_required_because)
		end()
	},
	dont_use_advantage() {
		push_undo()
		end()
	}
}


P.ask_about_huguenots = {
	inactive: "contemplate Huguenots",
	prompt() {
		V.prompt = say_action_header() + say_action("Flip a Huguenot in same region to reduce action cost by 1, or pass.") + say_action_points_left()
		let region = data.spaces[G.active_space].region
		for (let s = 0; s < NUM_SPACES; s++) {
			if (data.spaces[s].region !== region) continue
			if (!has_fresh_huguenots(s)) continue
			action_space(s)
		}
		button("pass")
	},
	space(s) {
		push_undo()
		expend_huguenots(s)
		log (italic("France flipped Huguenots at " + say_space(s) + " to reduce cost to flag " + say_space(G.active_space) + " by 1."))
		end()
	},
	pass() {
		push_undo()
		clear_bit(ELIGIBLE_FOR_HUGUENOTS)
		end()
	}
}


// Player needs to flip a hidden ministry to qualify for what he wants to do. Give him the choice...
// "optional" means the player could still execute the action (perhaps more expensively) without it, so a "Don't Reveal" option is given; otherwise must either Reveal or Undo
function require_ministry(who, m, why, optional = false, prompt_to_exhaust = false, leave_log_box_open = false)
{
	// True if the player (now) has the requested/required ministry revealed and thus active
	delete G.has_required_ministry
	if (has_active_ministry(who, m)) {
		G.has_required_ministry = TRUE
		set_bit(MINISTRY_ALREADY_REVEALED)
	}
	else {
		if (!has_ministry(who, m)) {
			G.has_required_ministry = FALSE
		}
		clear_bit(MINISTRY_ALREADY_REVEALED)
	}

	// "m" card id of the ministry card being used (e.g. John Law is 2)
	G.ministry_id = m

	// Which of the player's two minister cards is being used (always 0 or 1)
	G.ministry_index = G.ministry[who].indexOf(m)

	// String reason ministry is required or helpful in current action
	G.ministry_required_because = why

	// True if player can conceivably accomplish current action without revealing the ministry
	set_bit(MINISTRY_OPTIONAL, optional)

	// True if, finding the ministry already revealed, we should prompt the player whether he wants to exhaust the ministry now
	set_bit(MINISTRY_PROMPT_TO_EXHAUST, prompt_to_exhaust)

	// True if, after opening a log box when revealing and/or exhausting a minister, it should be left open
	set_bit(LEAVE_LOG_BOX_OPEN, leave_log_box_open)

	call ("ministry_is_required")
}


function require_ministry_unexhausted(who, m, why, ability = 0, optional = false, prompt_to_exhaust = false, leave_log_box_open = false)
{
	if (is_ministry_exhausted(who, m, ability)) {
		G.has_required_ministry = FALSE
		return
	}
	G.ministry_ability = ability
	require_ministry(who, m, why, optional, prompt_to_exhaust, leave_log_box_open)
}


P.ministry_is_required = script (`
	eval { clear_bit(STARTED_MINISTRY_BOX) }
	call confirm_reveal_ministry
	eval {
		if (is_bit(MINISTRY_PROMPT_TO_EXHAUST) && !is_ministry_exhausted(R, G.ministry_id, G.ministry_ability)) {
			G.has_required_ministry = FALSE
		} else {
			G.has_required_ministry = G.ministry_revealed[R][G.ministry_index] ? TRUE : FALSE
		}
		if (is_bit(STARTED_MINISTRY_BOX) && !is_bit(LEAVE_LOG_BOX_OPEN)) {
			log_box_end(LOG_BOX_MINISTRY) // In case we revealed any ministries
				clear_bit(STARTED_MINISTRY_BOX)
		}
	}
`)

// True if ministry is presently exhausted
// Some ministries have more than one separately exhaustible ability (in which case can pass a different "ability" number)
function is_ministry_exhausted (who, m, ability = 0)
{
	if (!G.ministry[who].includes(m)) return false
	var idx = G.ministry[who].indexOf(m)
	if (Array.isArray(G.ministry_exhausted[0])) {
		return set_has(G.ministry_exhausted[who], idx + (ability * ((G.game_state_created_with < 2) ? OLD_NUM_MINISTRY_CARDS : NUM_MINISTRY_CARDS)))
	} else {
		G.ministry_exhausted = [ [], [] ]
	}
}

function is_ministry_fully_exhausted(who, m)
{
	for (let i = 0; i < data.ministries[m].abilities; i++) {
		if (!is_ministry_exhausted(who, m, i)) return false
	}
	return true
}

function is_ministry_partially_exhausted(who, m)
{
	for (let i = 0; i < data.ministries[m].abilities; i++) {
		if (is_ministry_exhausted(who, m, i)) return true
	}
	return false
}


// Exhausts the specific ability of a ministry
function exhaust_ministry (who, m, ability = 0, silent = false)
{
	if (!G.ministry[who].includes(m)) return
	if (is_ministry_exhausted(who, m, ability)) return
	var idx = G.ministry[who].indexOf(m)

	if (!Array.isArray(G.ministry_exhausted[0])) {
		G.ministry_exhausted = [ [], [] ]
	}

	set_add(G.ministry_exhausted[who], idx + (ability * ((G.game_state_created_with < 2) ? OLD_NUM_MINISTRY_CARDS : NUM_MINISTRY_CARDS)))

	if (!silent) {
		let msg = "Ministry Exhausted"
		if (!is_log_box(LOG_BOX_MINISTRY)) {
			msg += ": " + say_ministry(m, who)
		}
		if (data.ministries[m].abilities > 1) {
			msg += " (Ability #" + (ability + 1) + ")"
		}
		log(msg)
	}
}


// Refreshes a ministry (or ministry sub-ability)
function refresh_ministry (who, m, ability = 0)
{
	if (!G.ministry[who].includes(m)) return
	var idx = G.ministry[who].indexOf(m)

	if (!Array.isArray(G.ministry_exhausted[0])) {
		G.ministry_exhausted = [ [], [] ]
	}

	set_delete(G.ministry_exhausted[who], idx + (ability * ((G.game_state_created_with < 2) ? OLD_NUM_MINISTRY_CARDS : NUM_MINISTRY_CARDS)))
}



/* 4.1.8 - INITIATIVE PHASE */

P.initiative_phase = function () {
	log("=Initiative Phase")
	if ((G.vp < 15) || (G.turn === PEACE_TURN_1)) {
		log("Initiative to France.")
		G.initiative = FRANCE
	} else if (G.vp > 15) {
		log("Initiative to Britain.")
		G.initiative = BRITAIN
	} else {
		if (G.initiative === FRANCE) {
			log("France retained the initiative.")
		}
		else {
			log ("Britain retained the initiative.")
		}
	}
	end()
}

function start_action_phase() {
	clear_bit(SKIPPED_EVENT)
	//("START ACTION PHASE: " + data.turns[G.turn].name)
}

/* 4.1.9 - ACTION PHASE */

P.action_phase = script (`
	log ("=Action Phase")
	eval { start_action_phase() }
	set G.active G.initiative
	call choose_first_player
	call confirm_first_player
	for G.round in 1 to 4 {
		call action_round
		set G.active (1-G.active)
		call action_round
		set G.active (1-G.active)
	}
`)

function tell_first_player_choice()
{
	log ("First player: " + data.flags[G.first_player].name)
}

P.choose_first_player = {
	inactive: "choose who will go first this turn",
	prompt() {
		V.prompt = say_action_header("INITIATIVE PHASE: ") + say_action("Choose who will go first in each action round this turn.")
		button("france")
		button("britain")
	},
	france() {
		push_undo()
		G.first_player = FRANCE
		tell_first_player_choice()
		end()
	},
	britain() {
		push_undo()
		G.first_player = BRITAIN
		tell_first_player_choice()
		end()
	},
	space(s) {
		push_undo()
		G.first_player = G.flags[s]
		tell_first_player_choice()
		end()
	},
}

P.confirm_first_player = {
	_begin() {
		// Don't need a confirmation step if player picks himself - head straight into his turn
		if (G.first_player === R) {
			G.active = G.first_player
			end()
		}
	},
	inactive: "confirm choice of first player",
	prompt() {
		V.prompt = say_action_header("INITIATIVE PHASE: ") + say_action("Confirm choice of first player: " + data.flags[G.first_player].name + ".")
		button("confirm")
	},
	confirm() {
		push_undo() //... just going to get cleared anyway?
		G.active = G.first_player
		end()
	},
}


/* 4.1.10 - ACTION PHASE */

P.reduce_treaty_points_phase = function () {
	var any = false
	if (G.treaty_points[FRANCE] > 4) {
		log ("=Reduce Treaty Points Phase")
		log ("French treaty points reduced from " + G.treaty_points[FRANCE] + " to 4.")
		G.treaty_points[FRANCE] = 4
		any = true
	}
	if (G.treaty_points[BRITAIN] > 4) {
		if (!any) log ("=Reduce Treaty Points Phase")
		log ("British treaty points reduced from " + G.treaty_points[BRITAIN] + " to 4.")
		G.treaty_points[BRITAIN] = 4
	}
	end()
}


function has_unconflicted(s, who)
{
	return (G.flags[s] === who) && !has_conflict_marker(s)
}

/* 4.1.11 - ACTION PHASE */

P.resolve_remaining_powers = function () {
	let announced = false

	if (has_active_ministry(FRANCE, JOHN_LAW)) {
		let debt_reduction = 1
		if (has_unconflicted(SCOTLAND_1, FRANCE) || has_unconflicted(SCOTLAND_2, FRANCE)) debt_reduction++
		debt_reduction = Math.min(debt_reduction, G.debt[FRANCE])
		if (debt_reduction > 0) {
			G.debt[FRANCE] -= debt_reduction

			if (!announced) {
				announced = true
				log("=Resolve Remaining Powers Phase")
			}
			log_box_ministry(FRANCE, JOHN_LAW)
			log(bold(say_spending("French debt", FRANCE) + " reduced by " + debt_reduction + "."))
			log_box_end(LOG_BOX_MINISTRY)
		}
	}

	end()
}


function debt_winner()
{
	if (available_debt(FRANCE) > available_debt(BRITAIN) + 1) return FRANCE
	if (available_debt(BRITAIN) > available_debt(FRANCE) + 1) return BRITAIN
	return NONE
}


function debt_delta()
{
	return Math.abs(available_debt(FRANCE) - available_debt(BRITAIN))
}

function debt_award()
{
	return Math.min(4, Math.floor(debt_delta() / 2))
}


function get_winner(france, britain)
{
	if (france > britain) return FRANCE
	if (britain > france) return BRITAIN
	return NONE
}

function region_flag_winner(region)
{
	return get_winner(G.flag_count[FRANCE][region], G.flag_count[BRITAIN][region])
}

function region_flag_delta(region)
{
	return Math.abs(G.flag_count[FRANCE][region] - G.flag_count[BRITAIN][region])
}

function prestige_winner()
{
	return get_winner(G.prestige_flags[FRANCE], G.prestige_flags[BRITAIN])
}

function prestige_flag_delta()
{
	return Math.abs(G.prestige_flags[FRANCE] - G.prestige_flags[BRITAIN])
}

function demand_flag_winner(demand)
{
	return get_winner(G.demand_flag_count[FRANCE][demand], G.demand_flag_count[BRITAIN][demand])
}

function demand_flag_delta(demand)
{
	return Math.abs(G.demand_flag_count[FRANCE][demand] - G.demand_flag_count[BRITAIN][demand])
}


function ensure_arrays()
{
	if (G.temp_vp === undefined) {
		G.temp_vp = [ G.vp, G. vp ]
		G.temp_trp = [ G.treaty_points, G.treaty_points ]
		G.temp_debt = [ G.debt, G.debt ]
	} else if (!Array.isArray(G.temp_vp)) {
		G.temp_vp = [ G.temp_vp, G.temp_vp ]
		G.temp_trp = [ G.temp_trp, G.temp_trp ]
		G.temp_debt = [ G.temp_debt, G.temp_debt ]
	}
}

function adjust_scoring_view_start(who)
{
	ensure_arrays()
	G.temp_trp[who] = G.scoring_start_trp
	G.temp_vp[who] = G.scoring_start_vp
	G.temp_debt[who] = G.scoring_start_debt ?? (Array.isArray(G.scoring_demand_debt) ? (G.scoring_demand_debt[0] ?? G.debt) : G.debt)
}

function adjust_scoring_view_prestige(who)
{
	adjust_scoring_view_start(who)
	if (L.score_prestige >= 0) {
		G.temp_vp[who] = G.scoring_prestige_vp
		G.temp_debt = [ G.debt, G.debt ]
	}
}

// Causes the VP/TRP/Debt markers to be shown in adjusted positions (from mid-points in scoring phase)
function adjust_scoring_view_region(who)
{
	ensure_arrays()

	// Show VP markers temporarily at intermediate positions (during scoring phase)
	G.temp_vp[who]   = G.scoring_region_vp[L.region_ticker[R]]

	// Show TRP markers temporarily at intermediate positions (during scoring phase)
	G.temp_trp[who]  = G.scoring_region_trp[L.region_ticker[R]]

	// Show Debt markers temporarily at intermediate positions (during scoring phase)
	G.temp_debt[who] = G.scoring_start_debt ?? G.scoring_demand_debt[0] ?? G.debt
}


function adjust_scoring_view_demand(who)
{
	ensure_arrays()

	G.temp_vp[who]   = G.scoring_demand_vp[L.demand_ticker[R]]
	G.temp_trp[who]  = G.scoring_demand_trp[L.demand_ticker[R]]
	G.temp_debt[who] = G.scoring_demand_debt[L.demand_ticker[R]]
}


function adjust_scoring_done(who)
{
	ensure_arrays()

	G.temp_vp[who]   = G.vp
	G.temp_trp[who]  = G.treaty_points
	G.temp_debt[who] = G.debt
}


// Stop showing temporary VP/TRP/Debt values and revert to the true current ones
function close_scoring_view()
{
	delete G.temp_vp
	delete G.temp_trp
	delete G.temp_debt
}


// Each player now can review the scoring step by step (region by region, demand by demand). Each player clicks
// once for each step, and we reveal that part of the log to him. Neither player is blocked until they get to the end of all
// the scoring -- only then do they have to wait for the other player to catch up.
P.scoring_review = {
	_begin() {
		G.active = [ FRANCE, BRITAIN ]
		L.score_prestige = 0 // 0 = not done prestige, 1 = done prestige, -1 = backed up to very beginning of round *before* prestige
		L.region_ticker  = [0, 0] // How many regions each player has progressed through region scoring
		L.demand_ticker  = [0, 0] // How many regions each player has progressed through demand scoring

		// Separate temp mini-view per-player, just like the Big Boy Review.
		G.temp_vp   = [ ]
		G.temp_trp  = [ ]
		G.temp_debt = [ ]
		adjust_scoring_view_start(FRANCE)
		adjust_scoring_view_start(BRITAIN)
	},
	inactive: "review scoring phase results",
	prompt() {
		let msg = say_action_header("SCORING PHASE: ")

		if (L.score_prestige < 0) {
			msg += say_action("Beginning of Scoring")
		} else if (L.score_prestige === 0) {
			msg += say_action("Review scoring for Prestige")
		} else if (L.region_ticker[R] < NUM_REGIONS) {
			msg += say_action("Review region scoring for " + data.regions[L.region_ticker[R]].name)
		} else if (L.demand_ticker[R] < G.global_demand.length) {
			let demands = G.global_demand.slice()
			demands.sort((a, b) => a - b)
			msg += say_action("Review demand scoring for " + data.demands[demands[L.demand_ticker[R]]].name)
		} else {
			msg += say_action("Review additional bonus scoring")
		}
		msg += "."

		V.prompt = msg
		button("done")
		if (L.score_prestige >= 0) button("undo")
	},
	done() {
		// Advance the appropriate ticker
		if (L.score_prestige < 1) {
			L.score_prestige++
		} else if (L.region_ticker[R] < NUM_REGIONS) {
			L.region_ticker[R]++
		} else if (L.demand_ticker[R] < G.global_demand.length) {
			L.demand_ticker[R]++
		} else {
			adjust_scoring_done(R)
		}

		// Update which part of the log we are hiding (and check if this player is done with this phase)
		let done = false
		if (L.score_prestige === 0) {
			G.log_hide_after[R] = G.scoring_prestige_index
			adjust_scoring_view_prestige(R)
		} else if (L.region_ticker[R] < NUM_REGIONS) {
			G.log_hide_after[R] = G.scoring_region_indices[L.region_ticker[R]]
			adjust_scoring_view_region(R)
		} else if (L.demand_ticker[R] < G.global_demand.length) {
			G.log_hide_after[R] = G.scoring_demand_indices[L.demand_ticker[R]]
			adjust_scoring_view_demand(R)
		} else {
			adjust_scoring_done(R)
			if (G.log_hide_after[R] === G.scoring_extra_index) { // This step may not even happen if nothing got written to the log in that step
				done = true
			} else {
				G.log_hide_after[R] = G.scoring_extra_index
			}
		}

		if (done) {
			set_delete(G.active, R)
			if (G.active.length === 0) {
				G.log_hide_after = [-1, -1] // Stop hiding any part of the log
				clear_dirty()
				close_scoring_view()
				end_of_scoring_phase()
				end()
			}
		}
	},
	undo() {
		if (L.demand_ticker[R] > 0) {
			L.demand_ticker[R]--
			G.log_hide_after[R] = G.scoring_demand_indices[L.demand_ticker[R]]
			adjust_scoring_view_demand(R)
		} else if (L.region_ticker[R] > 0) {
			L.region_ticker[R]--
			G.log_hide_after[R] = G.scoring_region_indices[L.region_ticker[R]]
			adjust_scoring_view_region(R)
		} else if (L.score_prestige > -1) {
			L.score_prestige--
			if (L.score_prestige === 0) {
				G.log_hide_after[R] = G.scoring_prestige_index
			} else {
				G.log_hide_after[R] = G.scoring_start_index
			}
			adjust_scoring_view_prestige(R)
		}
	}
}


function end_of_scoring_phase()
{
	delete G.scoring_demand_debt
	delete G.scoring_demand_trp
	delete G.scoring_demand_vp
	delete G.scoring_region_trp
	delete G.scoring_region_vp
	delete G.scoring_demand_indices
	delete G.scoring_region_indices
	delete G.scoring_start_trp
	delete G.scoring_start_vp
	delete G.scoring_start_index
	delete G.scoring_start_debt
}

/* 4.1.12 - SCORING PHASE */

P.scoring_phase = function () {
	log_box_end()
	log("=Scoring Phase")

	G.won_all_scorings = -1

	G.scoring_start_index    = G.log.length - 1
	G.scoring_start_vp       = G.vp
	G.scoring_start_trp      = G.treaty_points.slice()
	G.scoring_start_debt     = G.debt.slice()
	G.scoring_region_indices = []
	G.scoring_demand_indices = []
	G.scoring_region_vp   = []
	G.scoring_region_trp  = []
	G.scoring_demand_vp   = []
	G.scoring_demand_trp  = []
	G.scoring_demand_debt = []

	// Prestige awards are notionally done alongside the Europe award, so we go first with that.
	let winner = prestige_winner()
	if (winner !== NONE) {
		log_box_begin(winner, "Scoring: PRESTIGE" + "\n" + data.flags[winner].name + " +" + prestige_flag_delta() + " flags")

		award_vp(winner, 2)

		//if (G.won_all_scorings < 0) {
		//	G.won_all_scorings = winner
		//} else if (winner !== G.won_all_scorings) {
		//	G.won_all_scorings = NONE
		//}
	} else {
		log_box_begin(NONE, "Scoring: PRESTIGE " + "\n" + "TIE! No score.")
		//G.won_all_scorings = NONE
	}
	log_box_end()

	G.scoring_prestige_vp    = G.vp
	G.scoring_prestige_index = G.log.length - 1

	for (let region = 0; region < NUM_REGIONS; region++) {
		let award = G.awards[region]
		let winner = region_flag_winner(region)
		if (data.awards[award].by2 && region_flag_delta(region) < 2) winner = NONE

		if (winner !== NONE) {
			log_box_begin(winner, "Scoring: " + data.regions[region].name.toUpperCase() + "\n" + data.flags[winner].name + " +" + region_flag_delta(region) + " flags")
			let vp = data.awards[award].vp
			let trp = data.awards[award].trp
			if (region === REGION_EUROPE) {
				if (has_active_ministry(winner, COURT_OF_THE_SUN_KING)) {
					log(say_ministry(COURT_OF_THE_SUN_KING, winner) + " increased VP value of Europe award by +1.")
					vp++
				}
				if (has_active_ministry(winner, SAMUEL_JOHNSON)) {
					log(say_ministry(SAMUEL_JOHNSON, winner) + " increased VP value of Europe award by +1.")
					vp++
				} else if (has_active_ministry(1 - winner, SAMUEL_JOHNSON)) {
					if (vp > 0) {
						vp--
						log(say_ministry(SAMUEL_JOHNSON, winner) + " decreased VP value of Europe award by 1.")
					}
				}
			} else if (region === REGION_INDIA) {
				if (has_active_ministry(winner, DUPLEIX)) {
					log (say_ministry(DUPLEIX, winner) + " added an extra treaty point for India.")
					trp++
				}
			}

			award_vp(winner, vp)
			add_treaty_points(winner, trp)

			// Tracking if anybody won ALL the scorings
			if (G.won_all_scorings < 0) {
				G.won_all_scorings = winner
			} else if (winner !== G.won_all_scorings) {
				G.won_all_scorings = NONE
			}
		} else {
			log_box_begin(NONE, "Scoring: " + data.regions[region].name.toUpperCase() + "\n" +
				(!region_flag_delta(region) ? "TIE! No score." : "NO WINNER: " + data.flags[region_flag_winner(region)].name + " +" + region_flag_delta(region) + " Insufficient."))
			G.won_all_scorings = NONE
		}

		log_box_end()

		if (region === REGION_EUROPE) {
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
					log_box_ministry(FRANCE, VOLTAIRE)
					log("French prestige space in " + " multi-space countr" + ((multispace === 1) ? "y" : "ies") + ".")
					add_treaty_points(FRANCE, countries)
					log_box_end(LOG_BOX_MINISTRY)
				}
			}
		}

		G.scoring_region_indices.push(G.log.length - 1) // Bookmark in log how much to display when reviewing this score
		G.scoring_region_vp.push(G.vp)
		G.scoring_region_trp.push(G.treaty_points.slice())
	}

	for (let d = 0; d < NUM_DEMANDS; d++) {
		if (!G.global_demand.includes(d)) continue
		let winner = demand_flag_winner(d)
		if (winner !== NONE) {
			log_box_begin(winner, "Scoring: " + data.demands[d].name.toUpperCase() + "\n" + data.flags[winner].name + " +" + demand_flag_delta(d) + " flags")
			let vp = data.demands[d].awards[current_era()].vp
			let trp = data.demands[d].awards[current_era()].trp
			let debt = data.demands[d].awards[current_era()].debt

			if ((d === COTTON) || (d === SPICE)) {
				if (has_active_ministry(winner, DUPLEIX)) {
					log (say_ministry(DUPLEIX, winner) + " added an extra treaty point for " + data.demands[d].name + ".")
					trp++
				}
			}

			award_vp(winner, vp)
			add_treaty_points(winner, trp)
			if (debt < 0) {
				reduce_debt(winner, Math.abs(debt))
			} else if (debt > 0) {
				increase_debt(winner, debt)
			}

			// Tracking if anybody won ALL the scorings
			if (G.won_all_scorings < 0) {
				G.won_all_scorings = winner
			} else if (winner !== G.won_all_scorings) {
				G.won_all_scorings = NONE
			}
		} else {
			log_box_begin(winner, "Scoring: " + data.demands[d].name.toUpperCase() + "\n" + "TIE! No score.")
			G.won_all_scorings = NONE
		}
		log_box_end()

		G.scoring_demand_indices.push(G.log.length - 1) // Bookmark in log how much to display when reviewing this score
		G.scoring_demand_vp.push(G.vp)
		G.scoring_demand_trp.push(G.treaty_points.slice())
		G.scoring_demand_debt.push(G.debt.slice())
	}

	if (has_active_ministry(BRITAIN, EAST_INDIA_COMPANY)) {
		let vp = 0
		for (const a of [ TEXTILES, SILK, FRUIT, FUR_TRADE, RUM]) {
			if (has_advantage(BRITAIN, a) && !is_advantage_conflicted(a) && !is_advantage_exhausted(a)) {
				vp++
			}
		}
		vp = Math.min(vp, 3)
		log_box_begin((vp > 0) ? BRITAIN : NONE, bold("Bonus Scoring") + "\n" + say_ministry(EAST_INDIA_COMPANY, BRITAIN))
		award_vp(BRITAIN, vp)
		log_box_end()
	}

	G.scoring_extra_index = G.log.length - 1 // Bookmark in log how much to display when reviewing bonus scoring (NB: in this case just to know IF we have a bonus step with any content since the last bookmark)
	G.log_hide_after = [ G.scoring_prestige_index, G.scoring_prestige_index ] // We start by hiding all of the scoring part of the log except for the Prestige scoring

	goto ("scoring_review")
}

/* 4.1.13 - VICTORY CHECK PHASE */

P.victory_check_phase = function () {
	log ("=Victory Check Phase")
	if ((G.won_all_scorings !== NONE) && (G.won_all_scorings >= 0)) {
		let msg = bold(data.flags[G.won_all_scorings].name + " wins the game by winning all regional and demand scorings!")
		finish (G.won_all_scorings, msg)
	} else if (G.vp <= 0) {
		let msg = bold("Britain wins the game: VP 0 or fewer!")
		finish(BRITAIN, msg)
	} else if (G.vp >= 30) {
		let msg = bold("France wins the game: VP 30 or greater!")
		finish(FRANCE, msg)
	} else {
		log ("No automatic victory.")
		delete G.won_all_scorings
		end()
	}
}

/* 4.1.14 - FINAL SCORING PHASE */

P.final_scoring_phase = {
	_begin() {
		log_box_end()
		log("=Final Scoring Phase")

		clear_dirty()
		review_begin()
		review_push("Start of Final Scoring")

		let winner = prestige_winner()
		if (winner !== NONE) {
			log_box_begin(winner, "Final Scoring: PRESTIGE" + "\n" + data.flags[winner].name + " +" + prestige_flag_delta() + " flags")
			award_vp(winner, 2)
		} else {
			log_box_begin(NONE, "Final Scoring: PRESTIGE " + "\n" + "TIE! No score.")
		}
		log_box_end()
		review_push ("Review Final Prestige Scoring")

		winner = debt_winner()
		if (winner !== NONE) {
			log_box_begin(winner, "Final Scoring: DEBT" + "\n" + data.flags[winner].name + " " + debt_delta() + " more available debt.")
			award_vp(winner, debt_award())
		} else {
			log_box_begin(NONE, "Final Scoring: DEBT " + "\n" + "No score.")
		}
		log_box_end()
		review_push ("Review Final Debt Scoring")

		for (let d = 0; d < NUM_DEMANDS; d++) {
			winner = demand_flag_winner(d)
			if (winner !== NONE) {
				log_box_begin(winner, "Final Scoring: " + data.demands[d].name.toUpperCase() + "\n" + data.flags[winner].name + " +" + demand_flag_delta(d) + " flags")
				award_vp(winner, 1)
			} else {
				log_box_begin(winner, "Final Scoring: " + data.demands[d].name.toUpperCase() + "\n" + "TIE! No score.")
			}
			log_box_end()
			review_push ("Review Final " + data.demands[d].name + " Scoring")
		}

		let any = false
		for (const s of [ NORTHERN_COLONIES, CAROLINAS, JAMAICA, BARBADOS, MADRAS, CALCUTTA ]) {
			if ((G.flags[s] === FRANCE) || (G.flags[s] === USA)) {
				if (!any) {
					any = true
					log_box_begin (FRANCE, "Final Scoring: TERRITORIES")
				}
				award_vp(FRANCE, 2, false, "Control of " + say_space(s, FRANCE))
			}
		}
		if (any) log_box_end()

		any = false
		for (const s of [ ACADIA, QUEBEC_AND_MONTREAL, LOUISIANA, ST_DOMINGUE, GUADELOUPE, PONDICHERRY, CHANDERNAGORE ]) {
			if (G.flags[s] === BRITAIN) {
				if (!any) {
					any = true
					log_box_begin (BRITAIN, "Final Scoring: TERRITORIES")

				}
				award_vp(BRITAIN, 2, false, "Control of " + say_space(s, BRITAIN))
			}
		}
		if (any) log_box_end()

		// We start them seeing the first step, but they can rewind one further to the very beginning if they want to
		review_step(1, FRANCE)
		review_step(1, BRITAIN)

		G.active = [ FRANCE, BRITAIN ]
	},
	inactive: "review final scoring",
	prompt() {
		if (G.review_step[R] < G.review_index.length) {
			V.prompt = say_action_header(G.review_phase[G.review_step[R]] + ": Done.")
			button("done")
		} else {
			V.prompt = say_action_header ("FINAL SCORING: Done.")
			button("done")
		}
		if (G.review_step[R] > 0) button ("undo")
	},
	done() {
		if (G.review_step[R] < G.review_index.length) {
			review_step(++G.review_step[R], R)
		} else {
			set_delete(G.active, R)
			if (G.active.length === 0) {
				review_end()
				end()
			}
		}
	},
	undo() {
		if (G.review_step[R] > 0) {
			review_step(--G.review_step[R], R)
		}
	},
}


/* 2.4 - VICTORY */
P.game_over = function () {
	if (G.vp >= 16) {
		log ("=frGame Over")
		let msg = bold("France wins! VP marker at " + G.vp + "!")
		finish (FRANCE, msg)
	} else if (G.vp <= 14) {
		log ("=brGame Over")
		let msg = bold("Britain wins! VP marker at " + G.vp + "!")
		finish (BRITAIN, msg)
	} else {
		log ("=Game Over")
		let msg = bold("Victory points tied at 15.")
		log (msg)
		if (available_debt(FRANCE) > available_debt(BRITAIN)) {
			msg = bold("France wins! Tie-breaker: more available debt!")
			finish (FRANCE, msg)
		} else if (available_debt(BRITAIN) > available_debt(FRANCE)) {
			msg = bold("Britain wins! Tie-breaker: more available debt!")
			finish (BRITAIN, msg)
		} else {
			msg = bold("Available debt tied at " + available_debt(FRANCE) + ".")
			log (msg)
			msg = bold("Britain wins! Final tie-breaker!")
			finish (BRITAIN, msg)
		}
	}
}

/* 5.0 - ACTION ROUNDS */

P.action_round = script (`
	eval {
		start_action_round() // This is the official "start of action round" per the "Play Note" on p. 10 (beneath 5.1)
	}
	call select_investment_tile
	call action_round_core
	call before_end_of_action_round
	call end_of_action_round
	set G.played_tile -1
`)

function start_action_round() {
	G.subphase = BEFORE_PICKING_TILE

	// Certain effects care if we controlled particular spaces from beginning of action round
	// <br><b>
	// set_has(G.controlled, space)
	G.controlled = []
	for (var s = 0; s < NUM_SPACES; s++) {
		if (G.flags[s] !== G.active) continue
		set_add(G.controlled, s)
	}

	find_isolated_markets() // Markets are isolated for the whole action around if-and-only-if they're isolated at the beginning of the round

	// Advantages we acquired last round now "age in" and are available to be used. Any we acquire *after* this point won't be available until the following round
	update_advantages()
	advantages_acquired_last_round_now_available()
	G.adv_used = 0
	G.adv_regions = 0

	refresh_ministry(FRANCE, POMPADOUR_AND_DU_BARRY) // Pompadour and Du Barry works once per action round
	refresh_ministry(BRITAIN, JAMES_WATT) // James Watt once per action round
	refresh_ministry(BRITAIN, EDMUND_BURKE) // Edmund Burke's power works every time you use him

	G.bonuswar_bought = 0

	// Clear all the transient ability flags
	for (let ab = 0; ab < NUM_TRANSIENT_BITFLAGS; ab++) {
		set_transient(G.active, ab, false)
	}
}


function mark_dirty(s) {
	set_add(G.dirty, s)
}

function mark_dirty_conflict(s) {
	set_add(G.dirty_conflict, s)
}


function clear_dirty() {
	set_clear(G.dirty)
	set_clear(G.dirty_conflict)
	G.dirty_demand = 0
}

function mark_navy_this_war(s) {
	set_add(G.navy_this_war, s)
}

function clear_navy_this_war() {
	G.navy_this_war = []
}



function check_if_market_isolated(market)
{
	let who = G.flags[market]
	if ((who !== FRANCE) && (who !== BRITAIN)) return false // Ignore unflagged markets, Spain, etc.

	let connection_queue  = [ market ]
	let already_traversed = [ market ]
	let connected       = false

	while (!connected && connection_queue.length > 0) {
		var s = connection_queue.pop()
		if ((data.spaces[s].type === NAVAL) || (data.spaces[s].type === TERRITORY)) {
			if (G.flags[s] === who) connected = true
		}
		else if (data.spaces[s].type === FORT) {
			// NB - doesn't matter if fort is damaged
			if (G.flags[s] === who) connected = true
		}
		else if (data.spaces[s].type === MARKET) {
			if (G.flags[s] !== who) continue                           // Only trace through our own flagged markets
			if ((s !== market) && has_conflict_marker(s)) continue     // Can't trace through conflict marker, but original starting point can have conflict
			for (const connection of data.spaces[s].connects) {
				if (already_traversed.includes(connection)) continue   // Don't traverse things twice
				already_traversed.push(connection)
				connection_queue.unshift(connection)
			}
		}
	}

	return !connected
}



// Checks if a specified market (space) qualifies as isolated per 5.4.1
function check_and_mark_if_market_isolated(market)
{
	if (check_if_market_isolated(market)) {
		set_isolated_market(market)
	}
}

/* 5.4.1 - Identify Isolated Markets, and flag them for the Action Round */
function find_isolated_markets()
{
	// Set of isolated_market spaces, for the purposes of 5.4.1
	// <br><b>
	// set_has(G.isolated_markets, space)
	G.isolated_markets = []

	for (var s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== MARKET) continue
		check_and_mark_if_market_isolated(s)
	}
}

function is_action_phase()
{
	return G.subphase !== NOT_ACTION_PHASE
}


const RULE_UNFLAG_EUROPE        = "Unflagging in Europe only"
const RULE_NORTH_AMERICA        = "North America only"
const RULE_INDIA                = "India only"
const RULE_CARIBBEAN            = "Caribbean only"
const RULE_GERMAN_PRUSSIA_DUTCH = "German States, Prussia, or the Dutch Republic"
const RULE_EUROPE               = "Europe only"
const RULE_EUROPE_BURKE         = "Whole action entirely in Europe"
const RULE_UNFLAG_MARKETS       = "Unflagging markets only"
const RULE_MARKET_MARKET        = "Flag markets next to a BR-flagged market"
const RULE_SHIFT_NON_PRESTIGE   = "Shifting non-Prestige political spaces"
const RULE_WAR_TILE_OR_DEPLOY   = "Bonus War Tiles or Deploying Squadrons"
const RULE_SPAIN_AUSTRIA        = "Spain and/or Austria"
const RULE_SCOTLAND_IRELAND     = "Scotland and Ireland"

const SHORT_UNFLAG_EUROPE       = "Unflag Europe"
const SHORT_NORTH_AMERICA       = "N. Amer"
const SHORT_INDIA               = "India"
const SHORT_CARIBBEAN           = "Caribbean"
const SHORT_GERMAN_PRUSSIA_DUTCH= "Ge/Pr/Du"
const SHORT_EUROPE              = "Europe"
const SHORT_EUROPE_BURKE        = "All in Europe"
const SHORT_UNFLAG_MARKETS      = "Unflag Mkts"
const SHORT_MARKET_MARKET       = "Flg Mkt near BR-Mkt"
const SHORT_SHIFT_NON_PRESTIGE  = "Shift non-Prestige"
const SHORT_WAR_TILE_OR_DEPLOY  = "Buy Tile or Dply Sqdrn"
const SHORT_SPAIN_AUSTRIA       = "Spn/Aus"
const SHORT_SCOTLAND_IRELAND    = "Scot/Ire"


// Returns a list of presently-active contingent action point rules for which the specified space *qualifies* under the specified type
function space_rules(s, type, force_type = -1)
{
	let qualified_rules = []
	let matching_type = (force_type >= 0) ? force_type : (s >= 0) ? space_action_type(s) : -1

	if ((s >= 0) && (type === matching_type)) {
		for (let rule of active_rules()) {
			switch (rule) {
				case RULE_UNFLAG_EUROPE:
					if (data.spaces[s].region === REGION_EUROPE) {
						if (G.flags[s] !== NONE) {
							qualified_rules.push(rule)
						}
					}
					break
				case RULE_NORTH_AMERICA:
					if (data.spaces[s].region === REGION_NORTH_AMERICA) {
						qualified_rules.push(rule)
					}
					break
				case RULE_INDIA:
					if (data.spaces[s].region === REGION_INDIA) {
						qualified_rules.push(rule)
					}
					break
				case RULE_CARIBBEAN:
					if (data.spaces[s].region === REGION_CARIBBEAN) {
						qualified_rules.push(rule)
					}
					break
				case RULE_GERMAN_PRUSSIA_DUTCH:
					if ([ GERMAN_STATES_1, GERMAN_STATES_2, PRUSSIA_1, PRUSSIA_2, PRUSSIA_3, PRUSSIA_4, DUTCH_1, DUTCH_2 ].includes(s)) {
						qualified_rules.push(rule)
					}
					break
				case RULE_EUROPE:
					if (data.spaces[s].region === REGION_EUROPE) {
						qualified_rules.push(rule)
					}
					break
				case RULE_EUROPE_BURKE:
					if (data.spaces[s].region === REGION_EUROPE) {
						if (is_entirely_in_europe(type)) {
							qualified_rules.push(rule)
						}
					}
					break
				case RULE_UNFLAG_MARKETS:
					if (G.flags[s] !== NONE) {
						qualified_rules.push(rule)
					}
					break
				case RULE_MARKET_MARKET: // Alberoni's Ambition -- flag markets next to a BR-flagged market
					if ((G.flags[s] === NONE) && (data.spaces[s].connects !== undefined))  {
						for (const s2 of data.spaces[s].connects) {
							if (data.spaces[s2].type !== MARKET) continue
							if (G.flags[s2] !== BRITAIN) continue
							qualified_rules.push(rule)
							break
						}
					}
					break
				case RULE_SHIFT_NON_PRESTIGE:
					if (!data.spaces[s].prestige) qualified_rules.push(rule)
					break
				case RULE_WAR_TILE_OR_DEPLOY:
					if (data.spaces[s].type === NAVAL) {
						qualified_rules.push(rule)
					}
					break
				case RULE_SPAIN_AUSTRIA:
					if (is_spain(s) || is_austria(s)) {
						qualified_rules.push(rule)
					}
					break
				case RULE_SCOTLAND_IRELAND:
					if ([ SCOTLAND_1, SCOTLAND_2, IRELAND_1, IRELAND_2 ].includes(s)) {
						qualified_rules.push(rule)
					}
					break
			}
		}
	}

	return qualified_rules
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



// For one type of action points (ECON, DIPLO, MIL), add an amount of contingent points subject to a specific rule
// If action is "not_independent" then it isn't its own major/minor action but must instead be attached to another one
function add_contingent(type, amount, rule, short, not_independent = false) {
	let nat = false
	//if (!not_independent && (type === ECON) && !action_points_eligible_major(ECON, active_rules()) && has_transient(G.active, TRANSIENT_NORTH_AMERICAN_TRADE)) {
	//	amount++
	//	nat = true
	//}

	G.contingent.push({ type, amount, rule, short, not_independent })
	log ("+" + say_action_points(amount, type) + " (" + rule +")" + (nat ? " (North American Trade increased award)" : ""))
}

// Amount of contingent action points of the specified type (ECON, DIPLO, MIL) available based on array of rules we're eligible for (or a single rule)
function get_contingent(type, rules, require_independent = false)
{
	let amount = 0
	if ((rules !== undefined) && (rules !== null)) {
		if ((typeof rules !== "string") && (rules.constructor === Array)) {
			for (let i = 0; i < G.contingent.length; i++) {
				if (G.contingent[i].type !== type) continue
				let any = false
				for (const rule of rules) {
					if (G.contingent[i].rule !== rule) continue
					any = true
				}
				if (!any) continue
				if (require_independent) {
					if (G.contingent[i].not_independent) continue
				}
				amount += G.contingent[i].amount
			}
		} else {
			for (let i = 0; i < G.contingent.length; i++) {
				if (G.contingent[i].type !== type) continue
				if (G.contingent[i].rule !== rules) continue
				if (require_independent) {
					if (G.contingent[i].not_independent) continue
				}
				amount += G.contingent[i].amount
			}
		}
	}
	return amount
}

// True if ANY contingent action points of the specified type (ECON, DIPLO, MIL) theoretically available based on array of rules we're eligible for (or a single rule). Even if we've spent it all we can still use debt/TRPs in that category.
function any_contingent(type, rules, require_independent) {
	if ((rules !== undefined) && (rules !== null)) {
		if (rules.constructor === Array) {
			for (let rule of rules) {
				for (let i = 0; i < G.contingent.length; i++) {
					if (G.contingent[i].type !== type) continue
					if (G.contingent[i].rule !== rule) continue
					if (require_independent) {
						if (G.contingent[i].not_independent) continue
					}
					return true
				}
			}
		} else {
			for (let i = 0; i < G.contingent.length; i++) {
				if (G.contingent[i].type !== type) continue
				if (G.contingent[i].rule !== rules) continue
				if (require_independent) {
					if (G.contingent[i].not_independent) continue
				}
				return true
			}
		}
	}
	return false
}

// Use up contingent action points matching a specific rule, to the extent available. Returns amount that wasn't satisfied from contingent points (still to be paid)
function use_contingent(amount, type, rule)
{
	for (let i = 0; i < G.contingent.length; i++) {
		if (G.contingent[i].type !== type) continue
		if (G.contingent[i].rule !== rule) continue
		if (G.contingent[i].amount <= 0) continue
		while ((amount > 0) && (G.contingent[i].amount > 0)) {
			amount--
			G.contingent[i].amount--
		}
	}
	return amount
}


// When we've done a minor action of a type and aren't eligible for any major actions of the type, we drain any "non-independent" contingent points that would otherwise look like we could perform a second action of that type
function drain_non_independent(type, rule) {
	for (let i = 0; i < G.contingent.length; i++) {
		if (G.contingent[i].type !== type) continue
		if (G.contingent[i].rule !== rule) continue
		if (!G.contingent[i].not_independent) continue
		G.contingent[i].amount = 0
	}
}

// Adds unrestricted major action points of the specified type
function add_action_points(type, amount)
{
	let nat = false
	//if ((type === ECON) && !action_points_eligible_major(ECON, active_rules()) && has_transient(G.active, TRANSIENT_NORTH_AMERICAN_TRADE)) {
	//	amount++
	//	nat = true
	//}

	G.major[type] += amount
	G.eligible[type] = TRUE
	G.eligible_major[type] = TRUE
	log ("+" + say_action_points(amount, type) + (nat ? " (North American Trade increased award)" : ""))
}



function potential_burke_points(who)
{
	let points = 0
	if (has_unconflicted(IRELAND_1, BRITAIN)) points++
	if (has_unconflicted(IRELAND_2, BRITAIN)) points++
	return points
}

function burke_points(who)
{
	if (who !== BRITAIN) return 0
	if (!has_active_ministry(who, EDMUND_BURKE)) return 0
	return potential_burke_points(who)
}


// Active player has picked an investment tile.
function selected_a_tile(tile)
{
	advance_action_round_subphase(PICKED_TILE_OPTION_TO_PASS)

	log (((G.active === FRANCE ? "=fr" : "=br") + "Turn " + data.turns[G.turn].id + "\n" + "Action Round " + G.round + " (" + data.flags[G.active].adj + ")"))
	log (data.flags[G.active].name + " investment tile: ")
	log (say_inv(tile))
	//log (say_action_points_brief(data.investments[tile].majorval, data.investments[tile].majortype) + " / " + say_action_points_brief(data.investments[tile].minorval, data.investments[tile].minortype) + " " +
	//    parens(say_investment_tile(data.action_points[data.investments[tile].majortype].name + " / " + data.action_points[data.investments[tile].minortype].name, tile)))

	var major = data.investments[tile].majorval

	//BR// Maybe we'll copy the "dagger" and "snake" icons the actual tiles use? But for now at least...
	//if (major === 3) {
	//	log (say_investment_tile("Event allowed", tile))
	//} else if (major === 2) {
	//	log (say_investment_tile("Event allowed + Military Upgrade", tile))
	//}

	clear_dirty() // Clear highlights of opponent's previous round actions
	G.dirty_who = G.active

	G.played_event = -1 // Haven't played an event so far

	G.inv_played.push(tile)             //BR// We leave it in G.inv_avail but mark it played
	G.played_tiles[G.active][G.round-1] = tile  //BR// Mark the tile we played, the round we played it
	G.played_tile = tile
	set_bit(FLAG_MILITARY_UPGRADE, major <= 2)  // We get a military upgrade if we picked a tile w/ major action strength 2

	if (is_bit(FLAG_MILITARY_UPGRADE) && (G.turn === PEACE_TURN_6)) {
		clear_bit(FLAG_MILITARY_UPGRADE)
		log_br()
		log (data.flags[G.active].name + " gained " + say_spending("1 Treaty Point", G.active) + " for having a Military Upgrade symbol on Turn 6 (see 5.3.3).")
		add_treaty_points(G.active, 1, true)
	}

	// Major action point levels for the 3 types (ECON, DIPLO, MIL). We may get extra amounts from an event. Then we can increase our action points with debt/TRPs (but not in a category that is zero)
	G.major = [ 0, 0, 0 ]

	// Minor action point levels for the 3 types (ECON, DIPLO, MIL). We may get extra amounts from an event. Then we can increase our action points with debt/TRPs (but not in a category that is zero)
	G.minor = [ 0, 0, 0 ]

	G.major[data.investments[G.played_tile].majortype] = data.investments[G.played_tile].majorval
	G.minor[data.investments[G.played_tile].minortype] = data.investments[G.played_tile].minorval

	// Bonus points (ECON, DIPLO, MIL) committed during the current specific action (e.g. a bonus military point for Choiseul)
	G.committed = [ 0, 0, 0 ]

	// Contingent action points (e.g. restricted to an area)
	G.contingent = []

	// Type of action points we've bought on turn 6, if any
	G.bought_action_points = -1

	/* Action point eligibility */

	// We're eligible for a class of action if we had at least 1 point of it.
	// This controls whether we're allowed to use this category at all.
	// Initially set to what our tile gives us, but event cards could add other categories
	// <br><b>
	// if (G.eligible[DIPLO]) ...
	G.eligible = []

	// We're eligible for major action in an action point class if we had at least 1 point of major, either from our investment tile or from an event/ministry
	// <br><b>
	// if (G.eligible_major[ECON]) ...
	G.eligible_major = []
	for (var i = 0; i < NUM_ACTION_POINTS_TYPES; i++) {
		G.eligible[i]       = ((G.major[i] > 0) || (G.minor[i] > 0)) ? TRUE : FALSE
		G.eligible_major[i] = (G.major[i] > 0) ? TRUE : FALSE
	}

	// For each flavor of action points (though we only care about ECON and DIPLO), track how many different regions we've spent that flavor of points on during this tile.
	// This is for charging the "region switching" action point penalty
	// <br><b>
	// G.action_point_regions[ECON][...] </b> is a set containing all the regions we've spent ECON points in this round. Value has +NUM_REGIONS added if it was all minor action points.
	// <b>set_has(G.action_points[ECON], REGION_EUROPE) || set_has(G.action_points[ECON], REGION_EUROPE + NUM_REGIONS)</b>
	G.action_point_regions = [ [], [], [] ]

	if (G.eligible_major[DIPLO]) set_transient(G.active, TRANSIENT_TILE_MADE_DIPLO)
	if (G.eligible_major[ECON]) set_transient(G.active, TRANSIENT_TILE_MADE_ECON)

	// Ministries that increase action points right away

	if (has_active_ministry(G.active, EDMUND_BURKE) && !is_ministry_exhausted(G.active, EDMUND_BURKE)) {
		if (G.eligible_major[DIPLO]) {
			let points = burke_points(G.active)
			if (points > 0) {
				log_box_ministry(G.active, EDMUND_BURKE)
				add_contingent(DIPLO, points, RULE_EUROPE_BURKE, SHORT_EUROPE_BURKE, true)
				exhaust_ministry(G.active, EDMUND_BURKE)
				log_box_end(LOG_BOX_MINISTRY)
			}
		}
	}

	if (has_active_ministry(G.active, NORTH_AMERICAN_TRADE)) {
		if (G.demand_flag_count[FRANCE][FURS] + G.demand_flag_count[FRANCE][FISH] > G.demand_flag_count[BRITAIN][FURS] + G.demand_flag_count[BRITAIN][FISH]) {
			set_transient(G.active, TRANSIENT_NORTH_AMERICAN_TRADE)
			if (G.major[ECON]) G.major[ECON]++
			if (G.minor[ECON]) G.minor[ECON]++
			if (G.major[ECON] || G.minor[ECON]) {
				log_box_ministry(G.active, NORTH_AMERICAN_TRADE)
				log(say_action_points(1, ECON) + " (France more combined Fur and Fish markets)")
				log_box_end(LOG_BOX_MINISTRY)
				//log("North American Trade added " + say_action_points(1, ECON) + " (France more combined Fur and Fish markets).")
			}
		}
	}

	log_br()
}

// Player is picking an investment tile
P.select_investment_tile = {
	_begin() {
		// push_undo() // It was backing out from later points all the way to back to initiative?!
		L.tile_to_move = -1
		L.moved_any_tiles = false
		L.theaters = []
	},
	_resume() {
		log_box_end()
	},
	inactive() {
		if (G.theater_bonus[((G.active === "France") || (G.active === FRANCE)) ? FRANCE : BRITAIN][0].length) {
			return "place Austrian Succession bonus war tiles"
		} else {
			return "select an investment tile"
		}
	},
	prompt() {
		if (G.theater_bonus[R][0].length) {
			if (L.tile_to_move >= 0) {
				V.prompt = say_action_header("AUSTRIAN SUCCESSION BONUS: ") + say_action("Select theater in which to place " + say_bonus_war_tile(L.tile_to_move, false))
				for (const theater of free_theaters(R)) {
					action_theater(theater)
				}
			} else {
				V.prompt = say_action_header("AUSTRIAN SUCCESSION BONUS: ") + (L.moved_any_tiles ? say_action ("Select next bonus war tile to place") : say_action("Scroll down to War board and select a bonus war tile to place.") + say_scroll_to_war())
				for (const tile of G.theater_bonus[R][0]) {
					action_bonus_war_tile(tile)
				}
			}
		} else {
			V.prompt = say_action_header("ACTION ROUND " + G.round + ": ") + say_action("Select an investment tile or activate a ministry.")
			for (var tile of G.inv_avail) {
				if (G.inv_played.includes(tile)) continue
				action_investment(tile)
			}
			action_eligible_ministries()
		}
	},
	theater(theater) {
		push_undo()
		theater = display_to_theater(theater)
		L.moved_any_tiles = true
		if (L.theaters === undefined) L.theaters = []

		L.theaters.push(theater)
		G.theater_bonus[R][theater].push(L.tile_to_move)
		array_delete_item(G.theater_bonus[R][0], L.tile_to_move)
		L.tile_to_move = -1
		if (!G.theater_bonus[R][0].length) {
			let msg = bold("Austrian Succession: ") + data.flags[R].name + " received free bonus war tiles in theaters: "
			let any = false
			for (const th of L.theaters) {
				if (any) msg += ", "
				msg += th
				any = true
			}
			log(msg)
		}
	},
	bonus_war(tile) {
		push_undo()
		L.tile_to_move = tile
	},
	investment(tile) {
		push_undo()
		selected_a_tile(tile)
		goto ("after_selecting_tile")
	},
	ministry_card(m) {
		push_undo()
		handle_ministry_card_click(m)
	},
}


P.after_selecting_tile = script(`
	if ((R === FRANCE) && has_ministry(R, THE_CARDINAL_MINISTERS) && (cardinal_ministers_value() > 0) && G.eligible[DIPLO]) {
		eval { require_ministry_unexhausted(R, THE_CARDINAL_MINISTERS, "To gain " + say_action_points(cardinal_ministers_value(), DIPLO), 0, true, true) }
		if (G.has_required_ministry) {
			eval { use_cardinal_ministers() }
		}
	}
`)


// Player selects an event card to play
function handle_event_card_click(c) {
	G.played_event = c
	set_bit(LAST_EVENT_BY_BRITAIN, (R === BRITAIN))
	G.action_header = "PLAY EVENT: "

	if (data.cards[c].action !== WILD) {
		if (data.cards[c].action !== data.investments[G.played_tile].majortype) {
			if (has_ministry(R, BANK_OF_ENGLAND) && (data.cards[c].action === ECON) && !is_ministry_exhausted(R, BANK_OF_ENGLAND, 1)) {
				//NB: this gets exhausted later in the process
			} else {
				let msg = "Mismatched event play allowed without use of Bank of England ministry: " + data.cards[c].name
				console.error(msg)
				if (globalThis.RTT_FUZZER) throw new Error(msg)
			}
		}
	}

	if (data.investments[G.played_tile].majorval > 3) {
		if (has_ministry(R, MARQUIS_DE_CONDORCET) && !is_ministry_exhausted(R, MARQUIS_DE_CONDORCET)) {
			//NB: this gets exhausted later in the process
		} else {
			let msg = "Allowed play of event without an event symbol on investment tile: " + data.cards[c].name
			console.error(msg)
			if (globalThis.RTT_FUZZER) throw new Error(msg)
		}
	}

	call ("event_flow")
}


function event_made_diplo()
{
	if (!has_transient(R, TRANSIENT_EVENT_MADE_DIPLO)) {
		set_transient(R, TRANSIENT_EVENT_MADE_DIPLO)
		if (has_active_ministry(R, EDMUND_BURKE)) {
			if (!is_ministry_exhausted(R, EDMUND_BURKE)) exhaust_ministry(R, EDMUND_BURKE)
			add_contingent(DIPLO, burke_points(R), RULE_EUROPE_BURKE, SHORT_EUROPE_BURKE, true)
		}
	}
}

function event_made_econ(rule = null, short = null)
{
	if (!has_transient(R, TRANSIENT_EVENT_MADE_ECON)) {
		set_transient(R, TRANSIENT_EVENT_MADE_ECON)
		if (has_active_ministry(R, NORTH_AMERICAN_TRADE) && has_transient(R, TRANSIENT_NORTH_AMERICAN_TRADE)) {
			log_box_ministry(R, NORTH_AMERICAN_TRADE)
			if (rule === null) {
				add_action_points(ECON, 1)
			} else {
				add_contingent(ECON, 1, rule, short, true)
			}
			log_box_end(LOG_BOX_MINISTRY)
		}
	}
}


function begin_event_play(c) {
	advance_action_round_subphase(DURING_EVENT)
	G.played_events.push(c)
	array_delete_item(G.hand[R], c)

	let msg = ""
	msg += "EVENT"
	msg += "\n" + say_event(c, R, true)
	if (is_bit(QUALIFIES_FOR_BONUS)) {
		msg += "\n" + "(with Bonus)"
	} else if (is_bit(CARD_HAS_BONUS)) {
		msg += "\n" + "(no Bonus)"
	}

	log_box_begin(R, msg, LOG_BOX_EVENT)
}


function end_event_play(c)
{
	advance_action_round_subphase(BEFORE_SPENDING_ACTION_POINTS)
	G.action_header = ""
	log_box_end(LOG_BOX_EVENT)

	if (is_bit(QUALIFIES_FOR_BONUS) && has_active_ministry(G.active, LAVOISIER)) {
		G.major[data.investments[G.played_tile].majortype]++
		G.minor[data.investments[G.played_tile].minortype]++

		log_box_begin(G.active, say_ministry(LAVOISIER + "\n" + "Event Bonus Received", G.active), LOG_BOX_MINISTRY)
		log ("+" + say_action_points(1, data.investments[G.played_tile].majortype) + " (Major)")
		log ("+" + say_action_points(1, data.investments[G.played_tile].minortype) + " (Minor)")
		log_box_end(LOG_BOX_MINISTRY)
	}
}


function check_event_bonus_requirements(who) {
	// True if the event card played this turn has a bonus available on it
	clear_bit(CARD_HAS_BONUS)

	// True if we qualified for the bonus on the played event card
	clear_bit(QUALIFIES_FOR_BONUS)

	// If there's a ministry the player needs to flip in order to gain an event bonus or ministry discount, it is identified here by "m" value
	G.needs_to_flip_ministry = -1

	let keyword = data.cards[G.played_event].keyword
	if (keyword !== KEYWORD_NONE) {
		set_bit(CARD_HAS_BONUS)
		if (has_active_keyword(who, keyword)) {
			set_bit(QUALIFIES_FOR_BONUS)
		} else if (has_keyword(who, keyword)) {
			G.needs_to_flip_ministry = get_minister_for_keyword(who, keyword)
		}
	}

	if ([INTEREST_PAYMENTS, MILITARY_SPENDING_OVERRUNS, WEST_AFRICAN_GOLD_MINING, LA_GABELLE].includes(G.played_event)) {
		set_bit(CARD_HAS_BONUS)
		set_bit(QUALIFIES_FOR_BONUS, available_debt(who) > available_debt(1 - who))     // "You have more Available Debt than your opponent"
	}

	if ([DEBT_CRISIS, EUROPEAN_PANIC].includes(G.played_event)) {
		set_bit(CARD_HAS_BONUS)
		set_bit(QUALIFIES_FOR_BONUS, available_debt(who) > available_debt(1 - who) + 2) // "You have at least 3 more Available Debt than your opponent"
	}

	if ([CARIBBEAN_SLAVE_UNREST, HAITIAN_REVOLUTION].includes(G.played_event)) {
		set_bit(CARD_HAS_BONUS)
		if (G.turn < PEACE_TURN_6) {
			var tiles = [ 0, 0 ]
			for (let whom = FRANCE; whom <= BRITAIN; whom++) {
				for (let theater = 1; theater <= data.wars[G.next_war].theaters; theater++) { //NB intentionally from 1 to theaters, inclusive
					tiles[whom] += G.theater_bonus[whom][theater].length
				}
			}

			set_bit(QUALIFIES_FOR_BONUS, tiles[who] > tiles [1 - who]) // "More total Bonus War Tiles in next War"
		}
		else {
			clear_bit(QUALIFIES_FOR_BONUS) // There IS no next war
		}
	}

	if (G.played_event === ACTS_OF_UNION) {
		set_bit(CARD_HAS_BONUS)
		var prestige = [ ]
		for (let whom = FRANCE; whom <= BRITAIN; whom++) {
			prestige[whom] = (has_unconflicted(IRELAND_2, whom) ? 1 : 0) + (has_unconflicted(SCOTLAND_2, whom) ? 1 : 0)
		}
		set_bit(QUALIFIES_FOR_BONUS, prestige[who] > prestige[1 - who]) // "More Prestige spaces in Scotland and Ireland"
	}

	if (G.played_event === FALKLANDS_CRISIS) {
		set_bit(QUALIFIES_FOR_BONUS, has_advantage(who, MEDITERRANEAN_INTRIGUE)) // "Mediterranean Intrigue"
	}

	//set_bit(QUALIFIES_FOR_BONUS, true) //Uncomment for testing if you want every event to qualify for a bonus
}


P.event_flow = script (`
	if (data.investments[G.played_tile].majorval > 3) {
		eval {
			require_ministry_unexhausted(R, MARQUIS_DE_CONDORCET, "Required to play event with a non-event Investment Tile", 0, false, true, true)
		}
		if (!G.has_required_ministry) {
			eval { pop_undo() }
			return
		} else {
			eval {
				log_box_ministry(R, MARQUIS_DE_CONDORCET) // Start a box if it didn't already get started above
				log("Used to play event with a non-event Investment Tile.")
				log_box_end(LOG_BOX_MINISTRY)
			}
		}
	}

	if ((data.cards[G.played_event].action !== WILD) && (data.cards[G.played_event].action !== data.investments[G.played_tile].majortype)) {
		eval {
			if (has_transient(R, TRANSIENT_BANK_OF_ENGLAND) && !is_ministry_exhausted(R, BANK_OF_ENGLAND, 1)) { // Up here we're coming in from a ministry flow, having / clicked on Bank of England
				log_box_ministry(R, BANK_OF_ENGLAND)
				exhaust_ministry(R, BANK_OF_ENGLAND, 1)
				log("Used to play economic event without [@0] major action.")
				G.has_required_ministry = TRUE
				log_box_end(LOG_BOX_MINISTRY)
			} else {
				require_ministry_unexhausted(R, BANK_OF_ENGLAND, "Required to play an economic event without an economic major action", 1, false, true, true)
				log_box_ministry(R, BANK_OF_ENGLAND) // Start a box if it didn't already get started above
				log("Used to play economic event without [@0] major action.")
				log_box_end(LOG_BOX_MINISTRY)
			}
		}
		if (!G.has_required_ministry) {
			eval { pop_undo() }
			return
		}
	}

	eval {
		check_event_bonus_requirements(R)
	}

	if ((G.played_event === LA_GABELLE) && is_bit(QUALIFIES_FOR_BONUS) && has_inactive_keyword(R, GOVERNANCE) && !has_active_keyword(R, GOVERNANCE)) {
		eval {
			require_ministry(R, get_minister_for_keyword(R, GOVERNANCE), "To unlock Governance keyword for an extra victory point from La Gabelle event", true)
		}
	}

	if (G.needs_to_flip_ministry >= 0) {
		eval {
			require_ministry(R, G.needs_to_flip_ministry, "To unlock bonus keyword: " + data.keywords[data.cards[G.played_event].keyword].name, true)
		}
		if (G.has_required_ministry) {
			eval {
				check_event_bonus_requirements(R) // Re-evaluate if we now qualify for the bonus
			}
		}
	}

	if (is_bit(QUALIFIES_FOR_BONUS)) {
		eval {
			require_ministry(R, LAVOISIER, "To receive extra action points from your investment tile when gaining an event's bonus", true, false)
		}
	}

	if (true) { // Make sure this waits for Lavoisier, above
		eval {
			begin_event_play(G.played_event)
		}
	}

	// Here we branch to an unholy number of possible events
	if (data.cards[G.played_event].proc !== undefined) {
		call (data.cards[G.played_event].proc)
		eval { end_event_play(G.played_event) }
		return
	}

	call event_not_implemented
	eval { end_event_play(G.played_event) }
`)


function event_prompt(who, c, string1, string2 = "", even_if_no_bonus = false) {
	var header = say_event(c, -1, true) + ": " // NB: Not passing who -- don't want text colored in a prompt

	var prompt = ""
	if ((string2 === "") || (string2 === null) || (!is_bit(QUALIFIES_FOR_BONUS) && !even_if_no_bonus)) {
		prompt += string1 + "."
	}
	else if (string1 === null) {
		prompt += string2 + "."
	}
	else {
		prompt += strike(string1, false)
		prompt += " AND "
		prompt += strike(string2, false)
		prompt += "."
	}
	return bold(header) + say_action(prompt)
}


P.event_not_implemented = {
	inactive: "to discover an unimplemented event",
	_begin() {
		let msg = "Event not yet emplemented: " + data.events[G.played_event].name
		console.error (msg)
		if (globalThis.RTT_FUZZER) throw new Error(msg)
	},
	prompt() {
		let msg = "Event not yet implemented."
		V.prompt = event_prompt(R, G.played_event, msg)
		button ("pass")
	},
	pass() {
		push_undo()
		end()
	}
}

function carnatic_conflicts(who) {
	let alliances = 0
	for (let s = data.regions[REGION_INDIA].first_space; s < data.regions[REGION_INDIA].first_space + data.regions[REGION_INDIA].spaces; s++) {
		if (data.spaces[s].type !== POLITICAL) continue
		if (G.flags[s] !== who) continue
		if (has_conflict_marker(s)) continue
		alliances++
	}
	return alliances
}

// "Place 1 Conflict marker in India for each Local Alliance you control there. BONUS: Damage an enemy Fort or shift a Cotton market in India."
P.event_carnatic_war = {
	_begin() {
		L.conflicts_placed = 0     // Progress trackers
		L.done_bonus       = false
		L.cant_do_bonus    = false
		L.space            = -1
		L.deciding         = false // Unfortunately "cotton markets in India" can qualify for both parts of the event, meaning player needs to decide which when clicking on them
		L.confirming       = false
	},
	inactive: "to get all Carnatic about it",
	prompt() {
		if (L.deciding) {
			V.prompt = event_prompt(R, G.played_event, "Choose shift market or place conflict marker for " + data.spaces[L.space].name)
			button("shift_market")
			button("place_conflict_marker")
		} else if (L.confirming) {
			V.prompt = event_prompt(R, G.played_event, data.spaces[L.space].name + " belongs to you. Confirm you really want to place a conflict marker there?")
			button("confirm")
		} else {
			var any_conflictable = false
			for (let s = data.regions[REGION_INDIA].first_space; s < data.regions[REGION_INDIA].first_space + data.regions[REGION_INDIA].spaces; s++) {
				if (!can_have_conflict_marker(s)) continue
				if (has_conflict_marker(s)) continue
				if (L.conflicts_placed < carnatic_conflicts(R)) {
					action_space(s)
				}
				any_conflictable = true
			}

			let gauge = any_conflictable ? L.conflicts_placed + "/" + carnatic_conflicts(R) : "DONE"
			V.prompt = event_prompt(R, G.played_event, "Place conflict markers in India (" + gauge + ")", "damage an enemy fort or shift a Cotton market in India")

			var any_damageable = false
			if (is_bit(QUALIFIES_FOR_BONUS) && !L.done_bonus && !L.cant_do_bonus) {
				for (let s = data.regions[REGION_INDIA].first_space; s < data.regions[REGION_INDIA].first_space + data.regions[REGION_INDIA].spaces; s++) {
					if ((data.spaces[s].type === MARKET) && (data.spaces[s].market === COTTON)) {
						if (G.flags[s] !== R) {
							action_space(s, INCLUDE_CONFLICT)
							any_damageable = true
						}
					}
					if (data.spaces[s].type === FORT) {
						if ((G.flags[s] === 1 - R) && !is_damaged_fort(s)) {
							action_space(s)
							any_damageable = true
						}
					}
				}
				if (!any_damageable) L.cant_do_bonus = true
			}

			if ((!any_conflictable || (L.conflicts_placed >= carnatic_conflicts(R))) && !any_damageable) {
				V.prompt = event_prompt(R, G.played_event, "Done")
				button("done")
			}
		}
	},
	conflict(s) {
		this.space(s)
	},
	confirm() {
		add_conflict_marker(L.space)
		L.conflicts_placed++
		L.confirming = false
	},
	space(s) {
		push_undo()
		L.space = s
		// This first horrible "if" detects if the space qualifies under *both* the regular condition *and* the bonus condition, in a situation when the player is presently entitled to do either and hasn't used up quota of either
		if (can_have_conflict_marker(s) && !has_conflict_marker(s) && (L.conflicts_placed < carnatic_conflicts(R)) &&
			is_bit(QUALIFIES_FOR_BONUS) && !L.done_bonus && !L.cant_do_bonus && (data.spaces[s].type === MARKET) && (data.spaces[s].market === COTTON) && (G.flags[s] !== R)) {
			L.deciding = true
		} else if ((can_have_conflict_marker(s) && !has_conflict_marker(s)) && (L.conflicts_placed < carnatic_conflicts(R))) {
			if (G.flags[s] === R) {
				L.confirming = true
			} else {
				add_conflict_marker(s)
				L.conflicts_placed++
			}
		} else if ((data.spaces[s].type === MARKET) && (data.spaces[s].market === COTTON) && (G.flags[s] !== R)) {
			reflag_space(s, (G.flags[s] === NONE) ? G.active : NONE)
			L.done_bonus = true
		} else if ((data.spaces[s].type === FORT) && (G.flags[s] === 1 - R) && !is_damaged_fort(s)) {
			set_damaged_fort(s, true)
			L.done_bonus = true
		}
	},
	place_conflict_marker() {
		push_undo()
		add_conflict_marker(L.space)
		L.conflicts_placed++
		L.deciding = false
	},
	shift_market() {
		push_undo()
		reflag_space(L.space, (G.flags[L.space] === NONE) ? G.active : NONE)
		L.done_bonus = true
		L.deciding = false
	},
	done() {
		push_undo()
		end()
	}
}



// BR: 1 Diplo (unflagging in Europe only), Bonus: Score 2 VP
// FR: 2 Diplo. Bonus: Unflag a political space in Europe (not in Spain or Austria)
P.event_acts_of_union = {
	_begin() {
		if (R === BRITAIN) {
			add_contingent(DIPLO, 1, RULE_UNFLAG_EUROPE, SHORT_UNFLAG_EUROPE)
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				award_vp(BRITAIN, 2, false, "Event Bonus")
			}
		} else {
			add_action_points(DIPLO, 2)
		}
		event_made_diplo()
	},
	inactive: "get busy with some Acts of Union",
	prompt() {
		if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, "Confirm event play to gain unflag-in-Europe action", "score 2 VP")
			button("confirm")
		} else if (!is_bit(QUALIFIES_FOR_BONUS)) {
			V.prompt = event_prompt(R, G.played_event, "Confirm event play to gain 2 diplomatic points.")
			button("confirm")
		} else {
			V.prompt = event_prompt(R, G.played_event, "Unflag a political space in Europe (not in Spain or Austria)")
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_EUROPE) continue
				if (data.spaces[s].type !== POLITICAL) continue
				if ((s >= SPAIN_1) && (s <= SPAIN_4)) continue
				if ((s >= AUSTRIA_1) && (s <= AUSTRIA_4)) continue
				if (G.flags[s] !== 1 - R) continue // It's "unflag" which means it can't be a friendly flag
				action_space(s)
				any = true
			}
			if (!any) {
				V.prompt = event_prompt(R, G.played_event, "Confirm event play to gain 2 diplomatic points. No bonus possible, no spaces available to unflag.")
				button("confirm")
			}
		}
	},
	space(s) {
		push_undo()
		reflag_space(s, NONE)
		end()
	},
	confirm() {
		push_undo()
		end()
	}
}


// Remove 1 enemy flag, then 1 friendly flag, from Markets in the Caribbean. Bonus: Remove an additional enemy flag from a Market in the Caribbean
P.event_tropical_diseases = {
	_begin() {
		L.enemy_done    = 0
		L.enemy_to_do   = 1 + (is_bit(QUALIFIES_FOR_BONUS) ? 1 : 0)
		L.friendly_done = 0
	},
	inactive: "catch spicy tropical diseases",
	prompt() {
		let any_friendly = false
		let any_enemy = false
		for (let s = 0; s < NUM_SPACES; s++) {
			if (data.spaces[s].region !== REGION_CARIBBEAN) continue
			if (data.spaces[s].type !== MARKET) continue
			if (G.flags[s] === R) {
				any_friendly = true
				if (L.friendly_done === 0) action_space(s)
			} else if (G.flags[s] === 1 - R) {
				any_enemy = true
				if (L.enemy_done < L.enemy_to_do) action_space(s)
			}
		}
		let gauge = ((any_enemy || (L.enemy_done >= L.enemy_to_do)) ? L.enemy_done + "/" + L.enemy_to_do : "DONE")
		let gauge2 = ((any_friendly || (L.friendly_done > 0)) ? L.friendly_done + "/1" : "DONE")
		V.prompt = event_prompt(R, G.played_event, "Remove " + L.enemy_to_do + " enemy flag" + s(L.enemy_to_do) + " from " + ((L.enemy_to_do !== 1) ? "markets" : "a market") + " in the Caribbean " + parens(gauge), "remove 1 friendly flag from a market in the Caribbean " + parens(gauge2), true)

		if (!any_enemy || (L.enemy_done >= L.enemy_to_do)) {
			if (!any_friendly || (L.friendly_done > 0)) {
				button ("done")
			}
		}
	},
	space(s) {
		push_undo()

		if (G.flags[s] === R) {
			L.friendly_done++
		} else if (G.flags[s] === 1 - R) {
			L.enemy_done++
		}

		reflag_space(s, NONE)

		if ((L.friendly_done > 0) && (L.enemy_done >= L.enemy_to_do)) {
			end()
		}
	},
	done() {
		push_undo()
		end()
	}
}


function apply_south_sea_bonus()
{
	log ("Bonus: -2 military cost of next squadron constructed this round.")
	set_transient(R, TRANSIENT_SOUTH_SEA_SQUADRON_DISCOUNT)
}


// Unflag a Market whose removal does not Isolate any other Markets. Bonus: -2 Mil to construct a new Squadron this AR (This can result in the Construct Squadron action costing 0 Mil)
P.event_south_sea_speculation = {
	_begin() {
		L.unflagged = false
	},
	inactive: "sail to the south seas",
	prompt() {
		if (!L.unflagged) {
			V.prompt = event_prompt(R, G.played_event, "Unflag a market whose removal does not isolate any other markets")

			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== MARKET) continue
				if (G.flags[s] !== 1 - R) continue

				let okay = true
				for (const s2 of data.spaces[s].connects) {
					if (data.spaces[s2].type !== MARKET) continue
					if (G.flags[s2] !== 1 - R) continue

					if (check_if_market_isolated(s2)) continue // If connected market is *already* isolated, then removing target flag by definition doesn't *cause* it to become isolated

					G.flags[s] = NONE // temporarily unflag our target space
					let now_isolated = check_if_market_isolated(s2) // check if it isolates this adjacent space
					G.flags[s] = 1 - R // set target space back

					if (now_isolated) {
						okay = false
						break
					}
				}

				if (okay) {
					action_space(s)
					any = true
				}
			}

			if (!any) {
				V.prompt = event_prompt(R, G.played_event, "Unflag a market whose removal does not isolate any other markets (None possible)")
				button("done")
			}
		} else if (is_bit(QUALIFIES_FOR_BONUS)) {
			V.prompt = event_prompt(R, G.played_event, "-2 military cost to construct a squadron this action round (you may construct immediately or pass until later in the round)")
			if (action_points_eligible(MIL, active_rules())) button("construct_squadron_now")
			button("defer")
		}
	},
	space(s) {
		push_undo()
		reflag_space(s, NONE)
		L.unflagged = true
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			apply_south_sea_bonus()
		} else {
			end()
		}
	},
	construct_squadron_now() {
		push_undo()
		advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
		action_cost_setup(-1, MIL)
		G.action_string = "to construct a squadron"
		G.action_header = "CONSTRUCT SQUADRON: "
		G.prepicked_ministry = -1
		G.prepicked_advantage = -1
		goto ("construct_squadron_flow")
	},
	done() {
		push_undo()
		if (L.unflagged) {
			end()
		} else {
			L.unflagged = true
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				apply_south_sea_bonus()
			} else {
				end()
			}
		}
	},
	defer() {
		push_undo()
		end()
	}
}


// BR: Reduce your Debt by 2. Bonus: Add 1 FR Debt.
// FR: Place a conflict marker in a BR-flagged Market in the Caribbean. Bonus: 1 Diplo
P.event_war_of_jenkins_ear = {
	_begin() {
		if (R === BRITAIN) {
			reduce_debt(BRITAIN, 2)
			if (is_bit(QUALIFIES_FOR_BONUS)) increase_debt(FRANCE, 1)
			L.finished = true
		} else {
			L.conflicts_placed = 0
			L.finished = false
			L.doing_bonus = false
		}
	},
	inactive: "chop off Jenkins' ear",
	prompt() {
		if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, "British debt reduced", "French debt increased")
			button("done")
		} else {
			if ((L.conflicts_placed <= 0) && !L.doing_bonus) {
				let msg = "Place a conflict marker in a BR-flagged market in the Caribbean"
				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].region !== REGION_CARIBBEAN) continue
					if (data.spaces[s].type !== MARKET) continue
					if (has_conflict_marker(s)) continue
					if (G.flags[s] !== BRITAIN) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button ("done")
				}
				V.prompt = event_prompt(R, G.played_event, msg)
			} else {
				V.prompt = event_prompt (R, G.played_event, "Confirm gain of " + say_action_points(1, DIPLO))
				button ("confirm")
			}
		}
	},
	space(s) {
		push_undo()
		add_conflict_marker(s)
		L.conflicts_placed++
		L.doing_bonus = true
		if (!is_bit(QUALIFIES_FOR_BONUS)) end()
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()
		if (!L.finished && !L.doing_bonus && is_bit(QUALIFIES_FOR_BONUS)) {
			L.doing_bonus = true
		} else {
			if ((R === FRANCE) && is_bit(QUALIFIES_FOR_BONUS)) {
				add_action_points(DIPLO, 1)
				event_made_diplo()
			}
			end()
		}
	}
}


// BR: Shift a local alliance in North America. Bonus: Immediately activate an advantage you control in North America (ignoring Exhaustion)
// FR: 2 Econ (North America only). Bonus: Unflag a Local Alliance in North America.
P.event_native_american_alliances = {
	_begin() {
		L.done_alliance = false
		L.done_action_points = false
	},
	inactive: "make Native American alliances",
	prompt() {
		if (R === BRITAIN) {
			if (!L.done_alliance) {
				let msg = "Shift a local alliance in North America"
				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].region !== REGION_NORTH_AMERICA) continue
					if (data.spaces[s].type !== POLITICAL) continue
					if (data.spaces[s].era > current_era()) continue // Some diplomatic spaces are era-locked
					if (((s === USA_1) || (s === USA_2)) && !G.usa_flags) continue // USA flags only if USA exists
					if (G.flags[s] === R) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
				V.prompt = event_prompt(R, G.played_event, msg)
			} else {
				let msg = "Immediately activate an advantage you control in North America, ignoring exhaustion"
				let any = false
				for (let a of [ ALGONQUIN_RAIDS, FUR_TRADE, IROQUOIS_RAIDS, PATRIOT_AGITATION, WHEAT ]) {
					if (!has_advantage_eligible(R, a, true, true)) continue
					action_advantage(a)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				} else {
					button("pass") //BR// Among other things, we might have an advantage that is available but doesn't have any valid targets, so the activation will fail and player will have to undo back to here (and needs a way out of the flow)
				}
				V.prompt = event_prompt(R, G.played_event, msg)
			}
		} else {
			if (!L.done_action_points) {
				V.prompt = "Confirm gain of " + say_action_points(2, ECON) + " in North America only"
				//V.prompt = "+2 Economic action points in North America only"
				button("confirm")
			} else {
				let msg = "Unflag a local alliance in North America"
				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].region !== REGION_NORTH_AMERICA) continue
					if (data.spaces[s].type !== POLITICAL) continue
					if (G.flags[s] !== 1 - R) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
				V.prompt = event_prompt(R, G.played_event, msg)
			}
		}
	},
	space(s) {
		push_undo()
		if (G.flags[s] === NONE) {
			reflag_space(s, R)
		} else {
			reflag_space(s, NONE)
		}
		L.done_alliance = true
		if (R === BRITAIN) {
			if (!is_bit(QUALIFIES_FOR_BONUS)) end()
		} else {
			end()
		}
	},
	advantage(a) {
		push_undo()
		G.active_advantage = a
		G.adv_used++
		G.adv_regions |= (1 << get_advantage_region(a))
		clear_bit(ADVANTAGE_ALREADY_EXHAUSTED)
		set_bit(DONT_EXHAUST_ADVANTAGE)
		goto ("advantage_flow")
	},
	pass() {
		push_undo()
		end()
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			if (L.done_alliance || !is_bit(QUALIFIES_FOR_BONUS)) {
				end()
			} else {
				L.done_alliance = true
			}
		} else {
			if (!L.done_action_points) {
				add_contingent(ECON, 2, RULE_NORTH_AMERICA, SHORT_NORTH_AMERICA)
				event_made_econ(RULE_NORTH_AMERICA, SHORT_NORTH_AMERICA)
				L.done_action_points = true
				if (!is_bit(QUALIFIES_FOR_BONUS)) end()
			} else {
				end()
			}
		}
	},
}


// BR: Place one Conflict marker in Spain. Bonus: Remove a FR Bonus War tile from the next War (returning it to their pool)
// FR: Unflag a space in the Dutch Republic. Bonus: 2 Diplo or 2 Econ in India
P.event_austro_spanish_rivalry = {
	_begin() {
		if (R === BRITAIN) {
			L.conflicts_placed = 0
			L.picked_bonus_tile = -1
			L.theater = 0
			L.confirming = false
		} else {
			L.unflagged = 0
		}
	},
	inactive: "rowl up the Austrians and Spanish",
	prompt() {
		if (R === BRITAIN) {
			let msg = ""
			if (L.confirming) {
				msg += "That space belongs to you. Confirm you really want to place a conflict marker there?"
				button("confirm")
			} else if (!L.conflicts_placed) {
				msg = "Place 1 conflict marker in Spain"
				let any = false
				for (let s of [ SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4] ) {
					if (has_conflict_marker(s)) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
			} else if (L.theater <= 0) {
				msg  = "Remove a French bonus war tile from the next war, returning it to their pool"
				let any= false
				for (let theater = 1; theater <= data.wars[G.next_war].theaters; theater++) { // 1 through theaters inclusive is correct
					if (G.theater_bonus[FRANCE][theater].length < 1) continue
					any = true
					action_theater(theater)
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				} else {
					msg += " (Pick theater to remove a random tile from)"
				}
			} else {
				msg = "Confirm removal of French bonus tile from theater " + L.theater + ": " + data.wars[G.next_war].theater_names[L.theater] + "? (CANNOT BE UNDONE!)"
				button("confirm")
			}
			V.prompt = event_prompt(R, G.played_event, msg)
		} else {
			let msg = ""
			if (!L.unflagged) {
				msg = "Unflag a space in the Dutch Republic"
				let any = false
				for (let s of [DUTCH_1, DUTCH_2]) {
					if (G.flags[s] !== 1 - R) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
			} else {
				msg = "Choose " + say_action_points(2, DIPLO) + " or " + say_action_points(2, ECON) + " in India"
				button ("diplomatic2")
				button ("economic2")
			}
			V.prompt = event_prompt(R, G.played_event, msg)
		}
	},
	space(s) {
		push_undo()
		if (R === BRITAIN) {
			if (G.flags[s] === R) {
				L.confirming = true
				L.space      = s
			} else {
				add_conflict_marker(s)
				L.conflicts_placed++
				if (!is_bit(QUALIFIES_FOR_BONUS)) end()
			}
		} else {
			reflag_space(s, NONE)
			L.unflagged++
			if (!is_bit(QUALIFIES_FOR_BONUS)) end()
		}
	},
	theater(t) {
		push_undo()
		L.theater = display_to_theater(t)
	},
	confirm() {
		if (L.confirming) {
			push_undo()
			add_conflict_marker(L.space)
			L.conflicts_placed++
			L.confirming = false
			if (!is_bit(QUALIFIES_FOR_BONUS)) end()
		} else {
			clear_undo() // No going back once we've effectively revealed a war tile

			log("French bonus war tile removed from theater " + L.theater + ": " + data.wars[G.next_war].theater_names[L.theater])

			// Randomize the choice without disrupting owner's present tile order
			let choices = G.theater_bonus[1 - G.active][L.theater].slice()
			shuffle(choices)

			L.picked_bonus_tile = choices[0]
			array_delete_item(G.theater_bonus[1 - G.active][L.theater], L.picked_bonus_tile)
			G.bonus_war[1 - G.active].push(L.picked_bonus_tile)
			shuffle(G.bonus_war[1 - G.active])
			end()
		}
	},
	diplomatic2() {
		push_undo()
		add_contingent(DIPLO, 2, RULE_INDIA, SHORT_INDIA)
		event_made_diplo()
		end()
	},
	economic2() {
		push_undo()
		add_contingent(ECON, 2, RULE_INDIA, SHORT_INDIA)
		event_made_econ(RULE_INDIA, SHORT_INDIA)
		end()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			if (!L.conflicts_placed) {
				L.conflicts_placed++
				if (!is_bit(QUALIFIES_FOR_BONUS)) end()
			} else {
				end()
			}
		} else {
			if (!L.unflagged && is_bit(QUALIFIES_FOR_BONUS)) {
				L.unflagged++
			} else {
				end()
			}
		}
	}
}

// Reduce your debt by 2. Bonus: Reduce your debt by an additional 1.
// If you are unable to reduce debt, you make take 1 Econ for each debt reduction not taken.
P.event_tax_reform = {
	_begin() {
		L.reduction_amount = is_bit(QUALIFIES_FOR_BONUS) ? 3 : 2
		if (L.reduction_amount <= G.debt[R]) {
			L.economic_points = 0
		} else {
			L.economic_points  = L.reduction_amount - G.debt[R]
			L.reduction_amount = G.debt[R]
		}
	},
	inactive: "do some really boring tax reform",
	prompt() {
		let msg = ""
		if (L.reduction_amount === 0) {
			msg = "Confirm award of " + say_action_points(L.economic_points, ECON) + " in lieu of debt reduction"
		} else if (L.economic_points === 0) {
			msg = "Confirm debt reduction of " + L.reduction_amount
		} else {
			msg = "Confirm debt reduction of " + L.reduction_amount + " and " + say_action_points(L.economic_points, ECON, true)
		}
		V.prompt = event_prompt(R, G.played_event, msg)
		button ("confirm")
	},
	confirm() {
		push_undo()
		if (L.reduction_amount > 0) reduce_debt(R, L.reduction_amount)
		if (L.economic_points > 0) {
			add_action_points(ECON, L.economic_points)
			event_made_econ()
		}
		end()
	}
}


function score_northern_war()
{
	if ((G.flags[GERMAN_STATES_1] === BRITAIN) && (G.flags[GERMAN_STATES_2] === BRITAIN)) {
		if (!has_conflict_marker(GERMAN_STATES_1) && !has_conflict_marker(GERMAN_STATES_2)) {
			award_vp(BRITAIN, 2, false, "German States all BR-flagged")
		}
	}
}


// BR: Shift a political space in the German States. If both are now BR-flagged, score 2 VP. Bonus: 1 Diplo
// FR: Shift Russia. If it's already FR-flagged, score 2 VP instead. Bonus: 1 Diplo
P.event_great_northern_war = {
	_begin() {
		L.shifted_space = false
	},
	inactive: "fight a war. A great one. In the north",
	prompt() {
		let msg = ""
		if (R === BRITAIN) {
			if (!L.shifted_space) {
				msg = "Shift a political space in the German States. If both are now BR-flagged, score 2 VP"
				let any = false
				for (let s of [ GERMAN_STATES_1, GERMAN_STATES_2 ]) {
					if (G.flags[s] === BRITAIN) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (Both spaces already BR-flagged)"
					button("done")
				}
			} else {
				msg = "Confirm Bonus: " + say_action_points(1, DIPLO)
				button("confirm")
			}
		} else {
			if (!L.shifted_space) {
				msg = "Shift Russia. If it's already FR-flagged, score 2 VP instead"
				if (G.flags[RUSSIA] === FRANCE) {
					msg += " (Already FR-flagged)"
					button("done")
				} else {
					action_space(RUSSIA)
					button("done")
				}
			} else {
				msg = "Bonus: " + say_action_points(1, DIPLO)
				button("done")
			}
		}
		V.prompt = event_prompt(R, G.played_event, msg)
	},
	space(s) {
		push_undo()
		if (R === BRITAIN) {
			L.shifted_space = true
			if (G.flags[s] === NONE) {
				reflag_space(s, BRITAIN)
			} else {
				reflag_space(s, NONE)
			}
			score_northern_war()
			if (!is_bit(QUALIFIES_FOR_BONUS)) end()
		} else {
			L.shifted_space = true
			if (G.flags[RUSSIA] === NONE) {
				reflag_space(RUSSIA, FRANCE)
			} else {
				reflag_space(RUSSIA, NONE)
			}
			if (!is_bit(QUALIFIES_FOR_BONUS)) end()
		}
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			if (!L.shifted_space) {
				L.shifted_space = true
				score_northern_war()
				if (!is_bit(QUALIFIES_FOR_BONUS)) end()
			} else {
				add_action_points(DIPLO, 1)
				event_made_diplo()
				end()
			}
		} else {
			if (!L.shifted_space) {
				L.shifted_space = true
				if (G.flags[RUSSIA] === FRANCE) {
					if (!has_conflict_marker(RUSSIA)) {
						award_vp(FRANCE, 2, false, "Russia already FR-flagged")
					}
				} else if (G.flags[RUSSIA] === NONE) {
					reflag_space(RUSSIA, FRANCE)
				} else {
					reflag_space(RUSSIA, NONE)
				}
				if (!is_bit(QUALIFIES_FOR_BONUS)) end()
			} else {
				add_action_points(DIPLO, 1)
				event_made_diplo()
				end()
			}
		}
	}
}


function score_vatican_politics() {
	let any = false
	for (let s of [ SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4, AUSTRIA_1, AUSTRIA_2, AUSTRIA_3, AUSTRIA_4 ]) {
		if (G.flags[s] !== BRITAIN) continue
		if (has_conflict_marker(s)) continue
		any = true
		break
	}

	if (!any) {
		award_vp(FRANCE, 2, false, "No BR flags in Spain or Austria")
	}
}

// BR: 2 Diplo (must be spent in the German States, Prussia, or the Dutch Republic). Bonus: 1 Diplo (Europe)
// FR: Shift any Spain or Austria space. Bonus: If there are no BR flags in Spain and Austria, score 2 VP.
P.event_vatican_politics = {
	_begin() {
		L.shifted_space = false
	},
	inactive: "go papal on you",
	prompt() {
		if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(2, DIPLO) + " (German States, Prussia, Dutch Republic)", say_action_points(1, DIPLO, true) + " (Europe)")
			button ("confirm")
		} else {
			if (!L.shifted_space) {
				V.prompt = event_prompt(R, G.played_event, "Shift any Spain or Austria space", "if there are afterwards no BR flags in Spain and Austria, score 2 VP")
				let any = false
				for (let s of [ SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4, AUSTRIA_1, AUSTRIA_2, AUSTRIA_3, AUSTRIA_4 ]) {
					if (G.flags[s] === FRANCE) continue // already friendly flagged
					action_space(s)
					any = true
				}
				if (!any) {
					V.prompt = event_prompt(R, G.played_event, "No Spain or Austria spaces remain to be shifted", "score 2 VP for no BR flags in the region")
					button("done")
				}
			}
		}
	},
	space(s) {
		push_undo()
		if (G.flags[s] === NONE) {
			reflag_space(s, FRANCE)
		} else {
			reflag_space(s, NONE)
		}
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			score_vatican_politics()
		}
		end()
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			add_contingent(DIPLO, 2, RULE_GERMAN_PRUSSIA_DUTCH, SHORT_GERMAN_PRUSSIA_DUTCH)
			event_made_diplo()
			if (is_bit(QUALIFIES_FOR_BONUS)) add_contingent(DIPLO, 1, RULE_EUROPE, SHORT_EUROPE)
			end()
		} else {
			if (is_bit(QUALIFIES_FOR_BONUS)) score_vatican_politics()
			end()
		}
	}
}


// BR: 2 Econ (must be used to unflag markets). Bonus: You may score Cotton (as if in Global Demand)
// FR: Unflag a Cotton Market. Bonus: Move a BR Squadron from the map to the Navy Box.
P.event_calico_acts = {
	_begin() {
		L.unflagged_markets = false
	},
	inactive: "get their Calico on",
	prompt() {
		let msg = ""
		if (R === BRITAIN) {
			if (!L.unflagged_markets) {
				msg += "Confirm gain of " + say_action_points(2, ECON) + "; must be used to unflag markets"
				button("confirm")
			} else {
				msg = "You may score Cotton (as if in Global Demand)"
				button("scorecotton")
				button("pass")
			}
		} else {
			if (!L.unflagged_markets) {
				msg = "Unflag a Cotton market"
				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].type !== MARKET) continue
					if (data.spaces[s].market !== COTTON) continue
					if (G.flags[s] !== 1 - R) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
			} else {
				msg = "Move a British squadron from the map to the Navy Box"
				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].type !== NAVAL) continue
					if (G.flags[s] !== 1 - R) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
			}
		}
		V.prompt = event_prompt(R, G.played_event, msg)
	},
	space(s) {
		push_undo()
		if (!L.unflagged_markets) {
			L.unflagged_markets = true
			reflag_space(s, NONE)
			if (!is_bit(QUALIFIES_FOR_BONUS)) end()
		} else {
			move_squadron_token(BRITAIN, s, SPACE_NAVY_BOX)

			reflag_space (s, NONE, true)
			G.navy_box[BRITAIN]++

			validate_squadrons("CALICO")

			let msg = say_space(s) + " squadron to Navy Box."
			log (msg)

			log (say_navy_box())

			end()
		}
	},
	scorecotton() {
		push_undo()
		log ("Scoring: COTTON")
		let winner = demand_flag_winner(COTTON)
		if (winner !== NONE) {
			let vp = data.demands[COTTON].awards[current_era()].vp
			let trp = data.demands[COTTON].awards[current_era()].trp
			let debt = data.demands[COTTON].awards[current_era()].debt

			log ("  Winner: " + data.flags[winner].name)
			if (vp > 0) log ("  VP: +" + vp)
			if (trp > 0) log ("  TRP: +" + trp)
			if (debt > 0) log ("  Debt: +" + debt)
			if (debt < 0) log ("  Debt: " + debt)

			award_vp(winner, vp)
			add_treaty_points(winner, trp)
			if (debt < 0) {
				reduce_debt(winner, Math.abs(debt))
			} else if (debt > 0) {
				increase_debt(winner, debt)
			}
		} else {
			log ("  Winner: NONE")
		}
		end()
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			L.unflagged_markets = true
			add_contingent(ECON, 2, RULE_UNFLAG_MARKETS, SHORT_UNFLAG_MARKETS)
			event_made_econ(RULE_UNFLAG_MARKETS, SHORT_UNFLAG_MARKETS)
			if (!is_bit(QUALIFIES_FOR_BONUS)) end()
		} else {
			if (!L.unflagged_markets) {
				L.unflagged_markets = true
				if (!is_bit(QUALIFIES_FOR_BONUS)) end()
			} else {
				end()
			}
		}
	},
	pass() {
		push_undo()
		log("British player opted NOT to score Cotton.")
		end()
	}
}


P.event_military_spending_overruns = {
	inactive: "concoct some tasty Military Spending Overruns",
	prompt() {
		V.prompt = event_prompt(R, G.played_event, "Confirm opponent to damage a fort, remove a squadron, or remove a bonus war tile" + (is_bit(QUALIFIES_FOR_BONUS) ? " (x2)" : "") + " (CANNOT BE UNDONE!)")
		button("confirm")
	},
	confirm() {
		push_undo() // Just going to get cleared anyway?
		G.active = 1 - R
		goto ("do_military_spending_overruns")
	}
}

// Your opponent must damage a fort, remove a squadron (to Navy Box), or remove a Bonus War Tile from the next war (returning it to their pool). Bonus: Your opponent must do so again (does not have to be the same choice)
P.do_military_spending_overruns = {
	_begin() {
		L.removals_done = 0
		L.removals_required = 1 + (is_bit(QUALIFIES_FOR_BONUS) ? 1 : 0)
	},
	inactive: "enjoy some tasty Military Spending Overruns",
	prompt() {
		let any = false
		if (L.removals_done < L.removals_required) {
			for (let s = 0; s < NUM_SPACES; s++) {
				if (G.flags[s] !== G.active) continue
				if ((data.spaces[s].type === NAVAL) ||
					((data.spaces[s].type === FORT) && !is_damaged_fort(s))) {
					action_space(s)
					any = true
				}
			}
			for (let theater = 1; theater <= data.wars[G.next_war].theaters; theater++) { // 1 to theaters, inclusive
				for (let t of G.theater_bonus[G.active][theater]) {
					any = true
					action_bonus_war_tile(t)
				}
			}
		}

		let gauge = (any || (L.removals_done >= L.removals_required)) ? (L.removals_done + "/" + L.removals_required) : "DONE"
		V.prompt = event_prompt(G.active, G.played_event, "Damage a fort, remove a squadron, or remove a bonus war tile from the next war " + parens(gauge))

		if (!any && (L.removals_done === 0)) {
			V.prompt = event_prompt(G.active, G.played_event, "No forts, squadrons, or bonus war tiles available.")
			button ("confirm")
		} else if (L.removals_done >= L.removals_required) {
			V.prompt = event_prompt(G.active, G.played_event, "Confirm choices")
			button ("confirm")
		} else if (!any) {
			button ("confirm")
		}
	},
	space(s) {
		push_undo()
		L.removals_done++
		if (data.spaces[s].type === FORT) {
			set_damaged_fort(s)
		} else {
			move_squadron_token(G.active, s, SPACE_NAVY_BOX)
			reflag_space (s, NONE, true)
			G.navy_box[G.active]++

			validate_squadrons("MILITARY_SPENDING_OVERRUNS")

			let msg = say_space(s) + " squadron to Navy Box."
			log (msg)

			log (say_navy_box())
		}
		if (L.removals_done < L.removals_required) log_br()
	},
	bonus_war(t) {
		push_undo()
		L.removals_done++
		let theater = get_theater_from_bonus_war_tile(G.active, t)
		array_delete_item(G.theater_bonus[G.active][theater], t)
		G.bonus_war[G.active].push(t)
		//shuffle(G.bonus_war[G.active])
		log(data.flags[G.active].name + " returned a bonus war tile from theater " + theater + ": " + data.wars[G.next_war].theater_names[theater])
	},
	confirm() {
		push_undo()  // Probably just gets cleared?
		if (L.removals_done < L.removals_required) {
			log(italic("No further legal targets available."))
		}
		G.active = 1 - G.active
		end()
	}
}

// BR: 2 Econ. Must be spent to flag market(s) next to a BR-flagged market. Bonus: 1 Econ, similarly restricted.
// FR: Shift an Alliance space in Austria, the Dutch Republic, or Spain. Bonus: if both Savoy and Sardinia are FR-flagged, score 3 VP.
P.event_alberonis_ambition = {
	_begin() {
		if (R === BRITAIN) {
			L.econ_amount = is_bit(QUALIFIES_FOR_BONUS) ? 3 : 2
		} else {
			L.shifted_alliance = false
			L.savoy_sardinia = ((G.flags[SAVOY] === FRANCE) && (G.flags[SARDINIA] === FRANCE)) && !has_conflict_marker(SAVOY) && !has_conflict_marker(SARDINIA)
		}
	},
	inactive: "tame Alberoni's ambition",
	prompt() {
		if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(L.econ_amount, ECON) + " (must be spent to flag markets next to a British-flagged market)")
			button("confirm")
		} else {
			if (!L.shifted_alliance) {
				let msg = "Shift an Alliance space in Austria, the Dutch Republic, or Spain"
				let any = false
				for (let s of [ SPAIN_1, SPAIN_3, AUSTRIA_1, AUSTRIA_3, DUTCH_1 ]) {
					if (G.flags[s] === R) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
				V.prompt = event_prompt(R, G.played_event, msg, "if both Savoy and Sardinia are FR-flagged, score 3 VP")
			} else {
				V.prompt = event_prompt(R, G.played_event, L.savoy_sardinia ? "+3 VP for flags in both Savoy and Sardinia" : "No VP bonus as France does not have flags in both Savoy and Sardinia")
				button("done")
			}
		}
	},
	space(s) {
		push_undo()
		reflag_space(s, (G.flags[s] === NONE) ? R : NONE)
		L.shifted_alliance = true
		if (!is_bit(QUALIFIES_FOR_BONUS)) end()
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			add_contingent(ECON, L.econ_amount, RULE_MARKET_MARKET, SHORT_MARKET_MARKET)
			event_made_econ(RULE_MARKET_MARKET, SHORT_MARKET_MARKET)
		} else {
			if (!L.shifted_alliance) {
				L.shifted_alliance = true
				if (!is_bit(QUALIFIES_FOR_BONUS)) end()
			}
			if (L.savoy_sardinia) {
				award_vp(FRANCE, 3, false, "French in both Savoy and Sardinia")
			} else {
				log ("No VP Bonus: France did not have flags in both Savoy and Sardinia.")
			}
		}
		end()
	}
}

// BR: Unflag a FR space in Ireland or Scotland
// FR: Draw one Bonus War Tile for each space you control in Ireland, and add them to the Jacobite Rebellion theater in the next war
P.event_famine_in_ireland = {
	_begin() {
		if (R === FRANCE) {
			L.tiles_to_draw = 0
			L.drawn_tiles = false
			L.placing_displaced_tile = false
			if (has_unconflicted(IRELAND_1, FRANCE)) L.tiles_to_draw++
			if (has_unconflicted(IRELAND_2, FRANCE)) L.tiles_to_draw++

			L.already = num_bonus_tiles_in_play(R)
		}
	},
	inactive: "find some food, fast",
	prompt() {
		if (R === BRITAIN) {
			let msg = "Unflag a French space in Ireland or Scotland"
			let any = false
			for (let s of [ IRELAND_1, IRELAND_2, SCOTLAND_1, SCOTLAND_2 ] ) {
				if (G.flags[s] !== FRANCE) continue
				action_space(s)
				any = true
			}
			if (!any) {
				button ("done")
				msg += " (None possible)"
			}
			V.prompt = event_prompt(R, G.played_event, msg)
		} else {
			if (!L.drawn_tiles) {
				let msg = ""
				if (G.turn >= PEACE_TURN_4) {
					msg = "No Jacobite Rebellion theater in next war. No war tiles drawn."
					button("done")
				} else if (L.tiles_to_draw === 0) {
					msg = "France controls no spaces in Ireland. No war tiles drawn."
					button("done")
				} else if (L.already >= data.wars[G.next_war].theaters * 2) {
					msg = "You cannot draw any bonus war tiles, as all theaters in the next war already contain the maximum 2 bonus war tiles"
					button("done")
				} else if ((L.tiles_to_draw === 2) && (L.already >= (data.wars[G.next_war].theaters * 2) - 1)) {
					msg = "Confirm drawing only ONE bonus war tile even though you have TWO spaces in Ireland, as you have room for only one more on the war mat (CANNOT BE UNDONE!)"
					button("confirm")
				} else {
					msg = "Confirm draw of " + L.tiles_to_draw + " bonus war tile" + s(L.tiles_to_draw) + " to Jacobite Rebellion theater (CANNOT BE UNDONE!)"
					button("confirm")
				}
				V.prompt = event_prompt(R, G.played_event, msg)
			} else {
				if (!L.placing_displaced_tile) {
					for (let index = 0; index < G.theater_bonus[R][4].length; index++) {
						if ((L.displaced_a_new_one || (L.tiles_to_displace === 1)) && (index >= 2)) continue // If we only drew one tile, don't displace that one. If we displaced a new one the first time, we can't do it on a second time.
						action_bonus_war_tile(G.theater_bonus[R][4][index])
					}
					V.prompt = event_prompt(R, G.played_event, "Theater has more than 2 bonus war tiles. Select a tile to displace to a different theater")
				} else {
					for (let theater of free_theaters(R)) {
						action_theater(theater)
					}
					V.prompt = event_prompt(R, G.played_event, "Select a new theater for " + say_bonus_war_tile(L.displaced_tile, false) + " tile")
				}
			}
		}
	},
	space(s) {
		push_undo()
		reflag_space(s, NONE)
		end()
	},
	bonus_war(t) {
		push_undo()
		L.placing_displaced_tile = true
		L.displaced_tile = t
		if (G.theater_bonus[FRANCE][4].indexOf(t) >= 2) L.displaced_a_new_one = true
	},
	theater(theater) {
		push_undo()
		theater = display_to_theater(theater)
		array_delete_item(G.theater_bonus[FRANCE][4], L.displaced_tile)
		G.theater_bonus[FRANCE][theater].push(L.displaced_tile)

		log("France displaced a bonus war tile from Jacobite Rebellion theater to theater " + theater + ": " + data.wars[G.next_war].theater_names[theater] + ".")

		if (G.theater_bonus[R][4].length <= 2) { // We're done if Jacobite theater only has two bonus war tiles
			end()
		} else {
			L.placing_displaced_tile = false // Loop back for another displacement if we need to
		}
	},
	confirm() {
		clear_undo()
		let oops = (L.tiles_to_draw === 2) && ((L.already >= (data.wars[G.next_war].theaters * 2) - 1))
		if (oops) L.tiles_to_draw = 1
		let msg = "France added " + L.tiles_to_draw + " bonus war tile" + s(L.tiles_to_draw) + " to Jacobite Rebellion theater"
		if (oops) msg += " (theaters only had room for 1 more tile)"
		msg += "."
		log (msg)
		L.new_tiles = []
		for (let i = 0; i < L.tiles_to_draw; i++) {
			L.new_tiles.push(draw_bonus_war_tile(R, 4))
		}
		L.drawn_tiles = true

		if (G.theater_bonus[R][4].length <= 2) {
			end()
		} else {
			L.tiles_to_displace = G.theater_bonus[R][4].length - 2
			L.displaced_a_new_one = false
			L.placing_displaced_tile = false
		}
	},
	done() {
		push_undo()
		end()
	}
}

// Reduce your opponent's debt limit by one. If your opponent was at debt limit, reduce their debt by one as well, then score 1 VP. Bonus: reduce your own debt by 2.
P.event_interest_payments = {
	_begin() {
		L.penalty = available_debt(1 - R) < 1
		L.debt_reduction = Math.min(2, G.debt[R])
	},
	inactive: "charge you interest",
	prompt() {
		let msg = "Reduces your opponent's Debt Limit by one"
		if (L.penalty) msg += ". This also reduces their debt by one and you will score 1 VP"
		V.prompt = event_prompt(R, G.played_event, msg, "reduces your own debt by " + L.debt_reduction)
		button("done")
	},
	done() {
		push_undo()
		G.debt_limit[1 - R]--
		log (bold(data.flags[1 - R].adj + " debt limit reduced by 1."))
		if (L.penalty) {
			G.debt[1 - R]--
			award_vp(R, 1, false, "Debt Overrun")
		}
		if (is_bit(QUALIFIES_FOR_BONUS) && (L.debt_reduction > 0)) {
			reduce_debt(R, L.debt_reduction)
		}
		end()
	}
}


// Place 1 Conflict marker in a market in the Caribbean. Bonus: place an additional Conflict marker as above
P.event_caribbean_slave_unrest = {
	_begin() {
		L.conflicts_done  = 0
		L.conflicts_to_do = 1 + (is_bit(QUALIFIES_FOR_BONUS) ? 1 : 0)
		L.confirming = false
	},
	inactive: "incite some unrest",
	prompt() {
		if (L.confirming) {
			V.prompt = event_prompt(R, G.played_event, data.spaces[L.space].name + " belongs to you. Confirm placing a conflict marker there anyway?")
			button("confirm")
		} else {
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_CARIBBEAN) continue
				if (data.spaces[s].type !== MARKET) continue
				if (has_conflict_marker(s)) continue
				any = true
				action_space(s)
			}
			let gauge = ((any || (L.conflicts_done >= L.conflicts_to_do)) ? L.conflicts_done + "/" + L.conflicts_to_do : "DONE")
			V.prompt = event_prompt(R, G.played_event, "Place " + L.conflicts_to_do + " conflict marker" + s(L.conflicts_to_do) + " in " + ((L.conflicts_to_do !== 1) ? "markets" : "a market") + " in the Caribbean " + parens(gauge))

			if (!any || (L.conflicts_done >= L.conflicts_to_do)) {
				button("done")
			}
		}
	},
	confirm() {
		L.confirming = false
		add_conflict_marker(L.space)
		L.conflicts_done++
		if (L.conflicts_done >= L.conflicts_to_do) {
			end()
		}
	},
	space(s) {
		push_undo()
		if (G.flags[s] === R) {
			L.confirming = true
			L.space = s
		} else {
			add_conflict_marker(s)
			L.conflicts_done++
			if (L.conflicts_done >= L.conflicts_to_do) {
				end()
			}
		}
	},
	done() {
		push_undo()
		end()
	}
}


// BR: This AR, FR-flagged spaces in Spain or Austria cost 1 less for you to unflag. Bonus: 1 Diplo.
// FR: Refresh up to two Advantages in Europe. Bonus: 2 Diplo in Spain and/or Austria
P.event_pacte_de_famille = {
	_begin() {
		if (R === FRANCE) {
			L.num_refreshed  = 0
		}
	},
	inactive: "keep it in the famille",
	prompt() {
		if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, "This action round, FR-flagged spaces in Spain or Austria cost 1 less for you to unflag", say_action_points(1, DIPLO))
			button("done")
		} else {
			let any = false
			let msg = "Refresh up to two Advantages in Europe "
			if (L.num_refreshed < 2) {
				for (let a = 0; a < NUM_ADVANTAGES; a++) {
					if (!is_advantage_exhausted(a)) continue
					if (get_advantage_region(a) !== REGION_EUROPE) continue
					action_advantage(a)
					any = true
				}
				let gauge = ((any || (L.num_refreshed >= 2)) ? L.num_refreshed+ "/" + 2 : "DONE")
				V.prompt = event_prompt(R, G.played_event, msg + parens(gauge), "gain " + say_action_points(2, DIPLO) + " in Spain and/or Austria")
				button("done")
			} else {
				V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(2, DIPLO) + " in Spain and/or Austria")
				button("confirm")
			}
		}
	},
	advantage(a) {
		push_undo()
		refresh_advantage(a)
		L.num_refreshed++
		if ((L.num_refreshed >= 2) && !is_bit(QUALIFIES_FOR_BONUS)) end()
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			log ("This action round, French-flagged spaces in Spain or Austria cost Britain one fewer action point to unflag.")
			set_transient(R, TRANSIENT_PACTE_DE_FAMILLE)
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				add_action_points(DIPLO, 1)
				event_made_diplo()
			}
		} else {
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				add_contingent(DIPLO, 2, RULE_SPAIN_AUSTRIA, SHORT_SPAIN_AUSTRIA)
				event_made_diplo()
			}
		}
		end()
	}
}


// BR: Place the Byng marker in any theater that counts Naval strength in the next war
// FR: Remove one BR squadron from the map or navy box to the turn track (on the next peace turn). On that turn's reset phase, return it to the navy box
P.event_byngs_trial = {
	inactive: "encourage les autres",
	prompt() {
		if (R === BRITAIN) {
			for (let theater = 1; theater <= data.wars[G.next_war].theaters; theater++) {
				if (!data.wars[G.next_war].theater[theater].naval) continue
				action_theater(theater)
			}
			V.prompt = event_prompt(R, G.played_event, "Place the +2 Byng marker in any theater that counts Naval Strength in the next War.")
		} else {
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== NAVAL) continue
				if (G.flags[s] !== BRITAIN) continue
				action_space(s)
				any = true
			}
			if (G.navy_box[BRITAIN]) {
				action_navy_box()
				any = true
			}
			let msg = "Remove one British Squadron from the map or Navy Box to the turn track. It will return to the navy box on the next Peace Turn's reset phase."
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg)
		}
	},
	theater(theater) {
		push_undo()
		theater = display_to_theater(theater)
		G.byng = theater
		log (bold("Byng +2 tile placed in theater " + theater + ": " + data.wars[G.next_war].theater_names[theater]))
		end()
	},
	space(s) {
		push_undo()
		move_squadron_token(BRITAIN, s, SPACE_THE_BRIG)
		reflag_space(s, NONE, true)
		log (bold("British squadron removed from " + say_space(s) + ". It will return to the Navy Box on the next peace turn."))
		if (G.the_brig === undefined) G.the_brig = 0
		G.the_brig++
		validate_squadrons("BYNGS TRIAL")

		end()
	},
	done() {
		log (bold("No more British squadrons in play - no more can be removed."))
		end()
	},
	navy_box() {
		push_undo()
		move_squadron_token(BRITAIN, SPACE_NAVY_BOX, SPACE_THE_BRIG)
		G.navy_box[BRITAIN]--
		if (G.the_brig === undefined) G.the_brig = 0
		G.the_brig++
		validate_squadrons("BYNGS TRIAL NAVY BOX")

		log (bold("British squadron removed from Navy Box. It will return to the Navy Box on the next peace turn."))
		log (say_navy_box())
		end()
	}
}



// BR: You may put Fur or Cotton into Global Demand. Bonus: 1 Econ
// FR: 1 Diplo in Europe. Bonus: 2 more Diplo in Europe.
P.event_le_beau_monde = {
	inactive: "do the high society",
	prompt() {
		if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, "You may put Fur or Cotton into Global Demand", "gain " + say_action_points(1, ECON))
			button("fur", !G.global_demand.includes(FURS))
			button("cotton", !G.global_demand.includes(COTTON))
			button("pass")
		} else {
			V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(1, DIPLO) + " in Europe", "an additional " + say_action_points(2, DIPLO) + " in Europe")
			button("confirm")
		}
	},
	fur() {
		push_undo()
		G.global_demand.push(FURS)
		G.dirty_demand |= (1 << FURS)
		log(bold(say_demand(FURS) + " added to Global Demand."))
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			add_action_points(ECON, 1)
			event_made_econ()
		}
		end()
	},
	cotton() {
		push_undo()
		G.global_demand.push(COTTON)
		G.dirty_demand |= (1 << COTTON)
		log(bold(say_demand(COTTON) + " added to Global Demand."))
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			add_action_points(ECON, 1)
			event_made_econ()
		}
		end()
	},
	pass() {
		push_undo()
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			add_action_points(ECON, 1)
			event_made_econ()
		}
		end()
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()
		add_contingent(DIPLO, is_bit(QUALIFIES_FOR_BONUS) ? 3 : 1, RULE_EUROPE, SHORT_EUROPE)
		event_made_diplo()
		end()
	}
}


function hyder_ali(s)
{
	add_conflict_marker(s)
	L.conflicts_done++
	if (L.conflicts_done >= 2) {
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			add_contingent(ECON, 2, RULE_INDIA, SHORT_INDIA)
			event_made_econ(RULE_INDIA, SHORT_INDIA)
		}
		end()
	}
}

// Take control of one Local Alliance space in India OR place 2 Conflict markers in unprotected spaces in India. Bonus: 2 Econ in India
P.event_hyder_ali = {
	_begin() {
		// Player needs to first decide which route he's going, because local alliance spaces are potentially subject to both halves of the choice
		L.taking_control = false
		L.placing_conflicts = false
		L.conflicts_done = 0
		L.confirming = false
	},
	inactive: "ally with Hyder Ali",
	prompt() {
		let msg = ""
		if (L.confirming) {
			V.prompt = event_prompt(R, G.played_event, data.spaces[L.space].name + " belongs to you. Confirm placing a conflict marker there anyway?")
			button("confirm")
		} else {
			if (!L.taking_control && !L.placing_conflicts) {
				msg = "Take control of one Local Alliance space in India, or place two conflict markers in unprotected spaces in India"
				button("take_control")
				button("place_conflicts")
			} else if (L.taking_control) {
				msg = "Take control of one Local Alliance space in India"
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].region !== REGION_INDIA) continue
					if (data.spaces[s].type === POLITICAL) {
						if (G.flags[s] === R) continue
						action_space(s)
					}
				}
				//NB - no option to pass if there isn't a space -- requires player to undo & go the conflict path (exception for Fuzzer)
				if (globalThis.RTT_FUZZER) {
					button("done")
				}
			} else {
				msg = "Place two conflict markers in unprotected spaces in India"
				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].region !== REGION_INDIA) continue
					if (has_conflict_marker(s)) continue
					if (data.spaces[s].type === POLITICAL) {
						action_space(s)
						any = true
					} else if (data.spaces[s].type === MARKET) {
						if ((G.flags[s] === NONE) || !is_protected(s)) {
							action_space(s)
							any = true
						}
					}
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				} else {
					let gauge = L.conflicts_done + "/2"
					msg += " " + parens(gauge)
				}
			}

			V.prompt = event_prompt(R, G.played_event, msg, "gain " + say_action_points(2, ECON) + " in India")
		}
	},
	take_control() {
		push_undo()
		L.taking_control = true
	},
	place_conflicts() {
		push_undo()
		L.placing_conflicts = true
	},
	space(s) {
		push_undo()
		if (L.taking_control) {
			reflag_space(s, R)
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				add_contingent(ECON, 2, RULE_INDIA, SHORT_INDIA)
				event_made_econ(RULE_INDIA, SHORT_INDIA)
			}
			end()
		} else {
			if (G.flags[s] === R) {
				L.confirming = true
				L.space = s
			} else {
				hyder_ali(s)
			}
		}
	},
	confirm() {
		push_undo()
		L.confirming = false
		hyder_ali(L.space)
	},
	done() {
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			add_contingent(ECON, 2, RULE_INDIA, SHORT_INDIA)
			event_made_econ(RULE_INDIA, SHORT_INDIA)
		}
		end()
	}
}


// Draw a new Global Demand tile, then replace one of this turn's Global Demand tiles with the new one. Bonus: 2 Econ in India
P.event_co_hong_system = {
	_begin() {
		L.drawn_demand = -1
	},
	inactive: "manipulate the Co Hong system",
	prompt() {
		let msg = ""
		if (L.drawn_demand < 0) {
			msg += "Confirm drawing new Global Demand tile to replace one from this turn? (CANNOT BE UNDONE)"
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				msg += " (You will also receive +2 Economic points in India)"
			}
			button("confirm")
		} else {
			msg += "Select a Global Demand tile to replace with " + data.demands[L.drawn_demand].name
			for (const d of G.global_demand) {
				if (d === L.drawn_demand) continue
				action_demand(d)
			}
		}
		V.prompt = event_prompt(R, G.played_event, msg)
	},
	confirm() {
		clear_undo()
		var global_demand_chits = []
		for (var i = 0; i < NUM_DEMANDS; i++) {
			if (G.global_demand.includes(i)) continue
			global_demand_chits.push(i)
		}
		shuffle(global_demand_chits)
		L.drawn_demand = global_demand_chits.pop()
		G.global_demand.push(L.drawn_demand)
		G.dirty_demand |= (1 << L.drawn_demand)
		log (bold(say_demand(L.drawn_demand) + " added to Global Demand."))
	},
	demand(d) {
		push_undo()
		array_delete_item(G.global_demand, d)
		log (bold(say_demand(d) + " removed from Global Demand."))

		if (is_bit(QUALIFIES_FOR_BONUS)) {
			add_contingent(ECON, 2, RULE_INDIA, SHORT_INDIA)
			event_made_econ(RULE_INDIA, SHORT_INDIA)
		}
		end()
	}
}



function score_corsican_crisis(who)
{
	if (!is_bit(QUALIFIES_FOR_BONUS)) return
	if (who === BRITAIN) {
		let any = false
		for (const s of [ BALEARIC, BISCAY ]) {
			if (G.flags[s] === FRANCE) {
				any = true
				break
			}
		}
		if (!any) {
			award_vp(BRITAIN, 1, false, "No French squadrons in Europe")
		}
	} else {
		let any = false
		for (const s of [ SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4 ]) {
			if ((G.flags[s] === BRITAIN) && !has_conflict_marker(s)) {
				any = true
				break
			}
		}
		if (!any) {
			award_vp(FRANCE, 1, false, "No British flags in Spain")
		}
	}
}


// BR: Shift Sardinia or Savoy. Bonus: Score 1 VP if France has no Squadrons in Europe
// FR: Unflag a political space in Europe. Bonus: Score 1 VP if Britain has no flags in Spain.
P.event_corsican_crisis = {
	inactive: "invade Corsica, or maybe not invade it",
	prompt() {
		if (R === BRITAIN) {
			let msg = "Shift Sardinia or Savoy"
			let any = false
			for (const s of [ SARDINIA, SAVOY ]) {
				if (G.flags[s] === R) continue
				action_space(s)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg, "score 1 VP if France has no squadrons in Europe")
		} else {
			let msg = "Unflag a political space in Europe"
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_EUROPE) continue
				if (data.spaces[s].type !== POLITICAL) continue
				if (G.flags[s] !== 1-R) continue
				action_space(s)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg, "score 1 VP if Britain has no flags in Spain")
		}
	},
	space(s) {
		push_undo()
		if (R === BRITAIN) {
			reflag_space(s, (G.flags[s] === NONE) ? BRITAIN : NONE)
			score_corsican_crisis(R)
			end()
		} else {
			reflag_space(s, NONE)
			score_corsican_crisis(R)
			end()
		}
	},
	done() {
		push_undo()
		score_corsican_crisis(R)
		end()
	}
}



function score_european_panic(who)
{
	award_vp(who, L.vp_award, false, (L.vp_award > 0) ? "Less debt than opponent" : "As much debt as opponent")
}


// For each Debt your opponent has in excess of yours (up to 4), score 1 VP. Bonus: Unflag an opposing Political space in Europe.
P.event_european_panic = {
	_begin() {
		if (G.debt[1-R] > G.debt[R]) {
			L.vp_award = Math.min(4, G.debt[1-R] - G.debt[R])
		} else {
			L.vp_award = 0
		}
	},
	inactive: "scare all the Europeans",
	prompt() {
		let msg = "For each Debt (NOT Available Debt) your opponent has in excess of yours (up to 4), score 1 VP"
		let msg2 = "unflag an opposing Political space in Europe"
		let any = false
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_EUROPE) continue
				if (data.spaces[s].type !== POLITICAL) continue
				if (G.flags[s] !== 1 - R) continue
				action_space(s)
				any = true
			}
		}
		if (!any) {
			msg2 += " (None possible)"
			button("done")
		}
		V.prompt = event_prompt(R, G.played_event, msg, msg2)
	},
	space(s) {
		push_undo()
		reflag_space(s, NONE)
		score_european_panic(R)
		end()
	},
	done() {
		push_undo()
		score_european_panic(R)
		end()
	}
}


// World's simplest event! +1 Econ. Bonus: +2 Econ in the Caribbean.
P.event_west_african_gold_mining = {
	inactive: "dig up some serious gold",
	prompt() {
		V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(1, ECON), say_action_points(2, ECON) + " in the Caribbean")
		button("confirm")
	},
	confirm() {
		push_undo()
		add_action_points(ECON, 1)
		event_made_econ()
		if (is_bit(QUALIFIES_FOR_BONUS)) add_contingent(ECON, 2, RULE_CARIBBEAN, SHORT_CARIBBEAN)
		end()
	}
}


function quadruple_alliance_british_bonus()
{
	if (!is_bit(QUALIFIES_FOR_BONUS)) return true
	if (!G.unbuilt_squadrons[BRITAIN]) {
		log("No unbuilt British squadrons remain -- cannot construct one.")
		return true
	}
	move_squadron_token(BRITAIN, SPACE_UNBUILT, SPACE_NAVY_BOX)

	G.unbuilt_squadrons[BRITAIN]--
	G.navy_box[BRITAIN]++
	validate_squadrons("QUADRUPLE ALLIANCE BUILD")
	log (bold("British squadron constructed."))
}


// BR: Remove a BR Squadron from the map or Navy Box to score 2 VP. It returns on the next peace turn. Bonus: Build a Squadron then take 1 Debt, or, if you have any, lose 1 TRP.
// FR: Shift a Spain space. Bonus: 1 Diplo
P.event_war_of_the_quadruple_alliance = {
	_begin() {
		L.picked_squadron = false
		L.shifted_spain = false
	},
	inactive: "make a quadruple alliance",
	prompt() {
		if (R === BRITAIN) {
			let msg = "Remove a British squadron from the map or Navy Box to score 2 VP"
			let msg2 = "build a squadron then take 1 debt or lose a TRP"

			if (!L.picked_squadron) {
				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].type !== NAVAL) continue
					if (G.flags[s] !== BRITAIN) continue
					action_space(s)
					any = true
				}
				if (G.navy_box[BRITAIN] > 0) {
					action_navy_box()
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
			} else {
				msg = "New Squadron added to Navy Box. Choose Debt or TRP for payment."
				msg2 = null
				button ("paydebt", (G.treaty_points[BRITAIN] === 0) || (available_debt(BRITAIN) > 0))
				button ("paytrp", G.treaty_points[BRITAIN] > 0)
			}
			V.prompt = event_prompt(R, G.played_event, msg, msg2)
		} else {
			let msg = "Shift a Spain space"
			let any = false
			for (const s of [ SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4 ]) {
				if (G.flags[s] === R) continue
				action_space(s)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg, "gain " + say_action_points(1, DIPLO))
		}
	},
	space(s) {
		push_undo()
		if (R === BRITAIN) {
			move_squadron_token(BRITAIN, s, SPACE_THE_BRIG)
			reflag_space(s, NONE, true)
			L.picked_squadron = true
			G.the_brig++
			log("British squadron at " + say_space(s, BRITAIN) + " removed (will return next peace turn).")
			validate_squadrons("QUADRUPLE MAP")
			award_vp(BRITAIN, 2)
			if (quadruple_alliance_british_bonus()) end()
		} else {
			reflag_space(s, (G.flags[s] === NONE) ? FRANCE : NONE)
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				add_action_points(DIPLO, 1)
				event_made_diplo()
			}
			end()
		}
	},
	navy_box() {
		push_undo()
		L.picked_squadron = true
		move_squadron_token(BRITAIN, SPACE_NAVY_BOX, SPACE_THE_BRIG)
		G.navy_box[BRITAIN]--
		G.the_brig++
		validate_squadrons("QUADRUPLE NAVY BOX")
		log("British squadron removed from Navy Box (will return next peace turn).")
		log(say_navy_box())
		award_vp(BRITAIN, 2)
		if (quadruple_alliance_british_bonus()) end()
	},
	paydebt() {
		push_undo()
		increase_debt(BRITAIN, 1)
		end()
	},
	paytrp() {
		push_undo()
		pay_treaty_points(BRITAIN, 1)
		log ("Britain spent " + say_spending("1 treaty point", BRITAIN) + ".")
		end()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			if (!L.picked_squadron) {
				L.picked_squadron = true
				if (quadruple_alliance_british_bonus()) end()
			}
		} else {
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				add_action_points(DIPLO, 1)
				event_made_diplo()
			}
			end()
		}
	}
}


// BR: Increase FR Debt by 1. Bonus: Increase FR Debt by another 2.
// FR: 2 Diplo in Europe. Bonus: 2 additional Diplo in Europe.
P.event_salon_d_hercule = {
	inactive: "play Salon d'Hercule",
	prompt() {
		if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, "Increase French Debt by 1", "increase French Debt by another 2")
		} else {
			V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(2, DIPLO) + " in Europe", "an additional " + say_action_points(2, DIPLO) + " in Europe")
		}
		button("confirm")
	},
	confirm() {
		push_undo()
		if (R === BRITAIN) {
			increase_debt(FRANCE, is_bit(QUALIFIES_FOR_BONUS) ? 3 : 1)
		} else {
			add_contingent(DIPLO, is_bit(QUALIFIES_FOR_BONUS) ? 4 : 2, RULE_EUROPE, SHORT_EUROPE)
			event_made_diplo()
		}
		end()
	}
}


// Place up to 2 Conflict markers in Markets in Political spaces in India
P.event_bengal_famine = {
	_begin() {
		L.conflicts_done = 0
		L.confirming = false
	},
	inactive: "find some food, fast",
	prompt() {
		if (L.confirming) {
			V.prompt = event_prompt(R, G.played_event, data.spaces[L.space].name + " belongs to you. Confirm placing a conflict marker there anyway?")
			button ("confirm")
		} else {
			let msg = "Place up to 2 conflict markers in markets or political spaces in India "
			let gauge = parens(L.conflicts_done + "/2")
			msg += gauge

			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_INDIA) continue
				if (!can_have_conflict_marker(s)) continue
				if (has_conflict_marker(s)) continue
				action_space(s)
				any = true
			}

			if (!any) {
				msg += " (None possible)"
			}

			V.prompt = event_prompt(R, G.played_event, msg)

			button("pass")
		}
	},
	confirm() {
		push_undo()
		add_conflict_marker(L.space)
		L.conflicts_done++
		L.confirming = false
		if (L.conflicts_done >= 2) end()
	},
	space(s) {
		push_undo()
		if (G.flags[s] === R) {
			L.confirming = true
			L.space = s
		} else {
			add_conflict_marker(s)
			L.conflicts_done++
			if (L.conflicts_done >= 2) end()
		}
	},
	pass() {
		push_undo()
		end()
	}
}


function father_le_loutre(s)
{
	add_conflict_marker(s)
	if (is_bit(QUALIFIES_FOR_BONUS)) {
		if (R === BRITAIN) {
			add_contingent(MIL, 2, RULE_NORTH_AMERICA, SHORT_NORTH_AMERICA)
		} else {
			add_contingent(ECON, 2, RULE_NORTH_AMERICA, SHORT_NORTH_AMERICA)
			event_made_econ(RULE_NORTH_AMERICA, SHORT_NORTH_AMERICA)
		}
	}
	end()
}


// BR: Place a Conflict marker in a Fish market. Bonus: 2 Mil in North America
// FR: Place a Conflict marker in a BR-flagged market. Bonus: 2 Econ in North America
P.event_father_le_loutre = {
	_begin() {
		L.confirming = false
	},
	inactive: "play Father le Loutre",
	prompt() {
		if (L.confirming) {
			V.prompt = event_prompt(R, G.played_event, data.spaces[L.space].name + " belongs to you. Confirm placing a conflict marker there anyway?")
			button("confirm")
		} else if (R === BRITAIN) {
			let msg = "Place a conflict marker in a Fish market"
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== MARKET) continue
				if (data.spaces[s].market !== FISH) continue
				if (has_conflict_marker(s)) continue
				action_space(s)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg, "gain " + say_action_points(2, MIL) + " in North America")
		} else {
			let msg = "Place a conflict marker in a British-flagged market"
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== MARKET) continue
				if (G.flags[s] !== BRITAIN) continue
				if (has_conflict_marker(s)) continue
				action_space(s)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg, "gain " + say_action_points(2, ECON) + " in North America")
		}
	},
	confirm() {
		push_undo()
		L.confirming = false
		father_le_loutre(L.space)
	},
	space(s) {
		push_undo()
		if (G.flags[s] === R) {
			L.confirming = true
			L.space = s
		} else {
			father_le_loutre(s)
		}
	},
	done() {
		push_undo()
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			if (R === BRITAIN) {
				add_contingent(MIL, 2, RULE_NORTH_AMERICA, SHORT_NORTH_AMERICA)
			} else {
				add_contingent(ECON, 2, RULE_NORTH_AMERICA, SHORT_NORTH_AMERICA)
				event_made_econ(RULE_NORTH_AMERICA, SHORT_NORTH_AMERICA)
			}
		}
		end()
	}
}



function do_polish_succession(who)
{
	if (who === BRITAIN) {
		add_treaty_points(who, 2)
	} else {
		award_vp(who, 2)
	}
}


// BR: Gain 2 TRP. Bonus: Shift Russia.
// FR: Score 2 VP. Bonus: Shift Russia or Sweden
P.event_war_of_the_polish_succession = {
	inactive: "get involved in the Polish Succession",
	prompt() {
		if (R === BRITAIN) {
			let msg = (G.flags[RUSSIA] === BRITAIN) ? "Russia already British-flagged" : "shift Russia"
			V.prompt = event_prompt(R, G.played_event, "Gain 2 treaty points", msg)
			if (G.flags[RUSSIA] === BRITAIN) {
				button("done")
			} else {
				if (is_bit(QUALIFIES_FOR_BONUS)) {
					action_space(RUSSIA)
				}
				button("done")
			}
		} else {
			let msg = "shift Russia or Sweden"
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				let any = false
				for (const s of [ RUSSIA, SWEDEN ]) {
					if (G.flags[s] === R) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
			} else {
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, "Score 2 VP", msg)
		}
	},
	space(s) {
		push_undo()
		reflag_space(s, (G.flags[s] === NONE) ? R : NONE)
		do_polish_succession(R)
		end()
	},
	done() {
		push_undo()
		if ((R === BRITAIN) && (G.flags[RUSSIA] !== BRITAIN) && is_bit(QUALIFIES_FOR_BONUS)) reflag_space(RUSSIA, (G.flags[RUSSIA] === NONE) ? R : NONE)
		do_polish_succession(R)
		end()
	}
}


// +2 Econ. Bonus: +1 Econ and reduce your debt by 1.
P.event_jonathans_coffee_house = {
	inactive: "grab a quick coffee",
	prompt() {
		V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(2, ECON), "an additional " + say_action_points(1, ECON) + " and reduce your debt by 1")
		button("confirm")
	},
	confirm() {
		add_action_points(ECON, is_bit(QUALIFIES_FOR_BONUS) ? 3 : 2)
		event_made_econ()
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			if (G.debt[R] > 0) {
				reduce_debt(R, 1)
			} else {
				log(say_spending(data.flags[R].adj + " debt", R) + " was already 0.")
			}
		}
		end()
	}
}



function nootka_bonus()
{
	if (!is_bit(QUALIFIES_FOR_BONUS)) return
	if (G.active === BRITAIN) {
		let score = 0
		for (const s of [ SPAIN_1, SPAIN_3 ]) {
			if (G.flags[s] !== BRITAIN) continue
			if (has_conflict_marker(s)) continue
			score += 2
			reflag_space(s, NONE)
		}
		award_vp(BRITAIN, score, false, (score/2) + " flag" + s(score/2) + " removed from alliance spaces in Spain")
	} else {
		if (G.unbuilt_squadrons[FRANCE] > 0) {
			move_squadron_token(FRANCE, SPACE_UNBUILT, SPACE_NAVY_BOX)
			G.navy_box[FRANCE]++
			G.unbuilt_squadrons[FRANCE]--
			validate_squadrons("NOOTKA")

			log ("French squadron added to Navy Box.")
			log (say_navy_box())
		}
	}
}


// BR: +2 Diplo or +2 Econ. Bonus: Score 2 VP per BR-flagged alliance space in Spain, then remove those flags.
// FR: Displace a BR Squadron to Navy Box. Bonus: Construct a squadron.
P.event_nootka_incident = {
	inactive: "head to Nootka",
	prompt() {
		if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, say_action_points(2, DIPLO) + " or " + say_action_points(2, ECON), "score 2 VP per British-flagged alliance space in Spain, then remove those flags")
			button("diplomatic2")
			button("economic2")
		} else if (R === FRANCE) {
			let msg = "Displace a British squadron to the Navy Box"
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== NAVAL) continue
				if (G.flags[s] !== BRITAIN) continue
				action_space(s)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg, "construct a squadron")
		}
	},
	diplomatic2() {
		push_undo()
		add_action_points(DIPLO, 2)
		event_made_diplo()
		nootka_bonus()
		end()
	},
	economic2() {
		push_undo()
		add_action_points(ECON, 2)
		nootka_bonus()
		end()
	},
	space(s) {
		push_undo()
		move_squadron_token(BRITAIN, s, SPACE_NAVY_BOX)
		reflag_space(s, NONE)
		G.navy_box[BRITAIN]++
		log (say_space(s) + " squadron displaced.")
		validate_squadrons("NOOTKA DISPLACE")

		log (say_navy_box())
		nootka_bonus()
		end()
	},
	done() {
		push_undo()
		log ("Nootka Incident: no British squadrons available to displace.")
		nootka_bonus()
		end()
	}
}


// Place a conflict in a Caribbean Sugar market
// BONUS: Place Conflict markers in two additional such markets
// -- Conflict markers placed by this event cost 1 extra Mil to resolve --
P.event_haitian_revolution = {
	_begin() {
		L.conflicts_to_do = is_bit(QUALIFIES_FOR_BONUS) ? 3 : 1
		L.conflicts_done  = 0
		L.confirming = false
	},
	inactive: "play Haitian Revolution",
	prompt() {
		if (L.confirming) {
			V.prompt = event_prompt(R, G.played_event, data.spaces[L.space].name + " belongs to you. Confirm placing a conflict marker there anyway?")
			button("confirm")
		} else {
			let msg = !is_bit(QUALIFIES_FOR_BONUS) ? "Place a conflict marker in a Sugar market in the Caribbean." : "Place 3 conflict markers in Sugar markets in the Caribbean."
			let gauge = (G.conflicts_to_do > 1) ? (L.conflicts_done + "/" + L.conflicts_to_do) : ""
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_CARIBBEAN) continue
				if (data.spaces[s].type !== MARKET) continue
				if (data.spaces[s].market !== SUGAR) continue
				if (has_conflict_marker(s)) continue
				action_space(s)
				any = true
			}
			if (!any) {
				if (L.conflicts_done > 0) {
					gauge = "DONE - no more eligible spaces"
				} else {
					gauge = "None possible"
				}
				button("done")
			}

			if (gauge !== "") {
				msg += " " + parens(gauge)
			}
			msg += " Conflict markers placed by this end cost an extra " + say_action_points(1, MIL) + " to remove"
			V.prompt = event_prompt(R, G.played_event, msg)
		}
	},
	confirm() {
		L.confirming = false
		L.conflicts_done++
		add_conflict_marker(L.space, CONFLICT_PLUS_ONE)
		if (L.conflicts_done >= L.conflicts_to_do) {
			end()
		}
	},
	space(s) {
		push_undo()
		if (G.flags[s] === R) {
			L.confirming = true
			L.space = s
		} else {
			L.conflicts_done++
			add_conflict_marker(s, CONFLICT_PLUS_ONE)
			if (L.conflicts_done >= L.conflicts_to_do) {
				end()
			}
		}
	},
	done() {
		push_undo()
		end()
	},
}



function neuf_soeurs_bonus()
{
	if (!is_bit(QUALIFIES_FOR_BONUS)) return
	if (R === BRITAIN) {
		if (G.flag_count[BRITAIN][REGION_NORTH_AMERICA] > G.flag_count[FRANCE][REGION_NORTH_AMERICA]) {
			award_vp(BRITAIN, 3)
		}
	}
}

// BR: Place one conflict marker in the Northern Colonies sub-region. Bonus: If there are more BR than FR flags in North America, Score 3 VP.
// FR: Activate an advantage you control outside Europe (ignore Exhaustion). Bonus: 2 Diplo
P.event_loge_des_neuf_soeurs = {
	_begin() {
		L.confirming = false
	},
	inactive: "count to nine",
	prompt() {
		if (L.confirming) {
			V.prompt = event_prompt(R, G.played_event, data.spaces[L.space].name + " belongs to you. Confirm placing a conflict marker there anyway?")
			button("confirm")
		} else if (R === BRITAIN) {
			let msg = "Place a conflict marker in the Northern Colonies sub-region"
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_NORTH_AMERICA) continue
				if (data.spaces[s].subreg !== SUBREGION_NORTHERN_COL) continue
				if (!can_have_conflict_marker(s)) continue
				if (has_conflict_marker(s)) continue
				action_space(s)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg, "if there are more British than French flags in North America, score 3 VP")
		} else {
			let msg = "Activate an advantage you control outside Europe, ignoring exhaustion"
			let any = false
			for (let a = 0; a < NUM_ADVANTAGES; a++) {
				if (get_advantage_region(a) === REGION_EUROPE) continue
				if (!has_advantage_eligible(R, a, true)) continue
				action_advantage(a)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			} else {
				button("pass") //BR// If we don't let people pass here, then you can end up with eligible-to-activate-but-currently-unusable advantages (e.g. discount w/ no econ points, conflict w/ no eligible targets) blocking the player from getting the bonus half of the card
			}
			V.prompt = event_prompt(R, G.played_event, msg, "gain " + say_action_points(2, DIPLO))
		}
	},
	confirm() {
		push_undo()
		L.confirming = false
		add_conflict_marker(L.space)
		neuf_soeurs_bonus()
		end()
	},
	space(s) {
		push_undo()
		if (G.flags[s] === R) {
			L.confirming = true
			L.space = s
		} else {
			add_conflict_marker(s)
			neuf_soeurs_bonus()
			end()
		}
	},
	advantage(a) {
		push_undo()

		if (is_bit(QUALIFIES_FOR_BONUS)) {
			add_action_points(DIPLO, 2)
			event_made_diplo()
		}

		G.active_advantage = a
		G.adv_used++
		G.adv_regions |= (1 << get_advantage_region(a))
		clear_bit(ADVANTAGE_ALREADY_EXHAUSTED)
		set_bit(DONT_EXHAUST_ADVANTAGE)
		goto ("advantage_flow")
	},
	pass() {
		this.done()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			neuf_soeurs_bonus()
		} else {
			if (is_bit(QUALIFIES_FOR_BONUS)) {
				add_action_points(DIPLO, 2)
				event_made_diplo()
			}
		}
		end()
	},
}



function gabelle_bonus()
{
	if (!is_bit(QUALIFIES_FOR_BONUS)) return
	add_action_points(ECON, 2)
}


// BR: Exhaust up to 2 advantages (BR player's choice). They do not take effect. Bonus: 2 Econ
// FR: 2 Econ. Bonus: Score 2 VP (or 3 VP, if you have the Governance keyword)
P.event_la_gabelle = {
	_begin() {
		L.advantages_done = 0
	},
	inactive: "tinker with the French tax system",
	prompt() {
		if (R === BRITAIN) {
			let msg = "Exhaust up to 2 advantages. They do not take effect"
			let any = false
			for (let a = 0; a < NUM_ADVANTAGES; a++) {
				if (is_advantage_exhausted(a)) continue
				action_advantage(a)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
			} else {
				msg += " " + parens(L.advantages_done + "/2")
			}
			button("pass")
			V.prompt = event_prompt(R, G.played_event, msg, "gain " + say_action_points(2, ECON))
		} else {
			V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(2, ECON), "score 2 VP, or 3 VP if you have the Governance keyword")
			button("done")
		}
	},
	advantage(a) {
		push_undo()
		exhaust_advantage(a, true, "", false, false)
		L.advantages_done++
		if (L.advantages_done >= 2) {
			gabelle_bonus()
			end()
		}
	},
	pass() {
		push_undo()
		gabelle_bonus()
		end()
	},
	done() {
		push_undo()
		add_action_points(ECON, 2)
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			award_vp(FRANCE, has_active_keyword(R, GOVERNANCE) ? 3 : 2)
		}
		end()
	}
}



function jesuit_bonus()
{
	if (!is_bit(QUALIFIES_FOR_BONUS)) return
	add_contingent(ECON, 3, RULE_CARIBBEAN, SHORT_CARIBBEAN)
}


// BR: Unflag a Sugar market. Bonus: +3 Econ (Caribbean only)
// FR: Reduce your debt by 2. Bonus: Score 2 VP
P.event_jesuit_abolition = {
	inactive: "kick the Jesuits out",
	prompt() {
		if (R === BRITAIN) {
			let msg = "Unflag a Sugar market"
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== MARKET) continue
				if (data.spaces[s].market !== SUGAR) continue
				if (G.flags[s] !== 1 - R) continue
				action_space(s)
				any = true
			}
			if (!any) {
				msg += " (None possible)"
				button("done")
			}
			V.prompt = event_prompt(R, G.played_event, msg, "gain " + say_action_points(3, ECON) + " (Caribbean only)")
		} else {
			V.prompt = event_prompt(R, G.played_event, "Reduce your debt by 2", "score 2 VP")
			button("done")
		}
	},
	space(s) {
		push_undo()
		reflag_space(s, NONE)
		jesuit_bonus()
		end()
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			jesuit_bonus()
			end()
		} else {
			reduce_debt(FRANCE, 2)
			if (is_bit(QUALIFIES_FOR_BONUS)) award_vp(FRANCE, 2)
			end()
		}
	},
}


// Reduce your debt by 2. Bonus: +3 ECON
// NEW RECORD HOLDER, SIMPLEST EVENT EVER!!!
P.event_wealth_of_nations = {
	inactive: "get rich quick",
	prompt() {
		V.prompt = event_prompt(R, G.played_event, "Reduce your debt by 2", "gain " + say_action_points(3, ECON))
		button("confirm")
	},
	confirm() {
		push_undo()
		reduce_debt(R, 2)
		if (is_bit(QUALIFIES_FOR_BONUS)) add_action_points(ECON, 3)
		end()
	}
}


// If you have more available debt than opponent, receive +3 Economic action points (must be used to unflag markets). Bonus: Score 2 VP.
P.event_debt_crisis = {
	inactive: "call in your debt",
	prompt() {
		V.prompt = event_prompt(R, G.played_event, "If you have more available debt than opponent, receive " + say_action_points(3, ECON) + " (must be used to unflag markets)", "bonus: score 2 VP")
		button("confirm")
	},
	confirm() {
		push_undo()
		if (available_debt(R) > available_debt(1-R)) {
			add_contingent(ECON, 3, RULE_UNFLAG_MARKETS, SHORT_UNFLAG_MARKETS)
		}
		if (is_bit(QUALIFIES_FOR_BONUS)) {
			award_vp(R, 2)
		}
		end()
	}
}


// If you have more combined squadrons, forts, and local alliances in India than your opponent does, score 3 VP.
P.event_east_asia_piracy = {
	inactive: "say ARRRRRRRRRRRRRRR",
	prompt() {
		V.prompt = event_prompt(R, G.played_event, "If you have more combined squadrons, forts, and local alliances in India than your opponent does, score 3 VP.")
		button("done")
	},
	done() {
		push_undo()
		let me = 0
		let you = 0
		for (let s = 0; s < NUM_SPACES; s++) {
			if (data.spaces[s].region !== REGION_INDIA) continue
			if ((data.spaces[s].type !== NAVAL) && (data.spaces[s].type !== FORT)) {
				if ((data.spaces[s].type !== POLITICAL) || has_conflict_marker(s)) continue
			}
			if (G.flags[s] === NONE) continue
			if (G.flags[s] === R) {
				me++
			} else if (G.flags[s] === 1 - R) {
				you++
			}
		}
		if (me > you) {
			award_vp(R, 3)
		} else {
			log ("No VP award (" + me + " combined squadrons, forts, and alliances, vs. opponent's " + you + ").")
		}
		end()
	}
}


// BR: Reduce your debt by 2. Bonus: 2 Econ
// FR: Place 1 conflict marker in the Northern Colonies sub-region. Bonus: Place 3 instead.
P.event_stamp_act = {
	_begin() {
		L.conflicts_done = 0
		L.conflicts_to_do = is_bit(QUALIFIES_FOR_BONUS) ? 3 : 1
		L.confirming = false
	},
	inactive: "find out what Boston thinks about taxes",
	prompt() {
		if (L.confirming) {
			V.prompt = event_prompt(R, G.played_event, data.spaces[L.space].name + " belongs to you. Confirm placing a conflict marker there anyway?")
			button("confirm")
		} else if (R === BRITAIN) {
			V.prompt = event_prompt(R, G.played_event, "Reduce your debt by 2", "gain " + say_action_points(2, ECON))
			button("confirm")
		} else {
			let msg = "Place " + L.conflicts_to_do + " conflict marker" + s(L.conflicts_to_do) + " in the Northern Colonies sub-region"
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_NORTH_AMERICA) continue
				if (data.spaces[s].subreg !== SUBREGION_NORTHERN_COL) continue
				if (!can_have_conflict_marker(s)) continue
				if (has_conflict_marker(s)) continue
				action_space(s)
				any = true
			}
			if (!any) {
				if (L.conflicts_done > 0) {
					msg += " (DONE - no more eligible spaces)"
				} else {
					msg += " (None possible)"
				}
				button("done")
			} else if (L.conflicts_to_do > 1) {
				msg += " " + parens(L.conflicts_done + "/" + L.conflicts_to_do)
			}
			V.prompt = event_prompt(R, G.played_event, msg)
		}
	},
	space(s) {
		push_undo()
		if (G.flags[s] === R) {
			L.confirming = true
			L.space = s
		} else {
			add_conflict_marker(s)
			L.conflicts_done++
			if (L.conflicts_done >= L.conflicts_to_do) end()
		}
	},
	confirm() {
		if (L.confirming) {
			L.confirming = false
			add_conflict_marker(L.space)
			L.conflicts_done++
			if (L.conflicts_done >= L.conflicts_to_do) end()
		} else {
			this.done()
		}
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			reduce_debt(R, 2)
			if (is_bit(QUALIFIES_FOR_BONUS)) add_action_points(ECON, 2)
		}
		end()
	}
}


// BR: If there is a BR-flagged space in Spain, score 1 VP. Bonus: Unflag a space in Spain.
// FR: Receive 1 Mil for each FR flag in Spain. Bonus: Remove a BR Squadron from the game
P.event_falklands_crisis = {
	_begin() {
		L.done_starting = false
	},
	inactive: "get way ahead of Margaret Thatcher",
	prompt() {
		if (R === BRITAIN) {
			if (!L.done_starting) {
				V.prompt = event_prompt(R, G.played_event, "If there is a British-flagged space in Spain, score 1 VP", "bonus: unflag a space in Spain")
				button("done")
			} else {
				let msg = "Unflag a space in Spain"
				let any = false
				for (const s of [ SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4 ]) {
					if (G.flags[s] !== FRANCE) continue
					action_space(s)
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
				V.prompt = event_prompt(R, G.played_event, msg)
			}
		} else {
			if (!L.done_starting) {
				V.prompt = event_prompt(R, G.played_event, "Confirm gain of " + say_action_points(1, MIL) + " for each French flag in Spain", "remove a British squadron from the game")
				button("confirm")
			} else {
				let msg = "Remove a British squadron from the game"
				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].type !== NAVAL) continue
					if (G.flags[s] !== BRITAIN) continue
					action_space(s)
					any = true
				}
				if (G.navy_box[BRITAIN] > 0) {
					action_navy_box()
					any = true
				}
				if (!any) {
					msg += " (None possible)"
					button("done")
				}
				V.prompt = event_prompt(R, G.played_event, msg)
			}
		}
	},
	space(s) {
		push_undo()
		if (R === BRITAIN) {
			reflag_space(s, NONE)
			end()
		} else {
			move_squadron_token(BRITAIN, s, SPACE_REMOVED_FROM_GAME)
			reflag_space(s, NONE, true)
			validate_squadrons("FALKLANDS")

			log("British squadron at " + say_space(s) + " removed from the game.")
			end()
		}
	},
	navy_box() {
		push_undo()
		move_squadron_token(BRITAIN, SPACE_NAVY_BOX, SPACE_REMOVED_FROM_GAME)
		G.navy_box[BRITAIN]--
		validate_squadrons("FALKLANDS NAVY BOX")

		log ("British squadron from Navy Box removed from the game.")
		log (say_navy_box())
		end()
	},
	confirm() {
		this.done()
	},
	done() {
		push_undo()

		if (L.done_starting) {
			end()
			return
		}

		L.done_starting = true

		if (R === BRITAIN) {
			let any = false
			for (const s of [SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4]) {
				if (G.flags[s] !== BRITAIN) continue
				if (has_conflict_marker(s)) continue
				any = true
				break
			}
			if (any) {
				award_vp(BRITAIN, 1)
			} else {
				log("No VP award - no British-flagged spaces in Spain.")
			}
		} else {
			let spain = 0
			for (const s of [ SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4 ]) {
				if (G.flags[s] !== FRANCE) continue
				if (has_conflict_marker(s)) continue
				spain++
			}
			if (spain > 0) {
				add_action_points(MIL, spain)
			} else {
				log ("No action point award - no French-flagged spaces in Spain.")
			}
		}

		if (!is_bit(QUALIFIES_FOR_BONUS)) end()
	}
}


// BR: 1 =econ= for every 2 squadrons you have on the map or in Navy Box. Bonus: Draw a Bonus War Tile.
// FR: Add a squadron to the Navy Box. Bonus: Reduce your debt by 2.
P.event_cook_and_bougainville = {
	_begin() {
		L.squadrons = 0
		for (let s = 0; s < NUM_SPACES; s++) {
			if (data.spaces[s].type !== NAVAL) continue
			if (G.flags[s] !== BRITAIN) continue
			L.squadrons++
		}
		L.squadrons += G.navy_box[BRITAIN]
		L.econ_award = Math.floor(L.squadrons / 2)
		L.done_award = false
	},
	inactive: "circumnavigate",
	prompt() {
		if (R === BRITAIN) {
			if (!L.done_award) {
				V.prompt = event_prompt(R, G.played_event, "Confirm gain of +" + say_action_points(L.econ_award, ECON) + " (1 for every 2 squadrons you have on the map or in the Navy Box)", "draw a Bonus War Tile")
				button("done")
			} else {
				V.prompt = event_prompt(R, G.played_event, "Confirm drawing Bonus War Tile (CANNOT BE UNDONE)")
				button("confirm")
			}
		} else {
			V.prompt = event_prompt(R, G.played_event, "Add a squadron to the Navy Box", "reduce your debt by 2")
			button("done")
		}
	},
	confirm() {
		clear_undo()
		set_transient(R, TRANSIENT_COOK)
		goto ("bonus_war_tile_decisions")
	},
	done() {
		push_undo()
		if (R === BRITAIN) {
			if (!L.done_award) {
				L.done_award = true
				add_action_points(ECON, L.econ_award)
				if (!is_bit(QUALIFIES_FOR_BONUS)) end()
				if (free_theaters(R) <= 0) {
					log ("No bonus war tile can be drawn: all theaters full!")
					end()
				}
			}
		} else {
			if (G.unbuilt_squadrons[FRANCE] > 0) {
				move_squadron_token(FRANCE, SPACE_UNBUILT, SPACE_NAVY_BOX)
				G.navy_box[FRANCE]++
				G.unbuilt_squadrons[FRANCE]--
				log("French squadron added to Navy Box.")
				validate_squadrons("COOK AND BOUG")

				log(say_navy_box())
			} else {
				log("No squadron added: all French squadrons are already in play!")
			}
			if (is_bit(QUALIFIES_FOR_BONUS)) reduce_debt(FRANCE, 2)
			end()
		}
	}
}


function handle_ministry_card_click(m)
{
	G.action_header = data.ministries[m].name.toUpperCase() + ": "

	// The *index* into the player's ministry i.e. G.ministry[R][G.ministry_index] of the ministry card clicked on (distinct from the actual ministr" id)
	// <br><b>
	// G.ministry[R][G.ministry_index] </b> contains card id (m) the card the player clicked on
	G.ministry_index = G.ministry[R].indexOf(m)

	// The ministry id (m) of the card the player clicked on - an index into data.ministries[...]
	G.ministry_id = m

	clear_bit(MINISTRY_ALREADY_REVEALED)
	clear_bit(MINISTRY_PROMPT_TO_EXHAUST)
	set_bit(MINISTRY_MANUALLY_CLICKED)

	delete G.has_required_ministry //G.has_required_ministry = undefined // undefined is a meaningful state here

	// String reason we are requesting/suggesting the player flip up a ministry
	G.ministry_required_because = ""

	if (G.ministry_index >= 0) {
		call ("ministry_flow")
	}
}

P.ministry_flow = script (`
	eval { clear_bit(MINISTRY_JUST_REVEALED) }

	if (!G.ministry_revealed[R][G.ministry_index]) {
		eval { clear_bit(STARTED_MINISTRY_BOX) }
		call confirm_reveal_ministry
		if (is_bit(MINISTRY_MANUALLY_CLICKED)) {
			return // If we manually clicked the minister and then chose to reveal him, that's the action.
		}
	}

	//eval {
	//	if (!is_log_box(LOG_BOX_MINISTRY)) log_box_ministry(G.active, G.ministry_id)
	//}

	if (G.ministry_revealed[R][G.ministry_index]) {
		if (data.ministries[G.ministry_id].proc !== undefined) {
			call (data.ministries[G.ministry_id].proc)
		} else {
			if (is_bit(MINISTRY_JUST_REVEALED) && !is_bit(MINISTRY_MANUALLY_CLICKED)) {
				if (!ministry_has_activatable_abilities(G.ministry_id)) {
					call ministry_not_activatable
				} else {
					call ministry_not_implemented
				}
			}
		}
	}

	eval {
		clear_bit(MINISTRY_MANUALLY_CLICKED)
		log_box_end(LOG_BOX_MINISTRY)     // only end it if it's a Ministry box, not if we're embedded in somebody else's box
	}
`)


function start_ministry_effect()
{
	if (!is_log_box(LOG_BOX_MINISTRY)) log_box_ministry(G.active, G.ministry_id)
}


function ministry_has_activatable_abilities(m)
{
	return ![JONATHAN_SWIFT, EAST_INDIA_COMPANY, MARQUIS_DE_CONDORCET, JOHN_LAW, COURT_OF_THE_SUN_KING, MERCHANT_BANKS, SAMUEL_JOHNSON, JAMES_WATT, EDMUND_BURKE, TURGOT, VOLTAIRE, POMPADOUR_AND_DU_BARRY, DUPLEIX, LAVOISIER, NORTH_AMERICAN_TRADE].includes(m)
}

// Is there something the player could conceivably accomplish by clicking on this ministry right now (based on how long-in-the-tooth the current action phase has gotten)
function ministry_useful_this_phase(m, subphase)
{
	switch (subphase) {
		case BEFORE_PICKING_TILE:
			return [ BANK_OF_ENGLAND, ROBERT_WALPOLE, TOWNSHEND_ACTS, NEW_WORLD_HUGUENOTS ].includes(m)

		case OPTION_TO_PLAY_EVENT:
		case DURING_EVENT:
		case BEFORE_SPENDING_ACTION_POINTS:
		case ACTION_POINTS_ALREADY_SPENT:
		default:

			if (subphase > OPTION_TO_PLAY_EVENT) {
				return ![ THE_CARDINAL_MINISTERS ].includes(m) // Ministries which can't be activated after playing an event or spending action points
			}

			return true
	}
}


function ministry_prompt(who, m, string1, string2 = "") {
	var prompt = ""
	if ((G.subphase === BEFORE_PICKING_TILE) && !ministry_useful_this_phase(m, G.subphase)) {
		prompt += "You must pick an investment tile before you can use this ministry's abilities."
	}
	else if ((G.subphase > OPTION_TO_PLAY_EVENT) && !ministry_useful_this_phase(m, G.subphase)) {
		prompt += "This ministry can only be activated at the beginning of your action round."
	}
	else if (is_ministry_fully_exhausted(who, m) || (is_ministry_partially_exhausted(who, m) && ((string1 == null) || (string2 == null)))) {
		prompt += "Ministry Exhausted."
	}
	else {
		if ((string2 === "") || (string2 === null)) {
			prompt += string1 + "."
		}
		else if (string1 === null) {
			prompt += string2 + "."
		}
		else {
			let ex = is_ministry_exhausted(who, m, 0) && ((m !== JACOBITE_UPRISINGS) || !has_transient(who, TRANSIENT_JACOBITES_SHIFT_SPACES))
			prompt += strike(string1, ex)
			if (ex) prompt += " (exhausted)"
			prompt += " OR "
			prompt += strike(string2, is_ministry_exhausted(who, m, 1))
			if (is_ministry_exhausted(who, m, 1)) prompt += " (exhausted)"
			prompt += "."
		}
	}
	return say_ministry_header() + say_action(prompt)
}

function reveal_ministry(who, index) {
	if (index < 0) return

	let m = G.ministry[who][index]
	G.ministry_revealed[who][index] = TRUE
	let msg = "Ministry Revealed"
	if (!is_log_box(LOG_BOX_MINISTRY)) {
		msg += ": \n" + say_ministry(m, who, false)
	}
	log (msg)

	// Effects right when ministry is revealed, if applicable, like pooching off Jacobites if we're the Pope

	if (m === PAPACY_HANOVER_NEGOTIATIONS) {
		remove_jacobites()
	}

	if ((m === EDMUND_BURKE) && !has_transient(who, TRANSIENT_BURKE_FOR_DISCOUNT)) {
		if ((G.subphase > BEFORE_PICKING_TILE) && is_entirely_in_europe(DIPLO) && action_points_eligible_major(DIPLO, RULE_EUROPE_BURKE)) {
			let proc = 0
			if (has_transient(who, TRANSIENT_TILE_MADE_DIPLO)) proc++
			if (has_transient(who, TRANSIENT_EVENT_MADE_DIPLO)) proc++
			add_contingent(DIPLO, burke_points(who) * proc, RULE_EUROPE_BURKE, SHORT_EUROPE_BURKE, true)
			exhaust_ministry(who, m)
		}
	}

	if (m === NORTH_AMERICAN_TRADE) {
		refresh_huguenots()
	}
}


P.confirm_reveal_ministry = {
	_begin() {
		if (G.has_required_ministry === FALSE) end() //NB: explicitly check false, because undefined is a meaningful state here
		if (G.ministry_revealed[R][G.ministry_index] && !is_bit(MINISTRY_PROMPT_TO_EXHAUST)) end()
	},
	inactive() {
		if (!G.ministry_revealed[((G.active === "France") || (G.active === FRANCE)) ? FRANCE : BRITAIN][G.ministry_index]) {
			return "reveal a ministry"
		} else {
			return "use a ministry's ability"
		}
	},
	prompt() {
		if (!G.ministry_revealed[R][G.ministry_index]) {
			V.prompt = say_action_header() + say_action("Reveal " + say_ministry(G.ministry[R][G.ministry_index]) + " Ministry Card?")
			button("reveal_ministry")
			if (is_bit(MINISTRY_OPTIONAL)) button("dont_reveal_ministry")
		} else {
			V.prompt = say_action_header() + say_action("Exhaust " + say_ministry(G.ministry[R][G.ministry_index]) + " Ministry Card Ability?")
			button ("exhaust_ministry")
			if (is_bit(MINISTRY_OPTIONAL)) button("dont_exhaust_ministry")
		}
		if ((G.ministry_required_because !== undefined) && (G.ministry_required_because !== "")) V.prompt += say_action(" (" + G.ministry_required_because + ")")

		if (is_bit(MINISTRY_MANUALLY_CLICKED) && !ministry_useful_this_phase(G.ministry_id, G.subphase)) {
			V.prompt += say_action(" (NOTE: abilities cannot activate yet -- e.g. must pick investment tile, or must be beginning of round, or similar reason)")
		}

		V.prompt += say_action_points_left()
	},
	reveal_ministry() {
		push_undo()
		set_bit(MINISTRY_JUST_REVEALED)
		if (!is_log_box(LOG_BOX_MINISTRY)) {
			log_box_ministry(R, G.ministry_id) // If we manually click on a minister to reveal him, don't reveal his name into the log until he's confirmed to be getting revealed (otherwise would leak information)
			set_bit(STARTED_MINISTRY_BOX)
		}
		reveal_ministry(R, G.ministry_index)
		if (is_bit(MINISTRY_PROMPT_TO_EXHAUST)) exhaust_ministry(R, G.ministry_id, G.ministry_ability)
		G.has_required_ministry = TRUE
		end()
	},
	dont_reveal_ministry() {
		push_undo()
		end()
	},
	exhaust_ministry() {
		push_undo()
		if (!is_log_box(LOG_BOX_MINISTRY)) {
			log_box_ministry(R, G.ministry_id)
			set_bit(STARTED_MINISTRY_BOX)
		}
		exhaust_ministry(R, G.ministry_id, G.ministry_ability)
		G.has_required_ministry = TRUE
		end()
	},
	dont_exhaust_ministry() {
		push_undo()
		G.has_required_ministry = FALSE
		end()
	}
}

P.ministry_not_activatable = {
	inactive: "use a ministry's ability",
	prompt() {
		let msg = "This ministry does not require manual activation. It takes effect automatically at the appropriate time"
		V.prompt = ministry_prompt(R, G.ministry_id, msg)
		button ("pass")
	},
	pass() {
		push_undo()
		end()
	}
}

P.ministry_not_implemented = {
	inactive: "use a ministry's ability",
	_begin() {
		let msg = "Ministry not yet emplemented: " + data.events[G.ministry_id].name
		console.error (msg)
		if (globalThis.RTT_FUZZER) throw new Error(msg)
	},
	prompt() {
		let msg = "Ministry not yet implemented"
		V.prompt = ministry_prompt(R, G.ministry_id, msg)
		button ("pass")
	},
	pass() {
		push_undo()
		end()
	}
}


P.ministry_robert_walpole = {
	_begin() {
		L.drawn_extra = false
	},
	inactive: "activate Robert Walpole",
	prompt() {
		if (L.drawn_extra) {
			V.prompt = say_ministry_header() + say_action("You must now [click] an event card to discard.") + say_action_points_left()
			for (var c of G.hand[R]) {
				action_event_card(c)
			}
		} else {
			V.prompt = ministry_prompt(R, ROBERT_WALPOLE, "You may draw an event card (and then discard one).") + say_action_points_left()
			button("draw_an_event")
			button("pass")
		}
	},
	draw_an_event() {
		clear_undo() // Because we're drawing a new event card
		start_ministry_effect()

		log_box_ministry(R, ROBERT_WALPOLE)
		exhaust_ministry(R, ROBERT_WALPOLE)

		if (G.deck.length === 0) {
			log ("Discard Pile shuffled to form new Event Deck.")
			G.deck = G.discard_pile.slice()
			G.discard_pile = []
			shuffle(G.deck)
			validate_decks("ROBERT WALPOLE")
		}

		if (G.deck.length > 0) {
			G.hand[R].push(G.deck.pop())
			L.drawn_extra = true
			log (data.flags[R].name + " drew new event card.")
		} else {
			log ("Event deck EMPTY. Could not an draw event card.")
			end()
		}
	},
	event_card(c) {
		push_undo()
		log (data.flags[R].name + " discards event: E" + c)
		// Discard the old card
		array_delete_item(G.hand[R], c)
		G.discard_pile.push(c)
		log_box_end(LOG_BOX_MINISTRY)
		end()
	},
	pass() {
		push_undo()
		end()
	}
}


P.ministry_bank_of_england = {
	_begin() {
		L.picking_event = false
	},
	inactive: "activate the Bank of England",
	prompt() {
		if (!L.picking_event) {
			V.prompt = ministry_prompt(R, BANK_OF_ENGLAND, "You may increase your debt limit by one", "you may play an economic event even if your selected investment tile does not have an economic major action (it must still have the event symbol)") + say_action_points_left()
			if (ministry_useful_this_phase(BANK_OF_ENGLAND, G.subphase)) {
				button("increase_debt_limit", !is_ministry_exhausted(R, BANK_OF_ENGLAND, 0))
			}
			button("play_event", ((G.subphase <= OPTION_TO_PLAY_EVENT) && (G.subphase > BEFORE_PICKING_TILE)) && !is_ministry_exhausted(R, BANK_OF_ENGLAND, 1))
		} else {
			V.prompt = ministry_prompt(R, BANK_OF_ENGLAND, "Select an economic event to play")
			for (const e of G.hand[R]) {
				if (data.cards[e].action !== ECON) continue
				action_event_card(e)
			}
		}
		button("pass")
	},
	increase_debt_limit() {
		push_undo()
		start_ministry_effect()
		log_box_ministry(R, BANK_OF_ENGLAND)
		exhaust_ministry(R, BANK_OF_ENGLAND)
		G.debt_limit[R]++
		log_br()
		log(bold(data.flags[R].name + " Debt Limit +1."))
		log_br()
		log_box_end(LOG_BOX_MINISTRY)
		end()
	},
	play_event() {
		push_undo()
		start_ministry_effect()
		L.picking_event = true
	},
	event_card(c) {
		push_undo()
		G.played_event = c
		G.action_header = "PLAY EVENT: "
		set_transient(R, TRANSIENT_BANK_OF_ENGLAND)
		goto ("event_flow")
	},
	pass() {
		push_undo()
		end()
	}
}


P.ministry_edmond_halley = {
	inactive: "activate Edmond Halley",
	prompt() {
		V.prompt = ministry_prompt(R, EDMOND_HALLEY, "Build discounted squadron", "discard an event to gain 1 Treaty Point") + say_action_points_left()
		if (ministry_useful_this_phase(EDMOND_HALLEY, G.subphase)) {
			if (!is_ministry_exhausted(R, EDMOND_HALLEY, 1) && ((G.flags[BISCAY] === BRITAIN) || (G.flags[BALEARIC] === BRITAIN))) {
				for (var card of G.hand[R]) {
					action_event_card(card)
				}
				L.any = true
			}

			button("build_squadron", !is_ministry_exhausted(R, EDMOND_HALLEY, 0) && (G.subphase >= PICKED_TILE_OPTION_TO_PASS) && G.eligible[MIL])
		}
		button("pass")
	},
	build_squadron() {
		push_undo()
		start_ministry_effect()
		advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
		action_cost_setup(-1, MIL)
		G.action_string = "to construct a squadron"
		G.prepicked_ministry = EDMOND_HALLEY
		G.prepicked_advantage = -1
		goto ("construct_squadron_flow")
	},
	event_card(c) {
		push_undo()
		start_ministry_effect()
		log_box_ministry(R, EDMOND_HALLEY)
		exhaust_ministry(R, EDMOND_HALLEY,1)

		// Discard the old card
		array_delete_item(G.hand[R], c)
		G.discard_pile.push(c)
		log (data.flags[R].name + " discarded event: E" + c)

		G.treaty_points[R]++
		log (data.flags[R].name + " gained " + say_spending("1 Treaty Point", R) + ".")
		log_box_end(LOG_BOX_MINISTRY)
		end()
	},
	pass() {
		push_undo()
		end()
	}
}

function cardinal_ministers_value()
{
	let raw_value = 0
	for (const s of [SAVOY, SARDINIA, AUSTRIA_2, AUSTRIA_4, SPAIN_2, SPAIN_4]) {
		if (G.flags[s] !== FRANCE) continue
		if (has_conflict_marker(s)) continue
		raw_value++
	}
	return Math.min(raw_value, 3)
}


function use_cardinal_ministers() {
	log_box_ministry(R, THE_CARDINAL_MINISTERS)
	exhaust_ministry(R, THE_CARDINAL_MINISTERS)

	if (G.major[DIPLO] > 0) {
		G.major[DIPLO] += cardinal_ministers_value()
	} else {
		G.minor[DIPLO] += cardinal_ministers_value()
	}
	log (bold(data.flags[FRANCE].name + " gained " + say_action_points(cardinal_ministers_value(), DIPLO) + ((G.major[DIPLO] <= 0) ? " (Minor)" : "") + "."))
	log_box_end(LOG_BOX_MINISTRY)
}


P.ministry_cardinal_ministers = {
	inactive: "activate the Cardinal Ministers",
	prompt() {
		V.prompt = ministry_prompt(R, THE_CARDINAL_MINISTERS, "Confirm use of ministry to gain " + say_action_points(cardinal_ministers_value(), DIPLO)) + "(You presently have " + say_action_points_left() + ")"
		if (cardinal_ministers_value() < 1) V.prompt = say_ministry_header() + say_action("You do not control any of the necessary spaces to gain a bonus.")
		if (ministry_useful_this_phase(THE_CARDINAL_MINISTERS, G.subphase) && !G.eligible[DIPLO]) V.prompt = say_ministry_header() + say_action("Your investment tile does not confer any " + say_action_points(0, DIPLO, false, false) + ".")
		if (ministry_useful_this_phase(THE_CARDINAL_MINISTERS, G.subphase) && (cardinal_ministers_value() > 0) && G.eligible[DIPLO] && !is_ministry_exhausted(R, THE_CARDINAL_MINISTERS)) {
			button("confirm")
		}
		button ("pass")
	},
	confirm() {
		push_undo()
		start_ministry_effect()
		use_cardinal_ministers()
		end()
	},
	pass() {
		push_undo()
		end()
	}
}


P.ministry_new_world_huguenots = {
	inactive: "place New World Huguenots",
	prompt() {
		let msg = "Place Huguenots marker in a French-flagged territory in North America or the Caribbean"
		let any = false
		if (!is_ministry_exhausted(R, NEW_WORLD_HUGUENOTS)) {
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== TERRITORY) continue
				if ((data.spaces[s].region !== REGION_NORTH_AMERICA) && (data.spaces[s].region !== REGION_CARIBBEAN)) continue
				if (G.flags[s] !== FRANCE) continue
				if (has_huguenots(s)) continue
				action_space(s)
				any = true
			}
		}
		if (!any) {
			msg += " (None possible)"
		}
		V.prompt = ministry_prompt(R, NEW_WORLD_HUGUENOTS, msg)
	},
	space(s) {
		push_undo()
		start_ministry_effect()
		log_box_ministry(R, NEW_WORLD_HUGUENOTS)
		exhaust_ministry(R, NEW_WORLD_HUGUENOTS)
		add_huguenots(s)
		log (bold("Huguenots added at " + say_space(s, FRANCE) + "."))
		log_box_end(LOG_BOX_MINISTRY)
		end()
	},
}


function jacobite_vp_value()
{
	let vp = 0
	for (const s of [ IRELAND_1, IRELAND_2, SCOTLAND_1, SCOTLAND_2 ]) {
		if (has_conflict_marker(s)) continue
		if (G.flags[s] === FRANCE) vp++
	}

	vp += G.jacobite_victory

	vp = Math.min(4, vp)
	return vp
}

function do_award_jacobite_vp()
{
	log_box_ministry(FRANCE, JACOBITE_UPRISINGS)
	exhaust_ministry(FRANCE, JACOBITE_UPRISINGS, 1)
	award_vp(FRANCE, jacobite_vp_value(), false, "Jacobite Uprisings")
	display_action_cost()
	log_box_end(LOG_BOX_MINISTRY)
}

P.jacobite_vp_flow = script (`
	call decide_how_and_whether_to_spend_action_points
	eval { G.action_header = "" }
	if (!is_bit(PAID_ACTION_COST)) {
		return
	}
	eval { do_award_jacobite_vp() }
`)


P.jacobite_divert = {
	inactive: "shift a space",
	prompt() {
		V.prompt = bold("Use diplomatic or military points to shift " + data.spaces[G.active_space].name + "?")
		button("military")
		button("diplomatic")
	},
	military() {
		push_undo()
		advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
		action_cost_setup(G.active_space, MIL)
		G.action_cost   = action_point_cost(R, G.active_space, DIPLO, true) //NB: we use the political space-shifting cost, but charge the player military points
		G.action_string = "to shift " + say_space(G.active_space) + " space"
		G.action_header = say_ministry_header()
		goto ("jacobite_flow")
	},
	diplomatic() {
		push_undo()
		goto ("jacobite_back_to_diplo")
	}
}


P.jacobite_back_to_diplo = script(`
	eval { standard_space_click(G.active_space, DIPLO) }
`)

function jacobite_start_shift()
{
	G.action_header = ""
	log_box_ministry(FRANCE, JACOBITE_UPRISINGS)
	set_transient(R, TRANSIENT_JACOBITES_SHIFT_SPACES)
	//if (!is_ministry_exhausted(FRANCE, JACOBITE_UPRISINGS, 0)) {
	//	exhaust_ministry(FRANCE, JACOBITE_UPRISINGS, 0)
	//}
}

P.jacobite_flow = script (`
	call decide_how_and_whether_to_spend_action_points

	eval { jacobite_start_shift() }

	if (!is_bit(PAID_ACTION_COST)) {
		return
	}

	eval {
		do_reflag_space()
		log_box_end(LOG_BOX_MINISTRY)
	}
`)


P.ministry_jacobite_uprisings = {
	inactive: "activate Jacobite Uprisings",
	prompt() {
		V.prompt = ministry_prompt(R, JACOBITE_UPRISINGS, "Shift spaces in Scotland/Ireland with " + say_action_points(0, MIL, false, false), "score " + jacobite_vp_value() + " VP for " + say_action_points(3, MIL)) + say_action_points_left()
		if (ministry_useful_this_phase(JACOBITE_UPRISINGS, G.subphase)) {
			if (G.eligible[MIL]) {
				if ((!is_ministry_exhausted(R, JACOBITE_UPRISINGS, 0) || has_transient(R, TRANSIENT_JACOBITES_SHIFT_SPACES)) && !has_transient(R, TRANSIENT_JACOBITES_SCORE_VP)) {
					for (const s of [IRELAND_1, IRELAND_2, SCOTLAND_1, SCOTLAND_2]) {
						if (G.flags[s] !== FRANCE) {
							if ((G.flags[s] === NONE) || action_points_eligible_major(MIL, space_rules(s, MIL))) { // If we're unflagging, can't use minor action
								action_space(s, INCLUDE_CONFLICT)
							}
						}
					}
				}

				if (!is_ministry_exhausted(R, JACOBITE_UPRISINGS, 1)) {
					button("jacobite_vp", !has_transient(R, TRANSIENT_JACOBITES_SHIFT_SPACES))
				}
			} else {
				V.prompt = say_ministry_header() + say_action("This ministry requires [@2] (military action points) to activate.")
			}
		}
		if (is_bit(MINISTRY_JUST_REVEALED)) button("pass") // If we just manually revealed the ministry (only) we may not want to do any actions and that's okay (allowing pass in other conditions would leave a spurious log box commemorating our indecision)
	},
	jacobite_vp() {
		push_undo()
		start_ministry_effect()
		set_transient(R, TRANSIENT_JACOBITES_SCORE_VP)
		advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
		action_cost_setup(-1, MIL)
		G.action_cost = 3
		G.action_string = "to score " + jacobite_vp_value() + " VP with " + say_ministry(JACOBITE_UPRISINGS)
		G.action_header = say_ministry_header()
		goto ("jacobite_vp_flow")
	},
	conflict(s) {
		this.space(s)
	},
	space(s) {
		push_undo()
		start_ministry_effect()
		set_transient(R, TRANSIENT_JACOBITES_SHIFT_SPACES)
		advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
		action_cost_setup(s, MIL)
		G.action_cost   = action_point_cost(R, s, DIPLO, true) //NB: we use the political space-shifting cost, but charge the player military points
		G.action_string = "to shift " + say_space(s) + " space"
		G.action_header = say_ministry_header()
		goto ("jacobite_flow")
	},
	pass() {
		push_undo()
		end()
	}
}


P.ministry_pitt_the_elder = {
	inactive: "activate Pitt the Elder",
	prompt() {
		V.prompt = ministry_prompt(R, PITT_THE_ELDER, "Gain 1 diplomatic action usable for shifting non-prestige spaces", "build discounted squadron") + say_action_points_left()
		if (ministry_useful_this_phase(PITT_THE_ELDER, G.subphase) && !is_ministry_fully_exhausted(R, PITT_THE_ELDER)) {

			if (!is_ministry_exhausted(R, PITT_THE_ELDER, 0)) {
				button ("diplomatic_point", !is_ministry_exhausted(R, PITT_THE_ELDER, 0) && G.eligible[DIPLO])
			}

			button("build_squadron", !is_ministry_exhausted(R, PITT_THE_ELDER, 1) && (G.subphase >= PICKED_TILE_OPTION_TO_PASS) && G.eligible[MIL])
		}
		button ("pass")
	},
	build_squadron() {
		push_undo()
		start_ministry_effect()
		advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
		action_cost_setup(-1, MIL)
		G.action_string = "to construct a squadron"
		G.prepicked_ministry = PITT_THE_ELDER
		G.prepicked_advantage = -1
		goto ("construct_squadron_flow")
	},
	diplomatic_point() {
		push_undo()
		start_ministry_effect()
		log_box_ministry(R, PITT_THE_ELDER)
		exhaust_ministry(R, PITT_THE_ELDER, 0)
		add_contingent(DIPLO, 1, RULE_SHIFT_NON_PRESTIGE, SHORT_SHIFT_NON_PRESTIGE, true)
		log_box_end(LOG_BOX_MINISTRY)
		end()
	},
	pass() {
		push_undo()
		end()
	},
}


P.ministry_charles_hanbury_williams = {
	inactive: "activate Charles Hanbury Williams",
	prompt() {
		V.prompt = ministry_prompt(R, CHARLES_HANBURY_WILLIAMS, "Reduce cost to unflag FR spaces in Prussia, German States, and Russia by 1 [@1]") + say_action_points_left()
		if (ministry_useful_this_phase(CHARLES_HANBURY_WILLIAMS, G.subphase)) {
			if (!is_ministry_exhausted(R, CHARLES_HANBURY_WILLIAMS)) {
				button ("unflag_discount", action_points_eligible_major(DIPLO, active_rules()))
			}
		}
		button ("pass")
	},
	unflag_discount() {
		push_undo()
		start_ministry_effect()
		exhaust_ministry(R, CHARLES_HANBURY_WILLIAMS)
		set_transient(R, TRANSIENT_CHARLES_HANBURY_WILLIAMS)
		log (say_ministry(CHARLES_HANBURY_WILLIAMS) + " will reduce the cost to unflag French-flagged spaces in Prussia, German States, and Russia for the rest of the action round.")
		log_box_end(LOG_BOX_MINISTRY)
		end()
	},
	pass() {
		push_undo()
		end()
	},
}

P.ministry_choiseul = {
	prompt() {
		V.prompt = ministry_prompt(R, CHOISEUL, "Gain an extra " + say_action(1, MIL) + " usable for Bonus War Tiles or deploying squadrons only", "build discounted a squadron") + say_action_points_left()
		if (ministry_useful_this_phase(CHOISEUL, G.subphase)) {
			button ("military_point", G.eligible[MIL] && (action_points_eligible_major(MIL, active_rules()) || G.minor[MIL]) && !is_ministry_exhausted(R, CHOISEUL, 0))
			button("build_squadron", !is_ministry_exhausted(R, CHOISEUL, 1) && (G.subphase >= PICKED_TILE_OPTION_TO_PASS) && G.eligible[MIL] && (squadrons_in_region(R, REGION_NORTH_AMERICA) > 0))
		}
		button ("pass")
	},
	build_squadron() {
		push_undo()
		start_ministry_effect()
		advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
		action_cost_setup(-1, MIL)
		G.action_string = "to construct a squadron"
		G.prepicked_ministry = CHOISEUL
		G.prepicked_advantage = -1
		goto ("construct_squadron_flow")
	},
	military_point() {
		push_undo()
		start_ministry_effect()
		log_box_ministry(R, CHOISEUL)
		exhaust_ministry(R, CHOISEUL, 0)
		add_contingent(MIL, 1, RULE_WAR_TILE_OR_DEPLOY, SHORT_WAR_TILE_OR_DEPLOY, true)
		log_box_end(LOG_BOX_MINISTRY)
		end()
	},
	pass() {
		push_undo()
		end()
	},
}


P.ministry_papacy_hanover_negotiations = {
	inactive: "activate Papacy Hanover Negotiations",
	prompt() {
		let msg = ""
		if (ministry_useful_this_phase(PAPACY_HANOVER_NEGOTIATIONS, G.subphase) && !is_ministry_exhausted(R, PAPACY_HANOVER_NEGOTIATIONS)) {
			if (!action_points_eligible(R, active_rules())) {
				msg = "You don't have any diplomatic actions this round."
				button("pass")
			} else {
				msg = say_action_points(2, DIPLO) + " usable only to shift spaces in Scotland and Ireland."
				button("done")
			}
		}
		V.prompt = ministry_prompt(R, PAPACY_HANOVER_NEGOTIATIONS, msg)
	},
	done() {
		push_undo()
		start_ministry_effect()
		exhaust_ministry(R, PAPACY_HANOVER_NEGOTIATIONS)
		add_contingent(DIPLO, 2, RULE_SCOTLAND_IRELAND, SHORT_SCOTLAND_IRELAND, true)
		log_box_end(LOG_BOX_MINISTRY)
		end()
	},
	pass() {
		end()
	}
}


P.ministry_townshend_acts = {
	inactive: "activate the Townshend Acts",
	prompt() {
		V.prompt = ministry_prompt(R, TOWNSHEND_ACTS, "Select a Global Demand to which to apply the Townshend Acts")
		if (ministry_useful_this_phase(TOWNSHEND_ACTS, G.subphase) && !is_ministry_exhausted(R, TOWNSHEND_ACTS)) {
			for (const d of G.global_demand) {
				action_demand(d)
			}
		}
	},
	demand(d) {
		push_undo()
		start_ministry_effect()
		apply_townshend_acts(d)
		end()
	}
}


function apply_townshend_acts(d)
{
	log_box_ministry(BRITAIN, TOWNSHEND_ACTS)
	exhaust_ministry(BRITAIN, TOWNSHEND_ACTS)
	G.townshend_acts = d
	log ("Britain applied " + say_ministry(TOWNSHEND_ACTS, BRITAIN) + " to " + say_demand(d) + ". British Minor actions may be used to unflag " + say_demand(d) + " this turn.")
	log_box_end(LOG_BOX_MINISTRY)
}


function handle_townshend_acts_click(d)
{
	apply_townshend_acts(d)
}



function advantage_prompt(who, a, string1 = "") {
	var header = say_advantage(a, -1, true) + ": " // NB: Not passing who -- don't want text colored in a prompt

	var prompt = ""
	if (G.subphase === BEFORE_PICKING_TILE) {
		prompt += "You must pick an investment tile before you can activate advantages."
	}
	else if (is_bit(ADVANTAGE_ALREADY_EXHAUSTED)) {
		prompt += "Advantage Exhausted."
	}
	else {
		prompt += string1
	}
	return say_action_header(header) + say_action(prompt)
}


function handle_advantage_click(a)
{
	G.active_advantage = a
	G.adv_used++
	G.adv_regions |= (1 << get_advantage_region(a))
	set_bit(ADVANTAGE_ALREADY_EXHAUSTED, is_advantage_exhausted(a))
	call ("advantage_flow")
}


P.advantage_flow = script (`
	if ((R === FRANCE) && get_advantage_region(G.active_advantage) === REGION_EUROPE) {
		eval { require_ministry(R, POMPADOUR_AND_DU_BARRY, "For an extra TRP when activating an advantage in Europe", true) }
	}

	if (!is_bit(ADVANTAGE_ALREADY_EXHAUSTED) && !is_bit(DONT_EXHAUST_ADVANTAGE)) {
		eval { exhaust_advantage(G.active_advantage, false) } //NB: This also begins a log box with LOG_BOX_ADVANTAGE
	} else {
		eval {
			log_box_begin(R, say_advantage(G.active_advantage, R, true), LOG_BOX_ADVANTAGE)
			clear_bit (DONT_EXHAUST_ADVANTAGE)
		}
	}

	if (data.advantages[G.active_advantage].proc !== undefined) {
		call (data.advantages[G.active_advantage].proc)
	} else {

		//if (!advantage_activatable_now(G.active_advantage)) {
		//	call advantage_not_activatable
		//}

		call advantage_not_implemented
	}

	eval { log_box_end(LOG_BOX_ADVANTAGE) }
`)


// Should never get here anymore
P.advantage_not_implemented = {
	inactive: "activate an advantage",
	prompt() {
		let msg = "Advantage not yet implemented."
		V.prompt = advantage_prompt(R, G.active_advantage, msg)
		button ("pass")
	},
	pass() {
		push_undo()
		end()
	}
}

P.advantage_baltic_trade = {
	inactive: "activate Baltic Trade",
	prompt() {
		if (G.debt[R] <= 0) {
			V.prompt = advantage_prompt(R, G.active_advantage, "You currently have no debt.")
		} else {
			let amount = Math.min(2, G.debt[R])
			V.prompt = advantage_prompt(R, G.active_advantage, "Use advantage to reduce debt by " + amount + "?")
			if (amount === 1) V.prompt += " (You currently have only 1 debt)"
			button ("use_advantage")
		}
	},
	use_advantage() {
		push_undo()
		reduce_debt(R, Math.min(2, G.debt[R]))
		end()
	}
}


P.advantage_slaving_contracts = function() {
	advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
	action_cost_setup(-1, MIL)
	G.action_string = "to construct a squadron"
	G.prepicked_advantage = SLAVING_CONTRACTS
	G.prepicked_ministry = -1
	goto ("construct_squadron_flow")
}


P.advantage_naval_bastion = {
	_begin() {
		action_cost_setup(-1, MIL)
	},
	inactive: "activate Naval Bastion",
	prompt() {
		if (!G.eligible_major[MIL]) {
			V.prompt = advantage_prompt(R, G.active_advantage, "You need an available major Military action to use this advantage.")
		} else {
			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== NAVAL) continue
				if (G.flags[s] !== 1 - R) continue
				action_space(s)
				any = true
			}

			if (any) {
				V.prompt = advantage_prompt(R, G.active_advantage, "Select opposing squadron to return to Navy Box for " + say_action_points(1, MIL) + ".")
			} else {
				V.prompt = advantage_prompt(R, G.active_advantage, "Your opponent has no deployed squadrons.")
			}
		}
	},
	space(s) {
		push_undo()
		move_squadron_token(1-R, s, SPACE_NAVY_BOX)
		G.navy_box[1 - R]++
		reflag_space(s, NONE, true)
		validate_squadrons("QUADRUPLE NAVAL BASTION")

		log (bold(say_space(s) + " squadron to Navy Box."))

		log (say_navy_box())

		G.action_cost = 1

		goto ("pay_naval_bastion")
	}
}


function do_naval_bastion()
{
	display_action_cost()
}


P.pay_naval_bastion = script(`
	call decide_how_and_whether_to_spend_action_points
	if (!is_bit(PAID_ACTION_COST)) {
		eval { pop_undo() }
		return
	}

	eval { do_naval_bastion() }
`)


function set_up_conflict_advantage(a)
{
	switch (a) {
		case RAIDS_AND_INCURSIONS:
			L.adv_string = "in a market in India."
			L.adv_market_only = true
			L.adv_region = REGION_INDIA
			break
		case SEPARATIST_WARS:
			L.adv_string = "in a Cotton market."
			L.adv_market_only = true
			L.adv_market_type = COTTON
			break
		case POWER_STRUGGLE:
			L.adv_string = "in a Carnatic Coast market."
			L.adv_region = REGION_INDIA
			L.adv_market_only = true
			// unique code for Carnatic Coast specifically
			break
		case LETTERS_OF_MARQUE:
		case PIRATE_HAVENS:
			L.adv_string = "in an unprotected Caribbean market."
			L.adv_market_only = true
			L.adv_region = REGION_CARIBBEAN
			// unique code for unprotected
			break
		case PATRIOT_AGITATION:
			L.adv_string = "in North America."
			L.adv_region = REGION_NORTH_AMERICA
			break
		case IROQUOIS_RAIDS:
		case ALGONQUIN_RAIDS:
			L.adv_string = "in a Fur Market."
			L.adv_market_only = true
			L.adv_market_type = FURS
			break
		case MEDITERRANEAN_INTRIGUE:
			L.adv_string = "in Spain, Austria, or Sardinia."
			// unique code
			break
		case CENTRAL_EUROPE_CONFLICT:
			L.adv_string = "in an alliance space in Europe."
			L.adv_region = REGION_EUROPE
			// unique code for alliance
			break
	}
}


function check_advantage_targets(who, mark_action)
{
	let any = false
	for (let s = 0; s < NUM_SPACES; s++) {
		if (L.adv_market_only || (data.spaces[s].type !== POLITICAL)) {
			if (data.spaces[s].type !== MARKET) continue
		}
		if ((L.adv_market_type >= 0) && (data.spaces[s].market !== L.adv_market_type)) continue
		if ((L.adv_region >= 0) && (data.spaces[s].region !== L.adv_region)) continue
		if (data.spaces[s].era > current_era()) continue // Some diplomatic spaces are era-locked
		if (((s === USA_1) || (s === USA_2)) && !G.usa_flags) continue // USA flags only if USA exists

		switch (G.active_advantage) {
			case POWER_STRUGGLE:
				if (data.spaces[s].subreg !== SUBREGION_CARNATIC_COAST) continue
				break

			case LETTERS_OF_MARQUE:
			case PIRATE_HAVENS:
				if (is_protected(s)) continue
				break

			case MEDITERRANEAN_INTRIGUE:
				if (![SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4, AUSTRIA_1, AUSTRIA_2, AUSTRIA_3, AUSTRIA_4, SARDINIA].includes(s)) continue
				break

			case CENTRAL_EUROPE_CONFLICT:
				if (data.spaces[s].alliance === undefined) continue
				if (data.spaces[s].alliance.length <= 0) continue
				break
		}

		if ((who === FRANCE) || (who === BRITAIN)) {
			if (G.flags[s] === who) continue
		}

		if (has_conflict_marker(s)) continue
		any = true
		if (mark_action) action_space(s)
	}
	return any
}

function has_advantage_targets(who, a)
{
	if (![CENTRAL_EUROPE_CONFLICT, MEDITERRANEAN_INTRIGUE, ALGONQUIN_RAIDS, IROQUOIS_RAIDS, PATRIOT_AGITATION, LETTERS_OF_MARQUE, PIRATE_HAVENS, RAIDS_AND_INCURSIONS, POWER_STRUGGLE, SEPARATIST_WARS].includes(a)) return true
	set_up_conflict_advantage(a)
	return check_advantage_targets(who, false)
}


P.advantage_place_conflict = {
	_begin() {
		let a = G.active_advantage
		L.adv_region = -1
		L.adv_market_only = false
		L.adv_market_type = -1
		set_up_conflict_advantage(a)
		L.confirming = false
	},
	inactive() {
		return "place a conflict with the " + data.advantages[G.active_advantage].name + " advantage"
	},
	prompt() {
		if (L.confirming) {
			V.prompt = advantage_prompt(R, G.active_advantage, data.spaces[L.space].name + " belongs to you. Confirm placing a conflict marker there anyway?")
			button("confirm")
		} else {
			V.prompt = advantage_prompt(R, G.active_advantage, "Place a Conflict " + L.adv_string)
			if (!check_advantage_targets(NONE, true)) V.prompt += " (None eligible)"
		}
	},
	confirm() {
		push_undo()
		L.confirming = false
		add_conflict_marker(L.space)
		end()
	},
	space(s) {
		push_undo()
		if (G.flags[s] === R) {
			L.confirming = true
			L.space = s
		} else {
			add_conflict_marker(s)
			end()
		}
	}
}

P.advantage_unflag_discount = {
	_begin() {
		let a = G.active_advantage
		L.adv_region = -1
		L.adv_market = true
		L.adv_market_type = -1
		L.adv_for_one = false
		switch (a) {
			case FUR_TRADE:
				L.adv_string = "market in North America"
				L.adv_plural = "markets in North America"
				L.adv_region = REGION_NORTH_AMERICA
				L.adv_market = true
				L.adv_for_one = true
				break
			case WHEAT:
				L.adv_string = "market in North America"
				L.adv_plural = "markets in North America"
				L.adv_region = REGION_NORTH_AMERICA
				L.adv_market = true
				break
			case TEXTILES:
			case SILK:
				L.adv_string = "market in India"
				L.adv_plural = "markets in India"
				L.adv_region = REGION_INDIA
				L.adv_market = true
				break
			case RUM:
			case FRUIT:
				L.adv_string = "market in the Caribbean"
				L.adv_plural = "markets in the Caribbean"
				L.adv_region = REGION_CARIBBEAN
				L.adv_market = true
				break
			case GERMAN_DIPLOMACY:
				L.adv_string = "space in Russia, Sweden, or Bavaria"
				L.adv_plural = "spaces in Russia, Sweden, or Bavaria"
				L.adv_region = REGION_EUROPE
				L.adv_market = false
				L.adv_for_one = true
				break
			case SILESIA_NEGOTIATIONS:
				L.adv_string = "space in Prussia or the German States"
				L.adv_plural = "spaces in Prussia or the German States"
				L.adv_region = REGION_EUROPE
				L.adv_market = false
				L.adv_for_one = true
				break
			case ITALY_INFLUENCE:
				L.adv_string = "space in Spain or Austria"
				L.adv_plural = "spaces in Spain or Austria"
				L.adv_region = REGION_EUROPE
				L.adv_market = false
				L.adv_for_one = true
				break
		}
	},
	inactive() {
		return "unflag a space with the " + data.advantages[G.active_advantage].name + " advantage"
	},
	prompt() {
		let type = L.adv_market ? ECON : DIPLO
		let msg = "Pick a " + L.adv_string + " to unflag " + (L.adv_for_one ? "for " + say_action_points(1, type) + "." : "for one fewer [@" + type + "].")
		let space_type = L.adv_market ? MARKET : POLITICAL
		if (!action_points_eligible(type, active_rules())) { // Consider all possible sources of action points. If we don't have ANY of the right type then stop.
			if (type === ECON) {
				msg = "You must have an Economic action available to unflag markets."
			} else {
				msg = "You must have a Diplomatic action available to unflag political spaces."
			}
		} else {
			let any = false
			let any_flagged = false
			let any_non_conflict = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== L.adv_region) continue
				if (data.spaces[s].type !== space_type) continue
				if (G.flags[s] !== 1 - G.active) continue
				any_flagged = true
				if (!has_conflict_marker(s)) any_non_conflict = true
				if ((type === ECON) && !allowed_to_shift_market(s, R)) continue
				if (!is_shift_allowed(s, R, true, space_rules(s, type))) continue
				if (!action_points_eligible_major(type, space_rules(s, type)) && !eligible_for_minor_action(s, R)) continue

				if (G.active_advantage === GERMAN_DIPLOMACY) {
					if (![RUSSIA, SWEDEN, BAVARIA].includes(s)) continue
				} else if (G.active_advantage === SILESIA_NEGOTIATIONS) {
					if (![PRUSSIA_1, PRUSSIA_2, PRUSSIA_3, PRUSSIA_4, GERMAN_STATES_1, GERMAN_STATES_2].includes(s)) continue
				} else if (G.active_advantage === ITALY_INFLUENCE) {
					if (![SPAIN_1, SPAIN_2, SPAIN_3, SPAIN_4, AUSTRIA_1, AUSTRIA_2, AUSTRIA_3, AUSTRIA_4].includes(s)) continue
				}

				action_space(s)
				any = true
			}
			if (!any_flagged) {
				msg = "There are no eligible enemy-flagged " + L.adv_plural + " right now."
			} else if (any_non_conflict && G.minor[type] > 0) {
				msg = "With a minor action you can only unflag spaces that have a conflict marker."
			} else if (!G.eligible_major[type] && (G.minor[type] <= 0) && (type === data.investments[G.played_tile].minortype)) {
				msg = "You cannot make a second purchase with a minor action."
			} else if (!any) {
				msg = "You do not have eligible connections to any unflaggable " + L.adv_plural + "."
			}
		}
		V.prompt = advantage_prompt(R, G.active_advantage, msg)
	},
	space(s) {
		push_undo()
		action_cost_setup(s, L.adv_market ? ECON : DIPLO)
		G.action_cost = action_point_cost(G.active, s, G.action_type)
		if (L.adv_for_one) {
			action_point_cost_modify(MODIFY_SET_TO_1, MODIFY_ADVANTAGE)
		} else {
			action_point_cost_modify(-1, MODIFY_ADVANTAGE)
		}
		goto ("space_flow")
	}
}


/* 5.4.1 - In order to shift a Market, that Market must be connected to a Territory, Fort, or Naval space the player controls, or be connected to another Market the player controls that does not contain a Conflict marker, is not Isolated, and did not change control during the current Action Round. */
function allowed_to_shift_market(s, who)
{
	for (const link of data.spaces[s].connects) {
		if (G.flags[link] !== who) continue
		if ([ FORT, NAVAL, TERRITORY ].includes(data.spaces[link].type)) return true // Can always shift if adjacent to friendly fort/navy/territory
		if (data.spaces[link].type === MARKET) {
			if (has_conflict_marker(link)) continue       // Not if conflict
			if (is_isolated_market(link)) continue        // Not if isolated
			if (!set_has(G.controlled, link)) continue    // Can't "daisy chain" from market we shifted THIS round
			return true
		}
	}
	return false
}


/* 5.3.2 "Minor Actions may not be used to remove opposing flags or Squadrons, unless the space has a Conflict Marker." Returns true if eligible for a minor action in the space (enemy spaces can only be unflagged if a conflict marker is present, or the Jonathan Swift / Townshend Acts ministry exceptions) */
function eligible_for_minor_action(s, who)
{
	if ((s >= 0) && (G.flags[s] !== NONE) && (G.flags[s] !== who)) {
		if ([ FORT, NAVAL ].includes(data.spaces[s].type)) return false // Can't pop enemy forts or squadrons
		if (!has_conflict_marker(s)) {
			// Other nations flags can only be removed w/ presence of a conflict marker

			// ... except European diplomatic spaces with Jonathan Swift ministry active and at least one space in Ireland
			if (((data.spaces[s].region === REGION_EUROPE) && (data.spaces[s].type === POLITICAL) && has_active_ministry(who, JONATHAN_SWIFT) && (has_unconflicted(IRELAND_1, who) || has_unconflicted(IRELAND_2, who)))) {
				return true
			}

			// ... and except markets for Townshend Act goods
			if ((who === BRITAIN) && has_active_ministry(who, TOWNSHEND_ACTS) && (data.spaces[s].type === MARKET) && (data.spaces[s].market === G.townshend_acts)) {
				return true
			}

			return false
		}
	}
	return true
}


// Returns true if eligible for an action of this type (minor or major), checking the optional list of rules for potential contingent points
function action_points_eligible(type, rules = []) {
	return G.eligible[type] || any_contingent(type, rules, true)
}


// Returns true if eligible for a major action of this type, checking the optional list of rules for potential contingent points
function action_points_eligible_major(type, rules = []) {
	return G.eligible_major[type] || any_contingent(type, rules, true)
}


// Returns the number of major action points available of the type, checking the optional list of rules for potential contingent points
function action_points_major(type, rules = [], allow_minor = false) {
	return G.major[type] + get_contingent(type, rules, !action_points_eligible_major(type, rules) && !allow_minor)
}


function action_points_available(who, s, type, allow_debt_and_trps, rules = [])
{
	if (!action_points_eligible(type, rules)) return 0

	var eligible_minor = eligible_for_minor_action(s, who)
	if (!action_points_eligible_major(type, rules) && !eligible_minor) return 0

	if (type === DIPLO) {
		// If we have already spent "Edmund Burke major-action-must-be-all-in-europe" points, then we can't do diplomatic actions *outside* of europe unless we have a minor action
		if (has_transient(who, TRANSIENT_MUST_BE_ENTIRELY_IN_EUROPE) && ((s < 0) || (data.spaces[s].region !== REGION_EUROPE))) {
			if (!eligible_minor) return 0
			return G.minor[type] + (allow_debt_and_trps ? available_debt_plus_trps(who) : 0) + action_points_major(type, rules, eligible_minor)
		}

		if (eligible_minor) {
			let burke = get_contingent(DIPLO, RULE_EUROPE_BURKE, false)
			if ((burke > 0) && is_entirely_in_europe(DIPLO) && ((s < 0) || (data.spaces[s].region !== REGION_EUROPE))) {
				// If we're considering our first action outside Europe, don't combine Edmund Burke diplo-major points with minor actions
				return Math.max(
					action_points_major(type, rules, eligible_minor) + G.committed[type] + (allow_debt_and_trps ? available_debt_plus_trps(who) : 0),
					action_points_major(type, rules, eligible_minor) + G.committed[type] + (allow_debt_and_trps ? available_debt_plus_trps(who) : 0) + (eligible_minor ? G.minor[type] - burke : 0)
				)
			}
		}
	}

	return action_points_major(type, rules, eligible_minor) + G.committed[type] + (allow_debt_and_trps ? available_debt_plus_trps(who) : 0) + (eligible_minor ? G.minor[type] : 0)
}

// True if we're legally allowed to shift the space (includes minor action rules).
function is_shift_allowed(s, who, allow_debt_and_trps, rules = [])
{
	var type = space_action_type(s)

	if (!action_points_eligible(type, rules)) return false

	// Don't let fuzzer see spaces we know we can't afford
	if (globalThis.RTT_FUZZER) {
		action_cost_setup(s, type)
		var cost = action_point_cost(R, s, type)
		var avail = action_points_available(who, s, type, allow_debt_and_trps)
		if (avail < cost) return false
	}

	return action_points_eligible_major(type, rules) || eligible_for_minor_action(s, who)
}


function action_eligible_spaces_econ(region)
{
	for (const space of data.spaces) {
		if ((region !== REGION_ALL) && (region !== space.region)) continue
		if (space.type !== MARKET) continue
		if (G.flags[space.num] === R) continue // can't shift our own spaces
		if (!allowed_to_shift_market(space.num, R)) continue // the connected-market rules, etc.
		if (!action_points_eligible_major(ECON, space_rules(space.num, ECON))) { // We either need eligibility for major action *at this space*, or else we need to have non-zero minor action points remaining
			if (!G.minor[ECON]) continue
		}
		if (!action_points_eligible(ECON, space_rules(space.num, ECON))) continue
		if (!is_shift_allowed(space.num, R, true, space_rules(space.num, ECON))) continue

		action_space(space.num, INCLUDE_CONFLICT)
	}
}

function action_eligible_spaces_diplo(region)
{
	for (const space of data.spaces) {
		if ((region !== REGION_ALL) && (region !== space.region)) continue
		if (space.type !== POLITICAL) continue
		if (G.flags[space.num] === R) continue // can't shift our own spaces
		if (data.spaces[space.num].era > current_era()) continue // Some diplomatic spaces are era-locked
		if (((space.num === USA_1) || (space.num === USA_2)) && !G.usa_flags) continue // USA flags only if USA exists
		if (!action_points_eligible_major(DIPLO, space_rules(space.num, DIPLO))) { // We either need eligibility for major action *at this space*, or else we need to have non-zero minor action points remaining
			if (!G.minor[DIPLO]) continue
		}
		if (!is_shift_allowed(space.num, R, true, space_rules(space.num, DIPLO))) continue
		if (has_transient(R, TRANSIENT_MUST_BE_ENTIRELY_IN_EUROPE) && (space.region !== REGION_EUROPE)) {
			if (!G.minor[DIPLO]) continue
		}
		action_space(space.num, INCLUDE_CONFLICT)
	}
}

function action_eligible_spaces_mil(region)
{
	for (const space of data.spaces) {
		if ((region !== REGION_ALL) && (region !== space.region)) continue
		if (G.flags[space.num] === R) {
			/* 5.6.4 - Repair a fort */
			if (space.type === FORT) {
				if (!is_damaged_fort(space.num)) continue
			}

			/* Move my existing ship */
			if (space.type === NAVAL) {
				if (set_has(G.dirty, space.num)) continue /* A given Squadron can only deploy once per action round */
			}
		}
		else {
			if (space.type === FORT) {
				if (G.flags[space.num] === NONE) {
					/* 5.6.3 - Build a fort */
					var allowed_to_build_fort = false
					for (const link of space.connects) {
						if (G.flags[link] !== R) continue
						if (![ TERRITORY, NAVAL, MARKET ].includes(data.spaces[link].type)) continue // Need a friendly fort, territory, or market
						if (!set_has(G.controlled, link)) continue                                   // Need it since start of action round
						if (has_conflict_marker(link)) continue // Not a conflicted market
						allowed_to_build_fort = true
						break
					}
					if (!allowed_to_build_fort) continue
				}
				else {
					/* 5.6.4 - Seize ('repair') an enemy fort  */
					if (!is_damaged_fort(space.num)) continue // Must be damaged
					if (!action_points_eligible_major(MIL, space_rules(space.num, MIL)) && !eligible_for_minor_action(space.num, R)) continue // Cannot use minor action
					var allowed_to_seize_fort = false
					for (const link of space.connects) {
						if (G.flags[link] !== R) continue
						if (![ NAVAL , MARKET ].includes(data.spaces[link].type)) continue // Need a fort, territory, or market (but don't care if since start of action round apparently)
						allowed_to_seize_fort = true
						break
					}
					if (!allowed_to_seize_fort) continue
				}
			}

			if (space.type === NAVAL) {
				if (G.flags[space.num] !== NONE) {
					if (!action_points_eligible_major(MIL, space_rules(space.num, MIL)) && !eligible_for_minor_action(space.num, R)) continue // Cannot use minor action
				}
			}

			if (has_transient(R, TRANSIENT_JACOBITES_SHIFT_SPACES)) {
				if ([IRELAND_1, IRELAND_2, SCOTLAND_1, SCOTLAND_2].includes(space.num)) {
					if ((G.flags[space.num] === NONE) || action_points_eligible_major(MIL, space_rules(space.num, MIL))) { // If we're unflagging, can't use minor action
						action_space(space.num)
					}
				}
			}
		}

		if ((space.type !== NAVAL) && (space.type !== FORT)) {
			if (!has_conflict_marker(space.num)) continue
			action_conflict(space.num)
		}
		else {
			action_space(space.num, INCLUDE_CONFLICT | INCLUDE_DAMAGED)
		}
	}
}

function action_eligible_spaces(type, region)
{
	if (!action_points_eligible_major(type, active_rules()) && (G.minor[type] <= 0)) return
	switch (type) {
		case ECON:
			action_eligible_spaces_econ(region)
			break
		case DIPLO:
			action_eligible_spaces_diplo(region)
			break
		case MIL:
			action_eligible_spaces_mil(region)
			break
	}
}

function action_all_eligible_spaces()
{
	for (var i = 0; i < NUM_ACTION_POINTS_TYPES; i++) {
		if (globalThis.RTT_FUZZER && G.fail !== undefined && (G.fail[i] > 2)) continue
		if (!action_points_eligible(i, active_rules())) continue
		action_eligible_spaces(i, REGION_ALL)
	}
}

function action_eligible_ministries()
{
	if (globalThis.RTT_FUZZER && G.fail !== undefined) {
		for (const fail of G.fail) {
			if (fail > 3) return
		}
	}

	for (var index = 0; index < G.ministry[R].length; index++) {
		if (G.ministry_revealed[R][index]) {
			let m = G.ministry[R][index]
			if (is_ministry_fully_exhausted(R, m)) continue
		}

		action_ministry_card(G.ministry[R][index])
	}
}

function action_eligible_advantages()
{
	if (globalThis.RTT_FUZZER && (G.fail !== undefined)) {
		for (const fail of G.fail) {
			if (fail > 3) return
		}
	}

	if (G.adv_used >= 2) return
	for (var a = 0; a < NUM_ADVANTAGES; a++) {
		if (!has_advantage_eligible(R, a)) continue
		if ([WHEAT, FUR_TRADE, RUM, FRUIT, TEXTILES, SILK].includes(a)) {
			if (!action_points_eligible(ECON, active_rules())) continue
		}
		if ([NAVAL_BASTION, SLAVING_CONTRACTS].includes(a)) {
			if (!action_points_eligible(MIL, active_rules())) continue
		}
		if ([GERMAN_DIPLOMACY, SILESIA_NEGOTIATIONS, ITALY_INFLUENCE].includes(a)) {
			if (!action_points_eligible(DIPLO, active_rules())) continue
		}
		action_advantage(a)
	}
}


data.advantages[BALTIC_TRADE].proc = "advantage_baltic_trade"
data.advantages[ALGONQUIN_RAIDS].proc = "advantage_place_conflict"
data.advantages[IROQUOIS_RAIDS].proc = "advantage_place_conflict"
data.advantages[PATRIOT_AGITATION].proc = "advantage_place_conflict"
data.advantages[WHEAT].proc = "advantage_unflag_discount"
data.advantages[FUR_TRADE].proc = "advantage_unflag_discount"
data.advantages[RAIDS_AND_INCURSIONS].proc = "advantage_place_conflict"
data.advantages[SEPARATIST_WARS].proc = "advantage_place_conflict"
data.advantages[POWER_STRUGGLE].proc = "advantage_place_conflict"
data.advantages[LETTERS_OF_MARQUE].proc = "advantage_place_conflict"
data.advantages[PIRATE_HAVENS].proc = "advantage_place_conflict"
data.advantages[MEDITERRANEAN_INTRIGUE].proc = "advantage_place_conflict"
data.advantages[CENTRAL_EUROPE_CONFLICT].proc = "advantage_place_conflict"
data.advantages[RUM].proc = "advantage_unflag_discount"
data.advantages[FRUIT].proc = "advantage_unflag_discount"
data.advantages[TEXTILES].proc = "advantage_unflag_discount"
data.advantages[SILK].proc = "advantage_unflag_discount"
data.advantages[GERMAN_DIPLOMACY].proc = "advantage_unflag_discount"
data.advantages[SILESIA_NEGOTIATIONS].proc = "advantage_unflag_discount"
data.advantages[ITALY_INFLUENCE].proc = "advantage_unflag_discount"
data.advantages[NAVAL_BASTION].proc = "advantage_naval_bastion"
data.advantages[SLAVING_CONTRACTS].proc = "advantage_slaving_contracts"


function space_action_type(s)
{
	if (data.spaces[s].type === POLITICAL) return DIPLO
	if (data.spaces[s].type === MARKET) return ECON
	return MIL
}


function is_entirely_in_europe(type)
{
	if (has_transient(R, TRANSIENT_BOUGHT_EVENT)) return false
	for (const r of [ REGION_NORTH_AMERICA, REGION_CARIBBEAN, REGION_INDIA ]) {
		if (set_has(G.action_point_regions[type], r)) return false // We don't check +NUM_REGIONS values for Burke, he only cares about major actions
	}
	return true
}


/* Purchases in multiple regions - 5.3.4 - does NOT apply to military */
function charge_region_switching_penalty(type, region)
{
	if (type === MIL) return false
	if (set_has(G.action_point_regions[type], region) || set_has(G.action_point_regions[type], region + NUM_REGIONS)) return false // We've already spent this type of points in this region, so don't charge again

	for (var r = 0; r < NUM_REGIONS; r++) {
		if (r === region) continue
		if (set_has(G.action_point_regions[type], r) || set_has(G.action_point_regions[type], r + NUM_REGIONS)) return true   // We've spent this type of points in a different region this round, so the region-switching penalty applies
	}

	return false // This is the first region we've spent points on this time, so no charge
}


function squadrons_in_region(who, region)
{
	var squadrons = 0
	for (let s = data.regions[region].first_space; s < data.regions[region].first_space + data.regions[region].spaces; s++) {
		if (data.spaces[s].type !== NAVAL) continue
		if (G.flags[s] !== who) continue
		squadrons++
	}
	return squadrons
}


function is_bit(b)
{
	return !!bit_get(G.bitflags, b)
}

function set_bit(b, on = true)
{
	bit_set(G.bitflags, b, on)
}

function clear_bit(b)
{
	bit_set(G.bitflags, b, false)
}


function set_bit2(state, b, on = true)
{
	bit_set(state.bitflags, b, on)
}




function has_transient(who, t)
{
	return !!bit_get(G.transient_bitflags[who], t)
}

function set_transient(who, t, on = true)
{
	bit_set(G.transient_bitflags[who], t, on)
}

function clear_transient(who, t)
{
	set_transient(who, t, false)
}


function cost_to_build_squadron(who, check_minimum = false, info = {})
{
	var cost = 4

	// Choiseul - require the ministry & a squadron in North America. Works once per turn.
	if ((who === FRANCE) && has_ministry(who, CHOISEUL, !check_minimum) && !is_ministry_exhausted(who, CHOISEUL, 1) && (squadrons_in_region(who, REGION_NORTH_AMERICA) > 0)) {
		cost = 2
		info.ministry = CHOISEUL
		info.ministry_ability = 1
	}
	if (who === BRITAIN) {
		if (has_ministry(who, EDMOND_HALLEY, !check_minimum) && !is_ministry_exhausted(who, EDMOND_HALLEY, 0)) {
			cost = 2
			info.ministry = EDMOND_HALLEY
			info.ministry_ability = 0
		}
		if (has_ministry(who, PITT_THE_ELDER, !check_minimum) && !is_ministry_exhausted(who, PITT_THE_ELDER, 1)) {
			cost = 2
			info.ministry = PITT_THE_ELDER
			info.ministry_ability = 1
		}
	}

	if (has_advantage_eligible(who, SLAVING_CONTRACTS) && check_minimum) {
		cost = 2
		info.advantage = SLAVING_CONTRACTS
	} else if (G.prepicked_advantage === SLAVING_CONTRACTS) {
		cost = 2
	}

	if (has_transient(who, TRANSIENT_SOUTH_SEA_SQUADRON_DISCOUNT)) {
		info.ability = true
		cost -= 2
	}

	return cost
}


function handle_buy_diplomatic() {
	advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
	action_cost_setup(-1, MIL)
	G.action_string = "to buy " + say_action_points(1, DIPLO)
	G.action_header = "BUY DIPLOMATIC ACTION: "
	G.prepicked_ministry = -1
	G.prepicked_advantage = -1
	G.action_cost = 2
	call ("buy_diplomatic_flow")
}


P.buy_diplomatic_flow = script(`
	call decide_how_and_whether_to_spend_action_points
	if (!is_bit(PAID_ACTION_COST)) {
		return
	}

	eval { do_buy_diplomatic(G.active) }
`)


function do_buy_diplomatic(who)
{
	G.major[DIPLO]++
	G.eligible[DIPLO] = TRUE
	G.eligible_major[DIPLO] = TRUE
	G.bought_action_points = DIPLO
	log (bold(data.flags[who].name + " has bought " + say_action_points(1, DIPLO) + " (for " + say_action_points(2, MIL) + ")."))
	display_action_cost()
	if (!has_transient(who, TRANSIENT_TILE_MADE_DIPLO)) {
		set_transient(who, TRANSIENT_TILE_MADE_DIPLO)
		if (has_active_ministry(who, EDMUND_BURKE)) {
			add_contingent(DIPLO, burke_points(who), RULE_EUROPE_BURKE, SHORT_EUROPE_BURKE, true)
			exhaust_ministry(who, EDMUND_BURKE)
		}
	}
}



function handle_buy_economic() {
	advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
	action_cost_setup(-1, MIL)
	G.action_string = "to buy " + say_action_points(1, ECON)
	G.action_header = "BUY ECONOMIC ACTION: "
	G.prepicked_ministry = -1
	G.prepicked_advantage = -1
	G.action_cost = 2
	call ("buy_economic_flow")
}


P.buy_economic_flow = script(`
	call decide_how_and_whether_to_spend_action_points
	if (!is_bit(PAID_ACTION_COST)) {
		return
	}

	eval { do_buy_economic(G.active) }
`)


function do_buy_economic(who)
{
	G.major[ECON]++
	G.eligible[ECON] = TRUE
	G.eligible_major[ECON] = TRUE
	G.bought_action_points = ECON
	log (bold(data.flags[who].name + " has bought " + say_action_points(1, ECON) + " (for " + say_action_points(2, MIL) + ")."))
	display_action_cost()
	if (!has_transient(who, TRANSIENT_TILE_MADE_ECON)) {
		set_transient(who, TRANSIENT_TILE_MADE_ECON)
		if (has_active_ministry(who, NORTH_AMERICAN_TRADE) && has_transient(who, TRANSIENT_NORTH_AMERICAN_TRADE)) {
			log_box_ministry(who, NORTH_AMERICAN_TRADE)
			add_action_points(ECON, 1)
			log_box_end(LOG_BOX_MINISTRY)
		}
	}
}



function handle_buy_event() {
	advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
	action_cost_setup(-1, DIPLO)
	G.action_string = "to buy an Event card"
	G.action_header = "BUY EVENT CARD: "
	G.prepicked_ministry = -1
	G.prepicked_advantage = -1
	G.action_cost = 3

	if (globalThis.RTT_FUZZER) {
		action_cost_setup(-1, DIPLO)
		var avail = action_points_available(R, -1, DIPLO, true)
		if (avail < G.action_cost) {
			end()
			return
		}
	}

	call ("buy_event_flow")
}


P.buy_event_flow = script(`
	call decide_how_and_whether_to_spend_action_points
	if (!is_bit(PAID_ACTION_COST)) {
		return
	}

	goto buy_event_decisions
`)


P.buy_event_decisions = {
	inactive: "buy an Event card",
	prompt() {
		V.prompt = say_action_header() + say_action("Confirm buying an event card for " + say_action_points(3, DIPLO) + "? (CANNOT BE UNDONE!)" + say_action_points_left())
		button("confirm")
	},
	confirm() {
		clear_undo()
		do_buy_event(R)
		end()
	}
}



function do_buy_event(who) {
	set_transient(who, TRANSIENT_BOUGHT_EVENT)
	if (G.deck.length === 0) {
		log ("Discard Pile shuffled to form new Event Deck.")
		G.deck = G.discard_pile.slice()
		G.discard_pile = []
		shuffle(G.deck)
		validate_decks("BUY EVENT")
	}

	if (G.deck.length > 0) {
		G.hand[who].push(G.deck.pop())
		L.drawn_extra = true
		log (data.flags[who].name + " has bought an extra event card.")
	} else {
		log ("Event deck MPTY. Could not draw an event card.")
	}
}


function handle_construct_squadron_button() {
	advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
	action_cost_setup(-1, MIL)
	G.action_string = "to construct a squadron"
	G.action_header = "CONSTRUCT SQUADRON: "
	G.prepicked_ministry = -1
	G.prepicked_advantage = -1
	call ("construct_squadron_flow")
}


P.no_military_action_squadron = {
	inactive: "take an action",
	prompt() {
		V.prompt = say_action_header() + say_action("You need a military action available to construct a squadron.")
	}
}

P.noff_noff_money_squadron = {
	inactive: "take an action",
	prompt() {
		V.prompt = say_action_header() + say_action("You don't have enough debt, treaty points, and action points to construct a squadron.")
	}
}

P.noff_noff_squadrons = {
	inactive: "take an action",
	prompt() {
		V.prompt = say_action_header() + say_action("You already have the maximum 8 squadrons in play.")
	}
}


P.construct_squadron_flow = script(`
	eval {
		G.action_cost = cost_to_build_squadron(G.active, false)
		L.info = {}
		L.min_cost = cost_to_build_squadron(G.active, true, L.info)
		L.flipped_something = false
	}
	if (!G.eligible[MIL]) {
		call no_military_action_squadron
		return
	}
	if (G.action_points_available_debt < L.min_cost) {
		call noff_noff_money_squadron
		return // If we can't even afford it w/ debt and trps, we shouldn't be here
	}
	if (G.unbuilt_squadrons[G.active] <= 0) {
		call noff_noff_squadrons
		return // If we don't have any available squadrons
	}

	// Possible option to flip relevant ministry
	if ((L.info.ministry !== undefined) && (G.prepicked_advantage === -1)) {
		eval {
			if (G.prepicked_ministry === L.info.ministry) {
				G.has_required_ministry = TRUE
			} else {
				require_ministry_unexhausted(R, L.info.ministry, "To reduce cost of squadron by 2", L.info.ministry_ability, G.action_points_available_debt >= G.action_cost, true)				
			}
		}
		if (G.has_required_ministry) {
			eval {
				G.action_cost = (L.info.ability !== undefined) ? 0 : 2
				L.flipped_something  = true
				log_box_ministry(R, L.info.ministry)
				exhaust_ministry(R, L.info.ministry, L.info.ministry_ability)
				log(say_ministry(L.info.ministry, R) + " reduces squadron construction cost by 2.")
				log_box_end(LOG_BOX_MINISTRY)
			}
		} else {
			eval {
				G.action_cost = (L.info.ability !== undefined) ? 2 : 4
				L.min_cost    = (L.info.ability !== undefined) ? 2 : 4
			}
		}
		if (!G.has_required_ministry && (G.action_points_available_debt < L.min_cost)) {
			return // If it's now impossible to afford cost because we didn't flip the ministry
		}
	}

	// Possible option to use advantage
	if ((L.info.advantage !== undefined) && !L.flipped_something && (G.prepicked_advantage === -1)) {
		eval {
			require_advantage(R, L.info.advantage, "To reduce cost of squadron by 2", G.action_points_available_debt >= G.action_cost)
		}
		if (is_bit(USED_REQUIRED_ADVANTAGE)) {
			eval {
				G.action_cost = (L.info.ability !== undefined) ? 0 : 2
				L.flipped_something = true
			}
		}
		if (!is_bit(USED_REQUIRED_ADVANTAGE) && (G.action_points_available_debt < L.min_cost)) {
			return // If it's now impossible to afford cost because we didn't use the advantage
		}
	} else {
		if (G.prepicked_advantage >= 0) {
			eval { G.action_cost = (L.info.ability !== undefined) ? 0 : 2 }
		}
	}

	call decide_how_and_whether_to_spend_action_points
	if (!is_bit(PAID_ACTION_COST)) {
		return
	}

	eval { do_construct_squadron(G.active) }
`)

function do_construct_squadron(who) {
	if (G.unbuilt_squadrons[who] <= 0) return // Can't construct a squadron if there aren't any left to build

	move_squadron_token(who, SPACE_UNBUILT, SPACE_NAVY_BOX)
	G.unbuilt_squadrons[who]--
	G.navy_box[who]++
	validate_squadrons("DO CONSTRUCT")
	clear_transient(R, TRANSIENT_SOUTH_SEA_SQUADRON_DISCOUNT)

	log_br()
	log(bold(data.flags[who].name + " constructed a squadron."))
	log(say_navy_box())
	display_action_cost()
	log_br()
}


/* 3.2.8 and 5.6.2 - protected spaces: adjacent to friendly squadron or undamaged fort */
function is_protected(s)
{
	var whose = G.flags[s]
	if (whose === NONE) return false
	if (data.spaces[s].connects === undefined) return false
	for (const adjacent of data.spaces[s].connects) {
		if (G.flags[adjacent] === whose) {
			if (data.spaces[adjacent].type === NAVAL) return true
			if (data.spaces[adjacent].type === FORT) {
				if (!is_damaged_fort(adjacent)) return true
			}
		}
	}
	return false
}


const MODIFY_ADVANTAGE = 0
const MODIFY_MINISTRY  = 1
const MODIFY_HUGUENOTS = 2
const MODIFY_SET_TO_1  = 0

// Modifier amounts. 0 = "set to 1", otherwise the -1/+1 value of advantage
// Modifier types. 0 = Advantage, 1 = Ministry, 2 = Huguenots
function action_point_cost_modify(amount, type)
{
	G.modifiers.push(amount)
	G.mod_types.push(type)
	G.action_cost = action_point_cost(G.active, G.active_space, G.action_type)
}


function is_spain(s)
{
	return (s >= SPAIN_1) && (s <= SPAIN_4)
}

function is_austria(s)
{
	return (s >= AUSTRIA_1) && (s <= AUSTRIA_4)
}

function is_europe(s)
{
	return data.spaces[s].region === REGION_EUROPE
}



function action_point_cost (who, s, type, ignore_region_switching = false)
{
	var cost = data.spaces[s].cost

	// These two "side effect" fields allow us to explain complex cost adjustments to the player so we don't get unending "bug" reports
	G.breakdown  = cost + " for space."
	G.adjustable = cost
	clear_bit(ACTION_COST_ADJUSTED)

	// General Rule: Apply all reductions before any increases (5.4.2, 5.5.2)

	if (type === MIL) {
		if ((data.spaces[s].type === FORT) && is_damaged_fort(s)) {
			if (G.flags[s] === G.active) { //BR// hmmm... should I be passing "who" as a parameter, or do I only ever need for active player? For now I *think* the latter.
				cost -= 1 // Repairing friendly fort costs one less than strength
				G.breakdown += " -1 friendly fort."
				set_bit(ACTION_COST_ADJUSTED)
			} else if (G.flags[s] === 1 - G.active) {
				cost += 1 // Seizing enemy fort costs one more than strength
				G.breakdown += " +1 enemy fort."
				set_bit(ACTION_COST_ADJUSTED)
			}
		}

		if (has_conflict_marker(s)) {
			cost = get_conflict_marker(s) + 1 // Either 2 for basic conflict or 3 for Haitians
			G.breakdown = "Remove Conflict: 2."
			if (cost > 2) {
				G.breakdown += " +1 Haitian Revolution."
				set_bit(ACTION_COST_ADJUSTED)
			}
			if (is_protected(s)) {
				cost--
				G.breakdown += " -1 protected."
				set_bit(ACTION_COST_ADJUSTED)
			}
		}
	} else {
		// Both political costs & market flagging costs are reduced to 1 by a conflict marker (5.4.2, 5.5.2)
		if (has_conflict_marker(s)) {
			cost = 1
			G.breakdown  = "Conflict = 1."
			G.adjustable = 1
			set_bit(ACTION_COST_ADJUSTED)
		}

		if (type === ECON) {
			// Isolated markets cost 1 to shift
			if (is_isolated_market(s)) {
				cost = 1
				G.breakdown  = "Isolated = 1."
				G.adjustable = 1
				set_bit(ACTION_COST_ADJUSTED)
			}
		}

		// First any modifiers that set it to 1
		for (let i = 0; i < G.modifiers.length; i++) {
			let modifier = G.modifiers[i]
			let reason   = G.mod_types[i]

			if (modifier === MODIFY_SET_TO_1) {
				cost = 1
				set_bit(ACTION_COST_ADJUSTED)
				G.adjustable = 1
				G.breakdown  = "Set to 1 by " + ((reason === MODIFY_ADVANTAGE) ? "Advantage" : "Ministry") + "."
			}
		}

		// And then any modifiers which reduce it (these could negate a potential +1 from another modifier)
		for (let i = 0; i < G.modifiers.length; i++) {
			let modifier = G.modifiers[i]
			let reason   = G.mod_types[i]

			if (modifier !== MODIFY_SET_TO_1) {
				cost += modifier
				set_bit(ACTION_COST_ADJUSTED)
				G.adjustable += modifier
				G.breakdown  += " " + modifier + " " + ((reason === MODIFY_ADVANTAGE) ? "Advantage" : "Ministry") + "."
			}
		}

		if (type === DIPLO) {
			if (has_active_ministry(who, JONATHAN_SWIFT)) {
				if ([IRELAND_1, IRELAND_2, SCOTLAND_1, SCOTLAND_2].includes(s)) { // Ireland & Scotland
					if (G.flags[s] === NONE) {                                    // Jonathan Swift discount only works for *flagging* spaces, not unflagging
						cost -= 1
						set_bit(ACTION_COST_ADJUSTED)
						G.breakdown += " -1 Jonathan Swift."
						G.adjustable--
					}
				}
			}

			if (has_active_ministry(who, EDMUND_BURKE)) {
				if ([ SONS_OF_LIBERTY, USA_1, USA_2 ].includes(s)) {
					cost -= 1
					set_bit(ACTION_COST_ADJUSTED)
					G.breakdown += " -1 Edmund Burke."
					G.adjustable--
				}
			}

			if (has_transient(who, TRANSIENT_CHARLES_HANBURY_WILLIAMS)) {
				if (G.flags[s] === FRANCE) {
					if ([ PRUSSIA_1, PRUSSIA_2, PRUSSIA_3, PRUSSIA_4, GERMAN_STATES_1, GERMAN_STATES_2, RUSSIA ].includes(s))
					{
						cost--
						set_bit(ACTION_COST_ADJUSTED)
						G.breakdown += " -1 Charles Hanbury Williams."
						G.adjustable--
					}
				}
			}

			if (has_transient(who, TRANSIENT_PACTE_DE_FAMILLE)) {
				if (G.flags[s] === FRANCE) {
					if (is_spain(s) || is_austria(s)) {
						cost--
						set_bit(ACTION_COST_ADJUSTED)
						G.breakdown += " -1 Pacte de Famille."
						G.adjustable--
					}
				}
			}
		}

		if (type === ECON) {
			// Protected markets cost +1 to shift
			if (is_protected(s)) {
				cost++
				set_bit(ACTION_COST_ADJUSTED)
				G.breakdown += " +1 Protected."
			}
		}

		// Region-switching penalty
		if (!ignore_region_switching && charge_region_switching_penalty(type, data.spaces[s].region)) {
			cost++
			set_bit(ACTION_COST_ADJUSTED)
			G.breakdown += " +1 Extra Region."
		}

		if (cost < 1) {
			cost = 1 // Can't be reduced below 1 (5.4.2)
			set_bit(ACTION_COST_ADJUSTED)
			G.breakdown += " Minimum: 1."
		}
	}

	return cost
}

// When flags/navies have changed, re-compute all the flag counts. Spaces with conflict markers don't count toward flags counts (3.8)
function update_flag_counts()
{
	G.prestige_flags    = [ 0, 0 ]                                       // G.flag_count[who]
	G.flag_count        = [ [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ]             // G.flag_count[who][region]
	G.demand_flag_count = [ [ 0, 0, 0, 0, 0, 0 ], [ 0, 0, 0, 0, 0, 0 ] ] // G.demand_flag_count[who][demand]

	for (let s = 0; s < NUM_SPACES; s++) {
		let who = G.flags[s]
		if ((who !== FRANCE) && (who !== BRITAIN)) continue
		if (has_conflict_marker(s)) continue
		G.flag_count[who][data.spaces[s].region]++
		if (data.spaces[s].prestige > 0) G.prestige_flags[who]++
		if (data.spaces[s].type === MARKET) {
			G.demand_flag_count[who][data.spaces[s].market]++
		}
	}
}


function handle_military_upgrade(t)
{
	G.upgrading_basic_tile = t
	call ("military_upgrade_decisions")
}


function get_theater_from_basic_war_tile(who, tile) {
	for (let theater = 0; theater <= data.wars[G.next_war].theaters; theater++) { //NB 0 through theaters is intentional
		if (G.theater_basic[who][theater].includes(tile)) return theater
	}
	let msg = "Could not find theater for basic war tile. Who: " + who + "  Tile: " + tile
	console.error (msg)
	if (globalThis.RTT_FUZZER) throw new Error(msg)

	return 1
}


function get_theater_from_bonus_war_tile(who, tile) {
	for (let theater = 0; theater <= data.wars[G.next_war].theaters; theater++) { //NB 0 through theaters is intentional
		if (G.theater_bonus[who][theater].includes(tile)) return theater
	}
	let msg = "Could not find theater for bonus war tile. Who: " + who + "  Tile: " + tile
	console.error (msg)
	if (globalThis.RTT_FUZZER) throw new Error(msg)
	return 1
}



P.military_upgrade_decisions = {
	_begin() {
		L.confirmed = false
		L.picked_one_to_keep = false
		L.theater = get_theater_from_basic_war_tile(G.active, G.upgrading_basic_tile)
	},
	inactive: "use a Military Upgrade",
	prompt() {
		let msg = say_action_header("MILITARY UPGRADE: ")

		if (!L.confirmed) {
			//TODO - optional rule would allow choice of swap or draw
			if (G.basic_war[G.active].length < 1) {
				msg += say_action("You do not have any war tiles left to draw an upgrade from.")
				button ("done")
			} else {
				msg += say_action("Confirm upgrade draw for " + say_basic_war_tile(G.upgrading_basic_tile, false) + " tile in theater " + L.theater + ": " + data.wars[G.next_war].theater_names[L.theater] + "? (CANNOT BE UNDONE!)")
				button("confirm")
			}
		} else if (!L.picked_one_to_keep) {
			msg += say_action("Choose which tile to remove")
			action_basic_war_tile(L.new_tile)
			action_basic_war_tile(G.upgrading_basic_tile)
		} else {
			msg += say_action("Return " + say_basic_war_tile(L.get_rid_of_tile, false) + " tile to the pool or remove it from the game?")
			button("return_to_pool")
			button("remove_from_game")
		}

		V.prompt = msg
	},
	confirm() {
		clear_undo() // Drew a tile - so there's no going back!
		L.confirmed = true
		L.new_tile = draw_basic_war_tile(G.active, L.theater)
		clear_bit(FLAG_MILITARY_UPGRADE) // No longer eligible for a military upgrade
		log(bold(data.flags[G.active].name + " took a military upgrade in theater " + L.theater + ": " + data.wars[G.next_war].theater_names[L.theater] + "."))
	},
	basic_war(t) {
		push_undo()
		L.get_rid_of_tile = t
		array_delete_item(G.theater_basic[G.active][L.theater], L.get_rid_of_tile)
		L.picked_one_to_keep = true
	},
	return_to_pool() {
		push_undo()
		delete G.upgrading_basic_tile
		G.basic_war[G.active].push(L.get_rid_of_tile) // Put the other tile back in the stock
		log(data.flags[G.active].name + " returned a basic war tile to the pool.")
		log_br()
		end()
	},
	remove_from_game() {
		push_undo()
		delete G.upgrading_basic_tile
		log(data.flags[G.active].name + " removed a basic war tile from the game: " + say_basic_war_tile(L.get_rid_of_tile) + ".")
		log_br()
		end()
	},
	done() {
		push_undo()
		clear_bit(FLAG_MILITARY_UPGRADE) // In the rare case where the player doesn't have enough tiles to even take an upgrade, just check it off his to-do list
		end()
	},

}

// Returns an array of theater numbers where the player currently has fewer than the maximum 2 bonus war tiles
function free_theaters(who) {
	let theaters = []
	for (let theater = 1; (theater <= data.wars[G.next_war].theaters); theater++) { //NB: this one is intentionally *1* through <= theaters
		if (G.theater_bonus[who][theater].length >= 2) continue
		theaters.push(theater)
	}
	return theaters
}


// Returns the total number of bonus war tiles a player already has on the next war mat
function num_bonus_tiles_in_play(who) {
	let num = 0
	for (let theater = 1; (theater <= data.wars[G.next_war].theaters); theater++) { //NB: this one is intentionally *1* through <= theaters
		num += G.theater_bonus[who][theater].length
	}
	return num
}


function handle_buy_bonus_war_tile()
{
	action_cost_setup(-1, MIL)
	G.action_header = "BUY BONUS WAR TILE: "
	G.action_cost   = 2

	if (globalThis.RTT_FUZZER) {
		action_cost_setup(-1, MIL)
		var avail = action_points_available(R, -1, MIL, true)
		if (avail < G.action_cost) {
			end()
			return
		}
	}

	if (free_theaters(G.active).length < 1) {
		call ("no_room_at_the_inn")
	} else if (G.bonuswar_bought >= 2) {
		call ("no_time_for_love_dr_jones")
	} else {
		call ("buy_bonus_war_tile_flow")
	}
}

P.no_room_at_the_inn = { // Player required to click "undo"
	prompt() {
		V.prompt = say_action_header() + say_action("All theaters have 2 bonus war tiles. No room to buy any more.")
		if (globalThis.RTT_FUZZER) button("pass")
	},
	pass() {
		end()
	}
}

P.no_time_for_love_dr_jones = { // Player required to click "undo"
	prompt() {
		V.prompt = say_action_header() + say_action("You have already purchased the maximum allowed number of bonus war tiles this action round (2).")
		if (globalThis.RTT_FUZZER) button("pass")
	},
	pass() {
		end()
	}
}


function use_choiseul()
{
	G.committed[MIL]++
	G.action_points_available_now++
	log_box_ministry(FRANCE, CHOISEUL)
	log ("France received 1 extra " + say_action_points(1, MIL) + " (usable for deploying squadrons or buying bonus war tiles.")
	log_box_end(LOG_BOX_MINISTRY)
}


P.buy_bonus_war_tile_flow = script(`
	eval {
		clear_bit(MUST_PLACE_IN_NORTH_AMERICA)

		G.has_required_ministry = false
		if (action_points_eligible_major(MIL, active_rules()) > 0) {
			require_ministry_unexhausted(R, CHOISEUL, "For an extra " + say_action_points(1, MIL), 0, true, true)
		}
	}
	if (G.has_required_ministry) {
		eval { use_choiseul() }
	}

	call decide_how_and_whether_to_spend_action_points
	if (!is_bit(PAID_ACTION_COST)) {
		eval { G.action_header = "" }
		return
	}

	goto bonus_war_tile_decisions
`)


P.bonus_war_tile_decisions = {
	_begin() {
		L.confirmed      = has_transient(R, TRANSIENT_COOK)
		if (L.confirmed) {
			L.new_tile = draw_bonus_war_tile(G.active, 0)
			log (data.flags[G.active].name + " drew a bonus war tile.")
			display_action_cost()
		}
		L.theater        = 0
		L.displaced_tile = -1
		set_transient(R, TRANSIENT_COOK, false)
	},
	inactive() {
		if (!L.confirmed) {
			return "buy a bonus war tile"
		} else if (L.theater <= 0) {
			return "select a theater for a new bonus war tile"
		} else if (L.displaced_tile < 0) {
			return "select a bonus war tile to displace from an overfull theater"
		} else {
			return "select a new theater for a displaced bonus war tile"
		}
	},
	prompt() {
		let msg = say_action_header()

		if (!L.confirmed) {
			if (G.bonus_war[G.active].length < 1) {
				msg += say_action("You do not have any bonus war tiles left to draw from.")
				button ("done")
			} else {
				msg += say_action("Confirm drawing tile for " + say_action_points(2, MIL) + "? (CANNOT BE UNDONE!)" + say_action_points_left())
				button("confirm")
			}
		} else if (L.theater <= 0) {
			msg = say_action_header()
			msg += "Select theater for " + say_bonus_war_tile(L.new_tile, false) + " tile."
			action_all_eligible_theaters()
		} else if (L.displaced_tile < 0) {
			msg += "Theater had two bonus tiles already. Select a bonus tile to displace."
			for (const t of G.theater_bonus[G.active][L.theater]) {
				if (t === L.new_tile) continue
				action_bonus_war_tile(t)
			}
		} else {
			msg += "Select new theater for " + say_bonus_war_tile(L.displaced_tile, false) + " tile."
			for (const t of free_theaters(G.active)) {
				action_theater(t)
			}
		}

		V.prompt = msg
	},
	confirm() {
		clear_undo() // Drew a tile - so there's no going back!
		L.confirmed = true
		L.new_tile = draw_bonus_war_tile(G.active, 0)
		log (data.flags[G.active].name + " has bought a bonus war tile.")
		display_action_cost()
	},
	theater(t) {
		t = display_to_theater(t)
		push_undo()
		if (L.theater <= 0) {
			L.theater = t
			G.theater_bonus[G.active][L.theater].push(L.new_tile)
			array_delete_item(G.theater_bonus[G.active][0], L.new_tile) // Remove from the "just drawn tiles" list
			G.bonuswar_bought++
			log(bold(data.flags[G.active].name + " placed new bonus war tile into theater " + L.theater + ": " + data.wars[G.next_war].theater_names[L.theater] + "."))
			log_br()
			if (G.theater_bonus[G.active][L.theater].length <= 2) {
				end() // If we don't need to displace another tile, we're done
			}
		} else {
			G.theater_bonus[G.active][t].push(L.displaced_tile)
			log(bold(data.flags[G.active].name + " moved a bonus war tile into theater " + t + ": " + data.wars[G.next_war].theater_names[t] + "."))
			log_br()
			end()
		}
	},
	bonus_war(t) {
		push_undo()
		L.displaced_tile = t
		array_delete_item(G.theater_bonus[G.active][L.theater], t)
	},
}


function handle_navy_box()
{
	set_bit(NAVY_FROM_NAVY_BOX)
	clear_bit(NAVY_DISPLACE)
	G.navy_to = -1
	G.navy_from = -1
	call ("naval_decisions")
}


function handle_naval_space(s)
{
	clear_bit(NAVY_FROM_NAVY_BOX)
	clear_bit(NAVY_DISPLACE)
	mark_dirty(s)

	if (G.flags[s] === G.active) {
		G.navy_from = s
		G.navy_to = -1
	}
	else {
		G.navy_from = -1
		G.navy_to = s

		if (G.flags[s] !== NONE) {
			set_bit(NAVY_DISPLACE)
		}

		// If there simply aren't any other available squadrons on the map, autopick the Navy Box
		if (num_available_squadrons(G.active) < 1) {
			if (G.navy_box[G.active] > 0) {
				set_bit(NAVY_FROM_NAVY_BOX)
				call ("naval_flow")
				return
			}
		}
	}

	call ("naval_decisions")
}


function num_available_squadrons(who) {
	let avail = 0
	for (let s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== NAVAL) continue
		if (G.flags[s] !== who) continue
		if (set_has(G.dirty, s)) continue
		avail++
	}
	return avail
}


function num_map_squadrons(who) {
	let ships = 0
	for (let s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== NAVAL) continue
		if (G.flags[s] !== who) continue
		ships++
	}
	return ships
}

function action_naval_sources()
{
	if (G.navy_box[G.active] > 0) action_navy_box()

	let avail = 0
	// Naval spaces containing our own naval units, except ones we've already moved this round
	for (let s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== NAVAL) continue
		if (G.flags[s] !== G.active) continue
		if (set_has(G.dirty, s)) continue
		action_space(s)
		avail++
	}

	return avail
}

function action_naval_destinations()
{
	let avail = 0

	// Naval spaces that are either empty or contain an enemy squadron (which we could therefore displace)
	for (let s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].type !== NAVAL) continue
		if (G.flags[s] === G.active) continue

		if (G.flags[s] !== NONE) {
			if (!action_points_eligible_major(MIL, space_rules(s, MIL)) && !eligible_for_minor_action(s, R)) continue
		}

		action_space(s)
		avail++
	}

	return avail
}


P.naval_decisions = {
	_begin() {
		action_cost_setup(G.navy_to, MIL)
	},
	inactive() {
		if (is_bit(NAVY_DISPLACE)) {
			return "displace a squadron"
		} else if (is_bit(NAVY_FROM_NAVY_BOX)) {
			return "deploy a squadron"
		} else if (G.navy_from >= 0) {
			return "move a squadron"
		} else {
			return "deploy a squadron"
		}
	},
	prompt() {
		let header = ""
		let msg = ""
		if (is_bit(NAVY_DISPLACE)) {
			header = "DISPLACE SQUADRON: "
		} else {
			if (is_bit(NAVY_FROM_NAVY_BOX)) {
				header = "DEPLOY SQUADRON: "
			} else if (G.navy_from >= 0) {
				header = "MOVE SQUADRON: "
			} else {
				header = "DEPLOY SQUADRON: "
			}
		}

		if (G.navy_to >= 0) {
			msg = "Select squadron to move to " + data.spaces[G.navy_to].name + " (from map or Navy Box)."
			action_naval_sources()

			if ((G.navy_box[G.active] < 1) && num_available_squadrons(G.active) < 1) {
				msg = "You have no available squadrons to move there."
				if (num_map_squadrons(G.active) > 0) {
					msg = "All squadrons in play have already moved this round. You have none left to move."
				}
			}
		} else if (is_bit(NAVY_FROM_NAVY_BOX) || (G.navy_from >= 0)) {
			msg = "Select target naval space."
			let avail = action_naval_destinations()
			if (avail < 1) {
				msg = "There are no naval spaces available for you to deploy to." // I'm not sure this can actually happen
			}
		} else {
			msg = "Select a naval space and/or squadron."
			action_naval_sources()
			action_naval_destinations()
		}

		V.prompt = say_action_header(header) + say_action(msg) + say_action_points_left()
	},
	space(s) {
		push_undo()
		mark_dirty(s)
		if (G.navy_to >= 0) {
			G.navy_from = s
		} else {
			G.navy_to = s
			action_cost_setup(G.navy_to, MIL)

			if (G.flags[s] !== NONE) {
				set_bit(NAVY_DISPLACE)
			}
		}
		if ((G.navy_to >= 0) && ((G.navy_from >= 0) || is_bit(NAVY_FROM_NAVY_BOX))) {
			goto ("naval_flow")
		}
	},
	navy_box() {
		push_undo()
		set_bit(NAVY_FROM_NAVY_BOX)
		if (G.navy_to >= 0) goto ("naval_flow")
	}
}

function get_naval_cost()
{
	if (G.flags[G.navy_to] === NONE) return 1
	return is_bit(NAVY_FROM_NAVY_BOX) ? 3 : 2
}


P.naval_flow = script(`
	eval {
		G.action_cost = get_naval_cost()
		G.has_required_ministry = false

		L.choiseul = get_contingent(MIL, RULE_WAR_TILE_OR_DEPLOY, false)
		if (L.choiseul > 0) {
			G.committed[MIL] += L.choiseul
			// G.action_points_available_now += L.choiseul // NB - No! They already got added in as part of contingent
			use_contingent(L.choiseul, MIL, RULE_WAR_TILE_OR_DEPLOY)
		}

		if (action_points_eligible_major(MIL, active_rules()) > 0) {
			require_ministry_unexhausted(R, CHOISEUL, "For an extra " + say_action_points(1, MIL), 0, true, true)
		}
	}
	if (G.has_required_ministry) {
		eval { use_choiseul() }
	}

	call decide_how_and_whether_to_spend_action_points
	if (!is_bit(PAID_ACTION_COST)) {
		eval { G.action_header = "" }
		return
	}

	eval { execute_naval_move() }
`)

function execute_naval_move()
{
	// If we're displacing an enemy fleet, send it back to the Navy Box
	if (is_bit(NAVY_DISPLACE) && (G.navy_to >= 0)) {
		let whom = 1 - G.active
		G.navy_box[whom]++
	}

	// If we're moving from the Navy Box, subtract it
	if (is_bit(NAVY_FROM_NAVY_BOX)) {
		if (G.navy_box[G.active] < 1) {
			throw new Error("Allowed move from Navy Box when no " + data.flags[G.active].adj + " squadrons were there!")
		} else {
			G.navy_box[G.active]--
		}
	}

	// If we're moving from a space on the board, remove the navy from it
	if (G.navy_from >= 0) {
		reflag_space (G.navy_from, NONE, true)
	}

	// Check if we somehow didn't move a navy from *anywhere*
	if (!is_bit(NAVY_FROM_NAVY_BOX) && (G.navy_from < 0)) {
		throw new Error("Naval move with no source! G.navy_to: " + G.navy_to)
	}

	// Put a navy in the space we're moving to
	if (G.navy_to >= 0) {
		reflag_space (G.navy_to, G.active, true)
	} else {
		throw new Error("Naval move with no destination! G.navy_from: " + G.navy_from)
	}

	let msg
	if (is_bit(NAVY_FROM_NAVY_BOX)) {
		msg = "Navy box to " + say_space(G.navy_to, G.active)
		move_squadron_token(G.active, SPACE_NAVY_BOX, G.navy_to)
	} else {
		msg = "Squadron " + say_space(G.navy_from) + " to " + say_space(G.navy_to, G.active)
		move_squadron_token(G.active, G.navy_from, G.navy_to)
	}
	log (msg)
	if (is_bit(NAVY_DISPLACE)) {
		log (bold(data.flags[1-G.active].adj + " squadron displaced."))
		move_squadron_token(1 - G.active, G.navy_to, SPACE_NAVY_BOX)
	}

	validate_squadrons("EXECUTE MOVE (" + G.navy_from + " " + G.navy_to + " " + is_bit(NAVY_DISPLACE) + " " + is_bit(NAVY_FROM_NAVY_BOX) + ")")

	if (is_bit(NAVY_FROM_NAVY_BOX) || is_bit(NAVY_DISPLACE)) {
		log (say_navy_box())
	}

	display_action_cost()

	log_br() // Leave a blank line
}


function reflag_space(s, who, silent = false) {
	var former = G.flags[s]
	if (former !== who) {
		G.flags[s] = who
		if (who === USA) G.usa_flags++
		if ((former === USA) && G.usa_flags > 0) G.usa_flags-- // Don't think this ever happens, but...
		set_delete(G.controlled, s) // 5.4.1 - change in control means we can't chain from here later in the round even if we get it back during the round
		if (!silent) {
			let msg = say_space(s) + " "
			if (who === NONE) {
				msg += "unflagged"
			} else {
				msg += "flagged " + data.flags[G.flags[s]].adj
			}
			msg += "."
			log(bold(msg))

			display_action_cost()
		}
	}

	mark_dirty(s) // We've now changed this space. Highlight it until next investment tile.
	mark_navy_this_war(s)

	if ((who === BRITAIN) && has_huguenots(s)) {
		remove_huguenots(s)
	}

	set_isolated_market(s, false) // A reflagged space is never isolated that same turn

	remove_conflict_marker(s) // Reflagging a space removes any conflict marker

	update_advantages() // This could change the ownership of an advantage
	//update_flag_counts()  //BR// NB:Updating flag counts is implicit in removing conflict marker above

	if (who === BRITAIN) {
		if (has_active_ministry(who, EDMUND_BURKE) && [IRELAND_1, IRELAND_2].includes(s)) {
			if (is_entirely_in_europe(DIPLO) && action_points_eligible_major(DIPLO, active_rules())) {
				let proc = 0
				if (has_transient(who, TRANSIENT_TILE_MADE_DIPLO)) proc++
				if (has_transient(who, TRANSIENT_EVENT_MADE_DIPLO)) proc++
				add_contingent(DIPLO, proc, RULE_EUROPE_BURKE, SHORT_EUROPE_BURKE, true)
				exhaust_ministry(who, EDMUND_BURKE, 0, true) // but we don't *check* exhaustion before allowing here, because he's allowed to gain strength on the fly
			}
		}
	}
}


function eligible_to_play_event()
{
	return ((data.investments[G.played_tile].majorval <= 3) || (has_ministry(R, MARQUIS_DE_CONDORCET) && !is_ministry_exhausted(R, MARQUIS_DE_CONDORCET)))
}

function advance_action_round_subphase(subphase)
{
	if (G.subphase >= subphase) return
	let prior_phase = G.subphase
	G.subphase = subphase

	if ((subphase >= BEFORE_SPENDING_ACTION_POINTS) && (prior_phase <= OPTION_TO_PLAY_EVENT) && eligible_to_play_event()) {
		log_box_begin(G.active, "NO EVENT PLAYED", LOG_BOX_EVENT)
		log_box_end(LOG_BOX_EVENT)

		for (var card of G.hand[G.active]) {
			// If any of our event cards were *actually* eligible to be played, then we can throw the Skipped Event semaphore
			if ((data.cards[card].action === WILD) || (data.cards[card].action === data.investments[G.played_tile].majortype) ||
				(has_ministry(G.active, BANK_OF_ENGLAND) && (data.cards[card].action === ECON) && !is_ministry_exhausted(G.active, BANK_OF_ENGLAND, 1))) {
				set_bit(SKIPPED_EVENT)
			}
		}
	} else {
		clear_bit(SKIPPED_EVENT)
	}
}

// Set up our tracking of an impending "How would you like to pay for this, Sir?" situation
function action_cost_setup(s, t, force_type = -1) {

	// The space we're checking, if any (could be -1)
	G.active_space = s

	// Flavor of action we're trying to perform (i.e. ECON, DIPLO, MIL)
	G.action_type = t

	// Have we committed to a minor action
	clear_bit(ACTION_MINOR)
	clear_bit(ACTION_ENTIRELY_MINOR)

	// Is this action eligible to be a minor one (e.g. not removing enemy flag, and we have minor action points available)
	set_bit(ELIGIBLE_MINOR, eligible_for_minor_action(s, G.active) && (G.minor[G.action_type] > 0))

	let committed = 0
	if ((t === MIL) && is_bit(BUYING_WAR_TILE)) {
		committed = get_contingent(MIL, RULE_WAR_TILE_OR_DEPLOY)
	}

	// How many action points (of the active flavor) are immediately available (without taking debt, spending TRP, or otherwise invoking an ability to gain more)
	G.action_points_available_now  = action_points_available(G.active, G.active_space, G.action_type, false, space_rules(G.active_space, G.action_type, force_type)) + committed

	// How many action points (of the active flavor) would we have total, if we took all possible debt and spent all our TRP. Our notional absolute maximum w/o needing an ability/advantage.
	G.action_points_available_debt = action_points_available(G.active, G.active_space, G.action_type, true, space_rules(G.active_space, G.action_type, force_type)) + committed

	// Clause to remind player why he might be wanting to cough up enough debt or whatever (e.g. "... to unflag Denmark")
	G.action_string = ""

	// Header to remind player of main action he might want to be paying for
	G.action_header = ""

	// Have we wpent any debt on the current action
	G.debt_spent = 0

	// Have we spent any TRP on the current action
	G.treaty_points_spent = 0

	// Do we need to flip a ministry in order to get a discount or be able to do the action (if so, this is the card id of the ministry)
	G.needs_to_flip_ministry = -1

	// Eligible to use Huguenots discount?
	clear_bit(ELIGIBLE_FOR_HUGUENOTS)

	// We sometimes generate a "cost breakdown" so that we don't get unending "bug" reports about complex cost formulas
	G.breakdown = ""

	// This gets set true if ad-hoc adjustments to the cost make it seem worth displaying a cost breakdown
	clear_bit(ACTION_COST_ADJUSTED)

	// Will be set to the base cost of the space, minus any downward adjustments (used to tell if there's any point in e.g. triggerig another advantage)
	G.adjustable = 1

	// Array of modifier types. 0 = Advantage, 1 = Ministry
	G.mod_types = []

	// Array of modifier amounts. 0 = "set to 1", otherwise the -1/+1 value of advantage
	G.modifiers = []
}


function standard_space_click(s, force_type = -1)
{
	action_cost_setup(s, (force_type > 0) ? force_type : space_action_type(s), force_type)

	if (data.spaces[s].type === NAVAL) {
		handle_naval_space(s)
		return
	}

	G.action_cost = action_point_cost(G.active, s, G.action_type)

	if (G.action_type !== MIL) {
		if (G.flags[s] === NONE) {
			G.action_string = "to flag " + data.spaces[G.active_space].name
			G.action_header = "FLAG " + data.spaces[G.active_space].name + ": "
		}
		else {
			G.action_string = "to unflag " + data.spaces[G.active_space].name
			G.action_header = "UNFLAG " + data.spaces[G.active_space].name + ": "
		}
	} else {
		if (has_conflict_marker(s)) {
			G.action_string = "to remove conflict at " + data.spaces[G.active_space].name
			G.action_header = "REMOVE CONFLICT: "
		} else if (data.spaces[s].type === FORT) {
			if (G.flags[s] === NONE) {
				G.action_string = "to build a fort at " + data.spaces[G.active_space].name
				G.action_header = "BUILD FORT: "
			} else if (is_damaged_fort(s)) {
				if (G.flags[s] === G.active) {
					G.action_string = "to repair fort at " + data.spaces[G.active_space].name
					G.action_header = "REPAIR FORT: "
				} else {
					G.action_string = "to seize fort at " + data.spaces[G.active_space].name
					G.action_header = "SEIZE FORT: "
				}
			}
		}
	}

	//Ministries that might give discounts

	G.needs_to_flip_ministry = -1
	if ((G.action_type === DIPLO) && [ IRELAND_1, IRELAND_2, SCOTLAND_1, SCOTLAND_2 ].includes(s) && (G.flags[s] === NONE)) {
		if (has_inactive_ministry(G.active, JONATHAN_SWIFT)) {
			G.needs_to_flip_ministry = JONATHAN_SWIFT
		}
	}

	if ((G.action_type === DIPLO) && [ SONS_OF_LIBERTY, USA_1, USA_2 ].includes(s)) {
		if (has_inactive_ministry(G.active, EDMUND_BURKE)) {
			G.needs_to_flip_ministry = EDMUND_BURKE
			set_transient(G.active, TRANSIENT_BURKE_FOR_DISCOUNT)
		}
	}

	call("space_flow")
}

// Player has clicked a space during action phase, so we're probably reflagging it (but we might be removing conflict or deploying navies)
function handle_space_click(s, force_type = -1)
{
	if (has_transient(G.active, TRANSIENT_JACOBITES_SHIFT_SPACES) && [IRELAND_1, IRELAND_2, SCOTLAND_1, SCOTLAND_2].includes(s) && (force_type === -1)) {
		if (!action_points_available(G.active, s, DIPLO, true, space_rules(s, DIPLO))) {
			advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)
			action_cost_setup(s, MIL)
			G.action_cost   = action_point_cost(R, s, DIPLO, true) //NB: we use the political space-shifting cost, but charge the player military points
			G.action_string = "to shift " + say_space(s) + " space"
			G.action_header = say_ministry_header()
			call ("jacobite_flow")
			return
		}
		if (action_points_eligible_major(MIL, space_rules(s, MIL))) {
			G.active_space = s
			mark_dirty(s)
			call ("jacobite_divert")
			return
		}
	}

	standard_space_click(s, force_type)
}


P.space_flow = script(`

	eval { mark_dirty(G.active_space) } // Mark our space dirty -- so that it will be highlighted as our current action.

	if (G.needs_to_flip_ministry >= 0) {
		eval {
			require_ministry(R, G.needs_to_flip_ministry, "For an action point discount", true)
		}
		if (G.has_required_ministry) {
			eval { G.action_cost = action_point_cost(G.active, G.active_space, G.action_type) }
		}
	}

	// These advantages reduce the cost of unflagging a *market* in *north america* to 1 econ point.
	if ((G.action_type === ECON) && (data.spaces[G.active_space].region === REGION_NORTH_AMERICA) && (G.flags[G.active_space] === (1 - G.active)) && (G.adjustable > 1)) {
		eval { require_advantage(R, FUR_TRADE, "To reduce action cost to 1", true) }
		if (is_bit(USED_REQUIRED_ADVANTAGE)) {
			eval {
				action_point_cost_modify(MODIFY_SET_TO_1, MODIFY_ADVANTAGE)
			}
		}
	}

	// These advantages reduce the cost of unflagging a *market* in *north america* BY 1 action point
	if ((G.action_type === ECON) && (data.spaces[G.active_space].region === REGION_NORTH_AMERICA) && (G.flags[G.active_space] === (1 - G.active)) && (G.adjustable > 1)) {
		eval { require_advantage(R, WHEAT, "To reduce action cost by 1", true) }
		if (is_bit(USED_REQUIRED_ADVANTAGE)) {
			eval {
				action_point_cost_modify(-1, MODIFY_ADVANTAGE)
			}
		}
	}

	// These advantages reduce the cost of unflagging a *market* in *india* BY 1 action point
	if ((G.action_type === ECON) && (data.spaces[G.active_space].region === REGION_INDIA) && (G.flags[G.active_space] === (1 - G.active)) && (G.adjustable > 1)) {
		eval { require_advantage(R, TEXTILES, "To reduce action cost by 1", true) }
		if (is_bit(USED_REQUIRED_ADVANTAGE)) {
			eval {
				action_point_cost_modify(-1, MODIFY_ADVANTAGE)
			}
		}
		if ((G.adjustable > 1) && (G.adv_used < 2)) {
			eval { require_advantage(R, SILK, "To reduce action cost by 1", true) }
			if (is_bit(USED_REQUIRED_ADVANTAGE)) {
				eval {
					action_point_cost_modify(-1, MODIFY_ADVANTAGE)
				}
			}
		}
	}

	// These advantages reduce the cost of unflagging a *market* in *the caribbean* BY 1 action point
	if ((G.action_type === ECON) && (data.spaces[G.active_space].region === REGION_CARIBBEAN) && (G.flags[G.active_space] === (1 - G.active)) && (G.adjustable > 1)) {
		eval { require_advantage(R, RUM, "To reduce action cost by 1", true) }
		if (is_bit(USED_REQUIRED_ADVANTAGE)) {
			eval {
				action_point_cost_modify(-1, MODIFY_ADVANTAGE)
			}
		}
		if ((G.adjustable > 1) && (G.adv_used < 2)) {
			eval { require_advantage(R, RUM, "To reduce action cost by 1", true) }
			if (is_bit(USED_REQUIRED_ADVANTAGE)) {
				eval {
					action_point_cost_modify(-1, MODIFY_ADVANTAGE)
				}
			}
		}
	}

	// European reduce-cost-to-1 unflagging advantages
	if ((G.action_type === DIPLO) && (data.spaces[G.active_space].region === REGION_EUROPE) && (G.flags[G.active_space] === (1 - G.active)) && (G.adjustable > 1)) {
		if ((G.active_space === RUSSIA) || (G.active_space === SWEDEN) || (G.active_space === BAVARIA)) {
			eval { require_advantage(R, GERMAN_DIPLOMACY, "To reduce action cost to 1", true) }
			if (is_bit(USED_REQUIRED_ADVANTAGE)) {
				eval {
					action_point_cost_modify(MODIFY_SET_TO_1, MODIFY_ADVANTAGE)
				}
			}
		} else {
			if ((((G.active_space >= PRUSSIA_1) && (G.active_space <= PRUSSIA_4)) || (G.active_space === GERMAN_STATES_1) || (G.active_space === GERMAN_STATES_2)) && (G.adjustable > 1)) {
				eval { require_advantage(R, SILESIA_NEGOTIATIONS, "To reduce action cost to 1", true) }
				if (is_bit(USED_REQUIRED_ADVANTAGE)) {
					eval {
						action_point_cost_modify(MODIFY_SET_TO_1, MODIFY_ADVANTAGE)
					}
				}
			} else {
				if ((((G.active_space >= SPAIN_1) && (G.active_space <= SPAIN_4)) || ((G.active_space >= AUSTRIA_1) && (G.active_space <= AUSTRIA_4))) && (G.adjustable > 1)) {
					eval { require_advantage(R, ITALY_INFLUENCE, "To reduce action cost to 1", true) }
					if (is_bit(USED_REQUIRED_ADVANTAGE)) {
						eval {
							action_point_cost_modify(MODIFY_SET_TO_1, MODIFY_ADVANTAGE)
						}
					}
				}
			}
		}
	}

	if ((G.action_type === DIPLO) && !data.spaces[G.active_space].prestige) {
		eval { require_ministry_unexhausted(R, PITT_THE_ELDER, "To gain a diplomatic point usable for shifting non-Prestige political spaces", 0, true, true, true) }
		if (G.has_required_ministry) {
			eval {
				log_box_ministry(BRITAIN, PITT_THE_ELDER)
				exhaust_ministry(BRITAIN, PITT_THE_ELDER, 0)
				add_contingent(DIPLO, 1, RULE_SHIFT_NON_PRESTIGE, SHORT_SHIFT_NON_PRESTIGE, true)
				G.action_points_available_now++
				log_box_end(LOG_BOX_MINISTRY)
			}
		}
	}

	if ((G.action_type === DIPLO) && [ SCOTLAND_1, SCOTLAND_2, IRELAND_1, IRELAND_2 ].includes(G.active_space)) {
		eval { require_ministry_unexhausted(R, PAPACY_HANOVER_NEGOTIATIONS, "To gain 2 diplomatic points usable for shifting spaces in Scotland and Ireland", 0, true, true, true) }
		if (G.has_required_ministry) {
			eval {
				log_box_ministry(BRITAIN, PAPACY_HANOVER_NEGOTIATIONS)
				exhaust_ministry(BRITAIN, PAPACY_HANOVER_NEGOTIATIONS, 0)
				add_contingent(DIPLO, 2, RULE_SCOTLAND_IRELAND, SHORT_SCOTLAND_IRELAND, true)
				G.action_points_available_now += 2
				log_box_end(LOG_BOX_MINISTRY)
			}
		}
	}

	if ((G.action_type === DIPLO) && is_europe(G.active_space) && is_entirely_in_europe(DIPLO) && (potential_burke_points(G.active) > 0) && (action_points_major(DIPLO, space_rules(G.active_space, G.action_type), false) > 0)) {
		eval { require_ministry(R, EDMUND_BURKE, "To gain Diplomatic points for each space of Ireland you have flagged, usable only while spending a major diplomatic action entirely within Europe.", true, false, true) }
		if (G.has_required_ministry && !is_ministry_exhausted(R, EDMUND_BURKE)) {
			eval {
				log_box_ministry(R, EDMUND_BURKE)
				exhaust_ministry(R, EDMUND_BURKE)
				let proc = 0
				if (has_transient(R, TRANSIENT_TILE_MADE_DIPLO)) proc++
				if (has_transient(R, TRANSIENT_EVENT_MADE_DIPLO)) proc++
				add_contingent(DIPLO, potential_burke_points(G.active) * proc, RULE_EUROPE_BURKE, SHORT_EUROPE_BURKE, true)
				G.action_points_available_now += potential_burke_points(G.active)
				if (G.minor[DIPLO] > 0) {
					G.action_points_available_now -= Math.max(potential_burke_points(G.active), G.minor[DIPLO]) // Burke points don't combine with minor action points
				}
				log_box_end(LOG_BOX_MINISTRY)
			}
		}
	}

	if ((G.action_type === ECON) && (G.action_points_available_now < G.action_cost)) {
		eval { require_ministry_unexhausted(R, MERCHANT_BANKS, "To ignore the first two debt you take as Economic action points this turn.", 0, true, false) }
	}

	eval {
		set_bit(ELIGIBLE_FOR_HUGUENOTS, (G.active === FRANCE) && (G.action_type === ECON) && any_huguenots_in_region(data.spaces[G.active_space].region) && (G.adjustable > 1))
	}

	if (is_bit(ELIGIBLE_FOR_HUGUENOTS)) {
		call ask_about_huguenots
		if (is_bit(ELIGIBLE_FOR_HUGUENOTS)) {
			eval {
				action_point_cost_modify(-1, MODIFY_HUGUENOTS)
			}
		}
	}
	
	call decide_how_and_whether_to_spend_action_points
	eval { G.action_header = "" }
	if (!is_bit(PAID_ACTION_COST)) {
		return
	}

	eval { do_reflag_space() }
`)



P.decide_how_and_whether_to_spend_action_points = script(`
	eval { clear_bit(PAID_ACTION_COST) }

	if (is_bit(ELIGIBLE_MINOR)) {
		if (G.action_points_available_debt < G.action_cost + 2) {
			eval { set_bit(ACTION_MINOR) }  // If the only way we can do this is as a minor action, we don't need to make a choice
		}
		if (!action_points_eligible_major(G.action_type, space_rules(G.active_space, G.action_type))) {
			eval { set_bit(ACTION_MINOR) }  // If we're not eligible for a major action in this category, we don't need to make a choice
		}
		if (has_transient(G.active, TRANSIENT_MUST_BE_ENTIRELY_IN_EUROPE) && (G.action_type === DIPLO) && ((G.active_space < 0) || (data.spaces[G.active_space].region !== REGION_EUROPE))) {
			eval { set_bit(ACTION_MINOR) }  // If we've spent Edmund Burke's special points in Europe already, only a minor action can be used outside of Europe
		}
	}

	// If we could do *either* major or minor action, make our choice
	if (is_bit(ELIGIBLE_MINOR) && !is_bit(ACTION_MINOR)) {
		call choice_use_minor_action
		eval {
			if (!is_bit(ACTION_MINOR)) {
				clear_bit(ACTION_MINOR)
				G.action_points_available_debt -= G.minor[G.action_type]
				G.action_points_available_now  -= G.minor[G.action_type]
			}
		}
	}

	// If player is buying a bonus war tile, and happens to have geographically restricted military points, find out if he wants to use them
	if (is_bit(BUYING_WAR_TILE)) {
		eval { L.restricted = get_contingent(MIL, RULE_NORTH_AMERICA) }
		if (L.restricted > 0) {
			call confirm_north_america

			eval {
				if (is_bit(MUST_PLACE_IN_NORTH_AMERICA)) {
					G.action_points_available_now  += L.restricted
					G.action_points_available_debt += L.restricted
				}
			}
		}
	}

	// If it is going to cost debt or TRPs, then see if player wants to spend them
	if (G.action_points_available_now < G.action_cost) {
		call confirm_spend_debt_or_trps
		if (G.action_points_available_now < G.action_cost) {
			return // If we didn't decide to spend enough, we're done
		}
	}

	eval { pay_action_cost() }
`)


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

function indent(string, yeah = true)
{
	return yeah ? "<span style=\"margin-left:15px;\">" + string + "</span>" : string
}

function display_action_cost()
{
	if (G.cost) {
		log(italic(indent(G.cost)))
		if (G.breakdown) {
			log (italic(indent(G.breakdown)))
		}

		if (G.debt_spending) {
			log (indent(G.debt_spending))
		}

		if (G.trp_spending) {
			log(indent(G.trp_spending))
		}

		delete G.cost
		delete G.breakdown
		delete G.debt_spending
		delete G.trp_spending
	}
}


function pay_action_cost() {
	advance_action_round_subphase(ACTION_POINTS_ALREADY_SPENT)

	set_bit(PAID_ACTION_COST)
	let prev_cost = G.action_cost
	let cost_string = " Cost: " + G.action_cost

	let msg = say_action_points(G.action_cost, G.action_type) + " spent."
	if (action_points_eligible_major(G.action_type, space_rules(G.active_space, G.action_type)) && G.minor[G.action_type] > 0) {
		if (is_bit(ACTION_MINOR)) {
			msg += " (Minor action)"
		} else {
			msg += " (Major action)"
		}
	}
	G.cost = msg
	if (!is_bit(ACTION_COST_ADJUSTED)) {
		delete G.breakdown // Get unneeded string back out of our game state blob (if no breakdown to be displayed)
	}
	//display_action_cost()  // Moved display to after action is taken

	G.action_cost -= G.committed[G.action_type] // Spend any committed bonus points first
	if (G.action_cost !== prev_cost) {
		cost_string += " ComBonus: " + (prev_cost - G.action_cost)
		prev_cost = G.action_cost
	}
	G.committed[G.action_type] = 0

	if (is_bit(ACTION_MINOR)) {
		// Minor actions always zero out the minor action points (even if the cost was less)
		let excess = G.minor[G.action_type] - G.action_cost
		if (excess > 0) {
			log(italic("Minor action: " + excess + " excess action point" + s(excess) + " forfeited."))
		}
		G.action_cost = Math.max(0, G.action_cost - G.minor[G.action_type])
		G.minor[G.action_type] = 0

		if (G.action_cost !== prev_cost) {
			cost_string += "  MinorDrain: " + (prev_cost - G.action_cost)
			prev_cost = G.action_cost
		}

		if (G.action_cost === 0) set_bit(ACTION_ENTIRELY_MINOR)
	}

	if (is_bit(BUYING_WAR_TILE) && is_bit(MUST_PLACE_IN_NORTH_AMERICA)) {
		G.action_cost = use_contingent(G.action_cost, MIL, RULE_NORTH_AMERICA)
	}

	// Spent contingent points, if available
	for (let rule of space_rules(G.active_space, G.action_type, (G.action_type === MIL) ? MIL : -1)) {
		if (rule === RULE_EUROPE_BURKE) continue

		G.action_cost = use_contingent(G.action_cost, G.action_type, rule)

		if (G.action_cost !== prev_cost) {
			cost_string += "  rule:" + rule + ":" + (prev_cost - G.action_cost)
			prev_cost = G.action_cost
		}

		// Drain non-independent contingent points from e.g. Pitt the Elder if we're only allowed minor actions in this type
		if (is_bit(ACTION_MINOR) && !G.eligible_major[G.action_type]) {
			drain_non_independent(G.action_type, rule)
		}
	}

	// Edmund Burke points spent last
	if (!is_bit(ACTION_MINOR)) {
		let old_cost = G.action_cost
		for (let rule of space_rules(G.active_space, G.action_type)) {
			if (rule !== RULE_EUROPE_BURKE) continue

			G.action_cost = use_contingent(G.action_cost, G.action_type, rule)

			if (G.action_cost !== prev_cost) {
				cost_string += "  rule:" + rule + ":" + (prev_cost - G.action_cost)
				prev_cost = G.action_cost
			}

			// Drain non-independent contingent points from e.g. Pitt the Elder if we're only allowed minor actions in this type
			if (is_bit(ACTION_MINOR) && !G.eligible_major[G.action_type]) {
				drain_non_independent(G.action_type, rule)
			}
		}
		if (G.action_cost !== old_cost) {
			set_transient(G.active, TRANSIENT_MUST_BE_ENTIRELY_IN_EUROPE) // Once we've spent one of the Burke points, we can't region-switch any more
		}
	}

	if ((G.action_type === MIL) && is_bit(BUYING_WAR_TILE) && get_contingent(MIL, RULE_WAR_TILE_OR_DEPLOY)) {
		G.action_cost = use_contingent(G.action_cost, G.action_type, RULE_WAR_TILE_OR_DEPLOY)

		if (G.action_cost !== prev_cost) {
			cost_string += "  WarTileOrDeploy:" + (prev_cost - G.action_cost)
			prev_cost = G.action_cost
		}
	}

	if (G.major[G.action_type] >= G.action_cost) {
		G.major[G.action_type] -= G.action_cost
		G.action_cost = 0
	}
	else {
		throw new Error("Reached paying action costs without enough action points (" + G.major[G.action_type] + ") to repay the remaining cost (" + G.action_cost + ")!" + (is_bit(ACTION_MINOR) ? " (Was minor action)" : "") + " Space:" + G.active_space + "  Type: "+ G.action_type + "   Last:" + G.debug + "  Actions:" + tell_action_points() + "  Cost: " + cost_string)
	}
}


function tell_action_points(space = true, brackets = true) {

	if (!is_action_phase()) return ""
	if (G.subphase < PICKED_TILE_OPTION_TO_PASS) return ""

	let verbose = "medium"
	let names = []
	let shortest = (verbose === "short")
	for (i = 0; i < NUM_ACTION_POINTS_TYPES; i++) {
		if (verbose === "short") {
			names[i] = data.action_points[i].letter
		} else if (verbose === "long") {
			names[i] = data.action_points[i].name
		} else {
			names[i] = data.action_points[i].short
		}
	}


	var need_comma = false
	var early = [ false, false, false ]
	var tell = ""
	for (var level = MAJOR; level <= MINOR; level++) {
		for (var i = 0; i < NUM_ACTION_POINTS_TYPES; i++) {
			if (G.eligible === undefined) continue
			if (action_points_eligible(i, active_rules())) {
				if ((level === MAJOR) && G.eligible_major[i]) {

					if (need_comma) {
						tell += ", "
					}
					tell += names[i] + (shortest ? "" : ": ")
					need_comma = true

					tell += G.major[i] //+ " major"
					if (G.minor[i]) {
						tell += shortest ? "M," : " Major, " // only explicitly say Major if we also have Minor
						early[i] = true
					}
				}

				if ((level === MAJOR) === early[i]) {
					if ((G.minor[i] || !G.eligible_major[i])) {
						if (level === MINOR) {
							if (need_comma) {
								tell += ", "
							}
							tell += names[i] + (shortest ? "" : ": ")
						}

						tell += G.minor[i] + (shortest ? "m" : " Minor")
						need_comma = true
					}

					if (G.committed[i] > 0) {
						if (need_comma) {
							tell += ", "
						}
						tell += G.committed[i] + " Bonus"
						need_comma = true
					}

					for (let rule of active_rules_list()) {
						let amount = rule.amount
						if (any_contingent(i, rule.rule)) {
							if (need_comma) tell += ", "
							tell += amount + " " + (shortest ? rule.short : rule.rule)
							need_comma = true
						}
					}
				}
			}
		}
	}

	if (tell === "") return tell
	if (brackets) tell = "(" + tell + ")"
	if (space) tell = " " + tell
	return italic(tell)
}


function do_reflag_space(repair_if_damaged = true) {
	let whom = (G.flags[G.active_space] === NONE) ? G.active : NONE
	let silent = false

	if ((data.spaces[G.active_space].type === FORT) && repair_if_damaged) {
		if (is_damaged_fort(G.active_space)) {
			set_damaged_fort(G.active_space, false)
			if (G.flags[G.active_space] === G.active) {
				log (bold("Fort repaired at " + say_space(G.active_space) + "."))
				whom = G.active // Stays on our team
				silent = true
				display_action_cost()
			}
			else {
				log (bold("Damaged fort seized at " + say_space(G.active_space) + "."))
				whom = G.active // We go all the way to our team, no stop at neutral
				silent = true
				display_action_cost()
			}
		}
	}

	if ((G.action_type === MIL) && has_conflict_marker(G.active_space)) {
		remove_conflict_marker(G.active_space, false, true)
		display_action_cost()
		log_br() // Leave a blank line
		return
	}

	reflag_space(G.active_space, whom, silent)
	set_add(G.action_point_regions[G.action_type], data.spaces[G.active_space].region + (is_bit(ACTION_ENTIRELY_MINOR) ? NUM_REGIONS : 0)) // We've now used this flavor of action point in this region. If it was entirely minor action points, add NUM_REGIONS (we distinguish for Burke calculations)

	log_br() // Leave a blank line
}


P.confirm_north_america = {
	inactive: "peer across the cold North Atlantic",
	prompt() {
		V.prompt = say_action_header() + say_action("Use points restricted to North America? (Affects which theaters tile can be placed in)")
		button("no")
		button("yes")
	},
	yes() {
		push_undo()
		set_bit(MUST_PLACE_IN_NORTH_AMERICA)
		end()
	},
	no() {
		push_undo()
		end()
	}
}


P.choice_use_minor_action = {
	inactive: "decide whether to use a minor or a major action",
	prompt() {
		V.prompt = say_action_header() + say_action("Use major or minor action" + ((G.action_string !== "") ? " " + G.action_string : "") + "?") + say_action_points_left()
		button ("major")
		button ("minor")
	},
	major() {
		push_undo()
		clear_bit(ACTION_MINOR)
		end()
	},
	minor() {
		push_undo()
		set_bit(ACTION_MINOR)
		end()
	}
}

function add_action_point()
{
	G.action_points_available_now++
	if (is_bit(ACTION_MINOR)) {
		G.minor[G.action_type]++
	} else {
		G.major[G.action_type]++
	}
}

function can_merchant_bank()
{
	return (G.action_type === ECON) && has_active_ministry(R, MERCHANT_BANKS) && (!is_ministry_exhausted(R, MERCHANT_BANKS, 0) || !is_ministry_exhausted(R, MERCHANT_BANKS, 1))
}


function log_spending()
{
	if (G.debt_spent > 0) {
		G.debt_spending = data.flags[R].name + " spent " + say_spending(G.debt_spent + " debt.", R)
		//log (data.flags[R].name + " spent " + say_spending(G.debt_spent + " debt.", R))
	}
	if (G.treaty_points_spent > 0) {
		G.trp_spending = data.flags[R].name + " spent " + say_spending(G.treaty_points_spent + " treaty point" + s(G.treaty_points_spent) + ".", R)
		//log (data.flags[R].name + " spent " + say_spending(G.treaty_points_spent + " treaty point" + s(G.treaty_points_spent) + ".", R))
	}
}


// Player needs to spend debt or action points to do the thing he wants to do. See if that's okay with him
P.confirm_spend_debt_or_trps = {
	_begin() {
		//BR// No more separate confirmation step
		if (G.action_points_available_now >= G.action_cost) {
			log_spending()
			end()
		}
	},
	inactive: "spend debt and/or TRPs",
	prompt() {
		if (!action_points_eligible_major(G.action_type, space_rules(G.active_space, G.action_type)) && (G.minor[G.action_type] <= 0)) {
			V.prompt = say_action_header()
			if (G.action_type === data.investments[G.played_tile].minortype) {
				V.prompt += say_action("You cannot conduct another action using " + data.action_points[G.action_type].name + " points, as you have already conducted a minor action. ")
				if (globalThis.RTT_FUZZER) button("fail")
			} else { // Probably/Hopefully can't get here, but if you do you have to hit Undo
				V.prompt += say_action("You aren't eligible to conduct an action using " + data.action_points[G.action_type].name + " points.")
				if (globalThis.RTT_FUZZER) button("fail")
			}
		} else if (G.action_points_available_now < G.action_cost) {
			V.prompt = say_action_header()
			V.prompt += say_action(("Pay remaining action point costs (" + G.action_points_available_now + "/" + G.action_cost + " [@" + G.action_type + "])" + ((G.action_string !== "") ? " " + G.action_string : ""))) + "."
			if (is_bit(ACTION_COST_ADJUSTED)) {
				V.prompt += " " + say_action(parens("Cost Breakdown: " + G.breakdown))
			}
			V.prompt += " (Available Debt: " + available_debt(R) + ((G.treaty_points[R] > 0) ? " / Treaty Points: " + G.treaty_points[R] : "") + ")"
			V.prompt += say_action_points_left()
			let any = false
			if ((available_debt(R) > 0) || can_merchant_bank()) {
				button("paydebt")
				any = true
			}
			if (G.treaty_points[R] > 0) {
				button("paytrp")
				any = true
			}
			if (!any && globalThis.RTT_FUZZER) button("fail")
		} else {
			V.prompt = say_action_header()
			if ((G.debt_spent > 0) && (G.treaty_points_spent === 0)) {
				V.prompt += say_action("Confirm spending " + G.debt_spent + " debt")
			} else if ((G.treaty_points_spent > 0) && (G.debt_spent === 0)) {
				V.prompt += say_action("Confirm spending " + G.treaty_points_spent + " treaty points")
			} else {
				V.prompt += say_action("Confirm spending " + G.debt_spent + " debt and " + G.treaty_points_spent + " treaty points")
			}
			V.prompt += say_action(((G.action_string !== "") ? " " + G.action_string : "") + "?")
			V.prompt += say_action_points_left()
			button("confirm")
		}
	},
	paydebt() {
		push_undo()
		if (can_merchant_bank()) {
			log_box_ministry(R, MERCHANT_BANKS)
			log("Britain ignored a point of debt spent for an [@0].")
			log_box_end(LOG_BOX_MINISTRY)
			if (!is_ministry_exhausted(R, MERCHANT_BANKS, 0)) {
				exhaust_ministry(R, MERCHANT_BANKS, 0, true)
			} else {
				exhaust_ministry(R, MERCHANT_BANKS, 1, true)
			}
		} else {
			if (!has_transient(R, TRANSIENT_FIRST_DEBT_TAKEN) && has_active_ministry(R, TURGOT) && (available_debt(FRANCE) > available_debt(BRITAIN))) {
				add_action_point()
				log (say_ministry(TURGOT, FRANCE) + " added an extra action point.")
			}
			pay_debt(R, 1) // Turgot checks the debt level *before* expending it
		}
		G.debt_spent++
		set_transient(R, TRANSIENT_FIRST_DEBT_TAKEN)
		add_action_point()

		//BR// No more separate confirmation step
		if (G.action_points_available_now >= G.action_cost) {
			log_spending()
			end()
		}
	},
	paytrp() {
		push_undo()
		pay_treaty_points(R, 1)
		G.treaty_points_spent++
		add_action_point()

		//BR// No more separate confirmation step
		if (G.action_points_available_now >= G.action_cost) {
			log_spending()
			end()
		}
	},
	confirm() {
		push_undo()
		log_spending()
		end()
	},
	fail() {
		if (G.fail === undefined) {
			G.fail = [0, 0, 0, 0]
		}
		G.fail[G.action_type]++
		add_action_point()
		end()
	}
}


function check_event_skip()
{
	if (is_bit(SKIPPED_EVENT)) clear_bit(SKIPPED_EVENT)
}


/* 5.0 Action Rounds - This is the main place player makes choices during his action round. */
P.action_round_core = {
	_begin() {
		G.action_header = ""
		clear_bit(BUYING_WAR_TILE)
		clear_bit(SKIPPED_EVENT)
		L.clicked_upgrade = false
		if (globalThis.RTT_FUZZER) G.fail = [ 0, 0, 0, 0 ]
	},
	_resume() {
		G.action_header = ""
		log_box_end()
		clear_bit(BUYING_WAR_TILE)
		delete G.ministry_required_because
		delete G.advantage_required_because
		delete G.action_string
	},
	_end() {
		G.action_header = ""
		clear_bit(BUYING_WAR_TILE)
		clear_bit(SKIPPED_EVENT)
		L.clicked_upgrade = false
		delete G.ministry_required_because
		delete G.advantage_required_because
		delete G.action_string
	},
	inactive() {
		let whom = ((G.active === "France") || (G.active === FRANCE)) ? FRANCE : BRITAIN
		if (G.subphase <= OPTION_TO_PLAY_EVENT) {
			if ((data.investments[G.played_tile].majorval <= 3) || (has_active_ministry(whom, MARQUIS_DE_CONDORCET) && !is_ministry_exhausted(whom, MARQUIS_DE_CONDORCET))) {
				return "play an event or begin spending action points and using abilities. " + say_action_points_left()
			} else {
				return "begin spending action points and using abilities. " + say_action_points_left()
			}
		} else {
			return "spend action points or use an ability. " + say_action_points_left()
		}
	},
	prompt() {
		var header = "ACTION ROUND " + G.round + ": "
		var prompt = ""

		let any = false

		if (G.subphase <= OPTION_TO_PLAY_EVENT) {
			if ((data.investments[G.played_tile].majorval <= 3) || (has_ministry(R, MARQUIS_DE_CONDORCET) && !is_ministry_exhausted(R, MARQUIS_DE_CONDORCET))) { // Eligible for event if our tiles major base value was <= 3
				if (any) prompt += ", "
				prompt += "Play Event"
				any = true

				for (var card of G.hand[R]) {
					// Only events that either match=our major action or be "wild" events (the ones that don't show a symbol)
					if ((data.cards[card].action === WILD) || (data.cards[card].action === data.investments[G.played_tile].majortype) ||
						(has_ministry(R, BANK_OF_ENGLAND) && (data.cards[card].action === ECON) && !is_ministry_exhausted(R, BANK_OF_ENGLAND, 1))) {
						action_event_card(card)
					}
				}
			}

			if (has_active_ministry(R, TOWNSHEND_ACTS) && !is_ministry_exhausted(R, TOWNSHEND_ACTS)) {
				if (any) prompt += ", "
				prompt += "Use Townshend Acts"
				any = true

				for (var d of G.global_demand) {
					action_demand(d)
				}
			}
		}

		if (L.clicked_upgrade && is_bit(FLAG_MILITARY_UPGRADE)) {
			if (any) prompt += ", "
			prompt += "Select basic war tile for military upgrade"
			any = true
		}

		if (any) prompt += ", "

		let any_advantages = has_any_eligible_advantages(R)
		let any_ministries = false
		for (let r of G.ministry_revealed[R]) {
			if (!r) any_ministries = true
		}
		for (let m of G.ministry[R]) {
			if (!ministry_has_activatable_abilities(m)) continue
			if (is_ministry_fully_exhausted(R, m)) continue
			if (!ministry_useful_this_phase(R, G.subphase)) continue
			any_ministries = true
			break
		}

		if (any_advantages && any_ministries) {
			prompt += "Spend Action Points or activate Advantage / Ministry. "
		} else if (any_advantages) {
			prompt += "Spend Action Points or activate Advantage. "
		} else if (any_ministries) {
			prompt += "Spend Action Points or activate Ministry. "
		} else {
			prompt += "Spend Action Points."
		}
		V.prompt = say_action_header(header) + say_action(prompt) + say_action_points_left()

		action_eligible_advantages()
		action_eligible_ministries()
		action_all_eligible_spaces()

		// We probably won't show a face down event deck, nor unbuilt fleets, so special buttons for them
		if (G.eligible[DIPLO]) {
			button ("draw_event", (G.deck.length || G.discard_pile.length) && !(globalThis.RTT_FUZZER && G.fail !== undefined && G.fail[DIPLO]))
		}

		if (G.eligible[MIL] && !(globalThis.RTT_FUZZER && G.fail !== undefined  && G.fail[MIL])) {
			if (G.navy_box[G.active] > 0) action_navy_box()
			button ("construct_squadron", (G.unbuilt_squadrons[R] > 0) && (action_points_available(G.active, -1, MIL, true) >= cost_to_build_squadron(R, true)))

			if (G.turn === PEACE_TURN_6) {
				if (G.bought_action_points !== ECON)  button("buy_diplomatic")
				if (G.bought_action_points !== DIPLO) button("buy_economic")
			} else {
				button ("buy_bonus_war_tile")
			}
		}

		var left = 0
		for (var i = 0; i < NUM_ACTION_POINTS_TYPES; i++) {
			left += G.major[i] + G.minor[i]
		}

		// If we've spent all our action points but still haven't taken an eligible military upgrade, add the top-row button as a hint
		if (is_bit(FLAG_MILITARY_UPGRADE)) {
			if (!left) button("military_upgrade") // Only show special button if we're out of anything else to do
			for (let theater = 0; theater <= data.wars[G.next_war].theaters; theater++) { //NB: intentionally start at 0 (no-theater-yet) and then also theaters 1-X
				for (var t of G.theater_basic[G.active][theater]) {
					action_basic_war_tile(t)
				}
			}
		}

		// Decide whether to remind about unused advantages
		let still_advantages = false
		for (let a = 0; a < NUM_ADVANTAGES; a++) {
			if (!has_advantage_eligible(R, a)) continue

			// These are the advantages that can generally be used even after spending all one's action points
			if (![BALTIC_TRADE, CENTRAL_EUROPE_CONFLICT, MEDITERRANEAN_INTRIGUE, ALGONQUIN_RAIDS, IROQUOIS_RAIDS, PATRIOT_AGITATION, LETTERS_OF_MARQUE, PIRATE_HAVENS, RAIDS_AND_INCURSIONS, POWER_STRUGGLE, SEPARATIST_WARS].includes(a)) continue

			if (!has_advantage_targets(R, a)) continue

			still_advantages = true
			break
		}

		let still_bank = (G.round === 4) && has_ministry(R, BANK_OF_ENGLAND) && !is_ministry_exhausted(R, BANK_OF_ENGLAND, 0)
		let still_halley = (G.round === 4) && has_ministry(R, EDMOND_HALLEY) && !is_ministry_exhausted(R, EDMOND_HALLEY, 1) && ((G.flags[BALEARIC] === BRITAIN) || (G.flags[BISCAY] === BRITAIN)) && (G.hand[R].length > 0)
		let still_walpole = (G.round === 4) && has_ministry(R, ROBERT_WALPOLE) && !is_ministry_exhausted(R, ROBERT_WALPOLE) && (G.hand[R].length > 0)
		let still_huguenots = (G.round === 4) && has_ministry(R, NEW_WORLD_HUGUENOTS) && !is_ministry_exhausted(R, NEW_WORLD_HUGUENOTS)

		if (G.subphase === PICKED_TILE_OPTION_TO_PASS) {
			button("confirm_pass_to_reduce_debt")
		} else {
			button((left > 0)              ? "confirm_end_action_round" :
				is_bit(FLAG_MILITARY_UPGRADE) ? "confirm_no_military_upgrade" :
				still_advantages              ? "confirm_end_action_round_2" :
				still_bank                    ? "confirm_end_action_round_bank" :
				still_halley                  ? "confirm_end_action_round_halley" :
				still_walpole                 ? "confirm_end_action_round_walpole" :
				still_huguenots               ? "confirm_end_action_round_huguenots" :
				"end_action_round")
		}
	},
	military_upgrade() {
		push_undo()
		check_event_skip()
		G.debug = 0
		L.clicked_upgrade = true
		// This is mostly just a dummy - only effect of button is to scroll down to war
	},
	draw_event() {
		push_undo()
		check_event_skip()
		G.debug = 1
		handle_buy_event()
	},
	construct_squadron() {
		push_undo()
		check_event_skip()
		G.debug = 2
		handle_construct_squadron_button()
	},
	basic_war(t) {
		push_undo()
		check_event_skip()
		G.debug = 3
		handle_military_upgrade(t)
	},
	navy_box() {
		push_undo()
		check_event_skip()
		G.debug = 4
		handle_navy_box()
	},
	buy_bonus_war_tile() { // buy a bonus war tile, and deploy it into the next war
		push_undo()
		check_event_skip()
		G.debug = 5
		set_bit(BUYING_WAR_TILE)
		handle_buy_bonus_war_tile()
	},
	buy_diplomatic() { // TBD: Turn 6 only, spend 2 mil to buy 1 diplo. Can't buy both diplo & econ in same turn.
		push_undo()
		check_event_skip()
		G.debug = 6
		handle_buy_diplomatic()
	},
	buy_economic() { // TBD: Turn 6 only, spend 2 mil to buy 1 econ. Can't buy both diplo & econ in same turn
		push_undo()
		check_event_skip()
		G.debug = 7
		handle_buy_economic()
	},
	confirm_pass_to_reduce_debt() {
		push_undo()
		check_event_skip()
		G.debug = 8
		var debt_reduction = (G.debt[R] >= 2) ? 2 : (G.debt[R] >= 1) ? 1 : 0
		log(data.flags[R].name + " passed to " + say_spending("reduce debt by " + debt_reduction, R) + ".")
		G.debt[R] = Math.max(0, G.debt[R] - 2)
		end()
	},
	end_action_round() {
		push_undo()
		clear_bit(SKIPPED_EVENT)
		G.debug = 9
		end()
	},
	confirm_end_action_round() {
		this.end_action_round()
	},
	confirm_end_action_round_2() {
		this.end_action_round()
	},
	confirm_no_military_upgrade() {
		this.end_action_round()
	},
	confirm_end_action_round_bank() {
		this.end_action_round()
	},
	confirm_end_action_round_halley() {
		this.end_action_round()
	},
	confirm_end_action_round_walpole() {
		this.end_action_round()
	},
	confirm_end_action_round_huguenots() {
		this.end_action_round()
	},
	conflict(s) {
		// Usually clicking conflict just resolves as clicking the space, but if we have military points available *and* the other type for this space then clicking the conflict is explicitly to remove the conflict and clicking the space is to take the regular flag action for the space (w/ conflict discount)
		G.debug = 10
		if (!G.eligible[MIL] || !has_conflict_marker(s)) {
			this.space(s)
		} else {
			push_undo()
			check_event_skip()
			handle_space_click(s, MIL)
		}
	},
	damaged(s) {
		this.space(s)
	},
	space(s) {
		push_undo()
		check_event_skip()
		G.debug = 11
		handle_space_click(s)
	},
	ministry_card(m) {
		push_undo()
		check_event_skip()
		G.debug = 12
		handle_ministry_card_click(m)
	},
	advantage(a) {
		push_undo()
		check_event_skip()
		G.debug = 13
		advance_action_round_subphase(BEFORE_SPENDING_ACTION_POINTS) // Can't play an event after using an advantage
		handle_advantage_click(a)
	},
	event_card(c) {
		push_undo()
		check_event_skip()
		G.debug = 14
		handle_event_card_click(c)
	},
	demand(d) {
		push_undo()
		check_event_skip()
		G.debug = 15
		handle_townshend_acts_click(d)
	},
	frenchify() {
		push_undo()
		flagify(FRANCE)
	},
	britify() {
		push_undo()
		flagify(BRITAIN)
	},
	cheatrefresh() {
		push_undo()
		debug_log("Advantages Refreshed")
		advantages_acquired_last_round_now_available()
		G.adv_used = 0
		G.adv_regions = 0
	},
	cheat_huguenots() {
		push_undo()
		add_huguenots(QUEBEC_AND_MONTREAL)
		add_huguenots(ACADIA)
		expend_huguenots(ACADIA)
		add_huguenots(LOUISIANA)
		add_huguenots(ST_DOMINGUE)
		add_huguenots(GUADELOUPE)
	},
	cheat_conflict() {
		cheat_conflict_flag = !cheat_conflict_flag
		for (let s = 0; s < NUM_SPACES; s++) {
			if (!can_have_conflict_marker(s)) continue
			if (cheat_conflict_flag) {
				add_conflict_marker(s)
			} else {
				remove_conflict_marker(s)
			}
		}
	},
	cheat_damage() {
		cheat_damage_flag = !cheat_damage_flag
		for (let s = 0; s < NUM_SPACES; s++) {
			if (data.spaces[s].type !== FORT) continue
			if (cheat_damage_flag) {
				set_damaged_fort(s, true)
			} else {
				set_damaged_fort(s, false)
			}
		}
	},
	cheat_cheat() { // Whatever random debug code I want to inject right now
		push_undo()
		if (G.townshend_acts === -1) {
			G.townshend_acts = G.global_demand[0]
		} else if (G.townshend_acts === G.global_demand[0]) {
			G.townshend_acts = G.global_demand[1]
		} else if (G.townshend_acts === G.global_demand[1]) {
			G.townshend_acts = G.global_demand[2]
		} else {
			G.townshend_acts = -1
		}
	}
}

var cheat_conflict_flag = false
var cheat_damage_flag = false


P.before_end_of_action_round = script(`
	eval { G.subphase = NOT_ACTION_PHASE }

	if ((G.round === 1) && has_inactive_ministry(R, JAMES_WATT)) {
		eval { require_ministry(R, JAMES_WATT, "Must be active before opponent's turn to receive a bonus when opponent activates an advantage.", true) }
	}

	if (G.round < 4) {
		return // Only need to do the below reminders on the player's last action round of the turn
	}

	if (has_inactive_ministry(R, COURT_OF_THE_SUN_KING)) {
		eval { require_ministry(R, COURT_OF_THE_SUN_KING, "Last chance to flip in time for scoring phase" + ((G.turn <= PEACE_TURN_3) ? " (and Style keyword for upcoming war)" : ""), true) }
	}

	if (has_inactive_ministry(R, EAST_INDIA_COMPANY)) {
		eval { require_ministry(R, EAST_INDIA_COMPANY, "Last chance to flip in time for scoring phase", true) }
	}

	if (has_inactive_ministry(R, JOHN_LAW)) {
		eval { require_ministry(R, JOHN_LAW, "Last chance to flip in time to reduce debt at end of turn", true) }
	}

	if (has_inactive_ministry(R, THE_CARDINAL_MINISTERS) && (G.turn === PEACE_TURN_1)) {
		eval { require_ministry(R, THE_CARDINAL_MINISTERS, "Last chance to flip in time use Governance keyword in upcoming war", true) }
	}

	if (has_inactive_ministry(R, JONATHAN_SWIFT) && (G.turn <= PEACE_TURN_3)) {
		eval { require_ministry(R, JONATHAN_SWIFT, "Last chance to flip in time use Style keyword in upcoming war", true) }
	}

	if (has_inactive_ministry(R, ROBERT_WALPOLE) && (G.turn === PEACE_TURN_1)) {
		eval { require_ministry(R, ROBERT_WALPOLE, "Last chance to flip in time use Governance keyword in upcoming war", true) }
	}

	if (has_inactive_ministry(R, CHARLES_HANBURY_WILLIAMS) && (G.turn <= PEACE_TURN_3)) {
		eval { require_ministry(R, CHARLES_HANBURY_WILLIAMS, "Last chance to flip in time use Style keyword in upcoming war", true) }
	}

	if (has_inactive_ministry(R, POMPADOUR_AND_DU_BARRY) && (G.turn <= PEACE_TURN_3)) {
		eval { require_ministry(R, POMPADOUR_AND_DU_BARRY, "Last chance to flip in time use Style keyword in upcoming war", true) }
	}

	if (has_inactive_ministry(R, SAMUEL_JOHNSON)) {
		eval { require_ministry(R, SAMUEL_JOHNSON, "Last chance to flip in time for scoring phase", true) }
	}

	if (has_inactive_ministry(R, DUPLEIX)) {
		eval { require_ministry(R, DUPLEIX, "Last chance to flip in time for scoring phase", true) }
	}

	if (has_inactive_ministry(R, VOLTAIRE)) {
		eval { require_ministry(R, VOLTAIRE, "Last chance to flip in time for scoring phase", true) }
	}

	if (has_inactive_ministry(R, JAMES_WATT)) {
		eval { require_ministry(R, JAMES_WATT, "Last chance to flip to protect from debt overruns during scoring or war", true) }
	}
`)


P.end_of_action_round = {
	inactive: "end the action round",
	prompt() {
		V.prompt = say_action_header("ACTION ROUND " + G.round + ": ") + say_action("Confirm end of action round. (No undo possible past this point)")
		button("confirm")
	},
	confirm() {
		push_undo()

		if (has_transient(R, TRANSIENT_JACOBITES_SHIFT_SPACES)) {
			exhaust_ministry(R, JACOBITE_UPRISINGS, 0)
		}

		clear_bit(SKIPPED_EVENT)
		end()
	}
}


/* 7.0 WAR TURNS */

P.war_turn = script (`
	call war_resolution_phase
	call war_victory_check_phase
	call war_reset_phase
	if (G.turn < WAR_TURN_AWI) {
		call war_layout_phase
	}
`)



function conquest_point_cost(s)
{
	return has_huguenots(s) ? 2 : 1
}


function theater_winner(theater)
{
	return get_winner(theater_strength(FRANCE, theater), theater_strength(BRITAIN, theater))
}


function theater_delta(theater)
{
	return Math.abs(theater_strength(FRANCE, theater) - theater_strength(BRITAIN, theater))
}

function theater_tier(theater)
{
	let who   = theater_winner(theater)
	let delta = theater_delta(theater)

	var margin
	if ((who === FRANCE) && (data.wars[G.next_war].theater[theater].france_margin !== undefined)) {
		margin = data.wars[G.next_war].theater[theater].france_margin
	} else {
		margin = data.wars[G.next_war].theater[theater].margin
	}

	for (let i = margin.length - 1; i >= 0; i--) {
		if (delta >= margin[i]) return i
	}

	return -1
}


/* 7.1.4 - Total Theater Strength */
function theater_strength(who, theater)
{
	let score = 0
	for (let s = 0; s < NUM_SPACES; s++) {
		if (data.spaces[s].alliance) {
			for (const a of data.spaces[s].alliance) {
				if (a[0] !== G.next_war) continue
				if (a[1] !== theater) continue
				if (G.flags[s] !== who) continue
				if (has_conflict_marker(s)) continue     // Only non-conflicted spaces (3.8)
				if (is_damaged_fort(s)) continue         // Only undamaged forts (7.1.3)
				score++
			}
		}

		if (data.spaces[s].region !== data.wars[G.next_war].theater[theater].region) {
			if ((G.next_war === WAR_7YW) && (theater === 3)) {
				if (data.spaces[s].region !== REGION_CARIBBEAN) continue // 7YW, theater 3 has two regions
			} else {
				continue
			}
		}


		if (data.wars[G.next_war].theater[theater].conflicts) {
			if ((G.flags[s] === 1 - who) && has_conflict_marker(s)) score++ // Score for conflict markers on *opponent's* flagged spaces
		}
	}

	if (data.wars[G.next_war].theater[theater].keyword > 0) {
		if (has_active_keyword(who, data.wars[G.next_war].theater[theater].keyword)) score++
	}

	for (const t of G.theater_basic[who][theater]) {
		if (set_has(G.basic_revealed[who], t)) score += data.basic_war_tiles[t].val
	}

	for (const t of G.theater_bonus[who][theater]) {
		if (set_has(G.bonus_revealed[who], t) || (t === ATLANTIC_DOMINANCE) || (t === ATLANTIC_DOMINANCE + 1)) score += data.bonus_war_tiles[t].val
	}

	if ((who === BRITAIN) && (G.byng === theater)) score += 2

	return score
}


function num_choices(who, type)
{
	let num = 0
	for (const t of L.wartile_choices[who]) {
		if (t === type) num++
	}
	return num
}

function say_war_choices(who)
{
	let fort = num_choices(who, WAR_FORT)
	let flag = num_choices(who, WAR_FLAG)
	let any = false
	let msg = ""

	if (L.wartile_original_amounts[who][WAR_FLAG] > 0) {
		msg = (L.wartile_original_amounts[who][WAR_FLAG] - flag) + "/" + L.wartile_original_amounts[who][WAR_FLAG] + " Unflag"
		any = true
	}

	if (L.wartile_original_amounts[who][WAR_FORT] > 0) {
		if (any) msg += ", "
		msg += (L.wartile_original_amounts[who][WAR_FORT] - fort) + "/" + L.wartile_original_amounts[who][WAR_FORT] + " Fort or Naval"
		any = true
	}

	return parens(msg, any)
}


function do_wartile(who, type) {
	L.wartile_original_amounts[who][type]++
	switch (type) {
		case WAR_DUDE:
			break
		case WAR_DEBT:
			L.wartile_debt[1-who]++
			L.wartile_choices[who].push(type)
			break
		case WAR_FORT:
		case WAR_FLAG:
			L.wartile_choices[who].push(type)
			break
	}
}


P.war_theater_reveal = {
	_begin() {
		log ("=" + "Theater " + G.theater + ": " + data.wars[G.next_war].theater_names[G.theater])
		review_begin()
		review_push("")

		L.wartile_choices = [ [], [] ]
		L.wartile_debt = [ 0, 0 ]
		L.wartile_original_amounts = [ [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ]

		// Reveal all the tiles in this theater only
		for (let who = FRANCE; who <= BRITAIN; who++) {
			let msg = "~w"   // The encoding here looks like ~wb03,B20,B11   for an undertermined number of B tiles
			let any = false
			for (let tile of G.theater_basic[who][G.theater]) {
				set_add(G.basic_revealed[who], tile)
				do_wartile(who, data.basic_war_tiles[tile].type)
				if (any) msg += ","
				any = true
				msg += "b" + ((tile < 10) ? "0" : "") + tile
			}
			for (let tile of G.theater_bonus[who][G.theater]) {
				set_add(G.bonus_revealed[who], tile)
				do_wartile(who, data.bonus_war_tiles[tile].type)
				msg += ",B" + ((tile < 10) ? "0" : "") + tile
			}
			log (msg)
		}

		// First to act is player closest to automatic victory, or if tied it's whoever went first on the last peace turn
		if (G.vp > 15) {
			G.first_war_player = FRANCE
		} else if (G.vp < 15) {
			G.first_war_player = BRITAIN
		} else {
			G.first_war_player = G.first_player
		}

		if (L.wartile_choices[G.first_war_player].length > 0) {
			G.active = G.first_war_player
			if (L.wartile_debt[1 - G.first_war_player] > 0) {
				log(data.flags[G.first_war_player].name + " has revealed " + L.wartile_debt[1 - G.first_war_player] + " tile" + s(L.wartile_debt[1 - G.first_war_player]) + " with " + ((L.wartile_debt[1 - G.first_war_player] === 1) ? "a " : "") + "debt marker" + s(L.wartile_debt[1 - G.first_war_player]) + ".")
			}
			increase_debt(1 - G.first_war_player, L.wartile_debt[1 - G.first_war_player])
			log_br()
			if (G.dirty_who !== G.active) {
				clear_dirty()
				G.dirty_who = G.active
			}
		} else if (L.wartile_choices[1 - G.first_war_player].length) {
			G.active = 1 - G.first_war_player
			if (L.wartile_debt[G.first_war_player] > 0) {
				log(data.flags[1 - G.first_war_player].name + " has revealed " + L.wartile_debt[G.first_war_player] + " tile" + s(L.wartile_debt[G.first_war_player]) + " with " + ((L.wartile_debt[G.first_war_player] === 1) ? "a " : "") + "debt marker" + s(L.wartile_debt[G.first_war_player]) + ".")
			}

			increase_debt(G.first_war_player, L.wartile_debt[G.first_war_player])
			log_br()
			if (G.dirty_who !== G.active) {
				clear_dirty()
				G.dirty_who = G.active
			}
		} else {
			G.active = [ FRANCE, BRITAIN ]
		}

		review_step(0, FRANCE)
		review_step(0, BRITAIN)
	},
	inactive() {
		if (R < 0) {
			return "review/resolve revealed war tiles"
		} else if (G.review_step[1-R] < G.review_index.length) {
			if (G.review_step[1-R] === 0) {
				return "review war tiles"
			} else {
				return "review revealed war tiles"
			}
		} else if ((L.wartile_debt[R] > 0) && L.wartile_choices[1-R].includes(WAR_DEBT)) {
			return "resolve debt tiles"
		} else {
			return "resolve war tile actions"
		}
	},
	prompt() {
		let any = false
		let any_okay    = false
		let spare_markets = []

		let msg = say_action_header("WAR THEATER " + G.theater + ": ")

		if (G.review_step[R] < G.review_index.length) {
			msg += say_action_header("[Click] the " + data.wars[G.next_war].theater_names[G.theater] + " theater on the " + data.wars[G.next_war].name + " mat to reveal war tiles.")
			action_theater(G.theater)
		} else if ((L.wartile_debt[1 - R] > 0) && L.wartile_choices[R].includes(WAR_DEBT)) {
			msg += say_action("You have revealed " + L.wartile_debt[1 - R] + " tile" + s(L.wartile_debt[1 - R]) + " with " + a(L.wartile_debt[1 - R]) + "debt marker" + s(L.wartile_debt[1 - R]) +  ". " + data.flags[1 - R].adj + " debt increased by " + L.wartile_debt[1 - R] + ".")
			button("done")
		} else {
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== data.wars[G.next_war].theater[G.theater].region) {
					if ((G.next_war === WAR_7YW) && (G.theater === 3)) {
						if (data.spaces[s].region !== REGION_CARIBBEAN) continue // 7YW, theater 3 has two regions
					} else {
						continue
					}
				}
				if (G.flags[s] !== 1 - R) continue
				let space_type = data.spaces[s].type
				if (num_choices(R, WAR_FORT) > 0) {
					if (((space_type === FORT) || (space_type === NAVAL)) && !is_damaged_fort(s)) {
						any = true
						action_space(s)
					}
				}
				if (num_choices(R, WAR_FLAG)) {
					if (has_conflict_marker(s)) continue // Surprisingly, you can't remove a flag with a conflict marker!

					if (space_type === MARKET) {
						let okay = true
						for (const s2 of data.spaces[s].connects) {
							if (data.spaces[s2].type !== MARKET) continue
							if (G.flags[s2] !== 1 - R) continue

							if (check_if_market_isolated(s2)) continue // If connected market is *already* isolated, then removing target flag by definition doesn't *cause* it to become isolated

							G.flags[s] = NONE // temporarily unflag our target space
							let now_isolated = check_if_market_isolated(s2) // check if it isolates this adjacent space
							G.flags[s] = 1 - R // set target space back

							if (now_isolated) {
								okay = false
								break
							}
						}

						if (okay) {
							any = true
							any_okay = true
							action_space(s)
						} else {
							spare_markets.push(s)
						}
					} else if (space_type === POLITICAL) {
						any = true
						action_space(s)
					}
				}
			}

			// If there were NO markets we can unflag w/o isolating another market, then in that case we're allowed to unflag a market that isolates other markets - 7.1.2(i)
			if (!any_okay) {
				for (const s of spare_markets) {
					any = true
					action_space(s)
				}
			}

			msg += say_action("Execute war tile actions for Theater " + G.theater + ", " + data.wars[G.next_war].theater_names[G.theater] + ". " + say_war_choices(R))
			if (!any) {
				if (L.wartile_choices[R].length) {
					msg += say_action(" (None possible)")
				} else {
					msg += say_action(" (Done)")
				}
				button("done")
			}
		}

		V.prompt = msg
	},
	theater(_t) {
		push_undo()
		// t = display_to_theater(t) // Presently unused but it makes me nervous to leave the conversion out in case we change this later
		review_step(++G.review_step[R], R)
		if (Array.isArray(G.active)) {
			set_delete(G.active, R)
			review_step(100, R)
			if (G.active.length === 0) {
				review_end()
				end()
			}
		} else {
			if ((G.review_step[FRANCE] >= 1) && (G.review_step[BRITAIN] >= 1)) {
				review_end()
				if (!L.wartile_choices[R].length) end()
			}
		}
	},
	space(s) {
		push_undo()
		switch (data.spaces[s].type) {
			case FORT:
				log(data.flags[R].name + " used Damaged Fort tile.")
				set_damaged_fort(s, true, true)
				array_delete_item(L.wartile_choices[R], WAR_FORT)
				log_br()
				break
			case NAVAL:
				log(data.flags[R].name + " used Remove Fleet tile.")
				move_squadron_token(1-R, s, SPACE_NAVY_BOX)
				reflag_space(s, NONE, true)
				G.navy_box[1-R]++
				validate_squadrons("WAR TILE")
				log (bold(say_space(s) + " squadron displaced."))
				log (say_navy_box())
				log_br()
				array_delete_item(L.wartile_choices[R], WAR_FORT)
				break
			case MARKET:
			case POLITICAL:
				log(data.flags[R].name + " used Unflag tile.")
				reflag_space(s, NONE)
				array_delete_item(L.wartile_choices[R], WAR_FLAG)
				log_br()
				break
		}
	},
	done() {
		push_undo()
		let done = true

		if ((L.wartile_debt[1 - R] > 0) && L.wartile_choices[R].includes(WAR_DEBT)) {
			while (L.wartile_choices[R].includes(WAR_DEBT)) {
				array_delete_item(L.wartile_choices[R], WAR_DEBT)
			}
			if (L.wartile_choices[R].length > 0) done = false
		}

		if (done) {
			if (L.wartile_choices[R].length > 0) {
				log(data.flags[R].name + " was unable to use " + L.wartile_choices[R].length + " war tile effect" + s(L.wartile_choices[R].length) + " (no eligible targets).")
			}

			L.wartile_choices[R] = []
			if ((L.wartile_choices[1 - R].length > 0) || (G.review_step[1 - R] < G.review_index.length)) {
				G.active = 1 - R
				if (L.wartile_debt[R] > 0) {
					log(data.flags[1 - R].name + " has revealed " + L.wartile_debt[R] + " tile" + s(L.wartile_debt[R]) + " with " + ((L.wartile_debt[R] === 1) ? "a " : "") + "debt marker" + s(L.wartile_debt[R]) + ".")
				}
				increase_debt(R, L.wartile_debt[R])
				log_br()
				clear_dirty()
				G.dirty_who = G.active
			} else {
				review_end()
				end()
			}
		}
	}
}


function remove_jacobites()
{
	clear_bit(JACOBITES_ALWAYS)
	set_bit(JACOBITES_NEVER)
	let index = G.ministry[FRANCE].indexOf(JACOBITE_UPRISINGS)
	if (index >= 0) {
		let len = G.ministry[FRANCE].length
		array_delete(G.ministry[FRANCE], index)
		array_delete(G.ministry_revealed[FRANCE], index)

		// We just deleted a ministry from the array, and exhausted is infelicitously tracked by the ministry's "relative position in the current ministries" as opposed to its real ministry id, so
		// we have to copy all the crud down a notch.
		for (let idx = index; idx < len - 1; idx++) {
			for (let abil = 0; abil < 2; abil++) {
				if (set_has(G.ministry_exhausted[FRANCE], (idx + 1) + (abil * ((G.game_state_created_with < 2) ? OLD_NUM_MINISTRY_CARDS : NUM_MINISTRY_CARDS)))) {
					set_add(G.ministry_exhausted[FRANCE], idx + (abil * ((G.game_state_created_with < 2) ? OLD_NUM_MINISTRY_CARDS : NUM_MINISTRY_CARDS)))
				} else {
					set_delete(G.ministry_exhausted[FRANCE], idx + (abil * ((G.game_state_created_with < 2) ? OLD_NUM_MINISTRY_CARDS : NUM_MINISTRY_CARDS)))
				}
			}
		}
	}
	log (bold(say_ministry(JACOBITE_UPRISINGS) + " ministry removed from the game."))
}


function start_war_theater_resolution()
{
	delete G.first_war_player

	L.war_winner          = theater_winner(G.theater)
	L.war_delta           = theater_delta(G.theater)
	L.war_tier            = theater_tier(G.theater)
	L.free_squadrons      = []
	L.picking_squadron    = false
	L.confirming_conquest = false
	L.checking_refusal    = false
	L.war_space           = -1
	let header = G.theater + ". " + data.wars[G.next_war].theater_names[G.theater] + "\n"
	if (L.war_winner === NONE) {
		header += "TIE!"
		G.won_all_theaters_by_maximum_level = NONE
	} else {
		header += data.flags[L.war_winner].name + " +" + L.war_delta
	}
	log_box_begin(L.war_winner, header)

	G.war_winner[G.theater] = L.war_winner

	G.old_winners[G.next_war][G.theater] = L.war_winner
	G.old_margins[G.next_war][G.theater] = L.war_delta

	if (L.war_tier === data.wars[G.next_war].theater[G.theater].margin.length - 1) {
		if ((G.won_all_theaters_by_maximum_level === -1) || (G.won_all_theaters_by_maximum_level === L.war_winner)) {
			G.won_all_theaters_by_maximum_level = L.war_winner
		} else {
			G.won_all_theaters_by_maximum_level = NONE
		}
	} else {
		G.won_all_theaters_by_maximum_level = NONE
	}

	if (L.war_winner === NONE) {
		L.result_string = "Theater tied; no winner or spoils."
	} else {
		L.result_string = "+" + L.war_delta + " " + data.flags[L.war_winner].adj + " victory!"

		L.war_vp = data.wars[G.next_war].theater[G.theater].vp[L.war_tier]
		L.war_cp = data.wars[G.next_war].theater[G.theater].cp[L.war_tier]
		L.war_unflag = data.wars[G.next_war].theater[G.theater].unflag[L.war_tier]
		L.war_trp = data.wars[G.next_war].theater[G.theater].trp[L.war_tier]
		L.war_usa = false
		L.war_canada = false
		L.war_atlantic = false
		L.war_squadrons = 0
		L.war_squadrons_original = 0
		L.doing_squadrons = false
		L.opponent_confirm = false

		L.war_cp_start = L.war_cp

		if (L.war_winner === FRANCE) {
			if (data.wars[G.next_war].theater[G.theater].france_vp) {
				L.war_vp = data.wars[G.next_war].theater[G.theater].france_vp[L.war_tier]
			}

			if (data.wars[G.next_war].theater[G.theater].france_trp) {
				L.war_trp = data.wars[G.next_war].theater[G.theater].france_trp[L.war_tier]
			}

			if ((G.next_war === WAR_AWI) && (G.theater === 1)) {
				L.war_cp = 0
				L.war_usa = true
				if (L.war_tier === 2) L.war_canada = true
			}

			if ((G.next_war === WAR_WSS) && (G.theater === 4) && (L.war_tier > 0)) {
				log(bold("Jacobite Victory marker added."))
				G.jacobite_victory++
				set_bit(JACOBITE_VICTORY_WSS)
			}

			if ((G.next_war === WAR_WAS) && (G.theater === 4)) {
				log(bold("Jacobite Victory marker added. France may always select " + say_ministry(JACOBITE_UPRISINGS) + " as an extra ministry for rest of game."))
				G.jacobite_victory++
				set_bit(JACOBITES_ALWAYS)
				set_bit(JACOBITE_VICTORY_WAS)
			}
		} else if (L.war_winner === BRITAIN) {
			if ((G.next_war === WAR_WAS) && (G.theater === 4) && (L.war_tier > 0)) {
				log(bold("Jacobite Defeat marker added."))
				set_bit(JACOBITE_DEFEAT)
				remove_jacobites()
			}
		}

		if (L.war_vp > 0) award_vp(L.war_winner, L.war_vp)
		if (L.war_trp > 0) add_treaty_points(1 - L.war_winner, L.war_trp)

		if (L.war_cp || L.war_unflag) {
			let msg = data.flags[L.war_winner].name
			if (L.war_cp) {
				msg += " has gained " + L.war_cp + " conquest point" + s(L.war_cp)
			}
			if (L.war_unflag) {
				if (L.war_cp) msg += " and"
				msg += " may unflag one "
				if (data.wars[G.next_war].theater[G.theater].region === REGION_EUROPE) {
					msg += " political space"
				} else {
					msg += " market"
				}
			}
			log(msg)
		}

		if (L.war_canada) {
			log("France may form USA, including in Canada!")
		} else if (L.war_usa) {
			log("France may form USA!")
		}

		if ((G.next_war === WAR_7YW) && (G.theater === 1)) {
			if (L.war_tier >= 0) L.war_atlantic = true
			if (L.war_tier > 0) L.war_squadrons = L.war_tier
		}

		if ((G.next_war === WAR_AWI) && (G.theater === 3)) {
			L.war_squadrons = Math.min(2, L.war_delta)
		}

		L.war_squadrons_original = L.war_squadrons

		if (L.war_cp) {
			L.free_squadrons = []
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== data.wars[G.next_war].theater[G.theater].region) {
					if ((G.next_war === WAR_7YW) && (G.theater === 3)) {
						if (data.spaces[s].region !== REGION_CARIBBEAN) continue
					} else {
						continue
					}
				}
				if (data.spaces[s].type !== NAVAL) continue
				if (G.flags[s] !== L.war_winner) continue
				if (set_has(G.navy_this_war, s)) continue /* A given Squadron can capture one space per war */
				L.free_squadrons.push(s)
			}
		}
	}
}


function conquer_from_navy_box()
{
	log(data.flags[L.war_winner].name + " spent 1 conquest point.")
	L.war_cp--
	L.picking_squadron = false
	set_bit(NAVY_FROM_NAVY_BOX)
	G.navy_from = -1
	G.navy_to   = L.war_space
	set_bit(NAVY_DISPLACE, G.flags[L.war_space] !== NONE)
	execute_naval_move()
}


function conquer_from_space(s)
{
	log(data.flags[L.war_winner].name + " spent 1 conquest point.")
	L.war_cp--
	L.picking_squadron = false
	clear_bit(NAVY_FROM_NAVY_BOX)
	G.navy_from = s
	G.navy_to   = L.war_space
	set_bit(NAVY_DISPLACE, (G.flags[L.war_space] !== NONE))
	execute_naval_move()
}


P.war_theater_resolve = {
	_begin() {
		start_war_theater_resolution()
		if (L.war_squadrons > 0) {
			L.doing_squadrons = true
			G.active = 1 - L.war_winner
			if (G.dirty_who !== G.active) {
				clear_dirty()
				G.dirty_who = G.active
			}
			log_br()
		} else if ((L.war_winner !== NONE) && (L.war_cp || L.war_unflag || L.war_usa || L.war_atlantic)) {
			G.active = L.war_winner
			if (G.dirty_who !== G.active) {
				clear_dirty()
				G.dirty_who = G.active
			}
			log_br()
		} else {
			log_box_end()
			G.active = [ FRANCE, BRITAIN ]
		}
	},
	inactive() {
		if (L.doing_squadrons) {
			return "remove squadrons"
		} else if (Array.isArray(G.active) || L.opponent_confirm) {
			return "review final theater results"
		} else if (L.checking_refusal) {
			return "tell the king the bad news"
		} else if (L.confirming_conquest) {
			return "confirm conquest of a territory"
		} else if (L.picking_squadron) {
			return "select a squadron to take a naval space"
		} else if (L.war_cp > 0) {
			return "spend conquest point" + s(L.war_cp_start) + " " + parens( (L.war_cp_start - L.war_cp) +  " / " + L.war_cp_start)
		} else if (L.war_unflag) {
			return "unflag a space"
		} else if (L.war_usa) {
			return "place USA flags"
		} else if (L.war_atlantic) {
			return "place the Atlantic Dominance marker"
		} else {
			return "confirm theater spoils"
		}
	},
	prompt() {
		let msg = say_action_header(data.wars[G.next_war].theater_names[G.theater].toUpperCase() + ": ")

		if (L.doing_squadrons) {
			msg += say_action("You must remove " + L.war_squadrons_original + " squadron" + s(L.war_squadrons_original))
			msg += say_action((current_era() === REVOLUTION_ERA) ? " from the game. " : " from map or Navy Box to unbuilt. ")

			let any_left = false
			if (L.war_squadrons) {
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].type !== NAVAL) continue
					if (G.flags[s] !== G.active) continue
					action_space(s)
					any_left = true
				}
				if (G.navy_box[G.active] > 0) {
					any_left = true
					action_navy_box()
				}
			}

			if (any_left || !L.war_squadrons) {
				msg += say_action(parens((L.war_squadrons_original - L.war_squadrons) + "/" + L.war_squadrons_original))
			} else {
				msg += "(Done)"
			}

			if (!L.war_squadrons || !any_left) button ("done")

		} else if (Array.isArray(G.active) || L.opponent_confirm) {
			msg += say_action(L.result_string)
			if (L.opponent_confirm) {
				msg += say_action(" Opponent has claimed all spoils.")
			}
			msg += say_action(" Done.")
			button("done")
		} else if (L.checking_refusal) {
			let vp_cost = G.war_refused[1 - L.war_winner] ? 5 : 3
			msg = say_action(data.flags[L.war_winner].name + " proposes to conquer " + data.spaces[L.war_space].name + ". Refuse by paying " + vp_cost + " Victory Points? (Current VP: " + G.vp + ")")
			button("refuse")
			button("accept")
		} else if (L.confirming_conquest) {
			let cost = conquest_point_cost(L.war_space)
			msg += say_action("Confirm spending " + cost + " conquest point" + s(cost) + " to take control of " + data.spaces[L.war_space].name + "?")
			if ((G.flags[L.war_space] === 1 - R) && (G.war_refused[1 - R] < 2)) {
				msg += say_action(" (CANNOT BE UNDONE)")
			}
			button("confirm")
		} else if (L.picking_squadron) {
			msg += say_action('Select squadron from region or Navy Box to perform conquest.')
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].type !== NAVAL) continue
				if (G.flags[s] !== L.war_winner) continue
				if (set_has(G.dirty, s)) continue // Can't use the same ship twice
				if (data.spaces[s].region !== data.wars[G.next_war].theater[G.theater].region) {
					if ((G.next_war === WAR_7YW) && (G.theater === 3)) {
						if (data.spaces[s].region !== REGION_CARIBBEAN) continue
					} else {
						continue
					}
				}
				action_space(s)
			}
			if (G.navy_box[L.war_winner] > 0) {
				action_navy_box()
			}
		} else if (L.war_cp > 0) {
			msg += say_action(L.result_string) + say_action(" Spend conquest point" + s(L.war_cp_start) + " " + parens( (L.war_cp_start - L.war_cp) +  " / " + L.war_cp_start) + ".")

			let any = false
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== data.wars[G.next_war].theater[G.theater].region) {
					if ((G.next_war === WAR_7YW) && (G.theater === 3)) {
						if (data.spaces[s].region !== REGION_CARIBBEAN) continue
					} else {
						continue
					}
				}
				if ((data.spaces[s].type === FORT) || (data.spaces[s].type === MARKET)) {
					if (G.flags[s] === L.war_winner) continue

					//TODO if using "tougher forts" optional rule, you have to use a conquest line

					action_space(s)
					any = true
				}

				if (data.spaces[s].type === NAVAL) {
					if (G.flags[s] === L.war_winner) continue
					if ((G.navy_box[L.war_winner] <= 0) && (L.free_squadrons.length < 1)) continue
					action_space(s)
					any = true
				}

				if (data.spaces[s].type === TERRITORY) {
					if (G.flags[s] === L.war_winner) continue
					if (G.flags[s] === USA) continue             // Can come up during Antilles war
					if (G.war_refused_list.includes(s)) continue // If opponent has already paid VP to refuse this space, don't include it in the options
					if (data.spaces[s].conquest) {               // If there are conquest lines to the territory, must control something at the other end of one in order to take this territory
						let connected = false
						for (const s2 of data.spaces[s].conquest) {
							if (G.flags[s2] !== L.war_winner) continue
							connected = true
							break
						}
						if (!connected) continue
					}

					if (conquest_point_cost(s) > L.war_cp) continue // If too expensive because of Huguenots

					action_space(s)
					any = true
				}
			}

			for (const s of data.wars[G.next_war].theater[G.theater].additional) {
				if (G.flags[s] === L.war_winner) continue
				if (G.war_refused_list.includes(s)) continue // If opponent has already paid VP to refuse this space, don't include it in the options
				if (data.spaces[s].conquest) {               // If there are conquest lines to the territory, must control something at the other end of one in order to take this territory
					let connected = false
					for (const s2 of data.spaces[s].conquest) {
						if (G.flags[s2] !== L.war_winner) continue
						connected = true
						break
					}
					if (!connected) continue
				}
				if (conquest_point_cost(s) > L.war_cp) continue // If too expensive because of Huguenots

				action_space(s)
				any = true
			}

			if (!any) {
				msg += " (p)"
				button("done")
			}
		} else if (L.war_unflag) {
			if (data.wars[G.next_war].theater[G.theater].region === REGION_EUROPE) {
				msg += say_action("Unflag a political space in Europe.")

				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].region !== REGION_EUROPE) continue
					if (data.spaces[s].type !== POLITICAL) continue
					if (G.flags[s] !== 1 - R) continue
					action_space(s)
					any = true
				}

				if (!any) {
					msg += say_action(" (None possible)")
					button("done")
				}
			} else {
				msg += say_action("Unflag a market in " + data.regions[data.wars[G.next_war].theater[G.theater].region].name + ".")

				let any = false
				for (let s = 0; s < NUM_SPACES; s++) {
					if (data.spaces[s].region !== data.wars[G.next_war].theater[G.theater].region) continue
					if (data.spaces[s].type !== MARKET) continue
					if (G.flags[s] !== 1 - R) continue
					action_space(s)
					any = true
				}

				if (!any) {
					msg += say_action(" (None possible)")
					button("done")
				}
			}
		} else if (L.war_usa) {
			msg += say_action("You may place USA flags in territories and unflag forts.")
			let any = false
			let any_territory = false
			for (const s of [ NORTHERN_COLONIES, CAROLINAS, SAN_AGUSTIN, QUEBEC_AND_MONTREAL ]) {
				if (G.flags[s] === USA) continue
				if ((s === QUEBEC_AND_MONTREAL) && !L.war_canada) continue
				action_space(s)
				any = true
				any_territory = true
			}
			for (let s = 0; s < NUM_SPACES; s++) {
				if (data.spaces[s].region !== REGION_NORTH_AMERICA) continue
				if (data.spaces[s].subreg !== SUBREGION_NORTHERN_COL) continue
				if (data.spaces[s].type !== FORT) continue
				if (G.flags[s] === NONE) continue
				action_space(s)
				any = true
			}
			if (!any) {
				button("done")
			} else if (any_territory) {
				button("confirm_pass_usa")
			} else {
				button("confirm_pass_usa_forts")
			}
		} else if (L.war_atlantic) {
			msg += say_action("Place Atlantic Dominance marker in the French & Indian War theater box.")
			action_theater(3)
		} else {
			msg += say_action("Done.")
			button("done")
		}

		V.prompt = msg
	},
	space(s) {
		push_undo()
		if (L.doing_squadrons) {
			L.war_squadrons--
			reflag_space(s, NONE, true)
			if (current_era() === REVOLUTION_ERA) {
				log (data.flags[G.active].name + " removed the squadron at " + say_space(s) + " from the game.")
				move_squadron_token(G.active, s, SPACE_REMOVED_FROM_GAME)
			} else {
				G.unbuilt_squadrons[G.active]++
				log (data.flags[G.active].name + " removed a squadron from " + say_space(s) + " to Unbuilt.")
				move_squadron_token(G.active, s, SPACE_UNBUILT)
			}
			log_br()
			validate_squadrons("WAR EFFECT")
		} else if (L.picking_squadron) {
			conquer_from_space(s)
			log_br()
			let index = L.free_squadrons.indexOf(s)
			if (index !== -1) {
				L.free_squadrons.splice(index, 1)
			}
		} else if (L.war_cp > 0) {
			L.war_space = s
			if ((data.spaces[s].type === FORT) || (data.spaces[s].type === MARKET)) {
				log(data.flags[L.war_winner].name + " spent 1 conquest point.")
				L.war_cp--
				reflag_space(s, L.war_winner)
			} else if (data.spaces[s].type === NAVAL) {
				if (L.free_squadrons.length && ((G.navy_box[R] > 0) || (L.free_squadrons.length > 1))) {
					L.picking_squadron = true
				} else if (G.navy_box[R] > 0) {
					conquer_from_navy_box()
					log_br()
				} else if (L.free_squadrons.length === 1) {
					conquer_from_space(L.free_squadrons[0])
					log_br()
					L.free_squadrons.shift()
				}
			} else if (data.spaces[s].type === TERRITORY) {
				mark_dirty(s)
				L.confirming_conquest = true
			}
		} else if (L.war_unflag > 0) {
			L.war_unflag--
			reflag_space(s, NONE)
			log_br()
		} else if (L.war_usa) {
			L.already_isolated = []
			for (let s2 = 0; s2 < NUM_SPACES; s2++) {
				if (data.spaces[s2].type !== MARKET) continue
				if ((data.spaces[s2].region !== REGION_CARIBBEAN) && (data.spaces[s2].region !== REGION_NORTH_AMERICA)) continue
				if (check_if_market_isolated(s2)) {
					L.already_isolated.push(s2)
				}
			}

			if (data.spaces[s].type === FORT) {
				reflag_space(s, NONE)
			} else if (data.spaces[s].type === TERRITORY) {
				reflag_space(s, USA)
			}

			// Unflag markets that became isolated as a result of this change (7.3)
			for (let s2 = 0; s2 < NUM_SPACES; s2++) {
				if (data.spaces[s2].type !== MARKET) continue
				if ((data.spaces[s2].region !== REGION_CARIBBEAN) && (data.spaces[s2].region !== REGION_NORTH_AMERICA)) continue
				if (!check_if_market_isolated(s2)) continue
				if (L.already_isolated.includes(s2)) continue
				reflag_space(s2, NONE)
			}

			log_br()
		}
	},
	navy_box() {
		push_undo()
		if (L.doing_squadrons) {
			L.war_squadrons--
			G.navy_box[G.active]--
			if (current_era() === REVOLUTION_ERA) {
				log (data.flags[G.active].name + " removed a squadron in the Navy Box from the game.")
				move_squadron_token(G.active, SPACE_NAVY_BOX, SPACE_REMOVED_FROM_GAME)
			} else {
				G.unbuilt_squadrons[G.active]++
				move_squadron_token(G.active, SPACE_NAVY_BOX, SPACE_UNBUILT)
				log (data.flags[G.active].name + " removed a squadron from the Navy Box to Unbuilt.")
			}
			log_br()
			validate_squadrons("WAR EFFECT NAVY BOX")
		} else {
			conquer_from_navy_box()
			log_br()
		}
	},
	theater(_t) {
		push_undo()
		// t = display_to_theater(t) // Unused but too scary to leave out in case of future changes
		L.war_atlantic = false
		G.theater_bonus[L.war_winner][3].push(ATLANTIC_DOMINANCE + L.war_winner)
		log (bold(data.flags[L.war_winner].name + " placed Atlantic Dominance marker in theater 3: French & Indian War."))
		log_br()
	},
	confirm() {
		push_undo()
		mark_dirty(L.war_space)
		L.confirming_conquest = false
		let cost = conquest_point_cost(L.war_space)
		log(data.flags[L.war_winner].name + " spent " + cost + " conquest point" + s(cost) + " at " + say_space(L.war_space) + ".")
		L.war_cp -= cost

		if ((G.flags[L.war_space] === NONE) || (G.war_refused[1 - L.war_winner] >= 2)) {
			reflag_space(L.war_space, L.war_winner)
			log_br()
		} else {
			L.checking_refusal = true
			G.active = 1 - G.active
		}
	},
	refuse() {
		let vp_cost = G.war_refused[1 - L.war_winner] ? 5 : 3
		log(bold(data.flags[1 - L.war_winner].name + " refused conquest of " + data.spaces[L.war_space].name) + "!")
		award_vp(1 - L.war_winner, -vp_cost) // Construe it as paying/losing VP by the war loser
		log_br()
		G.war_refused[1 - L.war_winner]++
		G.war_refused_list.push(L.war_space) // Put it on the list of refused spaces -- conquest can't be attempted again during this war
		L.checking_refusal = false
		G.active = 1 - G.active
	},
	accept() {
		log(bold(data.flags[1 - L.war_winner].name + " accepted conquest of " + data.spaces[L.war_space].name) + ".")
		reflag_space(L.war_space, L.war_winner)
		log_br()
		L.checking_refusal = false
		G.active = 1 - G.active
	},
	done() {
		push_undo()
		if (L.doing_squadrons) {
			L.doing_squadrons = false
			if (L.war_squadrons > 0) {
				log(italic("No more squadrons left to remove."))
			}
			L.war_squadrons = 0
			G.active = L.war_winner
			if (G.dirty_who !== G.active) {
				clear_dirty()
				G.dirty_who = G.active
			}
		} else if (L.opponent_confirm) {
			L.opponent_confirm = false
			end()
		} else if (Array.isArray(G.active)) {
			set_delete(G.active, R)
			if (G.active.length === 0) {
				end()
			}
		} else {
			if (L.war_cp > 0) {
				log(L.war_cp + " conquest point" + s(L.war_cp) + " left unspent.")
				L.war_cp = 0
			} else if (L.war_unflag) {
				L.war_unflag = 0
			} else if (L.war_usa) {
				L.war_usa = false
			} else {
				log_box_end()
				L.opponent_confirm = true
				G.active = 1 - R
			}
		}
	},
	confirm_pass_usa() {
		this.done()
	},
	confirm_pass_usa_forts() {
		this.done()
	},
}

/* 7.1 - WAR RESOLUTION PHASE */

P.war_resolution_phase = script(`
	eval {
		log ("#" + data.wars[G.next_war].name + "\\n" + data.turns[G.turn].dates)
		log ("=War Resolution Phase")
		clear_dirty()
		clear_navy_this_war()
		G.won_all_theaters_by_maximum_level = -1
		G.war_refused = [0, 0]
		G.war_refused_list = []
	}
	for G.theater in 1 to (data.wars[G.next_war].theaters) {
		call war_theater_reveal
		call war_theater_resolve
	}
`)


/* 7.4 - WAR RESOLUTION PHASE */

P.war_victory_check_phase = function() {
	log ("=War Victory Check Phase")

	if ((G.won_all_theaters_by_maximum_level !== NONE) && (G.won_all_theaters_by_maximum_level >= 0)) {
		let msg = bold(data.flags[G.won_all_theaters_by_maximum_level].name + " wins the game by winning all theaters with the maximum possible spoils of war!")
		finish (G.won_all_theaters_by_maximum_level, msg)
	} else {
		delete G.won_all_theaters_by_maximum_level
		delete G.war_refused
		delete G.war_refused_list
		if (G.vp <= 0) {
			let msg = bold("Britain wins the game: VP 0 or fewer!")
			finish(BRITAIN, msg)
		} else if (G.vp >= 30) {
			let msg = bold("France wins the game: VP 30 or greater!")
			finish(FRANCE, msg)
		} else {
			log ("No automatic victory.")
			end()
		}
	}
}


/* 7.5 - WAR RESET PHASE */

P.war_reset_phase = function () {
	log ("=War Reset Phase")
	log ("Bonus war tiles from concluded war removed.") // I actually do it in the next step, for efficiency

	G.byng = 0

	// Remove any conflicts that granted strength in this war
	let conflicts_removed = []
	for (let s = 0; s < NUM_SPACES; s++) {
		if (!has_conflict_marker(s)) continue

		for (let theater = 1; theater <= data.wars[G.next_war].theaters; theater++) {
			if (!data.wars[G.next_war].theater[theater].conflicts) continue
			let r = data.spaces[s].region
			if ((r === data.wars[G.next_war].theater[theater].region) || ((G.next_war === WAR_7YW) && (theater === 3) && (r === REGION_CARIBBEAN))) {
				if ((G.flags[s] !== FRANCE) && (G.flags[s] !== BRITAIN)) continue // Don't remove conflicts on neutral spaces (they didn't grant anybody strength). On off chance we ever support e.g. SPAIN, those don't count either.
				conflicts_removed.push(s)
				remove_conflict_marker(s, true)
			}
		}
	}
	if (conflicts_removed.length > 0) {
		let msg = "Conflict" + s(conflicts_removed.length) + " removed at "
		let any = false
		for (const s of conflicts_removed) {
			if (any) msg += ", "
			msg += say_space(s)
			any = true
		}
		msg += "."
		log(msg)
	}
	end()
}


function war_layout_reshuffle_basic_war_tiles(new_game) {
	if (new_game) {
		// For a new game we shuffle all the war tiles together
		G.basic_war = [[], []]
		for (var i = 0; i < NUM_BASE_WAR_TILES; i++) {
			G.basic_war[FRANCE].push(i)
			G.basic_war[BRITAIN].push(i + NUM_BASE_WAR_TILES)
		}
	} else {
		// When moving to next war, we return the basic tiles left from the last war to the stock. We *don't* remake the stock from scratch because player may have removed some from the game with military upgrades.
		for (let who = FRANCE; who <= BRITAIN; who++) {
			for (let theater = 0; theater <= data.wars[G.next_war].theaters; theater++) { //NB 0 through <= theaters inclusive is intentional
				for (const t of G.theater_basic[who][theater]) {
					G.basic_war[who].push(t)
				}
			}
		}
	}
	shuffle(G.basic_war[FRANCE])
	shuffle(G.basic_war[BRITAIN])

	// Turn them all back face down
	G.bonus_revealed = [ [], [] ]
	G.basic_revealed = [ [], [] ]

	// None in any theaters
	G.theater_basic = [[[], [], [], [], []], [[], [], [], [], []]]
}


/* 7.6 - War layout - each side gets one basic war tile per theater to start out */
function war_layout_basic_war_tiles()
{
	for (var who = FRANCE; who <= BRITAIN; who++) {
		for (var theater = 1; theater <= data.wars[G.next_war].theaters; theater++) {
			draw_basic_war_tile(who, rules_military_planning() ? 0 : theater)
		}
	}
}

/* 7.6 - WAR LAYOUT PHASE */

P.war_layout_phase = function () {

	let current_war_bonus_tiles = [ 0, 0 ]
	for (var who = FRANCE; who <= BRITAIN; who++) {
		for (var theater = 1; theater <= data.wars[G.next_war].theaters; theater++) {
			current_war_bonus_tiles[who] += G.theater_bonus[who][theater].length
			G.theater_bonus[who][theater] = [] // We just delete the old bonus war tiles, because we're getting a whole new set for the next war
		}
	}

	G.next_war++ // Here's where we officially move to the next war mat

	G.war_winner = [ -1, -1, -1, -1, -1 ]

	log ("=War Layout Phase")
	war_layout_reshuffle_basic_war_tiles(false)
	add_next_war_bonus_tiles()
	war_layout_basic_war_tiles()
	log (data.wars[G.next_war].name + " mat and Bonus War Tiles added.")

	if (G.next_war === WAR_7YW) {
		for (who = FRANCE; who <= BRITAIN; who++) {
			let amount = Math.min(current_war_bonus_tiles[who], 3)
			if (amount > 0) {
				log("Austrian Succession Special: " + data.flags[who].name + " received " + amount + " bonus war tiles for Seven Years War.")
				for (var i = 0; i < amount; i++) {
					draw_bonus_war_tile(who, 0)
				}
			}
		}
	}

	end()
}


function action_event_card(c) {
	action("event_card", c)
}

function action_ministry_card(c) {
	action("ministry_card", c)
}

function action_investment(i) {
	action("investment", i)
}

function action_advantage(a) {
	action("advantage", a)
}


const INCLUDE_CONFLICT = 0x01
const INCLUDE_DAMAGED = 0x02

function action_space(s, include = 0) {
	action("space", s)
	if ((include & INCLUDE_CONFLICT) && has_conflict_marker(s)) action_conflict(s)
	if ((include & INCLUDE_DAMAGED) && is_damaged_fort(s)) action_damaged(s)
}

function action_conflict(s) {
	action("conflict", s)
}

function action_damaged(s) {
	action("damaged", s)
}

function action_navy_box()
{
	action("navy_box", 0)
}


function theater_to_display(t)
{
	return t + (G.next_war - 1) * 4
}

function display_to_theater(t)
{
	return t - (G.next_war - 1) * 4
}

function action_theater(t)
{
	action("theater", theater_to_display(t))
}

function action_all_eligible_theaters() {
	for (let t = 1; t <= data.wars[G.next_war].theaters; t++) { //NB 1 to theaters, inclusive
		if (is_bit(MUST_PLACE_IN_NORTH_AMERICA)) {
			if (data.wars[G.next_war].theater[t].region !== REGION_NORTH_AMERICA) continue
		}
		action_theater(t)
	}
}

function action_basic_war_tile(t) {
	action("basic_war", t)
}

function action_bonus_war_tile(t) {
	action("bonus_war", t)
}


function action_demand(d) {
	action("demand", d)
}


function debug_log(s) {
	console.log(s)
	log(s)
}


/* FRAMEWORK */

function log(s) {
	if (s === undefined) {
		if (G.log.length > 0 && G.log[G.log.length - 1] !== "")
			G.log.push("")
	} else {
		G.log.push(s)
	}
}


const LOG_BOX_MINISTRY  = 1
const LOG_BOX_EVENT     = 2
const LOG_BOX_ADVANTAGE = 3
const LOG_BOX_MISC      = 4 // Used in other situations -- scoring, wars, etc.

function log_box_begin(who, header, type = LOG_BOX_MISC) {
	log_br()
	if (!G.log_box) {
		G.log_box = []
	}
	if (who > BRITAIN) who = 2 // Turns e.g. NONE into "both"
	G.log_box.push({ "type": type, "who": who })
	log("{" + who + type + header)
}


function log_box_ministry(who, m) {
	if (is_log_box(LOG_BOX_MINISTRY)) return
	log_box_begin(who, "MINISTRY" + "\n" + say_ministry(m, who, true), LOG_BOX_MINISTRY)
}


function is_log_box(type = 0)
{
	if (type === 0) return !!G.log_box
	if (!G.log_box) return false
	for (const box of G.log_box) {
		if (box.type === type) return true
	}
	return false
}

function log_box_end(type = 0) {
	if (!G.log_box) return
	if ((type !== 0) && (G.log_box.slice(-1)[0].type !== type)) return // If we were asked to *only* cancel log box if we're currently inside a particular type
	log ("}")
	G.log_box.pop()
	if (G.log_box.length <= 0) G.log_box = null // Null is falsey
}


function button(action, enabled = true) {
	V.actions[action] = !!enabled | 0
}

function action(action, argument) {
	if (!(action in V.actions))
		V.actions[action] = []
	set_add(V.actions[action], argument)
}

function finish(result, message) {
	G.active = -1
	G.result = ROLES[result] ?? result
	G.L = L = { message }
	log(message)
}

function call(name, env) {
	G.L = L = { ...env, P: name, I: 0, L: L }
	P[name]?._begin?.()
}

function goto(name, env) {
	P[L.P]?._end?.()
	G.L = L = { ...env, P: name, I: 0, L: L.L }
	P[name]?._begin?.()
}

function end(result) {
	P[L.P]?._end?.()
	G.L = L = L.L
	if (result !== undefined)
		L.$ = result
	P[L.P]?._resume?.()
}

exports.roles ??= ROLES

exports.scenarios ??= (typeof SCENARIOS !== "undefined") ? SCENARIOS : [ "Standard" ]

exports.setup = function (seed, scenario, options) {
	G = {
		active: null,
		seed,
		log: [],
		undo: [],
	}
	L = null
	R = null
	V = null

	on_setup(scenario, options)
	_run()
	_save()

	return G
}

exports.view = function (state, role) {
	G = state
	L = G.L
	R = role
	V = {
		log: G.log,
		prompt: null,
	}

	if ((Array.isArray(G.active) && G.active.includes(R)) || G.active === R) {
		_load()
		on_view()

		V.actions = {}

		if (P[L.P])
			P[L.P].prompt()
		else
			V.prompt = "TODO: " + L.P

		if (V.actions.undo === undefined)
			button("undo", G.undo?.length > 0)

		_save()
	} else {
		_load()
		on_view()
		_save()

		if (G.active === "None") {
			V.prompt = L.message
		} else {
			var inactive = P[L.P]?.inactive
			if (inactive) {
				if (typeof inactive === "function") { //BR// Now supports functions because some of my states are complex
					if (Array.isArray(G.active))
						V.prompt = `Waiting for ${G.active.join(" and ")} to ${inactive()}.`
					else
						V.prompt = `Waiting for ${G.active} to ${inactive()}.`
				} else {
					if (Array.isArray(G.active))
						V.prompt = `Waiting for ${G.active.join(" and ")} to ${inactive}.`
					else
						V.prompt = `Waiting for ${G.active} to ${inactive}.`
				}
			} else {
				if (Array.isArray(G.active))
					V.prompt = `Waiting for ${G.active.join(" and ")}.`
				else
					if (L.bidding_for_sides) {
						V.prompt = `Waiting for opponent.`
					} else {
						V.prompt = `Waiting for ${G.active}.`
					}
			}
		}
	}

	return V
}

function flagify(who) {
	for (let s = 0; s < NUM_SPACES; s++) {
		G.flags[s] = who
	}
	update_flag_counts()
	update_advantages(true)
}


exports.action = function (state, role, action, argument) {
	G = state
	L = G.L
	R = role
	V = null

	var old_active = G.active

	_load()

	G.UNDID = FALSE

	var this_state = P[L.P]
	if (this_state && typeof this_state[action] === "function") {
		this_state[action](argument)
		_run()
	} else if (action === "undo" && G.undo.length > 0) {
		pop_undo()
	} else {
		throw new Error("Invalid action: " + action)
	}

	_save()

	if (old_active !== G.active)
		clear_undo()

	if (Array.isArray(G.active) && G.active.length === 0) throw new Error("Nobody is active - who's been naughty?")

	return G
}

exports.finish = function (state, result, message) {
	G = state
	L = G.L
	R = null
	V = null

	_load()
	finish(result, message)
	_save()

	return G
}

function _load() {
	R = ROLES.indexOf(R)
	if (Array.isArray(G.active))
		G.active = G.active.map(r => ROLES.indexOf(r))
	else
		G.active = ROLES.indexOf(G.active)

	on_load()
}

function _save() {
	if (Array.isArray(G.active))
		G.active = G.active.map(r => ROLES[r])
	else
		G.active = ROLES[G.active] ?? "None"

	on_save()
}

function _run() {
	for (var i = 0; i < 1000 && L; ++i) {
		var prog = P[L.P]
		if (typeof prog === "function") {
			prog()
		} else if (Array.isArray(prog)) {
			if (L.I < prog.length) {
				try {
					prog[L.I++]()
				} catch (err) {
					err.message += "\n\tat P." + L.P + ":" + L.I
					throw err
				}
			} else {
				end()
			}
		} else {
			return // state
		}
	}
	if (L)
		throw new Error("runaway script")
}

function _parse(text) {
	var prog = []

	function lex(s) {
		var words = []
		var p = 0, n = s.length, m

		function lex_flush() {
			if (words.length > 0) {
				command(words)
				words = []
			}
		}

		function lex_newline() {
			while (p < n && s[p] === "\n")
				++p
			lex_flush()
		}

		function lex_semi() {
			++p
			lex_flush()
		}

		function lex_comment() {
			while (p < n && s[p] !== "\n")
				++p
		}

		function lex_word() {
			while (p < n && !" \t\n".includes(s[p]))
				++p
			words.push(s.substring(m, p))
		}

		function lex_qstring(q) {
			var x = 1
			++p
			while (p < n && x > 0) {
				if (s[p] === q)
					--x
				++p
			}
			if (p >= n && x > 0)
				throw new Error("unterminated quote string " + q)
			words.push(s.substring(m, p))
		}

		function lex_bstring(a, b) {
			var x = 1
			++p
			while (p < n && x > 0) {
				if (s[p] === a)
					++x
				else if (s[p] === b)
					--x
				++p
			}
			if (p >= n && x > 0)
				throw new Error("unterminated bracket string " + a + b)
			words.push(s.substring(m, p))
		}

		while (p < n) {
			while (s[p] === " " || s[p] === "\t")
				++p
			if (p >= n) break
			m = p
			if (s[p] === "{") lex_bstring("{", "}")
			else if (s[p] === "[") lex_bstring("[", "]")
			else if (s[p] === "(") lex_bstring("(", ")")
			else if (s[p] === '"') lex_qstring('"')
			else if (s[p] === "\n") lex_newline()
			else if (s[p] === ";") lex_semi()
			else if (s[p] === "#") lex_comment()
			else if (s[p] === "/" && s[p+1] === "/") lex_comment()
			else if (s[p] === "-" && s[p+1] === "-") lex_comment()
			else lex_word()
		}

		if (words.length > 0)
			command(words)
	}

	function command(line) {
		var ix_loop, ix1, ix2
		var i, k, start, end, array, body

		switch (line[0]) {
		case "set":
			if (line.length !== 3)
				throw new Error("invalid set - " + line.join(" "))
			emit(line[1] + " = " + line[2])
			break

		case "incr":
			if (line.length !== 2)
				throw new Error("invalid incr - " + line.join(" "))
			emit("++(" + line[1] + ")")
			break

		case "decr":
			if (line.length !== 2)
				throw new Error("invalid decr - " + line.join(" "))
			emit("--(" + line[1] + ")")
			break

		case "eval":
			emit(line.slice(1).join(" "))
			break

		case "log":
			emit("log(" + line.slice(1).join(" ") + ")")
			break

		case "call":
			if (line.length === 3)
				emit("call(" + quote(line[1]) + ", " + line[2] + ")")
			else if (line.length === 2)
				emit("call(" + quote(line[1]) + ")")
			else
				throw new Error("invalid call - " + line.join(" "))
			break

		case "goto":
			if (line.length === 3)
				emit("goto(" + quote(line[1]) + ", " + line[2] + ")")
			else if (line.length === 2)
				emit("goto(" + quote(line[1]) + ")")
			else
				throw new Error("invalid goto - " + line.join(" "))
			break

		case "return":
			if (line.length === 1)
				emit(`end()`)
			else if (line.length === 2)
				emit(`end(${line[1]})`)
			else
				throw new Error("invalid return - " + line.join(" "))
			break

		case "while":
			// while (exp) { block }
			if (line.length !== 3)
				throw new Error("invalid while - " + line.join(" "))
			ix_loop = emit_jz(line[1])
			block(line[2])
			emit_jump(ix_loop)
			label(ix_loop)
			break

		case "for":
			// for i in (start) to (end) { block }
			if (line.length === 7 && line[2] === "in" && line[4] === "to") {
				i = line[1]
				start = line[3]
				end = line[5]
				body = line[6]
				emit(`${i} = ${start}`)
				ix_loop = prog.length
				block(body)
				emit(`if (++(${i}) <= ${end}) L.I = ${ix_loop}`)
				return
			}
			// for i in (array) { block }
			// NOTE: array is evaluated repeatedly so should be a constant!
			else if (line.length === 5 && line[2] === "in") {
				k = line[1]
				i = k.replace(/^G\./, "L.G_") + "_"
				array = line[3]
				body = line[4]
				emit(`${i} = 0`)
				ix_loop = emit(`if (${i} < ${array}.length) { ${k} = ${array}[${i}++] } else { delete ${i} ; L.I = % }`)
				block(body)
				emit_jump(ix_loop)
				label(ix_loop)
			} else {
				throw new Error("invalid for - " + line.join(" "))
			}
			break

		case "if":
			// if (exp) { block}
			// if (exp) { block } else { block }
			// TODO: if (exp) { block } elseif (exp) { block } else { block }
			ix1, ix2
			if (line.length === 3) {
				ix1 = emit_jz(line[1])
				block(line[2])
				label(ix1)
			} else if (line.length === 5 && line[3] === "else") {
				ix1 = emit_jz(line[1])
				block(line[2])
				ix2 = emit_jump()
				label(ix1)
				block(line[4])
				label(ix2)
			} else {
				throw new Error("invalid if - " + line.join(" "))
			}
			break

		default:
			throw new Error("unknown command - " + line.join(" "))
		}
	}

	function quote(s) {
		if ("{[(`'\"".includes(s[0]))
			return s
		return '"' + s + '"'
	}

	function emit_jz(exp, to = "%") {
		return emit("if (!(" + exp + ")) L.I = " + to)
	}

	function emit_jump(to = "%") {
		return emit("L.I = " + to)
	}

	function emit(s) {
		prog.push(s)
		return prog.length - 1
	}

	function label(ix) {
		prog[ix] = prog[ix].replace("%", prog.length)
	}

	function block(body) {
		if (body[0] !== "{")
			throw new Error("expected block (" + body + ")")
		lex(body.slice(1, -1))
	}

	lex(text)

	return prog
}

function script(text) {
	return text
}

(function _compile() {
	var cache = {}
	for (var name in P) {
		if (typeof P[name] === "string") {
			var prog = []
			try {
				for (var inst of _parse(P[name])) {
					try {
						prog.push(cache[inst] ??= eval("(function(){" + inst + "})"))
					} catch (err) {
						err.message += "\n\tat (" + inst + ")"
						throw err
					}
				}
			} catch (err) {
				err.message += "\n\tat P." + name
				throw err
			}
			P[name] = prog
		}
	}
})()

/* LIBRARY */

function copy_view_without_log(original) {
	var copy, k, v
	copy = {}
	for (k in original) {
		v = original[k]
		if (k === "log")
			continue
		else if (typeof v === "object" && v !== null)
			v = object_copy(v)
		copy[k] = v
	}
	return copy
}

function clear_undo() {
	if (G.undo) {
		G.undo.length = 0
	}
}

function push_undo() {
	var copy, k, v
	if (G.undo) {
		copy = {}
		for (k in G) {
			v = G[k]
			if (k === "undo")
				continue
			else if (k === "log")
				v = v.length
			else if (typeof v === "object" && v !== null)
				v = object_copy(v)
			copy[k] = v
		}
		G.undo.push(copy)
	}
}

function pop_undo() {
	if (G.undo) {
		var save_log = G.log
		var save_undo = G.undo
		G = save_undo.pop()
		save_log.length = G.log
		G.log = save_log
		G.undo = save_undo
		G.UNDID = TRUE
	}
}


function random(range) {
	// An MLCG using integer arithmetic with doubles.
	// https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/S0025-5718-99-00996-5.pdf
	// m = 2**35 − 31
	return (G.seed = G.seed * 200105 % 34359738337) % range
}

function shuffle(list) {
	// Fisher-Yates shuffle
	var i, j, tmp
	for (i = list.length - 1; i > 0; --i) {
		j = random(i + 1)
		tmp = list[j]
		list[j] = list[i]
		list[i] = tmp
	}
}

// Fast deep copy for objects without cycles
function object_copy(original) {
	var copy, i, n, v
	if (Array.isArray(original)) {
		n = original.length
		copy = new Array(n)
		for (i = 0; i < n; ++i) {
			v = original[i]
			if (typeof v === "object" && v !== null)
				copy[i] = object_copy(v)
			else
				copy[i] = v
		}
		return copy
	} else {
		copy = {}
		for (i in original) {
			v = original[i]
			if (typeof v === "object" && v !== null)
				copy[i] = object_copy(v)
			else
				copy[i] = v
		}
		return copy
	}
}


// Deep compare on two objects. Returns true if objects are equivalent.
function is_object_equal(a, b) {
	var i, key, a_length
	if (a === b)
		return true
	if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
		if (Array.isArray(a)) {
			if (!Array.isArray(b))
				return false
			a_length = a.length
			if (b.length !== a_length)
				return false
			for (i = 0; i < a_length; ++i)
				if (!is_object_equal(a[i], b[i]))
					return false
			return true
		}
		for (key in a)
			if (!is_object_equal(a[key], b[key]))
				return false
		for (key in b)
			if (!(key in a))
				return false
		return true
	}
	return false
}

function is_primitive_array(array) {
	return array.every(x => typeof x !== "object")
}

function array_diff(a, b) {
	var i, diff = {}
	if (a.length !== b.length)
		diff.length = b.length
	for (i = 0; i < a.length && i < b.length; ++i)
		if (!is_object_equal(a[i], b[i]))
			diff[i] = object_diff(a[i], b[i])
	for (; i < b.length; ++i)
		diff[i] = b[i]
	return diff
}


// Compute a "diff" object to transform object "a" into object "b"
function object_diff(a, b) {
	// CAVEATS: property must not change type from object to array or vice versa
	// return "b" if either one is not an object
	if (a === null || b === null || typeof a !== "object" || typeof b !== "object")
		return b
	if (Array.isArray(a) && Array.isArray(b)) {
		// copy arrays of primitive values verbatim
		// TODO: pick representation based on how much they differ
		if (is_primitive_array(b))
			return b.slice()
		// represent array diff as object
		return array_diff(a, b)
	}
	var diff = {}
	for (var key in a) {
		var a_val = a[key]
		var b_val = b[key]
		if (a_val !== b_val) {
			if (b_val === undefined)
				diff[key] = null
			else if (!is_object_equal(a_val, b_val)) {
				if (typeof a_val === "object") {
					diff[key] = object_diff(a_val, b_val)
				} else {
					if (typeof b_val === "object")
						diff[key] = object_copy(b_val)
					else
						diff[key] = b_val
				}
			}
		}
	}
	for (key in b) {
		if (a[key] === undefined)
			diff[key] = b[key]
	}
	return diff
}

// mutate object to apply patch!
function object_patch(obj, diff) {
	var i, a, b
	for (i in diff) {
		a = obj[i]
		b = diff[i]
		if (a !== null && b !== null && typeof a === "object" && typeof b === "object")
			obj[i] = object_patch(a, b)
		else if (b === undefined || b === null)
			delete obj[i]
		else
			obj[i] = b
	}
	return obj
}



// Array remove and insert (faster than splice)

function array_delete(array, index) {
	var i, n = array.length
	for (i = index + 1; i < n; ++i)
		array[i - 1] = array[i]
	array.length = n - 1
}

function array_delete_item(array, item) {
	var i, n = array.length
	for (i = 0; i < n; ++i)
		if (array[i] === item)
			return array_delete(array, i)
}

function array_insert(array, index, item) {
	for (var i = array.length; i > index; --i)
		array[i] = array[i - 1]
	array[index] = item
}

function array_delete_pair(array, index) {
	var i, n = array.length
	for (i = index + 2; i < n; ++i)
		array[i - 2] = array[i]
	array.length = n - 2
}

function array_insert_pair(array, index, key, value) {
	for (var i = array.length; i > index; i -= 2) {
		array[i] = array[i-2]
		array[i+1] = array[i-1]
	}
	array[index] = key
	array[index+1] = value
}

// Set as plain sorted array

function set_clear(set) {
	set.length = 0
}

function set_has(set, item) {
	var a = 0
	var b = set.length - 1
	while (a <= b) {
		var m = (a + b) >> 1
		var x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return true
	}
	return false
}

function set_add(set, item) {
	var a = 0
	var b = set.length - 1
	// optimize fast case of appending items in order
	if (item > set[b]) {
		set[b+1] = item
		return
	}
	while (a <= b) {
		var m = (a + b) >> 1
		var x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return
	}
	array_insert(set, a, item)
}

function set_delete(set, item) {
	var a = 0
	var b = set.length - 1
	while (a <= b) {
		var m = (a + b) >> 1
		var x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else {
			array_delete(set, m)
			return
		}
	}
}

// Map as plain sorted array of key/value pairs

function map_get(map, key, missing) {
	var a = 0
	var b = (map.length >> 1) - 1
	while (a <= b) {
		var m = (a + b) >> 1
		var x = map[m<<1]
		if (key < x)
			b = m - 1
		else if (key > x)
			a = m + 1
		else
			return map[(m<<1)+1]
	}
	return missing
}

function map_set(map, key, value) {
	var a = 0
	var b = (map.length >> 1) - 1
	while (a <= b) {
		var m = (a + b) >> 1
		var x = map[m<<1]
		if (key < x)
			b = m - 1
		else if (key > x)
			a = m + 1
		else {
			map[(m<<1)+1] = value
			return
		}
	}
	array_insert_pair(map, a<<1, key, value)
}

function map_delete(map, key) {
	var a = 0
	var b = (map.length >> 1) - 1
	while (a <= b) {
		var m = (a + b) >> 1
		var x = map[m<<1]
		if (key < x)
			b = m - 1
		else if (key > x)
			a = m + 1
		else {
			array_delete_pair(map, m<<1)
			return
		}
	}
}

// Bit flags. bits = "array" of dwords e.g. G.my_bits. index = which bit are we setting, bool_value = true or false
function bit_set(bits, index, bool_value) {
	var w = index >> 5
	var b = index & 31
	var m = 1 << b
	if (bool_value) {
		bits[w] |= m
	} else {
		bits[w] &= ~m
	}
}

function bit_get(bits, index)
{
	var w = index >> 5
	var b = index & 31
	return ((bits[w] >> b) & 1) > 0
}

// Initializes bitflag field, given the maximum number of bits possible
function bit_init(total_bits) {
	return new Array((total_bits + 31) >> 5).fill(0)
}


// === Log Helpers ===

function log_br() {
	if (G.log.length > 0 && (G.log[G.log.length-1] !== "" && G.log[G.log.length-1] !== "}"))
		log("")
}

function pad(s, condition = true) {
	if (!condition) return s
	return " " + s + " "
}

function parens(s, condition = true) {
	if (!condition) return s
	return "(" + s + ")"
}

function bold (s, condition = true)
{
	if (!condition) return s
	return "<b>" + s + "</b>"
}

function italic (s, condition = true )
{
	if (!condition) return s
	return "<i>" + s + "</i>"
}

function strike (s, condition = true )
{
	if (!condition) return s
	return "<s>" + s + "</s>"
}
