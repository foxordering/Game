const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const C = require('../shared/constants');
const { RoomManager } = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['websocket', 'polling'],
  serveClient: true,
  pingInterval: 10000,
  pingTimeout: 12000,
  perMessageDeflate: false
});

app.disable('x-powered-by');
const noCache = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
};
app.use(express.static(path.join(__dirname, '..', 'public'), { etag: false, lastModified: false, maxAge: 0, setHeaders: noCache }));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared'), { etag: false, lastModified: false, maxAge: 0, setHeaders: noCache }));
app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules', 'phaser', 'dist'), { maxAge: '7d' }));
app.get('/health', (_req, res) => res.json({ ok: true, build: C.BUILD_VERSION, rooms: manager.rooms.size, targetFps: C.TARGET_FPS }));

const manager = new RoomManager(io);

io.on('connection', (socket) => {
  socket.on('createRoom', (data, ack = () => {}) => ack(manager.createRoom(socket, data?.name)));
  socket.on('joinRoom', (data, ack = () => {}) => ack(manager.joinRoom(socket, data?.code, data?.name)));
  socket.on('playerInput', (input) => manager.setInput(socket, input));
  socket.on('requestRematch', (_data, ack = () => {}) => ack(manager.requestRematch(socket)));
  socket.on('leaveRoom', (_data, ack = () => {}) => ack(manager.leaveRoom(socket)));
  socket.on('reconnectRoom', (data, ack = () => {}) => ack(manager.reconnect(socket, data?.code, data?.token)));
  socket.on('pingCheck', (sentAt, ack = () => {}) => ack({ sentAt, serverAt: Date.now() }));
  socket.on('disconnect', () => manager.handleDisconnect(socket));
});

const fixedMs = 1000 / C.TARGET_FPS;
let last = performance.now();
let accumulator = 0;
let serverTick = 0;

function loop() {
  const now = performance.now();
  accumulator += Math.min(250, now - last);
  last = now;
  while (accumulator >= fixedMs) {
    manager.tick(C.FIXED_DT, Date.now());
    accumulator -= fixedMs;
    serverTick += 1;
    if (serverTick % Math.max(1, Math.round(C.TARGET_FPS / C.SNAPSHOT_HZ)) === 0) manager.broadcastSnapshots(serverTick);
  }
  setImmediate(loop);
}
loop();
setInterval(() => manager.cleanup(), 30000).unref();

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`FOX PICKLEBALL v${C.BUILD_VERSION} running on http://localhost:${PORT}`);
});
