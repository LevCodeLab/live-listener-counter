import { INITIAL_CHANNELS } from '../data/channelRegistry.js';

/**
 * Fetch station metadata for a given frequency.
 * Calls external FM_API_URL if configured, otherwise resolves against local channelRegistry.
 */
export async function getStationInfo(frequency, options = {}) {
  if (!frequency) {
    throw new Error('frequency is required');
  }

  const baseUrl = options.apiUrl ?? process.env.FM_API_URL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (baseUrl) {
    const url = `${baseUrl}?frequency=${encodeURIComponent(frequency)}`;
    const resp = await fetchImpl(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch station info: ${resp.status}`);
    }
    return resp.json();
  }

  const registry = options.channels ?? INITIAL_CHANNELS;
  const station = registry[frequency];
  if (!station) {
    return {
      frequency,
      name: `Custom Room ${frequency} FM`,
      genre: 'Custom',
      isLive: false,
      listeners: 0,
    };
  }
  return { ...station };
}
