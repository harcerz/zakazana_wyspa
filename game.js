const islandTileNames = [
    { name: "Twilight Hollow", treasure: null }, { name: "Phantom Rock", treasure: null },
    { name: "Cave of Embers", treasure: "Crystal of Fire" }, { name: "Coral Palace", treasure: "Ocean's Chalice" },
    { name: "Whispering Gardens", treasure: "Statue of the Wind" }, { name: "Crimson Forest", treasure: null },
    { name: "Misty Marsh", treasure: null }, { name: "Observatory", treasure: null },
    { name: "Silver Gate", treasure: null }, { name: "Temple of the Moon", treasure: "Earth Stone" },
    { name: "Tidal Palace", treasure: "Ocean's Chalice" }, { name: "Watchtower", treasure: null },
    { name: "Breakers Bridge", treasure: null }, { name: "Bronze Gate", treasure: null },
    { name: "Cliffs of Abandon", treasure: null }, { name: "Copper Gate", treasure: null },
    { name: "Dunes of Deception", treasure: null }, { name: "Fools' Landing", treasure: null, isHelicopterPad: true },
    { name: "Gold Gate", treasure: null }, { name: "Howling Garden", treasure: "Statue of the Wind" },
    { name: "Iron Gate", treasure: null }, { name: "Lost Lagoon", treasure: null },
    { name: "Temple of the Sun", treasure: "Earth Stone" }, { name: "Cave of Shadows", treasure: "Crystal of Fire" }
];

const treasureDeckConfig = [
    { type: 'artifact', name: 'Earth Stone', count: 5 },
    { type: 'artifact', name: 'Statue of the Wind', count: 5 },
    { type: 'artifact', name: 'Crystal of Fire', count: 5 },
    { type: 'artifact', name: 'Ocean\'s Chalice', count: 5 },
    { type: 'special', name: 'Helicopter Lift', count: 3 },
    { type: 'special', name: 'Sandbags', count: 2 },
    { type: 'special', name: 'Waters Rise!', count: 3 }
];

const adventurerRoles = [
    { name: 'Pilot', ability: 'Once per turn, fly to any tile for 1 action.', startTile: "Fools' Landing" },
    { name: 'Engineer', ability: 'Shore up 2 tiles for 1 action.', startTile: 'Bronze Gate' },
    { name: 'Diver', ability: 'Move through adjacent flooded or missing tiles for 1 action.', startTile: 'Iron Gate' },
    { name: 'Messenger', ability: 'Give Treasure cards to any player on any tile.', startTile: 'Silver Gate' },
    { name: 'Navigator', ability: 'Move another player up to 2 adjacent tiles for 1 action.', startTile: 'Gold Gate' },
    { name: 'Explorer', ability: 'Move and shore up diagonally.', startTile: 'Copper Gate' }
];

const treasures = ['Earth Stone', 'Statue of the Wind', 'Crystal of Fire', 'Ocean\'s Chalice'];
const WATER_LEVEL_MAX = 10;

let gameState = {};
let lobbyPlayers = [];
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function addPlayerToLobby(id) { if (lobbyPlayers.length < MAX_PLAYERS) { const isHost = lobbyPlayers.length === 0; lobbyPlayers.push({ id, name: '', isReady: false, isHost }); return true; } return false; }
function removePlayerFromLobby(id) { lobbyPlayers = lobbyPlayers.filter(p => p.id !== id); if (lobbyPlayers.length > 0 && !lobbyPlayers.some(p => p.isHost)) { lobbyPlayers[0].isHost = true; } }
function setPlayerReady(id, name) { const player = lobbyPlayers.find(p => p.id === id); if (player) { player.name = name; player.isReady = true; } }
function getLobbyState() { const allReady = lobbyPlayers.every(p => p.isReady); const canStart = lobbyPlayers.length >= MIN_PLAYERS && lobbyPlayers.length <= MAX_PLAYERS; return { players: lobbyPlayers, allReady, canStart }; }
function resetLobby() { lobbyPlayers = []; }

function initializeGame(difficulty) {
    const players = JSON.parse(JSON.stringify(lobbyPlayers));
    const islandTiles = islandTileNames.map((tileInfo, index) => ({ ...tileInfo, id: index, flooded: false, sunk: false }));
    const boardLayout = shuffle([...islandTiles]);
    let treasureDeck = [];
    treasureDeckConfig.forEach(cardInfo => { for (let i = 0; i < cardInfo.count; i++) { treasureDeck.push({ type: cardInfo.type, name: cardInfo.name }); } });
    treasureDeck = shuffle(treasureDeck);
    let floodDeck = shuffle(islandTileNames.map(t => t.name));
    const assignedRoles = shuffle([...adventurerRoles]).slice(0, players.length);
    players.forEach((player, index) => { player.role = assignedRoles[index]; player.hand = []; const startTile = boardLayout.find(t => t.name === player.role.startTile); player.position = startTile.id; });
    gameState = { players, board: boardLayout, treasureDeck, floodDeck, floodDiscard: [], treasureDiscard: [], waterLevel: parseInt(difficulty, 10), treasuresCaptured: [], turn: 0, actionsRemaining: 3, phase: 'actions', gameOver: null };
    players.forEach(player => { for (let i = 0; i < 2; i++) drawTreasureCard(player, true); });
    for (let i = 0; i < 6; i++) drawFloodCard();
    checkWinLossConditions();
    return gameState;
}

