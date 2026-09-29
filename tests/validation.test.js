const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeName } = require('../server/rooms');

test('sanitizes HTML and trims names', () => {
  assert.equal(sanitizeName('  <b>Alex</b> <script>x</script>  '), 'Alex x');
});

test('rejects effectively empty name', () => {
  assert.equal(sanitizeName('<script></script>'), '');
});

test('limits name length to 25 characters', () => {
  assert.equal(sanitizeName('abcdefghijklmnopqrstuvwxyz').length, 25);
});
