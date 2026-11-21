/**
 * Heartbeat-based Live Audio Room Attendance & Listener Streak Tracker.
 *
 * Design:
 * - Clients ping `recordHeartbeat({ roomId, listenerId, now })` every ~15s.
 * - Each valid heartbeat within `ttlMs` accrues bounded listen seconds (clamped by `maxDeltaSeconds`
 *   so delayed or manipulated timestamps cannot inflate listen duration in one ping) and increments
 *   `heartbeatStreak`.
 * - If a listener misses `ttlMs`, they are dropped from concurrent room count and their current
 *   continuous heartbeat streak resets on next rejoin, while cumulative `totalSeconds` and
 *   `longestStreak` persist.
 */
export class ListenerAttendanceTracker {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs ?? 45000;
    this.maxDeltaSeconds = options.maxDeltaSeconds ?? 20;
    this.qualifySeconds = options.qualifySeconds ?? 900; // 15m default
    this.rooms = new Map();
  }

  recordHeartbeat({ roomId, listenerId, handle = null, now = Date.now() }) {
    if (!roomId || !listenerId) {
      throw new Error('roomId and listenerId are required');
    }

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    const roomMap = this.rooms.get(roomId);
    const existing = roomMap.get(listenerId);

    if (!existing) {
      const entry = {
        roomId,
        listenerId,
        handle: handle || listenerId,
        firstSeenAt: now,
        lastHeartbeatAt: now,
        totalSeconds: 0,
        heartbeatStreak: 1,
        longestStreak: 1,
      };
      roomMap.set(listenerId, entry);
      this.pruneRoom(roomId, now);
      return this.formatStats(roomId, entry, now);
    }

    const elapsedMs = Math.max(0, now - existing.lastHeartbeatAt);

    if (elapsedMs <= this.ttlMs) {
      const accruedSeconds = Math.min(this.maxDeltaSeconds, Math.round(elapsedMs / 1000));
      existing.totalSeconds += accruedSeconds;
      existing.heartbeatStreak += 1;
      if (existing.heartbeatStreak > existing.longestStreak) {
        existing.longestStreak = existing.heartbeatStreak;
      }
    } else {
      // Gap exceeded TTL: continuous streak resets to 1
      existing.heartbeatStreak = 1;
    }

    if (handle) existing.handle = handle;
    existing.lastHeartbeatAt = now;
    this.pruneRoom(roomId, now);
    return this.formatStats(roomId, existing, now);
  }

  pruneRoom(roomId, now = Date.now()) {
    const roomMap = this.rooms.get(roomId);
    if (!roomMap) return 0;
    let activeCount = 0;
    for (const entry of roomMap.values()) {
      if (now - entry.lastHeartbeatAt <= this.ttlMs) {
        activeCount += 1;
      }
    }
    return activeCount;
  }

  getRoomSnapshot(roomId, now = Date.now()) {
    const roomMap = this.rooms.get(roomId);
    if (!roomMap) {
      return {
        roomId,
        activeListeners: 0,
        totalUniqueListeners: 0,
        listeners: [],
      };
    }

    const activeList = [];
    for (const entry of roomMap.values()) {
      if (now - entry.lastHeartbeatAt <= this.ttlMs) {
        activeList.push({
          listenerId: entry.listenerId,
          handle: entry.handle,
          totalSeconds: entry.totalSeconds,
          heartbeatStreak: entry.heartbeatStreak,
          longestStreak: entry.longestStreak,
          qualifiedForBadge: entry.totalSeconds >= this.qualifySeconds,
        });
      }
    }

    activeList.sort((a, b) => b.totalSeconds - a.totalSeconds);

    return {
      roomId,
      activeListeners: activeList.length,
      totalUniqueListeners: roomMap.size,
      listeners: activeList,
    };
  }

  getListenerStats(roomId, listenerId, now = Date.now()) {
    const entry = this.rooms.get(roomId)?.get(listenerId);
    if (!entry) return null;
    return this.formatStats(roomId, entry, now);
  }

  formatStats(roomId, entry, now) {
    const isOnline = now - entry.lastHeartbeatAt <= this.ttlMs;
    const activeListeners = this.pruneRoom(roomId, now);
    return {
      roomId,
      listenerId: entry.listenerId,
      handle: entry.handle,
      isOnline,
      activeListeners,
      totalSeconds: entry.totalSeconds,
      heartbeatStreak: entry.heartbeatStreak,
      longestStreak: entry.longestStreak,
      qualifiedForBadge: entry.totalSeconds >= this.qualifySeconds,
    };
  }
}