function checkWinLossConditions() {
    if (gameState.gameOver) return;
    if (gameState.waterLevel >= WATER_LEVEL_MAX) return gameState.gameOver = { status: 'loss', reason: 'The water level reached the maximum!' };
    const foolsLanding = gameState.board.find(t => t.isHelicopterPad);
    if (foolsLanding.sunk) return gameState.gameOver = { status: 'loss', reason: "Fools' Landing has sunk!" };
    for (const treasure of treasures) {
        if (!gameState.treasuresCaptured.includes(treasure)) {
            const treasureTiles = gameState.board.filter(t => t.treasure === treasure);
            if (treasureTiles.every(t => t.sunk)) return gameState.gameOver = { status: 'loss', reason: `The island has sunk before you could collect the ${treasure}!` };
        }
    }
}

function handlePlayerAction(playerId, action) {
    if (gameState.gameOver) return { error: "The game is over." };
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return { error: "Player not found." };

    // Handle special actions that can be played at any time
    if (action.action === 'helicopter-lift') {
        const heliCardIndex = player.hand.findIndex(c => c.name === 'Helicopter Lift');
        if (heliCardIndex === -1) return { error: "You don't have a Helicopter Lift card." };

        const foolsLanding = gameState.board.find(t => t.isHelicopterPad);
        const allPlayersOnPad = gameState.players.every(p => p.position === foolsLanding.id);
        if (allPlayersOnPad && gameState.treasuresCaptured.length === treasures.length) {
            gameState.gameOver = { status: 'win', reason: 'You have escaped the island with all the treasures!' };
            return { success: true, gameState };
        } else {
            return { error: "Not all players are on Fools' Landing with all treasures captured." };
        }
    }

    const isCurrentPlayer = gameState.players[gameState.turn].id === playerId;
    if (!isCurrentPlayer) return { error: "It's not your turn." };
    if (gameState.actionsRemaining <= 0) return { error: "You have no actions left." };

    let actionSuccessful = false;
    switch (action.action) {
        case 'fly': {
            if (player.role.name === 'Pilot' && !player.flyUsedThisTurn) {
                const targetTile = gameState.board.find(t => t.id === action.tileId);
                if (targetTile && !targetTile.sunk) {
                    player.position = targetTile.id;
                    player.flyUsedThisTurn = true;
                    actionSuccessful = true;
                }
            }
            break;
        }
        case 'navigate': {
            if (player.role.name === 'Navigator' && action.targetPlayerId && action.targetTileId !== undefined) {
                const targetPlayer = gameState.players.find(p => p.id === action.targetPlayerId);
                const targetTile = gameState.board.find(t => t.id === action.targetTileId);
                if (targetPlayer && targetTile && !targetTile.sunk) {
                    if (areTilesAdjacent(targetPlayer.position, targetTile.id, true)) {
                         targetPlayer.position = targetTile.id;
                         actionSuccessful = true;
                    }
                }
            }
            break;
        }
        case 'move': {
            const isExplorer = player.role.name === 'Explorer';
            const isDiver = player.role.name === 'Diver';
            const targetTile = gameState.board.find(t => t.id === action.tileId);

            if (targetTile) {
                if (isDiver) {
                    // Simplified Diver: Can move to an adjacent tile even if it's sunk.
                    if (areTilesAdjacent(player.position, targetTile.id, true)) {
                         player.position = targetTile.id;
                         actionSuccessful = true;
                    }
                } else if (!targetTile.sunk && areTilesAdjacent(player.position, targetTile.id, isExplorer)) {
                    player.position = targetTile.id;
                    actionSuccessful = true;
                }
            }
            break;
        }
        case 'shore-up': {
            const isExplorer = player.role.name === 'Explorer';
            const tile1 = gameState.board.find(t => t.id === action.tileId);
            let shoredUpCount = 0;

            if (tile1 && tile1.flooded && (areTilesAdjacent(player.position, tile1.id, isExplorer) || player.position === tile1.id)) {
                tile1.flooded = false;
                shoredUpCount++;
            }

            if (player.role.name === 'Engineer' && action.secondTileId !== undefined) {
                const tile2 = gameState.board.find(t => t.id === action.secondTileId);
                 if (tile2 && tile2.flooded && (areTilesAdjacent(player.position, tile2.id, isExplorer) || player.position === tile2.id)) {
                    if (tile1.id !== tile2.id) {
                        tile2.flooded = false;
                    }
                    shoredUpCount++;
                }
            }

            if (shoredUpCount > 0) {
                actionSuccessful = true;
            }
            break;
        }
        case 'give-card': {
            const targetPlayer = gameState.players.find(p => p.id === action.targetPlayerId);
            const cardToGiveIndex = player.hand.findIndex(c => c.name === action.cardName);
            if (targetPlayer && cardToGiveIndex !== -1 && (player.position === targetPlayer.position || player.role.name === 'Messenger')) {
                if (targetPlayer.hand.length < 5) {
                    const card = player.hand.splice(cardToGiveIndex, 1)[0];
                    targetPlayer.hand.push(card);
                    actionSuccessful = true;
                } else { return { error: "Target player's hand is full." }; }
            }
            break;
        }
        case 'capture-treasure': {
            const playerTile = gameState.board.find(t => t.id === player.position);
            const treasureOnTile = playerTile ? playerTile.treasure : null;
            if (treasureOnTile && !gameState.treasuresCaptured.includes(treasureOnTile)) {
                const matchingCards = player.hand.filter(c => c.name === treasureOnTile);
                if (matchingCards.length >= 4) {
                    for (let i = 0; i < 4; i++) {
                        const cardIndex = player.hand.findIndex(c => c.name === treasureOnTile);
                        if (cardIndex !== -1) gameState.treasureDiscard.push(player.hand.splice(cardIndex, 1)[0]);
                    }
                    gameState.treasuresCaptured.push(treasureOnTile);
                    actionSuccessful = true;
                }
            }
            break;
        }
    }

    if (!actionSuccessful) {
        return { error: "Invalid action or conditions not met." };
    }

    gameState.actionsRemaining--;
    checkWinLossConditions();

    if (gameState.actionsRemaining === 0 && !gameState.gameOver) {
        // --- End of Turn Sequence ---
        // 1. Draw 2 Treasure Cards
        for (let i = 0; i < 2; i++) drawTreasureCard(player);
        checkWinLossConditions();
        if (gameState.gameOver) return { success: true, gameState };

        // 2. Draw Flood Cards
        for (let i = 0; i < gameState.waterLevel; i++) drawFloodCard();
        checkWinLossConditions();
        if (gameState.gameOver) return { success: true, gameState };

        // 3. Prepare for Next Player
        gameState.turn = (gameState.turn + 1) % gameState.players.length;
        gameState.actionsRemaining = 3;

        // Reset turn-specific flags
        const nextPlayer = gameState.players[gameState.turn];
        if (nextPlayer.role.name === 'Pilot') {
            nextPlayer.flyUsedThisTurn = false;
        }
    }

    return { success: true, gameState };
}

