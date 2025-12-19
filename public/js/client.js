// Forbidden Island - Client
const socket = io();

// Game state
let gameState = null;
let playerId = null;
let playerName = '';
let selectedAction = null;
let selectedCard = null;
let selectedTile = null;
let selectedPlayers = [];

// Constants
const ARTIFACTS = {
  fire: { name: 'Kryształ Ognia', emoji: '🔥' },
  wind: { name: 'Posąg Wiatru', emoji: '🌪️' },
  water: { name: 'Kielich Oceanu', emoji: '🌊' },
  earth: { name: 'Kamień Ziemi', emoji: '🪨' }
};

const CARD_EMOJIS = {
  fire: '🔥',
  wind: '🌪️',
  water: '🌊',
  earth: '🪨',
  helicopter: '🚁',
  sandbags: '🛡️'
};

const PHASE_NAMES = {
  lobby: 'Lobby',
  setup: 'Przygotowanie',
  actions: 'Faza Akcji',
  draw_treasure: 'Dobieranie Kart',
  draw_flood: 'Faza Powodzi',
  game_over: 'Koniec Gry',
  victory: 'Zwycięstwo!'
};

// DOM Elements
const lobbyEl = document.getElementById('lobby');
const gameEl = document.getElementById('game');
const menuScreen = document.getElementById('menu-screen');
const lobbyScreen = document.getElementById('lobby-screen');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

function setupEventListeners() {
  // Menu buttons
  document.getElementById('btn-create').addEventListener('click', showCreateForm);
  document.getElementById('btn-join').addEventListener('click', showJoinForm);

  // Create game
  document.getElementById('btn-create-confirm').addEventListener('click', createGame);

  // Join game
  document.getElementById('btn-join-confirm').addEventListener('click', joinGame);

  // Back buttons
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', showMenu);
  });

  // Start game
  document.getElementById('btn-start-game').addEventListener('click', () => {
    socket.emit('start_game');
  });

  // Difficulty select
  document.getElementById('difficulty-select').addEventListener('change', (e) => {
    socket.emit('set_difficulty', { difficulty: parseInt(e.target.value) });
  });

  // Action buttons
  document.getElementById('btn-move').addEventListener('click', () => selectAction('move'));
  document.getElementById('btn-shore').addEventListener('click', () => selectAction('shore_up'));
  document.getElementById('btn-give').addEventListener('click', () => selectAction('give_card'));
  document.getElementById('btn-capture').addEventListener('click', captureTreasure);
  document.getElementById('btn-end-actions').addEventListener('click', endActions);
  document.getElementById('btn-draw-treasure').addEventListener('click', drawTreasure);
  document.getElementById('btn-draw-flood').addEventListener('click', drawFlood);

  // Chat
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    if (input.value.trim()) {
      socket.emit('chat', { message: input.value });
      input.value = '';
    }
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
}

// Screen navigation
function showCreateForm() {
  document.getElementById('menu-buttons').style.display = 'none';
  document.getElementById('create-form').style.display = 'block';
}

function showJoinForm() {
  document.getElementById('menu-buttons').style.display = 'none';
  document.getElementById('join-form').style.display = 'block';
}

function showMenu() {
  document.getElementById('menu-buttons').style.display = 'block';
  document.getElementById('create-form').style.display = 'none';
  document.getElementById('join-form').style.display = 'none';
}

function showLobby() {
  menuScreen.style.display = 'none';
  lobbyScreen.style.display = 'block';
}

function showGame() {
  lobbyEl.style.display = 'none';
  gameEl.style.display = 'block';
}

// Socket handlers
socket.on('game_created', (data) => {
  playerId = data.playerId;
  playerName = data.playerName;
  document.getElementById('game-code').textContent = data.gameId;
  showLobby();
  showNotification('Gra utworzona!', 'success');
});

socket.on('game_joined', (data) => {
  playerId = data.playerId;
  playerName = data.playerName;
  document.getElementById('game-code').textContent = data.gameId;
  showLobby();
  showNotification('Dołączono do gry!', 'success');
});

socket.on('player_joined', (data) => {
  showNotification(`${data.playerName} dołączył do gry`, 'info');
});

socket.on('game_started', (data) => {
  showGame();
  showNotification('Gra rozpoczęta!', 'success');
});

socket.on('game_state', (state) => {
  gameState = state;
  renderGame();
});

