// 임시 목업 값이며 실제 가격, 결제 수단 또는 서버 정책이 아니다.
export interface MockBattleConfig {
  durationHours: { min: number; max: number; default: number };
  schoolCounts: readonly number[];
  startTime: { minLeadMinutes: number; maxLeadDays: number; allowedStartHoursKst: { from: number; to: number }; stepMinutes: number };
}

export interface MockShopConfig {
  coffee: { price: number; currency: 'contribution'; durationMs: number; multiplier: number };
  imagePricesKrw: { school: number; department: number; profile: number };
  battle: MockBattleConfig;
}

export const MOCK_SHOP_CONFIG: MockShopConfig = {
  coffee: { price: 120, currency: 'contribution', durationMs: 30_000, multiplier: 2 },
  imagePricesKrw: { school: 500, department: 500, profile: 500 },
  battle: {
    durationHours: { min: 6, max: 72, default: 24 },
    schoolCounts: [2, 3],
    startTime: { minLeadMinutes: 60, maxLeadDays: 7, allowedStartHoursKst: { from: 9, to: 22 }, stepMinutes: 30 }, // 임시 목업 값
  },
};
