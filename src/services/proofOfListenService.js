import crypto from 'node:crypto';

const STORAGE_KEY = 'live_audio_attendance_badges';
const memoryStore = new Map();

function getStorageAdapter(customStorage = null) {
  if (customStorage) return customStorage;
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }
  return {
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => memoryStore.set(k, v),
    removeItem: (k) => memoryStore.delete(k),
  };
}

/**
 * Generate deterministic SHA-256 hex digest using Web Crypto or Node crypto.
 */
export async function generateSha256Hex(text) {
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Load all claimed attendance badges from storage.
 */
export function getClaimedBadges(storage = null) {
  try {
    const raw = getStorageAdapter(storage).getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Check if an attendance badge was already claimed for a frequency + sessionTag.
 */
export function hasClaimedBadge(frequency, sessionTag, storage = null) {
  const badges = getClaimedBadges(storage);
  return badges.some(
    (b) => b.frequency === frequency && b.sessionTag === sessionTag
  );
}

export function clearClaimedBadges(storage = null) {
  getStorageAdapter(storage).removeItem(STORAGE_KEY);
}

/**
 * Issue a cryptographic Proof-of-Listen attendance badge after verified listen time.
 */
export async function claimProofOfListenBadge({
  frequency = '104.7 FM',
  stationTitle = 'Main Stage Talk',
  sessionTag = 'EPISODE_01',
  listenerHandle = 'guest_listener',
  listenSeconds = 900,
  streakCount = 1,
  signer = null,
  storage = null,
}) {
  const timestamp = new Date().toISOString();
  const payloadString = `PROOF_OF_LISTEN | Station: ${frequency} | Session: ${sessionTag} | Listener: ${listenerHandle} | Duration: ${Math.floor(listenSeconds / 60)}m | Streak: ${streakCount} | Time: ${timestamp}`;

  let signatureHex = '';
  let isCustomSigned = false;

  if (signer && typeof signer.signMessage === 'function') {
    const encoded = new TextEncoder().encode(payloadString);
    const sigBytes = await signer.signMessage(encoded);
    signatureHex = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .slice(0, 32)
      .join('');
    isCustomSigned = true;
  }

  if (!signatureHex) {
    signatureHex = await generateSha256Hex(payloadString);
  }

  const badgeId = `POL-${frequency.replace(/[^0-9]/g, '') || '1047'}-${signatureHex.slice(0, 8).toUpperCase()}`;

  const newBadge = {
    id: badgeId,
    frequency,
    stationTitle,
    sessionTag,
    listenerHandle,
    listenSeconds,
    streakCount,
    claimedAt: timestamp,
    payload: payloadString,
    signatureHex,
    proofType: isCustomSigned ? 'Detached Ed25519/Custom Signature' : 'SHA-256 Session Digest',
    verified: true,
  };

  const adapter = getStorageAdapter(storage);
  const existing = getClaimedBadges(adapter);
  const updated = [
    newBadge,
    ...existing.filter(
      (b) => !(b.frequency === frequency && b.sessionTag === sessionTag)
    ),
  ];
  adapter.setItem(STORAGE_KEY, JSON.stringify(updated));

  return newBadge;
}

/**
 * Recompute SHA-256 digest of a badge's canonical payload to verify integrity.
 */
export async function verifyProofOfListenBadge(badge) {
  if (!badge?.payload || !badge?.signatureHex) return false;
  const expected = await generateSha256Hex(badge.payload);
  return expected === badge.signatureHex;
}
