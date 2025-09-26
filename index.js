var express = require('express'),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server);

const {
    addPlayerToLobby,
    removePlayerFromLobby,
    setPlayerReady,
    getLobbyState,
    resetLobby,
    initializeGame,
    handlePlayerAction,
    handleDiscardAction,
} = require('./game.js');
 
server.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on port 3000');
});

app.use(express.static('public'));
 
app.get('/',function(req,res){
  res.sendFile(__dirname+'/public/game.html');
});

let gameInProgress = false;
 
io.sockets.on('connection', function (socket) {
 
   console.log("Socket connected: " + socket.id);

   if(gameInProgress) {
       socket.emit('gameInProgress');
       socket.disconnect();
       return;
   }

   const playerAdded = addPlayerToLobby(socket.id);
   if (!playerAdded) {
       socket.emit('lobbyFull');
       socket.disconnect();
       return;
   }

   io.sockets.emit('lobbyUpdate', getLobbyState());

   socket.on('playerJoin', (data) => {
       setPlayerReady(socket.id, data.name);
       io.sockets.emit('lobbyUpdate', getLobbyState());
   });

   socket.on('startGame', (data) => {
       const lobbyState = getLobbyState();
       const player = lobbyState.players.find(p => p.id === socket.id);
       if (player && player.isHost && lobbyState.canStart) {
           console.log("Host started game...");
           gameInProgress = true;
           const initialState = initializeGame(data.difficulty);
           io.sockets.emit('gameStarted', initialState);
       }
   });

   socket.on('playerAction', (action) => {
        if (!gameInProgress) return;
        const result = handlePlayerAction(socket.id, action);
        if(result.error) {
            socket.emit('actionError', result.error);
        } else {
            io.sockets.emit('gameStateUpdate', result.gameState);
        }
   });

   socket.on('discardAction', (data) => {
       if (!gameInProgress) return;
       const result = handleDiscardAction(socket.id, data.cardName);
       if (result.error) {
           socket.emit('actionError', result.error);
       } else {
           io.sockets.emit('gameStateUpdate', result.gameState);
       }
   });

   socket.on('disconnect', function() {
      console.log('Socket disconnected: ' + socket.id);
      removePlayerFromLobby(socket.id);
      if (gameInProgress) {
          // Handle disconnect during a game
          gameInProgress = false;
          resetLobby();
          io.sockets.emit('gameEnded'); // Notify clients that game is over
          console.log("Game ended due to disconnection.");
      } else {
          // Update lobby if not in a game
          io.sockets.emit('lobbyUpdate', getLobbyState());
      }
   });
});