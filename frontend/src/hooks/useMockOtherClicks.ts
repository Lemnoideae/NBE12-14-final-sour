import { useEffect, useState } from 'react';
import { createMockOtherClicksSource, createSeededRandom, MOCK_REALTIME_CONFIG, planOtherClickParticles, type MockRealtimeConfig, type OtherClicksSource, type PlannedOtherClick } from '../data/mockRealtime';

export interface OtherClickScheduler {
  interval: (callback: () => void, ms: number) => () => void;
  timeout: (callback: () => void, ms: number) => () => void;
}
const DEFAULT_SCHEDULER: OtherClickScheduler = {
  interval: (callback, ms) => { const id = setInterval(callback, ms); return () => clearInterval(id); },
  timeout: (callback, ms) => { const id = setTimeout(callback, ms); return () => clearTimeout(id); },
};
export interface OtherClickParticle extends PlannedOtherClick { id: number }
export function useMockOtherClicks({ getMyClicksSinceLastTick, config = MOCK_REALTIME_CONFIG, source, scheduler = DEFAULT_SCHEDULER }: {
  getMyClicksSinceLastTick: () => number;
  config?: MockRealtimeConfig;
  source?: OtherClicksSource;
  scheduler?: OtherClickScheduler;
}) {
  const [defaultSource] = useState(() => createMockOtherClicksSource());
  const [particles, setParticles] = useState<OtherClickParticle[]>([]);
  const [otherClicks, setOtherClicks] = useState<number | null>(null);
  useEffect(() => {
    // 새 소스/설정으로 전환하면 이전 세대의 타이머가 취소되므로 표시도 함께 초기화한다.
    setParticles((current) => current.length ? [] : current);
    setOtherClicks(null);
    let disposed = false;
    let sequence = 0;
    const random = createSeededRandom(1831);
    const pending = new Set<() => void>();
    const schedule = (callback: () => void, ms: number) => {
      let cancel = () => {};
      cancel = scheduler.timeout(() => { pending.delete(cancel); if (!disposed) callback(); }, ms);
      pending.add(cancel);
    };
    const stop = scheduler.interval(() => {
      const myClicks = getMyClicksSinceLastTick();
      try {
        Promise.resolve((source ?? defaultSource).exchange(myClicks)).then(({ otherClicks: received }) => {
          if (disposed || !Number.isFinite(received) || received < 0) return;
          const count = Math.floor(received);
          setOtherClicks(count);
          for (const planned of planOtherClickParticles(count, config, random)) {
            const id = ++sequence;
            schedule(() => {
              setParticles((current) => config.maxActiveParticles > 0 ? [...current, { ...planned, id }].slice(-config.maxActiveParticles) : []);
              schedule(() => setParticles((current) => current.filter((particle) => particle.id !== id)), config.particleLifetimeMs);
            }, planned.delayMs);
          }
        }).catch(() => {});
      } catch { /* 요청 실패 시 해당 틱의 연출은 생략한다. */ }
    }, config.pollIntervalMs);
    return () => { disposed = true; stop(); for (const cancel of pending) cancel(); };
  }, [getMyClicksSinceLastTick, config, source, scheduler, defaultSource]);
  return { particles, otherClicks };
}
