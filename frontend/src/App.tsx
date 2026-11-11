import { useState, useEffect, useCallback, useMemo } from 'react';
import { TopHUD } from './components/TopHUD';
import { CampusView } from './components/CampusView';
import { PhoneShellVariantContext } from './components/PhoneShell';
import { GameScreenLayout } from './components/GameScreenLayout';
import { useDeviceMode } from './hooks/useDeviceMode';
import { AllianceNavProvider, BottomNav, NavTab, type AllianceNavValue } from './components/BottomNav';
import { RankingsView } from './components/RankingsView';
import { ShopView } from './components/ShopView';
import { CampusMapView } from './components/CampusMapView';
import { OnboardingFlow } from './components/OnboardingFlow';
import { SpriteSheetViewer } from './components/SpriteSheetViewer';
import { RankingScreenPhone } from './components/RankingScreenPhone';
import { ShopScreenPhone } from './components/ShopScreenPhone';
import { TwoPhoneMapComparison } from './components/TwoPhoneMapComparison';
import { MapIllustrationViewer } from './components/MapIllustrationViewer';
import { MapScreenPhone, INITIAL_MAP_CONTEXT, type MapContext } from './components/MapScreenPhone';
import { VisitingScreen1Phone } from './components/VisitingScreen1Phone';
import { VisitingScreen2Phone } from './components/VisitingScreen2Phone';
import { OnboardingPhone } from './components/onboarding/OnboardingPhone';
import { useMySchool } from './hooks/useSchoolViews';
import { TwoPhoneChatComparison } from './components/TwoPhoneChatComparison';
import { TwoPhoneVisitingComparison } from './components/TwoPhoneVisitingComparison';
import { TwoPhoneOurSchoolGuestbookComparison } from './components/TwoPhoneOurSchoolGuestbookComparison';
import { TwoPhoneRankingComparison } from './components/TwoPhoneRankingComparison';
import { OurSchoolGuestbookBottomSheet } from './components/OurSchoolGuestbookBottomSheet';
import { ChatPreviewBar } from './components/ChatPreviewBar';
import { ChatBottomSheet } from './components/ChatBottomSheet';
import { BottomSheetDialog } from './components/BottomSheetDialog';
import { CampusStatsSheet } from './components/CampusStatsSheet';
import { getSchoolRankings } from './data/mockRankings';
import { useMockGame } from './hooks/useMockGame';
import { useMockRequest } from './hooks/useMockRequest';
import { MOCK_REQUEST_MODES, type MockRequestMode } from './utils/mockRequest';
import { MockLoadGate } from './components/MockLoadGate';
import { AllianceProvider, useAlliance } from './hooks/useMockAlliance';
import { BattleProvider, useBattle } from './hooks/useMockBattle';
import { CampusAmbienceProvider, useAmbienceControl } from './hooks/useCampusTimePhase';
import type { AmbienceOverride } from './data/campusAmbience';
import { AllianceApplyScreenPhone } from './components/AllianceApplyScreenPhone';
import { CurrentAllianceScreenPhone } from './components/CurrentAllianceScreenPhone';
import { BattleApplyScreenPhone } from './components/BattleApplyScreenPhone';
import { BattleStatusScreenPhone } from './components/BattleStatusScreenPhone';
import { soundManager } from './utils/sound';
import { Smartphone, Gamepad2, Layers, Trophy, ShoppingBag, MapPin, Image as ImageIcon, Compass, MessageSquare, BookOpen, Sparkles } from 'lucide-react';

// [시연] 헤더 학교명 길이별 표시 확인용. 실제 학교 데이터가 아니라 목업 표시 테스트 값이다.
/** Service flow screens (M5-D). Demo tools and design comparisons are left out of the 44px touch areas. */
const SERVICE_VIEW_MODES = new Set<string>(['gameplay', 'signup', 'single_map', 'visiting', 'ranking', 'shop', 'alliance_apply', 'current_alliance', 'battle_apply', 'battle_status']);

