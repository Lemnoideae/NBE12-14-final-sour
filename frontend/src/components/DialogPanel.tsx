import React from 'react';
import { Award } from 'lucide-react';
import { useMockGame } from '../hooks/useMockGame';

interface DialogPanelProps {
  myContribution: number;
  clickerLevel: number;
}

/** Contribution and clicker boxes. Shown in the campus stats sheet (T5); the main screen no longer has this panel. */
export const DialogPanel: React.FC<DialogPanelProps> = ({ myContribution, clickerLevel }) => {
  const { clicker, nextClicker, normalPower, activeBuff, remainingSeconds } = useMockGame();
  const cost = clicker.upgradeCost;
  const progress = cost === null ? 100 : Math.min(100, Math.floor(myContribution / cost * 100));
  const buffStatus = activeBuff ? `${activeBuff.name} · ${remainingSeconds}초 남음${activeBuff.singleUse ? ' · 다음 클릭 1회' : ''}` : '활성 버프 없음';

  return (
    <div className="w-full flex flex-col gap-2 mt-2">
      <div className="rpg-box p-2 flex items-center gap-2 shadow-[2px_2px_0px_#261608]">
        <Award className="w-7 h-7 text-[#8b5327] shrink-0" />
        <div>
          <p className="font-pixel text-[10px] text-[#8b5327]">내 누적 기여 점수 · 구매/강화 시 차감</p>
          <p className="font-pixel text-xs font-bold text-[#261608]">
            보유 기여도 <span className="font-press-start text-xs bg-[#fef08a] px-1">{myContribution.toLocaleString('ko-KR')}</span>점
          </p>
        </div>
      </div>
      <div className="rpg-box p-2 flex flex-col gap-1.5 shadow-[2px_2px_0px_#261608]">
        <div className="flex items-center justify-between font-pixel text-xs font-bold">
          <span>🖋️ 클리커 Lv.{clickerLevel}</span>
          <span className="bg-[#fef08a] px-1 border border-[#261608]">클릭당 {normalPower}점</span>
        </div>
        <p className="font-pixel text-[10px] text-[#8b5327]">기본 세기 {clicker.power}점 · 치명타 2배 · 강화는 상점에서</p>
        <div className="font-pixel text-[10px] text-[#8b5327] flex justify-between gap-1">
          <span>{nextClicker ? `다음 Lv.${nextClicker.level} · 클릭당 ${nextClicker.power}점` : '최고 단계 달성'}</span>
          <span>{cost === null ? '추가 강화 없음' : `강화 비용 ${cost.toLocaleString('ko-KR')}점`}</span>
        </div>
        <div className="h-2.5 bg-[#faecc7] border-2 border-[#261608]" role="progressbar" aria-label="다음 강화 비용 대비 보유 기여도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full bg-[#facc15]" style={{ width: `${progress}%` }} />
        </div>
        <p className="font-pixel text-[10px] text-[#8b5327]" role="status">
          {buffStatus}
        </p>
      </div>
    </div>
  );
};