socket.on('card_drawn', (data) => {
  if (data.watersRise) {
    showNotification('Wody Przybywają! Poziom wody wzrasta!', 'error');
  } else {
    showNotification(`Dobrano: ${data.card.name}`, 'info');
  }
});

socket.on('tile_flooded', (data) => {
  const tile = gameState?.island?.tiles?.find(t => t.id === data.tileId);
  const name = tile?.name || data.tileId;
  if (data.sunk) {
    showNotification(`${name} zatopione!`, 'error');
  } else if (data.flooded) {
    showNotification(`${name} zalane!`, 'info');
  }
});

socket.on('treasure_captured', (data) => {
  showNotification(`Zdobyto: ${data.artifact.name} ${data.artifact.emoji}!`, 'success');
});

socket.on('waters_rise', (data) => {
  showNotification(`Poziom wody: ${data.waterLevel}`, 'error');
});

socket.on('victory', (data) => {
  showModal('Zwycięstwo!', data.message, 'victory');
});

socket.on('game_over', (data) => {
  showModal('Koniec Gry', data.reason, 'defeat');
});

socket.on('action_error', (data) => {
  showNotification(data.message, 'error');
});

socket.on('error', (message) => {
  showNotification(message, 'error');
});

socket.on('chat', (data) => {
  addChatMessage(data.playerName, data.message);
});

socket.on('player_disconnected', (data) => {
  showNotification(`${data.playerName} rozłączył się`, 'error');
});

// Game actions
function createGame() {
  const name = document.getElementById('create-player-name').value.trim() || 'Gracz';
  socket.emit('create_game', { playerName: name });
}

function joinGame() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('join-player-name').value.trim() || 'Gracz';

  if (!code) {
    showNotification('Wprowadź kod gry', 'error');
    return;
  }

  socket.emit('join_game', { gameId: code, playerName: name });
}

function selectAction(action) {
  if (selectedAction === action) {
    selectedAction = null;
    selectedTile = null;
    selectedCard = null;
    selectedPlayers = [];
  } else {
    selectedAction = action;
    selectedTile = null;
    selectedCard = null;
    selectedPlayers = [];
  }
  renderGame();
}

function handleTileClick(tileId) {
  if (!gameState || !selectedAction) return;

  const validActions = gameState.validActions;
  if (!validActions?.isCurrentPlayer) return;

  if (selectedAction === 'move') {
    const moveAction = validActions.actions.find(a => a.type === 'move');
    if (moveAction?.targets?.includes(tileId)) {
      socket.emit('move', { tileId });
      selectedAction = null;
    }
  } else if (selectedAction === 'pilot_fly') {
    socket.emit('pilot_fly', { tileId });
    selectedAction = null;
  } else if (selectedAction === 'shore_up') {
    const shoreAction = validActions.actions.find(a => a.type === 'shore_up');
    if (shoreAction?.targets?.includes(tileId)) {
      socket.emit('shore_up', { tileId });
      selectedAction = null;
    }
  } else if (selectedAction === 'use_sandbags' && selectedCard) {
    socket.emit('use_sandbags', { cardId: selectedCard, tileId });
    selectedAction = null;
    selectedCard = null;
  } else if (selectedAction === 'use_helicopter' && selectedCard) {
    if (selectedPlayers.length > 0) {
      socket.emit('use_helicopter', {
        cardId: selectedCard,
        playerIds: selectedPlayers,
        targetTileId: tileId
      });
      selectedAction = null;
      selectedCard = null;
      selectedPlayers = [];
    }
  }
}

function handleCardClick(cardId, cardType) {
  if (!gameState?.validActions?.isCurrentPlayer) return;

  const myPlayer = gameState.players.find(p => p.id === playerId);
  if (!myPlayer) return;

  const card = myPlayer.hand.find(c => c.id === cardId);
  if (!card) return;

  // Check if we need to discard (hand limit)
  if (myPlayer.hand.length > 5) {
    socket.emit('discard_card', { cardId });
    showNotification('Odrzucono kartę (limit ręki)', 'info');
    return;
  }

  // Select card for giving or using
  if (selectedAction === 'give_card') {
    if (card.isAction) {
      showNotification('Nie możesz dawać kart akcji', 'error');
      return;
    }
    selectedCard = cardId;
    showNotification('Wybierz gracza, któremu chcesz dać kartę', 'info');
    renderGame();
  } else if (cardType === 'helicopter') {
    selectedAction = 'use_helicopter';
    selectedCard = cardId;
    selectedPlayers = [playerId]; // Start with self selected
    showNotification('Wybierz graczy do przeniesienia, potem pole docelowe', 'info');
    renderGame();
  } else if (cardType === 'sandbags') {
    selectedAction = 'use_sandbags';
    selectedCard = cardId;
    showNotification('Wybierz zalane pole do osuszenia', 'info');
    renderGame();
  } else {
    selectedCard = selectedCard === cardId ? null : cardId;
    renderGame();
  }
}

