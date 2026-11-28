// SCRUM-159: drives the "other students' clicks" particles from click responses in API mode. Attack and assist
// counts (2026-11-28) come with every click, attack and assist answer and get their own particles.
// Plan: .agents/01-PLAN/261118-2039-scrum159_other_click_particles.md

/**
 * How far back an earlier own batch can still be inside the server's "previous second" bucket. The server reads
 * `clicks:univ:{u}:{nowSec-1}` when it applies a batch, so an own batch that reached it less than 2s earlier may be
 * counted there. Batches are sent serially, so their send order matches the server's arrival order. The extra 500ms
 * covers latency jitter between send times and server arrival times: missing an own batch would show own clicks as
 * someone else's, while an extra one only lowers the estimate.
 */
export const OWN_CLICK_OVERLAP_MS = 2500;

/**
 * Turns `schoolClicksLastSecond` (the whole school, the requester's own earlier clicks included) into a lower bound
 * on other students' clicks. Every own batch that could be in that bucket is subtracted, so the player's own clicks
 * never show up as someone else's. Others' clicks can be under-counted; an exact number needs the server to exclude
 * the requester.
 */
export function createOtherClicksEstimator(overlapMs = OWN_CLICK_OVERLAP_MS) {
  let ownBatches: Array<{ sentAt: number; clicks: number }> = [];
  return {
    accept(schoolClicksLastSecond: number, ownClicks: number, sentAt: number): number {
      ownBatches = ownBatches.filter((batch) => batch.sentAt <= sentAt && sentAt - batch.sentAt < overlapMs);
      const recentOwn = ownBatches.reduce((sum, batch) => sum + batch.clicks, 0);
      ownBatches.push({ sentAt, clicks: Math.max(0, Math.floor(ownClicks) || 0) });
      if (!Number.isFinite(schoolClicksLastSecond) || schoolClicksLastSecond <= 0) return 0;
      return Math.max(0, Math.floor(schoolClicksLastSecond) - recentOwn);
    },
  };
}

/** What other people did at one school in the previous second: clicks by its students, attacks and assists it received. */
export interface SchoolActivity {
  clicks: number;
  attacks: number;
  assists: number;
}
export type ActivityKind = 'click' | 'attack' | 'assist';

/** A count from the server as a whole non-negative number; a missing or broken value (older server) is 0. */
export function activityCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export type FeedListener<T> = (value: T) => void;
export interface Feed<T> {
  subscribe(listener: FeedListener<T>): () => void;
}
export function createFeed<T>(): Feed<T> & { publish(value: T): void } {
  const listeners = new Set<FeedListener<T>>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish(value) {
      for (const listener of [...listeners]) listener(value);
    },
  };
}

export type OtherClicksListener = FeedListener<SchoolActivity>;
/** A push source: each accepted response publishes one estimate. Unlike the mock source, nothing is polled. */
export type OtherClicksFeed = Feed<SchoolActivity>;
export function createOtherClicksFeed() {
  return createFeed<SchoolActivity>();
}

/** One attack or assist answer, for the school it was about. */
export interface TargetActivity {
  universityId: number;
  activity: SchoolActivity;
}
/** The visit screen only shows answers about the school it shows; answers about an earlier target are dropped. */
export function feedForUniversity(source: Feed<TargetActivity>, universityId: number): OtherClicksFeed {
  return {
    subscribe(listener) {
      return source.subscribe((value) => { if (value.universityId === universityId) listener(value.activity); });
    },
  };
}
