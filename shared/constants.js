(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  if (root) root.FOX_CONFIG = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return Object.freeze({
    TARGET_FPS: 60,
    FIXED_DT: 1 / 60,
    GAME_WIDTH: 1280,
    GAME_HEIGHT: 720,
    COURT: Object.freeze({ left: 88, right: 1192, top: 140, bottom: 610, netX: 640, netGap: 56 }),
    BALL_RADIUS: 12,
    BALL_START_SPEED: 720,
    BALL_MAX_SPEED: 1700,
    BALL_RALLY_ACCEL_PER_SECOND: 30,
    BALL_MATCH_ACCEL_PER_SECOND: 2.5,
    BALL_HIT_SPEED_BONUS: 6,
    MAX_REBOUND_ANGLE_DEG: 60,
    PADDLE_COLLISION_COOLDOWN_MS: 50,
    PLAYER_SPEED: 520,
    MOUSE_FOLLOW_SPEED: 1600,
    PLAYER_ACCELERATION: 4800,
    PLAYER_DECELERATION: 5600,
    PLAYER_RADIUS: 46,
    PLAYER_START_X_OFFSET: 150,
    WIN_SCORE: 7,
    ROOM_MAX_PLAYERS: 2,
    RECONNECT_TIMEOUT: 30000,
    EMPTY_ROOM_TTL: 300000,
    ENDED_ROOM_TTL: 600000,
    SCORE_PAUSE_MS: 1000,
    COUNTDOWN_MS: 3000,
    ROOM_CODE_LENGTH: 5,
    ROOM_CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    NAME_MAX_LENGTH: 25,
    DEBUG_MODE: false,
    LEFT_TEAM: 'blue',
    RIGHT_TEAM: 'red',
    BUILD_VERSION: '13.0.0',
    SNAPSHOT_HZ: 60
  });
});
