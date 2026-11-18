import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './ApiProvider';
import type { ApiClient } from './client';

/** ItemType.java / PayType.java. Credit products stay disabled until payments are integrated. */
export type ItemType = 'MULTIPLIER' | 'LOGO_UNIVERSITY' | 'LOGO_DEPARTMENT' | 'LOGO_PROFILE';
export type PayType = 'CONTRIBUTION' | 'CREDIT';
export interface ShopItem {
  id: number;
  name: string;
  content: string;
  type: ItemType;
  payType: PayType;
  price: number;
  durationSeconds: number | null;
}
export interface ItemPurchaseResponse {
  userItemId: number;
  item: { id: number; name: string; payType: PayType };
  price: number;
  expiredAt: string | null;
  myContribScore: number;
  myCreditBalance: number;
}
export interface ActiveItemEffect {
  itemId: number;
  name: string | null;
  multiplier: number;
  expiredAt: string;
  remainingSeconds: number;
}
export interface EffectSnapshot { effect: ActiveItemEffect | null; receivedAt: number }
export const itemKeys = {
  catalog: ['items', 'catalog'] as const,
  active: (userId: number | undefined, generation?: number) => generation === undefined
    ? ['items', 'active', userId] as const : ['items', 'active', userId, generation] as const,
};
export function getItems(client: ApiClient, signal?: AbortSignal): Promise<ShopItem[]> {
  return client.get('/items', { anonymous: true, signal });
}
export function getActiveItemEffect(client: ApiClient, signal?: AbortSignal): Promise<ActiveItemEffect | null> {
  return client.get('/items/me/active', { signal });
}
/** Contribution potions only. No body, multipart, idempotency key or automatic POST retry. */
export function purchaseItem(client: ApiClient, itemId: number, signal?: AbortSignal): Promise<ItemPurchaseResponse> {
  return client.request(`/items/${itemId}/purchase`, { method: 'POST', signal });
}
export function useItemCatalog() {
  const client = useApiClient();
  return useQuery({ queryKey: itemKeys.catalog, queryFn: ({ signal }) => getItems(client, signal) });
}
/** Use elapsed monotonic time, not the browser wall clock or a decrement-per-timer counter. */
export function effectSecondsLeft(snapshot: EffectSnapshot | undefined, now: number): number {
  if (!snapshot?.effect) return 0;
  return Math.max(0, Math.ceil(snapshot.effect.remainingSeconds - Math.max(0, now - snapshot.receivedAt) / 1000));
}
