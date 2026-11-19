import { useEffect, useId, useRef, useState, type ReactNode, type RefObject, type SubmitEvent } from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useAuthSession } from '../api/ApiProvider';
import {
  ALLIANCE_DURATION_PRESETS, ALLIANCE_ERROR_CODES, ALLIANCE_LIMITS, ALLIANCE_MAX_SCHOOLS, ALLIANCE_STATUS_LABEL, createAllianceMemory,
  createSentApplicationMemory, parseAllianceId, parseApplicationId, useAllianceDetail, useApplyToAlliance, useCreateAlliance,
  useDecideApplication, useUniversityName, validateAllianceName, type AllianceApplication, type AllianceMemory, type ApplicationDecision,
  type SentApplication, type SentApplicationMemory,
} from '../api/alliances';
import { errorMessage, fieldErrorMap, isApiError } from '../api/errors';
import { useMyInfo } from '../api/users';
import { soundManager } from '../utils/sound';
import { BottomNavFooter, type NavTab } from './BottomNav';
import { DurationPicker, formatDurationHours } from './DurationPicker';
import { LoadNotice } from './LoadNotice';
import { PhoneShell } from './PhoneShell';

// Alliance screen in API mode: create and detail (SCRUM-177), join applications by number (SCRUM-178). Plans in
// .agents/01-PLAN/261119-1123-* and -1134-*. Replaces the mock school-to-school proposal screens; the mock keeps them
// with their [시연] buttons and virtual clock.

const BUTTON = 'pixel-plaque plaque-wood min-h-11 min-w-11 px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default';
const BOX = 'rpg-box p-3 bg-[#fdf5df] border-2 border-[#261608] shadow-[2px_2px_0px_#261608] flex flex-col gap-2';
const INPUT = 'w-full min-h-12 border-2 border-[#261608] bg-white px-2 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#261608] disabled:bg-stone-100';
const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
const defaultMemory = createAllianceMemory();
const defaultApplications = createSentApplicationMemory();
const ERROR_TEXT = 'text-[#7f1d1d]';

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
  applications?: SentApplicationMemory;
  now?: () => number;
}

