import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheetDialog } from './BottomSheetDialog';
import { useMockRequest } from '../hooks/useMockRequest';
import { useTurnstileLoader } from '../hooks/useTurnstileLoader';
import { TURNSTILE_ACTIONS, turnstileSitekey, type TurnstileApi } from '../utils/turnstile';

// Click bot check (SCRUM-121, plan §3-4). The server answers a flagged click with 403 ABUSE_VERIFICATION_REQUIRED;
// the page shows this widget and sends its token to POST /api/v1/abuse/verification, then clicks go on.
// [목업] There is no server yet: the request goes through the mock request layer and does not check the token.

/** Mock request key. A second send while one is pending is refused by the request layer. */
const VERIFY_REQUEST_KEY = 'abuse-verification';

export const BOT_CHECK_FAILED_MESSAGE = '[시연] 네트워크 오류로 확인 요청이 실패했습니다. 다시 시도해 주세요.';

type Phase = 'loading' | 'challenge' | 'sending' | 'failed';

export function BotCheckDialog({ onVerified, onClose }: { onVerified: () => void; onClose: () => void }) {
  const loadTurnstile = useTurnstileLoader();
  const { run } = useMockRequest();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetRef = useRef<string | undefined>(undefined);
  const cancelRef = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [withoutWidget, setWithoutWidget] = useState(false);
  const [widgetError, setWidgetError] = useState(false);

  const onVerifiedRef = useRef(onVerified);
  useEffect(() => { onVerifiedRef.current = onVerified; }, [onVerified]);

  /**
   * Sends one token. An empty token means the widget could not load (plan P6); the server still asks Cloudflare.
   * [목업] The real client sends `{ turnstileToken }`; the mock request layer decides the result from the demo mode.
   */
  const submit = useCallback((_token: string) => {
    setWidgetError(false);
    setPhase('sending');
    const cancel = run(VERIFY_REQUEST_KEY, (ok) => {
      cancelRef.current = null;
      if (ok) onVerifiedRef.current();
      else setPhase('failed');
    });
    if (cancel) cancelRef.current = cancel;
  }, [run]);
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; }, [submit]);

  useEffect(() => {
    let active = true;
    loadTurnstile().then((api) => {
      if (!active || !containerRef.current) return;
      apiRef.current = api;
      widgetRef.current = api.render(containerRef.current, {
        sitekey: turnstileSitekey(),
        action: TURNSTILE_ACTIONS.click,
        // The widget retries on its own after an error (retry: auto), so this only tells the user.
        'error-callback': () => setWidgetError(true),
        callback: (token) => submitRef.current(token),
      });
      setPhase('challenge');
    }, () => {
      if (!active) return;
      setWithoutWidget(true);
      submitRef.current('');
    });
    return () => {
      active = false;
      cancelRef.current?.();
      if (apiRef.current && widgetRef.current !== undefined) apiRef.current.remove(widgetRef.current);
    };
  }, [loadTurnstile]);

  /** A token can be verified only once, so a retry resets the widget for a new one. */
  const retry = () => {
    if (apiRef.current && widgetRef.current !== undefined) {
      setPhase('challenge');
      apiRef.current.reset(widgetRef.current);
    } else {
      submit('');
    }
  };

  const status = phase === 'loading' ? '확인 위젯을 불러오는 중…'
    : phase === 'sending' ? (withoutWidget ? '확인 위젯을 불러오지 못해 위젯 없이 확인 중…' : '확인 중…')
    : phase === 'challenge' ? (widgetError ? '확인 위젯에 문제가 생겼어요. 잠시 후 자동으로 다시 시도합니다.' : '아래 확인을 마치면 바로 다시 클릭할 수 있어요.')
    : null;

  return (
    <BottomSheetDialog label="자동 입력 방지 확인" onClose={onClose}>
      <div data-testid="bot-check-dialog" className="p-4 flex flex-col items-center gap-3 font-pixel text-[#261608]">
        <h2 className="text-sm font-black">자동 입력 방지 확인</h2>
        <p className="text-xs text-center leading-relaxed">클릭이 평소보다 많아 사람인지 확인이 필요해요.</p>
        <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
        {status && <p data-testid="bot-check-status" role="status" className="text-[11px] text-center text-[#8b5327]">{status}</p>}
        {phase === 'failed' && (
          <>
            <p data-testid="bot-check-error" role="alert" className="text-[11px] text-center font-bold text-[#991b1b]">{BOT_CHECK_FAILED_MESSAGE}</p>
            <button type="button" onClick={retry} className="pixel-plaque plaque-yellow px-3 py-1.5 text-xs font-bold cursor-pointer">다시 시도</button>
          </>
        )}
        <p className="text-[10px] text-center text-[#8b5327]">[시연] 확인 요청은 목업입니다. 위젯 키를 설정하지 않으면 Cloudflare 테스트 키(항상 통과)를 씁니다.</p>
      </div>
    </BottomSheetDialog>
  );
}
