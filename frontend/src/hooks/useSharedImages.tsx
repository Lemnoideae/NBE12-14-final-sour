import React, { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { REAL_UNIVERSITIES } from '../data/universitiesData.ts';
import { KNOWN_DEPARTMENTS } from '../data/gameRules.ts';
import { createSharedImageStore, type ImageDirectory, type ImageTarget } from '../utils/sharedImages.ts';

// Explicit mock IDs only; these are not authenticated memberships.
export const MOCK_IMAGE_DIRECTORY: ImageDirectory = Object.freeze({
  schoolIds: Object.freeze([...REAL_UNIVERSITIES.map((school) => school.id), 'blue-sea']),
  departments: Object.freeze([
    ...KNOWN_DEPARTMENTS.map((d) => Object.freeze({ id: d.id, schoolId: d.schoolId })),
    Object.freeze({ id: 'marine-nav', schoolId: 'blue-sea' }),
    Object.freeze({ id: 'marine-bio', schoolId: 'blue-sea' }),
    Object.freeze({ id: 'marine-it', schoolId: 'blue-sea' }),
  ]),
  users: Object.freeze([
    ...Object.entries({
      me: 'my-department',
      night: 'my-department',
      star: 'electronics',
      tiger: 'business',
      lunch: 'biology',
      clock: 'design',
      deer: 'ai',
      dog: 'architecture',
      bird: 'media',
    }).map(([userId, departmentId]) => Object.freeze({ userId, schoolId: 'hanyang', departmentId })),
    Object.freeze({ userId: 'external-viewer', schoolId: 'kaist', departmentId: 'kaist-computing' }),
    Object.freeze({ userId: 'visiting-user-1', schoolId: 'blue-sea', departmentId: 'marine-nav' }),
    Object.freeze({ userId: 'visiting-user-2', schoolId: 'blue-sea', departmentId: 'marine-bio' }),
    Object.freeze({ userId: 'visiting-user-3', schoolId: 'blue-sea', departmentId: 'marine-it' }),
    Object.freeze({ userId: 'our-gb-1', schoolId: 'pusan', departmentId: 'my-department' }),
    Object.freeze({ userId: 'our-gb-2', schoolId: 'kaist', departmentId: 'kaist-computing' }),
    Object.freeze({ userId: 'our-gb-3', schoolId: 'chonnam', departmentId: 'my-department' }),
    Object.freeze({ userId: 'our-gb-4', schoolId: 'jejunu', departmentId: 'my-department' }),
    Object.freeze({ userId: 'our-gb-5', schoolId: 'korea', departmentId: 'my-department' }),
    // Visit guestbook sample authors (src/data/mockGuestbook.ts).
    Object.freeze({ userId: 'gb-1', schoolId: 'kaist', departmentId: 'kaist-computing' }),
    Object.freeze({ userId: 'gb-2', schoolId: 'pusan', departmentId: 'my-department' }),
    Object.freeze({ userId: 'gb-3', schoolId: 'yonsei', departmentId: 'my-department' }),
    Object.freeze({ userId: 'gb-4', schoolId: 'korea', departmentId: 'my-department' }),
    Object.freeze({ userId: 'gb-5', schoolId: 'hanyang', departmentId: 'my-department' }),
    Object.freeze({ userId: 'gb-6', schoolId: 'chonnam', departmentId: 'my-department' }),
    Object.freeze({ userId: 'gb-7', schoolId: 'jejunu', departmentId: 'my-department' }),
    Object.freeze({ userId: 'msg-1', schoolId: 'hanyang', departmentId: 'my-department' }),
    Object.freeze({ userId: 'msg-2', schoolId: 'hanyang', departmentId: 'mechanical' }),
    Object.freeze({ userId: 'msg-3', schoolId: 'hanyang', departmentId: 'my-department' }),
    Object.freeze({ userId: 'msg-4', schoolId: 'hanyang', departmentId: 'my-department' }),
    Object.freeze({ userId: 'msg-5', schoolId: 'hanyang', departmentId: 'electronics' }),
    Object.freeze({ userId: 'union-1', schoolId: 'kaist', departmentId: 'kaist-computing' }),
    Object.freeze({ userId: 'union-2', schoolId: 'pusan', departmentId: 'my-department' }),
    Object.freeze({ userId: 'union-3', schoolId: 'hanyang', departmentId: 'my-department' }),
  ]),
});

export type SharedImageStore = ReturnType<typeof createSharedImageStore>;
const Context = createContext<SharedImageStore | null>(null);

export function SharedImageProvider({
  children,
  store,
  initialDirectory = MOCK_IMAGE_DIRECTORY,
}: {
  children?: React.ReactNode;
  store?: SharedImageStore;
  initialDirectory?: ImageDirectory;
}) {
  const [instance] = useState(() => store ?? createSharedImageStore(initialDirectory));
  return <Context.Provider value={instance}>{children}</Context.Provider>;
}
export function useImageStore() {
  const store = useContext(Context);
  if (!store) throw new Error('SharedImageProvider is required');
  return store;
}
export function useSharedImage(target: ImageTarget) {
  const store = useImageStore();
  return useSyncExternalStore(store.subscribe, () => store.get(target), () => store.get(target));
}
