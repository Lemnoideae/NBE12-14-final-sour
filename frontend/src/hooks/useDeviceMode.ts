import { useSyncExternalStore } from 'react';
import { MOBILE_DEVICE_QUERY, resolveDeviceMode, type DeviceMode } from '../utils/deviceMode';

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
