/**
 * Watch Party Server - Real-time synchronization with Socket.IO
 * Production-Grade Implementation
 */

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.WATCH_PARTY_PORT || 3001;

// In-memory room storage (in production, use Redis)
const rooms = new Map();
const ROOM_EXPIRY = 2 * 60 * 60 * 1000; // 2 hours

class RoomManager {
  constructor() {
    this.rooms = rooms;
    this.cleanupInterval = setInterval(() => this.cleanupExpiredRooms(), 30 * 60 * 1000); // Every 30 min
  }

  createRoom(hostId, hostName, media = null) {
    const roomId = this.generateRoomId();
    
    const room = {
      roomId,
      host: {
        id: hostId,
        name: hostName,
        isHost: true
      },
      participants: [
        {
          id: hostId,
          name: hostName,
          joinedAt: Date.now(),
          isHost: true
        }
      ],
      currentMedia: media,
      position: 0,
      playing: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chat: []
    };

    this.rooms.set(roomId, room);
    console.log(`Room created: ${roomId} by ${hostName}`);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, participantId, participantName) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Check if already in room
    const existing = room.participants.find(p => p.id === participantId);
    if (existing) {
      existing.name = participantName; // Update name
      room.updatedAt = Date.now();
      return room;
    }

    const participant = {
      id: participantId,
      name: participantName,
      joinedAt: Date.now(),
      isHost: false
    };

    room.participants.push(participant);
    room.updatedAt = Date.now();

