# KERNE

Collaborative study rooms with video, audio, chat, whiteboards, and screen sharing. [Open the live site](https://kerne.apospace.com).

## Code to review

- `site/index.html`: home page and room entry.
- `site/room.html`: room interface and client-side logic.
- `site/signaling.js`: real-time connection and reconnection.
- `worker/index.js`: room assignment, WebRTC signaling, chat, and shared whiteboards.

The site is static and needs no build step. A Cloudflare Worker with a Durable Object coordinates participants. Audio and video use WebRTC; the Worker creates short-lived TURN credentials. No TURN secret is included in this repository.

## Run and deploy

```sh
cd worker
npm ci
npm run check
npm run deploy
cd ..
npx wrangler pages deploy site --project-name kernee --branch main
```

Configure `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` as Cloudflare Worker secrets. If you test from another local hostname, add it to the allowed origins in `worker/index.js`.

## Verification

Two local room connections were used to check joining, chat, whiteboard synchronization, and screen-share signaling. JavaScript syntax and the Worker dry run were checked. Audio and video quality also depend on each participant's browser and network.

## Rights

© 2026 Yassine El Faidi. All rights reserved for the original KERNE code. This public repository is provided for Boba Bash review; no license to reuse the original code is granted. The third-party library retains its license in `site/vendor/simplepeer.LICENSE`.
