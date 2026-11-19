import { useEffect, useId, useRef, useState, type RefObject, type SubmitEvent } from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useAuthSession } from '../api/ApiProvider';
import {
  ALLIANCE_DURATION_PRESETS, ALLIANCE_ERROR_CODES, ALLIANCE_LIMITS, ALLIANCE_STATUS_LABEL, createAllianceMemory, parseAllianceId,
  useAllianceDetail, useCreateAlliance, validateAllianceName, type AllianceMemory,
} from '../api/alliances';
import { errorMessage, fieldErrorMap, isApiError } from '../api/errors';
import { useMyInfo } from '../api/users';
import { soundManager } from '../utils/sound';
import { BottomNavFooter, type NavTab } from './BottomNav';
import { DurationPicker, formatDurationHours } from './DurationPicker';
import { LoadNotice } from './LoadNotice';
import { PhoneShell } from './PhoneShell';

// Alliance screen in API mode (SCRUM-177, plan .agents/01-PLAN/261119-1123-scrum177_alliance_create_detail.md). Replaces
// the mock school-to-school proposal screens; the mock keeps them with their [시연] buttons and virtual clock.

const BUTTON = 'pixel-plaque plaque-wood min-h-11 min-w-11 px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default';
const BOX = 'rpg-box p-3 bg-[#fdf5df] border-2 border-[#261608] shadow-[2px_2px_0px_#261608] flex flex-col gap-2';
const INPUT = 'w-full min-h-12 border-2 border-[#261608] bg-white px-2 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#261608] disabled:bg-stone-100';
const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
const defaultMemory = createAllianceMemory();

export function remainingTime(expiredAt: string, now: number): string {
  const diff = Date.parse(expiredAt) - now;
  if (!Number.isFinite(diff)) return '';
  if (diff <= 0) return '만료 시각이 지났어요';
  const minutes = Math.floor(diff / 60_000);
  return `만료까지 ${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

interface ApiAllianceScreenPhoneProps {
  onBack: () => void;
  onGoToLogin: () => void;
  onNavigateTab?: (tab: NavTab) => void;
  /** Tests pass their own storage and clock. */
  memory?: AllianceMemory;
  now?: () => number;
}

export function ApiAllianceScreenPhone({ onBack, onGoToLogin, onNavigateTab, memory = defaultMemory, now = Date.now }: ApiAllianceScreenPhoneProps) {
  const signedIn = useAuthSession().status === 'signed-in';
  const me = useMyInfo();
  if (signedIn && !me.data) return <LoadNotice status={me.isError ? 'failed' : 'loading'} name="내 정보"
    failureDetail={errorMessage(me.error)} onRetry={() => void me.refetch()} onBack={onBack} backLabel="이전 화면으로" />;
  return (
    <PhoneShell>
      <header className="bg-[#faecc7] border-b-2 border-[#261608] p-2 flex items-center gap-3 shrink-0 font-pixel text-[#261608]">
        <button type="button" onClick={() => { soundManager.playTabSound(); onBack(); }} className={BUTTON} aria-label="이전 화면으로 돌아가기">
          <ChevronLeft className="w-4 h-4 inline" aria-hidden="true" /> 뒤로
        </button>
        <h1 className="text-sm font-black">연합</h1>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3 font-pixel text-[#261608]">
        {signedIn && me.data ? <AllianceHome key={me.data.id} userId={me.data.id} universityName={me.data.university.name} memory={memory} now={now} /> : (
          <div role="status" className={`${BOX} items-center text-center`}>
            <p className="text-sm font-bold">연합을 만들거나 보려면 로그인해 주세요</p>
            <button type="button" className={BUTTON} onClick={onGoToLogin}>로그인</button>
          </div>
        )}
      </div>
      {onNavigateTab && <BottomNavFooter activeTab="alliance" onChangeTab={onNavigateTab} />}
    </PhoneShell>
  );
}

function AllianceHome({ userId, universityName, memory, now }: { userId: number; universityName: string; memory: AllianceMemory; now: () => number }) {
  const [remembered, setRemembered] = useState(() => memory.get(userId));
  const [notice, setNotice] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState<number | null>(null);
  const lookupInput = useRef<HTMLInputElement>(null);
  const forget = (message: string | null) => {
    memory.forget(userId);
    setRemembered(null);
    setNotice(message);
  };

  return <>
    <section aria-labelledby="alliance-mine" className="flex flex-col gap-2">
      <h2 id="alliance-mine" className="text-sm font-black">우리 연합</h2>
      {notice && <p role="status" className={`${BOX} text-xs`}>{notice}</p>}
      {remembered !== null ? (
        <AllianceDetail userId={userId} allianceId={remembered} now={now} mine
          onMissing={() => forget(`기억해 둔 연합 #${remembered}을(를) 찾을 수 없어 목록에서 지웠어요.`)}
          onForget={() => forget(null)} />
      ) : (
        <>
          <p className="text-xs">이 브라우저에서 만든 연합이 없어요. 같은 학교 회원이 만든 연합은 아래 "연합 ID로 찾기"에서 볼 수 있어요.</p>
          <CreateAllianceForm userId={userId} universityName={universityName}
            onCreated={(id) => { memory.set(userId, id); setRemembered(id); setNotice('연합을 만들었어요.'); }}
            onFindById={() => lookupInput.current?.focus()} />
        </>
      )}
    </section>

    <AllianceLookup userId={userId} now={now} inputRef={lookupInput} allianceId={lookedUp} onLookup={setLookedUp} />

    <section aria-labelledby="alliance-soon" className={`${BOX} text-xs`}>
      <h2 id="alliance-soon" className="font-black text-sm">준비 중</h2>
      <p>연합 목록, 소속 학교, 가입 신청과 승인, 대결은 서버 조회 기능이 생기면 열려요.</p>
    </section>
  </>;
}

