import React from 'react';
import { PhoneShell } from './PhoneShell';
import { BottomNavFooter, type NavTab } from './BottomNav';
import { ChevronLeft, Shield, AlertCircle, RefreshCw, UserPlus, Swords, BarChart3, Clock } from 'lucide-react';
import { useMockAlliance } from '../hooks/useMockAlliance.tsx';
import { getSchoolInfo, type AllianceRequest } from '../data/allianceModel.ts';
import { SharedImage } from './SharedImage.tsx';
import { soundManager } from '../utils/sound.ts';

interface CurrentAllianceScreenPhoneProps {
  onBack?: () => void;
  /** 하단 내비의 다른 탭으로 이동한다(T4, 계획서 §7). 없으면(단독 렌더링) 내비를 그리지 않는다. */
  onNavigateTab?: (tab: NavTab) => void;
  onNavigateToApply?: () => void;
  onNavigateToBattleApply?: () => void;
  onNavigateToBattleStatus?: () => void;
}

export const CurrentAllianceScreenPhone: React.FC<CurrentAllianceScreenPhoneProps> = ({
  onBack = () => {},
  onNavigateTab,
  onNavigateToApply = () => {},
  onNavigateToBattleApply = () => {},
  onNavigateToBattleStatus = () => {},
}) => {
  const {
    mySchoolId,
    currentAlliance,
    pendingRequests,
    cancelRequest,
    simulateLoadFailure,
    toggleSimulateLoadFailure,
    retryLoad,
  } = useMockAlliance();

  const mySchool = getSchoolInfo(mySchoolId);

  return (
    <PhoneShell>
      {/* 2. Top Header Navigation */}
      <div className="w-full bg-[#faecc7] border-b-2 border-[#261608] px-3 py-2 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundManager.playTabSound();
              onBack();
            }}
            aria-label="뒤로가기"
            className="pixel-plaque plaque-wood px-1.5 py-1 text-xs font-pixel font-bold flex items-center gap-0.5 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>뒤로</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="font-pixel text-[11px] font-black text-white bg-[#d97706] border border-[#261608] px-1 shadow-[1px_1px_0px_#261608]">
              소속
            </span>
            <h1 className="font-pixel text-sm font-black text-[#261608]">현재 연합</h1>
          </div>
        </div>

        <button
          onClick={() => {
            soundManager.playTabSound();
            onNavigateToApply();
          }}
          className="pixel-plaque plaque-yellow px-2 py-1 text-[11px] font-pixel font-bold flex items-center gap-1 cursor-pointer"
        >
          <UserPlus className="w-3 h-3 text-[#b45309]" />
          <span>연합 신청</span>
        </button>
      </div>

      {/* 3. Main Content Container */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* State: LOAD FAILURE SIMULATION */}
        {simulateLoadFailure ? (
          <div
            role="alert"
            className="rpg-box p-4 bg-[#fee2e2] border-2 border-[#991b1b] flex flex-col items-center justify-center gap-2 text-center shadow-[2px_2px_0px_#261608]"
          >
            <AlertCircle className="w-8 h-8 text-[#991b1b]" />
            <h2 className="font-pixel text-sm font-black text-[#991b1b]">연합 정보 조회 실패</h2>
            <p className="font-pixel text-xs text-[#7f1d1d]">
              네트워크 통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={() => {
                soundManager.playTabSound();
                retryLoad();
              }}
              className="pixel-plaque plaque-yellow px-3 py-1.5 text-xs font-pixel font-bold flex items-center gap-1 cursor-pointer mt-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>다시 시도</span>
            </button>
          </div>
        ) : currentAlliance ? (
          /* State: ALLIANCE FORMED */
          <div className="flex flex-col gap-3">
            {/* Alliance Card */}
            <div className="rpg-box p-3 bg-[#fefce8] border-2 border-[#261608] shadow-[3px_3px_0px_#261608] flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-[#261608]/20 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#b45309]" />
                  <h2 className="font-pixel text-sm font-black text-[#261608]">{currentAlliance.name}</h2>
                </div>
                <span className="font-pixel text-[9px] px-1.5 py-0.5 bg-[#22c55e] text-white border border-[#261608] font-bold shadow-[1px_1px_0px_#261608]">
                  결성 완료 (활성)
                </span>
              </div>

              {/* Participating Schools List */}
              <div className="flex flex-col gap-1.5">
                <span className="font-pixel text-xs font-bold text-[#8b5327]">
                  참여 학교 목록 ({currentAlliance.schoolIds.length}개교)
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {currentAlliance.schoolIds.map((schoolId) => {
                    const school = getSchoolInfo(schoolId);
                    const isMySchool = schoolId === mySchoolId;
                    return (
                      <div
                        key={schoolId}
                        className={`p-2 border border-[#261608] flex items-center justify-between bg-white shadow-[1px_1px_0px_#261608] ${
                          isMySchool ? 'ring-2 ring-[#facc15]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 border-2 border-[#261608] shadow-[1px_1px_0px_#261608] shrink-0">
                            <SharedImage
                              target={{ type: 'school', id: schoolId }}
                              name={school.name}
                              fallback={school.firstSyllable}
                              className="w-full h-full text-xs"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-pixel text-xs font-black text-[#261608]">{school.name}</span>
                              {isMySchool && (
                                <span className="font-pixel text-[8px] bg-[#facc15] border border-[#261608] px-1 font-bold">
                                  내 학교
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-pixel text-[#8b5327]">{school.region}</span>
                          </div>
                        </div>

                        <span className="font-pixel text-[10px] text-[#0284c7] font-bold">참여 중</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Placeholder Entry Points to Battle (N4 Context) */}
            <div className="rpg-box p-3 bg-white border-2 border-[#261608] shadow-[2px_2px_0px_#261608] flex flex-col gap-2">
              <span className="font-pixel text-xs font-black text-[#261608]">대결 경기 (N4)</span>
              <p className="font-pixel text-[10px] text-[#8b5327]">
                ※ 대결 신청 및 현황 기능은 다음 단계(N4)에서 지원됩니다.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTabSound();
                    onNavigateToBattleApply();
                  }}
                  className="pixel-plaque plaque-yellow p-2 text-center font-pixel text-xs font-bold flex flex-col items-center gap-1 cursor-pointer hover:bg-[#fef08a]"
                >
                  <Swords className="w-4 h-4 text-[#b45309]" />
                  <span>⚔️ 대결 신청</span>
                  <span className="text-[8px] text-[#8b5327] font-mono">대항전 신청하기</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTabSound();
                    onNavigateToBattleStatus();
                  }}
                  className="pixel-plaque plaque-wood p-2 text-center font-pixel text-xs font-bold flex flex-col items-center gap-1 cursor-pointer hover:bg-[#f5e2b8]"
                >
                  <BarChart3 className="w-4 h-4 text-[#8b5327]" />
                  <span>📊 대결 현황</span>
                  <span className="text-[8px] text-[#8b5327] font-mono">경기 일정·기록</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* State: NO ALLIANCE */
          <div className="flex flex-col gap-3">
            <div className="rpg-box p-4 bg-white border-2 border-[#261608] shadow-[3px_3px_0px_#261608] flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-12 h-12 bg-[#faecc7] border-2 border-[#261608] flex items-center justify-center rounded-none shadow-[2px_2px_0px_#261608]">
                <Shield className="w-6 h-6 text-[#8b5327]" />
              </div>
              <h2 className="font-pixel text-sm font-black text-[#261608]">소속 연합 없음</h2>
              <p className="font-pixel text-xs text-[#8b5327] max-w-[240px]">
                현재 {mySchool.name}는 소속된 연합이 없습니다. 다른 학교와 연합을 맺고 대항전에 참가해보세요!
              </p>

              <button
                onClick={() => {
                  soundManager.playTabSound();
                  onNavigateToApply();
                }}
                className="pixel-plaque plaque-yellow px-3 py-1.5 text-xs font-pixel font-black flex items-center gap-1 cursor-pointer mt-2 shadow-[2px_2px_0px_#261608]"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#b45309]" />
                <span>연합 신청하러 가기</span>
              </button>
            </div>

            {/* Pending requests if any */}
            {pendingRequests.length > 0 && (
              <div className="rpg-box p-2.5 bg-[#fefce8] border-2 border-[#261608] flex flex-col gap-2">
                <span className="font-pixel text-xs font-black text-[#b45309] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>진행 중인 연합 신청 ({pendingRequests.length}건)</span>
                </span>

                <div className="flex flex-col gap-1.5">
                  {pendingRequests.map((req: AllianceRequest) => {
                    const isRequester = req.requesterSchoolId === mySchoolId;
                    const partnerId = isRequester ? req.recipientSchoolId : req.requesterSchoolId;
                    const partnerSchool = getSchoolInfo(partnerId);

                    return (
                      <div
                        key={req.id}
                        className="p-1.5 bg-white border border-[#261608] flex items-center justify-between text-xs font-pixel"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 border border-[#261608]">
                            <SharedImage
                              target={{ type: 'school', id: partnerId }}
                              name={partnerSchool.name}
                              fallback={partnerSchool.firstSyllable}
                              className="w-full h-full text-[10px]"
                            />
                          </div>
                          <span className="font-bold text-[#261608]">{partnerSchool.name}</span>
                          <span className="text-[9px] text-[#8b5327]">{isRequester ? '(보냄)' : '(받음)'}</span>
                        </div>

                        {isRequester && (
                          <button
                            onClick={() => cancelRequest(req.id)}
                            className="px-1.5 py-0.5 bg-stone-100 border border-[#261608] text-[9px] font-bold hover:bg-stone-200 cursor-pointer"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DEMO CONTROLS (Clearly separated) */}
        <div
          role="region"
          aria-label="시연용 연합 조회 제어 영역"
          data-no-touch44
          className="rpg-box p-2.5 bg-[#fef2f2] border-2 border-dashed border-[#b91c1c] flex flex-col gap-1.5 mt-auto"
        >
          <span className="font-pixel text-[11px] font-black text-[#b91c1c]">🧪 시연 제어</span>
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[10px] text-[#7f1d1d] font-bold">조회 실패 시뮬레이션:</span>
            <button
              onClick={toggleSimulateLoadFailure}
              className={`px-2 py-0.5 border border-[#261608] text-[9px] font-pixel font-bold cursor-pointer ${
                simulateLoadFailure ? 'bg-[#b91c1c] text-white' : 'bg-white text-[#7f1d1d]'
              }`}
            >
              {simulateLoadFailure ? '오류 강제 활성화 중' : '정상 동작 중'}
            </button>
          </div>
        </div>
      </div>

      {onNavigateTab && <BottomNavFooter activeTab="alliance" onChangeTab={onNavigateTab} />}
    </PhoneShell>
  );
};
