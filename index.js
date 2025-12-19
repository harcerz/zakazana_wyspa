const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');
const GameState = require('./game/GameState');
const { GAME_PHASE, DIFFICULTY, WATER_LEVELS } = require('./game/constants');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game rooms
const games = new Map();
const playerSockets = new Map();

// Generate unique game ID
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Gracz połączony:', socket.id);

  let currentGameId = null;
  let playerName = null;

  // Create new game
  socket.on('create_game', (data) => {
    const gameId = generateGameId();
    const game = new GameState(gameId);

    games.set(gameId, game);
    currentGameId = gameId;
    playerName = data.playerName || 'Gracz 1';

    const result = game.addPlayer(socket.id, playerName);
    if (result.success) {
      socket.join(gameId);
      playerSockets.set(socket.id, { gameId, playerName });

      socket.emit('game_created', {
        gameId,
        playerId: socket.id,
        playerName
      });

      broadcastGameState(gameId);
    } else {
      socket.emit('error', result.message);
    }
  });

  // Join existing game
  socket.on('join_game', (data) => {
    const { gameId } = data;
    playerName = data.playerName || 'Gracz';

    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Gra nie istnieje');
      return;
    }

    const result = game.addPlayer(socket.id, playerName);
    if (result.success) {
      currentGameId = gameId;
      socket.join(gameId);
      playerSockets.set(socket.id, { gameId, playerName });

      socket.emit('game_joined', {
        gameId,
        playerId: socket.id,
        playerName
      });

      io.to(gameId).emit('player_joined', {
        playerId: socket.id,
        playerName,
        playerCount: result.playerCount
      });

      broadcastGameState(gameId);
    } else {
      socket.emit('error', result.message);
    }
  });

  // Set difficulty
  socket.on('set_difficulty', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.setDifficulty(data.difficulty);
    if (result.success) {
      broadcastGameState(currentGameId);
    } else {
      socket.emit('error', result.message);
    }
  });

  // Start game
  socket.on('start_game', () => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.startGame();
    if (result.success) {
      io.to(currentGameId).emit('game_started', {
        initialFlood: result.initialFlood
      });
      broadcastGameState(currentGameId);
    } else {
      socket.emit('error', result.message);
    }
  });

  // Move action
  socket.on('move', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.move(socket.id, data.tileId);
    handleActionResult(game, result, 'move');
  });

  // Pilot fly action
  socket.on('pilot_fly', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.pilotFly(socket.id, data.tileId);
    handleActionResult(game, result, 'pilot_fly');
  });

  // Navigator move action
  socket.on('navigator_move', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.navigatorMove(socket.id, data.targetPlayerId, data.tileId);
    handleActionResult(game, result, 'navigator_move');
  });

  // Shore up action
  socket.on('shore_up', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.shoreUp(socket.id, data.tileId);
    handleActionResult(game, result, 'shore_up');
  });

  // Give card action
  socket.on('give_card', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.giveCard(socket.id, data.cardId, data.targetPlayerId);
    handleActionResult(game, result, 'give_card');
  });

  // Capture treasure action
  socket.on('capture_treasure', () => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.captureTreasure(socket.id);
    if (result.success) {
      io.to(currentGameId).emit('treasure_captured', {
        playerId: socket.id,
        artifact: result.artifact
      });
    }
    handleActionResult(game, result, 'capture_treasure');
  });

  // Use helicopter card
  socket.on('use_helicopter', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.useHelicopter(socket.id, data.cardId, data.playerIds, data.targetTileId);
    if (result.victory) {
      io.to(currentGameId).emit('victory', { message: result.message });
    }
    handleActionResult(game, result, 'use_helicopter');
  });

  // Use sandbags card
  socket.on('use_sandbags', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.useSandbags(socket.id, data.cardId, data.tileId);
    handleActionResult(game, result, 'use_sandbags');
  });

  // End actions phase
  socket.on('end_actions', () => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.endActions(socket.id);
    handleActionResult(game, result, 'end_actions');
  });

  // Draw treasure card
  socket.on('draw_treasure', () => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.drawTreasureCard(socket.id);
    if (result.success) {
      socket.emit('card_drawn', {
        card: result.card,
        watersRise: result.watersRise
      });

      if (result.watersRise) {
        io.to(currentGameId).emit('waters_rise', {
          waterLevel: game.waterLevel
        });
      }

      // Auto-advance if drawn 2 cards
      if (result.drawn >= 2) {
        game.finishDrawingTreasure(socket.id);
      }
    }
    handleActionResult(game, result, 'draw_treasure');
  });

  // Draw flood card
  socket.on('draw_flood', () => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.drawFloodCard(socket.id);
    if (result.success) {
      io.to(currentGameId).emit('tile_flooded', {
        tileId: result.card.tileId,
        flooded: result.result.flooded,
        sunk: result.result.sunk
      });

      if (result.gameOver) {
        io.to(currentGameId).emit('game_over', { reason: result.reason });
      }

      // Auto-advance if drawn all flood cards
      const floodCount = WATER_LEVELS[game.waterLevel].floodCards;
      if (result.drawn >= floodCount) {
        game.finishFloodPhase(socket.id);
      }
    }
    handleActionResult(game, result, 'draw_flood');
  });

  // Discard card (for hand limit)
  socket.on('discard_card', (data) => {
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.discardCard(socket.id, data.cardId);
    handleActionResult(game, result, 'discard_card');
  });

  // Get valid actions
  socket.on('get_valid_actions', () => {
    const game = games.get(currentGameId);
    if (!game) return;

    const actions = game.getValidActions(socket.id);
    socket.emit('valid_actions', actions);
  });

  // Chat message
  socket.on('chat', (data) => {
    if (currentGameId) {
      io.to(currentGameId).emit('chat', {
        playerId: socket.id,
        playerName,
        message: data.message
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Gracz rozłączony:', socket.id);

    if (currentGameId) {
      const game = games.get(currentGameId);
      if (game && game.phase === GAME_PHASE.LOBBY) {
        game.removePlayer(socket.id);
        broadcastGameState(currentGameId);

        // Remove empty games
        if (game.players.length === 0) {
          games.delete(currentGameId);
        }
      } else if (game) {
        // Game in progress - notify others
        io.to(currentGameId).emit('player_disconnected', {
          playerId: socket.id,
          playerName
        });
      }
    }

    playerSockets.delete(socket.id);
  });

  // Helper functions
  function handleActionResult(game, result, action) {
    if (!result.success) {
      socket.emit('action_error', { action, message: result.message });
    } else {
      broadcastGameState(currentGameId);
    }

    if (result.gameOver) {
      io.to(currentGameId).emit('game_over', { reason: result.reason || game.gameOverReason });
    }
  }

  function broadcastGameState(gameId) {
    const game = games.get(gameId);
    if (!game) return;

    // Send personalized state to each player
    const sockets = io.sockets.adapter.rooms.get(gameId);
    if (sockets) {
      for (const socketId of sockets) {
        const state = game.getState(socketId);
        const validActions = game.getValidActions(socketId);
        io.to(socketId).emit('game_state', { ...state, validActions });
      }
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serwer uruchomiony na porcie ${PORT}`);
  console.log(`Otwórz http://localhost:${PORT} w przeglądarce`);
});
