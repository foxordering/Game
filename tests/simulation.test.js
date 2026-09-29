const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../shared/constants');
const { GameSimulation } = require('../server/gameSimulation');

function runSteps(sim, seconds, start = 0) {
  for (let i = 0; i < seconds * C.TARGET_FPS; i += 1) sim.update(C.FIXED_DT, start + i * (1000 / C.TARGET_FPS));
}

test('fixed timestep keeps player inside own half', () => {
  const sim = new GameSimulation({ random: () => 0.5 });
  sim.phase = 'playing';
  sim.ball.vx = 430;
  sim.setInput(0, { right: true });
  runSteps(sim, 5);
  assert.ok(sim.players[0].x <= C.COURT.netX - C.COURT.netGap - C.PLAYER_RADIUS + 0.01);
});

test('ball speed never exceeds hard cap', () => {
  const sim = new GameSimulation({ random: () => 0.5 });
  sim.phase = 'playing';
  sim.ball.vx = 640;
  sim.ball.speed = 640;
  sim.rallyElapsed = 500;
  sim.rallyHits = 100;
  for (let i = 0; i < 600; i += 1) sim.applyProgressiveSpeed();
  assert.ok(sim.ball.speed <= C.BALL_MAX_SPEED);
});

test('goal increments opposite score and ends at seven', () => {
  const sim = new GameSimulation({ random: () => 0.5 });
  sim.phase = 'playing';
  sim.score = [6, 0];
  sim.ball.x = C.COURT.right + 30;
  sim.ball.vx = 430;
  sim.updateBall(C.FIXED_DT, 1000);
  assert.deepEqual(sim.score, [7, 0]);
  assert.equal(sim.phase, 'ended');
  assert.equal(sim.winner, 0);
});

test('paddle rebound angle changes with vertical contact', () => {
  const sim = new GameSimulation({ random: () => 0.5 });
  const p = sim.players[0];
  sim.ball.x = p.x + 40;
  sim.ball.y = p.y - 30;
  sim.ball.vx = -430;
  sim.ball.vy = 0;
  sim.ball.speed = 430;
  sim.tryPlayerCollision(p, 1000);
  assert.ok(sim.ball.vx > 0);
  assert.ok(sim.ball.vy < 0);
});

test('mouse target moves left player toward pointer while staying in left half', () => {
  const sim = new GameSimulation({ random: () => 0.25 });
  sim.phase = 'playing';
  sim.ball.vx = 0;
  const startX = sim.players[0].x;
  const startY = sim.players[0].y;
  sim.setInput(0, { targetX: C.COURT.netX + 400, targetY: C.COURT.bottom + 400 });
  for (let i = 0; i < 90; i += 1) sim.updatePlayers(C.FIXED_DT);
  assert.ok(sim.players[0].x > startX);
  assert.ok(sim.players[0].y > startY);
  assert.ok(sim.players[0].x <= C.COURT.netX - C.COURT.netGap - C.PLAYER_RADIUS + 0.01);
  assert.ok(sim.players[0].y <= C.COURT.bottom - C.PLAYER_RADIUS + 0.01);
});

test('serve can randomly start from either player and always travels inward', () => {
  const leftServe = new GameSimulation({ random: () => 0.25 });
  leftServe.startServe();
  assert.ok(leftServe.ball.x < C.COURT.netX);
  assert.ok(leftServe.ball.vx > 0);

  const rightServe = new GameSimulation({ random: () => 0.75 });
  rightServe.startServe();
  assert.ok(rightServe.ball.x > C.COURT.netX);
  assert.ok(rightServe.ball.vx < 0);
});
