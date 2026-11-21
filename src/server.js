import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ListenerAttendanceTracker } from './services/attendanceTracker.js';
import { getStationInfo } from './services/fmService.js';
import { claimProofOfListenBadge } from './services/proofOfListenService.js';

const __filename = fileURLToPath(import.meta.url);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

export function createAttendanceServer(options = {}) {
  const tracker = new ListenerAttendanceTracker({
    ttlMs: Number(options.ttlMs || process.env.HEARTBEAT_TTL_MS || 45000),
    qualifySeconds: Number(options.qualifySeconds || process.env.BADGE_MIN_SECONDS || 900),
    maxDeltaSeconds: options.maxDeltaSeconds ?? 20,
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, service: 'live-listener-counter' });
    }

    if (req.method === 'POST' && url.pathname === '/heartbeat') {
      try {
        const body = await readJson(req);
        if (!body.roomId || !body.listenerId) {
          return sendJson(res, 400, { error: 'roomId and listenerId are required' });
        }
        const stats = tracker.recordHeartbeat({
          roomId: body.roomId,
          listenerId: body.listenerId,
          handle: body.handle,
          now: body.now ?? Date.now(),
        });
        return sendJson(res, 200, stats);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON payload' });
      }
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)\/listeners$/);
    if (req.method === 'GET' && roomMatch) {
      const roomId = decodeURIComponent(roomMatch[1]);
      return sendJson(res, 200, tracker.getRoomSnapshot(roomId));
    }

    const stationMatch = url.pathname.match(/^\/stations\/([^/]+)$/);
    if (req.method === 'GET' && stationMatch) {
      const freq = decodeURIComponent(stationMatch[1]);
      const info = await getStationInfo(freq);
      const snapshot = tracker.getRoomSnapshot(freq);
      return sendJson(res, 200, {
        ...info,
        isLive: snapshot.activeListeners > 0 || info.isLive,
        listeners: snapshot.activeListeners,
      });
    }

    if (req.method === 'POST' && url.pathname === '/badges/claim') {
      try {
        const body = await readJson(req);
        const stats = tracker.getListenerStats(body.roomId, body.listenerId);
        if (!stats || !stats.qualifiedForBadge) {
          return sendJson(res, 403, {
            error: 'Listener has not reached required qualified listen duration',
            totalSeconds: stats?.totalSeconds ?? 0,
            requiredSeconds: tracker.qualifySeconds,
          });
        }
        const badge = await claimProofOfListenBadge({
          frequency: body.roomId,
          stationTitle: body.stationTitle || `Station ${body.roomId}`,
          sessionTag: body.sessionTag || 'LIVE_SESSION',
          listenerHandle: stats.handle,
          listenSeconds: stats.totalSeconds,
          streakCount: stats.heartbeatStreak,
        });
        return sendJson(res, 201, badge);
      } catch {
        return sendJson(res, 400, { error: 'Invalid badge claim request' });
      }
    }

    return sendJson(res, 404, { error: 'Not found' });
  });

  return { server, tracker };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  const port = Number(process.env.PORT) || 3020;
  const { server } = createAttendanceServer();
  server.listen(port, () => {
    console.log(`[live-listener-counter] Heartbeat & attendance API running on http://localhost:${port}`);
  });
}
