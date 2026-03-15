import type { QualLevel } from '@/types'

export const QUAL_LEVELS: QualLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high']

export const DEFAULT_COUNTRY_CONTEXT: Record<string, QualLevel> = {
  inflation_expectation: 'high',
  usd_volatility: 'high',
  country_risk_pressure: 'high',
  bank_trust_index: 'medium',
  social_panic_level: 'medium',
  liquidity_preference_shift: 'high',
  crypto_volatility: 'high',
  energy_cost_pressure: 'high',
  consumer_confidence: 'low',
  policy_uncertainty: 'high',
  labor_market_stress: 'medium',
  political_noise: 'high',
}

export const DEFAULT_COMPANY_CONTEXT: Record<string, QualLevel> = {
  wallet_yield_current: 'medium',
  wallet_yield_new: 'medium',
  competitor_yield: 'medium',
  cashback_percent: 'medium',
  cashback_cap: 'medium',
  onboarding_friction: 'low',
  KYC_friction: 'medium',
  app_stability: 'high',
  transfer_limits: 'medium',
  withdrawal_delay_risk: 'low',
  support_quality: 'medium',
  trust_baseline: 'medium',
  credit_offer_aggressiveness: 'medium',
  loan_rate_level: 'high',
}

export const ACTION_ORDER = [
  'withdraw_fast',
  'move_funds',
  'buy_crypto',
  'stay',
  'reduce_balance',
  'increase_usage',
  'exploit_promo',
  'wait_and_see',
]

export const QUAL_NUM: Record<QualLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
}
