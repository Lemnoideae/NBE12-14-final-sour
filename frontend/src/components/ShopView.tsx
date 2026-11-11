import React from 'react';
import { ShopScreenPhone } from './ShopScreenPhone';

// 메인 탭과 독립 폰 목업이 동일한 상점·상태·계산 규칙을 사용한다.
export function ShopView({ onBackToCampus }: { onBackToCampus: () => void }) {
  return (
    <div className="w-full flex flex-col gap-2 pt-1">
      <button onClick={onBackToCampus} className="pixel-plaque plaque-parchment px-2 py-1 font-pixel text-xs cursor-pointer">캠퍼스로 돌아가기</button>
      <ShopScreenPhone embedded onNavigateTab={onBackToCampus} />
    </div>
  );
}
