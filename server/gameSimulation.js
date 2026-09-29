const C = require('../shared/constants');

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const degToRad = (deg) => (deg * Math.PI) / 180;

class GameSimulation {
  constructor({ onEvent = () => {}, random = Math.random } = {}) {
    this.onEvent = onEvent;
    this.random = random;
    this.resetMatch();
  }

  resetMatch() {
    const midY = (C.COURT.top + C.COURT.bottom) / 2;
    this.players = [
      this.makePlayer(0, C.COURT.left + C.PLAYER_START_X_OFFSET, midY),
      this.makePlayer(1, C.COURT.right - C.PLAYER_START_X_OFFSET, midY)
    ];
    this.ball = { x: C.COURT.netX, y: midY, vx: 0, vy: 0, speed: C.BALL_START_SPEED, lastHitAt: -Infinity };
    this.score = [0, 0];
    this.phase = 'waiting';
    this.winner = null;
    this.matchElapsed = 0;
    this.rallyElapsed = 0;
    this.rallyHits = 0;
    this.pauseUntil = 0;
    this.nowMs = 0;
    this.currentServerIndex = this.random() < 0.5 ? 0 : 1;
    this.serveToward = this.currentServerIndex === 0 ? 1 : 0;
    this.syncBallToServer();
  }

  makePlayer(index, x, y) {
    return { index, x, y, vx: 0, vy: 0, input: { mode: 'mouse', targetX: x, targetY: y, up: false, down: false, left: false, right: false } };
  }

  setInput(index, input = {}) {
    const p = this.players[index];
    if (!p) return;

    // Mouse input is sent as a desired target only. The server still owns the
    // actual position, speed, acceleration and legal court boundaries.
    const hasMouseTarget = Number.isFinite(input.targetX) && Number.isFinite(input.targetY);
    p.input = {
      mode: hasMouseTarget ? 'mouse' : 'keyboard',
      targetX: hasMouseTarget ? Number(input.targetX) : null,
      targetY: hasMouseTarget ? Number(input.targetY) : null,
      up: !!input.up,
      down: !!input.down,
      left: !!input.left,
      right: !!input.right
    };
  }

  startCountdown(nowMs = this.nowMs) {
    this.phase = 'countdown';
    this.pauseUntil = nowMs + C.COUNTDOWN_MS;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.syncBallToServer();
  }

  resumeCountdown(nowMs = this.nowMs) {
    this.startCountdown(nowMs);
  }

