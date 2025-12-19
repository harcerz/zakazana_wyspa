// Forbidden Island Game Constants

// Tile states
const TILE_STATE = {
  NORMAL: 'normal',
  FLOODED: 'flooded',
  SUNK: 'sunk'
};

// Artifacts
const ARTIFACTS = {
  FIRE_CRYSTAL: { id: 'fire', name: 'Kryształ Ognia', emoji: '🔥' },
  WIND_STATUE: { id: 'wind', name: 'Posąg Wiatru', emoji: '🌪️' },
  OCEAN_CHALICE: { id: 'water', name: 'Kielich Oceanu', emoji: '🌊' },
  EARTH_STONE: { id: 'earth', name: 'Kamień Ziemi', emoji: '🪨' }
};

// Island tiles with their properties
const ISLAND_TILES = [
  // Fire artifact tiles
  { id: 'cave_of_embers', name: 'Jaskinia Żaru', artifact: 'fire' },
  { id: 'cave_of_shadows', name: 'Jaskinia Cieni', artifact: 'fire' },
  // Wind artifact tiles
  { id: 'howling_garden', name: 'Wyjący Ogród', artifact: 'wind' },
  { id: 'whispering_garden', name: 'Szepczący Ogród', artifact: 'wind' },
  // Water artifact tiles
  { id: 'coral_palace', name: 'Koralowy Pałac', artifact: 'water' },
  { id: 'tidal_palace', name: 'Pałac Przypływów', artifact: 'water' },
  // Earth artifact tiles
  { id: 'temple_of_the_moon', name: 'Świątynia Księżyca', artifact: 'earth' },
  { id: 'temple_of_the_sun', name: 'Świątynia Słońca', artifact: 'earth' },
  // Starting tiles for each role
  { id: 'fools_landing', name: 'Lądowisko Głupców', starting: 'pilot', isHelipad: true },
  { id: 'bronze_gate', name: 'Brązowa Brama', starting: 'engineer' },
  { id: 'iron_gate', name: 'Żelazna Brama', starting: 'diver' },
  { id: 'copper_gate', name: 'Miedziana Brama', starting: 'explorer' },
  { id: 'silver_gate', name: 'Srebrna Brama', starting: 'messenger' },
  { id: 'gold_gate', name: 'Złota Brama', starting: 'navigator' },
  // Other tiles
  { id: 'watchtower', name: 'Wieża Strażnicza' },
  { id: 'phantom_rock', name: 'Widmowa Skała' },
  { id: 'crimson_forest', name: 'Szkarłatny Las' },
  { id: 'lost_lagoon', name: 'Zaginiona Laguna' },
  { id: 'misty_marsh', name: 'Mgliste Bagna' },
  { id: 'twilight_hollow', name: 'Zmierzchowa Kotlina' },
  { id: 'observatory', name: 'Obserwatorium' },
  { id: 'breakers_bridge', name: 'Most Falochronów' },
  { id: 'cliffs_of_abandon', name: 'Klify Opuszczenia' },
  { id: 'dunes_of_deception', name: 'Wydmy Złudzeń' }
];

// Island layout - positions in cross pattern (row, col)
// null means empty space
const ISLAND_LAYOUT = [
  [null, null, 0, 1, null, null],
  [null, 2, 3, 4, 5, null],
  [6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17],
  [null, 18, 19, 20, 21, null],
  [null, null, 22, 23, null, null]
];

// Adventurer roles
const ROLES = {
  pilot: {
    id: 'pilot',
    name: 'Pilot',
    color: '#2196F3',
    ability: 'Raz na turę może polecieć na dowolne pole (1 akcja)',
    startingTile: 'fools_landing'
  },
  engineer: {
    id: 'engineer',
    name: 'Inżynier',
    color: '#F44336',
    ability: 'Może osuszyć 2 pola za 1 akcję',
    startingTile: 'bronze_gate'
  },
  diver: {
    id: 'diver',
    name: 'Nurek',
    color: '#000000',
    ability: 'Może przepłynąć przez zatopione lub usunięte pola',
    startingTile: 'iron_gate'
  },
  explorer: {
    id: 'explorer',
    name: 'Odkrywca',
    color: '#4CAF50',
    ability: 'Może poruszać się i osuszać po przekątnych',
    startingTile: 'copper_gate'
  },
  messenger: {
    id: 'messenger',
    name: 'Posłaniec',
    color: '#E0E0E0',
    ability: 'Może dawać karty graczom na dowolnym polu',
    startingTile: 'silver_gate'
  },
  navigator: {
    id: 'navigator',
    name: 'Nawigator',
    color: '#FFEB3B',
    ability: 'Może przesunąć innego gracza o 2 pola (1 akcja)',
    startingTile: 'gold_gate'
  }
};

// Treasure card types
const TREASURE_CARDS = {
  FIRE: { id: 'fire', name: 'Kryształ Ognia', count: 5 },
  WIND: { id: 'wind', name: 'Posąg Wiatru', count: 5 },
  WATER: { id: 'water', name: 'Kielich Oceanu', count: 5 },
  EARTH: { id: 'earth', name: 'Kamień Ziemi', count: 5 },
  WATERS_RISE: { id: 'waters_rise', name: 'Wody Przybywają!', count: 3, isSpecial: true },
  HELICOPTER: { id: 'helicopter', name: 'Lot Helikopterem', count: 3, isAction: true },
  SANDBAGS: { id: 'sandbags', name: 'Worki z Piaskiem', count: 2, isAction: true }
};

// Water level meter
const WATER_LEVELS = {
  1: { floodCards: 2, name: 'Nowicjusz' },
  2: { floodCards: 2, name: 'Nowicjusz' },
  3: { floodCards: 3, name: 'Normalny' },
  4: { floodCards: 3, name: 'Normalny' },
  5: { floodCards: 3, name: 'Elita' },
  6: { floodCards: 4, name: 'Elita' },
  7: { floodCards: 4, name: 'Legendarny' },
  8: { floodCards: 5, name: 'Legendarny' },
  9: { floodCards: 5, name: 'Śmierć' },
  10: { floodCards: 0, name: 'KONIEC GRY', gameOver: true }
};

// Difficulty settings (starting water level)
const DIFFICULTY = {
  NOVICE: 1,
  NORMAL: 2,
  ELITE: 3,
  LEGENDARY: 4
};

// Game phases
const GAME_PHASE = {
  LOBBY: 'lobby',
  SETUP: 'setup',
  ACTIONS: 'actions',
  DRAW_TREASURE: 'draw_treasure',
  DRAW_FLOOD: 'draw_flood',
  GAME_OVER: 'game_over',
  VICTORY: 'victory'
};

// Actions
const ACTIONS = {
  MOVE: 'move',
  SHORE_UP: 'shore_up',
  GIVE_CARD: 'give_card',
  CAPTURE_TREASURE: 'capture_treasure',
  USE_HELICOPTER: 'use_helicopter',
  USE_SANDBAGS: 'use_sandbags'
};

module.exports = {
  TILE_STATE,
  ARTIFACTS,
  ISLAND_TILES,
  ISLAND_LAYOUT,
  ROLES,
  TREASURE_CARDS,
  WATER_LEVELS,
  DIFFICULTY,
  GAME_PHASE,
  ACTIONS
};
