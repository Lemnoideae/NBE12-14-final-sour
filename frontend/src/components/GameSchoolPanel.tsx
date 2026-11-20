import { lazy, Suspense, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { errorMessage } from '../api/errors';
import { API_MODE, selectByMode } from '../api/mode';
import { useMyInfo } from '../api/users';
import type { SchoolView } from '../data/schoolDirectory';
import { useMockGame } from '../hooks/useMockGame';
import type { MySchoolRank } from '../hooks/useMySchoolRank';
import type { VisitSchool, VisitSchoolView } from '../hooks/useVisitSchool';
import { soundManager } from '../utils/sound';
import { ApiGuestbookBottomSheet } from './ApiGuestbookBottomSheet';
import { CampusStatsSheet } from './CampusStatsSheet';
import { ChatBottomSheet } from './ChatBottomSheet';
import { GuestbookBottomSheet } from './GuestbookBottomSheet';
import { OurSchoolGuestbookBottomSheet } from './OurSchoolGuestbookBottomSheet';
import { VisitSchoolInfoSheet, formatScore, formatVisitRank } from './VisitingParts';

// Do not load STOMP until the school chat tab is opened.
export const LazyApiChat = lazy(() => import('./ApiChatBottomSheet').then((module) => ({ default: module.ApiChatBottomSheet })));

const tabs = [
  { id: 'detail', label: '상세' },
  { id: 'chat', label: '우리 학교 채팅' },
  { id: 'guestbook', label: '방명록' },
] as const;
export type SchoolPanelTab = (typeof tabs)[number]['id'];

interface Props {
  tab: SchoolPanelTab;
  onTabChange: (tab: SchoolPanelTab) => void;
  mySchool: SchoolView;
  ranking: MySchoolRank;
  /** null means my campus; an unresolved visit must not fall back to my campus's data. */
  visit: VisitSchool | null;
  onGoToMap: () => void;
  onGoToShop: () => void;
}

export function GameSchoolPanel({ tab, onTabChange, mySchool, ranking, visit, onGoToMap, onGoToShop }: Props) {
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusedTab, setFocusedTab] = useState<SchoolPanelTab | null>(null);
  const own = useOwnSchool(mySchool);
  const visited = visit?.status === 'ready' ? visit.school : undefined;
  const choose = (next: SchoolPanelTab) => {
    onTabChange(next);
    soundManager.playTabSound();
  };
  const moveFocus = (event: KeyboardEvent, index: number) => {
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    buttons.current[next]?.focus();
  };

  return <>
    <section className="game-school-summary" aria-label="학교 요약">
      <p>{visit ? '방문 학교' : '내 학교'}</p>
      {visit ? visited && <SchoolSummary name={visited.name} score={visited.score} rank={visited.rank} change={visited.rankChange} />
        : <OwnSchoolSummary name={own.name} notice={own.notice} ranking={ranking} />}
      {visit && !visited && <VisitSchoolNotice visit={visit} />}
    </section>
    <div className="game-school-tabs" role="tablist" aria-label="학교 패널 메뉴"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedTab(null); }}>
      {tabs.map(({ id: value, label }, index) => <button key={value} ref={(node) => { buttons.current[index] = node; }}
        type="button" role="tab" id={`${id}-${value}`} aria-controls={`${id}-${value}-panel`}
        tabIndex={(focusedTab ?? tab) === value ? 0 : -1} aria-selected={tab === value} className="game-workspace-action"
        onFocus={() => setFocusedTab(value)} onKeyDown={(event) => moveFocus(event, index)} onClick={() => choose(value)}>{label}</button>)}
    </div>
    {tabs.map(({ id: value }) => <div key={value} id={`${id}-${value}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`}
      tabIndex={tab === value ? 0 : -1} hidden={tab !== value} className="game-school-tabpanel">
      {tab === value && renderTab(value)}
    </div>)}
  </>;

  function renderTab(value: SchoolPanelTab) {
    // No visit ID on this branch: the live room uses the authenticated member and stays mounted during visits.
    if (value === 'chat') return <SchoolChat mySchool={mySchool} />;
    if (visit && !visited) return <p className="p-2">방문 학교 정보를 확인하면 이용할 수 있어요.</p>;
    if (!visit && !own.ready) return <p className="p-2">내 소속을 확인하면 이용할 수 있어요.</p>;
    if (value === 'guestbook') return <SchoolGuestbook key={visited?.id ?? own.id} school={visited} mySchool={mySchool} onGoToMap={onGoToMap} />;
    if (visited) return <VisitSchoolInfoSheet key={visited.id} school={visited} extras={visit?.extras} onOpenGuestbook={() => {
      onTabChange('guestbook');
      buttons.current[2]?.focus();
    }} />;
    return <CampusStatsSheet onGoToShop={onGoToShop} />;
  }
}

