const crypto = require('crypto');
const C = require('../shared/constants');
const { GameSimulation } = require('./gameSimulation');

function sanitizeName(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[<>`]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, C.NAME_MAX_LENGTH);
}

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  generateCode() {
    for (let attempts = 0; attempts < 50; attempts += 1) {
      let code = '';
      for (let i = 0; i < C.ROOM_CODE_LENGTH; i += 1) {
        const idx = crypto.randomInt(0, C.ROOM_CODE_ALPHABET.length);
        code += C.ROOM_CODE_ALPHABET[idx];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Unable to generate unique room code');
  }

  makeToken() {
    return crypto.randomBytes(18).toString('base64url');
  }

  createRoom(socket, rawName) {
    const name = sanitizeName(rawName);
    if (!name) return { ok: false, error: 'INVALID_NAME' };
    const code = this.generateCode();
    const token = this.makeToken();
    const room = {
      code,
      createdAt: Date.now(),
      endedAt: null,
      players: [this.makePlayer(socket, name, token, 0)],
      simulation: new GameSimulation({ onEvent: (event, payload) => this.emitGameEvent(code, event, payload) }),
      rematch: [false, false],
      reconnectTimer: null,
      pausedForDisconnect: false
    };
    this.rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 0;
    return { ok: true, code, token, playerIndex: 0, players: this.publicPlayers(room) };
  }

  joinRoom(socket, rawCode, rawName) {
    const code = String(rawCode || '').trim().toUpperCase();
    const name = sanitizeName(rawName);
    if (!name) return { ok: false, error: 'INVALID_NAME' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.players.length >= C.ROOM_MAX_PLAYERS) return { ok: false, error: 'MATCH_FULL' };
    const token = this.makeToken();
    room.players.push(this.makePlayer(socket, name, token, 1));
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 1;
    this.broadcastRoom(room);
    room.simulation.startCountdown(Date.now());
    this.io.to(code).emit('matchCountdown', { startsAt: Date.now() + C.COUNTDOWN_MS });
    return { ok: true, code, token, playerIndex: 1, players: this.publicPlayers(room) };
  }

  makePlayer(socket, name, token, index) {
    return { index, socketId: socket.id, name, token, connected: true, disconnectedAt: null };
  }

  publicPlayers(room) {
    return room.players.map((p) => ({ index: p.index, name: p.name, connected: p.connected }));
  }

  broadcastRoom(room) {
    this.io.to(room.code).emit('roomState', { code: room.code, players: this.publicPlayers(room) });
  }

  setInput(socket, input) {
    const room = this.rooms.get(socket.data.roomCode);
    if (!room) return;
    const idx = socket.data.playerIndex;
    if (idx !== 0 && idx !== 1) return;
    room.simulation.setInput(idx, input);
  }

  requestRematch(socket) {
    const room = this.rooms.get(socket.data.roomCode);
    if (!room || room.players.length < 2) return { ok: false };
    const idx = socket.data.playerIndex;
    room.rematch[idx] = true;
    this.io.to(room.code).emit('rematchState', { accepted: [...room.rematch] });
    if (room.rematch[0] && room.rematch[1]) {
      room.rematch = [false, false];
      room.endedAt = null;
      room.simulation.resetMatch();
      room.simulation.startCountdown(Date.now());
      this.io.to(room.code).emit('matchCountdown', { startsAt: Date.now() + C.COUNTDOWN_MS, rematch: true });
    }
    return { ok: true };
  }


  leaveRoom(socket) {
    const room = this.rooms.get(socket.data.roomCode);
    if (!room) return { ok: true };
    const idx = socket.data.playerIndex;
    const player = room.players[idx];
    if (player && player.socketId === socket.id) {
      player.connected = false;
      player.disconnectedAt = Date.now() - C.RECONNECT_TIMEOUT - 1;
      room.endedAt = Date.now();
      room.simulation.phase = 'ended';
      socket.leave(room.code);
      this.io.to(room.code).emit('partnerLeft', {});
    }
    socket.data.roomCode = null;
    socket.data.playerIndex = null;
    return { ok: true };
  }

  handleDisconnect(socket) {
    const room = this.rooms.get(socket.data.roomCode);
    if (!room) return;
    const idx = socket.data.playerIndex;
    const player = room.players[idx];
    if (!player || player.socketId !== socket.id) return;
    player.connected = false;
    player.disconnectedAt = Date.now();
    room.simulation.pause();
    room.pausedForDisconnect = true;
    this.broadcastRoom(room);
    this.io.to(room.code).emit('partnerDisconnected', { playerIndex: idx, timeoutMs: C.RECONNECT_TIMEOUT });

    clearTimeout(room.reconnectTimer);
    room.reconnectTimer = setTimeout(() => {
      const current = this.rooms.get(room.code);
      if (!current) return;
      const disconnected = current.players.some((p) => !p.connected);
      if (!disconnected) return;
      current.endedAt = Date.now();
      current.simulation.phase = 'ended';
      this.io.to(room.code).emit('partnerLeft', {});
    }, C.RECONNECT_TIMEOUT);
  }

  reconnect(socket, rawCode, token) {
    const code = String(rawCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const player = room.players.find((p) => p.token === token);
    if (!player) return { ok: false, error: 'RECONNECT_FAILED' };
    if (player.connected) return { ok: false, error: 'ALREADY_CONNECTED' };
    if (Date.now() - player.disconnectedAt > C.RECONNECT_TIMEOUT) return { ok: false, error: 'RECONNECT_EXPIRED' };

    player.socketId = socket.id;
    player.connected = true;
    player.disconnectedAt = null;
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = player.index;
    clearTimeout(room.reconnectTimer);
    room.reconnectTimer = null;
    this.broadcastRoom(room);

    if (room.players.length === 2 && room.players.every((p) => p.connected)) {
      room.pausedForDisconnect = false;
      room.simulation.resumeCountdown(Date.now());
      this.io.to(code).emit('matchCountdown', { startsAt: Date.now() + C.COUNTDOWN_MS, reconnect: true });
    }
    return { ok: true, code, playerIndex: player.index, players: this.publicPlayers(room) };
  }

  emitGameEvent(code, event, payload) {
    const room = this.rooms.get(code);
    if (!room) return;
    if (event === 'matchEnd') room.endedAt = Date.now();
    this.io.to(code).emit('gameEvent', { event, payload });
  }

  tick(dt, nowMs) {
    for (const room of this.rooms.values()) {
      if (room.players.length === 2 && room.players.every((p) => p.connected)) {
        room.simulation.update(dt, nowMs);
      }
    }
  }

  broadcastSnapshots(serverTick) {
    for (const room of this.rooms.values()) {
      if (room.players.length === 2 && room.players.some((p) => p.connected)) {
        this.io.to(room.code).emit('snapshot', { k: serverTick, ...room.simulation.snapshot() });
      }
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const noConnected = room.players.every((p) => !p.connected);
      if (room.endedAt && now - room.endedAt > C.ENDED_ROOM_TTL) {
        this.rooms.delete(code);
      } else if ((room.players.length === 0 || noConnected) && now - room.createdAt > C.EMPTY_ROOM_TTL) {
        this.rooms.delete(code);
      } else if (room.players.length === 1 && !room.players[0].connected && now - room.players[0].disconnectedAt > C.EMPTY_ROOM_TTL) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = { RoomManager, sanitizeName };
