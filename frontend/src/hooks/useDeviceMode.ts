import { useSyncExternalStore } from 'react';
import { GAME_WIDE_QUERY, MOBILE_DEVICE_QUERY, resolveDeviceMode, resolveGameLayout, type DeviceMode, type GameLayout } from '../utils/deviceMode';

const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_DEVICE_QUERY) : null);

function subscribe(onChange: () => void) {
  const list = query();
  list?.addEventListener('change', onChange);
  return () => list?.removeEventListener('change', onChange);
}

const snapshot = (): DeviceMode => resolveDeviceMode(typeof window === 'undefined' ? '' : window.location.search, query()?.matches ?? false);

/** Current device mode; follows the media query live (rotation, devtools device toggles). */
export function useDeviceMode(): DeviceMode {
  return useSyncExternalStore(subscribe, snapshot, () => 'framed');
}

const gameQuery = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia(GAME_WIDE_QUERY)
  : null;

function subscribeGameLayout(onChange: () => void) {
  const list = gameQuery();
  list?.addEventListener('change', onChange);
  return () => list?.removeEventListener('change', onChange);
}

function gameLayoutSnapshot(): GameLayout {
  const list = gameQuery();
  return list ? resolveGameLayout(window.location.search, list.matches) : 'legacy';
}

export function useGameLayout(): GameLayout {
  return useSyncExternalStore(subscribeGameLayout, gameLayoutSnapshot, () => 'legacy');
}