function handlePlayerClick(targetPlayerId) {
  if (!gameState?.validActions?.isCurrentPlayer) return;

  if (selectedAction === 'give_card' && selectedCard) {
    socket.emit('give_card', { cardId: selectedCard, targetPlayerId });
    selectedAction = null;
    selectedCard = null;
  } else if (selectedAction === 'use_helicopter') {
    if (selectedPlayers.includes(targetPlayerId)) {
      selectedPlayers = selectedPlayers.filter(id => id !== targetPlayerId);
    } else {
      selectedPlayers.push(targetPlayerId);
    }
    renderGame();
  } else if (selectedAction === 'navigator_move') {
    // Navigator selecting player to move
    selectedPlayers = [targetPlayerId];
    showNotification('Teraz wybierz pole docelowe', 'info');
    renderGame();
  }
}

function captureTreasure() {
  socket.emit('capture_treasure');
  selectedAction = null;
}

function endActions() {
  socket.emit('end_actions');
  selectedAction = null;
}

function drawTreasure() {
  socket.emit('draw_treasure');
}

function drawFlood() {
  socket.emit('draw_flood');
}

// Rendering
function renderGame() {
  if (!gameState) return;

  renderWaterLevel();
  renderPhase();
  renderIsland();
  renderArtifacts();
  renderHand();
  renderActions();
  renderPlayers();
}

function renderWaterLevel() {
  const container = document.getElementById('water-meter');
  container.innerHTML = '';

  for (let i = 1; i <= 10; i++) {
    const bar = document.createElement('div');
    bar.className = 'water-bar';
    if (i <= gameState.waterLevel) {
      bar.classList.add('active');
      if (i >= 7) bar.classList.add('danger');
    }
    container.appendChild(bar);
  }

  document.getElementById('water-level-text').textContent =
    `${gameState.waterLevel} - ${gameState.waterLevelInfo?.name || ''}`;
}

function renderPhase() {
  const phaseEl = document.getElementById('phase-name');
  const infoEl = document.getElementById('phase-info');

  phaseEl.textContent = PHASE_NAMES[gameState.phase] || gameState.phase;

  const isMyTurn = gameState.currentPlayerId === playerId;

  if (gameState.phase === 'actions') {
    infoEl.textContent = isMyTurn
      ? `Twoja tura! Pozostało ${gameState.actionsRemaining} akcji`
      : `Tura: ${gameState.players[gameState.currentPlayerIndex]?.name}`;
  } else if (gameState.phase === 'draw_treasure') {
    infoEl.textContent = isMyTurn
      ? `Dobierz ${2 - gameState.treasureCardsDrawn} kart`
      : 'Dobieranie kart skarbów...';
  } else if (gameState.phase === 'draw_flood') {
    infoEl.textContent = isMyTurn
      ? `Dobierz ${gameState.floodCardsRequired - gameState.floodCardsDrawn} kart powodzi`
      : 'Faza powodzi...';
  } else {
    infoEl.textContent = '';
  }

  if (isMyTurn) {
    phaseEl.classList.add('your-turn');
  } else {
    phaseEl.classList.remove('your-turn');
  }
}

