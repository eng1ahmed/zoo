const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        transports: ['websocket', 'polling'],
        credentials: true
    },
    allowEIO3: true
});
const path = require('path');

// Serve static files
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store active rooms and their participants
const rooms = {};

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('join-room', (roomId, userId) => {
        console.log(`User ${userId} joining room ${roomId}`);
        
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
        console.log(`Notified others about user ${userId} in room ${roomId}`);
        
        // Send list of existing participants to the new user
        const otherParticipants = rooms[roomId].participants.filter(id => id !== userId);
        socket.emit('existing-participants', otherParticipants);
        console.log(`Sent existing participants to user ${userId}: ${otherParticipants.join(', ')}`);

        // Handle WebRTC signaling
        socket.on('offer', (offer, targetUserId) => {
            console.log(`Received offer from ${userId} to ${targetUserId}`);
            socket.to(roomId).emit('offer', offer, userId, targetUserId);
        });

        socket.on('answer', (answer, targetUserId) => {
            console.log(`Received answer from ${userId} to ${targetUserId}`);
            socket.to(roomId).emit('answer', answer, userId, targetUserId);
        });

        socket.on('ice-candidate', (candidate, targetUserId) => {
            console.log(`Received ICE candidate from ${userId} to ${targetUserId}`);
            socket.to(roomId).emit('ice-candidate', candidate, userId, targetUserId);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected from room ${roomId}`);
            if (rooms[roomId]) {
                rooms[roomId].participants = rooms[roomId].participants.filter(id => id !== userId);
                socket.to(roomId).emit('user-disconnected', userId);
                
                // Clean up empty rooms
                if (rooms[roomId].participants.length === 0) {
                    console.log(`Deleting empty room ${roomId}`);
                    delete rooms[roomId];
                }
            }
        });
    });
});

// Handle Vercel serverless environment
if (process.env.NODE_ENV === 'production') {
    module.exports = server;
} else {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

io.on('chat message', function(msg) {
    io.emit('chat message', msg);
});
    
