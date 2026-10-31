'use strict';
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const crypto = require('node:crypto');
const path = require('node:path');

const app = express();
const http = createServer(app);
const io = new Server(http, { maxHttpBufferSize: 32 * 1024 });
const rooms = new Map();
const TTL_MS = 60 * 60 * 1000;

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/share', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/view/:code', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

function getOther(r, socketId) {
  if (r.owner === socketId) return r.viewer;
  if (r.viewer === socketId) return r.owner;
  return null;
}
function dispose(socket) {
  const roomId = socket.data.room;
  if (!roomId) return;
  const room = rooms.get(roomId);
  socket.data.room = null;
  if (!room) return;
  if (room.owner === socket.id) {
    io.to(roomId).emit('session-ended');
    rooms.delete(roomId);
  } else if (room.viewer === socket.id) {
    room.viewer = null;
    io.to(room.owner).emit('viewer-left');
  }
  socket.leave(roomId);
}

io.on('connection', (socket) => {
  socket.on('create-room', (ack) => {
    if (typeof ack !== 'function') return;
    dispose(socket);
    const id = crypto.randomBytes(16).toString('hex');
    rooms.set(id, { owner: socket.id, viewer: null, created: Date.now() });
    socket.data.room = id;
    socket.join(id);
    ack({ ok: true, room: id });
  });

  socket.on('join-room', ({ room } = {}, ack) => {
    if (typeof ack !== 'function') return;
    if (typeof room !== 'string' || !/^[0-9a-f]{32}$/.test(room)) return ack({ok:false, error:'Invalid invitation link.'});
    const r = rooms.get(room);
    if (!r || Date.now() - r.created > TTL_MS) return ack({ok:false, error:'Invitation expired or was closed.'});
    if (r.viewer && r.viewer !== socket.id) return ack({ok:false, error:'A viewer is already connected.'});
    dispose(socket);
    r.viewer = socket.id;
    socket.data.room = room;
    socket.join(room);
    ack({ok:true});
    io.to(r.owner).emit('viewer-joined');
  });

  socket.on('signal', ({ room, packet } = {}) => {
    const r = rooms.get(room);
    if (!r || socket.data.room !== room) return;
    if (!packet || !['offer','answer','candidate'].includes(packet.type)) return;
    if (JSON.stringify(packet).length > 20000) return;
    const other = getOther(r, socket.id);
    if (other) io.to(other).emit('signal', packet);
  });

  socket.on('sharing-stopped', ({room} = {}) => {
    const r = rooms.get(room);
    if (r && r.owner === socket.id) {
      if (r.viewer) io.to(r.viewer).emit('sharing-stopped');
    }
  });
  socket.on('leave-room', () => dispose(socket));
  socket.on('disconnect', () => dispose(socket));
});

setInterval(() => {
  for (const [id, r] of rooms) {
    if (Date.now() - r.created > TTL_MS) {
      io.to(id).emit('session-ended');
      rooms.delete(id);
    }
  }
}, 60_000).unref();

const PORT = Number(process.env.PORT) || 3000;
http.listen(PORT, '0.0.0.0', () => console.log('ClearShare listening on ' + PORT));
