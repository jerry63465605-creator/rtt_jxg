const data = {}

const XXX = -1
//
// DANGER WILL ROBINSON!!!
//
// These are NOT the master copies of these const values. They are in rules.js.
// So DON'T change things here -- change them in rules.js and then copy/paste on top of here.
//

/* CONSTANTS */

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
const NUM_MINISTRY_SLOTS    = 2
const NUM_DEMANDS           = 6
const NUM_AWARD_TILES       = 8
const NUM_ADVANTAGES 		= 22
const NUM_SPACES            = 112
const NUM_ACTION_POINTS_TYPES= 3
const NUM_SQUADRONS			= 8 // per side, counter mix limit

// Types of War Tile
const WAR_DUDE = 0 // Just a soldier
const WAR_DEBT = 1 // Debt attack
const WAR_FORT = 2 // Fort/Fleet attack
const WAR_FLAG = 3 // Diplomatic attack

// Eras
const SUCCESSION_ERA = 0
const EMPIRE_ERA = 1
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
const NUM_SPACES_EUROPE = 30
const NUM_SPACES_NORTH_AMERICA  = 30
const NUM_SPACES_CARIBBEAN      = 30
const NUM_SPACES_INDIA = 22

// SPACES
const SPACE_NAVY_BOX = -1	// The negative numbers are for keeping track of squadron "token" locations for animation purposes
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
const NOT_ACTION_PHASE				= 6

// Generic persistent bitflags
const NUM_BITFLAGS                = 32
const FLAG_MILITARY_UPGRADE	      = 0
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


// TRANSIENT BITFLAGS FROM EVENTS, MINISTERS, ADVANTAGES
const NUM_TRANSIENT_BITFLAGS = 32
const TRANSIENT_SOUTH_SEA_SQUADRON_DISCOUNT = 0
const TRANSIENT_JACOBITES_USED_1 = 1
const TRANSIENT_JACOBITES_USED_2 = 2

/* TILES & CARDS */

data.regions = [
	{ num: 0, name: "Europe",         "spaces": NUM_SPACES_EUROPE,        "first_space": 0},
	{ num: 1, name: "North America" , "spaces": NUM_SPACES_NORTH_AMERICA, "first_space": NUM_SPACES_EUROPE },
	{ num: 2, name: "Caribbean",      "spaces": NUM_SPACES_CARIBBEAN,     "first_space": NUM_SPACES_EUROPE + NUM_SPACES_NORTH_AMERICA },
	{ num: 3, name: "India",          "spaces": NUM_SPACES_INDIA,         "first_space": NUM_SPACES_EUROPE + NUM_SPACES_NORTH_AMERICA + NUM_SPACES_CARIBBEAN },
]

data.flags = [
	{ "num": 0, "id": "fr", "name": "France",  "name2": "France",  "adj": "French" },
	{ "num": 1, "id": "br", "name": "Britain", "name2": "Britain", "adj": "British" },
	{ "num": 2, "id": "sp", "name": "Spain",   "name2": "Spain",   "adj": "Spanish" },
	{ "num": 3, "id": "us", "name": "USA",     "name2": "USA",     "adj": "US" },
	{ "num": 4, "id": "no", "name": "No Flag", "name2": "TIE",     "adj": "Unflagged" }
]

data.action_points = [
	{ "num": 0, "name": "Economic",   "short": "Econ",  "letter": "E" },
	{ "num": 1, "name": "Diplomatic", "short": "Diplo", "letter": "D" },
	{ "num": 2, "name": "Military",   "short": "Mil",   "letter": "M" }
]

data.demands = [
    { "num": 0, "name": "Furs",    "awards": [ { "vp": 2, "trp": 1, "debt":  0 }, { "vp": 2, "trp": 1, "debt":  0 }, { "vp": 1, "trp": 0, "debt":  0 } ] },
    { "num": 1, "name": "Spice",   "awards": [ { "vp": 1, "trp": 0, "debt": -1 }, { "vp": 2, "trp": 0, "debt": -1 }, { "vp": 3, "trp": 0, "debt": -1 } ] },
    { "num": 2, "name": "Fish",    "awards": [ { "vp": 2, "trp": 0, "debt":  1 }, { "vp": 2, "trp": 0, "debt":  0 }, { "vp": 2, "trp": 0, "debt":  0 } ] },
    { "num": 3, "name": "Tobacco", "awards": [ { "vp": 3, "trp": 0, "debt":  1 }, { "vp": 2, "trp": 0, "debt":  1 }, { "vp": 1, "trp": 0, "debt":  1 } ] },
    { "num": 4, "name": "Sugar",   "awards": [ { "vp": 2, "trp": 0, "debt":  0 }, { "vp": 3, "trp": 1, "debt":  0 }, { "vp": 3, "trp": 0, "debt":  0 } ] },
    { "num": 5, "name": "Cotton",  "awards": [ { "vp": 2, "trp": 1, "debt":  0 }, { "vp": 2, "trp": 1, "debt":  0 }, { "vp": 3, "trp": 0, "debt":  0 } ] }
]

data.awards = [
    { "num": 0, "vp": 3, "by2": true,  "trp": 0, name: "3 VP (if won by 2 flags)" },
    { "num": 1, "vp": 2, "by2": true,  "trp": 0, name: "2 VP (if won by 2 flags)" },
    { "num": 2, "vp": 1, "by2": false, "trp": 0, name: "1 VP" },
    { "num": 3, "vp": 1, "by2": false, "trp": 0, name: "1 VP" },
    { "num": 4, "vp": 1, "by2": false, "trp": 1, name: "1 VP, 1 TRP" },
    { "num": 5, "vp": 1, "by2": false, "trp": 1, name: "1 VP, 1 TRP" },
    { "num": 6, "vp": 0, "by2": false, "trp": 1, name: "0 VP, 1 TRP" },
    { "num": 7, "vp": 0, "by2": false, "trp": 1, name: "0 VP, 1 TRP" },
]

data.turns = [
    { "num": 0, "id": "1",   "war": false, "name": "1: PEACE",                       "dates": "1697-1701", layout: "Turn 1" },
    { "num": 1, "id": "WSS", "war": true,  "name": "War of the Spanish Succession",  "dates": "1702-1713", layout: "War 1" },
    { "num": 2, "id": "2",   "war": false, "name": "2: PEACE",                       "dates": "1714-1722", layout: "Turn 2" },
    { "num": 3, "id": "3",   "war": false, "name": "3: PEACE",                       "dates": "1722-1739", layout: "Turn 3" },
    { "num": 4, "id": "WAS", "war": true,  "name": "War of the Austrian Succession", "dates": "1740-1748", layout: "War 2" },
    { "num": 5, "id": "4",   "war": false, "name": "4: PEACE",                       "dates": "1749-1753", layout: "Turn 4" },
    { "num": 6, "id": "7YW", "war": true,  "name": "Seven Years War",                "dates": "1754-1763", layout: "War 3" },
    { "num": 7, "id": "5",   "war": false, "name": "5: PEACE",                       "dates": "1764-1774", layout: "Turn 5" },
    { "num": 8, "id": "AWI", "war": true,  "name": "American War of Independence",   "dates": "1775-1783", layout: "War 4" },
    { "num": 9, "id": "6",   "war": false, "name": "6: PEACE",                       "dates": "1784-1789", layout: "Turn 6" }
]

data.wars = [
	{ },
	{ "num": 1, "id": "WSS", "theaters": 4, "name": "War of the Spanish Succession",  "theater_names": ["Newly Drawn", "Central Europe", "Spain", "Queen Anne's War", "Jacobite Rebellion"] },
	{ "num": 2, "id": "WAS", "theaters": 4, "name": "War of the Austrian Succession", "theater_names": ["Newly Drawn", "Central Europe", "King George's War", "First Carnatic War", "Jacobite Rebellion"] },
	{ "num": 3, "id": "7YW", "theaters": 4, "name": "Seven Years War",                "theater_names": ["Newly Drawn", "Atlantic Dominance", "Third Carnatic War", "French & Indian War", "Prussia's Wars" ] },
	{ "num": 4, "id": "AWI", "theaters": 3, "name": "American War of Independence",   "theater_names": ["Newly Drawn", "American Revolution", "Mysore War", "Antilles War"] }
]

data.wars[WAR_WSS].theater = []
data.wars[WAR_WSS].theater[1] = { "region": REGION_EUROPE,        "keyword": -1,         "conflicts": false, "naval": false, "margin": [1,3,5], "vp": [2,2,3], "cp": [0,1,2], "trp": [1,2,3], "unflag": [0,0,0], "additional": [ SAN_AGUSTIN, ASIENTO, HUDSON_BAY, ACADIA ] }
data.wars[WAR_WSS].theater[2] = { "region": REGION_EUROPE,        "keyword": GOVERNANCE, "conflicts": false, "naval": true,  "margin": [1,2,4], "vp": [1,1,1], "cp": [0,1,2], "trp": [1,2,2], "unflag": [0,0,0], "additional": [ SAN_AGUSTIN, ASIENTO ] }
data.wars[WAR_WSS].theater[3] = { "region": REGION_NORTH_AMERICA, "keyword": -1,         "conflicts": true,  "naval": true,  "margin": [1,3,4], "vp": [1,1,1], "cp": [0,1,1], "trp": [0,1,2], "unflag": [0,0,1], "additional": [] }
data.wars[WAR_WSS].theater[4] = { "region": REGION_EUROPE,        "keyword": STYLE,      "conflicts": true,  "naval": false, "margin": [1,3,5], "vp": [1,2,4], "cp": [0,0,0], "trp": [0,1,2], "unflag": [0,0,0], "additional": [] }

data.wars[WAR_WAS].theater = []
data.wars[WAR_WAS].theater[1] = { "region": REGION_EUROPE,        "keyword": -1,         "conflicts": false, "naval": false, "margin": [1,3],   "vp": [1,1],   "cp": [0,1],   "trp": [0,1],   "unflag": [0,0],   "additional": [ HUDSON_BAY, SAN_AGUSTIN, ACADIA, ASIENTO ] }
data.wars[WAR_WAS].theater[2] = { "region": REGION_NORTH_AMERICA, "keyword": -1,         "conflicts": true,  "naval": true,  "margin": [1,3],   "vp": [0,0],   "cp": [1,1],   "trp": [0,1],   "unflag": [0,1],   "additional": [ SAN_AGUSTIN ] }
data.wars[WAR_WAS].theater[3] = { "region": REGION_INDIA,         "keyword": -1,         "conflicts": true,  "naval": true,  "margin": [1,3,4], "vp": [0,0,0], "cp": [1,2,2], "trp": [0,1,2], "unflag": [0,0,1], "additional": [] }
data.wars[WAR_WAS].theater[4] = { "region": REGION_EUROPE,        "keyword": STYLE,      "conflicts": true,  "naval": false, "margin": [1,2,3], "vp": [1,2,3], "cp": [0,0,0], "trp": [0,1,2], "unflag": [0,1,1], "france_margin": [1,2,4], "france_vp": [2,3,5], "france_trp": [1,2,3], "additional": [] }

data.wars[WAR_7YW].theater = []
data.wars[WAR_7YW].theater[1] = { "region": REGION_EUROPE,        "keyword": -1,         "conflicts": false, "naval": true,  "margin": [2,3,5], "vp": [0,0,0], "cp": [0,0,0], "trp": [0,0,0], "unflag": [0,0,0], "additional": [ ] }
data.wars[WAR_7YW].theater[2] = { "region": REGION_INDIA,         "keyword": -1,         "conflicts": true,  "naval": true,  "margin": [1,3,5], "vp": [0,0,0], "cp": [1,1,2], "trp": [1,2,3], "unflag": [0,1,1], "additional": [ ] }
data.wars[WAR_7YW].theater[3] = { "region": REGION_NORTH_AMERICA, "keyword": -1,         "conflicts": true,  "naval": true,  "margin": [1,3,5], "vp": [0,1,2], "cp": [1,2,3], "trp": [1,3,4], "unflag": [1,0,0], "additional": [ MINORCA, GIBRALTAR ] }
data.wars[WAR_7YW].theater[4] = { "region": REGION_EUROPE,        "keyword": -1,         "conflicts": false, "naval": false, "margin": [1,3,5], "vp": [2,3,4], "cp": [0,0,0], "trp": [0,0,1], "unflag": [0,0,0], "additional": [ ]	}

data.wars[WAR_AWI].theater = []
data.wars[WAR_AWI].theater[1] = { "region": REGION_NORTH_AMERICA, "keyword": -1,         "conflicts": true,  "naval": true,  "margin": [1,2,4], "vp": [2,3,4], "cp": [0,1,2], "trp": [0,1,2], "unflag": [0,0,0], "france_margin": [1,3,5], "france_vp": [2,3,4], "france_trp": [2,2,3], "additional": [ SAN_AGUSTIN ] }
data.wars[WAR_AWI].theater[2] = { "region": REGION_INDIA,         "keyword": -1,         "conflicts": true,  "naval": true,  "margin": [1,3],   "vp": [0,0],   "cp": [1,2],   "trp": [1,3],   "unflag": [0,0,0], "additional": [ ] }
data.wars[WAR_AWI].theater[3] = { "region": REGION_CARIBBEAN,     "keyword": -1,         "conflicts": true,  "naval": true,  "margin": [1,2,4], "vp": [0,0,0], "cp": [1,1,2], "trp": [0,1,2], "unflag": [0,1,1], "additional": [ HUDSON_BAY, ACADIA ] }