function renderIsland() {
  const grid = document.getElementById('island-grid');
  grid.innerHTML = '';

  if (!gameState.island) return;

  const validActions = gameState.validActions;
  let validMoves = [];
  let validShores = [];

  if (validActions?.isCurrentPlayer) {
    const moveAction = validActions.actions?.find(a => a.type === 'move');
    validMoves = moveAction?.targets || [];

    const pilotAction = validActions.actions?.find(a => a.type === 'pilot_fly');
    if (selectedAction === 'pilot_fly' && pilotAction) {
      validMoves = pilotAction.targets || [];
    }

    const shoreAction = validActions.actions?.find(a => a.type === 'shore_up');
    validShores = shoreAction?.targets || [];

    const sandbagsAction = validActions.actions?.find(a => a.type === 'use_sandbags');
    if (selectedAction === 'use_sandbags' && sandbagsAction) {
      validShores = sandbagsAction.targets || [];
    }
  }

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const tileId = gameState.island.grid[row][col];
      const tile = tileId ? gameState.island.tiles.find(t => t.id === tileId) : null;

      const tileEl = document.createElement('div');
      tileEl.className = 'tile';

      if (!tile) {
        tileEl.classList.add('empty');
      } else {
        tileEl.classList.add(tile.state);
        tileEl.dataset.tileId = tile.id;

        // Valid move highlight
        if (selectedAction === 'move' || selectedAction === 'pilot_fly') {
          if (validMoves.includes(tile.id)) {
            tileEl.classList.add('valid-move');
          }
        }

        // Valid shore up highlight
        if (selectedAction === 'shore_up' || selectedAction === 'use_sandbags') {
          if (validShores.includes(tile.id)) {
            tileEl.classList.add('valid-shore');
          }
        }

        // Tile content
        const nameEl = document.createElement('div');
        nameEl.className = 'tile-name';
        nameEl.textContent = tile.name;
        tileEl.appendChild(nameEl);

        if (tile.artifact) {
          const artifactEl = document.createElement('div');
          artifactEl.className = 'tile-artifact';
          artifactEl.textContent = ARTIFACTS[tile.artifact]?.emoji || '';
          tileEl.appendChild(artifactEl);
        }

        if (tile.isHelipad) {
          const heliEl = document.createElement('div');
          heliEl.className = 'tile-helipad';
          heliEl.textContent = '🚁';
          tileEl.appendChild(heliEl);
        }

        // Players on tile
        const playersOnTile = gameState.players.filter(p => p.tileId === tile.id);
        if (playersOnTile.length > 0) {
          const playersEl = document.createElement('div');
          playersEl.className = 'players-on-tile';

          for (const p of playersOnTile) {
            const pawn = document.createElement('div');
            pawn.className = 'player-pawn';
            pawn.style.background = p.role.color;
            pawn.title = p.name;
            playersEl.appendChild(pawn);
          }

          tileEl.appendChild(playersEl);
        }

        tileEl.addEventListener('click', () => handleTileClick(tile.id));
      }

      grid.appendChild(tileEl);
    }
  }
}

function renderArtifacts() {
  const container = document.getElementById('artifacts-grid');
  container.innerHTML = '';

  for (const [key, artifact] of Object.entries(ARTIFACTS)) {
    const item = document.createElement('div');
    item.className = 'artifact-item';
    if (gameState.capturedArtifacts[key]) {
      item.classList.add('captured');
    }

    item.innerHTML = `
      <div class="artifact-emoji">${artifact.emoji}</div>
      <div class="artifact-name">${artifact.name}</div>
    `;

    container.appendChild(item);
  }
}