function CreateAllianceForm({ userId, universityName, onCreated, onFindById }: {
  userId: number; universityName: string; onCreated: (allianceId: number) => void; onFindById: () => void;
}) {
  const id = useId();
  const [name, setName] = useState('');
  const [hours, setHours] = useState<number>(ALLIANCE_LIMITS.defaultHours);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useCreateAlliance(userId);
  const alert = useRef<HTMLDivElement>(null);
  useEffect(() => { if (problem || create.error) alert.current?.focus(); }, [problem, create.error]);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (create.isPending) return;
    const checked = validateAllianceName(name);
    if ('problem' in checked) { setProblem(checked.problem); return; }
    setProblem(null);
    create.mutate({ name: checked.name, durationHours: hours }, { onSuccess: (alliance) => onCreated(alliance.id) });
  };
  const code = isApiError(create.error) ? create.error.code : null;
  const fields = fieldErrorMap(create.error);
  const fieldReason = fields.name ?? fields.durationHours;
  // Only a request that got no server answer may have created the alliance anyway.
  const answered = isApiError(create.error) && create.error.kind === 'http';
  const length = name.trim().length;

  return (
    <form noValidate onSubmit={submit} aria-label="연합 만들기" className={`${BOX} text-xs`}>
      <p>{universityName}이(가) 창립 학교가 되는 연합을 만들어요. 연합에는 학교 2곳까지 들어갈 수 있고, 한 학교는 연합 하나에만 소속돼요.</p>
      <label htmlFor={`${id}-name`} className="font-bold">연합 이름</label>
      <input id={`${id}-name`} value={name} autoComplete="off" disabled={create.isPending} aria-invalid={problem !== null || fields.name !== undefined}
        aria-describedby={`${id}-count${problem ? ` ${id}-problem` : ''}`}
        onChange={(event) => { setName(event.target.value); setProblem(null); }} className={INPUT} />
      <p id={`${id}-count`} className={`text-[11px] ${length > ALLIANCE_LIMITS.nameMax ? 'text-[#7f1d1d] font-bold' : ''}`}>
        {length}/{ALLIANCE_LIMITS.nameMax}자 · 앞뒤 공백은 빼고 저장돼요
      </p>
      <fieldset disabled={create.isPending} className="contents">
        <DurationPicker label="연합 유지 기간" value={hours} min={ALLIANCE_LIMITS.minHours} max={ALLIANCE_LIMITS.maxHours}
          presets={ALLIANCE_DURATION_PRESETS} onChange={setHours} />
      </fieldset>
      <p className="text-[11px]">만들면 {formatDurationHours(hours)} 뒤에 만료돼요.</p>
      {problem && <div ref={alert} tabIndex={-1} id={`${id}-problem`} role="alert" className="text-[#7f1d1d]">{problem}</div>}
      {create.error && (
        <div ref={alert} tabIndex={-1} role="alert" data-testid="alliance-create-error" className="text-[#7f1d1d] flex flex-col gap-1.5">
          {code === ALLIANCE_ERROR_CODES.alreadyJoined ? <>
            <p className="font-bold">우리 학교는 이미 연합에 소속돼 있어요.</p>
            <p>한 학교는 연합 하나에만 소속될 수 있어요. 같은 학교 회원이 만들었거나 가입한 연합일 수 있어요. 연합 ID를 알면 찾아볼 수 있어요.</p>
            <button type="button" className={`${BUTTON} self-start`} onClick={onFindById}>연합 ID로 찾기</button>
          </> : code === ALLIANCE_ERROR_CODES.notActiveUser ? (
            <p>활동 중인 회원만 연합을 만들 수 있어요. {errorMessage(create.error)}</p>
          ) : (
            <p>연합을 만들지 못했어요. {fieldReason ?? errorMessage(create.error)}{answered ? '' : ' 응답을 받지 못했다면 같은 학교 연합이 이미 생겼을 수 있어요. 다시 누르기 전에 연합 ID로 확인해 보세요.'}</p>
          )}
        </div>
      )}
      <button type="submit" className={`${BUTTON} plaque-yellow`} disabled={create.isPending}>
        {create.isPending ? '만드는 중…' : '연합 만들기'}
      </button>
    </form>
  );
}