data.keywords = [
	{ "num": 0, "name": "Finance" },
	{ "num": 1, "name": "Mercantilism" },
	{ "num": 2, "name": "Governance" },
	{ "num": 3, "name": "Style" },
	{ "num": 4, "name": "Scholarship" }
]

data.cards = [
    {},
    { "num":  1, "era": 0, "name": "Carnatic War",                  "action":  3, "keyword":  1 , "keylabel": "BONUS: Mercantilism",                                                "label": "", "effect": "Place 1 Conflict marker in India for each Local Alliance you control there.", "bonus": "Bonus: Damage an enemy Fort or shift a Cotton market in India.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num":  2, "era": 0, "name": "Acts of Union",                 "action":  3, "keyword": -1 , "keylabel": "BONUS: More Prestige spaces in Scotland and Ireland",                "label": "", "effect": "", "bonus": "", "britishlabel": "United Parliament reduces Scottish intrigue in Europe", "britisheffect": "[@1]1 (unflagging in Europe only).", "britishbonus": "Bonus: Score 2 VP.", "frenchlabel": "Hapsburgs isolated", "frencheffect": "2[@1]", "frenchbonus": "Bonus: Unflag a Political space in Europe (not in Spain or Austria)." },
    { "num":  3, "era": 0, "name": "Tropical Diseases",             "action":  3, "keyword":  4 , "keylabel": "BONUS: Scholarship",                                                 "label": "", "effect": "Remove 1 enemy flag, then 1 friendly flag, from Markets in the Caribbean.", "bonus": "Bonus: Remove an additional flag from a Market in theh Caribbean.",  "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num":  4, "era": 0, "name": "South Sea Speculation",         "action":  3, "keyword":  0 , "keylabel": "BONUS: Finance",                                                     "label": "", "effect": "Unflag a Market whose removal does not Isolate any other Markets.", "bonus": "Bonus: -2[@2] to construct a new Squadron this AR. (This can result in the Construct Squadron action costing 0[@2].)", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num":  5, "era": 0, "name": "War of Jenkins' Ear",           "action":  2, "keyword":  1 , "keylabel": "BONUS: Mercantilism",                                                "label": "", "effect": "", "bonus": "", "britishlabel": "Anson returns with Spanish gold", "britisheffect": "Reduce your Debt by 2.", "britishbonus": "Bonus: Add 1 FR Debt.", "frenchlabel": "Cartagena disaster", "frencheffect": "Place a Conflict marker in a BR-flagged Market in the Caribbean", "frenchbonus": "Bonus: 1[@1]." },
    { "num":  6, "era": 0, "name": "Native American Alliances",     "action":  1, "keyword":  1 , "keylabel": "BONUS: Mercantilism",                                                "label": "", "effect": "", "bonus": "", "britishlabel": "Four Mohawk Kings", "britisheffect": "Shift a Local Alliance in North America.", "britishbonus": "Bonus: Immediately activate an Advantage you control in North America (ignoring Exhaustion).", "frenchlabel": "Alliance with natives", "frencheffect": "2[@0] (North America only).", "frenchbonus": "Bonus: Unflag a Local Alliance in North America." },
    { "num":  7, "era": 0, "name": "Austro-Spanish Rivalry",        "action":  3, "keyword":  2 , "keylabel": "BONUS: Governance",                                                  "label": "", "effect": "", "bonus": "", "britishlabel": "Farnese clashes with France", "britisheffect": "Place 1 Conflict marker in Spain", "britishbonus": "Bonus: Remove a FR Bonus War tile from the next War (returning it to their pool).", "frenchlabel": "Charles VI invests in the Netherlands", "frencheffect": "Unflag a space in the Dutch Republic.", "frenchbonus": "Bonus: 2[@1] or 2[@0] in India." },
    { "num":  8, "era": 0, "name": "Tax Reform",                    "action":  0, "keyword":  0 , "keylabel": "BONUS: Finance",                                                     "label": "", "effect": "Reduct your Debt by 2. If you are unable to reduce Debt, you may take 1[@0] for each Debt reduction not taken.", "bonus": "Bonus: Reduct your Debt by an additional 1.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num":  9, "era": 0, "name": "Great Northern War",            "action":  2, "keyword":  3 , "keylabel": "BONUS: Style",                                                       "label": "", "effect": "", "bonus": "", "britishlabel": "Hanover prestige enhanced", "britisheffect": "Shift a Political space in the German States. If both are now BR-flagged, score 2 VP.", "britishbonus": "1 [@1]", "frenchlabel": "France brokers treaty", "frencheffect": "Shift Russia. If it's already FR-flagged, score 2 VP instead.", "frenchbonus": "Bonus: 1[@1]." },
    { "num": 10, "era": 0, "name": "Vatican Politics",              "action":  3, "keyword":  3 , "keylabel": "BONUS: Style",                                                       "label": "", "effect": "", "bonus": "", "britishlabel": "Protestant states wary", "britisheffect": "2 [@1] (must be spent in the German States, Prussia, or the Dutch Republic).", "britishbonus": "Bonus: 1[@1] (Europe).", "frenchlabel": "Catholic unity", "frencheffect": "Shift any Spain or Austria space.", "frenchbonus": "Bonus: If there are no BR flags in Spain and Austria, score 2 VP." },
    { "num": 11, "era": 0, "name": "Calico Acts",                   "action":  0, "keyword":  1 , "keylabel": "BONUS: Mercantilism",                                                "label": "", "effect": "", "bonus": "", "britishlabel": "Calico Act stimulates industry", "britisheffect": "2 [@0]; must be used to unflag Market(s).", "britishbonus": "Bonus: You may score Cotton (as if in Global Demand).", "frenchlabel": "Calico Act enriches smugglers", "frencheffect": "Unflag a Cotton Market.", "frenchbonus": "Bonus: Move a BR Squadron from the map to the Navy Box." },
    { "num": 12, "era": 0, "name": "Military Spending Overruns",    "action":  2, "keyword": -1 , "keylabel": "BONUS: You have more Available Debt than your opponent.",            "label": "", "effect": "Your opponent must damage a Fort, remove a Squadron (to Navy Box), or remove a Bonus War Tile from the next War (returning it to their pool).", "bonus": "Bonus: Your opponent must do so again (does not have to be the same choice).", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 13, "era": 0, "name": "Alberoni's Ambition",           "action":  3, "keyword":  2 , "keylabel": "BONUS: Governance",                                                  "label": "", "effect": "", "bonus": "", "britishlabel": "Not One Englishman", "britisheffect": "2 [@0]. Must be spent to flag Market(s) next to a BR-flagged Market.", "britishbonus": "Bonus: 1 [@0], similarly restricted.", "frenchlabel": "Fleury's masterpiece", "frencheffect": "Shift an Alliance space in Austria, the Dutch Republic, or Spain.", "frenchbonus": "Bonus: If both Savoy and Sardinia are FR-flagged, score 3 VP." },
    { "num": 14, "era": 0, "name": "Famine in Ireland",             "action":  0, "keyword": -1 , "keylabel": "",                                                                   "label": "", "effect": "", "bonus": "", "britishlabel": "Famine weakens Jacobites", "britisheffect": "Unflag a FR space in Ireland or Scotland", "britishbonus": "", "frenchlabel": "Grain shipments from America", "frencheffect": "Draw one Bonus War Tile for each space you control in Ireland, and add them to the Jacobite Rebellion theater in the next War.", "frenchbonus": "" },
    { "num": 15, "era": 0, "name": "Interest Payments",             "action":  0, "keyword": -1 , "keylabel": "BONUS: You have more Available Debt than your opponent.",            "label": "", "effect": "Reduce your opponent's Debt Limit by one. If your opponent was at Debt Limit, reduce their Debt by one as well, then score 1 VP.", "bonus": "Bonus: Reduce your own Debt by 2.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },

    { "num": 16, "era": 1, "name": "Caribbean Slave Unrest",        "action":  3, "keyword": -1 , "keylabel": "BONUS: More total Bonus War Tiles in next War",                      "label": "Slaves desert plantations", "effect": "Place 1 Conflict marker in a Market in the Caribbean", "bonus": "Bonus: Place 1 additional Conflict marker as above", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 17, "era": 1, "name": "Pacte de Famille",              "action":  3, "keyword":  3 , "keylabel": "BONUS: Style",                                                       "label": "", "effect": "", "bonus": "", "britishlabel": "Bourbon-Hapsburg tension", "britisheffect": "This AR, FR-flagged spaces in Spain or Austria cost 1 less [@1] for you to unflag.", "britishbonus": "Bonus: 1 [@1]", "frenchlabel": "Bourbon family ties", "frencheffect": "Refresh up to two Advantages in Europe.", "frenchbonus": "Bonus: 2 [@1] in Spain and/or Austria." },
    { "num": 18, "era": 1, "name": "Byng's Trial",                  "action":  3, "keyword": -1 , "keylabel": "",                                                                   "label": "", "effect": "", "bonus": "", "britishlabel": "Others encouraged", "britisheffect": "Place the Byng marker in any theater that counts Naval Strength in the next War.", "britishbonus": "", "frenchlabel": "Autres ne sont pas encouragés", "frencheffect": "Remove one BR Squadron from the map or the Navy Box and place it on the Turn Track (on the next peace turn). On that turn's Reset Phase, return it to the Navy Box.", "frenchbonus": "" },
    { "num": 19, "era": 1, "name": "Le Beau Monde",                 "action":  3, "keyword":  3 , "keylabel": "BONUS: Style",                                                       "label": "", "effect": "", "bonus": "", "britishlabel": "Huguenot refugees bring their crafts", "britisheffect": "You may put Fur or Cotton into Global Demand.", "britishbonus": "Bonus: 1 [@0]", "frenchlabel": "Dominance of fashion", "frencheffect": "1 [@1] in Europe.", "frenchbonus": "Bonus: 2 more [@1] in Europe." },
    { "num": 20, "era": 1, "name": "Hyder Ali",                     "action":  3, "keyword":  1 , "keylabel": "BONUS: Mercantilism",                                                "label": "", "effect": "Take control of one Local Alliance space in India\n-- OR --\nplace 2 Conflict markers in unprotected spaces in India.", "bonus": "Bonus: 2 [@0] in India.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 21, "era": 1, "name": "Co-Hong System",                "action":  1, "keyword":  4 , "keylabel": "BONUS: Scholarship",                                                 "label": "Arrangement with Qing", "effect": "Draw a new Global Demand tile, then replace one of this turn's Global Demand tiles with the new one.", "bonus": "Bonus: 2 [@0] in India.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 22, "era": 1, "name": "Corsican Crisis",               "action":  1, "keyword":  2 , "keylabel": "BONUS: Governance",                                                  "label": "", "effect": "", "bonus": "", "britishlabel": "British intervene", "britisheffect": "Shift Sardinia or Savoy.", "britishbonus": "Bonus: Score 1 VP if France has no Squadrons in Europe.", "frenchlabel": "British vacillate", "frencheffect": "Unflag a Political space in Europe.", "frenchbonus": "Bonus: Score 1 VP if Britain has no flags in Spain." },
    { "num": 23, "era": 1, "name": "European Panic",                "action":  0, "keyword": -1 , "keylabel": "BONUS: You have at least 3 more Available Debt than your opponent.", "label": "", "effect": "For each Debt your opponent has in excess of yours (up to 4), score 1 VP.", "bonus": "Bonus: Unflag an opposing Political space in Europe.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 24, "era": 1, "name": "West African Gold Mining",      "action":  3, "keyword": -1 , "keylabel": "BONUS: You have more Available Debt than your opponent.",            "label": "", "effect": "1 [@0]", "bonus": "Bonus: 2 [@0] in the Caribbean.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 25, "era": 1, "name": "War of the Quadruple Alliance", "action":  1, "keyword":  2 , "keylabel": "BONUS: Governance",                                                  "label": "", "effect": "", "bonus": "", "britishlabel": "British naval prowess", "britisheffect": "Remove a BR Squadron from the map or Navy Box to score 2 VP. It returns to Navy Box on the next peace turn.", "britishbonus": "Bonus: Build a Squadron then take 1 Debt or, if you have any, lose 1 TRP.", "frenchlabel": "France advances Med interests", "frencheffect": "Shift a Spain space.", "frenchbonus": "Bonus: 1 [@1]" },
    { "num": 26, "era": 1, "name": "Salon d'Hercule",               "action":  3, "keyword":  3 , "keylabel": "BONUS: Style",                                                       "label": "", "effect": "", "bonus": "", "britishlabel": "Versailles cost overruns", "britisheffect": "Increase FR Debt by 1.", "britishbonus": "Bonus: Increase FR Debt by another 2.", "frenchlabel": "Salon impresses envoys", "frencheffect": "2 [@1] in Europe.", "frenchbonus": "Bonus: 2 additional [@1] in Europe." },
    { "num": 27, "era": 1, "name": "Bengal Famine",                 "action":  0, "keyword": -1 , "keylabel": "",                                                                   "label": "", "effect": "Place up to 2 Conflict markers in Markets or Political spaces in India.", "bonus": "", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 28, "era": 1, "name": "Father le Loutre",              "action":  2, "keyword":  2 , "keylabel": "BONUS: Governance",                                                  "label": "", "effect": "", "bonus": "", "britishlabel": "Acadians expelled", "britisheffect": "Place a Conflict marker in a Fish Market.", "britishbonus": "Bonus: 2 [@2] in North America.", "frenchlabel": "Raids on Halifax", "frencheffect": "Bonus: 2 [@0] in North America.", "frenchbonus": "" },
    { "num": 29, "era": 1, "name": "War of the Polish Succession",  "action":  2, "keyword":  0 , "keylabel": "BONUS: Finance",                                                     "label": "", "effect": "", "bonus": "", "britishlabel": "British strengthen ties with Russia", "britisheffect": "Gain 2 TRP.", "britishbonus": "Bonus: Shift Russia.", "frenchlabel": "Lorraine secured", "frencheffect": "Score 2 VP.", "frenchbonus": "Shift Russia or Sweden." },
    { "num": 30, "era": 1, "name": "Jonathan's Coffee-House",       "action":  0, "keyword":  0 , "keylabel": "BONUS: Finance",                                                     "label": "", "effect": "2 [@0].", "bonus": "Bonus: 1 additional [@0], and reduce your Debt by 1.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },

    { "num": 31, "era": 2, "name": "Nootka Incident",               "action":  2, "keyword":  1 , "keylabel": "BONUS: Mercantilism",                                                "label": "", "effect": "", "bonus": "", "britishlabel": "Crisis resolved", "britisheffect": "2 [@1] or 2 [@0]", "britishbonus": "Bonus: Score 2 VP per BR-flagged alliance space in Spain, then remove those flags.", "frenchlabel": "British dispute territory with Spain", "frencheffect": "Displace a BR Squadron to Navy Box.", "frenchbonus": "Bonus: Construct a Squadron." },
    { "num": 32, "era": 2, "name": "Haitian Revolution",            "action":  3, "keyword": -1 , "keylabel": "BONUS: More total Bonus War Tiles in next War.",                     "label": "", "effect": "Place a Conflict marker in a Caribbean Sugar Market.\n\nConflict markers placed by this event cost 1 extra MP to remove.", "bonus": "Bonus: Place Conflict markers in 2 additional such Markets.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 33, "era": 2, "name": "Loge des Neuf Soeurs",          "action":  3, "keyword":  3 , "keylabel": "BONUS: Style",                                                       "label": "", "effect": "", "bonus": "", "britishlabel": "Debate societies infiltrated", "britisheffect": "Place 1 Conflict marker in the Northern Colonies sub-region.", "britishbonus": "Bonus: If there are more BR than FR flags in North America, score 3 VP.", "frenchlabel": "Loges energize politics", "frencheffect": "Activate an Advantage you control outside Europe (ignore Exhaustion).", "frenchbonus": "Bonus: 2 [@1]." },
    { "num": 34, "era": 2, "name": "La Gabelle",                    "action":  1, "keyword": -1 , "keylabel": "BONUS: You have more Available Debt than your opponent.",            "label": "", "effect": "", "bonus": "", "britishlabel": "Salt tax unrest", "britisheffect": "Exhaust up to 2 Advantages (BR player's choice). They do not take effect.", "britishbonus": "Bonus: 2 [@0]", "frenchlabel": "Salt tax permanently reformed", "frencheffect": "2 [@0]", "frenchbonus": "Score 2 VP (or 3 VP, if you have the Governance keyword)." },
    { "num": 35, "era": 2, "name": "Jesuit Abolition",              "action":  3, "keyword":  2 , "keylabel": "BONUS: Governance",                                                  "label": "", "effect": "", "bonus": "", "britishlabel": "Jesuit haciendas dissolve", "britisheffect": "Unflag a Sugar Market.", "britishbonus": "Bonus: 3 [@0] (Caribbean only).", "frenchlabel": "Jesuit liabilities made good", "frencheffect": "Reduce your Debt by 2.", "frenchbonus": "Bonus: Score 2 VP." },
    { "num": 36, "era": 2, "name": "Wealth of Nations",             "action":  3, "keyword":  4 , "keylabel": "BONUS: Scholarship",                                                 "label": "", "effect": "Reduce your Debt by 2.", "bonus": "Bonus: 3 [@0].", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 37, "era": 2, "name": "Debt Crisis",                   "action":  0, "keyword": -1 , "keylabel": "BONUS: You have at least 3 more Available Debt than your opponent.", "label": "", "effect": "If you have more Available Debt than opponent, receive 3 [@0] (must be used to unflag Markets).", "bonus": "Bonus: Score 2 VP.", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 38, "era": 2, "name": "East Asia Piracy",              "action":  2, "keyword": -1 , "keylabel": "",                                                                   "label": "", "effect": "If you have more combined Squadrons, Forts, and Local Alliances in India than your opponent does, score 3 VP.", "bonus": "", "britishlabel": "", "britisheffect": "", "britishbonus": "", "frenchlabel": "", "frencheffect": "", "frenchbonus": "" },
    { "num": 39, "era": 2, "name": "Stamp Act",                     "action":  3, "keyword":  1 , "keylabel": "BONUS: Mercantilism",                                                "label": "", "effect": "", "bonus": "", "britishlabel": "Stamp Act deters smuggling", "britisheffect": "Reduce your Debt by 2.", "britishbonus": "Bonus: 2 [@0]", "frenchlabel": "Stamp rule enrages colonists", "frencheffect": "Place 1 Conflict marker in the Northern Colonies sub-region.", "frenchbonus": "Bonus: Place 3 instead." },
    { "num": 30, "era": 2, "name": "Falklands Crisis",              "action":  1, "keyword": -1 , "keylabel": "BONUS: Mediterranean Intrigue",                                      "label": "", "effect": "", "bonus": "", "britishlabel": "Spain concedes Egmont", "britisheffect": "If there is a BR-flagged space in Spain, score 1 VP.", "britishbonus": "Bonus: Unflag a space in Spain.", "frenchlabel": "France tips balance", "frencheffect": "Receive 1 [@2] for each FR flag in Spain.", "frenchbonus": "Bonus: Remove a BR Squadron from the game." },
    { "num": 41, "era": 2, "name": "Cook and Bougainville",         "action":  3, "keyword":  1 , "keylabel": "BONUS: Mercantilism",                                                "label": "", "effect": "", "bonus": "", "britishlabel": "Cook maps the Pacific", "britisheffect": "1 [@0] for every 2 Squadrons you have on the map or in the Navy Box.", "britishbonus": "Bonus: Draw a Bonus War Tile.", "frenchlabel": "Bougainville's circumnavigation", "frencheffect": "Add a Squadron to the Navy Box.", "frenchbonus": "Bonus: Reduce your Debt by 2." },
]

data.ministries = [
    {},
    { "num":  1, "side": 0, "era": [ 0 ],       "abilities": 1, "name": "The Cardinal Ministers",      "keywords": [ 2 ],    "keylabel": "Governance",           "effect": "Once per turn, at the start of an Action Round in which your Investment Tile has any Diplomatic Action, that Action confers 1 extra [@1] for each of the following you control (max 3): Savoy, Sardinia, and each Prestige space in Spain and Austria." },
    { "num":  2, "side": 0, "era": [ 0 ],       "abilities": 1, "name": "John Law",                    "keywords": [ 0 ],    "keylabel": "Finance",              "effect": "At the end of each Peace turn, reduce your Debt by 1 (or 2, if you control any spaces in Scotland)." },
    { "num":  3, "side": 0, "era": [ 0 ],       "abilities": 1, "name": "Court of the Sun King",       "keywords": [ 3, 4 ], "keylabel": "Style, Scholarship",   "effect": "The Award for Europe is worth 1 extra VP to you." },
    { "num":  4, "side": 0, "era": [ 0, 1, 2 ], "abilities": 2, "name": "Jacobite Uprisings",          "keywords": [ ],      "keylabel": "None",                 "effect": "Once per turn you may use [@2] to shift spaces in Scotland and/or Ireland. Once per turn, on a different Action Round, you may spend 3[@2] to score 1 VP (max 4) for each FR-flagged such space and Jacobite Victory marker. Immediately remove this card from the game after BR play of the Papacy-Hanover Negotiations Ministry card, or after a Jacobite Defeat war result." },
    { "num":  5, "side": 1, "era": [ 0 ],       "abilities": 1, "name": "Robert Walpole",              "keywords": [ 2 ],    "keylabel": "Governance",           "effect": "Once per turn, you may draw one Event card, then discard one Event card." },
    { "num":  6, "side": 1, "era": [ 0 ],       "abilities": 1, "name": "Jonathan Swift",              "keywords": [ 3 ],    "keylabel": "Style",                "effect": "Spaces in Ireland and Scotland cost you 1 less [@1] to flag.\n\nIf you control any spaces in Ireland, your Minor Diplomatic Actions may be used to remove FR flags in Europe." },
    { "num":  7, "side": 1, "era": [ 0, 1 ],    "abilities": 1, "name": "East India Company",          "keywords": [ 1 ],    "keylabel": "Mercantilism",         "effect": "During the Scoring Phase, score 1 VP for each of the following unexhausted Advantages you control (maximum 3): Textiles, Silk, Fruit, Fur Trade, Rum." },
    { "num":  8, "side": 1, "era": [ 0 ],       "abilities": 2, "name": "Bank of England",             "keywords": [ 0 ],    "keylabel": "Finance",              "effect": "Once per turn, you may increase your Debt Limit by 1.\n\nOnce per turn, you may play an Economic event even if your selected Investment Tile does not have an Economic Major Action. (It must still have the Event symbol.)" },
    { "num":  9, "side": 0, "era": [ 0 ],       "abilities": 1, "name": "New World Huguenots",         "keywords": [ 1 ],    "keylabel": "Mercantilism",         "effect": "Once per turn, during a FR Action Round, place 1 Huguenots marker in one FR-flagged Territory in N. America or the Caribbean where there isn't one already. A Huguenots marker increases its space's CP cost by 1. It may be flipped once per game to reduce the [@0] cost of a Market in its Region by 1. It is permanently removed if its space becomes BR-flagged." },
    { "num": 10, "side": 1, "era": [ 0 ],       "abilities": 2, "name": "Edmond Halley",               "keywords": [ 4 ],    "keylabel": "Scholarship",          "effect": "Once per turn, you may spend 2[@2] to build a Squadron (instead of the usual 4).\n\nOnce per turn, if you have a Squadron in Europe, you may discard an Event card from your hand and take 1 TRP." },

    { "num": 11, "side": 0, "era": [ 1 ],       "abilities": 2, "name": "Choiseul",                    "keywords": [ 2, 0 ], "keylabel": "Governance, Finance",  "effect": "Once per turn, when taking a Military action, you receive 1 extra [@2] that you may spend on Bonus War Tiles or deploying Squadrons (only). Once per turn, if you have a Squadron in North America, you may may 2 [@2] to construct a new Squadron (instead of the usual 4)." },
    { "num": 12, "side": 0, "era": [ 1 ],       "abilities": 1, "name": "Dupleix",                     "keywords": [ 1 ],    "keylabel": "Mercantilism",         "effect": "The Awards for India, Cotton, and Spice are worth 1 extra TRP to you." },
    { "num": 13, "side": 0, "era": [ 1, 2 ],    "abilities": 1, "name": "Pompadour & Du Barry",        "keywords": [ 3 ],    "keylabel": "Style",                "effect": "The first time each Action Round that you exhaust an Advantage in Europe, gain 1 TRP." },
    { "num": 14, "side": 0, "era": [ 1, 2 ],    "abilities": 1, "name": "Voltaire",                    "keywords": [ 4 ],    "keylabel": "Scholarship",          "effect": "When the Europe Award is given, gain 1 TRP for each multi-space country in which you control a Prestige space (max 3)." },
    { "num": 15, "side": 1, "era": [ 1 ],       "abilities": 2, "name": "Pitt the Elder",              "keywords": [ 2 ],    "keylabel": "Governance",           "effect": "Once per turn, when taking a Diplomatic action, you receive 1 extra [@1] that you may spend on shifting non-Prestige Political spaces.\n\nOnce per turn, you may pay 2 [@2] to construct a new Squadron (instead of the usual 4)." },
    { "num": 16, "side": 1, "era": [ 1 ],       "abilities": 1, "name": "Charles Hanbury Williams",    "keywords": [ 3 ],    "keylabel": "Style",                "effect": "Once per turn, FR-flagged spaces in Prussia, German States, and Russia cost you 1 less [@1] to unflag for one Action Round." },
    { "num": 17, "side": 1, "era": [ 1, 2 ],    "abilities": 1, "name": "Merchant Banks",              "keywords": [ 0 ],    "keylabel": "Finance",              "effect": "Ignore the first 2 Debt you take as [@0] each Peace turn, provided you use the Debt. (If this ability is available, you may use it even while at your Debt Limit.)" },
    { "num": 18, "side": 1, "era": [ 1, 2 ],    "abilities": 1, "name": "Samuel Johnson",              "keywords": [ 4 ],    "keylabel": "Scholarship",          "effect": "The Award for Europe is worth 1 extra VP to you, and 1 less VP to France (minimum 0)." },

    { "num": 19, "side": 1, "era": [ 2 ],       "abilities": 1, "name": "James Watt",                  "keywords": [ 4 ],    "keylabel": "Scholarship",          "effect": "If you are forced to take Debt in excess of your Debt Limit, your opponent scores no VP.\n\nThe first time each Action Round your opponent exhausts an Advantage, gain 1 TRP." },
    { "num": 20, "side": 1, "era": [ 2 ],       "abilities": 1, "name": "Papacy-Hanover Negotiations", "keywords": [ 3 ],    "keylabel": "Style",                "effect": "Remove the Jacobite Uprisings Ministry card from the game.\n\nOnce per turn, when taking a Diplomatic action, you receive 2 [@1] usable only to shift spaces in Scotland and Ireland." },
    { "num": 21, "side": 1, "era": [ 2 ],       "abilities": 1, "name": "Townshend Acts",              "keywords": [ 1 ],    "keylabel": "Mercantilism",         "effect": "Once per turn, at the start of an Action Round, place the Townshend Acts marker on a commodity on the Global Demand display. You may use Minor Actions to unflag that commodity's Markets this turn." },
    { "num": 22, "side": 1, "era": [ 2 ],       "abilities": 1, "name": "Edmund Burke",                "keywords": [ 2 ],    "keylabel": "Governance",           "effect": "Major Diplomatic Actions spent entirely in Europe are worth up to 2 extra [@1]: one for each Ireland space you control.\n\nSons of Liberty and USA spaces cost 1 less [@1] for you to shift." },
    { "num": 23, "side": 0, "era": [ 2 ],       "abilities": 1, "name": "Turgot",                      "keywords": [ 0, 3 ], "keylabel": "Finance, Style",       "effect": "The first Debt you take each Action Round is worth 1 extra Action Point, provided you have more Available Debt than the British." },
    { "num": 24, "side": 0, "era": [ 2 ],       "abilities": 1, "name": "North American Trade",        "keywords": [ 1 ],    "keylabel": "Mercantilism",         "effect": "If you control more Fur and Fish Markets (combined) than your opponent at the start of your Action Round, your Economic Major and Minor Actions are worth 1 extra [@0].\n\nRefresh your Huguenots markers, if you have any on the map." },
    { "num": 25, "side": 0, "era": [ 2 ],       "abilities": 1, "name": "Marquis de Condorcet",        "keywords": [ 2 ],    "keylabel": "Governance",           "effect": "Once per turn, at the start of your Action Round, you can play an Event even if your selected Investment Tile does not have an event symbol. You must still match the Event's type, if it has one, to the Major Action on your Investment Tile." },
    { "num": 26, "side": 0, "era": [ 2 ],       "abilities": 1, "name": "Lavoisier",                   "keywords": [ 4 ],    "keylabel": "Scholarship",          "effect": "On any Action Round you play an Event with a Bonus effect, and you receive that Bonus effect, your Major and Minor Actions from Investment tiles are worth 1 extra Action Point." },
]

data.investments = [
    { "num" :  0, "majortype" : 0, "majorval": 4, "minortype" : 1, "minorval" : 2, "name": "4 Economic major, 2 Diplomatic minor" },                          // 4 econ, 2 diplo
    { "num" :  1, "majortype" : 0, "majorval": 4, "minortype" : 1, "minorval" : 2, "name": "4 Economic major, 2 Diplomatic minor" },
    { "num" :  2, "majortype" : 0, "majorval": 4, "minortype" : 2, "minorval" : 2, "name": "4 Economic major, 2 Military minor" },                            // 4 econ, 2 mil
    { "num" :  3, "majortype" : 0, "majorval": 4, "minortype" : 2, "minorval" : 2, "name": "4 Economic major, 2 Military minor" },
    { "num" :  4, "majortype" : 0, "majorval": 3, "minortype" : 1, "minorval" : 2, "name": "3 Economic major, 2 Diplomatic minor, Event" },                   // 3 econ, 2 diplo
    { "num" :  5, "majortype" : 0, "majorval": 3, "minortype" : 2, "minorval" : 2, "name": "3 Economic major, 2 Military minor, Event" },                     // 3 econ, 2 mil
    { "num" :  6, "majortype" : 0, "majorval": 2, "minortype" : 1, "minorval" : 2, "name": "2 Economic major, 2 Diplomatic minor, Event, Military Upgrade" }, // 2 econ, 2 diplo
    { "num" :  7, "majortype" : 0, "majorval": 2, "minortype" : 2, "minorval" : 2, "name": "2 Economic major, 2 Military minor, Event, Military Upgrade" },   // 2 econ, 2 mil

    { "num" :  8, "majortype" : 1, "majorval": 4, "minortype" : 0, "minorval" : 2, "name": "4 Diplomatic major, 2 Economic minor" },                          // 4 diplo, 2 econ
    { "num" :  9, "majortype" : 1, "majorval": 4, "minortype" : 0, "minorval" : 2, "name": "4 Diplomatic major, 2 Economic minor" },
    { "num" : 10, "majortype" : 1, "majorval": 4, "minortype" : 2, "minorval" : 2, "name": "4 Diplomatic major, 2 Military minor" },                          // 4 diplo, 2 mil
    { "num" : 11, "majortype" : 1, "majorval": 4, "minortype" : 2, "minorval" : 2, "name": "4 Diplomatic major, 2 Military minor" },
    { "num" : 12, "majortype" : 1, "majorval": 3, "minortype" : 0, "minorval" : 2, "name": "3 Diplomatic major, 2 Economic minor, Event" },                   // 3 diplo, 2 econ
    { "num" : 13, "majortype" : 1, "majorval": 3, "minortype" : 2, "minorval" : 2, "name": "3 Diplomatic major, 2 Military minor, Event" },                   // 3 diplo, 2 mil
    { "num" : 14, "majortype" : 1, "majorval": 2, "minortype" : 0, "minorval" : 2, "name": "2 Diplomatic major, 2 Economic minor, Event, Military Upgrade" }, // 2 diplo, 2 econ
    { "num" : 15, "majortype" : 1, "majorval": 2, "minortype" : 2, "minorval" : 2, "name": "2 Diplomatic major, 2 Military minor, Event, Military Upgrade" }, // 2 diplo, 2 mil

    { "num" : 16, "majortype" : 2, "majorval": 4, "minortype" : 0, "minorval" : 2, "name": "4 Military major, 2 Economic minor" },                            // 4 mil, 2 econ
    { "num" : 17, "majortype" : 2, "majorval": 4, "minortype" : 0, "minorval" : 2, "name": "4 Military major, 2 Economic minor" },
    { "num" : 18, "majortype" : 2, "majorval": 4, "minortype" : 1, "minorval" : 2, "name": "4 Military major, 2 Diplomatic minor" },                          // 4 mil, 2 diplo
    { "num" : 19, "majortype" : 2, "majorval": 4, "minortype" : 1, "minorval" : 2, "name": "4 Military major, 2 Diplomatic minor" },
    { "num" : 20, "majortype" : 2, "majorval": 3, "minortype" : 0, "minorval" : 2, "name": "3 Military major, 2 Economic minor, Event" },                     // 3 mil, 2 econ
    { "num" : 21, "majortype" : 2, "majorval": 3, "minortype" : 1, "minorval" : 2, "name": "3 Military major, 2 Diplomatic minor, Event" },                   // 3 mil, 2 diplo
    { "num" : 22, "majortype" : 2, "majorval": 2, "minortype" : 0, "minorval" : 2, "name": "2 Military major, 2 Economic minor, Event, Military Upgrade" },   // 2 mil, 2 econ
    { "num" : 23, "majortype" : 2, "majorval": 2, "minortype" : 1, "minorval" : 2, "name": "2 Military major, 2 Diplomatic minor, Event, Military Upgrade" }  // 2 mil, 2 diplo
]

data.basic_war_tiles = [
    // French basic war tiles
    { "num" :  0, "side": 0, "val":  2, "type": 0 }, // +2 tile, x3
    { "num" :  1, "side": 0, "val":  2, "type": 0 },
    { "num" :  2, "side": 0, "val":  2, "type": 0 },
    { "num" :  3, "side": 0, "val":  1, "type": 0 }, // +1 tile, x4
    { "num" :  4, "side": 0, "val":  1, "type": 0 },
    { "num" :  5, "side": 0, "val":  1, "type": 0 },
    { "num" :  6, "side": 0, "val":  1, "type": 0 },
    { "num" :  7, "side": 0, "val":  0, "type": 1 }, // 0 w/ Debt, x4
    { "num" :  8, "side": 0, "val":  0, "type": 1 },
    { "num" :  9, "side": 0, "val":  0, "type": 1 },
    { "num" : 10, "side": 0, "val":  0, "type": 1 },
    { "num" : 11, "side": 0, "val":  0, "type": 2 }, // 0 w/ Fort, x2
    { "num" : 12, "side": 0, "val":  0, "type": 2 },
    { "num" : 13, "side": 0, "val": -1, "type": 3 }, // -1 w/ Flag x3
    { "num" : 14, "side": 0, "val": -1, "type": 3 },
    { "num" : 15, "side": 0, "val": -1, "type": 3 },

    // British basic war tiles
    { "num" : 16, "side": 1, "val":  2, "type": 0 }, // +2 tile, x3
    { "num" : 17, "side": 1, "val":  2, "type": 0 },
    { "num" : 18, "side": 1, "val":  2, "type": 0 },
    { "num" : 19, "side": 1, "val":  1, "type": 0 }, // +1 tile, x4
    { "num" : 20, "side": 1, "val":  1, "type": 0 },
    { "num" : 21, "side": 1, "val":  1, "type": 0 },
    { "num" : 22, "side": 1, "val":  1, "type": 0 },
    { "num" : 23, "side": 1, "val":  0, "type": 1 }, // 0 w/ Debt, x4
    { "num" : 24, "side": 1, "val":  0, "type": 1 },
    { "num" : 25, "side": 1, "val":  0, "type": 1 },
    { "num" : 26, "side": 1, "val":  0, "type": 1 },
    { "num" : 27, "side": 1, "val":  0, "type": 2 }, // 0 w/ Fort, x2
    { "num" : 28, "side": 1, "val":  0, "type": 2 },
    { "num" : 29, "side": 1, "val": -1, "type": 3 }, // -1 w/ Flag x3
    { "num" : 30, "side": 1, "val": -1, "type": 3 },
    { "num" : 31, "side": 1, "val": -1, "type": 3 }
]

data.bonus_war_tiles = [
    // French WSS bonus tiles
    { "num" :  0, "side": 0, "val": 3, "type": 0, "war" : 0, "warid": "WSS", "name": "Vendôme" },               // +3
    { "num" :  1, "side": 0, "val": 3, "type": 0, "war" : 0, "warid": "WSS", "name": "de Villars" },
    { "num" :  2, "side": 0, "val": 2, "type": 0, "war" : 0, "warid": "WSS", "name": "Berwick" },               // +2
    { "num" :  3, "side": 0, "val": 2, "type": 0, "war" : 0, "warid": "WSS", "name": "Cadiz Refused" },
    { "num" :  4, "side": 0, "val": 2, "type": 0, "war" : 0, "warid": "WSS", "name": "d'Estrées" },
    { "num" :  5, "side": 0, "val": 2, "type": 0, "war" : 0, "warid": "WSS", "name": "Musketeers" },
    { "num" :  6, "side": 0, "val": 1, "type": 0, "war" : 0, "warid": "WSS", "name": "d'Artagnan" },            // +1
    { "num" :  7, "side": 0, "val": 1, "type": 0, "war" : 0, "warid": "WSS", "name": "Maison du Roi" },
    { "num" :  8, "side": 0, "val": 1, "type": 1, "war" : 0, "warid": "WSS", "name": "Boufflers" },             // +1, Debt
    { "num" :  9, "side": 0, "val": 1, "type": 1, "war" : 0, "warid": "WSS", "name": "de Tessé" },
    { "num" : 10, "side": 0, "val": 1, "type": 2, "war" : 0, "warid": "WSS", "name": "Crack Troops" },          // +1, Fort
    { "num" : 11, "side": 0, "val": 1, "type": 2, "war" : 0, "warid": "WSS", "name": "Ultima Ratio Regum" },

    // British WSS bonus tiles
    { "num" : 12, "side": 1, "val": 3, "type": 0, "war" : 0, "warid": "WSS", "name": "Marlborough" },           // +3
    { "num" : 13, "side": 1, "val": 3, "type": 0, "war" : 0, "warid": "WSS", "name": "Prince Eugene" },
    { "num" : 14, "side": 1, "val": 2, "type": 0, "war" : 0, "warid": "WSS", "name": "Church" },                // +2
    { "num" : 15, "side": 1, "val": 2, "type": 0, "war" : 0, "warid": "WSS", "name": "Galway" },
    { "num" : 16, "side": 1, "val": 2, "type": 0, "war" : 0, "warid": "WSS", "name": "Rooke" },
    { "num" : 17, "side": 1, "val": 2, "type": 0, "war" : 0, "warid": "WSS", "name": "Savoy Defects" },
    { "num" : 18, "side": 1, "val": 1, "type": 0, "war" : 0, "warid": "WSS", "name": "Foot Guards" },           // +1
    { "num" : 19, "side": 1, "val": 1, "type": 0, "war" : 0, "warid": "WSS", "name": "United Parliament" },
    { "num" : 20, "side": 1, "val": 1, "type": 1, "war" : 0, "warid": "WSS", "name": "Huguenot Rebels" },       // +1, Debt
    { "num" : 21, "side": 1, "val": 1, "type": 1, "war" : 0, "warid": "WSS", "name": "Prize Hunting" },
    { "num" : 22, "side": 1, "val": 1, "type": 2, "war" : 0, "warid": "WSS", "name": "Leopold" },               // +1, Fort
    { "num" : 23, "side": 1, "val": 1, "type": 2, "war" : 0, "warid": "WSS", "name": "Louis William" },

    // French WAS bonus tiles
    { "num" : 24, "side": 0, "val": 3, "type": 0, "war" : 1, "warid": "WAS", "name": "Frederick" },             // +3
    { "num" : 25, "side": 0, "val": 3, "type": 0, "war" : 1, "warid": "WAS", "name": "Saxe" },
    { "num" : 26, "side": 0, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "Bonny Prince Charlie" },  // +2
    { "num" : 27, "side": 0, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "Castries" },
    { "num" : 28, "side": 0, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "de la Bourdonnais" },
    { "num" : 29, "side": 0, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "Murray" },
    { "num" : 30, "side": 0, "val": 1, "type": 0, "war" : 1, "warid": "WAS", "name": "Contades" },              // +1
    { "num" : 31, "side": 0, "val": 1, "type": 0, "war" : 1, "warid": "WAS", "name": "O'Sullivan" },
    { "num" : 32, "side": 0, "val": 1, "type": 1, "war" : 1, "warid": "WAS", "name": "de Coigny" },             // +1, Debt
    { "num" : 33, "side": 0, "val": 1, "type": 1, "war" : 1, "warid": "WAS", "name": "Nizam's Favor" },
    { "num" : 34, "side": 0, "val": 1, "type": 2, "war" : 1, "warid": "WAS", "name": "Lowendal" },              // +1, Fort
    { "num" : 35, "side": 0, "val": 1, "type": 2, "war" : 1, "warid": "WAS", "name": "von Schwerin" },

    // British WAS bonus tiles
    { "num" : 36, "side": 1, "val": 3, "type": 0, "war" : 1, "warid": "WAS", "name": "Clive" },                 // +3
    { "num" : 37, "side": 1, "val": 3, "type": 0, "war" : 1, "warid": "WAS", "name": "Stair" },
    { "num" : 38, "side": 1, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "Boscawen" },              // +2
    { "num" : 39, "side": 1, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "Francois de Bussy" },
    { "num" : 40, "side": 1, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "Treaty of Warsaw" },
    { "num" : 41, "side": 1, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "Warren" },
    { "num" : 42, "side": 1, "val": 1, "type": 0, "war" : 1, "warid": "WAS", "name": "de Lorraine" },           // +1
    { "num" : 43, "side": 1, "val": 1, "type": 0, "war" : 1, "warid": "WAS", "name": "King George II" },
    { "num" : 44, "side": 1, "val": 1, "type": 1, "war" : 1, "warid": "WAS", "name": "Chaos in Bavaria" },      // +1, Debt
    { "num" : 45, "side": 1, "val": 1, "type": 1, "war" : 1, "warid": "WAS", "name": "Hungarian Enthusiasm" },
    { "num" : 46, "side": 1, "val": 1, "type": 2, "war" : 1, "warid": "WAS", "name": "Lawrence" },              // +1, Fort
    { "num" : 47, "side": 1, "val": 1, "type": 2, "war" : 1, "warid": "WAS", "name": "Seckendorff" },

    // French 7YW bonus tiles
    { "num" : 48, "side": 0, "val": 3, "type": 0, "war" : 2, "warid": "7YW", "name": "Castries" },              // +3
    { "num" : 49, "side": 0, "val": 3, "type": 0, "war" : 2, "warid": "7YW", "name": "Montcalm" },
    { "num" : 50, "side": 0, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Bougainville" },          // +2
    { "num" : 51, "side": 0, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Coureurs des bois" },
    { "num" : 52, "side": 0, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Nawabs Rally" },
    { "num" : 53, "side": 0, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Villiers" },
    { "num" : 54, "side": 0, "val": 1, "type": 0, "war" : 2, "warid": "7YW", "name": "Broglie" },               // +1
    { "num" : 55, "side": 0, "val": 1, "type": 0, "war" : 2, "warid": "7YW", "name": "Lally" },
    { "num" : 56, "side": 0, "val": 1, "type": 1, "war" : 2, "warid": "7YW", "name": "Beaujeu" },               // +1, Debt
    { "num" : 57, "side": 0, "val": 1, "type": 1, "war" : 2, "warid": "7YW", "name": "Hadik's Raid" },
    { "num" : 58, "side": 0, "val": 1, "type": 2, "war" : 2, "warid": "7YW", "name": "Chevert" },               // +1, Fort
    { "num" : 59, "side": 0, "val": 1, "type": 2, "war" : 2, "warid": "7YW", "name": "Monongahela Ambush" },

    // British 7YW bonus tiles
    { "num" : 60, "side": 1, "val": 3, "type": 0, "war" : 2, "warid": "7YW", "name": "Clive" },                 // +3
    { "num" : 61, "side": 1, "val": 3, "type": 0, "war" : 2, "warid": "7YW", "name": "Old Fritz" },
    { "num" : 62, "side": 1, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Amherst" },               // +2
    { "num" : 63, "side": 1, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Coote" },
    { "num" : 64, "side": 1, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Morta la Bestia" },
    { "num" : 65, "side": 1, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Wolfe" },
    { "num" : 66, "side": 1, "val": 1, "type": 0, "war" : 2, "warid": "7YW", "name": "Granby" },                // +1
    { "num" : 67, "side": 1, "val": 1, "type": 0, "war" : 2, "warid": "7YW", "name": "Sepoy Veterans" },
    { "num" : 68, "side": 1, "val": 1, "type": 1, "war" : 2, "warid": "7YW", "name": "Damned Audacity" },       // +1, Debt
    { "num" : 69, "side": 1, "val": 1, "type": 1, "war" : 2, "warid": "7YW", "name": "Johnson" },
    { "num" : 70, "side": 1, "val": 1, "type": 2, "war" : 2, "warid": "7YW", "name": "Bradstreet" },            // +1, Fort
    { "num" : 71, "side": 1, "val": 1, "type": 2, "war" : 2, "warid": "7YW", "name": "Monckton" },

    // French AWI bonus tiles
    { "num" : 72, "side": 0, "val": 3, "type": 0, "war" : 3, "warid": "AWI", "name": "Lafayette" },             // +3
    { "num" : 73, "side": 0, "val": 3, "type": 0, "war" : 3, "warid": "AWI", "name": "Washington" },
    { "num" : 74, "side": 0, "val": 2, "type": 0, "war" : 3, "warid": "AWI", "name": "Arnold" },                // +2
    { "num" : 75, "side": 0, "val": 2, "type": 0, "war" : 3, "warid": "AWI", "name": "East River Wind" },
    { "num" : 76, "side": 0, "val": 2, "type": 0, "war" : 3, "warid": "AWI", "name": "Greene" },
    { "num" : 77, "side": 0, "val": 2, "type": 0, "war" : 3, "warid": "AWI", "name": "von Steuben" },
    { "num" : 78, "side": 0, "val": 1, "type": 0, "war" : 3, "warid": "AWI", "name": "de Grasse" },             // +1
    { "num" : 79, "side": 0, "val": 1, "type": 0, "war" : 3, "warid": "AWI", "name": "Rochambeau" },
    { "num" : 80, "side": 0, "val": 1, "type": 1, "war" : 3, "warid": "AWI", "name": "Bunker Hill" },           // +1, Debt
    { "num" : 81, "side": 0, "val": 1, "type": 1, "war" : 3, "warid": "AWI", "name": "Castelnau" },
    { "num" : 82, "side": 0, "val": 1, "type": 2, "war" : 3, "warid": "AWI", "name": "Morgan's Rifles" },       // +1, Fort
    { "num" : 83, "side": 0, "val": 1, "type": 2, "war" : 3, "warid": "AWI", "name": "de Suffren" },

    // British AWI bonus tiles
    { "num" : 84, "side": 1, "val": 3, "type": 0, "war" : 3, "warid": "AWI", "name": "Coote" },                 // +3
    { "num" : 85, "side": 1, "val": 3, "type": 0, "war" : 3, "warid": "AWI", "name": "Rodney" },
    { "num" : 86, "side": 1, "val": 2, "type": 0, "war" : 3, "warid": "AWI", "name": "Anglo-Dutch Conflict" },  // +2
    { "num" : 87, "side": 1, "val": 2, "type": 0, "war" : 3, "warid": "AWI", "name": "Carleton" },
    { "num" : 88, "side": 1, "val": 2, "type": 0, "war" : 3, "warid": "AWI", "name": "Hessians" },
    { "num" : 89, "side": 1, "val": 2, "type": 0, "war" : 3, "warid": "AWI", "name": "Howe" },
    { "num" : 90, "side": 1, "val": 1, "type": 0, "war" : 3, "warid": "AWI", "name": "Cornplanter" },           // +1
    { "num" : 91, "side": 1, "val": 1, "type": 0, "war" : 3, "warid": "AWI", "name": "Cornwallis" },
    { "num" : 92, "side": 1, "val": 1, "type": 1, "war" : 3, "warid": "AWI", "name": "Brant's Volunteers" },    // +1, Debt
    { "num" : 93, "side": 1, "val": 1, "type": 1, "war" : 3, "warid": "AWI", "name": "Stuart" },
    { "num" : 94, "side": 1, "val": 1, "type": 2, "war" : 3, "warid": "AWI", "name": "André" },                 // +1, Fort
    { "num" : 95, "side": 1, "val": 1, "type": 2, "war" : 3, "warid": "AWI", "name": "Arnold's Treason" },

	{ "num" : 96, "side": 0, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Atlantic Dominance" },	// +2 Atlantic Dominance
	{ "num" : 97, "side": 1, "val": 2, "type": 0, "war" : 2, "warid": "7YW", "name": "Atlantic Dominance" },
	{ "num" : 98, "side": 1, "val": 2, "type": 0, "war" : 1, "warid": "WAS", "name": "Byng" },
]

// ADVANTAGE TILES
data.advantages = [
	{ "num":  0, "name": "Baltic Trade",		    req: [ DENMARK, PRUSSIA_1 ],            "desc": "Reduce your debt by 2" },
	{ "num":  1, "name": "Central Europe Conflict",	req: [ GERMAN_STATES_2, BAVARIA ],      "desc": "Place a conflict marker in an alliance space in Europe" },
	{ "num":  2, "name": "German Diplomacy",	    req: [ PRUSSIA_4 ],                     "desc": "Pay one [@1] total to unflag Russia, Sweden, or Bavaria" },
	{ "num":  3, "name": "Italy Influence",		    req: [ AUSTRIA_3, SARDINIA ],           "desc": "Pay one [@1] total to unflag a space in Spain or Austria" },
	{ "num":  4, "name": "Mediterranean Intrigue",	req: [ SAVOY, SPAIN_4 ],                "desc": "Place a conflict marker in Spain, Austria, or Sardinia" },
	{ "num":  5, "name": "Naval Bastion",		    req: [ GIBRALTAR ],                     "desc": "Pay [@2] to return an enemy squadron to the Navy Box" },
	{ "num":  6, "name": "Silesia Negotiations",	req: [ AUSTRIA_2 ],                     "desc": "Pay one [@1] total to unflag a space in Prussia or the German States" },
	{ "num":  7, "name": "Algonquin Raids",		    req: [ ALGONQUIN ],                     "desc": "Place a conflict marker in a fur market" },
	{ "num":  8, "name": "Fur Trade",		        req: [ HUDSON_BAY ],                    "desc": "Pay one [@0] total to unflag a market in North America" },
	{ "num":  9, "name": "Iroquois Raids",		    req: [ IROQUOIS ],                      "desc": "Place a conflict marker in a fur market" },
	{ "num": 10, "name": "Patriot Agitation",	    req: [ SONS_OF_LIBERTY ],               "desc": "Place a conflict marker in a market or local alliance space in North America" },
	{ "num": 11, "name": "Wheat",			        req: [ CHESAPEAKE ],                    "desc": "-1 [@0] to unflag a market in North America" },
	{ "num": 12, "name": "Fruit",			        req: [ SAN_AGUSTIN ],                   "desc": "-1 [@0] to unflag a market in the Caribbean" },
	{ "num": 13, "name": "Letters of Marque",	    req: [ PRIVATEERS ],                    "desc": "Place a conflict marker in an unprotected Caribbean market" },
	{ "num": 14, "name": "Pirate Havens",		    req: [ BUCCANEERS ],                    "desc": "Place a conflict marker in an unprotected Caribbean market" },
	{ "num": 15, "name": "Rum",			            req: [ PUERTO_RICO ],                   "desc": "-1 [@0] to unflag a market in the Caribbean" },
	{ "num": 16, "name": "Slaving Contracts",	    req: [ ASIENTO ],                       "desc": "Pay 2 [@2] to construct a squadron" },
	{ "num": 17, "name": "Power Struggle",		    req: [ MYSORE ],                        "desc": "Place a conflict marker in a Carnatic Coast market" },
	{ "num": 18, "name": "Raids & Incursions",	    req: [ MARATHA ],                       "desc": "Place a conflict marker in an Indian market" },
	{ "num": 19, "name": "Separatist Wars",		    req: [ NIZAM ],                         "desc": "Place a conflict marker in a cotton market" },
	{ "num": 20, "name": "Silk",			        req: [ WEST_BENGAL ],                   "desc": "-1 [@0] to unflag a market in India" },
	{ "num": 21, "name": "Textiles",		        req: [ TIRUCHIRAPPALLI ],               "desc": "-1 [@0] to unflag a market in India" }
]

data.space_types = [
	{ "num": 0, "name" : "Political" },
	{ "num": 1, "name" : "Market" },
	{ "num": 2, "name" : "Naval" },
	{ "num": 3, "name" : "Territory" },
	{ "num": 4, "name" : "Fort" }
]

data.spaces = [
    // EUROPE
    { "layout": "Ireland_1" ,              "num":   0, "name": "Ireland - alliance",       "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 0, "alliance": [ [ 1, 4 ], [ 2, 4 ] ] },
    { "layout": "Ireland_2" ,              "num":   1, "name": "Ireland - prestige",       "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 4, "alliance": [ ], },
    { "layout": "Scotland_1",              "num":   2, "name": "Scotland - alliance",      "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 4, "alliance": [ [ 1, 4 ], [ 2, 4 ] ] },
    { "layout": "Scotland_2",              "num":   3, "name": "Scotland - prestige",      "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 4, "alliance": [ ], },
    { "layout": "Denmark",                 "num":   4, "name": "Denmark · Norway",         "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 4, "alliance": [ [ 1, 1 ], [ 2, 1 ], [ 3, 4 ] ] },
    { "layout": "Prussia_1",               "num":   5, "name": "Prussia - alliance",       "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 4, "alliance": [ [ 2, 1 ], [ 3, 4 ] ] },
    { "layout": "Prussia_2",               "num":   6, "name": "Prussia - prestige",       "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 4, "alliance": [ ], },
    { "layout": "Prussia_3",               "num":   7, "name": "Prussia - empire alliance","era": 1, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 4, "alliance": [ [ 2, 1 ], [ 3, 4 ] ] },
    { "layout": "Prussia_4",               "num":   8, "name": "Prussia - empire prestige","era": 1, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 4, "alliance": [ ], },
    { "layout": "Sweden",                  "num":   9, "name": "Sweden",                   "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 2, "flag": 4, "alliance": [ [ 2, 1 ], [ 3, 4 ] ] },
    { "layout": "Russia",                  "num":  10, "name": "Russia",                   "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 4, "alliance": [ [ 3, 4 ] ] },
    { "layout": "Dutch_1",                 "num":  11, "name": "Dutch Republic (2)",       "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 4, "alliance": [ [ 1, 1 ], [ 1, 4 ], [ 2, 1 ], [ 3, 4 ] ] },
    { "layout": "Dutch_2",                 "num":  12, "name": "Dutch Republic (3)",       "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 1, "alliance": [ ], },
    { "layout": "German_States_1",         "num":  13, "name": "German States · Saxony",   "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 4, "alliance": [ [ 1, 1 ], [ 2, 1 ], [ 3, 4 ], [ 4, 1 ] ] },
    { "layout": "German_States_2",         "num":  14, "name": "German States · Saxony",   "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 3, "flag": 1, "alliance": [ [ 1, 1 ], [ 2, 1 ], [ 3, 4 ], [ 4, 1 ] ] },
    { "layout": "Bavaria",                 "num":  15, "name": "Bavaria",                  "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 3, "flag": 0, "alliance": [ [ 1, 1 ], [ 2, 1 ], [ 3, 4 ] ] },
    { "layout": "Austria_1",               "num":  16, "name": "Austria - alliance (2)",   "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 1, "alliance": [ [ 1, 1 ], [ 2, 1 ], [ 3, 4 ] ] },
    { "layout": "Austria_2",               "num":  17, "name": "Austria - prestige",       "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 4, "alliance": [ ], },
    { "layout": "Austria_3",               "num":  18, "name": "Austria - alliance (3)",   "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 3, "flag": 4, "alliance": [ [ 1, 1 ], [ 2, 1 ], [ 3, 4 ] ] },
    { "layout": "Austria_4",               "num":  19, "name": "Austria - prestige",       "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 0, "alliance": [ ], },
    { "layout": "Sardinia",                "num":  20, "name": "Sardinia",                 "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 4, "alliance": [ [ 1, 2 ] ] },
    { "layout": "Savoy",                   "num":  21, "name": "Savoy",                    "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 2, "flag": 4, "alliance": [ [ 1, 1 ] ] },
    { "layout": "Spain_1",                 "num":  22, "name": "Spain - alliance",         "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 3, "flag": 0, "alliance": [ [ 1, 2 ], [ 3, 3 ], [ 4, 1 ], [ 4, 3 ] ] },
    { "layout": "Spain_2",                 "num":  23, "name": "Spain - prestige (2)",     "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 2, "flag": 4, "alliance": [ ], },
    { "layout": "Spain_3",                 "num":  24, "name": "Spain - alliance",         "era": 0, "region": 0, "type": 0, "prestige": false, "cost": 3, "flag": 4, "alliance": [ [ 1, 2 ], [ 3, 3 ], [ 4, 1 ], [ 4, 3 ] ] },
    { "layout": "Spain_4",                 "num":  25, "name": "Spain - prestige (3)",     "era": 0, "region": 0, "type": 0, "prestige": true,  "cost": 3, "flag": 4, "alliance": [ ], },
    { "layout": "Gibraltar",               "num":  26, "name": "Gibraltar",                "era": 0, "region": 0, "type": 3, "prestige": false, "cost": 1, "flag": 4, "alliance": [ ], },
    { "layout": "Minorca",                 "num":  27, "name": "Minorca",                  "era": 0, "region": 0, "type": 3, "prestige": true,  "cost": 1, "flag": 4, "alliance": [ ], },
    { "layout": "Biscay",                  "num":  28, "name": "Biscay",                   "era": 0, "region": 0, "type": 2, "prestige": true,  "cost": 0, "flag": 4, "alliance": [ [ 1, 2 ], [ 3, 1 ] ] },
    { "layout": "Balearic",                "num":  29, "name": "Balearic",                 "era": 0, "region": 0, "type": 2, "prestige": true,  "cost": 0, "flag": 4, "alliance": [ [ 1, 2 ], [ 3, 1 ] ] },

    // NORTH AMERICA
    { "layout": "Algonquin",               "num":  30, "name": "Algonquin",               "era": 0, "region": 1, "subreg": 0, "type": 0, "prestige": false, "cost": 2, "flag": 0,                                                                                                                                                                                       "alliance": [ ], },
    { "layout": "Hudson Bay",              "num":  31, "name": "Hudson Bay",              "era": 0, "region": 1, "subreg": 0, "type": 3, "prestige": false, "cost": 1, "flag": 4,              "connects": [ YORK_FACTORY ], },
    { "layout": "York Factory",            "num":  32, "name": "York Factory",            "era": 0, "region": 1, "subreg": 0, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 0, "connects": [ HUDSON_BAY ], },
    { "layout": "Quebec & Montreal",       "num":  33, "name": "Québec & Montréal",       "era": 0, "region": 1, "subreg": 0, "type": 3, "prestige": false, "cost": 1, "flag": 0,              "connects": [ GULF_OF_ST_LAWRENCE, CATARAQUI, ILE_AUX_NOIX ],                               "conquest": [ LOUISBOURG, CHAMPLAIN_VALLEY, OHIO_FORKS] },
    { "layout": "Gulf of St. Lawrence",    "num":  34, "name": "Gulf of St. Lawrence",    "era": 0, "region": 1, "subreg": 0, "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 2, "connects": [ QUEBEC_AND_MONTREAL, CABOT_STRAIT, LOUISBOURG, GEORGES_BANK ] },
    { "layout": "Cabot Strait",            "num":  35, "name": "Cabot Strait",            "era": 0, "region": 1, "subreg": 0, "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ GULF_OF_ST_LAWRENCE, LOUISBOURG ],                                                                                                                         "alliance": [ [ 1, 3 ], [ 2, 2 ], [ 3, 1 ], [ 3, 3 ], [ 4, 1 ] ] },
    { "layout": "Louisbourg",              "num":  36, "name": "Louisbourg",              "era": 0, "region": 1, "subreg": 0, "type": 4, "prestige": false, "cost": 3, "flag": 4,              "connects": [ GULF_OF_ST_LAWRENCE, CABOT_STRAIT, ACADIA, NORTHEAST_CHANNEL, GEORGES_BANK ], "conquest": [ QUEBEC_AND_MONTREAL, HALIFAX, ACADIA ],                        "alliance": [ [ 1, 3 ], [ 2, 2 ], [ 3, 3 ], [ 4, 1 ] ] },
    { "layout": "Acadia",                  "num":  37, "name": "Acadia",                  "era": 0, "region": 1, "subreg": 0, "type": 3, "prestige": false, "cost": 1, "flag": 0,              "connects": [ LOUISBOURG, NORTHEAST_CHANNEL ],                                              "conquest": [ LOUISBOURG ] },
    { "layout": "Northeast Channel",       "num":  38, "name": "Northeast Channel",       "era": 0, "region": 1, "subreg": 0, "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 2, "connects": [ LOUISBOURG, ACADIA, HALIFAX, GEORGES_BANK ] },
    { "layout": "Halifax",                 "num":  39, "name": "Halifax",                 "era": 0, "region": 1, "subreg": 1, "type": 4, "prestige": false, "cost": 3, "flag": 4,              "connects": [ NORTHEAST_CHANNEL, GEORGES_BANK, GULF_OF_MAINE ],                             "conquest": [ LOUISBOURG, NORTHERN_COLONIES ],                               "alliance": [ [ 1, 3 ], [ 2, 2 ], [ 3, 3 ], [ 4, 1 ] ] },
    { "layout": "Georges Bank",            "num":  40, "name": "Georges Bank",            "era": 0, "region": 1, "subreg": 0, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 2, "connects": [ GULF_OF_ST_LAWRENCE, LOUISBOURG, NORTHEAST_CHANNEL, HALIFAX, GULF_OF_MAINE, MASS_BAY, ATLANTIC_PASSAGE ] },
    { "layout": "Atlantic Passage",        "num":  41, "name": "Atlantic Passage",        "era": 0, "region": 1, "subreg": 1, "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ GEORGES_BANK ],                                                                                                                                            "alliance": [ [ 1, 3 ], [ 2, 2 ], [ 3, 1 ], [ 3, 3 ], [ 4, 1 ] ] },
    { "layout": "Gulf of Maine",           "num":  42, "name": "Gulf of Maine",           "era": 0, "region": 1, "subreg": 1, "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ HALIFAX, GEORGES_BANK, MASS_BAY ],                                                                                                                         "alliance": [ [ 1, 3 ], [ 2, 2 ], [ 3, 1 ], [ 3, 3 ], [ 4, 1 ] ] },
    { "layout": "Mass. Bay",               "num":  43, "name": "Massachusetts Bay",       "era": 0, "region": 1, "subreg": 1, "type": 1, "prestige": false, "cost": 3, "flag": 1, "market": 2, "connects": [ GULF_OF_MAINE, GEORGES_BANK, NORTHERN_COLONIES ] },
    { "layout": "Northern Colonies",       "num":  44, "name": "Northern Colonies",       "era": 0, "region": 1, "subreg": 1, "type": 3, "prestige": false, "cost": 1, "flag": 1,              "connects": [ MASS_BAY, HUDSON_VALLEY, CHESAPEAKE, CUMBERLAND ],                            "conquest": [ HALIFAX, CHAMPLAIN_VALLEY, OHIO_FORKS ] },
    { "layout": "Chesapeake",              "num":  45, "name": "Chesapeake",              "era": 0, "region": 1, "subreg": 1, "type": 1, "prestige": false, "cost": 3, "flag": 1,              "connects": [ NORTHERN_COLONIES ] },
    { "layout": "Hudson Valley",           "num":  46, "name": "Hudson Valley",           "era": 0, "region": 1, "subreg": 1, "type": 1, "prestige": false, "cost": 3, "flag": 1, "market": 0, "connects": [ NORTHERN_COLONIES, CUMBERLAND, ALBANY ] },
    { "layout": "Albany",                  "num":  47, "name": "Albany",                  "era": 0, "region": 1, "subreg": 1, "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 0, "connects": [ HUDSON_VALLEY, CUMBERLAND, OSWEGO, CHAMPLAIN_VALLEY, ILE_AUX_NOIX ] },
    { "layout": "Cumberland",              "num":  48, "name": "Cumberland",              "era": 0, "region": 1, "subreg": 1, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 0, "connects": [ NORTHERN_COLONIES, HUDSON_VALLEY, ALBANY, OHIO_FORKS, ALLEGHENY ] },
    { "layout": "Ohio Forks",              "num":  49, "name": "Ohio Forks",              "era": 0, "region": 1, "subreg": 1, "type": 4, "prestige": false, "cost": 3, "flag": 4,              "connects": [ CUMBERLAND, ALLEGHENY, NIAGARA  ],                                            "conquest": [ NORTHERN_COLONIES, QUEBEC_AND_MONTREAL ],                      "alliance": [ [ 1, 3 ], [ 2, 2 ], [ 3, 3 ], [ 4, 1 ] ] },
    { "layout": "Allegheny",               "num":  50, "name": "Allegheny",               "era": 0, "region": 1, "subreg": 1, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 0, "connects": [ CUMBERLAND, OHIO_FORKS, NIAGARA ] },
    { "layout": "Niagara",                 "num":  51, "name": "Niagara",                 "era": 0, "region": 1, "subreg": 1, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 0, "connects": [ ALLEGHENY, OHIO_FORKS, OSWEGO, CATARAQUI, ILE_AUX_NOIX ] },
    { "layout": "Oswego",                  "num":  52, "name": "Oswego",                  "era": 0, "region": 1, "subreg": 1, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 0, "connects": [ ALBANY, NIAGARA, CHAMPLAIN_VALLEY ] },
    { "layout": "Champlain Valley",        "num":  53, "name": "Champlain Valley",        "era": 0, "region": 1, "subreg": 1, "type": 4, "prestige": false, "cost": 4, "flag": 4,              "connects": [ ALBANY, OSWEGO, ILE_AUX_NOIX ],                                               "conquest": [ NORTHERN_COLONIES, QUEBEC_AND_MONTREAL ],                      "alliance": [ [ 1, 3 ], [ 2, 2 ], [ 3, 3 ], [ 4, 1 ] ] },
    { "layout": "Ile aux Noix",            "num":  54, "name": "Île aux Noix",            "era": 0, "region": 1, "subreg": 0, "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 0, "connects": [ QUEBEC_AND_MONTREAL, NIAGARA, CHAMPLAIN_VALLEY, ALBANY ] },
    { "layout": "Cataraqui",               "num":  55, "name": "Cataraqui",               "era": 0, "region": 1, "subreg": 0, "type": 1, "prestige": false, "cost": 2, "flag": 0, "market": 0, "connects": [ NIAGARA, QUEBEC_AND_MONTREAL ] },
    { "layout": "Iroquois",                "num":  56, "name": "Iroquois",                "era": 0, "region": 1, "subreg": 1, "type": 0, "prestige": false, "cost": 2, "flag": 4,                                                                                                                                                                                       "alliance": [ ], },
    { "layout": "Sons of Liberty",         "num":  57, "name": "Sons of Liberty",         "era": 2, "region": 1, "subreg": 1, "type": 0, "prestige": false, "cost": 3, "flag": 4,                                                                                                                                                                                       "alliance": [ [ 4, 1 ] ], },
    { "layout": "USA_Prestige_2",          "num":  58, "name": "USA",                     "era": 2, "region": 1, "subreg": 1, "type": 0, "prestige": true,  "cost": 2, "flag": 4,                                                                                                                                                                                       "alliance": [ ] },
    { "layout": "USA_Prestige_3",          "num":  59, "name": "USA",                     "era": 2, "region": 1, "subreg": 1, "type": 0, "prestige": true,  "cost": 3, "flag": 4,                                                                                                                                                                                       "alliance": [ ] },


    // CARIBBEAN
    { "layout": "Asiento",                 "num":  60, "name": "Asiento",                 "era": 0, "region": 2,              "type": 3, "prestige": false, "cost": 1, "flag": 2, },
    { "layout": "Privateers",              "num":  61, "name": "Privateers",              "era": 0, "region": 2,              "type": 0, "prestige": false, "cost": 2, "flag": 4,                                                                                                                                                                                       "alliance": [ ]  },
    { "layout": "Buccaneers",              "num":  62, "name": "Buccaneers",              "era": 0, "region": 2,              "type": 0, "prestige": false, "cost": 2, "flag": 4,                                                                                                                                                                                       "alliance": [ ], },
    { "layout": "Carolinas",               "num":  63, "name": "Carolinas",               "era": 0, "region": 2,              "type": 3, "prestige": false, "cost": 1, "flag": 1,              "connects": [ GEORGIA, BAHAMAS_RUN_WEST ],                                                  "conquest": [ SAN_AGUSTIN ] },
    { "layout": "Georgia",                 "num":  64, "name": "Georgia",                 "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 1, "market": 3, "connects": [ CAROLINAS ] },
    { "layout": "San Agustin",             "num":  65, "name": "San Agustin",             "era": 0, "region": 2,              "type": 3, "prestige": false, "cost": 1, "flag": 2,              "connects": [ PANZACOLA ],                                                                  "conquest": [ CAROLINAS, ST_DOMINGUE ] },
    { "layout": "Panzacola",               "num":  66, "name": "Panzacola",               "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 4, "connects": [ SAN_AGUSTIN ] },
    { "layout": "Bahamas Run West",        "num":  67, "name": "Bahamas Run West",        "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 3, "connects": [ CAROLINAS, BAHAMAS_RUN_NORTH, BAHAMAS_RUN, CAICOS, CUBA_PASSAGE_EAST, ST_JAMES ] },
    { "layout": "Bahamas Run North",       "num":  68, "name": "Bahamas Run North",       "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 3, "connects": [ BAHAMAS_RUN_WEST, BAHAMAS_RUN, CAICOS] },
    { "layout": "Caicos",                  "num":  69, "name": "Caicos",                  "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 3, "connects": [ BAHAMAS_RUN, BAHAMAS_RUN_NORTH, BAHAMAS_RUN_WEST, ST_DOMINGUE ] },
    { "layout": "Bahamas Run",             "num":  70, "name": "Bahamas Run",             "era": 0, "region": 2,              "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ BAHAMAS_RUN_WEST, BAHAMAS_RUN_NORTH, CAICOS ],                                "conquest": [ ST_DOMINGUE ],                                                 "alliance": [ [ 3, 1 ], [ 3, 3 ], [ 4, 3 ] ] },
    { "layout": "St. Domingue",            "num":  71, "name": "St. Domingue",            "era": 0, "region": 2,              "type": 3, "prestige": false, "cost": 1, "flag": 0,              "connects": [ CAICOS, PORT_DE_PAIX, PUERTO_PRINCIPE ],                                      "conquest": [ SAN_AGUSTIN, BAHAMAS_RUN ] },
    { "layout": "Port de Paix",            "num":  72, "name": "Port de Paix",            "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 3, "flag": 0, "market": 4, "connects": [ ST_DOMINGUE ], },
    { "layout": "Puerto Principe",         "num":  73, "name": "Puerto Principe",         "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 2, "market": 4, "connects": [ ST_DOMINGUE, PUERTO_RICO, HAVANA, SANTIAGO, GULF_OF_CAZONES ], },
    { "layout": "Puerto Rico",             "num":  74, "name": "Puerto Rico",             "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 4, "connects": [ PUERTO_PRINCIPE, ANTIGUA ], },
    { "layout": "Antigua",                 "num":  75, "name": "Antigua",                 "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 4, "connects": [ PUERTO_RICO, MARTINIQUE, ST_LUCIA, ANTILLES_CHANNEL ], },
    { "layout": "Martinique",              "num":  76, "name": "Martinique",              "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 0, "market": 4, "connects": [ ANTIGUA, GUADELOUPE, ST_LUCIA, ANTILLES_CHANNEL ], },
    { "layout": "St. Lucia",               "num":  77, "name": "St. Lucia",               "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 1, "market": 4, "connects": [ ANTIGUA, MARTINIQUE, BARBADOS, ANTILLES_CHANNEL ], },
    { "layout": "Antilles Channel",        "num":  78, "name": "Antilles Channel",        "era": 0, "region": 2,              "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ ANTIGUA, MARTINIQUE, ST_LUCIA ],                                              "conquest": [ GUADELOUPE, BARBADOS ],                                        "alliance": [ [ 3, 1 ], [ 3, 3 ], [ 4, 3 ] ] },
    { "layout": "Guadeloupe",              "num":  79, "name": "Guadeloupe",              "era": 0, "region": 2,              "type": 3, "prestige": false, "cost": 1, "flag": 0,              "connects": [ MARTINIQUE ],                                                                 "conquest": [ ANTILLES_CHANNEL ] },
    { "layout": "Barbados",                "num":  80, "name": "Barbados",                "era": 0, "region": 2,              "type": 3, "prestige": false, "cost": 1, "flag": 1,              "connects": [ ST_LUCIA ],                                                                   "conquest": [ ANTILLES_CHANNEL ] },
    { "layout": "Havana",                  "num":  81, "name": "Havana",                  "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 2, "market": 4, "connects": [ PUERTO_PRINCIPE, SANTIAGO, GULF_OF_CAZONES ], },
    { "layout": "Gulf of Cazones",         "num":  82, "name": "Gulf of Cazones",         "era": 0, "region": 2,              "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ HAVANA, PUERTO_PRINCIPE, SANTIAGO ],                                          "conquest": [ ],                                                             "alliance": [ [ 3, 1 ], [ 3, 3 ], [ 4, 3 ] ] },
    { "layout": "Santiago",                "num":  83, "name": "Santiago",                "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 2, "market": 4, "connects": [ HAVANA, PUERTO_PRINCIPE, GULF_OF_CAZONES, JAMAICA ], },
    { "layout": "Jamaica",                 "num":  84, "name": "Jamaica",                 "era": 0, "region": 2,              "type": 3, "prestige": false, "cost": 1, "flag": 1,              "connects": [ SANTIAGO, CAYMAN_PASSAGE ],                                                   "conquest": [ CUBA_PASSAGE ] },
    { "layout": "Cayman Passage",          "num":  85, "name": "Cayman Passage",          "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 3, "connects": [ JAMAICA, CUBA_PASSAGE, CUBA_PASSAGE_EAST, ST_JAMES ] },
    { "layout": "Cuba Passage East",       "num":  86, "name": "Cuba Passage East",       "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 3, "connects": [ CAYMAN_PASSAGE, BAHAMAS_RUN_WEST, CUBA_PASSAGE, ST_JAMES ] },
    { "layout": "Cuba Passage",            "num":  87, "name": "Cuba Passage",            "era": 0, "region": 2,              "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ CUBA_PASSAGE_EAST, CAYMAN_PASSAGE, ST_JAMES ],                                "conquest": [ JAMAICA, LOUISIANA ],                                          "alliance": [ [ 3, 1 ], [ 3, 3 ], [ 4, 3 ] ] },
    { "layout": "St. James",               "num":  88, "name": "St. James",               "era": 0, "region": 2,              "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 3, "connects": [ LOUISIANA, BAHAMAS_RUN_WEST, CUBA_PASSAGE, CUBA_PASSAGE_EAST, CAYMAN_PASSAGE, ST_JAMES ] },
    { "layout": "Louisiana",               "num":  89, "name": "Louisiana",               "era": 0, "region": 2,              "type": 3, "prestige": false, "cost": 1, "flag": 0,              "connects": [ ST_JAMES ],                                                                   "conquest": [ CUBA_PASSAGE ] },

    // INDIA
    { "layout": "Maratha",                 "num":  90, "name": "Maratha",                 "era": 0, "region": 3, "subreg": 2, "type": 0, "prestige": false, "cost": 2, "flag": 4,                                                                                                                                                                                       "alliance": [ ]  },
    { "layout": "Nizam",                   "num":  91, "name": "Nizam",                   "era": 0, "region": 3, "subreg": 3, "type": 0, "prestige": false, "cost": 2, "flag": 4,                                                                                                                                                                                       "alliance": [ ]  },
    { "layout": "Mysore",                  "num":  92, "name": "Mysore",                  "era": 0, "region": 3, "subreg": 3, "type": 0, "prestige": false, "cost": 2, "flag": 4,                                                                                                                                                                                       "alliance": [ ]  },
    { "layout": "Malacca Route",           "num":  93, "name": "Malacca Route",           "era": 0, "region": 3, "subreg": 2, "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 1, "connects": [ PLASSEY, HOOGHLY_RIVER ] },
    { "layout": "Hooghly River",           "num":  94, "name": "Hooghly River",           "era": 0, "region": 3, "subreg": 2, "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ PLASSEY, MALACCA_ROUTE, WEST_BENGAL, MIDNAPORE,  ],                           "conquest": [ CHANDERNAGORE, CALCUTTA ],                                     "alliance": [ [ 2, 3 ], [ 3, 2 ], [ 4, 2 ] ] },
    { "layout": "Chandernagore",           "num":  95, "name": "Chandernagore",           "era": 0, "region": 3, "subreg": 2, "type": 3, "prestige": false, "cost": 1, "flag": 0,              "connects": [ PLASSEY ],                                                                    "conquest": [ HOOGHLY_RIVER ] },
    { "layout": "Plassey",                 "num":  96, "name": "Plassey",                 "era": 0, "region": 3, "subreg": 2, "type": 1, "prestige": false, "cost": 3, "flag": 0, "market": 5, "connects": [ MALACCA_ROUTE, CHANDERNAGORE, HOOGHLY_RIVER, WEST_BENGAL ] },
    { "layout": "West Bengal",             "num":  97, "name": "West Bengal",             "era": 0, "region": 3, "subreg": 2, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 5, "connects": [ PLASSEY, HOOGHLY_RIVER, MIDNAPORE, MANGALORE ] },
    { "layout": "Midnapore",               "num":  98, "name": "Midnapore",               "era": 0, "region": 3, "subreg": 2, "type": 1, "prestige": false, "cost": 3, "flag": 1, "market": 5, "connects": [ CALCUTTA, HOOGHLY_RIVER, WEST_BENGAL, KURPA ] },
    { "layout": "Calcutta",                "num":  99, "name": "Calcutta",                "era": 0, "region": 3, "subreg": 2, "type": 3, "prestige": false, "cost": 1, "flag": 1,              "connects": [ MIDNAPORE ],                                                                  "conquest": [ HOOGHLY_RIVER ] },
    { "layout": "Kurpa",                   "num": 100, "name": "Kurpa",                   "era": 0, "region": 3, "subreg": 3, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 5, "connects": [ MIDNAPORE, VELLORE, ARCOT ] },
    { "layout": "Arcot",                   "num": 101, "name": "Arcot",                   "era": 0, "region": 3, "subreg": 3, "type": 4, "prestige": false, "cost": 2, "flag": 4,              "connects": [ KURPA, VELLORE ],                                                             "conquest": [ MADRAS ],                                                      "alliance": [ [ 2, 3 ], [ 3, 2 ], [ 4, 2 ] ] },
    { "layout": "Vellore",                 "num": 102, "name": "Vellore",                 "era": 0, "region": 3, "subreg": 3, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 5, "connects": [ KURPA, ARCOT, KANCHIPURAM, TIRUCHIRAPPALLI ] },
    { "layout": "Kanchipuram",             "num": 103, "name": "Kanchipuram",             "era": 0, "region": 3, "subreg": 3, "type": 1, "prestige": false, "cost": 2, "flag": 1, "market": 1, "connects": [ MADRAS, KARAIKAL, VANDAVASI, TIRUCHIRAPPALLI, VELLORE ] },
    { "layout": "Madras",                  "num": 104, "name": "Madras",                  "era": 0, "region": 3, "subreg": 3, "type": 3, "prestige": false, "cost": 1, "flag": 1,              "connects": [ KANCHIPURAM ],                                                                "conquest": [ ARCOT, VANDAVASI ] },
    { "layout": "Pondicherry",             "num": 105, "name": "Pondicherry",             "era": 0, "region": 3, "subreg": 3, "type": 3, "prestige": false, "cost": 1, "flag": 0,              "connects": [ KARAIKAL ],                                                                   "conquest": [ VANDAVASI ] },
    { "layout": "Karaikal",                "num": 106, "name": "Karaikal",                "era": 0, "region": 3, "subreg": 3, "type": 1, "prestige": false, "cost": 3, "flag": 0, "market": 5, "connects": [ PONDICHERRY, KANCHIPURAM, TIRUCHIRAPPALLI, VANDAVASI ] },
    { "layout": "Vandavasi",               "num": 107, "name": "Vandavasi",               "era": 0, "region": 3, "subreg": 3, "type": 4, "prestige": false, "cost": 4, "flag": 4,              "connects": [ KANCHIPURAM, KARAIKAL, TIRUCHIRAPPALLI ],                                     "conquest": [ MADRAS, PONDICHERRY ],                                         "alliance": [ [ 2, 3 ], [ 3, 2 ], [ 4, 2 ] ] },
    { "layout": "Tiruchirappalli",         "num": 108, "name": "Tiruchirappalli",         "era": 0, "region": 3, "subreg": 3, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 1, "connects": [ KARAIKAL, VANDAVASI, KANCHIPURAM, VELLORE, CALICUT ] },
    { "layout": "Calicut",                 "num": 109, "name": "Calicut",                 "era": 0, "region": 3, "subreg": 3, "type": 1, "prestige": false, "cost": 3, "flag": 4, "market": 1, "connects": [ TIRUCHIRAPPALLI, MALABAR_COAST, MANGALORE ] },
    { "layout": "Mangalore",               "num": 110, "name": "Mangalore",               "era": 0, "region": 3, "subreg": 3, "type": 1, "prestige": false, "cost": 2, "flag": 4, "market": 1, "connects": [ MALABAR_COAST, CALICUT, WEST_BENGAL ] },
    { "layout": "Malabar Coast",           "num": 111, "name": "Malabar Coast",           "era": 0, "region": 3, "subreg": 2, "type": 2, "prestige": false, "cost": 0, "flag": 4,              "connects": [ MANGALORE, CALICUT ],                                                         "conquest": [ ],                                                             "alliance": [ [ 2, 3 ], [ 3, 2 ], [ 4, 2 ] ] },
]

data.bizarro_spaces = [
    // BIZARRO SPACES
    { "layout": "Navy Box",                "num":  0, "name": "Navy Box"  },
    { "layout": "Award Europe",            "num":  1, "name": "Award for Europe" },
    { "layout": "Award North America",     "num":  2, "name": "Award for North America" },
    { "layout": "Award Caribbean",         "num":  3, "name": "Award for the Caribbean" },
    { "layout": "Award India",             "num":  4, "name": "Award for India" },
    { "layout": "Demand",                  "num":  5, "name": "Global Demand" },
    { "layout": "Initiative",              "num":  6, "name": "Initiative Box" },
    { "layout": "Turn 1",                  "num":  7, "name": "Turn 1" },
    { "layout": "War 1",                   "num":  8, "name": "War of the Spanish Succession" },
    { "layout": "Turn 2",                  "num":  9, "name": "Turn 2" },
    { "layout": "Turn 3",                  "num": 10, "name": "Turn 3" },
    { "layout": "War 2",                   "num": 11, "name": "War of the Austrian Succession" },
    { "layout": "Turn 4",                  "num": 12, "name": "Turn 4" },
    { "layout": "War 3",                   "num": 13, "name": "Seven Years War" },
    { "layout": "Turn 5",                  "num": 14, "name": "Turn 5" },
    { "layout": "War 4",                   "num": 15, "name": "American War of Independence" },
    { "layout": "Turn 6",                  "num": 16, "name": "Turn 6" },
	{ "layout": "record track -7",         "num": 17, "name": "General track Record -7" },
	{ "layout": "record track -6",         "num": 18, "name": "General track Record -6" },
	{ "layout": "record track -5",         "num": 19, "name": "General track Record -5" },
	{ "layout": "record track -4",         "num": 20, "name": "General track Record -4" },
	{ "layout": "record track -3",         "num": 21, "name": "General track Record -3" },
	{ "layout": "record track -2",         "num": 22, "name": "General track Record -2" },
	{ "layout": "record track -1",         "num": 23, "name": "General track Record -1" },
    { "layout": "record track 0",          "num": 24, "name": "General track Record 0" },
	{ "layout": "record track 1",          "num": 25, "name": "General track Record 1" },
	{ "layout": "record track 2",          "num": 26, "name": "General track Record 2" },
	{ "layout": "record track 3",          "num": 27, "name": "General track Record 3" },
	{ "layout": "record track 4",          "num": 28, "name": "General track Record 4" },
	{ "layout": "record track 5",          "num": 29, "name": "General track Record 5" },
	{ "layout": "record track 6",          "num": 30, "name": "General track Record 6" },
	{ "layout": "record track 7",          "num": 31, "name": "General track Record 7" },
	{ "layout": "record track 8",          "num": 32, "name": "General track Record 8" },
	{ "layout": "record track 9",          "num": 33, "name": "General track Record 9" },
	{ "layout": "record track 10",         "num": 34, "name": "General track Record 10" },
	{ "layout": "record track 11",         "num": 35, "name": "General track Record 11" },
	{ "layout": "record track 12",         "num": 36, "name": "General track Record 12" },
	{ "layout": "record track 13",         "num": 37, "name": "General track Record 13" },
	{ "layout": "record track 14",         "num": 38, "name": "General track Record 14" },
	{ "layout": "record track 15",         "num": 39, "name": "General track Record 15" },
	{ "layout": "record track 16",         "num": 40, "name": "General track Record 16" },
	{ "layout": "record track 17",         "num": 41, "name": "General track Record 17" },
	{ "layout": "record track 18",         "num": 42, "name": "General track Record 18" },
	{ "layout": "record track 19",         "num": 43, "name": "General track Record 19" },
	{ "layout": "record track 20",         "num": 44, "name": "General track Record 10" },
	{ "layout": "record track 21",         "num": 45, "name": "General track Record 21" },
	{ "layout": "record track 22",         "num": 46, "name": "General track Record 22" },
	{ "layout": "record track 23",         "num": 47, "name": "General track Record 23" },
	{ "layout": "record track 24",         "num": 48, "name": "General track Record 24" },
	{ "layout": "record track 25",         "num": 49, "name": "General track Record 25" },
	{ "layout": "record track 26",         "num": 50, "name": "General track Record 26" },
	{ "layout": "record track 27",         "num": 51, "name": "General track Record 27" },
	{ "layout": "record track 28",         "num": 52, "name": "General track Record 28" },
	{ "layout": "record track 29",         "num": 53, "name": "General track Record 29" },
	{ "layout": "record track 30",         "num": 54, "name": "General track Record 30" },
	{ "layout": "record track 31",         "num": 55, "name": "General track Record 31" },
	{ "layout": "record track 32",         "num": 56, "name": "General track Record 32" },
	{ "layout": "record track 33",         "num": 57, "name": "General track Record 33" },
	{ "layout": "record track 34",         "num": 58, "name": "General track Record 34" },
	{ "layout": "record track 35",         "num": 59, "name": "General track Record 35" },
	{ "layout": "record track 36",         "num": 60, "name": "General track Record 36" },

	// FRENCH PLAYER MAT
	{ "layout": "fr_advantages",           "num": 61, "name": "Advantage Tile"},
	{ "layout": "fr_ministries",           "num": 62, "name": "Ministries"},
	{ "layout": "fr_squadrons",            "num": 63, "name": "Squadrons"},
	{ "layout": "fr_basic_war_tiles",      "num": 64, "name": "Basic War Tiles"},
	{ "layout": "fr_bonus_war_tiles",      "num": 65, "name": "Bonus War Tiles"},

	// BRITISH PLAYER MAT
	{ "layout": "br_advantages",           "num": 66, "name": "Advantage Tile"},
	{ "layout": "br_ministries",           "num": 67, "name": "Ministry Card"},
	{ "layout": "br_squadrons",            "num": 68, "name": "Squadrons"},
	{ "layout": "br_basic_war_tiles",      "num": 69, "name": "Basic War Tiles"},
	{ "layout": "br_bonus_war_tiles",      "num": 70, "name": "Bonus War Tiles"},

	// INVESTMENT TILE DISPLAY and EVENT DECK
	{ "layout": "available_investment_1",  "num": 71, "name": "Available Investment Tiles" },
	{ "layout": "available_investment_2",  "num": 72, "name": "Available Investment Tiles" },
	{ "layout": "available_investment_3",  "num": 73, "name": "Available Investment Tiles" },
	{ "layout": "available_investment_4",  "num": 74, "name": "Available Investment Tiles" },
	{ "layout": "available_investment_5",  "num": 75, "name": "Available Investment Tiles" },
	{ "layout": "available_investment_6",  "num": 76, "name": "Available Investment Tiles" },
	{ "layout": "available_investment_7",  "num": 77, "name": "Available Investment Tiles" },
	{ "layout": "available_investment_8",  "num": 78, "name": "Available Investment Tiles" },
	{ "layout": "available_investment_9",  "num": 79, "name": "Available Investment Tiles" },
	{ "layout": "investment_tile_stack",   "num": 80, "name": "Investment Tile Stack" },
	{ "layout": "used_investment_tiles",   "num": 81, "name": "Used Investment Tiles" },
	{ "layout": "draw_pile",               "num": 82, "name": "Draw Pile" },
	{ "layout": "discard_pile",            "num": 83, "name": "Discard Pile" },
	{ "layout": "played_events_pile",      "num": 84, "name": "Played Events Pile" },
]

if (typeof module !== "undefined") module.exports = data
