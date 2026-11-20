import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '../api/ApiProvider';
import { logout } from '../api/auth';
import { errorMessage } from '../api/errors';

type ProfileAction = 'my_info' | 'member_support' | 'login' | 'signup' | 'support_guest';

interface GameProfileBarProps {
  mode: 'member' | 'guest' | 'mock';
  nickname: string;
  onNavigate: (action: ProfileAction) => void;
  onLogout: () => void;
  onCampus: () => void;
}

function MemberProfile({ nickname, onNavigate, onLogout }: Pick<GameProfileBarProps, 'nickname' | 'onNavigate' | 'onLogout'>) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const client = useApiClient();
  const signOut = useMutation({ mutationFn: () => logout(client), onSuccess: onLogout });
  const close = () => {
    if (details.current) details.current.open = false;
  };
  const navigate = (action: ProfileAction) => {
    close();
    summary.current?.focus();
    onNavigate(action);
  };

  return (
    <details ref={details} className="game-profile" onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();
    }} onKeyDown={(event) => {
      if (event.key === 'Escape' && details.current?.open) {
        event.stopPropagation();
        close();
        summary.current?.focus();
      }
    }}>
      <summary ref={summary} className="game-workspace-action">프로필 <span className="game-profile-name">· {nickname}</span></summary>
      <div className="game-profile-actions">
        <button type="button" onClick={() => navigate('my_info')}>내 정보</button>
        <button type="button" onClick={() => navigate('member_support')}>문의</button>
        <button type="button" aria-disabled={signOut.isPending || undefined} onClick={(event) => {
          event.currentTarget.focus();
          if (!signOut.isPending) signOut.mutate();
        }}>{signOut.isPending ? '로그아웃 중…' : '로그아웃'}</button>
        {signOut.isError && <p role="alert" className="p-2 text-red-800">로그아웃하지 못했어요. {errorMessage(signOut.error)}</p>}
      </div>
    </details>
  );
}

export function GameProfileBar({ mode, nickname, onNavigate, onLogout, onCampus }: GameProfileBarProps) {
  return (
    <header className="game-top-bar game-width">
      <button type="button" onClick={onCampus} className="game-brand" aria-label="대대대 내 캠퍼스">
        <span className="game-wordmark" aria-hidden="true">대</span>
        <span className="font-black">대대대 <span className="text-xs text-[#775430]">캠퍼스 대항전</span></span>
      </button>
      <div className="ms-auto min-w-0">
        {mode === 'member' && <MemberProfile nickname={nickname} onNavigate={onNavigate} onLogout={onLogout} />}
        {mode === 'guest' && <nav aria-label="비회원 메뉴" className="flex flex-wrap gap-2">
          <button type="button" className="game-workspace-action" onClick={() => onNavigate('login')}>로그인</button>
          <button type="button" className="game-workspace-action" onClick={() => onNavigate('signup')}>가입</button>
          <button type="button" className="game-workspace-action" onClick={() => onNavigate('support_guest')}>비회원 문의</button>
        </nav>}
      </div>
    </header>
  );
}