function SchoolSummary({ name, score, rank, change, children }: {
  name: string; score: number | null; rank: number | null; change: string | null; children?: ReactNode;
}) {
  return <>
    <h2>{name}</h2>
    <dl>
      <dt>학교 점수</dt><dd>{score === null ? '—' : formatScore(score)}</dd>
      <dt>전국 순위</dt><dd>{children ?? formatVisitRank(rank, change)}</dd>
    </dl>
  </>;
}

function OwnSchoolSummary({ name, notice, ranking }: { name?: string; notice?: ReactNode; ranking: MySchoolRank }) {
  if (!name) return notice;
  const { scoreStatus, score, rank, change } = ranking;
  const rankLabel = { loading: '확인 중', failed: '조회 실패', unranked: '순위 없음', ready: undefined }[scoreStatus];
  return <>
    <SchoolSummary name={name} score={score} rank={rank} change={change}>{rankLabel}</SchoolSummary>
    {API_MODE === 'api' && scoreStatus === 'ready' && <p className="text-xs">순위 집계 기준</p>}
    {scoreStatus === 'failed' && <button type="button" className="game-workspace-action" onClick={ranking.retry}>점수·순위 다시 조회</button>}
  </>;
}

function VisitSchoolNotice({ visit }: { visit: VisitSchool }) {
  if (visit.status === 'not-found') return <p role="alert">학교를 찾을 수 없습니다.</p>;
  if (visit.status === 'failed') return <>
    <p role="alert">방문 학교 조회에 실패했습니다. {visit.failureDetail}</p>
    <button type="button" className="game-workspace-action" onClick={visit.retry}>방문 학교 다시 조회</button>
  </>;
  return <p role="status">방문 학교 정보를 확인하는 중이에요.</p>;
}

type OwnSchool = { id?: number; name?: string; ready: boolean; notice?: ReactNode };
const useOwnSchool = selectByMode<(school: SchoolView) => OwnSchool>({
  mock: (school) => ({ id: school.id, name: school.name, ready: true }),
  api: useApiOwnSchool,
});

function useApiOwnSchool(): OwnSchool {
  const me = useMyInfo();
  const { player } = useMockGame();
  if (me.data) return { id: me.data.university.id, name: me.data.university.name, ready: player.userId === String(me.data.id) && player.schoolId === me.data.university.id };
  return { ready: false, notice: me.isError ? <>
    <p role="alert">{errorMessage(me.error)}</p>
    <button type="button" className="game-workspace-action" onClick={() => void me.refetch()}>내 소속 다시 조회</button>
  </> : <p role="status">내 소속을 확인하는 중이에요.</p> };
}

function SchoolChat({ mySchool }: { mySchool: SchoolView }) {
  const { player } = useMockGame();
  if (API_MODE === 'api') return <Suspense fallback={<p role="status" className="p-2">채팅 화면을 여는 중이에요.</p>}><LazyApiChat schoolOnly /></Suspense>;
  return <ChatBottomSheet key={`${player.userId}:${mySchool.id}`} schoolOnly mySchoolInitial={mySchool.firstSyllable} myNickname={player.nickname} myDepartment={player.department} />;
}

function SchoolGuestbook({ school, mySchool, onGoToMap }: { school?: VisitSchoolView; mySchool: SchoolView; onGoToMap: () => void }) {
  const { player } = useMockGame();
  if (API_MODE === 'api') return <ApiGuestbookBottomSheet universityId={school?.id} schoolName={school?.name} onGoToMap={onGoToMap} />;
  if (!school) return <OurSchoolGuestbookBottomSheet mySchoolId={mySchool.id} schoolName={mySchool.name} onGoToMap={onGoToMap} />;
  return <GuestbookBottomSheet schoolId={school.id} schoolName={school.name} schoolInitial={school.firstSyllable} schoolBadgeColor={school.badgeColor}
    mySchoolId={mySchool.id} mySchoolName={mySchool.name} mySchoolInitial={mySchool.firstSyllable} mySchoolBadgeColor={mySchool.badgeColor} myNickname={player.nickname} />;
}