  pause() {
    if (this.phase === 'playing' || this.phase === 'countdown' || this.phase === 'pointPause') this.phase = 'paused';
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  startServe() {
    const serverIndex = this.currentServerIndex;
    const server = this.players[serverIndex];
    const direction = serverIndex === 0 ? 1 : -1;
    const angle = degToRad((this.random() * 50) - 25);
    const matchBoost = this.matchElapsed * C.BALL_MATCH_ACCEL_PER_SECOND;
    const speed = clamp(C.BALL_START_SPEED + matchBoost, C.BALL_START_SPEED, C.BALL_MAX_SPEED);
    this.ball.x = server.x + direction * (C.PLAYER_RADIUS - 2);
    this.ball.y = server.y;
    this.ball.speed = speed;
    this.ball.vx = Math.abs(Math.cos(angle)) * speed * direction;
    this.ball.vy = Math.sin(angle) * speed;
    this.ball.lastHitAt = -Infinity;
    this.rallyElapsed = 0;
    this.rallyHits = 0;
    this.phase = 'playing';
    this.serveToward = direction > 0 ? 1 : 0;
    this.onEvent('serve', { from: serverIndex, toward: this.serveToward, speed });
  }

  syncBallToServer() {
    const server = this.players[this.currentServerIndex];
    if (!server) return;
    const direction = this.currentServerIndex === 0 ? 1 : -1;
    this.ball.x = server.x + direction * 18;
    this.ball.y = server.y + 8;
    this.ball.speed = C.BALL_START_SPEED;
  }

  update(dt, nowMs) {
    this.nowMs = nowMs;
    if (this.phase === 'countdown') {
      this.updatePlayers(dt);
      this.syncBallToServer();
      if (nowMs >= this.pauseUntil) this.startServe();
      return;
    }
    if (this.phase === 'pointPause') {
      this.updatePlayers(dt);
      this.syncBallToServer();
      if (nowMs >= this.pauseUntil) this.startServe();
      return;
    }
    if (this.phase !== 'playing') return;

    this.matchElapsed += dt;
    this.rallyElapsed += dt;
    this.updatePlayers(dt);
    this.updateBall(dt, nowMs);
  }

  updatePlayers(dt) {
    for (const p of this.players) {
      const minY = C.COURT.top + C.PLAYER_RADIUS;
      const maxY = C.COURT.bottom - C.PLAYER_RADIUS;
      const minX = p.index === 0
        ? C.COURT.left + C.PLAYER_RADIUS
        : C.COURT.netX + C.COURT.netGap + C.PLAYER_RADIUS;
      const maxX = p.index === 0
        ? C.COURT.netX - C.COURT.netGap - C.PLAYER_RADIUS
        : C.COURT.right - C.PLAYER_RADIUS;

      if (p.input.mode === 'mouse' && Number.isFinite(p.input.targetX) && Number.isFinite(p.input.targetY)) {
        // Mouse is positional input, but the server remains authoritative.
        // Clamp the requested target to the player's legal half, then move
        // toward it at a high fixed speed so the fox visibly follows the cursor.
        const targetX = clamp(p.input.targetX, minX, maxX);
        const targetY = clamp(p.input.targetY, minY, maxY);
        const deltaX = targetX - p.x;
        const deltaY = targetY - p.y;
        const distance = Math.hypot(deltaX, deltaY);
        const oldX = p.x;
        const oldY = p.y;
        if (distance > 0.5) {
          const step = Math.min(distance, C.MOUSE_FOLLOW_SPEED * dt);
          p.x = clamp(p.x + (deltaX / distance) * step, minX, maxX);
          p.y = clamp(p.y + (deltaY / distance) * step, minY, maxY);
          p.vx = (p.x - oldX) / dt;
          p.vy = (p.y - oldY) / dt;
        } else {
          p.x = targetX;
          p.y = targetY;
          p.vx = 0;
          p.vy = 0;
        }
        continue;
      }

      let dx = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
      let dy = (p.input.down ? 1 : 0) - (p.input.up ? 1 : 0);
      if (dx || dy) {
        const mag = Math.hypot(dx, dy) || 1;
        dx /= mag;
        dy /= mag;
        p.vx = this.approach(p.vx, dx * C.PLAYER_SPEED, C.PLAYER_ACCELERATION * dt);
        p.vy = this.approach(p.vy, dy * C.PLAYER_SPEED, C.PLAYER_ACCELERATION * dt);
      } else {
        p.vx = this.approach(p.vx, 0, C.PLAYER_DECELERATION * dt);
        p.vy = this.approach(p.vy, 0, C.PLAYER_DECELERATION * dt);
      }

      p.x = clamp(p.x + p.vx * dt, minX, maxX);
      p.y = clamp(p.y + p.vy * dt, minY, maxY);
    }
  }

  updateBall(dt, nowMs) {
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.y - C.BALL_RADIUS <= C.COURT.top && this.ball.vy < 0) {
      this.ball.y = C.COURT.top + C.BALL_RADIUS;
      this.ball.vy *= -1;
      this.onEvent('wall', { y: 'top' });
    } else if (this.ball.y + C.BALL_RADIUS >= C.COURT.bottom && this.ball.vy > 0) {
      this.ball.y = C.COURT.bottom - C.BALL_RADIUS;
      this.ball.vy *= -1;
      this.onEvent('wall', { y: 'bottom' });
    }

    this.tryPlayerCollision(this.players[0], nowMs);
    this.tryPlayerCollision(this.players[1], nowMs);

    if (this.ball.x + C.BALL_RADIUS < C.COURT.left) {
      this.scorePoint(1, nowMs);
      return;
    }
    if (this.ball.x - C.BALL_RADIUS > C.COURT.right) {
      this.scorePoint(0, nowMs);
      return;
    }

    this.applyProgressiveSpeed();
  }