function drawTreasureCard(player, isSetup = false) {
    if (gameState.treasureDeck.length === 0) return;
    let card = gameState.treasureDeck.pop();
    if (card.name === 'Waters Rise!') {
        if (isSetup) { gameState.treasureDeck.push(card); shuffle(gameState.treasureDeck); drawTreasureCard(player, true); return; }
        handleWatersRise();
        gameState.treasureDiscard.push(card);
    } else {
        if (player.hand.length < 5) player.hand.push(card);
        else gameState.treasureDiscard.push(card);
    }
}

function handleWatersRise() {
    gameState.waterLevel++;
    checkWinLossConditions();
    gameState.floodDeck = shuffle([...gameState.floodDiscard, ...gameState.floodDeck]);
    gameState.floodDiscard = [];
}

function drawFloodCard() {
    if (gameState.floodDeck.length === 0) return;
    const tileName = gameState.floodDeck.pop();
    const tile = gameState.board.find(t => t.name === tileName);
    if (tile && !tile.sunk) {
        if (tile.flooded) {
            tile.sunk = true;
            gameState.players.forEach(p => {
                if (p.position === tile.id) {
                    const adjacentTiles = gameState.board.filter(t => areTilesAdjacent(p.position, t.id) && !t.sunk);
                    if (adjacentTiles.length === 0) gameState.gameOver = { status: 'loss', reason: `${p.name} has drowned!` };
                }
            });
        } else { tile.flooded = true; }
        gameState.floodDiscard.push(tileName);
        checkWinLossConditions();
    }
}

function getTileCoordinates(tileId) {
    let index = 0;
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            const isPlaceholder = ((y === 0 || y === 4) && (x === 0 || x === 4)) || ((y === 0 || y === 4) && (x === 1 || x === 3)) || ((y === 1 || y === 3) && (x === 0 || x === 4));
            if (isPlaceholder) continue;
            const tileOnBoard = gameState.board.find(t => t.id === index);
            if (tileOnBoard) {
                if (tileOnBoard.id === tileId) return { x, y };
                index++;
            }
        }
    }
    return null;
}

function areTilesAdjacent(tileId1, tileId2, allowDiagonal = false) {
    const pos1 = getTileCoordinates(tileId1);
    const pos2 = getTileCoordinates(tileId2);
    if (!pos1 || !pos2) return false;

    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);

    if (allowDiagonal) {
        return (dx <= 1 && dy <= 1) && (dx + dy > 0);
    } else {
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }
}

module.exports = { addPlayerToLobby, removePlayerFromLobby, setPlayerReady, getLobbyState, resetLobby, initializeGame, getGameState: () => gameState, handlePlayerAction, };