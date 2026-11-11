import React, { useState } from 'react';
import { Screen1NationalMap } from './Screen1NationalMap';
import { Screen2RegionMap } from './Screen2RegionMap';
import type { NavTab } from './BottomNav';
import { useSchoolViews } from '../hooks/useSchoolViews.ts';
import type { MapRegion } from '../data/schoolMapLayout.ts';

/** What the map shows. Kept outside the map in the app so a visit can return to it (M2 A2). */
export interface MapContext {
  region: MapRegion;
  query: string;
  selectedSchoolId?: string;
}

export const INITIAL_MAP_CONTEXT: MapContext = { region: '전체', query: '' };

interface MapScreenPhoneProps {
  /** Receives the selected school ID; the app opens that school's visit screen. */
  onSelectSchool?: (schoolId: string) => void;
  onNavigateTab?: (tab: NavTab) => void;
  /** Controlled context. Without it the phone keeps its own state (comparison demos). */
  context?: MapContext;
  onContextChange?: (context: MapContext) => void;
  initialRegion?: MapRegion;
}

/**
 * Map phone shared by the single map and the comparison demo.
 * Plans: docs/261108-1930-m1_school_map_data_plan.md 4-2, docs/261108-2000-m2_map_visit_return_plan.md 4-1.
 */
export const MapScreenPhone: React.FC<MapScreenPhoneProps> = ({
  onSelectSchool,
  onNavigateTab = () => {},
  context,
  onContextChange,
  initialRegion = '전체',
}) => {
  const schools = useSchoolViews();
  const [localContext, setLocalContext] = useState<MapContext>({ ...INITIAL_MAP_CONTEXT, region: initialRegion });
  const current = context ?? localContext;
  const update = (patch: Partial<MapContext>) => {
    const next = { ...current, ...patch };
    if (context) onContextChange?.(next);
    else setLocalContext(next);
  };

  const controls = {
    schools,
    query: current.query,
    selectedSchoolId: current.selectedSchoolId,
    onRegionChange: (region: MapRegion) => update({ region }),
    onQueryChange: (query: string) => update({ query }),
    onSelectSchool: (schoolId: string) => {
      update({ selectedSchoolId: schoolId });
      onSelectSchool?.(schoolId);
    },
    onNavigateTab,
  };

  return current.region === '충청' ? <Screen2RegionMap {...controls} /> : <Screen1NationalMap {...controls} region={current.region} />;
};
