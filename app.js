const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.get('/',(req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Store active rooms and their participants
const rooms = {};

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('join-room', (roomId, userId) => {
        // Create room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = {
                participants: [],
                maxParticipants: 5
            };
        }

        // Check if room is full
        if (rooms[roomId].participants.length >= rooms[roomId].maxParticipants) {
            socket.emit('room-full');
            return;
        }

        // Join the room
        socket.join(roomId);
        rooms[roomId].participants.push(userId);
        
        // Notify others in the room
        socket.to(roomId).emit('user-connected', userId);
        
        // Send list of existing participants to the new user
        const otherParticipants = rooms[roomId].participants.filter(id => id !== userId);
        socket.emit('existing-participants', otherParticipants);

        // Handle WebRTC signaling
        socket.on('offer', (offer, targetUserId) => {
            socket.to(roomId).emit('offer', offer, userId, targetUserId);
        });

        socket.on('answer', (answer, targetUserId) => {
            socket.to(roomId).emit('answer', answer, userId, targetUserId);
        });

        socket.on('ice-candidate', (candidate, targetUserId) => {
            socket.to(roomId).emit('ice-candidate', candidate, userId, targetUserId);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            if (rooms[roomId]) {
                rooms[roomId].participants = rooms[roomId].participants.filter(id => id !== userId);
                socket.to(roomId).emit('user-disconnected', userId);
                
                // Clean up empty rooms
                if (rooms[roomId].participants.length === 0) {
                    delete rooms[roomId];
                }
            }
        });
    });
});

http.listen(3000, () => {
    console.log('listening on *:3000');
});


io.on('chat message', function(msg) {
    io.emit('chat message', msg);
});
    
