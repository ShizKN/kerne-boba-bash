# KERNE

[KERNE](https://kerne.apospace.com) is a study call for up to four people, with camera, microphone, chat, screen sharing, and two live multiplayer breaks: **Sketch Rush** and **Bluff Club**. The call continues while a game is open. Screen shares have a full-screen viewer with zoom and visible camera previews. On phones, the shared screen takes the main stage and cameras stay in a scrollable strip.

## Code to review

- `site/index.html`: English entry page and room setup.
- `site/room.html`, `site/room.css`: call, media controls, responsive layout, and screen viewer.
- `site/activities.js`: game UI, drawing, scores, reactions, and camera previews.
- `site/signaling.js`: WebSocket connection and reconnection.
- `worker/index.js`: room membership, signaling, chat, TURN access, and game persistence.
- `worker/games.js`: server-owned game rules and per-player state filtering.
- `worker/games.test.js`: rule, secret-visibility, reconnect, and scoring tests.

The static site needs no build step. A Cloudflare Worker and Durable Object coordinate rooms. Audio/video use WebRTC; the Worker creates short-lived TURN credentials. Secrets are configured in Cloudflare and excluded from this repository.

## Run and deploy

```sh
cd worker
npm ci
npm test
npm run check
npm run deploy
cd ..
npx wrangler pages deploy site --project-name kernee --branch main
```

Configure `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` as Worker secrets. Local WebSocket testing is permitted for `localhost` and `127.0.0.1` origins. A browser's camera/microphone permission must be changed in browser or site settings after a persistent denial.

## Verification

The game engine has automated rule tests. Local WebSocket tests used four clients to check drawing, scoring, private answers, room isolation, reconnects, and timed progression. Browser checks covered two people in one call and phone-sized game layouts. Media quality still depends on browser, device, and network; a real phone switching between Wi-Fi and cellular requires separate device testing.

## Rights

© 2026 Yassine El Faidi. All rights reserved for the original KERNE code. This public repository is provided for Boba Bash review; no license to reuse the original code is granted. The third-party library retains its license in `site/vendor/simplepeer.LICENSE`.
