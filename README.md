# FOX PICKLEBALL — ONLINE MULTIPLAYER v13 — NEW EVENT ASSETS

Deployment build for online multiplayer only.

## Included

- Node.js + Express server
- Socket.IO multiplayer with room codes
- Server-authoritative ball, player movement, score and match state
- Blue team on the left / Red team on the right
- Mouse controls
- Progressive ball speed
- Reconnect support
- Rematch flow
- Coffee Day high-energy UI copy
- Static frontend served by the same Node application

## Removed from this build

- Bot mode
- `PLAY VS BOT` UI
- `bot.js`
- Local `preview-game.html`

## Run

```bash
npm install
npm start
```

The server uses `process.env.PORT` when provided by the hosting platform, otherwise port `3000`.

Local default:

```text
http://localhost:3000
```

Health endpoint:

```text
/health
```

Expected build:

```text
13.0.0
```

## Hosting requirements

The host must support:

- Node.js 18+
- Long-running HTTP server
- WebSockets / Socket.IO
- Environment-provided port

This is not a static-only deployment. The entire project folder must be deployed, not only `public/`.

## Production start command

```bash
npm start
```

## Tests

```bash
npm test
```


## v13 assets

Updated all court, ball, blue fox, and red fox PNG assets with the supplied event image pack.