  tryPlayerCollision(p, nowMs) {
    if (nowMs - this.ball.lastHitAt < C.PADDLE_COLLISION_COOLDOWN_MS) return;
    if (p.index === 0 && this.ball.vx >= 0) return;
    if (p.index === 1 && this.ball.vx <= 0) return;

    const dx = this.ball.x - p.x;
    const dy = this.ball.y - p.y;
    const hitRadius = C.PLAYER_RADIUS + C.BALL_RADIUS;
    if ((dx * dx + dy * dy) > hitRadius * hitRadius) return;

    const normalized = clamp(dy / C.PLAYER_RADIUS, -1, 1);
    const maxAngle = degToRad(C.MAX_REBOUND_ANGLE_DEG);
    const angle = normalized * maxAngle;
    const direction = p.index === 0 ? 1 : -1;
    const speed = clamp(Math.max(this.ball.speed, Math.hypot(this.ball.vx, this.ball.vy)), C.BALL_START_SPEED, C.BALL_MAX_SPEED);
    this.ball.speed = speed;
    this.ball.vx = Math.cos(angle) * speed * direction;
    this.ball.vy = Math.sin(angle) * speed;
    this.ball.lastHitAt = nowMs;
    this.rallyHits += 1;

    const separation = hitRadius + 2;
    this.ball.x = p.x + direction * separation;
    this.onEvent('paddle', { player: p.index, speed, x: this.ball.x, y: this.ball.y });
  }

  applyProgressiveSpeed() {
    // Speed rises continuously the longer the rally lasts. The match clock also
    // nudges the baseline upward, so later rallies naturally begin faster.
    const target = clamp(
      C.BALL_START_SPEED
        + this.rallyElapsed * C.BALL_RALLY_ACCEL_PER_SECOND
        + this.matchElapsed * C.BALL_MATCH_ACCEL_PER_SECOND
        + this.rallyHits * C.BALL_HIT_SPEED_BONUS,
      C.BALL_START_SPEED,
      C.BALL_MAX_SPEED
    );
    if (target > this.ball.speed + 0.05) {
      const currentMagnitude = Math.hypot(this.ball.vx, this.ball.vy) || 1;
      const maxIncreaseThisTick = C.BALL_RALLY_ACCEL_PER_SECOND * C.FIXED_DT;
      const nextSpeed = Math.min(target, this.ball.speed + maxIncreaseThisTick);
      this.ball.vx = (this.ball.vx / currentMagnitude) * nextSpeed;
      this.ball.vy = (this.ball.vy / currentMagnitude) * nextSpeed;
      this.ball.speed = nextSpeed;
    }
  }

  scorePoint(playerIndex, nowMs) {
    this.score[playerIndex] += 1;
    this.onEvent('score', { player: playerIndex, score: [...this.score] });
    this.ball.vx = 0;
    this.ball.vy = 0;
    if (this.score[playerIndex] >= C.WIN_SCORE) {
      this.phase = 'ended';
      this.winner = playerIndex;
      this.onEvent('matchEnd', { winner: playerIndex, score: [...this.score] });
      return;
    }
    this.currentServerIndex = this.random() < 0.5 ? 0 : 1;
    this.serveToward = this.currentServerIndex === 0 ? 1 : 0;
    this.phase = 'pointPause';
    this.pauseUntil = nowMs + C.SCORE_PAUSE_MS;
    this.syncBallToServer();
  }

  approach(current, target, delta) {
    if (current < target) return Math.min(current + delta, target);
    if (current > target) return Math.max(current - delta, target);
    return target;
  }

  snapshot() {
    return {
      p: this.players.map(({ x, y, vx, vy }) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(vx), Math.round(vy)]),
      b: [Math.round(this.ball.x * 10) / 10, Math.round(this.ball.y * 10) / 10, Math.round(this.ball.vx), Math.round(this.ball.vy), Math.round(this.ball.speed)],
      s: [...this.score],
      ph: this.phase,
      w: this.winner,
      srv: this.currentServerIndex,
      t: Math.round(this.matchElapsed * 1000)
    };
  }
}

module.exports = { GameSimulation, clamp };
