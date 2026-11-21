import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_CHANNELS,
  findNearestActiveChannel,
  findMostRecentActiveChannel,
  getStationInfo,
  ListenerAttendanceTracker,
  claimProofOfListenBadge,
  verifyProofOfListenBadge,
  hasClaimedBadge,
  clearClaimedBadges,
  createAttendanceServer,
} from '../src/index.js';

beforeEach(() => {
  clearClaimedBadges();
});

test('channelRegistry finds nearest live station and most recent station accurately', () => {
  const channels = structuredClone(INITIAL_CHANNELS);
  channels['106.2'].isLive = true;
  channels['098.8'].isLive = true;
  channels['098.8'].lastActiveAt = 1700000500000;
  channels['106.2'].lastActiveAt = 1700000900000;

  const nearestTo1047 = findNearestActiveChannel('104.7', channels);
  assert.equal(nearestTo1047.frequency, '106.2');
  assert.equal(nearestTo1047.distance, 2);

  const recent = findMostRecentActiveChannel(channels);
  assert.equal(recent.frequency, '106.2');
});

test('ListenerAttendanceTracker clamps heartbeat delta, tracks streaks, and evicts stale listeners', () => {
  const tracker = new ListenerAttendanceTracker({
    ttlMs: 30000,
    maxDeltaSeconds: 15,
    qualifySeconds: 30,
  });

  const t0 = 1_000_000;
  const s1 = tracker.recordHeartbeat({ roomId: '104.7', listenerId: 'u_1', handle: 'kabir', now: t0 });
  assert.equal(s1.activeListeners, 1);
  assert.equal(s1.heartbeatStreak, 1);
  assert.equal(s1.totalSeconds, 0);

  // 25s later (within 30s TTL, clamped to maxDeltaSeconds = 15s)
  const s2 = tracker.recordHeartbeat({ roomId: '104.7', listenerId: 'u_1', now: t0 + 25000 });
  assert.equal(s2.totalSeconds, 15);
  assert.equal(s2.heartbeatStreak, 2);
  assert.equal(s2.qualifiedForBadge, false);

  // Second listener joins
  tracker.recordHeartbeat({ roomId: '104.7', listenerId: 'u_2', now: t0 + 26000 });
  assert.equal(tracker.getRoomSnapshot('104.7', t0 + 26000).activeListeners, 2);

  // Another 15s for u_1 -> reaches 30s qualified threshold
  const s3 = tracker.recordHeartbeat({ roomId: '104.7', listenerId: 'u_1', now: t0 + 40000 });
  assert.equal(s3.totalSeconds, 30);
  assert.equal(s3.heartbeatStreak, 3);
  assert.equal(s3.qualifiedForBadge, true);

  // 60s gap for u_2 -> u_2 expires from active room count
  const snapAfterExpiry = tracker.getRoomSnapshot('104.7', t0 + 60000);
  assert.equal(snapAfterExpiry.activeListeners, 1);
  assert.equal(snapAfterExpiry.listeners[0].listenerId, 'u_1');
});

test('claimProofOfListenBadge issues verifiable SHA-256 receipt and deduplicates per session', async () => {
  const badge = await claimProofOfListenBadge({
    frequency: '104.7 FM',
    stationTitle: 'Main Stage Talk',
    sessionTag: 'NIGHT_TALK_42',
    listenerHandle: 'kabir',
    listenSeconds: 960,
    streakCount: 64,
  });

  assert.ok(badge.id.startsWith('POL-1047-'));
  assert.equal(await verifyProofOfListenBadge(badge), true);
  assert.equal(hasClaimedBadge('104.7 FM', 'NIGHT_TALK_42'), true);

  // Tampered payload fails verification
  const tampered = { ...badge, payload: badge.payload + '|tampered' };
  assert.equal(await verifyProofOfListenBadge(tampered), false);
});

test('HTTP attendance server handles heartbeats, station lookup, and gated badge claims', async () => {
  const { server } = createAttendanceServer({ ttlMs: 30000, qualifySeconds: 15, maxDeltaSeconds: 20 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    const stationRes = await fetch(`${base}/stations/098.8`);
    const station = await stationRes.json();
    assert.equal(station.name, 'Ambient Lo-Fi 98.8 FM');

    const now = Date.now();
    await fetch(`${base}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: '098.8', listenerId: 'u_9', handle: 'anya', now: now - 16000 }),
    });

    // Premature badge claim rejected (0s accrued so far)
    const earlyClaim = await fetch(`${base}/badges/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: '098.8', listenerId: 'u_9' }),
    });
    assert.equal(earlyClaim.status, 403);

    // Second heartbeat accrues 16s -> qualifies
    await fetch(`${base}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: '098.8', listenerId: 'u_9', handle: 'anya', now }),
    });

    const validClaim = await fetch(`${base}/badges/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: '098.8', listenerId: 'u_9', sessionTag: 'LOFI_01' }),
    });
    assert.equal(validClaim.status, 201);
    const badge = await validClaim.json();
    assert.equal(badge.listenerHandle, 'anya');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('fmService supports custom external API fetch override', async () => {
  const data = await getStationInfo('101.7', {
    apiUrl: 'https://mock.local/fm',
    fetchImpl: async (url) => ({
      ok: true,
      json: async () => ({ frequency: '101.7', sourceUrl: url, isLive: true }),
    }),
  });
  assert.equal(data.frequency, '101.7');
  assert.equal(data.isLive, true);
});
