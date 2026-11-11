import { useMemo } from 'react';
import { getSchoolViews, type SchoolView } from '../data/schoolDirectory.ts';
import { useMockGame } from './useMockGame.tsx';

/** School rows with my school's live score from the shared game state. My school is the player's school (M4). */
export function useSchoolViews(): SchoolView[] {
  const { state, player } = useMockGame();
  return useMemo(() => getSchoolViews(state.schoolScore, player.schoolId), [state.schoolScore, player.schoolId]);
}

/** The player's school row: name, badge, rank and score shown in the HUD, chat and rankings. */
export function useMySchool(): SchoolView {
  const mySchool = useSchoolViews().find((school) => school.isMySchool);
  if (!mySchool) throw new Error('My school is missing from the school list.');
  return mySchool;
}