export function ApiAllianceScreenPhone({
  onBack, onGoToLogin, onNavigateTab, memory = defaultMemory, applications = defaultApplications, now = Date.now,
}: ApiAllianceScreenPhoneProps) {
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
        {signedIn && me.data ? <AllianceHome key={me.data.id} userId={me.data.id} universityName={me.data.university.name}
          memory={memory} applications={applications} now={now} /> : (
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

function AllianceHome({ userId, universityName, memory, applications, now }: {
  userId: number; universityName: string; memory: AllianceMemory; applications: SentApplicationMemory; now: () => number;
}) {
  const [remembered, setRemembered] = useState(() => memory.get(userId));
  const [sent, setSent] = useState(() => applications.get(userId));
  const [notice, setNotice] = useState<string | null>(null);
  const [lookedUp, setLookedUp] = useState<number | null>(null);
  const lookupInput = useRef<HTMLInputElement>(null);
  const forget = (message: string | null) => {
    memory.forget(userId);
    setRemembered(null);
    setNotice(message);
  };
  const remember = (allianceId: number, message: string) => {
    memory.set(userId, allianceId);
    setRemembered(allianceId);
    applications.forget(userId);
    setSent(null);
    setNotice(message);
  };
  const forgetSent = (message: string | null) => {
    applications.forget(userId);
    setSent(null);
    setNotice(message);
  };
  const rememberButton = (allianceId: number) => (
    <button type="button" className={BUTTON} onClick={() => remember(allianceId, `연합 #${allianceId}을(를) 우리 연합으로 기억했어요.`)}>
      우리 연합으로 기억
    </button>
  );

  return <>
    <section aria-labelledby="alliance-mine" className="flex flex-col gap-2">
      <h2 id="alliance-mine" className="text-sm font-black">우리 연합</h2>
      {notice && <p role="status" className={`${BOX} text-xs`}>{notice}</p>}
      {remembered !== null ? <>
        <AllianceDetail userId={userId} allianceId={remembered} now={now} mine
          onMissing={() => forget(`기억해 둔 연합 #${remembered}을(를) 찾을 수 없어 목록에서 지웠어요.`)}
          onForget={() => forget(null)} />
        <ApplicationDecisionForm userId={userId} allianceId={remembered} />
      </> : <>
        <p className="text-xs">
          이 브라우저에 기억한 연합이 없어요. 같은 학교 회원이 만들었거나 우리 학교가 가입한 연합은 아래 "연합 ID로 찾기"에서 찾아
          "우리 연합으로 기억"할 수 있어요.
        </p>
        {sent && <SentApplicationCard userId={userId} sent={sent} now={now} rememberButton={rememberButton(sent.allianceId)}
          onMissing={() => forgetSent(`가입 신청한 연합 #${sent.allianceId}을(를) 찾을 수 없어 신청 기억을 지웠어요.`)}
          onForget={() => forgetSent(null)} />}
        <CreateAllianceForm userId={userId} universityName={universityName}
          onCreated={(id) => remember(id, '연합을 만들었어요.')}
          onFindById={() => lookupInput.current?.focus()} />
      </>}
    </section>

    <AllianceLookup userId={userId} now={now} inputRef={lookupInput} allianceId={lookedUp} onLookup={setLookedUp}
      actions={lookedUp === null ? null : lookedUp === remembered ? <p className="text-[11px] font-bold">우리 연합이에요.</p> : <>
        <ApplyButton key={lookedUp} allianceId={lookedUp}
          onSent={(application) => {
            const next = { applicationId: application.id, allianceId: application.allianceId };
            applications.set(userId, next);
            setSent(next);
          }} />
        {rememberButton(lookedUp)}
      </>} />

    <section aria-labelledby="alliance-soon" className={`${BOX} text-xs`}>
      <h2 id="alliance-soon" className="font-black text-sm">준비 중</h2>
      <p>연합 목록, 소속 학교, 받은 가입 신청 목록, 대결은 서버 조회 기능이 생기면 열려요.</p>
    </section>
  </>;
}

/** The school's name, or its number while the name loads or when it cannot be read. */
function SchoolName({ universityId, viewerId }: { universityId: number; viewerId: number }) {
  const name = useUniversityName(universityId, viewerId);
  return <>{name.data ?? `학교 #${universityId}`}</>;
}

function SentApplicationCard({ userId, sent, now, rememberButton, onMissing, onForget }: {
  userId: number; sent: SentApplication; now: () => number; rememberButton: ReactNode; onMissing: () => void; onForget: () => void;
}) {
  return (
    <section aria-label="보낸 가입 신청" data-testid="sent-application" className={`${BOX} text-xs`}>
      <h3 className="text-sm font-black">보낸 가입 신청 #{sent.applicationId}</h3>
      <p>
        연합 #{sent.allianceId}에 가입을 신청했어요. 그 연합의 회원에게 신청 번호 <strong>#{sent.applicationId}</strong>를 알려 주세요.
        승인되면 "우리 연합으로 기억"을 눌러 연합을 보세요. 승인 여부는 서버 조회 기능이 생기면 여기에 표시돼요.
      </p>
      <AllianceDetail userId={userId} allianceId={sent.allianceId} now={now} onMissing={onMissing}
        actions={<>{rememberButton}<button type="button" className={BUTTON} onClick={onForget}>신청 기억 지우기</button></>} />
    </section>
  );
}

function ApplyButton({ allianceId, onSent }: { allianceId: number; onSent: (application: AllianceApplication) => void }) {
  const apply = useApplyToAlliance();
  const code = isApiError(apply.error) ? apply.error.code : null;
  const answered = isApiError(apply.error) && apply.error.kind === 'http';
  const reason = code === ALLIANCE_ERROR_CODES.alreadyJoined ? '우리 학교는 이미 연합에 소속돼 있어요. 한 학교는 연합 하나에만 소속될 수 있어요.'
    : code === ALLIANCE_ERROR_CODES.applicationPending ? '우리 학교가 이 연합에 보낸 가입 신청이 이미 처리를 기다리고 있어요. 같은 학교 회원이 보냈을 수 있어요.'
    : code === ALLIANCE_ERROR_CODES.full ? `이 연합은 학교 ${ALLIANCE_MAX_SCHOOLS}곳이 모두 찼어요.`
    : code === ALLIANCE_ERROR_CODES.notJoinable ? '이 연합은 지금 가입 신청을 받을 수 없어요. 대결 중이거나 만료된 연합이에요.'
    : code === ALLIANCE_ERROR_CODES.notFound ? '연합을 찾을 수 없어요.'
    : code === ALLIANCE_ERROR_CODES.notActiveUser ? '활동 중인 회원만 가입 신청할 수 있어요.'
    : `가입 신청을 보내지 못했어요. ${errorMessage(apply.error)}${answered ? '' : ' 응답을 받지 못했다면 신청이 이미 접수됐을 수 있어요. 다시 누르면 "이미 처리를 기다리는 신청"으로 알려 줘요.'}`;
  return <>
    <button type="button" className={`${BUTTON} plaque-yellow`} disabled={apply.isPending}
      onClick={() => apply.mutate(allianceId, { onSuccess: onSent })}>
      {apply.isPending ? '신청하는 중…' : '이 연합에 가입 신청'}
    </button>
    {apply.data && <p role="status" className="basis-full font-bold">가입 신청 #{apply.data.id}을(를) 보냈어요. 연합 회원에게 신청 번호 #{apply.data.id}를 알려 주세요.</p>}
    {apply.error && <p role="alert" data-testid="alliance-apply-error" className={`basis-full ${ERROR_TEXT}`}>{reason}</p>}
  </>;
}

function ApplicationDecisionForm({ userId, allianceId }: { userId: number; allianceId: number }) {
  const id = useId();
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ applicationId: number; decision: ApplicationDecision } | null>(null);
  const decide = useDecideApplication(userId);
  const done = decide.data;
  const asked = decide.variables;
  const code = isApiError(decide.error) ? decide.error.code : null;
  const answered = isApiError(decide.error) && decide.error.kind === 'http';
  const number = asked ? `#${asked.applicationId}` : '';
  const reason = code === ALLIANCE_ERROR_CODES.applicationNotFound ? `신청 ${number}을(를) 찾을 수 없어요. 번호를 확인해 주세요.`
    : code === ALLIANCE_ERROR_CODES.applicationNotPending ? `신청 ${number}은(는) 이미 처리됐어요. 승인·거절됐거나 정원이 차서 자동으로 거절된 신청이에요.`
    : code === ALLIANCE_ERROR_CODES.notMember ? '우리 학교는 이 신청을 받은 연합의 소속이 아니에요. 그 연합의 회원만 처리할 수 있어요.'
    : code === ALLIANCE_ERROR_CODES.full ? `연합 학교 ${ALLIANCE_MAX_SCHOOLS}곳이 이미 찼어요.`
    : code === ALLIANCE_ERROR_CODES.alreadyJoined ? '신청한 학교가 그사이 다른 연합에 들어갔어요.'
    : code === ALLIANCE_ERROR_CODES.notJoinable ? '지금은 이 연합이 가입 신청을 처리할 수 없어요. 대결 중이거나 만료된 연합이에요.'
    : code === ALLIANCE_ERROR_CODES.notActiveUser ? '활동 중인 회원만 가입 신청을 처리할 수 있어요.'
    : `가입 신청을 처리하지 못했어요. ${errorMessage(decide.error)}${answered ? '' : ' 응답을 받지 못했다면 이미 처리됐을 수 있어요. 다시 누르면 "이미 처리됨"으로 알려 줘요.'}`;

  const ask = (decision: ApplicationDecision) => {
    const parsed = parseApplicationId(input);
    if ('problem' in parsed) { setProblem(parsed.problem); return; }
    setProblem(null);
    setConfirming({ applicationId: parsed.applicationId, decision });
  };
  const confirm = () => {
    if (!confirming) return;
    decide.mutate(confirming, { onSuccess: () => setInput('') });
    setConfirming(null);
  };
  const verb = (decision: ApplicationDecision) => decision === 'approve' ? '승인' : '거절';

  return (
    <form noValidate onSubmit={(event) => { event.preventDefault(); ask('approve'); }} aria-label="가입 신청 처리" className={`${BOX} text-xs`}>
      <h3 className="text-sm font-black">가입 신청 처리</h3>
      <p>가입을 신청한 학교에게 받은 신청 번호를 입력하세요. 받은 신청 목록은 서버 조회 기능이 생기면 보여요.</p>
      <label htmlFor={`${id}-id`} className="font-bold">신청 번호</label>
      <input id={`${id}-id`} inputMode="numeric" autoComplete="off" value={input} disabled={decide.isPending} aria-invalid={problem !== null}
        aria-describedby={problem ? `${id}-problem` : undefined}
        onChange={(event) => { setInput(event.target.value); setProblem(null); setConfirming(null); }} className={INPUT} />
      {problem && <p id={`${id}-problem`} role="alert" className={ERROR_TEXT}>{problem}</p>}
      {confirming ? (
        <div role="group" aria-label="처리 확인" className="flex flex-col gap-1.5 border-2 border-[#261608] bg-white p-2">
          <p className="font-bold">신청 #{confirming.applicationId}을(를) {verb(confirming.decision)}할까요? 되돌릴 수 없어요.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${BUTTON} plaque-yellow`} onClick={confirm}>{verb(confirming.decision)}하기</button>
            <button type="button" className={BUTTON} onClick={() => setConfirming(null)}>취소</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={`${BUTTON} plaque-yellow`} disabled={decide.isPending}>{decide.isPending && asked?.decision === 'approve' ? '승인하는 중…' : '승인'}</button>
          <button type="button" className={BUTTON} disabled={decide.isPending} onClick={() => ask('reject')}>
            {decide.isPending && asked?.decision === 'reject' ? '거절하는 중…' : '거절'}
          </button>
        </div>
      )}
      {done && !decide.isPending && (
        <div role="status" data-testid="application-decision-result" className="flex flex-col gap-1 font-bold">
          {done.status === 'ACCEPTED' ? <>
            <p><SchoolName universityId={done.universityId} viewerId={userId} />이(가) 연합에 들어왔어요.</p>
            <p>연합 #{done.allianceId} 학교 {ALLIANCE_MAX_SCHOOLS}/{ALLIANCE_MAX_SCHOOLS} · 정원이 찼어요. 남은 대기 신청은 서버가 자동으로 거절해요.</p>
          </> : (
            <p>신청 #{done.id}(<SchoolName universityId={done.universityId} viewerId={userId} />)을(를) 거절했어요.</p>
          )}
          {done.allianceId !== allianceId && <p className="font-normal">이 신청은 우리 연합 #{allianceId}이 아니라 연합 #{done.allianceId}에 온 신청이었어요.</p>}
        </div>
      )}
      {decide.error && !decide.isPending && <p role="alert" data-testid="application-decision-error" className={ERROR_TEXT}>{reason}</p>}
    </form>
  );
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

function AllianceLookup({ userId, now, inputRef, allianceId, onLookup, actions }: {
  userId: number; now: () => number; inputRef: RefObject<HTMLInputElement | null>; allianceId: number | null; onLookup: (id: number) => void;
  actions: ReactNode;
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
      {allianceId !== null && <AllianceDetail key={allianceId} userId={userId} allianceId={allianceId} now={now} actions={actions} />}
    </section>
  );
}

function AllianceDetail({ userId, allianceId, now, mine = false, onMissing, onForget, actions }: {
  userId: number; allianceId: number; now: () => number; mine?: boolean; onMissing?: () => void; onForget?: () => void;
  /** Shown once the alliance has loaded. */
  actions?: ReactNode;
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
          {mine && <p className="text-[11px]">
            다른 학교에 이 연합 ID(#{alliance.id})를 알려 주면 "연합 ID로 찾기"에서 가입 신청할 수 있어요. 신청 번호를 받으면 아래에서 승인하거나 거절하세요.
            "이 연합 잊기"는 이 브라우저의 기억만 지우고 연합은 그대로 둬요.
          </p>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
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
