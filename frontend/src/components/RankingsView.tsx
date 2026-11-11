import React, { useState, useEffect } from 'react';
import { Crown, ArrowUp, ArrowDown, Minus, RefreshCw } from 'lucide-react';
import { soundManager } from '../utils/sound';
import { getMockRankings } from '../data/mockRankings';
import { useMockGame } from '../hooks/useMockGame';
import { useMySchool } from '../hooks/useSchoolViews';

interface RankingsViewProps {
  currentSchoolScore: number;
  onCheer?: () => void;
  cheerCooldown?: number;
  onBackToCampus: () => void;
}

type RankingTab = 'school' | 'dept' | 'personal';

export const RankingsView: React.FC<RankingsViewProps> = ({
  currentSchoolScore,
  onBackToCampus,
}) => {
  const [activeRankingTab, setActiveRankingTab] = useState<RankingTab>('school');
  const [refreshCountdown, setRefreshCountdown] = useState<number>(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? 5 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const game = useMockGame();
  const mySchool = useMySchool();
  const { school: schoolRankings, dept: deptRankings, personal: personalRankings } = getMockRankings({ ...game.state, schoolScore: currentSchoolScore }, game.player);

  const [visibleCount, setVisibleCount] = useState<number>(15);

  const currentDataset =
    activeRankingTab === 'school'
      ? schoolRankings
      : activeRankingTab === 'dept'
      ? deptRankings
      : personalRankings;

  const top1 = currentDataset[0];
  const top2 = currentDataset[1];
  const top3 = currentDataset[2];
  const remainingRows = currentDataset.slice(3, activeRankingTab === 'school' ? visibleCount : 9);
  const myRow = currentDataset.find((item) => item.isMySchool) || currentDataset[6];

  const renderPixelCrest = (item: (typeof currentDataset)[0], size: 'sm' | 'md' | 'lg' = 'sm') => {
    const sizeClass =
      size === 'lg' ? 'w-10 h-10 text-sm font-black' : size === 'md' ? 'w-8 h-8 text-xs font-bold' : 'w-6 h-6 text-[10px] font-bold';

    const syllable = item.firstSyllable;
    const bgColor = item.badgeColor;

    return (
      <div
        className={`${sizeClass} border-2 border-[#261608] flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#261608] font-pixel text-white`}
        style={{ backgroundColor: bgColor }}
      >
        <span className="drop-shadow-[1px_1px_0px_#261608]">{syllable}</span>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-1.5 animate-fadeIn select-none">
      {/* Header Bar with "5초마다 갱신" and back button */}
      <div className="rpg-box p-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-pixel text-[10px] font-bold text-[#ffffff] bg-[#e11d48] border border-[#261608] px-1 shadow-[1px_1px_0px_#261608]">
            순위
          </span>
          <span className="font-pixel text-xs font-black text-[#261608]">
            전국 대항전
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-pixel text-[9px] text-[#8b5327] flex items-center gap-0.5">
            <RefreshCw className="w-2.5 h-2.5 text-[#22c55e]" />
            5초마다 갱신 ({refreshCountdown}s)
          </span>
          <button
            onClick={onBackToCampus}
            className="pixel-plaque plaque-parchment text-[10px] font-pixel font-bold px-1.5 py-0.5 text-[#261608] cursor-pointer"
          >
            돌아가기
          </button>
        </div>
      </div>

      <p className="font-pixel text-[9px] text-[#8b5327]">
        {activeRankingTab === 'school' ? '전국 학교' : activeRankingTab === 'dept' ? `${mySchool.shortName} 교내 학과` : `${mySchool.shortName} 교내 개인 · 소비 후 보유 기여도`} · 목업 샘플<br />
        점수 내림차순 → 이름 오름차순 · 동점 순위는 임시 연번 · 변경 즉시 반영
      </p>
      {/* Top 3 Pixel Tab Switcher */}
      <div className="grid grid-cols-3 gap-1 p-1 rpg-box bg-[#fdf5df]">
        <button
          onClick={() => {
            setActiveRankingTab('school');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque py-1 px-1 text-center font-pixel text-xs font-bold cursor-pointer transition-transform ${
            activeRankingTab === 'school' ? 'plaque-yellow' : 'plaque-parchment text-[#8b5327]'
          }`}
        >
          학교 순위
        </button>

        <button
          onClick={() => {
            setActiveRankingTab('dept');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque py-1 px-1 text-center font-pixel text-xs font-bold cursor-pointer transition-transform ${
            activeRankingTab === 'dept' ? 'plaque-yellow' : 'plaque-parchment text-[#8b5327]'
          }`}
        >
          교내 학과
        </button>

        <button
          onClick={() => {
            setActiveRankingTab('personal');
            soundManager.playTabSound();
          }}
          className={`pixel-plaque py-1 px-1 text-center font-pixel text-xs font-bold cursor-pointer transition-transform ${
            activeRankingTab === 'personal' ? 'plaque-yellow' : 'plaque-parchment text-[#8b5327]'
          }`}
        >
          교내 개인
        </button>
      </div>

      {/* Pixel Podium on Grassy Stage */}
      <div className="w-full border-3 border-[#261608] shadow-[2px_2px_0px_#261608] bg-[#38a134] overflow-hidden shrink-0 relative flex flex-col justify-end pt-2 pb-1 px-1.5">
        <div className="absolute inset-x-0 top-0 h-6 bg-[#38bdf8] border-b-2 border-[#261608] flex items-center justify-between px-2">
          <span className="font-pixel text-[8px] text-white font-bold">
            👑 TOP 3 명예의 전당
          </span>
          <div className="w-3 h-3 bg-[#facc15] border border-[#261608]" />
        </div>

        <div className="grid grid-cols-3 gap-1 items-end pt-5 relative z-10">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            <div className="flex flex-col items-center mb-0.5">
              {renderPixelCrest(top2, 'md')}
              <span className="font-pixel text-[10px] font-bold text-[#ffffff] drop-shadow-[1px_1px_0px_#261608] text-center truncate max-w-[75px]">
                {top2.name}
              </span>
              <span className="font-press-start text-[7px] text-[#fef08a]">
                {top2.score.toLocaleString('ko-KR')}
              </span>
            </div>
            <div className="w-full h-12 bg-[#cbd5e1] border-2 border-[#261608] shadow-[1px_1px_0px_#261608] flex flex-col items-center justify-center">
              <span className="font-press-start text-[10px] font-black text-[#261608]">2</span>
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center -mt-2">
            <Crown className="w-4 h-4 text-[#facc15] fill-[#facc15] drop-shadow-[1px_1px_0px_#261608] animate-bounce" />
            <div className="flex flex-col items-center mb-0.5">
              {renderPixelCrest(top1, 'lg')}
              <span className="font-pixel text-xs font-black text-[#fef08a] drop-shadow-[1px_1px_0px_#261608] text-center truncate max-w-[85px]">
                {top1.name}
              </span>
              <span className="font-press-start text-[8px] text-[#fef08a] font-black">
                {top1.score.toLocaleString('ko-KR')}
              </span>
            </div>
            <div className="w-full h-16 bg-[#facc15] border-2 border-[#261608] shadow-[1px_1px_0px_#261608] flex flex-col items-center justify-center">
              <span className="font-press-start text-xs font-black text-[#261608]">1</span>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            <div className="flex flex-col items-center mb-0.5">
              {renderPixelCrest(top3, 'md')}
              <span className="font-pixel text-[10px] font-bold text-[#ffffff] drop-shadow-[1px_1px_0px_#261608] text-center truncate max-w-[75px]">
                {top3.name}
              </span>
              <span className="font-press-start text-[7px] text-[#fef08a]">
                {top3.score.toLocaleString('ko-KR')}
              </span>
            </div>
            <div className="w-full h-10 bg-[#d97706] border-2 border-[#261608] shadow-[1px_1px_0px_#261608] flex flex-col items-center justify-center">
              <span className="font-press-start text-[9px] font-black text-white">3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Parchment Rows (Ranks 4–9) */}
      <div
        className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-0.5"
        onScroll={(event) => {
          // Same as the standalone ranking screen: reaching the end loads 10 more. The button stays as a fallback.
          const el = event.currentTarget;
          if (activeRankingTab !== 'school' || visibleCount >= currentDataset.length) return;
          if (el.scrollHeight - (el.scrollTop + el.clientHeight) <= 24) {
            // Several scroll events can arrive before the longer list renders; load once per rendered count.
            setVisibleCount((prev) => (prev === visibleCount ? Math.min(currentDataset.length, prev + 10) : prev));
          }
        }}
      >
        {remainingRows.map((row) => (
          <div
            key={row.name}
            className="rpg-box p-1.5 flex items-center justify-between bg-[#fdf5df] border-2"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-press-start text-[10px] font-black text-[#261608] w-5 text-center shrink-0">
                {row.rank}
              </span>
              {renderPixelCrest(row, 'sm')}
              <div className="min-w-0">
                <span className="font-pixel text-xs font-bold text-[#261608] truncate block">
                  {row.name}
                </span>
                <span className="text-[8px] text-[#8b5327] font-mono block -mt-0.5">
                  {row.mascot}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="font-press-start text-[9px] text-[#261608] font-bold">
                {row.score.toLocaleString('ko-KR')}
              </span>
              <span
                className={`text-[8px] font-mono px-0.5 py-0.2 border border-[#261608] font-bold ${
                  row.change.startsWith('▲')
                    ? 'text-[#ffffff] bg-[#22c55e]'
                    : row.change.startsWith('▼')
                    ? 'text-[#ffffff] bg-[#fb7185]'
                    : 'text-[#261608] bg-[#faecc7]'
                }`}
              >
                {row.change}
              </span>
            </div>
          </div>
        ))}

        {activeRankingTab === 'school' && visibleCount < currentDataset.length && (
          <button
            onClick={() => setVisibleCount((prev) => Math.min(currentDataset.length, prev + 10))}
            className="w-full py-1.5 text-center font-pixel text-[9px] text-[#8b5327] bg-[#faecc7]/80 hover:bg-[#faecc7] border border-dashed border-[#8b5327] cursor-pointer mt-0.5 active:translate-y-0.5"
          >
            + 10개 대학 더 불러오기 ({visibleCount} / {currentDataset.length})
          </button>
        )}
      </div>

      {/* My School Row: Pinned at bottom with glowing yellow pixel border */}
      <div
        className="p-1.5 border-3 border-[#facc15] bg-[#fef08a] shadow-[0_0_0_2px_#261608,2px_2px_0px_#261608] flex items-center justify-between mt-1"
        style={{
          boxShadow: '0 0 0 2px #261608, 2px 2px 0px #261608, 0 0 8px rgba(250, 204, 21, 0.9)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-press-start text-xs font-black text-[#261608] w-5 text-center shrink-0">
            {myRow.rank}
          </span>
          {renderPixelCrest(myRow, 'sm')}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-pixel text-xs font-black text-[#261608] truncate">
                {myRow.name}
              </span>
              <span className="text-[8px] bg-[#e11d48] text-white font-mono px-0.5 border border-[#261608] shrink-0 font-black">
                MY
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="font-press-start text-xs text-[#261608] font-black">
            {myRow.score.toLocaleString('ko-KR')}
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 border border-[#261608] text-[#ffffff] bg-[#22c55e] font-black">
            {myRow.change}
          </span>
        </div>
      </div>
    </div>
  );
};
