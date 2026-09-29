const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../shared/constants');

const root = path.join(__dirname, '..');

test('online build has no preview or bot implementation', () => {
  assert.equal(fs.existsSync(path.join(root, 'preview-game.html')), false);
  assert.equal(fs.existsSync(path.join(root, 'public/js/bot.js')), false);
});

test('public UI exposes only multiplayer entry points', () => {
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const lobby = fs.readFileSync(path.join(root, 'public/js/lobby.js'), 'utf8');
  assert.doesNotMatch(index, /bot\.js/i);
  assert.doesNotMatch(lobby, /PLAY VS BOT/i);
  assert.doesNotMatch(lobby, /botForm/);
  assert.match(lobby, /Host Match/);
  assert.match(lobby, /Join Match/);
});

test('online build version is 13.0.0', () => {
  assert.equal(C.BUILD_VERSION, '13.0.0');
});
