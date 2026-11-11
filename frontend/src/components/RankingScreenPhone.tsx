import React, { useState, useEffect, useCallback } from 'react';
import { PhoneShell } from './PhoneShell';
import { Crown, Sparkles, ArrowUp, ArrowDown, Minus, RefreshCw, ChevronUp, MoveVertical } from 'lucide-react';
import { soundManager } from '../utils/sound';
import { BottomNav, NavTab } from './BottomNav';
import { getMockRankings } from '../data/mockRankings';
import { useMockGame } from '../hooks/useMockGame';
import { useMySchool } from '../hooks/useSchoolViews';
import { useDragScroll } from '../hooks/useDragScroll';
import { SharedImage } from './SharedImage.tsx';

interface RankingScreenPhoneProps {
  currentSchoolScore: number;
  onNavigateTab: (tab: NavTab) => void;
}

type RankingTab = 'school' | 'dept' | 'personal';

export const RankingScreenPhone: React.FC<RankingScreenPhoneProps> = ({
  currentSchoolScore,
  onNavigateTab,
}) => {
  const [activeRankingTab, setActiveRankingTab] = useState<RankingTab>('school');
  const [refreshCountdown, setRefreshCountdown] = useState<number>(5);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Pagination for infinite scrolling (starts at 15, increases by 10)
  const [visibleCount, setVisibleCount] = useState<number>(15);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // 5-second auto refresh loop
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          setIsRefreshing(true);
          setTimeout(() => setIsRefreshing(false), 300);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Official Real Universities Data with user score dynamic reflection
  const game = useMockGame();
  const mySchool = useMySchool();
  const { school: schoolRankings, dept: deptRankings, personal: personalRankings } = getMockRankings({ ...game.state, schoolScore: currentSchoolScore }, game.player);

  const currentDataset =
    activeRankingTab === 'school'
      ? schoolRankings
      : activeRankingTab === 'dept'
      ? deptRankings
      : personalRankings;

  const totalCount = currentDataset.length;

  // Infinite scroll trigger: loads next 10 items
  const handleLoadMore = useCallback(() => {
    if (activeRankingTab !== 'school') return;
    if (visibleCount >= totalCount || isLoadingMore) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(totalCount, prev + 10));
      setIsLoadingMore(false);
    }, 350);
  }, [activeRankingTab, visibleCount, totalCount, isLoadingMore]);

  // Hook for drag and touch scrolling with momentum
  const { containerRef, isDragging, scrollTop, scrollToTop, dragHandlers } =
    useDragScroll({
      onScrollBottom: handleLoadMore,
      bottomThreshold: 120,
    });

  // Top 3 Podium
  const top1 = currentDataset[0];
  const top2 = currentDataset[1];
  const top3 = currentDataset[2];

  // Ranks 4 to visibleCount
  const listRows = currentDataset.slice(3, visibleCount);

  // My school/item
  const myItem = currentDataset.find((item) => item.isMySchool) || currentDataset[6];

  // 순위가 바뀌어도 내 항목을 찾을 수 있도록 모든 탭에서 고정 요약을 제공한다.
  const showPinnedMySchoolBar = true;

  // Sticky top 1st place bar appears when podium is scrolled past (scrollTop > 170px)
  const showStickyTop1Summary = activeRankingTab === 'school' && scrollTop > 175;

  const renderBadge = (
    item: { id: string; name: string; firstSyllable?: string; crestSymbol?: string; badgeColor?: string; crestColor?: string },
    size: 'sm' | 'md' | 'lg' = 'sm'
  ) => {
    const sizeClasses =
      size === 'lg'
        ? 'w-10 h-10 text-sm font-black'
        : size === 'md'
        ? 'w-8 h-8 text-xs font-bold'
        : 'w-6 h-6 text-[10px] font-bold';

    const syllable = item.firstSyllable || item.crestSymbol || '?';
    const bgColor = item.badgeColor || item.crestColor || '#0284c7';

    return (
      <div
        className={`${sizeClasses} border-2 border-[#261608] shadow-[1px_1px_0px_#261608] flex items-center justify-center text-white shrink-0 font-pixel`}
        style={{ backgroundColor: bgColor }}
      >
        <SharedImage target={{ type: activeRankingTab === 'dept' ? 'department' : activeRankingTab === 'personal' ? 'profile' : 'school', id: item.id }} name={item.name} fallback={syllable} className="w-full h-full drop-shadow-[1px_1px_0px_#261608]" />
      </div>
    );
  };

  return (
    <PhoneShell>
      {/* 2. Screen Header Bar: Title & "5초마다 갱신" */}
      <div className="w-full bg-[#fdf5df] border-b-2 border-[#261608] px-3 py-1.5 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-1.5">
          <span className="font-pixel text-xs font-bold text-[#ffffff] bg-[#e11d48] border border-[#261608] px-1 shadow-[1px_1px_0px_#261608]">
            대대대
          </span>
          <h1 className="font-pixel text-sm font-black text-[#261608]">
            전국 랭킹 대항전
          </h1>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-pixel text-[#8b5327]">
          <RefreshCw
            className={`w-3 h-3 text-[#22c55e] ${isRefreshing ? 'animate-spin' : ''}`}
          />
          <span className="font-mono font-bold text-[#261608]">5초마다 갱신</span>
          <span className="text-[9px] font-mono text-[#e11d48] bg-[#fef08a] border border-[#261608] px-1 py-0.2">
            {refreshCountdown}s
          </span>
        </div>
      </div>

      <p className="px-2 py-1 font-pixel text-[9px] text-[#8b5327] shrink-0">
        {activeRankingTab === 'school' ? '전국 학교' : activeRankingTab === 'dept' ? `${mySchool.shortName} 교내 학과` : `${mySchool.shortName} 교내 개인 · 소비 후 보유 기여도`} · 목업 샘플<br />
        점수 내림차순 → 이름 오름차순 · 동점 순위는 임시 연번 · 변경 즉시 반영
      </p>
      {/* 3. Sticky Tab Switcher */}
      <div className="w-full px-2 pt-1.5 bg-[#faecc7]/50 shrink-0 z-30">
        <div className="grid grid-cols-3 gap-1 p-1 rpg-box bg-[#fdf5df]">
          <button
            onClick={() => {
              if (isDragging) return;
              setActiveRankingTab('school');
              setVisibleCount(15);
              soundManager.playTabSound();
            }}
            className={`pixel-plaque py-1.5 px-1 text-center font-pixel text-xs font-bold cursor-pointer transition-transform ${
              activeRankingTab === 'school' ? 'plaque-yellow' : 'plaque-parchment text-[#8b5327]'
            }`}
          >
            학교 순위
          </button>
          <button
            onClick={() => {
              if (isDragging) return;
              setActiveRankingTab('dept');
              setVisibleCount(9);
              soundManager.playTabSound();
            }}
            className={`pixel-plaque py-1.5 px-1 text-center font-pixel text-xs font-bold cursor-pointer transition-transform ${
              activeRankingTab === 'dept' ? 'plaque-yellow' : 'plaque-parchment text-[#8b5327]'
            }`}
          >
            교내 학과
          </button>
          <button
            onClick={() => {
              if (isDragging) return;
              setActiveRankingTab('personal');
              setVisibleCount(9);
              soundManager.playTabSound();
            }}
            className={`pixel-plaque py-1.5 px-1 text-center font-pixel text-xs font-bold cursor-pointer transition-transform ${
              activeRankingTab === 'personal' ? 'plaque-yellow' : 'plaque-parchment text-[#8b5327]'
            }`}
          >
            교내 개인
          </button>
        </div>
      </div>

      {/* 4. Sticky Compact 1st Summary: Slides down when TOP 3 Podium scrolls out */}
      {showStickyTop1Summary && (
        <div className="w-full px-2 py-1 bg-[#faecc7]/95 border-b border-[#261608]/40 shrink-0 z-20 animate-fadeIn">
          <div className="rpg-box px-2 py-1 bg-[#fef08a] border border-[#261608] flex items-center justify-between shadow-[1px_1px_0px_#261608]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs">👑</span>
              <span className="font-press-start text-[9px] text-[#b45309] font-black">
                1
              </span>
              <div className="w-4.5 h-4.5 bg-[#1d4ed8] border border-[#261608] flex items-center justify-center font-pixel text-[8px] text-white font-bold shrink-0">
                <SharedImage target={{ type: 'school', id: top1.id }} name={top1.name} fallback={top1.firstSyllable} className="w-full h-full" />
              </div>
              <span className="font-pixel text-[11px] font-black text-[#261608] truncate">
                {top1.name}
              </span>
              <span className="text-[8px] font-pixel text-[#8b5327] hidden sm:inline">
                ({top1.region})
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] font-pixel text-[#8b5327] font-bold">현재 1위</span>
              <span className="font-press-start text-[9px] font-black text-[#261608]">
                {top1.score.toLocaleString('ko-KR')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Mobile Gesture Instruction Banner (Subtle, dispatches touch intent) */}
      <div className="w-full px-2 py-0.5 bg-[#faecc7]/40 border-b border-[#261608]/20 flex items-center justify-between text-[9px] font-pixel text-[#8b5327] shrink-0">
        <span className="flex items-center gap-1">
          <MoveVertical className="w-2.5 h-2.5 text-[#d97706]" />
          <span>마우스 드래그 및 터치 스와이프로 스크롤</span>
        </span>
        <span className="font-bold text-[#b45309]">
          {activeRankingTab === 'school' ? `${visibleCount} / ${totalCount}개교` : `${totalCount}개 순위`}
        </span>
      </div>

      {/* ========================================================= */}
      {/* 6. MAIN INTEGRATED DRAG-SCROLL VIEWPORT                    */}
      {/* ========================================================= */}
      <div
        ref={containerRef}
        {...dragHandlers}
        className={`flex-1 overflow-y-auto px-2 pt-1 pb-1 bg-[#faecc7]/30 relative scrollbar-none overscroll-contain select-none transition-colors ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {/* ========================================================= */}
        {/* TOP 3 PODIUM ON A GRASSY STAGE (Scrolls with the feed)     */}
        {/* ========================================================= */}
        <div className="w-full border-3 border-[#261608] shadow-[3px_3px_0px_#261608] bg-[#38a134] overflow-hidden shrink-0 relative flex flex-col justify-end pt-3 pb-1 px-2 mb-2">
          {/* Sky Strip & Sun */}
          <div className="absolute inset-x-0 top-0 h-9 bg-[#38bdf8] border-b-2 border-[#261608] flex items-center justify-between px-3">
            <span className="font-pixel text-[9px] text-white/95 font-bold">
              👑 TOP 3 명예의 전당
            </span>
            <div className="w-3.5 h-3.5 bg-[#facc15] border border-[#261608] shadow-[1px_1px_0px_#261608]" />
          </div>

          <span className="absolute bottom-12 left-2 text-[10px] pointer-events-none">🌼</span>
          <span className="absolute bottom-14 right-2 text-[10px] pointer-events-none">🌸</span>

          {/* 3 Podium Pillars: [2nd 부산대] [1st KAIST] [3rd 전남대] */}
          <div className="grid grid-cols-3 gap-1.5 items-end pt-7 relative z-10">
            {/* 2nd Place: 부산대 (Left) */}
            <div className="flex flex-col items-center">
              <div className="flex flex-col items-center mb-1">
                {renderBadge(top2, 'md')}
                <span className="font-pixel text-[11px] font-bold text-white drop-shadow-[1px_1px_0px_#261608] text-center truncate max-w-[85px] mt-0.5">
                  {top2.name}
                </span>
                <span className="text-[8px] font-pixel text-[#e0f2fe] drop-shadow-[1px_1px_0px_#261608]">
                  {top2.region}
                </span>
                <span className="font-press-start text-[8px] text-[#fef08a] drop-shadow-[1px_1px_0px_#261608] mt-0.5">
                  {top2.score.toLocaleString('ko-KR')}
                </span>
              </div>

              {/* Podium Block: Silver */}
              <div className="w-full h-15 bg-[#cbd5e1] border-3 border-[#261608] shadow-[2px_2px_0px_#261608] flex flex-col items-center justify-center relative">
                <div className="w-5 h-5 bg-[#94a3b8] border-2 border-[#261608] flex items-center justify-center font-press-start text-[10px] font-black text-white shadow-[1px_1px_0px_#261608]">
                  2
                </div>
                <span className="font-pixel text-[8px] text-[#261608] font-bold mt-0.5">
                  SILVER
                </span>
              </div>
            </div>

            {/* 1st Place: KAIST (Center - Tallest) */}
            <div className="flex flex-col items-center -mt-2.5">
              <div className="animate-bounce flex flex-col items-center mb-0.5">
                <Crown className="w-5 h-5 text-[#facc15] fill-[#facc15] drop-shadow-[1px_1px_0px_#261608]" />
              </div>

              <div className="flex flex-col items-center mb-1">
                {renderBadge(top1, 'lg')}
                <span className="font-pixel text-xs font-black text-[#fef08a] drop-shadow-[1px_1px_0px_#261608] text-center truncate max-w-[100px] mt-0.5">
                  {top1.name}
                </span>
                <span className="text-[8px] font-pixel text-[#fef9c3] drop-shadow-[1px_1px_0px_#261608]">
                  {top1.region}
                </span>
                <span className="font-press-start text-[9px] text-[#fef08a] drop-shadow-[1px_1px_0px_#261608] font-black mt-0.5">
                  {top1.score.toLocaleString('ko-KR')}
                </span>
              </div>

              {/* Podium Block: Gold (Tallest) */}
              <div className="w-full h-20 bg-[#facc15] border-3 border-[#261608] shadow-[2px_2px_0px_#261608] flex flex-col items-center justify-center relative">
                <div className="w-6 h-6 bg-[#ca8a04] border-2 border-[#261608] flex items-center justify-center font-press-start text-xs font-black text-[#fef08a] shadow-[1px_1px_0px_#261608]">
                  1
                </div>
                <span className="font-pixel text-[9px] text-[#261608] font-black mt-0.5">
                  CHAMPION
                </span>
              </div>
            </div>

            {/* 3rd Place: 전남대 (Right) */}
            <div className="flex flex-col items-center">
              <div className="flex flex-col items-center mb-1">
                {renderBadge(top3, 'md')}
                <span className="font-pixel text-[11px] font-bold text-white drop-shadow-[1px_1px_0px_#261608] text-center truncate max-w-[85px] mt-0.5">
                  {top3.name}
                </span>
                <span className="text-[8px] font-pixel text-[#dcfce7] drop-shadow-[1px_1px_0px_#261608]">
                  {top3.region}
                </span>
                <span className="font-press-start text-[8px] text-[#fef08a] drop-shadow-[1px_1px_0px_#261608] mt-0.5">
                  {top3.score.toLocaleString('ko-KR')}
                </span>
              </div>

              {/* Podium Block: Bronze */}
              <div className="w-full h-12 bg-[#d97706] border-3 border-[#261608] shadow-[2px_2px_0px_#261608] flex flex-col items-center justify-center relative">
                <div className="w-5 h-5 bg-[#92400e] border-2 border-[#261608] flex items-center justify-center font-press-start text-[10px] font-black text-[#fde68a] shadow-[1px_1px_0px_#261608]">
                  3
                </div>
                <span className="font-pixel text-[8px] text-white font-bold mt-0.5">
                  BRONZE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* LIST ROWS 4 TO N                                          */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between text-[10px] font-pixel text-[#8b5327] px-1 mb-1 font-bold">
          <span>순위 및 소속</span>
          <span>누적 점수 · 변동</span>
        </div>

        <div className="flex flex-col gap-1.5 pb-2">
          {listRows.map((row) => {
            const isMy = row.isMySchool;

            return (
              <div
                key={`${row.rank}-${row.name}`}
                className={`rpg-box p-1.5 flex items-center justify-between transition-colors shrink-0 ${
                  isMy
                    ? 'bg-[#fefce8] border-3 border-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.7)]'
                    : 'bg-[#fdf5df] border-2 hover:bg-[#fffbeb]'
                }`}
              >
                {/* Left: Rank, Badge, School Name & Region */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`font-press-start text-xs font-black w-6 text-center shrink-0 ${
                      isMy ? 'text-[#b45309]' : 'text-[#261608]'
                    }`}
                  >
                    {row.rank}
                  </span>

                  {renderBadge(row, 'sm')}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-pixel text-xs font-bold text-[#261608] truncate">
                        {row.name}
                      </span>
                      {isMy && (
                        <span className="font-pixel text-[8px] text-[#261608] bg-[#facc15] border border-[#261608] px-1 font-black shrink-0">
                          내 소속
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-[#8b5327] font-pixel truncate leading-none mt-0.5">
                      {row.region}
                    </p>
                  </div>
                </div>

                {/* Right: Score & Change Indicator */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-press-start text-[9px] text-[#261608] font-bold">
                    {row.score.toLocaleString('ko-KR')}
                  </span>
                  <span
                    className={`text-[8px] font-mono px-1 py-0.2 border border-[#261608] flex items-center gap-0.5 font-bold ${
                      row.change.startsWith('↑') || row.change.startsWith('▲')
                        ? 'text-white bg-[#22c55e]'
                        : row.change.startsWith('↓') || row.change.startsWith('▼')
                        ? 'text-white bg-[#fb7185]'
                        : 'text-[#261608] bg-[#faecc7]'
                    }`}
                  >
                    {row.change.startsWith('↑') || row.change.startsWith('▲') ? (
                      <ArrowUp className="w-2.5 h-2.5" />
                    ) : row.change.startsWith('↓') || row.change.startsWith('▼') ? (
                      <ArrowDown className="w-2.5 h-2.5" />
                    ) : (
                      <Minus className="w-2.5 h-2.5" />
                    )}
                    {row.change.replace(/[↑↓▲▼]/g, '') || '-'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* ========================================================= */}
          {/* INFINITE SCROLL LOADING ROW                                */}
          {/* ========================================================= */}
          {activeRankingTab === 'school' && (
            <div className="mt-1">
              {isLoadingMore ? (
                <div className="rpg-box p-2.5 bg-[#fdf5df] border-2 border-dashed border-[#8b5327] flex items-center justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#d97706] border border-[#261608] animate-pixel-blink" />
                    <span
                      className="w-1.5 h-1.5 bg-[#d97706] border border-[#261608] animate-pixel-blink"
                      style={{ animationDelay: '250ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-[#d97706] border border-[#261608] animate-pixel-blink"
                      style={{ animationDelay: '500ms' }}
                    />
                  </div>
                  <span className="font-pixel text-[10px] font-bold text-[#8b5327]">
                    순위 데이터를 더 불러오는 중… ({visibleCount} / {totalCount})
                  </span>
                </div>
              ) : visibleCount < totalCount ? (
                <button
                  onClick={() => {
                    if (!isDragging) handleLoadMore();
                  }}
                  className="w-full py-2 bg-[#faecc7]/60 hover:bg-[#faecc7] border-2 border-dashed border-[#8b5327]/60 text-center font-pixel text-[10px] text-[#8b5327] cursor-pointer active:translate-y-0.5 transition-all"
                >
                  <span>아래로 스크롤하여 10개교 더 보기 ({visibleCount} / {totalCount})</span>
                </button>
              ) : (
                <div className="py-2.5 text-center font-pixel text-[10px] text-[#8b5327] border-t border-[#261608]/20">
                  <span>🏁 전국 76개 모든 대학교 순위를 확인했습니다!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 7. FLOATING "▲ 맨 위로" PIXEL BUTTON                        */}
      {/* ========================================================= */}
      {scrollTop > 220 && (
        <button
          onClick={() => {
            soundManager.playTabSound();
            scrollToTop();
          }}
          className="absolute right-3 bottom-20 z-30 bg-[#facc15] hover:bg-[#fde047] text-[#261608] border-2 border-[#261608] shadow-[2px_2px_0px_#261608] px-2.5 py-1.5 flex items-center gap-1 cursor-pointer font-pixel text-[10px] font-black active:translate-y-0.5 transition-transform animate-fadeIn"
          title="최상단 포디움으로 이동"
        >
          <ChevronUp className="w-3.5 h-3.5 text-[#261608]" />
          <span>▲ 맨 위로</span>
        </button>
      )}

      {/* ========================================================= */}
      {/* 8. SMART PINNED "MY SCHOOL" BAR                           */}
      {/* Shown dynamically whenever row 7 scrolled away from view  */}
      {/* ========================================================= */}
      {showPinnedMySchoolBar && (
        <div className="w-full shrink-0 px-2 pt-1 pb-1 bg-[#fdf5df] border-t-2 border-[#261608] z-20 animate-fadeIn">
          <div className="text-[9px] font-pixel text-[#8b5327] font-bold px-1 mb-0.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[#261608]">
              <Sparkles className="w-3 h-3 text-[#facc15]" /> 내 소속 실시간 순위
            </span>
            <span className="text-[#22c55e] text-[8px]">실시간 반영 중</span>
          </div>

          <div
            className="p-1.5 border-3 border-[#facc15] bg-[#fef08a] shadow-[0_0_0_2px_#261608,2px_2px_0px_#261608] flex items-center justify-between transition-all"
            style={{
              boxShadow: '0 0 0 2px #261608, 2px 2px 0px #261608, 0 0 8px rgba(250, 204, 21, 0.85)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-press-start text-xs font-black text-[#b45309] w-6 text-center shrink-0">
                {myItem.rank}
              </span>

              {renderBadge(myItem, 'sm')}

              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-pixel text-xs font-black text-[#261608] truncate">
                    {myItem.name}
                  </span>
                  <span className="font-pixel text-[8px] text-[#261608] bg-[#facc15] border border-[#261608] px-1 font-black shrink-0">
                    내 소속
                  </span>
                </div>
                <span className="text-[8px] text-[#8b5327] font-pixel truncate">
                  {myItem.region}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-press-start text-[9px] text-[#261608] font-black">
                {myItem.score.toLocaleString('ko-KR')}
              </span>
              <span className="text-[8px] font-mono px-1 py-0.2 border border-[#261608] flex items-center gap-0.5 font-bold text-white bg-[#22c55e]">
                {myItem.change}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 9. Bottom Navigation Bar with '순위' active */}
      <div className="w-full px-2 pb-2 bg-[#fdf5df] border-t-2 border-[#261608] shrink-0">
        <BottomNav
          activeTab="rankings"
          onChangeTab={(tab) => {
            soundManager.playTabSound();
            onNavigateTab(tab);
          }}
          hasShopUpgrade={false}
          hasRankChange={false}
        />
      </div>
    </PhoneShell>
  );
};