function AllianceLookup({ userId, now, inputRef, allianceId, onLookup }: {
  userId: number; now: () => number; inputRef: RefObject<HTMLInputElement | null>; allianceId: number | null; onLookup: (id: number) => void;
}) {
  const id = useId();
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseAllianceId(input);
    if ('problem' in parsed) { setProblem(parsed.problem); return; }
    setProblem(null);
    onLookup(parsed.allianceId);
  };
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-2">
      <h2 id={`${id}-title`} className="text-sm font-black">연합 ID로 찾기</h2>
      <form noValidate onSubmit={submit} aria-label="연합 ID로 찾기" className={`${BOX} text-xs`}>
        <label htmlFor={`${id}-id`} className="font-bold">연합 ID</label>
        <input ref={inputRef} id={`${id}-id`} inputMode="numeric" autoComplete="off" value={input} aria-invalid={problem !== null}
          aria-describedby={problem ? `${id}-problem` : undefined}
          onChange={(event) => { setInput(event.target.value); setProblem(null); }} className={INPUT} />
        {problem && <p id={`${id}-problem`} role="alert" className="text-[#7f1d1d]">{problem}</p>}
        <button type="submit" className={`${BUTTON} self-start`}>찾기</button>
      </form>
      {allianceId !== null && <AllianceDetail key={allianceId} userId={userId} allianceId={allianceId} now={now} />}
    </section>
  );
}

function AllianceDetail({ userId, allianceId, now, mine = false, onMissing, onForget }: {
  userId: number; allianceId: number; now: () => number; mine?: boolean; onMissing?: () => void; onForget?: () => void;
}) {
  const query = useAllianceDetail(userId, allianceId);
  const missing = isApiError(query.error) && query.error.code === ALLIANCE_ERROR_CODES.notFound;
  // Runs once when the 404 arrives; the parent passes a new callback on every render, so it is not a dependency.
  useEffect(() => { if (missing) onMissing?.(); }, [missing]);
  const alliance = query.data;

  return (
    <article aria-label={`연합 #${allianceId}`} data-testid="alliance-detail" aria-busy={query.isFetching} className={`${BOX} text-xs`}>
      {query.isPending ? <p role="status">연합 #{allianceId} 정보를 불러오는 중…</p>
        : query.isError ? (
          <div role="alert" className="flex flex-col gap-1.5">
            <p className="font-bold text-[#7f1d1d]">{missing ? `연합 #${allianceId}을(를) 찾을 수 없어요.` : '연합 정보를 불러오지 못했어요.'}</p>
            {!missing && <p>{errorMessage(query.error)}</p>}
            {!missing && <button type="button" className={`${BUTTON} self-start`} onClick={() => void query.refetch()}>다시 조회</button>}
          </div>
        ) : alliance && <>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-black break-words min-w-0">{alliance.name}</h3>
            <span data-testid="alliance-status" className="shrink-0 border-2 border-[#261608] px-1.5 py-0.5 text-[11px] font-bold bg-white">
              {ALLIANCE_STATUS_LABEL[alliance.status]}
            </span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>연합 ID</dt><dd>#{alliance.id}</dd>
            <dt>총점</dt><dd>{alliance.totalScore.toLocaleString()}점</dd>
            <dt>유지 기간</dt><dd>{formatDurationHours(alliance.durationHours)}</dd>
            <dt>만료 시각</dt><dd>{dateFormat.format(new Date(alliance.expiredAt))} (KST)</dd>
            <dt>남은 시간</dt><dd>{alliance.status === 'EXPIRED' ? '만료됨' : remainingTime(alliance.expiredAt, now())}</dd>
          </dl>
          {mine && alliance.status === 'EXPIRED' && <p>만료된 연합이에요. 이 연합을 잊으면 새 연합을 만들 수 있어요.</p>}
          {mine && <p className="text-[11px]">다른 학교에 이 연합 ID(#{alliance.id})를 알려 주면 가입 신청 기능이 열린 뒤 찾아올 수 있어요. "이 연합 잊기"는 이 브라우저의 기억만 지우고 연합은 그대로 둬요.</p>}
        </>}
      <div className="flex flex-wrap gap-2">
        {!missing && (
          <button type="button" className={`${BUTTON} flex items-center gap-1`} disabled={query.isFetching} onClick={() => void query.refetch()}>
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> {query.isFetching && !query.isPending ? '새로고침 중…' : '새로고침'}
          </button>
        )}
        {onForget && <button type="button" className={BUTTON} onClick={onForget}>이 연합 잊기</button>}
      </div>
    </article>
  );
}
