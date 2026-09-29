const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager } = require('../server/rooms');

class FakeTarget { emit(){} }
class FakeIO { to(){ return new FakeTarget(); } }
function fakeSocket(id){
  return {
    id,
    data:{},
    rooms:new Set(),
    join(code){this.rooms.add(code)},
    leave(code){this.rooms.delete(code)}
  };
}

test('create + join room and reject third player', () => {
  const manager = new RoomManager(new FakeIO());
  const a=fakeSocket('a'), b=fakeSocket('b'), c=fakeSocket('c');
  const created=manager.createRoom(a,'Alex');
  assert.equal(created.ok,true);
  assert.equal(created.code.length,5);
  const joined=manager.joinRoom(b,created.code,'Blair');
  assert.equal(joined.ok,true);
  assert.equal(joined.players.length,2);
  const third=manager.joinRoom(c,created.code,'Casey');
  assert.deepEqual(third,{ok:false,error:'MATCH_FULL'});
});

test('unknown room returns ROOM_NOT_FOUND', () => {
  const manager = new RoomManager(new FakeIO());
  const r=manager.joinRoom(fakeSocket('x'),'ABCDE','Alex');
  assert.deepEqual(r,{ok:false,error:'ROOM_NOT_FOUND'});
});

test('reconnect token restores same player slot', () => {
  const manager = new RoomManager(new FakeIO());
  const a=fakeSocket('a');
  const created=manager.createRoom(a,'Alex');
  const room=manager.rooms.get(created.code);
  room.players[0].connected=false;
  room.players[0].disconnectedAt=Date.now();
  const newer=fakeSocket('a2');
  const result=manager.reconnect(newer,created.code,created.token);
  assert.equal(result.ok,true);
  assert.equal(result.playerIndex,0);
  assert.equal(room.players[0].socketId,'a2');
});
