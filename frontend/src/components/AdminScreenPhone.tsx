import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useAuthSession } from '../api/ApiProvider';
import { useAdminPendingSupportCount } from '../api/admin';
import { errorMessage } from '../api/errors';
import { useIsAdmin, useMyInfo } from '../api/users';
import { soundManager } from '../utils/sound';
import { LoadNotice } from './LoadNotice';
import { PhoneShell } from './PhoneShell';

// Admin home in API mode (SCRUM-172, plan .agents/01-PLAN/261119-1023-scrum172_admin_entry.md). Shown only to a
// profile whose role is ADMIN; the server checks the role again on every admin call. The menu items are switched on
// by SCRUM-173 (inquiries), SCRUM-174 (member status, abuse ranking) and SCRUM-175 (test tools).

const BUTTON = 'pixel-plaque plaque-wood min-h-11 min-w-11 px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default';
const BOX = 'rpg-box p-3 bg-[#fdf5df] border-2 border-[#261608] shadow-[2px_2px_0px_#261608] flex flex-col gap-2';

/** Admin menu entries, in the order of their subtasks. */
const ADMIN_MENU: ReadonlyArray<{ label: string; detail: string }> = [
  { label: '문의 처리', detail: '문의 목록과 답변' },
  { label: '회원 정지·해제', detail: '회원 상태 변경' },
  { label: '어뷰징 순위', detail: '최근 3일 부정행위 순위' },
  { label: '테스트 도구', detail: '이 브라우저의 요청 지연·실패 주입' },
];

interface AdminScreenPhoneProps {
  onBack: () => void;
  onGoToLogin: () => void;
}

export function AdminScreenPhone({ onBack, onGoToLogin }: AdminScreenPhoneProps) {
  const signedIn = useAuthSession().status === 'signed-in';
  const me = useMyInfo();
  const isAdmin = useIsAdmin();

  if (signedIn && !me.data) {
    return <LoadNotice status={me.isError ? 'failed' : 'loading'} name="내 정보" failureDetail={errorMessage(me.error)}
      onRetry={() => void me.refetch()} onBack={onBack} backLabel="내 정보로" />;
  }

  return (
    <PhoneShell>
      <header className="bg-[#faecc7] border-b-2 border-[#261608] p-2 flex items-center gap-3 shrink-0 font-pixel text-[#261608]">
        <button type="button" onClick={() => { soundManager.playTabSound(); onBack(); }} className={BUTTON} aria-label="내 정보로 돌아가기">
          <ChevronLeft className="w-4 h-4 inline" aria-hidden="true" /> 뒤로
        </button>
        <h1 className="text-sm font-black">관리자</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 font-pixel text-[#261608]">
        {!signedIn ? (
          <div role="status" className={`${BOX} items-center text-center`}>
            <p className="text-sm font-bold">관리자 계정으로 로그인해 주세요</p>
            <button type="button" onClick={onGoToLogin} className={BUTTON}>로그인</button>
          </div>
        ) : isAdmin ? (
          <AdminHome onGoToLogin={onGoToLogin} />
        ) : (
          <p role="status" data-testid="admin-denied" className={`${BOX} text-sm font-bold text-center`}>관리자만 이용할 수 있어요.</p>
        )}
      </div>
    </PhoneShell>
  );
}

function AdminHome({ onGoToLogin }: { onGoToLogin: () => void }) {
  const { query: pending, forbidden } = useAdminPendingSupportCount();

  if (forbidden) {
    return (
      <div role="alert" data-testid="admin-forbidden" className={`${BOX} items-center text-center`}>
        <p className="text-sm font-black text-[#991b1b]">이 로그인에는 아직 관리자 권한이 없어요</p>
        <p className="text-[11px]">권한이 막 바뀌었다면 로그아웃한 뒤 다시 로그인해 주세요.</p>
        <button type="button" onClick={onGoToLogin} className={BUTTON}>로그인 화면으로</button>
      </div>
    );
  }

  return (
    <>
      <section aria-label="답변 대기 문의" className={BOX}>
        {pending.data !== undefined ? (
          <p className="text-sm font-bold">답변 대기 문의 <span data-testid="admin-pending-count">{pending.data.toLocaleString()}</span>건</p>
        ) : pending.isError ? (
          <div role="alert" className="flex flex-col gap-1.5">
            <p className="text-xs font-bold text-[#991b1b]">답변 대기 문의를 불러오지 못했어요</p>
            <p className="text-[10px] text-[#8b5327]">{errorMessage(pending.error)}</p>
            <button type="button" onClick={() => void pending.refetch()} className={`${BUTTON} self-start flex items-center gap-1`}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> 다시 시도
            </button>
          </div>
        ) : (
          <p role="status" className="text-xs">답변 대기 문의 불러오는 중…</p>
        )}
      </section>
      <nav aria-label="관리자 메뉴" className="flex flex-col gap-2">
        {ADMIN_MENU.map(({ label, detail }) => (
          <button key={label} type="button" disabled aria-describedby={`admin-menu-${label}`}
            className="pixel-plaque plaque-parchment min-h-12 px-3 py-2 text-left text-xs font-bold disabled:opacity-60 disabled:cursor-default">
            {label}
            <span id={`admin-menu-${label}`} className="block text-[10px] font-normal">{detail} · 준비 중</span>
          </button>
        ))}
      </nav>
    </>
  );
}
