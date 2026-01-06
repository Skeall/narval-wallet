// XP rules and types (v1)
export type XpEventType =
  | "DAILY_PASSIVE"
  | "LOGIN"
  | "PARTY_CREATED"
  | "PARTY_JOINED"
  | "BET_CREATED"
  | "BET_ACCEPTED"
  | "BET_SETTLED"
  | "TRANSFER_SENT"
  | "ADMIN_GRANT"
  | "REWARD_GRANTED";

export const XP_VALUES: Record<Exclude<XpEventType, "REWARD_GRANTED">, number> = {
  DAILY_PASSIVE: 1,
  LOGIN: 2,
  PARTY_CREATED: 15,
  PARTY_JOINED: 10,
  BET_CREATED: 5,
  BET_ACCEPTED: 5,
  BET_SETTLED: 10,
  TRANSFER_SENT: 2,
  ADMIN_GRANT: 0,
};

export const XP_THRESHOLD = 100;

export interface XpStateRow {
  user_id: string;
  xp: number;
  last_daily_xp_at: string | null; // ISO date (YYYY-MM-DD) or null
  last_login_xp_at: string | null; // ISO date (YYYY-MM-DD) or null
}

export interface XpEventRow {
  id: string;
  user_id: string;
  type: XpEventType;
  value: number; // XP given, or 0 for REWARD_GRANTED
  metadata: any;
  created_at: string; // ISO
}
