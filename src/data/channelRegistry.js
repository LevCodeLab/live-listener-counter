/**
 * Generic Live Audio Channel & Station Frequency Registry
 */
export const FREQUENCY_SCALE = [
  '107.9',
  '106.2',
  '105.4',
  '104.7',
  '103.4',
  '101.7',
  '100.3',
  '098.8',
  '096.5',
  '094.2',
  '092.1',
  '00.0',
];

export const INITIAL_CHANNELS = {
  '107.9': {
    frequency: '107.9',
    name: 'Systems & Infra 107.9 FM',
    genre: 'Engineering',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '106.2': {
    frequency: '106.2',
    name: 'Late Night Jazz 106.2 FM',
    genre: 'Jazz',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '105.4': {
    frequency: '105.4',
    name: 'Analog Synth Waves 105.4 FM',
    genre: 'Electronic',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '104.7': {
    frequency: '104.7',
    name: 'Main Stage Talk 104.7 FM',
    genre: 'Talk',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '103.4': {
    frequency: '103.4',
    name: 'Open Mic Lounge 103.4 FM',
    genre: 'Community',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '101.7': {
    frequency: '101.7',
    name: 'Code Review Radio 101.7 FM',
    genre: 'Software',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '100.3': {
    frequency: '100.3',
    name: 'Acoustic Sessions 100.3 FM',
    genre: 'Acoustic',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '098.8': {
    frequency: '098.8',
    name: 'Ambient Lo-Fi 98.8 FM',
    genre: 'Lo-Fi',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '096.5': {
    frequency: '096.5',
    name: 'Indie Roundtable 96.5 FM',
    genre: 'Podcast',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '094.2': {
    frequency: '094.2',
    name: 'Night Owls Lounge 94.2 FM',
    genre: 'Ambient',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '092.1': {
    frequency: '092.1',
    name: 'Vinyl Beats 92.1 FM',
    genre: 'Instrumental',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
  '00.0': {
    frequency: '00.0',
    name: 'NO SIGNAL',
    genre: 'Idle',
    isLive: false,
    broadcaster: null,
    listeners: 0,
    lastActiveAt: null,
    roomId: null,
  },
};

/**
 * Find the nearest currently live channel to a given frequency on the dial.
 */
export function findNearestActiveChannel(currentFreq, channels = {}) {
  const currentIdx = FREQUENCY_SCALE.indexOf(currentFreq);
  if (currentIdx === -1) return null;

  let nearest = null;
  let minDistance = Infinity;

  Object.values(channels).forEach((ch) => {
    if (ch.isLive && ch.frequency !== currentFreq && ch.frequency !== '00.0') {
      const idx = FREQUENCY_SCALE.indexOf(ch.frequency);
      if (idx !== -1) {
        const distance = Math.abs(idx - currentIdx);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = { ...ch, distance };
        }
      }
    }
  });

  return nearest;
}

/**
 * Find the most recently active channel across the registry.
 */
export function findMostRecentActiveChannel(channels = {}) {
  let mostRecent = null;
  let maxTime = 0;

  Object.values(channels).forEach((ch) => {
    if (ch.frequency !== '00.0' && ch.lastActiveAt && ch.lastActiveAt > maxTime) {
      maxTime = ch.lastActiveAt;
      mostRecent = ch;
    }
  });

  return mostRecent;
}
