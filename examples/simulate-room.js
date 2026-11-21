/**
 * Example: Simulate 3 listeners sending heartbeats and claiming a verified SHA-256 badge.
 * Run with: node examples/simulate-room.js
 */
import {
  ListenerAttendanceTracker,
  claimProofOfListenBadge,
  verifyProofOfListenBadge,
} from '../src/index.js';

const tracker = new ListenerAttendanceTracker({ ttlMs: 45000, maxDeltaSeconds: 20, qualifySeconds: 40 });
const start = Date.now() - 60000;

for (let step = 0; step <= 3; step++) {
  tracker.recordHeartbeat({
    roomId: '104.7',
    listenerId: 'listener_01',
    handle: 'dev_arjun',
    now: start + step * 15000,
  });
}

const snapshot = tracker.getRoomSnapshot('104.7', start + 45000);
console.log('Room snapshot:', snapshot);

const badge = await claimProofOfListenBadge({
  frequency: '104.7 FM',
  stationTitle: 'Systems & Infra',
  sessionTag: 'DEMO_01',
  listenerHandle: 'dev_arjun',
  listenSeconds: snapshot.listeners[0].totalSeconds,
  streakCount: snapshot.listeners[0].heartbeatStreak,
});

console.log('Issued badge:', badge.id, 'verified:', await verifyProofOfListenBadge(badge));