const DEMO_SCHOOL_NAMES = [
  // 'default' shows the player's school (M4: set by the mock email verification).
  { id: 'default', label: '기본', name: null },
  { id: 'medium', label: '9자', name: '서울과학기술대학교' },
  { id: 'long', label: '긴 이름', name: '한국방송통신대학교 프라임칼리지 서울캠퍼스' },
] as const;

function AppContent() {
  // Mode: 'ranking_screens' (2-phone ranking comparison with infinite scroll) | 'our_guestbook_screens' | 'visiting_screens' | etc.
  const [viewMode, setViewMode] = useState<'ranking_screens' | 'our_guestbook_screens' | 'visiting_screens' | 'chat_screens' | 'single_map' | 'visiting' | 'map_screens' | 'map_illustration' | 'shop' | 'ranking' | 'spritesheet' | 'onboarding' | 'signup' | 'gameplay' | 'alliance_apply' | 'current_alliance' | 'battle_apply' | 'battle_status'>('gameplay');
  const [isChatSheetOpen, setIsChatSheetOpen] = useState<boolean>(false);
  const [isOurGuestbookSheetOpen, setIsOurGuestbookSheetOpen] = useState<boolean>(false);
  const [isStatsSheetOpen, setIsStatsSheetOpen] = useState<boolean>(false);
  const [isMockMenuOpen, setIsMockMenuOpen] = useState<boolean>(false);
  // Map → visit → return (M2, docs/261108-2000-m2_map_visit_return_plan.md 4-1). Only the ID is kept;
  // the visit screen reads the school's values from the shared rows.
  const [visitSchoolId, setVisitSchoolId] = useState<string | null>(null);
  const [mapContext, setMapContext] = useState<MapContext>(INITIAL_MAP_CONTEXT);
  const [isVisitGuestbookOpen, setIsVisitGuestbookOpen] = useState<boolean>(false);

  const ambienceControl = useAmbienceControl();
  // T2 (plan §5): on a phone the service screens fill the viewport; demo comparisons keep their frames and scroll.
  const isPhone = useDeviceMode() === 'full';
  const shellVariant = isPhone && SERVICE_VIEW_MODES.has(viewMode) ? 'full' : 'framed';
  const viewWrap = shellVariant === 'full' ? 'w-full flex flex-col' : 'w-full flex flex-col items-center py-2 animate-fadeIn';
  const game = useMockGame();
  const request = useMockRequest();
  const playerInfo = game.player;
  const schoolScore = game.state.schoolScore;
  const mySchool = useMySchool();
  const mySchoolRank = getSchoolRankings(schoolScore, playerInfo.schoolId).find((school) => school.isMySchool)!;
  const rank = mySchoolRank.rank;
  const rankDelta = mySchoolRank.change;
  const campusLevel = game.campus.level;
  const myContribution = game.state.contribution;
  const [activeStudents, setActiveStudents] = useState<number>(37);
  const [activeTab, setActiveTab] = useState<NavTab>('campus');

  const goToMySchool = () => {
    setIsVisitGuestbookOpen(false);
    setActiveTab('campus');
    setViewMode('gameplay');
  };
  const goToMap = () => {
    setIsVisitGuestbookOpen(false);
    setViewMode('single_map');
  };
  // My school opens my own campus; any other ID opens its visit screen (unknown IDs show a notice there).
  const openSchool = (schoolId: string) => {
    if (schoolId === playerInfo.schoolId) {
      goToMySchool();
      return;
    }
    setVisitSchoolId(schoolId);
    setIsVisitGuestbookOpen(false);
    setViewMode('visiting');
  };
  // Bottom-nav tabs from service screens outside the main game (visit, alliance·battle — T4, plan §7).
  const navigateTab = (tab: NavTab) => {
    if (tab === 'campus') goToMySchool();
    else if (tab === 'map') goToMap();
    else if (tab === 'rankings') setViewMode('ranking');
    else if (tab === 'shop') setViewMode('shop');
  };
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [demoSchoolNameId, setDemoSchoolNameId] = useState<(typeof DEMO_SCHOOL_NAMES)[number]['id']>('default');
  const demoSchoolName = DEMO_SCHOOL_NAMES.find((d) => d.id === demoSchoolNameId)!.name ?? mySchool.name;

  // 기존 피버 연출은 유지하되 별도 EXP는 생성하지 않는다.
  const [_feverGauge, setFeverGauge] = useState<number>(35);
  const [isFever, setIsFever] = useState<boolean>(false);
  const shopItems = game.storeItems;
  const basePower = game.normalPower;
  const clickPower = game.criticalPower;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.enabled = next;
  };

  // Fluctuating active student ticker count (no idle/auto income added to score)
  useEffect(() => {
    const teamInterval = setInterval(() => {
      const flu = Math.floor(Math.random() * 9) - 4;
      setActiveStudents((prev) => Math.max(30, Math.min(48, prev + flu)));
    }, 4500);

    return () => clearInterval(teamInterval);
  }, []);

  useEffect(() => {
    if (isFever) {
      const feverTimer = setTimeout(() => {
        setIsFever(false);
        setFeverGauge(0);
      }, 6000);
      return () => clearTimeout(feverTimer);
    } else {
      const decayTimer = setInterval(() => {
        setFeverGauge((prev) => Math.max(0, prev - 2));
      }, 800);
      return () => clearInterval(decayTimer);
    }
  }, [isFever]);

  const handleCampusTap = useCallback(
    (_x: number, _y: number, isCrit: boolean, _gainedPoints: number) => {
      const gainedPoints = game.tap(isCrit);
      // A refused click (M5-A) adds nothing, not even to the fever gauge.
      if (gainedPoints === null) return null;

      if (!isFever) {
        setFeverGauge((prev) => {
          const next = prev + 5;
          if (next >= 100) {
            setIsFever(true);
            soundManager.playFeverSound();
            return 100;
          }
          return next;
        });
      }
      return gainedPoints;
    },
    [game.tap, isFever]
  );

  const alliance = useAlliance();
  const battle = useBattle();
  const hasAllianceAlert =
    alliance.receivedRequests.some((r) => r.status === 'pending')
    || battle.pendingBattles.some((b) => battle.myAllianceId !== null && b.recipientAllianceId === battle.myAllianceId)
    || battle.isMyAllianceOccupied;
  const allianceNav = useMemo<AllianceNavValue>(
    () => ({ open: () => setViewMode('current_alliance'), hasAlert: hasAllianceAlert }),
    [hasAllianceAlert],
  );

  const hasAffordableShopItem = shopItems.some((item) => !item.previewOnly && myContribution >= item.cost)
    || (game.clicker.upgradeCost !== null && myContribution >= game.clicker.upgradeCost);

  // View menus and demo tools: in the desktop header, or in the mock menu sheet on a phone (T2, plan §5, Q5).
  // View switcher (M5-D): service flow screens and design comparisons/demo tools are kept apart.
  const viewMenus = (inSheet: boolean) => (
    <div className={`flex flex-col gap-1.5 ${inSheet ? 'items-start' : 'items-end'}`}>
      <nav aria-label="서비스 흐름" className={`flex items-center gap-1.5 flex-wrap ${inSheet ? 'justify-start' : 'justify-end'}`}>
        <span className="font-pixel text-[10px] font-black text-[#15803d]">서비스 흐름</span>
        <button
          onClick={() => {
            setViewMode('gameplay');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'gameplay' ? 'plaque-green' : 'plaque-wood'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5 text-white" />
          <span>🎮 메인 게임 화면</span>
        </button>

        <button
          onClick={() => {
            setViewMode('signup');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'signup' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-[#261608]" />
          <span>📱 순차 온보딩 (Single Phone)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('single_map');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'single_map' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-[#261608]" />
          <span>🗺️ 단일 폰 지도</span>
        </button>

        <button
          onClick={() => {
            setViewMode('ranking');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'ranking' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-[#261608]" />
          <span>🏆 랭킹 화면 (Single Phone)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('shop');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'shop' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-[#261608]" />
          <span>🏪 상점 & 강화 (Single Phone)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('alliance_apply');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'alliance_apply' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <span>🤝 연합 신청 (Alliance Apply)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('current_alliance');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'current_alliance' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <span>🛡️ 현재 연합 (Current Alliance)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('battle_apply');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'battle_apply' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <span>⚔️ 대결 신청 (Battle Apply)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('battle_status');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'battle_status' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <span>📊 대결 현황 (Battle Status)</span>
        </button>
      </nav>
      <nav aria-label="[시연] 시안 비교·도구" className={`flex items-center gap-1.5 flex-wrap ${inSheet ? 'justify-start' : 'justify-end'}`}>
        <span className="font-pixel text-[10px] font-black text-[#8b5327]">[시연] 시안 비교·도구</span>
        <button
          onClick={() => {
            setViewMode('ranking_screens');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'ranking_screens' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-[#d97706]" />
          <span>🏆 2-Phone 순위 비교 (무한 스크롤)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('our_guestbook_screens');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'our_guestbook_screens' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#e11d48]" />
          <span>📜 2-Phone 우리 방명록 (Screen 1 & 2)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('visiting_screens');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'visiting_screens' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-[#0d9488]" />
          <span>📖 2-Phone 방문교 방명록</span>
        </button>

        <button
          onClick={() => {
            setViewMode('chat_screens');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'chat_screens' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#261608]" />
          <span>💬 2-Phone 채팅 비교</span>
        </button>

        <button
          onClick={() => {
            setViewMode('map_screens');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'map_screens' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-[#261608]" />
          <span>📱📱 2-Phone 지도 비교</span>
        </button>

        <button
          onClick={() => {
            setViewMode('map_illustration');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'map_illustration' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#261608]" />
          <span>🖼️ 배경 맵 일러스트 (1080x1600)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('spritesheet');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'spritesheet' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-[#261608]" />
          <span>🏛️ 10단계 캠퍼스 성장 시트 (5x2)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('onboarding');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque px-2.5 py-1.5 text-xs font-pixel font-bold flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'onboarding' ? 'plaque-yellow' : 'plaque-parchment'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-[#261608]" />
          <span>3단 온보딩 화면</span>
        </button>
      </nav>
    </div>
  );
  const demoTools = (
    <section aria-label="[시연] 도구" className="mb-3 flex flex-wrap items-center justify-center gap-3 border-2 border-dashed border-[#8b5327] bg-[#fffbeb] px-3 py-1.5">
      <span className="font-pixel text-xs font-black text-[#8b5327]">[시연] 도구</span>
      <label className="font-pixel text-xs font-bold">[시연] 시간대{' '}
        <select aria-label="[시연] 시간대" value={ambienceControl?.override ?? 'auto'} onChange={(e) => ambienceControl?.setOverride(e.target.value as AmbienceOverride)} className="border-2 border-[#261608] bg-white px-2 py-1">
          <option value="auto">자동</option><option value="dawn">새벽</option><option value="day">낮</option><option value="dusk">노을</option><option value="night">밤</option>
        </select>
      </label>
      <label className="font-pixel text-xs font-bold">[시연] 학교명{' '}
        <select aria-label="[시연] 학교명" value={demoSchoolNameId} onChange={(e) => setDemoSchoolNameId(e.target.value as typeof demoSchoolNameId)} className="border-2 border-[#261608] bg-white px-2 py-1">
          {DEMO_SCHOOL_NAMES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>
      {/* M5-B: how the next mock requests (auth, shop, ranking/map/visit queries) end. */}
      <label className="font-pixel text-xs font-bold">[시연] 요청{' '}
        <select aria-label="[시연] 요청 상태" value={request.mode} onChange={(e) => request.setMode(e.target.value as MockRequestMode)} className="border-2 border-[#261608] bg-white px-2 py-1">
          {MOCK_REQUEST_MODES.map((option) => <option key={option.mode} value={option.mode}>{option.label}</option>)}
        </select>
      </label>
      {/* M5-A: every click on my campus is refused while this is on. */}
      <label className="font-pixel text-xs font-bold flex items-center gap-1">
        <input type="checkbox" checked={game.clickRejectDemo} onChange={(e) => game.setClickRejectDemo(e.target.checked)} />
        [시연] 서버 클릭 거절 응답
      </label>
    </section>
  );

  return (
    <AllianceNavProvider value={allianceNav}>
      <div className={`w-full bg-[#f1f5f9] flex flex-col items-center justify-start select-none text-[#261608] ${isPhone ? 'device-full min-h-dvh' : 'min-h-screen p-2 sm:p-5'}`}>
        {/* [목업] Phone: the presentation header, view menus and demo tools move into a sheet behind this bar (Q5). Not part of the real service. */}
        {isPhone && (
          <div className="mock-menu-bar w-full shrink-0 flex items-center justify-end gap-2 bg-[#fffbeb] border-b-2 border-dashed border-[#8b5327]">
            <span className="font-pixel text-[10px] font-bold text-[#8b5327] truncate">[시연] 다른 목업 화면·도구</span>
            <button type="button" onClick={() => { setIsMockMenuOpen(true); soundManager.playTabSound(); }}
              className="pixel-plaque plaque-parchment px-2 py-0.5 text-[10px] font-pixel font-bold cursor-pointer shrink-0">
              목업
            </button>
          </div>
        )}
        {isPhone && isMockMenuOpen && (
          <BottomSheetDialog label="목업 메뉴" onClose={() => setIsMockMenuOpen(false)}>
            {/* Choosing a screen closes the sheet; the demo tools (selects, checkbox) keep it open. */}
            <div className="p-3 flex flex-col gap-3" onClick={(e) => { if ((e.target as Element).closest('nav button')) setIsMockMenuOpen(false); }}>
              {viewMenus(true)}
              {demoTools}
            </div>
          </BottomSheetDialog>
        )}
        {/* Top Presentation Bar: Clean Flat Presentation on Plain Light Background */}
        {!isPhone && (
        <div className="w-full max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 px-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#facc15] border-3 border-[#261608] shadow-[2px_2px_0px_#261608] flex items-center justify-center font-press-start text-xs font-black text-[#261608]">
              대
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-pixel text-base sm:text-lg font-black text-[#261608] tracking-tight">
                  대대대 (DAEDAEDAE)
                </h1>
                <span className="text-[10px] font-pixel text-[#ffffff] bg-[#e11d48] border border-[#261608] px-1.5 py-0.2 shadow-[1px_1px_0px_#261608]">
                  UI Mockup
                </span>
              </div>
              <p className="font-pixel text-[11px] text-[#8b5327]">
                전국 가상 대학교 대항전 픽셀 클리커 게임 온보딩 플로우 (9:19.5 포트레이트)
              </p>
            </div>
          </div>

          {viewMenus(false)}
        </div>
        )}

        {!isPhone && demoTools}

        {/* Main Content Area based on viewMode. Service screens get 44px touch areas (src/index.css). */}
        <PhoneShellVariantContext.Provider value={shellVariant}>
        <div className="contents" data-touch-area={SERVICE_VIEW_MODES.has(viewMode) ? '44' : undefined}>
        {viewMode === 'ranking_screens' ? (
          <TwoPhoneRankingComparison
            schoolScore={schoolScore}
            onNavigateTab={(tab) => {
              if (tab === 'campus') {
                setViewMode('gameplay');
              } else if (tab === 'map') {
                setViewMode('map_screens');
              } else if (tab === 'shop') {
                setViewMode('shop');
              }
            }}
          />
        ) : viewMode === 'our_guestbook_screens' ? (
          <TwoPhoneOurSchoolGuestbookComparison
            schoolScore={schoolScore}
            rank={rank}
            rankDelta={rankDelta}
            campusLevel={campusLevel}
            clickPower={clickPower}
            basePower={basePower}
            activeStudents={activeStudents}
            onCampusTap={handleCampusTap}
            onNavigateTab={(tab) => {
              if (tab === 'campus') {
                setViewMode('gameplay');
              } else if (tab === 'map') {
                setViewMode('map_screens');
              } else if (tab === 'rankings') {
                setViewMode('ranking');
              } else if (tab === 'shop') {
                setViewMode('shop');
              }
            }}
            onGoToMap={() => setViewMode('map_screens')}
          />
        ) : viewMode === 'visiting_screens' ? (
          <TwoPhoneVisitingComparison
            onBackToMySchool={goToMySchool}
            onNavigateTab={navigateTab}
          />
        ) : viewMode === 'chat_screens' ? (
          <TwoPhoneChatComparison
            schoolScore={schoolScore}
            rank={rank}
            rankDelta={rankDelta}
            campusLevel={campusLevel}
            clickPower={clickPower}
            basePower={basePower}
            activeStudents={activeStudents}
            onCampusTap={handleCampusTap}
            onNavigateTab={(tab) => {
              if (tab === 'campus') {
                setViewMode('gameplay');
              } else if (tab === 'map') {
                setViewMode('map_screens');
              } else if (tab === 'rankings') {
                setViewMode('ranking');
              } else if (tab === 'shop') {
                setViewMode('shop');
              }
            }}
          />
        ) : viewMode === 'visiting' ? (
          <div className={viewWrap}>
            {isVisitGuestbookOpen && (
              <VisitingScreen2Phone modal schoolId={visitSchoolId ?? ''} onCloseGuestbook={() => setIsVisitGuestbookOpen(false)} />
            )}
            <MockLoadGate key={`visit:${visitSchoolId ?? ''}`} name="방문 학교" onBack={goToMap} backLabel="지도로 돌아가기">
              <VisitingScreen1Phone
                schoolId={visitSchoolId ?? ''}
                onBackToMap={goToMap}
                onBackToMySchool={goToMySchool}
                onNavigateTab={navigateTab}
                onOpenGuestbook={() => setIsVisitGuestbookOpen(true)}
                soundEnabled={soundEnabled}
                onToggleSound={handleToggleSound}
              />
            </MockLoadGate>
          </div>
        ) : viewMode === 'single_map' ? (
          <div className={viewWrap}>
            <MockLoadGate key="map" name="학교 지도" onBack={goToMySchool}>
              <MapScreenPhone
                context={mapContext}
                onContextChange={setMapContext}
                onSelectSchool={openSchool}
                onNavigateTab={(tab) => {
                  if (tab === 'campus') {
                    setActiveTab('campus');
                    setViewMode('gameplay');
                  } else if (tab === 'rankings') {
                    setViewMode('ranking');
                  } else if (tab === 'shop') {
                    setViewMode('shop');
                  }
                }}
              />
            </MockLoadGate>
          </div>
        ) : viewMode === 'map_illustration' ? (
          <MapIllustrationViewer
            onGoToMapScreen={() => setViewMode('single_map')}
          />
        ) : viewMode === 'map_screens' ? (
          <TwoPhoneMapComparison
            onSelectSchool={openSchool}
            onNavigateTab={(tab) => {
              if (tab === 'campus') {
                setActiveTab('campus');
                setViewMode('gameplay');
              } else if (tab === 'rankings') {
                setViewMode('ranking');
              } else if (tab === 'shop') {
                setViewMode('shop');
              }
            }}
            onGoToMySchool={() => {
              setActiveTab('campus');
              setViewMode('gameplay');
            }}
          />
        ) : viewMode === 'shop' ? (
          <div className={viewWrap}>
            <ShopScreenPhone
              onNavigateTab={(tab) => {
                if (tab === 'campus') {
                  setActiveTab('campus');
                  setViewMode('gameplay');
                } else if (tab === 'rankings') {
                  setViewMode('ranking');
                } else if (tab === 'map') {
                  setViewMode('map_screens');
                }
              }}
            />
          </div>
        ) : viewMode === 'ranking' ? (
          <div className={viewWrap}>
            <MockLoadGate key="ranking" name="순위" onBack={goToMySchool}>
              <RankingScreenPhone
                currentSchoolScore={schoolScore}
                onNavigateTab={(tab) => {
                  if (tab === 'campus') {
                    setActiveTab('campus');
                    setViewMode('gameplay');
                  } else if (tab === 'shop') {
                    setViewMode('shop');
                  } else if (tab === 'map') {
                    setViewMode('map_screens');
                  }
                }}
              />
            </MockLoadGate>
          </div>
        ) : viewMode === 'alliance_apply' ? (
          <div className={viewWrap}>
            <AllianceApplyScreenPhone
              onNavigateTab={navigateTab}
              onBack={() => setViewMode('gameplay')}
              onNavigateToCurrentAlliance={() => setViewMode('current_alliance')}
            />
          </div>
        ) : viewMode === 'current_alliance' ? (
          <div className={viewWrap}>
            <CurrentAllianceScreenPhone
              onNavigateTab={navigateTab}
              onBack={() => setViewMode('gameplay')}
              onNavigateToApply={() => setViewMode('alliance_apply')}
              onNavigateToBattleApply={() => setViewMode('battle_apply')}
              onNavigateToBattleStatus={() => setViewMode('battle_status')}
            />
          </div>
        ) : viewMode === 'battle_apply' ? (
          <div className={viewWrap}>
            <BattleApplyScreenPhone
              onNavigateTab={navigateTab}
              onBack={() => setViewMode('current_alliance')}
              onNavigateToBattleStatus={() => setViewMode('battle_status')}
              onNavigateToAllianceApply={() => setViewMode('alliance_apply')}
            />
          </div>
        ) : viewMode === 'battle_status' ? (
          <div className={viewWrap}>
            <BattleStatusScreenPhone
              onNavigateTab={navigateTab}
              onBack={() => setViewMode('current_alliance')}
              onNavigateToBattleApply={() => setViewMode('battle_apply')}
            />
          </div>
        ) : viewMode === 'spritesheet' ? (
          <SpriteSheetViewer
            currentLevel={campusLevel}
            onSelectStageForGame={(level) => {
              game.previewCampus(level);
            }}
            onGoToGame={() => setViewMode('gameplay')}
          />
        ) : viewMode === 'onboarding' ? (
          <OnboardingFlow onStartSequential={() => setViewMode('signup')} />
        ) : viewMode === 'signup' ? (
          <OnboardingPhone onGoToCampus={goToMySchool} />
        ) : (
          /* Single Phone Gameplay View */
          <div className={viewWrap}>
            {!isPhone && <div className="mb-2 font-pixel text-xs text-[#8b5327] font-bold flex items-center gap-2">
              <span>입학생: {playerInfo.nickname} ({playerInfo.department})</span>
              <button
                data-no-touch44
                onClick={() => setViewMode('spritesheet')}
                className="pixel-plaque plaque-parchment px-2 py-0.5 text-[10px] cursor-pointer"
              >
                [시연] 성장 시트 보기
              </button>
            </div>}


            {/* 9:19.5 Portrait Phone Frame; the layout is shared with the visit screen (V1). */}
            <GameScreenLayout
              kind="my-campus"
              fillMain={activeTab === 'campus'}
              header={
                <TopHUD
                  schoolName={demoSchoolName}
                  schoolId={mySchool.id}
                  schoolBadgeColor={mySchool.badgeColor}
                  schoolInitial={demoSchoolNameId === 'default' ? mySchool.firstSyllable : undefined}
                  schoolRegion={`${mySchool.city} · ${mySchool.filterRegion}`}
                  schoolScore={schoolScore}
                  rank={rank}
                  rankDelta={rankDelta}
                  campusLevel={campusLevel}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
                  onOpenRankings={() => setActiveTab('rankings')}
                  onOpenMap={() => setActiveTab('map')}
                />
              }
              previewBar={
                <ChatPreviewBar
                  latestSender="새벽코딩러"
                  latestMessage="도서관 앞 클릭 모임 ㄱㄱ"
                  unreadCount={12}
                  onClick={() => {
                    setIsChatSheetOpen(true);
                    soundManager.playTabSound();
                  }}
                />
              }
              nav={
                <BottomNav
                  activeTab={activeTab}
                  onChangeTab={setActiveTab}
                  hasShopUpgrade={hasAffordableShopItem}
                  hasRankChange={rankDelta.startsWith('▲')}
                />
              }
              overlays={
                <>
                  {/* Service sheets use the native top layer; short viewports must not clip controls. */}
                  {isChatSheetOpen && (
                    <BottomSheetDialog label="채팅" onClose={() => {
                      setIsChatSheetOpen(false);
                      soundManager.playTabSound();
                    }}>
                      <ChatBottomSheet
                        onClose={() => {
                          setIsChatSheetOpen(false);
                          soundManager.playTabSound();
                        }}
                        mySchoolInitial={mySchool.firstSyllable}
                        myNickname={playerInfo.nickname}
                        myDepartment={playerInfo.department}
                      />
                    </BottomSheetDialog>
                  )}

                  {isStatsSheetOpen && (
                    <BottomSheetDialog label="상세 스탯" onClose={() => {
                      setIsStatsSheetOpen(false);
                      soundManager.playTabSound();
                    }}>
                      <CampusStatsSheet onGoToShop={() => {
                        setIsStatsSheetOpen(false);
                        setActiveTab('shop');
                        soundManager.playTabSound();
                      }} />
                    </BottomSheetDialog>
                  )}

                  {isOurGuestbookSheetOpen && (
                    <BottomSheetDialog label="우리 학교 방명록" onClose={() => {
                      setIsOurGuestbookSheetOpen(false);
                      soundManager.playTabSound();
                    }}>
                      <OurSchoolGuestbookBottomSheet
                        onClose={() => {
                          setIsOurGuestbookSheetOpen(false);
                          soundManager.playTabSound();
                        }}
                        onGoToMap={() => {
                          setIsOurGuestbookSheetOpen(false);
                          setActiveTab('map');
                        }}
                        mySchoolId={mySchool.id}
                        schoolName={mySchool.name}
                      />
                    </BottomSheetDialog>
                  )}
                </>
              }
            >
              {activeTab === 'campus' && (
                <>
                  <CampusView
                    onTap={handleCampusTap}
                    clickPower={clickPower}
                    basePower={basePower}
                    activeStudents={activeStudents}
                    onOpenGuestbook={() => {
                      setIsOurGuestbookSheetOpen(true);
                      soundManager.playTabSound();
                    }}
                    showGuestbookBoard={true}
                    onOpenStats={() => setIsStatsSheetOpen(true)}
                    fill
                  />

                </>
              )}

              {activeTab === 'rankings' && (
                <MockLoadGate name="순위" variant="panel" onBack={() => setActiveTab('campus')} backLabel="캠퍼스로">
                  <RankingsView
                    currentSchoolScore={schoolScore}
                    onBackToCampus={() => setActiveTab('campus')}
                  />
                </MockLoadGate>
              )}

              {activeTab === 'shop' && (
                <ShopView
                  onBackToCampus={() => setActiveTab('campus')}
                />
              )}

              {activeTab === 'map' && (
                <CampusMapView
                  currentLevel={campusLevel}
                  currentScore={schoolScore}
                  onBackToCampus={() => setActiveTab('campus')}
                  onOpenSpriteSheet={() => setViewMode('spritesheet')}
                  onOpenKoreaMap={goToMap}
                />
              )}
            </GameScreenLayout>
          </div>
        )}
        </div>
        </PhoneShellVariantContext.Provider>
      </div>
    </AllianceNavProvider>
  );
}

export default function App() {
  return (
    <CampusAmbienceProvider>
      <AllianceProvider>
        <BattleProvider>
          <AppContent />
        </BattleProvider>
      </AllianceProvider>
    </CampusAmbienceProvider>
  );
}
