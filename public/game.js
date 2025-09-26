$(function () {
    const socket = io();

    // Lobby Elements
    const lobby = $('#lobby');
    const playerList = $('#player-list');
    const playerNameInput = $('#player-name-input');
    const difficultySelect = $('#difficulty-select');
    const readyBtn = $('#ready-btn');
    const startGamePrompt = $('#start-game-prompt');

    // Game Elements
    const gameContainer = $('#game-container');
    const gameBoard = $('#game-board');
    const playerInfo = $('#player-info');
    const gameInfo = $('#game-info');
    const actionsPanel = $('#actions-panel');
    const actionPrompt = $('#action-prompt');

    let localGameState = {};
    let currentAction = null;
    let selectedData = {};

    // --- LOBBY LOGIC ---
    readyBtn.on('click', function() {
        const playerName = playerNameInput.val().trim();
        if (playerName) {
            socket.emit('playerReady', { name: playerName });
            playerNameInput.prop('disabled', true);
            difficultySelect.prop('disabled', true);
            $(this).prop('disabled', true).text('Waiting...');
        } else {
            alert('Please enter your name.');
        }
    });

    socket.on('lobbyUpdate', (lobbyState) => {
        playerList.empty();
        lobbyState.players.forEach(p => {
            const playerDiv = $('<div>').text(`${p.name} - ${p.isReady ? 'Ready' : 'Not Ready'}`);
            playerList.append(playerDiv);
        });

        if (lobbyState.allReady && lobbyState.canStart) {
            startGamePrompt.show();
            // The first player who readied up can start the game
            const me = lobbyState.players.find(p => p.id === socket.id);
            if (me && me.isHost) {
                 // Automatically start for simplicity, or add a start button for the host
                 socket.emit('startGame', { difficulty: difficultySelect.val() });
            }
        } else {
            startGamePrompt.hide();
        }
    });

    socket.on('lobbyFull', () => {
        alert('The game is full.');
        lobby.html('<h1>Lobby is full. Please try again later.</h1>');
    });

    socket.on('gameInProgress', () => {
        alert('A game is already in progress.');
        lobby.html('<h1>A game is in progress. Please try again later.</h1>');
    });

    // --- GAME LOGIC ---
    socket.on('gameStarted', (gameState) => {
        localGameState = gameState;
        lobby.hide();
        gameContainer.show();
        renderGame(localGameState);
    });

    socket.on('gameStateUpdate', (gameState) => {
        localGameState = gameState;
        renderGame(localGameState);
        resetActionState();

        if (gameState.gameOver) {
            $('#game-over-message').text(`${gameState.gameOver.status === 'win' ? 'You Win!' : 'Game Over!'} ${gameState.gameOver.reason}`);
            $('#game-over-overlay').show();
        }
    });

    $('#play-again-btn').on('click', () => {
        window.location.reload();
    });

    socket.on('actionError', (message) => {
        alert(message);
        resetActionState();
    });

    socket.on('gameEnded', () => {
        alert('Game has ended due to a player leaving.');
        gameContainer.hide();
        lobby.show();
        // Reset lobby UI elements
        playerNameInput.prop('disabled', false).val('');
        difficultySelect.prop('disabled', false);
        readyBtn.prop('disabled', false).text('Ready');
    });

    // Action buttons
    actionsPanel.on('click', '.action-btn', function() {
        const action = $(this).data('action');
        currentAction = action;
        $('.action-btn').removeClass('selected');
        $(this).addClass('selected');

        if (action === 'capture-treasure') {
            socket.emit('playerAction', { action: 'capture-treasure' });
        } else if (action === 'give-card') {
            promptGiveCard();
        } else if (action === 'navigate') {
            promptSelectPlayerToNavigate();
        } else {
            actionPrompt.text(`Select a tile to ${action.replace('-', ' ')}.`);
        }
    });

    // Game board tile clicks
    gameBoard.on('click', '.tile', function() {
        if (!currentAction || currentAction === 'give-card' || (currentAction === 'navigate' && !selectedData.targetPlayerId)) return;

        const me = localGameState.players.find(p => p.id === socket.id);
        const tileId = $(this).data('tileId');

        if (currentAction === 'navigate') {
            socket.emit('playerAction', {
                action: 'navigate',
                targetPlayerId: selectedData.targetPlayerId,
                targetTileId: tileId,
            });
            return;
        }

        if (currentAction === 'shore-up' && me.role.name === 'Engineer' && !selectedData.tileId) {
            selectedData.tileId = tileId;
            actionPrompt.text('Select a second tile to shore up (or the same tile again).');
            return; // Wait for second tile selection
        }

        let payload = { action: currentAction, tileId };
        if (currentAction === 'shore-up' && me.role.name === 'Engineer') {
            payload.secondTileId = selectedData.tileId;
        }

        socket.emit('playerAction', payload);
    });

    // Dynamic prompt clicks
    actionPrompt.on('click', '.prompt-card', function() {
        if (currentAction !== 'give-card') return;
        selectedData.cardName = $(this).data('cardName');
        promptSelectPlayer();
    });

    actionPrompt.on('click', '.prompt-player', function() {
        if (currentAction !== 'give-card') return;
        selectedData.targetPlayerId = $(this).data('playerId');
        socket.emit('playerAction', {
            action: 'give-card',
            cardName: selectedData.cardName,
            targetPlayerId: selectedData.targetPlayerId,
        });
    });

    actionPrompt.on('click', '.prompt-navigate-player', function() {
        if (currentAction !== 'navigate') return;
        selectedData.targetPlayerId = $(this).data('playerId');
        actionPrompt.text('Select a destination tile for the player.');
    });

    function resetActionState() {
        currentAction = null;
        selectedData = {};
        $('.action-btn').removeClass('selected');
        actionPrompt.empty();
    }

    function promptGiveCard() {
        const me = localGameState.players.find(p => p.id === socket.id);
        actionPrompt.empty();
        actionPrompt.append('<p>Select a card to give:</p>');
        me.hand.forEach(card => {
             if(card.type === 'artifact') {
                const cardButton = $('<button>').addClass('prompt-card').text(card.name);
                cardButton.data('cardName', card.name);
                actionPrompt.append(cardButton);
             }
        });
    }

    function promptSelectPlayer() {
        const me = localGameState.players.find(p => p.id === socket.id);
        const playersOnSameTile = localGameState.players.filter(p => p.id !== socket.id && p.position === me.position);

        actionPrompt.empty();
        if (playersOnSameTile.length === 0) {
            actionPrompt.text('No other players on your tile.');
            setTimeout(resetActionState, 2000);
            return;
        }

        actionPrompt.append('<p>Select a player to give the card to:</p>');
        playersOnSameTile.forEach(player => {
            const playerButton = $('<button>').addClass('prompt-player').text(player.role.name);
            playerButton.data('playerId', player.id);
            actionPrompt.append(playerButton);
        });
    }

function promptSelectPlayerToNavigate() {
    actionPrompt.empty();
    actionPrompt.append('<p>Select a player to move:</p>');
    localGameState.players.forEach(player => {
        const playerButton = $('<button>')
            .addClass('prompt-navigate-player')
            .text(player.name);
        playerButton.data('playerId', player.id);
        actionPrompt.append(playerButton);
    });
}

    function renderGame(state) {
        renderGameBoard(state.board, state.players);
        renderPlayerInfo(state.players);
        renderGameInfo(state);

        // Show/hide role-specific action buttons
        const me = state.players.find(p => p.id === socket.id);
        const isMyTurn = state.players[state.turn].id === socket.id;
        const flyButton = $('[data-action="fly"]');
        const navigateButton = $('[data-action="navigate"]');

        if (me && isMyTurn) {
            if (me.role.name === 'Pilot' && !me.flyUsedThisTurn) flyButton.show();
            else flyButton.hide();

            if (me.role.name === 'Navigator') navigateButton.show();
            else navigateButton.hide();
        } else {
            flyButton.hide();
            navigateButton.hide();
        }
    }

    function renderGameBoard(board, players) {
        gameBoard.empty();
        let tileIndex = 0;
        const boardGrid = Array(25).fill(null);
        board.forEach(tile => {
            boardGrid[tile.id] = tile;
        });

        let currentTileId = 0;
        for(let i=0; i<5; i++){
            for(let j=0; j<5; j++){
                const isPlaceholder = ((i === 0 || i === 4) && (j === 0 || j === 4)) ||
                                    ((i === 0 || i === 4) && (j === 1 || j === 3)) ||
                                    ((i === 1 || i === 3) && (j === 0 || j === 4));

                if (isPlaceholder) {
                    gameBoard.append($('<div>').addClass('tile-placeholder'));
                } else {
                    const tileData = board.find(t => t.id === currentTileId);
                    currentTileId++;
                    if(!tileData) {
                         gameBoard.append($('<div>').addClass('tile-placeholder'));
                         continue;
                    };

                    const tile = $('<div>').addClass('tile');
                    if (tileData.flooded) tile.addClass('flooded');
                    if (tileData.sunk) tile.addClass('sunk');
                    tile.html(`<span>${tileData.name}</span>`);
                    tile.data('tileId', tileData.id);

                    players.forEach(p => {
                        if (p.position === tileData.id) {
                            const pawn = $('<div>').addClass('pawn').text(p.role.name.substring(0,1));
                            pawn.css('background-color', p.id === socket.id ? 'gold' : 'gray');
                            tile.append(pawn);
                        }
                    });
                    gameBoard.append(tile);
                }
            }
        }
    }

    function renderPlayerInfo(players) {
        playerInfo.empty();
        players.forEach((p, index) => {
            const playerDiv = $('<div>').addClass('player');
            if (index === localGameState.turn) {
                playerDiv.addClass('current-turn');
            }

            let handHtml = '<p>Hand: ';
            if(p.hand.length > 0){
                handHtml += p.hand.map(c => c.name).join(', ');
            }
            handHtml += '</p>';

            playerDiv.html(`
                <h3>${p.name} - ${p.role.name} ${p.id === socket.id ? '(You)' : ''}</h3>
                <p><i>${p.role.ability}</i></p>
                ${handHtml}
            `);
            playerInfo.append(playerDiv);
        });
    }

    function renderGameInfo(state) {
        gameInfo.empty();
        const currentPlayer = state.players[state.turn];
        gameInfo.html(`
            <p><strong>Turn:</strong> ${currentPlayer.name} ${currentPlayer.id === socket.id ? '(Your Turn)' : ''}</p>
            <p><strong>Actions Remaining:</strong> ${state.actionsRemaining}</p>
            <p><strong>Water Level:</strong> ${state.waterLevel}</p>
            <p><strong>Treasures Captured:</strong> ${state.treasuresCaptured.join(', ')}</p>
        `);
    }
});