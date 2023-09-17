const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// CORS 설정
app.use(cors());

// Sample route
app.get('/', (req, res) => {
    res.send('<h1>Socket.io Server is running</h1>');
});



 let rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (data) => {
        const hostName = data.hostName;
        const numOfPlayer = data.numOfPlayer;
        let roomCode = generateRoomCode(); // 6자리 방 코드 생성 함수
        rooms[roomCode] = { host: socket.id, players: [socket.id], playerName: [hostName], numOfPlayer: numOfPlayer };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, playerId: 0, socketID: socket.id, playerNames: rooms[roomCode].playerName  });
        console.log('room Created!:', roomCode);

        console.log('All existing room codes:', Object.keys(rooms).join(', '));
    });

    socket.on('joinRoom', (data) => {
        const roomCode = data.roomCode;
        const userName = data.userName;
        if (rooms[roomCode]) {
            rooms[roomCode].players.push(socket.id);
            rooms[roomCode].playerName.push(userName);
            let playerId = rooms[roomCode].players.length - 1;
            socket.join(roomCode);
            io.to(data.roomCode).emit('roomJoined', { roomCode, playerId, socketID: socket.id, playerNames: rooms[roomCode].playerName  });
            console.log('room Joined!:', roomCode, 'playerID:',playerId);
        } else {
            socket.emit('error', { message: 'Room not found!' });
        }
    });

    // 주사위 굴리기 이벤트 수신
    socket.on('rollDice', (data) => {
        const roomCode = data.roomCode;
        const numberOfDiceToRoll = data.numberOfDiceToRoll;
        const dice1Result = data.dice1Result;
        const dice2Result = data.dice2Result;

        // 주사위를 굴린 플레이어를 제외한 모든 플레이어에게 결과를 전송합니다.
        socket.to(roomCode).emit('diceRolled', {
            roomCode, dice1Result, dice2Result, numberOfDiceToRoll});
    });

    socket.on('extraRollDice', (data) => {
        const roomCode = data.roomCode;
        const shouldRollAgain = data.shouldRollAgain;
        const numberOfDiceToRoll = data.numberOfDiceToRoll;
        const dice1Result = data.dice1Result;
        const dice2Result = data.dice2Result;
        // 모든 다른 플레이어에게 결정 알림
        socket.to(roomCode).emit('extraDiceRolled', {
            roomCode, shouldRollAgain, numberOfDiceToRoll, dice1Result, dice2Result});
    });

    socket.on('nextTurn', (data) =>{
        const roomCode = data.roomCode;

        socket.to(roomCode).emit('doNextTurn',{roomCode});
    });

    socket.on('centerCardPurchase', (data)=>{
        const roomCode = data.roomCode;
        const purchasePlayerId = data.purchasePlayerId;
        const buildingIndex = data.buildingIndex;
        const buildingCost = data.buildingCost;

        socket.to(roomCode).emit('centerCardPurchased',{
            roomCode,purchasePlayerId,buildingIndex,buildingCost});
    });

    socket.on('majorCardPurchase', (data)=>{
        const roomCode = data.roomCode;
        const purchasePlayerId = data.purchasePlayerId;
        const buildingIndex = data.buildingIndex;
        const buildingCost = data.buildingCost;

        socket.to(roomCode).emit('majorCardPurchased',{
            roomCode, purchasePlayerId, buildingIndex, buildingCost, playerNames: rooms[roomCode].playerName});
    });


    socket.on('gameStart', (data) => {
        const roomCode = data.roomCode;
        if (rooms[roomCode]) {
            const playersInRoom = rooms[roomCode].players;
            const numOfPlayer = rooms[roomCode].numOfPlayer;
            const playerNames = rooms[roomCode].playerName;
    
            const payload = {
                roomCode: roomCode,
                players: playersInRoom,
                playerNames: playerNames,
                numOfPlayer: numOfPlayer
            };
    
            console.log('game Started!:', roomCode);
            io.to(roomCode).emit('gameStarted', payload);
        } else {
            console.log('Room not found:', roomCode);
        }
    });
    

    socket.on("roomQuit", (data) => {
        const roomCode = data.roomCode;
        const socketID = data.socketID;

        // 플레이어를 방의 플레이어 목록에서 제거
        for(let i=0;i<rooms[roomCode].players.length;i++){
            console.log(rooms[roomCode].players[i]);
            if(rooms[roomCode].players[i] === socketID){
                rooms[roomCode].players.splice(i, 1);
            }
        }

        //가장 마지막에 들어온 사람이 나갔다가 들어오는 것은 문제 X
        //하지만 이미 들어와있던 사람이 나갔다가 들어오면 playerID가 꼬임
        //playerID를 재조정하고 클라이언트에 업데이트 해주는 코드를 추가해줘야함
        
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('gameWon', (data) => {
        const roomCode = data.roomCode;
        if (rooms[roomCode]) {
            delete rooms[roomCode];
            console.log(`Room ${roomCode} has been deleted due to game completion.`);
        } else {
            console.log('Room not found:', roomCode);
        }
    });
      


});

// Start the Express server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

function generateRoomCode() {
    let roomCode;
    do {
        roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[roomCode]); // 방코드가 이미 존재하면 다시 생성
    return roomCode;
}
