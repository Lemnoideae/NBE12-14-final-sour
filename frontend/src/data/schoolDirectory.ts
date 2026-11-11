// One lookup for school display values: map, rankings and (from M2) visits read the same rows by school ID.
// Plan: docs/261108-1930-m1_school_map_data_plan.md 4-1. Scores are mock values; my school uses the game state.
import { INITIAL_SCHOOL_SCORE, MY_SCHOOL_ID } from './gameRules.ts';
import { getSchoolRankings } from './mockRankings.ts';
import { REAL_UNIVERSITIES, type UniversityItem } from './universitiesData.ts';
import { schoolLogoStatus, type LogoStatus } from './schoolLogos.ts';
import type { MapRegion, SchoolRegion } from './schoolMapLayout.ts';
import { getCampusStage } from '../utils/gameModel.ts';

/**
 * School shown by the 2-Phone visiting comparison demo (decision D4, 2026-11-08). It replaced the fictional
 * 'blue-sea' school so the demo reads the same rows as the map. Plan: docs/261108-2000-m2_map_visit_return_plan.md.
 */
export const DEMO_VISIT_SCHOOL_ID = 'pusan';

export interface SchoolView extends Omit<UniversityItem, 'score'> {
  score: number;
  /** National rank from the shared ranking rule (score desc, then name, then ID). */
  rank: number;
  /** Rank change from the shared ranking rows, e.g. "▲2", "▼1" or "-" (HUD badge, visit screen V2). */
  rankChange: string;
  campusLevel: number;
  isMySchool: boolean;
  isTop3: boolean;
  logoStatus: LogoStatus;
}

const BASE_BY_ID = new Map(REAL_UNIVERSITIES.map((school) => [school.id, school]));

/** All schools ordered by national rank. Reuses getSchoolRankings so the ranking screens agree. */
export function getSchoolViews(schoolScore = INITIAL_SCHOOL_SCORE, mySchoolId = MY_SCHOOL_ID): SchoolView[] {
  return getSchoolRankings(schoolScore, mySchoolId).map((row) => {
    const base = BASE_BY_ID.get(row.id);
    if (!base) throw new Error(`Ranking row without school data: ${row.id}`);
    return {
      ...base,
      score: row.score,
      rank: row.rank,
      rankChange: row.change,
      campusLevel: getCampusStage(row.score).level,
      isMySchool: !!row.isMySchool,
      isTop3: row.rank <= 3,
      logoStatus: schoolLogoStatus(row.id),
    };
  });
}

export function getSchoolById(views: readonly SchoolView[], schoolId: string): SchoolView | undefined {
  return views.find((school) => school.id === schoolId);
}

export function getTopSchools(views: readonly SchoolView[], count = 3): SchoolView[] {
  return [...views].sort((a, b) => a.rank - b.rank).slice(0, count);
}

export function countByRegion(views: readonly SchoolView[]): Map<SchoolRegion, number> {
  const counts = new Map<SchoolRegion, number>();
  for (const school of views) counts.set(school.region, (counts.get(school.region) ?? 0) + 1);
  return counts;
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Region filter first, then search by name, short name, city or first syllable. Keeps rank order. */
export function filterSchools(views: readonly SchoolView[], region: MapRegion, query: string): SchoolView[] {
  const q = normalizeQuery(query);
  return views.filter((school) => {
    if (region !== '전체' && school.filterRegion !== region) return false;
    if (!q) return true;
    return [school.name, school.shortName, school.city, school.firstSyllable].some((field) => field.toLowerCase().includes(q));
  });
}
