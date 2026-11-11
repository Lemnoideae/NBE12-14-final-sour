import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { soundManager } from '../utils/sound';
import { formatContribution } from '../utils/formatContribution';
import { BottomNav, NavTab } from './BottomNav';
import { BottomSheetDialog } from './BottomSheetDialog';
import { CampusSignButton, CampusStage, GuestbookBoardButton } from './CampusStage';
import { GameScreenLayout } from './GameScreenLayout';
import { TopHUD, schoolHudProps } from './TopHUD';
import { LiveClicksEmpty, SPECTATOR_NOTICE, SpectatorBar, VisitNotFoundPhone, VisitSchoolInfoSheet, formatScore, useVisitedSchool } from './VisitingParts.tsx';

interface VisitingScreen1PhoneProps {
  /** Visited school ID from the map (M2). Values are read from the shared school rows. */
  schoolId: string;
  onBackToMap?: () => void;
  onBackToMySchool?: () => void;
  onNavigateTab?: (tab: NavTab) => void;
  onOpenGuestbook?: () => void;
  /** The game's sound setting (App). Without it, as on the comparison mockup, the screen keeps its own. */
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

/**
 * Visit screen in the main game's layout (V1·V2, docs/261110-2005-visit_ui_jeju_map_plan.md §4): the same header,
 * campus frame and footer as my campus, with a "방문 중" HUD, a 학교 정보 sign where 상세 스탯 is, and the spectator
 * bar where the chat preview is. Spectating never calls the game's tap: no score, contribution, buff or wobble (M2 16, Q5).
 */
export const VisitingScreen1Phone: React.FC<VisitingScreen1PhoneProps> = ({
  schoolId,
  onBackToMap = () => {},
  onBackToMySchool = () => {},
  onNavigateTab = () => {},
  onOpenGuestbook = () => {},
  soundEnabled,
  onToggleSound,
}) => {
  const [clickNoticeToast, setClickNoticeToast] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [localSound, setLocalSound] = useState(() => soundManager.enabled);
  const { school, mySchool } = useVisitedSchool(schoolId);

  const handleCampusClick = () => {
    soundManager.playTapSound();
    setClickNoticeToast(true);
    setTimeout(() => setClickNoticeToast(false), 2000);
  };
  const toggleSound = onToggleSound ?? (() => {
    soundManager.enabled = !localSound;
    setLocalSound(!localSound);
  });
  const closeInfo = () => {
    setIsInfoOpen(false);
    soundManager.playTabSound();
  };

  if (!school) return <VisitNotFoundPhone schoolId={schoolId} onBackToMap={onBackToMap} />;

  return (
    <GameScreenLayout
      kind="visit"
      fillMain
      header={
        <TopHUD
          mode="visit"
          onBack={onBackToMap}
          {...schoolHudProps(school)}
          schoolScore={school.score}
          rank={school.rank}
          rankDelta={school.rankChange}
          campusLevel={school.campusLevel}
          soundEnabled={soundEnabled ?? localSound}
          onToggleSound={toggleSound}
          onOpenRankings={() => onNavigateTab('rankings')}
        />
      }
      previewBar={<SpectatorBar mySchoolShortName={mySchool.shortName} onBackToMySchool={onBackToMySchool} />}
      nav={
        <BottomNav
          activeTab="map"
          onChangeTab={(tab) => {
            soundManager.playTabSound();
            onNavigateTab(tab);
          }}
          hasShopUpgrade={false}
          hasRankChange={false}
        />
      }
      overlays={
        isInfoOpen && (
          <BottomSheetDialog label={`${school.name} 학교 정보`} onClose={closeInfo}>
            <VisitSchoolInfoSheet
              school={school}
              onOpenGuestbook={() => {
                setIsInfoOpen(false);
                onOpenGuestbook();
              }}
            />
          </BottomSheetDialog>
        )
      }
    >
      <CampusStage
        level={school.campusLevel}
        fill
        bubble={<LiveClicksEmpty />}
        bubbleDot="#0284c7"
        sceneLabelPrefix={school.name}
        frameProps={{ role: 'button', 'aria-label': `${school.name} 캠퍼스 (관전 모드)`, onClick: handleCampusClick }}
      >
        {clickNoticeToast && (
          <div className="absolute inset-0 bg-[#261608]/50 flex items-center justify-center p-3 animate-fadeIn z-30 pointer-events-none">
            <div className="rpg-box p-2 bg-[#ffffff] border-2 border-[#261608] shadow-[2px_2px_0px_#261608] flex items-center gap-1.5">
              <span className="text-base">🚫</span>
              <span role="status" className="font-pixel text-[10px] font-bold text-[#b45309]">
                {SPECTATOR_NOTICE}
              </span>
            </div>
          </div>
        )}

        <GuestbookBoardButton ariaLabel={`${school.name} 방명록 보기`} onOpen={onOpenGuestbook} />
        <CampusSignButton
          testId="visit-info-button"
          icon={<Trophy className="w-3 h-3" aria-hidden="true" />}
          title="학교 정보"
          value={formatContribution(school.score)}
          tooltip={`학교 정보 보기 · 학교 점수 ${formatScore(school.score)}`}
          ariaLabel={`학교 정보 보기, 학교 점수 ${formatScore(school.score)}`}
          onOpen={() => setIsInfoOpen(true)}
        />
      </CampusStage>
    </GameScreenLayout>
  );
};
