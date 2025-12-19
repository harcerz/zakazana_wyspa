// Main game state manager
const Island = require('./Island');
const { TreasureDeck, FloodDeck, AdventurerDeck } = require('./Cards');
const {
  TILE_STATE,
  ARTIFACTS,
  ROLES,
  WATER_LEVELS,
  DIFFICULTY,
  GAME_PHASE,
  ACTIONS
} = require('./constants');

class Player {
  constructor(id, name, role, startingTile) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.tileId = startingTile.id;
    this.row = startingTile.row;
    this.col = startingTile.col;
    this.hand = [];
    this.usedPilotAbility = false;
  }

  addCard(card) {
    this.hand.push(card);
  }

  removeCard(cardId) {
    const index = this.hand.findIndex(c => c.id === cardId);
    if (index !== -1) {
      return this.hand.splice(index, 1)[0];
    }
    return null;
  }

  getCardsByType(type) {
    return this.hand.filter(c => c.type === type);
  }

  countCardsByType(type) {
    return this.getCardsByType(type).length;
  }

  moveTo(tile) {
    this.tileId = tile.id;
    this.row = tile.row;
    this.col = tile.col;
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      tileId: this.tileId,
      row: this.row,
      col: this.col,
      hand: this.hand,
      handCount: this.hand.length
    };
  }
}

class GameState {
  constructor(gameId) {
    this.gameId = gameId;
    this.phase = GAME_PHASE.LOBBY;
    this.players = [];
    this.island = null;
    this.treasureDeck = null;
    this.floodDeck = null;
    this.adventurerDeck = null;
    this.waterLevel = 1;
    this.difficulty = DIFFICULTY.NOVICE;
    this.currentPlayerIndex = 0;
    this.actionsRemaining = 3;
    this.capturedArtifacts = {
      fire: false,
      wind: false,
      water: false,
      earth: false
    };
    this.gameOverReason = null;
    this.treasureCardsDrawn = 0;
    this.floodCardsDrawn = 0;
    this.engineerShoreUpCount = 0;
    this.pendingWatersRise = [];
  }

  // ========== LOBBY PHASE ==========

