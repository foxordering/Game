const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lobby = fs.readFileSync(path.join(root, 'public/js/lobby.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'public/js/game.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

test('Coffee Day lobby copy is present', () => {
  assert.match(lobby, /Find your duo\. Hit the court\. Game on!/);
  assert.match(lobby, /Host Match/);
  assert.match(lobby, /Enter Court/);
  assert.match(lobby, /<div class=\"mini\">Code<\/div>/);
  assert.match(lobby, /Special Event: Coffee Day/);
  assert.match(lobby, /Waiting for your duo/);
  assert.match(lobby, /Duo Ready!/);
});

test('high-energy match and results copy is present', () => {
  assert.match(lobby, /Match Over!/);
  assert.match(lobby, /GG! \(Good Game!\)/);
  assert.match(lobby, /Rematch requested!/);
  assert.match(lobby, /Waiting for duo/);
  assert.match(lobby, /Rematch\?/);
  assert.match(game, /Blue Team \(L\)/);
  assert.match(game, /Red Team \(R\)/);
  assert.match(game, /Sound: On/);
});

test('mobile warning is concise', () => {
  assert.match(index, /Best played on Desktop/);
});