    console.log(`${participantName} joined room ${roomId}`);
    return room;
  }

  leaveRoom(roomId, participantId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.participants = room.participants.filter(p => p.id !== participantId);
    room.updatedAt = Date.now();

    // If host leaves, assign new host or delete room
    if (room.host.id === participantId) {
      if (room.participants.length > 0) {
        const newHost = room.participants[0];
        newHost.isHost = true;
        room.host = { id: newHost.id, name: newHost.name, isHost: true };
        console.log(`New host for room ${roomId}: ${newHost.name}`);
      } else {
        // No participants left, delete room
        this.rooms.delete(roomId);
        console.log(`Room deleted (empty): ${roomId}`);
        return null;
      }
    }

    console.log(`Participant ${participantId} left room ${roomId}`);
    return room;
  }

  updatePlayback(roomId, { position, playing, media = null }) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (position !== undefined) room.position = position;
    if (playing !== undefined) room.playing = playing;
    if (media) room.currentMedia = media;
    
    room.updatedAt = Date.now();
    return room;
  }

  addChatMessage(roomId, senderId, senderName, message) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const chatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      senderId,
      senderName,
      message: message.slice(0, 500), // Limit message length
      timestamp: Date.now()
    };

    room.chat.push(chatMessage);
    
    // Keep only last 100 messages
    if (room.chat.length > 100) {
      room.chat = room.chat.slice(-100);
    }

    room.updatedAt = Date.now();
    return chatMessage;
  }

  generateRoomId() {
    // Generate 6-character room ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure uniqueness
    if (this.rooms.has(id)) {
      return this.generateRoomId();
    }
    
    return id;
  }

  cleanupExpiredRooms() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.updatedAt > ROOM_EXPIRY) {
        this.rooms.delete(roomId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired rooms`);
    }
  }

  getStats() {
    return {
      totalRooms: this.rooms.size,
      totalParticipants: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.participants.length, 0),
      rooms: Array.from(this.rooms.values()).map(room => ({
        roomId: room.roomId,
        participantCount: room.participants.length,
        createdAt: room.createdAt,
        hasMedia: !!room.currentMedia
      }))
    };
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check and stats endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return;
  }
  
  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(roomManager.getStats()));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const roomManager = new RoomManager();

// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX = 20; // Max 20 events per window

function checkRateLimit(socketId) {
  const now = Date.now();
  const limit = rateLimits.get(socketId);
  
  if (!limit) {
    rateLimits.set(socketId, { count: 1, windowStart: now });
    return true;
  }
  
  if (now - limit.windowStart > RATE_LIMIT_WINDOW) {
    limit.count = 1;
    limit.windowStart = now;
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create room
  socket.on('create_room', ({ hostName, media }, callback) => {
    if (!checkRateLimit(socket.id)) {
      callback({ success: false, error: 'Rate limited' });
      return;
    }

    if (!hostName || hostName.trim().length === 0) {
      callback({ success: false, error: 'Host name required' });
      return;
    }

    try {
      const room = roomManager.createRoom(socket.id, hostName.trim(), media);
      socket.join(room.roomId);
      socket.roomId = room.roomId;
      
      callback({ success: true, room });
      
      // Notify others in room (none yet for create)
      io.to(room.roomId).emit('room_state', room);
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Join room
  socket.on('join_room', ({ roomId, participantName }, callback) => {
    if (!checkRateLimit(socket.id)) {
      callback({ success: false, error: 'Rate limited' });
      return;
    }

    if (!roomId || !participantName) {
      callback({ success: false, error: 'Room ID and name required' });
      return;
    }

    const room = roomManager.joinRoom(roomId.toUpperCase(), socket.id, participantName.trim());
    
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    socket.join(room.roomId);
    socket.roomId = room.roomId;

    callback({ success: true, room });
    
    // Notify all in room
    io.to(room.roomId).emit('participant_joined', {
      participant: { id: socket.id, name: participantName.trim() },
      room
    });
    
    io.to(room.roomId).emit('room_state', room);
  });

  // Leave room
  socket.on('leave_room', (callback) => {
    if (socket.roomId) {
      const room = roomManager.leaveRoom(socket.roomId, socket.id);
      socket.leave(socket.roomId);
      
      if (room) {
        io.to(room.roomId).emit('participant_left', {
          participantId: socket.id,
          room
        });
        io.to(room.roomId).emit('room_state', room);
      }
      
      socket.roomId = null;
    }
    
    if (callback) callback({ success: true });
  });

  // Playback controls (host only)
  socket.on('play', ({ position }, callback) => {
    if (!socket.roomId) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = roomManager.getRoom(socket.roomId);
    if (!room) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }

    // Only host can control playback
    if (room.host.id !== socket.id) {
      if (callback) callback({ success: false, error: 'Only host can control playback' });
      return;
    }

    const updatedRoom = roomManager.updatePlayback(socket.roomId, { position, playing: true });
    
    // Broadcast to all except host
    socket.to(socket.roomId).emit('play', { position, room: updatedRoom });
    io.to(socket.roomId).emit('room_state', updatedRoom);
    
    if (callback) callback({ success: true, room: updatedRoom });
  });

  socket.on('pause', ({ position }, callback) => {
    if (!socket.roomId) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = roomManager.getRoom(socket.roomId);
    if (!room || room.host.id !== socket.id) {
      if (callback) callback({ success: false, error: 'Only host can control playback' });
      return;
    }

    const updatedRoom = roomManager.updatePlayback(socket.roomId, { position, playing: false });
    
    socket.to(socket.roomId).emit('pause', { position, room: updatedRoom });
    io.to(socket.roomId).emit('room_state', updatedRoom);
    
    if (callback) callback({ success: true, room: updatedRoom });
  });

  socket.on('seek', ({ position }, callback) => {
    if (!socket.roomId) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = roomManager.getRoom(socket.roomId);
    if (!room || room.host.id !== socket.id) {
      if (callback) callback({ success: false, error: 'Only host can control playback' });
      return;
    }

    if (!checkRateLimit(socket.id)) {
      if (callback) callback({ success: false, error: 'Rate limited' });
      return;
    }

    const updatedRoom = roomManager.updatePlayback(socket.roomId, { position });
    
    socket.to(socket.roomId).emit('seek', { position, room: updatedRoom });
    io.to(socket.roomId).emit('room_state', updatedRoom);
    
    if (callback) callback({ success: true, room: updatedRoom });
  });

  socket.on('change_media', ({ media }, callback) => {
    if (!socket.roomId) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = roomManager.getRoom(socket.roomId);
    if (!room || room.host.id !== socket.id) {
      if (callback) callback({ success: false, error: 'Only host can change media' });
      return;
    }

    // IMPORTANT: Never send file paths, only media identity
    const safeMedia = media ? {
      id: media.id,
      type: media.type || media.media_type,
      title: media.title || media.name,
      poster_path: media.poster_path
    } : null;

    const updatedRoom = roomManager.updatePlayback(socket.roomId, { 
      position: 0, 
      playing: false, 
      media: safeMedia 
    });
    
    io.to(socket.roomId).emit('media_changed', { media: safeMedia, room: updatedRoom });
    io.to(socket.roomId).emit('room_state', updatedRoom);
    
    if (callback) callback({ success: true, room: updatedRoom });
  });

  // Chat
  socket.on('chat_message', ({ message }, callback) => {
    if (!socket.roomId) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    if (!checkRateLimit(socket.id)) {
      if (callback) callback({ success: false, error: 'Rate limited' });
      return;
    }

    if (!message || message.trim().length === 0) {
      if (callback) callback({ success: false, error: 'Message required' });
      return;
    }

    const room = roomManager.getRoom(socket.roomId);
    if (!room) {
      if (callback) callback({ success: false, error: 'Room not found' });
      return;
    }

    const participant = room.participants.find(p => p.id === socket.id);
    const senderName = participant ? participant.name : 'Unknown';

    const chatMessage = roomManager.addChatMessage(socket.roomId, socket.id, senderName, message.trim());
    
    io.to(socket.roomId).emit('chat_message', chatMessage);
    
    if (callback) callback({ success: true, message: chatMessage });
  });

  // Sync request (for rejoining clients)
  socket.on('request_sync', (callback) => {
    if (!socket.roomId) {
      if (callback) callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = roomManager.getRoom(socket.roomId);
    if (callback) callback({ success: true, room });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    if (socket.roomId) {
      const room = roomManager.leaveRoom(socket.roomId, socket.id);
      
      if (room) {
        io.to(room.roomId).emit('participant_left', {
          participantId: socket.id,
          room
        });
        io.to(room.roomId).emit('room_state', room);
      }
    }
    
    rateLimits.delete(socket.id);
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
🍿 zPopcorn Watch Party Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Port: ${PORT}
Health: http://localhost:${PORT}/health
Stats: http://localhost:${PORT}/stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { server, io, roomManager };