  addPlayer(playerId, playerName) {
    if (this.phase !== GAME_PHASE.LOBBY) {
      return { success: false, message: 'Gra już się rozpoczęła' };
    }
    if (this.players.length >= 4) {
      return { success: false, message: 'Maksymalnie 4 graczy' };
    }
    if (this.players.find(p => p.id === playerId)) {
      return { success: false, message: 'Gracz już jest w grze' };
    }

    // Temporarily store player info until game starts
    this.players.push({ id: playerId, name: playerName });
    return { success: true, playerCount: this.players.length };
  }

  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      this.players.splice(index, 1);
      return { success: true };
    }
    return { success: false };
  }

  setDifficulty(level) {
    if (this.phase !== GAME_PHASE.LOBBY) {
      return { success: false, message: 'Nie można zmienić trudności w trakcie gry' };
    }
    this.difficulty = level;
    this.waterLevel = level;
    return { success: true, difficulty: level };
  }

  // ========== GAME START ==========

  startGame() {
    if (this.phase !== GAME_PHASE.LOBBY) {
      return { success: false, message: 'Gra już się rozpoczęła' };
    }
    if (this.players.length < 2) {
      return { success: false, message: 'Potrzeba minimum 2 graczy' };
    }

    // Initialize game components
    this.island = new Island();
    this.treasureDeck = new TreasureDeck();
    this.floodDeck = new FloodDeck(this.island.tiles);
    this.adventurerDeck = new AdventurerDeck();

    // Assign roles to players
    const playerInfos = [...this.players];
    this.players = [];

    for (const info of playerInfos) {
      const role = this.adventurerDeck.draw();
      const startingTile = this.island.getTileByStartingRole(role.id);

      if (!startingTile) {
        // Find the tile with matching starting property
        const tile = this.island.tiles.find(t => t.starting === role.id);
        if (tile) {
          const player = new Player(info.id, info.name, role, tile);
          player.hand = this.treasureDeck.drawInitialHand(2);
          this.players.push(player);
        }
      } else {
        const player = new Player(info.id, info.name, role, startingTile);
        player.hand = this.treasureDeck.drawInitialHand(2);
        this.players.push(player);
      }
    }

    // Initial flood (6 cards)
    const initialFlood = this.floodDeck.drawMultiple(6);
    for (const floodCard of initialFlood) {
      this.island.floodTile(floodCard.tileId);
      this.floodDeck.discard(floodCard);
    }

    // Set water level based on difficulty
    this.waterLevel = this.difficulty;

    // Start first player's turn
    this.phase = GAME_PHASE.ACTIONS;
    this.currentPlayerIndex = 0;
    this.actionsRemaining = 3;

    return {
      success: true,
      message: 'Gra rozpoczęta!',
      initialFlood: initialFlood.map(c => c.tileId)
    };
  }

  // ========== ACTIONS PHASE ==========

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  move(playerId, targetTileId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (this.phase !== GAME_PHASE.ACTIONS) {
      return { success: false, message: 'Nie możesz teraz wykonać ruchu' };
    }
    if (this.actionsRemaining <= 0) {
      return { success: false, message: 'Brak pozostałych akcji' };
    }

    const targetTile = this.island.getTileById(targetTileId);
    if (!targetTile || targetTile.state === TILE_STATE.SUNK) {
      return { success: false, message: 'Nieprawidłowe pole docelowe' };
    }

    const validMoves = this.island.getValidMoves(player.row, player.col, player.role.id);
    if (!validMoves.find(t => t.id === targetTileId)) {
      return { success: false, message: 'Nie możesz się tam ruszyć' };
    }

    player.moveTo(targetTile);
    this.actionsRemaining--;

    return { success: true, remaining: this.actionsRemaining };
  }

  pilotFly(playerId, targetTileId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (player.role.id !== 'pilot') {
      return { success: false, message: 'Tylko pilot może latać' };
    }
    if (player.usedPilotAbility) {
      return { success: false, message: 'Już użyłeś zdolności pilota w tej turze' };
    }
    if (this.actionsRemaining <= 0) {
      return { success: false, message: 'Brak pozostałych akcji' };
    }

    const targetTile = this.island.getTileById(targetTileId);
    if (!targetTile || targetTile.state === TILE_STATE.SUNK) {
      return { success: false, message: 'Nieprawidłowe pole docelowe' };
    }

    player.moveTo(targetTile);
    player.usedPilotAbility = true;
    this.actionsRemaining--;

    return { success: true, remaining: this.actionsRemaining };
  }

  navigatorMove(playerId, targetPlayerId, targetTileId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (player.role.id !== 'navigator') {
      return { success: false, message: 'Tylko nawigator może przesuwać innych graczy' };
    }
    if (this.actionsRemaining <= 0) {
      return { success: false, message: 'Brak pozostałych akcji' };
    }

    const targetPlayer = this.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer || targetPlayer.id === player.id) {
      return { success: false, message: 'Nieprawidłowy gracz' };
    }

    const targetTile = this.island.getTileById(targetTileId);
    if (!targetTile || targetTile.state === TILE_STATE.SUNK) {
      return { success: false, message: 'Nieprawidłowe pole docelowe' };
    }

    // Navigator can move player up to 2 tiles (checking path)
    const validMoves = this.getNavigatorMoves(targetPlayer);
    if (!validMoves.find(t => t.id === targetTileId)) {
      return { success: false, message: 'Za daleko' };
    }

    targetPlayer.moveTo(targetTile);
    this.actionsRemaining--;

    return { success: true, remaining: this.actionsRemaining };
  }

  getNavigatorMoves(targetPlayer) {
    const moves = new Set();
    const startMoves = this.island.getAdjacentTiles(targetPlayer.row, targetPlayer.col);

    for (const tile of startMoves) {
      moves.add(tile);
      const secondMoves = this.island.getAdjacentTiles(tile.row, tile.col);
      for (const t of secondMoves) {
        moves.add(t);
      }
    }

    return Array.from(moves);
  }

  shoreUp(playerId, targetTileId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (this.phase !== GAME_PHASE.ACTIONS) {
      return { success: false, message: 'Nie możesz teraz osuszać' };
    }
    if (this.actionsRemaining <= 0) {
      return { success: false, message: 'Brak pozostałych akcji' };
    }

    const targets = this.island.getShoreUpTargets(player.row, player.col, player.role.id);
    if (!targets.find(t => t.id === targetTileId)) {
      return { success: false, message: 'Nie możesz osuszyć tego pola' };
    }

    const result = this.island.shoreUp(targetTileId);
    if (!result.success) {
      return result;
    }

    // Engineer can shore up 2 tiles for 1 action
    if (player.role.id === 'engineer') {
      this.engineerShoreUpCount++;
      if (this.engineerShoreUpCount >= 2) {
        this.actionsRemaining--;
        this.engineerShoreUpCount = 0;
      }
    } else {
      this.actionsRemaining--;
    }

    return { success: true, remaining: this.actionsRemaining, tile: result.tile };
  }

  giveCard(playerId, cardId, targetPlayerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (this.phase !== GAME_PHASE.ACTIONS) {
      return { success: false, message: 'Nie możesz teraz dawać kart' };
    }
    if (this.actionsRemaining <= 0) {
      return { success: false, message: 'Brak pozostałych akcji' };
    }

    const card = player.hand.find(c => c.id === cardId);
    if (!card) {
      return { success: false, message: 'Nie masz tej karty' };
    }
    if (card.isAction) {
      return { success: false, message: 'Nie możesz dawać kart akcji' };
    }

    const targetPlayer = this.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      return { success: false, message: 'Nieprawidłowy gracz' };
    }

    // Check if on same tile (unless messenger)
    if (player.role.id !== 'messenger' && player.tileId !== targetPlayer.tileId) {
      return { success: false, message: 'Musisz być na tym samym polu' };
    }

    player.removeCard(cardId);
    targetPlayer.addCard(card);
    this.actionsRemaining--;

    // Check hand limit
    const handLimitResult = this.checkHandLimit(targetPlayer);

    return {
      success: true,
      remaining: this.actionsRemaining,
      handLimitExceeded: handLimitResult
    };
  }

  captureTreasure(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (this.phase !== GAME_PHASE.ACTIONS) {
      return { success: false, message: 'Nie możesz teraz zbierać artefaktów' };
    }
    if (this.actionsRemaining <= 0) {
      return { success: false, message: 'Brak pozostałych akcji' };
    }

    const currentTile = this.island.getTileById(player.tileId);
    if (!currentTile || !currentTile.artifact) {
      return { success: false, message: 'To pole nie ma artefaktu' };
    }

    const artifactType = currentTile.artifact;
    if (this.capturedArtifacts[artifactType]) {
      return { success: false, message: 'Ten artefakt został już zdobyty' };
    }

    const matchingCards = player.getCardsByType(artifactType);
    if (matchingCards.length < 4) {
      return { success: false, message: 'Potrzebujesz 4 pasujących kart' };
    }

    // Remove 4 cards
    for (let i = 0; i < 4; i++) {
      const card = player.removeCard(matchingCards[i].id);
      this.treasureDeck.discard(card);
    }

    this.capturedArtifacts[artifactType] = true;
    this.actionsRemaining--;

    return {
      success: true,
      remaining: this.actionsRemaining,
      artifact: ARTIFACTS[Object.keys(ARTIFACTS).find(k => ARTIFACTS[k].id === artifactType)]
    };
  }

  // ========== SPECIAL ACTION CARDS ==========

  useHelicopter(playerId, cardId, playerIds, targetTileId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, message: 'Nieprawidłowy gracz' };
    }

    const card = player.hand.find(c => c.id === cardId && c.type === 'helicopter');
    if (!card) {
      return { success: false, message: 'Nie masz karty helikoptera' };
    }

    // Check for victory condition
    if (targetTileId === 'ESCAPE') {
      return this.attemptEscape(playerId, cardId);
    }

    const targetTile = this.island.getTileById(targetTileId);
    if (!targetTile || targetTile.state === TILE_STATE.SUNK) {
      return { success: false, message: 'Nieprawidłowe pole docelowe' };
    }

    // All players must be on the same tile
    const movingPlayers = this.players.filter(p => playerIds.includes(p.id));
    if (movingPlayers.length === 0) {
      return { success: false, message: 'Wybierz graczy do przeniesienia' };
    }

    const firstTileId = movingPlayers[0].tileId;
    if (!movingPlayers.every(p => p.tileId === firstTileId)) {
      return { success: false, message: 'Wszyscy gracze muszą być na tym samym polu' };
    }

    // Move all players
    for (const p of movingPlayers) {
      p.moveTo(targetTile);
    }

    player.removeCard(cardId);
    this.treasureDeck.discard(card);

    return { success: true, movedPlayers: playerIds };
  }

  useSandbags(playerId, cardId, targetTileId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, message: 'Nieprawidłowy gracz' };
    }

    const card = player.hand.find(c => c.id === cardId && c.type === 'sandbags');
    if (!card) {
      return { success: false, message: 'Nie masz karty worków z piaskiem' };
    }

    const result = this.island.shoreUp(targetTileId);
    if (!result.success) {
      return result;
    }

    player.removeCard(cardId);
    this.treasureDeck.discard(card);

    return { success: true, tile: result.tile };
  }

  attemptEscape(playerId, cardId) {
    // Check all artifacts collected
    if (!Object.values(this.capturedArtifacts).every(v => v)) {
      return { success: false, message: 'Musisz zebrać wszystkie 4 artefakty' };
    }

    // Check all players on Fools' Landing
    const helipad = this.island.getHelipad();
    if (!helipad || helipad.state === TILE_STATE.SUNK) {
      return { success: false, message: 'Lądowisko Głupców zostało zatopione!' };
    }

    if (!this.players.every(p => p.tileId === helipad.id)) {
      return { success: false, message: 'Wszyscy gracze muszą być na Lądowisku Głupców' };
    }

    // Remove the helicopter card
    const player = this.players.find(p => p.id === playerId);
    const card = player.removeCard(cardId);
    this.treasureDeck.discard(card);

    this.phase = GAME_PHASE.VICTORY;
    return { success: true, victory: true, message: 'ZWYCIĘSTWO! Uciekliście z wyspy!' };
  }

  // ========== END ACTIONS / DRAW TREASURE ==========

  endActions(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (this.phase !== GAME_PHASE.ACTIONS) {
      return { success: false, message: 'Nie jesteś w fazie akcji' };
    }

    // Finish engineer's shore up if pending
    if (this.engineerShoreUpCount > 0) {
      this.engineerShoreUpCount = 0;
    }

    this.phase = GAME_PHASE.DRAW_TREASURE;
    this.treasureCardsDrawn = 0;
    this.pendingWatersRise = [];

    return { success: true };
  }

  drawTreasureCard(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (this.phase !== GAME_PHASE.DRAW_TREASURE) {
      return { success: false, message: 'Nie jesteś w fazie dobierania kart' };
    }
    if (this.treasureCardsDrawn >= 2) {
      return { success: false, message: 'Już dobrałeś 2 karty' };
    }

    const card = this.treasureDeck.draw();
    if (!card) {
      return { success: false, message: 'Brak kart w talii' };
    }

    this.treasureCardsDrawn++;

    if (card.isWatersRise) {
      this.pendingWatersRise.push(card);
      this.treasureDeck.discard(card);

      return {
        success: true,
        card,
        watersRise: true,
        drawn: this.treasureCardsDrawn
      };
    }

    player.addCard(card);
    const handLimitResult = this.checkHandLimit(player);

    if (this.treasureCardsDrawn >= 2) {
      // Process Waters Rise! cards
      this.processWatersRise();
    }

    return {
      success: true,
      card,
      drawn: this.treasureCardsDrawn,
      handLimitExceeded: handLimitResult
    };
  }

  processWatersRise() {
    for (const card of this.pendingWatersRise) {
      this.waterLevel++;

      // Check for game over
      if (this.waterLevel >= 10) {
        this.phase = GAME_PHASE.GAME_OVER;
        this.gameOverReason = 'Poziom wody osiągnął maksimum!';
        return { gameOver: true, reason: this.gameOverReason };
      }
    }

    if (this.pendingWatersRise.length > 0) {
      // Shuffle flood discard pile onto draw pile
      this.floodDeck.putDiscardOnTop();
    }

    this.pendingWatersRise = [];
    return { gameOver: false };
  }

  finishDrawingTreasure(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }

    // Process any pending Waters Rise! cards
    const watersResult = this.processWatersRise();
    if (watersResult.gameOver) {
      return { success: false, gameOver: true, reason: this.gameOverReason };
    }

    this.phase = GAME_PHASE.DRAW_FLOOD;
    this.floodCardsDrawn = 0;

    return { success: true };
  }

  // ========== DRAW FLOOD CARDS ==========

  drawFloodCard(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }
    if (this.phase !== GAME_PHASE.DRAW_FLOOD) {
      return { success: false, message: 'Nie jesteś w fazie zalewania' };
    }

    const floodCount = WATER_LEVELS[this.waterLevel].floodCards;
    if (this.floodCardsDrawn >= floodCount) {
      return { success: false, message: 'Już dobrałeś wszystkie karty powodzi' };
    }

    const card = this.floodDeck.draw();
    if (!card) {
      return { success: false, message: 'Brak kart powodzi' };
    }

    this.floodCardsDrawn++;
    const result = this.island.floodTile(card.tileId);

    if (result.sunk) {
      // Check if any player is on the sunk tile
      const playersOnTile = this.players.filter(p => p.tileId === card.tileId);
      for (const p of playersOnTile) {
        const escapeResult = this.playerEscape(p);
        if (!escapeResult.success) {
          this.phase = GAME_PHASE.GAME_OVER;
          this.gameOverReason = `${p.name} utonął/ęła!`;
          return {
            success: true,
            card,
            result,
            gameOver: true,
            reason: this.gameOverReason
          };
        }
      }

      // Check lose conditions
      const loseCheck = this.checkLoseConditions();
      if (loseCheck.gameOver) {
        this.phase = GAME_PHASE.GAME_OVER;
        this.gameOverReason = loseCheck.reason;
        return {
          success: true,
          card,
          result,
          gameOver: true,
          reason: this.gameOverReason
        };
      }

      // Card is removed from game with the tile
    } else {
      this.floodDeck.discard(card);
    }

    return {
      success: true,
      card,
      result,
      drawn: this.floodCardsDrawn,
      remaining: floodCount - this.floodCardsDrawn
    };
  }

  playerEscape(player) {
    // Find valid escape tiles based on role
    const currentTile = this.island.getTileById(player.tileId);
    if (!currentTile || currentTile.state !== TILE_STATE.SUNK) {
      return { success: true }; // No escape needed
    }

    let validEscapes;
    if (player.role.id === 'diver') {
      validEscapes = this.island.getDiverMoves(player.row, player.col);
    } else if (player.role.id === 'explorer') {
      validEscapes = this.island.getAdjacentTiles(player.row, player.col, true);
    } else if (player.role.id === 'pilot' && !player.usedPilotAbility) {
      validEscapes = this.island.getAllNonSunkTiles();
    } else {
      validEscapes = this.island.getAdjacentTiles(player.row, player.col, false);
    }

    validEscapes = validEscapes.filter(t => t.state !== TILE_STATE.SUNK);

    if (validEscapes.length === 0) {
      return { success: false, reason: `${player.name} nie może uciec!` };
    }

    // Auto-escape to first valid tile (in a real game, player would choose)
    player.moveTo(validEscapes[0]);
    return { success: true, escapedTo: validEscapes[0] };
  }

  finishFloodPhase(playerId) {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      return { success: false, message: 'Nie twoja tura' };
    }

    // Move to next player
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.phase = GAME_PHASE.ACTIONS;
    this.actionsRemaining = 3;

    // Reset pilot ability for new turn
    const nextPlayer = this.getCurrentPlayer();
    nextPlayer.usedPilotAbility = false;

    return { success: true, nextPlayer: nextPlayer.id };
  }

  // ========== HAND LIMIT ==========

  checkHandLimit(player) {
    if (player.hand.length > 5) {
      return {
        exceeded: true,
        player: player.id,
        count: player.hand.length
      };
    }
    return null;
  }

  discardCard(playerId, cardId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, message: 'Nieprawidłowy gracz' };
    }

    const card = player.removeCard(cardId);
    if (!card) {
      return { success: false, message: 'Nie masz tej karty' };
    }

    this.treasureDeck.discard(card);
    return { success: true, handCount: player.hand.length };
  }

  // ========== LOSE CONDITIONS ==========

  checkLoseConditions() {
    // Check if helipad is sunk
    const helipad = this.island.getHelipad();
    if (!helipad || helipad.state === TILE_STATE.SUNK) {
      return { gameOver: true, reason: 'Lądowisko Głupców zostało zatopione!' };
    }

    // Check if both tiles for any uncaptured artifact are sunk
    for (const [key, artifact] of Object.entries(ARTIFACTS)) {
      if (!this.capturedArtifacts[artifact.id]) {
        const tiles = this.island.getArtifactTiles(artifact.id);
        if (tiles.length === 0) {
          return {
            gameOver: true,
            reason: `Oba pola z ${artifact.name} zostały zatopione!`
          };
        }
      }
    }

    // Water level checked separately in processWatersRise

    return { gameOver: false };
  }

  // ========== GAME STATE ==========

  getState(forPlayerId = null) {
    return {
      gameId: this.gameId,
      phase: this.phase,
      waterLevel: this.waterLevel,
      waterLevelInfo: WATER_LEVELS[this.waterLevel],
      difficulty: this.difficulty,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      actionsRemaining: this.actionsRemaining,
      capturedArtifacts: this.capturedArtifacts,
      gameOverReason: this.gameOverReason,
      players: this.players.map(p => {
        const state = p.getState();
        // Hide other players' hands unless same player
        if (forPlayerId && p.id !== forPlayerId) {
          state.hand = state.hand.map(c => ({ hidden: true }));
        }
        return state;
      }),
      island: this.island?.getState(),
      treasureDeck: this.treasureDeck?.getState(),
      floodDeck: this.floodDeck?.getState(),
      floodCardsRequired: WATER_LEVELS[this.waterLevel]?.floodCards,
      floodCardsDrawn: this.floodCardsDrawn,
      treasureCardsDrawn: this.treasureCardsDrawn
    };
  }

  getValidActions(playerId) {
    const player = this.getCurrentPlayer();
    if (!player || player.id !== playerId) {
      return { isCurrentPlayer: false, actions: [] };
    }

    const actions = [];

    if (this.phase === GAME_PHASE.ACTIONS && this.actionsRemaining > 0) {
      // Move
      const moves = this.island.getValidMoves(player.row, player.col, player.role.id);
      if (moves.length > 0) {
        actions.push({
          type: ACTIONS.MOVE,
          targets: moves.map(t => t.id)
        });
      }

      // Pilot fly
      if (player.role.id === 'pilot' && !player.usedPilotAbility) {
        actions.push({
          type: 'pilot_fly',
          targets: this.island.getAllNonSunkTiles().map(t => t.id)
        });
      }

      // Navigator move
      if (player.role.id === 'navigator') {
        for (const p of this.players) {
          if (p.id !== player.id) {
            const navMoves = this.getNavigatorMoves(p);
            if (navMoves.length > 0) {
              actions.push({
                type: 'navigator_move',
                targetPlayer: p.id,
                targets: navMoves.map(t => t.id)
              });
            }
          }
        }
      }

      // Shore up
      const shoreTargets = this.island.getShoreUpTargets(player.row, player.col, player.role.id);
      if (shoreTargets.length > 0) {
        actions.push({
          type: ACTIONS.SHORE_UP,
          targets: shoreTargets.map(t => t.id)
        });
      }

      // Give card
      const giveableCards = player.hand.filter(c => !c.isAction);
      if (giveableCards.length > 0) {
        const validReceivers = player.role.id === 'messenger'
          ? this.players.filter(p => p.id !== player.id)
          : this.players.filter(p => p.id !== player.id && p.tileId === player.tileId);

        if (validReceivers.length > 0) {
          actions.push({
            type: ACTIONS.GIVE_CARD,
            cards: giveableCards.map(c => c.id),
            receivers: validReceivers.map(p => p.id)
          });
        }
      }

      // Capture treasure
      const currentTile = this.island.getTileById(player.tileId);
      if (currentTile?.artifact && !this.capturedArtifacts[currentTile.artifact]) {
        const matchingCards = player.countCardsByType(currentTile.artifact);
        if (matchingCards >= 4) {
          actions.push({
            type: ACTIONS.CAPTURE_TREASURE,
            artifact: currentTile.artifact
          });
        }
      }
    }

    // Special action cards (can be used anytime)
    const helicopters = player.hand.filter(c => c.type === 'helicopter');
    if (helicopters.length > 0) {
      actions.push({
        type: ACTIONS.USE_HELICOPTER,
        cards: helicopters.map(c => c.id),
        canEscape: Object.values(this.capturedArtifacts).every(v => v)
      });
    }

    const sandbags = player.hand.filter(c => c.type === 'sandbags');
    if (sandbags.length > 0) {
      const floodedTiles = this.island.getAllFloodedTiles();
      if (floodedTiles.length > 0) {
        actions.push({
          type: ACTIONS.USE_SANDBAGS,
          cards: sandbags.map(c => c.id),
          targets: floodedTiles.map(t => t.id)
        });
      }
    }

    return {
      isCurrentPlayer: true,
      phase: this.phase,
      actionsRemaining: this.actionsRemaining,
      actions
    };
  }
}

module.exports = GameState;