function renderHand() {
  const container = document.getElementById('hand-cards');
  container.innerHTML = '';

  const myPlayer = gameState.players.find(p => p.id === playerId);
  if (!myPlayer) return;

  for (const card of myPlayer.hand) {
    if (card.hidden) continue;

    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.type}`;
    if (selectedCard === card.id) {
      cardEl.classList.add('selected');
    }

    cardEl.innerHTML = `
      <div class="card-emoji">${CARD_EMOJIS[card.type] || '?'}</div>
      <div class="card-name">${card.name}</div>
    `;

    cardEl.addEventListener('click', () => handleCardClick(card.id, card.type));
    container.appendChild(cardEl);
  }

  // Hand limit warning
  if (myPlayer.hand.length > 5) {
    showNotification('Przekroczono limit kart! Odrzuć karty do 5.', 'error');
  }
}

function renderActions() {
  const validActions = gameState.validActions;
  const isMyTurn = validActions?.isCurrentPlayer && gameState.phase === 'actions';
  const hasActions = gameState.actionsRemaining > 0;

  // Action buttons
  const btnMove = document.getElementById('btn-move');
  const btnShore = document.getElementById('btn-shore');
  const btnGive = document.getElementById('btn-give');
  const btnCapture = document.getElementById('btn-capture');
  const btnEndActions = document.getElementById('btn-end-actions');
  const btnDrawTreasure = document.getElementById('btn-draw-treasure');
  const btnDrawFlood = document.getElementById('btn-draw-flood');

  // Reset all buttons
  [btnMove, btnShore, btnGive, btnCapture, btnEndActions, btnDrawTreasure, btnDrawFlood].forEach(btn => {
    btn.disabled = true;
    btn.classList.remove('active');
  });

  if (!validActions?.isCurrentPlayer) return;

  if (gameState.phase === 'actions') {
    const actions = validActions.actions || [];

    // Move
    if (hasActions && actions.find(a => a.type === 'move')) {
      btnMove.disabled = false;
      if (selectedAction === 'move') btnMove.classList.add('active');
    }

    // Shore up
    if (hasActions && actions.find(a => a.type === 'shore_up')) {
      btnShore.disabled = false;
      if (selectedAction === 'shore_up') btnShore.classList.add('active');
    }

    // Give card
    if (hasActions && actions.find(a => a.type === 'give_card')) {
      btnGive.disabled = false;
      if (selectedAction === 'give_card') btnGive.classList.add('active');
    }

    // Capture treasure
    if (hasActions && actions.find(a => a.type === 'capture_treasure')) {
      btnCapture.disabled = false;
    }

    // End actions
    btnEndActions.disabled = false;
  } else if (gameState.phase === 'draw_treasure') {
    if (gameState.treasureCardsDrawn < 2) {
      btnDrawTreasure.disabled = false;
    }
  } else if (gameState.phase === 'draw_flood') {
    if (gameState.floodCardsDrawn < gameState.floodCardsRequired) {
      btnDrawFlood.disabled = false;
    }
  }
}

function renderPlayers() {
  const container = document.getElementById('players-list');
  container.innerHTML = '';

  for (const player of gameState.players) {
    const playerEl = document.createElement('div');
    playerEl.className = 'player-info';

    if (gameState.currentPlayerId === player.id) {
      playerEl.classList.add('current-turn');
    }
    if (player.id === playerId) {
      playerEl.classList.add('is-me');
    }

    const isSelected = selectedPlayers.includes(player.id);

    playerEl.innerHTML = `
      <div class="player-avatar" style="background: ${player.role.color}">
        ${player.name.charAt(0).toUpperCase()}
      </div>
      <div class="player-details">
        <div class="player-name">${player.name}${player.id === playerId ? ' (Ty)' : ''}</div>
        <div class="player-role">${player.role.name}</div>
      </div>
      <div class="player-cards-count">${player.handCount} kart</div>
    `;

    if (selectedAction === 'give_card' || selectedAction === 'use_helicopter') {
      if (player.id !== playerId || selectedAction === 'use_helicopter') {
        playerEl.style.cursor = 'pointer';
        if (isSelected) {
          playerEl.style.boxShadow = '0 0 15px #feca57';
        }
        playerEl.addEventListener('click', () => handlePlayerClick(player.id));
      }
    }

    container.appendChild(playerEl);
  }
}

// Lobby rendering
socket.on('game_state', (state) => {
  gameState = state;

  if (state.phase === 'lobby') {
    renderLobbyPlayers();
  } else {
    renderGame();
  }
});

function renderLobbyPlayers() {
  const container = document.getElementById('lobby-players');
  container.innerHTML = '';

  for (const player of gameState.players) {
    const item = document.createElement('div');
    item.className = 'player-item';
    item.innerHTML = `
      <div class="player-color" style="background: #48dbfb"></div>
      <span>${player.name}${player.id === playerId ? ' (Ty)' : ''}</span>
    `;
    container.appendChild(item);
  }

  // Show start button only for first player
  const startBtn = document.getElementById('btn-start-game');
  if (gameState.players.length >= 2 && gameState.players[0]?.id === playerId) {
    startBtn.style.display = 'inline-block';
  } else {
    startBtn.style.display = 'none';
  }
}

// Chat
function addChatMessage(sender, message) {
  const container = document.getElementById('chat-messages');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message';
  msgEl.innerHTML = `<span class="sender">${sender}:</span> ${message}`;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

// Modal
function showModal(title, message, type) {
  const modal = document.getElementById('modal');
  const content = modal.querySelector('.modal-content');
  content.className = `modal-content ${type}`;

  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;

  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

// Notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}
