# live-listener-counter

![Node.js](https://img.shields.io/badge/Node.js-20%2B_ESM-141418?style=flat-square&color=141418&labelColor=26262E)
![Dependencies](https://img.shields.io/badge/Dependencies-Zero-141418?style=flat-square&color=141418&labelColor=26262E)
![Crypto](https://img.shields.io/badge/Receipts-SHA--256-141418?style=flat-square&color=141418&labelColor=26262E)
![License](https://img.shields.io/badge/License-MIT-141418?style=flat-square&color=141418&labelColor=26262E)

Zero dependency Node.js listener counter and streak tracker for live audio rooms.

Counting raw socket connections lies because dead phone tabs stay open forever. This tiny tracker counts real 15 second heartbeats, blocks fake time jumps, and drops silent tabs after 45 seconds. Zero npm bloat, works on pure divine code and Node built ins.

![live-listener-counter preview](./assets/preview.svg)

## What it does

- Counts real active listeners in each audio room using 15 second heartbeats.
- Caps every ping at 20 seconds max so nobody can fake 3 hours in one request.
- Tracks listener streaks and drops dead tabs automatically after 45 seconds.
- Mints a verifiable `SHA 256` receipt once a listener stays for 15 minutes.

## Run it in 60 seconds

```bash
git clone https://github.com/LevCodeLab/live-listener-counter.git
cd live-listener-counter

# Zero npm install needed! Run tests right away:
npm test

# Start the HTTP server on port 3020
npm start
```

Send a test heartbeat from another terminal:

```bash
curl -X POST http://localhost:3020/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"roomId":"104.7","listenerId":"user_01","handle":"kabir"}'
```

## Which file to edit

| File | What to change here |
| :--- | :--- |
| `src/services/attendanceTracker.js` | Change heartbeat timeout, max seconds per ping, or streak rules |
| `src/services/proofOfListenService.js` | Change `SHA 256` receipt format and badge verification |
| `src/data/channelRegistry.js` | Edit default station names and frequencies |
| `src/services/fmService.js` | Plug in an external station metadata API URL |
| `src/server.js` | Edit HTTP routes (`/heartbeat`, `/rooms/:id/listeners`, `/badges/claim`) |

## License

MIT License. Clone it, break it, ship it.
