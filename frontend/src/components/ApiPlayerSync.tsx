import React, { useEffect, useRef } from 'react';
import { accountFromMyInfo, useMyInfo } from '../api/users';
import { useMockGame } from '../hooks/useMockGame';

/**
 * Mounted once at the app root in API mode (SCRUM-153): while signed in, the game's player, contribution and clicker
 * level come from GET /users/me instead of the mock defaults. Applied when the profile changes, so a refetch with the
 * same values leaves the game alone.
 */
export const ApiPlayerSync: React.FC = () => {
  const { data } = useMyInfo();
  const { applyAccount } = useMockGame();
  const applyRef = useRef(applyAccount);
  applyRef.current = applyAccount;
  useEffect(() => {
    if (data) applyRef.current(accountFromMyInfo(data));
  }, [data]);
  return null;
};
